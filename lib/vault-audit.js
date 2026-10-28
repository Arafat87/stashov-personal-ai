'use strict';

/**
 * The vault audit used to send category counts to Nemotron and tell the model
 * it was reading 1,337 bookmarks. It now sends the actual digest: one compact
 * line per saved link, so the 1M-context window is genuinely exercised and the
 * report can cite real titles instead of inventing them.
 */

const DEFAULT_DIGEST_LIMIT = 2000;
const BLENDED_USD_PER_MILLION = 1;

function clean(value, max) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function digestLine(bookmark) {
  const title = clean(bookmark.title || bookmark.domain || 'Untitled', 90);
  const domain = clean(bookmark.domain || '', 42);
  const category = clean(bookmark.category || '', 38);
  const section = clean(bookmark.library_section || '', 22);
  const tags = Array.isArray(bookmark.tags)
    ? bookmark.tags.slice(0, 4).map((tag) => clean(tag, 18)).filter(Boolean).join(',')
    : '';
  return [title, domain, category, section, tags].filter(Boolean).join(' | ');
}

function buildBookmarkDigest(vault, options = {}) {
  const bookmarks = Array.isArray(vault && vault.bookmarks) ? vault.bookmarks : [];
  const requested = Number(options.limit);
  const limit = Number.isFinite(requested) && requested > 0
    ? Math.floor(requested)
    : DEFAULT_DIGEST_LIMIT;
  const shown = bookmarks.slice(0, limit);
  const lines = shown.map(digestLine).filter(Boolean);
  const header = `BOOKMARK DIGEST — ${bookmarks.length.toLocaleString('en-US')} saved links, one per line: title | domain | category | library section | tags`;
  const footer = bookmarks.length > shown.length
    ? `… ${bookmarks.length - shown.length} more bookmarks not shown`
    : '';
  return [header, ...lines, footer].filter(Boolean).join('\n');
}

function buildVaultAuditMessages({ vault, question, budget, gate }) {
  const bookmarks = Array.isArray(vault && vault.bookmarks) ? vault.bookmarks : [];
  const wishlist = Array.isArray(vault && vault.wishlist) ? vault.wishlist : [];
  const protocols = Array.isArray(vault && vault.protocols) ? vault.protocols : [];
  const context = (vault && vault.personal_context) || {};
  const digest = buildBookmarkDigest(vault);

  const system = [
    'You are Stashov, a direct, data-driven personal vault auditor running on NVIDIA Nemotron 3 Ultra via Nebius Token Factory.',
    `You are given the complete digest of the user's ${bookmarks.length} saved bookmarks, plus their wishlist, routines, budget and personal constraints.`,
    'Cite concrete saved items by title or domain. Never invent a bookmark that is not in the digest. If the digest does not support a claim, say so.',
    'Prioritise duplicate purchases, owned-item overlaps, routine or ingredient conflicts, price-floor mistakes and budget risk.',
    'Answer with numbered sections and specific items. No filler, no generic advice.',
  ].join(' ');

  const user = [
    `Question: ${question}`,
    '',
    `Budget: ${JSON.stringify(budget || {})}`,
    `Gate: ${JSON.stringify(gate || {})}`,
    `Wishlist (${wishlist.length}): ${JSON.stringify(wishlist)}`,
    `Protocols (${protocols.length}): ${JSON.stringify(protocols)}`,
    `Personal context: ${JSON.stringify(context)}`,
    '',
    digest,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** Local, factual summary used only when the model call fails. No invented numbers. */
function buildFallbackReport({ vault, question, budget, gate }) {
  const bookmarks = Array.isArray(vault && vault.bookmarks) ? vault.bookmarks : [];
  const wishlist = Array.isArray(vault && vault.wishlist) ? vault.wishlist : [];
  const protocols = Array.isArray(vault && vault.protocols) ? vault.protocols : [];
  const counts = {};
  for (const bookmark of bookmarks) {
    const category = clean(bookmark.category || 'Uncategorised', 48);
    counts[category] = (counts[category] || 0) + 1;
  }
  const topCategories = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count})`)
    .join(' · ');
  const ready = wishlist.filter((item) => item.status === 'ready').slice(0, 4);
  const readyLines = ready.length
    ? ready.map((item) => {
      const price = Number(item.lowest_verified_price);
      return `• ${clean(item.title, 72)}${price > 0 ? ` — $${price.toFixed(2)}` : ' — price pending'}`;
    })
    .join('\n')
    : '• Nothing is ready to decide yet.';

  return [
    'VAULT AUDIT — DETERMINISTIC FALLBACK',
    'The Nebius call did not return a live response, so this is a local summary, not a model synthesis.',
    '',
    `Question: "${clean(question, 180)}"`,
    `Scope: ${bookmarks.length.toLocaleString('en-US')} saved bookmarks · ${wishlist.length} ${wishlist.length === 1 ? 'wish' : 'wishes'} · ${protocols.length} ${protocols.length === 1 ? 'routine' : 'routines'}.`,
    `Top categories: ${topCategories || 'No bookmarks indexed.'}`,
    `Gate: ${gate && gate.counts ? `${gate.counts.ready} ready · ${gate.counts.cooling} cooling · ${gate.counts.snoozed} snoozed` : 'No gate data.'}`,
    budget
      ? `Budget: $${Number(budget.spent || 0).toFixed(2)} spent of $${Number(budget.cap || 0).toFixed(2)} · $${Number(budget.remaining || 0).toFixed(2)} remaining.`
      : 'Budget: not available.',
    '',
    'Ready to decide now:',
    readyLines,
    '',
    'This fallback reports only what is in the vault. Check NEBIUS_API_KEY and the model endpoint, then run the audit again for the full synthesis.',
  ].join('\n');
}

/**
 * Turn a provider response into the numbers the telemetry console shows.
 * Tokens come from the provider when it reports them; a failed fallback call
 * records zero rather than a made-up 84,500. Spend is a blended estimate and
 * the Router labels it as such; override the rate with
 * TELEMETRY_USD_PER_M_TOKENS (USD per million tokens).
 */
function usageFromResult(result) {
  const usage = (result && result.usage) || null;
  const tokensIn = Math.max(0, Math.round(Number(usage && usage.prompt_tokens) || 0));
  const tokensOut = Math.max(0, Math.round(Number(usage && usage.completion_tokens) || 0));
  const configuredRate = Number(process.env.TELEMETRY_USD_PER_M_TOKENS);
  const rate = Number.isFinite(configuredRate) && configuredRate >= 0
    ? configuredRate
    : BLENDED_USD_PER_MILLION;
  const cost = Number((((tokensIn + tokensOut) / 1_000_000) * rate).toFixed(5));
  return {
    live: Boolean(result && result.live),
    latency: Math.max(0, Math.round(Number(result && result.latency_ms) || 0)),
    tokensIn,
    tokensOut,
    cost,
  };
}

module.exports = {
  buildBookmarkDigest,
  buildFallbackReport,
  buildVaultAuditMessages,
  usageFromResult,
};
