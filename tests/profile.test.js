const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const { ProfileError, updatePersonalContext } = require('../lib/profile');

function baseVault() {
  return {
    personal_context: {
      owner: 'Old Name',
      location: 'Old City',
      monthly_discretionary_budget: 300,
      spent_this_month: 85,
      default_cooling_off_days: 14,
      budget_month: '2026-10',
      sizes: { tops: 'M' },
      skin_and_health_constraints: ['Old constraint'],
      owned_inventory: [
        { id: 'own_01', name: 'Parka', category: 'Menswear', brand: 'Old Brand', notes: 'Warm', status: 'Active' },
      ],
      fragrance_profile: { loved_notes: ['Amber'], avoid_notes: ['Vanilla'] },
    },
    wishlist: [],
    spending_ledger: [],
  };
}

test('profile updates sanitize fields and preserve budget, cooling, and inventory identity', () => {
  const vault = baseVault();
  const context = updatePersonalContext(vault, {
    owner: '  New\u0000 Name  ',
    location: 'New York, NY',
    sizes: { tops: 'L', footwear: 'US 10.5' },
    skin_and_health_constraints: ['Constraint one', '  ', 'Constraint two'],
    owned_inventory: [
      { id: 'own_01', name: 'Black Parka', brand: 'New Brand', notes: 'Still warm', status: 'Active in closet' },
      { name: 'Leather boots', brand: 'Thursday', notes: 'Size 10', status: 'Active' },
    ],
    fragrance_profile: { loved_notes: ['Oud', ' Cedarwood '], avoid_notes: ['Powdery iris'] },
  });

  assert.equal(context.owner, 'New Name');
  assert.deepEqual(context.sizes, { tops: 'L', footwear: 'US 10.5' });
  assert.deepEqual(context.skin_and_health_constraints, ['Constraint one', 'Constraint two']);
  assert.equal(context.monthly_discretionary_budget, 300);
  assert.equal(context.spent_this_month, 85);
  assert.equal(context.default_cooling_off_days, 14);
  assert.equal(context.budget_month, '2026-10');
  assert.equal(context.owned_inventory[0].id, 'own_01');
  assert.equal(context.owned_inventory[0].category, 'Menswear');
  assert.equal(context.owned_inventory[0].name, 'Black Parka');
  assert.match(context.owned_inventory[1].id, /^own_/);
  assert.equal(context.owned_inventory[1].category, 'Uncategorized');
  assert.deepEqual(context.fragrance_profile.loved_notes, ['Oud', 'Cedarwood']);
  assert.deepEqual(context.fragrance_profile.avoid_notes, ['Powdery iris']);
});

test('profile validation rejects bad shapes and empty required fields', () => {
  assert.throws(() => updatePersonalContext(baseVault(), { owner: '   ' }), ProfileError);
  assert.throws(() => updatePersonalContext(baseVault(), { sizes: [] }), /Sizes must be an object/);
  assert.throws(
    () => updatePersonalContext(baseVault(), { skin_and_health_constraints: Array.from({ length: 21 }, (_, i) => `Rule ${i}`) }),
    /at most 20/
  );
  assert.throws(
    () => updatePersonalContext(baseVault(), { owned_inventory: [{ brand: 'No name' }] }),
    /name cannot be empty/
  );
  assert.throws(
    () => updatePersonalContext(baseVault(), { owned_inventory: Array.from({ length: 31 }, (_, i) => ({ name: `Item ${i}` })) }),
    /at most 30/
  );
  assert.throws(() => updatePersonalContext(baseVault(), { fragrance_profile: [] }), /Scent profile/);
});

test('profile updates do not let an empty inventory item or oversized size slip through', () => {
  assert.throws(
    () => updatePersonalContext(baseVault(), { sizes: { tops: 'x'.repeat(81) } }),
    /Size value for "tops"/
  );
  assert.throws(
    () => updatePersonalContext(baseVault(), { owned_inventory: [{ name: '   ' }] }),
    /name cannot be empty/
  );
  const context = updatePersonalContext(baseVault(), { sizes: {} });
  assert.deepEqual(context.sizes, {});
});

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashov-profile-'));
process.env.STASHOV_DATA_DIR = tempDir;
for (const name of ['vault.json', 'sections.json', 'clusters.json']) {
  fs.copyFileSync(path.join(__dirname, '..', 'data', name), path.join(tempDir, name));
}
const server = require('../server');

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: pathname,
      method: options.method || 'GET',
      headers: {
        host: `127.0.0.1:${port}`,
        ...(options.headers || {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

test('PATCH /api/context persists validated profile edits and rejects a blank name', async (t) => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const updated = await request(port, '/api/context', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      owner: 'Arafat Sani',
      location: 'New York, NY',
      sizes: { tops: 'L', footwear: 'US 10.5' },
      skin_and_health_constraints: ['Combination skin', 'Caffeine cutoff at 2 PM'],
      owned_inventory: [
        { id: 'own_01', name: 'Heavyweight Charcoal Hoodie', brand: 'BYLT', notes: 'Two in rotation', status: 'Active in closet' },
      ],
      fragrance_profile: { loved_notes: ['Oud', 'Amber'], avoid_notes: ['Synthetic vanilla'] },
    }),
  });
  assert.equal(updated.status, 200);
  const context = JSON.parse(updated.body).personal_context;
  assert.equal(context.owner, 'Arafat Sani');
  assert.equal(context.location, 'New York, NY');
  assert.equal(context.sizes.footwear, 'US 10.5');
  assert.deepEqual(context.skin_and_health_constraints, ['Combination skin', 'Caffeine cutoff at 2 PM']);
  assert.equal(context.owned_inventory[0].id, 'own_01');
  assert.equal(context.owned_inventory[0].category, 'Menswear & Streetwear');
  assert.deepEqual(context.fragrance_profile.loved_notes, ['Oud', 'Amber']);

  const persisted = await request(port, '/api/vault');
  assert.equal(persisted.status, 200);
  const vault = JSON.parse(persisted.body);
  assert.equal(vault.personal_context.owner, 'Arafat Sani');
  assert.equal(vault.budget.cap, 300);

  const invalid = await request(port, '/api/context', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner: '  ' }),
  });
  assert.equal(invalid.status, 400);
  assert.match(JSON.parse(invalid.body).error, /Name cannot be empty/);
});
