const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashov-search-'));
process.env.STASHOV_DATA_DIR = tempDir;
for (const name of ['vault.json', 'sections.json', 'clusters.json']) {
  fs.copyFileSync(path.join(__dirname, '..', 'data', name), path.join(tempDir, name));
}

const server = require('../server');

function get(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
    });
    req.on('error', reject);
    req.end();
  });
}

test('search only returns links that share a real word with the query', async (t) => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const nonsense = await get(port, '/api/bookmarks?q=zzzznotathing&limit=10');
  assert.equal(nonsense.total, 0);
  assert.deepEqual(nonsense.items, []);

  // The stored vectors are hashed bags of words, not real embeddings, so a
  // vector-only “match” must never pad a result list.
  const minecraft = await get(port, '/api/bookmarks?q=minecraft&limit=10');
  assert.equal(minecraft.total, 0);

  const cashmere = await get(port, '/api/bookmarks?q=cashmere&limit=10');
  assert.ok(cashmere.total >= 1, 'cashmere should find the cashmere bookmark');
  assert.ok(
    cashmere.items.every((item) =>
      `${item.title || ''} ${item.domain || ''} ${(item.tags || []).join(' ')} ${item.description || ''} ${item.use_for || ''}`
        .toLowerCase()
        .includes('cashmere')
    ),
    'every result should actually contain the query word'
  );

  const phrase = await get(port, '/api/bookmarks?q=soccer%20kit&limit=5');
  assert.ok(phrase.total >= 1);
  assert.match(String(phrase.items[0].title).toLowerCase(), /soccer/);

  const categoryFiltered = await get(port, '/api/bookmarks?category=Menswear%20%26%20Streetwear&q=hoodie&limit=5');
  assert.ok(categoryFiltered.items.every((item) => item.category === 'Menswear & Streetwear'));
});
