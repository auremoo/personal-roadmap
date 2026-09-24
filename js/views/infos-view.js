// Onglet Infos : fiche du projet (modifiable) + sections libres de la roadmap (Cadre, À vérifier, Sources…).

import { getProjectMeta, getActivePlan } from '../store.js';
import { formatDate } from '../utils/dates.js';
import { renderMarkdown } from '../utils/markdown.js';
import { esc } from '../utils/ui.js';

const STATUS_LABEL = { active: 'Actif', paused: 'En pause', done: 'Terminé' };

export function mount(container, slug) {
  const meta = getProjectMeta(slug);
  const plan = getActivePlan(slug);

  const rows = [
    ['Objectif', meta.objective],
    ['Période', meta.startDate ? `${formatDate(meta.startDate)} → ${formatDate(meta.endDate)}${meta.weeks ? ` (${meta.weeks} semaines)` : ''}` : ''],
    ['Rythme', meta.rhythm],
    ['Statut', STATUS_LABEL[meta.status || 'active']],
    ['Contexte', meta.context],
    ['Contraintes', meta.constraints],
  ].filter(([, v]) => v);

  container.innerHTML = `
    <div class="infos-view">
      <section class="card">
        <div class="card__heading-row">
          <h2 class="card__heading">Projet</h2>
          <button class="btn btn--secondary btn--sm" data-nav="/project/${slug}/edit">Modifier</button>
        </div>
        <dl class="facts">
          ${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v).replace(/\n/g, '<br>')}</dd>`).join('')}
        </dl>
      </section>

      ${plan ? `
        ${plan.blocks.length ? `
          <section class="card">
            <h2 class="card__heading">Blocs</h2>
            <div class="block-legend">
              ${plan.blocks.map(b => `<span class="block-legend__item"><span class="dot dot--${b.color}"></span><strong>${esc(b.id)}</strong> ${esc(b.name)}</span>`).join('')}
            </div>
          </section>` : ''}
        ${plan.info.map(s => `
          <section class="card">
            <h2 class="card__heading">${esc(s.label)}</h2>
            <div class="markdown-body">${renderMarkdown(s.body)}</div>
          </section>`).join('')}
      ` : ''}

      ${meta.draft ? `
        <details class="card">
          <summary class="card__heading">Matière existante (brouillon fourni à l'IA)</summary>
          <pre class="draft">${esc(meta.draft)}</pre>
        </details>` : ''}
    </div>`;
}
