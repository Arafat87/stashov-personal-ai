/**
 * SSRF-safe outbound HTTP for user-supplied product and image URLs.
 *
 * The old code checked the hostname once and then followed redirects with
 * `fetch`, which let a public URL redirect to localhost, a link-local metadata
 * address, or an internal service. This module validates every hop, resolves
 * DNS itself, and pins the connection to the validated address so a second DNS
 * answer cannot rebind it between the check and the request.
 */

const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const ALLOWED_PORTS = new Set(['', '80', '443']);

class SafeFetchError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'SafeFetchError';
    this.status = status;
  }
}

function bareHost(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

function isPrivateIPv4(address) {
  const parts = String(address).split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  // Documentation, benchmarking, multicast, and reserved space.
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(address) {
  const value = String(address).toLowerCase().split('%')[0];
  if (value === '::' || value === '::1') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(value)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(value)) return true;
  if (/^ff[0-9a-f]{2}:/.test(value)) return true;
  if (/^fec[0-9a-f]:/.test(value)) return true;
  if (/^2001:db8:/.test(value)) return true;
  if (/^64:ff9b:/.test(value)) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const hexMapped = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const high = parseInt(hexMapped[1], 16);
    const low = parseInt(hexMapped[2], 16);
    return isPrivateIPv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return false;
}

function isPrivateAddress(address) {
  const family = net.isIP(String(address || '').split('%')[0]);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return false;
}

function isBlockedHostname(hostname) {
  const host = bareHost(hostname);
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return true;
  if (host === 'metadata.google.internal' || host === 'instance-data') return true;
  // URL() already canonicalizes numeric IPv4 forms, but reject any remaining
  // single-label host (an intranet name) rather than relying on DNS to fail.
  if (!host.includes('.') && !host.includes(':') && net.isIP(host) === 0) return true;
  return false;
}

function parseHttpUrl(raw) {
  let url;
  try {
    url = raw instanceof URL ? new URL(raw.href) : new URL(String(raw || '').trim());
  } catch (_) {
    throw new SafeFetchError('URL must be a valid public HTTP or HTTPS address.');
  }
  if (!/^https?:$/.test(url.protocol)) {
    throw new SafeFetchError('Only HTTP and HTTPS URLs are supported.');
  }
  if (url.username || url.password) {
    throw new SafeFetchError('URLs with embedded credentials are not allowed.');
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SafeFetchError('Only the standard HTTP and HTTPS ports are allowed.');
  }
  const hostname = bareHost(url.hostname);
  if (isBlockedHostname(hostname)) {
    throw new SafeFetchError('That host is not a public internet address.');
  }
  if (net.isIP(hostname) && isPrivateAddress(hostname)) {
    throw new SafeFetchError('Private and loopback addresses are blocked.');
  }
  return url;
}

async function resolvePublicAddress(hostname) {
  const host = bareHost(hostname);
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new SafeFetchError('Private and loopback addresses are blocked.');
    return { address: host, family: net.isIP(host) };
  }
  let records;
  try {
    records = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch (_) {
    throw new SafeFetchError('That host could not be resolved.', 422);
  }
  if (!records.length) throw new SafeFetchError('That host could not be resolved.', 422);
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new SafeFetchError('That host resolves to a private or loopback address.');
  }
  const preferred = records.find((record) => record.family === 4) || records[0];
  return { address: preferred.address, family: preferred.family };
}

async function validatePublicUrl(raw) {
  const url = parseHttpUrl(raw);
  const resolved = await resolvePublicAddress(url.hostname);
  return { url, ...resolved };
}

function requestOnce(url, target, options) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const hostname = bareHost(url.hostname);
    const headers = {
      host: url.host,
      'accept-encoding': 'identity',
      ...(options.headers || {}),
    };
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname || '/'}${url.search || ''}`,
        method: options.method || 'GET',
        headers,
        servername: url.protocol === 'https:' ? hostname : undefined,
        agent: false,
        lookup(_host, lookupOptions, callback) {
          // Node 20+ asks for the full address list (`all: true`) while older
          // versions ask for one address. Support both signatures.
          if (lookupOptions && lookupOptions.all) {
            callback(null, [{ address: target.address, family: target.family }]);
          } else {
            callback(null, target.address, target.family);
          }
        },
      },
      (response) => {
        const declared = Number(response.headers['content-length'] || 0);
        if (declared && declared > options.maxBytes) {
          response.resume();
          reject(new SafeFetchError('The response is too large.', 413));
          return;
        }
        const chunks = [];
        let total = 0;
        response.on('data', (chunk) => {
          total += chunk.length;
          if (total > options.maxBytes) {
            response.destroy();
            reject(new SafeFetchError('The response is too large.', 413));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({ response, body: Buffer.concat(chunks) });
        });
        response.on('error', reject);
      }
    );
    request.setTimeout(options.timeoutMs, () => {
      request.destroy(new SafeFetchError('The request timed out.', 504));
    });
    request.on('error', (error) => {
      if (error instanceof SafeFetchError) reject(error);
      else reject(new SafeFetchError('The remote host could not be reached.', 502));
    });
    request.end();
  });
}

/**
 * GET a public URL with per-hop SSRF validation, a response size cap, and a
 * timeout. Returns `{ status, headers, body, url }` where `url` is the final
 * URL after redirects.
 */
async function safeGet(rawUrl, options = {}) {
  const opts = {
    timeoutMs: Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS,
    maxBytes: Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_MAX_BYTES,
    maxRedirects: Number.isFinite(Number(options.maxRedirects)) ? Math.max(0, Number(options.maxRedirects)) : MAX_REDIRECTS,
    headers: options.headers || {},
    method: options.method || 'GET',
  };
  let current = parseHttpUrl(rawUrl);
  for (let hop = 0; hop <= opts.maxRedirects; hop += 1) {
    const target = await resolvePublicAddress(current.hostname);
    const { response, body } = await requestOnce(current, target, opts);
    const status = response.statusCode || 0;
    if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
      if (hop === opts.maxRedirects) throw new SafeFetchError('Too many redirects.', 508);
      let next;
      try {
        next = new URL(response.headers.location, current);
      } catch (_) {
        throw new SafeFetchError('The remote host returned an invalid redirect.', 502);
      }
      current = parseHttpUrl(next);
      continue;
    }
    return {
      status,
      headers: response.headers,
      body,
      url: current.href,
    };
  }
  throw new SafeFetchError('Too many redirects.', 508);
}

module.exports = {
  MAX_REDIRECTS,
  SafeFetchError,
  isBlockedHostname,
  isPrivateAddress,
  isPrivateIPv4,
  isPrivateIPv6,
  parseHttpUrl,
  resolvePublicAddress,
  safeGet,
  validatePublicUrl,
};
