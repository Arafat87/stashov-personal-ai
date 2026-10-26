/**
 * Stashov — Impulse Gate state machine and spend ledger.
 *
 * The gate is intentionally boring: every wishlist item gets an `added_at`
 * timestamp, a 14-day `unlock_at`, and a small lifecycle
 * (cooling -> ready -> bought/skipped). Snoozing pushes the decision date out
 * without pretending the item was purchased. Buying writes one auditable
 * ledger entry (which can be voided, never deleted) and derives the monthly
 * spend from that ledger instead of a hand-maintained `spent_this_month` number.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_COOLING_DAYS = 14;
const DEFAULT_SNOOZE_DAYS = 7;
const MAX_SNOOZE_DAYS = 90;
const DEFAULT_MONTHLY_BUDGET = 300;

class GateError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'GateError';
    this.status = status;
  }
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function addDays(value, days) {
  return new Date(new Date(value).getTime() + Number(days) * DAY_MS);
}

function startOfMonth(value = new Date()) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(value = new Date()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value = new Date()) {
  return new Date(value).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function monthShort(value = new Date()) {
  return new Date(value).toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
}

function monthName(value = new Date()) {
  return new Date(value).toLocaleString('en-US', { month: 'long' });
}

function dateLabel(value) {
  const date = toDate(value);
  if (!date) return 'unknown date';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return 0;
  return Math.max(0, Math.ceil((date.getTime() - new Date(now).getTime()) / DAY_MS));
}

function activeLedger(vault) {
  return (vault.spending_ledger || []).filter((entry) => !entry.voided);
}

function ledgerTotal(ledger, month) {
  return roundMoney(
    (ledger || [])
      .filter((entry) => !entry.voided && (entry.month || monthKey(entry.spent_at)) === month)
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
  );
}

function configuredCap(context) {
  const value = context && context.monthly_discretionary_budget;
  if (value === undefined || value === null || value === '') return DEFAULT_MONTHLY_BUDGET;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : DEFAULT_MONTHLY_BUDGET;
}

function syncBudget(vault, now = new Date()) {
  const context = vault.personal_context || (vault.personal_context = {});
  const month = monthKey(now);
  context.monthly_discretionary_budget = configuredCap(context);
  context.budget_month = month;
  context.spent_this_month = ledgerTotal(vault.spending_ledger || [], month);
  return context.spent_this_month;
}

function ensureLedger(vault, now = new Date()) {
  if (!Array.isArray(vault.spending_ledger)) vault.spending_ledger = [];
  const context = vault.personal_context || (vault.personal_context = {});
  const legacySpent = roundMoney(context.spent_this_month || 0);

  if (!vault.spending_ledger.length && legacySpent > 0) {
    vault.spending_ledger.push({
      id: 'led_legacy_opening',
      item_id: null,
      title: 'Existing spend (opening balance)',
      category: 'Unallocated',
      amount: legacySpent,
      currency: 'USD',
      spent_at: startOfMonth(now).toISOString(),
      month: monthKey(now),
      source: 'Imported from the original vault balance',
      note: 'No per-item breakdown existed before the ledger was added.',
      voided: false,
      created_at: new Date(now).toISOString(),
    });
  }

  syncBudget(vault, now);
  return vault.spending_ledger;
}

function normaliseWishlistItem(item, now = new Date()) {
  if (!item || typeof item !== 'object') return item;
  const current = new Date(now);
  const legacyLeft = Number.isFinite(Number(item.cooling_off_days_left))
    ? Math.max(0, Math.floor(Number(item.cooling_off_days_left)))
    : null;
  const configuredDays = Number.isFinite(Number(item.cooling_off_days)) && Number(item.cooling_off_days) > 0
    ? Math.max(1, Math.floor(Number(item.cooling_off_days)))
    : 0;
  const coolingDays = configuredDays || Math.max(DEFAULT_COOLING_DAYS, legacyLeft || 0);

  let addedAt = toDate(item.added_at);
  if (!addedAt) {
    const consumed = Math.min(legacyLeft ?? 0, coolingDays);
    addedAt = new Date(current.getTime() - (coolingDays - consumed) * DAY_MS);
  }
  if (addedAt > current) addedAt = current;

  let unlockAt = toDate(item.unlock_at);
  if (!unlockAt) unlockAt = addDays(addedAt, coolingDays);
  if (unlockAt < addedAt) unlockAt = addDays(addedAt, coolingDays);

  const purchasedAt = toDate(item.purchased_at);
  const skippedAt = toDate(item.skipped_at);
  const snoozedUntil = toDate(item.snoozed_until);
  const isBought = item.status === 'bought' || Boolean(purchasedAt);
  const isSkipped = !isBought && (item.status === 'skipped' || Boolean(skippedAt));
  const effectiveUntil = [unlockAt, snoozedUntil].filter(Boolean).reduce((latest, date) => (date > latest ? date : latest), unlockAt);
  const isSnoozed = !isBought && !isSkipped && Boolean(snoozedUntil) && snoozedUntil > current;
  const status = isBought ? 'bought' : isSkipped ? 'skipped' : isSnoozed ? 'snoozed' : effectiveUntil > current ? 'cooling' : 'ready';
  const left = status === 'bought' || status === 'skipped' ? 0 : daysUntil(effectiveUntil, current);
  const daysLabel = `${left} ${left === 1 ? 'day' : 'days'}`;

  let coolingStatus = 'Ready — gate cleared';
  if (status === 'bought') coolingStatus = `Bought ${purchasedAt ? dateLabel(purchasedAt) : ''}`.trim();
  else if (status === 'skipped') coolingStatus = `Skipped ${skippedAt ? dateLabel(skippedAt) : ''}`.trim();
  else if (status === 'snoozed') coolingStatus = `Snoozed until ${dateLabel(snoozedUntil)}`;
  else if (status === 'cooling') coolingStatus = `Cooling Off (${daysLabel} remaining)`;

  item.cooling_off_days = coolingDays;
  item.added_at = addedAt.toISOString();
  item.unlock_at = unlockAt.toISOString();
  item.snoozed_until = snoozedUntil ? snoozedUntil.toISOString() : null;
  item.purchased_at = purchasedAt ? purchasedAt.toISOString() : null;
  item.skipped_at = skippedAt ? skippedAt.toISOString() : null;
  item.status = status;
  item.cooling_off_days_left = left;
  item.cooling_status = coolingStatus;
  item.snooze_count = Math.max(0, Math.floor(Number(item.snooze_count) || 0));
  item.target_price = Number.isFinite(Number(item.target_price)) && Number(item.target_price) > 0
    ? roundMoney(item.target_price)
    : null;
  if (!Array.isArray(item.price_history)) item.price_history = [];
  if (!item.price_history.length && Number(item.lowest_verified_price) > 0) {
    recordPricePoint(item, item.lowest_verified_price, {
      at: toDate(item.price_captured_at) || addedAt,
      source: item.price_source || 'saved',
      confidence: item.price_confidence || '',
    });
  }
  if (Array.isArray(item.price_history) && item.price_history.length) {
    const observed = item.price_history
      .map((point) => Number(point && point.price))
      .filter((price) => Number.isFinite(price) && price > 0);
    if (observed.length) {
      item.lowest_seen_price = roundMoney(Math.min(...observed));
      const lowest = item.price_history.find((point) => Number(point.price) === item.lowest_seen_price);
      if (lowest) item.lowest_seen_at = lowest.at;
    }
  }
  item.price_checked_at = item.price_history && item.price_history.length
    ? item.price_history[item.price_history.length - 1].at
    : item.price_checked_at || null;
  return item;
}

/**
 * Append one observed price. Repeating the same amount within an hour updates
 * the timestamp instead of filling the history with identical checks.
 */
function recordPricePoint(item, price, options = {}) {
  if (!item || typeof item !== 'object') return null;
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const at = toDate(options.at) || new Date();
  const source = String(options.source || '').trim().slice(0, 40);
  const confidence = options.confidence === 'low' ? 'low' : (options.confidence === 'high' ? 'high' : '');
  const point = { at: at.toISOString(), price: roundMoney(amount), source, confidence };
  item.price_history = Array.isArray(item.price_history) ? item.price_history : [];
  const previous = item.price_history[item.price_history.length - 1];
  if (previous && Number(previous.price) === point.price && Math.abs(at.getTime() - Date.parse(previous.at)) < 60 * 60 * 1000) {
    previous.at = point.at;
    previous.source = source || previous.source;
    previous.confidence = confidence || previous.confidence;
    item.price_checked_at = point.at;
    return previous;
  }
  item.price_history.push(point);
  if (item.price_history.length > 60) item.price_history = item.price_history.slice(-60);
  item.price_checked_at = point.at;
  const observed = item.price_history.map((row) => Number(row.price)).filter((value) => value > 0);
  if (observed.length) {
    item.lowest_seen_price = roundMoney(Math.min(...observed));
    item.lowest_seen_at = item.price_history.find((row) => Number(row.price) === item.lowest_seen_price).at;
  }
  return point;
}

function startGate(item, { now = new Date(), days = DEFAULT_COOLING_DAYS } = {}) {
  const current = new Date(now);
  const coolingDays = Math.max(1, Math.floor(Number(days) || DEFAULT_COOLING_DAYS));
  item.cooling_off_days = coolingDays;
  item.added_at = current.toISOString();
  item.unlock_at = addDays(current, coolingDays).toISOString();
  item.snoozed_until = null;
  item.snoozed_at = null;
  item.snooze_count = 0;
  item.status = 'cooling';
  item.cooling_off_days_left = coolingDays;
  item.cooling_status = `Cooling Off (${coolingDays} ${coolingDays === 1 ? 'day' : 'days'} remaining)`;
  if (Number(item.lowest_verified_price) > 0) {
    recordPricePoint(item, item.lowest_verified_price, {
      at: current,
      source: item.price_source || 'capture',
      confidence: item.price_confidence || (item.price_source === 'manual' ? '' : 'high'),
    });
  }
  return item;
}

function monthLabelFromKey(key) {
  const [year, month] = String(key || '').split('-').map(Number);
  if (!year || !month) return String(key || 'Unknown');
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function categoryCapMap(context) {
  const source = context && context.category_budgets;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const result = {};
  for (const [rawName, rawAmount] of Object.entries(source)) {
    const name = String(rawName || '').trim().slice(0, 80);
    if (!name || rawAmount === null || rawAmount === '') continue;
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    result[name] = roundMoney(amount);
  }
  return result;
}

function budgetSummary(vault, now = new Date()) {
  const context = vault.personal_context || {};
  const month = monthKey(now);
  const cap = configuredCap(context);
  const active = activeLedger(vault);
  const entries = active
    .filter((entry) => (entry.month || monthKey(entry.spent_at)) === month)
    .sort((a, b) => new Date(b.spent_at || 0) - new Date(a.spent_at || 0));
  const spent = ledgerTotal(entries, month);
  const remaining = roundMoney(cap - spent);
  const categoryBudgets = categoryCapMap(context);
  const categoryMap = new Map();
  for (const entry of entries) {
    const name = entry.category || 'Uncategorized';
    const row = categoryMap.get(name) || { category: name, spent: 0, cap: categoryBudgets[name] ?? null };
    row.spent = roundMoney(row.spent + (Number(entry.amount) || 0));
    categoryMap.set(name, row);
  }
  for (const [name, categoryCap] of Object.entries(categoryBudgets)) {
    if (!categoryMap.has(name)) categoryMap.set(name, { category: name, spent: 0, cap: categoryCap });
  }
  const categories = Array.from(categoryMap.values())
    .filter((row) => row.spent > 0 || row.cap !== null)
    .map((row) => ({
      ...row,
      spent: roundMoney(row.spent),
      remaining: row.cap === null ? null : roundMoney(row.cap - row.spent),
      over_budget: row.cap !== null && row.spent > row.cap,
    }))
    .sort((a, b) => {
      if (a.over_budget !== b.over_budget) return a.over_budget ? -1 : 1;
      return b.spent - a.spent || a.category.localeCompare(b.category);
    });

  const monthTotals = new Map();
  for (const entry of active) {
    const key = entry.month || monthKey(entry.spent_at);
    const row = monthTotals.get(key) || { month: key, total: 0, entry_count: 0 };
    row.total = roundMoney(row.total + (Number(entry.amount) || 0));
    row.entry_count += 1;
    monthTotals.set(key, row);
  }
  const monthlyTotals = Array.from(monthTotals.values())
    .map((row) => ({ ...row, label: monthLabelFromKey(row.month) }))
    .sort((a, b) => b.month.localeCompare(a.month));

  return {
    month,
    month_label: monthLabel(now),
    month_short: monthShort(now),
    month_name: monthName(now),
    cap: roundMoney(cap),
    spent,
    remaining,
    over_budget: remaining < 0,
    entries,
    entry_count: entries.length,
    voided_count: (vault.spending_ledger || []).filter((entry) => entry.voided).length,
    category_budgets: categoryBudgets,
    category_breakdown: categories,
    monthly_totals: monthlyTotals,
  };
}

function updateBudget(vault, updates = {}, now = new Date()) {
  ensureLedger(vault, now);
  const context = vault.personal_context;
  if (Object.prototype.hasOwnProperty.call(updates, 'cap')) {
    const cap = Number(updates.cap);
    if (!Number.isFinite(cap) || cap < 0 || cap > 10000000) {
      throw new GateError('Monthly cap must be a number between $0 and $10,000,000.');
    }
    context.monthly_discretionary_budget = roundMoney(cap);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'category_budgets')) {
    const source = updates.category_budgets;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new GateError('Category budgets must be an object of category names to amounts.');
    }
    const next = {};
    for (const [rawName, rawAmount] of Object.entries(source)) {
      if (rawAmount === null || rawAmount === undefined || rawAmount === '') continue;
      const name = String(rawName || '').trim().slice(0, 80);
      const amount = Number(rawAmount);
      if (!name) continue;
      if (!Number.isFinite(amount) || amount < 0 || amount > 10000000) {
        throw new GateError(`Category budget for "${name}" must be a number between $0 and $10,000,000.`);
      }
      next[name] = roundMoney(amount);
    }
    context.category_budgets = next;
  }
  syncBudget(vault, now);
  return budgetSummary(vault, now);
}

function gateSummary(vault, now = new Date()) {
  const current = new Date(now);
  const counts = { cooling: 0, ready: 0, snoozed: 0, bought: 0, skipped: 0 };
  const items = vault.wishlist || [];
  for (const item of items) {
    const status = item.status || (Number(item.cooling_off_days_left) === 0 ? 'ready' : 'cooling');
    counts[status] = (counts[status] || 0) + 1;
  }
  const active = counts.cooling + counts.ready + counts.snoozed;
  const nextCandidates = items
    .filter((item) => item.status === 'cooling' || item.status === 'snoozed')
    .map((item) => {
      const dates = [toDate(item.unlock_at), toDate(item.snoozed_until)].filter(Boolean);
      const at = dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
      return { id: item.id, title: item.title, at };
    })
    .filter((entry) => entry.at && entry.at > current)
    .sort((a, b) => a.at - b.at);
  const next = nextCandidates[0] || null;
  const targetHits = items
    .filter((item) => item.status !== 'bought' && item.status !== 'skipped')
    .filter((item) => Number(item.target_price) > 0 && Number(item.lowest_verified_price) > 0)
    .filter((item) => Number(item.lowest_verified_price) <= Number(item.target_price))
    .map((item) => ({
      id: item.id,
      title: item.title,
      target_price: roundMoney(item.target_price),
      price: roundMoney(item.lowest_verified_price),
      at: item.price_checked_at || null,
    }));
  return {
    counts,
    active,
    archived: counts.bought + counts.skipped,
    total: items.length,
    target_hits: targetHits,
    ready_ids: items.filter((item) => item.status === 'ready').map((item) => item.id),
    next_unlock: next
      ? { id: next.id, title: next.title, at: next.at.toISOString(), days: daysUntil(next.at, current) }
      : null,
  };
}

function ensureGateState(vault, now = new Date()) {
  if (!Array.isArray(vault.wishlist)) vault.wishlist = [];
  ensureLedger(vault, now);
  for (const item of vault.wishlist) normaliseWishlistItem(item, now);
  return {
    budget: budgetSummary(vault, now),
    gate: gateSummary(vault, now),
  };
}

function findWishlistItem(vault, id) {
  return (vault.wishlist || []).find((item) => item.id === id) || null;
}

function optionalAmount(value, fallback) {
  if (value === undefined) {
    if (fallback === undefined || fallback === null || fallback === '') return null;
    const number = Number(fallback);
    return Number.isFinite(number) && number >= 0 ? roundMoney(number) : null;
  }
  if (value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1000000000) {
    throw new GateError('Price must be a number between $0 and $1,000,000,000.');
  }
  return roundMoney(number);
}

function updateWishlistDetails(vault, id, updates = {}, now = new Date()) {
  const current = toDate(updates.now) || new Date(now);
  ensureGateState(vault, current);
  const item = findWishlistItem(vault, id);
  if (!item) throw new GateError('Wishlist item not found.', 404);

  if (updates.title !== undefined) {
    const title = String(updates.title || '').trim().slice(0, 220);
    if (!title) throw new GateError('A wish needs a title.');
    item.title = title;
  }
  if (updates.brand !== undefined) item.brand = String(updates.brand || '').trim().slice(0, 120);
  if (updates.best_source !== undefined) item.best_source = String(updates.best_source || '').trim().slice(0, 180);

  if (Object.prototype.hasOwnProperty.call(updates, 'target_price')) {
    const target = optionalAmount(updates.target_price, null);
    item.target_price = target === null ? null : target;
  }

  if (updates.retail_price !== undefined || updates.lowest_verified_price !== undefined) {
    let retail = optionalAmount(updates.retail_price, item.retail_price);
    let floor = optionalAmount(updates.lowest_verified_price, item.lowest_verified_price);
    if (updates.retail_price !== undefined && updates.lowest_verified_price === undefined) floor = retail;
    if (updates.lowest_verified_price !== undefined && updates.retail_price === undefined) retail = floor;
    if (retail === null && floor !== null) retail = floor;
    if (floor === null && retail !== null) floor = retail;
    item.retail_price = retail;
    item.lowest_verified_price = floor;
    item.price_currency = 'USD';
    item.price_source = 'manual';
    item.price_confidence = '';
    item.price_captured_at = current.toISOString();
    item.price_note = '';
    item.price_reason = '';
    item.price_status = retail === null && floor === null ? 'missing' : 'manual';
    item.cost_per_use = floor === null ? null : roundMoney(floor / Math.max(1, Number(item.uses_per_month) || 1));
    if (floor !== null) {
      recordPricePoint(item, floor, { at: current, source: 'manual', confidence: '' });
    }
    if (item.price_status === 'missing') item.verdict_label = 'PRICE NEEDS REVIEW';
    else if (item.verdict_label === 'PRICE NEEDS REVIEW') item.verdict_label = 'GATE ACTIVE — REVIEW';
  }

  item.updated_at = current.toISOString();
  normaliseWishlistItem(item, current);
  return item;
}

function voidLedgerEntry(vault, entryId, options = {}) {
  const now = toDate(options.now) || new Date();
  ensureGateState(vault, now);
  const entry = (vault.spending_ledger || []).find((row) => row.id === entryId);
  if (!entry) throw new GateError('Ledger entry not found.', 404);
  if (entry.voided) throw new GateError('That ledger entry is already voided.', 409);

  entry.voided = true;
  entry.voided_at = now.toISOString();
  entry.void_reason = String(options.reason || '').trim().slice(0, 500);

  let item = null;
  if (entry.item_id) {
    item = findWishlistItem(vault, entry.item_id);
    if (item && item.status === 'bought') {
      const hasActivePurchase = (vault.spending_ledger || []).some(
        (row) => row.item_id === item.id && !row.voided
      );
      if (!hasActivePurchase) {
        item.purchased_at = null;
        item.purchase_price = null;
        item.purchase_source = '';
        item.purchase_note = '';
        item.snoozed_until = null;
        item.snoozed_at = null;
        item.status = 'cooling';
        normaliseWishlistItem(item, now);
      }
    }
  }

  syncBudget(vault, now);
  return {
    entry,
    item,
    budget: budgetSummary(vault, now),
    gate: gateSummary(vault, now),
  };
}

function reopenItem(vault, id, options = {}) {
  const now = toDate(options.now) || new Date();
  ensureGateState(vault, now);
  const item = findWishlistItem(vault, id);
  if (!item) throw new GateError('Wishlist item not found.', 404);
  if (item.status !== 'bought' && item.status !== 'skipped') {
    throw new GateError('This wish is already open.', 409);
  }

  const reason = String(options.reason || '').trim().slice(0, 500) || 'Wish reopened';
  for (const entry of vault.spending_ledger || []) {
    if (entry.item_id === item.id && !entry.voided) {
      entry.voided = true;
      entry.voided_at = now.toISOString();
      entry.void_reason = reason;
    }
  }

  item.purchased_at = null;
  item.purchase_price = null;
  item.purchase_source = '';
  item.purchase_note = '';
  item.skipped_at = null;
  item.skip_reason = '';
  item.snoozed_until = null;
  item.snoozed_at = null;
  item.status = 'cooling';
  item.reopened_at = now.toISOString();
  item.reopen_count = Math.max(0, Math.floor(Number(item.reopen_count) || 0)) + 1;
  normaliseWishlistItem(item, now);
  syncBudget(vault, now);

  return {
    item,
    budget: budgetSummary(vault, now),
    gate: gateSummary(vault, now),
  };
}

function purchaseItem(vault, id, options = {}) {
  const now = toDate(options.now) || new Date();
  ensureGateState(vault, now);
  const item = findWishlistItem(vault, id);
  if (!item) throw new GateError('Wishlist item not found.', 404);
  if (item.status === 'bought') throw new GateError('This wish is already recorded as bought.', 409);
  if (item.status === 'skipped') throw new GateError('This wish was skipped; reopen it before recording a purchase.', 409);
  if (item.status !== 'ready') {
    throw new GateError(`This wish is still locked for ${item.cooling_off_days_left} more ${item.cooling_off_days_left === 1 ? 'day' : 'days'}.`, 409);
  }

  const amountProvided = options.amount !== undefined && options.amount !== null && options.amount !== '';
  const fallbackAmount = Number(item.lowest_verified_price);
  if (!amountProvided && !(Number.isFinite(fallbackAmount) && fallbackAmount > 0)) {
    throw new GateError('This wish has no captured price. Enter what you paid before recording the purchase.');
  }
  const rawAmount = amountProvided ? options.amount : fallbackAmount;
  const parsedAmount = Number(rawAmount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    throw new GateError('Purchase price must be a non-negative number.');
  }
  const amount = roundMoney(parsedAmount);
  const source = String(options.source || item.best_source || 'Manual purchase').trim().slice(0, 180);
  const note = String(options.note || '').trim().slice(0, 500);
  const entry = {
    id: `led_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    item_id: item.id,
    title: item.title,
    category: item.category || 'Unclustered',
    amount,
    currency: 'USD',
    spent_at: now.toISOString(),
    month: monthKey(now),
    source,
    note,
    voided: false,
    created_at: now.toISOString(),
  };

  vault.spending_ledger.unshift(entry);
  item.status = 'bought';
  item.purchased_at = now.toISOString();
  item.purchase_price = amount;
  item.purchase_source = source;
  item.purchase_note = note;
  normaliseWishlistItem(item, now);
  syncBudget(vault, now);

  return {
    item,
    entry,
    budget: budgetSummary(vault, now),
    gate: gateSummary(vault, now),
  };
}

function skipItem(vault, id, options = {}) {
  const now = toDate(options.now) || new Date();
  ensureGateState(vault, now);
  const item = findWishlistItem(vault, id);
  if (!item) throw new GateError('Wishlist item not found.', 404);
  if (item.status === 'bought') throw new GateError('This wish is already recorded as bought.', 409);
  if (item.status === 'skipped') throw new GateError('This wish is already skipped.', 409);

  item.status = 'skipped';
  item.skipped_at = now.toISOString();
  item.skip_reason = String(options.reason || '').trim().slice(0, 500);
  normaliseWishlistItem(item, now);

  return {
    item,
    budget: budgetSummary(vault, now),
    gate: gateSummary(vault, now),
  };
}

function snoozeItem(vault, id, options = {}) {
  const now = toDate(options.now) || new Date();
  ensureGateState(vault, now);
  const item = findWishlistItem(vault, id);
  if (!item) throw new GateError('Wishlist item not found.', 404);
  if (item.status === 'bought') throw new GateError('This wish is already recorded as bought.', 409);
  if (item.status === 'skipped') throw new GateError('This wish was skipped; it cannot be snoozed.', 409);

  const requested = Number(options.days);
  const days = Math.min(MAX_SNOOZE_DAYS, Math.max(1, Math.round(Number.isFinite(requested) ? requested : DEFAULT_SNOOZE_DAYS)));
  // Extend the decision from the later of today, the original unlock date, and
  // any earlier snooze. Snoozing an item that is still cooling must never make
  // the decision date earlier than it already was.
  const base = [now, toDate(item.unlock_at), toDate(item.snoozed_until)]
    .filter(Boolean)
    .reduce((latest, date) => (date > latest ? date : latest), now);
  item.snoozed_until = addDays(base, days).toISOString();
  item.snoozed_at = now.toISOString();
  item.snooze_count = Math.max(0, Math.floor(Number(item.snooze_count) || 0)) + 1;
  item.snooze_note = String(options.note || '').trim().slice(0, 500);
  normaliseWishlistItem(item, now);

  return {
    item,
    days,
    budget: budgetSummary(vault, now),
    gate: gateSummary(vault, now),
  };
}

module.exports = {
  DAY_MS,
  DEFAULT_COOLING_DAYS,
  DEFAULT_SNOOZE_DAYS,
  MAX_SNOOZE_DAYS,
  GateError,
  activeLedger,
  addDays,
  budgetSummary,
  dateLabel,
  daysUntil,
  ensureGateState,
  ensureLedger,
  gateSummary,
  ledgerTotal,
  monthKey,
  monthLabel,
  monthLabelFromKey,
  monthShort,
  normaliseWishlistItem,
  purchaseItem,
  recordPricePoint,
  reopenItem,
  skipItem,
  snoozeItem,
  startGate,
  syncBudget,
  updateBudget,
  updateWishlistDetails,
  voidLedgerEntry,
};
