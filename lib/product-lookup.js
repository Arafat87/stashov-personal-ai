/**
 * Best-effort product lookup for pasted routines.
 *
 * A routine names products in plain text. Anything already saved in the Gate
 * is linked directly; everything else can be looked up here: search the open
 * web, open the most product-like result, read its structured data, and bring
 * back a title, brand, price, and a locally cached photo.
 *
 * This is deliberately conservative. A wrong photo on a skincare step is worse
 * than no photo, so a result is only accepted when enough of the pasted product
 * name actually appears in the page title. Everything is fetched through
 * `safe-fetch`, and the returned image is always a local /media path.
 */

const { safeGet } = require('./safe-fetch');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
const MAX_QUERY_LENGTH = 160;
const MAX_QUERIES = 8;
const MAX_CANDIDATES = 6;
const SEARCH_TIMEOUT_MS = 9000;
const PAGE_TIMEOUT_MS = 9000;
const MAX_SEARCH_BYTES = 900 * 1024;

const STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'from', 'plus', 'your', 'this', 'that', 'into',
  'over', 'daily', 'every', 'morning', 'evening', 'night', 'week', 'about',
]);

const PRODUCT_HINT = /\b(cleanser|face wash|body wash|shampoo|conditioner|serum|essence|toner|exfoliant|peel|mask|moisturiser|moisturizer|cream|lotion|balm|ointment|sunscreen|sunblock|sun cream|spf|retinol|retinoid|adapalene|tretinoin|niacinamide|azelaic|salicylic|glycolic|lactic|hyaluronic|vitamin c|peptide|ceramide|squalane|benzoyl|clindamycin|hydroquinone|supplement|protein|creatine|capsule|tablet|powder|fragrance|perfume|cologne|deodorant|toothpaste|razor|blade|shirt|tee|t-shirt|trouser|chino|jean|jacket|coat|shoe|sneaker|boot|watch|bag|wallet|belt|sock|underwear|mattress|pillow|bottle|pan|knife)\b/i;

const NOISE_LINE = /^(?:also|note|notes|tip|tips|optional|avoid|warning|weekly|every other|reminder|do not|don't|if |start |stop |wait |rinse |pat |massage )/i;

const BLOCKED_HOSTS = [
  'facebook.com', 'instagram.com', 'pinterest.com', 'youtube.com', 'youtu.be',
  'reddit.com', 'quora.com', 'twitter.com', 'x.com', 'tiktok.com',
  'linkedin.com', 'wikipedia.org', 'medium.com', 'substack.com', 'threads.net',
  'tumblr.com', 'spotify.com', 'apps.apple.com', 'play.google.com',
];

const ARTICLE_PATH = /\/(?:blogs?|articles?|news|wiki|guides?|stories)\/|\/(?:best|top)-/i;

const SHOP_HOSTS = /\b(?:sephora|ulta|target|walmart|amazon|boots|lookfantastic|cultbeauty|iherb|spacenk|net-a-porter|mrporter|quince|uniqlo|zara|asos|nordstrom|macys|argos|currys|very|johnlewis)\b/i;

function decodeEntities(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch (_) { return ' '; }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(Number(dec)); } catch (_) { return ' '; }
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function tokens(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function tokenMatch(token, haystack) {
  if (!token) return false;
  if (haystack.includes(token)) return true;
  // "moisturizer" should still find "moisturising"; "cleanser" should not find "clean".
  return token.length >= 6 && haystack.includes(token.slice(0, 5));
}

function extractUrls(value) {
  return String(value || '').match(/https?:\/\/[^\s<>"')]+/gi) || [];
}

function cleanTitle(value, max = 180) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|:–—-]+|[\s|:–—-]+$/g, '')
    .slice(0, max)
    .trim();
}

function cleanBrand(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function domainOf(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function isBlockedHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

function isArticleUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return ARTICLE_PATH.test(url.pathname);
  } catch (_) {
    return true;
  }
}

function looksLikeShop(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (SHOP_HOSTS.test(url.hostname)) return true;
    return /\/(?:products?|shop|p|dp|item|listing|buy)\//i.test(url.pathname);
  } catch (_) {
    return false;
  }
}

/**
 * Turn routine steps into search phrases. Instruction tails and note lines are
 * removed so "Apply 3 drops of serum to damp skin" becomes "serum", which is
 * then dropped for being too generic.
 */
function cleanProductLine(raw) {
  let value = String(raw || '')
    .replace(/^\s*(?:am|pm|morning|evening)\s*[—–:]\s*/i, '')
    .replace(/^\s*[-*•·]\s*/, '')
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/\[[^\]]{0,40}\]/g, ' ')
    .trim();
  if (!value) return '';
  value = value.replace(/^(?:cleanse|wash)\s+with\s+/i, '');
  value = value.replace(/^(?:apply|use|massage|pat|rinse|layer|spread|dot|press|smooth|mist)\s+/i, '');
  value = value.replace(/^\d+(?:\.\d+)?\s*(?:drops?|pumps?|sprays?|capsules?|tablets?|scoops?|pills?)\s+(?:of\s+)?/i, '');
  if (NOISE_LINE.test(value)) return '';
  value = value.replace(/\s+[—–]\s+.*$/, ' ');
  value = value.replace(/\s+every\s+(?:morning|evening|night|day)\b.*$/i, ' ');
  value = value.replace(/\s+(?:on|to)\s+(?:slightly\s+)?(?:damp|dry|clean|wet)\b.*$/i, ' ');
  value = value.replace(/\s+(?:until|then|before|after|and wait|and let|and pat|and rinse|and repeat|and follow)\s+.*$/i, ' ');
  value = value.replace(/\s*\([^)]*\)\s*/g, ' ');
  value = value.replace(/\s{2,}/g, ' ').trim();
  return value.replace(/[.;:,]+$/, '').trim();
}

function extractProductQueries(steps) {
  const queries = [];
  const seen = new Set();
  for (const raw of steps || []) {
    const cleaned = cleanProductLine(raw);
    if (!cleaned || cleaned.length > MAX_QUERY_LENGTH) continue;
    const words = cleaned.split(/\s+/);
    if (words.length < 2 || words.length > 16) continue;
    // "a gentle foaming cleanser" is a category, not a product.
    if (/^(?:a|an)\s+/i.test(cleaned)) continue;
    const hasUrl = extractUrls(cleaned).length > 0;
    const capitalised = (cleaned.match(/\b[A-Z][a-z0-9'’-]{2,}/g) || []).length >= 2;
    if (!hasUrl && !PRODUCT_HINT.test(cleaned) && !capitalised) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push(cleaned);
    if (queries.length >= MAX_QUERIES) break;
  }
  return queries;
}

function decodeBingHref(rawHref) {
  let url;
  try {
    url = new URL(decodeEntities(rawHref), 'https://www.bing.com');
  } catch (_) {
    return '';
  }
  if (!/(^|\.)bing\.com$/i.test(url.hostname)) return url.href;
  const wrapped = url.searchParams.get('u');
  if (!wrapped || !wrapped.startsWith('a1')) return '';
  try {
    const base64 = wrapped.slice(2).replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    return /^https?:\/\//i.test(decoded) ? decoded : '';
  } catch (_) {
    return '';
  }
}

function parseBraveResults(html) {
  const results = [];
  const chunks = String(html || '').split(/<a\s/i).slice(1);
  for (const chunk of chunks) {
    if (!chunk.includes('search-snippet-title')) continue;
    const openEnd = chunk.indexOf('>');
    if (openEnd < 0) continue;
    const href = /\bhref="([^"]+)"/i.exec(chunk.slice(0, openEnd));
    if (!href) continue;
    const url = decodeEntities(href[1]);
    if (!/^https?:\/\//i.test(url)) continue;
    const titleMatch = /title="([^"]{3,300})"/i.exec(chunk.slice(0, chunk.indexOf('</a>') + 1));
    const title = cleanTitle(titleMatch ? titleMatch[1] : '');
    if (!title) continue;
    results.push({ url, title });
  }
  return dedupeResults(results);
}

function parseBingResults(html) {
  const results = [];
  const blocks = String(html || '').split(/<li class="b_algo/i).slice(1);
  for (const block of blocks) {
    const h2Start = block.indexOf('<h2');
    if (h2Start < 0) continue;
    const h2End = block.indexOf('</h2>', h2Start);
    if (h2End < 0) continue;
    const h2 = block.slice(h2Start, h2End);
    const href = /\bhref="([^"]+)"/i.exec(h2);
    if (!href) continue;
    const url = decodeBingHref(href[1]);
    if (!url) continue;
    const title = cleanTitle(decodeEntities(h2.replace(/<[^>]+>/g, ' ')));
    if (!title) continue;
    results.push({ url, title });
  }
  return dedupeResults(results);
}

function dedupeResults(results) {
  const seen = new Set();
  return results.filter((result) => {
    if (!result || !result.url || seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });
}

async function fetchSearchPage(url) {
  return safeGet(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
    },
    timeoutMs: SEARCH_TIMEOUT_MS,
    maxBytes: MAX_SEARCH_BYTES,
  });
}

async function searchProductUrls(query, options = {}) {
  const engines = [
    {
      name: 'brave',
      url: `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`,
      parse: parseBraveResults,
    },
    {
      name: 'bing',
      url: `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10&setlang=en-US`,
      parse: parseBingResults,
    },
  ];

  for (const engine of engines) {
    try {
      const response = await fetchSearchPage(engine.url, options);
      if (response.status < 200 || response.status >= 300) continue;
      const candidates = engine.parse(response.body.toString('utf8'));
      if (candidates.length) return candidates;
    } catch (_) {
      // Try the next engine.
    }
  }
  return [];
}

function scoreProduct(query, title, brand, url, info = {}) {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return { accept: false, score: 0, coverage: 0 };
  const haystack = ` ${String(title || '').toLowerCase()} ${String(brand || '').toLowerCase()} `;
  const matched = queryTokens.filter((token) => tokenMatch(token, haystack)).length;
  const coverage = matched / queryTokens.length;
  let score = coverage * 10;
  if (Number(info.price) > 0) score += 1.5;
  if (info.image_url) score += 1;
  if (looksLikeShop(url)) score += 0.8;
  const brandToken = String(brand || '').toLowerCase().split(/\s+/)[0];
  if (brandToken && queryTokens.some((token) => token === brandToken || brandToken.includes(token))) score += 1;

  // One lucky word out of three is not a match. Two words, or 60% coverage, is.
  const accept = coverage >= 0.6 || (coverage >= 0.5 && matched >= 2);
  return { accept, score, coverage };
}

/**
 * Look up one product. Returns null when no page is a credible match; callers
 * should show "not found" rather than inventing a photo.
 */
async function lookupProduct(rawQuery, options = {}) {
  const query = String(rawQuery || '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) throw new Error('Give me a product name or link to look up.');

  const search = options.search || searchProductUrls;
  const fetchInfo = options.fetchInfo || require('./product-info').fetchProductInfo;
  const resolve = options.resolveImage || require('./image-cache').resolveImage;

  const pastedUrls = extractUrls(query);
  const candidates = pastedUrls.length
    ? [{ url: pastedUrls[0], title: '' }]
    : await search(query, options);

  const deadline = Date.now() + (Number(options.deadlineMs) || 30000);
  let best = null;
  const seen = new Set();
  for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
    if (Date.now() > deadline) break;
    if (!candidate || !candidate.url || seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    let parsed;
    try { parsed = new URL(candidate.url); } catch (_) { continue; }
    if (!/^https?:$/i.test(parsed.protocol)) continue;
    if (isBlockedHost(parsed.hostname)) continue;
    if (!pastedUrls.length && isArticleUrl(candidate.url)) continue;

    let info;
    try {
      info = await fetchInfo(candidate.url, { timeoutMs: PAGE_TIMEOUT_MS });
    } catch (_) {
      continue;
    }
    const title = cleanTitle(info.title || candidate.title);
    if (!title) continue;
    const scored = scoreProduct(query, title, info.brand, candidate.url, info);
    if (!scored.accept) continue;
    if (!best || scored.score > best.score) {
      best = {
        score: scored.score,
        title,
        brand: cleanBrand(info.brand),
        price: info.price ?? null,
        currency: info.currency || '',
        priceSource: info.price_source || 'none',
        url: info.final_url || candidate.url,
        info,
      };
    }
    if (best.score >= 14) break;
  }
  if (!best) return null;

  let image = '';
  if (best.info.image_url) {
    try {
      image = await resolve(best.info.image_url, { pageUrl: best.url });
    } catch (_) {
      image = '';
    }
  }

  return {
    query,
    title: best.title,
    brand: best.brand,
    price: best.price,
    currency: best.currency,
    price_source: best.priceSource,
    image: /^\/media\/images\//i.test(image) ? image : '',
    url: best.url,
    domain: domainOf(best.url),
    confidence: best.score >= 12 ? 'high' : 'medium',
    fetched_at: new Date().toISOString(),
  };
}

module.exports = {
  MAX_QUERIES,
  cleanProductLine,
  decodeBingHref,
  extractProductQueries,
  extractUrls,
  lookupProduct,
  parseBingResults,
  parseBraveResults,
  scoreProduct,
  searchProductUrls,
};
