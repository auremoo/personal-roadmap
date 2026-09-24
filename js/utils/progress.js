// Calculs d'avancement partagés par les vues (accueil, sidebar, plan, avancement, prompts).

import { getActivePlan, getItemStates, getMoves, getProjectMeta } from '../store.js';
import { today, daysBetween } from './dates.js';

// Semaines "effectives" : les items déplacés (state.moves) sont rangés dans leur semaine cible.
export function effectiveWeeks(plan, moves = {}) {
  if (!plan) return [];
  const byNum = new Map(plan.weeks.map(w => [w.number, { ...w, items: [] }]));
  for (const w of plan.weeks) {
    for (const item of w.items) {
      const target = moves[item.id];
      const dest = target != null && byNum.has(target) ? byNum.get(target) : byNum.get(w.number);
      dest.items.push(dest.number !== w.number ? { ...item, movedFrom: w.number } : item);
    }
  }
  return [...byNum.values()];
}

export function projectWeeks(slug) {
  return effectiveWeeks(getActivePlan(slug), getMoves(slug));
}

// Position d'aujourd'hui dans le plan.
// phase : 'before' (pas commencé), 'during', 'after' (toutes les semaines passées)
export function currentWeek(weeks, todayStr = today()) {
  const dated = weeks.filter(w => w.start);
  if (!dated.length) return { number: weeks[0]?.number ?? null, phase: 'during' };
  const hit = dated.find(w => w.start <= todayStr && todayStr <= w.end);
  if (hit) return { number: hit.number, phase: 'during' };
  if (todayStr < dated[0].start) return { number: dated[0].number, phase: 'before' };
  const next = dated.find(w => w.start > todayStr);
  if (next) return { number: next.number, phase: 'during' };
  return { number: dated[dated.length - 1].number, phase: 'after' };
}

export function countStatus(items, states) {
  let done = 0, skipped = 0;
  for (const it of items) {
    const st = states[it.id]?.status;
    if (st === 'done') done++;
    else if (st === 'skipped') skipped++;
  }
  const total = items.length;
  return { total, done, skipped, todo: total - done - skipped, pct: total ? Math.round(done / total * 100) : 0 };
}

// Nombre d'items qui "devraient" être traités aujourd'hui : semaines passées
// en entier + prorata de la semaine en cours.
export function expectedByNow(weeks, todayStr = today()) {
  let expected = 0;
  for (const w of weeks) {
    if (!w.start) continue;
    if (w.end < todayStr) expected += w.items.length;
    else if (w.start <= todayStr) expected += w.items.length * (daysBetween(w.start, todayStr) + 1) / 7;
  }
  return expected;
}

// Avance / retard en nombre d'items (fait + sauté = traité).
export function paceOf(weeks, states, todayStr = today()) {
  const all = weeks.flatMap(w => w.items);
  const c = countStatus(all, states);
  const delta = Math.round((c.done + c.skipped) - expectedByNow(weeks, todayStr));
  let label, tone;
  if (Math.abs(delta) < 1) { label = 'Dans les temps'; tone = 'ok'; }
  else if (delta > 0)      { label = `${delta} d'avance`; tone = 'ok'; }
  else                     { label = `${-delta} de retard`; tone = delta <= -3 ? 'bad' : 'warn'; }
  return { delta, label, tone };
}

export function projectSummary(slug) {
  const plan = getActivePlan(slug);
  if (!plan) return null;
  const weeks  = projectWeeks(slug);
  const states = getItemStates(slug);
  const all    = weeks.flatMap(w => w.items);
  const cur    = currentWeek(weeks);
  const week   = weeks.find(w => w.number === cur.number) || null;
  return {
    plan, weeks, states,
    counts: countStatus(all, states),
    current: cur,
    week,
    weekCounts: week ? countStatus(week.items, states) : null,
    pace: paceOf(weeks, states),
    weekIndex: week ? weeks.indexOf(week) + 1 : 0,
  };
}

export function blockMap(plan) {
  return Object.fromEntries((plan?.blocks || []).map(b => [b.id, b]));
}

export function isActiveProject(slug) {
  return (getProjectMeta(slug)?.status || 'active') === 'active';
}
