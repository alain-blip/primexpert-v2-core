# Primexpert — mémoire de décisions (journal)

> **Emplacement canonique (code + doc jumeaux) :**  
> `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/docs/`  
> Miroir possible : `00_PRIMEXPERT_SYSTEME_APP/docs/` sur le disque de sauvegarde.

---

## Règle linguistique — langage des affaires (Québec)

**Règle maîtresse** pour toute UI, libellé, bouton, rapport et documentation **visible par l’utilisateur ou le client** (vendeur, acheteur, courtier).

### Purge du lexique européen

- **Interdit à l’écran** : le mot **« audit »** (trop académique / européen pour le marché québécois).
- **Remplacer par** (selon le contexte) : **vérification**, **conformité**, **diligence**, **diligence raisonnable**, **preuves de conformité**.

### Ton et verbes d’action (exemples)

- Boutons / états : *Vérification*, *Certification*, *Verrouillage*, *Preuves de conformité*, *Journal de conformité* (pas « journal d’audit »).
- Analyse financière 360° : parler de **vérification de performance** ou **analyse 360°**, jamais « audit 360° » côté client.
- Registres OACIQ / coffre-fort : **journal de conformité**, **traçabilité**, **conservation 6 ans**.

### Abréviations — jamais seules

- **Interdit à l’écran** : une abréviation seule (`NOI`, `RBE`, `TGA`, `ACM`, `CPA`, etc.).
- **Format obligatoire** : **terme complet**, puis **abréviation entre parenthèses** — ex. *revenu net d’exploitation (RNE)*, *revenu brut effectif (RBE)*, *taux de capitalisation (TGA)*, *analyse comparative de marché (ACM)*, *comptable professionnel agréé (CPA)*.
- Même règle en anglais quand l’UI est bilingue : *net operating income (NOI)*, *effective gross income (EGI)*, etc.

### Portée technique

- Les **identifiants de code** (`computePerformanceAudit360`, `noiAudit`, `buildingAudit`, `auditSensitiveFields`, scripts ops `audit_tenant_uids.js`) peuvent rester en anglais interne tant qu’ils ne sont **pas exposés** dans l’UI.
- Toute nouvelle chaîne `t('…')`, `labelFr` / `labelEn`, titre de section ou message d’erreur utilisateur doit respecter cette règle **avant merge**.

*Référence Cursor : `.cursor/rules/quebec-business-language.mdc` (alwaysApply).*

---

## Règle #0 — SSOT métier

- **Toute logique financière, identité, valuation, mail parser** vit dans `packages/core/` (`@primexpert/core`).
- Les composants React **ne calculent pas** le cœur financier : ils consomment des view models (`computeBilanCfoViewModel`, `buildRevenusDepensesGrid`, `buildIdentityViewModel`, etc.). **Exception affichage** : onglet **Synthèse** et cartes **inscriptions** — cascade de **lecture** sur champs `residences` / formatage monétaire (pas de nouveau moteur dans `@primexpert/core`).
- Firestore listeners : `FinancialDataContext` → `residences/{id}/financial/dataV2` ; `ResidenceDocumentContext` → `residences/{id}`.

---

## Charte visuelle — fiche résidence & inscriptions (2026-05-19)

**Étalon :** cockpit institutionnel — encre sur fond **primexpert** (tokens Tailwind `tailwind.config.js` + `@config` dans `src/index.css`).

| Token | Usage |
|-------|--------|
| Fond panneaux / liste inscriptions | `bg-primexpert-blue` (`#2656b7`) — zone « Navigateur » |
| Cadres, titres, bordures fortes | `border-primexpert-dark`, `text-primexpert-dark` (`#142c6a`) |
| Fonds cartes / bandeaux neutres | `bg-primexpert-light` (`#f1f5f9`) ou blanc |
| Accent transaction (ex. promesse) | `primexpert-gold` (`#D4AF37`) |
| Valeurs chiffrées (Hub / fiches) | Contraste élevé — `text-black` / `font-black` sur fond clair |

Kit partagé : `src/lib/institutionalTheme.ts` + `src/components/residence/institutional/InstitutionalUi.tsx` (`inst`, `InstitutionalResidenceTabShell`, `InstitutionalSection`, `InstitutionalKpi`, `InstitutionalPlaceholder` si besoin).

**Inscriptions (« Mes inscriptions ») :** pipeline **4 colonnes** (prospect · mandat · promesse · vendu) — cartes `ListingInstitutionalCard` + view model `listingCardViewModel.ts` ; `PIPELINE_ACTIVE_STATUSES` exclut `expired` du Kanban chaud. **Phase 2 (2026-05-24)** : totaux colonnes ($ + commissions), badge conformité mandat incomplet, **drag-and-drop** Kanban (`ListingsPipelineKanban`, `@hello-pangea/dnd`), filtres **régions Québec** (`ListingsRegionFilterPanel`, portal `document.body`), règles core `listingCommission.ts`, `mandateCompleteness.ts`, `pipelineDragRules.ts`, `quebecRegions.ts`.

**Hotfix prod (2026-05-16) :** l’onglet Déclaration référençait encore `PlaceholderPanel` (supprimé) → `InstitutionalPlaceholder` ; commit `0a65adf`.

---

## Fiche résidence V2 — phases livrées

### Phase 3 — Hub Finance (`FinanceHubTab`)

| Sous-onglet | Phase | Core |
|-------------|-------|------|
| Bilan exécutif | 3a | `bilanCfoView.ts` |
| Revenus & Dépenses | 3b | `revenusDepensesGrid.ts` |
| Finançabilité | 3c | `computeFinancabilite.ts` (SCHL Standard / APH Select) |
| Ratios performance | 3d | `performanceRatios.ts` |
| Vérification 360° (UI ; code : `financialOptimization360`) | 3d | `financialOptimization360.ts` |

Données : sous-collection **`residences/{id}/financial/dataV2`** (migration depuis Copilote via `migrate_financial_subcollections.js`).

### Phase 4a — Identité fusionnée

- Package `packages/core/src/identity/`
- UI : `IdentiteImmeubleTab` + sections (`EditableIdentitySection`, `RentPricingTableSection`, `EditableCapacitySection`, `BuildingAuditPanel`, etc.)
- **Confort 66+ (2026-05-19)** : édition inline sans bouton « Modifier » ; sauvegarde `onBlur` via `ResidenceDocumentContext.updateResidence` ; libellés `text-[13px] font-black uppercase text-[#142c6a]`
- Purge doublons UI : `RegulatoryFrameworkPanel`, `ServicesRecognitionSection` retirés de l’onglet (données conservées en doc racine)
- Badge MSSS : `RaphaelBadge.tsx`
- Contexte : `ResidenceDocumentProvider`

### Phase 4b — Espace Documents (`DocumentsDiligenceTab`)

- UI 3 colonnes : **Financier / Technique / Légal** (`DocumentCategorySidebar`, upload, métadonnées).
- Firestore : `residences/{id}/documents/{documentId}` — `virusScanStatus`, `parsingStatus`, `extractedData`.
- Storage : `primexpert/{brokerId}/properties/{propertyId}/documents/{category}/{fileName}`.
- Sécurité MVP : PDF, XLSX/XLS, DOCX uniquement ; téléchargement si `virusScanStatus === 'clean'`.
- Dossier **Financier** : après scan `clean` → parse IA Vertex (`gemini-2.0-flash-001`, `us-central1`).
- Cloud Functions : scan, parse, réconciliation scan/parse (callable authentifiés).
- **Auth Vertex en prod** : ADC du compte de service Cloud Run (`250702494735-compute@…`) — **pas** de clé JSON ni `GOOGLE_APPLICATION_CREDENTIALS` en production.
- API GCP : `aiplatform.googleapis.com` + IAM `roles/aiplatform.user` sur le compte compute.
- Client : `functions/src/services/vertexClient.ts` ; erreurs typées (`VERTEX_API_DISABLED`, `VERTEX_MODEL_NOT_FOUND`, …).
- Réconciliation UI : relance automatique des docs `pending` ou `failed` à l’ouverture de l’onglet.

### Phase 4c — Onglets fiche résidence (Synthèse, Déclaration, Marché, Promesse)

- **Synthèse** : `Synthese360Tab` — bilan exécutif, bloc rétribution (lecture champs + affichage), jalons Loi sur le courtage immobilier (C-73.2) J+3 / J+180, notes `residences/{id}/notes`
- **Déclaration** : `DeclarationVendeurTab` — questionnaire OACIQ, coquille institutionnelle
- **Marché** : `MarcheConcurrenceTab` — marché & concurrence, coquille institutionnelle
- **Promesse** : `PromesseAchatTab` — cockpit promesse d'achat (Sprints 5.1–5.4)
  - **SSOT** : `packages/core/src/transaction/` — `offreTronc.ts`, `offreConditions.ts`, `offreCloture.ts`, `promesseAchatEngine.ts`
  - **Firestore** : objet racine `offre` (tronc financier + conditions + clôture) ; bloc `promesseAchat` (statut, dates, délais en jours, commission, collaborateurs, documents)
  - **UI** (`src/components/residence/promesse/`) : `OffreTroncFinancierSection`, `OffreConditionsLegalesSection`, `OffreClotureRetributionSection`, `PromesseDelaisPaSection` (jours éditables → dates calculées), `PromesseCommissionPaSection`, `PaConfortPanel` ; `TernaryToggle` partagé
  - **Épuration OACIQ (5.4)** : champs retirés de l’UI (Annexe 6, clause RNE/TGA, transfert fiducie, prorata MSSS) — clés core conservées pour migrations
  - **Sérialisation Firestore** : `undefined` → `null` sur `promesseAchat.delais.*` et commission (évite `Unsupported field value: undefined`)
  - **Écriture `offre`** : toujours envoyer l’objet `offre` complet via `serializeOffreForFirestore` (merge contexte = shallow ; un partial efface les autres clés)

### Intelligence (`ResidenceIntelligencePanel`)

- Composant **`IntelligenceChronologie`** : chronologie appels + courriels, guardrails NDA / mise de fonds.
- Données : `users/{uid}/call_analyses` ; courriels via **`email_threads/…/messages`** (métadonnées analyse — ex-`mailbox_analyses` déprécié).
- Lecture UI : `mailboxAnalysis.ts` + `communicationTimelineService.ts` (collectionGroup `messages`).
- Rapport vendeur anonymisé (`@primexpert/core/intelligence`).
- Boutons : rapport vendeur / mise à jour → `contentGenPrefill` + onglet ContentGen.
- Thème institutionnel (`InstitutionalResidenceTabShell` + tokens `primexpert-*`, 2026-05-19)

### Authentification — développement local (2026-05-19)

- En **`import.meta.env.DEV`**, connexion Google via **`signInWithPopup`** (évite les boucles `signInWithRedirect` sur localhost).
- Production : **`signInWithRedirect`** inchangé.
- `App.tsx` : navigation vers `/workhub` après session effective ; garde courte si `auth.currentUser` est défini avant le contexte React.

### Tableau de bord — Priorités de suivi KISS (2026-05-17)

- `PriorityFollowUpList` + `packages/core/src/intelligence/dashboardPriorityFollowUp.ts`.
- Jalons **J+3 / J+5 / J+7** sur le tableau de bord courtier.

---

## Navigation & UI (2026-05-15)

### Tour de contrôle — Finance

- **Retirée de la sidebar** (menu gauche = Radar / dossiers uniquement).
- **Déplacée dans Paramètres** : bandeau *Profil et accréditations*, bouton **« Tour de contrôle — Finance »**, visibilité `admin_system` uniquement.
- Navigation : `useWorkhubNav().setActiveTab('admin-billing')`.

### Sidebar

- Colonne fixe `h-screen`, nav scrollable.
- Logos silo **RPA / CPE / PLEX** : `gap-3`.

### Essai 45 jours

- Champ **`trialStartDate`** à l’inscription ; compteurs UI via `trialTimeline.ts`.

### Rôles

| Rôle | Accès |
|------|--------|
| `admin_system` | KPIs Finance + bouton Paramètres, jamais bloqué par Chérif |
| `admin` | Équipe sans Finance |
| `member` | Courtier standard |

---

## Chantier 1 — Chérif & Ghost Billing (2026-05-16)

### Chérif (`billingStatus`)

| État | Comportement |
|------|----------------|
| `active` | Workhub complet |
| `grace_period` | 72 h après échec ; `GracePeriodBanner`, accès conservé |
| `suspended` | `SuspendedAccountScreen`, portail Stripe |

Côté client : `resolveEffectiveBillingStatus()` — règle 72 h si Firestore en retard.

### Ghost Billing

- `companyConfig.ts`, `quebecInvoiceTax.ts`, `invoicePdfService.ts` (ex. 175 $ → 201,21 $ TTC)

### Relances J7 & J21

- **J7** : `J7SurveyModal` ; `j7Survey` + `lastEmailSent: J7`
- **J21** : `maybeSendJ21NurtureEmail` ; file `email_outbox`
- Env : `VITE_SUPPORT_EMAIL`, `VITE_NURTURE_EMAIL_API_URL`

---

## Messagerie — Email Center (Nylas) — SSOT 2026-05-20 · Phase 2 CRM 2026-05-24

- **UI unique** : `src/components/mailbox/MailboxContainer.tsx` (Workhub onglet `mail`). **`Mailbox.tsx` supprimé** (mocks + double silo).
- **SSOT Firestore** : `users/{uid}/email_threads/{threadId}/messages/{messageId}` — analyse OACIQ sur le message (`matchedResidenceId`, `mailContactEmail`, `mailIntent`, `summaryOneLine`, …).
- **Phase 2 — liaison CRM** : `matchedContactId` sur fil **et** messages ; barre `MailContactLinkBar` (« Lier au dossier client », « Créer un contact ») ; auto-liaison si courriel = **un seul** contact ; UI optimiste ; `linkEmailThreadToContact()` dans `emailSyncService.ts` ; heuristique `@primexpert/core/mail/contactMatch.ts` (`findContactsByEmail`, `resolveThreadPartyEmail`).
- **`mailbox_analyses`** : déprécié — ne plus écrire ; Intelligence lit les `messages` analysés.
- Ingestion : `syncNylasMessageToFirestore` + `@primexpert/core/mail` (vendoré `functions/src/nylas/_vendored/mail/`).
- **Loi 25** : `verifyNylasWebhookSignature` — rejet HTTP 401 si signature Nylas invalide.
- `EmailAccountsSettings.tsx` — OAuth Gmail/Outlook multi-inbox.
- Functions : `nylasGetAuthUrl`, `nylasOAuthCallback`, `nylasWebhook`, `nylasSendMessage`, `nylasFetchMessageBody`, `nylasHydrateThread`, `nylasUpdateThreadFolder`, `nylasSendSellerUpdate`.
- Secrets : `NYLAS_API_KEY`, `NYLAS_CLIENT_ID`, `NYLAS_CLIENT_SECRET`, `NYLAS_WEBHOOK_SECRET`.
- Profil : `users.emailAccounts[]` (`nylasGrantId`, `emailAddress`).

## Diffusion Web — prebuild Functions (2026-05-20)

- SSOT : `packages/core/src/diffusion/` → `functions/src/diffusion/_vendored/` via `sync-core-diffusion.cjs` (prebuild).
- Stub **`financialCalcTypes.ts`** généré pour `buyerPreviewKpis` (évite vendor `normalizeFinancialData` entier).
- Callables : `saveDraftListingV2`, `publishListingV2` — guardrails publicitaires OACIQ (`publicationGuardrails.ts`).
- Enrichissements : `publicBuyerDisclosures`, `transactionBanner`, `formatPublicListingHeadline`, aperçu acheteur (`buyerPreviewKpis`).

---

## CRM Contacts — SSOT `organizations/{orgId}/contacts` (2026-05-20)

**Règle :** pas de collections parallèles `clients/`, `vendors/`, `buyerPipeline/` — une fiche contact unifiée.

| Élément | Détail |
|---------|--------|
| Core | `packages/core/src/crm/` — `contactTypes.ts`, `contactUiHelpers.ts`, `coBuyers.ts`, `coSellers.ts`, `legacyContactImport.ts` |
| Service | `src/services/contacts.ts` — CRUD, upload pièces Storage, `linkCoBuyer` / `linkCoSeller` (writeBatch) |
| UI | `ContactsListPage`, `ContactFormDrawer`, `BuyerTierBadge`, sections documents & partenaires |
| Cloison | `ownerId` + `visibility: AGENCY_SHARED` (pool RPA uniquement) |
| Import | `scripts/migrate-legacy-contacts-to-v2.mjs` (Copilote `contacts/` → V2) |

### Acheteur — typologie dérivée (`deriveBuyerTier`)

- **Acheteur privilégié** : NDA téléversée + (mise de fonds **ou** lettre bancaire **ou** préapprobation).
- **Acheteur confidentiel** : préapprobation seule.
- Pièces : `buyerCriteria.ndaFile`, `proofOfFundsFile`, `bankLetterFile`, `mortgagePreApprovalFile` — Storage `buyer_documents/{kind}/`.

### Vendeur — mandat & conformité

- `sellerCriteria` : contrat de courtage, titre de propriété, déclaration vendeur — Storage `seller_documents/{kind}/`.
- `corporateMandate` partagé (Inc., NEQ, fiche REQ) sur acheteur **et** vendeur.

### Liaisons bidirectionnelles (writeBatch atomique)

- `coBuyerIds[]` / `coSellerIds[]` — lier A↔B met à jour **les deux** fiches en une transaction.
- Pattern identique à `residenceIds` ↔ `partiesImpliquees` (`packages/core/src/residence/partiesImpliquees.ts`).

### Chronologie contact

- `packages/core/src/intelligence/contactTimeline.ts` + `communicationTimelineService.ts` — fil courriel + résidences liées dans le drawer contact.
- **Phase 2 (2026-05-24)** : matching par `matchedContactId` **ou** courriel ; `fetchMailboxAnalysesLinkedToContact()` ; `buildContactTimeline({ id, email, residenceIds })` ; courriels liés sans analyse serveur visibles via `linkedContactAtMillis` / `sentAtMillis`.
- `ContactFormDrawer` : prop `initialDraft` (préremplissage depuis messagerie) ; `onSaved(contactId?)` pour enchaîner la liaison fil.

---

## Hub Finance — refonte master panel (2026-05-20) · enrichissements 2026-05-24

- `FinanceHubMasterPanel.tsx`, `FinanceHubLockContext`, rapports PDF (`certifiableFinancialReport`, `detailedFinancialReport`, `acmPresentationReport`).
- Core : `financeHubGlossary.ts`, sentinelle anti-drift TP70, glossaire Québec (pas « audit » à l’écran).
- **Revenus & Dépenses** : prévisualisation grille (`revenusDepensesPreview.ts`), suggestions normalisation (`normalizationSuggestions.ts`), benchmark marché (`marketBenchmarks.ts`, `globalFinancialBenchmark.ts`).
- Callable **`getGlobalFinancialBenchmark`** ; hook `useGlobalFinancialBenchmark` ; service `globalFinancialBenchmarkService.ts`.

---

## Bibliothèque marché — Statistiques du marché (2026-05-24)

- **Nav Workhub** : « Statistiques du marché » (`Layout.tsx`).
- UI : `MarketLibraryDashboard.tsx` — upload PDF, HITL adaptatif (régions macro / grille transactions / grille ratios), spinner longue analyse (~3 min).
- Core : `packages/core/src/documents/` (schémas extraction omnivore, normalisation) ; **`packages/core/src/market/marketDeduplication.ts`** (empreintes déterministes, logique legacy Copilote `marketComparableDedupe.js`).
- Service : `marketDocumentsService.ts` ; type `marketDocument.ts`.
- Functions : `marketDocumentParseIA` (**2 GiB**, **540 s** timeout), `injectMarketMacroStats` ; prebuild `sync-core-documents.cjs`, `sync-core-market.cjs`.
- **Anti-doublons (idempotent merge)** : empreintes Firestore → `doc(fingerprint).set(data, { merge: true })` — transactions `{silo}__tx__{adresse|ville}__{date}__{prix}`, macro `macro__{region}__{annee}__{type}`, ratios `{silo}__bench__…` ; compteurs UI « X nouvelles transactions, Y doublons ignorés ».
- Firestore (top-level, hors `organizations/`) :
  - `market_documents/{docId}` — vault PDF courtier (`uploadedBy` + index `uploadedAtMillis`)
  - `market_macro_stats/{fingerprint}` — stats macro validées (écriture serveur)
  - `market_analytics_raw/{fingerprint}` — transactions comparables & ratios anonymisés
  - `marketSnapshots/v1` — agrégat lecture (append dédupliqué par `dedupeFingerprint`)
- Storage : `primexpert/{brokerId}/market_documents/{fileName}`.
- **UI grille transactions** : contraste `text-slate-900` sur panneau blanc (héritage `text-white` du shell bleu corrigé).

---

## Identité — courtier responsable inscription (2026-05-20)

- `ResponsibleBrokerCard` dans `IdentiteImmeubleTab` — revendication / affichage `courtiersResponsables` (multi-tenant).
- Écriture : `updateResidence({ courtiersResponsables: uid })` ; commit `0e64e83`.

---

## Parties résidence ↔ CRM (2026-05-20)

- `PartiesIntervenantsSection` — recherche contacts, liaison `partiesImpliquees` + `contact.residenceIds` via `linkContactToResidence` (writeBatch).
- Rôles : `VENDEUR`, `ACHETEUR`, `NOTAIRE`, `COLLABORATEUR`.

---

## Journée 2026-05-20 — synthèse trois chantiers (commits `main`)

| Chantier | Commits | Livrables clés |
|----------|---------|----------------|
| **1 — CRM & répertoire** | `b9fe455` | Fiche contact LCI, tiers acheteur, vendeur (documents + covendeurs), import legacy, liste + drawer |
| **2 — Messagerie & promesse** | `1c4f3c6`, `9b8a70c` | SSOT `email_threads`/`messages`, webhook Nylas Loi 25, refactor PA `offre` (persistance complète) |
| **3 — Fiche résidence & finance** | `0e64e83`, `b9fe455` | Courtier responsable identité, Hub Finance master, parties CRM, diffusion enrichie, chronologie Intelligence |

## Session 2026-05-24 — Option A + inscriptions + marché (`6d31058`)

| Chantier | Livrables clés |
|----------|----------------|
| **Option A — Messagerie ↔ CRM** | `MailContactLinkBar`, `matchedContactId`, liaison optimiste, chronologie contact par ID, index Firestore |
| **Mes inscriptions Phase 2** | DnD Kanban, filtres régions QC, totaux colonnes, badge conformité mandat |
| **Finance & marché** | Benchmark global, bibliothèque documents marché, enrichissement Revenus & Dépenses |

**Push Git :** `6d31058` → `origin/main`. **Déploiement prod :** hosting + firestore (rules + indexes) + functions + storage sur `primexpert-app-v2`.

### Hotfix prod — PDF massif & anti-doublons (2026-05-24, post-`6d31058`)

| Incident / chantier | Correctif |
|---------------------|-----------|
| `deadline-exceeded` parse ~100 pages | `marketDocumentParseIA` : **2 GiB** RAM, **540 s** ; spinner UI « analyse massives (~3 min) » |
| Encre invisible grille transactions | `MarketLibraryDashboard` : `text-slate-900` sur cellules + panneau détail |
| Pollution doublons Big Data | `marketDeduplication.ts` + `injectMarketMacroStats` : écritures **merge** par empreinte déterministe |

---

## Plan de migration Legacy → V2 — diagnostic Data Mapping (2026-05-20)

**Statut :** cartographie **validée à 100 %** par le PO (Alain) — diagnostic uniquement, **aucun script de migration final** exécuté dans cette session.

**Document officiel :** [`docs/DATA_MAPPING_LEGACY_V2.md`](./DATA_MAPPING_LEGACY_V2.md)

### Périmètre analysé

| Source | Chemin disque |
|--------|---------------|
| Legacy (Copilote-RPA) | `00_RPA_SYSTEME_APP/Copilote-RPA` |
| V2 (PrimeXpert) | `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2` |

### Décisions clés (alignées Règle #0)

| Sujet | Décision validée |
|-------|------------------|
| Contacts CRM | SSOT unique `organizations/{orgId}/contacts` — fusion `contacts/` + `vendors/` (import existant `legacyContactImport.ts`) |
| Pipeline acheteur | **`buyerPipeline/` interdit en V2** — aplatissement sur `buyerQualificationStatus` + `buyerCriteria` ; historique stage dans `importMeta.pipelineHistory` |
| Multi-offres PA | Offre **courante** dans `promesseAchat` + `offre` ; archives dans `importMeta.offersArchive[]` ou docs `legal` — **sans** sous-collection `purchaseOffers` |
| Parties | `partiesImpliquees[]` ↔ `contact.residenceIds` (bidirectionnel) |
| Documents Storage | Copie Legacy `residences/{id}/documents_*` → `primexpert/{brokerId}/properties/{id}/documents/{category}/` |
| Dual tenant | **Critique** : `orgId`/`ownerId` sur contacts **et** `courtiersResponsables` sur résidences |

### Trous prioritaires identifiés (avant scripts)

1. Pas de Kanban acheteur 5 colonnes en V2 → tiers dérivés `deriveBuyerTier()`
2. `residences_public` vs diffusion V2 (`syndication.draftToken`)
3. `financial/years_*` — enrichir `dataV2` ou sous-docs
4. Visites / comptes-rendus hétérogènes → `visitorVisitRegistry` + `call_analyses`

### Prochaine phase (hors scope diagnostic)

Ordre recommandé : users/orgId → contacts → résidences → parties → PA → finance → documents → compliance → flatten pipeline acheteur (détail dans le document lié).

---

## Déploiement

```bash
cd "01_PRIMEXPERT_SYSTEME_APP_STABLE_V2"
npm run build                        # toujours avant hosting si le front a changé
firebase deploy --only hosting
firebase deploy --only firestore:rules,storage:rules   # si règles modifiées
cd functions && npm run build
FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions
# Déploiement complet (hosting + règles + functions) : firebase deploy
```

**Notes :**
- Timeout discovery Firebase (~10 s par défaut) : utiliser `FUNCTIONS_DISCOVERY_TIMEOUT=60` si échec « Cannot determine backend specification ».
- **2026-05-19** : charte institutionnelle, inscriptions, Synthèse 360, documents ; déploiement Firebase hosting + indexes.
- **2026-05-19 (fin de journée)** : Sprints PA 5.1–5.4 + Identité Confort 66+ ; `npm run build` + `firebase deploy --only hosting` sur `primexpert-app-v2`.
- **2026-05-20** : Phase 1 Email SSOT (`1c4f3c6`) ; webhook Nylas signature ; fix prebuild diffusion `financialCalcTypes`.
- **2026-05-20 (soir)** : CRM contacts unifiés + vendeur/acheteur documents (`b9fe455`) ; courtier responsable identité (`0e64e83`).
- **2026-05-24** : Option A messagerie ↔ CRM (`6d31058`) ; Kanban inscriptions DnD + régions ; bibliothèque marché + benchmark finance ; déploiement complet Firebase.

**Repo :** https://github.com/alain-blip/primexpert-v2-core.git — branche `main`.

---

*Journal mis à jour : 2026-05-20 — Plan de migration Legacy→V2 (Data Mapping validé PO) ; voir [`DATA_MAPPING_LEGACY_V2.md`](./DATA_MAPPING_LEGACY_V2.md).*
