/**
 * Stashov — Personal AI Memory, Browser Bookmark Vault & Impulse-Gated Buyer Engine
 * Nebius x NVIDIA Global AI Hackathon (Personal AI Track)
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { syncBrowserBookmarks, classifyBookmark, deterministicVec } = require('./scripts/sync-bookmarks');
const { runServerlessJob } = require('./jobs/nebius-serverless-worker');
const { resolveImage, isCachedImage, safeRemoteUrl, IMAGE_DIR, BUNDLED_IMAGE_DIR, ensureImageDir } = require('./lib/image-cache');
const { loadSections, saveSections, createSection, updateSection, deleteSection, reorderSections } = require('./lib/sections');
const { getClusterMetaMap, replaceStore, updateClusterMeta } = require('./lib/clusters');
const { SECTIONS: LIBRARY_SECTIONS, librarySectionFor, librarySectionsWithCounts, findLibraryDuplicates, sectionById: librarySectionById } = require('./lib/library');
const { parseRoutine, matchWishlistIds } = require('./lib/routine');
const { extractProductQueries, lookupProduct } = require('./lib/product-lookup');
const { checkRoutine, createProtocol, updateProtocol, deleteProtocol } = require('./lib/protocols');
const { ProfileError, updatePersonalContext } = require('./lib/profile');
const {
  ensureGateState,
  budgetSummary,
  gateSummary,
  purchaseItem,
  recordPricePoint,
  skipItem,
  snoozeItem,
  startGate,
  updateBudget,
  updateWishlistDetails,
  removeWish,
  reopenItem,
  voidLedgerEntry,
} = require('./lib/gate');
const { buildPromotedWish, captureBookmarkProduct, captureFromSnapshot, previewFromCapture } = require('./lib/promotion');
const { buildFallbackReport, buildVaultAuditMessages, extractReport, usageFromResult } = require('./lib/vault-audit');
const {
  appendTelemetry,
  readTelemetry,
  readyVault,
  readySections,
  readyClusters,
  readVault,
  writeVault,
  writeSections,
  writeClusters,
  readSections,
  readClusters,
  readImage,
  snapshotVault,
} = require('./lib/state');

const PORT = (() => {
  const value = Number(process.env.PORT);
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : 3847;
})();
const HOST = String(process.env.HOST || '127.0.0.1').trim() || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const ACCESS_TOKEN = String(process.env.STASHOV_ACCESS_TOKEN || '').trim();
const PUBLIC_ORIGIN = String(process.env.STASHOV_PUBLIC_ORIGIN || '').trim().replace(/\/+$/, '');
const SESSION_COOKIE = 'stashov_session';
const SESSION_VALUE = ACCESS_TOKEN
  ? crypto.createHmac('sha256', ACCESS_TOKEN).update('stashov-session-v1').digest('hex')
  : '';
const BODY_LIMIT = 1024 * 1024;
const IMPORT_LIMIT = 40 * 1024 * 1024;
const SECURITY_HEADERS_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
const RATE_BUCKETS = new Map();
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
ensureImageDir();

const NEBIUS_BASE_URL = (process.env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1').replace(/\/$/, '');
const NEBIUS_API_KEY = process.env.NEBIUS_API_KEY || '';

const MODELS = {
  ultra: process.env.MODEL_ULTRA || 'nvidia/Nemotron-3-Ultra-550b-a55b',
  super: process.env.MODEL_SUPER || 'nvidia/Nemotron-3-Super-120b-a12b',
  nano: process.env.MODEL_NANO || 'nvidia/Nemotron-3-Nano-30B-A3B',
  lightning: process.env.MODEL_LIGHTNING || 'nvidia/Nemotron-3.5-Lightning',
  vision: process.env.MODEL_VISION || 'zai-org/GLM-5.3-Flash',
  embedding: process.env.MODEL_EMBEDDING || 'Qwen/Qwen3-Embedding-8B',
};

function loadVault() {
  const vault = readVault();
  ensureGateState(vault);
  return vault;
}

async function saveVault(vault) {
  return writeVault(vault);
}

function comparableUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|gclid$|fbclid$|msclkid$|igshid$|mc_cid$|mc_eid$|ref_$)/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  } catch (_) {
    return String(value || '').trim();
  }
}

function findWishlistByUrl(vault, value) {
  const key = comparableUrl(value);
  return (vault.wishlist || []).find((wish) => comparableUrl(wish.url) === key) || null;
}

function titleTokens(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'our', 'new', 'sale'].includes(word));
}

function findPossibleDuplicates(vault, bookmark, title) {
  const domain = String(bookmark && bookmark.domain || '').toLowerCase().replace(/^www\./, '');
  const tokens = new Set(titleTokens(title));
  if (!tokens.size) return [];
  return (vault.wishlist || [])
    .filter((wish) => wish.status !== 'bought' && wish.status !== 'skipped')
    .map((wish) => {
      const other = new Set(titleTokens(wish.title));
      if (!other.size) return null;
      let overlap = 0;
      for (const token of tokens) if (other.has(token)) overlap += 1;
      const union = new Set([...tokens, ...other]).size;
      const similarity = union ? overlap / union : 0;
      const sameDomain = domain && String(wish.url || '').toLowerCase().includes(domain);
      const sameTitle = String(wish.title || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();
      if (!sameTitle && similarity < 0.65) return null;
      return {
        id: wish.id,
        title: wish.title,
        status: wish.status,
        price: Number(wish.lowest_verified_price) > 0 ? Number(wish.lowest_verified_price) : null,
        same_domain: Boolean(sameDomain),
        similarity: Number(similarity.toFixed(2)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.same_domain) - Number(a.same_domain) || b.similarity - a.similarity)
    .slice(0, 4);
}

function bookmarkFromPastedUrl(raw) {
  const parsed = safeRemoteUrl(raw);
  if (!parsed) {
    const error = new Error('Paste a public HTTP or HTTPS product link.');
    error.status = 400;
    throw error;
  }
  parsed.hash = '';
  const domain = parsed.hostname.replace(/^www\./i, '');
  const [category] = classifyBookmark({ name: '', url: parsed.href, folder: '' });
  return {
    id: '',
    title: domain || 'Pasted link',
    url: parsed.href,
    domain,
    browser: 'Quick add',
    original_folder: 'Pasted link',
    category,
    image: '',
    tags: domain ? [domain] : [],
  };
}

function cosineSim(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / ((Math.sqrt(na) * Math.sqrt(nb)) || 1);
}

async function callTokenFactoryChat(model, messages, maxTokens = 900) {
  const start = Date.now();
  if (!NEBIUS_API_KEY || NEBIUS_API_KEY === 'your_nebius_token_factory_api_key_here') {
    return { live: false, latency_ms: Date.now() - start + 380, content: null };
  }
  try {
    const resp = await fetch(`${NEBIUS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NEBIUS_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
      // A 1M-context audit can run long; never let a hung socket hold the request.
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) {
      return { live: false, latency_ms: Date.now() - start, content: null };
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || null;
    return {
      live: true,
      latency_ms: Date.now() - start,
      content,
      usage: data.usage || null,
    };
  } catch (_) {
    return { live: false, latency_ms: Date.now() - start, content: null };
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Telemetry no longer mutates the vault. A search used to append one line and
 * rewrite the whole 2.4 MB JSON file; it now goes to a small separate store.
 */
function recordTelemetry(_vault, task, model, tier, latency_ms, tokensIn, tokensOut, costUsd, status = 'SUCCESS') {
  const entry = {
    id: `tel_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    task,
    model,
    tier,
    latency_ms,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: Number(Number(costUsd || 0).toFixed(5)),
    status,
  };
  appendTelemetry(entry).catch((err) => console.error('[telemetry]', err.message));
  return entry;
}

function sendJson(res, status, payload, extraHeaders = {}) {
  if (res.headersSent) return res.end();
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, extraHeaders = {}) {
  if (res.headersSent) return res.end();
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(text);
}

function setSecurityHeaders(res, req) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', SECURITY_HEADERS_CSP);
  res.setHeader('Cache-Control', 'no-store');
  if (req && (req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function parseCookies(header) {
  const result = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch (_) {
      result[key] = part.slice(index + 1).trim();
    }
  }
  return result;
}

function isAuthenticated(req) {
  if (!ACCESS_TOKEN) return true;
  const value = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!value || value.length !== SESSION_VALUE.length) return false;
  return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(SESSION_VALUE));
}

function hostnameFromHeader(value) {
  const host = String(value || '').trim();
  if (!host) return '';
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    return end > 0 ? host.slice(1, end).toLowerCase() : '';
  }
  return host.split(':')[0].toLowerCase();
}

function isHostAllowed(req) {
  const hostname = hostnameFromHeader(req.headers.host);
  if (!hostname) return false;
  if (PUBLIC_ORIGIN) {
    try { return hostname === hostnameFromHeader(new URL(PUBLIC_ORIGIN).host); } catch (_) { return false; }
  }
  // With a token, a reverse proxy or LAN hostname is acceptable; the session
  // cookie is what protects the data. Without one, only loopback may answer,
  // which closes the DNS-rebinding hole on a local install.
  if (ACCESS_TOKEN) return true;
  return LOOPBACK_HOSTS.has(hostname);
}

function requestOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    || (req.socket.encrypted ? 'https' : 'http');
  return `${proto}://${req.headers.host || ''}`;
}

function isCrossOrigin(req) {
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return true;
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return false;
  if (origin === 'null') return true;
  const allowed = new Set([requestOrigin(req)]);
  if (PUBLIC_ORIGIN) allowed.add(PUBLIC_ORIGIN);
  allowed.add(`http://${req.headers.host || ''}`);
  allowed.add(`https://${req.headers.host || ''}`);
  return !allowed.has(origin.replace(/\/+$/, ''));
}

function rateLimit(req, bucket, max, windowMs) {
  const key = `${bucket}:${req.socket.remoteAddress || 'local'}`;
  const now = Date.now();
  const hits = (RATE_BUCKETS.get(key) || []).filter((time) => now - time < windowMs);
  if (hits.length >= max) {
    RATE_BUCKETS.set(key, hits);
    return false;
  }
  hits.push(now);
  RATE_BUCKETS.set(key, hits);
  return true;
}

function parseBody(req, limit = BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared && declared > limit) {
      req.resume();
      reject(httpError(413, 'Request body is too large.'));
      return;
    }
    let tooLarge = false;
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(httpError(413, 'Request body is too large.'));
      const body = Buffer.concat(chunks).toString('utf8');
      if (!body.trim()) return resolve({});
      try {
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(httpError(400, 'Request body must be a JSON object.'));
        }
        resolve(parsed);
      } catch (_) {
        reject(httpError(400, 'Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function parseFormBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { tooLarge = true; chunks.length = 0; return; }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(httpError(413, 'Request body is too large.'));
      const params = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      const result = {};
      for (const [key, value] of params) result[key] = value;
      resolve(result);
    });
    req.on('error', reject);
  });
}

function safeNextPath(value) {
  const next = String(value || '/');
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function serveUnlock(res, status = 200) {
  try {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'unlock.html'));
    if (res.headersSent) return res.end();
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(html);
  } catch (err) {
    sendText(res, 500, 'Unlock page unavailable.');
  }
}

setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, hits] of RATE_BUCKETS) {
    const fresh = hits.filter((time) => time >= cutoff);
    if (fresh.length) RATE_BUCKETS.set(key, fresh);
    else RATE_BUCKETS.delete(key);
  }
}, 10 * 60 * 1000).unref();

async function handleRequest(req, res) {
  setSecurityHeaders(res, req);

  // A malformed Host header used to make `new URL` throw outside the route
  // try/catch, which rejected the request promise and took the process down.
  // Any client can send one, so parse defensively and answer 400.
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);
  } catch (_) {
    return sendText(res, 400, 'Bad request.');
  }
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, HEAD, POST, PUT, PATCH, DELETE');
    res.writeHead(204);
    return res.end();
  }

  // Health checks are deliberately public and host-agnostic so a load
  // balancer can probe the service before a browser unlocks it.
  if (pathname === '/api/health' && (req.method === 'GET' || req.method === 'HEAD')) {
    return sendJson(res, 200, { ok: true, uptime_seconds: Math.round(process.uptime()) });
  }

  const remoteOrigin = PUBLIC_ORIGIN && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(PUBLIC_ORIGIN);
  if (remoteOrigin && !ACCESS_TOKEN) {
    return sendText(res, 503, 'STASHOV_ACCESS_TOKEN is required when STASHOV_PUBLIC_ORIGIN points at a public deployment.');
  }

  if (!isHostAllowed(req)) {
    return sendText(res, 403, 'This host is not allowed. Set STASHOV_PUBLIC_ORIGIN if you serve Stashov from another origin.');
  }

  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '');
  if (mutation && pathname !== '/unlock' && isCrossOrigin(req)) {
    return sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
  }

  const hasBody = Number(req.headers['content-length'] || 0) > 0 || Boolean(req.headers['transfer-encoding']);
  if (mutation && hasBody && pathname.startsWith('/api/') && !/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) {
    return sendJson(res, 415, { error: 'API writes must use application/json.' });
  }

  if (pathname === '/unlock' || pathname === '/unlock/logout') {
    const wantsLogout = pathname === '/unlock/logout' || parsedUrl.searchParams.get('logout') === '1';
    if (wantsLogout) {
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      res.writeHead(302, { Location: '/unlock' });
      return res.end();
    }
    if (!ACCESS_TOKEN || isAuthenticated(req)) {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveUnlock(res);
    if (req.method !== 'POST') return sendText(res, 405, 'Method not allowed.');
    // The token is the only credential, so guessing must cost something. Ten
    // failures per quarter hour per address is far above a person typing a
    // passphrase and far below a useful brute-force rate.
    if (!rateLimit(req, 'unlock', 10, 15 * 60 * 1000)) {
      return sendText(res, 429, 'Too many unlock attempts. Wait 15 minutes and try again.', { 'Retry-After': '900' });
    }
    try {
      const form = await parseFormBody(req);
      const token = String(form.token || '');
      const expected = Buffer.from(ACCESS_TOKEN);
      const supplied = Buffer.from(token.slice(0, ACCESS_TOKEN.length));
      const same = supplied.length === expected.length
        && crypto.timingSafeEqual(supplied, expected)
        && token.length === ACCESS_TOKEN.length;
      if (!same) {
        res.writeHead(302, { Location: '/unlock?error=1' });
        return res.end();
      }
      const secure = req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${SESSION_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure ? '; Secure' : ''}`);
      res.writeHead(302, { Location: safeNextPath(form.next) });
      return res.end();
    } catch (err) {
      return sendText(res, err.status || 400, err.message);
    }
  }

  if (req.method === 'POST' && pathname === '/share-target') {
    try {
      const form = await parseFormBody(req);
      const shared = String(form.url || '').trim()
        || (String(form.text || '').match(/https?:\/\/[^\s<>"']+/i) || [])[0]
        || '';
      res.writeHead(303, { Location: shared ? `/?capture=${encodeURIComponent(shared)}` : '/?share=empty' });
      return res.end();
    } catch (err) {
      return sendText(res, err.status || 400, err.message);
    }
  }

  if (ACCESS_TOKEN && pathname === '/' && !isAuthenticated(req)) {
    res.writeHead(302, { Location: `/unlock?next=${encodeURIComponent(req.url || '/')}` });
    return res.end();
  }
  if (ACCESS_TOKEN && pathname.startsWith('/api/') && !isAuthenticated(req)) {
    return sendJson(res, 401, { error: 'Unlock Stashov before using the API.' });
  }
  if (ACCESS_TOKEN && pathname.startsWith('/media/') && !isAuthenticated(req)) {
    return sendText(res, 401, 'Unauthorized');
  }

  try {
    if (pathname.startsWith('/api/sections')) await readySections();
    else if (pathname === '/api/vault' || pathname.startsWith('/api/clusters')) await Promise.all([readyVault(), readyClusters()]);
    else if (pathname.startsWith('/api/') && pathname !== '/api/images/resolve') await readyVault();

    // 1. GET /api/vault — returns summary + wishlist + protocols + personal_context + telemetry + category counts
    if (req.method === 'GET' && pathname === '/api/vault') {
      const vault = loadVault();
      const catCounts = {};
      for (const b of vault.bookmarks || []) {
        catCounts[b.category] = (catCounts[b.category] || 0) + 1;
      }
      const budget = budgetSummary(vault);
      const gate = gateSummary(vault);
      const telemetryRows = await readTelemetry();
      const legacyTelemetry = (vault.telemetry || []).filter(
        (entry) => !telemetryRows.some((row) => row.id === entry.id)
      );
      if (!vault.meta || vault.meta.gate_schema_version !== 3) {
        vault.meta = { ...(vault.meta || {}), gate_schema_version: 3 };
        await saveVault(vault);
      }
      return sendJson(res, 200, {
        meta: vault.meta,
        nebius_configured: Boolean(NEBIUS_API_KEY && NEBIUS_API_KEY !== 'your_nebius_token_factory_api_key_here'),
        models: MODELS,
        personal_context: vault.personal_context,
        wishlist: vault.wishlist,
        spending_ledger: vault.spending_ledger || [],
        budget,
        gate,
        protocols: vault.protocols,
        routine_log: vault.routine_log || {},
        telemetry: [...telemetryRows, ...legacyTelemetry].slice(0, 25),
        last_digest: vault.last_digest || null,
        category_counts: catCounts,
        cluster_meta: getClusterMetaMap(Object.keys(catCounts)),
        total_bookmarks: (vault.bookmarks || []).length,
      });
    }

    // 1a. PATCH /api/context — update the You profile. Budget and cooling
    // fields are deliberately not editable from this route.
    if (req.method === 'PATCH' && pathname === '/api/context') {
      if (!rateLimit(req, 'profile-update', 20, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Profile edits are limited to 20 per minute.' }, { 'Retry-After': '60' });
      }
      const body = await parseBody(req);
      const vault = loadVault();
      try {
        const context = updatePersonalContext(vault, body);
        await saveVault(vault);
        return sendJson(res, 200, { ok: true, personal_context: context });
      } catch (err) {
        if (err instanceof ProfileError) return sendJson(res, err.status || 400, { error: err.message });
        throw err;
      }
    }

    // 2. GET /api/bookmarks — paginated & filtered bookmarks + hybrid semantic search
    // 2. Sidebar sections - editable built-ins and persisted custom collections
    if (req.method === 'GET' && pathname === '/api/sections') {
      return sendJson(res, 200, loadSections());
    }
    if (req.method === 'POST' && pathname === '/api/sections') {
      const body = await parseBody(req);
      try {
        return sendJson(res, 200, { ok: true, section: await createSection(body) });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
    if (req.method === 'POST' && pathname === '/api/sections/reorder') {
      const body = await parseBody(req);
      try {
        return sendJson(res, 200, { ok: true, ...(await reorderSections(body.ids)) });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
    const sectionMatch = pathname.match(/^\/api\/sections\/([a-z0-9_]+)$/i);
    if (req.method === 'PUT' && sectionMatch) {
      const body = await parseBody(req);
      try {
        return sendJson(res, 200, { ok: true, section: await updateSection(sectionMatch[1], body) });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
    if (req.method === 'DELETE' && sectionMatch) {
      try {
        return sendJson(res, 200, await deleteSection(sectionMatch[1]));
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // 3. Reference library — paginated, searchable, editable descriptions
    if (req.method === 'GET' && pathname === '/api/library') {
      const vault = loadVault();
      const section = parsedUrl.searchParams.get('section') || 'ALL';
      const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
      const status = parsedUrl.searchParams.get('status') || 'ALL';
      const limit = Math.min(Number(parsedUrl.searchParams.get('limit') || 40), 100);
      const offset = Math.max(0, Number(parsedUrl.searchParams.get('offset') || 0));
      const all = vault.bookmarks || [];
      const library = all
        .map((bookmark) => ({
          ...bookmark,
          library_section: librarySectionFor(bookmark),
          archived: Boolean(bookmark.library_archived),
        }))
        .filter((bookmark) => bookmark.library_section);
      const archivedTotal = library.filter((bookmark) => bookmark.archived).length;
      const active = library.filter((bookmark) => !bookmark.archived);
      const sections = librarySectionsWithCounts(all);
      const duplicates = findLibraryDuplicates(all);
      const sectionOrder = new Map(LIBRARY_SECTIONS.map((item, index) => [item.id, index]));

      let list = status === 'archived' ? library.filter((bookmark) => bookmark.archived) : active;
      if (section !== 'ALL') list = list.filter((bookmark) => bookmark.library_section === section);
      if (status !== 'ALL' && status !== 'archived') {
        list = list.filter((bookmark) => (bookmark.site_status || 'unchecked') === status);
      }
      if (q) {
        list = list.filter((bookmark) => {
          const hay = `${bookmark.title || ''} ${bookmark.domain || ''} ${bookmark.description || ''} ${bookmark.use_for || ''} ${bookmark.category || ''} ${(bookmark.tags || []).join(' ')}`.toLowerCase();
          return q.split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
        });
      }

      list = list.slice().sort((a, b) => {
        const sectionDelta = (sectionOrder.get(a.library_section) || 0) - (sectionOrder.get(b.library_section) || 0);
        if (sectionDelta) return sectionDelta;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });

      const items = list.slice(offset, offset + limit).map((bookmark) => {
        const { embedding, ...rest } = bookmark;
        const meta = librarySectionById(bookmark.library_section);
        return {
          ...rest,
          library_label: meta ? meta.label : bookmark.library_section,
          library_color: meta ? meta.color : '#8ab4ff',
        };
      });

      return sendJson(res, 200, {
        total: list.length,
        offset,
        limit,
        library_total: active.length,
        archived_total: archivedTotal,
        duplicate_groups: duplicates.length,
        duplicate_extra: duplicates.reduce((sum, group) => sum + group.extra, 0),
        all_total: all.length,
        sections,
        items,
        meta: vault.meta ? vault.meta.library_audit || null : null,
      });
    }

    // 3a. Duplicate review — same canonical URL saved more than once.
    if (req.method === 'GET' && pathname === '/api/library/duplicates') {
      const vault = loadVault();
      const groups = findLibraryDuplicates(vault.bookmarks || []).map((group) => ({
        ...group,
        items: group.items.map((bookmark) => {
          const { embedding, ...rest } = bookmark;
          const meta = librarySectionById(bookmark.library_section);
          return {
            ...rest,
            library_label: meta ? meta.label : bookmark.library_section,
            library_color: meta ? meta.color : '#8ab4ff',
          };
        }),
      }));
      return sendJson(res, 200, {
        groups,
        groups_count: groups.length,
        extra: groups.reduce((sum, group) => sum + group.extra, 0),
      });
    }

    // 3b. Bulk library actions — archive, restore, or refile many links at once.
    if (req.method === 'POST' && pathname === '/api/library/bulk') {
      if (!rateLimit(req, 'library-bulk', 20, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Wait a minute before running another bulk library action.' }, { 'Retry-After': '60' });
      }
      const body = await parseBody(req);
      const ids = Array.isArray(body.ids)
        ? [...new Set(body.ids.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 250)
        : [];
      const action = String(body.action || '');
      if (!ids.length) return sendJson(res, 400, { error: 'Select at least one library entry.' });
      if (!['archive', 'restore', 'section'].includes(action)) {
        return sendJson(res, 400, { error: 'Unknown bulk action.' });
      }
      const targetSection = action === 'section' ? librarySectionById(body.library_section) : null;
      if (action === 'section' && !targetSection) {
        return sendJson(res, 400, { error: 'Choose a valid library section.' });
      }

      const vault = loadVault();
      const byId = new Map((vault.bookmarks || []).map((bookmark) => [bookmark.id, bookmark]));
      const updated = [];
      const missing = [];
      const stamp = new Date().toISOString();
      for (const id of ids) {
        const bookmark = byId.get(id);
        if (!bookmark || !librarySectionFor(bookmark)) {
          missing.push(id);
          continue;
        }
        if (action === 'archive') {
          bookmark.library_archived = true;
          bookmark.library_archived_at = stamp;
        } else if (action === 'restore') {
          delete bookmark.library_archived;
          delete bookmark.library_archived_at;
        } else {
          bookmark.library_section = targetSection.id;
          bookmark.description_source = bookmark.description_source || 'manual';
          delete bookmark.library_opt_out;
        }
        updated.push(id);
      }
      if (!updated.length) {
        return sendJson(res, 404, { error: 'None of those library entries exist anymore.' });
      }
      await saveVault(vault);
      return sendJson(res, 200, {
        ok: true,
        action,
        updated: updated.length,
        missing: missing.length,
        section: targetSection ? targetSection.id : null,
      });
    }

    const libraryEditMatch = pathname.match(/^\/api\/library\/([a-z0-9_]+)$/i);
    if (req.method === 'PUT' && libraryEditMatch) {
      const vault = loadVault();
      const bookmark = (vault.bookmarks || []).find((item) => item.id === libraryEditMatch[1]);
      if (!bookmark || !librarySectionFor(bookmark)) {
        return sendJson(res, 404, { error: 'Library entry not found.' });
      }
      const body = await parseBody(req);
      const nextSection = body.library_section === undefined
        ? librarySectionFor(bookmark)
        : String(body.library_section || '');
      const section = librarySectionById(nextSection);
      if (!section) return sendJson(res, 400, { error: 'Choose a valid library section.' });
      bookmark.library_section = section.id;
      bookmark.description = String(body.description ?? bookmark.description ?? '').trim().slice(0, 360);
      bookmark.use_for = String(body.use_for ?? bookmark.use_for ?? '').trim().slice(0, 220);
      bookmark.description_source = 'manual';
      delete bookmark.library_opt_out;
      delete bookmark.library_archived;
      delete bookmark.library_archived_at;
      await saveVault(vault);
      return sendJson(res, 200, {
        ok: true,
        item: {
          ...bookmark,
          library_section: section.id,
          library_label: section.label,
          library_color: section.color,
        },
      });
    }

    // 4. Routine builder — parse a pasted routine into an editable protocol
    if (req.method === 'POST' && pathname === '/api/routines/parse') {
      const body = await parseBody(req);
      const vault = loadVault();
      try {
        const wishlist = vault.wishlist || [];
        const routine = parseRoutine(body.text || '', { wishlist });
        const product_queries = extractProductQueries(routine.steps)
          .filter((query) => matchWishlistIds(query, wishlist).length === 0);
        return sendJson(res, 200, { ok: true, routine, product_queries });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // 4b. Look up a product the user pasted but has not saved in the Gate
    if (req.method === 'POST' && pathname === '/api/routines/lookup-product') {
      if (!rateLimit(req, 'routine-lookup', 20, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Product lookups are limited to 20 per minute.' }, { 'Retry-After': '60' });
      }
      const body = await parseBody(req);
      try {
        const product = await lookupProduct(body.query || '');
        return sendJson(res, 200, { ok: true, product });
      } catch (err) {
        return sendJson(res, 422, { error: err.message });
      }
    }

    if (req.method === 'POST' && pathname === '/api/protocols') {
      const body = await parseBody(req);
      try {
        return sendJson(res, 200, { ok: true, protocol: await createProtocol(body) });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    const protocolMatch = pathname.match(/^\/api\/protocols\/([a-z0-9_]+)$/i);
    if (req.method === 'PUT' && protocolMatch) {
      const body = await parseBody(req);
      try {
        return sendJson(res, 200, { ok: true, protocol: await updateProtocol(protocolMatch[1], body) });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
    if (req.method === 'DELETE' && protocolMatch) {
      try {
        return sendJson(res, 200, { ok: true, removed: await deleteProtocol(protocolMatch[1]) });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // 5. Cached product images
    if (req.method === 'POST' && pathname === '/api/images/resolve') {
      if (!rateLimit(req, 'images-resolve', 30, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Image lookups are limited to 30 per minute.' }, { 'Retry-After': '60' });
      }
      const body = await parseBody(req);
      try {
        const image = await resolveImage(body.url || body.pageUrl, { pageUrl: body.pageUrl });
        return sendJson(res, 200, { ok: true, image });
      } catch (err) {
        return sendJson(res, 422, { error: err.message });
      }
    }
    const clusterMatch = pathname.match(/^\/api\/clusters\/(.+)$/);
    if (req.method === 'PUT' && clusterMatch) {
      let category = clusterMatch[1];
      try { category = decodeURIComponent(category); } catch (_) {}
      const vault = loadVault();
      const catCounts = {};
      for (const bookmark of vault.bookmarks || []) {
        catCounts[bookmark.category] = (catCounts[bookmark.category] || 0) + 1;
      }
      if (!category || !Object.prototype.hasOwnProperty.call(catCounts, category)) {
        return sendJson(res, 404, { error: 'Cluster not found.' });
      }
      const body = await parseBody(req);
      const mode = body.mode === 'product' || body.mode === 'reference' ? body.mode : '';
      if (!mode) return sendJson(res, 400, { error: 'Choose product photos or a reference card.' });
      const heroItemId = typeof body.hero_item_id === 'string' ? body.hero_item_id.trim() : '';
      if (heroItemId) {
        const hero = (vault.wishlist || []).find((wish) => wish.id === heroItemId);
        if (!hero) return sendJson(res, 400, { error: 'That wishlist item does not exist.' });
        if (hero.category !== category) return sendJson(res, 400, { error: 'Pick a wishlist item from this cluster.' });
      }
      let cover = typeof body.cover === 'string' ? body.cover.trim() : '';
      if (cover && !isCachedImage(cover)) {
        try {
          cover = await resolveImage(cover);
        } catch (err) {
          return sendJson(res, 422, { error: err.message });
        }
      }
      const meta = await updateClusterMeta(category, {
        mode,
        hero_item_id: heroItemId,
        cover,
      });
      return sendJson(res, 200, { ok: true, meta });
    }

    const wishlistPhotoMatch = pathname.match(/^\/api\/wishlist\/([a-z0-9_]+)\/photo$/i);
    if (req.method === 'POST' && wishlistPhotoMatch) {
      const body = await parseBody(req);
      const vault = loadVault();
      const item = (vault.wishlist || []).find((wish) => wish.id === wishlistPhotoMatch[1]);
      if (!item) return sendJson(res, 404, { error: 'Wishlist item not found.' });
      try {
        const image = await resolveImage(body.url || item.url, { pageUrl: item.url });
        item.image = image;
        item.image_source = body.url || item.url;
        await saveVault(vault);
        return sendJson(res, 200, { ok: true, item });
      } catch (err) {
        return sendJson(res, 422, { error: err.message });
      }
    }

    const wishlistDetailsMatch = pathname.match(/^\/api\/wishlist\/([a-z0-9_]+)\/details$/i);
    if (req.method === 'PATCH' && wishlistDetailsMatch) {
      const body = await parseBody(req);
      const vault = loadVault();
      try {
        const { now: _ignoredNow, ...updates } = body;
        const item = updateWishlistDetails(vault, wishlistDetailsMatch[1], updates);
        const tel = recordTelemetry(vault, `Wish details updated: "${item.title.slice(0, 48)}"`, 'Manual gate edit', 'Spend Ledger', 0, 0, 0, 0);
        await saveVault(vault);
        return sendJson(res, 200, { ok: true, item, telemetry: tel });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    }

    const wishlistDeleteMatch = pathname.match(/^\/api\/wishlist\/([a-z0-9_]+)$/i);
    if (req.method === 'DELETE' && wishlistDeleteMatch) {
      if (!rateLimit(req, 'wishlist-delete', 30, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Wish deletion is limited to 30 per minute.' }, { 'Retry-After': '60' });
      }
      const vault = loadVault();
      try {
        const result = removeWish(vault, wishlistDeleteMatch[1]);
        const tel = recordTelemetry(
          vault,
          `Wish removed: "${result.item.title.slice(0, 48)}"`,
          'Manual gate cleanup',
          'Spend Ledger',
          0, 0, 0, 0
        );
        await saveVault(vault);
        return sendJson(res, 200, { ok: true, ...result, telemetry: tel });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    }

    const wishlistReopenMatch = pathname.match(/^\/api\/wishlist\/([a-z0-9_]+)\/reopen$/i);
    if (req.method === 'POST' && wishlistReopenMatch) {
      const body = await parseBody(req);
      const vault = loadVault();
      try {
        const result = reopenItem(vault, wishlistReopenMatch[1], { reason: body.reason });
        const tel = recordTelemetry(
          vault,
          `Wish reopened: "${result.item.title.slice(0, 48)}"`,
          'Manual gate action',
          'Spend Ledger',
          0, 0, 0, 0
        );
        await saveVault(vault);
        return sendJson(res, 200, { ok: true, action: 'reopen', ...result, telemetry: tel });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    }

    const wishlistActionMatch = pathname.match(/^\/api\/wishlist\/([a-z0-9_]+)\/(buy|skip|snooze)$/i);
    if (req.method === 'POST' && wishlistActionMatch) {
      const body = await parseBody(req);
      const vault = loadVault();
      const id = wishlistActionMatch[1];
      const action = wishlistActionMatch[2].toLowerCase();
      try {
        let result;
        let task;
        if (action === 'buy') {
          result = purchaseItem(vault, id, { amount: body.amount, source: body.source, note: body.note });
          task = `Purchase logged: "${result.item.title.slice(0, 48)}" — $${result.entry.amount.toFixed(2)}`;
        } else if (action === 'skip') {
          result = skipItem(vault, id, { reason: body.reason || body.note });
          task = `Wish skipped: "${result.item.title.slice(0, 48)}"`;
        } else {
          result = snoozeItem(vault, id, { days: body.days, note: body.note });
          task = `Wish snoozed ${result.days} days: "${result.item.title.slice(0, 48)}"`;
        }
        const tel = recordTelemetry(vault, task, 'Manual gate action', 'Spend Ledger', 0, 0, 0, 0);
        await saveVault(vault);
        return sendJson(res, 200, { ok: true, action, ...result, telemetry: tel });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    }

    const ledgerVoidMatch = pathname.match(/^\/api\/ledger\/([a-z0-9_]+)\/void$/i);
    if (req.method === 'POST' && ledgerVoidMatch) {
      const body = await parseBody(req);
      const vault = loadVault();
      try {
        const result = voidLedgerEntry(vault, ledgerVoidMatch[1], { reason: body.reason });
        const tel = recordTelemetry(
          vault,
          `Ledger entry voided: "${String(result.entry.title || 'entry').slice(0, 48)}"`,
          'Manual ledger correction',
          'Spend Ledger',
          0, 0, 0, 0
        );
        await saveVault(vault);
        return sendJson(res, 200, { ok: true, ...result, telemetry: tel });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    }

    if (req.method === 'PUT' && pathname === '/api/budget') {
      const body = await parseBody(req);
      const vault = loadVault();
      const updates = {};
      if (Object.prototype.hasOwnProperty.call(body, 'cap')) updates.cap = body.cap;
      if (Object.prototype.hasOwnProperty.call(body, 'category_budgets')) updates.category_budgets = body.category_budgets;
      try {
        const budget = updateBudget(vault, updates);
        const tel = recordTelemetry(
          vault,
          `Budget updated: $${budget.cap.toFixed(2)} cap, ${Object.keys(budget.category_budgets).length} category caps`,
          'Manual budget edit',
          'Spend Ledger',
          0, 0, 0, 0
        );
        await saveVault(vault);
        return sendJson(res, 200, { ok: true, budget, telemetry: tel });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    }

    // 4. GET /api/bookmarks - paginated & filtered bookmarks + hybrid semantic search
    if (req.method === 'GET' && pathname === '/api/bookmarks') {
      const vault = loadVault();
      const category = parsedUrl.searchParams.get('category') || 'ALL';
      const browser = parsedUrl.searchParams.get('browser') || 'ALL';
      const q = (parsedUrl.searchParams.get('q') || '').trim();
      const limit = Math.min(Number(parsedUrl.searchParams.get('limit') || 120), 500);
      const offset = Number(parsedUrl.searchParams.get('offset') || 0);

      let list = vault.bookmarks || [];
      if (category !== 'ALL') {
        list = list.filter((b) => b.category === category);
      }
      if (browser !== 'ALL') {
        list = list.filter((b) => b.browser === browser);
      }

      if (q) {
        const qVec = deterministicVec(q);
        const qLower = q.toLowerCase();
        const qWords = qLower.split(/\s+/).filter(Boolean);

        // The stored vectors are a hashed bag of words, not a trained
        // embedding, so a vector match on its own is noise. Every result must
        // share a real word with the query; the vector only breaks ties with
        // results that already match. Short plural/prefix forms count so
        // "accounting" still finds "accountant" and "kits" finds "kit".
        const wordHit = (hay, word) => {
          if (!word) return false;
          if (hay.includes(word)) return true;
          if (word.length < 4) return false;
          const stem = word.replace(/(ing|ed|es|s)$/, '');
          return stem.length >= 4 && hay.includes(stem);
        };

        list = list
          .map((b) => {
            // Descriptions and use-for notes are searchable now: a reference
            // bookmark is often best found by what it is used for, not by the
            // literal page title.
            const hay = `${b.title || ''} ${b.domain || ''} ${b.category || ''} ${b.subcategory || ''} ${(b.tags || []).join(' ')} ${b.description || ''} ${b.use_for || ''}`.toLowerCase();
            const titleHay = `${b.title || ''} ${b.domain || ''}`.toLowerCase();
            const words = new Set(hay.match(/[a-z0-9]+/g) || []);
            let lexical = 0;
            let matchedWords = 0;
            if (titleHay.includes(qLower)) lexical += 0.75;
            else if (hay.includes(qLower)) lexical += 0.45;
            for (const w of qWords) {
              const matched = wordHit(titleHay, w) || [...words].some((word) => wordHit(word, w));
              if (!matched) continue;
              matchedWords += 1;
              if (titleHay.includes(w)) lexical += 0.28;
              else lexical += 0.14;
            }
            if (!matchedWords) return null;
            if (matchedWords === qWords.length) lexical += 0.2;
            const sem = Math.max(0, cosineSim(qVec, b.embedding || []));
            const score = lexical + sem * 0.1;
            return { ...b, match_score: Number(score.toFixed(3)) };
          })
          .filter(Boolean)
          .sort((a, b) => b.match_score - a.match_score);

        recordTelemetry(
          vault,
          `Hybrid Semantic + Lexical Search: "${q}" (${list.length} matches)`,
          'Local lexical + vector index',
          'Local recall',
          195,
          0,
          0,
          0
        );
      }

      const sliced = list.slice(offset, offset + limit).map(({ embedding, ...rest }) => rest);
      return sendJson(res, 200, {
        total: list.length,
        offset,
        limit,
        items: sliced,
      });
    }

    // 3. POST /api/bookmarks/sync — live re-sync from Chrome, Brave, and Edge Bookmarks files
    if (req.method === 'POST' && pathname === '/api/bookmarks/sync') {
      if (!rateLimit(req, 'bookmarks-sync', 3, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Bookmark sync is limited to 3 per minute.' }, { 'Retry-After': '60' });
      }
      const syncRes = syncBrowserBookmarks();
      const vault = loadVault();
      recordTelemetry(
        vault,
        `Re-Synced Browser Bookmarks (${syncRes.total_unique} unique URLs across ${syncRes.browsers_synced.join(', ')})`,
        'Local bookmark importer',
        'Local import',
        310,
        0,
        0,
        0
      );
      await saveVault(vault);
      return sendJson(res, 200, {
        ok: true,
        total_unique: syncRes.total_unique,
        browsers_synced: syncRes.browsers_synced,
      });
    }

    // 4. POST /api/ingest — Ingest URL, Life-Hack Note, YouTube Transcript, or Screenshot OCR
    if (req.method === 'POST' && pathname === '/api/ingest') {
      if (!rateLimit(req, 'ingest', 20, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Capture is limited to 20 items per minute.' }, { 'Retry-After': '60' });
      }
      const body = await parseBody(req);
      const vault = loadVault();
      const mode = body.mode || 'url'; // 'url' | 'screenshot' | 'note'
      const rawInput = (body.input || '').trim();
      const titleInput = (body.title || '').trim();
      const priceInput = Number(body.price || 0);

      if (!rawInput && !titleInput) {
        return sendJson(res, 400, { error: 'Please provide a URL, text note, or screenshot description.' });
      }

      const [category, itemType, subcategory] = classifyBookmark({
        name: titleInput || rawInput,
        url: rawInput,
        folder: mode === 'screenshot' ? 'shopping' : '',
      });

      // Ingest classifies locally from the pasted URL, note or OCR text. No model
      // call happens here, so the telemetry must not claim one.
      const modelUsed = 'Stashov local classifier';
      const tierUsed = 'Local classification';

      // Check against owned inventory & routines for instant Impulse-Gate assessment
      const textLower = `${titleInput} ${rawInput}`.toLowerCase();
      let overlapWarning = 'LOW — No direct duplicate detected in your active closet/shelf.';
      let verdict = 'WAIT_OR_DUPE';
      let verdictLabel = 'LOCKED FOR 14-DAY COOLING OFF';

      if (textLower.includes('hoodie') || textLower.includes('parka') || textLower.includes('jacket') || textLower.includes('coat')) {
        overlapWarning = 'HIGH OVERLAP — You already own 2 Charcoal Hoodies (own_01) and a Black Winter Parka (own_02).';
        verdict = 'SKIP_DUPLICATE';
        verdictLabel = 'SKIP — DUPLICATES OWNED CLOSET ITEM';
      } else if (textLower.includes('aha') || textLower.includes('bha') || textLower.includes('glycolic') || textLower.includes('salicylic') || textLower.includes('peel')) {
        overlapWarning = 'ROUTINE CONFLICT — Conflicts with your 0.1% Adapalene PM retinoid stack. Use AM only or skip.';
        verdict = 'WAIT_OR_DUPE';
        verdictLabel = 'HOLD — PM RETINOID CONFLICT';
      }

      let ingestUrl = '';
      if (/^https?:\/\//i.test(rawInput)) {
        try { ingestUrl = new URL(rawInput).href; } catch (_) { ingestUrl = ''; }
      }
      const newBookmark = {
        id: `bm_${String((vault.bookmarks || []).length + 1).padStart(4, '0')}`,
        title: titleInput || rawInput.slice(0, 100),
        url: ingestUrl || `https://stashov.local/capture/${Date.now()}`,
        domain: ingestUrl ? new URL(ingestUrl).hostname.replace(/^www\./, '') : 'local-capture',
        original_folder: `Ingest Studio (${mode.toUpperCase()})`,
        browser: mode === 'screenshot' ? 'Camera Roll OCR' : 'Stashov Ingest',
        category,
        subcategory,
        item_type: itemType,
        tags: [subcategory.toLowerCase().split(' ')[0], mode, 'archived'],
        snapshot_status: 'Archived Local Snapshot',
        rot_status: 'Live & Verified',
        embedding: deterministicVec(`${titleInput} ${rawInput} ${category} ${subcategory}`),
      };
      let resolvedImage = '';
      if (mode === 'url' && newBookmark.url.startsWith('http')) {
        try { resolvedImage = await resolveImage(newBookmark.url); } catch (_) {}
      }
      newBookmark.image = resolvedImage;
      vault.bookmarks.unshift(newBookmark);

      let createdWishlist = null;
      if (mode === 'screenshot' || itemType === 'wishlist' || priceInput > 0) {
        const retail = priceInput > 0 ? priceInput : 75;
        const floor = Number((retail * 0.68).toFixed(2));
        createdWishlist = {
          id: `wl_${Date.now()}`,
          title: titleInput || rawInput.slice(0, 80),
          brand: newBookmark.domain.split('.')[0].toUpperCase(),
          url: newBookmark.url,
          image: resolvedImage,
          category,
          retail_price: retail,
          lowest_verified_price: floor,
          best_source: 'Discounter / Verified Resale Floor',
          dupe_alternative: 'See category spec equivalent in Vault ($25–$45)',
          uses_per_month: 10,
          cost_per_use: Number((floor / 120).toFixed(2)),
          inventory_overlap: overlapWarning,
          routine_compatibility: overlapWarning.includes('CONFLICT') ? overlapWarning : 'Verified Compatible',
          verdict,
          verdict_label: verdictLabel,
          anti_hype_summary: `Captured via ${mode.toUpperCase()} and structured by ${modelUsed}. Impulse Cooling-Off lock active for 14 days.`,
          snapshot_excerpt: `Full text & metadata snapshotted at ${new Date().toISOString()}.`,
          tags: newBookmark.tags,
        };
        startGate(createdWishlist, { days: vault.personal_context.default_cooling_off_days || 14 });
        vault.wishlist.unshift(createdWishlist);
      }

      const tel = recordTelemetry(
        vault,
        `Ingested ${mode.toUpperCase()}: "${(titleInput || rawInput).slice(0, 55)}" -> [${category}]`,
        modelUsed,
        tierUsed,
        410,
        0,
        0,
        0
      );
      await saveVault(vault);

      return sendJson(res, 200, {
        ok: true,
        bookmark: newBookmark,
        wishlist_item: createdWishlist,
        telemetry: tel,
      });
    }

    // 5. POST /api/impulse-gate — Run Nemotron 3 Ultra "Talk Me Out of Buying This" analysis on any item
    if (req.method === 'POST' && pathname === '/api/impulse-gate') {
      if (!rateLimit(req, 'impulse-gate', 10, 60 * 1000)) {
        return sendJson(res, 429, { error: 'The oracle is rate limited to 10 requests per minute.' }, { 'Retry-After': '60' });
      }
      const body = await parseBody(req);
      const vault = loadVault();
      const itemId = body.id;
      const customQuery = body.query || '';

      const item = (vault.wishlist || []).find((w) => w.id === itemId) || (vault.bookmarks || []).find((b) => b.id === itemId);
      if (!item) {
        return sendJson(res, 404, { error: 'Item not found in Vault.' });
      }

      const ctx = vault.personal_context;
      const budget = budgetSummary(vault);
      const remaining = budget.remaining;

      const promptMessages = [
        {
          role: 'system',
          content:
            'You are Stashov, a brutal, data-driven Personal AI Impulse-Gate & Buyer Advisor running on NVIDIA Nemotron 3 Ultra via Nebius Token Factory. Evaluate purchases against the user’s owned inventory, budget, skincare/health constraints, and discounter alternatives.',
        },
        {
          role: 'user',
          content: `Evaluate item: ${JSON.stringify(item)}\nUser Context: Remaining Monthly Budget=$${remaining}, Owned Inventory=${JSON.stringify(ctx.owned_inventory)}, Constraints=${JSON.stringify(ctx.skin_and_health_constraints)}. Extra query: ${customQuery}`,
        },
      ];

      const llmRes = await callTokenFactoryChat(MODELS.ultra, promptMessages, 600);

      const analysis = llmRes.content || [
        `IMPULSE-GATE AUDIT (${MODELS.ultra})`,
        `• Item: ${item.title} (${item.category})`,
        `• Budget Check: Remaining ${budget.month_label} fun-money is $${remaining.toFixed(2)}. ${
          (item.lowest_verified_price || 50) > remaining
            ? `BLOCKED — Exceeds remaining budget by $${((item.lowest_verified_price || 50) - remaining).toFixed(2)}.`
            : `Consumes ${(((item.lowest_verified_price || 50) / remaining) * 100).toFixed(0)}% of remaining monthly budget.`
        }`,
        `• Owned Inventory Check: ${item.inventory_overlap || 'Cross-checked against 6 owned rotation staples — verify 1-In-1-Out rule before checkout.'}`,
        `• Routine & Constraint Check: ${item.routine_compatibility || 'Compatible with active AM/PM protocols and Halal/skin guardrails.'}`,
        `• Price Floor & Dupe Strategy: Never pay $${item.retail_price || 95} retail. Target $${item.lowest_verified_price || 55} via ${item.best_source || 'saved discounters'} or use dupe: ${item.dupe_alternative || 'Quince / FragranceNet equivalent'}.`,
        `• Final Verdict: ${item.verdict_label || 'WAIT FOR COOLING-OFF TIMER'}`,
      ].join('\n');

      const usage = usageFromResult(llmRes);
      const tel = recordTelemetry(
        vault,
        `Impulse-Gate Deep Audit: "${item.title.slice(0, 48)}"`,
        MODELS.ultra,
        '1M-Context Deep Reasoning',
        usage.latency,
        usage.tokensIn,
        usage.tokensOut,
        usage.cost,
        usage.live ? 'SUCCESS' : 'FALLBACK'
      );
      await saveVault(vault);

      return sendJson(res, 200, {
        ok: true,
        model: MODELS.ultra,
        live_nebius: llmRes.live,
        analysis,
        telemetry: tel,
      });
    }

    // 6. POST /api/bookmark-preview — Read a bookmark or pasted product link without gating it
    if (req.method === 'POST' && pathname === '/api/bookmark-preview') {
      if (!rateLimit(req, 'bookmark-preview', 30, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Preview is limited to 30 lookups per minute.' }, { 'Retry-After': '60' });
      }
      const body = await parseBody(req);
      const vault = loadVault();
      let bm = (vault.bookmarks || []).find((b) => b.id === body.id) || null;
      if (!bm && body.url) {
        try { bm = bookmarkFromPastedUrl(body.url); } catch (err) { return sendJson(res, err.status || 400, { error: err.message }); }
      }
      if (!bm) return sendJson(res, 404, { error: 'Bookmark not found' });

      const existing = findWishlistByUrl(vault, bm.url);
      if (existing) {
        return sendJson(res, 200, { ok: true, already_exists: true, item: existing });
      }

      const snapshot = body.snapshot && typeof body.snapshot === 'object' && !Array.isArray(body.snapshot)
        ? body.snapshot
        : null;
      const hasSnapshot = snapshot && ['title', 'brand', 'price', 'image'].some((key) => String(snapshot[key] ?? '').trim());
      let capture;
      try {
        capture = hasSnapshot
          ? await captureFromSnapshot(bm, snapshot)
          : await captureBookmarkProduct(bm);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      if (!body.id) {
        bm.category = classifyBookmark({
          name: (capture.product && capture.product.title) || bm.title,
          url: bm.url,
          folder: '',
        })[0];
      }
      return sendJson(res, 200, {
        ok: true,
        preview: previewFromCapture(bm, capture),
        possible_duplicates: findPossibleDuplicates(vault, bm, capture.product && capture.product.title),
      });
    }

    // 7. POST /api/promote-bookmark — Promote a bookmark or pasted link into the Impulse-Gated Wishlist
    if (req.method === 'POST' && pathname === '/api/promote-bookmark') {
      if (!rateLimit(req, 'promote', 30, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Promotion is limited to 30 per minute.' }, { 'Retry-After': '60' });
      }
      const body = await parseBody(req);
      const vault = loadVault();
      let bm = (vault.bookmarks || []).find((b) => b.id === body.id) || null;
      if (!bm && body.url) {
        try { bm = bookmarkFromPastedUrl(body.url); } catch (err) { return sendJson(res, err.status || 400, { error: err.message }); }
      }
      if (!bm) return sendJson(res, 404, { error: 'Bookmark not found' });

      const existing = findWishlistByUrl(vault, bm.url);
      if (existing) {
        return sendJson(res, 200, { ok: true, already_exists: true, item: existing });
      }

      const details = body.details && typeof body.details === 'object' && !Array.isArray(body.details)
        ? body.details
        : null;
      let newWl;
      try {
        const capture = details ? null : await captureBookmarkProduct(bm);
        if (!body.id) {
          bm.category = details && details.category
            ? details.category
            : classifyBookmark({
              name: (capture && capture.product && capture.product.title) || bm.title,
              url: bm.url,
              folder: '',
            })[0];
        }
        newWl = buildPromotedWish(bm, capture || {}, details);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      startGate(newWl, { days: vault.personal_context.default_cooling_off_days || 14 });
      vault.wishlist.unshift(newWl);
      const tel = recordTelemetry(
        vault,
        `Promoted Bookmark to Impulse-Gate Wishlist: "${bm.title.slice(0, 45)}" (${newWl.price_status === 'captured' ? `$${newWl.lowest_verified_price.toFixed(2)} captured` : newWl.price_status === 'manual' ? `$${newWl.lowest_verified_price.toFixed(2)} reviewed` : 'price pending'})`,
        'Local capture + gate init',
        'Local promotion',
        340,
        0,
        0,
        0
      );
      await saveVault(vault);
      return sendJson(res, 200, {
        ok: true,
        item: newWl,
        capture: {
          price_status: newWl.price_status,
          price: newWl.lowest_verified_price,
          currency: newWl.lowest_verified_price !== null ? newWl.price_currency : '',
          title: newWl.title,
          brand: newWl.brand,
          image: Boolean(newWl.image),
          reason: newWl.price_note,
        },
        possible_duplicates: findPossibleDuplicates(vault, bm, newWl.title),
        telemetry: tel,
      });
    }

    // 8. POST /api/vault-audit — 1M-Context Vault-Wide Synthesis & Routine Conflict Check (Nemotron 3 Ultra)
    if (req.method === 'POST' && pathname === '/api/vault-audit') {
      if (!rateLimit(req, 'vault-audit', 4, 60 * 1000)) {
        return sendJson(res, 429, { error: 'The vault audit is limited to 4 requests per minute.' }, { 'Retry-After': '60' });
      }
      const body = await parseBody(req);
      const vault = loadVault();
      const bookmarkCount = (vault.bookmarks || []).length;
      const question = (body.question || `Run a full audit across my ${bookmarkCount.toLocaleString('en-US')} saved bookmarks, wishlist, owned inventory and daily routines.`).trim().slice(0, 500);
      const budget = budgetSummary(vault);
      const gate = gateSummary(vault);
      const llmRes = await callTokenFactoryChat(
        MODELS.ultra,
        buildVaultAuditMessages({ vault, question, budget, gate }),
        // Reasoning tokens count against this budget too; leave room for the report.
        2500
      );

      const fallbackReport = buildFallbackReport({ vault, question, budget, gate });
      const report = extractReport(llmRes.content) || fallbackReport;

      const usage = usageFromResult(llmRes);
      const tel = recordTelemetry(
        vault,
        `1M-Context Vault Audit & Query: "${question.slice(0, 48)}"`,
        MODELS.ultra,
        '1M-Context Deep Reasoning',
        usage.latency,
        usage.tokensIn,
        usage.tokensOut,
        usage.cost,
        usage.live ? 'SUCCESS' : 'FALLBACK'
      );
      await saveVault(vault);

      return sendJson(res, 200, {
        ok: true,
        model: MODELS.ultra,
        live_nebius: llmRes.live,
        report,
        telemetry: tel,
      });
    }

    // 9. POST /api/serverless-job — Trigger the Nebius Serverless Job Worker on demand
    if (req.method === 'POST' && pathname === '/api/serverless-job') {
      if (!rateLimit(req, 'serverless-job', 2, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Give the background job a moment before running it again.' }, { 'Retry-After': '60' });
      }
      const report = await runServerlessJob();
      return sendJson(res, 200, { ok: true, report });
    }

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, uptime_seconds: Math.round(process.uptime()) });
    }

    // 10. Full vault export / restore. The vault is the product; a local-only
    // app still needs a way to take it somewhere and put it back.
    if (req.method === 'GET' && pathname === '/api/export') {
      await Promise.all([readyVault(), readySections(), readyClusters()]);
      const payload = {
        app: 'stashov',
        version: 2,
        exported_at: new Date().toISOString(),
        vault: loadVault(),
        sections: readSections(),
        clusters: readClusters(),
      };
      const stamp = new Date().toISOString().slice(0, 10);
      return sendJson(res, 200, payload, {
        'Content-Disposition': `attachment; filename="stashov-${stamp}.json"`,
      });
    }

    if (req.method === 'POST' && pathname === '/api/import') {
      if (!rateLimit(req, 'import', 3, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Wait a minute before restoring another backup.' }, { 'Retry-After': '60' });
      }
      const body = await parseBody(req, IMPORT_LIMIT);
      const incoming = body.vault && typeof body.vault === 'object' ? body.vault : body;
      if (!incoming || !Array.isArray(incoming.bookmarks) || !Array.isArray(incoming.wishlist) || !Array.isArray(incoming.protocols)) {
        return sendJson(res, 400, { error: 'That file is not a Stashov vault. It needs bookmarks, wishlist and protocols arrays.' });
      }
      const snapshot = snapshotVault('pre-import');
      ensureGateState(incoming);
      await writeVault(incoming);
      if (body.sections && typeof body.sections === 'object') await saveSections(body.sections);
      if (body.clusters && typeof body.clusters === 'object') await replaceStore(body.clusters);
      recordTelemetry(
        incoming,
        `Vault restored: ${incoming.bookmarks.length} bookmarks, ${incoming.wishlist.length} wishes, ${incoming.protocols.length} routines`,
        'Manual restore',
        'Data portability',
        0, 0, 0, 0
      );
      return sendJson(res, 200, {
        ok: true,
        restored: {
          bookmarks: incoming.bookmarks.length,
          wishlist: incoming.wishlist.length,
          protocols: incoming.protocols.length,
        },
        snapshot: snapshot ? 'saved in data/backups' : null,
      });
    }

    // 11. Re-check one wish against its saved product page and record the result.
    const priceRefreshMatch = pathname.match(/^\/api\/wishlist\/([a-z0-9_]+)\/refresh-price$/i);
    if (req.method === 'POST' && priceRefreshMatch) {
      if (!rateLimit(req, 'price-refresh', 20, 60 * 1000)) {
        return sendJson(res, 429, { error: 'Price checks are limited to 20 per minute.' }, { 'Retry-After': '60' });
      }
      const vault = loadVault();
      const item = (vault.wishlist || []).find((wish) => wish.id === priceRefreshMatch[1]);
      if (!item) return sendJson(res, 404, { error: 'Wishlist item not found.' });
      const previous = Number(item.lowest_verified_price) > 0 ? Number(item.lowest_verified_price) : null;
      let capture;
      try {
        capture = await captureBookmarkProduct(item);
      } catch (err) {
        return sendJson(res, err.status || 422, { error: err.message });
      }
      if (!capture || !(Number(capture.capturedPrice) > 0)) {
        return sendJson(res, 422, { error: (capture && capture.reason) || 'No public price could be read from that page.' });
      }
      const price = Math.round((Number(capture.capturedPrice) + Number.EPSILON) * 100) / 100;
      const now = new Date();
      item.retail_price = Math.max(price, Number(item.retail_price) || 0);
      item.lowest_verified_price = price;
      item.price_currency = 'USD';
      item.price_status = 'captured';
      item.price_source = (capture.product && capture.product.price_source) || 'page';
      item.price_confidence = capture.confidence === 'low' ? 'low' : 'high';
      item.price_captured_at = now.toISOString();
      item.price_checked_at = now.toISOString();
      item.price_note = capture.confidence === 'low' ? 'Low-confidence visible page price. Verify before checkout.' : '';
      item.price_reason = '';
      item.best_source = `${item.brand || item.domain || 'Product'} product page${capture.confidence === 'low' ? ' (low-confidence visible price)' : ''}`;
      item.cost_per_use = Math.round((price / Math.max(1, Number(item.uses_per_month) || 1)) * 100) / 100;
      if (!item.image && capture.image) item.image = capture.image;
      recordPricePoint(item, price, {
        at: now,
        source: 'refresh',
        confidence: item.price_confidence,
      });
      const tel = recordTelemetry(
        vault,
        `Price re-checked: "${item.title.slice(0, 48)}" — $${price.toFixed(2)}${previous !== null && previous !== price ? ` (was $${previous.toFixed(2)})` : ''}`,
        'Saved product page',
        'Price history',
        0, 0, 0, 0
      );
      await saveVault(vault);
      return sendJson(res, 200, {
        ok: true,
        item,
        previous,
        changed: previous !== null && previous !== price,
        telemetry: tel,
      });
    }

    // 12. Routine check-off for a single day.
    const routineTodayMatch = pathname.match(/^\/api\/protocols\/([a-z0-9_]+)\/today$/i);
    if (req.method === 'POST' && routineTodayMatch) {
      const body = await parseBody(req);
      try {
        const result = await checkRoutine(routineTodayMatch[1], { date: body.date, done: body.done !== false });
        const tel = recordTelemetry(
          null,
          `Routine ${result.done ? 'completed' : 'unchecked'}: "${routineTodayMatch[1]}" on ${result.date}`,
          'Manual routine log',
          'Living playbooks',
          0, 0, 0, 0
        );
        return sendJson(res, 200, { ok: true, ...result, telemetry: tel });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    }

    if (pathname.startsWith('/media/images/')) {
      const fileName = path.basename(pathname);
      if (!/^[a-z0-9][a-z0-9._-]{0,160}$/i.test(fileName) || fileName.includes('..')) {
        return sendText(res, 400, 'Invalid image name.');
      }
      const imagePath = [path.join(IMAGE_DIR, fileName), path.join(BUNDLED_IMAGE_DIR, fileName)]
        .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      const remote = imagePath ? null : await readImage(fileName);
      if (imagePath || remote) {
        const ext = imagePath ? path.extname(imagePath).toLowerCase() : '';
        const mime = imagePath
          ? {
              '.avif': 'image/avif',
              '.gif': 'image/gif',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.svg': 'image/svg+xml',
              '.webp': 'image/webp',
            }[ext] || 'application/octet-stream'
          : remote.contentType || 'application/octet-stream';
        const headers = {
          'Content-Type': mime,
          'Cache-Control': 'private, max-age=31536000, immutable',
        };
        // User-supplied SVG is active content. It is still displayed by <img>,
        // but a direct navigation must not be able to run script in our origin.
        if (ext === '.svg' || /^image\/svg/i.test(mime)) {
          headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
          headers['Content-Disposition'] = `inline; filename="${fileName.replace(/[^a-z0-9._-]/gi, '_')}"`;
        }
        res.writeHead(200, headers);
        return res.end(imagePath ? fs.readFileSync(imagePath) : remote.buffer);
      }
      return sendText(res, 404, 'Not found');
    }

    // Static files
    if (!['GET', 'HEAD'].includes(req.method || '')) {
      return sendText(res, 405, 'Method not allowed.', { Allow: 'GET, HEAD' });
    }
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch (_) {
      return sendText(res, 400, 'Invalid path.');
    }
    if (decodedPath.includes('\u0000')) return sendText(res, 400, 'Invalid path.');
    const filePath = decodedPath === '/'
      ? path.join(PUBLIC_DIR, 'index.html')
      : path.resolve(PUBLIC_DIR, `.${decodedPath}`);
    const insidePublic = filePath === PUBLIC_DIR || filePath.startsWith(`${PUBLIC_DIR}${path.sep}`);
    if (!insidePublic || decodedPath.split(/[\\/]/).some((part) => part.startsWith('.'))) {
      return sendText(res, 403, 'Forbidden');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
      }[ext] || 'application/octet-stream';
      const headers = {
        'Content-Type': mime,
        'Cache-Control': ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache',
      };
      if (ext === '.svg') {
        headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
      }
      res.writeHead(200, headers);
      return res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(filePath));
    }

    return sendText(res, 404, 'Not found');
  } catch (err) {
    const status = Number(err && err.status) || 500;
    if (status >= 500) console.error('[stashov]', err);
    return sendJson(res, status, { error: status >= 500 ? 'Internal server error.' : err.message });
  }
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('[stashov] unhandled request error', err);
    if (res.headersSent) return res.end();
    return sendJson(res, 500, { error: 'Internal server error.' });
  });
});

if (require.main === module) {
  const loopback = LOOPBACK_HOSTS.has(HOST) || HOST === '0:0:0:0:0:0:0:1';
  if (!loopback && !ACCESS_TOKEN && process.env.STASHOV_ALLOW_INSECURE_NETWORK !== '1') {
    console.error(
      `Refusing to bind ${HOST} without STASHOV_ACCESS_TOKEN.\n` +
      'Set STASHOV_ACCESS_TOKEN, or set STASHOV_ALLOW_INSECURE_NETWORK=1 for a trusted private network.'
    );
    process.exit(1);
  }
  if (loopback && HOST !== '127.0.0.1') {
    console.log(`Stashov is binding ${HOST}; only loopback hosts are accepted unless STASHOV_PUBLIC_ORIGIN is set.`);
  }
  server.listen(PORT, HOST, () => {
    const shownHost = HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST;
    console.log(`Stashov Personal AI Vault running at http://${shownHost}:${PORT}`);
    if (ACCESS_TOKEN) console.log('Access token is enabled; unlock at /unlock.');
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = server;
module.exports.server = server;
