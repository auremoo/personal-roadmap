// Liste des projets + création.

import { getProjects, getProjectMeta } from '../store.js';
import { projectSummary, weeklyLoad, isActiveProject } from '../utils/progress.js';
import { formatDateShort, mondayOf, today } from '../utils/dates.js';
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
        ${loadCard(sorted.filter(p => isActiveProject(p.slug)).map(p => p.slug))}
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

// Charge par semaine, tous projets actifs : faits / sautés / à rattraper / à faire
function loadCard(slugs) {
  const cols = weeklyLoad(slugs);
  if (!cols.length) return '';
  const cur = mondayOf(today());
  const max = Math.max(1, ...cols.map(c => c.done + c.skipped + c.late + c.todo));
  const step = Math.max(1, Math.ceil(cols.length / 6));
  const seg = (n, cls) => n ? `<div class="load__seg load__seg--${cls}" style="height:${n / max * 100}%"></div>` : '';
  return `
    <section class="card load-card">
      <div class="card__heading-row">
        <h2 class="card__heading">Charge par semaine</h2>
        <span class="muted small">en items, projets actifs</span>
      </div>
      <div class="load">
        ${cols.map((c, i) => {
          const total = c.done + c.skipped + c.late + c.todo;
          return `
          <div class="load__col ${c.monday === cur ? 'load__col--current' : ''}"
               title="Semaine du ${formatDateShort(c.monday)} : ${c.done} fait${c.done > 1 ? 's' : ''}, ${c.skipped} sauté${c.skipped > 1 ? 's' : ''}${c.late ? `, ${c.late} à rattraper` : ''}${c.todo ? `, ${c.todo} à faire` : ''}">
            <div class="load__count">${total || ''}</div>
            <div class="load__bar">${seg(c.todo, 'todo')}${seg(c.late, 'late')}${seg(c.skipped, 'skipped')}${seg(c.done, 'done')}</div>
            <div class="load__label">${i % step === 0 ? formatDateShort(c.monday) : ''}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="legend legend--wrap">
        <span><i class="dot dot--done"></i>Faits</span>
        <span><i class="dot dot--skipped"></i>Sautés</span>
        <span><i class="dot" style="background:var(--ios-red)"></i>À rattraper</span>
        <span><i class="dot" style="background:var(--ios-blue)"></i>À faire</span>
      </div>
    </section>`;
}
