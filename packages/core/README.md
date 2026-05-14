# @primexpert/core

> Core Engine PrimeXpert 2026 — logique métier OACIQ pure.

## 🎯 Mission

Centraliser la logique métier (évaluation, narrative, qualité, canonical, sources, export) **indépendamment de l'UI et du runtime** (web React, Cloud Functions, scripts CLI).

Ce package est la **fondation partagée** des deux silos :

- **Silo A** (`Copilote-RPA` V1 — sanctuaire) — *n'utilise pas ce package, conserve son `src/domain/` legacy*
- **Silo B** (PrimeXpert SaaS V2) — *consomme `@primexpert/core` pour toutes les opérations métier*

## 📦 Sous-modules

| Import | Rôle |
|---|---|
| `@primexpert/core/canonical` | Dictionnaire canonique des champs Firestore + aliases |
| `@primexpert/core/valuation` | Moteur valuation (TGA, NOI, MRB, MRN, comparables) |
| `@primexpert/core/narrative` | Génération + linting texte vendeur |
| `@primexpert/core/quality` | Scoring qualité de fiche résidence |
| `@primexpert/core/sources` | Ingestion sources externes (MSSS, REQ) |
| `@primexpert/core/export` | Build datasets export + policy |
| `@primexpert/core/tenant` | Helper multi-tenant (filtre `courtiersResponsables`) |

## 🚀 Usage

```ts
import { computeNoi } from '@primexpert/core/valuation';
import { withTenantFilter } from '@primexpert/core/tenant';
import { canonicalize } from '@primexpert/core/canonical';
```

## 🔒 Provenance

Voir `PROVENANCE.md` pour l'historique d'extraction depuis la V1.

## 🛠 Statut

**Phase A — extraction initiale** (2026-05-13). En attente de Phase B (câblage Vitest/Jest, intégration dans `packages/web`).
