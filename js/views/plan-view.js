// Onglet Plan : frise des semaines + items de la semaine sélectionnée.
// Ordinateur : frise verticale à gauche, semaine à droite, flèches ← → pour changer de semaine,
// « / » pour chercher. Mobile : frise horizontale défilante au-dessus de la semaine.

import { getActivePlan, getItemStates } from '../store.js';
import { projectWeeks, currentWeek, countStatus, blockMap } from '../utils/progress.js';
import { formatRange } from '../utils/dates.js';
import { esc, progressBar, ICONS, isTypingTarget } from '../utils/ui.js';
import { renderItemRow, bindItemRows } from './item-ui.js';

const pad = n => String(n).padStart(2, '0');

// Préférences d'affichage conservées le temps de la session (par projet)
const _selected = {};
const _filter   = {};
const _query    = {};
let _active = null;   // { slug, root } de la vue montée, pour le raccourci clavier global

// Pré-sélectionne une semaine avant d'ouvrir l'onglet (ex. clic dans l'histogramme d'avancement).
export function selectWeek(slug, number) {
  _selected[slug] = number;
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
        <div class="chips" id="block-filter">
          <button class="chip ${!_filter[slug] ? 'chip--on' : ''}" data-block="">Tous</button>
          ${plan.blocks.map(b => `
            <button class="chip chip--${b.color} ${_filter[slug] === b.id ? 'chip--on' : ''}" data-block="${esc(b.id)}" title="${esc(b.name)}">
              <span class="dot dot--${b.color}"></span>${esc(b.id)}
            </button>`).join('')}
        </div>
      </div>
      <div class="plan-layout">
        <nav class="week-rail" id="week-rail" aria-label="Semaines"></nav>
        <section class="week-panel" id="week-panel"></section>
      </div>
    </div>`;

  const root = container.firstElementChild;
  _active = { slug, root };

  const refresh = () => { renderRail(root, slug); renderPanel(root, slug); };
  bindItemRows(root.querySelector('#week-panel'), refresh);

  root.querySelector('#week-rail').addEventListener('click', e => {
    const btn = e.target.closest('[data-week]');
    if (!btn) return;
    _selected[slug] = parseInt(btn.dataset.week, 10);
    _query[slug] = '';
    root.querySelector('#plan-search').value = '';
    refresh();
  });

  root.querySelector('#week-panel').addEventListener('click', e => {
    const step = e.target.closest('[data-step]');
    if (step) selectRelative(slug, parseInt(step.dataset.step, 10));
  });

  root.querySelector('#block-filter').addEventListener('click', e => {
    const chip = e.target.closest('[data-block]');
    if (!chip) return;
    _filter[slug] = chip.dataset.block || null;
    root.querySelectorAll('#block-filter .chip').forEach(c => c.classList.toggle('chip--on', c === chip));
    renderPanel(root, slug);
  });

  root.querySelector('#plan-search').addEventListener('input', e => {
    _query[slug] = e.target.value;
    renderPanel(root, slug);
  });

  refresh();
  scrollRailToSelected(root);
}

function selectRelative(slug, step) {
  if (!_active || _active.slug !== slug) return;
  const weeks = projectWeeks(slug);
  const i = weeks.findIndex(w => w.number === _selected[slug]);
  const next = weeks[i + step];
  if (!next) return;
  _selected[slug] = next.number;
  renderRail(_active.root, slug);
  renderPanel(_active.root, slug);
  scrollRailToSelected(_active.root);
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
  if (isTypingTarget(e.target)) return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); selectRelative(_active.slug, -1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); selectRelative(_active.slug, 1); }
});

function scrollRailToSelected(root) {
  const el = root.querySelector('.rail-week--selected');
  el?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ── Frise des semaines ────────────────────────────────────────────

function renderRail(root, slug) {
  const weeks  = projectWeeks(slug);
  const states = getItemStates(slug);
  const cur    = currentWeek(weeks);

  root.querySelector('#week-rail').innerHTML = weeks.map(w => {
    const c = countStatus(w.items, states);
    const treated = c.done + c.skipped;
    const isCur = w.number === cur.number && cur.phase === 'during';
    const complete = c.total > 0 && treated === c.total;
    return `
      <button class="rail-week ${w.number === _selected[slug] ? 'rail-week--selected' : ''} ${isCur ? 'rail-week--current' : ''} ${complete ? 'rail-week--complete' : ''}"
              data-week="${w.number}" title="${esc(w.note || '')}">
        <span class="rail-week__num">W${pad(w.number)}</span>
        <span class="rail-week__info">
          <span class="rail-week__dates">${w.start ? formatRange(w.start, w.end) : ''}</span>
          <span class="rail-week__note">${esc(w.note || '')}</span>
        </span>
        <span class="rail-week__count">${treated}/${c.total}</span>
        ${progressBar(c.total ? treated / c.total * 100 : 0, 'bar--thin')}
      </button>`;
  }).join('');
}

// ── Panneau de la semaine (ou résultats de recherche) ─────────────

function renderPanel(root, slug) {
  const plan   = getActivePlan(slug);
  const blocks = blockMap(plan);
  const weeks  = projectWeeks(slug);
  const states = getItemStates(slug);
  const filter = _filter[slug];
  const query  = (_query[slug] || '').trim().toLowerCase();
  const panel  = root.querySelector('#week-panel');
  const keep   = i => !filter || i.block === filter;

  if (query) {
    const hits = weeks.flatMap(w => w.items.filter(keep).filter(i =>
      [i.id, i.code, i.title, i.content, i.production].join(' ').toLowerCase().includes(query)));
    panel.innerHTML = `
      <div class="week-panel__head"><h2 class="week-panel__title">${hits.length} résultat${hits.length > 1 ? 's' : ''}</h2></div>
      <div class="item-list">
        ${hits.map(i => renderItemRow(slug, i, { blocks, showWeek: true })).join('') || '<p class="muted">Aucun item ne correspond.</p>'}
      </div>`;
    return;
  }

  const i = weeks.findIndex(w => w.number === _selected[slug]);
  const w = weeks[i];
  if (!w) { panel.innerHTML = ''; return; }
  const cur = currentWeek(weeks);
  const c = countStatus(w.items, states);
  const items = w.items.filter(keep);

  panel.innerHTML = `
    <div class="week-panel__head">
      <button class="icon-btn" data-step="-1" ${i === 0 ? 'disabled' : ''} aria-label="Semaine précédente">${ICONS.chevronL}</button>
      <div class="week-panel__heading">
        <h2 class="week-panel__title">Semaine ${w.number}
          ${w.number === cur.number && cur.phase === 'during' ? '<span class="pill pill--accent">En cours</span>' : ''}
        </h2>
        <div class="muted small">${w.start ? formatRange(w.start, w.end, true) : ''}</div>
      </div>
      <button class="icon-btn" data-step="1" ${i === weeks.length - 1 ? 'disabled' : ''} aria-label="Semaine suivante">${ICONS.chevronR}</button>
    </div>
    ${w.note ? `<p class="week-panel__note">${esc(w.note)}</p>` : ''}
    <div class="week-panel__progress">
      ${progressBar(c.total ? (c.done + c.skipped) / c.total * 100 : 0)}
      <span class="small muted">${c.done} fait${c.done > 1 ? 's' : ''}${c.skipped ? ` · ${c.skipped} sauté${c.skipped > 1 ? 's' : ''}` : ''} · ${c.total} au total</span>
    </div>
    <div class="item-list">
      ${items.map(it => renderItemRow(slug, it, { blocks })).join('') || `<p class="muted">${filter ? 'Aucun item de ce bloc cette semaine.' : 'Aucun item cette semaine.'}</p>`}
    </div>`;
}
