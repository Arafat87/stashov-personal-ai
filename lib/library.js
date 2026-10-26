/**
 * Stashov — Reference Library taxonomy.
 *
 * The Vault keeps every saved link. The Library is the subset that is useful
 * as a reference (learning, business, tools, guides) rather than a product
 * page being price-tracked. Classification is deterministic and can be
 * overridden per bookmark with `library_section`.
 */

const SECTIONS = Object.freeze([
  {
    id: 'education',
    label: 'Education & Learning',
    short: 'Education',
    icon: 'i-book',
    color: '#8ab4ff',
    description: 'Courses, tutorials, certifications, and study material.',
    use_for: 'courses, tutorials, certifications, and self-study.',
  },
  {
    id: 'programming',
    label: 'Programming & Dev Tools',
    short: 'Programming',
    icon: 'i-code',
    color: '#63e6ff',
    description: 'Documentation, code references, snippets, and developer tooling.',
    use_for: 'coding references, documentation, snippets, and dev tooling.',
  },
  {
    id: 'ai',
    label: 'AI, Data & Automation',
    short: 'AI & Data',
    icon: 'i-spark',
    color: '#a98bff',
    description: 'Models, agents, prompts, data tools, and AI infrastructure.',
    use_for: 'AI models, agents, prompts, data work, and infrastructure research.',
  },
  {
    id: 'career',
    label: 'Career & Interview Prep',
    short: 'Career',
    icon: 'i-briefcase',
    color: '#ffc35c',
    description: 'Job search, resumes, interview practice, and career planning.',
    use_for: 'job search, resumes, interview practice, and career planning.',
  },
  {
    id: 'business',
    label: 'Business, Finance & Ideas',
    short: 'Business',
    icon: 'i-coin',
    color: '#52f2ab',
    description: 'Business models, finance, marketing, and market research.',
    use_for: 'business ideas, finance, marketing, and market research.',
  },
  {
    id: 'design',
    label: 'Design & Creative',
    short: 'Design',
    icon: 'i-image',
    color: '#ff6b8a',
    description: 'Design inspiration, assets, fonts, palettes, and creative tools.',
    use_for: 'design inspiration, assets, fonts, palettes, and creative tooling.',
  },
  {
    id: 'cyber',
    label: 'Cybersecurity & OSINT',
    short: 'Security',
    icon: 'i-lock',
    color: '#ff8a5c',
    description: 'Security research, labs, OSINT, and certification material.',
    use_for: 'security research, labs, OSINT, and certifications.',
  },
  {
    id: 'utilities',
    label: 'Utilities & Life Hacks',
    short: 'Utilities',
    icon: 'i-command',
    color: '#c6ff4a',
    description: 'Everyday tools, calculators, references, and how-to guides.',
    use_for: 'everyday tools, references, calculators, and how-to guides.',
  },
  {
    id: 'gaming',
    label: 'Gaming, Mods & Esports',
    short: 'Gaming',
    icon: 'i-deck',
    color: '#8ab4ff',
    description: 'Game guides, mods, sim-racing resources, and esports.',
    use_for: 'game guides, mods, sim-racing resources, and esports.',
  },
  {
    id: 'sourcing',
    label: 'Sourcing & Shipping',
    short: 'Sourcing',
    icon: 'i-arrow',
    color: '#ffc35c',
    description: 'Proxy buying, wholesale sourcing, shipping, and import guides.',
    use_for: 'sourcing, proxy buying, shipping, and import research.',
  },
]);

const SECTION_BY_ID = new Map(SECTIONS.map((section) => [section.id, section]));

const REFERENCE_CATEGORIES = new Set([
  'Life Hacks, Utilities & Reference',
  'Programming, Cloud & Dev Tools',
  'Career, Jobs & Interview Prep',
  'AI Models, Agents & Infra',
  'Global Sourcing & Proxies',
  'Cybersecurity & NetSec',
  'Gaming, Mods & Esports',
  'Business, Finance & Auto/Real Estate',
]);

const PRODUCT_CATEGORIES = new Set([
  'Menswear & Streetwear',
  'Fragrances & Cologne',
  'Skincare, Health & Protocols',
  'Watches, Footwear & Accessories',
  'Soccer Kits & Sportswear',
  'Food, Halal & Specialty Groceries',
]);

const CAREER_RE = /\b(interview|interviews|job|jobs|resume|résumé|career|hiring|salary|recruit|recruiter|linkedin)\b/i;
const EDUCATION_RE = /\b(course|courses|learn|learning|academy|university|college|school|bootcamp|certification|certified|curriculum|study|lesson|lessons|degree|mooc|edx|coursera|udemy|khan academy|freecodecamp|codecademy|upskill|digitaldefynd|greatfrontend|neetcode|pramp|interviewbit|bfe\.dev|javascript30|devchallenges|codewell|missing semester|leetcode|hackerrank|exercism|sololearn|skillshare|masterclass|pluralsight|tutorial|tutorials)\b/i;
const STRONG_EDUCATION_RE = /\b(course|courses|coursera|edx|udemy|khan academy|freecodecamp|codecademy|bootcamp|certification|curriculum|lesson|lessons|learn to|academy|university|college|mooc|upskill|digitaldefynd|greatfrontend|neetcode|pramp|interviewbit|leetcode|hackerrank|exercism|sololearn|skillshare|masterclass|pluralsight|codewell)\b/i;
const DESIGN_RE = /\b(bootstrap|html template|website template|templates?|themes?|ui kit|mockup|typeface|fonts?|fontspace|icon set|lightroom|presets?|procreate|figma|canva|illustration|3d library|texture|palette|color palette|svg|photoshop|graphic design|design tool|design resources?|vector art|vector files?|motion design|jitter|huemint|uizard|leiapix|kittl|eyecandy|space type generator|brand bible|jerseybird|veed|stunning visuals)\b/i;
const AUTO_RE = /\b(cars?|auto|automotive|vehicles?|dealers?|dealership|carvana|carmax|truecar|kbb|kelley|edmunds|manheim|iaai|carvertical|caredge|visor\.vin|enterprisecarsales|vin|motorcycle|truck|suv)\b/i;
const CAR_DOMAIN_RE = /(carvana|carmax|truecar|kbb|edmunds|manheim|iaai|carvertical|caredge|visor\.vin|enterprisecarsales|autotrader|cars\.com|carfax)/i;
const REAL_ESTATE_RE = /\b(real estate|realtor|housing|apartments?|rent|rental|zillow|streeteasy|compass|housingconnect|mortgage|property|landlord|condo|co-op|coop|lease)\b/i;
const RE_DOMAIN_RE = /(zillow|streeteasy|housingconnect|compass\.com|realtor\.com|apartments\.com|rentcafe)/i;
const SHIPPING_RE = /\b(cainiao|shipping|freight|logistics|parcel|forwarder|customs)\b/i;
const SHOP_REFERENCE_RE = /\b(shop|store|jersey|sneakers?|hoodie|parka|fragrance|cologne|perfume|skincare|serum|cleanser|discount|deal|price)\b/i;
const GAMING_SHOP_RE = /\b(racing wheel|simulator equipment|gtrack|moza|next level racing|shop|store|buy now)\b/i;

function cleanSection(value) {
  const id = String(value || '').trim();
  return SECTION_BY_ID.has(id) ? id : '';
}

function textFor(bookmark) {
  // Do not include subcategory: strings like "AI & Machine Learning" would
  // make every AI tool look like an education link.
  return `${bookmark.title || ''} ${bookmark.domain || ''} ${bookmark.url || ''} ${(bookmark.tags || []).join(' ')}`.toLowerCase();
}

function sectionById(id) {
  return SECTION_BY_ID.get(cleanSection(id)) || null;
}

/**
 * Return a library section id, or '' when the bookmark belongs in the Vault's
 * price-tracking/product clusters instead of the reference library.
 */
function librarySectionFor(bookmark) {
  if (!bookmark || bookmark.library_opt_out) return '';
  const stored = cleanSection(bookmark.library_section);
  if (stored) return stored;

  const category = String(bookmark.category || '');
  const text = textFor(bookmark);
  const isReference = REFERENCE_CATEGORIES.has(category);
  const isProduct = PRODUCT_CATEGORIES.has(category);

  if (!isReference && !isProduct) {
    if (DESIGN_RE.test(text)) return 'design';
    if (EDUCATION_RE.test(text)) return 'education';
    return '';
  }

  // Cars and housing are purchase research, not reference material.
  if (AUTO_RE.test(text) || CAR_DOMAIN_RE.test(bookmark.domain || '')) return '';
  if (REAL_ESTATE_RE.test(text) || RE_DOMAIN_RE.test(bookmark.domain || '')) return '';

  // Codewell is a coding-practice platform even though its copy mentions design templates.
  if (category === 'Programming, Cloud & Dev Tools' && /codewell/i.test(text)) return 'education';

  // Design resources are frequently misfiled in shopping, AI, and business.
  if (DESIGN_RE.test(text)) return 'design';

  if (category === 'Business, Finance & Auto/Real Estate') {
    if (EDUCATION_RE.test(text)) return 'education';
    return 'business';
  }

  if (EDUCATION_RE.test(text)) {
    if (category === 'Career, Jobs & Interview Prep' && CAREER_RE.test(text)) return 'career';
    if (category === 'Cybersecurity & NetSec') return 'cyber';
    return 'education';
  }

  if (category === 'Programming, Cloud & Dev Tools') return 'programming';
  if (category === 'AI Models, Agents & Infra') {
    if (SHIPPING_RE.test(text)) return 'sourcing';
    return 'ai';
  }
  if (category === 'Career, Jobs & Interview Prep') return 'career';
  if (category === 'Cybersecurity & NetSec') return 'cyber';
  if (category === 'Global Sourcing & Proxies') return 'sourcing';

  if (category === 'Gaming, Mods & Esports') {
    if (GAMING_SHOP_RE.test(text)) return '';
    return 'gaming';
  }

  if (category === 'Life Hacks, Utilities & Reference') {
    if (SHOP_REFERENCE_RE.test(text)) return '';
    return 'utilities';
  }

  // A product-category bookmark with no strong reference signal stays in the Vault.
  if (isProduct) return '';
  return '';
}

function isLibraryBookmark(bookmark) {
  return Boolean(librarySectionFor(bookmark));
}

function librarySectionsWithCounts(bookmarks) {
  const counts = new Map();
  for (const bookmark of bookmarks || []) {
    if (bookmark && bookmark.library_archived) continue;
    const id = librarySectionFor(bookmark);
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return SECTIONS
    .map((section) => ({ ...section, count: counts.get(section.id) || 0 }))
    .filter((section) => section.count > 0);
}

function libraryCount(bookmarks) {
  return (bookmarks || []).reduce(
    (total, bookmark) => total + (bookmark && !bookmark.library_archived && librarySectionFor(bookmark) ? 1 : 0),
    0
  );
}

// Tracking parameters that create duplicate library entries without changing
// the destination page. Everything else in the query string is preserved
// because it can select a real resource (docs version, product variant, etc.).
const TRACKING_PARAMS = new Set([
  'gclid', 'fbclid', 'msclkid', 'dclid', 'yclid', 'twclid', 'igshid',
  'mc_cid', 'mc_eid', '_ga', '_gl', 'ref', 'ref_src', 'ref_url', 'referrer',
  'source', 'campaign', 's_cid', 'spm', 'scid', 'trk',
]);

function canonicalBookmarkUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return raw.toLowerCase();
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const port = url.port && url.port !== '80' && url.port !== '443' ? `:${url.port}` : '';
    const path = url.pathname.replace(/\/+$/, '') || '/';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    const search = url.searchParams.toString();
    return `${host}${port}${path}${search ? `?${search}` : ''}`.toLowerCase();
  } catch (_) {
    return raw.replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Group live library entries that point at the same canonical URL. Product and
 * reference bookmarks are both handled, but archived entries are ignored so a
 * cleaned-up duplicate cannot reappear in the review list.
 */
function findLibraryDuplicates(bookmarks) {
  const groups = new Map();
  for (const bookmark of bookmarks || []) {
    if (!bookmark || bookmark.library_archived) continue;
    const section = librarySectionFor(bookmark);
    if (!section) continue;
    const key = canonicalBookmarkUrl(bookmark.url);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...bookmark, library_section: section });
  }
  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      section: items[0].library_section,
      title: items[0].title || items[0].domain || 'Duplicate link',
      items: items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))),
      extra: items.length - 1,
    }))
    .sort((a, b) => b.extra - a.extra || a.title.localeCompare(b.title));
}

function fallbackDescription(bookmark) {
  const section = sectionById(bookmark.library_section || librarySectionFor(bookmark));
  if (!section) return truncateText(`${bookmark.title || bookmark.domain || 'Reference'} — saved reference link.`, 280);
  const article = /^(education|ai)/.test(section.id) ? 'an' : 'a';
  return truncateText(
    `${bookmark.title || bookmark.domain || 'Reference'} — ${article} ${section.label.toLowerCase()} resource. ${section.description}`,
    280
  );
}

function truncateText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.65 ? cut.slice(0, space) : cut).replace(/[,.;:!?\-–—\s]+$/g, '')}…`;
}

module.exports = {
  SECTIONS,
  REFERENCE_CATEGORIES,
  PRODUCT_CATEGORIES,
  sectionById,
  librarySectionFor,
  isLibraryBookmark,
  librarySectionsWithCounts,
  libraryCount,
  fallbackDescription,
  canonicalBookmarkUrl,
  findLibraryDuplicates,
};
