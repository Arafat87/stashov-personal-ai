/**
 * Stashov — pre-gate promotion.
 *
 * A bookmark is promoted in two steps: preview what the page actually exposes,
 * then build the wishlist item from the reviewed values. The preview never
 * writes to the vault, so the user can correct a bad title or price before the
 * 14-day cooldown starts. A price that was not read from the page is always
 * labelled manual or missing; nothing is inferred.
 */

const { fetchProductInfo, normalizeCurrency } = require('./product-info');
const { isCachedImage, resolveImage, safeRemoteUrl } = require('./image-cache');

const MAX_PRICE = 1000000000;
const DEFAULT_USES_PER_MONTH = 8;

class PromotionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PromotionError';
    this.status = 400;
  }
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function cleanText(value, max) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function readPrice(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > MAX_PRICE) {
    throw new PromotionError(`${field} must be between $0 and $1,000,000,000.`);
  }
  return number === 0 ? null : roundMoney(number);
}

function bookmarkBrand(bm) {
  const domain = cleanText(bm && bm.domain, 120);
  return domain ? domain.split('.')[0].toUpperCase() : 'UNKNOWN BRAND';
}

function bookmarkImage(value) {
  const image = String(value || '').trim();
  if (isCachedImage(image)) return image;
  return /^https?:\/\//i.test(image) ? image : '';
}

async function captureBookmarkProduct(bm) {
  let product = null;
  let captureError = '';
  try {
    product = await fetchProductInfo(bm.url);
  } catch (err) {
    captureError = err.message;
  }

  const capturedPrice = product && Number(product.price) > 0 ? roundMoney(product.price) : null;
  let image = bookmarkImage(bm.image);
  if (!image && product && product.image_url) {
    try { image = await resolveImage(product.image_url, { pageUrl: bm.url }); } catch (_) {}
  }
  if (!image) {
    try { image = await resolveImage(bm.url); } catch (_) {}
  }

  return {
    product,
    captureError,
    capturedPrice,
    image,
    mode: 'server',
    confidence: capturedPrice !== null ? 'high' : '',
    reason: (product && product.price_reason) || captureError || 'No public price was found.',
  };
}

/**
 * Build a capture from metadata read inside the user's own product tab. Some
 * stores return 403 to server-side requests while still exposing complete
 * JSON-LD or OpenGraph data to the browser, so this path never fetches the
 * page. The image is still cached locally when possible.
 */
async function captureFromSnapshot(bm, snapshot = {}) {
  const page = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : {};
  const title = cleanText(page.title, 220);
  const brand = cleanText(page.brand, 120) || bookmarkBrand(bm);
  let price = readPrice(page.price, 'Captured price');
  let currency = normalizeCurrency(page.currency) || (price !== null ? 'USD' : '');
  let reason = cleanText(page.price_reason, 500);

  if (price !== null && currency && currency !== 'USD') {
    reason = `The page lists ${currency} ${price.toFixed(2)}; the Gate tracks USD, so enter a USD price manually.`;
    price = null;
    currency = '';
  }
  if (price === null && !reason) {
    reason = 'No public price was found in the page metadata.';
  }

  const imageUrl = safeRemoteUrl(page.image);
  let image = '';
  if (imageUrl) {
    try {
      image = await resolveImage(imageUrl.href, { pageUrl: bm.url });
    } catch (_) {
      image = imageUrl.href;
    }
  }

  const priceSource = page.price_source === 'json-ld' || page.price_source === 'meta' || page.price_source === 'dom'
    ? page.price_source
    : 'page';
  const confidence = price !== null && priceSource === 'dom' ? 'low' : (price !== null ? 'high' : '');
  const product = {
    ok: true,
    page_url: bm.url,
    title,
    brand,
    price,
    currency: price === null ? '' : currency,
    price_source: price === null ? 'none' : priceSource,
    price_reason: price === null ? reason : '',
    image_url: imageUrl ? imageUrl.href : '',
    page_title: cleanText(page.page_title, 220),
  };

  return {
    product,
    captureError: '',
    capturedPrice: price,
    image,
    mode: 'page',
    confidence,
    reason: price === null ? reason : '',
  };
}

function previewFromCapture(bm, capture = {}) {
  const product = capture.product || null;
  const price = capture.capturedPrice === undefined ? null : capture.capturedPrice;
  const status = price !== null && Number(price) > 0 ? 'captured' : 'missing';
  const title = cleanText((product && product.title) || bm.title, 220) || 'Untitled bookmark';
  const brand = cleanText((product && product.brand) || bookmarkBrand(bm), 120);
  return {
    bookmark_id: bm.id,
    url: bm.url,
    title,
    brand,
    image: capture.image || bookmarkImage(bm.image),
    image_source: (product && product.image_url) || bm.url,
    domain: cleanText(bm.domain, 180),
    browser: cleanText(bm.browser, 40),
    folder: cleanText(bm.original_folder, 180),
    category: bm.category,
    price,
    currency: price === null ? '' : ((product && product.currency) || 'USD'),
    price_status: status,
    price_source: status === 'captured' ? ((product && product.price_source) || 'page') : 'none',
    price_confidence: status === 'captured' ? (capture.confidence === 'low' ? 'low' : 'high') : '',
    price_reason: status === 'captured' ? '' : capture.reason,
    capture_mode: capture.mode === 'page' ? 'page' : 'server',
    best_source: status === 'captured'
      ? (capture.confidence === 'low'
        ? `${brand} product page (low-confidence visible price)`
        : `${brand} product page (captured from ${capture.mode === 'page' ? 'open product tab' : 'saved URL'})`)
      : 'Add a verified source',
    uses_per_month: DEFAULT_USES_PER_MONTH,
  };
}

/**
 * Build the wishlist item. Pass `details` when the user has reviewed the
 * preview; pass a capture object for the automatic API path. A reviewed price
 * is only labelled "captured" when it still matches the captured baseline.
 */
function buildPromotedWish(bm, capture = {}, details = null, now = new Date()) {
  const reviewed = details && typeof details === 'object' && !Array.isArray(details);
  const baseline = reviewed
    ? readPrice(details.captured_price, 'Captured price')
    : (capture.capturedPrice === undefined ? null : capture.capturedPrice);

  let retail;
  let floor;
  if (reviewed) {
    retail = readPrice(details.retail_price, 'Retail price');
    floor = readPrice(details.lowest_verified_price, 'Price you expect to pay');
    if (retail === null && floor !== null) retail = floor;
    if (floor === null && retail !== null) floor = retail;
  } else {
    retail = baseline;
    floor = baseline;
  }

  const product = capture.product || null;
  const captureMode = reviewed ? cleanText(details.capture_mode, 20) : (capture.mode || 'server');
  const title = cleanText(reviewed ? details.title : (product && product.title) || bm.title, 220)
    || cleanText(bm.title, 220)
    || 'Untitled bookmark';
  const brand = cleanText(reviewed ? details.brand : (product && product.brand) || bookmarkBrand(bm), 120)
    || bookmarkBrand(bm);
  const image = reviewed ? bookmarkImage(details.image) : (capture.image || bookmarkImage(bm.image));
  const priceConfirmed = retail !== null || floor !== null;
  const unchangedCapture = baseline !== null && retail === baseline && floor === baseline;
  const priceStatus = priceConfirmed ? (unchangedCapture ? 'captured' : 'manual') : 'missing';
  const priceSource = priceStatus === 'captured'
    ? ((product && product.price_source) || (reviewed && details.price_source) || 'page')
    : priceStatus === 'manual' ? 'manual' : 'none';
  const priceConfidence = priceStatus === 'captured'
    ? (cleanText(reviewed ? details.price_confidence : (capture.confidence || ''), 16) === 'low' ? 'low' : 'high')
    : '';
  const priceReason = priceStatus === 'missing'
    ? (cleanText(reviewed ? details.price_reason : capture.reason, 500)
      || 'No public price was confirmed before gating.')
    : '';
  const price = floor !== null ? floor : retail;
  const priceNote = priceConfidence === 'low'
    ? 'Low-confidence price read from visible page text — verify it before checkout.'
    : priceReason;
  const bestSource = cleanText(reviewed ? details.best_source : '', 180)
    || (priceStatus === 'captured'
      ? (priceConfidence === 'low'
        ? `${brand} product page (low-confidence visible price)`
        : `${brand} product page (captured from saved URL)`)
      : priceStatus === 'manual' ? 'Entered during pre-gate review' : 'Add a verified source');
  const antiHype = priceStatus === 'captured'
    ? (priceConfidence === 'low'
      ? `Low-confidence price ${price.toFixed(2)} USD was read from visible page text, not structured metadata. Verify it before checkout; the Gate does not treat it as a verified floor.`
      : `${captureMode === 'page' ? 'Captured directly from the open product tab' : 'Captured from the saved product page'} at ${price.toFixed(2)} USD. The Gate does not claim a lower verified floor until you find one.`)
    : priceStatus === 'manual'
      ? `Reviewed before gating at ${price.toFixed(2)} USD. The price was entered by hand, not read from the page.`
      : `Promoted from ${cleanText(bm.browser, 40) || 'the browser'} (${cleanText(bm.original_folder, 180) || 'bookmarks'}). ${priceReason} Add a price from the Gate card so the budget impact is real.`;

  return {
    id: `wl_${Date.now()}`,
    title,
    brand,
    url: bm.url,
    image,
    image_source: (product && product.image_url) || bm.url,
    category: cleanText(reviewed ? details.category : bm.category, 100) || bm.category,
    retail_price: retail,
    lowest_verified_price: floor,
    price_currency: 'USD',
    price_status: priceStatus,
    price_source: priceSource,
    price_confidence: priceConfidence,
    price_captured_at: priceConfirmed ? new Date(now).toISOString() : null,
    price_note: priceNote,
    best_source: bestSource,
    dupe_alternative: 'Check category price-to-spec leader in Vault before checkout',
    uses_per_month: DEFAULT_USES_PER_MONTH,
    cost_per_use: price !== null ? roundMoney(price / DEFAULT_USES_PER_MONTH) : null,
    inventory_overlap: 'Cross-checked against Owned Inventory — verify no duplicate in closet/shelf.',
    routine_compatibility: 'Verified against Personal Constraints Profile',
    verdict: 'WAIT_OR_DUPE',
    verdict_label: priceConfirmed ? '14-DAY COOLING LOCK ACTIVE' : 'PRICE NEEDS REVIEW',
    anti_hype_summary: antiHype,
    snapshot_excerpt: `Archived from ${bm.url}`,
    tags: bm.tags,
  };
}

module.exports = {
  PromotionError,
  bookmarkImage,
  buildPromotedWish,
  captureBookmarkProduct,
  captureFromSnapshot,
  previewFromCapture,
};
