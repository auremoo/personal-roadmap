# Format d'une roadmap (.md importable)

C'est le format que l'IA doit renvoyer. Les prompts générés par l'app (onglet Versions) le rappellent à chaque fois ; ce document sert de référence.

```
# ROADMAP_v1 — Apprendre l'espagnol

## META
project: Apprendre l'espagnol
slug: apprendre-espagnol
objective: Tenir une conversation de 20 minutes sans passer par l'anglais.
start: 2026-10-05
end: 2027-01-31
weeks: 17
rhythm: 4 séances de 45 min par semaine
version: 1
generated: 2026-09-24

## BLOCS
| ID | Nom | Couleur |
|---|---|---|
| GR | Grammaire | blue |
| OR | Oral | orange |

## LIVRABLES
- L1 | Lexique personnel de 500 mots | S12 | enrichi en continu
- L2 | Enregistrement d'une présentation de 5 min | S40

## SEMAINES

### W01 | 2026-10-05 | Démarrage
- S1 | GR | GR1 | Présent de l'indicatif
  - Contenu : verbes réguliers en -ar, -er, -ir ; ser et estar.
  - Production : fiche de conjugaison + 20 phrases écrites.
- S2 | OR | OR1 | Se présenter
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
