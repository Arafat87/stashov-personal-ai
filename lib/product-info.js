/**
 * Stashov — product metadata capture for promoted bookmarks.
 *
 * Promotion must not invent a price. This module reads the public product page
 * and extracts the fields the Gate actually uses: title, brand, an offered
 * price, currency, image, and the page title. It intentionally accepts only a
 * single observed price; a second "verified floor" is never fabricated from it.
 * If the page hides or omits the price, callers get `price: null` and a reason
 * instead of a plausible-looking placeholder.
 */

const { safeGet } = require('./safe-fetch');

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Stashov/2.0';

const CURRENCY_ALIASES = {
  '$': 'USD',
  'US$': 'USD',
  'USD': 'USD',
  '£': 'GBP',
  'GBP': 'GBP',
  '€': 'EUR',
  'EUR': 'EUR',
  'C$': 'CAD',
  'CAD': 'CAD',
  'A$': 'AUD',
  'AUD': 'AUD',
};

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => codePoint(parseInt(dec, 10)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function codePoint(value) {
  try {
    return Number.isFinite(value) ? String.fromCodePoint(value) : '';
  } catch (_) {
    return '';
  }
}

function cleanText(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAttributes(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match;
  while ((match = re.exec(tag))) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function metaMap(html) {
  const map = new Map();
  const re = /<meta\b[^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const attrs = parseAttributes(match[0]);
    const key = String(attrs.property || attrs.name || attrs.itemprop || '').trim().toLowerCase();
    if (key && attrs.content !== undefined) map.set(key, attrs.content);
  }
  return map;
}

function titleTag(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? cleanText(match[1]) : '';
}

function jsonLdNodes(html) {
  const nodes = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      nodes.push(JSON.parse(raw));
    } catch (_) {
      // A malformed block should not hide the rest of the page metadata.
    }
  }
  return nodes;
}

function walkJson(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visit);
    return;
  }
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walkJson(child, visit);
}

function isProductType(type) {
  const text = Array.isArray(type) ? type.join(' ') : String(type || '');
  return /product/i.test(text);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function brandName(brand) {
  if (!brand) return '';
  if (Array.isArray(brand)) return brandName(brand[0]);
  if (typeof brand === 'string') return cleanText(brand);
  if (typeof brand === 'object') return cleanText(brand.name || brand['@id'] || '');
  return '';
}

function imageUrl(image) {
  if (!image) return '';
  if (Array.isArray(image)) return imageUrl(image[0]);
  if (typeof image === 'string') return image;
  if (typeof image === 'object') return String(image.url || image.contentUrl || image['@id'] || '');
  return '';
}

function parsePriceValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 && value < 1e9 ? roundMoney(value) : null;
  const text = String(value).replace(/\u00a0/g, ' ').trim();
  const match = text.match(/-?\d[\d.,]*/);
  if (!match) return null;
  let normalized = match[0].replace(/[.,]$/, '');
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma > lastDot && /,\d{1,2}$/.test(normalized)) {
    // European style: 1.299,00 -> 1299.00
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 && number < 1e9 ? roundMoney(number) : null;
}

function normalizeCurrency(value) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return '';
  if (CURRENCY_ALIASES[text]) return CURRENCY_ALIASES[text];
  const code = text.replace(/[^A-Z]/g, '').slice(0, 3);
  return code.length === 3 ? code : '';
}

function currencyFromText(value) {
  const text = String(value || '');
  if (/£|GBP/i.test(text)) return 'GBP';
  if (/€|EUR/i.test(text)) return 'EUR';
  if (/\$|USD/i.test(text)) return 'USD';
  return '';
}

function offerFrom(value) {
  const offers = Array.isArray(value) ? value : [value];
  for (const offer of offers) {
    if (!offer || typeof offer !== 'object') continue;
    const specs = Array.isArray(offer.priceSpecification) ? offer.priceSpecification : [offer.priceSpecification];
    const candidates = [offer.price, offer.lowPrice, ...specs.map((spec) => spec && spec.price)];
    let price = null;
    for (const candidate of candidates) {
      price = parsePriceValue(candidate);
      if (price !== null) break;
    }
    if (price === null) continue;
    const currency = normalizeCurrency(
      firstDefined(offer.priceCurrency, ...specs.map((spec) => spec && spec.priceCurrency), '')
    ) || currencyFromText(offer.price);
    return { price, currency };
  }
  return null;
}

function findProductNode(nodes) {
  let product = null;
  for (const node of nodes) {
    walkJson(node, (candidate) => {
      if (!isProductType(candidate['@type'])) return;
      if (!product) product = candidate;
      else if (!product.offers && candidate.offers) product = candidate;
    });
  }
  return product;
}

/**
 * Parse already-downloaded HTML. Exposed separately so tests do not need the
 * network and so a caller can reuse a page it already fetched.
 */
function parseProductInfo(html, pageUrl = '') {
  const page = String(html || '');
  const metas = metaMap(page);
  const product = findProductNode(jsonLdNodes(page));
  const title = firstDefined(
    product && cleanText(product.name),
    cleanText(metas.get('og:title')),
    cleanText(metas.get('twitter:title')),
    titleTag(page),
    ''
  ) || '';
  const brand = firstDefined(
    brandName(product && product.brand),
    cleanText(metas.get('og:site_name')),
    cleanText(metas.get('application-name')),
    ''
  ) || '';
  const image = firstDefined(
    imageUrl(product && product.image),
    metas.get('og:image'),
    metas.get('og:image:url'),
    metas.get('twitter:image'),
    metas.get('twitter:image:src'),
    ''
  ) || '';

  let price = null;
  let currency = '';
  let priceSource = 'none';
  let priceReason = '';

  const offer = offerFrom(product && product.offers);
  if (offer) {
    price = offer.price;
    currency = offer.currency;
    priceSource = 'json-ld';
  }

  if (price === null) {
    const amount = firstDefined(
      metas.get('product:price:amount'),
      metas.get('og:price:amount'),
      metas.get('price')
    );
    const parsed = parsePriceValue(amount);
    if (parsed !== null) {
      price = parsed;
      priceSource = 'meta';
      currency = normalizeCurrency(
        firstDefined(
          metas.get('product:price:currency'),
          metas.get('og:price:currency'),
          metas.get('pricecurrency'),
          ''
        )
      ) || currencyFromText(amount) || 'USD';
    }
  }

  if (price !== null) {
    currency = currency || 'USD';
    if (currency !== 'USD') {
      priceReason = `The page lists ${currency} ${price.toFixed(2)}; the Gate tracks USD, so enter a USD price manually.`;
      price = null;
    }
  } else if (!priceReason) {
    priceReason = 'No public price was found in the page metadata.';
  }

  return {
    ok: true,
    page_url: pageUrl || '',
    title,
    brand,
    price,
    currency: price === null ? '' : currency,
    price_source: priceSource,
    price_reason: priceReason,
    image_url: image,
    page_title: titleTag(page),
  };
}

async function fetchProductInfo(rawUrl, options = {}) {
  const result = await safeGet(rawUrl, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
    },
    timeoutMs: Number(options.timeoutMs) || 10000,
    maxBytes: MAX_HTML_BYTES,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Product page request failed (${result.status}).`);
  }
  const contentType = String(result.headers['content-type'] || '');
  if (/^image\//i.test(contentType)) throw new Error('That saved URL is an image, not a product page.');
  const html = result.body.toString('utf8').slice(0, MAX_HTML_BYTES);
  return {
    ...parseProductInfo(html, result.url || rawUrl),
    final_url: result.url || rawUrl,
    http_status: result.status,
    fetched_at: new Date().toISOString(),
  };
}

module.exports = {
  MAX_HTML_BYTES,
  fetchProductInfo,
  normalizeCurrency,
  parsePriceValue,
  parseProductInfo,
};
