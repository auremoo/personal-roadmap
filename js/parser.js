// Parse une roadmap au format template (voir docs/ROADMAP_FORMAT.md) → objet structuré.

import { addDays } from './utils/dates.js';

export const BLOCK_COLORS = ['gray', 'blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'teal'];

// Sections du plan qui ne sont pas du markdown libre.
const STRUCTURED = new Set(['META', 'BLOCS', 'LIVRABLES', 'SEMAINES']);

// Libellés des sections libres connues ; toute autre section en majuscules
// est affichée telle quelle dans l'onglet Infos.
export const INFO_LABELS = {
  CADRE:      'Cadre',
  A_VERIFIER: 'À vérifier',
  SOURCES:    'Sources',
  NOTES:      'Notes',
};

export function parseRoadmap(markdown) {
  const md = markdown.replace(/\r\n/g, '\n');
  const sections = splitSections(md);
  const meta = parseMeta(sections['META'] || '');

  const blocks       = parseBlocks(sections['BLOCS'] || '');
  const deliverables = parseDeliverables(sections['LIVRABLES'] || '');
  const weeks        = parseWeeks(sections['SEMAINES'] || '', meta.start);

  const info = Object.entries(sections)
    .filter(([key, body]) => !STRUCTURED.has(key) && body.trim())
    .map(([key, body]) => ({ key, label: INFO_LABELS[key] || prettify(key), body: body.trim() }));

  return { meta, blocks, deliverables, weeks, info };
}

export function isRoadmapMarkdown(text) {
  return /^## META\s*$/m.test(text) && /^## SEMAINES\s*$/m.test(text);
}

// ── Split by ## headings ──────────────────────────────────────────

function splitSections(md) {
  const result = {};
  const re = /^## ([A-Z_ÉÈÀÙÂÊÎÔ &]+)\s*$/gm;
  let last = { key: null, idx: 0 };
  let m;
  while ((m = re.exec(md)) !== null) {
    if (last.key) result[last.key] = md.slice(last.idx, m.index);
    last = { key: m[1].trim().replace(/ /g, '_'), idx: m.index + m[0].length };
  }
  if (last.key) result[last.key] = md.slice(last.idx);
  return result;
}

function prettify(key) {
  const s = key.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── META ─────────────────────────────────────────────────────────

function parseMeta(content) {
  const meta = {};
  for (const line of content.trim().split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return meta;
}

// ── BLOCS ────────────────────────────────────────────────────────
// | ID | Nom | Couleur |

function parseBlocks(content) {
  const blocks = [];
  let pastSep = false;
  for (const line of content.trim().split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    if (/^\s*\|[-| :]+\|\s*$/.test(line)) { pastSep = true; continue; }
    if (!pastSep) continue;
    const cells = tableCells(line);
    if (cells.length < 2 || !cells[0]) continue;
    const color = (cells[2] || '').toLowerCase();
    blocks.push({
      id: cells[0],
      name: cells[1],
      color: BLOCK_COLORS.includes(color) ? color : BLOCK_COLORS[(blocks.length + 1) % BLOCK_COLORS.length],
    });
  }
  return blocks;
}

function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

// ── LIVRABLES ────────────────────────────────────────────────────
// - L1 | Titre | Échéance | Précision

function parseDeliverables(content) {
  const out = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^[-*]\s+(?:\[[ xX]\]\s*)?(.+)$/);
    if (!m) continue;
    const cells = m[1].split('|').map(c => stripBold(c.trim()));
    if (cells.length >= 2) {
      out.push({ id: cells[0], title: cells[1], due: cells[2] || '', note: cells.slice(3).join(' | ') });
    } else {
      out.push({ id: `L${out.length + 1}`, title: cells[0], due: '', note: '' });
    }
  }
  return out;
}

// ── SEMAINES ─────────────────────────────────────────────────────
// ### W01 | 2026-09-28 | Note
// - S1 | GP | GP1 | Titre
//   - Contenu : …
//   - Production : …

const FIELD_KEYS = { contenu: 'content', production: 'production' };

function parseWeeks(content, planStart) {
  const weeks = [];
  const seenIds = new Set();
  const parts = content.split(/^### /m).slice(1);

  for (const part of parts) {
    const lines = part.split('\n');
    const hParts = lines[0].split('|').map(p => p.trim());
    const numMatch = hParts[0].match(/(\d+)/);
    if (!numMatch) continue;
    const number = parseInt(numMatch[1], 10);

    let start = null;
    let noteParts = hParts.slice(1);
    if (noteParts.length && /^\d{4}-\d{2}-\d{2}$/.test(noteParts[0])) {
      start = noteParts[0];
      noteParts = noteParts.slice(1);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(planStart || '')) {
      start = addDays(planStart, (number - 1) * 7);
    }

    const items = parseItems(lines.slice(1), number, seenIds);
    weeks.push({
      number,
      start,
      end: start ? addDays(start, 6) : null,
      note: noteParts.join(' | '),
      items,
    });
  }

  weeks.sort((a, b) => a.number - b.number);
  return weeks;
}

function parseItems(lines, weekNum, seenIds) {
  const items = [];
  let current = null;
  let lastField = null;

  for (const raw of lines) {
    if (!raw.trim()) continue;

    const top = raw.match(/^[-*]\s+(?:\[[ xX]\]\s*)?(.+)$/);
    if (top) {
      current = buildItem(top[1], weekNum, items.length, seenIds);
      items.push(current);
      lastField = null;
      continue;
    }
    if (!current) continue;

    const field = raw.match(/^\s+[-*]\s+(?:\*\*)?([^:*]{1,40}?)(?:\*\*)?\s*:\s*(.*)$/);
    if (field) {
      const label = field[1].trim();
      const key = FIELD_KEYS[normalize(label)];
      if (key) {
        current[key] = field[2].trim();
        lastField = { key };
      } else {
        const extra = { label, value: field[2].trim() };
        current.extras.push(extra);
        lastField = { extra };
      }
      continue;
    }

    // Ligne de continuation (indentée) : rattachée au dernier champ
    const text = raw.trim().replace(/^[-*]\s+/, '');
    if (lastField?.key) current[lastField.key] += '\n' + text;
    else if (lastField?.extra) lastField.extra.value += '\n' + text;
    else current.content = current.content ? current.content + '\n' + text : text;
  }
  return items;
}

function buildItem(header, weekNum, indexInWeek, seenIds) {
  const cells = header.split('|').map(c => stripBold(c.trim()));
  let id, block = '', code = '', title;

  if (cells.length >= 4) {
    [id, block, code] = cells;
    title = cells.slice(3).join(' | ');
  } else if (cells.length === 3) {
    [id, block, title] = cells;
  } else if (cells.length === 2) {
    [id, title] = cells;
  } else {
    title = cells[0];
  }

  id = (id || '').replace(/[^\w-]/g, '');
  if (!id) id = `w${String(weekNum).padStart(2, '0')}-${indexInWeek + 1}`;
  let unique = id;
  for (let n = 2; seenIds.has(unique); n++) unique = `${id}-${n}`;
  seenIds.add(unique);

  return { id: unique, weekNum, block, code, title, content: '', production: '', extras: [] };
}

function stripBold(s) {
  return s.replace(/^\*\*(.*)\*\*$/, '$1');
}

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
