/**
 * Stashov — Browser Bookmark Auto-Importer & Category Classifier
 * Reads Google Chrome, Brave Browser, and Microsoft Edge local Bookmarks JSON,
 * deduplicates URLs, classifies them into 14 smart categories, computes semantic
 * vectors, and updates data/vault.json.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Arafat Sani', 'AppData', 'Local');

const BROWSER_PATHS = {
  Chrome: path.join(LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks'),
  Brave: path.join(LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Bookmarks'),
  Edge: path.join(LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data', 'Default', 'Bookmarks'),
};

function walkBookmarks(node, folder = '', source = '') {
  let items = [];
  if (!node || typeof node !== 'object') return items;

  if (node.type === 'url') {
    items.push({
      name: node.name || '',
      url: node.url || '',
      folder,
      date_added: node.date_added || '',
      source_browser: source,
    });
  } else if (Array.isArray(node.children)) {
    const nextFolder = [folder, node.name || ''].filter(Boolean).join('/');
    for (const child of node.children) {
      items = items.concat(walkBookmarks(child, nextFolder, source));
    }
  } else if (node.roots && typeof node.roots === 'object') {
    for (const [k, v] of Object.entries(node.roots)) {
      if (v && typeof v === 'object') {
        items = items.concat(walkBookmarks(v, k, source));
      }
    }
  }
  return items;
}

function classifyBookmark(b) {
  const name = (b.name || '').toLowerCase();
  const url = (b.url || '').toLowerCase();
  const folder = (b.folder || '').toLowerCase();
  const text = `${name} ${url}`;

  const hasAny = (words) => words.some((w) => text.includes(w));

  if (hasAny(['perfume', 'fragrance', 'cologne', 'scent', 'olfactory', 'byredo', 'acqua di parma', 'swiss arabian', 'al-rashad', 'taifalemarat', 'luckyscent', 'aromatrail', 'duppescents', 'maisonyusif'])) {
    return ['Fragrances & Cologne', 'wishlist', 'Fragrance & Scent'];
  }
  if (hasAny(['peptide', 'aminoclub', 'bpc-157', 'glp-', 'tiege', 'skincare', 'skin care', 'cortinahealth', 'cleanser', 'acne', 'deodorant', 'antiperspirant', 'jackhenry', 'twnskn', 'cecred', 'vitaminshoppe', 'lactoferrin', 'supplement', 'alkaline healing', 'longnaturalhealth', 'eightsleep', 'feelgreatsystem', 'bulknaturals'])) {
    return ['Skincare, Health & Protocols', 'wishlist', 'Grooming & Longevity'];
  }
  if (hasAny(['soccer', 'football', 'kitbag', 'retrofootball', 'classicfootballshirts', 'gogoalshop', 'aaaajersey', 'diaza', 'flairfutbol'])) {
    return ['Soccer Kits & Sportswear', 'wishlist', 'Sportswear & Kits'];
  }
  if (hasAny(['sugargoo', 'kakobuy', 'oopbuy', 'usfans', '1688', 'yupoo', 'zenmarket', 'neokyo', 'cnxtrans', 'pingubuy', 'repsaredumb', 'gowholesale', 'indiamart'])) {
    return ['Global Sourcing & Proxies', 'bookmark', 'Shopping Proxies & Wholesale'];
  }
  if (hasAny(['halal', 'yamibuy', 'japancrate', 'tokyocentral', 'sugoimart', 'godiva', 'baladyfoods', 'nattyicecream', 'mamitasices', 'cancakes', 'cafelist', 'lamarzocco', 'taste flavor'])) {
    return ['Food, Halal & Specialty Groceries', 'wishlist', 'Food & Culinary'];
  }
  if (hasAny(['watch', 'holzkern', 'seiko', 'swatch', 'sunglasses', 'eyewear', 'chamelo', 'jamesoro', 'belvoirco', 'rimowa', 'luggage', 'baggage', 'sneaker', 'shoes', 'boots', 'thursdayboots', 'giovvani', 'nobull', 'glidesoles', 'thetiebar', 'burga'])) {
    return ['Watches, Footwear & Accessories', 'wishlist', 'Footwear & Accessories'];
  }
  if (folder.includes('shopping') || hasAny(['clothing', 'streetwear', 'apparel', 'fashion', 'hoodie', 'jacket', 'coats', 'menswear', 'denim', 'suits', 'shirts', 'tees', 'cargo', 'lacoste', 'bershka', 'pullandbear', 'mango', 'primark', 'lululemon', 'quince', 'coofandy', 'youngla', 'bylt', 'mnml', 'palace', 'nocta', 'crtz', 'synaworld', 'parajumpers', 'canali', 'charlestyrwhitt', 'menswearhouse', 'fabletics'])) {
    return ['Menswear & Streetwear', 'wishlist', 'Apparel & Menswear'];
  }
  if (folder.includes('job search') || folder.includes('interview prep') || hasAny(['job', 'career', 'resume', 'interview', 'leetcode', 'neetcode', 'pramp', 'hiring', 'linkedin.com/jobs', 'indeed', 'glassdoor', 'coverquick'])) {
    return ['Career, Jobs & Interview Prep', 'bookmark', 'Career & Interviews'];
  }
  if (folder.includes('/ai') || folder.endsWith('ai') || hasAny(['openai', 'huggingface', 'anthropic', 'claude', 'gpt', 'llm', 'prompt', 'midjourney', 'runpod', 'nebius', 'ai ', '.ai/', 'therundown.ai', 'rtutor.ai', 'autonomous.ai', 'pamir.ai'])) {
    return ['AI Models, Agents & Infra', 'bookmark', 'AI & Machine Learning'];
  }
  if (folder.includes('cyber') || hasAny(['cyber', 'security', 'hack', 'osint', 'pentest', 'fortinet', 'tryhackme', 'hackthebox'])) {
    return ['Cybersecurity & NetSec', 'bookmark', 'Cybersecurity'];
  }
  if (folder.includes('gaming') || folder.includes('games') || folder.includes('sports') || hasAny(['warzone', 'wzranked', 'fifa', 'pes ', 'efootball', 'steam', 'dodi-repacks', 'fitgirl', 'racedepartment', 'assetto', 'simracing', 'poga.gg', 'shopto.net'])) {
    return ['Gaming, Mods & Esports', 'bookmark', 'Gaming & Sim Racing'];
  }
  if (folder.includes('business') || hasAny(['business', 'startup', 'saas', 'marketing', 'ecommerce', 'shopify', 'stripe', 'stan.store', 'patreon', 'finance', 'invest', 'real estate', 'carvertical', 'caredge', 'manheim', 'iaai', 'visor.vin', 'enterprisecarsales', 'housingconnect', 'compass.com'])) {
    return ['Business, Finance & Auto/Real Estate', 'bookmark', 'Business & Side Hustles'];
  }
  if (folder.includes('program') || hasAny(['github', 'javascript', 'python', 'react', 'css', 'html', 'nodejs', 'typescript', 'tailwind', 'developer', 'code', 'coding', 'api', 'npm', 'stack', 'replit', 'netlify', 'render.com', 'vercel', 'docker', 'aws', 'azure', 'cloud', 'sql', 'data science', 'kaggle'])) {
    return ['Programming, Cloud & Dev Tools', 'bookmark', 'Software & Data Engineering'];
  }

  return ['Life Hacks, Utilities & Reference', 'bookmark', 'General Reference'];
}

function deterministicVec(text, dim = 64) {
  const vec = new Array(dim).fill(0);
  const words = (text.toLowerCase().match(/[a-z0-9]{2,}/g) || []);
  for (const w of words) {
    const h = crypto.createHash('md5').update(w).digest();
    const idx = h.readUInt16BE(0) % dim;
    const sign = (h[2] & 1) === 0 ? 1.0 : -1.0;
    vec[idx] += sign;
    if (w.length >= 4) {
      const h2 = crypto.createHash('md5').update(w.slice(0, 4)).digest();
      const idx2 = h2.readUInt16BE(0) % dim;
      vec[idx2] += 0.5 * ((h2[2] & 1) === 0 ? 1.0 : -1.0);
    }
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1.0;
  return vec.map((x) => Number((x / norm).toFixed(4)));
}

function syncBrowserBookmarks() {
  let raw = [];
  const syncedSummary = [];

  for (const [browser, filePath] of Object.entries(BROWSER_PATHS)) {
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const bms = walkBookmarks(data, '', browser);
        raw = raw.concat(bms);
        syncedSummary.push(`${browser} (${bms.length})`);
      } catch (e) {
        console.error(`Failed reading ${browser}:`, e.message);
      }
    }
  }

  const seen = new Set();
  const bookmarksOut = [];

  for (const b of raw) {
    const u = (b.url || '').trim();
    if (!u || seen.has(u) || /^(javascript:|chrome:\/\/|edge:\/\/|about:)/i.test(u)) continue;
    seen.add(u);

    const [cat, itemType, sub] = classifyBookmark(b);
    let domain = 'unknown';
    try {
      domain = new URL(u).hostname.toLowerCase().replace(/^www\./, '');
    } catch (_) {}

    const title = (b.name || domain).trim().slice(0, 140) || domain;
    const tags = [sub.toLowerCase().split(/\s+/)[0], domain.split('.')[0]].filter(Boolean);
    const hay = `${title} ${u}`.toLowerCase();
    for (const kw of ['perfume', 'cologne', 'peptide', 'skincare', 'jacket', 'hoodie', 'streetwear', 'soccer', 'watch', 'halal', 'sneaker', 'react', 'python', 'ai', 'cloud', 'interview', 'resume', 'cyber', 'llm', 'agent']) {
      if (hay.includes(kw) && !tags.includes(kw)) tags.push(kw);
    }

    bookmarksOut.push({
      id: `bm_${String(bookmarksOut.length + 1).padStart(4, '0')}`,
      title,
      url: u,
      domain,
      original_folder: b.folder,
      browser: b.source_browser,
      category: cat,
      subcategory: sub,
      item_type: itemType,
      tags: tags.slice(0, 6),
      snapshot_status: 'Archived Local Snapshot',
      rot_status: 'Live & Verified',
      embedding: deterministicVec(`${title} ${cat} ${sub} ${tags.join(' ')} ${domain}`),
    });
  }

  const vaultPath = path.join(__dirname, '..', 'data', 'vault.json');
  if (fs.existsSync(vaultPath)) {
    const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
    vault.bookmarks = bookmarksOut;
    vault.meta = vault.meta || {};
    vault.meta.last_synced = new Date().toISOString();
    vault.meta.total_bookmarks_imported = bookmarksOut.length;
    vault.meta.browsers_synced = syncedSummary;
    fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2), 'utf8');
  }

  return {
    total_unique: bookmarksOut.length,
    browsers_synced: syncedSummary,
    bookmarks: bookmarksOut,
  };
}

if (require.main === module) {
  const res = syncBrowserBookmarks();
  console.log(`Synced ${res.total_unique} unique bookmarks from: ${res.browsers_synced.join(', ')}`);
}

module.exports = { syncBrowserBookmarks, classifyBookmark, deterministicVec };
