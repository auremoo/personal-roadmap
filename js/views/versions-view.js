// Onglet Versions : prompts IA (initial / révision), import d'une nouvelle version, historique.

import { getProjectMeta, getActivePlan, importPlanVersion, setActiveVersion, getPlanRaw } from '../store.js';
import { showToast } from '../app.js';
import { parseRoadmap, isRoadmapMarkdown, stripFence } from '../parser.js';
import { buildInitialPrompt, buildRevisionPrompt } from '../utils/prompts.js';
import { esc, openSheet, openPromptModal } from '../utils/ui.js';

export function mount(container, slug) {
  container.innerHTML = '<div class="versions-view"></div>';
  const root = container.firstElementChild;
  render(root, slug);
}

function render(root, slug) {
  const meta = getProjectMeta(slug);
  const versions = (meta.versions || []).slice().reverse();
  const hasPlan = !!getActivePlan(slug);

  root.innerHTML = `
    <div class="versions-actions">
      <section class="card action-card">
        <h2 class="card__heading">1. Générer le prompt</h2>
        <p class="muted small">${hasPlan
          ? 'Le prompt de révision contient le bilan réel (faits, sautés, déplacés, notes), le profil et la roadmap actuelle.'
          : 'Le prompt initial contient ton profil (Réglages), le projet et la matière existante éventuelle.'}</p>
        <button class="btn btn--primary btn--full" id="prompt-btn">✦ ${hasPlan ? 'Prompt de révision' : 'Prompt de roadmap initiale'}</button>
        ${hasPlan ? '<button class="btn btn--ghost btn--full" id="initial-btn">Prompt initial (repartir de zéro)</button>' : ''}
      </section>
      <section class="card action-card dropzone" id="dropzone">
        <h2 class="card__heading">2. Importer la réponse</h2>
        <p class="muted small">Colle la réponse de l'IA ou importe le fichier .md. Sur ordinateur, tu peux aussi glisser le fichier ici.</p>
        <button class="btn btn--secondary btn--full" id="paste-btn">Coller le texte</button>
        <button class="btn btn--ghost btn--full" id="file-btn">Choisir un fichier .md</button>
        <input type="file" id="md-input" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden>
      </section>
    </div>

    <h2 class="section-header">Historique des versions</h2>
    ${versions.length ? `<div class="version-list">${versions.map(v => versionRow(v, meta.activeVersion)).join('')}</div>`
      : '<p class="muted pad">Aucune version importée.</p>'}`;

  root.querySelector('#prompt-btn').addEventListener('click', () => {
    if (hasPlan) openPromptModal('Prompt de révision', buildRevisionPrompt(slug));
    else openPromptModal('Prompt de roadmap initiale', buildInitialPrompt(slug));
  });
  root.querySelector('#initial-btn')?.addEventListener('click', () =>
    openPromptModal('Prompt de roadmap initiale', buildInitialPrompt(slug)));

  root.querySelector('#paste-btn').addEventListener('click', () => openImportSheet(root, slug, ''));
  root.querySelector('#file-btn').addEventListener('click', () => root.querySelector('#md-input').click());
  root.querySelector('#md-input').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) openImportSheet(root, slug, await file.text());
  });

  const dz = root.querySelector('#dropzone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dropzone--over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dropzone--over'));
  dz.addEventListener('drop', async e => {
    e.preventDefault();
    dz.classList.remove('dropzone--over');
    const file = e.dataTransfer.files?.[0];
    if (file) openImportSheet(root, slug, await file.text());
  });

  root.querySelectorAll('[data-activate]').forEach(btn => btn.addEventListener('click', async () => {
    const v = parseInt(btn.dataset.activate, 10);
    btn.disabled = true;
    try {
      await setActiveVersion(slug, v);
      showToast(`Version ${v} activée`, 'success');
      // Re-monte tout le projet : l'en-tête affiche la version active.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      btn.disabled = false;
    }
  }));

  root.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', async () => {
    const v = parseInt(btn.dataset.view, 10);
    const md = await getPlanRaw(slug, v);
    if (!md) { showToast('Fichier introuvable', 'error'); return; }
    const sheet = openSheet({
      title: `Version ${v}`,
      html: `<textarea class="prompt-text" readonly>${esc(md)}</textarea>
             <div class="row-actions"><button class="btn btn--secondary" data-dl>Télécharger le .md</button></div>`,
    });
    sheet.el.classList.add('sheet--wide');
    sheet.body.querySelector('[data-dl]').addEventListener('click', () => download(`${slug}-v${v}.md`, md));
  }));
}

function versionRow(v, activeVersion) {
  const isActive = v.v === activeVersion;
  const date = new Date(v.importedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <div class="version-row ${isActive ? 'version-row--active' : ''}">
      <span class="version-row__badge">v${v.v}</span>
      <div class="version-row__info">
        <div class="version-row__title">${esc(v.label || `Version ${v.v}`)}</div>
        <div class="small muted">Importée le ${date}</div>
      </div>
      <button class="btn btn--ghost btn--sm" data-view="${v.v}">Voir</button>
      ${isActive ? '<span class="pill pill--ok">Active</span>' : `<button class="btn btn--secondary btn--sm" data-activate="${v.v}">Activer</button>`}
    </div>`;
}

// ── Import ────────────────────────────────────────────────────────

function openImportSheet(root, slug, initialText) {
  const meta = getProjectMeta(slug);
  const nextV = Math.max(0, ...(meta.versions || []).map(v => v.v)) + 1;
  const sheet = openSheet({
    title: `Importer la version ${nextV}`,
    html: `
      <div class="form-group">
        <label class="form-label" for="imp-label">Libellé</label>
        <input class="input-field" id="imp-label" value="${esc(nextV === 1 ? 'Roadmap initiale' : `Révision du ${new Date().toLocaleDateString('fr-FR')}`)}">
      </div>
      <div class="form-group">
        <label class="form-label" for="imp-text">Roadmap (.md)</label>
        <textarea class="prompt-text" id="imp-text" placeholder="# ROADMAP_v${nextV} — …">${esc(initialText)}</textarea>
      </div>
      <div class="import-preview" id="imp-preview"></div>
      <div class="row-actions">
        <button class="btn btn--primary" id="imp-go" disabled>Importer et activer</button>
        <button class="btn btn--secondary" data-close>Annuler</button>
      </div>`,
  });
  sheet.el.classList.add('sheet--wide');

  const text = sheet.body.querySelector('#imp-text');
  const preview = sheet.body.querySelector('#imp-preview');
  const go = sheet.body.querySelector('#imp-go');

  const check = () => {
    const md = stripFence(text.value);
    if (!md.trim()) { preview.innerHTML = ''; go.disabled = true; return null; }
    if (!isRoadmapMarkdown(md)) {
      preview.innerHTML = '<span class="error">Format non reconnu : il faut au moins les sections <code>## META</code> et <code>## SEMAINES</code>.</span>';
      go.disabled = true;
      return null;
    }
    const plan = parseRoadmap(md);
    const items = plan.weeks.reduce((n, w) => n + w.items.length, 0);
    const undated = plan.weeks.filter(w => !w.start).length;
    const unknownBlocks = [...new Set(plan.weeks.flatMap(w => w.items.map(i => i.block)).filter(b => b && !plan.blocks.some(x => x.id === b)))];
    preview.innerHTML = `
      <span class="${items ? 'ok' : 'error'}">${plan.weeks.length} semaines · ${items} items · ${plan.blocks.length} blocs · ${plan.deliverables.length} livrables</span>
      ${undated ? `<span class="warn">${undated} semaine(s) sans date (ni date dans l'en-tête, ni <code>start</code> dans META)</span>` : ''}
      ${unknownBlocks.length ? `<span class="warn">Blocs non déclarés : ${esc(unknownBlocks.join(', '))}</span>` : ''}`;
    go.disabled = !items;
    return items ? md : null;
  };
  text.addEventListener('input', check);
  check();
  if (!initialText) text.focus();

  sheet.body.querySelector('[data-close]').addEventListener('click', sheet.close);
  go.addEventListener('click', async () => {
    const md = check();
    if (!md) return;
    go.disabled = true;
    go.textContent = 'Envoi vers GitHub…';
    try {
      const v = await importPlanVersion(slug, md, sheet.body.querySelector('#imp-label').value.trim());
      showToast(`Version ${v} importée et activée`, 'success');
      sheet.close();
      location.hash = `/project/${slug}/plan`;
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
      go.disabled = false;
      go.textContent = 'Importer et activer';
    }
  });
}

function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
