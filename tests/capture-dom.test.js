const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const start = appSource.indexOf('function collectPageSnapshot()');
const end = appSource.indexOf('\nfunction captureBookmarkletCode(');
assert.ok(start > -1 && end > start, 'collectPageSnapshot should be extractable from public/app.js');
const extractorSource = appSource.slice(start, end);

function page(markup, { currency = 'USD', head = '' } = {}) {
  const currencyMeta = currency
    ? `<meta property="og:price:currency" content="${currency}">`
    : '';
  return `<!doctype html><html><head><title>Product</title>${currencyMeta}${head}</head><body>${markup}</body></html>`;
}

function snapshot(html, { url = 'https://shop.example.com/products/test' } = {}) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  const { window } = dom;
  window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    const top = Number(this.getAttribute('data-top') || 0);
    const height = Number(this.getAttribute('data-height') || 20);
    return { top, bottom: top + height, left: 0, right: 320, width: 320, height, x: 0, y: top, toJSON() { return {}; } };
  };
  const run = new Function('document', 'window', `${extractorSource}\nreturn collectPageSnapshot;`);
  return run(window.document, window)();
}

test('prefers the current sale price over a struck compare-at price', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Cashmere Crewneck</h1>
      <div class="product__info" data-top="120">
        <div class="price price--on-sale">
          <span class="price-item price-item--sale" data-top="140">$149.00</span>
          <s class="price-item price-item--regular" data-top="165">$199.00</s>
        </div>
        <button type="submit" name="add" data-top="210">Add to cart</button>
      </div>
    </main>`));

  assert.equal(result.price, '149');
  assert.equal(result.price_source, 'dom');
  assert.equal(result.price_confidence, 'low');
});

test('reads a regular price when the item is not on sale', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price price--regular" data-top="140">$199.00</span>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`));

  assert.equal(result.price, '199');
});

test('rejects a compare-at price marked only with a line-through style', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price price--regular" style="text-decoration: line-through" data-top="140">$199.00</span>
      <span class="price price--sale" data-top="165">$149.00</span>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`));

  assert.equal(result.price, '149');
});

test('rejects a compare-at price when no current price is visible', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <s class="price" data-top="140">$199.00</s>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`));

  assert.equal(result.price, '');
  assert.match(result.price_reason, /No visible price/);
});

test('refuses a price range instead of reporting its lowest value', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price" data-top="140">$20.00 - $40.00</span>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`));

  assert.equal(result.price, '');
  assert.match(result.price_reason, /price range/);
});

test('refuses a starting price from a multi-variant listing', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price" data-top="140">From $149.00</span>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`));

  assert.equal(result.price, '');
  assert.match(result.price_reason, /starting price/);
});

test('chooses the selected variant price over unselected variant tiles', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <div class="variant-picker">
        <button class="variant-price" aria-pressed="false" data-top="200">Small $120.00</button>
        <button class="variant-price is-selected" aria-pressed="true" data-top="220">Medium $125.00</button>
        <button class="variant-price" aria-pressed="false" data-top="240">Large $130.00</button>
      </div>
      <button type="submit" name="add" data-top="300">Add to cart</button>
    </main>`));

  assert.equal(result.price, '125');
});

test('asks for a variant when several variant prices are equally visible', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <button class="variant-price" data-top="200">Small $120.00</button>
      <button class="variant-price" data-top="220">Medium $125.00</button>
      <button class="variant-price" data-top="240">Large $130.00</button>
      <button type="submit" name="add" data-top="300">Add to cart</button>
    </main>`));

  assert.equal(result.price, '');
  assert.match(result.price_reason, /Several variant prices/);
});

test('accepts a price that is duplicated for screen readers', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price" data-top="140">$149.00 $149.00</span>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`));

  assert.equal(result.price, '149');
});

test('ignores prices inside a variant select and uses the displayed price', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <select class="variant-select">
        <option data-price="120.00" selected>$120.00</option>
        <option data-price="125.00">$125.00</option>
      </select>
      <span class="price" data-top="140">$125.00</span>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`));

  assert.equal(result.price, '125');
});

test('ignores installment copy that is not the item price', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price" data-top="140">or 4 payments of $37.25 with Klarna</span>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`));

  assert.equal(result.price, '');
});

test('ignores a monthly financing price', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price" data-top="140">$37.25 / month with Affirm</span>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`));

  assert.equal(result.price, '');
});

test('prefers the total price over a per-unit price', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Face Serum</h1>
      <div class="price">
        <span class="price-item price-item--sale" data-top="140">$149.00</span>
        <span class="unit-price" data-top="165">$0.15 / ml</span>
      </div>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`));

  assert.equal(result.price, '149');
});

test('does not multiply a bare cents data-price into dollars', () => {
  const cents = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price" data-price="14900" data-top="140"></span>
    </main>`));
  assert.equal(cents.price, '');

  const dollars = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price" data-price="149.00" data-top="140"></span>
    </main>`));
  assert.equal(dollars.price, '149');
});

test('prefers a visible selected variant price over an AggregateOffer range', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price" data-top="140">$35.00</span>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`, {
    head: `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Merino Crewneck',
      offers: { '@type': 'AggregateOffer', lowPrice: '20.00', highPrice: '40.00', priceCurrency: 'USD' }
    })}</script>`
  }));

  assert.equal(result.price, '35');
  assert.equal(result.price_source, 'dom');
  assert.equal(result.price_confidence, 'low');
});

test('keeps an exact JSON-LD offer ahead of the DOM fallback', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price" data-top="140">$35.00</span>
    </main>`, {
    head: `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Merino Crewneck',
      offers: { '@type': 'Offer', price: '30.00', priceCurrency: 'USD' }
    })}</script>`
  }));

  assert.equal(result.price, '30');
  assert.equal(result.price_source, 'json-ld');
  assert.equal(result.price_confidence, 'high');
});

test('keeps non-USD visible prices explicit instead of treating them as dollars', () => {
  const result = snapshot(page(`
    <main>
      <h1 data-top="100">Merino Crewneck</h1>
      <span class="price" data-top="140">£149.00</span>
      <button type="submit" name="add" data-top="210">Add to cart</button>
    </main>`, { currency: 'GBP' }));

  assert.equal(result.price, '');
  assert.match(result.price_reason, /GBP/);
});
