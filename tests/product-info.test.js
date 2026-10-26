const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeCurrency, parsePriceValue, parseProductInfo } = require('../lib/product-info');

test('JSON-LD Product supplies title, brand, price, and image', () => {
  const html = `
    <html><head><title>Fallback title</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"Mongolian Cashmere Crewneck",
       "brand":{"@type":"Brand","name":"Quince"},
       "image":["https://cdn.example.com/cashmere.jpg"],
       "offers":{"@type":"Offer","price":"59.90","priceCurrency":"USD","availability":"https://schema.org/InStock"}}
    </script></head><body></body></html>`;
  const info = parseProductInfo(html, 'https://www.quince.com/cashmere');
  assert.equal(info.title, 'Mongolian Cashmere Crewneck');
  assert.equal(info.brand, 'Quince');
  assert.equal(info.price, 59.9);
  assert.equal(info.currency, 'USD');
  assert.equal(info.price_source, 'json-ld');
  assert.equal(info.price_reason, '');
  assert.equal(info.image_url, 'https://cdn.example.com/cashmere.jpg');
});

test('OpenGraph meta tags work in either attribute order and fall back for title', () => {
  const html = `
    <html><head>
      <title>Ignored because OG exists</title>
      <meta content="Oak Headphones" property="og:title">
      <meta property="og:site_name" content="Oak Audio">
      <meta content="249.00" property="product:price:amount">
      <meta property="og:price:currency" content="USD">
      <meta content="https://cdn.example.com/oak.png" property="og:image">
    </head></html>`;
  const info = parseProductInfo(html, 'https://oak.example.com/headphones');
  assert.equal(info.title, 'Oak Headphones');
  assert.equal(info.brand, 'Oak Audio');
  assert.equal(info.price, 249);
  assert.equal(info.currency, 'USD');
  assert.equal(info.price_source, 'meta');
  assert.equal(info.price_reason, '');
  assert.equal(info.image_url, 'https://cdn.example.com/oak.png');
});

test('A non-USD price is reported instead of silently treated as dollars', () => {
  const html = `
    <html><head>
      <meta property="og:title" content="Wool Coat">
      <meta property="product:price:amount" content="£180.00">
      <meta property="product:price:currency" content="GBP">
    </head></html>`;
  const info = parseProductInfo(html, 'https://example.co.uk/coat');
  assert.equal(info.price, null);
  assert.equal(info.currency, '');
  assert.match(info.price_reason, /GBP/);
  assert.match(info.price_reason, /USD/);
});

test('Missing price is explicit, never invented', () => {
  const info = parseProductInfo('<html><head><title>Mystery item</title></head><body>Contact us</body></html>');
  assert.equal(info.title, 'Mystery item');
  assert.equal(info.price, null);
  assert.equal(info.price_source, 'none');
  assert.match(info.price_reason, /No public price/);
});

test('Price values tolerate currency symbols and thousands separators', () => {
  assert.equal(parsePriceValue('$1,299.00'), 1299);
  assert.equal(parsePriceValue('1099,50'), 1099.5);
  assert.equal(parsePriceValue('0'), null);
  assert.equal(parsePriceValue('free'), null);
  assert.equal(normalizeCurrency('$'), 'USD');
  assert.equal(normalizeCurrency('usd'), 'USD');
  assert.equal(normalizeCurrency('£'), 'GBP');
});
