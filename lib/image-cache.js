const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { IMAGE_DIR, BUNDLED_IMAGE_DIR } = require('./data-paths');
const { saveImage } = require('./state');
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Stashov/2.0';

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

function ensureImageDir() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

function publicImagePath(fileName) {
  return `/media/images/${fileName}`;
}

function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '0.0.0.0' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

function safeRemoteUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    if (!/^https?:$/.test(url.protocol)) return null;
    if (isPrivateHost(url.hostname)) return null;
    return url;
  } catch (_) {
    return null;
  }
}

function isCachedImage(value) {
  return /^\/media\/images\/[a-z0-9._-]+$/i.test(String(value || ''));
}

function isDirectImageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return /\.(avif|gif|jpe?g|png|webp|svg)$/i.test(url.pathname);
  } catch (_) {
    return false;
  }
}

function extensionFor(contentType, sourceUrl) {
  const cleanType = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (MIME_EXT[cleanType]) return MIME_EXT[cleanType];
  try {
    const ext = path.extname(new URL(sourceUrl).pathname).toLowerCase();
    if (/^\.(avif|gif|jpe?g|png|webp|svg)$/.test(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  } catch (_) {}
  return '.jpg';
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function imageCandidates(html, baseUrl) {
  const candidates = [];
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["']/gi,
    /<link[^>]+rel=["'](?:image_src|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/gi,
    /"image"\s*:\s*"([^"]+)"/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html))) {
      try {
        candidates.push(new URL(decodeEntities(match[1]), baseUrl).href);
      } catch (_) {}
    }
  }
  const unique = Array.from(new Set(candidates)).filter((url) => /^https?:\/\//i.test(url));
  unique.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  return unique;
}

function scoreCandidate(url) {
  const lower = url.toLowerCase();
  let score = 0;
  if (!/logo|icon|sprite|favicon|placeholder|default/i.test(lower)) score += 5;
  if (/\.(jpe?g|webp|avif)(\?|$)/i.test(lower)) score += 3;
  if (/\.png(\?|$)/i.test(lower)) score += 1;
  if (/\.svg(\?|$)/i.test(lower)) score -= 2;
  if (/product|cdn|media|image|upload/i.test(lower)) score += 2;
  return score;
}

async function cacheRemoteImage(rawUrl) {
  const url = safeRemoteUrl(rawUrl);
  if (!url) throw new Error('Image URL must be public HTTP or HTTPS.');
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Image request failed (${res.status}).`);
  const contentType = res.headers.get('content-type') || '';
  if (!/^image\//i.test(contentType)) throw new Error('The URL did not return an image.');
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_IMAGE_BYTES) throw new Error('Image is too large.');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Image is too large.');
  ensureImageDir();
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 18);
  const fileName = `${hash}${extensionFor(contentType, url.href)}`;
  const filePath = path.join(IMAGE_DIR, fileName);
  if (!fs.existsSync(filePath)) await saveImage(fileName, buffer, contentType);
  return publicImagePath(fileName);
}

async function resolvePageImage(rawPageUrl) {
  const pageUrl = safeRemoteUrl(rawPageUrl);
  if (!pageUrl) throw new Error('Page URL must be public HTTP or HTTPS.');
  const res = await fetch(pageUrl, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Page request failed (${res.status}).`);
  const contentType = res.headers.get('content-type') || '';
  if (/^image\//i.test(contentType) && isDirectImageUrl(pageUrl.href)) {
    return cacheRemoteImage(pageUrl.href);
  }
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_PAGE_BYTES) throw new Error('Page is too large to inspect.');
  const html = (await res.text()).slice(0, MAX_PAGE_BYTES);
  const candidates = imageCandidates(html, res.url || pageUrl.href);
  if (!candidates.length) throw new Error('No usable image metadata found.');
  let lastError = null;
  for (const candidate of candidates.slice(0, 4)) {
    try {
      return await cacheRemoteImage(candidate);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('No usable image could be downloaded.');
}

async function resolveImage(rawUrl, options = {}) {
  const value = String(rawUrl || '').trim();
  if (!value) {
    if (options.pageUrl) return resolvePageImage(options.pageUrl);
    throw new Error('Provide an image or page URL.');
  }
  if (isCachedImage(value)) return value;
  if (isDirectImageUrl(value)) {
    try {
      return await cacheRemoteImage(value);
    } catch (err) {
      if (options.pageUrl && options.pageUrl !== value) return resolvePageImage(options.pageUrl);
      throw err;
    }
  }
  return resolvePageImage(value);
}

module.exports = {
  IMAGE_DIR,
  BUNDLED_IMAGE_DIR,
  ensureImageDir,
  isCachedImage,
  isDirectImageUrl,
  resolveImage,
  resolvePageImage,
  cacheRemoteImage,
};
