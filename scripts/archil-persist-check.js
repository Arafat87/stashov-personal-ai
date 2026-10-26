/**
 * Stashov — Archil disk persistence check.
 *
 * Proves the durable disk survives a container: a unique line is written into a
 * fresh per-job directory by one exec, then read back by a second, separate
 * exec. Each exec is a fresh container, so a match means the bytes really are
 * on the disk. Exits non-zero unless the read-back output contains the line.
 *
 * Nothing is printed but the disk name/id, the region, and the read-back; the
 * one-time mount token is never read or shown.
 *
 * Usage:
 *   npm run archil-check
 */

const crypto = require('crypto');
const archilDisk = require('../lib/archil-disk');

const DISK_NAME = String(process.env.ARCHIL_DISK_NAME || '').trim() || archilDisk.DEFAULT_DISK_NAME;

function fail(message, detail) {
  console.error(`[archil] FAILED: ${message}`);
  if (detail) console.error(detail);
  process.exitCode = 1;
}

function authHint(err) {
  if (err && err.status === 401) {
    return (
      'HTTP 401 from the Archil API. ARCHIL_API_KEY is probably a disk/mount token (adt_…)\n' +
      'instead of an API key, or a key created in another region. Create a key- key at\n' +
      'https://console.archil.com/api-keys in an AWS region, then set ARCHIL_API_KEY and the\n' +
      'matching ARCHIL_REGION.'
    );
  }
  return '';
}

async function main() {
  if (!archilDisk.isConfigured()) {
    fail(
      'ARCHIL_API_KEY is not set.\n' +
        'Get an API key (starts with key-) at https://console.archil.com/api-keys and add\n' +
        'ARCHIL_API_KEY=key-… to .env, then run `npm run archil-check` again.'
    );
    return;
  }

  const region = archilDisk.region();
  console.log(`[archil] region ${region}`);

  let disk;
  try {
    disk = process.env.ARCHIL_DISK_ID ? await archilDisk.getDisk() : await archilDisk.ensureDisk(DISK_NAME);
  } catch (err) {
    fail(err.message, authHint(err));
    return;
  }

  console.log(`[archil] disk "${disk.name}" (${disk.id})`);
  if (!process.env.ARCHIL_DISK_ID) {
    console.log(`[archil] add ARCHIL_DISK_ID=${disk.id} to .env to reuse this disk.`);
  }

  const runDir = archilDisk.jobPath('persist-check');
  const target = `${runDir}/line.txt`;
  const token = `archil-persist-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  let written;
  try {
    written = await disk.exec(`mkdir -p ${runDir} && printf '%s\\n' '${token}' > ${target}`);
  } catch (err) {
    fail(`exec #1 (write) failed: ${err.message}`, authHint(err));
    return;
  }
  if (written.exitCode !== 0) {
    fail(`exec #1 (write) exited ${written.exitCode}`, (written.stderr || '').trim());
    return;
  }
  console.log(`[archil] exec #1 wrote ${target}`);

  let readBack;
  try {
    readBack = await disk.exec(`cat ${target}`);
  } catch (err) {
    fail(`exec #2 (read) failed: ${err.message}`, authHint(err));
    return;
  }
  if (readBack.exitCode !== 0) {
    fail(`exec #2 (read) exited ${readBack.exitCode}`, (readBack.stderr || '').trim());
    return;
  }

  const got = readBack.stdout.trim();
  console.log(`[archil] exec #2 read back: ${JSON.stringify(got)}`);
  if (!got.includes(token)) {
    fail('the second exec did not return what the first exec wrote.', `wrote: ${token}`);
    return;
  }

  console.log('[archil] OK — the file survived between two separate exec containers.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[archil] failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
