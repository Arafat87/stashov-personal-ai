const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashov-server-'));
process.env.STASHOV_DATA_DIR = tempDir;
for (const name of ['vault.json', 'sections.json', 'clusters.json']) {
  fs.copyFileSync(path.join(__dirname, '..', 'data', name), path.join(tempDir, name));
}

const server = require('../server');

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: pathname,
      method: options.method || 'GET',
      headers: {
        host: `127.0.0.1:${port}`,
        ...(options.headers || {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

test('security middleware protects the vault API', async (t) => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const health = await request(port, '/api/health');
  assert.equal(health.status, 200);
  assert.equal(JSON.parse(health.body).ok, true);

  const home = await request(port, '/');
  assert.equal(home.status, 200);
  assert.match(home.headers['content-security-policy'] || '', /script-src 'self'/);
  assert.match(home.headers['content-security-policy'] || '', /frame-ancestors 'none'/);
  assert.equal(home.headers['x-frame-options'], 'DENY');
  assert.equal(home.headers['x-content-type-options'], 'nosniff');
  assert.equal(home.headers['access-control-allow-origin'], undefined);

  const crossOrigin = await request(port, '/api/budget', {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    body: JSON.stringify({ cap: 1 }),
  });
  assert.equal(crossOrigin.status, 403);

  const wrongType = await request(port, '/api/budget', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: JSON.stringify({ cap: 1 }),
  });
  assert.equal(wrongType.status, 415);

  const badHost = await request(port, '/', { headers: { host: 'evil.example' } });
  assert.equal(badHost.status, 403);

  // A Host header that `new URL` cannot parse must be a 400, not an unhandled
  // rejection that kills the process.
  const malformedHost = await request(port, '/api/health', { headers: { host: 'a b' } });
  assert.equal(malformedHost.status, 400);
  const stillAlive = await request(port, '/api/health');
  assert.equal(stillAlive.status, 200);

  // A bodyless DELETE is a valid API write and must not demand JSON.
  const bodylessDelete = await request(port, '/api/protocols/proto_missing', { method: 'DELETE' });
  assert.equal(bodylessDelete.status, 400);
  assert.notEqual(bodylessDelete.status, 415);

  const traversal = await request(port, '/%2e%2e/server.js');
  assert.ok([403, 404].includes(traversal.status), `expected traversal to be blocked, got ${traversal.status}`);

  const exported = await request(port, '/api/export');
  assert.equal(exported.status, 200);
  assert.match(exported.headers['content-disposition'] || '', /attachment; filename="stashov-/);
  assert.ok(JSON.parse(exported.body).vault.bookmarks.length >= 1300);

  const invalidImport = await request(port, '/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nope: true }),
  });
  assert.equal(invalidImport.status, 400);

  const badMedia = await request(port, '/media/images/..%2fserver.js');
  assert.ok([400, 404].includes(badMedia.status), `expected invalid media name to be rejected, got ${badMedia.status}`);

  const duplicatePreview = await request(port, '/api/bookmark-preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: 'https://example.com/duplicate-check',
      snapshot: {
        title: 'Acqua di Parma Colonia Essenza Eau de Cologne (100ml)',
        price: '108',
        currency: 'USD',
        price_source: 'json-ld',
      },
    }),
  });
  assert.equal(duplicatePreview.status, 200);
  const duplicateBody = JSON.parse(duplicatePreview.body);
  assert.equal(duplicateBody.possible_duplicates.length >= 1, true);
  assert.equal(duplicateBody.possible_duplicates[0].id, 'wl_01');
});

test('library duplicate review archives extras and restores them', async (t) => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const review = await request(port, '/api/library/duplicates');
  assert.equal(review.status, 200);
  const reviewBody = JSON.parse(review.body);
  assert.ok(reviewBody.groups.length >= 1, 'seed vault should contain duplicate library links');
  const group = reviewBody.groups[0];
  assert.ok(group.items.length >= 2);
  const extras = group.items.slice(1).map((item) => item.id);

  const archived = await request(port, '/api/library/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'archive', ids: extras }),
  });
  assert.equal(archived.status, 200);
  assert.equal(JSON.parse(archived.body).updated, extras.length);

  const archivedList = await request(port, '/api/library?status=archived&limit=100');
  assert.equal(archivedList.status, 200);
  const archivedBody = JSON.parse(archivedList.body);
  assert.ok(archivedBody.items.every((item) => item.archived));
  assert.ok(extras.every((id) => archivedBody.items.some((item) => item.id === id)));

  const after = await request(port, '/api/library/duplicates');
  assert.ok(!JSON.parse(after.body).groups.some((entry) => entry.key === group.key));

  const restored = await request(port, '/api/library/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'restore', ids: extras }),
  });
  assert.equal(restored.status, 200);
  assert.equal(JSON.parse(restored.body).updated, extras.length);
  const restoredList = await request(port, '/api/library?status=archived&limit=100');
  assert.ok(!JSON.parse(restoredList.body).items.some((item) => extras.includes(item.id)));
});
