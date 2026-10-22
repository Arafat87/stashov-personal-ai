(() => {
'use strict';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const money = (n, digits = 0) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pad = (n) => String(n).padStart(2, '0');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (value) => (/^https?:\/\//i.test(String(value || '')) ? value : '#');
const safeImage = (value) => {
  const raw = String(value || '').trim();
  return /^https?:\/\//i.test(raw) || /^\/media\/images\/[a-z0-9._-]+$/i.test(raw) ? raw : '';
};
const shortModel = (value) => String(value || '').replace(/^.*\//, '').replace(/^Qwen\/?/i, '');
const isTyping = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

const TABS = {
  deck: 'COMMAND DECK',
  vault: 'SIGNAL INDEX',
  wishlist: 'IMPULSE GATE',
  protocols: 'LIVING PLAYBOOKS',
  context: 'IDENTITY BUFFER',
  ingest: 'CAPTURE STUDIO',
  router: 'TOKEN FACTORY ROUTER'
};
const TITLES = {
  deck: 'Neural Vault Command Deck',
  vault: 'Signal Index',
  wishlist: 'Impulse Gate',
  protocols: 'Living Playbooks',
  context: 'Identity Buffer',
  ingest: 'Capture Studio',
  router: 'Router Telemetry'
};
const SECTION_ICONS = ['i-deck', 'i-vault', 'i-gate', 'i-pulse', 'i-fingerprint', 'i-spark', 'i-router', 'i-search', 'i-command', 'i-coin', 'i-lock', 'i-clock', 'i-alert'];
const DEFAULT_SECTIONS = [
  ['deck', 'Deck', 'i-deck', '#c6ff4a'],
  ['vault', 'Vault', 'i-vault', '#63e6ff'],
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

const state = {
  vault: null,
  tab: 'deck',
  sections: DEFAULT_SECTIONS.map((section) => ({ ...section })),
  editingSectionId: null,
  editingCardId: null,
  photoId: null,
  category: 'ALL',
  verdict: 'ALL',
  items: [],
  total: 0,
  limit: 48,
  loadSeq: 0,
  searchTimer: null,
  bookmarkAbort: null,
  auditId: null,
  firstRender: true,
  paletteIndex: 0,
  paletteFiltered: []
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
  if (options.updateHash !== false) {
    try { history.replaceState(null, '', `#${tab}`); } catch (_) {}
  }
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  const panel = $(`#panel-${tab}`);
  if (panel) {
    window.setTimeout(() => $$('.reveal', panel).forEach((el) => el.classList.add('is-in')), 40);
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
  renderWishlistView(v);
  renderProtocolsView(v);
  renderContextView(v);
  renderRouterView(v);
  renderTelemetry(v);
  state.firstRender = false;
}

function budgetNumbers(v) {
  const ctx = v.personal_context || {};
  const cap = Number(ctx.monthly_discretionary_budget) || 300;
  const spent = Number(ctx.spent_this_month) || 0;
  return { cap, spent, remaining: Math.max(0, cap - spent) };
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
  const { cap, spent, remaining } = budgetNumbers(v);
  const top = $('#topBudget');
  if (top) top.textContent = money(remaining);
  const ovRemaining = $('#ovRemaining');
  if (ovRemaining) ovRemaining.textContent = money(remaining);
  const ovSpent = $('#ovSpent');
  if (ovSpent) ovSpent.textContent = money(spent);
  const ovCap = $('#ovCap');
  if (ovCap) ovCap.textContent = money(cap);
  const month = $('#budgetMonth');
  if (month) month.textContent = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  const arc = $('#budgetRingArc');
  if (arc) {
    const circumference = 2 * Math.PI * 66;
    arc.style.strokeDasharray = String(circumference);
    arc.style.strokeDashoffset = String(circumference * Math.min(1, spent / Math.max(1, cap)));
  }
  const wlRemaining = $('#wlRemaining');
  if (wlRemaining) wlRemaining.textContent = money(remaining);
  const fill = $('#wlRailFill');
  if (fill) fill.style.width = `${Math.min(100, (spent / Math.max(1, cap)) * 100)}%`;
  const note = $('#wlSpentNote');
  if (note) note.textContent = `${money(spent, 2)} spent of ${money(cap, 2)} monthly cap`;
  const profileBudget = $('#profileBudget');
  if (profileBudget) profileBudget.textContent = money(cap);
  const profileBudgetSub = $('#profileBudgetSub');
  if (profileBudgetSub) profileBudgetSub.textContent = `${money(remaining)} left after ${money(spent)} spent`;
}

function renderOverview(v) {
  const wishlist = v.wishlist || [];
  setCounter($('#heroVaultCount'), v.total_bookmarks || 0, fmt);
  setCounter($('#heroSavings'), totalMarkup(v), (n) => money(n));
  setCounter($('#heroGated'), wishlist.length, fmt);
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
    `${(v.wishlist || []).length} purchases interrogated`,
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

function clusterCover(v, name) {
  const item = (v.wishlist || []).find((wish) => wish.category === name && safeImage(wish.image));
  return item ? { image: item.image, title: item.title, brand: item.brand } : null;
}

function renderCategories(v) {
  const grid = $('#clusterGrid');
  if (!grid) return;
  const counts = v.category_counts || {};
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const head = $('#vaultHeadCount');
  if (head) head.textContent = fmt(v.total_bookmarks || 0);
  const panelCount = $('#catPanelCount');
  if (panelCount) panelCount.textContent = `${entries.length} CLUSTERS`;
  const allCount = $('#clusterAllCount');
  if (allCount) allCount.textContent = fmt(v.total_bookmarks || 0);
  const wishes = v.wishlist || [];
  grid.innerHTML = entries.map(([name, count], i) => {
    const active = state.category === name;
    const cover = clusterCover(v, name);
    const wishCount = wishes.filter((wish) => wish.category === name).length;
    const image = safeImage(cover && cover.image);
    const initial = String(name || '?').charAt(0).toUpperCase();
    return `
    <button type="button" class="cluster-card ${active ? 'is-active' : ''}" data-cat="${esc(name)}" aria-pressed="${active}" style="--tone:${CAT_COLORS[i % CAT_COLORS.length]}">
      <span class="cluster-media">
        <span class="media-fallback" aria-hidden="true"><strong>${esc(initial)}</strong><span>Cluster</span></span>
        ${image ? `<img src="${esc(image)}" alt="" loading="lazy" />` : ''}
        <span class="cluster-count">${fmt(count)}</span>
        ${cover ? '<span class="cluster-want">WANT</span>' : ''}
      </span>
      <span class="cluster-body">
        <span class="cluster-index">CLUSTER ${pad(i + 1)}</span>
        <span class="cluster-name">${esc(name)}</span>
        <span class="cluster-meta">${fmt(count)} saved${wishCount ? ` / ${wishCount} ${wishCount === 1 ? 'wish' : 'wishes'}` : ''}</span>
        <span class="cluster-cta">${active ? 'Filtering this cluster' : 'Open cluster'} <svg class="icon"><use href="#i-arrow"/></svg></span>
      </span>
    </button>`;
  }).join('');
}

function bookmarkCard(b, index) {
  const glyph = String(b.domain || b.title || '?').replace(/^www\./, '').charAt(0).toUpperCase() || '?';
  const tags = (b.tags || []).slice(0, 4).map((t) => `<span class="tag">#${esc(t)}</span>`).join('');
  const meta = [b.original_folder, b.snapshot_status].filter(Boolean).join(' · ');
  const score = b.match_score ? `<span class="match-score" title="Hybrid semantic match score">${b.match_score}</span>` : '';
  return `
  <article class="signal-card" style="--i:${Math.min(index, 12)}">
    <div class="signal-top">
      <span class="domain-glyph" aria-hidden="true">${esc(glyph)}</span>
      <span class="signal-domain" title="${esc(b.domain)}">${esc(b.domain)}</span>
      ${score}
      <span class="signal-cat" title="${esc(b.category)}">${esc(b.category)}</span>
    </div>
    <h3 class="signal-title"><a href="${esc(safeUrl(b.url))}" target="_blank" rel="noopener noreferrer">${esc(b.title)}</a></h3>
    <div class="signal-tags">${tags || `<span class="tag">#${esc(b.browser)}</span>`}</div>
    <div class="signal-foot">
      <span class="signal-browser" title="${esc(meta)}">${esc(b.browser)}${b.original_folder ? ' · ' + esc(b.original_folder) : ''}</span>
      <button type="button" class="gate-btn" data-promote="${esc(b.id)}" aria-label="Promote ${esc(b.title)} into the impulse gate"><svg class="icon"><use href="#i-plus"/></svg> Gate</button>
    </div>
  </article>`;
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
}

async function promoteBookmark(id, btn) {
  if (!id || (btn && btn.disabled)) return;
  busy(btn, true, 'Gating');
  try {
    const data = await postJSON('/api/promote-bookmark', { id });
    toast(data.already_exists ? 'That signal is already inside the impulse gate.' : 'Signal promoted. The 14-day cooldown starts now.');
    await refreshVault();
    setTab('wishlist');
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    busy(btn, false);
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

/* ————— WISHLIST ————— */
function renderWishlistView(v) {
  const wishlist = v.wishlist || [];
  const filters = $('#verdictFilters');
  if (filters) {
    const counts = { ALL: wishlist.length, good: 0, warn: 0, bad: 0 };
    wishlist.forEach((w) => { counts[verdictTone(w.verdict)] += 1; });
    const chips = [
      ['ALL', 'All wishes'],
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
  const visible = wishlist.filter((w) => state.verdict === 'ALL' || verdictTone(w.verdict) === state.verdict);
  if (!visible.length) {
    grid.innerHTML = `<div class="empty-state"><svg class="icon"><use href="#i-gate"/></svg><h3>No wishes in this lane</h3><p>Change the verdict filter, or promote a bookmark from the signal index to let the gate interrogate it.</p></div>`;
    return;
  }
  grid.innerHTML = visible.map((w, i) => wishCard(w, wishlist.indexOf(w), i)).join('');
}

function gateRow(label, value, icon, warnPattern) {
  const warn = warnPattern && warnPattern.test(String(value || ''));
  return `<div class="gate-check ${warn ? 'is-warn' : ''}"><svg class="icon"><use href="#${icon}"/></svg><b>${label}</b><span>${esc(value || '—')}</span></div>`;
}

function wishCard(w, originalIndex, renderIndex) {
  const tone = verdictTone(w.verdict);
  const retail = Math.max(1, Number(w.retail_price) || 0);
  const floor = Math.max(0, Number(w.lowest_verified_price) || 0);
  const pct = Math.min(100, Math.max(0, (floor / retail) * 100));
  const saving = Math.max(0, retail - floor);
  const image = safeImage(w.image);
  const initial = String(w.title || '?').trim().charAt(0).toUpperCase() || '?';
  return `
  <article class="wish ${tone}" style="--i:${Math.min(renderIndex, 9)}">
    <div class="wish-media">
      <span class="media-fallback" aria-hidden="true"><strong>${esc(initial)}</strong><span>Photo pending</span></span>
      ${image ? `<img src="${esc(image)}" alt="${esc(w.title)}" loading="lazy" />` : ''}
      <button type="button" class="wish-photo-btn" data-wish-photo="${esc(w.id)}" aria-label="${image ? 'Change' : 'Find'} photo for ${esc(w.title)}"><svg class="icon"><use href="#i-image"/></svg><span>${image ? 'Change photo' : 'Find photo'}</span></button>
    </div>
    <div class="wish-top">
      <div class="wish-id"><span>WL-${pad(originalIndex + 1)}</span><span class="cool-chip">${esc(w.cooling_status || 'Gate active')}</span></div>
      <span class="verdict" title="${esc(w.verdict_label || '')}">${esc(w.verdict_label || 'GATE ACTIVE')}</span>
    </div>
    <div>
      <p class="wish-brand">${esc(w.brand || 'PRIVATE SAVE')} <span aria-hidden="true">·</span> ${esc(w.category || 'Unclustered')}</p>
      <h3 class="wish-title"><a href="${esc(safeUrl(w.url))}" target="_blank" rel="noopener noreferrer">${esc(w.title)}</a></h3>
    </div>
    <div class="price-block">
      <div class="price-top">
        <div><span class="price-label">BEST VERIFIED FLOOR</span><span class="price-floor">${money(floor, 2)}</span></div>
        <span class="save-pill">${saving > 0 ? 'SAVE ' + money(saving) : 'AT THE FLOOR'}</span>
      </div>
      <div class="price-rail" aria-hidden="true"><i class="rail-retail"></i><i class="rail-floor" style="width:${pct}%"></i></div>
      <div class="price-foot"><span>${money(retail, 0)} retail</span><span>${money(w.cost_per_use, 2)} / use</span><span title="${esc(w.best_source || '')}">${esc(w.best_source || 'Saved discounter')}</span></div>
    </div>
    <div class="gate-checks">
      ${gateRow('Owned', w.inventory_overlap, 'i-vault', /HIGH|DUPLICATE|OVERLAP/i)}
      ${gateRow('Routine', w.routine_compatibility, 'i-pulse', /CONFLICT|WARNING|BLOCK/i)}
      ${gateRow('Dupe', w.dupe_alternative, 'i-coin')}
    </div>
    <p class="anti-hype">${esc(w.anti_hype_summary || 'No anti-hype read captured yet.')}</p>
    <div class="wish-foot">
      <button type="button" class="btn ghost sm" data-audit="${esc(w.id)}"><svg class="icon"><use href="#i-spark"/></svg> Ask the oracle</button>
      <a class="wish-link" href="${esc(safeUrl(w.url))}" target="_blank" rel="noopener noreferrer" aria-label="Open source for ${esc(w.title)}">Source <svg class="icon"><use href="#i-external"/></svg></a>
    </div>
  </article>`;
}

/* ————— PROTOCOLS ————— */
function renderProtocolsView(v) {
  const list = v.protocols || [];
  const counter = $('#protocolCount');
  if (counter) counter.textContent = String(list.length);
  const grid = $('#protocolsGrid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><svg class="icon"><use href="#i-pulse"/></svg><h3>No protocols armed</h3><p>Save a life-hack note in the capture studio and the router will compile it into a living rule.</p></div>`;
    return;
  }
  grid.innerHTML = list.map((p, i) => {
    const steps = (p.steps || []).map((step) => `<li>${esc(step)}</li>`).join('');
    const links = (p.linked_wishlist_ids || []).length;
    return `
    <article class="protocol" style="--i:${Math.min(i, 8)}">
      <div class="proto-top"><span class="proto-index">PROTOCOL ${pad(i + 1)}</span><span class="badge-soft">${esc(p.credibility_badge || 'UNVERIFIED')}</span></div>
      <div>
        <h3 class="proto-title">${esc(p.title)}</h3>
        <p class="proto-sched"><svg class="icon"><use href="#i-clock"/></svg>${esc(p.schedule || 'ALWAYS ON')}</p>
        <p class="proto-source">${esc(p.source_platform || '')}</p>
      </div>
      <div class="conflict"><svg class="icon"><use href="#i-alert"/></svg><span><b>ACTIVE GUARDRAIL</b>${esc(p.conflict_alert || 'Routine conflict checks armed.')}</span></div>
      <ol class="steps">${steps}</ol>
      <div class="proto-foot">
        <span class="ok"><svg class="icon"><use href="#i-check"/></svg>${esc(p.snapshot_status || 'Snapshot archived')}</span>
        <span>${links} gate ${links === 1 ? 'link' : 'links'}</span>
      </div>
    </article>`;
  }).join('');
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
    const tab = location.hash.slice(1);
    if (sectionById(tab) && tab !== state.tab) setTab(tab, { scroll: false, updateHash: false });
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
  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const dialog = $('#paletteDialog');
      if (dialog && dialog.open) dialog.close();
      else openPalette();
      return;
    }
    if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target) && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      setTab('vault');
      window.setTimeout(() => { const el = $('#bmSearchInput'); if (el) el.focus(); }, 160);
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
      const btn = event.target.closest('[data-cat]');
      if (!btn) return;
      state.category = state.category === btn.dataset.cat ? 'ALL' : btn.dataset.cat;
      renderCategories(state.vault);
      loadBookmarks(true);
      const results = $('.results-bar');
      if (results && !reduceMotion.matches) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  const allClustersBtn = $('#allClustersBtn');
  if (allClustersBtn) {
    allClustersBtn.addEventListener('click', () => {
      state.category = 'ALL';
      renderCategories(state.vault);
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

  const verdictFilters = $('#verdictFilters');
  if (verdictFilters) {
    verdictFilters.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-verdict]');
      if (!btn) return;
      state.verdict = btn.dataset.verdict;
      renderWishlistView(state.vault);
    });
  }
  const wishGrid = $('#wishlistGrid');
  if (wishGrid) {
    wishGrid.addEventListener('click', (event) => {
      const audit = event.target.closest('[data-audit]');
      if (audit) openAudit(audit.dataset.audit);
      const photo = event.target.closest('[data-wish-photo]');
      if (photo) openPhotoDialog(photo.dataset.wishPhoto);
    });
  }

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
}

async function init() {
  bindEvents();
  setupClock();
  setupCursor();
  await loadSections();
  setupReveal();
  const initial = location.hash.slice(1);
  setTab(sectionById(initial) ? initial : 'deck', { scroll: false, updateHash: false });
  await refreshVault(true);
  await loadBookmarks(true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
