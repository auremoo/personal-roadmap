// Petits helpers d'interface partagés : échappement, modale de prompt, panneau latéral.

import { showToast } from '../toast.js';

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function isTypingTarget(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

// Panneau : feuille du bas sur mobile, tiroir à droite sur ordinateur.
// Retourne { el, body, close }. Fermeture par la croix, le fond ou Échap.
export function openSheet({ title, html = '', onClose } = {}) {
  const root = document.createElement('div');
  root.className = 'sheet';
  root.innerHTML = `
    <div class="sheet__overlay"></div>
    <div class="sheet__panel" role="dialog" aria-modal="true">
      <div class="sheet__header">
        <span class="sheet__title">${esc(title)}</span>
        <button class="icon-btn sheet__close" aria-label="Fermer">✕</button>
      </div>
      <div class="sheet__body">${html}</div>
    </div>`;
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add('sheet--open'));

  const onKey = e => { if (e.key === 'Escape') close(); };
  function close() {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', close);
    root.classList.remove('sheet--open');
    setTimeout(() => root.remove(), 200);
    onClose?.();
  }
  document.addEventListener('keydown', onKey);
  // Changer de page ferme le panneau (sinon il resterait par-dessus la nouvelle vue)
  window.addEventListener('hashchange', close);
  root.querySelector('.sheet__overlay').addEventListener('click', close);
  root.querySelector('.sheet__close').addEventListener('click', close);
  return { el: root, body: root.querySelector('.sheet__body'), close };
}

export function openPromptModal(title, prompt, hint = 'Copie ce texte, envoie-le à ton IA (Claude, ChatGPT…) puis importe le .md obtenu dans l\'onglet Versions.') {
  const sheet = openSheet({
    title,
    html: `
      <p class="hint">${esc(hint)}</p>
      <textarea class="prompt-text" readonly>${esc(prompt)}</textarea>
      <div class="row-actions">
        <button class="btn btn--primary" data-copy>Copier le prompt</button>
        <button class="btn btn--secondary" data-close>Fermer</button>
      </div>`,
  });
  sheet.el.classList.add('sheet--wide');
  sheet.body.querySelector('[data-close]').addEventListener('click', sheet.close);
  sheet.body.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      sheet.body.querySelector('textarea').select();
      document.execCommand('copy');
    }
    showToast('Prompt copié !', 'success');
  });
}

export function progressBar(pct, extraClass = '') {
  return `<div class="bar ${extraClass}"><div class="bar__fill" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;
}

export const ICONS = {
  home:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></svg>',
  projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 7h10l-2 3 2 3H4"/><path d="M14 17h6"/><path d="M17 14v6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  plus:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
  back:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  plan:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  versions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="9" r="2.5"/><path d="M6 8.5v7M18 11.5c0 3-4 3.5-10 5"/></svg>',
  infos:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  check:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg>',
  cross:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  note:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H8l-4 4z"/></svg>',
  search:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  chevronL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chevronR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
};
