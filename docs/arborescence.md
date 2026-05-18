# Arborescence — Primexpert V2 (référence continuité)

## Emplacement unique (code + doc)

| Élément | Rôle |
|---------|------|
| **`01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/`** | Application **Vite + React** + **monorepo `@primexpert/core`** + **documentation** (`docs/`), déployée sur Firebase Hosting **`primexpert-app-v2`**. |
| **`00_RPA_SYSTEME_APP/Copilote-RPA/`** | Legacy RPA (référence métier ; migration vers V2 via scripts). |

---

## Vue d’ensemble du dépôt

```
01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/
├── docs/                          # Bible Primexpert (ce dossier)
│   ├── README.md
│   ├── MEMORY.md
│   ├── arborescence.md
│   ├── project_canonical_fields.md
│   └── project_pipeline_gps.md
├── packages/
│   └── core/                      # @primexpert/core — logique métier SSOT (zéro calcul dans l’UI)
│       ├── package.json
│       └── src/
│           ├── index.ts             # Barrel (canonical, valuation, financial, identity…)
│           ├── canonical/           # Champs canoniques & alias
│           ├── financial/           # normalizeFinancialData, bilan, ratios, SCHL…
│           ├── identity/            # buildIdentityViewModel, sections MSSS/RPA
│           ├── valuation/           # Cap rate, comparables, TGA
│           ├── narrative/           # Narratif vendeur
│           ├── intelligence/        # Priorités suivi KISS, rapport vendeur, vélocité
│           ├── quality/             # Score qualité fiche
│           ├── sources/             # Sources externes
│           ├── export/              # Export dataset / politique
│           ├── tenant/              # Multi-tenant (courtiersResponsables)
│           ├── mail/                # mailParser (E-2)
│           ├── audio/               # Transcription
│           └── utils/formatting.ts
├── functions/                       # Cloud Functions Gen2 (us-central1)
│   └── src/
│       ├── index.ts                 # Exports onCall / onRequest
│       ├── services/
│       │   └── vertexClient.ts    # Vertex AI — ADC (compte de service runtime)
│       ├── documents/
│       │   ├── scanPropertyDocument.ts
│       │   ├── parsePropertyDocument.ts
│       │   ├── geminiExtract.ts     # Extraction JSON via gemini-2.0-flash-001
│       │   └── validateStorageDocument.ts
│       ├── lib/firestore.ts
│       └── nylas/                   # OAuth, webhook, envoi, dossiers
├── scripts/                         # Utilitaires (facture sample, régions QC)
├── audit_tenant_uids.js             # Ops — audit tenant Firestore
├── backfill_tenant.js
├── hydrate_pipeline.js
├── migrate_financial_subcollections.js  # Copilote → residences/{id}/financial/dataV2
├── firebase.json                    # Hosting (dist), Firestore (2 bases), Functions, Storage
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── index.html
├── package.json
├── vite.config.ts                   # Alias @primexpert/core/* + code-splitting
├── public/                          # Logos silo, Primexpert…
└── src/
    ├── main.tsx
    ├── App.tsx                      # Routes, garde billing, lazy routes Workhub
    ├── components/
    │   ├── Layout.tsx               # Sidebar Radar, header
    │   ├── Settings.tsx             # Profil + Finance (admin_system) + comptes courriel
    │   ├── settings/
    │   │   └── EmailAccountsSettings.tsx
    │   ├── AdminSubscriptionsDashboard.tsx
    │   ├── Dashboard.tsx            # + PriorityFollowUpList (KISS J+3/J+5/J+7)
    │   ├── dashboard/
    │   │   └── PriorityFollowUpList.tsx
    │   ├── intelligence/
    │   │   └── IntelligenceChronologie.tsx
    │   ├── Listings.tsx             # Mes inscriptions + ResidenceDetail
    │   ├── ListingsInventoryVirtual.tsx
    │   ├── ListingRow.tsx
    │   ├── ResidenceIntelligencePanel.tsx  # Chronologie appels / courriels (onglet Intelligence)
    │   ├── residence/
    │   │   ├── ResidenceDetail.tsx  # Coquille fiche — 7 onglets
    │   │   ├── institutional/
    │   │   │   └── InstitutionalUi.tsx   # Kit UI audit (fond clair, #000000)
    │   │   ├── identity/            # Sections Identité (lecture seule)
    │   │   ├── documents/           # Espace Documents — diligence 3 colonnes
    │   │   │   ├── DocumentsDiligenceTab.tsx
    │   │   │   ├── DocumentCategorySidebar.tsx
    │   │   │   ├── DocumentUploadPanel.tsx
    │   │   │   └── DocumentMetadataPanel.tsx
    │   │   └── tabs/
    │   │       ├── IdentiteImmeubleTab.tsx
    │   │       ├── FinanceHubTab.tsx
    │   │       ├── BilanExecutifTab.tsx
    │   │       ├── RevenusDepensesTab.tsx
    │   │       ├── FinancabiliteTab.tsx
    │   │       └── Analyse360FinanceTab.tsx
    │   ├── financial/               # Composants partagés Hub Finance
    │   │   ├── PerformanceRatiosTab.tsx
    │   │   ├── ProvenanceStrip.tsx
    │   │   ├── TP70Card.tsx
    │   │   └── FinancialReportsSection.tsx
    │   ├── mailbox/                 # IA Mailbox (Nylas)
    │   ├── msss/
    │   │   └── RaphaelBadge.tsx
    │   ├── CRM.tsx, ACM.tsx, ContentGen.tsx
    │   ├── Drive/, Softphone/
    │   ├── GracePeriodBanner.tsx
    │   ├── SuspendedAccountScreen.tsx
    │   ├── J7SurveyModal.tsx
    │   └── UpsellModal.tsx, RadarLockBadge.tsx
    ├── context/
    │   ├── SiloContext.tsx
    │   ├── FinancialDataContext.tsx      # onSnapshot residences/{id}/financial/dataV2
    │   └── ResidenceDocumentContext.tsx  # onSnapshot residences/{id}
    ├── hooks/
    │   ├── useResidences.ts
    │   └── useListings.ts
    ├── lib/
    │   ├── auth.tsx
    │   ├── firebase.ts
    │   ├── i18n.tsx
    │   ├── billingAccess.ts
    │   ├── subscriptionPricing.ts
    │   ├── workhubNav.tsx
    │   ├── financeNavigation.ts
    │   ├── propertyDocumentValidation.ts
    │   ├── propertyDocumentPipeline.ts
    │   ├── emailAccounts.ts
    │   ├── quebecInvoiceTax.ts
    │   ├── stripePortal.ts
    │   ├── trialTimeline.ts
    │   └── …
    ├── services/
    │   ├── residences.ts            # Queries multi-tenant residences
    │   ├── propertyDocumentsService.ts  # Upload Storage + Firestore documents/
    │   ├── dashboardPriorityFollowUp.ts
    │   ├── transcriptionService.ts
    │   ├── mailboxAnalysis.ts
    │   ├── emailAccountService.ts
    │   ├── emailSyncService.ts
    │   ├── nylasClient.ts
    │   ├── invoicePdfService.ts
    │   ├── nurtureEmailService.ts
    │   └── …
    ├── config/
    │   ├── companyConfig.ts
    │   └── nurtureEmailTemplates.ts
    └── types/
        ├── residence.ts
        ├── propertyDocument.ts      # virusScanStatus, parsingStatus, extractedData
        ├── billing.ts
        ├── emailAccount.ts
        └── …
```

---

## Fiche résidence — onglets (`ResidenceDetail.tsx`)

| Onglet | Composant | Statut |
|--------|-----------|--------|
| Synthèse | `InstitutionalPlaceholder` | Placeholder — branchement CFO à venir |
| Identité | `IdentiteImmeubleTab` + `ResidenceDocumentProvider` | ✅ Phase 4a |
| Finances | `FinanceHubTab` + `FinancialDataProvider` | ✅ Hub + 5 sous-onglets |
| Déclaration | `InstitutionalPlaceholder` | Placeholder — Gold Signature |
| Marché | `InstitutionalPlaceholder` | Placeholder — géointelligence |
| Documents | `DocumentsDiligenceTab` | ✅ Financier / Technique / Légal + scan + parse IA |
| Intelligence | `ResidenceIntelligencePanel` + `IntelligenceChronologie` | ✅ Appels E-3 + courriels E-2 + rapport vendeur |

### Hub Finance — sous-onglets (`FinanceHubTab.tsx`)

| Sous-onglet | Composant UI | SSOT `@primexpert/core/financial` |
|-------------|--------------|-----------------------------------|
| Bilan exécutif | `BilanExecutifTab` | `computeBilanCfoViewModel()` |
| Revenus & Dépenses | `RevenusDepensesTab` | `buildRevenusDepensesGrid()` |
| Finançabilité | `FinancabiliteTab` | `computeFinancabilite()` |
| Ratios performance | `PerformanceRatiosTab` | `computePerformanceRatiosViewModel()` |
| Vérification performance | `Analyse360FinanceTab` | `computePerformanceAudit360()` |

**Règle #0 :** aucun calcul métier dans les composants React — uniquement formatage et présentation.

---

## Firebase

| Service | Détail |
|---------|--------|
| **Projet** | `primexpert-app-v2` |
| **Hosting** | `dist/` — SPA, réécriture `**` → `index.html` |
| **URL prod** | https://primexpert-app-v2.web.app |
| **Firestore** | Bases `(default)` + `ai-studio-1214d671-efd2-47da-93b7-425feb92155a` (même rules/indexes) |
| **Storage** | `primexpert/{brokerId}/properties/{propertyId}/documents/{category}/…` (+ legacy `properties/…` lecture) |
| **Functions** | `functions/` — Nylas + Espace Documents (scan, parse Vertex, réconciliation) |
| **Compte de service Functions** | `250702494735-compute@developer.gserviceaccount.com` (`roles/aiplatform.user`) |
| **Vertex AI** | `aiplatform.googleapis.com` — modèle `gemini-2.0-flash-001`, région `us-central1` |

---

## Fichiers clés par domaine

| Domaine | Fichiers |
|---------|----------|
| Multi-tenant résidences | `src/services/residences.ts`, `packages/core/src/tenant/`, `firestore.rules` |
| Données financières | `src/context/FinancialDataContext.tsx`, `packages/core/src/financial/` |
| Identité immeuble | `src/context/ResidenceDocumentContext.tsx`, `packages/core/src/identity/` |
| Charte UI institutionnelle | `src/components/residence/institutional/InstitutionalUi.tsx` |
| Billing / Chérif | `src/lib/billingAccess.ts`, `src/App.tsx`, `SuspendedAccountScreen.tsx` |
| Rôles & essai | `src/lib/auth.tsx`, `firestore.rules` (`users`) |
| KPIs Finance admin | `AdminSubscriptionsDashboard.tsx`, `subscriptionPricing.ts` |
| Migration Copilote | `migrate_financial_subcollections.js` |
| Espace Documents | `DocumentsDiligenceTab`, `propertyDocumentsService.ts`, `functions/src/documents/` |
| Parse IA financier | `geminiExtract.ts` + `vertexClient.ts` (ADC, pas de clé JSON en prod) |
| Priorités tableau de bord | `dashboardPriorityFollowUp.ts`, `PriorityFollowUpList.tsx` |

### Cloud Functions — Espace Documents

| Fonction | Rôle |
|----------|------|
| `propertyDocumentScanDocument` | Validation format → `virusScanStatus: clean` ; chaîne parse si Financier |
| `propertyDocumentsReconcileScan` | Réconcilie scans `pending` |
| `propertyDocumentParseIA` | Extraction Vertex (PDF/XLSX financiers `clean`) |
| `propertyDocumentsReconcileParse` | Réconcilie `parsingStatus` `pending` ou `failed` |

Déploiement parse : `FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions:propertyDocumentParseIA,…`

---

*Dernière mise à jour : 2026-05-18 — Espace Documents, Vertex AI ADC, Intelligence chronologie, priorités KISS.*
