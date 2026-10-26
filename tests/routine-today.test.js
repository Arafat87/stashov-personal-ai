const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashov-routine-'));
process.env.STASHOV_DATA_DIR = tempDir;
for (const name of ['vault.json', 'sections.json', 'clusters.json']) {
  fs.copyFileSync(path.join(__dirname, '..', 'data', name), path.join(tempDir, name));
}

const { checkRoutine, doneDates, localDateKey } = require('../lib/protocols');
const { readVault } = require('../lib/state');

test('a routine can be checked off and unchecked for today', async () => {
  const today = localDateKey();
  const checked = await checkRoutine('proto_01', { date: today, done: true });
  assert.equal(checked.done, true);
  assert.deepEqual(doneDates(readVault(), 'proto_01'), [today]);
  assert.equal(readVault().routine_log.proto_01.length, 1);

  const unchecked = await checkRoutine('proto_01', { date: today, done: false });
  assert.equal(unchecked.done, false);
  assert.deepEqual(doneDates(readVault(), 'proto_01'), []);
});

test('routine check-offs reject unknown routines and impossible dates', async () => {
  await assert.rejects(checkRoutine('proto_missing', { done: true }), /Routine not found/);
  await assert.rejects(checkRoutine('proto_01', { date: '26-10-2026', done: true }), /YYYY-MM-DD/);
  await assert.rejects(checkRoutine('proto_01', { date: '2999-01-01', done: true }), /future/);
});

test('the log is capped and sorted', async () => {
  const today = localDateKey();
  const vault = readVault();
  vault.routine_log = vault.routine_log || {};
  vault.routine_log.proto_01 = Array.from({ length: 400 }, (_, index) => `2020-01-${String((index % 28) + 1).padStart(2, '0')}`).sort();
  vault.routine_log.proto_01.push(today);
  await checkRoutine('proto_01', { date: today, done: true });
  assert.ok(readVault().routine_log.proto_01.length <= 400);
});
