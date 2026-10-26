const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DAY_MS,
  GateError,
  budgetSummary,
  ensureGateState,
  gateSummary,
  normaliseWishlistItem,
  purchaseItem,
  reopenItem,
  skipItem,
  snoozeItem,
  startGate,
  updateBudget,
  updateWishlistDetails,
  voidLedgerEntry,
} = require('../lib/gate');

const NOW = new Date('2026-10-25T12:00:00.000Z');

function item(overrides = {}) {
  return {
    id: 'wl_test',
    title: 'Test wish',
    category: 'Menswear & Streetwear',
    retail_price: 100,
    lowest_verified_price: 60,
    best_source: 'Saved discounter',
    ...overrides,
  };
}

function vaultWith(wishlist, overrides = {}) {
  return {
    wishlist,
    spending_ledger: [],
    personal_context: { monthly_discretionary_budget: 300, default_cooling_off_days: 14 },
    ...overrides,
  };
}

test('Legacy countdowns become real timestamps and the timestamps win over stale numbers', () => {
  const wish = item({ cooling_off_days_left: 5, cooling_status: 'Cooling Off (5 days remaining)' });
  normaliseWishlistItem(wish, NOW);
  assert.equal(wish.status, 'cooling');
  assert.equal(wish.cooling_off_days, 14);
  assert.equal(wish.cooling_off_days_left, 5);
  const added = new Date(wish.added_at).getTime();
  const unlock = new Date(wish.unlock_at).getTime();
  assert.ok(Math.abs((NOW.getTime() - added) - 9 * DAY_MS) < 1000, 'added_at should reflect 9 days already served');
  assert.ok(Math.abs((unlock - NOW.getTime()) - 5 * DAY_MS) < 1000, 'unlock_at should be five days out');

  const stale = item({
    added_at: new Date(NOW.getTime() - 16 * DAY_MS).toISOString(),
    unlock_at: new Date(NOW.getTime() - 2 * DAY_MS).toISOString(),
    cooling_off_days_left: 9,
    cooling_off_days: 14,
  });
  normaliseWishlistItem(stale, NOW);
  assert.equal(stale.status, 'ready');
  assert.equal(stale.cooling_off_days_left, 0);
});

test('Gate starts at fourteen days and refuses an early purchase', () => {
  const wish = item();
  startGate(wish, { now: NOW });
  assert.equal(wish.status, 'cooling');
  assert.equal(wish.cooling_off_days_left, 14);
  const vault = vaultWith([wish]);
  assert.throws(() => purchaseItem(vault, wish.id, { now: NOW }), (err) => err instanceof GateError && err.status === 409);
  assert.equal(vault.spending_ledger.length, 0);

  const custom = item({ id: 'wl_custom' });
  startGate(custom, { now: NOW, days: 7 });
  normaliseWishlistItem(custom, NOW);
  assert.equal(custom.cooling_off_days, 7, 'a configured shorter gate must survive normalisation');
  assert.equal(custom.cooling_off_days_left, 7);
});

test('Buying a cleared wish writes one ledger entry and derives the month spend', () => {
  const wish = item({
    added_at: new Date(NOW.getTime() - 15 * DAY_MS).toISOString(),
    unlock_at: new Date(NOW.getTime() - DAY_MS).toISOString(),
  });
  const vault = vaultWith([wish]);
  ensureGateState(vault, NOW);
  assert.equal(wish.status, 'ready');

  const result = purchaseItem(vault, wish.id, { amount: 59.9, source: 'Quince', note: 'Replaced worn sweater', now: NOW });
  assert.equal(result.item.status, 'bought');
  assert.equal(result.entry.amount, 59.9);
  assert.equal(result.entry.month, '2026-10');
  assert.equal(vault.spending_ledger.length, 1);
  assert.equal(result.budget.spent, 59.9);
  assert.equal(result.budget.remaining, 240.1);
  assert.equal(result.gate.counts.bought, 1);
  assert.throws(() => purchaseItem(vault, wish.id, { now: NOW }), /already recorded as bought/);
});

test('Monthly budget rolls over from the ledger instead of a frozen number', () => {
  const wish = item({
    added_at: new Date(NOW.getTime() - 15 * DAY_MS).toISOString(),
    unlock_at: new Date(NOW.getTime() - DAY_MS).toISOString(),
  });
  const vault = vaultWith([wish]);
  ensureGateState(vault, NOW);
  purchaseItem(vault, wish.id, { amount: 45, now: NOW });

  const october = budgetSummary(vault, NOW);
  assert.equal(october.spent, 45);
  assert.equal(october.remaining, 255);
  assert.equal(october.month_label, 'October 2026');

  const november = budgetSummary(vault, new Date('2026-11-04T12:00:00.000Z'));
  assert.equal(november.spent, 0);
  assert.equal(november.remaining, 300);
  assert.equal(november.month, '2026-11');
});

test('Snooze extends the decision date without touching the ledger and skip archives the wish', () => {
  const ready = item({
    added_at: new Date(NOW.getTime() - 15 * DAY_MS).toISOString(),
    unlock_at: new Date(NOW.getTime() - DAY_MS).toISOString(),
  });
  const cooling = item({
    id: 'wl_cooling',
    title: 'Still cooling',
    added_at: new Date(NOW.getTime() - 3 * DAY_MS).toISOString(),
    unlock_at: new Date(NOW.getTime() + 11 * DAY_MS).toISOString(),
  });
  const skipped = item({ id: 'wl_skip', title: 'Skip me' });
  const vault = vaultWith([ready, cooling, skipped]);
  ensureGateState(vault, NOW);

  const snooze = snoozeItem(vault, ready.id, { days: 7, note: 'Wait for sale', now: NOW });
  assert.equal(snooze.item.status, 'snoozed');
  assert.equal(snooze.item.snoozed_until, new Date(NOW.getTime() + 7 * DAY_MS).toISOString());
  assert.equal(snooze.item.cooling_off_days_left, 7);
  assert.equal(vault.spending_ledger.length, 0);

  const extended = snoozeItem(vault, cooling.id, { days: 7, now: NOW });
  assert.equal(extended.item.status, 'snoozed');
  assert.equal(extended.item.cooling_off_days_left, 18, 'snooze must extend the 11 remaining cooling days, not shorten them');
  assert.equal(extended.item.snoozed_until, new Date(NOW.getTime() + 18 * DAY_MS).toISOString());

  const skip = skipItem(vault, skipped.id, { reason: 'No longer wanted', now: NOW });
  assert.equal(skip.item.status, 'skipped');
  assert.equal(skip.item.skip_reason, 'No longer wanted');
  assert.equal(skip.gate.counts.skipped, 1);
  assert.throws(() => snoozeItem(vault, skipped.id, { now: NOW }), /cannot be snoozed/);
});

test('The opening balance is migrated only once, not added to every month', () => {
  const wish = item({ cooling_off_days_left: 0 });
  const vault = vaultWith([wish], { personal_context: { monthly_discretionary_budget: 300, spent_this_month: 85 } });
  const state = ensureGateState(vault, NOW);
  assert.equal(vault.spending_ledger.length, 1);
  assert.equal(vault.spending_ledger[0].amount, 85);
  assert.equal(state.budget.spent, 85);
  assert.equal(state.budget.remaining, 215);

  const nextMonth = budgetSummary(vault, new Date('2026-12-02T12:00:00.000Z'));
  assert.equal(nextMonth.spent, 0);
  assert.equal(nextMonth.remaining, 300);
});

test('Budget caps and category caps are editable and the breakdown uses the ledger', () => {
  const wish = item({
    added_at: new Date(NOW.getTime() - 15 * DAY_MS).toISOString(),
    unlock_at: new Date(NOW.getTime() - DAY_MS).toISOString(),
  });
  const vault = vaultWith([wish]);
  ensureGateState(vault, NOW);
  purchaseItem(vault, wish.id, { amount: 59.9, now: NOW });

  const budget = updateBudget(vault, {
    cap: 200,
    category_budgets: { 'Menswear & Streetwear': 100, 'Fragrances & Cologne': 50 },
  }, NOW);
  assert.equal(budget.cap, 200);
  assert.equal(budget.spent, 59.9);
  assert.equal(budget.remaining, 140.1);
  assert.equal(budget.category_budgets['Menswear & Streetwear'], 100);
  const clothing = budget.category_breakdown.find((row) => row.category === 'Menswear & Streetwear');
  assert.deepEqual(
    { spent: clothing.spent, cap: clothing.cap, remaining: clothing.remaining, over: clothing.over_budget },
    { spent: 59.9, cap: 100, remaining: 40.1, over: false }
  );
  assert.equal(budget.monthly_totals[0].month, '2026-10');
  assert.equal(budget.monthly_totals[0].total, 59.9);

  const zero = updateBudget(vault, { cap: 0 }, NOW);
  assert.equal(zero.cap, 0);
  assert.equal(zero.remaining, -59.9);
  assert.equal(zero.over_budget, true);
});

test('Wishlist details can correct a captured price and clear it back to price-pending', () => {
  const wish = item({ uses_per_month: 10 });
  startGate(wish, { now: NOW });
  const vault = vaultWith([wish]);
  const edited = updateWishlistDetails(vault, wish.id, {
    title: 'Quince cashmere crewneck',
    brand: 'Quince',
    retail_price: 120,
    lowest_verified_price: 90,
    best_source: 'Quince product page',
  }, NOW);
  assert.equal(edited.title, 'Quince cashmere crewneck');
  assert.equal(edited.brand, 'Quince');
  assert.equal(edited.retail_price, 120);
  assert.equal(edited.lowest_verified_price, 90);
  assert.equal(edited.price_status, 'manual');
  assert.equal(edited.cost_per_use, 9);

  const cleared = updateWishlistDetails(vault, wish.id, { retail_price: '', lowest_verified_price: '' }, NOW);
  assert.equal(cleared.retail_price, null);
  assert.equal(cleared.lowest_verified_price, null);
  assert.equal(cleared.price_status, 'missing');
  assert.equal(cleared.verdict_label, 'PRICE NEEDS REVIEW');
});

test('Reopening a bought wish voids the purchase and restores the budget', () => {
  const wish = item({
    added_at: new Date(NOW.getTime() - 15 * DAY_MS).toISOString(),
    unlock_at: new Date(NOW.getTime() - DAY_MS).toISOString(),
  });
  const vault = vaultWith([wish]);
  ensureGateState(vault, NOW);
  const purchase = purchaseItem(vault, wish.id, { amount: 45, now: NOW });
  assert.equal(purchase.budget.spent, 45);

  const reopened = reopenItem(vault, wish.id, { reason: 'Recorded by mistake', now: NOW });
  assert.equal(reopened.item.status, 'ready');
  assert.equal(reopened.item.purchased_at, null);
  assert.equal(reopened.item.purchase_price, null);
  assert.equal(reopened.item.reopen_count, 1);
  assert.equal(vault.spending_ledger[0].voided, true);
  assert.equal(reopened.budget.spent, 0);
  assert.equal(reopened.budget.remaining, 300);
  assert.throws(() => reopenItem(vault, wish.id, { now: NOW }), /already open/);
});

test('Voiding a purchase entry reopens its wish; voiding a skipped wish does not touch the ledger', () => {
  const bought = item({
    id: 'wl_bought',
    added_at: new Date(NOW.getTime() - 15 * DAY_MS).toISOString(),
    unlock_at: new Date(NOW.getTime() - DAY_MS).toISOString(),
  });
  const skipped = item({ id: 'wl_skipped', title: 'Skipped one' });
  const vault = vaultWith([bought, skipped]);
  ensureGateState(vault, NOW);
  const purchase = purchaseItem(vault, bought.id, { amount: 30, now: NOW });

  const voided = voidLedgerEntry(vault, purchase.entry.id, { reason: 'Wrong amount', now: NOW });
  assert.equal(voided.entry.voided, true);
  assert.equal(voided.item.status, 'ready');
  assert.equal(voided.budget.spent, 0);
  assert.throws(() => voidLedgerEntry(vault, purchase.entry.id, { now: NOW }), /already voided/);

  skipItem(vault, skipped.id, { reason: 'No longer wanted', now: NOW });
  const reopened = reopenItem(vault, skipped.id, { now: NOW });
  assert.equal(reopened.item.status, 'ready');
  assert.equal(reopened.budget.spent, 0);
});
