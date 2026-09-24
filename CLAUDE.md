# Personal Roadmap — CLAUDE.md

PWA de roadmaps de projets personnels (suivi hebdomadaire, prompts IA, versions). Mono-utilisateur, mot de passe `171225`, données dans ce dépôt via l'API GitHub. Inspirée de `auremoo/pacing-app` (même stack, même écran de connexion, même chiffrement du PAT), mais conçue pour ordinateur **et** téléphone.

## Stack

Vanilla JS (ES modules, pas de build), CSS pur (variables, style iOS), API GitHub (PAT fine-grained, Contents read+write), PWA, GitHub Pages sur `main` (workflow `.github/workflows/deploy.yml`).

## Fichiers

```
index.html / setup.html / config.json / manifest.webmanifest / service-worker.js
css/tokens.css        variables (couleurs des blocs --c-*, états --st-*, --sidebar-width, --page-max)
css/reset.css         reset + grille ordinateur (sidebar) à partir de 900 px
css/components.css    composants ; bloc @media (min-width: 900px) = mise en page ordinateur
js/app.js             routeur hash + boot + écouteur global [data-nav] + refreshSidebar()
js/store.js           état en mémoire + synchro GitHub (projects/, state.json, profile.json)
js/github-api.js      GET/PUT contents (commits « roadmap: … »)
js/parser.js          parseRoadmap(md) → { meta, blocks, deliverables, weeks, info }
js/views/
  lock.js             écran mot de passe (copie adaptée de Pacing)
  chrome.js           topbar() + globalTabBar()
  sidebar.js          sidebar ordinateur
  home.js             semaine en cours de chaque projet actif
  projects.js         liste des projets
  project.js          conteneur d'un projet (onglets plan/progress/versions/infos)
  plan-view.js        frise des semaines + semaine sélectionnée, recherche, filtre, raccourcis ← → /
  progress-view.js    KPI, histogramme hebdo, blocs, livrables
  versions-view.js    prompts, import (collage/fichier/glisser-déposer), historique
  infos-view.js       fiche projet + sections libres de la roadmap
  project-form.js     création / modification d'un projet
  settings.js         profil (profile.json) + déconnexion
  item-ui.js          ligne d'item + panneau de détail (statut, note, déplacement)
js/utils/
  progress.js         effectiveWeeks (applique les déplacements), currentWeek, countStatus, paceOf, projectSummary
  prompts.js          buildInitialPrompt / buildRevisionPrompt / formatTemplate
  ui.js               esc, openSheet (feuille mobile / tiroir ordinateur), openPromptModal, ICONS
  dates.js, markdown.js, crypto.js (repris de Pacing)
docs/ROADMAP_FORMAT.md  format du .md importable
```

## Données

- `projects/index.json` : `{ projects: [{ slug, name, startDate, endDate, status }] }`
- `projects/{slug}/meta.json` : `{ slug, name, objective, context, startDate, endDate, weeks, rhythm, constraints, draft, status, createdAt, activeVersion, versions: [{ v, file, importedAt, label }] }`
- `projects/{slug}/plans/v{N}.md` : roadmap au format `docs/ROADMAP_FORMAT.md`
- `state.json` : `{ version: 1, projects: { slug: { items: { id: { status: 'done'|'skipped'|null, doneAt, skippedAt, note, version } }, deliverables: { id: { done, doneAt } }, moves: { itemId: weekNum } } } }`
- `profile.json` : `situation, skills, availability, tools, learning, constraints, goals`

Aucun fichier n'est requis au démarrage : un dépôt vierge démarre sur un état vide, les fichiers sont créés au premier enregistrement.

## Conventions

- Les vues exportent `mount(container, …)` et écrivent `innerHTML` ; échapper tout texte utilisateur avec `esc()`.
- Écouteurs sur des éléments recréés à chaque rendu, jamais sur `#app` (sinon ils s'accumulent). Navigation : attribut `data-nav`, géré par un seul écouteur dans app.js.
- Après une modification d'avancement, appeler `refreshSidebar()`.
- Synchro `state.json` regroupée (600 ms), vidée immédiatement quand l'app passe en arrière-plan ; SHA relu avant chaque PUT.
- `version` est enregistrée à chaque changement de statut : deux versions peuvent réutiliser un même ID d'item.
- sessionStorage : `roadmap_auth`, `roadmap_pat` (distinctes de Pacing, même origine `auremoo.github.io`).
- Le sel PBKDF2 (`pacing-app-v1`) est volontairement identique à Pacing : un token chiffré est réutilisable d'une app à l'autre.
