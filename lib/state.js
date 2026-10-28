const fs = require('fs');
const path = require('path');
const { get, put } = require('@vercel/blob');
const { VAULT_PATH, SECTIONS_PATH, CLUSTERS_PATH, IMAGE_DIR, DATA_DIR } = require('./data-paths');

const VAULT_BLOB = 'state/vault.json';
const SECTIONS_BLOB = 'state/sections.json';
const CLUSTERS_BLOB = 'state/clusters.json';
const TELEMETRY_BLOB = 'state/telemetry.json';
const TELEMETRY_PATH = path.join(DATA_DIR, 'telemetry.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = 20;
const BACKUP_INTERVAL_MS = 10 * 60 * 1000;
const remoteEnabled = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL === '1' && process.env.BLOB_STORE_ID)
);

let vault = null;
let sections = null;
let clusters = null;
const lastBackupAt = new Map();

function readLocal(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function atomicWrite(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const descriptor = fs.openSync(tempPath, 'w');
  try {
    fs.writeFileSync(descriptor, text, 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(tempPath, filePath);
}

function pruneBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((name) => /\.json$/i.test(name))
      .map((name) => ({ name, at: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs }))
      .sort((a, b) => b.at - a.at);
    for (const file of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BACKUP_DIR, file.name));
    }
  } catch (_) {}
}

/**
 * Keep the immediately previous file as `.bak`, plus a rotating timestamped
 * snapshot at most every ten minutes. The timestamped copies survive a bad
 * write that happens after the `.bak` has already been replaced.
 */
function backupLocal(filePath, label = 'state') {
  if (!fs.existsSync(filePath)) return;
  try {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  } catch (_) {}
  const now = Date.now();
  if (now - (lastBackupAt.get(filePath) || 0) < BACKUP_INTERVAL_MS) return;
  lastBackupAt.set(filePath, now);
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const base = path.basename(filePath, '.json');
    const prefix = label && label !== base ? `${base}-${label}` : base;
    fs.copyFileSync(filePath, path.join(BACKUP_DIR, `${prefix}-${stamp}.json`));
    pruneBackups();
  } catch (_) {}
}

function writeLocal(filePath, value, options = {}) {
  const text = JSON.stringify(value, null, 2);
  if (options.backup) backupLocal(filePath, options.label);
  atomicWrite(filePath, text);
}

function snapshotFile(filePath, label) {
  if (!fs.existsSync(filePath)) return null;
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const destination = path.join(BACKUP_DIR, `${path.basename(filePath, '.json')}-${label}-${stamp}.json`);
    fs.copyFileSync(filePath, destination);
    pruneBackups();
    return destination;
  } catch (_) {
    return null;
  }
}

function blobOptions(contentType) {
  return {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  };
}

async function readBlobJson(pathname, localPath) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (result && result.statusCode === 200) {
    return JSON.parse(await new Response(result.stream).text());
  }
  const seed = readLocal(localPath);
  await put(pathname, JSON.stringify(seed, null, 2), blobOptions('application/json'));
  return seed;
}

async function readyVault(force = false) {
  if (vault && !force) return vault;
  vault = remoteEnabled ? await readBlobJson(VAULT_BLOB, VAULT_PATH) : readLocal(VAULT_PATH);
  return vault;
}

async function readySections(force = false) {
  if (sections && !force) return sections;
  sections = remoteEnabled ? await readBlobJson(SECTIONS_BLOB, SECTIONS_PATH) : readLocal(SECTIONS_PATH);
  return sections;
}

async function readyClusters(force = false) {
  if (clusters && !force) return clusters;
  clusters = remoteEnabled ? await readBlobJson(CLUSTERS_BLOB, CLUSTERS_PATH) : readLocal(CLUSTERS_PATH);
  return clusters;
}

async function ready() {
  await Promise.all([readyVault(), readySections(), readyClusters()]);
}

function readVault() {
  if (!vault) vault = readLocal(VAULT_PATH);
  return vault;
}

async function writeVault(value) {
  vault = value;
  if (remoteEnabled) {
    await put(VAULT_BLOB, JSON.stringify(value, null, 2), blobOptions('application/json'));
  } else {
    writeLocal(VAULT_PATH, value, { backup: true, label: 'vault' });
  }
  return value;
}

function readSections() {
  if (!sections) sections = readLocal(SECTIONS_PATH);
  return sections;
}

function readClusters() {
  if (!clusters) clusters = readLocal(CLUSTERS_PATH);
  return clusters;
}

async function writeSections(value) {
  sections = value;
  if (remoteEnabled) {
    await put(SECTIONS_BLOB, JSON.stringify(value, null, 2), blobOptions('application/json'));
  } else {
    writeLocal(SECTIONS_PATH, value, { backup: true, label: 'sections' });
  }
  return value;
}

async function writeClusters(value) {
  clusters = value;
  if (remoteEnabled) {
    await put(CLUSTERS_BLOB, JSON.stringify(value, null, 2), blobOptions('application/json'));
  } else {
    writeLocal(CLUSTERS_PATH, value, { backup: true, label: 'clusters' });
  }
  return value;
}

/**
 * Read the telemetry store. On Vercel the rows live in Blob storage, not on
 * the deployment's read-only disk, so the remote copy must be fetched first;
 * reading only the local file made every new row invisible after it was
 * written. The list is small, so it is deliberately not cached across calls —
 * a different serverless instance may have appended the newest row.
 */
async function readTelemetry() {
  try {
    if (remoteEnabled) {
      const result = await get(TELEMETRY_BLOB, { access: 'private', useCache: false });
      if (result && result.statusCode === 200) {
        const parsed = JSON.parse(await new Response(result.stream).text());
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    }
    const parsed = readLocal(TELEMETRY_PATH);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Telemetry used to live in the 2.4 MB vault, so every search rewrote the
 * entire file. Keep it in its own small append-only store instead.
 */
async function appendTelemetry(entry) {
  const list = await readTelemetry();
  list.unshift(entry);
  if (list.length > 50) list.length = 50;
  if (remoteEnabled) {
    await put(TELEMETRY_BLOB, JSON.stringify(list, null, 2), blobOptions('application/json'));
  } else {
    writeLocal(TELEMETRY_PATH, list);
  }
  return entry;
}

function snapshotVault(label = 'manual') {
  return snapshotFile(VAULT_PATH, label);
}

async function saveImage(fileName, buffer, contentType) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  fs.writeFileSync(path.join(IMAGE_DIR, fileName), buffer);
  if (remoteEnabled) {
    await put(`images/${fileName}`, buffer, blobOptions(contentType));
  }
}

async function readImage(fileName) {
  if (!remoteEnabled) return null;
  const result = await get(`images/${fileName}`, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return {
    buffer: Buffer.from(await new Response(result.stream).arrayBuffer()),
    contentType: result.blob.contentType,
  };
}

module.exports = {
  BACKUP_DIR,
  DATA_DIR,
  TELEMETRY_PATH,
  appendTelemetry,
  ready,
  readyVault,
  readySections,
  readyClusters,
  readVault,
  writeVault,
  readSections,
  writeSections,
  readClusters,
  writeClusters,
  readTelemetry,
  snapshotVault,
  saveImage,
  readImage,
};
