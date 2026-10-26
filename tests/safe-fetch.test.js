const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isPrivateAddress,
  isPrivateIPv4,
  isPrivateIPv6,
  parseHttpUrl,
  validatePublicUrl,
  safeGet,
} = require('../lib/safe-fetch');
const { sniffImageType } = require('../lib/image-cache');

test('private IPv4 ranges are blocked, including CGNAT, metadata, and documentation space', () => {
  for (const address of ['127.0.0.1', '10.0.0.4', '192.168.1.2', '169.254.169.254', '172.16.9.2', '100.64.1.1', '0.0.0.0', '224.0.0.1', '255.255.255.255']) {
    assert.equal(isPrivateIPv4(address), true, address);
  }
  assert.equal(isPrivateIPv4('8.8.8.8'), false);
  assert.equal(isPrivateIPv4('1.1.1.1'), false);
});

test('private IPv6 ranges are blocked, including mapped loopback and link-local', () => {
  for (const address of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '2001:db8::1']) {
    assert.equal(isPrivateIPv6(address), true, address);
  }
  assert.equal(isPrivateIPv6('2606:4700:4700::1111'), false);
});

test('URL policy rejects credentials, non-HTTP schemes, unusual ports, and private hosts', () => {
  assert.throws(() => parseHttpUrl('https://user:pass@example.com'), /credentials/i);
  assert.throws(() => parseHttpUrl('file:///etc/passwd'), /HTTP and HTTPS/i);
  assert.throws(() => parseHttpUrl('https://example.com:8443'), /standard HTTP and HTTPS ports/i);
  assert.throws(() => parseHttpUrl('http://127.0.0.1/'), /private|loopback|public/i);
  assert.throws(() => parseHttpUrl('http://localhost/'), /public internet address/i);
  assert.throws(() => parseHttpUrl('http://metadata.google.internal/'), /public internet address/i);
  assert.equal(parseHttpUrl('https://example.com/product').hostname, 'example.com');
});

test('validation rejects a DNS name that resolves to loopback and accepts a public host', async () => {
  await assert.rejects(validatePublicUrl('http://localhost.test/'), /public internet address|resolve/i);
  const result = await validatePublicUrl('https://example.com');
  assert.equal(result.url.hostname, 'example.com');
  assert.ok(result.address);
});

test('safeGet refuses loopback before opening a socket', async () => {
  await assert.rejects(safeGet('http://127.0.0.1/'), /private|loopback|public/i);
  await assert.rejects(safeGet('http://169.254.169.254/latest/meta-data'), /private|loopback|public/i);
});

test('image sniffing accepts raster magic bytes and rejects SVG or HTML', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(sniffImageType(png), 'image/png');
  assert.equal(sniffImageType(Buffer.from('<svg><script>alert(1)</script></svg>')), '');
  assert.equal(sniffImageType(Buffer.from('<!doctype html><title>not an image</title>')), '');
});
