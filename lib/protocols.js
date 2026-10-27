const crypto = require('crypto');
const { readVault, writeVault } = require('./state');

const MAX_STEPS = 40;
const MAX_STEP_LENGTH = 320;
const MAX_LOG_DAYS = 400;
const MAX_PRODUCTS = 12;
const DEFAULT_CATEGORY = 'Skincare, Health & Protocols';
const CACHED_IMAGE = /^\/media\/images\/[a-z0-9._-]+$/i;

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function doneDates(vault, id) {
  const log = vault.routine_log && typeof vault.routine_log === 'object' ? vault.routine_log : {};
  return Array.isArray(log[id]) ? log[id] : [];
}

function cleanText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function cleanSteps(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value || '').split(/\n+/);
  return raw
    .map((step) => cleanText(step, MAX_STEP_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_STEPS);
}

function cleanIds(value, wishlist) {
  if (!Array.isArray(value)) return [];
  const known = new Set((wishlist || []).map((item) => item.id));
  return [...new Set(value.filter((id) => known.has(String(id))))].slice(0, 12);
}

function cleanWebProducts(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const title = cleanText(item.title, 180);
    if (!title) return null;
    let url = '';
    try {
      const parsed = new URL(String(item.url || ''));
      if (/^https?:$/.test(parsed.protocol) && !parsed.username && !parsed.password) url = parsed.href;
    } catch (_) {}
    if (!url) return null;
    const rawPrice = Number(item.price);
    const price = Number.isFinite(rawPrice) && rawPrice > 0 && rawPrice < 1e9 ? rawPrice : null;
    const currency = /^[A-Z]{3}$/.test(String(item.currency || '')) ? String(item.currency) : '';
    const confidence = ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium';
    return {
      query: cleanText(item.query, 160),
      title,
      brand: cleanText(item.brand, 80),
      price,
      currency,
      price_source: cleanText(item.price_source, 40),
      image: CACHED_IMAGE.test(String(item.image || '')) ? String(item.image) : '',
      url,
      domain: cleanText(item.domain, 120),
      confidence,
      fetched_at: Number.isNaN(Date.parse(item.fetched_at)) ? '' : new Date(item.fetched_at).toISOString(),
    };
  }).filter(Boolean).slice(0, MAX_PRODUCTS);
}

function normalise(input, existing = {}, wishlist = []) {
  const title = cleanText(input.title ?? existing.title, 120);
  if (!title) throw new Error('Give the routine a title.');
  const steps = cleanSteps(input.steps ?? existing.steps);
  if (!steps.length) throw new Error('Add at least one routine step.');

  return {
    id: existing.id || `proto_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
    title,
    category: cleanText(input.category ?? existing.category ?? DEFAULT_CATEGORY, 100) || DEFAULT_CATEGORY,
    schedule: cleanText(input.schedule ?? existing.schedule ?? 'As needed', 100) || 'As needed',
    credibility_badge: cleanText(input.credibility_badge ?? existing.credibility_badge ?? 'User-created routine', 100) || 'User-created routine',
    source_platform: cleanText(input.source_platform ?? existing.source_platform ?? 'Pasted routine', 160) || 'Pasted routine',
    snapshot_status: cleanText(input.snapshot_status ?? existing.snapshot_status ?? 'Pasted text — no source snapshot', 160) || 'Pasted text — no source snapshot',
    conflict_alert: cleanText(input.conflict_alert ?? existing.conflict_alert ?? 'No known conflicts with your active constraints.', 500) || 'No known conflicts with your active constraints.',
    steps,
    linked_wishlist_ids: cleanIds(input.linked_wishlist_ids ?? existing.linked_wishlist_ids, wishlist),
    products: cleanWebProducts(input.products ?? existing.products),
    source_text: cleanText(input.source_text ?? existing.source_text ?? '', 6000),
    created_at: existing.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function createProtocol(input) {
  const vault = readVault();
  const protocol = normalise(input || {}, {}, vault.wishlist || []);
  vault.protocols = Array.isArray(vault.protocols) ? vault.protocols : [];
  vault.protocols.unshift(protocol);
  await writeVault(vault);
  return protocol;
}

async function updateProtocol(id, input) {
  const vault = readVault();
  const index = (vault.protocols || []).findIndex((protocol) => protocol.id === id);
  if (index < 0) throw new Error('Routine not found.');
  const protocol = normalise(input || {}, vault.protocols[index], vault.wishlist || []);
  vault.protocols[index] = protocol;
  await writeVault(vault);
  return protocol;
}

async function deleteProtocol(id) {
  const vault = readVault();
  const index = (vault.protocols || []).findIndex((protocol) => protocol.id === id);
  if (index < 0) throw new Error('Routine not found.');
  const [removed] = vault.protocols.splice(index, 1);
  if (vault.routine_log && typeof vault.routine_log === 'object') delete vault.routine_log[id];
  await writeVault(vault);
  return removed;
}

/**
 * Mark a routine done (or undone) for one local calendar day. The log is kept
 * per protocol and capped so it stays a small, readable history.
 */
async function checkRoutine(id, options = {}) {
  const vault = readVault();
  const protocol = (vault.protocols || []).find((item) => item.id === id);
  if (!protocol) throw new Error('Routine not found.');
  const date = String(options.date || localDateKey());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Use a YYYY-MM-DD date.');
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('That date is not valid.');
  const now = new Date();
  if (parsed.getTime() > now.getTime() + 36 * 60 * 60 * 1000) throw new Error('A routine cannot be completed in the future.');

  vault.routine_log = vault.routine_log && typeof vault.routine_log === 'object' ? vault.routine_log : {};
  const set = new Set(doneDates(vault, id));
  const done = options.done !== false;
  if (done) set.add(date);
  else set.delete(date);
  vault.routine_log[id] = [...set].sort().slice(-MAX_LOG_DAYS);
  await writeVault(vault);
  return {
    id,
    date,
    done,
    dates: vault.routine_log[id],
  };
}

module.exports = {
  MAX_STEPS,
  checkRoutine,
  createProtocol,
  deleteProtocol,
  doneDates,
  localDateKey,
  updateProtocol,
};
