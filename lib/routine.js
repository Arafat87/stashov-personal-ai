/**
 * Stashov — pasted-routine parser.
 *
 * Turns a TikTok/YouTube caption, a product list, or a hand-written routine
 * into the same protocol shape the Rules tab already renders. This is
 * deliberately deterministic: no API key is required, and the output stays
 * editable before it is saved.
 */

const CATEGORY_RULES = [
  { category: 'Fragrances & Cologne', re: /(fragrance|perfume|cologne|eau de|edp|oud|scent|deodorant)/i },
  { category: 'Skincare, Health & Protocols', re: /(skincare|skin care|cleanser|serum|retinol|retinoid|adapalene|niacinamide|azelaic|spf|sunscreen|moisturi[sz]er|exfoliat|toner|acne|dark spot|peptide|collagen|lactoferrin|supplement|vitamin|creatine|sleep|workout|gym|diet)/i },
  { category: 'Programming, Cloud & Dev Tools', re: /(code|coding|programming|javascript|typescript|python|react|git|docker|kubernetes|sql|api)/i },
  { category: 'Business, Finance & Auto/Real Estate', re: /(invest|investing|budget|finance|business|marketing|sales|startup)/i },
];

const PHASE_HEADER = /^(am|a\.m\.|morning|day|daytime|pm|p\.m\.|evening|night|nighttime)(\s+(routine|steps?|care))?\s*:?\s*$/i;
const PHASE_INLINE = /^(am|a\.m\.|morning|day|daytime|pm|p\.m\.|evening|night|nighttime)\s*[:\-–—]\s*/i;
const STEP_PREFIX = /^\s*(?:[-*•·]+\s*|\d{1,2}[.)]\s*|step\s*\d+\s*[:\-–—]\s*)/i;
const HEADING = /^(routine|my routine|morning routine|evening routine|night routine|skincare routine|products?|ingredients?|steps?|how to|what i use)\s*:?\s*$/i;
const BULLET_SPLIT = /\s*(?:[;•·]|\s[-–—]\s|\s*\|\s*)\s*/;

function cleanLine(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'“”]+|[\s"'“”]+$/g, '')
    .trim();
}

function inferCategory(text) {
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(text)) return rule.category;
  }
  return 'Skincare, Health & Protocols';
}

function inferTitle(lines, category) {
  const first = cleanLine(lines[0] || '');
  if (!first) return 'Pasted Routine';
  const explicit = first.match(/^(?:title|routine|name)\s*[:\-–—]\s*(.+)$/i);
  if (explicit && explicit[1].trim()) return explicit[1].trim().slice(0, 110);
  const looksLikeHeading = first.length <= 80
    && !STEP_PREFIX.test(first)
    && !PHASE_HEADER.test(first)
    && !/^(am|pm|step)\b/i.test(first)
    && (first.split(/\s+/).length <= 12 || /routine|protocol|stack|plan|guide/i.test(first));
  if (looksLikeHeading) return first.replace(/[.:]+$/g, '').slice(0, 110);
  return `Pasted ${category.split(',')[0]} Routine`;
}

function inferSchedule(steps) {
  const text = steps.join(' ').toLowerCase();
  const hasAm = /\b(am|morning|daytime)\b/.test(text);
  const hasPm = /\b(pm|evening|night|nighttime)\b/.test(text);
  if (hasAm && hasPm) return 'Daily — AM & PM';
  if (hasAm) return 'Daily — Morning';
  if (hasPm) return 'Daily — Evening';
  return 'As needed';
}

function splitIntoCandidateLines(raw) {
  let lines = String(raw || '').split(/\n+/).map(cleanLine).filter(Boolean);
  if (lines.length === 1) {
    const single = lines[0];
    if (single.length > 180) {
      lines = single.split(BULLET_SPLIT).map(cleanLine).filter(Boolean);
      if (lines.length === 1) lines = single.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(cleanLine).filter(Boolean);
    }
  }
  return lines.slice(0, 80);
}

function structureSteps(raw, title) {
  const lines = splitIntoCandidateLines(raw);
  const steps = [];
  let phase = '';
  let skippedTitle = false;

  for (const original of lines) {
    let line = cleanLine(original);
    if (!line) continue;
    if (HEADING.test(line)) continue;

    if (PHASE_HEADER.test(line)) {
      phase = /^(pm|p\.m\.|evening|night|nighttime)/i.test(line) ? 'PM' : 'AM';
      continue;
    }

    const inline = line.match(PHASE_INLINE);
    if (inline) {
      phase = /^(pm|p\.m\.|evening|night|nighttime)/i.test(inline[1]) ? 'PM' : 'AM';
      line = line.replace(PHASE_INLINE, '').trim();
      if (!line) continue;
    }

    line = line.replace(STEP_PREFIX, '').trim();
    if (!line) continue;

    // The first line is often the routine name; it is used as the title.
    if (title && steps.length === 0 && line.toLowerCase() === cleanLine(title).toLowerCase()) {
      skippedTitle = true;
      continue;
    }
    if (!skippedTitle && steps.length === 0 && line.length <= 90 && /routine|protocol|stack|plan/i.test(line) && !/\d/.test(line)) {
      skippedTitle = true;
      continue;
    }
    skippedTitle = true;

    const isNote = /^(also|note|tip|weekly|optional|avoid|do not|don't|remember)\b/i.test(line);
    const withPhase = phase && !isNote && !/^(am|pm)\b/i.test(line) ? `${phase} — ${line}` : line;
    steps.push(withPhase.slice(0, 300));
    if (steps.length >= 40) break;
  }

  if (!steps.length) {
    const fallback = cleanLine(raw).split(/(?<=[.!?])\s+/).map(cleanLine).filter(Boolean);
    for (const line of fallback.slice(0, 20)) steps.push(line.slice(0, 300));
  }
  return steps;
}

function detectConflicts(text) {
  const conflicts = [];
  const lower = text.toLowerCase();
  const hasRetinoid = /(retinoid|retinol|adapalene|tretinoin|differin)/.test(lower);
  const hasAcid = /(aha|bha|glycolic|salicylic|salicyclic|lactic acid|mandelic|exfoliat|peel)/.test(lower);

  if (hasRetinoid && hasAcid) {
    conflicts.push('ACTIVE GUARDRAIL — A retinoid and exfoliating acids appear in the same paste. Keep them in separate AM/PM windows or alternate nights to protect the skin barrier.');
  }
  if (/(caffeine|coffee|espresso|pre-workout|energy drink)/.test(lower)
    && /(after\s*2|2\s*pm|14:00|afternoon|evening|late)/.test(lower)) {
    conflicts.push('CAFFEINE CUTOFF — Caffeine is scheduled after 2:00 PM. Move it earlier to protect deep sleep.');
  }
  if (/(fragrance|perfume|cologne|eau de)/.test(lower) && /(sun|heat|summer|gym)/.test(lower)) {
    conflicts.push('FRAGRANCE NOTE — Citrus/fresh fragrances fade faster in heat. Apply to pulse points and reapply lightly instead of over-spraying.');
  }
  if (/(peptide|supplement|powder|capsule)/.test(lower) && !/(coa|certificate of analysis|third-party|third party|janoshik)/.test(lower)) {
    conflicts.push('SUPPLY CHECK — No third-party COA is mentioned. Verify the batch before adding a research peptide or supplement.');
  }
  return conflicts.length
    ? conflicts.join(' ')
    : 'No known conflicts with your active constraints. Patch-test new products and verify ingredient lists before layering.';
}

const WISHLIST_STOPWORDS = new Set([
  'barrier', 'support', 'system', 'company', 'collection', 'sports', 'sportswear',
  'performing', 'perfect', 'daily', 'premium', 'organic', 'natural', 'women',
  'womens', 'mens', 'cream', 'serum', 'cleanser', 'moisturizer', 'deodorant',
  'fragrance', 'perfume', 'cologne', 'parfum', 'boots', 'coat', 'jacket',
  'sweater', 'watch', 'stand', 'mattress', 'jersey', 'bottle', 'correcting',
  'handcrafted', 'invisible', 'cooling', 'healthy', 'immune', 'heavy', 'vintage',
]);

function matchWishlistIds(text, wishlist) {
  const lower = ` ${String(text || '').toLowerCase()} `;
  const ids = [];
  for (const wish of wishlist || []) {
    if (!wish || !wish.id) continue;
    const brandTokens = String(wish.brand || '')
      .split(/\s+/)
      .map((token) => cleanLine(token).toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter((token) => token.length >= 4);
    const titleTokens = String(wish.title || '')
      .split(/\s+/)
      .map((token) => cleanLine(token).toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter((token) => token.length >= 7 && !WISHLIST_STOPWORDS.has(token));
    const unique = [...new Set([...brandTokens, ...titleTokens])];
    if (unique.some((token) => lower.includes(` ${token} `))) {
      ids.push(wish.id);
      if (ids.length >= 5) break;
    }
  }
  return ids;
}

function parseRoutine(text, options = {}) {
  const raw = String(text || '').replace(/\r/g, '').trim();
  if (!raw) throw new Error('Paste a routine or product list first.');
  if (raw.length > 12000) throw new Error('That paste is too long. Keep it under 12,000 characters.');

  const lines = splitIntoCandidateLines(raw);
  const category = inferCategory(raw);
  const title = inferTitle(lines, category);
  const steps = structureSteps(raw, title);
  if (!steps.length) throw new Error('I could not find any steps in that paste. Add one step per line or separate steps with semicolons.');

  return {
    title,
    category,
    schedule: inferSchedule(steps),
    steps,
    conflict_alert: detectConflicts(raw),
    credibility_badge: 'User-pasted — verify before use',
    source_platform: 'Pasted routine (TikTok / YouTube / social)',
    snapshot_status: 'Pasted text — source not archived',
    linked_wishlist_ids: matchWishlistIds(raw, options.wishlist || []),
    source_text: raw.slice(0, 6000),
  };
}

module.exports = {
  parseRoutine,
  detectConflicts,
  matchWishlistIds,
};
