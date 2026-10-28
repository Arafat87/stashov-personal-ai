const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashov-state-'));
process.env.STASHOV_DATA_DIR = tempDir;
for (const name of ['vault.json', 'sections.json', 'clusters.json']) {
  fs.copyFileSync(path.join(__dirname, '..', 'data', name), path.join(tempDir, name));
}

const { BACKUP_DIR, TELEMETRY_PATH, appendTelemetry, readTelemetry, writeVault } = require('../lib/state');

test('a second vault write keeps the previous file as .bak and creates a rotating snapshot', async () => {
  const first = { bookmarks: [], wishlist: [], protocols: [], marker: 'first' };
  const second = { bookmarks: [], wishlist: [], protocols: [], marker: 'second' };
  await writeVault(first);
  await writeVault(second);

  const current = JSON.parse(fs.readFileSync(path.join(tempDir, 'vault.json'), 'utf8'));
  const backup = JSON.parse(fs.readFileSync(path.join(tempDir, 'vault.json.bak'), 'utf8'));
  assert.equal(current.marker, 'second');
  assert.equal(backup.marker, 'first');

  const snapshots = fs.readdirSync(BACKUP_DIR).filter((name) => name.startsWith('vault-'));
  assert.ok(snapshots.length >= 1, 'expected at least one rotating vault snapshot');
});

test('telemetry stays out of the vault and is capped at 50 entries', async () => {
  const vault = JSON.parse(fs.readFileSync(path.join(tempDir, 'vault.json'), 'utf8'));
  assert.equal(vault.telemetry, undefined);
  for (let index = 0; index < 55; index += 1) {
    await appendTelemetry({ id: `tel_${index}`, task: 'test' });
  }
  const entries = await readTelemetry();
  assert.equal(entries.length, 50);
  assert.equal(entries[0].id, 'tel_54');
  assert.ok(fs.existsSync(TELEMETRY_PATH));
});
