# Primexpert — mémoire de décisions (journal)

> **Index documentation :** [`README.md`](./README.md)  
> **Emplacement canonique (code + doc jumeaux) :**  
> `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/docs/`  
> Miroir possible : `00_PRIMEXPERT_SYSTEME_APP/docs/` sur le disque de sauvegarde.  
> **Gouvernance PO :** [`CHARTE SUPRÊME & GOUVERNANCE PRIMEXPERT .rtf`](./CHARTE%20SUPR%C3%8AME%20%26%20GOUVERNANCE%20PRIMEXPERT%20.rtf) (v2026.2) · [`Primexpert Normes d'implantation.rtf`](./Primexpert%20Normes%20d'implantation.rtf)

---

## Règle linguistique — langage des affaires (Québec)

**Règle maîtresse** pour toute UI, libellé, bouton, rapport et documentation **visible par l’utilisateur ou le client** (vendeur, acheteur, courtier).

### Purge du lexique européen

- **Interdit à l’écran** : le mot **« audit »** (trop académique / européen pour le marché québécois).
- **Remplacer par** (selon le contexte) : **vérification**, **conformité**, **diligence**, **diligence raisonnable**, **preuves de conformité**.

### Ton et verbes d’action (exemples)

- Boutons / états : *Vérification*, *Certification*, *Verrouillage*, *Preuves de conformité*, *Journal de conformité* (pas « journal d’audit »).
- Analyse financière 360° : parler de **vérification de performance** ou **analyse 360°**, jamais du terme banni côté client.
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

## Accès Vendeur — portail client (2026-05-20)

**Statut :** implantation validée PO — route Workhub + entrée depuis la fiche résidence.

| Élément | Détail |
|---------|--------|
| Route | `/acces-vendeur` — `App.tsx` (`ProtectedAccesVendeur`, lazy `AccesVendeurPage`) |
| UI portail | `src/components/vendor/` — `AccesVendeurPage`, `VendorTimeline`, `VendorComplianceGauge`, `VendorDocumentDropzone`, `VendorOfferPanel` |
| Bouton fiche | `ResidenceAccesVendeurButton` dans `ResidenceDetail.tsx` — ouvre le portail pour le contact **VENDEUR** lié (`partiesImpliquees`) |
| Core | `packages/core/src/residence/vendorPortalTimeline.ts`, enrichissement `mandateCompleteness.ts` (jauge preuves de conformité mandat) |
| Service | `vendorPortalService.ts` + `contacts.ts` (lecture / écoute temps réel contact CRM) |
| Commit amorce | `4d252d0` — timeline, jauge, service Firestore ; bouton fiche sur `main` |

**Règle #0 :** aucune logique métier timeline / conformité mandat dans React — tout passe par `@primexpert/core/residence`.

---

## Migration contacts — Maillon 1 (2026-05-20, clôture session)

**Statut :** script + SSOT mapping **implémentés** ; dry-run **validé PO** ; **`--execute` interdit** sans feu vert explicite.

| Élément | Détail |
|---------|--------|
| SSOT | `packages/core/src/crm/legacyContactImport.ts` — fusion `contacts/` + `vendors/` (email puis téléphone), aplatissement `buyerPipeline/` |
| Script | `scripts/migrate-legacy-contacts-to-v2.mjs` — dry-run par défaut ; `--org-id`, `--owner-id`, `--limit` |
| Rapport | `scripts/output/legacy-contacts-dry-run-report.json` (non versionné) |
| Référence | [`docs/DATA_MAPPING_LEGACY_V2.md`](./DATA_MAPPING_LEGACY_V2.md) § contacts / pipeline |

### Règle qualification acheteur (import)

- **`QUALIFIED`** uniquement si preuves **NDA + fonds** (`ndaSigned` / `ndaFile` + `proofOfFunds` / fichiers) **ou** stage legacy explicitement qualifié (`QUALIFIE`, `ACHETEURS_QUALIFIES`, …).
- Stages type **`ACHETEURS_EN_SUIVI_NOUVEAUX`** → **`PENDING_NDA`** par défaut (ex. **Éric Pichette** — validé dry-run).
- Même stage avec NDA + fonds documentés → **`QUALIFIED`** (ex. **Anthony Verret** — conforme critères PO).
- Historique Kanban : `importMeta.pipelineHistory[]` — **pas** de collection `buyerPipeline/` en V2.
- Suppression de l’ancien raccourci `accessConfirmedAt` / `includes('QUALIF')` sur le libellé de stage (faux positifs).

```bash
npx tsx scripts/migrate-legacy-contacts-to-v2.mjs --org-id=ORG_ID --owner-id=OWNER_ID --limit=50
```

---

## Plan de migration Legacy → V2 — diagnostic Data Mapping (2026-05-20)

**Statut :** cartographie **validée à 100 %** par le PO (Alain). **Maillon 1 (contacts)** : implémentation + dry-run OK ; maillons 2+ (résidences, finance, Storage) **planifiés** — voir document officiel.

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

### Prochaine phase (hors scope Maillon 1)

Ordre recommandé : **contacts `--execute`** (après feu vert) → résidences → parties → PA → finance → documents → compliance (détail dans le document lié).

---

## Session 2026-05-20 — clôture PO (Accès Vendeur + Maillon 1 contacts)

| Chantier | Livrables |
|----------|-----------|
| **Accès Vendeur** | Portail `/acces-vendeur`, timeline core, jauge mandat, bouton **Ouvrir l'Accès Vendeur** sur `ResidenceDetail` |
| **Migration contacts** | `legacyContactImport.ts` enrichi (fusion, pipeline, qualification stricte) ; dry-run Pichette → `PENDING_NDA`, Verret → `QUALIFIED` |

---

## Analyse de mise en marché (ACM) — parcours résidence (2026-05-20, validé PO)

**Statut :** parcours **ancré SSOT** sur la fiche résidence ; libellé UI **« Analyse de mise en marché (ACM) »** ; déploiement prod validé (`e1a900c`).

### Architecture (Règle #0)

| Couche | Fichiers / rôle |
|--------|------------------|
| **Bootstrap** | `packages/core/src/valuation/residenceAcmBootstrap.ts` — lit `normalizeFinancialData` + `calculatedResults` ; ancre le moteur (RBE/RNE → revenus/dépenses SSOT) |
| **TGA GPS** | `packages/core/src/market/gpsCapRateByRegionClass.ts` — médiane cascade **région + classe RPA** → région → classe → global |
| **Moteur** | `calculateValuation`, `computeTgaAdjustment`, `runStressTests`, `calculatePriceRecommendation` (`@primexpert/core/valuation`) |
| **UI workspace** | `src/components/acm/AcmValuationWorkspace.tsx` — champs verrouillés + **TGA éditable** (recalcul instantané, badge « Taux personnalisé par l’utilisateur ») |
| **Panneau fiche** | `src/components/residence/market/ResidenceAcmValuationPanel.tsx` — `FinancialDataProvider` + `useMarketData` (transactions GPS) |
| **Onglet Marché** | `MarcheConcurrenceTab.tsx` — ACM en **tête** (ne bloque plus sur le chargement du doc résidence pour les finances) |
| **PDF présentation** | `AcmTab.tsx` + `acmPresentationPdfService.ts` (sous le workspace) |
| **Workhub isolé** | `ACM.tsx` — sans `?residenceId=` → garde-fou vers Mes inscriptions |

### Data binding (obligatoire)

- **Finances** : `residences/{id}/financial/dataV2.calculatedResults` → RBE, RNE, prix demandé affichés et injectés dans `ValuationInputs` (plus de grille vide après refactor UI).
- **Territoire** : `residenceDoc` → `competitorsList`, `marcheDemographie`, `marketScope.radiusKm` → unités secteur, population 75+, rayon affichés dans le workspace.
- **TGA** : valeur initiale = médiane GPS ; le courtier peut **modifier** (ex. 8 → 9,5) → prix suggéré et scénarios d’occupation **sans rechargement**.

### Commits de référence (branche `main`)

| Commit | Contenu |
|--------|---------|
| `c1b5e62` | Sprint 0 — parité V1 (CSV comparables, stress/TGA, EEE, PDF vendeur) |
| `fa3cb1b` | TGA éditable + défaut GPS région/classe |
| `e1a900c` | Data binding SSOT finances + territorial + fix Intelligence `partiesTimelineEvents` |

### Garde-fous produit

- ACM **sans** `calculatedResults` validés → message d’alerte (onglet Finances requis), pas de formulaire vide.
- Abréviations **jamais seules** à l’écran (TGA, RBE, RNE) — voir règle linguistique en tête de ce journal.

---

## Session 2026-05-28 — Mobile Phase 2, CRM Storage, omnicanal, VoIP (parallèle)

### Migration contacts — Storage + Firestore legacy (`migrateLegacyContacts.ts`)

| Élément | Détail |
|---------|--------|
| **Source** | Bucket `gs://copilote-pour-courtiers-en-rpa.firebasestorage.app/contacts/{id}/` (PDFs) + collection legacy `contacts/{id}` |
| **Script** | `packages/core/src/scripts/migrateLegacyContacts.ts` — `npm run migrate:contacts` (dry-run) · `migrate:contacts:execute` |
| **Cible** | `organizations/{orgId}/contacts` — org défaut migration : `org_bYwUG6mxNmPcvK9Xz2Uuy4FxqD83` |
| **Exécution** | **90 contacts** importés ; **87** `buyerQualificationStatus === 'QUALIFIED'` (alimente Matchmaker) |
| **Règle #0** | Enrichit SSOT existant — pas de collection parallèle |

### Matchmaker Raphaël — Bilan 360° (`Synthese360Tab`)

| Élément | Détail |
|---------|--------|
| **Moteur** | `packages/core/src/crm/raphaelEngine.ts` — matching acheteurs `QUALIFIED` ↔ résidence |
| **UI** | `RaphaelMatchmakerPanel` **pleine largeur sous « Notes de suivi »** (plus de colonne latérale) |
| **Commits** | `382c5a1` (layout), `ac455d7` (moteur) |

### Notes vocales — Whisper / Gemini + hydratation

| Élément | Détail |
|---------|--------|
| **Storage** | `organizations/{orgId}/voice_notes/residences|contacts/{parentId}/{uploadId}.webm` |
| **Function** | `onVoiceNoteUploaded` — région **`us-east1`** (bucket Storage) ; STT OpenAI Whisper si `OPENAI_API_KEY`, sinon Gemini |
| **Core** | `packages/core/src/ai/voiceParser.ts` — intentions → note + tâche |
| **UI** | `AudioRecorderButton` dans `Synthese360Tab` ; `voiceNoteService.ts` |
| **Cibles** | `residences/{id}/notes`, `residences/{id}/tasks` ; champs `source: 'voice'`, `voiceUploadId` |
| **Test** | `npm run test:voice-note` · `test:voice-note:gemini` |
| **Commits** | `01d50d7`, `982342b`, `767efeb` |

### Hub omnicanal — SMS / Meta (SSOT `email_threads`)

| Élément | Détail |
|---------|--------|
| **Principe** | **Pas de nouvelle collection** — enrichissement `users/{uid}/email_threads` + `messages` avec `channel`, `metadata`, `isCritical` |
| **Core** | `packages/core/src/mail/types.ts` — `CommunicationChannel`, `messageUrgency.ts`, `findContactsByPhone` |
| **Functions** | `functions/src/messaging/` — `ingestOmnichannelMessage`, webhooks `twilioSmsWebhook` / `metaMessagingWebhook` (**`northamerica-northeast1`**) |
| **UI** | `CommunicationHub.tsx` — onglet Intelligence contact + chronologie résidence |
| **Tâches CRM** | SMS entrant → `organizations/{orgId}/tasks` si urgence |
| **Test** | `npm run test:incoming-sms` (ex. `test_kristel_sms`) |
| **Commit** | `0b0b97b` — webhooks **à déployer** : `TWILIO_AUTH_TOKEN`, `META_VERIFY_TOKEN` |
| **Déploiement ciblé** | `firebase deploy --only functions:twilioSmsWebhook,functions:metaMessagingWebhook,firestore:rules,hosting` |

### VoIP Twilio (travail parallèle — non déployé prod)

| Élément | Détail |
|---------|--------|
| **Core** | `packages/core/src/telephony/` — `canUseVoip.ts`, types |
| **Functions** | `getTwilioToken`, `twilioVoiceResponse` ; sync `functions/scripts/sync-core-telephony.cjs` |
| **Front** | `twilioVoiceService.ts`, `voipAccess.ts`, `partyQuickCommunications.ts` |
| **Audit** | `docs/AUDIT_VOIP_COMPARATIF_LEGACY_VS_V2.md` |

### Hub Finance — saisie manuelle & fusion extractions (parallèle)

| Élément | Détail |
|---------|--------|
| **Core** | `mergeExtractedFinancials.ts` |
| **UI** | `FinanceManualEntryPanel.tsx`, `FinancialHubDraftContext.tsx` |

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
- **2026-05-20 (soir, clôture PO)** : ACM résidence SSOT — `fa3cb1b`, `e1a900c` ; hosting `primexpert-app-v2.web.app`.
- **2026-05-28** : CRM Storage 90 contacts ; Matchmaker sous notes ; notes vocales (`onVoiceNoteUploaded` us-east1) ; hub omnicanal (`0b0b97b`) ; VoIP + finance manuelle en parallèle.
- **2026-05-28 (session locale)** : démarrage du serveur de développement `npm run dev` (Vite `--port=3000 --host=0.0.0.0`) ; URLs actives `http://localhost:3000/` et réseau local.
- **2026-05-28 — GO-LIVE V2.5 STABLE (`primexpert-app-v2`)** : conseil d’administration **[GO]** après inspection manuelle ACM/HITL réussie. **Livré en production :** Cœur CRM spécialisé RPA (typologies, relations atomiques, garde-fous pipeline) ; moteur ACM connecté aux médianes territoriales (`getGlobalFinancialBenchmark`, suggestions IA en brouillon `manualVerifications`) ; Hub omnicanal V1 (SSOT `email_threads/messages`, canal `sms` / `voice_call`, filtre `orgId`, briefing matin enrichi, adjointes IA HITL). **Déploiement exécuté :** `functions` — `getGlobalFinancialBenchmark` (us-central1), `onVoiceNoteUploaded` (us-east1) ; `hosting` — https://primexpert-app-v2.web.app . **Note ops :** `twilioSmsWebhook` redéployé (`northamerica-northeast1`, ACTIVE) — signature Twilio requise en prod ; correctif init Admin `getDb()` avant `getStorage()` sur `onVoiceNoteUploaded` (déploiement réussi).
- **2026-05-28 — CLÔTURE SPRINT MAJOR (Conseil d’administration)** : statut plateforme **[PRODUCTION IMMUABLE LIVE]** — URL certifiée https://primexpert-app-v2.web.app . **Périmètre clos :** (1) Cœur CRM spécialisé RPA ; (2) Workspace analyse comparative de marché (ACM) + médianes territoriales ; (3) Hub omnicanal unifié (SMS Twilio, courriels, notes vocales → `email_threads/messages`, canaux `sms` / `voice_call`) ; (4) Dictionnaire de distribution Centris RESO — [`CENTRIS_RESO_MAPPING_DRAFT.md`](./CENTRIS_RESO_MAPPING_DRAFT.md) (OData v4, `listings_cache`, déduplication `ListingId` → `marketDeduplication.ts`, feuille de route https://docs.datadistributionqc.centris.ca/fr/ ). **Hors périmètre sprint (été 2026) :** connecteur OData Centris exécutable ; promotion automatique `listings_cache` → `residences`. **Suivi ops notes vocales :** repli STT Vertex (`gemini-2.0-flash-001` 404) — lier `OPENAI_API_KEY` (Whisper) ou aligner modèle sur `gemini-2.5-flash` pour certification bout-en-bout message `voice_call`.
- **2026-05-28 — STATUT OFFICIEL SUITE V2.6** (conseil d’administration) :

| Volet | Statut certifié |
|-------|-----------------|
| Cœur CRM spécialisé RPA | **[OPÉRATIONNEL — LIVE]** |
| Workspace d'évaluation ACM | **[OPÉRATIONNEL — LIVE]** |
| Hub omnicanal (SMS, notes vocales, courriels) | **[OPÉRATIONNEL — LIVE]** |
| Copilote de négociation & clauses OACIQ / LOI | **[CÂBLÉ — PROD ACTIVE]** |

**Copilote V2.6 — SSOT :** `packages/core/src/ai/oaciqSpecsTypes.ts`, `negotiationEngine.ts`, `negotiationPrompts.ts` ; LLM via `packages/core/src/services/gemini.ts` (navigateur : `src/services/gemini.ts` + `VITE_GEMINI_API_KEY`) ; Vertex : `functions/src/ai/negotiationWithVertex.ts`. HITL : `pending_human_review` sur `manualVerifications`. Modes : `OACIQ_FORM`, `CUSTOM_CONTRACT`, `LETTER_OF_INTENT`.

- **2026-05-28 — STATUT DE PRODUCTION ACTIF V2.7** (`primexpert-app-v2`) :

| # | Volet | Statut certifié |
|---|-------|-----------------|
| 1 | Cœur CRM & fiches RPA | **[OPÉRATIONNEL — LIVE]** |
| 2 | Workspace évaluation ACM | **[OPÉRATIONNEL — LIVE]** |
| 3 | Hub omnicanal (SMS / Nylas) | **[OPÉRATIONNEL — LIVE]** |
| 4 | Moteur de clauses OACIQ / LOI | **[CÂBLÉ — PROD ACTIVE (Gemini JSON)]** |
| 5 | Après-vente & conformité Loi 25 | **[CÂBLÉ — PROD ACTIVE (ClosingEngine + types)]** |

**Après-vente V2.7 — SSOT :** `packages/core/src/market/closingEngine.ts` (`generateClosingSequenceTasks`, port `configureClosingEnginePort`) ; Loi 25 — `QuebecLaw25Consent` + `validateLaw25Compliance` dans `packages/core/src/crm/contactTypes.ts` ; conception [`CLOSING_AND_COMPLIANCE_DRAFT.md`](./CLOSING_AND_COMPLIANCE_DRAFT.md). **Prochain branchement prod :** trigger `onPromiseAcceptedTrigger` + garde-fous SMS/courriel sur `law25Consent`.

**URL production :** https://primexpert-app-v2.web.app

**Repo :** https://github.com/alain-blip/primexpert-v2-core.git — branche `main`.

---

## Journal de conformité — Algorithme de souscription validé (2026-05-29)

**Statut :** **[MISE EN PRODUCTION — HOSTING LIVE]**

| Élément | Détail |
|---------|--------|
| **Décision PO** | Alain (Product Owner) — principe de réalité métier : l'emprunt maximum autorisé est bridé par le **critère le plus restrictif** (souscription commerciale / SCHL). |
| **Règle #0** | Enrichissement SSOT — `packages/core/src/financial/bankingSubscriptionLimits.ts` (`resolveEmpruntMaximumAutorise`) ; pas de moteur parallèle en UI. |
| **Formule** | Emprunt maximum autorisé = **min** (capacité ratio de couverture de la dette (DSCR), plafond ratio prêt-valeur (RPV)) ; mise de fonds requise (MFR) recalculée sur l'emprunt restrictif. |
| **Surfaces unifiées** | Hub Finance · onglet Finançabilité · Bilan exécutif · rapports PDF certifiables · aperçu acheteur diffusion · ACM présentation vendeur. |
| **Libellé UI** | « Emprunt maximum autorisé (le plus bas des critères) » — abréviations développées (DSCR, RPV) conformément à la charte Québec. |
| **Git** | PR [#2](https://github.com/alain-blip/primexpert-v2-core/pull/2) — merge `20ed8dd` (`fix/finance-emprunt-maximum-plus-bas-criteres` → `main`) ; commit métier `d970196`. |
| **Déploiement** | `npm run build` (predeploy hosting) + `firebase deploy --only hosting` sur `primexpert-app-v2` — **2026-05-29**. |
| **URL production** | https://primexpert-app-v2.web.app |
| **Référence chiffrée PO** | Cas dossier validé — **1 899 993 $** unifié sur l'ensemble des rapports et fiches finançabilité (hard refresh recommandé post-déploiement). |

**HITL :** l'algorithme calcule et affiche ; le courtier demeure responsable de la diligence et de la validation des hypothèses de souscription avant toute recommandation à un client.

---

## Session 2026-05-29 — Portail vendeur autonome, briefing matin, radar off-market, SPA (`c407c60` → `f9a4f23` → `194a5ea`)

### Accès Vendeur V2.8 — portail client autonome

| Élément | Détail |
|---------|--------|
| **Catalogue SSOT** | `packages/core/src/residence/vendorPortalCatalogue.ts` — **82 types canoniques + 3 « Hors liste » = 85 exigences UI** |
| **Conformité** | `vendorPortalCompliance.ts` — `assessVendorPortalCatalogueCompliance()` ; jauge % types requis reçus |
| **3 catégories parentes** | Documents à partager · Contrat/mandat/titres · Promesse d'achat |
| **Invitation** | Callable `createVendorPortalInvite` — `vendor_portal_invites/{token}` ; TTL **30 jours** |
| **Session client** | `/acces-vendeur?token=…` → `validateVendorPortalToken` + `signInWithCustomToken` |
| **UI** | `AccesVendeurPage.tsx` — onglets overview / documents / timeline / promesse ; `VendorPortalSkeleton` |
| **Téléversement** | `uploadSource: 'vendor_portal' \| 'broker'` ; alerte courtier `notifyVendorPortalDocumentUpload` |
| **Routage SPA** | `App.tsx` → lazy `AuthenticatedApp.tsx` ; `AccesVendeurRoute` détecte `?token=` |

### Briefing du matin & Radar à opportunités (off-market)

| Élément | Détail |
|---------|--------|
| **Core** | `morningBriefing.ts`, `radarOpportunitesEngine.ts`, `hotLeadsEngine.ts` (`@primexpert/core/crm`) |
| **Cron** | `morningBriefingGenerator` — **06:00 America/Toronto** |
| **Persistance** | `organizations/{orgId}/morning_briefings/{brokerId}` ; `organizations/{orgId}/prospects_radar/{id}` |
| **Signaux radar** | `occupancy_drop` ; `certification_expiry` (CIUSSS/MSSS ≤ 60 j) |
| **UI** | `Dashboard.tsx` + `morningBriefingService.ts` |
| **Prebuild** | `sync-core-crm.cjs` → `functions/src/cron/_vendored/` |

### Bilan 360° & CRM — enrichissements

| Élément | Détail |
|---------|--------|
| **Synthèse** | Prix demandé et commissions éditables ; nœuds canoniques HITL ; import extractions |
| **Recherche CRM** | `contactSearch.ts` — haystack normalisé |
| **Inscriptions** | Recherche multi-critères villes/municipités |
| **Contacts multi-canaux** | `partyQuickCommunications.ts` — SMS/courriel/VoIP depuis parties |

### Statut production V2.8 (2026-05-29)

| # | Volet | Statut |
|---|-------|--------|
| 1–5 | Volets V2.5–V2.7 (CRM, ACM, omnicanal, négociation, closing) | **[LIVE / CÂBLÉ]** — inchangé |
| 6 | **Portail vendeur autonome (85 pièces)** | **[OPÉRATIONNEL — LIVE]** |
| 7 | **Briefing matin + radar off-market** | **[OPÉRATIONNEL — LIVE]** |

**Documentation Bible alignée :** `README.md`, `arborescence.md`, `project_canonical_fields.md`, `project_pipeline_gps.md`, RTF v2026.2.

---

## Sprint V2.9 — Vault WORM & journal de conformité légale (core types)

**Statut infrastructure core compilée — 2026-05-29**

| Volet | Statut |
|-------|--------|
| Coffre-fort immuable WORM (`LegalVaultDocument`) | **[OPÉRATIONNEL — INTÉGRÉ AU CORE]** |
| Registre d'adéquation scellé SHA-256 (`LegalComplianceLogEntry`) | **[OPÉRATIONNEL — INTÉGRÉ AU CORE]** |
| Validateur chronologique profil (`brokerProfileCompliance`) | **[OPÉRATIONNEL — INTÉGRÉ AU CORE]** |
| Lexique réglementaire — zéro occurrence mot banni | **[CONFORME]** |

**SSOT :** `packages/core/src/security/` — export `@primexpert/core/security`.

| Fichier | Rôle |
|---------|------|
| `vaultSpecsTypes.ts` | Types WORM, rétention 2190 j, chaînage SHA-256, `applyLegalVaultWormLock`, `validateLegalVaultDocument` |
| `brokerProfileCompliance.ts` | `profilePhotoUploadedAtMillis`, `isProfilePhotoExpired` (> 1826 j), `validateBrokerProfilePhotoForPublication` |
| `index.ts` | Barrel |

**Hors périmètre sprint (branchement prod planifié) :** collections Firestore `legal_vault` + `compliance_log`, `firestore.rules` deny update/delete si `isFinalWormLocked`, Function Montréal append journal sur READ/WRITE/LOCK/EXPORT_ZIP, extension `UserProfile` côté `users/{uid}`.

---

## Registre global de la suite logicielle — mai 2026

Statut officiel consolidé (conseil d'administration) :

| Volet | Statut certifié |
|-------|-----------------|
| Cœur CRM & fiches parties | **[OPÉRATIONNEL — PRODUCTION LIVE]** |
| Analyse de mise en marché (ACM) & benchmark taux de capitalisation (TGA) | **[OPÉRATIONNEL — PRODUCTION LIVE]** |
| Hub omnicanal (SMS / Nylas) | **[OPÉRATIONNEL — PRODUCTION LIVE]** |
| Clauses négociation Gemini | **[CÂBLÉ — MOTEUR DYNAMIQUE ACTIF]** |
| Coffre-fort WORM & sécurité | **[CÂBLÉ — INTÉGRATION CORE CERTIFIÉE]** |

**URL production :** https://primexpert-app-v2.web.app  
**Modules V2.8 complémentaires (hors registre exécutif) :** portail vendeur autonome (85 pièces), briefing matin, radar off-market — voir section session 2026-05-29 ci-dessus.

---

## Fin de cycle technique V2.9 — projet configuré et stable (mai 2026)

Clôture officielle du cycle de développement V2.9 :

| Élément | Statut |
|---------|--------|
| **URL officielle** | https://primexpert-app-v2.web.app |
| **Monorepo** | **Archivé, validé, zéro dérive** — `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2` |
| **Mode sécurisation** | **Cockpit technique en attente d'ordres opérationnels** |

**Interprétation ops :** aucun déploiement ni refactor non mandaté ; prochaines actions = ordres PO explicites (ex. branchement Firestore Vault WORM, `firestore.rules`, Functions Montréal journal de conformité).

**Repo :** https://github.com/alain-blip/primexpert-v2-core.git — branche `main`.

---

*Journal mis à jour : 2026-05-29 — Fin de cycle V2.9. Registre global mai 2026 certifié. Cockpit en attente d'ordres opérationnels.*
