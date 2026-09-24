// Ligne d'item (accueil + plan + recherche) et panneau de détail d'un item.
// Deux ronds à droite, comme dans Pacing : ✓ fait (vert), ✕ sauté (orange).
// Aucun rond rempli = à faire. Recliquer sur un rond rempli l'annule.

import { getItemState, getItemStates, setItemStatus, setItemNote, moveItem, getActivePlan } from '../store.js';
import { projectWeeks, blockMap, isOverdue } from '../utils/progress.js';
import { formatRange } from '../utils/dates.js';
import { renderMarkdown } from '../utils/markdown.js';
import { ICONS, esc, openSheet, isTypingTarget } from '../utils/ui.js';
import { refreshSidebar } from '../app.js';

const pad = n => String(n).padStart(2, '0');

export function blockBadge(block, code) {
  if (!block && !code) return '';
  const color = block?.color || 'gray';
  return `<span class="badge badge--${color}" title="${esc(block?.name || '')}">${esc(code || block?.id || '')}</span>`;
}

export function statusRounds(status, { large = false } = {}) {
  const size = large ? ' round--lg' : '';
  return `
    <button class="round round--done${size} ${status === 'done' ? 'is-on' : ''}" data-set-status="done"
            title="${status === 'done' ? 'Fait — cliquer pour annuler' : 'Marquer comme fait'}" aria-pressed="${status === 'done'}">${ICONS.check}</button>
    <button class="round round--skip${size} ${status === 'skipped' ? 'is-on' : ''}" data-set-status="skipped"
            title="${status === 'skipped' ? 'Sauté — cliquer pour annuler' : 'Marquer comme sauté'}" aria-pressed="${status === 'skipped'}">${ICONS.cross}</button>`;
}

// week : semaine effective où l'item est affiché (sert à signaler un item en retard)
export function renderItemRow(slug, item, { blocks, week = null, showWeek = false, showProduction = true } = {}) {
  const st = getItemState(slug, item.id);
  const status = st.status || 'todo';
  const block = blocks?.[item.block];
  const late = week && isOverdue(week, st);
  return `
    <div class="item-row item-row--${status}" data-slug="${slug}" data-item="${esc(item.id)}" tabindex="0">
      <div class="item-row__body">
        <div class="item-row__top">
          ${blockBadge(block, item.code)}
          <span class="item-row__title">${esc(item.title)}</span>
        </div>
        ${showProduction && item.production ? `<div class="item-row__sub">→ ${esc(item.production)}</div>` : ''}
        <div class="item-row__flags">
          ${showWeek && week ? `<span>Semaine ${week.number}</span>` : ''}
          ${late ? '<span class="flag flag--late">en retard</span>' : ''}
          ${item.movedFrom != null ? `<span class="flag flag--moved">reporté de la semaine ${item.movedFrom}</span>` : ''}
          ${st.note ? `<span class="flag flag--note">${ICONS.note} note</span>` : ''}
        </div>
      </div>
      <div class="item-row__actions">${statusRounds(status)}</div>
    </div>`;
}

function toggleStatus(slug, id, status) {
  const cur = getItemState(slug, id).status;
  setItemStatus(slug, id, cur === status ? null : status);
  refreshSidebar();
}

// Délégation : ronds = statut ; clic ailleurs sur la ligne = détail.
// Clavier sur une ligne : Entrée = détail, Espace = fait, X = sauté.
export function bindItemRows(root, onChange) {
  root.addEventListener('click', e => {
    const row = e.target.closest('.item-row');
    if (!row || !root.contains(row)) return;
    const { slug, item } = row.dataset;
    const btn = e.target.closest('[data-set-status]');
    if (btn) {
      toggleStatus(slug, item, btn.dataset.setStatus);
      onChange?.(item);
      return;
    }
    openItemSheet(slug, item, onChange);
  });
  root.addEventListener('keydown', e => {
    const row = e.target.closest?.('.item-row');
    if (!row || e.target !== row) return;
    const { slug, item } = row.dataset;
    if (e.key === 'Enter') { e.preventDefault(); openItemSheet(slug, item, onChange); }
    else if (e.key === ' ') { e.preventDefault(); toggleStatus(slug, item, 'done'); onChange?.(item); }
    else if (e.key === 'x' || e.key === 'X') { e.preventDefault(); toggleStatus(slug, item, 'skipped'); onChange?.(item); }
  });
}

// Après un re-rendu, redonne le focus à la ligne manipulée au clavier.
export function refocusItem(root, itemId) {
  if (!itemId) return;
  root.querySelector(`.item-row[data-item="${CSS.escape(itemId)}"]`)?.focus({ preventScroll: true });
}

// ── Détail d'un item ──────────────────────────────────────────────

export function openItemSheet(slug, itemId, onChange) {
  let currentId = itemId;
  const onKey = e => {
    if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  };
  const sheet = openSheet({
    title: '',
    onClose: () => { document.removeEventListener('keydown', onKey); onChange?.(currentId); },
  });
  document.addEventListener('keydown', onKey);
  let order = [];
  render();

  function go(step) {
    const idx = order.findIndex(o => o.item.id === currentId);
    const next = order[idx + step];
    if (!next) return;
    currentId = next.item.id;
    render();
    sheet.body.scrollTop = 0;
  }

  function render() {
    const weeks = projectWeeks(slug);
    order = weeks.flatMap(w => w.items.map(i => ({ item: i, week: w })));
    const idx = order.findIndex(o => o.item.id === currentId);
    if (idx < 0) { sheet.close(); return; }
    const { item, week } = order[idx];
    const blocks = blockMap(getActivePlan(slug));
    const block = blocks[item.block];
    const st = getItemStates(slug)[item.id] || {};
    const status = st.status || 'todo';
    const planned = weeks.find(w => w.number === item.weekNum);
    const statusText = { todo: 'À faire', done: 'Fait', skipped: 'Sauté' }[status];

    sheet.el.querySelector('.sheet__title').textContent = `${item.id} · ${idx + 1} / ${order.length}`;
    sheet.body.innerHTML = `
      <div class="item-detail">
        <div class="item-detail__chips">
          ${blockBadge(block, item.code)}
          ${block ? `<span class="muted">${esc(block.name)}</span>` : ''}
        </div>
        <h2 class="item-detail__title">${esc(item.title)}</h2>
        <div class="muted small">Semaine ${week.number}${week.start ? ` · ${formatRange(week.start, week.end, true)}` : ''}${isOverdue(week, st) ? ' · <span class="flag flag--late">en retard</span>' : ''}</div>

        <div class="status-bar">
          <div class="status-bar__rounds">${statusRounds(status, { large: true })}</div>
          <div class="status-bar__text">
            <strong class="status-bar__label status-bar__label--${status}">${statusText}</strong>
            <span class="muted small">${status === 'todo' ? '✓ fait · ✕ sauté' : 'Recliquer sur le rond pour annuler'}</span>
          </div>
        </div>

        ${item.content ? `<section class="item-detail__section"><h3>Contenu</h3><div class="markdown-body">${renderMarkdown(item.content)}</div></section>` : ''}
        ${item.production ? `<section class="item-detail__section item-detail__production"><h3>Production attendue</h3><div class="markdown-body">${renderMarkdown(item.production)}</div></section>` : ''}
        ${item.extras.map(x => `<section class="item-detail__section"><h3>${esc(x.label)}</h3><div class="markdown-body">${renderMarkdown(x.value)}</div></section>`).join('')}

        <section class="item-detail__section">
          <h3>Note</h3>
          <textarea class="textarea-field" id="item-note" rows="3" placeholder="Ce qui a différé du prévu, une difficulté, une idée… (reprise dans le prompt de révision)">${esc(st.note || '')}</textarea>
        </section>

        <section class="item-detail__section">
          <h3>Reporter</h3>
          <div class="move-row">
            <select class="input-field" id="item-week" aria-label="Semaine de réalisation">
              ${weeks.map(w => `<option value="${w.number}" ${w.number === week.number ? 'selected' : ''}>
                Semaine ${w.number}${w.start ? ` · ${formatRange(w.start, w.end)}` : ''}${w.number === item.weekNum ? ' (prévue)' : ''}
              </option>`).join('')}
            </select>
            ${item.movedFrom != null ? `<button class="btn btn--secondary btn--sm" id="item-unmove">Remettre en semaine ${item.weekNum}</button>` : ''}
          </div>
          <div class="form-hint">${item.movedFrom != null
            ? `Prévu en semaine ${item.weekNum}${planned?.start ? ` (${formatRange(planned.start, planned.end)})` : ''}, reporté.`
            : 'Choisis une autre semaine pour déplacer cet item.'}</div>
        </section>

        <div class="item-detail__nav">
          <button class="btn btn--secondary btn--sm" data-go="-1" ${idx === 0 ? 'disabled' : ''}>${ICONS.chevronL} Précédent</button>
          <span class="muted small kbd-hint">← → pour naviguer</span>
          <button class="btn btn--secondary btn--sm" data-go="1" ${idx === order.length - 1 ? 'disabled' : ''}>Suivant ${ICONS.chevronR}</button>
        </div>
      </div>`;

    sheet.body.querySelectorAll('[data-set-status]').forEach(btn => btn.addEventListener('click', () => {
      toggleStatus(slug, item.id, btn.dataset.setStatus);
      render();
    }));

    const note = sheet.body.querySelector('#item-note');
    // Enregistrée à chaque frappe : la synchro GitHub est de toute façon regroupée par le store.
    note.addEventListener('input', () => setItemNote(slug, item.id, note.value.trim()));

    sheet.body.querySelector('#item-week').addEventListener('change', e => {
      const n = parseInt(e.target.value, 10);
      moveItem(slug, item.id, n === item.weekNum ? null : n);
      refreshSidebar();
      render();
    });
    sheet.body.querySelector('#item-unmove')?.addEventListener('click', () => {
      moveItem(slug, item.id, null);
      refreshSidebar();
      render();
    });

    sheet.body.querySelectorAll('[data-go]').forEach(btn =>
      btn.addEventListener('click', () => go(parseInt(btn.dataset.go, 10))));
  }
}
