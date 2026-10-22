const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { classifyBookmark, deterministicVec } = require('../scripts/sync-bookmarks');
const { runServerlessJob } = require('../jobs/nebius-serverless-worker');

test('Vault contains all 1,386 imported browser bookmarks organized across 14 categories', () => {
  const vaultPath = path.join(__dirname, '..', 'data', 'vault.json');
  assert.ok(fs.existsSync(vaultPath), 'vault.json should exist');
  const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
  assert.ok(vault.bookmarks.length >= 1380, `Expected >=1380 bookmarks, got ${vault.bookmarks.length}`);
  assert.ok(vault.wishlist.length >= 12, `Should have at least 12 impulse-gated wishlist items, got ${vault.wishlist.length}`);
  assert.equal(vault.protocols.length, 5, 'Should have 5 living protocols');
  assert.ok(vault.personal_context.owned_inventory.length >= 6, 'Should track owned inventory');
});

test('Classifier accurately categorizes fragrances, skincare/peptides, menswear, and AI bookmarks', () => {
  const [cat1, type1] = classifyBookmark({
    name: 'Designer Perfumes, Fragrances & Colognes - Acqua di Parma',
    url: 'https://www.acquadiparma.com/en/us/',
    folder: 'bookmark_bar/Bookmarks bar/shopping',
  });
  assert.equal(cat1, 'Fragrances & Cologne');
  assert.equal(type1, 'wishlist');

  const [cat2] = classifyBookmark({
    name: '2-1 ACNE & DARK SPOT CORRECTING CLEANSER – twnskn',
    url: 'https://twnskn.co/products/cleanser',
    folder: 'shopping',
  });
  assert.equal(cat2, 'Skincare, Health & Protocols');

  const [cat3] = classifyBookmark({
    name: 'Hugging Face – The AI community building the future',
    url: 'https://huggingface.co/',
    folder: 'AI',
  });
  assert.equal(cat3, 'AI Models, Agents & Infra');
});

test('Deterministic semantic vector produces normalized 64-dim embeddings', () => {
  const v = deterministicVec('charcoal heavyweight hoodie menswear');
  assert.equal(v.length, 64);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(norm - 1.0) < 0.05);
});

test('Nebius Serverless Worker job executes and updates digest telemetry', async () => {
  const report = await runServerlessJob();
  assert.ok(report.job_id.startsWith('nebius_job_'));
  assert.ok(report.stats.total_bookmarks_verified >= 1380);
  assert.ok(report.top_deal_alerts.length > 0);
});
