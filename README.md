# Personal Roadmap

> Créé par Aurélien Moote - Moo - 2026. Logiciel libre (licence MIT) :
> réutilisable à condition de conserver la mention de l'auteur.

PWA pour piloter des projets personnels avec une roadmap hebdomadaire : objectifs, items à cocher, avancement, prompts IA et versions successives.
Sœur de [Pacing App](https://github.com/auremoo/pacing-app) : même principe, mêmes accès, mais pensée autant pour l'ordinateur que pour le téléphone.
Fonctionne sans serveur : toutes les données sont stockées dans ce dépôt GitHub via l'API.

---

## Principe

1. **Créer un projet** : nom, objectif, contexte, période, rythme (ex. 5 séances de 1 h 30 par semaine). Un brouillon existant peut être collé dans « Matière existante ». Si tu as déjà une roadmap au bon format, « Tu as déjà une roadmap (.md) ? » pré-remplit le formulaire et l'importe directement comme v1 (étapes 2 et 3 inutiles).
2. **Générer le prompt initial** (onglet Versions) : il contient ton profil (Réglages), le projet, le brouillon et le format attendu. Tu l'envoies à ton IA.
3. **Importer la réponse** : colle le texte ou choisis le fichier .md. L'app vérifie le format et annonce ce qu'elle a lu (semaines, items, blocs, livrables).
4. **Avancer** : chaque item a deux ronds, comme dans Pacing : ✓ fait, ✕ sauté ; vides = à faire (recliquer annule). Le détail d'un item permet d'ajouter une note ou de le reporter à une autre semaine. Les items des semaines passées ni faits ni sautés apparaissent « à rattraper ».
5. **Réviser** : le prompt de révision embarque le bilan réel (faits, sautés, déplacés, notes, rythme, livrables) et la roadmap en cours. La réponse devient la version suivante ; les anciennes restent consultables et réactivables.

## Écrans

| Écran | Contenu |
|---|---|
| Accueil | La semaine en cours de chaque projet actif, cochable sur place, et le nombre d'items à rattraper |
| Projets | Tous les projets (actifs, en pause, terminés) |
| Projet › Plan | Frise des semaines + items de la semaine ; recherche, filtre par bloc ou « à rattraper » |
| Projet › Avancement | Indicateurs, histogramme par semaine, avancement par bloc, livrables à cocher |
| Projet › Versions | Prompts IA, import, historique des versions |
| Projet › Infos | Fiche du projet (modifiable) et sections libres de la roadmap (cadre, points à vérifier, sources) |
| Réglages | Profil injecté dans les prompts, déconnexion |

**Ordinateur (≥ 900 px)** : sidebar permanente, onglets sous l'en-tête, frise verticale des semaines, détail d'un item en tiroir à droite. Raccourcis dans le plan : `←` `→` changer de semaine (ou d'item dans le détail), `/` chercher, et sur un item sélectionné (Tab) : `Entrée` ouvrir, `Espace` fait, `X` sauté, `Échap` fermer.
**Téléphone** : menu en bas, frise horizontale, détail en feuille du bas.

## À rattraper

Un item est « à rattraper » quand sa semaine est terminée et qu'il n'est ni fait ni sauté. Le prompt de révision transmet aussi le rythme global (items traités comparés aux items prévus à date).

## Format des roadmaps

Voir [docs/ROADMAP_FORMAT.md](./docs/ROADMAP_FORMAT.md).

## Sécurité & authentification

| Élément | Détail |
|---|---|
| Mot de passe | `171225` — déchiffre le PAT GitHub |
| Chiffrement | AES-GCM 256 bits, dérivation PBKDF2 SHA-256 (même sel que Pacing App) |
| Stockage du PAT | Chiffré dans `config.json` |
| Session | PAT déchiffré en `sessionStorage` uniquement (effacé à la fermeture de l'onglet) |

Le `config.json` reprend le token chiffré de Pacing App. Il fonctionne ici si ce token a aussi accès au dépôt `personal-roadmap` (Contents : lecture et écriture). Sinon : générer un token dédié et un nouveau `config.json` avec [setup.html](./setup.html).

## Données dans le dépôt

```
projects/index.json                 liste des projets
projects/{slug}/meta.json           projet + liste des versions
projects/{slug}/plans/v{N}.md       roadmap, une par version
profile.json                        profil (Réglages)
state.json                          avancement : items, livrables, déplacements
```

Les écritures de `state.json` portent `[skip ci]` pour ne pas redéployer le site à chaque case cochée.

## Déploiement

Chaque push sur `main` déclenche GitHub Actions → GitHub Pages. Premier déploiement : Settings → Pages → Source : **GitHub Actions**.
Sur iPhone : Safari → l'URL → Partager → « Sur l'écran d'accueil ».

---

## Auteur & licence

**Aurélien Moote - Moo - 2026**  
Copyright (c) 2026 Aurélien Moote ("Moo")  
Distribué sous [licence MIT](./LICENSE) — réutilisable à condition de conserver la mention de l'auteur.
