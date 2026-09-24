// Création (/new-project) et modification (/project/:slug/edit) d'un projet.

import { createProject, updateProject, getProjectMeta } from '../store.js';
import { navigate, showToast, refreshSidebar } from '../app.js';
import { weeksBetween, mondayOf, addDays } from '../utils/dates.js';
import { esc } from '../utils/ui.js';
import { topbar } from './chrome.js';

export function mount(container, slug) {
  const editing = !!slug;
  const meta = editing ? getProjectMeta(slug) : {};
  if (editing && !meta) { navigate('/projects'); return; }

  const field = (id, label, { type = 'text', value = '', placeholder = '', hint = '', required = false, attrs = '' } = {}) => `
    <div class="form-group">
      <label class="form-label" for="${id}">${label}${required ? ' *' : ''}</label>
      ${type === 'textarea'
        ? `<textarea class="textarea-field" id="${id}" name="${id}" rows="3" placeholder="${esc(placeholder)}" ${attrs}>${esc(value)}</textarea>`
        : `<input class="input-field" type="${type}" id="${id}" name="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''} ${attrs}>`}
      ${hint ? `<div class="form-hint">${hint}</div>` : ''}
    </div>`;

  container.innerHTML = `
    <div class="view">
      ${topbar({
        title: editing ? 'Modifier le projet' : 'Nouveau projet',
        back: editing ? { label: 'Projet', path: `/project/${slug}/infos` } : { label: 'Projets', path: '/projects' },
      })}
      <main class="page page--narrow">
        <form id="project-form" class="form" autocomplete="off">
          <section class="card">
            ${field('name', 'Nom', { value: meta.name, placeholder: 'Préparation PCI', required: true })}
            ${editing ? '' : field('slug', 'Identifiant', { value: '', placeholder: 'preparation-pci', hint: 'Nom du dossier dans le dépôt (lettres, chiffres, tirets). Généré à partir du nom.', attrs: 'pattern="[a-z0-9\\-]+"' })}
            ${field('objective', 'Objectif', { type: 'textarea', value: meta.objective, placeholder: 'Ce qui doit être vrai à la fin de la période.' })}
            ${field('context', 'Contexte', { type: 'textarea', value: meta.context, placeholder: 'Pourquoi ce projet, point de départ, enjeux.' })}
          </section>

          <section class="card">
            <div class="form-row">
              ${field('startDate', 'Début', { type: 'date', value: meta.startDate, hint: 'Ramené au lundi.' })}
              ${field('endDate', 'Fin', { type: 'date', value: meta.endDate })}
              ${field('weeks', 'Semaines', { type: 'number', value: meta.weeks, attrs: 'min="1" max="260"' })}
            </div>
            ${field('rhythm', 'Rythme', { value: meta.rhythm, placeholder: '5 séances de 1 h 30 par semaine' })}
            ${field('constraints', 'Contraintes du projet', { type: 'textarea', value: meta.constraints, placeholder: 'Congés, priorités en cas de retard, confidentialité…' })}
            ${editing ? `
              <div class="form-group">
                <label class="form-label" for="status">Statut</label>
                <select class="input-field" id="status" name="status">
                  ${[['active', 'Actif'], ['paused', 'En pause'], ['done', 'Terminé']].map(([v, l]) =>
                    `<option value="${v}" ${(meta.status || 'active') === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
              </div>` : ''}
          </section>

          <section class="card">
            ${field('draft', 'Matière existante (facultatif)', { type: 'textarea', value: meta.draft, placeholder: 'Colle ici un brouillon de roadmap, des notes… Il sera repris dans le prompt initial.', attrs: 'rows="8"' })}
          </section>

          <div class="form-actions">
            <button type="submit" class="btn btn--primary" id="save-btn">${editing ? 'Enregistrer' : 'Créer le projet'}</button>
            <button type="button" class="btn btn--secondary" data-nav="${editing ? `/project/${slug}/infos` : '/projects'}">Annuler</button>
          </div>
        </form>
      </main>
    </div>`;

  const form = container.querySelector('#project-form');
  const $ = id => form.querySelector('#' + id);

  // Identifiant auto tant que l'utilisateur ne l'a pas modifié
  let slugTouched = false;
  $('slug')?.addEventListener('input', () => { slugTouched = true; });
  $('name').addEventListener('input', () => {
    if (!editing && !slugTouched) $('slug').value = slugify($('name').value);
  });

  // Semaines ↔ dates
  const syncWeeks = () => {
    if ($('startDate').value && $('endDate').value && $('endDate').value >= $('startDate').value) {
      $('weeks').value = weeksBetween(mondayOf($('startDate').value), $('endDate').value);
    }
  };
  $('startDate').addEventListener('change', () => {
    if ($('startDate').value) $('startDate').value = mondayOf($('startDate').value);
    syncWeeks();
  });
  $('endDate').addEventListener('change', syncWeeks);
  $('weeks').addEventListener('change', () => {
    const n = parseInt($('weeks').value, 10);
    if ($('startDate').value && n > 0) $('endDate').value = addDays($('startDate').value, n * 7 - 1);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
      name: $('name').value.trim(),
      objective: $('objective').value.trim(),
      context: $('context').value.trim(),
      startDate: $('startDate').value,
      endDate: $('endDate').value,
      weeks: parseInt($('weeks').value, 10) || null,
      rhythm: $('rhythm').value.trim(),
      constraints: $('constraints').value.trim(),
      draft: $('draft').value.trim(),
    };
    if (!data.name) { showToast('Le nom est obligatoire', 'error'); return; }

    const btn = $('save-btn');
    btn.disabled = true;
    btn.textContent = 'Enregistrement…';
    try {
      if (editing) {
        await updateProject(slug, { ...data, status: $('status').value });
        showToast('Projet enregistré', 'success');
        refreshSidebar();
        navigate(`/project/${slug}/infos`);
      } else {
        const newSlug = slugify($('slug').value || data.name);
        if (!newSlug) throw new Error('Identifiant invalide');
        await createProject({ slug: newSlug, ...data });
        showToast('Projet créé', 'success');
        refreshSidebar();
        navigate(`/project/${newSlug}/versions`);
      }
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = editing ? 'Enregistrer' : 'Créer le projet';
    }
  });
}

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
