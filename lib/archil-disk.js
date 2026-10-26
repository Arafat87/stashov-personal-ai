/**
 * Stashov — Archil disk storage.
 *
 * Durable server-side storage for files that must outlive a single run: the
 * disk outlives the process (and the serverless container) that wrote to it,
 * so a file written now is still there for the next request or job. The module
 * stays deliberately small — resolve the configured disk, run a command on it,
 * and read/write files as objects.
 *
 * Credentials live server-side only: the API key comes from ARCHIL_API_KEY
 * (starts with `key-`), the disk from ARCHIL_DISK_ID, the region from
 * ARCHIL_REGION. Never expose this module to the browser and never rename the
 * variable with a public marker.
 */

const path = require('path');
const dotenv = require('dotenv');
const archil = require('disk');

// `.env` is shared, `.env.local` is the per-machine override (both gitignored).
dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const DEFAULT_REGION = 'aws-us-east-1';
const DEFAULT_DISK_NAME = 'stashov-vault';
const PLACEHOLDER_KEY = 'your_archil_api_key_here';

class ArchilDiskError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'ArchilDiskError';
    this.status = status;
  }
}

function apiKey() {
  const key = String(process.env.ARCHIL_API_KEY || '').trim();
  if (!key || key === PLACEHOLDER_KEY) {
    throw new ArchilDiskError(
      'ARCHIL_API_KEY is not set. Add an Archil API key (starts with key-) to .env and restart.'
    );
  }
  if (!key.startsWith('key-')) {
    throw new ArchilDiskError(
      'ARCHIL_API_KEY does not look like an Archil API key: it must start with "key-". Disk/mount tokens get HTTP 401 from the API.'
    );
  }
  return key;
}

function region() {
  return String(process.env.ARCHIL_REGION || '').trim() || DEFAULT_REGION;
}

/** Whether a usable Archil API key is present in the environment. */
function isConfigured() {
  const key = String(process.env.ARCHIL_API_KEY || '').trim();
  return Boolean(key && key !== PLACEHOLDER_KEY);
}

/** Point the SDK at the configured key and region. */
function configure() {
  archil.configure({ apiKey: apiKey(), region: region() });
  return { region: region() };
}

function diskId() {
  return String(process.env.ARCHIL_DISK_ID || '').trim();
}

/** Fetch the disk named by ARCHIL_DISK_ID. */
async function getDisk(id = diskId()) {
  configure();
  if (!id) {
    throw new ArchilDiskError(
      'ARCHIL_DISK_ID is not set. Run `npm run archil-check` once to create a disk, then put its dsk-… id in .env.'
    );
  }
  try {
    return await archil.getDisk(id);
  } catch (err) {
    throw new ArchilDiskError(`Could not load Archil disk ${id}: ${err.message}`, err.status || 502);
  }
}

/**
 * Reuse the named disk when the account already has it, otherwise create it.
 * The mount token the SDK returns is one-time and not needed for exec, so it is
 * never stored or printed here.
 */
async function ensureDisk(name = String(process.env.ARCHIL_DISK_NAME || '').trim() || DEFAULT_DISK_NAME) {
  configure();
  try {
    const existing = await archil.listDisks({ name });
    const match = existing.find((disk) => disk.name === name);
    if (match) return match;
    const { disk } = await archil.createDisk({ name });
    return disk;
  } catch (err) {
    throw new ArchilDiskError(`Could not resolve Archil disk "${name}": ${err.message}`, err.status || 502);
  }
}

/** A fresh per-job directory: exec mounts share the disk, so each job writes its own path. */
function jobPath(prefix = 'jobs') {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const suffix = Math.random().toString(16).slice(2, 8);
  return `${prefix}/${stamp}-${suffix}`;
}

/**
 * Run a command in a fresh container with the disk mounted (working directory
 * is the disk root). Files persist, container state does not.
 */
async function runCommand(command, options = {}) {
  const disk = options.disk || (await getDisk());
  const result = await disk.exec(command);
  return {
    disk_id: disk.id,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exit_code: result.exitCode,
    timing: result.timing || null,
  };
}

/** Write a text file onto the disk (creates parent directories as needed). */
async function writeFile(key, body, options = {}) {
  const disk = options.disk || (await getDisk());
  const put = { contentType: options.contentType || 'text/plain; charset=utf-8' };
  if (options.mode !== undefined) put.mode = options.mode;
  await disk.putObject(key, typeof body === 'string' ? body : String(body), put);
  return { disk_id: disk.id, key };
}

/** Read a text file back from the disk. */
async function readFile(key, options = {}) {
  const disk = options.disk || (await getDisk());
  const bytes = await disk.getObject(key);
  return Buffer.from(bytes).toString('utf8');
}

module.exports = {
  ArchilDiskError,
  DEFAULT_DISK_NAME,
  DEFAULT_REGION,
  configure,
  ensureDisk,
  getDisk,
  isConfigured,
  jobPath,
  readFile,
  region,
  runCommand,
  writeFile,
};
