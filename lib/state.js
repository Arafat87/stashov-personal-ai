const fs = require('fs');
const path = require('path');
const { get, put } = require('@vercel/blob');
const { VAULT_PATH, SECTIONS_PATH, IMAGE_DIR } = require('./data-paths');

const VAULT_BLOB = 'state/vault.json';
const SECTIONS_BLOB = 'state/sections.json';
const remoteEnabled = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL === '1' && process.env.BLOB_STORE_ID)
);

let vault = null;
let sections = null;

function readLocal(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeLocal(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
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

async function readyVault() {
  vault = remoteEnabled ? await readBlobJson(VAULT_BLOB, VAULT_PATH) : readLocal(VAULT_PATH);
}

async function readySections() {
  sections = remoteEnabled ? await readBlobJson(SECTIONS_BLOB, SECTIONS_PATH) : readLocal(SECTIONS_PATH);
}

async function ready() {
  await Promise.all([readyVault(), readySections()]);
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
    writeLocal(VAULT_PATH, value);
  }
  return value;
}

function readSections() {
  if (!sections) sections = readLocal(SECTIONS_PATH);
  return sections;
}

async function writeSections(value) {
  sections = value;
  if (remoteEnabled) {
    await put(SECTIONS_BLOB, JSON.stringify(value, null, 2), blobOptions('application/json'));
  } else {
    writeLocal(SECTIONS_PATH, value);
  }
  return value;
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

module.exports = { ready, readyVault, readySections, readVault, writeVault, readSections, writeSections, saveImage, readImage };
