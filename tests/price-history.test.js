const test = require('node:test');
const assert = require('node:assert/strict');

const {
  gateSummary,
  normaliseWishlistItem,
  recordPricePoint,
  startGate,
  updateWishlistDetails,
} = require('../lib/gate');

function freshItem() {
  return {
    id: 'wl_test',
    title: 'Wool Coat',
    category: 'Menswear & Streetwear',
    retail_price: 150,
    lowest_verified_price: 120,
    price_source: 'json-ld',
    price_confidence: 'high',
  };
}

test('starting a gate records the first observed price', () => {
  const item = freshItem();
  startGate(item, { now: new Date('2026-10-01T12:00:00Z'), days: 14 });
  assert.equal(item.price_history.length, 1);
  assert.equal(item.price_history[0].price, 120);
  assert.equal(item.price_history[0].source, 'json-ld');
  assert.equal(item.lowest_seen_price, 120);
  assert.equal(item.price_checked_at, '2026-10-01T12:00:00.000Z');
});

test('a price re-check appends a point and moves lowest-seen down', () => {
  const item = freshItem();
  startGate(item, { now: new Date('2026-10-01T12:00:00Z'), days: 14 });
  recordPricePoint(item, 99.5, { at: new Date('2026-10-03T12:00:00Z'), source: 'refresh', confidence: 'high' });
  assert.equal(item.price_history.length, 2);
  assert.equal(item.lowest_seen_price, 99.5);
  assert.equal(item.lowest_seen_at, '2026-10-03T12:00:00.000Z');
});

test('the same price within an hour updates the timestamp instead of duplicating the point', () => {
  const item = freshItem();
  startGate(item, { now: new Date('2026-10-01T12:00:00Z'), days: 14 });
  recordPricePoint(item, 120, { at: new Date('2026-10-01T12:30:00Z'), source: 'refresh' });
  assert.equal(item.price_history.length, 1);
  assert.equal(item.price_history[0].at, '2026-10-01T12:30:00.000Z');
});

test('a target price is normalized and surfaces as a target hit', () => {
  const item = freshItem();
  startGate(item, { now: new Date('2026-10-01T12:00:00Z'), days: 14 });
  recordPricePoint(item, 90, { at: new Date('2026-10-02T12:00:00Z'), source: 'refresh' });
  item.lowest_verified_price = 90;
  const vault = {
    wishlist: [item],
    personal_context: { monthly_discretionary_budget: 300 },
    spending_ledger: [],
  };
  updateWishlistDetails(vault, item.id, { target_price: 95 }, new Date('2026-10-02T13:00:00Z'));
  assert.equal(item.target_price, 95);
  const summary = gateSummary(vault, new Date('2026-10-02T13:00:00Z'));
  assert.equal(summary.target_hits.length, 1);
  assert.equal(summary.target_hits[0].id, item.id);
  assert.equal(summary.target_hits[0].price, 90);
});

test('editing only the target leaves captured price provenance intact', () => {
  const item = freshItem();
  item.price_status = 'captured';
  const vault = { wishlist: [item], personal_context: {}, spending_ledger: [] };
  startGate(item, { now: new Date('2026-10-01T12:00:00Z'), days: 14 });
  updateWishlistDetails(vault, item.id, { target_price: 100 }, new Date('2026-10-02T12:00:00Z'));
  assert.equal(item.target_price, 100);
  assert.equal(item.price_status, 'captured');
  assert.equal(item.price_confidence, 'high');
  assert.equal(item.price_history.length, 1);
});

test('legacy wishes get one history point from their saved price', () => {
  const item = {
    id: 'wl_legacy',
    title: 'Legacy coat',
    lowest_verified_price: 80,
    retail_price: 100,
    added_at: '2026-09-01T12:00:00.000Z',
    price_captured_at: '2026-09-02T12:00:00.000Z',
  };
  normaliseWishlistItem(item, new Date('2026-10-01T12:00:00Z'));
  assert.equal(item.price_history.length, 1);
  assert.equal(item.price_history[0].price, 80);
  assert.equal(item.price_history[0].at, '2026-09-02T12:00:00.000Z');
});
