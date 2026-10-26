const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Keep tests away from the real vault. The serverless job writes telemetry and
// would otherwise dirty data/vault.json after every `npm test`.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashov-test-'));
process.env.STASHOV_DATA_DIR = tempDir;
const seedDir = path.join(__dirname, '..', 'data');
for (const name of ['vault.json', 'sections.json', 'clusters.json']) {
  fs.copyFileSync(path.join(seedDir, name), path.join(tempDir, name));
}

const { classifyBookmark, deterministicVec } = require('../scripts/sync-bookmarks');
const { runServerlessJob } = require('../jobs/nebius-serverless-worker');
const { librarySectionFor, librarySectionsWithCounts } = require('../lib/library');
const { parseRoutine } = require('../lib/routine');
const { createProtocol, updateProtocol, deleteProtocol } = require('../lib/protocols');
const { readVault } = require('../lib/state');

test('Vault contains the imported browser bookmarks organized across 14 categories', () => {
  const vaultPath = path.join(__dirname, '..', 'data', 'vault.json');
  assert.ok(fs.existsSync(vaultPath), 'vault.json should exist');
  const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
  assert.ok(vault.bookmarks.length >= 1300, `Expected >=1300 bookmarks, got ${vault.bookmarks.length}`);
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
  assert.ok(report.stats.total_bookmarks_verified >= 1300);
  assert.ok(report.top_deal_alerts.length > 0);
});

test('Library classifier separates reference links from price-tracked products', () => {
  assert.equal(librarySectionFor({
    title: 'Figma design system resources',
    category: 'Business, Finance & Auto/Real Estate',
    domain: 'figma.com',
  }), 'design');
  assert.equal(librarySectionFor({
    title: 'Coursera | Learn without limits',
    category: 'Career, Jobs & Interview Prep',
    domain: 'coursera.org',
  }), 'education');
  assert.equal(librarySectionFor({
    title: 'Stripe API documentation',
    category: 'Programming, Cloud & Dev Tools',
    domain: 'stripe.com',
  }), 'programming');
  assert.equal(librarySectionFor({
    title: "Men's Heavy Parka Coat",
    category: 'Menswear & Streetwear',
    domain: 'tokyolaundry.com',
  }), '');
  assert.equal(librarySectionFor({
    title: 'Used cars for sale',
    category: 'Business, Finance & Auto/Real Estate',
    domain: 'carmax.com',
  }), '');
});

test('Library data has a description and use-for line for every filed entry', () => {
  const vault = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'vault.json'), 'utf8'));
  const library = vault.bookmarks.filter((bookmark) => bookmark.library_section);
  assert.ok(library.length >= 900, `Expected a large reference library, got ${library.length}`);
  assert.ok(library.every((bookmark) => bookmark.description && bookmark.use_for), 'Every library entry needs a description and use-for line');
  assert.equal(library.filter((bookmark) => bookmark.site_status === 'dead').length, 0, 'Dead links should be removed');
  const sections = librarySectionsWithCounts(vault.bookmarks);
  assert.ok(sections.some((section) => section.id === 'education' && section.count > 0));
  assert.ok(sections.some((section) => section.id === 'ai' && section.count > 0));
});

test('Pasted routine is structured and gets a conflict guardrail', () => {
  const routine = parseRoutine(
    'Barrier repair AM/PM\nMorning\n1. Gentle cleanser\n2. Azelaic acid 10%\n3. SPF 50\nNight\n1. Double cleanse\n2. Adapalene 0.1%\n3. Ceramide moisturizer\nAlso use a salicylic acid peel once a week.',
    { wishlist: readVault().wishlist }
  );
  assert.equal(routine.title, 'Barrier repair AM/PM');
  assert.equal(routine.schedule, 'Daily — AM & PM');
  assert.ok(routine.steps.some((step) => step.startsWith('AM — ')));
  assert.ok(routine.steps.some((step) => step.startsWith('PM — ')));
  assert.match(routine.conflict_alert, /retinoid/i);
  assert.match(routine.conflict_alert, /exfoliating acids/i);
});

test('Protocol CRUD round-trip leaves the five seeded protocols intact', async () => {
  const created = await createProtocol({
    title: 'Test barrier routine',
    category: 'Skincare, Health & Protocols',
    schedule: 'Daily — AM & PM',
    steps: ['AM — Cleanser', 'PM — Moisturizer'],
    conflict_alert: 'Test guardrail',
  });
  assert.ok(created.id.startsWith('proto_'));
  const updated = await updateProtocol(created.id, { ...created, title: 'Test barrier routine — edited' });
  assert.equal(updated.title, 'Test barrier routine — edited');
  await deleteProtocol(created.id);
  assert.equal(readVault().protocols.length, 5);
});
