// Onglet Avancement : indicateurs, avancement par bloc, histogramme hebdo, livrables.

import { getActivePlan, getDeliverableStates, setDeliverableDone } from '../store.js';
import { projectSummary, countStatus, blockMap } from '../utils/progress.js';
import { formatRange, formatDateShort } from '../utils/dates.js';
import { esc, progressBar, ICONS } from '../utils/ui.js';
import { refreshSidebar } from '../app.js';
import { selectWeek } from './plan-view.js';

const pad = n => String(n).padStart(2, '0');

export function mount(container, slug) {
  if (!getActivePlan(slug)) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📊</div>
        <div class="empty-state__title">Rien à mesurer pour l'instant</div>
        <div class="empty-state__body">L'avancement apparaît dès qu'une roadmap est importée.</div>
        <button class="btn btn--primary" data-nav="/project/${slug}/versions">Aller aux versions</button>
      </div>`;
    return;
  }
  container.innerHTML = '<div class="progress-view"></div>';
  const root = container.firstElementChild;

  root.addEventListener('click', e => {
    const d = e.target.closest('[data-deliv]');
    if (d) {
      const st = getDeliverableStates(slug)[d.dataset.deliv];
      setDeliverableDone(slug, d.dataset.deliv, !st?.done);
      render(root, slug);
      refreshSidebar();
      return;
    }
    const w = e.target.closest('[data-week-bar]');
    if (w) {
      selectWeek(slug, parseInt(w.dataset.weekBar, 10));
      location.hash = `/project/${slug}/plan`;
    }
  });

  render(root, slug);
}

function render(root, slug) {
  const s = projectSummary(slug);
  const { plan, weeks, states, counts, current, overdue } = s;
  const all = weeks.flatMap(w => w.items);
  const delivStates = getDeliverableStates(slug);
  const delivDone = plan.deliverables.filter(d => delivStates[d.id]?.done).length;
  const maxItems = Math.max(1, ...weeks.map(w => w.items.length));
  const itemWeek = Object.fromEntries(weeks.flatMap(w => w.items.map(i => [i.id, w])));

  const weekLabel = current.phase === 'before' ? 'Pas commencé'
    : current.phase === 'after' ? 'Terminé'
    : `${s.weekIndex} / ${weeks.length}`;

  root.innerHTML = `
    <div class="kpis">
      ${kpi('Avancement', `${counts.pct} %`, `${counts.done}/${counts.total} faits${counts.skipped ? ` · ${counts.skipped} sauté${counts.skipped > 1 ? 's' : ''}` : ''}`)}
      ${kpi('Semaine', weekLabel, s.week?.start ? formatRange(s.week.start, s.week.end) : '')}
      ${kpi('À rattraper', overdue.length ? String(overdue.length) : 'À jour', overdue.length ? 'items des semaines passées' : 'rien en attente', overdue.length ? (overdue.length >= 3 ? 'bad' : 'warn') : 'ok')}
      ${kpi('Livrables', `${delivDone} / ${plan.deliverables.length}`, plan.deliverables.length ? 'à cocher en bas de page' : 'aucun livrable déclaré')}
    </div>

    <div class="progress-columns">
      <section class="card">
        <h2 class="card__heading">Par semaine</h2>
        <div class="histogram" role="img" aria-label="Items faits par semaine">
          ${weeks.map(w => {
            const c = countStatus(w.items, states);
            const isCur = w.number === current.number && current.phase === 'during';
            const h = c.total / maxItems * 100;
            return `
              <div class="histogram__col ${isCur ? 'histogram__col--current' : ''}" data-week-bar="${w.number}"
                   title="W${pad(w.number)}${w.start ? ' · ' + formatRange(w.start, w.end) : ''} — ${c.done}/${c.total} faits${c.skipped ? `, ${c.skipped} sautés` : ''}">
                <div class="histogram__bar" style="height:${h}%">
                  <div class="histogram__skip" style="height:${c.total ? c.skipped / c.total * 100 : 0}%"></div>
                  <div class="histogram__done" style="height:${c.total ? c.done / c.total * 100 : 0}%"></div>
                </div>
                <span class="histogram__label">${w.number}</span>
              </div>`;
          }).join('')}
        </div>
        <div class="legend">
          <span><i class="dot dot--done"></i>Fait</span>
          <span><i class="dot dot--skipped"></i>Sauté</span>
          <span><i class="dot dot--todo"></i>Reste à faire</span>
          <span class="legend__hint">Clique sur une barre pour ouvrir la semaine</span>
        </div>
      </section>

      <section class="card">
        <h2 class="card__heading">Par bloc</h2>
        <div class="block-stats">
          ${plan.blocks.map(b => {
            const c = countStatus(all.filter(i => i.block === b.id), states);
            if (!c.total) return '';
            return `
              <div class="block-stat">
                <div class="block-stat__head">
                  <span><span class="dot dot--${b.color}"></span> <strong>${esc(b.id)}</strong> ${esc(b.name)}</span>
                  <span class="small muted">${c.done}/${c.total}</span>
                </div>
                ${progressBar(c.pct, `bar--${b.color}`)}
              </div>`;
          }).join('') || '<p class="muted">Aucun bloc déclaré dans la roadmap.</p>'}
        </div>
      </section>
    </div>

    ${plan.deliverables.length ? `
      <section class="card">
        <h2 class="card__heading">Livrables</h2>
        <div class="deliverables">
          ${plan.deliverables.map(d => {
            const done = !!delivStates[d.id]?.done;
            const w = itemWeek[d.due];
            const due = w ? `${d.due} · W${pad(w.number)}${w.start ? ' · ' + formatDateShort(w.end) : ''}` : d.due;
            return `
              <button class="deliverable ${done ? 'deliverable--done' : ''}" data-deliv="${esc(d.id)}">
                <span class="round round--done ${done ? 'is-on' : ''}">${ICONS.check}</span>
                <span class="deliverable__body">
                  <span class="deliverable__title">${esc(d.title)}</span>
                  <span class="small muted">${esc(due)}${d.note ? ` — ${esc(d.note)}` : ''}</span>
                </span>
              </button>`;
          }).join('')}
        </div>
      </section>` : ''}`;
}

function kpi(label, value, sub, tone = '') {
  return `
    <div class="kpi ${tone ? `kpi--${tone}` : ''}">
      <div class="kpi__label">${label}</div>
      <div class="kpi__value">${esc(value)}</div>
      <div class="kpi__sub">${esc(sub)}</div>
    </div>`;
}
