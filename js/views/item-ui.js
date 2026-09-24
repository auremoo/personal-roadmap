// Ligne d'item (accueil + plan) et panneau de détail d'un item.

import { getItemState, getItemStates, setItemStatus, setItemNote, moveItem, getActivePlan } from '../store.js';
import { projectWeeks, blockMap } from '../utils/progress.js';
import { formatRange } from '../utils/dates.js';
import { renderMarkdown } from '../utils/markdown.js';
import { ICONS, esc, openSheet } from '../utils/ui.js';
import { refreshSidebar } from '../app.js';

const pad = n => String(n).padStart(2, '0');

export function blockBadge(block, code) {
  if (!block && !code) return '';
  const color = block?.color || 'gray';
  return `<span class="badge badge--${color}" title="${esc(block?.name || '')}">${esc(code || block?.id || '')}</span>`;
}

export function renderItemRow(slug, item, { blocks, showWeek = false, showProduction = true } = {}) {
  const st = getItemState(slug, item.id);
  const status = st.status || 'todo';
  const block = blocks?.[item.block];
  return `
    <div class="item-row item-row--${status}" data-slug="${slug}" data-item="${esc(item.id)}" tabindex="0">
      <button class="check ${status === 'done' ? 'check--on' : ''}" data-toggle aria-label="Marquer comme fait">${ICONS.check}</button>
      <div class="item-row__body">
        <div class="item-row__top">
          ${blockBadge(block, item.code)}
          <span class="item-row__title">${esc(item.title)}</span>
        </div>
        ${showProduction && item.production ? `<div class="item-row__sub">→ ${esc(item.production)}</div>` : ''}
        <div class="item-row__flags">
          ${showWeek ? `<span>W${pad(item.weekNum)}</span>` : ''}
          ${item.movedFrom != null ? `<span class="flag flag--moved">déplacé de W${pad(item.movedFrom)}</span>` : ''}
          ${status === 'skipped' ? '<span class="flag flag--skipped">sauté</span>' : ''}
          ${st.note ? `<span class="flag flag--note">${ICONS.note} note</span>` : ''}
        </div>
      </div>
      <span class="item-row__chevron">${ICONS.chevronR}</span>
    </div>`;
}

// Délégation : case = fait / pas fait ; clic ailleurs sur la ligne = détail.
export function bindItemRows(root, onChange) {
  root.addEventListener('click', e => {
    const row = e.target.closest('.item-row');
    if (!row || !root.contains(row)) return;
    const { slug, item } = row.dataset;
    if (e.target.closest('[data-toggle]')) {
      const cur = getItemState(slug, item).status;
      setItemStatus(slug, item, cur === 'done' ? null : 'done');
      refreshSidebar();
      onChange?.();
      return;
    }
    openItemSheet(slug, item, onChange);
  });
  root.addEventListener('keydown', e => {
    const row = e.target.closest?.('.item-row');
    if (!row) return;
    if (e.key === 'Enter') { e.preventDefault(); openItemSheet(row.dataset.slug, row.dataset.item, onChange); }
    if (e.key === ' ')     { e.preventDefault(); row.querySelector('[data-toggle]').click(); }
  });
}

// ── Détail d'un item ──────────────────────────────────────────────

export function openItemSheet(slug, itemId, onChange) {
  const sheet = openSheet({ title: 'Item', onClose: () => onChange?.() });
  let currentId = itemId;
  render();

  function render() {
    const weeks = projectWeeks(slug);
    const order = weeks.flatMap(w => w.items.map(i => ({ item: i, week: w })));
    const idx = order.findIndex(o => o.item.id === currentId);
    if (idx < 0) { sheet.close(); return; }
    const { item, week } = order[idx];
    const plan = getActivePlan(slug);
    const blocks = blockMap(plan);
    const block = blocks[item.block];
    const st = getItemStates(slug)[item.id] || {};
    const status = st.status || 'todo';

    sheet.el.querySelector('.sheet__title').textContent = `${item.id} · Semaine ${week.number}`;
    sheet.body.innerHTML = `
      <div class="item-detail">
        <div class="item-detail__chips">
          ${blockBadge(block, item.code)}
          ${block ? `<span class="muted">${esc(block.name)}</span>` : ''}
          ${week.start ? `<span class="muted">· ${formatRange(week.start, week.end, true)}</span>` : ''}
        </div>
        <h2 class="item-detail__title">${esc(item.title)}</h2>

        <div class="segmented" role="group" aria-label="Statut">
          <button class="segmented__btn ${status === 'todo' ? 'is-on' : ''}" data-status="">À faire</button>
          <button class="segmented__btn segmented__btn--done ${status === 'done' ? 'is-on' : ''}" data-status="done">Fait</button>
          <button class="segmented__btn segmented__btn--skipped ${status === 'skipped' ? 'is-on' : ''}" data-status="skipped">Sauté</button>
        </div>

        ${item.content ? `<section class="item-detail__section"><h3>Contenu</h3><div class="markdown-body">${renderMarkdown(item.content)}</div></section>` : ''}
        ${item.production ? `<section class="item-detail__section item-detail__production"><h3>Production</h3><div class="markdown-body">${renderMarkdown(item.production)}</div></section>` : ''}
        ${item.extras.map(x => `<section class="item-detail__section"><h3>${esc(x.label)}</h3><div class="markdown-body">${renderMarkdown(x.value)}</div></section>`).join('')}

        <section class="item-detail__section">
          <h3>Note</h3>
          <textarea class="textarea-field" id="item-note" rows="3" placeholder="Écart par rapport au prévu, difficulté, idée…">${esc(st.note || '')}</textarea>
        </section>

        <section class="item-detail__section">
          <h3>Semaine</h3>
          <select class="input-field" id="item-week">
            ${weeks.map(w => `<option value="${w.number}" ${w.number === week.number ? 'selected' : ''}>
              W${pad(w.number)}${w.start ? ` · ${formatRange(w.start, w.end)}` : ''}${w.number === item.weekNum ? ' (prévue)' : ''}
            </option>`).join('')}
          </select>
        </section>

        <div class="item-detail__nav">
          <button class="btn btn--secondary btn--sm" data-go="-1" ${idx === 0 ? 'disabled' : ''}>${ICONS.chevronL} Précédent</button>
          <button class="btn btn--secondary btn--sm" data-go="1" ${idx === order.length - 1 ? 'disabled' : ''}>Suivant ${ICONS.chevronR}</button>
        </div>
      </div>`;

    sheet.body.querySelectorAll('[data-status]').forEach(btn => btn.addEventListener('click', () => {
      setItemStatus(slug, item.id, btn.dataset.status || null);
      refreshSidebar();
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

    sheet.body.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => {
      currentId = order[idx + parseInt(btn.dataset.go, 10)]?.item.id ?? currentId;
      render();
    }));
  }
}
