// Réglages : profil personnel (profile.json), injecté dans tous les prompts IA.

import { getProfile, saveProfile } from '../store.js';
import { showToast } from '../app.js';
import { logout } from './lock.js';
import { esc } from '../utils/ui.js';
import { topbar, globalTabBar } from './chrome.js';

const FIELDS = [
  ['situation',    'Situation actuelle',               'Poste, contexte de vie, étape en cours.'],
  ['skills',       'Compétences et acquis',            'Ce que tu maîtrises déjà, expériences utiles.'],
  ['availability', 'Disponibilités',                   'Créneaux, nombre d\'heures par semaine, périodes chargées.'],
  ['tools',        'Outils et environnement',          'Matériel, logiciels, licences, accès.'],
  ['learning',     'Façon d\'apprendre / de travailler', 'Pratique d\'abord, lecture, exercices corrigés, projets concrets…'],
  ['constraints',  'Contraintes',                      'Santé, famille, confidentialité, budget…'],
  ['goals',        'Objectifs de fond',                'Ce vers quoi tendent tous tes projets.'],
];

export function mount(container) {
  const p = getProfile();
  container.innerHTML = `
    <div class="view">
      ${topbar({ title: 'Réglages' })}
      <main class="page page--narrow">
        <form id="profile-form" class="form">
          <section class="card">
            <h2 class="card__heading">Profil</h2>
            <p class="muted small">Injecté automatiquement dans les prompts de roadmap initiale et de révision.</p>
            ${FIELDS.map(([id, label, ph]) => `
              <div class="form-group">
                <label class="form-label" for="${id}">${label}</label>
                <textarea class="textarea-field" id="${id}" rows="2" placeholder="${esc(ph)}">${esc(p[id] || '')}</textarea>
              </div>`).join('')}
            <div class="form-actions">
              <button type="submit" class="btn btn--primary" id="save-btn">Enregistrer</button>
            </div>
          </section>
        </form>

        <section class="card">
          <h2 class="card__heading">Session</h2>
          <p class="muted small">Les données sont stockées dans le dépôt GitHub (<code>profile.json</code>, <code>state.json</code>, <code>projects/</code>). Le token GitHub n'est gardé que pour cet onglet.</p>
          <div class="form-actions">
            <a class="btn btn--secondary" href="./README.md" target="_blank" rel="noopener">Documentation</a>
            <button class="btn btn--danger" id="logout-btn">Se déconnecter</button>
          </div>
        </section>
      </main>
      ${globalTabBar('settings')}
    </div>`;

  const form = container.querySelector('#profile-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('#save-btn');
    btn.disabled = true;
    btn.textContent = 'Enregistrement…';
    try {
      const profile = Object.fromEntries(FIELDS.map(([id]) => [id, form.querySelector('#' + id).value.trim()]));
      await saveProfile(profile);
      showToast('Profil enregistré', 'success');
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enregistrer';
    }
  });
  container.querySelector('#logout-btn').addEventListener('click', logout);
}
