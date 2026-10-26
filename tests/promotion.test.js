const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPromotedWish, captureFromSnapshot, previewFromCapture } = require('../lib/promotion');

const bookmark = {
  id: 'bm_1',
  title: 'Bookmark title',
  url: 'https://shop.example.com/coat',
  domain: 'shop.example.com',
  browser: 'Chrome',
  original_folder: 'Shopping',
  category: 'STYLE',
  image: '',
  tags: ['coat'],
};

const capture = {
  product: {
    title: 'Wool Coat',
    brand: 'Example',
    price: 180,
    currency: 'USD',
    price_source: 'json-ld',
    image_url: 'https://cdn.example.com/coat.jpg',
  },
  capturedPrice: 180,
  image: '/media/images/abcd.jpg',
  reason: '',
};

test('automatic promotion keeps the captured price and provenance', () => {
  const wish = buildPromotedWish(bookmark, capture, null);
  assert.equal(wish.title, 'Wool Coat');
  assert.equal(wish.brand, 'Example');
  assert.equal(wish.retail_price, 180);
  assert.equal(wish.lowest_verified_price, 180);
  assert.equal(wish.price_status, 'captured');
  assert.equal(wish.price_source, 'json-ld');
  assert.equal(wish.image, '/media/images/abcd.jpg');
  assert.match(wish.anti_hype_summary, /Captured from the saved product page/);
});

test('a reviewed capture that still matches the page price stays captured', () => {
  const wish = buildPromotedWish(bookmark, {}, {
    title: 'Wool Coat',
    brand: 'Example',
    captured_price: 180,
    retail_price: 180,
    lowest_verified_price: 180,
    image: '/media/images/abcd.jpg',
    best_source: 'Example product page',
    price_source: 'json-ld',
  });
  assert.equal(wish.price_status, 'captured');
  assert.equal(wish.price_source, 'json-ld');
  assert.equal(wish.best_source, 'Example product page');
});

test('an edited price is saved as manual, not as a page capture', () => {
  const wish = buildPromotedWish(bookmark, {}, {
    title: 'Wool Coat (sale)',
    brand: 'Example',
    captured_price: 180,
    retail_price: 140,
    lowest_verified_price: 140,
    image: '/media/images/abcd.jpg',
    best_source: 'Example sale',
  });
  assert.equal(wish.title, 'Wool Coat (sale)');
  assert.equal(wish.price_status, 'manual');
  assert.equal(wish.price_source, 'manual');
  assert.equal(wish.price_captured_at !== null, true);
  assert.match(wish.anti_hype_summary, /entered by hand/);
});

test('clearing both prices starts the gate as price pending, with the capture reason', () => {
  const wish = buildPromotedWish(bookmark, {}, {
    title: 'Wool Coat',
    brand: 'Example',
    captured_price: 180,
    retail_price: null,
    lowest_verified_price: null,
    image: '/media/images/abcd.jpg',
    price_reason: 'The page returned 403 Forbidden.',
  });
  assert.equal(wish.price_status, 'missing');
  assert.equal(wish.retail_price, null);
  assert.equal(wish.lowest_verified_price, null);
  assert.equal(wish.price_captured_at, null);
  assert.match(wish.price_note, /403/);
  assert.equal(wish.verdict_label, 'PRICE NEEDS REVIEW');
});

test('invalid reviewed prices are rejected instead of silently dropped', () => {
  assert.throws(() => buildPromotedWish(bookmark, {}, {
    title: 'Wool Coat',
    captured_price: 180,
    retail_price: -1,
  }), /Retail price must be between/);
});

test('preview exposes capture status without creating a wish', () => {
  const preview = previewFromCapture(bookmark, capture);
  assert.equal(preview.title, 'Wool Coat');
  assert.equal(preview.price, 180);
  assert.equal(preview.price_status, 'captured');
  assert.equal(preview.image, '/media/images/abcd.jpg');
  assert.equal(preview.url, bookmark.url);
  assert.equal(preview.bookmark_id, 'bm_1');
});

test('a page with no price previews as missing with its reason', () => {
  const preview = previewFromCapture(bookmark, {
    product: { title: 'Wool Coat', brand: 'Example', price: null, price_reason: 'No public price was found in the page metadata.' },
    capturedPrice: null,
    image: '/media/images/abcd.jpg',
    reason: 'No public price was found in the page metadata.',
  });
  assert.equal(preview.price, null);
  assert.equal(preview.price_status, 'missing');
  assert.match(preview.price_reason, /No public price/);
});

test('a page-side snapshot becomes a captured preview without fetching the page', async () => {
  const capture = await captureFromSnapshot(bookmark, {
    title: 'Mongolian Cashmere Crewneck',
    brand: 'Quince',
    price: '59.90',
    currency: 'USD',
    price_source: 'json-ld',
    image: '',
    page_title: 'Cashmere Crewneck | Quince',
  });
  assert.equal(capture.product.title, 'Mongolian Cashmere Crewneck');
  assert.equal(capture.product.brand, 'Quince');
  assert.equal(capture.capturedPrice, 59.9);
  assert.equal(capture.product.price_source, 'json-ld');
  assert.equal(capture.mode, 'page');
  assert.equal(capture.confidence, 'high');

  const preview = previewFromCapture(bookmark, capture);
  assert.equal(preview.capture_mode, 'page');
  assert.equal(preview.price, 59.9);
  assert.equal(preview.currency, 'USD');
  assert.equal(preview.price_confidence, 'high');
  assert.match(preview.best_source, /open product tab/);
});

test('a low-confidence DOM snapshot stays visibly low confidence', async () => {
  const capture = await captureFromSnapshot(bookmark, {
    title: 'Merino Wool Coat',
    brand: 'Example Atelier',
    price: '249.95',
    currency: 'USD',
    price_source: 'dom',
    price_confidence: 'low',
  });
  assert.equal(capture.capturedPrice, 249.95);
  assert.equal(capture.product.price_source, 'dom');
  assert.equal(capture.confidence, 'low');

  const preview = previewFromCapture(bookmark, capture);
  assert.equal(preview.price_status, 'captured');
  assert.equal(preview.price_confidence, 'low');
  assert.match(preview.best_source, /low-confidence/);
});


test('a page-side non-USD price is reported instead of treated as dollars', async () => {
  const capture = await captureFromSnapshot(bookmark, {
    title: 'Wool Coat',
    brand: 'Example',
    price: '180',
    currency: 'GBP',
    price_source: 'meta',
  });
  assert.equal(capture.capturedPrice, null);
  assert.match(capture.reason, /GBP/);
  assert.match(capture.reason, /USD/);
});

test('a page-side snapshot rejects an invalid price instead of inventing one', async () => {
  await assert.rejects(
    captureFromSnapshot(bookmark, { title: 'Wool Coat', price: '-1' }),
    /Captured price must be between/,
  );
});

test('page-side provenance is preserved when the reviewed gate starts', () => {
  const wish = buildPromotedWish(bookmark, {}, {
    title: 'Wool Coat',
    brand: 'Example',
    captured_price: 180,
    retail_price: 180,
    lowest_verified_price: 180,
    image: '/media/images/abcd.jpg',
    best_source: 'Example product page (captured from the open product tab)',
    price_source: 'json-ld',
    capture_mode: 'page',
  });
  assert.match(wish.anti_hype_summary, /open product tab/);
  assert.equal(wish.price_confidence, 'high');
});

test('a low-confidence DOM price stays marked for verification when gated', () => {
  const wish = buildPromotedWish(bookmark, {}, {
    title: 'Merino Wool Coat',
    brand: 'Example Atelier',
    captured_price: 249.95,
    retail_price: 249.95,
    lowest_verified_price: 249.95,
    image: '/media/images/abcd.jpg',
    best_source: 'Example Atelier product page (low-confidence visible price)',
    price_source: 'dom',
    price_confidence: 'low',
    capture_mode: 'page',
  });
  assert.equal(wish.price_status, 'captured');
  assert.equal(wish.price_source, 'dom');
  assert.equal(wish.price_confidence, 'low');
  assert.match(wish.price_note, /Low-confidence/);
  assert.match(wish.anti_hype_summary, /not structured metadata/);
});
