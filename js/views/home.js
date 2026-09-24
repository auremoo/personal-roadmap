// Accueil : la semaine en cours de chaque projet actif, cochable sur place.

import { getProjects, getProjectMeta } from '../store.js';
import { projectSummary, isActiveProject, blockMap } from '../utils/progress.js';
import { today, formatDate, formatRange } from '../utils/dates.js';
import { esc, progressBar } from '../utils/ui.js';
import { topbar, globalTabBar } from './chrome.js';
import { renderItemRow, bindItemRows } from './item-ui.js';

export function mount(container) {
  container.innerHTML = `<div class="view"></div>`;
  const root = container.firstElementChild;
  bindItemRows(root, () => render(root));
  render(root);
}

function render(root) {
  const projects = getProjects().filter(p => isActiveProject(p.slug));
  const withPlan = projects.map(p => ({ p, s: projectSummary(p.slug) })).filter(x => x.s);
  const noPlan   = projects.filter(p => !projectSummary(p.slug));

  root.innerHTML = `
    ${topbar({ title: 'Accueil', subtitle: capitalize(formatDate(today())) })}
    <main class="page">
      ${!projects.length ? emptyState() : ''}
      <div class="home-grid">
        ${withPlan.map(({ p, s }) => weekCard(p, s)).join('')}
        ${noPlan.map(p => `
          <div class="card card--link" data-nav="/project/${p.slug}/versions">
            <div class="card__title">${esc(p.name)}</div>
            <p class="muted">Pas encore de roadmap. Génère le prompt initial dans l'onglet Versions.</p>
          </div>`).join('')}
      </div>
    </main>
    ${globalTabBar('home')}`;
}

function weekCard(p, s) {
  const meta = getProjectMeta(p.slug);
  const blocks = blockMap(s.plan);
  const w = s.week;
  const heading = s.current.phase === 'before' ? `Démarre le ${formatDate(w.start)}`
    : s.current.phase === 'after' ? 'Période terminée — dernière semaine'
    : `Semaine ${s.weekIndex} / ${s.weeks.length}${w.start ? ` · ${formatRange(w.start, w.end)}` : ''}`;
  const wc = s.weekCounts;

  return `
    <section class="card week-card">
      <header class="week-card__head">
        <div>
          <button class="card__title link-like" data-nav="/project/${p.slug}">${esc(p.name)}</button>
          <div class="muted small">${heading}</div>
        </div>
        <span class="pill pill--${s.pace.tone}">${s.pace.label}</span>
      </header>
      ${meta?.objective ? `<p class="week-card__objective">${esc(meta.objective)}</p>` : ''}
      ${w.note ? `<p class="week-card__note">${esc(w.note)}</p>` : ''}
      <div class="week-card__progress">
        <span class="small muted">Semaine : ${wc.done}/${wc.total}</span>
        ${progressBar(wc.total ? (wc.done + wc.skipped) / wc.total * 100 : 0)}
        <span class="small muted">Global : ${s.counts.pct} %</span>
      </div>
      <div class="item-list">
        ${w.items.map(i => renderItemRow(p.slug, i, { blocks, showProduction: false })).join('') || '<p class="muted">Aucun item cette semaine.</p>'}
      </div>
    </section>`;
}

function emptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🗺️</div>
      <div class="empty-state__title">Aucun projet actif</div>
      <div class="empty-state__body">Crée un projet, génère sa roadmap avec l'IA, puis suis ton avancement semaine après semaine.</div>
      <button class="btn btn--primary" data-nav="/new-project">Créer un projet</button>
    </div>`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
