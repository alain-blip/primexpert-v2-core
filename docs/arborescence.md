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
│           ├── transaction/         # Promesse d'achat — offre SSOT, délais, commission
│           │   ├── offreTronc.ts
│           │   ├── offreConditions.ts
│           │   ├── offreCloture.ts
│           │   └── promesseAchatEngine.ts
│           ├── crm/                   # Contacts CRM — organizations/{orgId}/contacts
│           │   ├── contactTypes.ts    # LCI, buyerCriteria, sellerCriteria, deriveBuyerTier
│           │   ├── contactUiHelpers.ts
│           │   ├── coBuyers.ts / coSellers.ts
│           │   └── legacyContactImport.ts
│           ├── diffusion/             # Syndication Web (rpaavendre.com, guardrails OACIQ)
│           ├── valuation/           # Cap rate, comparables, TGA
│           ├── narrative/           # Narratif vendeur
│           ├── intelligence/        # Priorités suivi KISS, rapport vendeur, contactTimeline
│           ├── residence/             # partiesImpliquees, complianceChecklist, listingCommission, quebecRegions, pipelineDragRules
│           │   ├── vendorPortalTimeline.ts   # Accès Vendeur — étapes timeline (Règle #0)
│           │   └── mandateCompleteness.ts    # Jauge preuves de conformité mandat (portail vendeur)
│           ├── documents/             # extraction rapports marché, schémas Gemini (MARKET_REPORT omnivore)
│           ├── market/                # haversine, zonePenetration, marketDeduplication (anti-doublons Big Data)
│           ├── quality/             # Score qualité fiche
│           ├── sources/             # Sources externes
│           ├── export/              # Export dataset / politique
│           ├── tenant/              # Multi-tenant (courtiersResponsables)
│           ├── mail/                # mailParser + contactMatch (Phase 2 CRM)
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
│       │   ├── parseMarketDocument.ts       # Parse rapports marché (Vertex)
│       │   ├── injectMarketMacroStats.ts
│       │   ├── geminiExtract.ts     # Extraction JSON via gemini-2.0-flash-001
│       │   ├── documentTaxonomy.ts  # Taxonomie catégories documents
│       │   ├── validateStorageDocument.ts
│       │   └── _vendored/         # @primexpert/core/documents + market (prebuild)
│       ├── benchmark/
│       │   └── getGlobalFinancialBenchmark.ts
│       ├── emails/
│       │   └── sendDocumentSelection.ts  # Envoi sélection documents (callable)
│       ├── lib/firestore.ts
│       ├── diffusion/               # Syndication Web — _vendored/ (@primexpert/core/diffusion)
│       └── nylas/                   # OAuth, webhook (signature Loi 25), sync email_threads
│           ├── _vendored/mail/      # @primexpert/core/mail (prebuild sync-core-mail.cjs)
│           ├── syncInboundMessage.ts
│           ├── hydrateThreadMessages.ts
│           ├── messageDocId.ts
│           ├── verifyWebhookSignature.ts
│           └── mailMessageAnalysis.ts
├── scripts/
│   ├── migrate-legacy-contacts-to-v2.mjs   # Maillon 1 — contacts Copilote → organizations/…/contacts (dry-run défaut)
│   ├── deploy-diffusion-jour-4-5.sh
│   └── output/                      # Rapports dry-run migration (gitignored)
├── audit_tenant_uids.js             # Ops — audit tenant Firestore
├── backfill_tenant.js
├── hydrate_pipeline.js
├── migrate_financial_subcollections.js  # Copilote → residences/{id}/financial/dataV2
├── firebase.json                    # Hosting (dist), Firestore (2 bases), Functions, Storage
├── tailwind.config.js               # Couleurs primexpert (blue, dark, light, gold) — @config dans index.css
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── index.html
├── package.json
├── vite.config.ts                   # Alias @primexpert/core/* + code-splitting
├── public/                          # Logos silo, Primexpert…
└── src/
    ├── main.tsx
    ├── index.css                    # Tailwind v4 — @config ../tailwind.config.js, @theme primexpert-*
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
    │   ├── Listings.tsx             # Mes inscriptions — pipeline Kanban 4 colonnes + inventaire + DnD + filtres régions
    │   ├── listings/
    │   │   ├── ListingsPipelineKanban.tsx   # @hello-pangea/dnd
    │   │   └── ListingsRegionFilterPanel.tsx
    │   ├── ListingsInventoryVirtual.tsx
    │   ├── ListingRow.tsx           # Délègue à ListingInstitutionalCard
    │   ├── ListingInstitutionalCard.tsx  # Carte institutionnelle (nom commercial, prix, rétribution)
    │   ├── BrokerToolsDocuments.tsx # Outils courtier — documents
    │   ├── ResidenceIntelligencePanel.tsx  # Chronologie appels / courriels (onglet Intelligence)
    │   ├── vendor/                    # Accès Vendeur — portail client mobile-first
    │   │   ├── AccesVendeurPage.tsx
    │   │   ├── VendorTimeline.tsx
    │   │   ├── VendorComplianceGauge.tsx
    │   │   ├── VendorDocumentDropzone.tsx
    │   │   └── VendorOfferPanel.tsx
    │   ├── residence/
    │   │   ├── ResidenceDetail.tsx  # Coquille fiche — 8 onglets + InstitutionalResidenceTabShell
    │   │   ├── ResidenceAccesVendeurButton.tsx  # Lien portail vendeur (parties VENDEUR)
    │   │   ├── institutional/
    │   │   │   └── InstitutionalUi.tsx   # Kit UI institutionnel (coquilles, KPI, sections)
    │   │   ├── identity/            # Sections Identité — édition inline Confort 66+
    │   │   │   ├── ResponsibleBrokerCard.tsx   # courtiersResponsables
    │   │   │   └── PartiesIntervenantsSection.tsx
    │   │   ├── finance/
    │   │   │   └── FinanceHubMasterPanel.tsx
    │   │   ├── diffusion/
    │   │   │   └── DraftPreviewModal.tsx
    │   │   ├── promesse/            # Panneaux cockpit PA (tronc offre, conditions, clôture, délais, commission)
    │   │   │   ├── OffreTroncFinancierSection.tsx
    │   │   │   ├── OffreConditionsLegalesSection.tsx
    │   │   │   ├── OffreClotureRetributionSection.tsx
    │   │   │   ├── PromesseDelaisPaSection.tsx
    │   │   │   ├── PromesseCommissionPaSection.tsx
    │   │   │   └── PaConfortPanel.tsx
    │   │   ├── documents/           # Espace Documents — diligence 3 colonnes
    │   │   │   ├── DocumentsDiligenceTab.tsx
    │   │   │   ├── DocumentCategorySidebar.tsx
    │   │   │   ├── DocumentUploadPanel.tsx
    │   │   │   ├── DocumentMetadataPanel.tsx
    │   │   │   ├── DocumentTabs.tsx
    │   │   │   ├── DocumentDistributionPanel.tsx
    │   │   │   └── DocumentEmailPanel.tsx
    │   │   └── tabs/
    │   │       ├── Synthese360Tab.tsx      # Bilan exécutif 360°, rétribution, C-73.2, notes
    │   │       ├── IdentiteImmeubleTab.tsx
    │   │       ├── FinanceHubTab.tsx
    │   │       ├── BilanExecutifTab.tsx
    │   │       ├── RevenusDepensesTab.tsx
    │   │       ├── FinancabiliteTab.tsx
    │   │       ├── Analyse360FinanceTab.tsx
    │   │       ├── DeclarationVendeurTab.tsx
    │   │       ├── MarcheConcurrenceTab.tsx
    │   │       └── PromesseAchatTab.tsx
    │   ├── financial/               # Composants partagés Hub Finance
    │   │   ├── PerformanceRatiosTab.tsx
    │   │   ├── ProvenanceStrip.tsx
    │   │   ├── TP70Card.tsx
    │   │   └── FinancialReportsSection.tsx
    │   ├── mailbox/                 # Email Center — MailboxContainer (Nylas temps réel)
    │   │   ├── MailboxContainer.tsx
    │   │   ├── MailContactLinkBar.tsx   # Phase 2 — liaison dossier client
    │   │   ├── ChatWindow.tsx
    │   │   └── MessageComposer.tsx
    │   ├── market/
    │   │   └── MarketLibraryDashboard.tsx
    │   ├── ui/
    │   │   └── TernaryToggle.tsx      # Oui / Non / N/A — conditions PA
    │   ├── msss/
    │   │   └── RaphaelBadge.tsx
    │   ├── documents/
    │   │   └── ScopedDocumentManager.tsx
    │   ├── contacts/                  # Répertoire CRM — drawer, liste, coacheteurs/covendeurs
    │   │   ├── ContactsListPage.tsx
    │   │   ├── ContactFormDrawer.tsx
    │   │   ├── CoBuyersSection.tsx / CoSellersSection.tsx
    │   │   ├── BuyerTierBadge.tsx
    │   │   └── ContactCriteriaDocumentsSection.tsx
    │   ├── CRM.tsx                    # Route Workhub → ContactsListPage
    │   ├── ACM.tsx, ContentGen.tsx
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
    │   ├── useGlobalFinancialBenchmark.ts
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
    │   ├── propertyDocumentTaxonomy.ts
    │   ├── institutionalTheme.ts    # Chaînes Tailwind charte (primexpert-*)
    │   ├── listingCardViewModel.ts  # ViewModel cartes inscriptions (nom, prix, commission, revenu)
    │   ├── documentEmailTemplates.ts
    │   ├── quotaStorageService.ts
    │   ├── emailAccounts.ts
    │   ├── quebecInvoiceTax.ts
    │   ├── stripePortal.ts
    │   ├── trialTimeline.ts
    │   └── …
    ├── services/
    │   ├── contacts.ts              # organizations/{orgId}/contacts
    │   ├── communicationTimelineService.ts
    │   ├── residences.ts            # Queries multi-tenant residences
    │   ├── propertyDocumentsService.ts  # Upload Storage + Firestore documents/
    │   ├── dashboardPriorityFollowUp.ts
    │   ├── transcriptionService.ts
    │   ├── mailboxAnalysis.ts       # Lecture analyses — collectionGroup messages (SSOT)
    │   ├── communicationTimelineService.ts
    │   ├── emailAccountService.ts
    │   ├── emailSyncService.ts
    │   ├── nylasClient.ts
    │   ├── marketDocumentsService.ts
    │   ├── globalFinancialBenchmarkService.ts
    │   ├── financialDataService.ts
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

Huit onglets ; coquille bleue institutionnelle (`InstitutionalResidenceTabShell`) sur les onglets concernés.

| Onglet | Composant | Statut |
|--------|-----------|--------|
| Synthèse | `Synthese360Tab` | ✅ Bilan exécutif, bloc rétribution, jalons C-73.2 (J+3 / J+180), notes `residences/{id}/notes` |
| Identité | `IdentiteImmeubleTab` + `ResidenceDocumentProvider` | ✅ Phase 4a |
| Finances | `FinanceHubTab` + `FinancialDataProvider` | ✅ Hub + 5 sous-onglets |
| Déclaration | `DeclarationVendeurTab` | ✅ Questionnaire OACIQ — coquille institutionnelle |
| Marché | `MarcheConcurrenceTab` | ✅ Marché et concurrence — coquille institutionnelle |
| Documents | `DocumentsDiligenceTab` | ✅ Financier / Technique / Légal + scan + parse IA + onglets / distribution / courriel |
| Intelligence | `ResidenceIntelligencePanel` + `IntelligenceChronologie` | ✅ Appels E-3 + courriels `email_threads/messages` + rapport vendeur |
| Promesse | `PromesseAchatTab` + `residence/promesse/*` | ✅ Cockpit PA — `offre` + `promesseAchat` (core/transaction) |

### Hub Finance — sous-onglets (`FinanceHubTab.tsx`)

| Sous-onglet | Composant UI | SSOT `@primexpert/core/financial` |
|-------------|--------------|-----------------------------------|
| Bilan exécutif | `BilanExecutifTab` | `computeBilanCfoViewModel()` |
| Revenus & Dépenses | `RevenusDepensesTab` | `buildRevenusDepensesGrid()` |
| Finançabilité | `FinancabiliteTab` | `computeFinancabilite()` |
| Ratios performance | `PerformanceRatiosTab` | `computePerformanceRatiosViewModel()` |
| Vérification performance | `Analyse360FinanceTab` | `computePerformanceAudit360()` |

**Règle #0 :** le Hub Finance et l’identité consomment `@primexpert/core` — pas de moteur financier dupliqué dans l’UI. L’onglet **Synthèse** affiche une **lecture** rétribution / jalons (cascade sur champs `residences` + formatage), distincte du SSOT `financial/dataV2`.

---

## Firebase

| Service | Détail |
|---------|--------|
| **Projet** | `primexpert-app-v2` |
| **Hosting** | `dist/` — SPA, réécriture `**` → `index.html` |
| **URL prod** | https://primexpert-app-v2.web.app |
| **Firestore** | Bases `(default)` + `ai-studio-1214d671-efd2-47da-93b7-425feb92155a` (même rules/indexes) |
| **Storage** | `primexpert/{orgId}/contacts/…` ; `primexpert/{brokerId}/properties/{id}/documents/…` ; **`primexpert/{brokerId}/market_documents/…`** |
| **Functions** | `functions/` — Nylas, Espace Documents, **Statistiques du marché**, benchmark global |
| **Compte de service Functions** | `250702494735-compute@developer.gserviceaccount.com` (`roles/aiplatform.user`) |
| **Vertex AI** | `aiplatform.googleapis.com` — modèle `gemini-2.0-flash-001`, région `us-central1` |

---

## Fichiers clés par domaine

| Domaine | Fichiers |
|---------|----------|
| Multi-tenant résidences | `src/services/residences.ts`, `packages/core/src/tenant/`, `firestore.rules` |
| Données financières | `src/context/FinancialDataContext.tsx`, `packages/core/src/financial/` |
| Identité immeuble | `src/context/ResidenceDocumentContext.tsx`, `packages/core/src/identity/`, `IdentiteImmeubleTab` |
| Promesse d'achat | `PromesseAchatTab.tsx`, `src/components/residence/promesse/`, `packages/core/src/transaction/` |
| Charte UI institutionnelle | `tailwind.config.js`, `src/index.css` (`@theme` / `@config`), `src/lib/institutionalTheme.ts`, `InstitutionalUi.tsx` |
| Inscriptions (cartes, view model, Kanban DnD) | `Listings.tsx`, `listings/ListingsPipelineKanban.tsx`, `ListingInstitutionalCard.tsx`, `listingCardViewModel.ts`, `packages/core/src/residence/listingCommission.ts`, `mandateCompleteness.ts`, `quebecRegions.ts` |
| Messagerie ↔ CRM (Phase 2) | `MailContactLinkBar.tsx`, `emailSyncService.linkEmailThreadToContact`, `packages/core/src/mail/contactMatch.ts`, `matchedContactId` |
| Bibliothèque marché (Statistiques du marché) | `MarketLibraryDashboard.tsx`, `marketDocumentsService.ts`, `parseMarketDocument.ts`, `injectMarketMacroStats.ts`, `marketDeduplication.ts` |
| Benchmark finance global | `getGlobalFinancialBenchmark.ts`, `useGlobalFinancialBenchmark.ts`, `globalFinancialBenchmark.ts` |
| Billing / Chérif | `src/lib/billingAccess.ts`, `src/App.tsx`, `SuspendedAccountScreen.tsx` |
| Rôles & essai | `src/lib/auth.tsx`, `firestore.rules` (`users`) |
| KPIs Finance admin | `AdminSubscriptionsDashboard.tsx`, `subscriptionPricing.ts` |
| Migration Copilote | `migrate_financial_subcollections.js` |
| Espace Documents | `DocumentsDiligenceTab`, `propertyDocumentsService.ts`, `functions/src/documents/` |
| Parse IA financier | `geminiExtract.ts` + `vertexClient.ts` (ADC, pas de clé JSON en prod) |
| Priorités tableau de bord | `dashboardPriorityFollowUp.ts`, `PriorityFollowUpList.tsx` |
| CRM contacts | `packages/core/src/crm/`, `src/services/contacts.ts`, `src/components/contacts/` |
| Accès Vendeur | `src/components/vendor/`, `ResidenceAccesVendeurButton.tsx`, `vendorPortalService.ts`, `vendorPortalTimeline.ts` |
| Import contacts Maillon 1 | `legacyContactImport.ts`, `migrate-legacy-contacts-to-v2.mjs` |
| Parties ↔ contacts | `packages/core/src/residence/partiesImpliquees.ts`, `PartiesIntervenantsSection.tsx` |
| Chronologie omnicanale | `contactTimeline.ts`, `CommunicationTimelineFeed.tsx`, `communicationTimelineService.ts` |
| Identité — courtier responsable | `ResponsibleBrokerCard.tsx`, champ `courtiersResponsables` |
| Hub Finance master | `FinanceHubMasterPanel.tsx`, `FinanceHubLockContext.tsx`, rapports PDF |

### Cloud Functions — Espace Documents

| Fonction | Rôle |
|----------|------|
| `propertyDocumentScanDocument` | Validation format → `virusScanStatus: clean` ; chaîne parse si Financier |
| `propertyDocumentsReconcileScan` | Réconcilie scans `pending` |
| `propertyDocumentParseIA` | Extraction Vertex (PDF/XLSX financiers `clean`) |
| `propertyDocumentsReconcileParse` | Réconcilie `parsingStatus` `pending` ou `failed` |
| `sendDocumentSelection` | Envoi courriel sélection documents (callable authentifié) |

Déploiement parse : `FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions:propertyDocumentParseIA,…`

### Cloud Functions — Statistiques du marché (Big Data)

| Fonction | Rôle |
|----------|------|
| `marketDocumentParseIA` | Parse Vertex rapports marché (~100 p.) — **2 GiB**, **540 s** |
| `injectMarketMacroStats` | Injection HITL idempotente → `market_macro_stats`, `market_analytics_raw`, `marketSnapshots/v1` |
| `getGlobalFinancialBenchmark` | Médianes régionales / portefeuille pour Hub Finance |

---

*Dernière mise à jour : 2026-05-20 — Accès Vendeur, Maillon 1 migration contacts (`legacyContactImport`), bouton fiche résidence.*
