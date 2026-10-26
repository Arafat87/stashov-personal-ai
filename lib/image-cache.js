const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { IMAGE_DIR, BUNDLED_IMAGE_DIR } = require('./data-paths');
const { saveImage } = require('./state');
const { safeGet, isPrivateAddress, isBlockedHostname } = require('./safe-fetch');

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
};

function ensureImageDir() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

function publicImagePath(fileName) {
  return `/media/images/${fileName}`;
}

function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (isBlockedHostname(host)) return true;
  return isPrivateAddress(host);
}

/**
 * A synchronous syntactic check for use at API boundaries. Any fetch built on
 * this value must still go through `safeGet`, which validates every redirect
 * and pins DNS.
 */
function safeRemoteUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.username || url.password) return null;
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
    return /\.(avif|gif|jpe?g|png|webp)$/i.test(url.pathname);
  } catch (_) {
    return false;
  }
}

function extensionFor(contentType, sourceUrl) {
  const cleanType = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (MIME_EXT[cleanType]) return MIME_EXT[cleanType];
  try {
    const ext = path.extname(new URL(sourceUrl).pathname).toLowerCase();
    if (/^\.(avif|gif|jpe?g|png|webp)$/.test(ext)) return ext === '.jpeg' ? '.jpg' : ext;
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
  if (/\.svg(\?|$)/i.test(lower)) score -= 8;
  if (/product|cdn|media|image|upload/i.test(lower)) score += 2;
  return score;
}

/**
 * Verify the bytes are actually a supported raster image, not an HTML error
 * page or an SVG carrying script.
 */
function sniffImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp' && /^avi[fs]$/.test(buffer.subarray(8, 12).toString('ascii'))) return 'image/avif';
  return '';
}

async function cacheRemoteImage(rawUrl) {
  const result = await safeGet(rawUrl, {
    headers: { 'user-agent': USER_AGENT, accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
    timeoutMs: 12000,
    maxBytes: MAX_IMAGE_BYTES,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Image request failed (${result.status}).`);
  }
  const declaredType = String(result.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (/^image\/svg/i.test(declaredType)) throw new Error('SVG images are not accepted.');
  if (!/^image\//i.test(declaredType)) throw new Error('The URL did not return an image.');
  const sniffed = sniffImageType(result.body);
  if (!sniffed) throw new Error('The URL did not return a supported raster image.');
  const contentType = MIME_EXT[declaredType] ? declaredType : sniffed;
  if (!MIME_EXT[contentType]) throw new Error('The URL did not return a supported image type.');
  if (result.body.length > MAX_IMAGE_BYTES) throw new Error('Image is too large.');

  ensureImageDir();
  const hash = crypto.createHash('sha1').update(result.body).digest('hex').slice(0, 18);
  const fileName = `${hash}${extensionFor(contentType, result.url)}`;
  const filePath = path.join(IMAGE_DIR, fileName);
  if (!fs.existsSync(filePath)) await saveImage(fileName, result.body, contentType);
  return publicImagePath(fileName);
}

async function resolvePageImage(rawPageUrl) {
  const result = await safeGet(rawPageUrl, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    timeoutMs: 12000,
    maxBytes: MAX_PAGE_BYTES,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Page request failed (${result.status}).`);
  }
  const contentType = String(result.headers['content-type'] || '').toLowerCase();
  if (/^image\//i.test(contentType) && isDirectImageUrl(result.url)) {
    return cacheRemoteImage(result.url);
  }
  const html = result.body.toString('utf8');
  const candidates = imageCandidates(html, result.url || rawPageUrl);
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
  safeRemoteUrl,
  sniffImageType,
};
