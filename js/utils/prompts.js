// Prompts IA : roadmap initiale et révision. Pré-remplis avec le profil (Réglages)
// et les données du projet ; la réponse de l'IA est un .md importable (onglet Versions).

import { getProfile, getProjectMeta, getActivePlan, getActivePlanRaw, getItemStates, getMoves, getDeliverableStates } from '../store.js';
import { effectiveWeeks, currentWeek, countStatus, paceOf } from './progress.js';
import { today } from './dates.js';

const pad = n => String(n).padStart(2, '0');

function profileSection(p = {}) {
  const v = (x, fallback = 'Non renseigné') => (x && String(x).trim()) || fallback;
  return `## Profil

- Situation actuelle : ${v(p.situation)}
- Compétences et acquis : ${v(p.skills)}
- Disponibilités : ${v(p.availability)}
- Outils et environnement : ${v(p.tools)}
- Façon d'apprendre / de travailler : ${v(p.learning)}
- Contraintes : ${v(p.constraints, 'Aucune')}
- Objectifs de fond : ${v(p.goals, 'Aucun')}`;
}

function projectSection(meta) {
  const v = (x, fallback = '[à compléter]') => (x && String(x).trim()) || fallback;
  return `## Projet

- Nom : ${meta.name}
- Objectif : ${v(meta.objective)}
- Contexte : ${v(meta.context)}
- Date de début : ${v(meta.startDate, '[à compléter — toujours un lundi]')}
- Date de fin : ${v(meta.endDate)}
- Nombre de semaines : ${v(meta.weeks)}
- Rythme : ${v(meta.rhythm)}
- Contraintes propres au projet : ${v(meta.constraints, 'Aucune')}`;
}

export function formatTemplate(meta, version, { start, weeks } = {}) {
  return `# ROADMAP_v${version} — ${meta.name}

## META
project: ${meta.name}
slug: ${meta.slug}
objective: ${meta.objective || '[objectif en une phrase]'}
start: ${start || meta.startDate || '[YYYY-MM-DD — toujours un lundi]'}
end: ${meta.endDate || '[YYYY-MM-DD]'}
weeks: ${weeks || meta.weeks || '[nombre]'}
rhythm: ${meta.rhythm || '[ex : 5 séances de 1 h 30 par semaine]'}
version: ${version}
generated: ${today()}

## BLOCS
| ID | Nom | Couleur |
|---|---|---|
| {ID court, ex : GP} | {Nom du bloc thématique} | {couleur} |

Couleurs disponibles : gray, blue, indigo, purple, pink, red, orange, yellow, green, teal

## LIVRABLES
- {L1} | {Livrable} | {échéance : ID de l'item qui le produit, ex : S7} | {précision facultative}

## SEMAINES

### W{NN} | {YYYY-MM-DD du lundi} | {note courte sur la semaine}
- {ID item, ex : S1} | {ID du bloc} | {code court, ex : GP1} | {Titre de l'item}
  - Contenu : {ce qu'on voit / ce qu'on fait pendant la séance}
  - Production : {ce qui existe concrètement à la fin de la séance}

{Répéter pour toutes les semaines}

## CADRE
[règles du jeu : rythme, priorités en cas de retard, blocs sacrifiables, conventions]

## A_VERIFIER
[points ouverts, hypothèses à confirmer, questions en attente de réponse]

## SOURCES
[sources vérifiées, avec liens]`;
}

const FORMAT_RULES = `**Règles du format :**
- Une section \`### W{NN}\` par semaine, datée du lundi (calcule les dates à partir de \`start\`).
- Chaque item tient sur une ligne \`- ID | BLOC | CODE | Titre\` suivie de ses sous-lignes \`  - Contenu :\` et \`  - Production :\` (indentées de deux espaces). N'ajoute pas de description séparée : le titre est court, le détail va dans Contenu.
- Les IDs d'items sont uniques dans tout le plan (S1, S2, S3… dans l'ordre chronologique) et ne contiennent que lettres, chiffres et tirets.
- Le BLOC d'un item est l'un des IDs déclarés dans \`## BLOCS\`.
- Les créneaux tampon ou de rattrapage sont des items comme les autres (bloc dédié).
- N'utilise pas de tableau pour les items, pas de caractère « | » dans les titres.
- Pas d'introduction ni de conclusion hors du format : ta réponse commence directement par \`# ROADMAP_v…\`.`;

// ── Prompt de roadmap initiale ────────────────────────────────────

export function buildInitialPrompt(slug) {
  const meta = getProjectMeta(slug);
  const draft = (meta.draft || '').trim();

  return `Tu es un expert en planification de projets personnels et en apprentissage structuré. Construis une roadmap semaine par semaine, réaliste et progressive, pour le projet ci-dessous.

${profileSection(getProfile())}

${projectSection(meta)}
${draft ? `
## Matière existante

Voici un brouillon ou des notes déjà rédigés. Reprends-en le contenu et la logique (ne perds aucune information utile), mais remets-le au format ci-dessous : chaque item a un titre court + Contenu + Production.

\`\`\`
${draft}
\`\`\`
` : ''}
---

## FORMAT DE SORTIE OBLIGATOIRE

Génère la roadmap en suivant **EXACTEMENT** ce format, pour qu'elle soit importable dans mon application de suivi :

\`\`\`
${formatTemplate(meta, 1)}
\`\`\`

${FORMAT_RULES}
- Respecte le rythme indiqué (nombre d'items par semaine) et prévois des semaines tampon si la période contient des congés.
`;
}

// ── Prompt de révision ────────────────────────────────────────────

export function buildRevisionPrompt(slug) {
  const meta     = getProjectMeta(slug);
  const plan     = getActivePlan(slug);
  const raw      = getActivePlanRaw(slug);
  const states   = getItemStates(slug);
  const moves    = getMoves(slug);
  const delivSt  = getDeliverableStates(slug);
  const todayStr = today();
  const next     = Math.max(...(meta.versions || []).map(v => v.v), 0) + 1;

  const weeks = effectiveWeeks(plan, moves);
  const all   = weeks.flatMap(w => w.items);
  const c     = countStatus(all, states);
  const pace  = paceOf(weeks, states, todayStr);
  const cur   = currentWeek(weeks, todayStr);
  const remaining = weeks.filter(w => w.number >= cur.number).length;
  const nextMonday = (weeks.find(w => w.number === cur.number) || {}).start;

  const blockLines = plan.blocks.map(b => {
    const bc = countStatus(all.filter(i => i.block === b.id), states);
    return `- ${b.id} (${b.name}) : ${bc.done}/${bc.total} faits${bc.skipped ? `, ${bc.skipped} sautés` : ''}`;
  }).join('\n');

  const statusOf = (item, w) => {
    const st = states[item.id];
    if (st?.status === 'done')    return '✓ Fait';
    if (st?.status === 'skipped') return '✗ Sauté';
    return w.end && w.end < todayStr ? '— Non coché' : '· À venir';
  };

  const weekDetail = weeks.map(w => {
    const wc = countStatus(w.items, states);
    const tag = w.number === cur.number && cur.phase === 'during' ? ' ← EN COURS'
      : (w.end && w.end < todayStr ? '' : ' (à venir)');
    const rows = w.items.map(i => {
      const st = states[i.id];
      const note  = st?.note ? ` [Note : ${st.note.replace(/\n/g, ' ')}]` : '';
      const moved = i.movedFrom != null ? ` [déplacé depuis W${pad(i.movedFrom)}]` : '';
      return `- ${i.id} | ${i.block} | ${i.title} — ${statusOf(i, w)}${note}${moved}`;
    }).join('\n');
    return `### W${pad(w.number)} (${w.start || '?'}) — ${wc.done}/${wc.total} faits${wc.skipped ? `, ${wc.skipped} sautés` : ''}${tag}\n${rows}`;
  }).join('\n\n');

  const delivLines = plan.deliverables.map(d =>
    `- ${d.id} | ${d.title} | échéance ${d.due || '?'} — ${delivSt[d.id]?.done ? '✓ livré' : 'non livré'}`
  ).join('\n');

  return `Tu es un expert en planification de projets personnels et en apprentissage structuré. Je te transmets ma roadmap en cours avec le bilan réel de l'avancement.

**Ta mission :** générer une version révisée v${next} qui :
1. Tient compte de ce qui a été réellement fait, sauté ou déplacé
2. Réorganise les ${remaining} semaines restantes (semaine en cours comprise) de façon réaliste
3. Applique les priorités du CADRE si le retard impose de couper
4. Conserve les semaines passées telles quelles (mêmes IDs, même contenu) pour garder l'historique

**Lecture du réalisé :** item coché sans note = fait comme prévu ; item coché avec note = la note décrit l'écart ; item sauté = non fait, volontairement ; item non coché dans une semaine passée = statut inconnu.

${profileSection(getProfile())}

${projectSection(meta)}

---

## Bilan au ${todayStr}

- Semaine ${cur.number ?? '?'} / ${weeks.length}${cur.phase === 'before' ? ' (pas encore commencé)' : cur.phase === 'after' ? ' (période terminée)' : ''}
- Items faits : **${c.done} / ${c.total} (${c.pct} %)**${c.skipped ? ` · sautés : **${c.skipped}**` : ''}
- Rythme : **${pace.label}** (items traités vs attendus à date)

### Par bloc
${blockLines || '- (aucun bloc déclaré)'}

### Livrables
${delivLines || '- (aucun livrable déclaré)'}

## Détail semaine par semaine

${weekDetail}

---

## Roadmap actuelle — v${meta.activeVersion}

\`\`\`
${raw}
\`\`\`

---

## FORMAT DE SORTIE OBLIGATOIRE

\`\`\`
${formatTemplate(meta, next, { start: plan.meta.start || meta.startDate, weeks: plan.meta.weeks || meta.weeks })}
\`\`\`

${FORMAT_RULES}
- **Conserve l'ID des items existants** (faits, sautés ou replanifiés) ; un item nouveau reçoit un ID jamais utilisé. Ne réattribue jamais l'ID d'un item fait à un autre contenu.
- La semaine en cours commence le ${nextMonday || '[lundi de la semaine en cours]'}.
`;
}
