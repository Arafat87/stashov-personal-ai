const crypto = require('crypto');
const { readSections, writeSections } = require('./state');
const { SECTIONS_PATH } = require('./data-paths');
const ICONS = ['i-deck', 'i-vault', 'i-book', 'i-gate', 'i-pulse', 'i-fingerprint', 'i-spark', 'i-router', 'i-search', 'i-command', 'i-coin', 'i-lock', 'i-clock', 'i-alert', 'i-code', 'i-briefcase'];
const DEFAULT_COLOR = '#c6ff4a';

const BUILTINS = [
  ['deck', 'Deck', 'i-deck', '#c6ff4a'],
  ['vault', 'Vault', 'i-vault', '#63e6ff'],
  ['library', 'Library', 'i-book', '#8ab4ff'],
  ['wishlist', 'Gate', 'i-gate', '#ffc35c'],
  ['protocols', 'Rules', 'i-pulse', '#a98bff'],
  ['context', 'You', 'i-fingerprint', '#ff6b8a'],
  ['ingest', 'Capture', 'i-spark', '#52f2ab'],
  ['router', 'Router', 'i-router', '#8ab4ff'],
];

function cleanText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function cleanColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : DEFAULT_COLOR;
}

function cleanUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\/media\/images\/[a-z0-9._-]+$/i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

function cleanTags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  const unique = [];
  for (const item of list) {
    const tag = cleanText(item, 24).replace(/^#/, '');
    if (tag && !unique.some((existing) => existing.toLowerCase() === tag.toLowerCase())) unique.push(tag);
    if (unique.length >= 8) break;
  }
  return unique;
}

function cleanCard(card) {
  const source = card && typeof card === 'object' ? card : {};
  return {
    id: /^card_[a-z0-9_]+$/i.test(String(source.id || '')) ? source.id : `card_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
    title: cleanText(source.title, 90),
    description: cleanText(source.description, 260),
    image: cleanUrl(source.image),
    url: cleanUrl(source.url),
    price: cleanText(source.price, 24),
    status: cleanText(source.status, 24),
    color: cleanColor(source.color || DEFAULT_COLOR),
    tags: cleanTags(source.tags),
  };
}

function defaultSections() {
  return BUILTINS.map(([id, label, icon, color], order) => ({
    id,
    builtin: true,
    label,
    icon,
    logo: '',
    color,
    tags: [],
    description: '',
    visible: true,
    order,
    cards: [],
  }));
}

function mergeSections(raw) {
  const stored = Array.isArray(raw) ? raw : [];
  const merged = defaultSections().map((base) => {
    const saved = stored.find((section) => section && section.id === base.id);
    return saved
      ? {
          ...base,
          label: cleanText(saved.label, 18) || base.label,
          icon: ICONS.includes(saved.icon) ? saved.icon : base.icon,
          logo: cleanUrl(saved.logo),
          color: cleanColor(saved.color),
          tags: cleanTags(saved.tags),
          description: cleanText(saved.description, 260),
          visible: saved.visible !== false,
          order: Number.isFinite(Number(saved.order)) ? Number(saved.order) : base.order,
        }
      : base;
  });
  for (const saved of stored) {
    if (!saved || saved.builtin || !/^custom_/.test(String(saved.id || ''))) continue;
    merged.push({
      id: saved.id,
      builtin: false,
      label: cleanText(saved.label, 18) || 'Untitled',
      icon: ICONS.includes(saved.icon) ? saved.icon : 'i-spark',
      logo: cleanUrl(saved.logo),
      color: cleanColor(saved.color),
      tags: cleanTags(saved.tags),
      description: cleanText(saved.description, 260),
      visible: saved.visible !== false,
      order: Number.isFinite(Number(saved.order)) ? Number(saved.order) : merged.length,
      cards: Array.isArray(saved.cards) ? saved.cards.slice(0, 40).map(cleanCard) : [],
    });
  }
  return merged.sort((a, b) => a.order - b.order).map((section, order) => ({ ...section, order }));
}

function loadSections() {
  try {
    const parsed = readSections();
    return { version: 1, sections: mergeSections(parsed.sections) };
  } catch (_) {
    return { version: 1, sections: defaultSections() };
  }
}

async function saveSections(data) {
  const clean = { version: 1, sections: mergeSections(data.sections) };
  await writeSections(clean);
  return clean;
}

function assertVisibleRemains(sections, id, visible) {
  if (visible !== false) return;
  const others = sections.filter((section) => section.id !== id && section.visible);
  if (!others.length) throw new Error('Keep at least one sidebar section visible.');
}

async function createSection(input) {
  const data = loadSections();
  const order = data.sections.reduce((max, section) => Math.max(max, section.order + 1), 0);
  const section = {
    id: `custom_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
    builtin: false,
    label: cleanText(input.label, 18) || 'New section',
    icon: ICONS.includes(input.icon) ? input.icon : 'i-spark',
    logo: cleanUrl(input.logo),
    color: cleanColor(input.color),
    tags: cleanTags(input.tags),
    description: cleanText(input.description, 260),
    visible: input.visible !== false,
    order,
    cards: Array.isArray(input.cards) ? input.cards.slice(0, 40).map(cleanCard) : [],
  };
  data.sections.push(section);
  const saved = await saveSections(data);
  return saved.sections.find((item) => item.id === section.id);
}

async function updateSection(id, input) {
  const data = loadSections();
  const index = data.sections.findIndex((section) => section.id === id);
  if (index < 0) throw new Error('Section not found.');
  const current = data.sections[index];
  const visible = input.visible === false ? false : true;
  assertVisibleRemains(data.sections, id, visible);
  const next = {
    ...current,
    label: cleanText(input.label, 18) || current.label,
    icon: ICONS.includes(input.icon) ? input.icon : current.icon,
    logo: cleanUrl(input.logo),
    color: cleanColor(input.color),
    tags: cleanTags(input.tags),
    description: cleanText(input.description, 260),
    visible,
  };
  if (!current.builtin && Array.isArray(input.cards)) {
    next.cards = input.cards.slice(0, 40).map(cleanCard);
  }
  data.sections[index] = next;
  const saved = await saveSections(data);
  return saved.sections.find((section) => section.id === id);
}

async function deleteSection(id) {
  const data = loadSections();
  const section = data.sections.find((item) => item.id === id);
  if (!section) throw new Error('Section not found.');
  if (section.builtin) throw new Error('Built-in sections can be hidden, not deleted.');
  data.sections = data.sections.filter((item) => item.id !== id);
  await saveSections(data);
  return { ok: true, id };
}

async function reorderSections(ids) {
  if (!Array.isArray(ids)) throw new Error('Send an ordered list of section ids.');
  const data = loadSections();
  const known = new Set(data.sections.map((section) => section.id));
  const ordered = [];
  for (const id of ids) {
    if (known.has(id) && !ordered.includes(id)) ordered.push(id);
  }
  for (const section of data.sections) {
    if (!ordered.includes(section.id)) ordered.push(section.id);
  }
  data.sections = ordered.map((id, order) => {
    const section = data.sections.find((item) => item.id === id);
    return { ...section, order };
  });
  return saveSections(data);
}

module.exports = {
  SECTIONS_PATH,
  ICONS,
  loadSections,
  saveSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
};
