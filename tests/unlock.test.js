const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TOKEN = 'test-access-token-123';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stashov-unlock-'));
process.env.STASHOV_DATA_DIR = tempDir;
process.env.STASHOV_ACCESS_TOKEN = TOKEN;
for (const name of ['vault.json', 'sections.json', 'clusters.json']) {
  fs.copyFileSync(path.join(__dirname, '..', 'data', name), path.join(tempDir, name));
}

const server = require('../server');

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.form
      ? new URLSearchParams(options.form).toString()
      : options.body;
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: pathname,
      method: options.method || 'GET',
      headers: {
        host: `127.0.0.1:${port}`,
        ...(options.form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...(body && !options.form ? { 'content-type': 'application/json' } : {}),
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
    if (body) req.write(body);
    req.end();
  });
}

test('the vault requires a token and throttles guessing', async (t) => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const lockedOut = await request(port, '/api/vault');
  assert.equal(lockedOut.status, 401);

  const homeRedirect = await request(port, '/');
  assert.equal(homeRedirect.status, 302);
  assert.match(homeRedirect.headers.location || '', /^\/unlock\?next=/);

  const login = await request(port, '/unlock', {
    method: 'POST',
    form: { token: TOKEN, next: '/' },
  });
  assert.equal(login.status, 302);
  assert.equal(login.headers.location, '/');
  const cookie = String(login.headers['set-cookie'] || '');
  assert.match(cookie, /stashov_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);

  const session = cookie.split(';')[0];
  const unlocked = await request(port, '/api/vault', { headers: { cookie: session } });
  assert.equal(unlocked.status, 200);

  for (let attempt = 0; attempt < 9; attempt += 1) {
    const wrong = await request(port, '/unlock', {
      method: 'POST',
      form: { token: `wrong-${attempt}`, next: '/' },
    });
    assert.equal(wrong.status, 302);
    assert.equal(wrong.headers.location, '/unlock?error=1');
  }

  const throttled = await request(port, '/unlock', {
    method: 'POST',
    form: { token: TOKEN, next: '/' },
  });
  assert.equal(throttled.status, 429);
  assert.equal(throttled.headers['retry-after'], '900');
});
