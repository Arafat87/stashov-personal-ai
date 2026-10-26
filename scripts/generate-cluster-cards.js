/**
 * Stashov — generate one reference card per cluster.
 *
 * These are deliberately local SVG assets, not remote stock photos: they load
 * instantly, match the app's dark instrument-panel language, and remain legible
 * at the small cluster-card size. Each card has a stable accent colour and a
 * cluster-specific diagram so the board reads as fourteen distinct places.
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'cluster-cards');
const WIDTH = 800;
const HEIGHT = 600;

const CLUSTERS = [
  {
    index: 1,
    name: 'Programming, Cloud & Dev Tools',
    slug: 'programming-cloud',
    color: '#c6ff4a',
    motif: 'code',
  },
  {
    index: 2,
    name: 'Life Hacks, Utilities & Reference',
    slug: 'life-hacks',
    color: '#63e6ff',
    motif: 'tiles',
  },
  {
    index: 3,
    name: 'AI Models, Agents & Infra',
    slug: 'ai-models',
    color: '#a98bff',
    motif: 'network',
  },
  {
    index: 4,
    name: 'Career, Jobs & Interview Prep',
    slug: 'career',
    color: '#ffc35c',
    motif: 'steps',
  },
  {
    index: 5,
    name: 'Menswear & Streetwear',
    slug: 'menswear',
    color: '#52f2ab',
    motif: 'hanger',
  },
  {
    index: 6,
    name: 'Business, Finance & Auto/Real Estate',
    slug: 'business',
    color: '#ff6b8a',
    motif: 'chart',
  },
  {
    index: 7,
    name: 'Watches, Footwear & Accessories',
    slug: 'watches',
    color: '#8ab4ff',
    motif: 'watch',
  },
  {
    index: 8,
    name: 'Gaming, Mods & Esports',
    slug: 'gaming',
    color: '#c6ff4a',
    motif: 'gamepad',
  },
  {
    index: 9,
    name: 'Soccer Kits & Sportswear',
    slug: 'soccer',
    color: '#63e6ff',
    motif: 'pitch',
  },
  {
    index: 10,
    name: 'Skincare, Health & Protocols',
    slug: 'skincare',
    color: '#a98bff',
    motif: 'dropper',
  },
  {
    index: 11,
    name: 'Global Sourcing & Proxies',
    slug: 'sourcing',
    color: '#ffc35c',
    motif: 'globe',
  },
  {
    index: 12,
    name: 'Fragrances & Cologne',
    slug: 'fragrances',
    color: '#52f2ab',
    motif: 'bottle',
  },
  {
    index: 13,
    name: 'Cybersecurity & NetSec',
    slug: 'cybersecurity',
    color: '#ff6b8a',
    motif: 'shield',
  },
  {
    index: 14,
    name: 'Food, Halal & Specialty Groceries',
    slug: 'food',
    color: '#8ab4ff',
    motif: 'plate',
  },
];

function escapeXml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[char]));
}

function wrapName(name, max = 27) {
  const words = String(name || '').split(/\s+/).filter(Boolean);
  const lines = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (!last || `${last} ${word}`.length > max) lines.push(word);
    else lines[lines.length - 1] = `${last} ${word}`;
  }
  return lines;
}

function motifSvg(motif, color) {
  const stroke = color;
  const dim = '#2b3540';
  switch (motif) {
    case 'code':
      return `
        <path d="M66 52 20 120l46 68M174 52l46 68-46 68M146 38l-52 164" fill="none" stroke="${stroke}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="20" cy="120" r="5" fill="${stroke}"/>
        <circle cx="220" cy="120" r="5" fill="${stroke}"/>`;
    case 'tiles':
      return `
        <rect x="20" y="20" width="90" height="90" rx="18" fill="none" stroke="${dim}" stroke-width="2"/>
        <rect x="130" y="20" width="90" height="90" rx="18" fill="none" stroke="${stroke}" stroke-width="2"/>
        <rect x="20" y="130" width="90" height="90" rx="18" fill="none" stroke="${stroke}" stroke-width="2"/>
        <rect x="130" y="130" width="90" height="90" rx="18" fill="${stroke}" fill-opacity="0.12" stroke="${stroke}" stroke-width="2"/>
        <path d="M162 175h26M175 162v26" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/>`;
    case 'network':
      return `
        <path d="M120 50 44 96M120 50l76 46M44 96l28 86M196 96l-28 86M72 182l48 28M148 182l-48 28M120 50v160" fill="none" stroke="${dim}" stroke-width="2"/>
        <circle cx="120" cy="50" r="13" fill="${stroke}" fill-opacity="0.18" stroke="${stroke}" stroke-width="3"/>
        <circle cx="44" cy="96" r="10" fill="none" stroke="${stroke}" stroke-width="3"/>
        <circle cx="196" cy="96" r="10" fill="none" stroke="${stroke}" stroke-width="3"/>
        <circle cx="72" cy="182" r="9" fill="none" stroke="${stroke}" stroke-width="3"/>
        <circle cx="168" cy="182" r="9" fill="none" stroke="${stroke}" stroke-width="3"/>
        <circle cx="120" cy="120" r="5" fill="${stroke}"/>
        <circle cx="120" cy="152" r="5" fill="${stroke}"/>`;
    case 'steps':
      return `
        <rect x="26" y="184" width="42" height="32" rx="6" fill="${stroke}" fill-opacity="0.14" stroke="${stroke}" stroke-width="2"/>
        <rect x="82" y="148" width="42" height="68" rx="6" fill="${stroke}" fill-opacity="0.18" stroke="${stroke}" stroke-width="2"/>
        <rect x="138" y="108" width="42" height="108" rx="6" fill="${stroke}" fill-opacity="0.22" stroke="${stroke}" stroke-width="2"/>
        <rect x="194" y="58" width="30" height="158" rx="6" fill="${stroke}" fill-opacity="0.3" stroke="${stroke}" stroke-width="2"/>
        <path d="M42 166 91 129l56-38 74-48" fill="none" stroke="${stroke}" stroke-width="4" stroke-dasharray="7 7" stroke-linecap="round"/>
        <path d="m206 32 24 4-14 20" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'hanger':
      return `
        <path d="M120 42c0-13 9-22 22-22s22 9 22 22c0 14-11 18-22 26v14" fill="none" stroke="${stroke}" stroke-width="5" stroke-linecap="round"/>
        <path d="M120 82 28 158c-8 7-3 20 8 20h168c11 0 16-13 8-20L120 82Z" fill="none" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M72 112v42M168 112v42M72 154h96" stroke="${dim}" stroke-width="2"/>
        <path d="M32 40h44M32 52h26" stroke="${stroke}" stroke-width="3" stroke-linecap="round" opacity="0.45"/>`;
    case 'chart':
      return `
        <path d="M26 194h188" stroke="${dim}" stroke-width="2"/>
        <rect x="40" y="144" width="22" height="50" rx="4" fill="${stroke}" fill-opacity="0.14" stroke="${stroke}" stroke-width="2"/>
        <rect x="86" y="112" width="22" height="82" rx="4" fill="${stroke}" fill-opacity="0.2" stroke="${stroke}" stroke-width="2"/>
        <rect x="132" y="76" width="22" height="118" rx="4" fill="${stroke}" fill-opacity="0.26" stroke="${stroke}" stroke-width="2"/>
        <path d="M36 160 82 135l44-29 56-45" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>
        <path d="m172 55 20-3-7 19" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M176 146h34M176 158h24" stroke="${dim}" stroke-width="2"/>`;
    case 'watch':
      return `
        <circle cx="120" cy="120" r="82" fill="none" stroke="${stroke}" stroke-width="3"/>
        <circle cx="120" cy="120" r="66" fill="none" stroke="${dim}" stroke-width="1.5"/>
        <path d="M120 45v12M120 183v12M45 120h12M183 120h12M67 67l9 9M173 164l9 9M173 76l-9 9M67 164l-9 9" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
        <path d="M120 120V78M120 120l30 18" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="120" cy="120" r="5" fill="${stroke}"/>
        <path d="M188 120a68 68 0 0 1-14 42" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" opacity="0.55"/>`;
    case 'gamepad':
      return `
        <path d="M52 92h136c20 0 34 17 34 38v28c0 26-21 42-45 42-19 0-27-15-38-28H76c-11 13-19 28-38 28-24 0-45-16-45-42v-28c0-21 14-38 34-38Z" transform="translate(24)" fill="${stroke}" fill-opacity="0.06" stroke="${stroke}" stroke-width="3"/>
        <path d="M82 120v36M64 138h36" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/>
        <circle cx="170" cy="126" r="7" fill="${stroke}"/>
        <circle cx="190" cy="146" r="7" fill="${stroke}"/>
        <circle cx="170" cy="166" r="7" fill="${stroke}" fill-opacity="0.4"/>`;
    case 'pitch':
      return `
        <rect x="20" y="38" width="200" height="164" rx="10" fill="none" stroke="${stroke}" stroke-width="3"/>
        <path d="M120 38v164" stroke="${stroke}" stroke-width="2" opacity="0.6"/>
        <circle cx="120" cy="120" r="36" fill="none" stroke="${stroke}" stroke-width="2"/>
        <path d="M20 78h34v84H20M200 78h-34v84h34" fill="none" stroke="${stroke}" stroke-width="2"/>
        <circle cx="120" cy="120" r="5" fill="${stroke}"/>
        <path d="M60 120h-14M194 120h-14" stroke="${stroke}" stroke-width="2"/>
        <path d="M92 54h56M92 182h56" stroke="${dim}" stroke-width="2"/>`;
    case 'dropper':
      return `
        <rect x="88" y="94" width="64" height="112" rx="18" fill="${stroke}" fill-opacity="0.1" stroke="${stroke}" stroke-width="3"/>
        <path d="M104 94V70h32v24M112 70V48h16v22" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>
        <path d="M120 114c12 14 20 25 20 36a20 20 0 0 1-40 0c0-11 8-22 20-36Z" fill="${stroke}" fill-opacity="0.24" stroke="${stroke}" stroke-width="2"/>
        <path d="M38 88c20 0 34 14 34 34M202 88c-20 0-34 14-34 34M38 162c20 0 34-14 34-34M202 162c-20 0-34-14-34-34" fill="none" stroke="${dim}" stroke-width="2"/>`;
    case 'globe':
      return `
        <circle cx="120" cy="120" r="82" fill="none" stroke="${stroke}" stroke-width="3"/>
        <ellipse cx="120" cy="120" rx="38" ry="82" fill="none" stroke="${stroke}" stroke-width="2" opacity="0.65"/>
        <path d="M38 120h164M52 82h136M52 158h136" stroke="${stroke}" stroke-width="2" opacity="0.45"/>
        <path d="M62 176C88 146 112 104 152 86c16-7 32-9 44-7" fill="none" stroke="${stroke}" stroke-width="3" stroke-dasharray="6 7" stroke-linecap="round"/>
        <circle cx="158" cy="84" r="6" fill="${stroke}"/>
        <circle cx="84" cy="150" r="4" fill="${stroke}"/>`;
    case 'bottle':
      return `
        <path d="M90 92h60v-18H90zM104 74V46h32v28" fill="none" stroke="${stroke}" stroke-width="3"/>
        <rect x="78" y="92" width="84" height="112" rx="14" fill="${stroke}" fill-opacity="0.09" stroke="${stroke}" stroke-width="3"/>
        <path d="M78 120h84" stroke="${dim}" stroke-width="2"/>
        <path d="M194 94c14 16 14 34 0 50M28 94c-14 16-14 34 0 50" fill="none" stroke="${stroke}" stroke-width="2" opacity="0.45"/>
        <path d="M202 166c12 12 12 28 0 40M20 166c-12 12-12 28 0 40" fill="none" stroke="${dim}" stroke-width="2"/>`;
    case 'shield':
      return `
        <path d="M120 24 34 60v66c0 46 34 76 86 90 52-14 86-44 86-90V60Z" fill="${stroke}" fill-opacity="0.06" stroke="${stroke}" stroke-width="3"/>
        <path d="M120 66a24 24 0 0 1 24 24c0 14-8 23-18 28v22h-12v-22c-10-5-18-14-18-28a24 24 0 0 1 24-24Z" fill="none" stroke="${stroke}" stroke-width="3"/>
        <path d="M120 90v10" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>
        <path d="M44 54h-18M196 54h18M44 94h-18M196 94h18" stroke="${dim}" stroke-width="2"/>`;
    case 'plate':
      return `
        <circle cx="120" cy="128" r="74" fill="none" stroke="${stroke}" stroke-width="3"/>
        <circle cx="120" cy="128" r="48" fill="none" stroke="${stroke}" stroke-width="2" opacity="0.5"/>
        <path d="M36 54v54M28 54v30a8 8 0 0 0 16 0V54M198 54v130M212 54c0 20-10 34-22 42" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
        <path d="M92 108c-8-8-8-18 0-24M120 96c-8-10-6-22 4-28M148 108c-8-8-8-18 0-24" fill="none" stroke="${stroke}" stroke-width="2" opacity="0.45"/>`;
    default:
      return '';
  }
}

function cardSvg(cluster) {
  const nameLines = wrapName(cluster.name);
  const nameSize = nameLines.length >= 3 ? 38 : 44;
  const nameY = 404;
  const accent = cluster.color;
  const name = nameLines.map((line, index) => (
    `<tspan x="48" dy="${index === 0 ? 0 : nameSize + 8}">${escapeXml(line)}</tspan>`
  )).join('');
  const motif = motifSvg(cluster.motif, accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(cluster.name)} reference card">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b151f"/>
      <stop offset="0.55" stop-color="#071019"/>
      <stop offset="1" stop-color="#04080d"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.3"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse">
      <path d="M38 0H0V38" fill="none" stroke="#ffffff" stroke-opacity="0.035"/>
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>
  <circle cx="632" cy="174" r="270" fill="url(#glow)" opacity="0.7"/>
  <circle cx="632" cy="174" r="126" fill="none" stroke="${accent}" stroke-opacity="0.12" stroke-width="1"/>
  <circle cx="632" cy="174" r="184" fill="none" stroke="${accent}" stroke-opacity="0.06" stroke-width="1"/>
  <path d="M48 74h68" stroke="${accent}" stroke-width="2"/>
  <text x="48" y="48" fill="#82919f" font-family="Consolas, 'Courier New', monospace" font-size="11" letter-spacing="3">STASHOV / PRIVATE INDEX</text>
  <text x="752" y="48" text-anchor="end" fill="${accent}" font-family="Consolas, 'Courier New', monospace" font-size="11" letter-spacing="2.5">CLUSTER ${String(cluster.index).padStart(2, '0')}</text>
  <text x="42" y="252" fill="${accent}" fill-opacity="0.13" font-family="'Segoe UI', Arial, sans-serif" font-size="176" font-weight="700" letter-spacing="-12">${String(cluster.index).padStart(2, '0')}</text>
  <g transform="translate(500 72)">${motif}</g>
  <text x="48" y="354" fill="${accent}" font-family="Consolas, 'Courier New', monospace" font-size="10" letter-spacing="3">REFERENCE CARD</text>
  <text x="48" y="${nameY}" fill="#f2f7f8" font-family="'Segoe UI', Arial, sans-serif" font-size="${nameSize}" font-weight="600" letter-spacing="-1.4">${name}</text>
  <path d="M48 552h704" stroke="#ffffff" stroke-opacity="0.08"/>
  <text x="48" y="576" fill="#6f7f8d" font-family="Consolas, 'Courier New', monospace" font-size="9" letter-spacing="2.2">14 CLUSTERS / ONE PRIVATE BRAIN</text>
  <text x="752" y="576" text-anchor="end" fill="${accent}" fill-opacity="0.72" font-family="Consolas, 'Courier New', monospace" font-size="9" letter-spacing="2.2">STASHOV.COM</text>
</svg>
`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const cluster of CLUSTERS) {
  fs.writeFileSync(path.join(OUT_DIR, `${cluster.slug}.svg`), cardSvg(cluster), 'utf8');
}
console.log(`Wrote ${CLUSTERS.length} reference cards to ${OUT_DIR}`);
