const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBookmarkDigest,
  buildFallbackReport,
  buildVaultAuditMessages,
  extractReport,
  usageFromResult,
} = require('../lib/vault-audit');

function vaultWith(overrides = {}) {
  return {
    bookmarks: [
      {
        title: 'Nebius Token Factory',
        domain: 'nebius.com',
        category: 'AI Models, Agents & Infra',
        subcategory: 'Inference',
        tags: ['ai', 'gpu'],
      },
      {
        title: 'Thursday Boot Company — Captain',
        domain: 'thursdayboots.com',
        category: 'Menswear & Streetwear',
        subcategory: 'Boots',
        tags: ['boots'],
      },
    ],
    wishlist: [
      { id: 'wl_1', title: 'Acqua di Parma', status: 'ready', lowest_verified_price: 108 },
      { id: 'wl_2', title: 'SEIKO 5 Sports', status: 'cooling', lowest_verified_price: 289 },
    ],
    protocols: [{ id: 'proto_1', title: 'Clear Skin' }],
    personal_context: { owner: 'Arafat', monthly_discretionary_budget: 300 },
    ...overrides,
  };
}

test('The digest carries every bookmark with its domain, category and tags', () => {
  const digest = buildBookmarkDigest(vaultWith());
  assert.match(digest, /^BOOKMARK DIGEST — 2 saved links/);
  assert.match(digest, /Nebius Token Factory \| nebius\.com \| AI Models, Agents & Infra/);
  assert.match(digest, /Thursday Boot Company — Captain \| thursdayboots\.com \| Menswear & Streetwear/);
  assert.match(digest, /\| ai,gpu$/m);
  assert.equal(digest.split('\n').length, 3, 'header plus one line per bookmark');
});

test('The digest clamps long fields and reports bookmarks beyond the limit', () => {
  const longTitle = 'A'.repeat(400);
  const digest = buildBookmarkDigest(vaultWith({
    bookmarks: [{ title: longTitle, domain: 'example.com', category: 'X' }],
  }));
  assert.ok(!digest.includes(longTitle), 'the 90-character clamp must apply');
  assert.match(digest, /A{90} \| example\.com/);

  const limited = buildBookmarkDigest(vaultWith({
    bookmarks: Array.from({ length: 5 }, (_, index) => ({
      title: `Bookmark ${index}`,
      domain: 'example.com',
    })),
  }), { limit: 2 });
  assert.match(limited, /… 3 more bookmarks not shown/);
});

test('The audit prompt sends the real digest and current budget/gate context', () => {
  const messages = buildVaultAuditMessages({
    vault: vaultWith(),
    question: 'What should I skip this month?',
    budget: { cap: 300, spent: 85, remaining: 215 },
    gate: { counts: { ready: 1, cooling: 1, snoozed: 0 } },
  });

  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /complete digest of the user's 2 saved bookmarks/);
  assert.match(messages[0].content, /Never invent a bookmark/);
  assert.match(messages[0].content, /Return only the finished report/);
  assert.match(messages[0].content, /@@REPORT@@/);
  assert.match(messages[0].content, /must begin with the first numbered finding/);

  const user = messages[1].content;
  assert.match(user, /Question: What should I skip this month\?/);
  assert.match(user, /Budget: \{"cap":300,"spent":85,"remaining":215\}/);
  assert.match(user, /BOOKMARK DIGEST — 2 saved links/);
  assert.match(user, /thursdayboots\.com/);
  assert.ok(!user.includes('1,337'), 'the old hardcoded bookmark count must be gone');
});

test('The report extractor drops scratch work before the marker', () => {
  const raw = 'The user wants a vault audit. Let me inspect the digest first.\n\n@@REPORT@@\n\n1. BUY NOTHING\n- The SEIKO is still cooling.';
  const report = extractReport(raw);
  assert.match(report, /^1\. BUY NOTHING/);
  assert.ok(!report.includes('The user wants'));
  assert.ok(!report.includes('@@REPORT@@'));
});

test('The report extractor leaves a clean report untouched', () => {
  const clean = '1. BUY NOTHING\n- Nothing clears the gate this week.';
  assert.equal(extractReport(clean), clean);
  assert.equal(extractReport(''), '');
  assert.equal(extractReport(null), '');
});

test('The fallback reports only data that exists in the vault', () => {
  const report = buildFallbackReport({
    vault: vaultWith(),
    question: 'Audit everything',
    budget: { cap: 300, spent: 85, remaining: 215 },
    gate: { counts: { ready: 1, cooling: 1, snoozed: 0 } },
  });
  assert.match(report, /DETERMINISTIC FALLBACK/);
  assert.match(report, /2 saved bookmarks · 2 wishes · 1 routine/);
  assert.match(report, /Acqua di Parma — \$108\.00/);
  assert.match(report, /\$85\.00 spent of \$300\.00 · \$215\.00 remaining/);
  assert.match(report, /1 ready · 1 cooling · 0 snoozed/);
  assert.ok(!report.includes('1,337'), 'the fallback must not claim stale counts');
  assert.ok(!report.includes('NEMOTRON 3 ULTRA (1M-CONTEXT)'), 'the fallback must not impersonate the model');
});

test('Telemetry uses provider token counts and records zero when the call fails', () => {
  const live = usageFromResult({
    live: true,
    latency_ms: 2400,
    usage: { prompt_tokens: 120, completion_tokens: 30 },
  });
  assert.deepEqual(live, { live: true, latency: 2400, tokensIn: 120, tokensOut: 30, cost: 0.00015 });

  const failed = usageFromResult({ live: false, latency_ms: 380, content: null });
  assert.deepEqual(failed, { live: false, latency: 380, tokensIn: 0, tokensOut: 0, cost: 0 });
});
