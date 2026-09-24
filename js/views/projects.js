// Liste des projets + création.

import { getProjects, getProjectMeta } from '../store.js';
import { projectSummary } from '../utils/progress.js';
import { formatDateShort } from '../utils/dates.js';
import { esc, progressBar, ICONS } from '../utils/ui.js';
import { topbar, globalTabBar } from './chrome.js';

const STATUS_LABEL = { active: 'Actif', paused: 'En pause', done: 'Terminé' };

export function mount(container) {
  const projects = getProjects();
  const order = { active: 0, paused: 1, done: 2 };
  const sorted = projects.slice().sort((a, b) =>
    (order[a.status || 'active'] - order[b.status || 'active']) || (a.startDate || '').localeCompare(b.startDate || ''));

  container.innerHTML = `
    <div class="view">
      ${topbar({ title: 'Projets', actions: `<button class="btn btn--primary btn--sm" data-nav="/new-project">${ICONS.plus}<span>Nouveau</span></button>` })}
      <main class="page">
        ${sorted.length ? `<div class="project-grid">${sorted.map(projectCard).join('')}</div>` : `
          <div class="empty-state">
            <div class="empty-state__icon">🗺️</div>
            <div class="empty-state__title">Aucun projet</div>
            <div class="empty-state__body">Un projet = un objectif, une période, une roadmap hebdomadaire versionnée.</div>
            <button class="btn btn--primary" data-nav="/new-project">Créer un projet</button>
          </div>`}
      </main>
      ${globalTabBar('projects')}
    </div>`;
}

function projectCard(p) {
  const meta = getProjectMeta(p.slug) || {};
  const s = projectSummary(p.slug);
  const status = meta.status || 'active';
  return `
    <article class="card card--link project-card project-card--${status}" data-nav="/project/${p.slug}">
      <header class="project-card__head">
        <div class="card__title">${esc(meta.name || p.name)}</div>
        <span class="pill pill--${status === 'active' ? 'ok' : 'muted'}">${STATUS_LABEL[status]}</span>
      </header>
      ${meta.objective ? `<p class="project-card__objective">${esc(meta.objective)}</p>` : ''}
      <div class="project-card__meta">
        ${meta.startDate ? `<span>${formatDateShort(meta.startDate)} → ${formatDateShort(meta.endDate)}</span>` : ''}
        ${s ? `<span>v${meta.activeVersion} · ${s.counts.done}/${s.counts.total} items</span>` : '<span>Sans roadmap</span>'}
      </div>
      ${s ? `
        <div class="project-card__progress">
          ${progressBar(s.counts.pct)}
          <span class="small">${s.counts.pct} %</span>
        </div>
        ${s.overdue.length ? `<div class="small late-text">${s.overdue.length} à rattraper</div>` : ''}` : ''}
    </article>`;
}
