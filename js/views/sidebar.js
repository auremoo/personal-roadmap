// Sidebar ordinateur (≥ 900 px) : navigation, avancement de la semaine, liste des projets.

import { getProjects } from '../store.js';
import { projectSummary, isActiveProject } from '../utils/progress.js';
import { ICONS, esc, progressBar } from '../utils/ui.js';

export function mountSidebar(container, path = '/') {
  if (!container) return;
  const projects = getProjects();
  const activeSlug = path.match(/^\/project\/([\w-]+)/)?.[1] || null;

  // Semaine en cours, tous projets actifs confondus
  let weekDone = 0, weekTotal = 0;
  for (const p of projects.filter(p => isActiveProject(p.slug))) {
    const s = projectSummary(p.slug);
    if (s?.weekCounts && s.current.phase === 'during') {
      weekDone += s.weekCounts.done + s.weekCounts.skipped;
      weekTotal += s.weekCounts.total;
    }
  }

  const navItem = (id, label, target, icon) => `
    <button class="sb-nav-item ${isRoute(path, target) && !activeSlug ? 'sb-nav-item--active' : ''}" data-nav="${target}">
      ${ICONS[icon]}<span>${label}</span>
    </button>`;

  const active   = projects.filter(p => isActiveProject(p.slug));
  const inactive = projects.filter(p => !isActiveProject(p.slug));

  container.innerHTML = `
    <div class="sb-header">
      <img src="./logo.png" class="sb-logo" alt="">
      <span class="sb-title">Roadmap</span>
    </div>

    <nav class="sb-nav">
      ${navItem('home', 'Accueil', '/', 'home')}
      ${navItem('projects', 'Projets', '/projects', 'projects')}
      ${navItem('settings', 'Réglages', '/settings', 'settings')}
    </nav>

    ${weekTotal ? `
      <div class="sb-week" data-nav="/">
        <div class="sb-week__label">Cette semaine</div>
        <div class="sb-week__value">${weekDone} <span>/ ${weekTotal}</span></div>
        ${progressBar(weekTotal ? weekDone / weekTotal * 100 : 0)}
      </div>` : ''}

    <div class="sb-section-label">Projets</div>
    <div class="sb-projects">
      ${active.map(p => projectItem(p, activeSlug)).join('') || '<div class="sb-empty">Aucun projet actif</div>'}
      ${inactive.length ? `<div class="sb-section-label sb-section-label--sub">En pause / terminés</div>${inactive.map(p => projectItem(p, activeSlug)).join('')}` : ''}
    </div>

    <div class="sb-footer">
      <button class="sb-nav-item ${isRoute(path, '/new-project') ? 'sb-nav-item--active' : ''}" data-nav="/new-project">
        ${ICONS.plus}<span>Nouveau projet</span>
      </button>
    </div>`;
}

function isRoute(path, target) {
  return target === '/' ? path === '/' : path === target;
}

function projectItem(p, activeSlug) {
  const s = projectSummary(p.slug);
  const sub = s
    ? (s.current.phase === 'before' ? 'Pas commencé' : s.current.phase === 'after' ? 'Période terminée' : `Semaine ${s.weekIndex}/${s.weeks.length}`)
    : 'Sans roadmap';
  return `
    <button class="sb-project ${p.slug === activeSlug ? 'sb-project--active' : ''}" data-nav="/project/${p.slug}">
      <div class="sb-project__name">${esc(p.name)}</div>
      <div class="sb-project__meta">${sub}${s ? ` · ${s.counts.pct} %` : ''}</div>
      ${s ? progressBar(s.counts.pct, 'bar--thin') : ''}
    </button>`;
}
