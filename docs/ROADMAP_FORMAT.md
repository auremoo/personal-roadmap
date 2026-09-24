# Format d'une roadmap (.md importable)

C'est le format que l'IA doit renvoyer. Les prompts générés par l'app (onglet Versions) le rappellent à chaque fois ; ce document sert de référence.

```
# ROADMAP_v1 — Préparation PCI

## META
project: Préparation PCI
slug: preparation-pci
objective: Arriver début mars chez PCI avec le moins d'écart possible par rapport à la fiche de poste.
start: 2026-09-28
end: 2027-02-28
weeks: 22
rhythm: 5 séances de 1 h 30 par semaine
version: 1
generated: 2026-09-24

## BLOCS
| ID | Nom | Couleur |
|---|---|---|
| GP | Gestion de projet et budget | blue |
| I | Ignition | orange |

## LIVRABLES
- L1 | Glossaire FR / FR-QC / EN | S1 | enrichi en continu
- L2 | Grille de ratios d'estimation | S7

## SEMAINES

### W01 | 2026-09-28 | Démarrage
- S1 | GP | GP1 | Cycle de vie d'un projet d'intégration
  - Contenu : avant-vente, octroi, lancement, ingénierie…
  - Production : schéma du cycle de vie + début du glossaire.
- S2 | I | I1 | Reprise Ignition
  - Contenu : …
  - Production : …

## CADRE
Markdown libre : rythme, priorités en cas de retard, conventions.

## A_VERIFIER
Markdown libre : points ouverts.

## SOURCES
Markdown libre : liens.
```

## Règles

| Élément | Règle |
|---|---|
| `## META` | `clé: valeur`. `start` (un lundi) sert à dater les semaines dont l'en-tête n'a pas de date. |
| `## BLOCS` | Tableau `ID | Nom | Couleur`. Couleurs : gray, blue, indigo, purple, pink, red, orange, yellow, green, teal. |
| `## LIVRABLES` | `- ID | Titre | Échéance | Précision`. L'échéance est l'ID de l'item qui produit le livrable (l'app en déduit la semaine). |
| `### W{NN}` | `### W{NN} | {date du lundi} | {note}`. Date et note facultatives. |
| Item | `- ID | BLOC | CODE | Titre` à la colonne 0, puis des sous-lignes indentées `  - Contenu :` et `  - Production :`. Toute autre sous-ligne `  - Libellé : texte` est affichée telle quelle. |
| ID d'item | Unique dans le plan, lettres/chiffres/tirets. Clé de l'avancement dans `state.json` : une révision doit conserver l'ID des items existants. |
| Sections libres | Toute section `## NOM_EN_MAJUSCULES` hors META/BLOCS/LIVRABLES/SEMAINES s'affiche dans l'onglet Infos. |

Formes tolérées par le parser : `- [ ] ` devant un item, titres en `**gras**`, item à 2 ou 3 colonnes (`- ID | Titre`, `- ID | BLOC | Titre`), réponse enveloppée dans un bloc ```` ``` ````.
