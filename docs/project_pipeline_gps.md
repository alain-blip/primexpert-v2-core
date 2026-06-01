# Pipeline GPS — abonnements, essai 45 j, facturation & fiche résidence

Vision produit Primexpert **V3.8** — pipeline RPA protégé, capitalisation RNE/TGA centralisée.
**Hosting prod :** https://primexpert-app-v2.web.app  
**Journal détaillé :** [`MEMORY.md`](./MEMORY.md) — source primaire des statuts de chantier.

---

## A. Flux courtier — abonnement (billing)

```text
Inscription (Auth + users/{uid})
    ↓
Saisie carte Stripe (Customer + PaymentMethod)     [futur]
    ↓
trialStartDate → Essai 45 jours gratuits
    ↓
Relances J+7, J+21, J+30, J+40                    [partiel — voir ci-dessous]
    ↓
J+38 : facture PDF Ghost Billing                   [PDF manuel / sample OK]
    ↓
J+45 : prélèvement Stripe
    ├─ Succès → billingStatus: active
    └─ Échec  → grace_period + gracePeriodStartedAt
                    ↓
              72 h sans régularisation
                    ↓
              suspended → SuspendedAccountScreen
                    ↓
              Paiement portail Stripe → active (webhook)
```

### États `billingStatus` (Chérif)

| État | Expérience |
|------|------------|
| `active` | Workhub normal |
| `grace_period` | `GracePeriodBanner`, accès 72 h |
| `suspended` | Écran plein écran + Stripe Portal |

**Exemption :** `role === admin_system`.

### Relances courriel

| Jalon | `lastEmailSent` | Statut code |
|--------|-----------------|-------------|
| J+7 | `J7` | ✅ Modal + enquête + outbox support |
| J+21 | `J21` | ✅ `maybeSendJ21NurtureEmail` + templates |
| J+30 | `J30` | ⏳ |
| J+40 | `J40` | ⏳ |

Transport : Postmark / SendGrid ou `email_outbox` + Function expéditeur.

### Facturation Ghost Billing

| Ligne | Montant |
|--------|---------|
| Sous-total | 175,00 $ |
| TPS 5 % | 8,75 $ |
| TVQ 9,975 % | 17,46 $ |
| **Total** | **201,21 $** |

Code : `computeQuebecTaxes()`, `downloadInvoicePdf()`.

---

## B. Pipeline fiche résidence (Radar → CFO)

```text
Prospection / mandat (residences/{id} — status pipeline)
    ↓
Migration Copilote (optionnel)
    migrate_financial_subcollections.js
    → financial/dataV2 + documents/*
    ↓
Fiche V2 (Listings → ResidenceDetail)
    ├─ Synthèse          [✅ Synthese360Tab — rétribution affichée, C-73.2, notes]
    ├─ Identité          [✅ doc racine + core/identity + courtier responsable `courtiersResponsables`]
    ├─ Parties           [✅ PartiesIntervenantsSection ↔ organizations/…/contacts]
    ├─ Hub Finance       [✅ dataV2 + 5 sous-onglets + master panel PDF — SSOT prix/RNE `d232673`]
    ├─ Déclaration       [✅ DeclarationVendeurTab — OACIQ]
    ├─ Marché            [✅ MarcheConcurrenceTab]
    ├─ Documents         [✅ Espace Documents + scan + parse IA Vertex + distribution / courriel]
    ├─ Intelligence      [✅ call_analyses + courriels email_threads/messages (ex-mailbox_analyses)]
    ├─ Accès Vendeur     [✅ bouton fiche → /acces-vendeur — timeline + jauge mandat + docs]
    └─ Promesse          [✅ PromesseAchatTab — offre SSOT + conditions & délais RPA + clôture + assembleur contrat V3.5]
```

**Accès Vendeur (portail autonome V2.8) :**

```text
ResidenceDetail — « Ouvrir l'Accès Vendeur » ou « Copier le lien invité »
    ↓ createVendorPortalInvite → vendor_portal_invites/{token} (30 j)
Route /acces-vendeur?token=… (mode client — customToken Firebase)
    ↓ validateVendorPortalToken
AccesVendeurPage — catalogue 85 pièces, jauge conformité, téléversement
    ↓ uploadSource: vendor_portal → notifyVendorPortalDocumentUpload → tâche org courtier
Core vendorPortalCatalogue + vendorPortalCompliance + vendorPortalTimeline
```

**Inscriptions :** vue **pipeline** en **4 colonnes** (prospect · mandat · promesse · vendu) ; statut `expired` conservé en données mais **hors** colonnes actives (`PIPELINE_ACTIVE_STATUSES`). **Phase 2 (2026-05-24)** : totaux $ + commissions par colonne, badge conformité mandat, **drag-and-drop** (`@hello-pangea/dnd`), filtres **régions Québec** (portal), blocage DnD vers `promise` sans `prixAccepte`.

### Pipeline Espace Documents (diligence)

```text
Téléversement (Financier | Technique | Légal)
    → Storage primexpert/{brokerId}/properties/{id}/documents/{category}/…
    → Firestore documents/{docId} — virusScanStatus: pending
    → propertyDocumentScanDocument (callable)
        ├─ infected → blocage téléchargement
        └─ clean → parsingStatus: pending (si Financier + parsingEligible)
    → propertyDocumentParseIA (Vertex AI — gemini-2.0-flash-001)
        ├─ completed → extractedData (montants, taxes, revenus, dépenses…)
        └─ failed → parsingError (réconciliation auto pending/failed à l’ouverture onglet)
```

**Infra Vertex (primexpert-app-v2) :** API `aiplatform.googleapis.com`, IAM `roles/aiplatform.user` sur `250702494735-compute@developer.gserviceaccount.com`, auth **ADC** (pas de clé JSON en prod).

### Statuts pipeline (`ResidenceStatus`)

`prospect` → `mandate` → `promise` → `sold`  
Branches : `expired`, `unsigned`

**Ne pas renommer** (charte Copilote / export). Le **Kanban « Mes inscriptions »** n’affiche que les statuts **actifs** (`PIPELINE_ACTIVE_STATUSES` : sans `expired`).

**Protection Kanban (2026-06-01 — certifié)** : `resolveColumnId()` dans `src/config/pipelineStages.ts` — couverture tests **100 %** (`resolveColumnId.test.ts` + `scripts/check-resolveColumnId-coverage.mjs`). Aucun statut actif (`ACTIVE_PIPELINE_RAW_STATUTS`) ne doit retourner `null`.

### Promesse acceptée — 7 délais légaux (SSOT `promesseAchatEngine.ts`)

Dès qu’une PA passe à **`accepted`** (statut Kanban `pa-acceptee` → colonne `promise`), le moteur calcule **7 échéances critiques** via `PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS` :

1. `dateLimiteReponse` — délai réponse offre  
2. `dateLimiteVisiteLieux` — visite des lieux  
3. `dateLimiteVerificationDocuments` — vérification documents  
4. `dateLimiteInspection` — inspection  
5. `dateLimiteFinancement` — financement  
6. `dateLimitePermis` — permis MSSS  
7. `dateLimiteDeduitLci` — **dédit LCI art. 73.2** (`DEDIT_LCI_ART_73_2_JOURS` = **3 jours calendaires**)

Tests bloquants CI : `npm run test:rpa-coverage` (workflow `.github/workflows/rpa-transaction-test-coverage.yml`).

### Données financières (Hub)

```text
financial/dataV2 (Firestore)
    ↓
normalizeFinancialData()
    ↓
├─ Bilan exécutif (KPI CFO, TP70, rapports)
├─ Revenus & Dépenses (grille CPA, preuves A2)
├─ Finançabilité (DSCR, SCHL / APH Select)
├─ Ratios performance
└─ Vérification 360° (manque à gagner, capitalisation)
```

Sans `dataV2` : messages institutionnels + chiffres dérivés de `price` uniquement où applicable.

**Capitalisation RNE/TGA (2026-06-01 — certifié)** : toutes les conversions revenu net d'exploitation (RNE) ↔ valeur ↔ taux de capitalisation (TGA) passent par `packages/core/src/financial/capitalization.ts`. Consommateurs alignés : Hub Finance (`revenusDepensesPreview`, Finançabilité, Analyse 360°), ACM, comparables Centris / Matrix (`centrisComparableCapRate`) et flywheel analytique vendored (`functions/src/analytics/_vendored/capitalization.ts`).

---

## C. Intégration actuelle (code)

| Composant | Statut |
|-----------|--------|
| Garde billing + suspension | ✅ |
| Bandeau `grace_period` | ✅ |
| Résolution 72 h client | ✅ |
| PDF + taxes QC | ✅ |
| Fiche résidence + Hub Finance | ✅ |
| Identité fusionnée | ✅ |
| Intelligence chronologie + rapport vendeur | ✅ |
| Priorités suivi KISS (J+3/J+5/J+7) dashboard | ✅ |
| Espace Documents + parse IA Vertex | ✅ |
| UI institutionnelle (`primexpert-*`, coquilles onglets) | ✅ |
| Inscriptions Kanban + cartes institutionnelles | ✅ |
| Inscriptions — DnD pipeline + filtres régions QC | ✅ Phase 2 — `6d31058` |
| Inscriptions — totaux colonnes + conformité mandat | ✅ Phase 1 — `6d31058` |
| Onglet Synthèse 360 + notes `residences/{id}/notes` | ✅ |
| Déclaration, Marché, Promesse (cockpit PA + `offre` SSOT) | ✅ |
| Webhooks Stripe → Firestore | ⏳ |
| Cron relances J30/J40 | ⏳ |
| Stripe Customer Portal prod | ⏳ env |
| Cloud Functions Nylas | ✅ déployées (us-central1) |
| Webhook Nylas — signature HMAC (Loi 25) | ✅ `verifyNylasWebhookSignature` — POST non signé → 401 |
| Email Center — SSOT `email_threads` / `messages` | ✅ Phase 1 — analyse à l’ingestion, `mailbox_analyses` déprécié |
| **Email Center — liaison message ↔ contact CRM** | ✅ **Phase 2 Option A** — `matchedContactId`, `MailContactLinkBar`, chronologie contact |
| Bibliothèque documents marché + parse IA | ✅ `marketDocumentParseIA`, `MarketLibraryDashboard` |
| Benchmark finance global (callable) | ✅ `getGlobalFinancialBenchmark` |
| Diffusion Web — vendor prebuild + `tsc` | ✅ `sync-core-diffusion` + `financialCalcTypes` |
| Promesse d'achat — persistance `offre` / DRY | ✅ `serializeOffreForFirestore`, merge objet complet |
| CRM — répertoire contacts LCI | ✅ `organizations/{orgId}/contacts` — tiers, documents, coacheteurs/covendeurs |
| **Accès Vendeur** | ✅ Portail autonome — catalogue 85 pièces, jeton 30 j, alertes téléversement (`f9a4f23`) |
| **Briefing du matin** | ✅ `morningBriefingGenerator` cron 06:00 + `Dashboard.tsx` (`194a5ea`) |
| **Radar off-market** | ✅ `prospects_radar` — signaux occupation / certification CIUSSS (`194a5ea`) |
| **Recherche CRM / inscriptions** | ✅ `contactSearch.ts` + filtres villes (`0b2a1c5`, `4aca59c`) |
| **Routage SPA** | ✅ `AuthenticatedApp.tsx` — lazy chunks, `/acces-vendeur?token=` (`c407c60`) |
| **Migration contacts Maillon 1** | ✅ `legacyContactImport.ts` + dry-run ; qualification stricte ; **`--execute` sur approbation PO** |
| Parties résidence ↔ CRM | ✅ `partiesImpliquees` + `linkContactToResidence` (writeBatch) |
| Identité — courtier responsable | ✅ `ResponsibleBrokerCard` → `courtiersResponsables` |
| Hub Finance — master panel & rapports PDF | ✅ `FinanceHubMasterPanel`, glossaire Québec |
| Diffusion Web — enrichissements publics | ✅ `publicBuyerDisclosures`, `transactionBanner`, aperçu brouillon |
| **Messagerie ↔ CRM (Phase 2)** | ✅ `MailContactLinkBar`, `matchedContactId`, liaison optimiste, chronologie par contact |
| **Mes inscriptions Phase 2** | ✅ DnD Kanban, filtres régions QC, totaux colonnes, badge conformité mandat |
| **Statistiques du marché (Big Data)** | ✅ `MarketLibraryDashboard`, parse Vertex massif (2 GiB / 540 s), injection HITL idempotente |
| **Benchmark finance global** | ✅ `getGlobalFinancialBenchmark`, hook `useGlobalFinancialBenchmark` |
| **Anti-doublons Big Data** | ✅ `marketDeduplication.ts` — merge par empreinte sur `market_analytics_raw` / `market_macro_stats` |
| **Copilote négociation V2.6** | ✅ core `negotiationEngine` + Vertex `negotiationWithVertex` — HITL `manualVerifications` |
| **Après-vente closing V2.7** | ✅ core `closingEngine.ts` — trigger `onPromiseAcceptedTrigger` **planifié** |
| **Loi 25 consentement CRM** | ✅ `QuebecLaw25Consent` + `validateLaw25Compliance` — garde-fous SMS/courriel **planifiés** |
| **Rédacteur IA Centris** | ✅ `ContentGen.tsx` + lint `@primexpert/core/narrative` |
| **VoIP Twilio** | ⏳ parallèle — non déployé prod |
| **Assembleur contrat V3.5+** | ✅ `@primexpert/core/forms` + `ContractAssemblerPanel` — export HTML natif ; commit `63286dc` |
| **Capitalisation RNE / TGA** | ✅ `capitalization.ts` — SSOT Hub Finance, ACM, Centris, flywheel (`c33c109`) |
| **Tests transaction RPA** | ✅ `npm run test:rpa-coverage` — `resolveColumnId()` 100 % + 7 délais PA acceptée (`38a7779`) |

### Statut production certifié (conseil d’administration — 2026-05-28)

| # | Volet | Statut |
|---|-------|--------|
| 1 | Cœur CRM & fiches RPA | **OPÉRATIONNEL — LIVE** |
| 2 | Workspace évaluation ACM | **OPÉRATIONNEL — LIVE** |
| 3 | Hub omnicanal (SMS / Nylas / notes vocales) | **OPÉRATIONNEL — LIVE** |
| 4 | Moteur clauses OACIQ / LOI (V2.6) | **CÂBLÉ — PROD ACTIVE** |
| 5 | Après-vente & conformité Loi 25 (V2.7) | **CÂBLÉ — trigger prod planifié** |
| 6 | Portail vendeur autonome — 85 pièces (V2.8) | **OPÉRATIONNEL — LIVE** |
| 7 | Briefing matin + radar off-market (V2.8) | **OPÉRATIONNEL — LIVE** |

---

## D. Jalons session 2026-05-20 — trois chantiers (fin de session)

Commits poussés sur `main` : `b9fe455`, `0e64e83`, `1c4f3c6`, `9b8a70c`, `da105ca`.

### Chantier 1 — CRM & répertoire client (`b9fe455`)

| Jalon | Détail |
|-------|--------|
| **SSOT contacts** | `organizations/{orgId}/contacts` — interdit `clients/`, `vendors/`, `buyerPipeline/` |
| **Qualification acheteur** | `buyerCriteria` + pièces Storage ; typologie `deriveBuyerTier` (privilégié / confidentiel) |
| **Qualification vendeur** | `sellerCriteria` — contrat courtage, titre, déclaration ; mandat corporatif partagé |
| **Coacheteurs / covendeurs** | `coBuyerIds` / `coSellerIds` — liaison bidirectionnelle writeBatch (`coBuyers.ts`, `coSellers.ts`) |
| **UI Workhub** | `ContactsListPage`, `ContactFormDrawer`, filtres, `BuyerTierBadge` |
| **Import legacy** | `scripts/migrate-legacy-contacts-to-v2.mjs` |
| **Chronologie** | `contactTimeline.ts` + `communicationTimelineService.ts` dans le drawer |

### Chantier 2 — Messagerie & promesse (`1c4f3c6`, `9b8a70c`)

| Jalon | Détail |
|-------|--------|
| **Promesse d'achat (PA)** | Refactor DRY (`packages/core/src/transaction/`) ; persistance Firestore `offre` **complet** ; `undefined` → `null` sur `promesseAchat` |
| **Sécurité webhook Nylas** | Vérification `x-nylas-signature` + `NYLAS_WEBHOOK_SECRET` ; test `test-nylas-webhook-signature.cjs` |
| **Unification SSOT Email** | Suppression `Mailbox.tsx` (UI morte) ; `MailboxContainer` seul ; analyse sur `messages` à l’ingestion |
| **Diffusion Web (prebuild)** | Vendoring `@primexpert/core/diffusion` + stub `financialCalcTypes` ; build Functions `tsc` propre |

### Chantier 3 — Fiche résidence & finance (`0e64e83`, `b9fe455`, `955410e`, `d232673`)

| Jalon | Détail |
|-------|--------|
| **Courtier responsable** | `ResponsibleBrokerCard` dans Identité — `courtiersResponsables` |
| **Parties intervenants** | `PartiesIntervenantsSection` — rôles VENDEUR/ACHETEUR/NOTAIRE/COLLABORATEUR |
| **SSOT inter-onglets** | `ResidenceDataContext` — prix, unités, hints finance (`955410e`) |
| **Hub Finance** | Master panel, verrouillage contexte, rapports PDF certifiables ; cohérence RNE/prix/emprunt+MFR (`d232673`) |
| **Diffusion (front)** | Divulgations acheteur, bannière transaction, modal aperçu brouillon |

### Pipeline CRM — répertoire & liaisons

```text
Workhub → ContactsListPage (filtres ownerId, silo, tier, recherche LCI)
    ↓
ContactFormDrawer — création / édition organizations/{orgId}/contacts/{id}
    ├─ LCI + legalVerification + communicationPreferences (Loi 25 / LCAP)
    ├─ Acheteur : buyerCriteria + upload buyer_documents/{kind}/
    ├─ Vendeur : sellerCriteria + upload seller_documents/{kind}/
    ├─ linkCoBuyer / linkCoSeller → writeBatch sur 2 fiches (coBuyerIds ↔ coSellerIds)
    └─ Chronologie : email_threads/messages + résidences liées
    ↓
PartiesIntervenantsSection (fiche résidence)
    → linkContactToResidence → partiesImpliquees + contact.residenceIds (writeBatch)
```

### Pipeline messagerie (SSOT — Phase 1 + 2 Option A)

```text
Nylas webhook (signature validée)
    → syncNylasMessageToFirestore
    → users/{uid}/email_threads/{threadId}
    → messages/{messageId} + champs analyse (matchedResidenceId, mailContactEmail, mailIntent, summaryOneLine…)
    → @primexpert/core/mail (heuristique + match inventaire residences)
    ↓
Workhub MailboxContainer (lecture temps réel)
    ├─ MailContactLinkBar — « Lier au dossier client » / « Créer un contact »
    ├─ Auto-liaison si courriel = un seul contact CRM
    └─ linkEmailThreadToContact → matchedContactId (fil + messages)
    ↓
ContactFormDrawer — chronologie omnicanale (matchedContactId OU courriel)
Intelligence / Dashboard (lecture collectionGroup messages via mailboxAnalysis.ts)
```

### Pipeline Statistiques du marché (Big Data)

```text
Workhub → Statistiques du marché (MarketLibraryDashboard)
    ↓
Upload PDF → Storage primexpert/{brokerId}/market_documents/{fileName}
    → Firestore market_documents/{docId}
    ↓
marketDocumentParseIA (Vertex — 2 GiB RAM, timeout 540 s)
    → extractedData omnivore (macro / transactions / ratios)
    ↓
HITL courtier — coche régions, transactions, benchmarks
    ↓
injectMarketMacroStats
    → empreinte déterministe (marketDeduplication.ts)
    → set(merge: true) → market_macro_stats / market_analytics_raw
    → marketSnapshots/v1 (append dédupliqué)
    → UI : « X nouvelles transactions, Y doublons ignorés »
```

---

## G. Session 2026-05-20 (soir) — Analyse de mise en marché (ACM) résidence (`c1b5e62` → `e1a900c`)

| Jalon | Détail |
|-------|--------|
| **Parcours** | ACM intégré onglet **Marché** fiche résidence — plus de formulaire isolé sans SSOT |
| **Libellé PO** | **Analyse de mise en marché (ACM)** |
| **Finances** | `financial/dataV2.calculatedResults` → RBE, RNE, prix demandé injectés dans le moteur |
| **TGA** | Médiane GPS `gpsCapRateByRegionClass.ts` (région + classe RPA) ; **éditable** par le courtier ; recalcul live prix/scénarios |
| **Territoire** | Unités secteur, rayon `marketScope`, population 75+ depuis `residenceDoc` |
| **Sprint 0** | CSV comparables, stress tests, PDF vendeur, panneau vérification EEE (`c1b5e62`) |
| **Prod** | `primexpert-app-v2.web.app` — HEAD `e1a900c` validé PO |

```text
Fiche résidence → Onglet Marché
    → FinancialDataProvider (dataV2)
    → ResidenceDocumentProvider (competitors, démographie, classe)
    → bootstrapResidenceAcm() + useMarketData (transactions GPS)
    → AcmValuationWorkspace (TGA éditable, prix suggéré instantané)
    → AcmTab (PDF présentation)
```

---

## F. Session 2026-05-24 — Option A + inscriptions + marché (`6d31058`)

| Jalon | Détail |
|-------|--------|
| **Option A livrée** | Boucle fermée courriel → contact → chronologie ; UI optimiste ; index `brokerId` + `matchedContactId` |
| **Mes inscriptions Phase 2** | Kanban DnD, filtres régions, totaux colonnes, badge mandat incomplet |
| **Finance & marché** | Benchmark global, bibliothèque Statistiques du marché, enrichissement Revenus & Dépenses |
| **Anti-doublons Big Data** | Empreintes Firestore + merge idempotent ; compteur UI doublons ignorés |
| **Parse massif PDF** | `marketDocumentParseIA` 2 GiB / 540 s ; spinner UI ~3 min |
| **Déploiement prod** | hosting + firestore + functions + storage sur `primexpert-app-v2` |

---

## G. Session 2026-05-28 — Mobile Phase 2 + CRM Storage

| Jalon | Détail |
|-------|--------|
| **CRM Storage** | `migrateLegacyContacts.ts` — 90 contacts → `organizations/…/contacts` ; 87 `QUALIFIED` (Matchmaker) |
| **Matchmaker** | `raphaelEngine.ts` — panneau pleine largeur sous notes Bilan 360° |
| **Notes vocales** | `voice_notes/` Storage → `onVoiceNoteUploaded` (us-east1) → `residences/…/notes` + `tasks` |
| **Hub omnicanal** | `email_threads` enrichi (`channel`, urgence) ; webhooks Twilio/Meta Montréal — **ACTIVE prod** |
| **VoIP / finance** | Twilio token + saisie manuelle Hub — parallèle, non prod |

```text
Mobile courtier
  → AudioRecorderButton (Synthèse 360°)
  → Storage voice_notes → onVoiceNoteUploaded → note + tâche résidence

SMS entrant (Twilio)
  → twilioSmsWebhook (Montréal)
  → ingestOmnichannelMessage → email_threads + tasks org si critique
  → CommunicationHub (fiche contact Intelligence)
```

---

## H. Session 2026-05-28 — GO-LIVE V2.5 → V2.7

| Jalon | Détail |
|-------|--------|
| **GO-LIVE V2.5** | Conseil **[GO]** — CRM RPA, ACM+HITL, hub omnicanal V1 déployés |
| **Copilote V2.6** | `oaciqSpecsTypes`, `negotiationEngine`, `negotiationWithVertex` — modes OACIQ / LOI |
| **Après-vente V2.7** | `closingEngine.ts`, `QuebecLaw25Consent` — voir [`CLOSING_AND_COMPLIANCE_DRAFT.md`](./CLOSING_AND_COMPLIANCE_DRAFT.md) |
| **Centris RESO** | Draft mapping OData — [`CENTRIS_RESO_MAPPING_DRAFT.md`](./CENTRIS_RESO_MAPPING_DRAFT.md) |
| **URL prod** | https://primexpert-app-v2.web.app |

### Pipeline copilote négociation (V2.6)

```text
Courtier — contexte clause (fiche / promesse / contact)
    → buildNegotiationSystemPrompt + buildNegotiationUserPrompt
    → Gemini JSON (navigateur VITE_GEMINI_API_KEY ou Vertex negotiationWithVertex)
    → parseNegotiationLlmJson + validateNegotiationOutput (negotiationEngine)
    → brouillon HITL manualVerifications (kind: commercial_negotiation_clause)
    → validation humaine obligatoire avant insertion contrat / envoi
```

Modes : `OACIQ_FORM` · `CUSTOM_CONTRACT` · `LETTER_OF_INTENT`.

### Pipeline après-vente closing (V2.7 — conception)

```text
promesseAchat.statut → accepted (+ prixAccepte validé)
    → onPromiseAcceptedTrigger (northamerica-northeast1) [planifié]
    → generateClosingSequenceTasks (closingEngine.ts)
    → residences/{id}/tasks (source: closing_pipeline, closingPackId idempotent)
    → J+1 dossier hypothèque · J+2 inspection · J−10 notaire
```

Garde-fou Loi 25 : `validateLaw25Compliance(contact.communicationPreferences.law25Consent)` avant SMS/courriel sortant.

### Pipeline assembleur de mandats (V3.5 — scellé `63286dc`)

```text
Onglet Promesse → ContractAssemblerPanel
    → buildContractAssemblerDefaults (RNE ÷ TGA ACM, resolveCanonicalRne)
    → saisie champs entre parenthèses : ( $ ) ( % ) CCV-
    → sélection annexes : contrat courtage · annexe prix · G · R · promesse actifs
    → renderContractAssemblerToHtml (+ renderPaActifsToHtml si coché)
    → export HTML navigateur (print / PDF local)
```

**Règle #0 :** aucun docxtemplater ; legacy Copilote `docxGenerator.js` non réintroduit. Persistance Firestore état assembleur — planifiée été 2026.

### Cloud Functions — régions canoniques

| Fonction / groupe | Région | Secrets / notes | Statut |
|-------------------|--------|-----------------|--------|
| Nylas, documents parse, benchmark, diffusion | `us-central1` | Nylas, Vertex ADC | DEPLOYE |
| `twilioSmsWebhook`, `metaMessagingWebhook` | `northamerica-northeast1` | TWILIO_AUTH_TOKEN, META_VERIFY_TOKEN | DEPLOYE |
| `onVoiceNoteUploaded` | `us-east1` | OPENAI_API_KEY ou Gemini STT | DEPLOYE |
| `negotiationWithVertex` | `us-central1` | Vertex ADC | CABLE |
| `onPromiseAcceptedTrigger` | `northamerica-northeast1` | — | PLANIFIE |
| `morningBriefingGenerator` | `us-central1` (scheduler) | — | DEPLOYE |
| `createVendorPortalInvite`, `validateVendorPortalToken` | `us-central1` | — | DEPLOYE |
| VoIP `getTwilioToken`, `twilioVoiceResponse` | `us-central1` | Twilio | PARALLELE |

---

## I. Session 2026-05-29 — Portail vendeur V2.8, briefing, radar (`c407c60` → `194a5ea`)

| Jalon | Détail |
|-------|--------|
| **Portail vendeur autonome** | Catalogue 85 pièces ; lien invité 30 j ; mode client sans Google courtier |
| **Briefing matin** | Cron 06:00 Toronto ; tâches critiques + RDV + hot leads top 3 |
| **Radar off-market** | `occupancy_drop` + `certification_expiry` → `prospects_radar` |
| **Bilan 360°** | Prix demandé / commissions éditables ; nœuds canoniques HITL |
| **SPA** | Split `App.tsx` / `AuthenticatedApp.tsx` ; lazy loading Workhub |

### Pipeline briefing du matin

```text
Cron morningBriefingGenerator (06:00 America/Toronto)
    → scan organizations/{orgId}/tasks (ownerId, a_faire)
    → scan contacts QUALIFIED + messages email_threads récents (hot leads)
    → buildMorningBriefing (@primexpert/core/crm)
    → set organizations/{orgId}/morning_briefings/{brokerId}
    ↓
Dashboard.tsx — loadMorningBriefingDashboardData (persisté ou recalcul client)
```

### Pipeline radar off-market

```text
Cron (même batch briefing)
    → scan residences (courtiersResponsables) — tauxOccupation, certificationDueMillis
    → scoreRadarOpportunities (radarOpportunitesEngine.ts)
    → merge organizations/{orgId}/prospects_radar/{residenceId}__{signalType}
    ↓
Dashboard — fetchProspectsRadar — tri par score
```

---

## E. Prochaines priorités (au choix du PO — prochaine session)

| Option | Thème |
|--------|--------|
| ~~**A**~~ | ~~Phase 2 Email Center — rattachement message → contact CRM~~ **✅ livré 2026-05-24** |
| ~~**E (contacts)**~~ | ~~Maillon 1 contacts `--execute`~~ **✅ Storage 90 contacts 2026-05-28** |
| **B** | Module ACM — **base résidence livrée** ; suite : ingestion Centris/Matrix, comparables liés fiche |
| **C** | Coffre-fort WORM OACIQ — règles Firestore verrouillage 6 ans (documents « Final ») |
| **D** | Mes inscriptions Phase 3 — actions bulk, export pipeline, alertes stagnation |
| **F** | Brancher `onPromiseAcceptedTrigger` + garde-fous Loi 25 sur messagerie sortante |
| **G** | Migration maillons 2+ — résidences, finance, documents Storage |
| **H** | Coffre WORM 6 ans + validateur photo profil > 5 ans (exigences charte RTF) |
| **I** | Connecteur OData Centris exécutable (`listings_cache` → `residences`) |

### Backlog technique (inchangé)

1. **Stripe** : webhook `invoice.payment_failed` → `grace_period` ; succès → `active`.
2. **Cron** : `grace_period` → `suspended` après 72 h ; relances J30/J40.
3. **Documents** : enrichir `extractedData` → préremplissage Hub Finance / preuves A2.
4. **Vertex** : surveiller cycle de vie `gemini-2.0-flash-001`.
5. **Déploiement** : `firebase deploy --only hosting,firestore,functions,storage` — commit `6d31058` déployé 2026-05-24.

---

---

## J. Session 2026-05-30 — Assembleur de mandats V3.5 (`63286dc`)

| Jalon | Détail |
|-------|--------|
| **Moteur natif** | `packages/core/src/forms/` — HTML sans OpenXML ; alias `@primexpert/core/forms` |
| **Parenthèses typées** | `annexeFieldSchema.ts` — prix `( $ )`, commission `( % )`, référence `CCV-` |
| **UI** | `ContractAssemblerPanel.tsx` — onglet Promesse ; export dossier HTML |
| **Couplage ACM** | Defaults prix annexe depuis RNE ÷ taux de capitalisation global (TGA) territorial |
| **Legacy** | docxtemplater Copilote identifié et expulsé — zéro duplication V2 |
| **Git** | `63286dc` → `origin/feature/v2.8-market-stats-optimization` ; build racine exit 0 |

---

## K. Session 2026-06-01 — Protection RPA + clôture capitalisation (`38a7779` → `c33c109`)

| Jalon | Détail |
|-------|--------|
| **Kanban protégé** | `ACTIVE_PIPELINE_RAW_STATUTS` + `resolveColumnId()` couvrent slugs Firestore, Copilote, Centris/RESO et variantes FR ; `expired` / archives restent hors pipeline actif. |
| **CI bloquante** | `.github/workflows/rpa-transaction-test-coverage.yml` lance `npm run test:rpa-coverage` sur PR/push ciblés ; `scripts/check-resolveColumnId-coverage.mjs` exige 100 % sur `resolveColumnId()`. |
| **PA acceptée** | `PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS` garantit les 7 échéances critiques (`dateLimiteReponse`, visite, documents, inspection, financement, permis, dédit LCI C-73.2). |
| **RNE/TGA SSOT** | `capitalization.ts` centralise `resolveNetOperatingIncome`, `computeCapitalizationRatePct`, `computeCapitalizationRateDecimal`, `capitalizeNoiAtCapRatePct`. |
| **Flywheel Functions** | `sync-core-analytics-flywheel.cjs` vendore aussi `capitalization.ts` dans `functions/src/analytics/_vendored/`. |

```text
Statut brut inscription / PA
    → resolveColumnId(raw)     [jamais null pour les statuts actifs connus]
    → colonne Kanban canonique
    → si pa-acceptee / accepted
        → buildPromesseAchatViewModel
        → PA_ACCEPTEE_CRITICAL_DEADLINE_KEYS (7 champs)
        → validation Vitest + CI
```

```text
RBE / dépenses / RNE / prix
    → resolveNetOperatingIncome
    → computeCapitalizationRatePct ou capitalizeNoiAtCapRatePct
    → Hub Finance · ACM · comparables Centris · flywheel
```

---

*Dernière mise à jour : 2026-06-01 — V3.8 RNE/TGA (`c33c109`) + transaction RPA CI (`38a7779`).*
