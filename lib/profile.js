/**
 * Stashov — personal context edits.
 *
 * The You panel is a projection of `vault.personal_context`. This module is the
 * only write path for that object: it sanitizes free text, replaces the fields
 * the editor owns, and leaves budget/cooling fields untouched.
 */

const crypto = require('crypto');

const LIMITS = Object.freeze({
  owner: 80,
  location: 120,
  sizeEntries: 12,
  sizeKey: 40,
  sizeValue: 80,
  constraints: 20,
  constraintLength: 500,
  inventory: 30,
  inventoryName: 140,
  inventoryBrand: 100,
  inventoryStatus: 60,
  inventoryNotes: 300,
  inventoryCategory: 100,
  scentNotes: 20,
  scentNoteLength: 80,
});

class ProfileError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ProfileError';
    this.status = status;
  }
}

function cleanText(value, max, label, { required = false } = {}) {
  const text = String(value === undefined || value === null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (required && !text) throw new ProfileError(`${label} cannot be empty.`);
  if (text.length > max) throw new ProfileError(`${label} must be ${max} characters or fewer.`);
  return text;
}

function cleanList(value, { maxItems, maxLength, label }) {
  if (!Array.isArray(value)) throw new ProfileError(`${label} must be a list.`);
  if (value.length > maxItems) throw new ProfileError(`${label} can contain at most ${maxItems} entries.`);
  return value
    .map((item) => cleanText(item, maxLength, label))
    .filter(Boolean);
}

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function inventoryId(now, index) {
  return `own_${now.getTime().toString(36)}_${index}_${crypto.randomBytes(2).toString('hex')}`;
}

function updatePersonalContext(vault, updates = {}, now = new Date()) {
  if (!vault || typeof vault !== 'object') throw new ProfileError('Vault is unavailable.', 500);
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new ProfileError('Profile updates must be a JSON object.');
  }
  const context = vault.personal_context && typeof vault.personal_context === 'object' && !Array.isArray(vault.personal_context)
    ? vault.personal_context
    : (vault.personal_context = {});

  if (has(updates, 'owner')) {
    context.owner = cleanText(updates.owner, LIMITS.owner, 'Name', { required: true });
  }

  if (has(updates, 'location')) {
    context.location = cleanText(updates.location, LIMITS.location, 'Location');
  }

  if (has(updates, 'sizes')) {
    const sizes = updates.sizes;
    if (!sizes || typeof sizes !== 'object' || Array.isArray(sizes)) {
      throw new ProfileError('Sizes must be an object of labels to values.');
    }
    const entries = Object.entries(sizes);
    if (entries.length > LIMITS.sizeEntries) {
      throw new ProfileError(`Sizes can contain at most ${LIMITS.sizeEntries} entries.`);
    }
    const next = {};
    for (const [rawKey, rawValue] of entries) {
      const key = cleanText(rawKey, LIMITS.sizeKey, 'Size label');
      if (!key) continue;
      const value = cleanText(rawValue, LIMITS.sizeValue, `Size value for "${key}"`);
      if (!value) continue;
      next[key] = value;
    }
    context.sizes = next;
  }

  if (has(updates, 'skin_and_health_constraints')) {
    context.skin_and_health_constraints = cleanList(updates.skin_and_health_constraints, {
      maxItems: LIMITS.constraints,
      maxLength: LIMITS.constraintLength,
      label: 'Hard constraints',
    });
  }

  if (has(updates, 'owned_inventory')) {
    const inventory = updates.owned_inventory;
    if (!Array.isArray(inventory)) throw new ProfileError('Owned inventory must be a list.');
    if (inventory.length > LIMITS.inventory) {
      throw new ProfileError(`Owned inventory can contain at most ${LIMITS.inventory} items.`);
    }
    const existing = new Map(
      (Array.isArray(context.owned_inventory) ? context.owned_inventory : [])
        .filter((item) => item && item.id)
        .map((item) => [item.id, item])
    );
    const seen = new Set();
    context.owned_inventory = inventory.map((raw, index) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new ProfileError(`Owned item ${index + 1} must be an object.`);
      }
      const name = cleanText(raw.name, LIMITS.inventoryName, `Owned item ${index + 1} name`, { required: true });
      let id = cleanText(raw.id, 48, 'Owned item id');
      if (!/^[a-z0-9_]+$/i.test(id) || seen.has(id)) id = inventoryId(now, index);
      seen.add(id);
      const prior = existing.get(id);
      const category = cleanText(
        raw.category ?? (prior && prior.category) ?? 'Uncategorized',
        LIMITS.inventoryCategory,
        `Owned item ${index + 1} category`
      ) || 'Uncategorized';
      return {
        id,
        name,
        category,
        brand: cleanText(raw.brand, LIMITS.inventoryBrand, `Owned item ${index + 1} brand`),
        notes: cleanText(raw.notes, LIMITS.inventoryNotes, `Owned item ${index + 1} notes`),
        status: cleanText(raw.status, LIMITS.inventoryStatus, `Owned item ${index + 1} status`) || 'Owned',
      };
    });
  }

  if (has(updates, 'fragrance_profile')) {
    const profile = updates.fragrance_profile;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw new ProfileError('Scent profile must be an object of loved and avoided notes.');
    }
    const current = context.fragrance_profile && typeof context.fragrance_profile === 'object' && !Array.isArray(context.fragrance_profile)
      ? context.fragrance_profile
      : {};
    if (has(profile, 'loved_notes')) {
      current.loved_notes = cleanList(profile.loved_notes, {
        maxItems: LIMITS.scentNotes,
        maxLength: LIMITS.scentNoteLength,
        label: 'Loved notes',
      });
    }
    if (has(profile, 'avoid_notes')) {
      current.avoid_notes = cleanList(profile.avoid_notes, {
        maxItems: LIMITS.scentNotes,
        maxLength: LIMITS.scentNoteLength,
        label: 'Avoid notes',
      });
    }
    context.fragrance_profile = current;
  }

  return context;
}

module.exports = {
  LIMITS,
  ProfileError,
  updatePersonalContext,
};
