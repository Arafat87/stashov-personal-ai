const { readClusters, writeClusters } = require('./state');

const PRODUCT_CATEGORIES = new Set([
  'Menswear & Streetwear',
  'Fragrances & Cologne',
  'Skincare, Health & Protocols',
  'Watches, Footwear & Accessories',
  'Soccer Kits & Sportswear',
  'Food, Halal & Specialty Groceries',
  'Business, Finance & Auto/Real Estate',
]);

const REFERENCE_CATEGORIES = new Set([
  'Life Hacks, Utilities & Reference',
  'Programming, Cloud & Dev Tools',
  'Career, Jobs & Interview Prep',
  'AI Models, Agents & Infra',
  'Global Sourcing & Proxies',
  'Cybersecurity & NetSec',
  'Gaming, Mods & Esports',
]);

const PRODUCT_HINTS = /(menswear|streetwear|fragrance|cologne|perfume|skincare|health|watch|footwear|accessor|soccer|sportswear|food|halal|grocer|auto|car|real estate)/i;

function defaultClusterMode(category) {
  const name = String(category || '');
  if (PRODUCT_CATEGORIES.has(name)) return 'product';
  if (REFERENCE_CATEGORIES.has(name)) return 'reference';
  return PRODUCT_HINTS.test(name) ? 'product' : 'reference';
}

function emptyStore() {
  return { version: 1, clusters: {} };
}

function normalizeStore(value) {
  const store = value && typeof value === 'object' ? value : emptyStore();
  if (!store.clusters || typeof store.clusters !== 'object' || Array.isArray(store.clusters)) {
    store.clusters = {};
  }
  return { version: 1, clusters: store.clusters };
}

function getStore() {
  return normalizeStore(readClusters());
}

function getClusterMeta(category) {
  const store = getStore();
  const saved = store.clusters[category] && typeof store.clusters[category] === 'object'
    ? store.clusters[category]
    : {};
  const fallbackMode = defaultClusterMode(category);
  const mode = saved.mode === 'product' || saved.mode === 'reference' ? saved.mode : fallbackMode;
  const heroItemId = typeof saved.hero_item_id === 'string' ? saved.hero_item_id : '';
  const cover = typeof saved.cover === 'string' ? saved.cover : '';
  return {
    mode,
    default_mode: fallbackMode,
    hero_item_id: heroItemId,
    cover,
    pinned: Boolean(heroItemId),
    custom: Boolean(cover),
    explicit_mode: Boolean(saved.mode),
  };
}

function getClusterMetaMap(categories) {
  const map = {};
  for (const category of categories || []) map[category] = getClusterMeta(category);
  return map;
}

async function replaceStore(value) {
  const store = normalizeStore(value);
  await writeClusters(store);
  return store;
}

async function updateClusterMeta(category, patch = {}) {
  const store = getStore();
  const saved = store.clusters[category] && typeof store.clusters[category] === 'object'
    ? { ...store.clusters[category] }
    : {};

  if (Object.prototype.hasOwnProperty.call(patch, 'mode')) {
    if (patch.mode === 'product' || patch.mode === 'reference') saved.mode = patch.mode;
    else delete saved.mode;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'hero_item_id')) {
    if (patch.hero_item_id) saved.hero_item_id = String(patch.hero_item_id);
    else delete saved.hero_item_id;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'cover')) {
    if (patch.cover) saved.cover = String(patch.cover);
    else delete saved.cover;
  }

  if (Object.keys(saved).length) store.clusters[category] = saved;
  else delete store.clusters[category];

  await writeClusters(store);
  return getClusterMeta(category);
}

module.exports = {
  defaultClusterMode,
  getClusterMeta,
  getClusterMetaMap,
  replaceStore,
  updateClusterMeta,
};
