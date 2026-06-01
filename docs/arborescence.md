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
│           ├── financial/           # Finance SSOT : normalizeFinancialData, RNE/TGA, bilan, ratios, SCHL…
│           │   ├── capitalization.ts          # RNE ↔ valeur ↔ taux de capitalisation (TGA)
│           │   ├── normalizeFinancialData.ts
│           │   ├── resolveCanonicalRne.ts
│           │   ├── revenusDepensesPreview.ts
│           │   ├── mergeExtractedFinancials.ts
│           │   └── …
│           ├── identity/            # buildIdentityViewModel, sections MSSS/RPA
│           ├── transaction/         # Promesse d'achat — offre SSOT, délais, commission
│           │   ├── offreTronc.ts
│           │   ├── offreConditions.ts
│           │   ├── offreCloture.ts
│           │   └── promesseAchatEngine.ts
│           ├── forms/                 # Générateur natif contrats / PA — sans OpenXML (V3.4–V3.5)
│           │   ├── annexeFieldSchema.ts       # Schéma champs entre parenthèses ( $ ) ( % ) CCV-
│           │   ├── renderDynamicParenthesis.ts
│           │   ├── buildContractAssemblerDefaults.ts
│           │   ├── renderContractAssemblerToHtml.ts
│           │   ├── paActifsTypes.ts
│           │   ├── buildPaActifsRenderData.ts
│           │   ├── renderPaActifsToHtml.ts
│           │   ├── templates/paActifsTemplate.ts
│           │   └── index.ts
│           ├── crm/                   # Contacts CRM — organizations/{orgId}/contacts
│           │   ├── contactTypes.ts    # LCI, buyerCriteria, sellerCriteria, deriveBuyerTier
│           │   ├── contactSearch.ts   # Recherche multi-critères LCI (haystack normalisé)
│           │   ├── contactUiHelpers.ts
│           │   ├── coBuyers.ts / coSellers.ts
│           │   ├── legacyContactImport.ts
│           │   ├── morningBriefing.ts   # Briefing du matin — tâches, RDV, hot leads
│           │   ├── radarOpportunitesEngine.ts  # Radar off-market — signaux faibles
│           │   ├── hotLeadsEngine.ts
│           │   └── raphaelEngine.ts   # Matchmaker acheteurs QUALIFIED ↔ résidence
│           ├── ai/
│           │   ├── oaciqSpecsTypes.ts   # Specs OACIQ — modes négociation / LOI
│           │   ├── negotiationEngine.ts # Copilote clauses — HITL manualVerifications
│           │   ├── negotiationPrompts.ts
│           │   └── voiceParser.ts       # Intentions note vocale → note + tâche
│           ├── services/
│           │   └── gemini.ts            # Port JSON Gemini (négociation V2.6)
│           ├── narrative/               # Lint OACIQ descriptions Centris + narratif vendeur
│           ├── telephony/             # VoIP — canUseVoip, types Twilio
│           ├── scripts/               # migrateLegacyContacts, testVoiceNote, testIncomingSms
│           ├── diffusion/             # Syndication Web (rpaavendre.com, guardrails OACIQ)
│           ├── valuation/           # Cap rate, comparables, TGA, ACM résidence
│           │   ├── residenceAcmBootstrap.ts   # Bootstrap ACM — SSOT calculatedResults + TGA GPS
│           │   ├── stressTest.ts / priceStrategy.ts / penetrationTgaAdjustment.ts
│           │   └── sellerListingAnalysisReport.ts
│           ├── intelligence/        # Priorités suivi KISS, rapport vendeur, contactTimeline
│           ├── residence/             # partiesImpliquees, complianceChecklist, listingCommission, quebecRegions, pipelineDragRules
│           │   ├── vendorPortalTimeline.ts   # Accès Vendeur — étapes timeline (Règle #0)
│           │   ├── vendorPortalCatalogue.ts  # Catalogue 85 pièces (82 + 3 hors liste)
│           │   ├── vendorPortalCompliance.ts # Jauge conformité catalogue
│           │   └── mandateCompleteness.ts    # Jauge preuves de conformité mandat (portail vendeur)
│           ├── documents/             # extraction rapports marché, schémas Gemini (MARKET_REPORT omnivore)
│           ├── market/                # haversine, zonePenetration, gpsCapRateByRegionClass, marketDeduplication, closingEngine
│           ├── quality/             # Score qualité fiche
│           ├── sources/             # Sources externes
│           ├── export/              # Export dataset / politique
│           ├── tenant/              # Multi-tenant (courtiersResponsables)
│           ├── mail/                # mailParser, contactMatch, messageUrgency, types omnicanal
│           ├── audio/               # Transcription (legacy)
│           └── utils/formatting.ts
├── functions/                       # Cloud Functions Gen2 (us-central1 + régions ciblées)
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
│       ├── analytics/               # Data flywheel interne — onTransactionConcludedFlywheel + _vendored/capitalization
│       ├── benchmark/
│       │   └── getGlobalFinancialBenchmark.ts
│       ├── centris/                 # Sync Centris / inscriptions cache — hors marché exclu
│       ├── emails/
│       │   └── sendDocumentSelection.ts  # Envoi sélection documents (callable)
│       ├── lib/firestore.ts
│       ├── diffusion/               # Syndication Web — _vendored/ (@primexpert/core/diffusion)
│       ├── nylas/                   # OAuth, webhook (signature Loi 25), sync email_threads
│       │   ├── _vendored/mail/      # @primexpert/core/mail (prebuild sync-core-mail.cjs)
│       │   ├── syncInboundMessage.ts
│       │   ├── hydrateThreadMessages.ts
│       │   └── mailMessageAnalysis.ts
│       ├── messaging/               # Hub omnicanal — ingestOmnichannelMessage, webhooks SMS/Meta (Montréal)
│       ├── cron/                    # morningBriefingGenerator (06:00 Toronto) + _vendored/crm
│       ├── vendor/                  # createVendorPortalInvite, validateVendorPortalToken
│       ├── security/                # onVaultDocumentWrite + journal WORM Montréal
│       ├── ai/                      # negotiationWithVertex + _vendored/ (@primexpert/core/ai prebuild)
│       ├── audio/                   # onVoiceNoteUploaded (us-east1), hydrateVoiceNote, geminiTranscribe
│       └── telephony/               # getTwilioToken, twilioVoiceResponse ; sync-core-telephony.cjs
├── scripts/
│   ├── migrate-legacy-contacts-to-v2.mjs   # Maillon 1 Firestore — contacts Copilote (dry-run défaut)
│   # npm run migrate:contacts → packages/core/src/scripts/migrateLegacyContacts.ts (Storage legacy)
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
├── vite.config.ts                   # Alias @primexpert/core/* + @primexpert/core/forms + code-splitting
├── public/                          # Logos silo, Primexpert…
├── src/
│   ├── App.tsx                      # Entrée publique — BrowserRouter + lazy AuthenticatedApp
│   ├── AuthenticatedApp.tsx         # Routes /workhub, /acces-vendeur ; garde billing ; lazy Workhub
│   ├── main.tsx
│   ├── index.css                    # Tailwind v4 — @config ../tailwind.config.js, @theme primexpert-*
│   ├── components/
    │   ├── Layout.tsx               # Sidebar Radar, header
    │   ├── Settings.tsx             # Profil + Finance (admin_system) + comptes courriel
    │   ├── settings/
    │   │   └── EmailAccountsSettings.tsx
    │   ├── AdminSubscriptionsDashboard.tsx
    │   ├── Dashboard.tsx            # Briefing matin, radar off-market, PriorityFollowUpList (KISS)
    │   ├── dashboard/
    │   │   └── PriorityFollowUpList.tsx
    │   ├── intelligence/
    │   │   ├── IntelligenceChronologie.tsx
    │   │   └── CommunicationHub.tsx      # Fil omnicanal (SMS, Meta, courriel) par contact
    │   ├── mobile/
    │   │   └── AudioRecorderButton.tsx   # Note vocale → Storage voice_notes
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
    │   │   ├── AccesVendeurPage.tsx   # Modes broker | client (?token=)
    │   │   ├── VendorPortalSkeleton.tsx
    │   │   ├── VendorTimeline.tsx
    │   │   ├── VendorComplianceGauge.tsx
    │   │   ├── VendorDocumentDropzone.tsx
    │   │   └── VendorOfferPanel.tsx
    │   ├── residence/
    │   │   ├── ResidenceDetail.tsx  # Coquille fiche — 9 onglets + InstitutionalResidenceTabShell + ErrorBoundary
    │   │   ├── ResidenceTabErrorBoundary.tsx  # Attrape crash rendu par onglet (évite écran noir)
    │   │   ├── ResidenceAccesVendeurButton.tsx  # Lien portail vendeur (parties VENDEUR)
    │   │   ├── institutional/
    │   │   │   └── InstitutionalUi.tsx   # Kit UI institutionnel (coquilles, KPI, sections)
    │   │   ├── identity/            # Sections Identité — édition inline Confort 66+
    │   │   │   ├── ResponsibleBrokerCard.tsx   # courtiersResponsables
    │   │   │   └── PartiesIntervenantsSection.tsx
    │   │   ├── finance/
    │   │   │   ├── FinanceHubMasterPanel.tsx
    │   │   │   ├── FinanceManualEntryPanel.tsx
    │   │   │   └── FinancialHubDraftContext.tsx
    │   │   ├── diffusion/
    │   │   │   └── DraftPreviewModal.tsx
    │   │   ├── promesse/            # Panneaux cockpit PA (tronc offre, conditions, clôture, délais, commission)
    │   │   │   ├── OffreTroncFinancierSection.tsx
    │   │   │   ├── OffreConditionsLegalesSection.tsx
    │   │   │   ├── OffreClotureRetributionSection.tsx
    │   │   │   ├── PromesseDelaisPaSection.tsx
    │   │   │   ├── PromesseCommissionPaSection.tsx
    │   │   │   ├── PaConfortPanel.tsx
    │   │   │   └── ContractAssemblerPanel.tsx   # V3.5 — assemblage contrat + annexes (export HTML)
    │   │   ├── documents/           # Espace Documents — diligence 3 colonnes
    │   │   │   ├── DocumentsDiligenceTab.tsx
    │   │   │   ├── DocumentCategorySidebar.tsx
    │   │   │   ├── DocumentUploadPanel.tsx
    │   │   │   ├── DocumentMetadataPanel.tsx
    │   │   │   ├── DocumentTabs.tsx
    │   │   │   ├── DocumentDistributionPanel.tsx
    │   │   │   └── DocumentEmailPanel.tsx
    │   │   └── tabs/
    │   │       ├── Synthese360Tab.tsx      # Bilan 360°, notes, AudioRecorder, RaphaelMatchmakerPanel
    │   │       ├── RaphaelMatchmakerPanel.tsx
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
    │   │   ├── MailContactLinkBar.tsx
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
    │   ├── ACM.tsx, ContentGen.tsx    # Rédacteur IA Centris + lint OACIQ
    │   ├── Drive/, Softphone/
    │   ├── GracePeriodBanner.tsx
    │   ├── SuspendedAccountScreen.tsx
    │   ├── J7SurveyModal.tsx
    │   └── UpsellModal.tsx, RadarLockBadge.tsx
    ├── context/
    │   ├── SiloContext.tsx
    │   ├── FinancialDataContext.tsx      # onSnapshot residences/{id}/financial/dataV2 (value mémoïsée)
    │   ├── ResidenceDocumentContext.tsx  # onSnapshot residences/{id} (value mémoïsée)
    │   └── ResidenceDataContext.tsx      # SSOT inter-onglets : prix, unités, hints finance (`useUnifiedResidence`, `useResidenceFinancialHints`)
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
    │   ├── morningBriefingService.ts  # Briefing matin + radar off-market (dashboard)
    │   ├── vendorPortalService.ts
    │   ├── vendorPortalAccessService.ts  # Jetons invitation portail vendeur
    │   ├── communicationTimelineService.ts
    │   ├── residences.ts            # Queries multi-tenant residences
    │   ├── propertyDocumentsService.ts  # Upload Storage + Firestore documents/
    │   ├── dashboardPriorityFollowUp.ts
    │   ├── transcriptionService.ts
    │   ├── mailboxAnalysis.ts       # Lecture analyses — collectionGroup messages (SSOT)
    │   ├── emailAccountService.ts
    │   ├── emailSyncService.ts
    │   ├── nylasClient.ts
    │   ├── marketDocumentsService.ts
    │   ├── globalFinancialBenchmarkService.ts
    │   ├── financialDataService.ts  # Écrit financial/dataV2 ; RNE/TGA via @primexpert/core/financial/capitalization
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
| Marché | `MarcheConcurrenceTab` | ✅ **Analyse de mise en marché (ACM)** en tête + pénétration / comparables / diagnostic territorial |
| Documents | `DocumentsDiligenceTab` | ✅ Financier / Technique / Légal + scan + parse IA + onglets / distribution / courriel |
| Intelligence | `ResidenceIntelligencePanel` + `IntelligenceChronologie` | ✅ Appels E-3 + courriels `email_threads/messages` + rapport vendeur |
| Promesse | `PromesseAchatTab` + `residence/promesse/*` | ✅ Cockpit PA — `offre` + `promesseAchat` (core/transaction) + assembleur contrat V3.5 |

### Hub Finance — sous-onglets (`FinanceHubTab.tsx`)

| Sous-onglet | Composant UI | SSOT `@primexpert/core/financial` |
|-------------|--------------|-----------------------------------|
| Bilan exécutif | `BilanExecutifTab` | `computeBilanCfoViewModel()` |
| Revenus & Dépenses | `RevenusDepensesTab` | `buildRevenusDepensesGrid()` |
| Finançabilité | `FinancabiliteTab` | `computeFinancabilite()` |
| Ratios performance | `PerformanceRatiosTab` | `computePerformanceRatiosViewModel()` |
| Vérification performance | `Analyse360FinanceTab` | `computePerformanceAudit360()` |

**SSOT prix & hints finance (`d232673` + PR #10) :** `ResidenceDataProvider` normalise `price` / `prixAnnonce` / `prixDemande` ; `useResidenceFinancialHints()` injecte le prix canonique dans tous les sous-onglets ; core `resolveAdmissibleOpex()` — RNE = RBE − dépenses **déclarées** (pas le normalisé seul) ; `capitalization.ts` centralise RNE ↔ valeur ↔ taux de capitalisation (TGA).

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
| Données financières | `src/context/FinancialDataContext.tsx`, `src/services/financialDataService.ts`, `packages/core/src/financial/` (`capitalization.ts`, `resolveCanonicalRne.ts`, `normalizeFinancialData.ts`) |
| Identité immeuble | `src/context/ResidenceDocumentContext.tsx`, `packages/core/src/identity/`, `IdentiteImmeubleTab` |
| Promesse d'achat | `PromesseAchatTab.tsx`, `src/components/residence/promesse/`, `packages/core/src/transaction/`, **`packages/core/src/forms/`** (V3.4–V3.5) |
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
| Accès Vendeur | `AccesVendeurPage.tsx`, `vendorPortalCatalogue.ts`, `vendorPortalCompliance.ts`, `vendorPortalAccess.ts`, `ResidenceAccesVendeurButton.tsx` |
| Briefing matin & radar | `morningBriefing.ts`, `radarOpportunitesEngine.ts`, `morningBriefingGenerator.ts`, `morningBriefingService.ts`, `Dashboard.tsx` |
| Recherche CRM | `contactSearch.ts`, `ContactsListPage` |
| Import contacts Maillon 1 | `legacyContactImport.ts`, `migrate-legacy-contacts-to-v2.mjs` |
| Parties ↔ contacts | `packages/core/src/residence/partiesImpliquees.ts`, `PartiesIntervenantsSection.tsx` |
| Chronologie omnicanale | `contactTimeline.ts`, `CommunicationTimelineFeed.tsx`, `CommunicationHub.tsx`, `ingestOmnichannelMessage.ts` |
| Matchmaker Raphaël | `raphaelEngine.ts`, `RaphaelMatchmakerPanel.tsx`, `Synthese360Tab.tsx` |
| Notes vocales | `voiceParser.ts`, `onVoiceNoteUploaded.ts`, `AudioRecorderButton.tsx`, `voiceNoteService.ts` |
| VoIP Twilio | `telephony/`, `twilioVoiceService.ts`, `getTwilioToken.ts` |
| Copilote négociation V2.6 | `negotiationEngine.ts`, `oaciqSpecsTypes.ts`, `functions/src/ai/negotiationWithVertex.ts` |
| Après-vente closing V2.7 | `closingEngine.ts`, [`CLOSING_AND_COMPLIANCE_DRAFT.md`](./CLOSING_AND_COMPLIANCE_DRAFT.md) |
| Rédacteur IA Centris | `ContentGen.tsx`, `@primexpert/core/narrative` |
| Import CRM Storage | `migrateLegacyContacts.ts` — `npm run migrate:contacts` |
| Identité — courtier responsable | `ResponsibleBrokerCard.tsx`, champ `courtiersResponsables` |
| Hub Finance master | `FinanceHubMasterPanel.tsx`, `FinanceHubLockContext.tsx`, rapports PDF |
| Capitalisation RNE / TGA | `packages/core/src/financial/capitalization.ts`, `revenusDepensesPreview.ts`, `financialDataService.ts`, `centrisComparableCapRate.ts`, `internalMarketFlywheel.ts` |

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
| `onTransactionConcludedFlywheel` | Alimentation anonymisée `market_analytics_raw` lors des transitions promesse acceptée / vendu ; TGA via `capitalization.ts` vendoré |

---

| Analyse de mise en marché (ACM) | `AcmValuationWorkspace`, `ResidenceAcmValuationPanel`, `residenceAcmBootstrap.ts`, `gpsCapRateByRegionClass.ts` |
| Assembleur contrat / PA (V3.5) | `ContractAssemblerPanel.tsx`, `annexeFieldSchema.ts`, `renderContractAssemblerToHtml.ts`, `@primexpert/core/forms` |
| Capitalisation RNE / TGA (PR #10) | `capitalization.ts`, `financialDataService.ts`, `centrisComparableCapRate.ts`, `internalMarketFlywheel.ts`, `functions/src/analytics/_vendored/capitalization.ts` |

*Dernière mise à jour : 2026-06-01 — PR #10 : centralisation RNE / taux de capitalisation (TGA), flywheel et arborescence financière sans duplication.*
