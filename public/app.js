(() => {
'use strict';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const money = (n, digits = 0) => {
  const value = Number(n || 0);
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};
const pad = (n) => String(n).padStart(2, '0');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (value) => (/^https?:\/\//i.test(String(value || '')) ? value : '#');
const safeImage = (value) => {
  const raw = String(value || '').trim();
  return /^https?:\/\//i.test(raw) || /^\/media\/images\/[a-z0-9._-]+$/i.test(raw) ? raw : '';
};
const looksLikeImage = (value) => {
  const raw = String(value || '').trim();
  return /^\/media\/images\/[a-z0-9._-]+$/i.test(raw) || /^https?:\/\/[^?#]+\.(avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(raw);
};
const shortModel = (value) => String(value || '').replace(/^.*\//, '').replace(/^Qwen\/?/i, '');
const isTyping = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

const TABS = {
  deck: 'COMMAND DECK',
  vault: 'SIGNAL INDEX',
  library: 'REFERENCE LIBRARY',
  wishlist: 'IMPULSE GATE',
  protocols: 'LIVING PLAYBOOKS',
  context: 'IDENTITY BUFFER',
  ingest: 'CAPTURE STUDIO',
  router: 'TOKEN FACTORY ROUTER'
};
const TITLES = {
  deck: 'Neural Vault Command Deck',
  vault: 'Signal Index',
  library: 'Reference Library',
  wishlist: 'Impulse Gate',
  protocols: 'Living Playbooks',
  context: 'Identity Buffer',
  ingest: 'Capture Studio',
  router: 'Router Telemetry'
};
const CLUSTER_VISUALS = {
  'Programming, Cloud & Dev Tools': { slug: 'programming-cloud', color: '#c6ff4a' },
  'Life Hacks, Utilities & Reference': { slug: 'life-hacks', color: '#63e6ff' },
  'AI Models, Agents & Infra': { slug: 'ai-models', color: '#a98bff' },
  'Career, Jobs & Interview Prep': { slug: 'career', color: '#ffc35c' },
  'Menswear & Streetwear': { slug: 'menswear', color: '#52f2ab' },
  'Business, Finance & Auto/Real Estate': { slug: 'business', color: '#ff6b8a' },
  'Watches, Footwear & Accessories': { slug: 'watches', color: '#8ab4ff' },
  'Gaming, Mods & Esports': { slug: 'gaming', color: '#c6ff4a' },
  'Soccer Kits & Sportswear': { slug: 'soccer', color: '#63e6ff' },
  'Skincare, Health & Protocols': { slug: 'skincare', color: '#a98bff' },
  'Global Sourcing & Proxies': { slug: 'sourcing', color: '#ffc35c' },
  'Fragrances & Cologne': { slug: 'fragrances', color: '#52f2ab' },
  'Cybersecurity & NetSec': { slug: 'cybersecurity', color: '#ff6b8a' },
  'Food, Halal & Specialty Groceries': { slug: 'food', color: '#8ab4ff' },
};
const SECTION_ICONS = ['i-deck', 'i-vault', 'i-book', 'i-gate', 'i-pulse', 'i-fingerprint', 'i-spark', 'i-router', 'i-search', 'i-command', 'i-coin', 'i-lock', 'i-clock', 'i-alert', 'i-code', 'i-briefcase'];
const DEFAULT_SECTIONS = [
  ['deck', 'Deck', 'i-deck', '#c6ff4a'],
  ['vault', 'Vault', 'i-vault', '#63e6ff'],
  ['library', 'Library', 'i-book', '#8ab4ff'],
  ['wishlist', 'Gate', 'i-gate', '#ffc35c'],
  ['protocols', 'Rules', 'i-pulse', '#a98bff'],
  ['context', 'You', 'i-fingerprint', '#ff6b8a'],
  ['ingest', 'Capture', 'i-spark', '#52f2ab'],
  ['router', 'Router', 'i-router', '#8ab4ff']
].map(([id, label, icon, color], order) => ({
  id, builtin: true, label, icon, logo: '', color, tags: [], description: '', visible: true, order, cards: []
}));
const rootStyles = getComputedStyle(document.documentElement);
const cssVar = (name) => rootStyles.getPropertyValue(name).trim();
const CAT_COLORS = ['--lime', '--cyan', '--violet', '--amber', '--mint', '--rose', '--blue'].map(cssVar);
const MODEL_META = {
  ultra: { tag: 'U', label: 'Deep synthesis', tone: cssVar('--lime') },
  super: { tag: 'S', label: 'Structured extraction', tone: cssVar('--cyan') },
  nano: { tag: 'N', label: 'Fast classification', tone: cssVar('--violet') },
  lightning: { tag: 'L', label: 'MTP low-latency decode', tone: cssVar('--amber') },
  vision: { tag: 'V', label: 'Vision OCR', tone: cssVar('--rose') },
  embedding: { tag: 'E', label: 'Semantic memory', tone: cssVar('--mint') }
};

const ROUTINE_PRODUCT_CAP = 12;
const ROUTINE_PRODUCTS_PAGE = 60;
const ROUTINE_WEB_LOOKUP_KEY = 'stashov.routineWebLookup';

function readRoutineWebLookupPreference() {
  try { return window.localStorage.getItem(ROUTINE_WEB_LOOKUP_KEY) !== 'off'; } catch (_) { return true; }
}

function rememberRoutineWebLookup(enabled) {
  try { window.localStorage.setItem(ROUTINE_WEB_LOOKUP_KEY, enabled ? 'on' : 'off'); } catch (_) {}
}

const state = {
  vault: null,
  tab: 'deck',
  sections: DEFAULT_SECTIONS.map((section) => ({ ...section })),
  editingSectionId: null,
  editingCardId: null,
  photoId: null,
  wishEditOriginal: null,
  category: 'ALL',
  verdict: 'ALL',
  gateFilter: 'active',
  items: [],
  total: 0,
  limit: 48,
  loadSeq: 0,
  searchTimer: null,
  bookmarkAbort: null,
  library: {
    items: [], total: 0, libraryTotal: 0, sections: [], section: 'ALL',
    q: '', status: 'ALL', limit: 36, loading: false, loaded: false,
    meta: null, seq: 0, abort: null, editingId: null, timer: null,
    selectMode: false, selected: [], duplicates: null, duplicateExtra: 0
  },
  routineLinkedIds: [],
  routineSearch: '',
  routineSelectedOnly: false,
  routineLimit: ROUTINE_PRODUCTS_PAGE,
  routineMatchCount: 0,
  routineSearchTimer: null,
  routineQueries: [],
  routineWebProducts: [],
  routineLookupRun: 0,
  routineLookupBusy: false,
  routineWebLookup: readRoutineWebLookupPreference(),
  routineGateBusy: false,
  routineKey: '',
  routineLastGateSend: [],
  routineLastGateSendKey: '',
  auditId: null,
  promotion: null,
  clusterDialog: { name: '', mode: 'product', default_mode: 'product', hero_item_id: '', cover: '' },
  firstRender: true,
  paletteIndex: 0,
  paletteFiltered: [],
  help: { loaded: false, loading: false, error: '', entries: [], q: '', category: 'ALL' }
};

async function getJSON(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { error: text.slice(0, 240) }; }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const sendJSON = (url, method, body) => getJSON(url, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body || {})
});
const postJSON = (url, body) => sendJSON(url, 'POST', body);
const putJSON = (url, body) => sendJSON(url, 'PUT', body);
const patchJSON = (url, body) => sendJSON(url, 'PATCH', body);
const deleteJSON = (url) => sendJSON(url, 'DELETE');

function toast(message, type = 'ok') {
  const host = $('#toastHost');
  if (!host) return;
  while (host.children.length > 2) host.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'err' ? ' err' : type === 'warn' ? ' warn' : '');
  el.textContent = message;
  el.tabIndex = 0;
  host.appendChild(el);
  let timer = 0;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.add('is-out');
    window.setTimeout(() => el.remove(), 320);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(dismiss, type === 'err' ? 8500 : type === 'warn' ? 7000 : 5200);
  };
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', schedule);
  el.addEventListener('focus', () => clearTimeout(timer));
  el.addEventListener('blur', schedule);
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') dismiss();
  });
  schedule();
}

function busy(btn, on, label) {
  if (!btn) return;
  if (on) {
    if (!btn.dataset.original) btn.dataset.original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${esc(label || 'Working')}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.original) {
      btn.innerHTML = btn.dataset.original;
      delete btn.dataset.original;
    }
  }
}

function sectionById(id) {
  return state.sections.find((section) => section.id === id) || null;
}
function visibleSections() {
  return state.sections.filter((section) => section.visible);
}
function sectionLabel(section) {
  return section ? section.label : 'Section';
}

function clientDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function routineStreak(dates) {
  const set = new Set(Array.isArray(dates) ? dates : []);
  const cursor = new Date();
  if (!set.has(clientDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(clientDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function routeState(hash = location.hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const [rawTab, rawQuery = ''] = raw.split('?');
  const params = new URLSearchParams(rawQuery);
  return {
    tab: sectionById(rawTab) ? rawTab : 'deck',
    params,
  };
}

function applyRoute(route) {
  const params = route.params;
  if (route.tab === 'wishlist') {
    const gate = String(params.get('gate') || 'active');
    state.gateFilter = ['active', 'ready', 'cooling', 'snoozed', 'history'].includes(gate) ? gate : 'active';
    const verdict = String(params.get('verdict') || 'ALL');
    state.verdict = ['ALL', 'good', 'warn', 'bad'].includes(verdict) ? verdict : 'ALL';
  }
  if (route.tab === 'library') {
    state.library.section = String(params.get('section') || 'ALL');
    const status = String(params.get('status') || 'ALL');
    state.library.status = ['ALL', 'ok', 'blocked', 'error', 'unchecked', 'archived'].includes(status) ? status : 'ALL';
    state.library.q = String(params.get('q') || '');
    if ($('#librarySearch')) $('#librarySearch').value = state.library.q;
    if ($('#libraryStatusFilter')) $('#libraryStatusFilter').value = state.library.status;
  }
  if (route.tab === 'vault') state.category = String(params.get('cluster') || 'ALL');
}

function syncHash() {
  const params = new URLSearchParams();
  if (state.tab === 'wishlist') {
    if (state.gateFilter !== 'active') params.set('gate', state.gateFilter);
    if (state.verdict !== 'ALL') params.set('verdict', state.verdict);
  } else if (state.tab === 'library') {
    if (state.library.section !== 'ALL') params.set('section', state.library.section);
    if (state.library.status !== 'ALL') params.set('status', state.library.status);
    if (state.library.q) params.set('q', state.library.q);
  } else if (state.tab === 'vault' && state.category !== 'ALL') {
    params.set('cluster', state.category);
  }
  const query = params.toString();
  try {
    history.replaceState(null, '', `#${state.tab}${query ? `?${query}` : ''}`);
  } catch (_) {}
}

function setTab(tab, options = {}) {
  syncCustomPanels();
  const available = visibleSections();
  const target = available.find((section) => section.id === tab) || available[0] || state.sections[0];
  if (!target) return;
  tab = target.id;
  state.tab = tab;
  $$('.rail-btn').forEach((btn) => {
    const selected = btn.dataset.tab === tab;
    btn.setAttribute('aria-selected', String(selected));
    btn.tabIndex = selected ? 0 : -1;
  });
  $$('.panel').forEach((panel) => {
    const active = panel.id === `panel-${tab}`;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
    if (active) panel.style.setProperty('--section-accent', target.color || cssVar('--lime'));
  });
  const title = $('#pageTitle');
  if (title) title.textContent = sectionLabel(target);
  document.title = `STASHOV - ${target.builtin ? (TITLES[tab] || target.label) : target.label}`;
  if (options.updateHash !== false) syncHash();
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  const panel = $(`#panel-${tab}`);
  if (panel) {
    window.setTimeout(() => $$('.reveal', panel).forEach((el) => el.classList.add('is-in')), 40);
  }
  if (tab === 'library' && !state.library.loading) {
    loadLibrary(!state.library.loaded);
  }
}

function renderMode(v) {
  const pill = $('#modePill');
  if (!pill) return;
  const live = Boolean(v && v.nebius_configured);
  pill.className = 'mode-pill' + (live ? '' : ' is-demo');
  pill.innerHTML = `<i></i> ${live ? 'NEBIUS LIVE' : 'DEMO FALLBACK'}`;
  pill.title = live
    ? 'Requests are routed to Nebius Token Factory with a live API key.'
    : 'No live NEBIUS_API_KEY detected. Deterministic fallback traces are used.';
}
function renderModeOffline() {
  const pill = $('#modePill');
  if (!pill) return;
  pill.className = 'mode-pill is-offline';
  pill.innerHTML = '<i></i> VAULT OFFLINE';
  pill.title = 'The local Stashov server is not responding. Start it with npm start.';
}

async function refreshVault(initial = false) {
  try {
    const v = await getJSON('/api/vault');
    state.vault = v;
    renderAll();
    return true;
  } catch (err) {
    renderModeOffline();
    toast(initial ? `Cannot reach the vault API. Run npm start. ${err.message}` : err.message, 'err');
    return false;
  }
}

function renderAll() {
  const v = state.vault;
  if (!v) return;
  renderMode(v);
  renderBudget(v);
  renderOverview(v);
  renderSections();
  renderCategories(v);
  renderWantedStrip(v);
  renderWishlistView(v);
  renderProtocolsView(v);
  renderContextView(v);
  renderRouterView(v);
  renderTelemetry(v);
  state.firstRender = false;
}

function budgetNumbers(v) {
  const ctx = v.personal_context || {};
  const budget = v.budget || {};
  const rawCap = budget.cap ?? ctx.monthly_discretionary_budget;
  const cap = rawCap === undefined || rawCap === null || rawCap === '' ? 300 : Math.max(0, Number(rawCap) || 0);
  const spent = Number(budget.spent ?? ctx.spent_this_month) || 0;
  const remaining = budget.remaining !== undefined && budget.remaining !== null ? Number(budget.remaining) : cap - spent;
  return { cap, spent, remaining, budget };
}
function totalMarkup(v) {
  return (v.wishlist || []).reduce((sum, w) => sum + Math.max(0, (Number(w.retail_price) || 0) - (Number(w.lowest_verified_price) || 0)), 0);
}
function verdictTone(verdict) {
  if (verdict === 'BUY_RECOMMENDED' || verdict === 'BUY_AT_DISCOUNTER') return 'good';
  if (verdict === 'SKIP_DUPLICATE') return 'bad';
  return 'warn';
}
function validStamp(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'RECENT';
  return d.toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase();
}
function clockTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

function setCounter(el, value, formatter) {
  if (!el) return;
  const target = Number(value) || 0;
  if (!state.firstRender || reduceMotion.matches) {
    el.textContent = formatter(target);
    return;
  }
  const start = performance.now();
  const duration = 900;
  const step = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = formatter(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderBudget(v) {
  const { cap, spent, remaining, budget } = budgetNumbers(v);
  const top = $('#topBudget');
  if (top) top.textContent = money(remaining);
  const ovRemaining = $('#ovRemaining');
  if (ovRemaining) ovRemaining.textContent = money(remaining);
  const ovSpent = $('#ovSpent');
  if (ovSpent) ovSpent.textContent = money(spent);
  const ovCap = $('#ovCap');
  if (ovCap) ovCap.textContent = money(cap);
  const month = $('#budgetMonth');
  if (month) month.textContent = budget.month_short || new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  const wlMonth = $('#wlBudgetMonth');
  if (wlMonth) wlMonth.textContent = String(budget.month_name || new Date().toLocaleString('en-US', { month: 'long' })).toUpperCase();
  const arc = $('#budgetRingArc');
  if (arc) {
    const circumference = 2 * Math.PI * 66;
    arc.style.strokeDasharray = String(circumference);
    arc.style.strokeDashoffset = String(circumference * Math.min(1, spent / Math.max(1, cap)));
  }
  const wlRemaining = $('#wlRemaining');
  if (wlRemaining) wlRemaining.textContent = money(remaining);
  const fill = $('#wlRailFill');
  if (fill) {
    fill.style.width = `${Math.min(100, (spent / Math.max(1, cap)) * 100)}%`;
    fill.classList.toggle('is-over', Boolean(budget.over_budget));
  }
  const note = $('#wlSpentNote');
  if (note) note.textContent = `${money(spent, 2)} spent of ${money(cap, 2)} monthly cap${budget.over_budget ? ' · over budget' : ''}`;
  const ledgerCount = $('#ledgerCount');
  if (ledgerCount) ledgerCount.textContent = String((v.spending_ledger || []).length);
  const profileBudget = $('#profileBudget');
  if (profileBudget) profileBudget.textContent = money(cap);
  const profileBudgetSub = $('#profileBudgetSub');
  if (profileBudgetSub) profileBudgetSub.textContent = `${money(remaining)} left after ${money(spent)} spent`;
}

function renderOverview(v) {
  const wishlist = v.wishlist || [];
  setCounter($('#heroVaultCount'), v.total_bookmarks || 0, fmt);
  setCounter($('#heroSavings'), totalMarkup(v), (n) => money(n));
  setCounter($('#heroGated'), v.gate && Number.isFinite(v.gate.active) ? v.gate.active : wishlist.length, fmt);
  setCounter($('#ovBookmarkCount'), v.total_bookmarks || 0, fmt);

  const counts = v.category_counts || {};
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const cluster = $('#ovClusterCount');
  if (cluster) cluster.textContent = `${entries.length} clusters`;
  const bars = $('#catBars');
  if (bars) {
    const max = entries.reduce((m, e) => Math.max(m, e[1]), 1);
    bars.innerHTML = entries.slice(0, 4).map(([name, count], i) => `
      <div class="mini-bar">
        <span>${esc(name)}</span><em>${fmt(count)}</em>
        <span class="bar"><i style="width:${Math.max(8, (count / max) * 100)}%;background:linear-gradient(90deg, ${CAT_COLORS[i % CAT_COLORS.length]}, var(--cyan))"></i></span>
      </div>`).join('') || '<div class="micro">No clusters yet</div>';
  }
  const browser = $('#browserMeta');
  if (browser) browser.textContent = (v.meta && v.meta.browsers_synced ? v.meta.browsers_synced.join(' · ') : 'Browser profiles not synced') + ' · ' + entries.length + ' CLUSTERS';

  const groups = { good: 0, warn: 0, bad: 0 };
  wishlist.forEach((w) => { groups[verdictTone(w.verdict)] += 1; });
  const total = Math.max(1, wishlist.length);
  const seg = $('#verdictSeg');
  if (seg) {
    seg.innerHTML = [
      ['good', 'var(--mint)'], ['warn', 'var(--amber)'], ['bad', 'var(--rose)']
    ].map(([key, tone]) => `<i style="width:${(groups[key] / total) * 100}%;background:${tone}"></i>`).join('');
  }
  const legend = $('#verdictLegend');
  if (legend) {
    legend.innerHTML = [
      ['good', 'Approved or discounted', 'var(--mint)'],
      ['warn', 'Cooling or sample-first', 'var(--amber)'],
      ['bad', 'Blocked as duplicate', 'var(--rose)']
    ].map(([key, label, tone]) => `<li style="--tone:${tone}"><i></i><span>${label}</span><b>${groups[key]}</b></li>`).join('');
  }
  const note = $('#verdictNote');
  if (note) note.textContent = `${wishlist.length} items interrogated. ${groups.good} cleared, ${groups.warn} cooling, ${groups.bad} blocked.`;

  renderDigest(v, 'digest');
  renderQuickSignals(v);
  renderTicker(v);
}

function digestMarkup(v) {
  const d = v.last_digest;
  if (!d) {
    return {
      stamp: 'AWAITING SYNC',
      stats: '<div class="digest-stat"><b>—</b><span>No digest</span></div>',
      deals: '<li class="deal-item"><strong>The nightly job has not run yet.</strong><span>TRIGGER IT FROM THE ROUTER</span></li>'
    };
  }
  const s = d.stats || {};
  const stamp = validStamp(d.executed_at);
  const stats = [
    [fmt(s.total_bookmarks_verified), 'Links verified'],
    [fmt(s.wishlist_items_polled), 'Wishes polled'],
    [fmt(s.cooling_off_cleared), 'Timers cleared'],
    [money(s.remaining_monthly_budget), 'Budget left']
  ].map(([value, label]) => `<div class="digest-stat"><b>${value}</b><span>${label}</span></div>`).join('');
  const deals = (d.top_deal_alerts || []).slice(0, 3).map((deal) => `
    <li class="deal-item"><div><strong>${esc(deal.title)}</strong><span>${esc(deal.source)}</span></div><span class="deal-save">−${money(deal.savings)}</span></li>
  `).join('') || '<li class="deal-item"><strong>No live price drops.</strong><span>THE FLOOR IS STILL THE FLOOR</span></li>';
  return { stamp, stats, deals };
}
function renderDigest(v, prefix) {
  const data = digestMarkup(v);
  const stamp = $(`#${prefix === 'digest' ? 'digestStamp' : 'routerDigestStamp'}`);
  if (stamp) stamp.textContent = data.stamp;
  const stats = $(`#${prefix === 'digest' ? 'digestStats' : 'routerDigestStats'}`);
  if (stats) stats.innerHTML = data.stats;
  const deals = $(`#${prefix === 'digest' ? 'digestDeals' : 'routerDigestDeals'}`);
  if (deals) deals.innerHTML = data.deals;
}
function renderQuickSignals(v) {
  const list = $('#quickSignals');
  if (!list) return;
  const rows = (v.telemetry || []).slice(0, 4);
  list.innerHTML = rows.length ? rows.map((t) => `
    <li><time>${esc(clockTime(t.timestamp))}</time><p title="${esc(t.task)}">${esc(t.task)}</p><small>${esc(t.latency_ms)} ms</small></li>
  `).join('') : '<li><p>Waiting for the first router call.</p><small>IDLE</small></li>';
}
function renderTicker(v) {
  const track = $('#tickerTrack');
  if (!track) return;
  const { remaining } = budgetNumbers(v);
  const items = [
    `${fmt(v.total_bookmarks || 0)} signals indexed`,
    `${Object.keys(v.category_counts || {}).length} clusters mapped`,
    `${money(remaining)} fun-money left`,
    `${v.gate && Number.isFinite(v.gate.active) ? v.gate.active : (v.wishlist || []).length} active wishes interrogated`,
    `${(v.gate && Array.isArray(v.gate.target_hits) ? v.gate.target_hits.length : 0)} target prices met`,
    `${money(totalMarkup(v))} retail markup caught`,
    'NEMOTRON 3 ULTRA · 1M CONTEXT',
    'NEBIUS TOKEN FACTORY · ROUTING LIVE',
    'LOCAL VAULT · PRIVATE BY DESIGN'
  ];
  const sequence = items.map((item) => `<span class="ticker-item">${esc(item)}</span>`).join('');
  track.innerHTML = sequence + sequence;
}

function sectionIconMarkup(section, className = 'icon') {
  const logoSrc = safeImage(section && section.logo);
  if (logoSrc) return `<img class="${className === 'icon' ? 'rail-logo' : 'section-logo'}" src="${esc(logoSrc)}" alt="" loading="lazy" />`;
  const icon = section && SECTION_ICONS.includes(section.icon) ? section.icon : 'i-spark';
  return `<svg class="${className}"><use href="#${icon}"/></svg>`;
}

function syncRailOverflow() {
  const nav = $('.rail-nav');
  if (!nav) return;
  nav.classList.toggle('is-scrollable', nav.scrollWidth > nav.clientWidth + 2);
}

function renderSections() {
  const nav = $('.rail-nav');
  if (nav) {
    nav.innerHTML = visibleSections().map((section) => {
      const active = section.id === state.tab;
      const hint = section.tags && section.tags.length ? `${section.label} - ${section.tags.join(', ')}` : section.label;
      return `<button class="rail-btn" id="tab-${esc(section.id)}" data-tab="${esc(section.id)}" role="tab" aria-selected="${active}" aria-controls="panel-${esc(section.id)}" tabindex="${active ? 0 : -1}" style="--section-accent:${esc(section.color)}" title="${esc(hint)}">${sectionIconMarkup(section)}<span>${esc(section.label)}</span></button>`;
    }).join('');
  }
  syncCustomPanels();
  window.requestAnimationFrame(syncRailOverflow);
  const active = sectionById(state.tab);
  if (!active || !active.visible) {
    const fallback = visibleSections()[0] || state.sections[0];
    if (fallback) setTab(fallback.id, { scroll: false });
  }
}

function customCardMarkup(card, sectionId) {
  const image = safeImage(card.image);
  const initial = String(card.title || '?').trim().charAt(0).toUpperCase() || '?';
  const tags = (card.tags || []).map((tag) => `<span class="tag">#${esc(tag)}</span>`).join('');
  const title = card.url
    ? `<a href="${esc(safeUrl(card.url))}" target="_blank" rel="noopener noreferrer">${esc(card.title || 'Untitled card')}</a>`
    : esc(card.title || 'Untitled card');
  return `
  <article class="custom-card" style="--tone:${esc(card.color || '#c6ff4a')}">
    <div class="custom-card-media">
      <span class="media-fallback" aria-hidden="true"><strong>${esc(initial)}</strong><span>No photo</span></span>
      ${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : ''}
      ${card.status ? `<span class="custom-status">${esc(card.status)}</span>` : ''}
    </div>
    <div class="custom-card-body">
      <h3>${title}</h3>
      ${card.description ? `<p>${esc(card.description)}</p>` : ''}
      ${tags ? `<div class="custom-tags">${tags}</div>` : ''}
      <div class="custom-card-foot">
        <span class="custom-price">${card.price ? esc(card.price) : ''}</span>
        <span class="custom-actions">
          <button type="button" class="mini-btn" data-card-edit="${esc(card.id)}" data-section-id="${esc(sectionId)}" aria-label="Edit ${esc(card.title || 'card')}"><svg class="icon"><use href="#i-edit"/></svg></button>
          <button type="button" class="mini-btn danger" data-card-delete="${esc(card.id)}" data-section-id="${esc(sectionId)}" aria-label="Delete ${esc(card.title || 'card')}"><svg class="icon"><use href="#i-trash"/></svg></button>
        </span>
      </div>
    </div>
  </article>`;
}

function customPanelMarkup(section) {
  const cards = section.cards || [];
  const tags = (section.tags || []).map((tag) => `<span class="tag">#${esc(tag)}</span>`).join('');
  return `
  <div class="section-head custom-head reveal">
    <div>
      <div class="custom-kicker"><span class="custom-mark" style="--tone:${esc(section.color)}">${sectionIconMarkup(section)}</span><p class="eyebrow">CUSTOM COLLECTION</p></div>
      <h2>${esc(section.label)}</h2>
      <p class="lede">${esc(section.description || 'A section you control. Add image cards, tags, links and notes.')}</p>
      ${tags ? `<div class="section-tags">${tags}</div>` : ''}
    </div>
    <div class="head-actions">
      <button class="btn ghost" type="button" data-section-edit="${esc(section.id)}"><svg class="icon"><use href="#i-command"/></svg> Edit section</button>
      <button class="btn" type="button" data-card-add="${esc(section.id)}"><svg class="icon"><use href="#i-plus"/></svg> Add card</button>
    </div>
  </div>
  <div class="custom-card-grid">${cards.length ? cards.map((card) => customCardMarkup(card, section.id)).join('') : `
    <div class="empty-state custom-empty">
      <svg class="icon"><use href="#i-spark"/></svg>
      <h3>This collection is empty</h3>
      <p>Add the first item, a photo, a link and whatever tags you want to remember it by.</p>
      <button type="button" class="btn ghost sm" data-card-add="${esc(section.id)}"><svg class="icon"><use href="#i-plus"/></svg> Add the first card</button>
    </div>`}</div>`;
}

function syncCustomPanels() {
  const main = $('#main');
  if (!main) return;
  const customSections = state.sections.filter((section) => !section.builtin);
  for (const section of customSections) {
    let panel = document.getElementById(`panel-${section.id}`);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = `panel-${section.id}`;
      panel.className = 'panel custom-panel';
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `tab-${section.id}`);
      panel.tabIndex = 0;
      main.appendChild(panel);
    }
    panel.style.setProperty('--section-accent', section.color || cssVar('--lime'));
    panel.innerHTML = customPanelMarkup(section);
    panel.hidden = state.tab !== section.id;
    panel.classList.toggle('is-active', state.tab === section.id);
  }
  $$('.custom-panel', main).forEach((panel) => {
    const id = panel.id.replace(/^panel-/, '');
    if (!customSections.some((section) => section.id === id)) panel.remove();
  });
}

const PRODUCT_CLUSTER_RE = /(menswear|streetwear|fragrance|cologne|perfume|skincare|health|watch|footwear|accessor|soccer|sportswear|food|halal|grocer|auto|car|real estate)/i;
const CLUSTER_ICON_RULES = [
  [/programming|dev|cloud/i, 'i-command'],
  [/ai models|agents|infra/i, 'i-spark'],
  [/career|jobs|interview/i, 'i-fingerprint'],
  [/cyber|security/i, 'i-lock'],
  [/life hacks|utilities|reference/i, 'i-search'],
  [/gaming|mods|esports/i, 'i-deck'],
  [/sourcing|proxies/i, 'i-router'],
  [/business|finance|real estate|auto/i, 'i-coin'],
  [/food|halal|grocery/i, 'i-coin'],
  [/skincare|health/i, 'i-pulse'],
  [/fragrance|cologne/i, 'i-spark'],
  [/menswear|streetwear/i, 'i-vault'],
  [/watch|footwear|accessor/i, 'i-clock'],
  [/soccer|sportswear/i, 'i-spark']
];

function clusterTone(v, name) {
  const visual = CLUSTER_VISUALS[name];
  if (visual) return visual.color;
  const entries = Object.entries((v && v.category_counts) || {}).sort((a, b) => b[1] - a[1]);
  const index = entries.findIndex(([entry]) => entry === name);
  return CAT_COLORS[(index < 0 ? 0 : index) % CAT_COLORS.length];
}

function clusterCardImage(name) {
  const visual = CLUSTER_VISUALS[name];
  return visual ? `/cluster-cards/${visual.slug}.svg` : '';
}

function clusterMeta(v, name) {
  const saved = (v && v.cluster_meta && v.cluster_meta[name]) || {};
  const storedMode = saved.mode === 'product' || saved.mode === 'reference' ? saved.mode : '';
  const defaultMode = saved.default_mode === 'product' || saved.default_mode === 'reference'
    ? saved.default_mode
    : (PRODUCT_CLUSTER_RE.test(name) ? 'product' : 'reference');
  return {
    mode: storedMode || defaultMode,
    default_mode: defaultMode,
    hero_item_id: saved.hero_item_id || '',
    cover: saved.cover || '',
    pinned: Boolean(saved.hero_item_id),
    custom: Boolean(saved.cover)
  };
}

function clusterWishes(v, name) {
  return ((v && v.wishlist) || []).filter((wish) => wish.category === name);
}

function clusterHero(v, name, meta) {
  const wishes = clusterWishes(v, name);
  if (meta.hero_item_id) {
    const pinned = wishes.find((wish) => wish.id === meta.hero_item_id && safeImage(wish.image));
    if (pinned) return pinned;
  }
  const rank = { good: 0, warn: 1, bad: 2 };
  return wishes
    .filter((wish) => safeImage(wish.image))
    .sort((a, b) => (rank[verdictTone(a.verdict)] ?? 3) - (rank[verdictTone(b.verdict)] ?? 3))[0] || null;
}

function clusterIcon(name) {
  const match = CLUSTER_ICON_RULES.find(([pattern]) => pattern.test(name));
  return match ? match[1] : 'i-vault';
}

function clusterDesignMarkup(name, index, label = 'REFERENCE') {
  return `<span class="cluster-design" aria-hidden="true">
    <span class="cluster-design-index">${pad(index + 1)}</span>
    <svg class="icon cluster-design-icon"><use href="#${clusterIcon(name)}"/></svg>
    <span class="cluster-design-label"><i></i>${esc(label)}</span>
  </span>`;
}

function clusterCover(v, name, meta) {
  if (!meta || meta.mode !== 'product') return null;
  if (safeImage(meta.cover)) return { image: meta.cover, title: name, brand: 'CUSTOM COVER', pinned: true, custom: true };
  const hero = clusterHero(v, name, meta);
  return hero ? { image: hero.image, title: hero.title, brand: hero.brand, hero_id: hero.id, pinned: Boolean(meta.hero_item_id) } : null;
}

function clusterCardMarkup(v, name, count, index) {
  const active = state.category === name;
  const meta = clusterMeta(v, name);
  const wishes = clusterWishes(v, name);
  const cover = clusterCover(v, name, meta);
  const isReference = meta.mode === 'reference';
  const image = safeImage(cover && cover.image);
  const referenceCard = clusterCardImage(name);
  const quickWishes = isReference ? [] : wishes.filter((wish) => safeImage(wish.image)).slice(0, 3);
  return `
  <div class="cluster-cell" style="--tone:${clusterTone(v, name)}">
    <button type="button" class="cluster-card ${active ? 'is-active' : ''} ${isReference ? 'is-reference' : 'is-product'}" data-cat="${esc(name)}" aria-pressed="${active}">
      <span class="cluster-media">
        ${isReference
          ? referenceCard ? `<img src="${esc(referenceCard)}" alt="" loading="lazy" />` : clusterDesignMarkup(name, index)
          : image ? `<img src="${esc(image)}" alt="" loading="lazy" />`
            : referenceCard ? `<img src="${esc(referenceCard)}" alt="" loading="lazy" />` : clusterDesignMarkup(name, index, 'AWAITING FIRST WISH')}
        ${quickWishes.length > 1 ? `<span class="cluster-thumbs" aria-hidden="true">${quickWishes.map((wish, thumbIndex) => `<img src="${esc(safeImage(wish.image))}" alt="" loading="lazy" style="--j:${thumbIndex}" />`).join('')}${wishes.length > 3 ? `<span class="cluster-thumbs-more">+${wishes.length - 3}</span>` : ''}</span>` : ''}
        <span class="cluster-count">${fmt(count)}</span>
        ${cover ? `<span class="cluster-want">${cover.custom ? 'CUSTOM' : cover.pinned ? 'PINNED' : 'WANT'}</span>` : ''}
      </span>
      <span class="cluster-body">
        <span class="cluster-index">CLUSTER ${pad(index + 1)}</span>
        <span class="cluster-name">${esc(name)}</span>
        <span class="cluster-meta">${fmt(count)} saved${wishes.length ? ` / ${wishes.length} ${wishes.length === 1 ? 'wish' : 'wishes'}` : ''}</span>
        <span class="cluster-cta">${active ? 'Filtering this cluster' : isReference ? 'Open reference' : 'Open cluster'} <svg class="icon"><use href="#i-arrow"/></svg></span>
      </span>
    </button>
    <button type="button" class="cluster-cover-btn" data-cover="${esc(name)}" aria-label="Change the cover for ${esc(name)}" title="Change cover"><svg class="icon"><use href="#i-image"/></svg></button>
  </div>`;
}

function renderCategories(v) {
  const grid = $('#clusterGrid');
  if (!grid) return;
  const counts = v.category_counts || {};
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const head = $('#vaultHeadCount');
  if (head) head.textContent = fmt(v.total_bookmarks || 0);
  const auditIdle = $('#auditOutput');
  if (auditIdle && auditIdle.textContent.startsWith('The oracle is idle.')) {
    auditIdle.textContent = `The oracle is idle. Run a synthesis to audit ${fmt(v.total_bookmarks || 0)} bookmarks, your wardrobe, budget and routines in a single pass.`;
  }
  const panelCount = $('#catPanelCount');
  if (panelCount) panelCount.textContent = `${entries.length} CLUSTERS`;
  const allCount = $('#clusterAllCount');
  if (allCount) allCount.textContent = fmt(v.total_bookmarks || 0);
  grid.innerHTML = entries.map(([name, count], i) => clusterCardMarkup(v, name, count, i)).join('');
}

function wantedCardMarkup(wish) {
  const image = safeImage(wish.image);
  const initial = String(wish.title || '?').trim().charAt(0).toUpperCase() || '?';
  const floor = Math.max(0, Number(wish.lowest_verified_price) || 0);
  const retail = Math.max(0, Number(wish.retail_price) || 0);
  const hasPrice = floor > 0 || retail > 0;
  return `
  <article class="wanted-card">
    <button type="button" class="wanted-media" data-wish-jump="${esc(wish.id)}" aria-label="Open ${esc(wish.title)} in the Impulse Gate">
      ${image ? `<img src="${esc(image)}" alt="${esc(wish.title)}" loading="lazy" />` : `<span class="wanted-fallback" aria-hidden="true">${esc(initial)}</span>`}
      <span class="wanted-verdict ${verdictTone(wish.verdict)}">${esc(wish.verdict_label || 'GATE ACTIVE')}</span>
    </button>
    <div class="wanted-body">
      <p class="wanted-brand">${esc(wish.brand || 'PRIVATE SAVE')}</p>
      <h5 class="wanted-title">${esc(wish.title)}</h5>
      <div class="wanted-price">${hasPrice ? `<b>${money(floor, 2)}</b><span>${money(retail, 0)} retail</span>` : '<b>Price pending</b><span>add details</span>'}</div>
    </div>
    <a class="wanted-source" href="${esc(safeUrl(wish.url))}" target="_blank" rel="noopener noreferrer">Source <svg class="icon"><use href="#i-external"/></svg></a>
  </article>`;
}

function renderWantedStrip(v) {
  const strip = $('#wantedStrip');
  if (!strip) return;
  if (!v || !state.category || state.category === 'ALL') {
    strip.hidden = true;
    return;
  }
  const name = state.category;
  const meta = clusterMeta(v, name);
  if (meta.mode !== 'product') {
    strip.hidden = true;
    return;
  }
  const allWishes = clusterWishes(v, name);
  const hero = clusterHero(v, name, meta);
  const wishes = hero ? [hero, ...allWishes.filter((wish) => wish.id !== hero.id)] : allWishes;
  strip.hidden = false;
  strip.style.setProperty('--tone', clusterTone(v, name));
  if ($('#wantedTitle')) $('#wantedTitle').textContent = name;
  if ($('#wantedMeta')) {
    $('#wantedMeta').textContent = `${wishes.length} ${wishes.length === 1 ? 'wish' : 'wishes'} in this cluster · ${meta.pinned ? 'cover pinned' : 'cover auto'}`;
  }
  const coverBtn = $('#wantedCoverBtn');
  if (coverBtn) {
    coverBtn.dataset.cover = name;
    coverBtn.hidden = false;
  }
  const rail = $('#wantedRail');
  if (!rail) return;
  rail.classList.toggle('is-empty', !wishes.length);
  rail.innerHTML = wishes.length
    ? wishes.map(wantedCardMarkup).join('')
    : `<div class="wanted-empty"><p>No wishlist item in this cluster yet. Promote a signal from the index, or set a custom cover.</p><button type="button" class="btn ghost sm" data-cover="${esc(name)}"><svg class="icon"><use href="#i-image"/></svg> Set a cover</button></div>`;
}

function bookmarkGlyph(b) {
  return String(b.domain || b.title || '?').replace(/^www\./, '').charAt(0).toUpperCase() || '?';
}

function isPhotoCluster(name) {
  return PRODUCT_CLUSTER_RE.test(String(name || ''));
}

/** Product clusters get a picture slot; reference clusters stay text cards. */
function bookmarkPhotoSlot(b, glyph) {
  const image = safeImage(b.image);
  if (image) {
    return `<a class="signal-media" href="${esc(safeUrl(b.url))}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><img src="${esc(image)}" alt="" loading="lazy" decoding="async" /></a>`;
  }
  if (!isPhotoCluster(b.category)) return '';
  if (photoFailures.has(String(b.id))) {
    return `<a class="signal-media is-missing" href="${esc(safeUrl(b.url))}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><span class="signal-photo-glyph">${esc(glyph)}</span><span class="signal-photo-note"><span>Open source</span></span></a>`;
  }
  return `<span class="signal-media is-pending" data-photo-slot aria-hidden="true"><span class="signal-photo-glyph">${esc(glyph)}</span><span class="signal-photo-note"><i></i><span>No photo yet</span></span></span>`;
}

function bookmarkCard(b, index) {
  const glyph = bookmarkGlyph(b);
  const media = bookmarkPhotoSlot(b, glyph);
  const tags = (b.tags || []).slice(0, 4).map((t) => `<span class="tag">#${esc(t)}</span>`).join('');
  const meta = [b.original_folder, b.snapshot_status].filter(Boolean).join(' · ');
  const score = b.match_score ? `<span class="match-score" title="Hybrid semantic match score">${b.match_score}</span>` : '';
  return `
  <article class="signal-card ${media ? 'has-media' : ''} ${media && !safeImage(b.image) ? 'is-photo-pending' : ''}" data-bm-id="${esc(b.id)}" data-bm-url="${esc(safeUrl(b.url))}" data-bm-glyph="${esc(glyph)}" style="--i:${Math.min(index, 12)};--tone:${esc(clusterTone(state.vault, b.category))}">
    ${media}
    <div class="signal-body">
      <div class="signal-top">
        ${media ? '' : `<span class="domain-glyph" aria-hidden="true">${esc(glyph)}</span>`}
        <span class="signal-domain" title="${esc(b.domain)}">${esc(b.domain)}</span>
        ${score}
        <span class="signal-cat" title="${esc(b.category)}">${esc(b.category)}</span>
      </div>
      <h3 class="signal-title"><a href="${esc(safeUrl(b.url))}" target="_blank" rel="noopener noreferrer">${esc(b.title)}</a></h3>
      <div class="signal-tags">${tags || `<span class="tag">#${esc(b.browser)}</span>`}</div>
      <div class="signal-foot">
        <span class="signal-browser" title="${esc(meta)}">${esc(b.browser)}${b.original_folder ? ' · ' + esc(b.original_folder) : ''}</span>
        <button type="button" class="gate-btn" data-promote="${esc(b.id)}" aria-label="Review and gate ${esc(b.title)}"><svg class="icon"><use href="#i-gate"/></svg> Review</button>
      </div>
    </div>
  </article>`;
}

/* ————— CLUSTER PHOTO CARDS ————— */
const photoFailures = new Set();
let photoRun = 0;

function bookmarkCardNode(id) {
  const value = String(id || '').replace(/"/g, '\\"');
  return document.querySelector(`.signal-card[data-bm-id="${value}"]`);
}

function photoFallbackNode(glyph, url) {
  const slot = document.createElement('a');
  slot.className = 'signal-media is-missing';
  slot.href = safeUrl(url);
  slot.target = '_blank';
  slot.rel = 'noopener noreferrer';
  slot.tabIndex = -1;
  slot.setAttribute('aria-hidden', 'true');
  slot.innerHTML = `<span class="signal-photo-glyph">${esc(glyph || '?')}</span><span class="signal-photo-note"><span>Open source</span></span>`;
  return slot;
}

function markPhotoSearching(id) {
  const card = bookmarkCardNode(id);
  const note = card && card.querySelector('.signal-photo-note span');
  if (note) note.textContent = 'Finding photo';
}

function markPhotoFailed(id) {
  const card = bookmarkCardNode(id);
  if (!card) return;
  const slot = card.querySelector('[data-photo-slot]');
  if (slot) slot.replaceWith(photoFallbackNode(card.dataset.bmGlyph, card.dataset.bmUrl));
  card.classList.remove('is-photo-pending');
}

function applyBookmarkPhoto(id, image) {
  const card = bookmarkCardNode(id);
  if (!card) return;
  const link = document.createElement('a');
  link.className = 'signal-media';
  link.href = card.dataset.bmUrl || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.tabIndex = -1;
  link.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('load', () => card.classList.add('has-photo'));
  img.addEventListener('error', () => {
    photoFailures.add(String(id));
    link.replaceWith(photoFallbackNode(card.dataset.bmGlyph, card.dataset.bmUrl));
  });
  img.src = image;
  link.appendChild(img);
  const slot = card.querySelector('[data-photo-slot]');
  if (slot) slot.replaceWith(link); else card.prepend(link);
  card.classList.add('has-media');
  card.classList.remove('is-photo-pending');
}

/** Product-looking URLs are read first so the gallery fills with real photos sooner. */
function photoPriority(bookmark) {
  const url = String(bookmark.url || '');
  let score = 0;
  if (/\/(products?|collections|shop|item|dp|p|c|category|pages?)\//i.test(url)) score += 3;
  if (/\.(avif|gif|jpe?g|png|webp)([?#]|$)/i.test(url)) score += 2;
  return score;
}

async function hydrateBookmarkPhotos() {
  if (state.tab !== 'vault') return;
  const run = ++photoRun;
  const targets = state.items
    .filter((b) => b && b.id && !safeImage(b.image) && isPhotoCluster(b.category) && !photoFailures.has(String(b.id)))
    .sort((a, b) => photoPriority(b) - photoPriority(a));
  if (!targets.length) return;
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const item = targets[cursor++];
      if (run !== photoRun || state.tab !== 'vault') return;
      markPhotoSearching(item.id);
      try {
        const data = await postJSON(`/api/bookmarks/${encodeURIComponent(item.id)}/image`);
        if (run !== photoRun) return;
        if (data && data.image) {
          item.image = data.image;
          applyBookmarkPhoto(item.id, data.image);
        } else {
          photoFailures.add(String(item.id));
          markPhotoFailed(item.id);
        }
      } catch (_) {
        if (run !== photoRun) return;
        // A transport or rate-limit failure is not proof the page has no photo;
        // leave the slot available so a later visit retries it.
        const card = bookmarkCardNode(item.id);
        const note = card && card.querySelector('.signal-photo-note span');
        if (note) note.textContent = 'No photo yet';
      }
    }
  };
  await Promise.all([worker(), worker()]);
}
function renderSkeletons() {
  const grid = $('#bmGrid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-line w40"></div><div class="skeleton-line w90"></div>
      <div class="skeleton-line w70"></div><div class="skeleton-line w70"></div>
      <div class="skeleton-line w40"></div>
    </div>`).join('');
}
function setResultStatus(message) {
  const el = $('#bmCount');
  if (el) el.textContent = message;
}

async function loadBookmarks(reset) {
  const seq = ++state.loadSeq;
  const controller = new AbortController();
  if (state.bookmarkAbort) state.bookmarkAbort.abort();
  state.bookmarkAbort = controller;
  const input = $('#bmSearchInput');
  const browser = $('#bmBrowserFilter');
  const q = input ? input.value.trim() : '';
  const browserValue = browser ? browser.value : 'ALL';
  const grid = $('#bmGrid');
  if (!grid) return;
  if (reset) {
    photoRun += 1;
    state.items = [];
    setResultStatus(q ? `Searching memory for “${q}”…` : 'Loading signals…');
    renderSkeletons();
    grid.setAttribute('aria-busy', 'true');
  }
  const params = new URLSearchParams({
    category: state.category,
    browser: browserValue,
    q,
    limit: String(state.limit),
    offset: String(reset ? 0 : state.items.length)
  });
  try {
    const data = await getJSON('/api/bookmarks?' + params.toString(), { signal: controller.signal });
    if (seq !== state.loadSeq) return;
    state.total = Number(data.total) || 0;
    state.items = reset ? (data.items || []) : state.items.concat(data.items || []);
    renderBookmarkResults(q);
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (seq !== state.loadSeq) return;
    if (reset) state.items = [];
    grid.innerHTML = `<div class="empty-state"><svg class="icon"><use href="#i-alert"/></svg><h3>The vault link broke</h3><p>${esc(err.message)}</p><button type="button" class="btn ghost sm" id="retryBookmarks">Retry query</button></div>`;
    setResultStatus('Search failed.');
    const retry = $('#retryBookmarks');
    if (retry) retry.addEventListener('click', () => loadBookmarks(true));
    toast(err.message, 'err');
  } finally {
    if (state.bookmarkAbort === controller) state.bookmarkAbort = null;
    if (seq === state.loadSeq) grid.setAttribute('aria-busy', 'false');
  }
}

function renderBookmarkResults(q) {
  const grid = $('#bmGrid');
  if (!grid) return;
  if (!state.items.length) {
    grid.innerHTML = `<div class="empty-state"><svg class="icon"><use href="#i-search"/></svg><h3>No signals matched that memory</h3><p>Try a broader phrase, switch clusters, or search for a brand, ingredient, or domain. The vault only knows what you saved.</p><button type="button" class="btn ghost sm" id="clearFilters">Clear filters</button></div>`;
    const clear = $('#clearFilters');
    if (clear) clear.addEventListener('click', () => {
      if ($('#bmSearchInput')) $('#bmSearchInput').value = '';
      if ($('#bmBrowserFilter')) $('#bmBrowserFilter').value = 'ALL';
      state.category = 'ALL';
      renderCategories(state.vault);
      loadBookmarks(true);
    });
  } else {
    grid.innerHTML = state.items.map((b, i) => bookmarkCard(b, i)).join('');
  }
  const suffix = state.category !== 'ALL' ? ` in ${state.category}` : '';
  const browserValue = $('#bmBrowserFilter') ? $('#bmBrowserFilter').value : 'ALL';
  const browserSuffix = browserValue !== 'ALL' ? ` · ${browserValue}` : '';
  setResultStatus(`Showing ${state.items.length} of ${state.total} signals${suffix}${q ? ` for “${q}”` : ''}.`);
  const active = $('#activeFilter');
  if (active) active.textContent = (state.category === 'ALL' ? 'ALL CLUSTERS' : state.category.toUpperCase()) + browserSuffix;
  const more = $('#loadMoreBtn');
  if (more) more.hidden = state.items.length >= state.total || !state.total;
  hydrateBookmarkPhotos();
}

function captureSourceLabel(source) {
  if (source === 'json-ld') return 'JSON-LD';
  if (source === 'meta') return 'OpenGraph';
  if (source === 'dom') return 'visible page text (low confidence)';
  return 'page metadata';
}

function closePromotionReview() {
  state.promotion = null;
  const dialog = $('#promoteDialog');
  if (dialog && dialog.open) dialog.close();
}

function renderPromoteCategories(selected) {
  const select = $('#promoteCategory');
  if (!select) return;
  const counts = (state.vault && state.vault.category_counts) || {};
  const names = Object.keys(counts).sort((a, b) => (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b));
  if (selected && !names.includes(selected)) names.unshift(selected);
  select.innerHTML = names.map((name) => `<option value="${esc(name)}" ${name === selected ? 'selected' : ''}>${esc(name)}</option>`).join('');
}

function openPromotionReview(preview, duplicates = []) {
  const dialog = $('#promoteDialog');
  if (!dialog || !preview) return;
  state.promotion = { ...preview, possible_duplicates: Array.isArray(duplicates) ? duplicates : [] };
  const captured = Number(preview.price) > 0 ? Number(preview.price) : null;
  state.promotion.capturedPrice = captured;
  if (!dialog.open) dialog.showModal();
  if ($('#promoteId')) $('#promoteId').value = preview.bookmark_id || '';
  if ($('#promoteTitleInput')) $('#promoteTitleInput').value = preview.title || '';
  if ($('#promoteBrand')) $('#promoteBrand').value = preview.brand || '';
  renderPromoteCategories(preview.category || '');
  if ($('#promoteRetail')) $('#promoteRetail').value = priceInputValue(captured);
  if ($('#promoteFloor')) $('#promoteFloor').value = priceInputValue(captured);
  if ($('#promoteSource')) $('#promoteSource').value = preview.best_source || '';
  if ($('#promoteUrl')) {
    $('#promoteUrl').href = safeUrl(preview.url);
    $('#promoteUrl').textContent = preview.url || '';
  }
  const media = $('#promoteMedia');
  if (media) {
    const image = safeImage(preview.image);
    const initial = String(preview.title || '?').trim().charAt(0).toUpperCase() || '?';
    media.innerHTML = image
      ? `<img src="${esc(image)}" alt="${esc(preview.title || 'Product')}" />`
      : `<span aria-hidden="true">${esc(initial)}</span>`;
  }
  const status = $('#promoteCaptureStatus');
  if (status) {
    const lowConfidence = captured !== null && preview.price_confidence === 'low';
    const sourceLabel = preview.capture_mode === 'page' ? 'Read directly from the open product tab' : 'Read from the saved page';
    status.classList.toggle('is-warn', captured === null || lowConfidence);
    status.innerHTML = captured !== null
      ? (lowConfidence
        ? `<b>${esc(money(captured, 2))} ${esc(preview.currency || 'USD')} captured — verify</b><span>Low-confidence DOM fallback read from visible page text. Confirm or correct it before starting the gate.</span>`
        : `<b>${esc(money(captured, 2))} ${esc(preview.currency || 'USD')} captured</b><span>${esc(sourceLabel)} via ${esc(captureSourceLabel(preview.price_source))}. Edit it if the page is wrong.</span>`)
      : `<b>No USD price captured</b><span>${esc(preview.price_reason || 'The page did not expose a public price.')} Enter one below, or start the gate with the price marked pending.</span>`;
  }
  const dupeHost = $('#promoteDuplicates');
  if (dupeHost) {
    const duplicates = Array.isArray(state.promotion.possible_duplicates) ? state.promotion.possible_duplicates : [];
    dupeHost.hidden = !duplicates.length;
    dupeHost.innerHTML = duplicates.length
      ? `<span class="micro">POSSIBLE DUPLICATE${duplicates.length === 1 ? '' : 'S'} IN THE GATE</span><ul>${duplicates.map((dupe) => `<li><button type="button" data-dupe-jump="${esc(dupe.id)}"><b>${esc(dupe.title)}</b><span>${esc(String(dupe.status || '').toUpperCase())}${dupe.price ? ' · ' + money(dupe.price, 2) : ''}${dupe.same_domain ? ' · SAME STORE' : ''}</span></button></li>`).join('')}</ul>`
      : '';
  }
  const error = $('#promoteError');
  if (error) error.hidden = true;
  window.setTimeout(() => {
    const title = $('#promoteTitleInput');
    if (title) { title.focus(); title.select(); }
  }, 60);
}

async function promoteBookmark(id, btn) {
  if (!id || (btn && btn.disabled)) return;
  busy(btn, true, 'Reading page');
  try {
    const data = await postJSON('/api/bookmark-preview', { id });
    if (data.already_exists) {
      toast('That signal is already inside the impulse gate.');
      return;
    }
    if (!data.preview) throw new Error('The page preview did not return any details.');
    openPromotionReview(data.preview, data.possible_duplicates);
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

async function savePromotion(event) {
  event.preventDefault();
  const pending = state.promotion;
  const id = pending ? pending.bookmark_id : '';
  const url = pending ? pending.url : '';
  const title = $('#promoteTitleInput') ? $('#promoteTitleInput').value.trim() : '';
  const error = $('#promoteError');
  if (!pending || (!id && !url)) return;
  if (!title) {
    if (error) { error.hidden = false; error.textContent = 'Give this wish a title.'; }
    return;
  }
  let retail;
  let floor;
  try {
    retail = readOptionalPrice('#promoteRetail');
    floor = readOptionalPrice('#promoteFloor');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    return;
  }
  if (retail === 0) retail = null;
  if (floor === 0) floor = null;
  if (retail === null && floor !== null) retail = floor;
  if (floor === null && retail !== null) floor = retail;
  const captured = pending.capturedPrice;
  const status = retail === null && floor === null
    ? 'missing'
    : (captured !== null && retail === captured && floor === captured ? 'captured' : 'manual');
  let bestSource = $('#promoteSource') ? $('#promoteSource').value.trim() : '';
  if (status !== 'captured' && (!bestSource || bestSource === pending.best_source)) {
    bestSource = status === 'manual' ? 'Entered during pre-gate review' : '';
  }
  const btn = $('#promoteSubmit');
  busy(btn, true, 'Starting gate');
  try {
    await postJSON('/api/promote-bookmark', {
      id,
      url,
      details: {
        title,
        brand: $('#promoteBrand') ? $('#promoteBrand').value.trim() : '',
        category: $('#promoteCategory') ? $('#promoteCategory').value : (pending.category || ''),
        retail_price: retail,
        lowest_verified_price: floor,
        captured_price: captured,
        image: pending.image || '',
        best_source: bestSource,
        price_source: pending.price_source || 'none',
        price_confidence: pending.price_confidence || '',
        price_reason: pending.price_reason || '',
        capture_mode: pending.capture_mode || ''
      }
    });
    closePromotionReview();
    if (!id && $('#quickAddUrl')) $('#quickAddUrl').value = '';
    await refreshVault();
    setTab('wishlist');
    if (status === 'captured') toast(`Price confirmed at ${money(floor, 2)}. The 14-day gate starts now.`);
    else if (status === 'manual') toast(`Reviewed price ${money(floor, 2)} saved as manual. The 14-day gate starts now.`);
    else toast('Gate started with the price marked pending. Add it from the card so the budget impact is real.', 'warn');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

function linkFromClipboard(text) {
  const match = String(text || '').match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[),.;]+$/, '') : '';
}

function normalizeCaptureUrl(value) {
  let raw = String(value || '').trim();
  if (!/^https?:\/\//i.test(raw)) {
    try { raw = decodeURIComponent(raw); } catch (_) {}
  }
  return linkFromClipboard(raw);
}

function snapshotFromSearch(search) {
  const params = new URLSearchParams(search || '');
  const snapshot = {};
  ['title', 'brand', 'price', 'currency', 'image', 'price_source', 'price_confidence', 'price_reason', 'page_title'].forEach((key) => {
    const value = params.get(`capture_${key}`);
    if (value) snapshot[key] = value;
  });
  return Object.keys(snapshot).length ? snapshot : null;
}

async function reviewProductLink(value, btn, snapshot = null) {
  const input = $('#quickAddUrl');
  const url = normalizeCaptureUrl(value);
  if (!url) {
    toast('Paste a full http(s) product link first.', 'warn');
    if (input) input.focus();
    return false;
  }
  if (input) input.value = url;
  busy(btn, true, 'Reading page');
  try {
    const payload = { url };
    if (snapshot && Object.keys(snapshot).length) payload.snapshot = snapshot;
    const data = await postJSON('/api/bookmark-preview', payload);
    if (data.already_exists) {
      toast('That link is already inside the impulse gate.');
      return true;
    }
    if (!data.preview) throw new Error('The page preview did not return any details.');
    openPromotionReview(data.preview, data.possible_duplicates);
    return true;
  } catch (err) {
    toast(err.message, 'err');
    return false;
  } finally {
    busy(btn, false);
  }
}

async function quickAddLink(event) {
  event.preventDefault();
  const input = $('#quickAddUrl');
  await reviewProductLink(input ? input.value : '', $('#quickAddBtn'));
}

function collectPageSnapshot() {
  const clean = (value, max) => String(value === undefined || value === null ? '' : value)
    .replace(/\s+/g, ' ').trim().slice(0, max);
  const parsePrice = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const text = String(value).replace(/\u00a0/g, ' ').trim();
    const match = text.match(/-?\d[\d.,]*/);
    if (!match) return null;
    let normalized = match[0].replace(/[.,]$/, '');
    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');
    if (lastComma > lastDot && /,\d{1,2}$/.test(normalized)) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
    const number = Number(normalized);
    return Number.isFinite(number) && number > 0 && number < 1e9
      ? Math.round((number + Number.EPSILON) * 100) / 100
      : null;
  };
  const currencyOf = (value) => {
    const key = String(value || '').trim().toUpperCase();
    const aliases = { '$': 'USD', 'US$': 'USD', USD: 'USD', '£': 'GBP', GBP: 'GBP', '€': 'EUR', EUR: 'EUR', 'C$': 'CAD', CAD: 'CAD', 'A$': 'AUD', AUD: 'AUD' };
    if (aliases[key]) return aliases[key];
    const code = key.replace(/[^A-Z]/g, '').slice(0, 3);
    return code.length === 3 ? code : '';
  };
  const currencyFromText = (value) => {
    const text = String(value || '');
    if (/£|GBP/i.test(text)) return 'GBP';
    if (/€|EUR/i.test(text)) return 'EUR';
    if (/\$|USD/i.test(text)) return 'USD';
    return '';
  };
  const nameOf = (value) => {
    if (Array.isArray(value)) return nameOf(value[0]);
    if (value && typeof value === 'object') return clean(value.name || value['@id'], 160);
    return clean(value, 160);
  };
  const imageOf = (value) => {
    if (Array.isArray(value)) return imageOf(value[0]);
    if (value && typeof value === 'object') return String(value.url || value.contentUrl || value['@id'] || '');
    return String(value || '');
  };
  const metas = new Map();
  document.querySelectorAll('meta[content]').forEach((el) => {
    const key = String(el.getAttribute('property') || el.getAttribute('name') || el.getAttribute('itemprop') || '').trim().toLowerCase();
    const value = el.getAttribute('content') || '';
    if (key && value && !metas.has(key)) metas.set(key, value);
  });
  const nodes = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      const value = JSON.parse(script.textContent || '');
      if (value) nodes.push(value);
    } catch (_) {}
  });
  const products = [];
  const walk = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const type = Array.isArray(value['@type']) ? value['@type'].join(' ') : String(value['@type'] || '');
    if (/product/i.test(type)) products.push(value);
    Object.values(value).forEach(walk);
  };
  nodes.forEach(walk);
  let product = products[0] || null;
  for (const candidate of products) {
    if (candidate.offers) {
      product = candidate;
      break;
    }
  }
  let offerRange = false;
  const offerOf = (value) => {
    const offers = Array.isArray(value) ? value : [value];
    for (const offer of offers) {
      if (!offer || typeof offer !== 'object') continue;
      const direct = parsePrice(offer.price);
      if (direct !== null) {
        return {
          price: direct,
          currency: currencyOf(offer.priceCurrency) || currencyFromText(offer.price) || '',
        };
      }
      const low = parsePrice(offer.lowPrice);
      const high = parsePrice(offer.highPrice);
      if (low !== null && high !== null && low !== high) {
        offerRange = true;
        continue;
      }
      const specs = Array.isArray(offer.priceSpecification) ? offer.priceSpecification : [offer.priceSpecification];
      const specPrice = specs.map((spec) => spec && parsePrice(spec.price)).find((amount) => amount !== null);
      const specLow = specs.map((spec) => spec && parsePrice(spec.minPrice)).find((amount) => amount !== null);
      const specHigh = specs.map((spec) => spec && parsePrice(spec.maxPrice)).find((amount) => amount !== null);
      if (specPrice === undefined && specLow !== undefined && specHigh !== undefined && specLow !== specHigh) {
        offerRange = true;
        continue;
      }
      const chosen = specPrice !== undefined ? specPrice : (low !== null ? low : (specLow !== undefined ? specLow : null));
      if (chosen === null) continue;
      const specCurrency = specs.map((spec) => spec && (currencyOf(spec.priceCurrency) || currencyFromText(spec.price))).find(Boolean) || '';
      return {
        price: chosen,
        currency: currencyOf(offer.priceCurrency) || specCurrency || currencyFromText(offer.price) || '',
      };
    }
    return null;
  };
  const domPrice = () => {
    const currentToken = /(^|[-_])(sale|current|now|offer|deal|final|discount|reduced|special|clearance)([-_]|$)/i;
    const compareToken = /(^|[-_])(old|was|compare|strike|strikethrough|line-through|msrp|original)([-_]|$)/i;
    const selectedToken = /(^|[-_])(selected|is-selected|is-active)([-_]|$)/i;
    const unsupportedToken = /(^|[-_])(unselected|out-of-stock|sold-out)([-_]|$)/i;
    const financeText = /(per month|\/\s?mo(?:nth)?\b|monthly|installments?|financ(e|ing)|afterpay|klarna|affirm|sezzle|quadpay|payment plan|payments? of)/i;
    const shippingText = /(free shipping|shipping on|shipping over|delivery on|orders? over|shipping cost)/i;
    const startingText = /\b(from|starting at|starting from|as low as)\b/i;
    const unitText = /(?:\/|per)\s*(?:each|ea|unit|piece|pc|oz|fl\.?\s?oz|ml|g|kg|lb|l|ct|count|pack)\b/i;
    const rangeSeparator = /\d[\d.,]*\s*(?:-|–|—|\bto\b)\s*[$£€]?\s*\d/i;
    const compareText = /\b(was|compare at|compare to|msrp|original price)\b/i;
    const riskyContext = /(recommend|related|carousel|upsell|recently|sponsored|navigation|footer|header|cart|bundle|also-bought)/i;
    const main = document.querySelector('main, [role="main"]') || document.body;
    const heading = document.querySelector('h1');
    const headingTop = heading ? heading.getBoundingClientRect().top : null;
    const buyButton = main.querySelector('button[name="add" i], button[name*="add-to-cart" i], [data-testid*="add-to-cart" i], [data-testid*="add-to-bag" i], button[class*="add-to-cart" i], button[class*="add-to-bag" i], form[action*="cart" i] button[type="submit"], button[type="submit"][class*="buy" i]')
      || document.querySelector('button[name="add" i], [data-testid*="add-to-cart" i], [data-testid*="add-to-bag" i]');
    const buyTop = buyButton ? buyButton.getBoundingClientRect().top : null;
    const candidates = [];
    const seen = new Set();
    let sawRange = false;
    let sawStarting = false;
    let sawMultiple = false;
    const classText = (node) => `${node.className || ''} ${node.id || ''} ${node.getAttribute('aria-label') || ''}`.toLowerCase();
    const tokenHit = (node, pattern) => {
      let current = node;
      let depth = 0;
      while (current && depth < 3) {
        const tokens = classText(current).split(/\s+/).filter(Boolean);
        if (tokens.some((token) => pattern.test(token))) return true;
        current = current.parentElement;
        depth += 1;
      }
      return false;
    };
    const currencyPattern = /([$£€]\s?\d[\d.,]*)|(\d[\d.,]*\s?(?:USD|GBP|EUR|CAD|AUD))|((?:USD|GBP|EUR|CAD|AUD)\s?\d[\d.,]*)/gi;
    const exactPrice = /^[$£€]?\s*\d[\d.,]*\s*(?:USD|GBP|EUR|CAD|AUD)?$/i;
    const consider = (el, base) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|PATH|TEMPLATE)$/i.test(el.tagName)) return;
      if (el.closest('select')) return;
      const content = el.getAttribute('content') || '';
      const visible = clean(el.textContent || '', 180);
      const dataPrice = el.getAttribute('data-price') || el.getAttribute('data-product-price') || '';
      let text = clean(content || visible || el.getAttribute('aria-label') || '', 180);
      if (!text && /[.,]|[$£€]/.test(dataPrice)) text = clean(dataPrice, 180);
      if (!text || text.length > 180) return;
      if (rangeSeparator.test(text)) { sawRange = true; return; }
      if (startingText.test(text)) { sawStarting = true; return; }
      if (financeText.test(text) || shippingText.test(text)) return;
      if (/^\s*(save|savings|you save)\b/i.test(text) || compareText.test(text)) return;
      if (el.closest('del, s, [data-a-strike="true"], [data-compare-at-price], [data-was-price]') || tokenHit(el, compareToken)) return;
      const matches = text.match(currencyPattern) || [];
      let duplicateAmount = null;
      if (matches.length > 1) {
        const parsedMatches = matches.map((match) => parsePrice(match));
        if (parsedMatches.every((value) => value !== null && value === parsedMatches[0])) duplicateAmount = parsedMatches[0];
        else { sawMultiple = true; return; }
      }
      const attributeAmount = matches.length === 0 && Boolean(content || dataPrice) && /^\d[\d.,]*$/.test(text);
      if (matches.length === 0 && !attributeAmount) return;
      const amount = duplicateAmount !== null ? duplicateAmount : parsePrice(matches.length ? matches[0] : text);
      if (amount === null) return;
      const priceCurrency = (() => {
        const scope = el.closest('[itemtype]') || document;
        const node = scope.querySelector('[itemprop="priceCurrency"]');
        return currencyOf(
          (node && (node.getAttribute('content') || node.textContent))
            || el.getAttribute('data-currency')
            || el.getAttribute('data-currency-code')
            || metas.get('product:price:currency')
            || metas.get('og:price:currency')
            || metas.get('pricecurrency')
            || ''
        ) || currencyFromText(matches[0] || text);
      })();
      if (!priceCurrency) return;
      const style = window.getComputedStyle(el);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return;
      const struck = (() => {
        let node = el;
        let depth = 0;
        while (node && depth < 3) {
          const computed = node === el ? style : window.getComputedStyle(node);
          if (computed && /line-through/.test(`${computed.textDecorationLine || ''} ${computed.textDecoration || ''}`)) return true;
          node = node.parentElement;
          depth += 1;
        }
        return false;
      })();
      if (struck) return;
      const rect = el.getBoundingClientRect();
      const hasValueAttribute = Boolean(content || dataPrice);
      if (!hasValueAttribute && rect.width === 0 && rect.height === 0) return;
      let score = base;
      const label = classText(el);
      if (/price|amount|cost|money/.test(label)) score += 10;
      if (tokenHit(el, currentToken) || /\b(now|sale|clearance)\b/i.test(text)) score += 9;
      if (exactPrice.test(text)) score += 6;
      if (!content && unitText.test(text)) score -= 8;
      if (/\b(list price|retail price)\b/i.test(text)) score -= 10;
      if (el.closest('button[disabled], [aria-disabled="true"]')) score -= 14;
      let ancestor = el.parentElement;
      let depth = 0;
      let inProduct = false;
      while (ancestor && depth < 5) {
        const context = `${ancestor.className || ''} ${ancestor.id || ''} ${ancestor.tagName || ''}`.toLowerCase();
        if (riskyContext.test(context)) { score -= 22; break; }
        if (!inProduct && /(product|pdp|buy-box|buybox|product-info)/.test(context)) { score += 5; inProduct = true; }
        ancestor = ancestor.parentElement;
        depth += 1;
      }
      const selected = el.closest('[aria-checked="true"], [aria-selected="true"], [aria-pressed="true"], [aria-current="true"], [data-selected="true"], option:checked');
      if (selected || tokenHit(el, selectedToken)) score += 12;
      if (el.closest('[aria-checked="false"], [aria-selected="false"], [aria-pressed="false"], [data-selected="false"]') || tokenHit(el, unsupportedToken)) score -= 14;
      const optionLabel = el.closest('label');
      if (optionLabel) {
        const input = optionLabel.querySelector('input[type="radio"], input[type="checkbox"]');
        if (input) score += input.checked ? 12 : -14;
      }
      if (headingTop !== null && rect.height) {
        const distance = Math.abs(rect.top - headingTop);
        if (distance < 220) score += 8;
        else if (distance < 650) score += 2;
        else if (distance > 1400) score -= 5;
      }
      if (buyTop !== null && rect.height) {
        const buyDistance = Math.abs(rect.top - buyTop);
        if (buyDistance < 260) score += 9;
        else if (buyDistance > 900) score -= 4;
      }
      if (el.closest('main, [role="main"]')) score += 4;
      candidates.push({ price: amount, currency: priceCurrency, score });
    };
    document.querySelectorAll('[itemprop="price"], [data-price], [data-product-price], [data-price-amount]').forEach((el) => consider(el, 30));
    let inspected = 0;
    for (const el of main.querySelectorAll('[class*="price" i], [id*="price" i], [aria-label*="price" i], [data-testid*="price" i], [class*="money" i]')) {
      if (inspected >= 150) break;
      inspected += 1;
      consider(el, 8);
    }
    if (!candidates.length) {
      return {
        price: null,
        currency: '',
        reason: sawRange
          ? 'The page shows a price range for multiple variants. Select a variant or add the exact price.'
          : sawStarting
            ? 'The page shows a starting price ("from"). Select a variant or add the exact price.'
            : sawMultiple
              ? 'The page shows more than one price. Select a variant or add the exact price.'
              : 'No visible price was found in the product area.'
      };
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best.score < 16) {
      return { price: null, currency: '', reason: 'The visible price could not be read confidently. Add the exact price yourself.' };
    }
    const runnerUp = candidates[1];
    if (runnerUp && runnerUp.price !== best.price && best.score - runnerUp.score < 6) {
      return { price: null, currency: '', reason: 'Several variant prices are visible. Choose a variant or add the exact price.' };
    }
    return best;
  };
  const title = clean(
    nameOf(product && product.name)
      || metas.get('og:title')
      || metas.get('twitter:title')
      || (document.querySelector('h1') && document.querySelector('h1').textContent)
      || document.title,
    220
  );
  const brand = clean(
    nameOf(product && product.brand)
      || metas.get('og:site_name')
      || metas.get('application-name')
      || '',
    120
  );
  let rawImage = product ? imageOf(product.image) : '';
  rawImage = rawImage
    || metas.get('og:image:secure_url')
    || metas.get('og:image')
    || metas.get('og:image:url')
    || metas.get('twitter:image')
    || metas.get('twitter:image:src')
    || (document.querySelector('link[rel="image_src"]') && document.querySelector('link[rel="image_src"]').getAttribute('href'))
    || '';
  if (rawImage) {
    try { rawImage = new URL(rawImage, document.baseURI).href; } catch (_) { rawImage = ''; }
  }
  let price = null;
  let currency = '';
  let priceSource = 'none';
  let priceReason = '';
  const offer = product ? offerOf(product.offers) : null;
  if (offer) {
    price = offer.price;
    currency = offer.currency;
    priceSource = 'json-ld';
  }
  if (price === null) {
    const amount = metas.get('product:price:amount') || metas.get('og:price:amount') || metas.get('price') || '';
    const parsed = parsePrice(amount);
    if (parsed !== null) {
      price = parsed;
      priceSource = 'meta';
      currency = currencyOf(
        metas.get('product:price:currency') || metas.get('og:price:currency') || metas.get('pricecurrency')
      ) || currencyFromText(amount) || 'USD';
    }
  }
  if (price !== null) {
    currency = currency || 'USD';
    if (currency !== 'USD') {
      priceReason = `The page lists ${currency} ${price.toFixed(2)}; the Gate tracks USD, so enter a USD price manually.`;
      price = null;
      currency = '';
    }
  }
  if (price === null && !priceReason) {
    const fallback = domPrice();
    if (fallback && fallback.price > 0) {
      price = fallback.price;
      currency = fallback.currency || 'USD';
      priceSource = 'dom';
      if (currency !== 'USD') {
        priceReason = `The page lists ${currency} ${price.toFixed(2)}; the Gate tracks USD, so enter a USD price manually.`;
        price = null;
        currency = '';
      }
    } else if (fallback && fallback.reason) {
      priceReason = fallback.reason;
    }
  }
  if (price === null && !priceReason) {
    priceReason = offerRange
      ? 'The page lists a price range for multiple variants. Select a variant or add the exact price.'
      : 'No public price was found in the page metadata or visible price elements.';
  }
  return {
    title,
    brand,
    price: price === null ? '' : String(price),
    currency,
    price_source: priceSource,
    price_confidence: price === null ? '' : priceSource === 'dom' ? 'low' : 'high',
    price_reason: priceReason,
    image: clean(rawImage, 1200),
    page_title: clean(document.title, 220),
  };
}

function captureBookmarkletCode() {
  const target = `${location.origin}/?`;
  const keys = JSON.stringify(['title', 'brand', 'price', 'currency', 'image', 'price_source', 'price_confidence', 'price_reason', 'page_title']);
  const extractor = `(${collectPageSnapshot.toString().replace(/\s*\n\s*/g, ' ')})()`;
  return `javascript:(()=>{let d={};try{d=${extractor}||{};}catch(e){}const q=new URLSearchParams({capture:location.href});${keys}.forEach(k=>{if(d[k])q.set('capture_'+k,d[k]);});let t=${JSON.stringify(target)}+q.toString();if(t.length>7000){q.delete('capture_image');t=${JSON.stringify(target)}+q.toString();}const w=window.open(t,'stashov-capture');if(!w)location.href=t;})();`;
}

function fillCaptureDialog() {
  const code = captureBookmarkletCode();
  const link = $('#captureBookmarklet');
  if (link) link.href = code;
  if ($('#captureCode')) $('#captureCode').value = code;
  if ($('#captureOrigin')) $('#captureOrigin').textContent = location.host;
}

function openCaptureDialog() {
  const dialog = $('#captureDialog');
  if (!dialog) return;
  fillCaptureDialog();
  if (!dialog.open) dialog.showModal();
}

async function copyCaptureBookmarklet(btn) {
  const code = captureBookmarkletCode();
  try {
    await navigator.clipboard.writeText(code);
    toast('Bookmarklet code copied. Paste it into a new bookmark\u2019s URL field.');
  } catch (_) {
    const field = $('#captureCode');
    if (field) {
      field.focus();
      field.select();
    }
    toast('Copy the selected code with Ctrl/Cmd+C.', 'warn');
  }
}

async function pasteQuickAddLink() {
  const input = $('#quickAddUrl');
  const btn = $('#quickAddPaste');
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    toast('Clipboard access is not available in this browser. Paste with Ctrl/Cmd+V instead.', 'warn');
    if (input) input.focus();
    return;
  }
  busy(btn, true, 'Reading');
  try {
    const url = linkFromClipboard(await navigator.clipboard.readText());
    if (!url) {
      toast('No product link was found on the clipboard.', 'warn');
      if (input) input.focus();
      return;
    }
    if (input) {
      input.value = url;
      input.focus();
    }
    toast('Link pasted. Check it, then read the page.');
  } catch (_) {
    toast('Clipboard access was blocked. Paste with Ctrl/Cmd+V instead.', 'warn');
    if (input) input.focus();
  } finally {
    busy(btn, false);
  }
}

async function importVaultFile(file) {
  const status = $('#dataStatus');
  if (!file) return;
  if (file.size > 40 * 1024 * 1024) {
    toast('That backup is larger than 40 MB. Restore it from the server if it is genuine.', 'err');
    return;
  }
  if (status) status.textContent = `Reading ${file.name}…`;
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (_) {
    if (status) status.textContent = 'That file is not valid JSON.';
    toast('That file is not valid JSON.', 'err');
    return;
  }
  const incoming = payload && payload.vault && typeof payload.vault === 'object' ? payload.vault : payload;
  const counts = incoming && [
    ['bookmarks', Array.isArray(incoming.bookmarks) ? incoming.bookmarks.length : null],
    ['wishes', Array.isArray(incoming.wishlist) ? incoming.wishlist.length : null],
    ['routines', Array.isArray(incoming.protocols) ? incoming.protocols.length : null],
  ].filter(([, count]) => count !== null);
  if (!counts || counts.length < 3) {
    if (status) status.textContent = 'That file does not look like a Stashov vault.';
    toast('That file does not look like a Stashov vault.', 'err');
    return;
  }
  const summary = counts.map(([label, count]) => `${fmt(count)} ${label}`).join(', ');
  if (!window.confirm(`Restore ${summary}?\n\nThis replaces the current vault. A timestamped snapshot is saved in data/backups before the import.`)) {
    if (status) status.textContent = 'Restore cancelled. Nothing changed.';
    return;
  }
  if (status) status.textContent = 'Restoring and snapshotting the current vault…';
  try {
    await postJSON('/api/import', payload);
    await loadSections();
    await refreshVault(true);
    state.library.loaded = false;
    state.library.items = [];
    await loadBookmarks(true);
    if (state.tab === 'library') await loadLibrary(true);
    if (status) status.textContent = `Restored ${summary}. A pre-import snapshot is in data/backups.`;
    toast(`Vault restored: ${summary}.`);
  } catch (err) {
    if (status) status.textContent = err.message;
    toast(err.message, 'err');
  }
}

async function syncBookmarks(btn) {
  busy(btn, true, 'Scanning profiles');
  try {
    const data = await postJSON('/api/bookmarks/sync', {});
    toast(`Synced ${fmt(data.total_unique)} unique bookmarks from ${(data.browsers_synced || []).join(', ')}.`);
    await refreshVault();
    await loadBookmarks(true);
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

/* ————— REFERENCE LIBRARY ————— */
function librarySectionMeta(id) {
  return (state.library.sections || []).find((section) => section.id === id) || {
    id, label: id || 'Reference', color: '#8ab4ff', use_for: 'reference material.'
  };
}

function libraryStatus(status) {
  return ({
    ok: ['LIVE', 'is-live'],
    blocked: ['BOT-BLOCKED', 'is-blocked'],
    error: ['NEEDS REVIEW', 'is-error'],
    timeout: ['TIMEOUT', 'is-error'],
    dead: ['DEAD', 'is-dead'],
    unchecked: ['UNCHECKED', 'is-unchecked']
  })[status] || ['UNCHECKED', 'is-unchecked'];
}

function libraryChecked(value) {
  if (!value) return 'NOT CHECKED';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'CHECKED';
  return 'CHECKED ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function renderLibrarySections() {
  const nav = $('#librarySections');
  if (!nav) return;
  const sections = state.library.sections || [];
  const total = state.library.libraryTotal || sections.reduce((sum, section) => sum + section.count, 0);
  const chips = [{ id: 'ALL', label: 'All sections', count: total }, ...sections];
  nav.innerHTML = chips.map((section) => `
    <button type="button" class="filter-chip ${state.library.section === section.id ? 'is-active' : ''}" data-library-section="${esc(section.id)}" aria-pressed="${state.library.section === section.id}">${esc(section.label)} <b>${fmt(section.count)}</b></button>
  `).join('');
}

function libraryCardMarkup(item, index) {
  const section = librarySectionMeta(item.library_section);
  const status = libraryStatus(item.site_status);
  const article = /^(education|ai)/.test(section.id || '') ? 'an' : 'a';
  const description = item.description
    || `${item.title || item.domain || 'This site'} — ${article} ${String(section.label || 'reference').toLowerCase()} resource.`;
  const useFor = item.use_for || section.use_for || 'reference material.';
  const url = safeUrl(item.url);
  const selected = state.library.selected.includes(item.id);
  const archived = Boolean(item.archived || item.library_archived);
  return `
  <article class="library-card ${selected ? 'is-selected' : ''} ${archived ? 'is-archived' : ''}" data-library-id="${esc(item.id)}" style="--library-tone:${esc(section.color || '#8ab4ff')};--i:${Math.min(index, 10)}">
    <div class="library-card-top">
      ${state.library.selectMode ? `<label class="library-pick"><input type="checkbox" data-library-pick="${esc(item.id)}" aria-label="Select ${esc(item.title || item.domain || 'link')}" ${selected ? 'checked' : ''} /><span aria-hidden="true"><svg class="icon"><use href="#i-check"/></svg></span></label>` : ''}
      <span class="library-domain" title="${esc(item.domain || '')}">${esc(item.domain || 'unknown')}</span>
      <span class="library-status ${archived ? 'is-dead' : status[1]}">${archived ? 'ARCHIVED' : status[0]}</span>
    </div>
    <h3><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.title || item.domain || 'Untitled reference')}</a></h3>
    <p class="library-description">${esc(description)}</p>
    <p class="library-use"><b>USE FOR</b> ${esc(useFor)}</p>
    <div class="library-card-foot">
      <span class="tag">${esc(section.label)}</span>
      <span class="library-checked">${esc(libraryChecked(item.last_checked))}</span>
      <span class="library-card-actions">
        ${archived ? `<button type="button" class="mini-btn" data-library-restore="${esc(item.id)}" aria-label="Restore ${esc(item.title || item.domain || 'site')}" title="Restore to library"><svg class="icon"><use href="#i-refresh"/></svg></button>` : ''}
        <button type="button" class="mini-btn" data-library-edit="${esc(item.id)}" aria-label="Edit note for ${esc(item.title || item.domain || 'site')}" title="Edit note"><svg class="icon"><use href="#i-edit"/></svg></button>
        <a class="mini-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(item.title || item.domain || 'site')}" title="Open site"><svg class="icon"><use href="#i-external"/></svg></a>
      </span>
    </div>
  </article>`;
}

function renderLibrary() {
  const grid = $('#libraryGrid');
  if (!grid) return;
  const L = state.library;
  if (L.loading && !L.items.length) {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = Array.from({ length: 6 }).map(() => `
      <div class="skeleton-card library-skeleton" aria-hidden="true">
        <div class="skeleton-line w40"></div><div class="skeleton-line w90"></div>
        <div class="skeleton-line w70"></div><div class="skeleton-line w70"></div>
        <div class="skeleton-line w40"></div>
      </div>`).join('');
  } else if (!L.items.length) {
    grid.innerHTML = `<div class="empty-state"><svg class="icon"><use href="#i-book"/></svg><h3>No reference links matched</h3><p>Try a broader search, another section, or clear the status filter. Product and store links stay in the Vault.</p><button type="button" class="btn ghost sm" id="libraryClear">Clear filters</button></div>`;
    const clear = $('#libraryClear');
    if (clear) clear.addEventListener('click', () => {
      L.section = 'ALL';
      L.q = '';
      L.status = 'ALL';
      if ($('#librarySearch')) $('#librarySearch').value = '';
      if ($('#libraryStatusFilter')) $('#libraryStatusFilter').value = 'ALL';
      loadLibrary(true);
    });
  } else {
    grid.innerHTML = L.items.map((item, index) => libraryCardMarkup(item, index)).join('');
  }
  grid.setAttribute('aria-busy', String(Boolean(L.loading)));

  const count = L.total;
  const filteredSection = L.section === 'ALL' ? 'ALL SECTIONS' : String(librarySectionMeta(L.section).label || L.section).toUpperCase();
  if ($('#libraryResultCount')) {
    $('#libraryResultCount').textContent = `Showing ${fmt(L.items.length)} of ${fmt(count)} reference links${L.q ? ` for “${L.q}”` : ''}.`;
  }
  if ($('#libraryActiveSection')) $('#libraryActiveSection').textContent = filteredSection;
  if ($('#libraryCount')) $('#libraryCount').textContent = fmt(L.libraryTotal);
  const more = $('#libraryMoreBtn');
  if (more) more.hidden = L.items.length >= L.total || !L.total;

  const stamp = $('#libraryAuditStamp');
  if (stamp) {
    if (L.meta && L.meta.run_at) {
      const date = new Date(L.meta.run_at);
      stamp.textContent = `AUDITED ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()} · ${fmt(L.meta.live || 0)} LIVE`;
    } else {
      stamp.textContent = 'AWAITING AUDIT';
    }
  }

  updateLibraryBulk();
}

function updateLibraryBulk() {
  const L = state.library;
  const count = L.selected.length;
  const bulk = $('#libraryBulk');
  if (bulk) bulk.hidden = !L.selectMode;
  if ($('#libraryBulkCount')) $('#libraryBulkCount').textContent = fmt(count);
  const selectBtn = $('#librarySelectBtn');
  if (selectBtn) {
    selectBtn.setAttribute('aria-pressed', String(L.selectMode));
    selectBtn.innerHTML = L.selectMode
      ? '<svg class="icon"><use href="#i-check"/></svg> Done'
      : '<svg class="icon"><use href="#i-check"/></svg> Select';
  }
  const archiveBtn = $('#libraryBulkArchive');
  const restoreBtn = $('#libraryBulkRestore');
  const moveBtn = $('#libraryBulkMove');
  const moveSelect = $('#libraryBulkSection');
  const archivedView = L.status === 'archived';
  if (archiveBtn) archiveBtn.hidden = archivedView;
  if (restoreBtn) restoreBtn.hidden = !archivedView;
  if (moveBtn) moveBtn.disabled = !count;
  if (moveSelect) moveSelect.disabled = !count;
  for (const btn of [archiveBtn, restoreBtn]) if (btn) btn.disabled = !count;
  const dupeBadge = $('#libraryDupeCount');
  if (dupeBadge) {
    dupeBadge.hidden = !L.duplicateExtra;
    dupeBadge.textContent = fmt(L.duplicateExtra);
    dupeBadge.title = `${fmt(L.duplicateExtra)} extra cop${L.duplicateExtra === 1 ? 'y' : 'ies'}`;
  }
  syncLibraryBulkSections();
}

function syncLibraryBulkSections() {
  const select = $('#libraryBulkSection');
  if (!select) return;
  const current = select.value;
  const sections = state.library.sections || [];
  select.innerHTML = sections.length
    ? sections.map((section) => `<option value="${esc(section.id)}">${esc(section.label)}</option>`).join('')
    : '<option value="">No sections</option>';
  if (current && sections.some((section) => section.id === current)) select.value = current;
}

async function openLibraryDuplicates() {
  const dialog = $('#duplicateDialog');
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  const body = $('#duplicateBody');
  if (body) body.innerHTML = '<p class="duplicate-empty">Scanning the library for repeat URLs…</p>';
  if ($('#duplicateClean')) $('#duplicateClean').disabled = true;
  try {
    const data = await getJSON('/api/library/duplicates');
    state.library.duplicates = data;
    state.library.duplicateExtra = Number(data.extra) || 0;
    renderLibraryDuplicates();
    updateLibraryBulk();
  } catch (error) {
    if (body) body.innerHTML = `<p class="duplicate-empty">Could not check for duplicates: ${esc(error.message)}</p>`;
    toast(error.message, 'err');
  }
}

function renderLibraryDuplicates() {
  const data = state.library.duplicates;
  const body = $('#duplicateBody');
  if (!body || !data) return;
  const groups = Array.isArray(data.groups) ? data.groups : [];
  if ($('#duplicateSummary')) {
    $('#duplicateSummary').textContent = groups.length
      ? `${fmt(groups.length)} page${groups.length === 1 ? '' : 's'} saved more than once — ${fmt(data.extra)} extra cop${data.extra === 1 ? 'y' : 'ies'} can be archived.`
      : 'No duplicate links. The library is clean.';
  }
  if (!groups.length) {
    body.innerHTML = '<div class="duplicate-empty"><svg class="icon"><use href="#i-check"/></svg><p>Every reference link points at a unique page.</p></div>';
    if ($('#duplicateClean')) $('#duplicateClean').disabled = true;
    return;
  }
  body.innerHTML = groups.map((group, groupIndex) => `
    <section class="duplicate-group" data-duplicate-group="${groupIndex}">
      <header>
        <span class="library-domain">${esc(group.items[0].library_label || 'Reference')}</span>
        <span class="library-status is-blocked">${group.items.length} COPIES</span>
      </header>
      <h3>${esc(group.title)}</h3>
      <ul>
        ${group.items.map((item, itemIndex) => `
          <li>
            <label class="duplicate-choice">
              <input type="radio" name="duplicate-keep-${groupIndex}" value="${esc(item.id)}" ${itemIndex === 0 ? 'checked' : ''} />
              <span class="duplicate-choice-copy"><b>${esc(item.title || item.domain || 'Untitled')}</b><small>${esc(item.domain || 'unknown')} · ${esc(libraryStatus(item.site_status)[0])}</small></span>
            </label>
          </li>`).join('')}
      </ul>
    </section>`).join('');
  if ($('#duplicateClean')) {
    $('#duplicateClean').disabled = false;
    $('#duplicateClean').innerHTML = `<svg class="icon"><use href="#i-check"/></svg> Archive ${fmt(data.extra)} extra cop${data.extra === 1 ? 'y' : 'ies'}`;
  }
}

async function archiveDuplicateExtras(btn) {
  const data = state.library.duplicates;
  if (!data || !Array.isArray(data.groups) || !data.groups.length) return;
  const extras = [];
  data.groups.forEach((group, groupIndex) => {
    const checked = document.querySelector(`input[name="duplicate-keep-${groupIndex}"]:checked`);
    const keep = checked ? checked.value : group.items[0].id;
    for (const item of group.items) if (item.id !== keep) extras.push(item.id);
  });
  if (!extras.length) {
    toast('Every duplicate group already has a single keeper.', 'warn');
    return;
  }
  busy(btn, true, 'Archiving');
  try {
    const result = await postJSON('/api/library/bulk', { action: 'archive', ids: extras });
    toast(`${fmt(result.updated)} extra cop${result.updated === 1 ? 'y' : 'ies'} archived. Recover them under Archived.`);
    const dialog = $('#duplicateDialog');
    if (dialog && dialog.open) dialog.close();
    state.library.duplicates = null;
    await loadLibrary(true);
    await openLibraryDuplicates();
  } catch (error) {
    toast(error.message, 'err');
  } finally {
    busy(btn, false);
  }
}

async function bulkLibrary(action, ids, extra = {}) {
  if (!ids.length) {
    toast('Select at least one reference link first.', 'warn');
    return false;
  }
  try {
    const result = await postJSON('/api/library/bulk', { action, ids, ...extra });
    const label = action === 'archive' ? 'archived' : action === 'restore' ? 'restored' : 'moved';
    toast(`${fmt(result.updated)} link${result.updated === 1 ? '' : 's'} ${label}.`);
    if (action === 'archive') state.library.status = 'archived';
    if ($('#libraryStatusFilter')) $('#libraryStatusFilter').value = state.library.status;
    state.library.selected = [];
    syncHash();
    await loadLibrary(true);
    return true;
  } catch (error) {
    toast(error.message, 'err');
    return false;
  }
}

async function loadLibrary(reset) {
  const L = state.library;
  const seq = ++L.seq;
  if (L.abort) L.abort.abort();
  const controller = new AbortController();
  L.abort = controller;
  const qInput = $('#librarySearch');
  const statusInput = $('#libraryStatusFilter');
  L.q = qInput ? qInput.value.trim() : L.q;
  L.status = statusInput ? statusInput.value : L.status;
  if (state.tab === 'library') syncHash();
  L.loading = true;
  if (reset) {
    L.items = [];
    L.total = 0;
    L.loaded = false;
    L.selected = [];
    renderLibrarySections();
  }
  renderLibrary();
  const params = new URLSearchParams({
    section: L.section,
    status: L.status,
    q: L.q,
    limit: String(L.limit),
    offset: String(reset ? 0 : L.items.length)
  });
  try {
    const data = await getJSON('/api/library?' + params.toString(), { signal: controller.signal });
    if (seq !== L.seq) return;
    L.total = Number(data.total) || 0;
    L.libraryTotal = Number(data.library_total) || 0;
    L.archivedTotal = Number(data.archived_total) || 0;
    L.duplicateExtra = Number(data.duplicate_extra) || 0;
    L.sections = Array.isArray(data.sections) ? data.sections : [];
    L.meta = data.meta || null;
    L.items = reset ? (data.items || []) : L.items.concat(data.items || []);
    L.loaded = true;
    renderLibrarySections();
    renderLibrary();
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (seq !== L.seq) return;
    L.items = reset ? [] : L.items;
    renderLibrary();
    toast(err.message, 'err');
  } finally {
    if (L.abort === controller) L.abort = null;
    L.loading = false;
    if (seq === L.seq) renderLibrary();
  }
}

function openLibraryEdit(id) {
  const item = state.library.items.find((entry) => entry.id === id);
  const dialog = $('#libraryEditDialog');
  if (!item || !dialog) return;
  state.library.editingId = id;
  if ($('#libraryEditId')) $('#libraryEditId').value = id;
  if ($('#libraryEditMeta')) {
    $('#libraryEditMeta').innerHTML = `<span>${esc(item.domain || '')}</span><strong>${esc(item.title || item.domain || 'Reference')}</strong>`;
  }
  const select = $('#libraryEditSection');
  if (select) {
    const sections = state.library.sections.length ? state.library.sections : [{ id: item.library_section, label: item.library_label || item.library_section }];
    select.innerHTML = sections.map((section) => `<option value="${esc(section.id)}">${esc(section.label)}</option>`).join('');
    select.value = item.library_section || (sections[0] && sections[0].id) || '';
  }
  if ($('#libraryEditDescription')) $('#libraryEditDescription').value = item.description || '';
  if ($('#libraryEditUse')) $('#libraryEditUse').value = item.use_for || '';
  const open = $('#libraryEditOpen');
  if (open) open.href = safeUrl(item.url);
  const error = $('#libraryEditError');
  if (error) error.hidden = true;
  if (!dialog.open) dialog.showModal();
}

async function saveLibraryEdit(event) {
  event.preventDefault();
  const id = $('#libraryEditId') ? $('#libraryEditId').value : '';
  if (!id) return;
  const error = $('#libraryEditError');
  const btn = $('#libraryEditSave');
  const payload = {
    description: $('#libraryEditDescription') ? $('#libraryEditDescription').value.trim() : '',
    use_for: $('#libraryEditUse') ? $('#libraryEditUse').value.trim() : '',
    library_section: $('#libraryEditSection') ? $('#libraryEditSection').value : ''
  };
  busy(btn, true, 'Saving');
  try {
    await putJSON(`/api/library/${encodeURIComponent(id)}`, payload);
    const dialog = $('#libraryEditDialog');
    if (dialog && dialog.open) dialog.close();
    toast('Library note saved.');
    await loadLibrary(true);
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

/* ————— WISHLIST ————— */
function gateStatusOf(wish) {
  if (wish.status === 'bought' || wish.status === 'skipped') return wish.status;
  if (wish.status === 'snoozed') return 'snoozed';
  if (wish.status === 'ready') return 'ready';
  if (wish.status === 'cooling') return 'cooling';
  return Number(wish.cooling_off_days_left) === 0 ? 'ready' : 'cooling';
}

function isArchivedWish(wish) {
  const status = gateStatusOf(wish);
  return status === 'bought' || status === 'skipped';
}

function gateStatusLabel(wish) {
  const status = gateStatusOf(wish);
  if (status === 'ready') return 'Ready — gate cleared';
  if (status === 'bought') return 'Bought';
  if (status === 'skipped') return 'Skipped';
  const left = Math.max(0, Number(wish.cooling_off_days_left) || 0);
  if (status === 'snoozed') return `Snoozed (${left} ${left === 1 ? 'day' : 'days'} left)`;
  return `Cooling Off (${left} ${left === 1 ? 'day' : 'days'} left)`;
}

function renderWishlistView(v) {
  const wishlist = v.wishlist || [];
  const statusCounts = { cooling: 0, ready: 0, snoozed: 0, bought: 0, skipped: 0 };
  wishlist.forEach((wish) => { statusCounts[gateStatusOf(wish)] += 1; });
  const activeCount = statusCounts.cooling + statusCounts.ready + statusCounts.snoozed;

  const statusBar = $('#gateStatusbar');
  if (statusBar) {
    const chips = [
      ['active', 'Active', activeCount],
      ['ready', 'Ready', statusCounts.ready],
      ['cooling', 'Cooling', statusCounts.cooling],
      ['snoozed', 'Snoozed', statusCounts.snoozed],
      ['history', 'History', statusCounts.bought + statusCounts.skipped]
    ];
    statusBar.innerHTML = chips.map(([key, label, count]) => `
      <button type="button" class="filter-chip gate-status-chip ${state.gateFilter === key ? 'is-active' : ''}" data-gate-filter="${key}" aria-pressed="${state.gateFilter === key}">${label} <b>${count}</b></button>
    `).join('');
  }

  const filters = $('#verdictFilters');
  if (filters) {
    const counts = { ALL: wishlist.length, good: 0, warn: 0, bad: 0 };
    wishlist.forEach((w) => { counts[verdictTone(w.verdict)] += 1; });
    const chips = [
      ['ALL', 'All verdicts'],
      ['good', 'Approved'],
      ['warn', 'Cooling'],
      ['bad', 'Blocked']
    ];
    filters.innerHTML = chips.map(([key, label]) => `
      <button type="button" class="filter-chip ${state.verdict === key ? 'is-active' : ''}" data-verdict="${key}" aria-pressed="${state.verdict === key}">${label} <b>${counts[key]}</b></button>
    `).join('');
  }

  const grid = $('#wishlistGrid');
  if (!grid) return;
  const visible = wishlist
    .filter((w) => {
      const status = gateStatusOf(w);
      if (state.gateFilter === 'active') return status !== 'bought' && status !== 'skipped';
      if (state.gateFilter === 'history') return status === 'bought' || status === 'skipped';
      return status === state.gateFilter;
    })
    .filter((w) => state.verdict === 'ALL' || verdictTone(w.verdict) === state.verdict);
  if (!visible.length) {
    const copy = state.gateFilter === 'history'
      ? 'No purchases or skips logged yet. Decisions will appear here with their ledger context.'
      : state.gateFilter === 'active'
        ? 'Every active wish has been archived. Switch to History to review what you bought or skipped.'
        : 'No wishes in this lifecyle lane. Change the filter, or promote a bookmark from the signal index.';
    grid.innerHTML = `<div class="empty-state"><svg class="icon"><use href="#i-gate"/></svg><h3>No wishes in this lane</h3><p>${copy}</p></div>`;
    return;
  }
  grid.innerHTML = visible.map((w, i) => wishCard(w, wishlist.indexOf(w), i)).join('');
}

function gateRow(label, value, icon, warnPattern) {
  const warn = warnPattern && warnPattern.test(String(value || ''));
  return `<div class="gate-check ${warn ? 'is-warn' : ''}"><svg class="icon"><use href="#${icon}"/></svg><b>${label}</b><span>${esc(value || '—')}</span></div>`;
}

function priceSparkline(w) {
  const history = (Array.isArray(w.price_history) ? w.price_history : [])
    .filter((point) => Number(point && point.price) > 0)
    .slice(-14);
  if (!history.length) return '';
  const prices = history.map((point) => Number(point.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const points = prices.map((price, index) => {
    const x = history.length === 1 ? 0 : (index / (history.length - 1)) * 164;
    const y = max === min ? 18 : 30 - ((price - min) / (max - min)) * 24;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const spark = history.length >= 2
    ? `<svg class="price-spark" viewBox="0 0 164 36" role="img" aria-label="Observed price history. Low ${esc(money(min, 2))}, high ${esc(money(max, 2))}."><polyline points="${points}" /></svg>`
    : '';
  return `<div class="price-history ${history.length < 2 ? 'is-single' : ''}">
    ${spark}
    <div class="price-history-copy"><span>LOWEST SEEN <b>${esc(money(w.lowest_seen_price || min, 2))}</b></span><span>${history.length} observation${history.length === 1 ? '' : 's'} · checked ${esc(validStamp(w.price_checked_at || history[history.length - 1].at))}</span></div>
  </div>`;
}

function wishCard(w, originalIndex, renderIndex) {
  const tone = verdictTone(w.verdict);
  const status = gateStatusOf(w);
  const archived = status === 'bought' || status === 'skipped';
  const canBuy = status === 'ready';
  const coolingLeft = Math.max(0, Number(w.cooling_off_days_left) || 0);
  const coolingTotal = Math.max(1, Number(w.cooling_off_days) || 14);
  let coolingProgress = 0;
  if (status === 'snoozed' && w.snoozed_at && w.snoozed_until) {
    const start = Date.parse(w.snoozed_at);
    const end = Date.parse(w.snoozed_until);
    coolingProgress = end > start ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : 0;
  } else if (status === 'cooling') {
    coolingProgress = Math.min(100, Math.max(0, ((coolingTotal - coolingLeft) / coolingTotal) * 100));
  }
  const retailValue = Math.max(0, Number(w.retail_price) || 0);
  const floorValue = Math.max(0, Number(w.lowest_verified_price) || 0);
  const hasPrice = retailValue > 0 || floorValue > 0;
  const retail = Math.max(1, retailValue);
  const floor = floorValue;
  const pct = Math.min(100, Math.max(0, (floor / retail) * 100));
  const saving = Math.max(0, retail - floor);
  const image = safeImage(w.image);
  const initial = String(w.title || '?').trim().charAt(0).toUpperCase() || '?';
  const target = Number(w.target_price) > 0 ? Number(w.target_price) : null;
  const targetHit = target !== null && floorValue > 0 && floorValue <= target;
  const archivedNote = status === 'bought'
    ? `Bought for ${money(w.purchase_price ?? w.lowest_verified_price, 2)}${w.purchase_source ? ' · ' + esc(w.purchase_source) : ''}`
    : `Skipped${w.skip_reason ? ' · ' + esc(w.skip_reason) : ''}`;
  const removeButton = status === 'bought'
    ? ''
    : `<button type="button" class="btn quiet sm gate-remove" data-gate-remove="${esc(w.id)}" aria-label="Remove ${esc(w.title)} from the Gate" title="Delete this wish and unlink it from every routine. Purchases already in the ledger are never deleted."><svg class="icon"><use href="#i-trash"/></svg>Remove</button>`;
  const actionMarkup = archived
    ? `<div class="gate-archived"><div class="gate-archived-note"><svg class="icon"><use href="#${status === 'bought' ? 'i-check' : 'i-x'}"/></svg><span>${archivedNote}</span></div><button type="button" class="btn ghost sm" data-gate-action="reopen" data-gate-id="${esc(w.id)}"><svg class="icon"><use href="#i-refresh"/></svg>Reopen</button>${removeButton}</div>`
    : `<div class="gate-actions" role="group" aria-label="Gate actions for ${esc(w.title)}">
        <button type="button" class="btn sm gate-buy" data-gate-action="buy" data-gate-id="${esc(w.id)}" ${canBuy ? '' : 'disabled'} title="${canBuy ? 'Record this purchase in the spend ledger' : `Locked for ${coolingLeft} more ${coolingLeft === 1 ? 'day' : 'days'}`}"><svg class="icon"><use href="#i-coin"/></svg>${canBuy ? 'Buy' : `Locked ${coolingLeft}d`}</button>
        <button type="button" class="btn ghost sm" data-gate-action="snooze" data-gate-id="${esc(w.id)}" aria-label="Snooze ${esc(w.title)}"><svg class="icon"><use href="#i-clock"/></svg>Snooze</button>
        <button type="button" class="btn quiet sm" data-gate-action="skip" data-gate-id="${esc(w.id)}" aria-label="Skip ${esc(w.title)}"><svg class="icon"><use href="#i-x"/></svg>Skip</button>
        ${removeButton}
      </div>`;
  const lowConfidence = hasPrice && w.price_confidence === 'low';
  const priceMarkup = hasPrice
    ? `<div class="price-block">
      <div class="price-top">
        <div><span class="price-label">${lowConfidence ? 'LOW-CONFIDENCE PAGE PRICE' : w.price_status === 'captured' ? 'OBSERVED PAGE PRICE' : 'BEST VERIFIED FLOOR'}</span><span class="price-floor">${money(floor, 2)}</span></div>
        <span class="save-pill">${saving > 0 ? 'SAVE ' + money(saving) : lowConfidence ? 'VERIFY PRICE' : w.price_status === 'captured' ? 'CAPTURED' : 'AT THE FLOOR'}</span>
      </div>
      <div class="price-rail" aria-hidden="true"><i class="rail-retail"></i><i class="rail-floor" style="width:${pct}%"></i></div>
      <div class="price-foot"><span>${money(retail, 0)} retail</span><span>${w.cost_per_use ? money(w.cost_per_use, 2) + ' / use' : 'cost/use pending'}</span><span title="${esc(w.best_source || '')}">${esc(w.best_source || 'Saved discounter')}</span></div>
      ${lowConfidence ? `<p class="price-provenance is-low">Read from visible page text — verify before checkout.</p>` : w.price_status === 'captured' ? `<p class="price-provenance">Captured from the saved product page${w.price_captured_at ? ' · ' + esc(validStamp(w.price_captured_at)) : ''}${w.price_checked_at ? ' · checked ' + esc(validStamp(w.price_checked_at)) : ''}</p>` : w.price_status === 'manual' ? '<p class="price-provenance is-manual">Manual price — verify before checkout.</p>' : '<p class="price-provenance is-manual">Saved price — not verified from the page.</p>'}
      ${priceSparkline(w)}
      ${target !== null ? `<p class="price-target ${targetHit ? 'is-hit' : ''}">TARGET ${esc(money(target, 2))}${targetHit ? ' · MET' : ''}</p>` : ''}
    </div>`
    : `<div class="price-block price-missing">
      <span class="price-label">PRICE NOT CAPTURED</span>
      <strong>Add what this actually costs</strong>
      <p>${esc(w.price_note || 'No public price was readable from the saved page.')}</p>
      <button type="button" class="btn ghost sm" data-wish-edit="${esc(w.id)}"><svg class="icon"><use href="#i-edit"/></svg>Add details</button>
    </div>`;
  return `
  <article class="wish ${tone} ${archived ? 'is-archived' : ''}" data-wish-id="${esc(w.id)}" tabindex="-1" style="--i:${Math.min(renderIndex, 9)}">
    <div class="wish-media">
      <span class="media-fallback" aria-hidden="true"><strong>${esc(initial)}</strong><span>Photo pending</span></span>
      ${image ? `<img class="wish-media-bleed" src="${esc(image)}" alt="" aria-hidden="true" loading="lazy" decoding="async" /><img class="wish-media-shot" src="${esc(image)}" alt="${esc(w.title)}" loading="lazy" decoding="async" />` : ''}
      <button type="button" class="wish-photo-btn" data-wish-photo="${esc(w.id)}" aria-label="${image ? 'Change' : 'Find'} photo for ${esc(w.title)}"><svg class="icon"><use href="#i-image"/></svg><span>${image ? 'Change photo' : 'Find photo'}</span></button>
    </div>
    <div class="wish-top">
      <div class="wish-id"><span>WL-${pad(originalIndex + 1)}</span><span class="cool-chip is-${status}">${esc(gateStatusLabel(w))}</span></div>
      <div class="wish-badges">
        ${targetHit ? '<span class="target-chip is-hit" title="The captured price met your target">TARGET MET</span>' : ''}
        <span class="verdict" title="${esc(w.verdict_label || '')}">${esc(w.verdict_label || 'GATE ACTIVE')}</span>
      </div>
    </div>
    <div>
      <p class="wish-brand">${esc(w.brand || 'PRIVATE SAVE')} <span aria-hidden="true">·</span> ${esc(w.category || 'Unclustered')}</p>
      <h3 class="wish-title"><a href="${esc(safeUrl(w.url))}" target="_blank" rel="noopener noreferrer">${esc(w.title)}</a></h3>
    </div>
    ${status === 'cooling' || status === 'snoozed' ? `<div class="gate-timer is-${status}"><div><span>${status === 'snoozed' ? 'SNOOZED' : 'COOLING OFF'}</span><b>${coolingLeft} ${coolingLeft === 1 ? 'day' : 'days'} left</b></div><div class="gate-timer-rail"><i style="width:${coolingProgress}%"></i></div></div>` : ''}
    ${status === 'ready' ? '<div class="gate-ready-note"><svg class="icon"><use href="#i-check"/></svg><span>Gate cleared — decide deliberately, then log it.</span></div>' : ''}
    ${priceMarkup}
    <div class="gate-checks">
      ${gateRow('Owned', w.inventory_overlap, 'i-vault', /HIGH|DUPLICATE|OVERLAP/i)}
      ${gateRow('Routine', w.routine_compatibility, 'i-pulse', /CONFLICT|WARNING|BLOCK/i)}
      ${gateRow('Dupe', w.dupe_alternative, 'i-coin')}
    </div>
    <p class="anti-hype">${esc(w.anti_hype_summary || 'No anti-hype read captured yet.')}</p>
    ${actionMarkup}
    <div class="wish-foot">
      <button type="button" class="btn ghost sm" data-audit="${esc(w.id)}"><svg class="icon"><use href="#i-spark"/></svg> Ask the oracle</button>
      <button type="button" class="btn ghost sm" data-wish-edit="${esc(w.id)}"><svg class="icon"><use href="#i-edit"/></svg> Details</button>
      ${/^https?:\/\//i.test(String(w.url || '')) ? `<button type="button" class="btn ghost sm" data-price-refresh="${esc(w.id)}" title="Re-read the saved product page and record the price"><svg class="icon"><use href="#i-refresh"/></svg> Check price</button>` : ''}
      <a class="wish-link" href="${esc(safeUrl(w.url))}" target="_blank" rel="noopener noreferrer" aria-label="Open source for ${esc(w.title)}">Source <svg class="icon"><use href="#i-external"/></svg></a>
    </div>
  </article>`;
}

function openGateAction(id, action) {
  const item = state.vault ? (state.vault.wishlist || []).find((wish) => wish.id === id) : null;
  const dialog = $('#gateActionDialog');
  if (!item || !dialog) return;
  const status = gateStatusOf(item);
  const archived = status === 'bought' || status === 'skipped';
  if (action === 'buy' && status !== 'ready') {
    toast(`Locked for ${Math.max(0, Number(item.cooling_off_days_left) || 0)} more ${Number(item.cooling_off_days_left) === 1 ? 'day' : 'days'}.`, 'warn');
    return;
  }
  if (action === 'reopen' && !archived) {
    toast('Only bought or skipped wishes can be reopened.', 'warn');
    return;
  }
  const isBuy = action === 'buy';
  const isSnooze = action === 'snooze';
  const isSkip = action === 'skip';
  const isReopen = action === 'reopen';
  if (!isBuy && !isSnooze && !isSkip && !isReopen) return;
  if ($('#gateActionId')) $('#gateActionId').value = item.id;
  if ($('#gateActionType')) $('#gateActionType').value = action;
  if ($('#gateActionKicker')) $('#gateActionKicker').textContent = isBuy ? 'IMPULSE GATE / PURCHASE' : isSnooze ? 'IMPULSE GATE / SNOOZE' : isReopen ? 'IMPULSE GATE / REOPEN' : 'IMPULSE GATE / SKIP';
  if ($('#gateActionTitle')) $('#gateActionTitle').textContent = isBuy ? 'Record a purchase' : isSnooze ? 'Snooze this wish' : isReopen ? 'Reopen this wish' : 'Skip this wish';
  if ($('#gateActionCopy')) {
    $('#gateActionCopy').textContent = isReopen
      ? status === 'bought'
        ? `${item.title} · Bought for ${money(item.purchase_price ?? item.lowest_verified_price, 2)}. Reopening voids that purchase in the ledger and returns the wish to the gate.`
        : `${item.title} · Skipped. Reopening returns it to the gate.`
      : `${item.title} · ${gateStatusLabel(item)}`;
  }
  if ($('#gateActionSubmit')) {
    const label = isBuy ? 'Record purchase' : isSnooze ? 'Snooze wish' : isReopen ? 'Reopen wish' : 'Skip wish';
    $('#gateActionSubmit').innerHTML = `<svg class="icon"><use href="#${isReopen ? 'i-refresh' : 'i-check'}"/></svg> ${label}`;
  }
  if ($('#gateNoteLabel')) $('#gateNoteLabel').textContent = isBuy ? 'Purchase note (optional)' : isSnooze ? 'Snooze note (optional)' : isReopen ? 'Reason (optional)' : 'Why skip? (optional)';
  if ($('#gateAmountField')) $('#gateAmountField').hidden = !isBuy;
  if ($('#gateSourceField')) $('#gateSourceField').hidden = !isBuy;
  if ($('#gateDaysField')) $('#gateDaysField').hidden = !isSnooze;
  if ($('#gateNoteField')) $('#gateNoteField').hidden = false;
  if ($('#gateAmount')) $('#gateAmount').value = Number(item.lowest_verified_price) > 0 ? Number(item.lowest_verified_price).toFixed(2) : '';
  if ($('#gateSource')) $('#gateSource').value = item.best_source || '';
  if ($('#gateDays')) $('#gateDays').value = '7';
  if ($('#gateNote')) $('#gateNote').value = '';
  const error = $('#gateActionError');
  if (error) error.hidden = true;
  renderGateActionBudget();
  if (!dialog.open) dialog.showModal();
  if (isBuy && $('#gateAmount')) window.setTimeout(() => $('#gateAmount').focus(), 80);
}

async function removeGateWish(id, btn) {
  const item = state.vault ? (state.vault.wishlist || []).find((wish) => wish.id === id) : null;
  if (!item || (btn && btn.disabled)) return;
  const ok = window.confirm(`Remove “${item.title}” from the Gate?\n\nThis deletes the wish and unlinks it from every routine. Purchase history in the ledger is never deleted.`);
  if (!ok) return;
  busy(btn, true, 'Removing');
  try {
    await deleteJSON(`/api/wishlist/${encodeURIComponent(id)}`);
    await refreshVault();
    toast(`Removed “${item.title}” from the Gate.`);
  } catch (err) {
    if (btn) busy(btn, false);
    toast(err.message || 'Could not remove that wish.', 'err');
  }
}

function renderGateActionBudget() {
  const el = $('#gateBudgetPreview');
  if (!el || !state.vault) return;
  const { cap, spent, remaining } = budgetNumbers(state.vault);
  const type = $('#gateActionType') ? $('#gateActionType').value : '';
  if (type === 'buy') {
    const amount = Number($('#gateAmount') ? $('#gateAmount').value : 0) || 0;
    const after = remaining - amount;
    el.innerHTML = `<span>THIS MONTH</span><b>${money(spent, 2)} spent · ${money(remaining, 2)} left</b><small>${amount > 0 ? `After this purchase: ${money(after, 2)}${after < 0 ? ' — over budget' : ''}` : `Cap ${money(cap, 2)}`}</small>`;
  } else if (type === 'snooze') {
    el.innerHTML = '<span>SLEEP ON IT</span><b>The wish stays in the gate.</b><small>Budget is only touched when you record a purchase.</small>';
  } else if (type === 'reopen') {
    el.innerHTML = `<span>RETURN TO GATE</span><b>The purchase entry is voided, not deleted.</b><small>${money(remaining, 2)} remains available after the correction.</small>`;
  } else {
    el.innerHTML = `<span>NO SPEND</span><b>Skipping does not touch the ledger.</b><small>${money(remaining, 2)} remains available this month.</small>`;
  }
}

async function submitGateAction(event) {
  event.preventDefault();
  const id = $('#gateActionId') ? $('#gateActionId').value : '';
  const type = $('#gateActionType') ? $('#gateActionType').value : '';
  if (!id || !type) return;
  const btn = $('#gateActionSubmit');
  const error = $('#gateActionError');
  busy(btn, true, type === 'buy' ? 'Recording' : type === 'snooze' ? 'Snoozing' : type === 'reopen' ? 'Reopening' : 'Skipping');
  try {
    let data;
    if (type === 'buy') {
      const rawAmount = $('#gateAmount') ? $('#gateAmount').value : '';
      data = await postJSON(`/api/wishlist/${encodeURIComponent(id)}/buy`, {
        amount: rawAmount === '' ? undefined : Number(rawAmount),
        source: $('#gateSource') ? $('#gateSource').value : '',
        note: $('#gateNote') ? $('#gateNote').value : ''
      });
    } else if (type === 'snooze') {
      data = await postJSON(`/api/wishlist/${encodeURIComponent(id)}/snooze`, {
        days: Number($('#gateDays') ? $('#gateDays').value : 7),
        note: $('#gateNote') ? $('#gateNote').value : ''
      });
    } else if (type === 'reopen') {
      data = await postJSON(`/api/wishlist/${encodeURIComponent(id)}/reopen`, {
        reason: $('#gateNote') ? $('#gateNote').value : ''
      });
    } else {
      data = await postJSON(`/api/wishlist/${encodeURIComponent(id)}/skip`, {
        reason: $('#gateNote') ? $('#gateNote').value : ''
      });
    }
    const dialog = $('#gateActionDialog');
    if (dialog && dialog.open) dialog.close();
    await refreshVault();
    if (type === 'buy') toast(`Purchase logged: ${money(data.entry.amount, 2)}. ${money(data.budget.remaining, 2)} left this month.`);
    else if (type === 'snooze') toast(`Snoozed for ${data.days} days.`);
    else if (type === 'reopen') toast(`Wish reopened. ${money(data.budget.remaining, 2)} remains available this month.`);
    else toast('Wish skipped. It moved to History.');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

function priceInputValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toFixed(2) : '';
}

function readOptionalPrice(selector) {
  const input = $(selector);
  if (!input) return null;
  const raw = input.value.trim();
  if (raw === '') return null;
  const number = Number(raw);
  if (!Number.isFinite(number) || number < 0) throw new Error('Prices must be non-negative numbers.');
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function openWishEdit(id) {
  const item = state.vault ? (state.vault.wishlist || []).find((wish) => wish.id === id) : null;
  const dialog = $('#wishEditDialog');
  if (!item || !dialog) return;
  if ($('#wishEditId')) $('#wishEditId').value = item.id;
  if ($('#wishEditTitleInput')) $('#wishEditTitleInput').value = item.title || '';
  if ($('#wishEditBrand')) $('#wishEditBrand').value = item.brand || '';
  if ($('#wishEditRetail')) $('#wishEditRetail').value = priceInputValue(item.retail_price);
  if ($('#wishEditFloor')) $('#wishEditFloor').value = priceInputValue(item.lowest_verified_price);
  if ($('#wishEditSource')) $('#wishEditSource').value = item.best_source || '';
  if ($('#wishEditTarget')) $('#wishEditTarget').value = priceInputValue(item.target_price);
  state.wishEditOriginal = {
    retail: priceInputValue(item.retail_price),
    floor: priceInputValue(item.lowest_verified_price),
    source: item.best_source || '',
  };
  if ($('#wishEditUrl')) {
    $('#wishEditUrl').href = safeUrl(item.url);
    $('#wishEditUrl').textContent = item.url || '';
  }
  if ($('#wishEditProvenance')) {
    const when = item.price_captured_at ? ` on ${validStamp(item.price_captured_at)}` : '';
    const hasSavedPrice = Number(item.retail_price) > 0 || Number(item.lowest_verified_price) > 0;
    const text = item.price_status === 'captured'
      ? (item.price_confidence === 'low'
        ? `Low-confidence visible page price${when}. Verify before checkout.`
        : `Captured from the product page${when}.`)
      : item.price_status === 'manual'
        ? `Entered manually${when}. Verify before checkout.`
        : hasSavedPrice
          ? 'Saved before capture existed — not verified from the page. Update it to mark it manual.'
          : (item.price_note || 'No public price was captured. Add one below.');
    $('#wishEditProvenance').textContent = text;
  }
  const error = $('#wishEditError');
  if (error) error.hidden = true;
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => { if ($('#wishEditTitleInput')) $('#wishEditTitleInput').focus(); }, 60);
}

async function saveWishEdit(event) {
  event.preventDefault();
  const id = $('#wishEditId') ? $('#wishEditId').value : '';
  const title = $('#wishEditTitleInput') ? $('#wishEditTitleInput').value.trim() : '';
  const error = $('#wishEditError');
  if (!id) return;
  if (!title) {
    if (error) { error.hidden = false; error.textContent = 'Give this wish a title.'; }
    return;
  }
  let retail;
  let floor;
  let target;
  try {
    retail = readOptionalPrice('#wishEditRetail');
    floor = readOptionalPrice('#wishEditFloor');
    target = readOptionalPrice('#wishEditTarget');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    return;
  }
  if (target === 0) target = null;
  if (retail === null && floor !== null) retail = floor;
  if (floor === null && retail !== null) floor = retail;
  const btn = $('#wishEditSaveBtn');
  const original = state.wishEditOriginal || {};
  const source = $('#wishEditSource') ? $('#wishEditSource').value.trim() : '';
  const payload = {
    title,
    brand: $('#wishEditBrand') ? $('#wishEditBrand').value.trim() : '',
    target_price: target,
  };
  const retailChanged = (retail === null ? '' : retail.toFixed(2)) !== String(original.retail || '');
  const floorChanged = (floor === null ? '' : floor.toFixed(2)) !== String(original.floor || '');
  if (retailChanged || floorChanged) {
    payload.retail_price = retail;
    payload.lowest_verified_price = floor;
  }
  if (source !== String(original.source || '')) payload.best_source = source;
  busy(btn, true, 'Saving');
  try {
    await patchJSON(`/api/wishlist/${encodeURIComponent(id)}/details`, payload);
    const dialog = $('#wishEditDialog');
    if (dialog && dialog.open) dialog.close();
    await refreshVault();
    toast(retailChanged || floorChanged
      ? (retail === null ? 'Wish marked as price-pending.' : 'Wish details saved. Price is now marked as manual.')
      : 'Wish details saved. The captured price and its history are unchanged.');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

async function refreshWishPrice(id, btn) {
  if (!id || (btn && btn.disabled)) return;
  busy(btn, true, 'Checking');
  try {
    const data = await postJSON(`/api/wishlist/${encodeURIComponent(id)}/refresh-price`, {});
    await refreshVault();
    const item = data.item || {};
    if (data.changed) {
      toast(`Price moved from ${money(data.previous, 2)} to ${money(item.lowest_verified_price, 2)}. Recorded in history.`, 'warn');
    } else {
      toast(`Price still ${money(item.lowest_verified_price, 2)}. Observation recorded.`);
    }
    if (item.price_confidence === 'low') toast('That price was read from visible page text. Verify it before checkout.', 'warn');
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

function openBudgetDialog() {
  const dialog = $('#budgetDialog');
  const vault = state.vault;
  if (!dialog || !vault) return;
  const { budget } = budgetNumbers(vault);
  if ($('#budgetCapInput')) $('#budgetCapInput').value = Number(budget.cap || 0).toFixed(2);
  const counts = vault.category_counts || {};
  const categories = new Set(Object.keys(counts));
  (budget.category_breakdown || []).forEach((row) => categories.add(row.category));
  Object.keys(budget.category_budgets || {}).forEach((name) => categories.add(name));
  const ordered = Array.from(categories).filter(Boolean).sort((a, b) => {
    const diff = (Number(counts[b]) || 0) - (Number(counts[a]) || 0);
    return diff || a.localeCompare(b);
  });
  const spendByCategory = new Map((budget.category_breakdown || []).map((row) => [row.category, row]));
  const list = $('#budgetCategoryList');
  if (list) {
    list.innerHTML = ordered.length
      ? ordered.map((name) => {
          const row = spendByCategory.get(name);
          const cap = row && row.cap !== null && row.cap !== undefined ? Number(row.cap) : null;
          const spent = row ? Number(row.spent) || 0 : 0;
          return `<label class="budget-cat-row"><span class="budget-cat-name">${esc(name)}<small>${money(spent, 2)} spent this month</small></span><span class="budget-cat-input"><b>$</b><input type="number" min="0" step="0.01" inputmode="decimal" data-budget-cat="${esc(name)}" value="${cap === null ? '' : cap.toFixed(2)}" placeholder="No cap" aria-label="Monthly cap for ${esc(name)}" /></span></label>`;
        }).join('')
      : '<p class="field-note">No categories are available yet.</p>';
  }
  const error = $('#budgetError');
  if (error) error.hidden = true;
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => { if ($('#budgetCapInput')) $('#budgetCapInput').focus(); }, 60);
}

async function saveBudget(event) {
  event.preventDefault();
  const capRaw = $('#budgetCapInput') ? $('#budgetCapInput').value.trim() : '';
  const cap = Number(capRaw);
  const error = $('#budgetError');
  if (capRaw === '' || !Number.isFinite(cap) || cap < 0) {
    if (error) { error.hidden = false; error.textContent = 'Enter a monthly cap of $0 or more.'; }
    return;
  }
  const categoryBudgets = {};
  const inputs = $$('[data-budget-cat]');
  for (const input of inputs) {
    const raw = input.value.trim();
    if (raw === '') continue;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      if (error) { error.hidden = false; error.textContent = `The cap for ${input.dataset.budgetCat} must be $0 or more.`; }
      return;
    }
    categoryBudgets[input.dataset.budgetCat] = amount;
  }
  const btn = $('#budgetSaveBtn');
  const ledgerWasOpen = Boolean($('#ledgerDialog') && $('#ledgerDialog').open);
  busy(btn, true, 'Saving');
  try {
    await putJSON('/api/budget', { cap, category_budgets: categoryBudgets });
    const dialog = $('#budgetDialog');
    if (dialog && dialog.open) dialog.close();
    await refreshVault();
    if (ledgerWasOpen) openLedger();
    toast(`Budget saved: ${money(cap, 2)} monthly cap.`);
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

function openVoidDialog(entryId) {
  const dialog = $('#voidDialog');
  const entry = state.vault ? (state.vault.spending_ledger || []).find((row) => row.id === entryId) : null;
  if (!dialog || !entry || entry.voided) return;
  if ($('#voidEntryId')) $('#voidEntryId').value = entry.id;
  if ($('#voidCopy')) {
    $('#voidCopy').textContent = `${entry.title || 'Purchase'} · ${money(entry.amount, 2)} on ${validStamp(entry.spent_at)}. Voiding removes it from the budget${entry.item_id ? ' and reopens its wish' : ''}.`;
  }
  if ($('#voidPreview')) {
    $('#voidPreview').innerHTML = `<span>LEDGER CORRECTION</span><b>${money(entry.amount, 2)} comes back into this month's budget.</b><small>Voided entries stay in the data file for audit.</small>`;
  }
  if ($('#voidReason')) $('#voidReason').value = '';
  const error = $('#voidError');
  if (error) error.hidden = true;
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => { if ($('#voidReason')) $('#voidReason').focus(); }, 60);
}

async function submitVoid(event) {
  event.preventDefault();
  const id = $('#voidEntryId') ? $('#voidEntryId').value : '';
  if (!id) return;
  const error = $('#voidError');
  const btn = $('#voidSubmit');
  busy(btn, true, 'Voiding');
  try {
    const data = await postJSON(`/api/ledger/${encodeURIComponent(id)}/void`, {
      reason: $('#voidReason') ? $('#voidReason').value.trim() : ''
    });
    const dialog = $('#voidDialog');
    if (dialog && dialog.open) dialog.close();
    await refreshVault();
    if ($('#ledgerDialog') && $('#ledgerDialog').open) openLedger();
    toast(data.item ? `Entry voided and "${data.item.title}" reopened.` : 'Ledger entry voided.');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

function openLedger() {
  const dialog = $('#ledgerDialog');
  const vault = state.vault;
  if (!dialog || !vault) return;
  const { budget } = budgetNumbers(vault);
  const ledger = (vault.spending_ledger || []).filter((entry) => !entry.voided);
  const voidedCount = Number(budget.voided_count) || 0;
  if ($('#ledgerSub')) {
    $('#ledgerSub').textContent = `${budget.month_label}: ${money(budget.spent, 2)} spent, ${money(budget.remaining, 2)} remaining${voidedCount ? ` · ${voidedCount} voided` : ''}.`;
  }
  const summary = $('#ledgerSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="ledger-stat"><span class="micro">SPENT THIS MONTH</span><strong>${money(budget.spent, 2)}</strong><small>of ${money(budget.cap, 2)} cap</small></div>
      <div class="ledger-stat ${budget.over_budget ? 'is-over' : ''}"><span class="micro">REMAINING</span><strong>${money(budget.remaining, 2)}</strong><small>${budget.over_budget ? 'over budget' : 'available'}</small></div>
      <div class="ledger-stat"><span class="micro">ACTIVE ENTRIES</span><strong>${ledger.length}</strong><small>all months</small></div>`;
  }

  const categories = Array.isArray(budget.category_breakdown) ? budget.category_breakdown : [];
  const maxSpend = Math.max(1, ...categories.map((row) => Number(row.spent) || 0));
  const categorySection = categories.length
    ? `<section class="ledger-categories"><header><b>BY CATEGORY</b><span>${esc(budget.month_label)}</span></header>${categories.map((row) => {
      const cap = row.cap === null || row.cap === undefined ? null : Number(row.cap);
      const width = cap !== null && cap > 0
        ? Math.min(100, Math.max(0, (Number(row.spent) / cap) * 100))
        : Math.min(100, Math.max(0, (Number(row.spent) / maxSpend) * 100));
      return `<div class="ledger-cat ${row.over_budget ? 'is-over' : ''}"><div class="ledger-cat-top"><b>${esc(row.category)}</b><span>${money(row.spent, 2)}${cap !== null ? ` of ${money(cap, 2)}` : ''}</span></div><div class="ledger-cat-rail"><i style="width:${width}%"></i></div></div>`;
    }).join('')}</section>`
    : '';

  const months = Array.isArray(budget.monthly_totals) ? budget.monthly_totals : [];
  const historySection = months.length > 1
    ? `<section class="ledger-history"><header><b>MONTH HISTORY</b><span>ALL ACTIVE ENTRIES</span></header>${months.map((row) => `<div class="ledger-history-row"><span>${esc(row.label)}</span><b>${money(row.total, 2)}</b></div>`).join('')}</section>`
    : '';

  const list = $('#ledgerList');
  if (list) {
    if (!ledger.length) {
      list.innerHTML = `<div class="empty-state"><svg class="icon"><use href="#i-coin"/></svg><h3>No active purchases</h3><p>${voidedCount ? 'Every entry has been voided. Voided purchases remain in the data file for audit.' : 'When a wish clears the gate and you record a purchase, it will appear here.'}</p></div>`;
    } else {
      const groups = new Map();
      ledger.forEach((entry) => {
        const key = entry.month || (entry.spent_at ? String(entry.spent_at).slice(0, 7) : 'unknown');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
      });
      const sorted = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
      const entrySections = sorted.map(([month, entries]) => {
        const label = entries[0] && entries[0].spent_at
          ? new Date(entries[0].spent_at).toLocaleString('en-US', { month: 'long', year: 'numeric' })
          : month;
        const total = entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
        const rows = entries.map((entry) => {
          const date = entry.spent_at ? new Date(entry.spent_at).toLocaleString('en-US', { month: 'short', day: 'numeric' }) : '—';
          return `<li class="ledger-row"><time>${esc(date)}</time><div><strong>${esc(entry.title || 'Purchase')}</strong><span>${esc(entry.category || 'Uncategorized')}${entry.source ? ' · ' + esc(entry.source) : ''}</span></div><div class="ledger-row-end"><b>${money(entry.amount, 2)}</b><button type="button" class="mini-btn danger" data-void-ledger="${esc(entry.id)}" title="Void this ledger entry" aria-label="Void ${esc(entry.title || 'ledger entry')}"><svg class="icon"><use href="#i-x"/></svg></button></div></li>`;
        }).join('');
        return `<section class="ledger-month"><header><b>${esc(label)}</b><span>${money(total, 2)}</span></header><ul>${rows}</ul></section>`;
      }).join('');
      list.innerHTML = `${categorySection}${historySection}${entrySections}`;
    }
  }
  if (!dialog.open) dialog.showModal();
}

/* ————— PROTOCOLS ————— */
function renderProtocolsView(v) {
  const list = v.protocols || [];
  const counter = $('#protocolCount');
  if (counter) counter.textContent = String(list.length);
  const grid = $('#protocolsGrid');
  if (!grid) return;

  const today = clientDateKey();
  const log = v.routine_log && typeof v.routine_log === 'object' ? v.routine_log : {};
  const todayHost = $('#routineToday');
  if (todayHost) {
    if (!list.length) {
      todayHost.innerHTML = '';
    } else {
      const doneCount = list.filter((protocol) => (Array.isArray(log[protocol.id]) ? log[protocol.id] : []).includes(today)).length;
      todayHost.innerHTML = `<section class="routine-today-card" aria-labelledby="routineTodayTitle">
        <header class="routine-today-head">
          <div><p class="micro">TODAY'S PLAYBOOK</p><h3 id="routineTodayTitle">${doneCount === list.length ? 'Every routine checked off.' : 'What gets done today.'}</h3></div>
          <span class="routine-today-score"><b>${doneCount}</b>/${list.length} done</span>
        </header>
        <div class="routine-today-list">
          ${list.map((protocol) => {
            const dates = Array.isArray(log[protocol.id]) ? log[protocol.id] : [];
            const done = dates.includes(today);
            const streak = routineStreak(dates);
            return `<button type="button" class="routine-today-item ${done ? 'is-done' : ''}" data-routine-check="${esc(protocol.id)}" data-routine-done="${done ? 'false' : 'true'}" aria-pressed="${done}">
              <span class="routine-today-check" aria-hidden="true">${done ? '<svg class="icon"><use href="#i-check"/></svg>' : ''}</span>
              <span class="routine-today-copy"><b>${esc(protocol.title)}</b><small>${esc(protocol.schedule || 'As needed')}${streak ? ` · ${streak}-day streak` : ''}</small></span>
            </button>`;
          }).join('')}
        </div>
      </section>`;
    }
  }

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><svg class="icon"><use href="#i-pulse"/></svg><h3>No routines armed</h3><p>Paste a TikTok, YouTube or product-list routine and generate a structured protocol from it.</p><button type="button" class="btn ghost sm" data-new-routine><svg class="icon"><use href="#i-plus"/></svg> New routine</button></div>`;
    return;
  }
  const wishById = new Map(((v && v.wishlist) || []).map((wish) => [wish.id, wish]));
  grid.innerHTML = list.map((p, i) => {
    const steps = (p.steps || []).map((step) => `<li>${esc(step)}</li>`).join('');
    const linkedProducts = (p.linked_wishlist_ids || []).map((id) => wishById.get(id)).filter(Boolean);
    const webProducts = Array.isArray(p.products) ? p.products : [];
    const links = linkedProducts.length;
    const railItems = [
      ...linkedProducts.slice(0, 4).map((wish, productIndex) => {
        const image = safeImage(wish.image);
        const initial = String(wish.title || '?').trim().charAt(0).toUpperCase() || '?';
        const price = Number(wish.lowest_verified_price) > 0 ? money(wish.lowest_verified_price, 2) : 'Price pending';
        return `<button type="button" class="proto-product ${productIndex === 0 ? 'is-featured' : ''}" data-proto-wish="${esc(wish.id)}" title="Open ${esc(wish.title)} in the Gate">
          ${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : `<span class="proto-product-fallback" aria-hidden="true">${esc(initial)}</span>`}
          <span class="proto-product-copy"><b>${esc(wish.title)}</b><small>${esc(wish.brand || 'PRIVATE SAVE')} · ${price}</small></span>
        </button>`;
      }),
      ...webProducts
        .filter((product) => !linkedProducts.some((wish) => wish.url && wish.url === product.url))
        .slice(0, Math.max(0, 4 - linkedProducts.length))
        .map((product) => {
          const image = safeImage(product.image);
          const initial = String(product.title || '?').trim().charAt(0).toUpperCase() || '?';
          const detail = [product.brand || product.domain, Number(product.price) > 0 ? money(product.price, 2) : ''].filter(Boolean).join(' · ');
          return `<a class="proto-product is-web" href="${esc(product.url)}" target="_blank" rel="noopener noreferrer" title="Open ${esc(product.title)} on the web">
            ${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : `<span class="proto-product-fallback" aria-hidden="true">${esc(initial)}</span>`}
            <span class="proto-product-copy"><b>${esc(product.title)}</b><small>WEB · ${esc(detail || 'Not in the Gate')}</small></span>
          </a>`;
        }),
    ];
    const productRail = railItems.length
      ? `<div class="proto-products"><span class="proto-products-label">PRODUCTS IN THIS RULE</span><div class="proto-products-rail">${railItems.join('')}</div></div>`
      : '';
    return `
    <article class="protocol" style="--i:${Math.min(i, 8)}" data-proto-id="${esc(p.id)}">
      <div class="proto-top"><span class="proto-index">PROTOCOL ${pad(i + 1)}</span><span class="badge-soft">${esc(p.credibility_badge || 'UNVERIFIED')}</span><span class="proto-actions"><button type="button" class="mini-btn" data-proto-edit="${esc(p.id)}" aria-label="Edit ${esc(p.title)}" title="Edit routine"><svg class="icon"><use href="#i-edit"/></svg></button><button type="button" class="mini-btn danger" data-proto-delete="${esc(p.id)}" aria-label="Delete ${esc(p.title)}" title="Delete routine"><svg class="icon"><use href="#i-trash"/></svg></button></span></div>
      <div>
        <h3 class="proto-title">${esc(p.title)}</h3>
        <p class="proto-sched"><svg class="icon"><use href="#i-clock"/></svg>${esc(p.schedule || 'ALWAYS ON')}</p>
        <p class="proto-source">${esc(p.source_platform || '')}</p>
      </div>
      ${productRail}
      <div class="conflict"><svg class="icon"><use href="#i-alert"/></svg><span><b>ACTIVE GUARDRAIL</b>${esc(p.conflict_alert || 'Routine conflict checks armed.')}</span></div>
      <ol class="steps">${steps}</ol>
      <div class="proto-foot">
        <span class="ok"><svg class="icon"><use href="#i-check"/></svg>${esc(p.snapshot_status || 'Snapshot archived')}</span>
        <span>${links} gate ${links === 1 ? 'link' : 'links'}${webProducts.length ? ` · ${webProducts.length} web` : ''}</span>
      </div>
    </article>`;
  }).join('');
}

function protocolById(id) {
  return ((state.vault && state.vault.protocols) || []).find((protocol) => protocol.id === id) || null;
}

function routineProductText(wish) {
  const tags = Array.isArray(wish.tags) ? wish.tags : [];
  return [wish.title, wish.brand, wish.category, wish.best_source, wish.dupe_alternative, ...tags]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function routineProductMatches(wish, words) {
  const haystack = routineProductText(wish);
  return words.every((word) => haystack.includes(word));
}

function clearRoutineProductSearch() {
  state.routineSearch = '';
  state.routineLimit = ROUTINE_PRODUCTS_PAGE;
  if ($('#routineProductSearch')) $('#routineProductSearch').value = '';
}

function resetRoutineProductFilters() {
  clearRoutineProductSearch();
  state.routineSelectedOnly = false;
  const toggle = $('#routineSelectedToggle');
  if (toggle) {
    toggle.classList.remove('is-active');
    toggle.setAttribute('aria-pressed', 'false');
  }
}

function setRoutineLookupStatus(message, tone = '') {
  const el = $('#routineWebStatus');
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || '';
  el.className = `routine-web-status${tone ? ` is-${tone}` : ''}`;
}

function syncRoutineWebLookupToggle() {
  const btn = $('#routineWebLookupToggle');
  if (!btn) return;
  const enabled = Boolean(state.routineWebLookup);
  btn.textContent = `Web lookup: ${enabled ? 'on' : 'off'}`;
  btn.classList.toggle('is-active', enabled);
  btn.setAttribute('aria-pressed', String(enabled));
  btn.title = enabled
    ? 'Product names missing from your Gate are sent to a search engine.'
    : 'Nothing leaves this device; only products already in your Gate are attached.';
}

function setRoutineWebLookup(enabled) {
  const next = Boolean(enabled);
  if (next === state.routineWebLookup) return;
  state.routineWebLookup = next;
  rememberRoutineWebLookup(next);
  syncRoutineWebLookupToggle();
  if (!next) {
    state.routineLookupRun += 1;
    state.routineLookupBusy = false;
    state.routineQueries = [];
    setRoutineLookupStatus('');
    renderRoutineWebProducts();
    toast('Web lookup is off. Product names stay on this device.', 'warn');
  } else {
    toast('Web lookup is on. Generate the routine to search for missing products.');
  }
}

function linkRoutineWish(id) {
  if (!id) return false;
  const ids = new Set(state.routineLinkedIds || []);
  if (ids.has(id)) return true;
  if (ids.size >= ROUTINE_PRODUCT_CAP) return false;
  ids.add(id);
  state.routineLinkedIds = Array.from(ids);
  return true;
}

function routineWishDetails(product) {
  const price = Number(product.price) > 0 ? Number(product.price) : null;
  const lowConfidence = String(product.price_source || '').toLowerCase() === 'dom';
  const domain = String(product.domain || '').trim();
  return {
    title: product.title,
    brand: product.brand || '',
    category: $('#routineCategory') ? $('#routineCategory').value.trim() : '',
    retail_price: price,
    lowest_verified_price: price,
    captured_price: price,
    image: product.image || '',
    best_source: price === null
      ? 'Add a verified source'
      : `${domain || 'Product'} page${lowConfidence ? ' (low-confidence visible price)' : ' (captured from routine lookup)'}`,
    price_source: product.price_source || 'none',
    price_confidence: price === null ? '' : (lowConfidence ? 'low' : 'high'),
    price_reason: price === null ? 'The fetched product page did not expose a public price.' : '',
    capture_mode: 'server',
  };
}

async function sendRoutineProductsToGate() {
  if (state.routineGateBusy) return;
  const pending = (state.routineWebProducts || []).filter((product) => product && product.url);
  if (!pending.length) return;
  state.routineGateBusy = true;
  state.routineLastGateSend = [];
  state.routineLastGateSendKey = '';
  renderRoutineWebProducts();
  setRoutineLookupStatus(`Sending ${pending.length} ${pending.length === 1 ? 'product' : 'products'} to the Gate…`, 'busy');
  const created = [];
  let sent = 0;
  let existing = 0;
  let failed = 0;
  let linked = 0;
  let unlinked = 0;
  try {
    for (const product of pending) {
      try {
        const data = await postJSON('/api/promote-bookmark', {
          url: product.url,
          details: routineWishDetails(product),
        });
        const item = data && data.item;
        if (!item || !item.id) throw new Error('The Gate did not return a wish.');
        if (data.already_exists) {
          existing += 1;
        } else {
          sent += 1;
          created.push({ id: item.id, product: { ...product } });
        }
        state.routineWebProducts = (state.routineWebProducts || []).filter((entry) => entry.url !== product.url);
        if (linkRoutineWish(item.id)) linked += 1;
        else unlinked += 1;
        setRoutineLookupStatus(`Sent ${sent + existing} of ${pending.length} to the Gate…`, 'busy');
        renderRoutineWebProducts();
      } catch (_) {
        failed += 1;
      }
    }
  } finally {
    state.routineGateBusy = false;
  }
  state.routineLastGateSend = created;
  state.routineLastGateSendKey = created.length ? (state.routineKey || 'new') : '';
  if (!(state.routineWebProducts || []).length) {
    state.routineQueries = [];
    setRoutineLookupStatus('');
  } else {
    setRoutineLookupStatus('Some products are still waiting. Try again, or add them from the Gate.', 'warn');
  }
  renderRoutineWebProducts();
  await refreshVault();
  renderRoutineProducts();
  const parts = [];
  if (sent) parts.push(`${sent} sent to the Gate`);
  if (existing) parts.push(`${existing} already in the Gate`);
  if (failed) parts.push(`${failed} failed`);
  let message = `${parts.join(' · ') || 'Nothing sent'}.`;
  if (sent) message += ' Their 14-day cooldown has started.';
  if (linked) message += ` ${linked} linked to this routine — save to keep the links.`;
  if (unlinked) message += ` ${unlinked} could not be linked (12-link limit).`;
  toast(message, failed ? 'warn' : 'ok');
}

async function undoSendRoutineProductsToGate() {
  if (state.routineGateBusy) return;
  const batch = Array.isArray(state.routineLastGateSend) ? state.routineLastGateSend.slice() : [];
  if (!batch.length) return;
  state.routineGateBusy = true;
  renderRoutineWebProducts();
  setRoutineLookupStatus(`Removing ${batch.length} ${batch.length === 1 ? 'wish' : 'wishes'} from the Gate…`, 'busy');
  const removed = [];
  const failed = [];
  try {
    for (const entry of batch) {
      try {
        await deleteJSON(`/api/wishlist/${encodeURIComponent(entry.id)}`);
        removed.push(entry);
      } catch (_) {
        failed.push(entry);
      }
    }
  } finally {
    state.routineGateBusy = false;
  }
  if (removed.length) {
    const removedIds = new Set(removed.map((entry) => entry.id));
    state.routineLinkedIds = (state.routineLinkedIds || []).filter((id) => !removedIds.has(id));
    for (const entry of removed) {
      const product = entry.product;
      if (!product || !product.url) continue;
      if (!(state.routineWebProducts || []).some((item) => item.url === product.url)) {
        state.routineWebProducts.push(product);
      }
    }
    setRoutineLookupStatus(
      `Undid ${removed.length} ${removed.length === 1 ? 'wish' : 'wishes'}. ${failed.length ? 'Some could not be removed.' : 'They are back in the web list.'}`,
      failed.length ? 'warn' : 'ok'
    );
  } else {
    setRoutineLookupStatus('Could not undo the last send. Remove the wishes from the Gate instead.', 'warn');
  }
  state.routineLastGateSend = failed;
  state.routineLastGateSendKey = failed.length ? state.routineLastGateSendKey : '';
  renderRoutineWebProducts();
  await refreshVault();
  renderRoutineProducts();
  if (removed.length && failed.length) toast(`Undid ${removed.length}; ${failed.length} could not be removed.`, 'warn');
  else if (removed.length) toast(`Undid ${removed.length} ${removed.length === 1 ? 'wish' : 'wishes'}.`);
  else toast('Nothing could be undone.', 'err');
}

function renderRoutineWebProducts() {
  const host = $('#routineWebProducts');
  const field = $('#routineWebField');
  const count = $('#routineWebCount');
  const retry = $('#routineWebRetry');
  const send = $('#routineWebSendBtn');
  const sendLabel = $('#routineWebSendLabel');
  const undo = $('#routineWebUndo');
  const undoText = $('#routineWebUndoText');
  const undoBtn = $('#routineWebUndoBtn');
  if (!host || !field) return;
  const products = Array.isArray(state.routineWebProducts) ? state.routineWebProducts : [];
  const undoCount = Array.isArray(state.routineLastGateSend) ? state.routineLastGateSend.length : 0;
  field.hidden = !products.length && !(state.routineQueries || []).length && !undoCount;
  if (count) count.textContent = `${products.length} ${products.length === 1 ? 'product' : 'products'}`;
  if (undo) {
    undo.hidden = !undoCount;
    if (undoText) undoText.textContent = `${undoCount} ${undoCount === 1 ? 'wish' : 'wishes'} from the last send ${undoCount === 1 ? 'is' : 'are'} in the Gate.`;
    if (undoBtn) undoBtn.disabled = state.routineGateBusy;
  }
  if (retry) {
    retry.hidden = !(state.routineQueries || []).length;
    retry.disabled = state.routineLookupBusy;
    retry.textContent = state.routineLookupBusy ? 'Looking up…' : 'Look up again';
  }
  if (send) {
    send.hidden = !products.length;
    send.disabled = state.routineGateBusy;
    if (sendLabel) sendLabel.textContent = state.routineGateBusy ? 'Sending…' : `Send ${products.length} to Gate`;
  }
  if (!products.length) {
    host.innerHTML = undoCount
      ? '<p class="routine-products-empty">All found products are in the Gate. Undo restores them here.</p>'
      : '<p class="routine-products-empty">No product pages matched yet. Keep the product lines specific, or add the item to the Gate first.</p>';
    return;
  }
  host.innerHTML = products.map((product, index) => {
    const image = safeImage(product.image);
    const initial = String(product.title || '?').trim().charAt(0).toUpperCase() || '?';
    const meta = [
      product.brand || product.domain,
      Number(product.price) > 0 ? money(product.price, 2) : '',
      product.confidence === 'high' ? 'matched' : 'check match',
    ].filter(Boolean).join(' · ');
    return `<article class="routine-web-card">
      <a class="routine-web-media" href="${esc(product.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(product.title)}">
        ${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : `<span class="routine-product-fallback" aria-hidden="true">${esc(initial)}</span>`}
      </a>
      <div class="routine-web-copy"><b>${esc(product.title)}</b><small>${esc(meta || 'Fetched from the web')}</small></div>
      <button class="mini-btn danger" type="button" data-routine-web-remove="${index}" aria-label="Remove ${esc(product.title)}" title="Remove this match"><svg class="icon"><use href="#i-trash"/></svg></button>
    </article>`;
  }).join('');
}

async function lookupRoutineWebProducts(queries) {
  const run = ++state.routineLookupRun;
  const list = (Array.isArray(queries) ? queries : []).slice(0, 8);
  state.routineQueries = list;
  state.routineWebProducts = [];
  state.routineLookupBusy = Boolean(list.length);
  renderRoutineWebProducts();
  if (!list.length) {
    setRoutineLookupStatus('');
    return;
  }
  setRoutineLookupStatus(`Looking up ${list.length} ${list.length === 1 ? 'product' : 'products'}…`, 'busy');
  let done = 0;
  let failed = 0;
  const queue = list.slice();
  const worker = async () => {
    while (queue.length) {
      if (run !== state.routineLookupRun) return;
      const query = queue.shift();
      try {
        const data = await postJSON('/api/routines/lookup-product', { query });
        if (run !== state.routineLookupRun) return;
        const product = data.product;
        if (product && product.url && !state.routineWebProducts.some((item) => item.url === product.url)) {
          state.routineWebProducts.push(product);
          renderRoutineWebProducts();
        }
      } catch (_) {
        failed += 1;
      }
      done += 1;
      if (run === state.routineLookupRun) {
        setRoutineLookupStatus(`Checked ${done} of ${list.length}${state.routineWebProducts.length ? ` · ${state.routineWebProducts.length} found` : ''}…`, 'busy');
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
  if (run !== state.routineLookupRun) return;
  state.routineLookupBusy = false;
  renderRoutineWebProducts();
  const found = state.routineWebProducts.length;
  if (found) setRoutineLookupStatus(`Found ${found} of ${list.length}. Remove any wrong match before saving.`, 'ok');
  else if (failed) setRoutineLookupStatus('Some lookups failed. Try again in a moment, or add these products from the Gate.', 'warn');
  else setRoutineLookupStatus('No product pages matched. Add these products from the Gate instead.', 'warn');
}

function syncRoutineProductsFooter(total) {
  state.routineMatchCount = total;
  if ($('#routineProductsCount')) {
    $('#routineProductsCount').textContent = `${(state.routineLinkedIds || []).length} / ${ROUTINE_PRODUCT_CAP} ticked`;
  }
  const clear = $('#routineProductSearchClear');
  if (clear) clear.hidden = !state.routineSearch.trim();
  const foot = $('#routineProductsFoot');
  const meta = $('#routineProductsMeta');
  const more = $('#routineProductsMore');
  if (!foot || !meta || !more) return;
  if (!total) {
    foot.hidden = true;
    return;
  }
  foot.hidden = false;
  const query = state.routineSearch.trim();
  const shown = state.routineSelectedOnly ? total : Math.min(state.routineLimit, total);
  meta.textContent = `${shown} of ${total}${state.routineSelectedOnly ? ' ticked' : ' products'}${query ? ` · “${query}”` : ''}`;
  more.hidden = state.routineSelectedOnly || state.routineLimit >= total;
}

function renderRoutineProducts() {
  const picker = $('#routineProducts');
  if (!picker) return;
  const wishes = ((state.vault && state.vault.wishlist) || []);
  const selected = new Set(state.routineLinkedIds || []);
  const query = state.routineSearch.trim();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let matches = wishes;
  if (state.routineSelectedOnly) matches = matches.filter((wish) => selected.has(wish.id));
  if (words.length) matches = matches.filter((wish) => routineProductMatches(wish, words));
  if (!wishes.length) {
    picker.innerHTML = '<p class="routine-products-empty">No wishlist products yet. Add one from the Gate first.</p>';
    syncRoutineProductsFooter(0);
    return;
  }
  if (!matches.length) {
    const message = state.routineSelectedOnly && !query
      ? 'Nothing is ticked yet.'
      : query
        ? `No product matches “${esc(query)}”.`
        : 'No product matches this filter.';
    picker.innerHTML = `<p class="routine-products-empty">${message}<br><button class="btn ghost sm" type="button" data-routine-clear-search>Clear filters</button></p>`;
    syncRoutineProductsFooter(0);
    return;
  }
  const visible = state.routineSelectedOnly ? matches : matches.slice(0, state.routineLimit);
  picker.innerHTML = visible.map((wish) => {
    const image = safeImage(wish.image);
    const initial = String(wish.title || '?').trim().charAt(0).toUpperCase() || '?';
    const isSelected = selected.has(wish.id);
    const brand = wish.brand || 'PRIVATE SAVE';
    return `<button type="button" class="routine-product ${isSelected ? 'is-selected' : ''}" data-routine-link="${esc(wish.id)}" aria-pressed="${isSelected}" title="${esc(wish.title)}${wish.brand ? ` · ${esc(wish.brand)}` : ''}">
      ${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : `<span class="routine-product-fallback" aria-hidden="true">${esc(initial)}</span>`}
      <span class="routine-product-copy"><b>${esc(wish.title)}</b><small>${esc(brand)}</small></span>
      <span class="routine-product-check" aria-hidden="true"><svg class="icon"><use href="#i-check"/></svg></span>
    </button>`;
  }).join('');
  syncRoutineProductsFooter(matches.length);
}

function openRoutineDialog(protocol) {
  const dialog = $('#routineDialog');
  if (!dialog) return;
  state.routineLinkedIds = protocol ? (protocol.linked_wishlist_ids || []).slice() : [];
  state.routineLookupRun += 1;
  state.routineLookupBusy = false;
  state.routineQueries = [];
  state.routineWebProducts = protocol && Array.isArray(protocol.products) ? protocol.products.slice() : [];
  const isEdit = Boolean(protocol);
  state.routineKey = isEdit ? protocol.id : 'new';
  if (state.routineLastGateSendKey !== state.routineKey) {
    state.routineLastGateSend = [];
    state.routineLastGateSendKey = '';
  }
  if ($('#routineId')) $('#routineId').value = isEdit ? protocol.id : '';
  if ($('#routineDialogTitle')) $('#routineDialogTitle').textContent = isEdit ? 'Edit routine' : 'Build a routine';
  if ($('#routinePaste')) $('#routinePaste').value = isEdit ? (protocol.source_text || (protocol.steps || []).join('\n')) : '';
  if ($('#routineTitle')) $('#routineTitle').value = isEdit ? protocol.title || '' : '';
  if ($('#routineCategory')) $('#routineCategory').value = isEdit ? protocol.category || '' : 'Skincare, Health & Protocols';
  if ($('#routineSchedule')) $('#routineSchedule').value = isEdit ? protocol.schedule || '' : 'As needed';
  if ($('#routineBadge')) $('#routineBadge').value = isEdit ? protocol.credibility_badge || '' : 'User-pasted — verify before use';
  if ($('#routineSteps')) $('#routineSteps').value = isEdit ? (protocol.steps || []).join('\n') : '';
  if ($('#routineConflict')) $('#routineConflict').value = isEdit ? protocol.conflict_alert || '' : '';
  if ($('#routineSource')) $('#routineSource').value = isEdit ? protocol.source_platform || '' : 'Pasted routine (TikTok / YouTube / social)';
  if ($('#routineParseNote')) $('#routineParseNote').textContent = isEdit ? `Editing ${(protocol.steps || []).length} saved steps.` : 'Nothing parsed yet.';
  resetRoutineProductFilters();
  renderRoutineProducts();
  syncRoutineWebLookupToggle();
  renderRoutineWebProducts();
  setRoutineLookupStatus('');
  const error = $('#routineError');
  if (error) error.hidden = true;
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => { if ($('#routinePaste')) $('#routinePaste').focus(); }, 50);
}

async function generateRoutine(btn) {
  const paste = $('#routinePaste') ? $('#routinePaste').value.trim() : '';
  const error = $('#routineError');
  if (!paste) {
    if (error) { error.hidden = false; error.textContent = 'Paste a routine or product list first.'; }
    if ($('#routinePaste')) $('#routinePaste').focus();
    return;
  }
  if (error) error.hidden = true;
  busy(btn, true, 'Reading');
  try {
    const data = await postJSON('/api/routines/parse', { text: paste });
    const routine = data.routine || {};
    state.routineLinkedIds = routine.linked_wishlist_ids || [];
    if ($('#routineTitle')) $('#routineTitle').value = routine.title || '';
    if ($('#routineCategory')) $('#routineCategory').value = routine.category || 'Skincare, Health & Protocols';
    if ($('#routineSchedule')) $('#routineSchedule').value = routine.schedule || 'As needed';
    if ($('#routineBadge')) $('#routineBadge').value = routine.credibility_badge || 'User-pasted — verify before use';
    if ($('#routineSteps')) $('#routineSteps').value = (routine.steps || []).join('\n');
    if ($('#routineConflict')) $('#routineConflict').value = routine.conflict_alert || '';
    if ($('#routineSource')) $('#routineSource').value = routine.source_platform || 'Pasted routine (TikTok / YouTube / social)';
    if ($('#routineParseNote')) $('#routineParseNote').textContent = `Structured ${(routine.steps || []).length} steps · ${routine.schedule || 'as needed'}.`;
    resetRoutineProductFilters();
    renderRoutineProducts();
    toast('Routine structured. Review the guardrail, then save.');
    const queries = Array.isArray(data.product_queries) ? data.product_queries : [];
    if (state.routineWebLookup) {
      lookupRoutineWebProducts(queries).catch(() => {
        setRoutineLookupStatus('Product lookup failed. Add these products from the Gate instead.', 'warn');
      });
    } else {
      state.routineLookupRun += 1;
      state.routineQueries = [];
      state.routineWebProducts = [];
      state.routineLookupBusy = false;
      renderRoutineWebProducts();
      setRoutineLookupStatus('');
      if (queries.length && $('#routineParseNote')) {
        $('#routineParseNote').textContent = `Structured ${(routine.steps || []).length} steps · web lookup off.`;
      }
    }
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

async function saveRoutineForm(event) {
  event.preventDefault();
  const id = $('#routineId') ? $('#routineId').value : '';
  const title = $('#routineTitle') ? $('#routineTitle').value.trim() : '';
  const steps = ($('#routineSteps') ? $('#routineSteps').value : '').split(/\n+/).map((step) => step.trim()).filter(Boolean);
  const error = $('#routineError');
  if (!title) {
    if (error) { error.hidden = false; error.textContent = 'Give the routine a title.'; }
    if ($('#routineTitle')) $('#routineTitle').focus();
    return;
  }
  if (!steps.length) {
    if (error) { error.hidden = false; error.textContent = 'Paste or add at least one step, then generate the structure.'; }
    if ($('#routinePaste')) $('#routinePaste').focus();
    return;
  }
  if (error) error.hidden = true;
  const btn = $('#routineSaveBtn');
  const payload = {
    title,
    category: $('#routineCategory') ? $('#routineCategory').value.trim() : '',
    schedule: $('#routineSchedule') ? $('#routineSchedule').value.trim() : '',
    credibility_badge: $('#routineBadge') ? $('#routineBadge').value.trim() : '',
    source_platform: $('#routineSource') ? $('#routineSource').value.trim() : 'Pasted routine',
    snapshot_status: 'Pasted text — source not archived',
    conflict_alert: $('#routineConflict') ? $('#routineConflict').value.trim() : '',
    steps,
    source_text: $('#routinePaste') ? $('#routinePaste').value.trim() : '',
    linked_wishlist_ids: state.routineLinkedIds,
    products: state.routineWebProducts
  };
  busy(btn, true, 'Saving');
  try {
    const saved = id
      ? await putJSON(`/api/protocols/${encodeURIComponent(id)}`, payload)
      : await postJSON('/api/protocols', payload);
    if (!id && saved && saved.protocol) {
      state.routineKey = saved.protocol.id;
      if (state.routineLastGateSend.length) state.routineLastGateSendKey = saved.protocol.id;
    }
    const dialog = $('#routineDialog');
    if (dialog && dialog.open) dialog.close();
    await refreshVault();
    toast(id ? 'Routine updated.' : 'Routine saved to Rules.');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

async function removeProtocol(id) {
  const protocol = protocolById(id);
  if (!protocol || !window.confirm(`Delete “${protocol.title}”?`)) return;
  try {
    await deleteJSON(`/api/protocols/${encodeURIComponent(id)}`);
    await refreshVault();
    toast('Routine deleted.');
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function toggleRoutineToday(id, done, btn) {
  if (!id || (btn && btn.disabled)) return;
  busy(btn, true, done ? 'Checking off' : 'Reopening');
  try {
    await postJSON(`/api/protocols/${encodeURIComponent(id)}/today`, { done });
    await refreshVault();
    toast(done ? 'Routine checked off for today.' : 'Today\'s check-off removed.');
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

/* ————— PROFILE EDITOR ————— */
function profileContext() {
  return (state.vault && state.vault.personal_context) || {};
}

function profileSizeRow(key = '', value = '') {
  return `<div class="profile-size-row" data-profile-size>
    <div class="field"><label>Label</label><input type="text" data-size-key maxlength="40" autocomplete="off" placeholder="e.g. tops" value="${esc(key)}" /></div>
    <div class="field"><label>Value</label><input type="text" data-size-value maxlength="80" autocomplete="off" placeholder="e.g. L" value="${esc(value)}" /></div>
    <button class="mini-btn danger" type="button" data-size-remove aria-label="Remove size"><svg class="icon"><use href="#i-trash"/></svg></button>
  </div>`;
}

function profileInventoryRow(item = {}, index = 0) {
  const data = item && typeof item === 'object' ? item : {};
  return `<div class="profile-inventory-row" data-profile-inventory data-category="${esc(data.category || 'Uncategorized')}">
    <input type="hidden" data-inventory-id value="${esc(data.id || '')}" />
    <div class="profile-inventory-head"><span class="micro">ITEM ${pad(index + 1)}</span><button class="mini-btn danger" type="button" data-inventory-remove aria-label="Remove owned item"><svg class="icon"><use href="#i-trash"/></svg></button></div>
    <div class="profile-inventory-grid">
      <div class="field"><label>Item</label><input type="text" data-inventory-name maxlength="140" autocomplete="off" placeholder="e.g. Black quilted parka" value="${esc(data.name || '')}" /></div>
      <div class="field"><label>Brand</label><input type="text" data-inventory-brand maxlength="100" autocomplete="off" placeholder="e.g. Tokyo Laundry" value="${esc(data.brand || '')}" /></div>
      <div class="field"><label>Status</label><input type="text" data-inventory-status maxlength="60" autocomplete="off" placeholder="e.g. Active in closet" value="${esc(data.status || 'Owned')}" /></div>
      <div class="field profile-inventory-notes"><label>Notes</label><textarea data-inventory-notes rows="2" maxlength="300" placeholder="What it covers, why it blocks a duplicate…">${esc(data.notes || '')}</textarea></div>
    </div>
  </div>`;
}

function profileEmpty(host, message) {
  if (host) host.innerHTML = `<p class="profile-empty">${esc(message)}</p>`;
}

function reindexProfileInventory() {
  $$('#profileInventoryEditor [data-profile-inventory]').forEach((row, index) => {
    const label = row.querySelector('.profile-inventory-head .micro');
    if (label) label.textContent = `ITEM ${pad(index + 1)}`;
  });
}

function renderProfileSizes(sizes) {
  const host = $('#profileSizeEditor');
  if (!host) return;
  const entries = sizes && typeof sizes === 'object' && !Array.isArray(sizes) ? Object.entries(sizes) : [];
  if (!entries.length) {
    profileEmpty(host, 'No sizes recorded. Add the labels the Gate should check against.');
    return;
  }
  host.innerHTML = entries.map(([key, value]) => profileSizeRow(key, value)).join('');
}

function renderProfileInventory(items) {
  const host = $('#profileInventoryEditor');
  if (!host) return;
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    profileEmpty(host, 'No owned items tracked. Add what is already in rotation so the Gate can spot duplicates.');
    return;
  }
  host.innerHTML = list.map((item, index) => profileInventoryRow(item, index)).join('');
}

function renderProfileEditor() {
  const ctx = profileContext();
  if ($('#profileOwnerInput')) $('#profileOwnerInput').value = String(ctx.owner || '');
  if ($('#profileLocationInput')) $('#profileLocationInput').value = String(ctx.location || '');
  if ($('#profileConstraintsInput')) {
    $('#profileConstraintsInput').value = (Array.isArray(ctx.skin_and_health_constraints) ? ctx.skin_and_health_constraints : []).join('\n');
  }
  const fragrance = ctx.fragrance_profile && typeof ctx.fragrance_profile === 'object' ? ctx.fragrance_profile : {};
  if ($('#profileLovedNotes')) $('#profileLovedNotes').value = (Array.isArray(fragrance.loved_notes) ? fragrance.loved_notes : []).join('\n');
  if ($('#profileAvoidNotes')) $('#profileAvoidNotes').value = (Array.isArray(fragrance.avoid_notes) ? fragrance.avoid_notes : []).join('\n');
  renderProfileSizes(ctx.sizes);
  renderProfileInventory(ctx.owned_inventory);
  const error = $('#profileError');
  if (error) { error.hidden = true; error.textContent = ''; }
  const form = $('#profileForm');
  if (form) form.scrollTop = 0;
}

function openProfileDialog() {
  if (!state.vault) { toast('The vault is not loaded yet.', 'warn'); return; }
  renderProfileEditor();
  const dialog = $('#profileDialog');
  if (dialog && !dialog.open) dialog.showModal();
  window.setTimeout(() => { const input = $('#profileOwnerInput'); if (input) input.focus(); }, 60);
}

function profileLines(value) {
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function profileError(message) {
  const error = $('#profileError');
  if (error) {
    error.hidden = false;
    error.textContent = message;
  }
  toast(message, 'err');
}

function collectProfilePayload() {
  const owner = $('#profileOwnerInput') ? $('#profileOwnerInput').value.trim() : '';
  if (!owner) throw new Error('Add your name before saving the profile.');
  const location = $('#profileLocationInput') ? $('#profileLocationInput').value.trim() : '';

  const sizes = {};
  $$('#profileSizeEditor [data-profile-size]').forEach((row) => {
    const key = row.querySelector('[data-size-key]') ? row.querySelector('[data-size-key]').value.trim() : '';
    const value = row.querySelector('[data-size-value]') ? row.querySelector('[data-size-value]').value.trim() : '';
    if (!key && !value) return;
    if (!key || !value) throw new Error('Each size row needs both a label and a value.');
    if (Object.prototype.hasOwnProperty.call(sizes, key)) throw new Error(`The size "${key}" is listed twice.`);
    sizes[key] = value;
  });
  if (Object.keys(sizes).length > 12) throw new Error('Keep sizing to 12 entries or fewer.');

  const constraints = profileLines($('#profileConstraintsInput') ? $('#profileConstraintsInput').value : '');
  if (constraints.length > 20) throw new Error('Keep hard constraints to 20 lines or fewer.');

  const inventory = [];
  $$('#profileInventoryEditor [data-profile-inventory]').forEach((row) => {
    const name = row.querySelector('[data-inventory-name]') ? row.querySelector('[data-inventory-name]').value.trim() : '';
    const brand = row.querySelector('[data-inventory-brand]') ? row.querySelector('[data-inventory-brand]').value.trim() : '';
    const status = row.querySelector('[data-inventory-status]') ? row.querySelector('[data-inventory-status]').value.trim() : '';
    const notes = row.querySelector('[data-inventory-notes]') ? row.querySelector('[data-inventory-notes]').value.trim() : '';
    const id = row.querySelector('[data-inventory-id]') ? row.querySelector('[data-inventory-id]').value.trim() : '';
    if (!name && !brand && !notes && !id) return;
    if (!name) throw new Error('Every owned item needs a name.');
    inventory.push({
      id,
      name,
      brand,
      status,
      notes,
      category: row.dataset.category || 'Uncategorized'
    });
  });
  if (inventory.length > 30) throw new Error('Keep owned inventory to 30 items or fewer.');

  const loved = profileLines($('#profileLovedNotes') ? $('#profileLovedNotes').value : '');
  const avoid = profileLines($('#profileAvoidNotes') ? $('#profileAvoidNotes').value : '');
  if (loved.length > 20 || avoid.length > 20) throw new Error('Keep each scent list to 20 notes or fewer.');

  return {
    owner,
    location,
    sizes,
    skin_and_health_constraints: constraints,
    owned_inventory: inventory,
    fragrance_profile: { loved_notes: loved, avoid_notes: avoid }
  };
}

async function saveProfile(event) {
  event.preventDefault();
  const error = $('#profileError');
  if (error) { error.hidden = true; error.textContent = ''; }
  const btn = $('#profileSaveBtn');
  let payload;
  try {
    payload = collectProfilePayload();
  } catch (err) {
    profileError(err.message);
    return;
  }
  busy(btn, true, 'Saving');
  try {
    await patchJSON('/api/context', payload);
    const dialog = $('#profileDialog');
    if (dialog && dialog.open) dialog.close();
    await refreshVault();
    toast('Profile saved. The Gate will use these details on its next check.');
  } catch (err) {
    profileError(err.message);
  } finally {
    busy(btn, false);
  }
}

/* ————— HELP / GLOSSARY ————— */
function glossaryMatches(entry, words) {
  const hay = `${entry.term || ''} ${entry.category || ''} ${entry.definition || ''} ${(entry.keywords || []).join(' ')}`.toLowerCase();
  return words.every((word) => hay.includes(word));
}

/**
 * The rail only dims the edges it can actually scroll towards, so the first
 * chip is never faded at rest and the last one never fades when you reach it.
 */
function syncHelpCategoryEdges() {
  const row = $('#helpCategories');
  if (!row) return;
  const max = row.scrollWidth - row.clientWidth;
  row.classList.toggle('has-left', row.scrollLeft > 2);
  row.classList.toggle('has-right', max > 2 && row.scrollLeft < max - 2);
}

function renderHelpCategories() {
  const host = $('#helpCategories');
  if (!host) return;
  const terms = state.help.entries || [];
  if (!terms.length) { host.innerHTML = ''; syncHelpCategoryEdges(); return; }
  const counts = new Map();
  terms.forEach((entry) => counts.set(entry.category, (counts.get(entry.category) || 0) + 1));
  const chips = [['ALL', 'All terms', terms.length], ...Array.from(counts.entries()).map(([category, count]) => [category, category, count])];
  host.innerHTML = chips.map(([value, label, count]) => `
    <button type="button" class="help-cat-chip ${state.help.category === value ? 'is-active' : ''}" data-help-category="${esc(value)}" aria-pressed="${state.help.category === value}">${esc(label)} <b>${count}</b></button>
  `).join('');
  syncHelpCategoryEdges();
}

/**
 * The category rail scrolls horizontally, so the active chip can sit off
 * screen. Centre it only when it is actually out of view, which keeps a manual
 * scroll position intact while still showing which filter is applied.
 */
function revealHelpCategory() {
  const row = $('#helpCategories');
  if (!row) return;
  const active = row.querySelector('.help-cat-chip.is-active');
  if (!active) return;
  const rowRect = row.getBoundingClientRect();
  const chipRect = active.getBoundingClientRect();
  const offset = chipRect.left - rowRect.left;
  const left = row.scrollLeft + offset;
  const right = left + chipRect.width;
  const edge = 16;
  const viewLeft = row.scrollLeft + edge;
  const viewRight = row.scrollLeft + row.clientWidth - edge;
  if (left >= viewLeft && right <= viewRight) return;
  row.scrollLeft = Math.max(0, left - (row.clientWidth - chipRect.width) / 2);
  syncHelpCategoryEdges();
}

function renderHelp() {
  const body = $('#helpBody');
  const count = $('#helpCount');
  if (!body) return;
  if (state.help.loading) {
    if (count) count.textContent = 'Loading…';
    body.innerHTML = '<p class="help-empty">Loading the glossary…</p>';
    return;
  }
  if (state.help.error) {
    if (count) count.textContent = 'Unavailable';
    body.innerHTML = `<p class="help-empty">${esc(state.help.error)}<br><button class="btn ghost sm" type="button" data-help-retry>Try again</button></p>`;
    return;
  }
  const words = state.help.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = (state.help.entries || []).filter((entry) => {
    if (state.help.category !== 'ALL' && entry.category !== state.help.category) return false;
    return !words.length || glossaryMatches(entry, words);
  });
  if (count) count.textContent = `${filtered.length} of ${(state.help.entries || []).length} terms`;
  renderHelpCategories();
  if (!filtered.length) {
    body.innerHTML = `<p class="help-empty">No term matches that filter.<br><button class="btn ghost sm" type="button" data-help-clear>Clear search</button></p>`;
    return;
  }
  body.innerHTML = filtered.map((entry) => `
    <article class="help-entry">
      <header><h3>${esc(entry.term)}</h3><span class="micro">${esc(entry.category)}</span></header>
      <p>${esc(entry.definition)}</p>
    </article>
  `).join('');
}

async function loadGlossary() {
  if (state.help.loading) return;
  state.help.loading = true;
  state.help.error = '';
  renderHelp();
  try {
    const data = await getJSON('/glossary.json');
    state.help.entries = Array.isArray(data.terms) ? data.terms : [];
    state.help.loaded = true;
  } catch (err) {
    state.help.error = `The glossary could not be loaded. ${err.message}`;
  } finally {
    state.help.loading = false;
    renderHelp();
  }
}

function openHelp() {
  const dialog = $('#helpDialog');
  if (dialog && !dialog.open) dialog.showModal();
  if (!state.help.loaded && !state.help.loading) loadGlossary();
  else renderHelp();
  window.setTimeout(revealHelpCategory, 70);
  window.setTimeout(() => { const input = $('#helpSearch'); if (input) input.focus(); }, 60);
}

/* ————— CONTEXT ————— */
function renderContextView(v) {
  const ctx = v.personal_context || {};
  const owner = String(ctx.owner || 'Vault Owner');
  const initials = owner.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('') || 'SV';
  const id = (sel) => $(sel);
  if (id('#profileInitials')) id('#profileInitials').textContent = initials;
  if (id('#profileName')) id('#profileName').textContent = owner;
  if (id('#profileLocation')) id('#profileLocation').textContent = String(ctx.location || 'PRIVATE NODE') + ' · PERSONAL AI TRACK';
  const sizes = Object.entries(ctx.sizes || {});
  const sizeGrid = $('#profileSizes');
  if (sizeGrid) {
    sizeGrid.innerHTML = sizes.length ? sizes.map(([label, value]) => `<div><span>${esc(label.replace(/_/g, ' '))}</span><b>${esc(value)}</b></div>`).join('') : '<div><span>Sizes</span><b>Not recorded</b></div>';
  }
  const constraints = $('#constraintList');
  if (constraints) {
    constraints.innerHTML = (ctx.skin_and_health_constraints || []).map((c) => `<li>${esc(c)}</li>`).join('') || '<li>No hard constraints recorded.</li>';
  }
  const inventory = $('#inventoryList');
  if (inventory) {
    inventory.innerHTML = (ctx.owned_inventory || []).map((o) => `
      <div class="inventory-item">
        <div class="inv-top"><strong>${esc(o.name)}</strong><span class="inv-status">${esc(o.status || 'OWNED')}</span></div>
        <p>${esc(o.brand || '')}${o.brand ? ' · ' : ''}${esc(o.notes || '')}</p>
      </div>`).join('') || '<div class="inventory-item"><p>No owned inventory tracked.</p></div>';
  }
  const loved = $('#lovedNotes');
  if (loved) {
    loved.innerHTML = ((ctx.fragrance_profile || {}).loved_notes || []).map((n) => `<span>${esc(n)}</span>`).join('') || '<span>Not profiled</span>';
  }
  const avoid = $('#avoidNotes');
  if (avoid) {
    avoid.innerHTML = ((ctx.fragrance_profile || {}).avoid_notes || []).map((n) => `<span>${esc(n)}</span>`).join('') || '<span>Nothing muted</span>';
  }
}

/* ————— ROUTER & TELEMETRY ————— */
function renderRouterView(v) {
  const telemetry = v.telemetry || [];
  const calls = telemetry.length;
  const tokens = telemetry.reduce((sum, t) => sum + (Number(t.tokens_in) || 0) + (Number(t.tokens_out) || 0), 0);
  const latency = calls ? telemetry.reduce((sum, t) => sum + (Number(t.latency_ms) || 0), 0) / calls : 0;
  const spend = telemetry.reduce((sum, t) => sum + (Number(t.cost_usd) || 0), 0);
  if ($('#routerCalls')) $('#routerCalls').textContent = fmt(calls);
  if ($('#routerTokens')) $('#routerTokens').textContent = fmt(tokens);
  if ($('#routerLatency')) $('#routerLatency').textContent = fmt(Math.round(latency));
  if ($('#routerSpend')) $('#routerSpend').textContent = money(spend, spend > 0 && spend < 0.1 ? 4 : 2);

  const models = v.models || {};
  const grid = $('#modelGrid');
  if (grid) {
    grid.innerHTML = Object.keys(MODEL_META).filter((key) => models[key]).map((key) => {
      const meta = MODEL_META[key];
      return `
      <div class="model-row" style="--tone:${meta.tone}">
        <span class="model-dot" aria-hidden="true">${meta.tag}</span>
        <div class="model-name"><b title="${esc(models[key])}">${esc(shortModel(models[key]))}</b><span>${esc(key)} tier · ${esc(meta.label)}</span></div>
        <span class="model-role">${esc(meta.label)}</span>
        <span class="model-live"><i></i>READY</span>
      </div>`;
    }).join('');
  }
  renderDigest(v, 'router');
}

function renderTelemetry(v) {
  const list = $('#telemetryList');
  if (!list) return;
  const telemetry = v.telemetry || [];
  if (!telemetry.length) {
    list.innerHTML = '<p class="telemetry-empty">No routed calls yet. Search the vault or ask the oracle.</p>';
    return;
  }
  list.innerHTML = telemetry.map((t) => `
    <div class="tel-row" title="${esc(t.task)} · ${esc(t.tier)} · ${fmt(t.tokens_in)} in / ${fmt(t.tokens_out)} out">
      <span class="tel-time">${esc(clockTime(t.timestamp))}</span>
      <span class="tel-task">${esc(t.task)}</span>
      <span class="tel-model" title="${esc(t.model)}">${esc(shortModel(t.model))}</span>
      <span class="tel-lat">${fmt(t.latency_ms)} ms</span>
      <span class="tel-cost">${money(t.cost_usd, 4)}</span>
    </div>`).join('');
}

/* ————— ORACLE ————— */
function openAudit(id) {
  if (!id) return;
  state.auditId = id;
  const dialog = $('#oracleDialog');
  if (dialog && !dialog.open) dialog.showModal();
  runImpulseAudit(id);
}

async function runImpulseAudit(id) {
  const v = state.vault;
  const item = v ? (v.wishlist || []).find((w) => w.id === id) : null;
  if (!item) { toast('That wish is no longer in the gate.', 'err'); return; }
  const out = $('#oracleOutput');
  const meta = $('#oracleMeta');
  const status = $('#oracleStatus');
  const rerun = $('#oracleRerun');
  if ($('#oracleTitle')) $('#oracleTitle').textContent = item.title;
  if ($('#oracleKicker')) $('#oracleKicker').textContent = 'IMPULSE GATE / ' + String(item.verdict || 'DEEP AUDIT').replace(/_/g, ' ');
  if (meta) meta.textContent = `Routing through Nebius Token Factory · ${item.category || 'UNCLUSTERED'}`;
  if (out) out.textContent = 'Establishing a deep-reasoning session with NVIDIA Nemotron 3 Ultra…\n\nCross-referencing owned inventory, monthly budget, routine constraints, discounter floors, and anti-hype community reviews.';
  if (status) status.textContent = 'ROUTING';
  if (rerun) rerun.disabled = true;
  try {
    const data = await postJSON('/api/impulse-gate', { id });
    if (out) out.textContent = data.analysis || JSON.stringify(data, null, 2);
    if (meta) meta.textContent = `${data.model || 'Nemotron 3 Ultra'} · ${data.live_nebius ? 'LIVE TOKEN FACTORY' : 'DETERMINISTIC FALLBACK'} · ${data.telemetry ? data.telemetry.latency_ms : '—'} ms`;
    if (status) status.textContent = data.live_nebius ? 'LIVE' : 'FALLBACK';
    refreshVault();
  } catch (err) {
    if (out) out.textContent = `ORACLE ROUTE FAILED\n\n${err.message}\n\nCheck the local server and NEBIUS_API_KEY, then re-run the audit.`;
    if (meta) meta.textContent = 'The deep-reasoning route could not be established.';
    if (status) status.textContent = 'ERROR';
    toast(err.message, 'err');
  } finally {
    if (rerun) rerun.disabled = false;
  }
}

async function runVaultAudit(btn) {
  const input = $('#auditInput');
  const question = input ? input.value.trim() : '';
  if (!question) { toast('Give the oracle a question first.', 'warn'); if (input) input.focus(); return; }
  const out = $('#auditOutput');
  const status = $('#auditStatus');
  if (out) out.textContent = 'Opening a 1M-token context window across browser bookmarks, wishlist, owned inventory, protocols, and personal constraints…\n\nThis is the expensive route. Nemotron 3 Ultra is thinking.';
  if (status) status.textContent = 'SYNTHESIZING';
  busy(btn, true, 'Synthesizing');
  try {
    const data = await postJSON('/api/vault-audit', { question });
    if (out) out.textContent = data.report || JSON.stringify(data, null, 2);
    if (status) status.textContent = data.live_nebius ? 'LIVE' : 'FALLBACK';
    toast('Vault-wide synthesis complete. Telemetry updated.');
    await refreshVault();
  } catch (err) {
    if (out) out.textContent = `VAULT AUDIT FAILED\n\n${err.message}`;
    if (status) status.textContent = 'ERROR';
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

/* ————— INGEST ————— */
const EXAMPLES = {
  glycolic: { mode: 'url', title: 'The Ordinary Glycolic Acid 7% Toning Solution', input: 'https://theordinary.com/en-us/glycolic-acid-7-toning-solution-100436.html', price: '13' },
  kit: { mode: 'url', title: 'Vintage Arsenal 1998 Home Shirt', input: 'https://www.classicfootballshirts.com/collections/arsenal', price: '110' },
  cashmere: { mode: 'url', title: 'Quince Mongolian Cashmere Crewneck', input: 'https://www.quince.com/men/cashmere', price: '59.90' },
  price: { mode: 'screenshot', title: 'Camera-roll price tag — Nike Air Max 1', input: "OCR: NIKE AIR MAX 1 '86 OG, $150.00, size US 10.5, END. Clothing", price: '150' }
};

async function runIngest(event) {
  event.preventDefault();
  const titleEl = $('#ingestTitle');
  const inputEl = $('#ingestInput');
  const priceEl = $('#ingestPrice');
  const errorEl = $('#ingestError');
  const btn = $('#ingestBtn');
  const title = titleEl ? titleEl.value.trim() : '';
  const input = inputEl ? inputEl.value.trim() : '';
  const price = priceEl ? priceEl.value.trim() : '';
  if (!title && !input) {
    if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'Add a headline, a URL, or the text from a screenshot before ingesting.'; }
    if (titleEl) titleEl.focus();
    return;
  }
  if (errorEl) errorEl.hidden = true;
  const modeEl = document.querySelector('input[name="ingestMode"]:checked');
  const mode = modeEl ? modeEl.value : 'url';
  busy(btn, true, 'Routing through the vault');
  try {
    const data = await postJSON('/api/ingest', { mode, title, input, price });
    renderIngestResult(data);
    toast(data.wishlist_item ? 'Signal captured and sent into the impulse gate.' : 'Signal captured and filed in the vault.');
    const form = $('#ingestForm');
    if (form) form.reset();
    await refreshVault();
    await loadBookmarks(true);
  } catch (err) {
    if (errorEl) { errorEl.hidden = false; errorEl.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

function renderIngestResult(data) {
  const panel = $('#ingestResult');
  if (!panel) return;
  const item = data.bookmark || {};
  const wl = data.wishlist_item;
  const tel = data.telemetry || {};
  const gate = wl ? wl.verdict_label : 'Stored as reference — no gate item created';
  panel.hidden = false;
  panel.innerHTML = `
    <div class="result-head">
      <div><p class="eyebrow">CAPTURE CONFIRMED</p><h3>${esc(item.title || 'Signal archived')}</h3></div>
      <div class="result-chips">
        <span class="accent">${esc(item.category || 'UNCLUSTERED')}</span>
        <span>${esc(item.item_type || 'reference')}</span>
        ${wl ? `<span>${esc(wl.verdict || 'GATED')}</span>` : ''}
      </div>
    </div>
    <div class="result-grid">
      <div><span>Cluster</span><b>${esc(item.category || '—')} / ${esc(item.subcategory || '—')}</b></div>
      <div><span>Snapshot</span><b>${esc(item.snapshot_status || '—')}</b></div>
      <div><span>Routed model</span><b>${esc(tel.model || 'Stashov router')}</b></div>
      <div><span>Gate verdict</span><b>${esc(gate)}</b></div>
    </div>
    ${wl ? `<div class="privacy-note"><svg class="icon"><use href="#i-lock"/></svg><span><strong>${esc(wl.verdict_label)}</strong> — ${esc(wl.anti_hype_summary || 'Cooling-off lock active.')}</span></div>` : ''}
    <details><summary>Raw router payload</summary><pre class="console">${esc(JSON.stringify(data, null, 2))}</pre></details>
    <div class="card-actions">${wl ? '<button type="button" class="btn ghost sm" data-goto="wishlist">Open the impulse gate <svg class="icon"><use href="#i-arrow"/></svg></button>' : '<button type="button" class="btn ghost sm" data-goto="vault">Open signal index <svg class="icon"><use href="#i-arrow"/></svg></button>'}</div>`;
  window.setTimeout(() => panel.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' }), 60);
}

/* ————— SERVERLESS JOB ————— */
async function runServerlessJob(btn) {
  const out = $('#jobOutput');
  const status = $('#jobStatus');
  if (out) { out.hidden = false; out.textContent = 'Starting Nebius Serverless Job…\n\nPoller: discounter price floor\nVerifier: bookmark link rot\nDigest: cooling timers + routine conflicts'; }
  if (status) status.textContent = 'RUNNING';
  busy(btn, true, 'Running job');
  try {
    const data = await postJSON('/api/serverless-job', {});
    if (out) out.textContent = JSON.stringify(data.report || data, null, 2);
    if (status) status.textContent = 'COMPLETE';
    const stats = data.report && data.report.stats ? data.report.stats : null;
    toast(stats ? `Job complete · ${fmt(stats.total_bookmarks_verified)} links verified · ${fmt(stats.wishlist_items_polled)} wishes polled.` : 'Serverless job complete.');
    await refreshVault();
  } catch (err) {
    if (out) out.textContent = `SERVERLESS JOB FAILED\n\n${err.message}`;
    if (status) status.textContent = 'ERROR';
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

/* ————— PALETTE ————— */
function paletteActions() {
  const sections = visibleSections().map((section) => ({
    label: section.label,
    hint: section.builtin ? (TABS[section.id] || '') : 'CUSTOM',
    icon: SECTION_ICONS.includes(section.icon) ? section.icon : 'i-spark',
    run: () => setTab(section.id)
  }));
  return [
    ...sections,
    { label: 'Search the vault', hint: '/', icon: 'i-search', run: () => { setTab('vault'); window.setTimeout(() => { const el = $('#bmSearchInput'); if (el) el.focus(); }, 160); } },
    { label: 'Add a product link to the gate', hint: 'Gate', icon: 'i-plus', run: () => { setTab('wishlist'); window.setTimeout(() => { const el = $('#quickAddUrl'); if (el) el.focus(); }, 180); } },
    { label: 'Get the one-click capture bookmarklet', icon: 'i-spark', run: () => openCaptureDialog() },
    { label: 'Ask the 1M-context oracle', icon: 'i-command', run: () => { setTab('router'); window.setTimeout(() => { const el = $('#auditInput'); if (el) el.focus(); }, 180); } },
    { label: 'Customize sidebar sections', icon: 'i-edit', run: () => openSectionsDialog() },
    { label: 'Run Nebius serverless job', icon: 'i-refresh', run: () => runServerlessJob($('#jobBtn')) },
    { label: 'Sync browser bookmarks', icon: 'i-refresh', run: () => syncBookmarks($('#syncBtn')) }
  ];
}
function openPalette() {
  const dialog = $('#paletteDialog');
  const input = $('#paletteInput');
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  if (input) {
    input.value = '';
    input.setAttribute('aria-expanded', 'true');
  }
  state.paletteIndex = 0;
  renderPalette('');
  dialog.addEventListener('close', () => {
    if (!input) return;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }, { once: true });
  window.setTimeout(() => { if (input) input.focus(); }, 30);
}
function renderPalette(query) {
  const list = $('#paletteList');
  if (!list) return;
  const normalized = String(query || '').toLowerCase().trim();
  state.paletteFiltered = paletteActions().filter((action) => !normalized || action.label.toLowerCase().includes(normalized));
  state.paletteIndex = Math.max(0, Math.min(state.paletteIndex, state.paletteFiltered.length - 1));
  if (!state.paletteFiltered.length) {
    list.innerHTML = '<p class="palette-empty" role="presentation">No command matches that phrase.</p>';
    syncPaletteActiveDescendant();
    return;
  }
  list.innerHTML = state.paletteFiltered.map((action, i) => `
    <div class="palette-item ${i === state.paletteIndex ? 'is-active' : ''}" id="paletteOpt${i}" role="option" tabindex="-1" aria-selected="${i === state.paletteIndex}" data-index="${i}">
      <svg class="icon" aria-hidden="true"><use href="#${action.icon}"/></svg>
      <span>${esc(action.label)}</span>
      ${action.hint ? `<kbd>${esc(action.hint)}</kbd>` : ''}
    </div>`).join('');
  scrollPaletteActive();
  syncPaletteActiveDescendant();
}
function syncPaletteActiveDescendant() {
  const input = $('#paletteInput');
  if (!input) return;
  if (!state.paletteFiltered.length) {
    input.removeAttribute('aria-activedescendant');
    return;
  }
  input.setAttribute('aria-activedescendant', `paletteOpt${state.paletteIndex}`);
}
function setPaletteIndex(index) {
  if (!state.paletteFiltered.length) return;
  state.paletteIndex = (index + state.paletteFiltered.length) % state.paletteFiltered.length;
  $$('.palette-item', $('#paletteList')).forEach((el, i) => {
    const active = i === state.paletteIndex;
    el.classList.toggle('is-active', active);
    el.setAttribute('aria-selected', String(active));
  });
  syncPaletteActiveDescendant();
  scrollPaletteActive();
}
function scrollPaletteActive() {
  const active = $('.palette-item.is-active', $('#paletteList'));
  if (active) active.scrollIntoView({ block: 'nearest' });
}
function runPaletteIndex(index) {
  const action = state.paletteFiltered[index];
  if (!action) return;
  const dialog = $('#paletteDialog');
  if (dialog && dialog.open) dialog.close();
  window.setTimeout(() => action.run(), 20);
}

/* ————— SCAFFOLDING ————— */
function setupClock() {
  const tick = () => {
    const el = $('#clock');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
  };
  tick();
  window.setInterval(tick, 1000);
  const kbd = $('#paletteKbd');
  if (kbd) kbd.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
}

function setupReveal() {
  const elements = $$('.reveal');
  if (!elements.length) return;
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -36px 0px' });
  elements.forEach((el) => observer.observe(el));
}

function setupCursor() {
  const glow = $('.cursor-glow');
  if (!glow || reduceMotion.matches || window.matchMedia('(pointer: coarse)').matches) {
    if (glow) glow.remove();
    return;
  }
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let x = targetX;
  let y = targetY;
  let rafId = 0;
  let running = false;
  glow.style.transform = `translate3d(${x - 280}px, ${y - 280}px, 0)`;
  const frame = () => {
    x += (targetX - x) * 0.12;
    y += (targetY - y) * 0.12;
    glow.style.transform = `translate3d(${x - 280}px, ${y - 280}px, 0)`;
    if (Math.abs(targetX - x) < 0.4 && Math.abs(targetY - y) < 0.4) {
      running = false;
      return;
    }
    rafId = requestAnimationFrame(frame);
  };
  const start = () => {
    if (running || reduceMotion.matches) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  };
  window.addEventListener('pointermove', (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    start();
  }, { passive: true });
  reduceMotion.addEventListener('change', () => {
    if (!reduceMotion.matches) return;
    running = false;
    cancelAnimationFrame(rafId);
    glow.remove();
  });
}

async function loadSections() {
  try {
    const data = await getJSON('/api/sections');
    if (Array.isArray(data.sections) && data.sections.length) {
      state.sections = data.sections;
      renderSections();
      return true;
    }
  } catch (_) {}
  renderSections();
  return false;
}

function fillSectionForm(section) {
  const id = section ? section.id : '';
  const color = section ? section.color : '#c6ff4a';
  state.editingSectionId = id || null;
  if ($('#sectionId')) $('#sectionId').value = id;
  if ($('#sectionFormMode')) $('#sectionFormMode').textContent = section ? 'EDIT SECTION' : 'NEW SECTION';
  if ($('#sectionLabel')) $('#sectionLabel').value = section ? section.label : '';
  if ($('#sectionIcon')) $('#sectionIcon').value = section && SECTION_ICONS.includes(section.icon) ? section.icon : 'i-spark';
  if ($('#sectionColor')) $('#sectionColor').value = color;
  if ($('#sectionColorText')) $('#sectionColorText').value = color;
  if ($('#sectionLogo')) $('#sectionLogo').value = section ? section.logo || '' : '';
  if ($('#sectionTags')) $('#sectionTags').value = section ? (section.tags || []).join(', ') : '';
  if ($('#sectionDesc')) $('#sectionDesc').value = section ? section.description || '' : '';
  if ($('#sectionVisible')) $('#sectionVisible').checked = section ? section.visible !== false : true;
  if ($('#sectionDeleteBtn')) {
    $('#sectionDeleteBtn').hidden = !section || section.builtin;
    $('#sectionDeleteBtn').disabled = !section || section.builtin;
    $('#sectionDeleteBtn').title = !section ? 'Create the section first.' : section.builtin ? 'Built-in sections can be hidden, not deleted.' : 'Delete this custom section and its cards.';
  }
  if ($('#sectionSaveBtn')) $('#sectionSaveBtn').innerHTML = section ? '<svg class="icon"><use href="#i-check"/></svg> Save section' : '<svg class="icon"><use href="#i-plus"/></svg> Create section';
  const error = $('#sectionError');
  if (error) error.hidden = true;
}

function renderSectionManager(selectedId) {
  const list = $('#sectionManagerList');
  if (!list) return;
  list.innerHTML = state.sections.map((section, index) => `
    <li class="manager-row ${section.id === selectedId ? 'is-selected' : ''} ${section.visible ? '' : 'is-hidden'}">
      <button type="button" class="manager-pick" data-select-section="${esc(section.id)}" aria-pressed="${section.id === selectedId}">
        <span class="manager-swatch" style="--tone:${esc(section.color)}">${sectionIconMarkup(section)}</span>
        <span class="manager-name">${esc(section.label)}<small>${section.builtin ? 'BUILT IN' : 'CUSTOM'}${section.visible ? '' : ' / HIDDEN'}</small></span>
      </button>
      <span class="manager-actions">
        <button type="button" class="mini-btn" data-move-section="${esc(section.id)}" data-dir="-1" aria-label="Move ${esc(section.label)} up" ${index === 0 ? 'disabled' : ''}><svg class="icon"><use href="#i-up"/></svg></button>
        <button type="button" class="mini-btn" data-move-section="${esc(section.id)}" data-dir="1" aria-label="Move ${esc(section.label)} down" ${index === state.sections.length - 1 ? 'disabled' : ''}><svg class="icon"><use href="#i-down"/></svg></button>
        <button type="button" class="mini-btn ${section.visible ? 'is-on' : ''}" data-toggle-section="${esc(section.id)}" aria-label="${section.visible ? 'Hide' : 'Show'} ${esc(section.label)}" aria-pressed="${section.visible}"><svg class="icon"><use href="#i-eye"/></svg></button>
      </span>
    </li>`).join('');
}

function openSectionsDialog(sectionId) {
  const dialog = $('#sectionsDialog');
  if (!dialog) return;
  const section = sectionId ? sectionById(sectionId) : null;
  fillSectionForm(section);
  renderSectionManager(section ? section.id : null);
  if (!dialog.open) dialog.showModal();
}

async function saveSectionForm(event) {
  event.preventDefault();
  const label = $('#sectionLabel') ? $('#sectionLabel').value.trim() : '';
  const error = $('#sectionError');
  if (!label) {
    if (error) { error.hidden = false; error.textContent = 'Give the section a name.'; }
    if ($('#sectionLabel')) $('#sectionLabel').focus();
    return;
  }
  const color = $('#sectionColorText') ? $('#sectionColorText').value.trim() : '#c6ff4a';
  const payload = {
    label,
    icon: $('#sectionIcon') ? $('#sectionIcon').value : 'i-spark',
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#c6ff4a',
    logo: $('#sectionLogo') ? $('#sectionLogo').value.trim() : '',
    tags: $('#sectionTags') ? $('#sectionTags').value : '',
    description: $('#sectionDesc') ? $('#sectionDesc').value.trim() : '',
    visible: $('#sectionVisible') ? $('#sectionVisible').checked : true
  };
  const btn = $('#sectionSaveBtn');
  busy(btn, true, 'Saving');
  try {
    const data = state.editingSectionId
      ? await putJSON(`/api/sections/${encodeURIComponent(state.editingSectionId)}`, payload)
      : await postJSON('/api/sections', payload);
    state.editingSectionId = data.section.id;
    await loadSections();
    fillSectionForm(sectionById(state.editingSectionId));
    renderSectionManager(state.editingSectionId);
    toast(data.section.builtin ? 'Built-in section updated.' : 'Custom section saved.');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

async function moveSection(id, direction) {
  const index = state.sections.findIndex((section) => section.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.sections.length) return;
  const ids = state.sections.map((section) => section.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  try {
    await postJSON('/api/sections/reorder', { ids });
    await loadSections();
    renderSectionManager(state.editingSectionId);
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function toggleSectionVisibility(id) {
  const section = sectionById(id);
  if (!section) return;
  try {
    await putJSON(`/api/sections/${encodeURIComponent(id)}`, {
      label: section.label,
      icon: section.icon,
      color: section.color,
      logo: section.logo,
      tags: section.tags,
      description: section.description,
      visible: !section.visible
    });
    await loadSections();
    renderSectionManager(state.editingSectionId);
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function deleteCurrentSection() {
  const section = sectionById(state.editingSectionId);
  if (!section) return;
  if (section.builtin) {
    toast('Built-in sections can be hidden, not deleted.', 'warn');
    return;
  }
  if (!window.confirm(`Delete "${section.label}" and all ${(section.cards || []).length} cards?`)) return;
  try {
    await deleteJSON(`/api/sections/${encodeURIComponent(section.id)}`);
    state.editingSectionId = null;
    await loadSections();
    fillSectionForm(null);
    renderSectionManager(null);
    toast('Custom section deleted.');
  } catch (err) {
    toast(err.message, 'err');
  }
}

function setCardColor(color) {
  if ($('#cardColor')) $('#cardColor').value = color;
  if ($('#cardColorText')) $('#cardColorText').value = color;
}

function openCardDialog(sectionId, cardId) {
  const section = sectionById(sectionId);
  const dialog = $('#cardDialog');
  if (!section || !dialog) return;
  const card = cardId ? (section.cards || []).find((item) => item.id === cardId) : null;
  state.editingSectionId = sectionId;
  state.editingCardId = card ? card.id : null;
  if ($('#cardSectionId')) $('#cardSectionId').value = sectionId;
  if ($('#cardId')) $('#cardId').value = card ? card.id : '';
  if ($('#cardDialogTitle')) $('#cardDialogTitle').textContent = card ? 'Edit card' : 'New card';
  if ($('#cardTitle')) $('#cardTitle').value = card ? card.title : '';
  if ($('#cardUrl')) $('#cardUrl').value = card ? card.url || '' : '';
  if ($('#cardImage')) $('#cardImage').value = card ? card.image || '' : '';
  if ($('#cardPrice')) $('#cardPrice').value = card ? card.price || '' : '';
  if ($('#cardStatus')) $('#cardStatus').value = card ? card.status || '' : '';
  if ($('#cardDesc')) $('#cardDesc').value = card ? card.description || '' : '';
  if ($('#cardTags')) $('#cardTags').value = card ? (card.tags || []).join(', ') : '';
  setCardColor(card ? card.color || section.color : section.color || '#c6ff4a');
  if ($('#cardDeleteBtn')) $('#cardDeleteBtn').hidden = !card;
  const error = $('#cardError');
  if (error) error.hidden = true;
  if (!dialog.open) dialog.showModal();
}

async function findCardImage(btn) {
  const imageInput = $('#cardImage');
  const pageInput = $('#cardUrl');
  const target = imageInput ? imageInput.value.trim() : '';
  const page = pageInput ? pageInput.value.trim() : '';
  if (!target && !page) {
    toast('Add an image or product link first.', 'warn');
    return;
  }
  busy(btn, true, 'Finding');
  try {
    const data = await postJSON('/api/images/resolve', { url: target || page, pageUrl: page });
    if (data.image && imageInput) imageInput.value = data.image;
    toast('Photo cached locally.');
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

async function saveCardForm(event) {
  event.preventDefault();
  const section = sectionById($('#cardSectionId') ? $('#cardSectionId').value : '');
  const error = $('#cardError');
  if (!section) { toast('Section not found.', 'err'); return; }
  const title = $('#cardTitle') ? $('#cardTitle').value.trim() : '';
  if (!title) {
    if (error) { error.hidden = false; error.textContent = 'Give the card a title.'; }
    if ($('#cardTitle')) $('#cardTitle').focus();
    return;
  }
  const color = $('#cardColorText') ? $('#cardColorText').value.trim() : section.color;
  const payloadCard = {
    id: state.editingCardId || undefined,
    title,
    description: $('#cardDesc') ? $('#cardDesc').value.trim() : '',
    image: $('#cardImage') ? $('#cardImage').value.trim() : '',
    url: $('#cardUrl') ? $('#cardUrl').value.trim() : '',
    price: $('#cardPrice') ? $('#cardPrice').value.trim() : '',
    status: $('#cardStatus') ? $('#cardStatus').value.trim() : '',
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : section.color,
    tags: $('#cardTags') ? $('#cardTags').value : ''
  };
  const cards = [...(section.cards || [])];
  if (state.editingCardId) {
    const index = cards.findIndex((card) => card.id === state.editingCardId);
    if (index >= 0) cards[index] = { ...cards[index], ...payloadCard };
  } else {
    cards.push(payloadCard);
  }
  const btn = $('#cardSaveBtn');
  busy(btn, true, 'Saving');
  try {
    await putJSON(`/api/sections/${encodeURIComponent(section.id)}`, {
      label: section.label,
      icon: section.icon,
      color: section.color,
      logo: section.logo,
      tags: section.tags,
      description: section.description,
      visible: section.visible,
      cards
    });
    await loadSections();
    const dialog = $('#cardDialog');
    if (dialog && dialog.open) dialog.close();
    toast('Card saved.');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

async function deleteCard(sectionId, cardId) {
  const section = sectionById(sectionId);
  if (!section) return;
  const card = (section.cards || []).find((item) => item.id === cardId);
  if (!card) return;
  if (!window.confirm(`Delete "${card.title || 'this card'}"?`)) return;
  try {
    await putJSON(`/api/sections/${encodeURIComponent(sectionId)}`, {
      label: section.label,
      icon: section.icon,
      color: section.color,
      logo: section.logo,
      tags: section.tags,
      description: section.description,
      visible: section.visible,
      cards: (section.cards || []).filter((item) => item.id !== cardId)
    });
    await loadSections();
    toast('Card removed.');
  } catch (err) {
    toast(err.message, 'err');
  }
}

function openPhotoDialog(wishId) {
  const item = state.vault ? (state.vault.wishlist || []).find((wish) => wish.id === wishId) : null;
  const dialog = $('#photoDialog');
  if (!item || !dialog) return;
  state.photoId = item.id;
  if ($('#photoTitle')) $('#photoTitle').textContent = item.title;
  if ($('#photoUrl')) $('#photoUrl').value = item.image_source || '';
  const preview = $('#photoPreview');
  if (preview) {
    const image = safeImage(item.image);
    preview.innerHTML = image ? `<img src="${esc(image)}" alt="" />` : '<span>No photo cached yet</span>';
  }
  const error = $('#photoError');
  if (error) error.hidden = true;
  if (!dialog.open) dialog.showModal();
}

async function savePhotoForm(event) {
  event.preventDefault();
  if (!state.photoId) return;
  const input = $('#photoUrl');
  const error = $('#photoError');
  const btn = $('#photoSaveBtn');
  busy(btn, true, 'Finding');
  try {
    await postJSON(`/api/wishlist/${encodeURIComponent(state.photoId)}/photo`, { url: input ? input.value.trim() : '' });
    const dialog = $('#photoDialog');
    if (dialog && dialog.open) dialog.close();
    await refreshVault();
    toast('Wishlist photo updated.');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

function renderClusterDialog() {
  const dialog = $('#clusterDialog');
  const d = state.clusterDialog;
  if (!dialog || !d.name || !state.vault) return;
  const v = state.vault;
  const meta = clusterMeta(v, d.name);
  const wishes = clusterWishes(v, d.name);
  const hero = d.hero_item_id
    ? wishes.find((wish) => wish.id === d.hero_item_id)
    : clusterHero(v, d.name, meta);

  if ($('#clusterDialogTitle')) $('#clusterDialogTitle').textContent = d.name;
  if ($('#clusterDialogSub')) {
    $('#clusterDialogSub').textContent = `${wishes.length} ${wishes.length === 1 ? 'wish' : 'wishes'} · ${d.mode === 'product' ? 'photo-led cluster' : 'typographic reference cluster'}`;
  }
  $$('[data-cluster-mode]', dialog).forEach((btn) => {
    const active = btn.dataset.clusterMode === d.mode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  const heroField = $('#clusterHeroField');
  if (heroField) heroField.hidden = d.mode === 'reference';
  const coverField = $('#clusterCoverField');
  if (coverField) coverField.hidden = d.mode === 'reference';
  if ($('#clusterModeNote')) {
    $('#clusterModeNote').textContent = d.mode === 'reference'
      ? 'Reference mode uses this cluster\u2019s generated reference card. Switch to Product photos to feature an exact wish.'
      : 'Product mode uses the exact wishlist photo. Switch to Reference card to use this cluster\u2019s generated cover.';
  }

  const coverInput = $('#clusterCoverUrl');
  if (coverInput && document.activeElement !== coverInput) coverInput.value = d.cover || '';

  const picker = $('#clusterHeroPicker');
  if (picker) {
    const auto = `<button type="button" class="hero-option ${d.hero_item_id ? '' : 'is-selected'}" data-hero="">
      <span class="hero-auto">AUTO</span>
      <span class="hero-copy"><b>Best available wish</b><small>${wishes.length ? 'Highest verdict in this cluster' : 'No wishes in this cluster yet'}</small></span>
    </button>`;
    const options = wishes.map((wish) => {
      const image = safeImage(wish.image);
      const initial = String(wish.title || '?').trim().charAt(0).toUpperCase() || '?';
      return `<button type="button" class="hero-option ${d.hero_item_id === wish.id ? 'is-selected' : ''}" data-hero="${esc(wish.id)}">
        ${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : `<span class="hero-thumb-fallback" aria-hidden="true">${esc(initial)}</span>`}
        <span class="hero-copy"><b>${esc(wish.title)}</b><small>${esc(wish.brand || 'PRIVATE SAVE')} · ${money(wish.lowest_verified_price, 2)}</small></span>
      </button>`;
    }).join('');
    picker.innerHTML = auto + options;
  }

  const preview = $('#clusterPreview');
  if (preview) {
    const entries = Object.entries(v.category_counts || {}).sort((a, b) => b[1] - a[1]);
    const index = Math.max(0, entries.findIndex(([entry]) => entry === d.name));
    preview.style.setProperty('--tone', clusterTone(v, d.name));
    const referenceCard = clusterCardImage(d.name);
    preview.innerHTML = d.mode === 'reference'
      ? referenceCard ? `<img src="${esc(referenceCard)}" alt="" />` : clusterDesignMarkup(d.name, index, 'REFERENCE')
      : looksLikeImage(d.cover) || safeImage(hero && hero.image)
        ? `<img src="${esc(looksLikeImage(d.cover) ? d.cover : hero.image)}" alt="" />`
        : referenceCard ? `<img src="${esc(referenceCard)}" alt="" />` : clusterDesignMarkup(d.name, index, 'AWAITING FIRST WISH');
  }
}

function openClusterDialog(name) {
  const dialog = $('#clusterDialog');
  if (!dialog || !state.vault || !name) return;
  const meta = clusterMeta(state.vault, name);
  state.clusterDialog = {
    name,
    mode: meta.mode,
    default_mode: meta.default_mode,
    hero_item_id: meta.hero_item_id,
    cover: meta.cover
  };
  const error = $('#clusterError');
  if (error) error.hidden = true;
  renderClusterDialog();
  if (!dialog.open) dialog.showModal();
}

function resetClusterDialog() {
  const d = state.clusterDialog;
  if (!d.name) return;
  state.clusterDialog = { ...d, mode: d.default_mode || 'product', hero_item_id: '', cover: '' };
  renderClusterDialog();
}

async function findClusterCover(btn) {
  const input = $('#clusterCoverUrl');
  const value = input ? input.value.trim() : '';
  if (!value) {
    toast('Paste an image or product URL first.', 'warn');
    return;
  }
  busy(btn, true, 'Finding');
  try {
    const data = await postJSON('/api/images/resolve', { url: value });
    if (data.image) {
      state.clusterDialog.cover = data.image;
      if (input) input.value = data.image;
      renderClusterDialog();
      toast('Cover image cached locally.');
    }
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

async function saveClusterForm(event) {
  event.preventDefault();
  const d = state.clusterDialog;
  if (!d.name) return;
  const error = $('#clusterError');
  const btn = $('#clusterSaveBtn');
  busy(btn, true, 'Saving');
  try {
    await putJSON(`/api/clusters/${encodeURIComponent(d.name)}`, {
      mode: d.mode,
      hero_item_id: d.hero_item_id,
      cover: d.cover
    });
    const dialog = $('#clusterDialog');
    if (dialog && dialog.open) dialog.close();
    await refreshVault();
    toast('Cluster cover updated.');
  } catch (err) {
    if (error) { error.hidden = false; error.textContent = err.message; }
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
  }
}

function jumpToWish(id) {
  if (!id) return;
  setTab('wishlist', { scroll: false });
  window.setTimeout(() => {
    const card = $$('[data-wish-id]').find((el) => el.dataset.wishId === id);
    if (!card) return;
    card.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    card.focus({ preventScroll: true });
    card.classList.add('is-focus');
    window.setTimeout(() => card.classList.remove('is-focus'), 1800);
  }, 90);
}

function bindEvents() {
  const railNav = $('.rail-nav');
  if (railNav) {
    railNav.addEventListener('click', (event) => {
      const btn = event.target.closest('.rail-btn');
      if (btn) setTab(btn.dataset.tab);
    });
    railNav.addEventListener('keydown', (event) => {
      const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const tabs = $$('.rail-btn');
      const current = tabs.indexOf(document.activeElement);
      let next = current;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else {
        const dir = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
        next = (current + dir + tabs.length) % tabs.length;
      }
      if (tabs[next]) {
        tabs[next].focus();
        tabs[next].click();
      }
    });
  }
  window.addEventListener('hashchange', () => {
    const route = routeState();
    if (!sectionById(route.tab)) return;
    applyRoute(route);
    if (route.tab !== state.tab) {
      setTab(route.tab, { scroll: false, updateHash: false });
    } else if (state.vault) {
      renderAll();
      if (route.tab === 'library') loadLibrary(true);
      if (route.tab === 'vault') loadBookmarks(true);
    }
  });
  document.addEventListener('click', (event) => {
    const go = event.target.closest('[data-goto]');
    if (!go) return;
    setTab(go.dataset.goto);
    if (go.id === 'gateOracleBtn') window.setTimeout(() => { const el = $('#auditInput'); if (el) el.focus(); }, 320);
  });
  const paletteBtn = $('#paletteBtn');
  if (paletteBtn) paletteBtn.addEventListener('click', openPalette);
  const paletteInput = $('#paletteInput');
  if (paletteInput) {
    paletteInput.addEventListener('input', () => { state.paletteIndex = 0; renderPalette(paletteInput.value); });
    paletteInput.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setPaletteIndex(state.paletteIndex + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setPaletteIndex(state.paletteIndex - 1); }
      else if (event.key === 'Enter') { event.preventDefault(); runPaletteIndex(state.paletteIndex); }
    });
  }
  const paletteList = $('#paletteList');
  if (paletteList) {
    paletteList.addEventListener('click', (event) => {
      const item = event.target.closest('[data-index]');
      if (item) runPaletteIndex(Number(item.dataset.index));
    });
    paletteList.addEventListener('mousemove', (event) => {
      const item = event.target.closest('[data-index]');
      if (item && Number(item.dataset.index) !== state.paletteIndex) setPaletteIndex(Number(item.dataset.index));
    });
  }
  let goPending = 0;
  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const dialog = $('#paletteDialog');
      if (dialog && dialog.open) dialog.close();
      else openPalette();
      return;
    }
    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
    if (event.key === '/' || event.key === 's') {
      event.preventDefault();
      setTab('vault');
      window.setTimeout(() => { const el = $('#bmSearchInput'); if (el) el.focus(); }, 160);
      return;
    }
    const now = Date.now();
    if (event.key === 'g') {
      goPending = now;
      return;
    }
    if (goPending && now - goPending < 1000) {
      const destinations = { d: 'deck', v: 'vault', l: 'library', w: 'wishlist', r: 'protocols', y: 'context', c: 'ingest', t: 'router' };
      const destination = destinations[event.key.toLowerCase()];
      goPending = 0;
      if (destination) {
        event.preventDefault();
        setTab(destination);
        return;
      }
    }
    if (event.key === 'n' && state.tab === 'protocols') {
      event.preventDefault();
      openRoutineDialog(null);
    }
  });
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  });
  const oracleClose = $('#oracleClose');
  const oracleDismiss = $('#oracleDismiss');
  if (oracleClose) oracleClose.addEventListener('click', () => $('#oracleDialog').close());
  if (oracleDismiss) oracleDismiss.addEventListener('click', () => $('#oracleDialog').close());
  const oracleRerun = $('#oracleRerun');
  if (oracleRerun) oracleRerun.addEventListener('click', () => runImpulseAudit(state.auditId));

  const search = $('#bmSearchInput');
  if (search) {
    search.addEventListener('input', () => {
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(() => loadBookmarks(true), 420);
    });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { window.clearTimeout(state.searchTimer); loadBookmarks(true); }
      if (event.key === 'Escape') {
        if (search.value) { search.value = ''; loadBookmarks(true); }
        else search.blur();
      }
    });
  }
  const browser = $('#bmBrowserFilter');
  if (browser) browser.addEventListener('change', () => loadBookmarks(true));
  const searchBtn = $('#bmSearchBtn');
  if (searchBtn) searchBtn.addEventListener('click', () => loadBookmarks(true));
  const clusterGrid = $('#clusterGrid');
  if (clusterGrid) {
    clusterGrid.addEventListener('click', (event) => {
      const cover = event.target.closest('[data-cover]');
      if (cover) { openClusterDialog(cover.dataset.cover); return; }
      const btn = event.target.closest('[data-cat]');
      if (!btn) return;
      state.category = state.category === btn.dataset.cat ? 'ALL' : btn.dataset.cat;
      syncHash();
      renderCategories(state.vault);
      renderWantedStrip(state.vault);
      loadBookmarks(true);
      const strip = $('#wantedStrip');
      const results = $('.results-bar');
      const target = strip && !strip.hidden ? strip : results;
      if (target && !reduceMotion.matches) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  const wantedStrip = $('#wantedStrip');
  if (wantedStrip) {
    wantedStrip.addEventListener('click', (event) => {
      const cover = event.target.closest('[data-cover]');
      if (cover) { openClusterDialog(cover.dataset.cover); return; }
      const jump = event.target.closest('[data-wish-jump]');
      if (jump) jumpToWish(jump.dataset.wishJump);
    });
  }
  const allClustersBtn = $('#allClustersBtn');
  if (allClustersBtn) {
    allClustersBtn.addEventListener('click', () => {
      state.category = 'ALL';
      syncHash();
      renderCategories(state.vault);
      renderWantedStrip(state.vault);
      loadBookmarks(true);
    });
  }
  const loadMore = $('#loadMoreBtn');
  if (loadMore) loadMore.addEventListener('click', () => loadBookmarks(false));
  const bmGrid = $('#bmGrid');
  if (bmGrid) {
    bmGrid.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-promote]');
      if (btn) promoteBookmark(btn.dataset.promote, btn);
    });
  }
  const syncBtn = $('#syncBtn');
  if (syncBtn) syncBtn.addEventListener('click', () => syncBookmarks(syncBtn));
  const importBtn = $('#importBtn');
  const importFile = $('#importFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async () => {
      const file = importFile.files && importFile.files[0];
      importFile.value = '';
      if (file) await importVaultFile(file);
    });
  }

  const librarySearch = $('#librarySearch');
  if (librarySearch) {
    librarySearch.addEventListener('input', () => {
      window.clearTimeout(state.library.timer);
      state.library.timer = window.setTimeout(() => loadLibrary(true), 360);
    });
    librarySearch.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { window.clearTimeout(state.library.timer); loadLibrary(true); }
      if (event.key === 'Escape') {
        if (librarySearch.value) { librarySearch.value = ''; loadLibrary(true); }
        else librarySearch.blur();
      }
    });
  }
  const libraryStatusFilter = $('#libraryStatusFilter');
  if (libraryStatusFilter) libraryStatusFilter.addEventListener('change', () => loadLibrary(true));
  const libraryRefreshBtn = $('#libraryRefreshBtn');
  if (libraryRefreshBtn) libraryRefreshBtn.addEventListener('click', () => loadLibrary(true));
  const librarySections = $('#librarySections');
  if (librarySections) {
    librarySections.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-library-section]');
      if (!btn) return;
      state.library.section = btn.dataset.librarySection;
      syncHash();
      loadLibrary(true);
    });
  }
  const libraryGrid = $('#libraryGrid');
  if (libraryGrid) {
    libraryGrid.addEventListener('click', (event) => {
      const restore = event.target.closest('[data-library-restore]');
      if (restore) { bulkLibrary('restore', [restore.dataset.libraryRestore]); return; }
      const edit = event.target.closest('[data-library-edit]');
      if (edit) openLibraryEdit(edit.dataset.libraryEdit);
    });
    libraryGrid.addEventListener('change', (event) => {
      const pick = event.target.closest('[data-library-pick]');
      if (!pick) return;
      const ids = new Set(state.library.selected);
      if (pick.checked) ids.add(pick.dataset.libraryPick);
      else ids.delete(pick.dataset.libraryPick);
      state.library.selected = [...ids];
      const card = pick.closest('.library-card');
      if (card) card.classList.toggle('is-selected', pick.checked);
      updateLibraryBulk();
    });
  }
  const librarySelectBtn = $('#librarySelectBtn');
  if (librarySelectBtn) librarySelectBtn.addEventListener('click', () => {
    state.library.selectMode = !state.library.selectMode;
    if (!state.library.selectMode) state.library.selected = [];
    renderLibrary();
    const first = $('#libraryGrid input[data-library-pick]');
    if (state.library.selectMode && first) first.focus();
  });
  const libraryBulkClear = $('#libraryBulkClear');
  if (libraryBulkClear) libraryBulkClear.addEventListener('click', () => {
    state.library.selected = [];
    renderLibrary();
  });
  const libraryBulkArchive = $('#libraryBulkArchive');
  if (libraryBulkArchive) libraryBulkArchive.addEventListener('click', () => bulkLibrary('archive', state.library.selected));
  const libraryBulkRestore = $('#libraryBulkRestore');
  if (libraryBulkRestore) libraryBulkRestore.addEventListener('click', () => bulkLibrary('restore', state.library.selected));
  const libraryBulkMove = $('#libraryBulkMove');
  if (libraryBulkMove) libraryBulkMove.addEventListener('click', () => {
    const section = $('#libraryBulkSection') ? $('#libraryBulkSection').value : '';
    if (!section) { toast('Pick a section first.', 'warn'); return; }
    bulkLibrary('section', state.library.selected, { library_section: section });
  });
  const libraryDuplicatesBtn = $('#libraryDuplicatesBtn');
  if (libraryDuplicatesBtn) libraryDuplicatesBtn.addEventListener('click', openLibraryDuplicates);
  const duplicateClose = $('#duplicateClose');
  const duplicateCancel = $('#duplicateCancel');
  if (duplicateClose) duplicateClose.addEventListener('click', () => $('#duplicateDialog').close());
  if (duplicateCancel) duplicateCancel.addEventListener('click', () => $('#duplicateDialog').close());
  const duplicateClean = $('#duplicateClean');
  if (duplicateClean) duplicateClean.addEventListener('click', () => archiveDuplicateExtras(duplicateClean));
  const libraryMoreBtn = $('#libraryMoreBtn');
  if (libraryMoreBtn) libraryMoreBtn.addEventListener('click', () => loadLibrary(false));
  const libraryEditClose = $('#libraryEditClose');
  const libraryEditCancel = $('#libraryEditCancel');
  if (libraryEditClose) libraryEditClose.addEventListener('click', () => $('#libraryEditDialog').close());
  if (libraryEditCancel) libraryEditCancel.addEventListener('click', () => $('#libraryEditDialog').close());
  const libraryEditForm = $('#libraryEditForm');
  if (libraryEditForm) libraryEditForm.addEventListener('submit', saveLibraryEdit);

  const newRoutineBtn = $('#newRoutineBtn');
  if (newRoutineBtn) newRoutineBtn.addEventListener('click', () => openRoutineDialog(null));
  const routineToday = $('#routineToday');
  if (routineToday) {
    routineToday.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-routine-check]');
      if (!btn) return;
      toggleRoutineToday(btn.dataset.routineCheck, btn.dataset.routineDone === 'true', btn);
    });
  }
  const protocolsGrid = $('#protocolsGrid');
  if (protocolsGrid) {
    protocolsGrid.addEventListener('click', (event) => {
      const linkedProduct = event.target.closest('[data-proto-wish]');
      if (linkedProduct) { jumpToWish(linkedProduct.dataset.protoWish); return; }
      const edit = event.target.closest('[data-proto-edit]');
      if (edit && state.vault) {
        const protocol = (state.vault.protocols || []).find((item) => item.id === edit.dataset.protoEdit);
        if (protocol) openRoutineDialog(protocol);
        return;
      }
      const remove = event.target.closest('[data-proto-delete]');
      if (remove) removeProtocol(remove.dataset.protoDelete);
      const fresh = event.target.closest('[data-new-routine]');
      if (fresh) openRoutineDialog(null);
    });
  }
  const routineClose = $('#routineClose');
  const routineCancel = $('#routineCancel');
  if (routineClose) routineClose.addEventListener('click', () => $('#routineDialog').close());
  if (routineCancel) routineCancel.addEventListener('click', () => $('#routineDialog').close());
  const routineParseBtn = $('#routineParseBtn');
  if (routineParseBtn) routineParseBtn.addEventListener('click', () => generateRoutine(routineParseBtn));
  const routineWebLookupToggle = $('#routineWebLookupToggle');
  if (routineWebLookupToggle) {
    routineWebLookupToggle.addEventListener('click', () => {
      setRoutineWebLookup(!state.routineWebLookup);
    });
  }
  syncRoutineWebLookupToggle();
  const routineForm = $('#routineForm');
  if (routineForm) routineForm.addEventListener('submit', saveRoutineForm);
  const routineWebProducts = $('#routineWebProducts');
  if (routineWebProducts) {
    routineWebProducts.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-routine-web-remove]');
      if (!btn) return;
      const index = Number(btn.dataset.routineWebRemove);
      if (!Number.isInteger(index) || index < 0) return;
      state.routineWebProducts.splice(index, 1);
      renderRoutineWebProducts();
    });
  }
  const routineWebRetry = $('#routineWebRetry');
  if (routineWebRetry) {
    routineWebRetry.addEventListener('click', () => {
      if (state.routineLookupBusy) return;
      lookupRoutineWebProducts(state.routineQueries).catch(() => {
        setRoutineLookupStatus('Product lookup failed. Try again in a moment.', 'warn');
      });
    });
  }
  const routineWebSendBtn = $('#routineWebSendBtn');
  if (routineWebSendBtn) {
    routineWebSendBtn.addEventListener('click', () => {
      sendRoutineProductsToGate().catch(() => {
        state.routineGateBusy = false;
        renderRoutineWebProducts();
        toast('Sending to the Gate failed. Try again.', 'err');
      });
    });
  }
  const routineWebUndoBtn = $('#routineWebUndoBtn');
  if (routineWebUndoBtn) {
    routineWebUndoBtn.addEventListener('click', () => {
      undoSendRoutineProductsToGate().catch(() => {
        state.routineGateBusy = false;
        renderRoutineWebProducts();
        toast('Undo failed. Remove the wishes from the Gate instead.', 'err');
      });
    });
  }
  const routineProducts = $('#routineProducts');
  if (routineProducts) {
    routineProducts.addEventListener('click', (event) => {
      const clear = event.target.closest('[data-routine-clear-search]');
      if (clear) {
        resetRoutineProductFilters();
        renderRoutineProducts();
        if ($('#routineProductSearch')) $('#routineProductSearch').focus();
        return;
      }
      const btn = event.target.closest('[data-routine-link]');
      if (!btn) return;
      const id = btn.dataset.routineLink;
      const ids = new Set(state.routineLinkedIds || []);
      const willSelect = !ids.has(id);
      if (willSelect && ids.size >= ROUTINE_PRODUCT_CAP) {
        toast(`A routine can link up to ${ROUTINE_PRODUCT_CAP} products. Untick one before adding another.`, 'warn');
        return;
      }
      if (willSelect) ids.add(id);
      else ids.delete(id);
      state.routineLinkedIds = Array.from(ids);
      if (state.routineSelectedOnly) {
        renderRoutineProducts();
        return;
      }
      btn.classList.toggle('is-selected', willSelect);
      btn.setAttribute('aria-pressed', String(willSelect));
      syncRoutineProductsFooter(state.routineMatchCount || 0);
    });
  }
  const routineSearch = $('#routineProductSearch');
  if (routineSearch) {
    routineSearch.addEventListener('input', () => {
      state.routineSearch = routineSearch.value;
      window.clearTimeout(state.routineSearchTimer);
      state.routineSearchTimer = window.setTimeout(() => {
        state.routineLimit = ROUTINE_PRODUCTS_PAGE;
        renderRoutineProducts();
      }, 120);
    });
    routineSearch.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !routineSearch.value) return;
      event.stopPropagation();
      clearRoutineProductSearch();
      renderRoutineProducts();
    });
  }
  const routineSearchClear = $('#routineProductSearchClear');
  if (routineSearchClear) {
    routineSearchClear.addEventListener('click', () => {
      clearRoutineProductSearch();
      renderRoutineProducts();
      if (routineSearch) routineSearch.focus();
    });
  }
  const routineSelectedToggle = $('#routineSelectedToggle');
  if (routineSelectedToggle) {
    routineSelectedToggle.addEventListener('click', () => {
      state.routineSelectedOnly = !state.routineSelectedOnly;
      routineSelectedToggle.classList.toggle('is-active', state.routineSelectedOnly);
      routineSelectedToggle.setAttribute('aria-pressed', String(state.routineSelectedOnly));
      state.routineLimit = ROUTINE_PRODUCTS_PAGE;
      renderRoutineProducts();
    });
  }
  const routineProductsMore = $('#routineProductsMore');
  if (routineProductsMore) {
    routineProductsMore.addEventListener('click', () => {
      state.routineLimit += ROUTINE_PRODUCTS_PAGE;
      renderRoutineProducts();
    });
  }

  const verdictFilters = $('#verdictFilters');
  if (verdictFilters) {
    verdictFilters.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-verdict]');
      if (!btn) return;
      state.verdict = btn.dataset.verdict;
      syncHash();
      renderWishlistView(state.vault);
    });
  }
  const gateStatusbar = $('#gateStatusbar');
  if (gateStatusbar) {
    gateStatusbar.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-gate-filter]');
      if (!btn) return;
      state.gateFilter = btn.dataset.gateFilter;
      syncHash();
      renderWishlistView(state.vault);
    });
  }
  const wishGrid = $('#wishlistGrid');
  if (wishGrid) {
    wishGrid.addEventListener('click', (event) => {
      const gateRemove = event.target.closest('[data-gate-remove]');
      if (gateRemove) { removeGateWish(gateRemove.dataset.gateRemove, gateRemove); return; }
      const gateAction = event.target.closest('[data-gate-action]');
      if (gateAction) { openGateAction(gateAction.dataset.gateId, gateAction.dataset.gateAction); return; }
      const audit = event.target.closest('[data-audit]');
      if (audit) openAudit(audit.dataset.audit);
      const edit = event.target.closest('[data-wish-edit]');
      if (edit) { openWishEdit(edit.dataset.wishEdit); return; }
      const photo = event.target.closest('[data-wish-photo]');
      if (photo) openPhotoDialog(photo.dataset.wishPhoto);
      const refresh = event.target.closest('[data-price-refresh]');
      if (refresh) refreshWishPrice(refresh.dataset.priceRefresh, refresh);
    });
  }
  const ledgerBtn = $('#ledgerBtn');
  if (ledgerBtn) ledgerBtn.addEventListener('click', openLedger);
  const ledgerClose = $('#ledgerClose');
  if (ledgerClose) ledgerClose.addEventListener('click', () => $('#ledgerDialog').close());
  const ledgerBudgetBtn = $('#ledgerBudgetBtn');
  if (ledgerBudgetBtn) ledgerBudgetBtn.addEventListener('click', openBudgetDialog);
  const ledgerList = $('#ledgerList');
  if (ledgerList) {
    ledgerList.addEventListener('click', (event) => {
      const voidBtn = event.target.closest('[data-void-ledger]');
      if (voidBtn) openVoidDialog(voidBtn.dataset.voidLedger);
    });
  }
  const promoteClose = $('#promoteClose');
  const promoteCancel = $('#promoteCancel');
  if (promoteClose) promoteClose.addEventListener('click', closePromotionReview);
  if (promoteCancel) promoteCancel.addEventListener('click', closePromotionReview);
  const promoteForm = $('#promoteForm');
  if (promoteForm) promoteForm.addEventListener('submit', savePromotion);
  const quickAddForm = $('#quickAddForm');
  if (quickAddForm) quickAddForm.addEventListener('submit', quickAddLink);
  const quickAddPaste = $('#quickAddPaste');
  if (quickAddPaste) quickAddPaste.addEventListener('click', pasteQuickAddLink);
  $$('[data-capture-open]').forEach((btn) => btn.addEventListener('click', openCaptureDialog));
  const captureDialog = $('#captureDialog');
  const captureClose = $('#captureClose');
  const captureDone = $('#captureDone');
  if (captureClose) captureClose.addEventListener('click', () => captureDialog.close());
  if (captureDone) captureDone.addEventListener('click', () => captureDialog.close());
  const captureBookmarklet = $('#captureBookmarklet');
  if (captureBookmarklet) {
    captureBookmarklet.addEventListener('click', (event) => {
      event.preventDefault();
      toast('Drag this button to your bookmarks bar, or copy the code below.', 'warn');
    });
  }
  const captureCopyBtn = $('#captureCopyBtn');
  if (captureCopyBtn) captureCopyBtn.addEventListener('click', () => copyCaptureBookmarklet(captureCopyBtn));
  const captureCode = $('#captureCode');
  if (captureCode) captureCode.addEventListener('focus', () => captureCode.select());
  const promoteDialog = $('#promoteDialog');
  if (promoteDialog) {
    promoteDialog.addEventListener('close', () => { state.promotion = null; });
    promoteDialog.addEventListener('click', (event) => {
      const dupe = event.target.closest('[data-dupe-jump]');
      if (!dupe) return;
      promoteDialog.close();
      jumpToWish(dupe.dataset.dupeJump);
    });
  }
  const wishEditClose = $('#wishEditClose');
  const wishEditCancel = $('#wishEditCancel');
  if (wishEditClose) wishEditClose.addEventListener('click', () => $('#wishEditDialog').close());
  if (wishEditCancel) wishEditCancel.addEventListener('click', () => $('#wishEditDialog').close());
  const wishEditForm = $('#wishEditForm');
  if (wishEditForm) wishEditForm.addEventListener('submit', saveWishEdit);
  const budgetClose = $('#budgetClose');
  const budgetCancel = $('#budgetCancel');
  if (budgetClose) budgetClose.addEventListener('click', () => $('#budgetDialog').close());
  if (budgetCancel) budgetCancel.addEventListener('click', () => $('#budgetDialog').close());
  const budgetForm = $('#budgetForm');
  if (budgetForm) budgetForm.addEventListener('submit', saveBudget);
  const voidClose = $('#voidClose');
  const voidCancel = $('#voidCancel');
  if (voidClose) voidClose.addEventListener('click', () => $('#voidDialog').close());
  if (voidCancel) voidCancel.addEventListener('click', () => $('#voidDialog').close());
  const voidForm = $('#voidForm');
  if (voidForm) voidForm.addEventListener('submit', submitVoid);
  const gateActionForm = $('#gateActionForm');
  if (gateActionForm) gateActionForm.addEventListener('submit', submitGateAction);
  const gateActionClose = $('#gateActionClose');
  const gateActionCancel = $('#gateActionCancel');
  if (gateActionClose) gateActionClose.addEventListener('click', () => $('#gateActionDialog').close());
  if (gateActionCancel) gateActionCancel.addEventListener('click', () => $('#gateActionDialog').close());
  const gateAmount = $('#gateAmount');
  if (gateAmount) gateAmount.addEventListener('input', renderGateActionBudget);

  const main = $('#main');
  if (main) {
    main.addEventListener('click', (event) => {
      const addCard = event.target.closest('[data-card-add]');
      if (addCard) { openCardDialog(addCard.dataset.cardAdd); return; }
      const editSection = event.target.closest('[data-section-edit]');
      if (editSection) { openSectionsDialog(editSection.dataset.sectionEdit); return; }
      const editCard = event.target.closest('[data-card-edit]');
      if (editCard) { openCardDialog(editCard.dataset.sectionId, editCard.dataset.cardEdit); return; }
      const removeCard = event.target.closest('[data-card-delete]');
      if (removeCard) deleteCard(removeCard.dataset.sectionId, removeCard.dataset.cardDelete);
    });
  }

  const customizeBtn = $('#customizeBtn');
  if (customizeBtn) customizeBtn.addEventListener('click', () => openSectionsDialog(state.tab));
  const sectionsClose = $('#sectionsClose');
  if (sectionsClose) sectionsClose.addEventListener('click', () => $('#sectionsDialog').close());
  const newSectionBtn = $('#newSectionBtn');
  if (newSectionBtn) {
    newSectionBtn.addEventListener('click', () => {
      fillSectionForm(null);
      renderSectionManager(null);
      if ($('#sectionLabel')) $('#sectionLabel').focus();
    });
  }
  const sectionManagerList = $('#sectionManagerList');
  if (sectionManagerList) {
    sectionManagerList.addEventListener('click', (event) => {
      const pick = event.target.closest('[data-select-section]');
      if (pick) {
        fillSectionForm(sectionById(pick.dataset.selectSection));
        renderSectionManager(pick.dataset.selectSection);
        return;
      }
      const move = event.target.closest('[data-move-section]');
      if (move) { moveSection(move.dataset.moveSection, Number(move.dataset.dir)); return; }
      const toggle = event.target.closest('[data-toggle-section]');
      if (toggle) toggleSectionVisibility(toggle.dataset.toggleSection);
    });
  }
  const sectionForm = $('#sectionForm');
  if (sectionForm) sectionForm.addEventListener('submit', saveSectionForm);
  const sectionDeleteBtn = $('#sectionDeleteBtn');
  if (sectionDeleteBtn) sectionDeleteBtn.addEventListener('click', deleteCurrentSection);
  const sectionColor = $('#sectionColor');
  if (sectionColor) sectionColor.addEventListener('input', () => { if ($('#sectionColorText')) $('#sectionColorText').value = sectionColor.value; });
  const sectionColorText = $('#sectionColorText');
  if (sectionColorText) {
    sectionColorText.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(sectionColorText.value.trim()) && sectionColor) sectionColor.value = sectionColorText.value.trim();
    });
  }

  const cardClose = $('#cardClose');
  if (cardClose) cardClose.addEventListener('click', () => $('#cardDialog').close());
  const cardCancel = $('#cardCancel');
  if (cardCancel) cardCancel.addEventListener('click', () => $('#cardDialog').close());
  const cardForm = $('#cardForm');
  if (cardForm) cardForm.addEventListener('submit', saveCardForm);
  const cardFindImage = $('#cardFindImage');
  if (cardFindImage) cardFindImage.addEventListener('click', () => findCardImage(cardFindImage));
  const cardDeleteBtn = $('#cardDeleteBtn');
  if (cardDeleteBtn) {
    cardDeleteBtn.addEventListener('click', () => {
      if ($('#cardSectionId') && $('#cardId')) deleteCard($('#cardSectionId').value, $('#cardId').value);
    });
  }
  const cardColor = $('#cardColor');
  if (cardColor) cardColor.addEventListener('input', () => { if ($('#cardColorText')) $('#cardColorText').value = cardColor.value; });
  const cardColorText = $('#cardColorText');
  if (cardColorText) {
    cardColorText.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(cardColorText.value.trim()) && cardColor) cardColor.value = cardColorText.value.trim();
    });
  }

  const photoClose = $('#photoClose');
  if (photoClose) photoClose.addEventListener('click', () => $('#photoDialog').close());
  const photoCancel = $('#photoCancel');
  if (photoCancel) photoCancel.addEventListener('click', () => $('#photoDialog').close());
  const photoForm = $('#photoForm');
  if (photoForm) photoForm.addEventListener('submit', savePhotoForm);

  const clusterDialog = $('#clusterDialog');
  const clusterClose = $('#clusterClose');
  if (clusterClose) clusterClose.addEventListener('click', () => clusterDialog.close());
  const clusterCancel = $('#clusterCancel');
  if (clusterCancel) clusterCancel.addEventListener('click', () => clusterDialog.close());
  const clusterForm = $('#clusterForm');
  if (clusterForm) clusterForm.addEventListener('submit', saveClusterForm);
  const clusterReset = $('#clusterReset');
  if (clusterReset) clusterReset.addEventListener('click', resetClusterDialog);
  const clusterCoverFind = $('#clusterCoverFind');
  if (clusterCoverFind) clusterCoverFind.addEventListener('click', () => findClusterCover(clusterCoverFind));
  const clusterModeToggle = $('#clusterModeToggle');
  if (clusterModeToggle) {
    clusterModeToggle.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-cluster-mode]');
      if (!btn) return;
      state.clusterDialog.mode = btn.dataset.clusterMode;
      renderClusterDialog();
    });
  }
  const clusterHeroPicker = $('#clusterHeroPicker');
  if (clusterHeroPicker) {
    clusterHeroPicker.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-hero]');
      if (!btn) return;
      state.clusterDialog.hero_item_id = btn.dataset.hero || '';
      state.clusterDialog.cover = '';
      renderClusterDialog();
    });
  }
  const clusterCoverUrl = $('#clusterCoverUrl');
  if (clusterCoverUrl) {
    clusterCoverUrl.addEventListener('input', () => {
      state.clusterDialog.cover = clusterCoverUrl.value.trim();
      renderClusterDialog();
    });
  }

  const form = $('#ingestForm');
  if (form) form.addEventListener('submit', runIngest);
  $$('.example-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const example = EXAMPLES[btn.dataset.example];
      if (!example) return;
      const radio = document.querySelector(`input[name="ingestMode"][value="${example.mode}"]`);
      if (radio) radio.checked = true;
      if ($('#ingestTitle')) $('#ingestTitle').value = example.title;
      if ($('#ingestInput')) $('#ingestInput').value = example.input;
      if ($('#ingestPrice')) $('#ingestPrice').value = example.price;
      const error = $('#ingestError');
      if (error) error.hidden = true;
      const title = $('#ingestTitle');
      if (title) title.focus();
    });
  });

  const auditBtn = $('#runAuditBtn');
  if (auditBtn) auditBtn.addEventListener('click', () => runVaultAudit(auditBtn));
  const suggestions = $('#auditSuggestions');
  if (suggestions) {
    suggestions.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-prompt]');
      if (!btn) return;
      const input = $('#auditInput');
      if (input) { input.value = btn.dataset.prompt; input.focus(); }
    });
  }
  const jobBtn = $('#jobBtn');
  if (jobBtn) jobBtn.addEventListener('click', () => runServerlessJob(jobBtn));
  const deckJobBtn = $('#deckJobBtn');
  if (deckJobBtn) deckJobBtn.addEventListener('click', () => runServerlessJob(deckJobBtn));

  const profileBtn = $('#editProfileBtn');
  if (profileBtn) profileBtn.addEventListener('click', openProfileDialog);
  const profileClose = $('#profileClose');
  if (profileClose) profileClose.addEventListener('click', () => $('#profileDialog').close());
  const profileCancel = $('#profileCancel');
  if (profileCancel) profileCancel.addEventListener('click', () => $('#profileDialog').close());
  const profileForm = $('#profileForm');
  if (profileForm) profileForm.addEventListener('submit', saveProfile);
  const profileAddSize = $('#profileAddSize');
  if (profileAddSize) {
    profileAddSize.addEventListener('click', () => {
      const host = $('#profileSizeEditor');
      if (!host) return;
      const empty = host.querySelector('.profile-empty');
      if (empty) host.innerHTML = '';
      host.insertAdjacentHTML('beforeend', profileSizeRow());
      const input = host.lastElementChild && host.lastElementChild.querySelector('[data-size-key]');
      if (input) input.focus();
    });
  }
  const profileSizeEditor = $('#profileSizeEditor');
  if (profileSizeEditor) {
    profileSizeEditor.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-size-remove]');
      if (!remove) return;
      const row = remove.closest('[data-profile-size]');
      if (!row) return;
      row.remove();
      if (!profileSizeEditor.children.length) profileEmpty(profileSizeEditor, 'No sizes recorded. Add the labels the Gate should check against.');
    });
  }
  const profileAddInventory = $('#profileAddInventory');
  if (profileAddInventory) {
    profileAddInventory.addEventListener('click', () => {
      const host = $('#profileInventoryEditor');
      if (!host) return;
      const empty = host.querySelector('.profile-empty');
      if (empty) host.innerHTML = '';
      const count = host.querySelectorAll('[data-profile-inventory]').length;
      host.insertAdjacentHTML('beforeend', profileInventoryRow({}, count));
      reindexProfileInventory();
      const input = host.lastElementChild && host.lastElementChild.querySelector('[data-inventory-name]');
      if (input) input.focus();
    });
  }
  const profileInventoryEditor = $('#profileInventoryEditor');
  if (profileInventoryEditor) {
    profileInventoryEditor.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-inventory-remove]');
      if (!remove) return;
      const row = remove.closest('[data-profile-inventory]');
      if (!row) return;
      row.remove();
      if (!profileInventoryEditor.children.length) {
        profileEmpty(profileInventoryEditor, 'No owned items tracked. Add what is already in rotation so the Gate can spot duplicates.');
      } else {
        reindexProfileInventory();
      }
    });
  }

  const helpBtn = $('#helpBtn');
  if (helpBtn) helpBtn.addEventListener('click', openHelp);
  const helpClose = $('#helpClose');
  if (helpClose) helpClose.addEventListener('click', () => $('#helpDialog').close());
  const helpSearch = $('#helpSearch');
  if (helpSearch) {
    helpSearch.addEventListener('input', () => {
      state.help.q = helpSearch.value;
      window.clearTimeout(state.help.timer);
      state.help.timer = window.setTimeout(renderHelp, 90);
    });
  }
  const helpCategories = $('#helpCategories');
  if (helpCategories) {
    helpCategories.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-help-category]');
      if (!chip) return;
      state.help.category = chip.dataset.helpCategory;
      renderHelp();
      revealHelpCategory();
    });
    helpCategories.addEventListener('scroll', syncHelpCategoryEdges, { passive: true });
    // A vertical wheel over the rail should move it sideways; the container
    // never scrolls vertically, so nothing else competes for the gesture.
    helpCategories.addEventListener('wheel', (event) => {
      if (!event.deltaY || event.deltaX) return;
      const max = helpCategories.scrollWidth - helpCategories.clientWidth;
      if (max <= 1) return;
      const next = Math.max(0, Math.min(max, helpCategories.scrollLeft + event.deltaY));
      if (next === helpCategories.scrollLeft) return;
      event.preventDefault();
      helpCategories.scrollLeft = next;
    }, { passive: false });
  }
  const helpBody = $('#helpBody');
  if (helpBody) {
    helpBody.addEventListener('click', (event) => {
      if (event.target.closest('[data-help-retry]')) { loadGlossary(); return; }
      if (event.target.closest('[data-help-clear]')) {
        state.help.q = '';
        state.help.category = 'ALL';
        if ($('#helpSearch')) $('#helpSearch').value = '';
        renderHelp();
        revealHelpCategory();
      }
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== '?') return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const field = event.target.closest('input, textarea, select, [contenteditable="true"]');
    if (field) return;
    const dialog = $('#helpDialog');
    if (dialog && dialog.open) return;
    event.preventDefault();
    openHelp();
  });
}

async function init() {
  const params = new URLSearchParams(location.search);
  const captureParam = params.get('capture');
  const captureUrl = normalizeCaptureUrl(captureParam || '');
  const captureSnapshot = snapshotFromSearch(location.search);
  if (params.get('share') === 'empty') toast('That share did not include a product link. Paste the URL instead.', 'warn');
  bindEvents();
  window.addEventListener('resize', syncRailOverflow);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname))) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  setupClock();
  setupCursor();
  await loadSections();
  setupReveal();
  const route = routeState();
  applyRoute(route);
  const initialTab = captureUrl ? 'wishlist' : route.tab;
  setTab(initialTab, { scroll: false, updateHash: false });
  if (captureParam) {
    try { history.replaceState(null, '', captureUrl ? `${location.pathname}#wishlist` : location.pathname + location.hash); } catch (_) {}
  }
  await refreshVault(true);
  await loadBookmarks(true);
  if (captureUrl) await reviewProductLink(captureUrl, $('#quickAddBtn'), captureSnapshot);
  else if (captureParam) toast('That capture link did not include a usable http(s) product URL.', 'warn');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
