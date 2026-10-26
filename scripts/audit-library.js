/**
 * Stashov — Reference Library audit.
 *
 * Visits each bookmark that belongs in the reference library, extracts the
 * page title/description, records HTTP health, and applies the result to the
 * vault. Only confirmed-dead links (404/410/DNS/refused) are removed; bot
 * blocks, rate limits, and timeouts stay visible as "needs review".
 *
 * Usage:
 *   node scripts/audit-library.js --limit 20
 *   node scripts/audit-library.js --section education
 *   node scripts/audit-library.js --dry-run
 *   node scripts/audit-library.js
 */

const fs = require('fs');
const { readyVault, readVault, writeVault } = require('../lib/state');
const { librarySectionFor, sectionById, librarySectionsWithCounts } = require('../lib/library');
const { LIBRARY_AUDIT_PATH } = require('../lib/data-paths');

const USER_AGENT = 'StashovLibraryAudit/1.0 (personal reference vault; local)';
const MAX_BODY_BYTES = 360 * 1024;
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_CONCURRENCY = 16;
const DEAD_ERRORS = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
]);
const BAD_DESCRIPTION = /^(home|homepage|welcome|untitled|index|access denied|forbidden|just a moment|attention required|enable javascript|please enable javascript|404|not found|page not found|error)$/i;

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', copy: '©', reg: '®', trade: '™',
  middot: '·', bull: '•', eacute: 'é', egrave: 'è', agrave: 'à',
  ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä', ntilde: 'ñ',
};

function argvNumber(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function argvString(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  return String(process.argv[index + 1] || fallback);
}

function decodeEntities(value) {
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1] && entity[1].toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] || match;
  });
}

function cleanText(value) {
  return decodeEntities(value)
    .replace(/\s+/g, ' ')
    .replace(/^[\s|·•\-–—]+|[\s|·•\-–—]+$/g, '')
    .trim();
}

function stripHtml(value) {
  return cleanText(
    String(value || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function metaMap(html) {
  const map = {};
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const name = tag.match(/(?:name|property|itemprop)=["']([^"']+)["']/i);
    const content = tag.match(/content=["']([^"']*)["']/i);
    if (name && content) {
      const key = name[1].toLowerCase();
      if (!map[key]) map[key] = cleanText(content[1]);
    }
  }
  return map;
}

function truncate(value, max = 260) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.65 ? cut.slice(0, space) : cut).replace(/[,.;:!?\-–—\s]+$/g, '')}…`;
}

function usableDescription(value, title) {
  const text = cleanText(value);
  if (!text || text.length < 36) return false;
  if (BAD_DESCRIPTION.test(text)) return false;
  if (title && text.toLowerCase() === cleanText(title).toLowerCase()) return false;
  if (/^(we use cookies|cookie policy|this site uses cookies)/i.test(text)) return false;
  return true;
}

function pageFacts(html, domain, section) {
  const title = stripHtml((String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const meta = metaMap(html);
  const heading = stripHtml((String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const paragraph = stripHtml((String(html || '').match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '');

  const candidates = [
    [meta.description, 'meta'],
    [meta['og:description'], 'og'],
    [meta['twitter:description'], 'twitter'],
    [paragraph, 'paragraph'],
    [heading, 'heading'],
  ];

  let description = '';
  let source = '';
  for (const [candidate, label] of candidates) {
    if (usableDescription(candidate, title)) {
      description = truncate(candidate);
      source = label;
      break;
    }
  }

  if (!description) {
    description = truncate(
      `${title || domain} — a ${section.label.toLowerCase()} resource. ${section.description}`,
      280
    );
    source = 'fallback';
  }

  return {
    title: truncate(title || domain, 180),
    description,
    description_source: source,
  };
}

function statusFromResponse(response) {
  if (response.error) {
    const error = response.error;
    if (error === 'timeout') return { site_status: 'timeout', reason: 'timed out' };
    if (DEAD_ERRORS.has(error)) return { site_status: 'dead', reason: error };
    return { site_status: 'error', reason: error };
  }
  if (response.status >= 200 && response.status < 300) return { site_status: 'ok', reason: '' };
  if (response.status === 404 || response.status === 410) return { site_status: 'dead', reason: `HTTP ${response.status}` };
  if ([401, 403, 429, 451].includes(response.status)) return { site_status: 'blocked', reason: `HTTP ${response.status}` };
  return { site_status: 'error', reason: `HTTP ${response.status}` };
}

async function fetchPage(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.6',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    const contentType = response.headers.get('content-type') || '';
    let html = '';
    if (response.status >= 200 && response.status < 300 && /text\/html|application\/xhtml/i.test(contentType)) {
      const reader = response.body && response.body.getReader ? response.body.getReader() : null;
      if (reader) {
        const chunks = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          chunks.push(Buffer.from(value));
          size += value.length;
          if (size >= MAX_BODY_BYTES) {
            try { await reader.cancel(); } catch (_) {}
            break;
          }
        }
        html = Buffer.concat(chunks).toString('utf8');
      } else {
        html = await response.text();
      }
    } else {
      try { await response.body?.cancel(); } catch (_) {}
    }
    return {
      status: response.status,
      finalUrl: response.url || url,
      html,
      contentType,
      error: '',
    };
  } catch (err) {
    const code = err?.cause?.code || err?.code || (err?.name === 'AbortError' ? 'timeout' : 'network');
    return { status: 0, finalUrl: url, html: '', contentType: '', error: code };
  } finally {
    clearTimeout(timer);
  }
}

async function checkBookmark(bookmark, sectionId, timeoutMs) {
  const section = sectionById(sectionId);
  const response = await fetchPage(bookmark.url, timeoutMs);
  const health = statusFromResponse(response);
  const facts = response.status >= 200 && response.status < 300
    ? pageFacts(response.html, bookmark.domain || '', section)
    : { title: bookmark.title, description: '', description_source: '' };

  const existingManual = bookmark.description_source === 'manual' && bookmark.description;
  return {
    id: bookmark.id,
    title: bookmark.title,
    domain: bookmark.domain,
    category: bookmark.category,
    library_section: sectionId,
    library_label: section.label,
    description: existingManual ? bookmark.description : facts.description,
    use_for: bookmark.use_for || section.use_for,
    description_source: existingManual ? 'manual' : facts.description_source,
    page_title: facts.title,
    site_status: health.site_status,
    http_status: response.status,
    final_url: response.finalUrl,
    last_checked: new Date().toISOString(),
    error: health.reason,
  };
}

async function runPool(items, worker, concurrency) {
  const output = new Array(items.length);
  let next = 0;
  let completed = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      try {
        output[index] = await worker(items[index], index);
      } catch (err) {
        output[index] = {
          id: items[index].id,
          title: items[index].title,
          domain: items[index].domain,
          category: items[index].category,
          library_section: items[index].section,
          description: '',
          use_for: '',
          description_source: '',
          site_status: 'error',
          http_status: 0,
          final_url: items[index].url,
          last_checked: new Date().toISOString(),
          error: err?.message || 'audit failed',
        };
      }
      completed += 1;
      if (completed % 25 === 0 || completed === items.length) {
        console.log(`[audit] ${completed}/${items.length}`);
      }
    }
  });
  await Promise.all(workers);
  return output;
}

function summarize(results) {
  const totals = { ok: 0, blocked: 0, timeout: 0, error: 0, dead: 0 };
  for (const result of results) totals[result.site_status] = (totals[result.site_status] || 0) + 1;
  return totals;
}

async function main() {
  const limit = argvNumber('limit', 0);
  const sectionFilter = argvString('section', '');
  const concurrency = argvNumber('concurrency', DEFAULT_CONCURRENCY);
  const timeoutMs = argvNumber('timeout', DEFAULT_TIMEOUT_MS);
  const dryRun = process.argv.includes('--dry-run');

  await readyVault();
  const vault = readVault();
  const bookmarks = vault.bookmarks || [];
  const sectionCounts = librarySectionsWithCounts(bookmarks);

  let candidates = bookmarks
    .map((bookmark) => ({ ...bookmark, section: librarySectionFor(bookmark) }))
    .filter((bookmark) => bookmark.section);

  if (sectionFilter) candidates = candidates.filter((bookmark) => bookmark.section === sectionFilter);
  if (limit) candidates = candidates.slice(0, limit);

  console.log(`[audit] ${candidates.length} reference links queued (${sectionCounts.reduce((sum, section) => sum + section.count, 0)} total library).`);
  console.log(`[audit] concurrency=${concurrency} timeout=${timeoutMs}ms${dryRun ? ' dry-run' : ''}`);

  const results = await runPool(candidates, (bookmark) => checkBookmark(bookmark, bookmark.section, timeoutMs), concurrency);
  const totals = summarize(results);
  const dead = results.filter((result) => result.site_status === 'dead');
  const checkedById = new Map(results.map((result) => [result.id, result]));

  if (!dryRun) {
    for (const bookmark of bookmarks) {
      const result = checkedById.get(bookmark.id);
      if (!result) continue;
      bookmark.library_section = result.library_section;
      bookmark.description = result.description;
      bookmark.use_for = result.use_for;
      bookmark.description_source = result.description_source;
      bookmark.site_status = result.site_status;
      bookmark.http_status = result.http_status;
      bookmark.last_checked = result.last_checked;
      bookmark.final_url = result.final_url;
    }

    const deadIds = new Set(dead.map((result) => result.id));
    const removed = bookmarks
      .filter((bookmark) => deadIds.has(bookmark.id))
      .map((bookmark) => ({
        ...bookmark,
        removed_at: new Date().toISOString(),
        removal_reason: 'confirmed dead during library audit',
      }));

    vault.bookmarks = bookmarks.filter((bookmark) => !deadIds.has(bookmark.id));
    vault.meta = vault.meta || {};
    vault.meta.total_bookmarks_imported = vault.bookmarks.length;
    vault.meta.library_audit = {
      run_at: new Date().toISOString(),
      total_checked: results.length,
      live: totals.ok || 0,
      blocked: totals.blocked || 0,
      timeouts: totals.timeout || 0,
      errors: totals.error || 0,
      removed: removed.length,
      sections: librarySectionsWithCounts(vault.bookmarks).map((section) => ({
        id: section.id,
        label: section.label,
        count: section.count,
      })),
    };
    await writeVault(vault);

    const report = {
      run_at: vault.meta.library_audit.run_at,
      dry_run: false,
      totals,
      sections: vault.meta.library_audit.sections,
      removed,
      results,
    };
    fs.writeFileSync(LIBRARY_AUDIT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[audit] complete: ${totals.ok} live, ${totals.blocked} blocked, ${totals.timeout} timed out, ${totals.error} errors, ${dead.length} removed.`);
    if (dead.length) console.log(`[audit] removed: ${dead.slice(0, 12).map((item) => item.domain || item.title).join(', ')}${dead.length > 12 ? '…' : ''}`);
    console.log(`[audit] report: ${LIBRARY_AUDIT_PATH}`);
  } else {
    const report = {
      run_at: new Date().toISOString(),
      dry_run: true,
      totals,
      sections: sectionCounts,
      removed: dead,
      results,
    };
    fs.writeFileSync(LIBRARY_AUDIT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[audit] dry-run complete: ${totals.ok} live, ${totals.blocked} blocked, ${totals.timeout} timed out, ${totals.error} errors, ${dead.length} confirmed dead.`);
    console.log(`[audit] report: ${LIBRARY_AUDIT_PATH}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[audit] failed:', err);
    process.exitCode = 1;
  });
}

module.exports = { fetchPage, pageFacts, statusFromResponse, checkBookmark };
