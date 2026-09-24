// Onglet Plan : frise des semaines + items de la semaine sélectionnée.
// Ordinateur : frise verticale à gauche, semaine à droite, ← → pour changer de semaine,
// « / » pour chercher. Mobile : frise horizontale défilante au-dessus de la semaine.

import { getActivePlan, getItemStates } from '../store.js';
import { projectWeeks, currentWeek, countStatus, blockMap, overdueItems } from '../utils/progress.js';
import { formatRange } from '../utils/dates.js';
import { esc, progressBar, ICONS, isTypingTarget } from '../utils/ui.js';
import { renderItemRow, bindItemRows, refocusItem } from './item-ui.js';

const LATE = '__late';

// Préférences d'affichage conservées le temps de la session (par projet)
const _selected = {};
const _filter   = {};
const _query    = {};
let _active = null;   // { slug, root } de la vue montée, pour les raccourcis clavier

// Pré-sélectionne une semaine avant d'ouvrir l'onglet (ex. clic dans l'histogramme d'avancement).
export function selectWeek(slug, number) {
  _selected[slug] = number;
  _query[slug] = '';
  if (_filter[slug] === LATE) _filter[slug] = null;
}

// Ouvre l'onglet directement sur la liste des items à rattraper (depuis l'accueil).
export function showLate(slug) {
  _filter[slug] = LATE;
  _query[slug] = '';
}

export function mount(container, slug) {
  const plan = getActivePlan(slug);
  if (!plan) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📄</div>
        <div class="empty-state__title">Pas encore de roadmap</div>
        <div class="empty-state__body">Génère le prompt initial, envoie-le à ton IA puis importe le .md obtenu.</div>
        <button class="btn btn--primary" data-nav="/project/${slug}/versions">Aller aux versions</button>
      </div>`;
    return;
  }

  const weeks = projectWeeks(slug);
  if (_selected[slug] == null || !weeks.some(w => w.number === _selected[slug])) {
    _selected[slug] = currentWeek(weeks).number;
  }

  container.innerHTML = `
    <div class="plan">
      <div class="plan-toolbar">
        <label class="search">
          ${ICONS.search}
          <input type="search" id="plan-search" placeholder="Chercher un item…" title="Raccourci : /" value="${esc(_query[slug] || '')}">
        </label>
        <div class="chips" id="block-filter"></div>
      </div>
      <div class="plan-layout">
        <nav class="week-rail" id="week-rail" aria-label="Semaines"></nav>
        <section class="week-panel" id="week-panel" aria-live="polite"></section>
      </div>
    </div>`;

  const root = container.firstElementChild;
  _active = { slug, root };

  const refresh = focusId => {
    renderFilters(root, slug);
    renderRail(root, slug);
    renderPanel(root, slug);
    refocusItem(root.querySelector('#week-panel'), focusId);
  };
  bindItemRows(root.querySelector('#week-panel'), refresh);

  root.querySelector('#week-rail').addEventListener('click', e => {
    const btn = e.target.closest('[data-week]');
    if (!btn) return;
    pick(slug, parseInt(btn.dataset.week, 10));
  });

  root.querySelector('#week-panel').addEventListener('click', e => {
    const step = e.target.closest('[data-step]');
    if (step) selectRelative(slug, parseInt(step.dataset.step, 10));
    const goto = e.target.closest('[data-goto-week]');
    if (goto) pick(slug, parseInt(goto.dataset.gotoWeek, 10));
    if (e.target.closest('[data-clear]')) {
      _filter[slug] = null;
      _query[slug] = '';
      root.querySelector('#plan-search').value = '';
      refresh();
    }
  });

  root.querySelector('#block-filter').addEventListener('click', e => {
    const chip = e.target.closest('[data-block]');
    if (!chip) return;
    const v = chip.dataset.block || null;
    _filter[slug] = _filter[slug] === v ? null : v;
    refresh();
  });

  root.querySelector('#plan-search').addEventListener('input', e => {
    _query[slug] = e.target.value;
    renderPanel(root, slug);
  });

  refresh();
  scrollRailToSelected(root);
}

function pick(slug, number) {
  const root = _active.root;
  _selected[slug] = number;
  _query[slug] = '';
  if (_filter[slug] === LATE) _filter[slug] = null;
  root.querySelector('#plan-search').value = '';
  renderFilters(root, slug);
  renderRail(root, slug);
  renderPanel(root, slug);
  scrollRailToSelected(root);
}

function selectRelative(slug, step) {
  if (!_active || _active.slug !== slug) return;
  const weeks = projectWeeks(slug);
  const i = weeks.findIndex(w => w.number === _selected[slug]);
  const next = weeks[i + step];
  if (next) pick(slug, next.number);
}

// Raccourcis clavier (un seul écouteur, actif seulement quand l'onglet Plan est affiché)
document.addEventListener('keydown', e => {
  if (!_active || !document.body.contains(_active.root)) return;
  if (document.querySelector('.sheet') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/' && !isTypingTarget(e.target)) {
    e.preventDefault();
    _active.root.querySelector('#plan-search').focus();
    return;
  }
  if (e.key === 'Escape' && e.target.id === 'plan-search') {
    e.target.value = '';
    _query[_active.slug] = '';
    e.target.blur();
    renderPanel(_active.root, _active.slug);
    return;
  }
  if (isTypingTarget(e.target)) return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); selectRelative(_active.slug, -1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); selectRelative(_active.slug, 1); }
});

function scrollRailToSelected(root) {
  root.querySelector('.rail-week--selected')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ── Filtres (blocs + à rattraper) ─────────────────────────────────

function renderFilters(root, slug) {
  const plan = getActivePlan(slug);
  const late = overdueItems(projectWeeks(slug), getItemStates(slug)).length;
  const f = _filter[slug] || '';
  root.querySelector('#block-filter').innerHTML = `
    <button class="chip ${!f ? 'chip--on' : ''}" data-block="">Tous</button>
    ${late ? `<button class="chip chip--late ${f === LATE ? 'chip--on' : ''}" data-block="${LATE}">À rattraper · ${late}</button>` : ''}
    ${plan.blocks.map(b => `
      <button class="chip ${f === b.id ? 'chip--on' : ''}" data-block="${esc(b.id)}" title="${esc(b.name)}">
        <span class="dot dot--${b.color}"></span>${esc(b.id)}<span class="chip__name">${esc(b.name)}</span>
      </button>`).join('')}`;
}

// ── Frise des semaines ────────────────────────────────────────────

function renderRail(root, slug) {
  const weeks  = projectWeeks(slug);
  const states = getItemStates(slug);
  const cur    = currentWeek(weeks);
  const late   = new Set(overdueItems(weeks, states).map(o => o.week.number));

  root.querySelector('#week-rail').innerHTML = weeks.map(w => {
    const c = countStatus(w.items, states);
    const treated = c.done + c.skipped;
    const isCur = w.number === cur.number && cur.phase === 'during';
    const complete = c.total > 0 && treated === c.total;
    const cls = [
      w.number === _selected[slug] ? 'rail-week--selected' : '',
      isCur ? 'rail-week--current' : '',
      complete ? 'rail-week--complete' : '',
      late.has(w.number) ? 'rail-week--late' : '',
    ].join(' ');
    return `
      <button class="rail-week ${cls}" data-week="${w.number}" title="${esc(w.note || '')}">
        <span class="rail-week__num">Sem. ${w.number}</span>
        <span class="rail-week__info">
          <span class="rail-week__dates">${w.start ? formatRange(w.start, w.end) : ''}${isCur ? ' · en cours' : ''}</span>
          <span class="rail-week__note">${esc(w.note || '')}</span>
        </span>
        <span class="rail-week__count">${complete ? '✓' : `${treated}/${c.total}`}</span>
        ${progressBar(c.total ? treated / c.total * 100 : 0, 'bar--thin')}
      </button>`;
  }).join('');
}

// ── Panneau de la semaine (ou liste filtrée) ──────────────────────

function renderPanel(root, slug) {
  const plan   = getActivePlan(slug);
  const blocks = blockMap(plan);
  const weeks  = projectWeeks(slug);
  const states = getItemStates(slug);
  const filter = _filter[slug];
  const query  = (_query[slug] || '').trim().toLowerCase();
  const panel  = root.querySelector('#week-panel');

  // Recherche ou « à rattraper » : liste transversale, toutes semaines confondues
  if (query || filter === LATE) {
    let hits = filter === LATE
      ? overdueItems(weeks, states)
      : weeks.flatMap(w => w.items.map(item => ({ item, week: w })));
    if (filter && filter !== LATE) hits = hits.filter(h => h.item.block === filter);
    if (query) hits = hits.filter(({ item: i }) =>
      [i.id, i.code, i.title, i.content, i.production].join(' ').toLowerCase().includes(query));
    const title = filter === LATE
      ? `À rattraper · ${hits.length} item${hits.length > 1 ? 's' : ''}`
      : `${hits.length} résultat${hits.length > 1 ? 's' : ''}`;
    panel.innerHTML = `
      <div class="week-panel__head">
        <div class="week-panel__heading">
          <h2 class="week-panel__title">${title}</h2>
          ${filter === LATE ? '<div class="muted small">Items des semaines passées ni faits ni sautés. Coche-les, saute-les ou reporte-les.</div>' : ''}
        </div>
        <button class="btn btn--secondary btn--sm" data-clear>Retour à la semaine</button>
      </div>
      <div class="item-list">
        ${hits.map(h => renderItemRow(slug, h.item, { blocks, week: h.week, showWeek: true })).join('')
          || `<p class="muted">${filter === LATE ? 'Rien à rattraper.' : 'Aucun item ne correspond.'}</p>`}
      </div>`;
    return;
  }

  const i = weeks.findIndex(w => w.number === _selected[slug]);
  const w = weeks[i];
  if (!w) { panel.innerHTML = ''; return; }
  const cur = currentWeek(weeks);
  const isCur = w.number === cur.number && cur.phase === 'during';
  const c = countStatus(w.items, states);
  const items = w.items.filter(it => !filter || it.block === filter);

  panel.innerHTML = `
    <div class="week-panel__head">
      <button class="icon-btn" data-step="-1" ${i === 0 ? 'disabled' : ''} aria-label="Semaine précédente" title="Semaine précédente (←)">${ICONS.chevronL}</button>
      <div class="week-panel__heading">
        <h2 class="week-panel__title">Semaine ${w.number} <span class="muted week-panel__of">/ ${weeks.length}</span>
          ${isCur ? '<span class="pill pill--accent">En cours</span>' : ''}
        </h2>
        <div class="muted small">${w.start ? formatRange(w.start, w.end, true) : ''}</div>
      </div>
      <button class="icon-btn" data-step="1" ${i === weeks.length - 1 ? 'disabled' : ''} aria-label="Semaine suivante" title="Semaine suivante (→)">${ICONS.chevronR}</button>
    </div>
    ${!isCur && cur.number != null && cur.phase === 'during' ? `<button class="link-btn" data-goto-week="${cur.number}">↩ Revenir à la semaine en cours (${cur.number})</button>` : ''}
    ${w.note ? `<p class="week-panel__note">${esc(w.note)}</p>` : ''}
    <div class="week-panel__progress">
      ${progressBar(c.total ? (c.done + c.skipped) / c.total * 100 : 0)}
      <span class="small muted">${c.done}/${c.total} fait${c.done > 1 ? 's' : ''}${c.skipped ? ` · ${c.skipped} sauté${c.skipped > 1 ? 's' : ''}` : ''}</span>
    </div>
    <div class="item-list">
      ${items.map(it => renderItemRow(slug, it, { blocks, week: w })).join('')
        || `<p class="muted">${filter ? 'Aucun item de ce bloc cette semaine.' : 'Aucun item cette semaine.'}</p>`}
    </div>
    <p class="plan-help muted small">✓ fait · ✕ sauté · rien = à faire. Clique sur un item pour voir son contenu, ajouter une note ou le reporter.</p>`;
}
