# PROVENANCE — @primexpert/core

> *On enrichit / on étend / on modifie l'existant — aucune duplication autorisée.*

## 🎯 Origine du code

Ce package est l'**extraction** du Core Engine de la **Silo A** (`Copilote-RPA` V1) — dossier `src/domain/` — vers la **Silo B** (PrimeXpert 2026).

**Source d'extraction** : `/Volumes/SAUVEGARDE GRIS 1/00_RPA_SYSTEME_APP/Copilote-RPA/src/domain/`
**Date de l'extraction initiale** : 2026-05-13 (Phase A)
**Auteur** : Programmeur Analyste (sous direction de Gemini — Ingénieur Principal)

## 📜 Charte appliquée

- **Charte v2026.2** (Règle #0 — SOURCE UNIQUE · KISS · ZÉRO DÉRIVE)
- **Brief de Direction « SYSTÈME SILOS 2026 v4 »**

## ✅ Modules portés (extraits intégralement)

| Module | Origine V1 | Justification |
|---|---|---|
| `canonical/` | `src/domain/canonical/` | P0 — Dictionnaire de données central (`fieldAliases.ts`) |
| `valuation/` | `src/domain/valuation/` | P0 — Moteur Valuation OACIQ (TGA, NOI, MRB, MRN, lender cap rate) |
| `narrative/` | `src/domain/narrative/` | P1 — Génération texte vendeur + linter |
| `quality/` | `src/domain/quality/` | P1 — Scoring qualité de fiche |
| `sources/` | `src/domain/sources/` | P2 — Ingestion sources MSSS/REQ |
| `export/` | `src/domain/export/` | P2 — Export datasets + policy |

## ❌ Modules EXCLUS (décision Brief v4)

| Module V1 | Raison de l'exclusion |
|---|---|
| `src/domain/adoption/` | Logique d'onboarding V1 — non portée vers V2 SaaS |
| `src/domain/training/` | Personas IA / training V1 — exclu du Silo 2026 (Brief §2) |
| `src/domain/automation/` | Pas de fichier source (`__tests__/` orphelins uniquement) |

## ➕ Ajout V2

| Module nouveau | Rôle |
|---|---|
| `tenant/` | Helper multi-tenant (`withTenantFilter` sur `courtiersResponsables`) — **n'existe pas en V1** car V1 = mono-tenant |

## 🔒 Règles de synchronisation V1 ↔ V2

1. **V1 sanctuarisée** (Brief §1) : aucune modification dans `Copilote-RPA`. Le Core ici **divergera** de V1 et c'est attendu.
2. **Pas de copie automatisée** : toute évolution du Core se fait directement dans ce package.
3. **Tests** : les `__tests__/` ont été portés (à câbler avec Vitest/Jest en Phase B).

## ⚠️ Zone Rouge (Charte §V)

Le port respecte les slugs techniques (pipeline `READY` / `TEASER` / `INCOMPLETE`, mapping `resolveColumnId`, champs publics tels que `courtiersResponsables`, `prixAnnonce`, `nombreUnites`). Aucun renommage.

## 📊 Inventaire des fichiers portés

À jour : voir l'arborescence `packages/core/src/` actuelle. Total estimé : **33 fichiers TypeScript** (sources + tests).
