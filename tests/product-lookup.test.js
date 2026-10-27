const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  cleanProductLine,
  decodeBingHref,
  extractProductQueries,
  lookupProduct,
  parseBingResults,
  parseBraveResults,
  scoreProduct,
} = require('../lib/product-lookup');

test('routine lines become product queries and notes are dropped', () => {
  const steps = [
    'AM — CeraVe Hydrating Cleanser',
    'The Ordinary Niacinamide 10% + Zinc 1%',
    'Apply EltaMD UV Clear SPF 46 to damp skin',
    'Wait 5 minutes before sunscreen',
    'Also drink water',
    'PM — Differin Adapalene 0.1% Gel',
    'La Roche-Posay Cicaplast Balm B5',
    'Cleanse with a gentle foaming cleanser',
  ];
  const queries = extractProductQueries(steps);
  assert.deepEqual(queries, [
    'CeraVe Hydrating Cleanser',
    'The Ordinary Niacinamide 10% + Zinc 1%',
    'EltaMD UV Clear SPF 46',
    'Differin Adapalene 0.1% Gel',
    'La Roche-Posay Cicaplast Balm B5',
  ]);
});

test('instruction tails and quantities are stripped before searching', () => {
  assert.equal(cleanProductLine('Apply 3 drops of The Ordinary Niacinamide to damp skin'), 'The Ordinary Niacinamide');
  assert.equal(cleanProductLine('1. Massage CeraVe Moisturising Cream until absorbed'), 'CeraVe Moisturising Cream');
  assert.equal(cleanProductLine('Note: patch test first'), '');
  assert.equal(cleanProductLine('SPF 50'), 'SPF 50');
});

test('Brave results are read from anchor titles and de-duplicated', () => {
  const html = `
    <a href="https://www.cerave.com/skincare/cleansers/hydrating-facial-cleanser" class="result">
      <div class="title search-snippet-title" title="Hydrating Facial Cleanser | CeraVe">Hydrating Facial Cleanser</div>
    </a>
    <a href="https://www.pinterest.com/pin/123" class="result">
      <div class="title search-snippet-title" title="CeraVe routine | Pinterest">CeraVe routine</div>
    </a>
    <a href="https://www.cerave.com/skincare/cleansers/hydrating-facial-cleanser" class="result">
      <div class="title search-snippet-title" title="Duplicate">Duplicate</div>
    </a>`;
  const results = parseBraveResults(html);
  assert.equal(results.length, 2);
  assert.equal(results[0].title, 'Hydrating Facial Cleanser | CeraVe');
  assert.equal(results[1].url, 'https://www.pinterest.com/pin/123');
});

test('Bing redirect URLs are unwrapped and titles lose markup', () => {
  const html = `<ol><li class="b_algo"><h2><a href="https://www.bing.com/ck/a?&amp;&amp;p=abc&amp;u=a1aHR0cHM6Ly93d3cudGFyZ2V0LmNvbS9wL2NlcmF2ZS1oeWRyYXRpbmctZmFjZS13YXNo&amp;ntb=1">CeraVe <strong>Hydrating</strong> Face Wash</a></h2></li></ol>`;
  const results = parseBingResults(html);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, 'https://www.target.com/p/cerave-hydrating-face-wash');
  assert.equal(results[0].title, 'CeraVe Hydrating Face Wash');
  assert.equal(decodeBingHref('https://www.target.com/p/cerave'), 'https://www.target.com/p/cerave');
  assert.equal(decodeBingHref('https://www.bing.com/ck/a?u=zzz'), '');
});

test('a product is accepted only when the page title matches the pasted name', () => {
  const strong = scoreProduct('CeraVe Hydrating Cleanser', 'Hydrating Facial Cleanser | CeraVe', 'CeraVe', 'https://www.cerave.com/x', { price: 11.99, image_url: 'https://cdn/x.jpg' });
  assert.equal(strong.accept, true);
  assert.ok(strong.coverage >= 0.99);

  const weak = scoreProduct('CeraVe Hydrating Cleanser', 'The 10 Best Face Washes of 2026', 'Beauty Desk', 'https://blog.example.com/best-face-washes', {});
  assert.equal(weak.accept, false);
});

test('lookup skips article results and returns a locally cached photo', async () => {
  const fetched = [];
  const product = await lookupProduct('CeraVe Hydrating Cleanser', {
    search: async () => [
      { url: 'https://blog.example.com/best-cleansers', title: 'Best cleansers' },
      { url: 'https://www.cerave.com/skincare/cleansers/hydrating-facial-cleanser', title: 'CeraVe' },
    ],
    fetchInfo: async (url) => {
      fetched.push(url);
      return {
        title: 'Hydrating Facial Cleanser | CeraVe',
        brand: 'CeraVe',
        price: 11.99,
        currency: 'USD',
        price_source: 'json-ld',
        image_url: 'https://cdn.cerave.com/cleanser.jpg',
        final_url: url,
      };
    },
    resolveImage: async () => '/media/images/cerave-cleanser.webp',
  });

  assert.deepEqual(fetched, ['https://www.cerave.com/skincare/cleansers/hydrating-facial-cleanser']);
  assert.equal(product.title, 'Hydrating Facial Cleanser | CeraVe');
  assert.equal(product.brand, 'CeraVe');
  assert.equal(product.price, 11.99);
  assert.equal(product.image, '/media/images/cerave-cleanser.webp');
  assert.equal(product.domain, 'cerave.com');
  assert.equal(product.confidence, 'high');
});

test('lookup refuses to invent a match and never returns a remote image', async () => {
  const product = await lookupProduct('CeraVe Hydrating Cleanser', {
    search: async () => [{ url: 'https://shop.example.com/daily-wash', title: 'Daily Wash' }],
    fetchInfo: async (url) => ({
      title: 'Daily Face Wash',
      brand: 'Example',
      price: null,
      currency: '',
      price_source: 'none',
      image_url: '',
      final_url: url,
    }),
  });
  assert.equal(product, null);
});

test('a pasted product URL bypasses search but still checks the title', async () => {
  let searched = false;
  const product = await lookupProduct('https://www.cerave.com/skincare/cleansers/hydrating-facial-cleanser', {
    search: async () => { searched = true; return []; },
    fetchInfo: async (url) => ({
      title: 'Hydrating Facial Cleanser | CeraVe',
      brand: 'CeraVe',
      price: 11.99,
      currency: 'USD',
      price_source: 'json-ld',
      image_url: '',
      final_url: url,
    }),
    resolveImage: async () => { throw new Error('no image'); },
  });
  assert.equal(searched, false);
  assert.equal(product.image, '');
  assert.equal(product.url, 'https://www.cerave.com/skincare/cleansers/hydrating-facial-cleanser');
});

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashov-lookup-'));
process.env.STASHOV_DATA_DIR = tempDir;
for (const name of ['vault.json', 'sections.json', 'clusters.json']) {
  fs.copyFileSync(path.join(__dirname, '..', 'data', name), path.join(tempDir, name));
}

const { createProtocol } = require('../lib/protocols');

test('protocols keep valid web products and sanitise the rest', async () => {
  const protocol = await createProtocol({
    title: 'Web product test',
    steps: ['CeraVe Hydrating Cleanser'],
    products: [
      {
        query: 'CeraVe Hydrating Cleanser',
        title: 'Hydrating Facial Cleanser | CeraVe',
        brand: 'CeraVe',
        price: '11.99',
        currency: 'USD',
        image: '/media/images/cerave.webp',
        url: 'https://www.cerave.com/skincare/cleansers/hydrating-facial-cleanser',
        domain: 'cerave.com',
        confidence: 'high',
        fetched_at: '2026-10-27T10:00:00.000Z',
      },
      { title: 'Remote image attempt', url: 'https://example.com/x', image: 'https://evil.example/x.svg' },
      { title: 'No URL' },
      { title: '', url: 'https://example.com/empty' },
      'not an object',
    ],
  });
  assert.equal(protocol.products.length, 2);
  assert.equal(protocol.products[0].price, 11.99);
  assert.equal(protocol.products[0].image, '/media/images/cerave.webp');
  assert.equal(protocol.products[0].confidence, 'high');
  assert.equal(protocol.products[1].image, '');
  assert.equal(protocol.products[1].price, null);
});
