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
- **V3.1 (2026-05-29)** : verrouillage légal OACIQ client — `LegalVaultWormPanel`, `LegalVaultWormLockModal`, `legalVaultService.ts` ; badges Brouillon / Sécurisé WORM·OACIQ ; mutation `organizations/{orgId}/legal_vault/` (règles V3.0).

### Phase 4c — Onglets fiche résidence (Synthèse, Déclaration, Marché, Promesse)

- **Synthèse** : `Synthese360Tab` — bilan exécutif, bloc rétribution (lecture champs + affichage), jalons Loi sur le courtage immobilier (C-73.2) J+3 / J+180, notes `residences/{id}/notes`
- **Déclaration** : `DeclarationVendeurTab` — questionnaire OACIQ, coquille institutionnelle
- **Marché** : `MarcheConcurrenceTab` — marché & concurrence, coquille institutionnelle
- **Promesse** : `PromesseAchatTab` — cockpit promesse d'achat (Sprints 5.1–5.4)
  - **SSOT** : `packages/core/src/transaction/` — `offreTronc.ts`, `offreConditions.ts`, `offreCloture.ts`, `promesseAchatEngine.ts`
  - **Firestore** : objet racine `offre` (tronc financier + conditions + clôture) ; bloc `promesseAchat` (statut, dates, délais en jours, commission, collaborateurs, documents)
  - **UI** (`src/components/residence/promesse/`) : `OffreTroncFinancierSection`, `OffreConditionsLegalesSection`, `OffreClotureRetributionSection`, `PromesseDelaisPaSection` (jours éditables → dates calculées), `PromesseCommissionPaSection`, `PaConfortPanel`, **`ContractAssemblerPanel`** (V3.5 — assemblage contrat + annexes) ; `TernaryToggle` partagé
  - **Générateur natif (V3.4–V3.5)** : `packages/core/src/forms/` — HTML sans OpenXML ; legacy Copilote `docxtemplater` / PizZip **non réintroduit**
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

### Authentification — connexion Google (2026-05-19, recalé 2026-05-30)

- **Production et développement : utilisation stricte et exclusive de `signInWithPopup`** afin de préserver l'intégrité des sessions face aux restrictions d'ITP / cookies tiers sur Firebase Hosting (le retour `signInWithRedirect` perdait la session).
- En-tête `Cross-Origin-Opener-Policy: same-origin-allow-popups` déjà posé sur tous les chemins dans `firebase.json` pour autoriser les fenêtres (popups) OAuth.
- Points d'entrée du popup : `src/lib/auth.tsx` (hook `useAuth`), `src/auth-signin.ts`, `src/lib/publicEntryAuth.ts`.
- `App.tsx` : navigation vers `/workhub` après session effective ; garde courte si `auth.currentUser` est défini avant le contexte React.
- Garde de chargement `/workhub` déjà en place (`ProtectedWorkhub` → `if (loading)`, `Suspense` racine, *timeout* de démarrage 15 s dans `onAuthStateChanged`).
- Correctif 2026-05-30 : l'ancienne note « Production : `signInWithRedirect` inchangé » était discordante avec le code et a été remplacée.

### Évaluation d'infrastructure moderne — Diagnostic de distribution réseau et isolation des comportements de cache CDN (exit 0) (2026-05-30)

- **Symptôme** : écran noir persistant sur la production `/workhub`, sans erreur console, build `exit 0`.
- **Cause racine (réseau, pas applicatif)** : les en-têtes Firebase Hosting s'évaluent sur le **chemin de requête entrant, avant les `rewrites`**. Les routes SPA sans extension (`/workhub`, `/acces-vendeur`) ne correspondaient à aucune règle `no-cache` (qui ne ciblaient que `/index.html` et `**/*.html`) et ne matchaient que le `**` global (COOP seul). Le HTML de ces routes pouvait donc être mis en cache → après redéploiement, références de *chunks* hachés obsolètes → import dynamique en 404 → `Suspense` racine figé sur fond `#0a0a0a` (écran noir).
- **Correctif (config seule, `firebase.json`)** : ajout de blocs d'en-têtes `Cache-Control: no-cache, no-store, must-revalidate` (+ COOP) pour `"/workhub{,/**}"` et `"/acces-vendeur{,/**}"`, placés avant le `**` global.
- **Déploiement** : `firebase deploy --only hosting` (publication atomique — invalide automatiquement le CDN Firebase ; aucun purge manuel requis). Le correctif d'en-tête traite le cache **navigateur** qui survivait au redéploiement.
- **Point latent (cosmétique, non bloquant)** : le script *pré-paint* d'`index.html` pose `px-spa` sur `document.documentElement` (`<html>`) alors que les règles CSS ciblent `body.px-spa`. La bascule de visibilité fonctionne quand même car `bootstrap-spa.tsx` applique des styles *inline* sur `#root`, mais l'anti-flash de la page statique sur `/workhub` est inopérant. Non corrigé ici (hors écran noir).

### Évaluation d'infrastructure moderne — Stabilisation des composants de conformité et protocole de surveillance réseau (2026-05-30)

- **Contexte** : écran noir prod `/workhub` toujours présent après *hard refresh* ; hypothèses testées sur la bannière OACIQ (`BrokerPhotoComplianceBanner`).
- **Réfutation** : le système i18n n'a **aucun dictionnaire** — `t(fr, en)` est un simple ternaire renvoyant l'un des deux littéraux passés en ligne (`src/lib/i18n.tsx`). Donc « clé manquante », « chaîne vide » et « `t()` qui plante » sont impossibles ici ; `useLanguage()` ne lève que hors `LanguageProvider`, qui enveloppe toute l'app (`App.tsx`).
- **Garde-fou ajouté (défensif, sans effet fonctionnel attendu)** : `BrokerPhotoComplianceBanner` calcule `message` puis `if (!message) return null;` — pas de `try/catch` autour d'un *hook* (règles des *hooks*). Le composant ne peut pas bloquer le rendu du `Layout`.
- **Limite** : ce garde-fou par composant **ne corrige pas** un échec de chargement de *chunk* (404). Si le *chunk* `Layout`/vendor tombe, c'est tout le sous-arbre qui échoue, pas seulement la bannière — relève alors du correctif de cache (déjà déployé) ou d'une `ErrorBoundary` racine (non encore en place).
- **Protocole de surveillance** : le PO (Alain) extrait l'onglet **Réseau** de la prod pour isoler le fichier `.js`/locale en 404 ou échec. Diagnostic réel en attente de cette preuve.

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
- Functions : `marketDocumentParseIA` (**512 MiB**, **60 s** depuis la refonte sémantique V2.8 ; historique hotfix massif : 2 GiB / 540 s), `injectMarketMacroStats` ; prebuild `sync-core-documents.cjs`, `sync-core-market.cjs`.
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

## Vérification de conformité de l'infrastructure de données (2026-05-29)

**Statut :** **[VALIDÉ PO — commit `feature/v2.8-market-stats-optimization` — 2026-05-29]**

| Élément | Détail |
|---------|--------|
| **Décision technique** | Refonte pipeline `marketDocumentParseIA` + `injectMarketMacroStats` pour déploiement multi-tenant grand public (V2.8). |
| **Découpage sémantique local** | `packages/core/src/market/marketPdfSemanticAnchors.ts` + `functions/src/documents/marketPdfSlice.ts` — extraction pages à ancrages québécois (taux de capitalisation (TGA), 75 ans et plus, MSSS, SCHL, indice de liquidité, SP/LP) avant Vertex. |
| **Cache déterministe** | Empreinte `contentHashMd5` sur `market_documents` ; clone `extractedData` si hash déjà parsé — zéro appel IA sur doublon binaire. |
| **Modèle IA** | `gemini-2.5-flash` conservé ; `responseMimeType: application/json` ; variables canoniques `tgaPct`, `population75_plus`, `monthsOfInventory`, `sellingPriceListingPriceRatio`. |
| **Multi-tenant** | `orgId` propagé (upload client, injection HITL, règles Firestore `market_documents` / `market_macro_stats`). |
| **Ressources Cloud Function** | `marketDocumentParseIA` : **512 MiB** / **60 s** (était 2 GiB / 540 s). |
| **Règle #0** | Enrichissement SSOT core ; architecture HITL préservée (injection courtier avant persistance macro). |

**HITL :** le courtier valide toujours les extractions avant injection ; le cache MD5 ne contourne pas la revue humaine sur les nouveaux dépôts identiques.

---

## Optimisation du moteur d'analyse comparative de marché (ACM) et traitement Big Data (V3.2 — 2026-05-29)

**Statut :** **[VALIDÉ PO — commit `feature/v2.8-market-stats-optimization` — build exit 0]**

| Élément | Détail |
|---------|--------|
| **Règle #0** | Enrichissement SSOT `@primexpert/core/market/centrisComparableCapRate.ts` — aucun moteur parallèle. |
| **Calcul TGA réel** | `calculateComparableCapRate()` — taux de capitalisation global (TGA) = revenu net d’exploitation (RNE) ÷ prix vendu × 100. |
| **Sources Big Data** | Fusion `listings_cache` (Centris Matrix, `source: centris_odata`) + `market_analytics_raw` filtrés par `regionAdministrative` et classe RPA. |
| **Service client** | `marketAnalyticsService.ts` + `useTerritorialCompetition` — abonnement temps réel, tri par récence. |
| **Workspace ACM** | `AcmValuationWorkspace.tsx` — taux de capitalisation global (TGA) médian dynamique ; ajustement qualitatif courtier (ex. +0,25 % vétusté) recalcule la valorisation SSOT instantanément. |
| **UI Marché** | `TerritorialCentrisCompetitionSection` — sous-onglet **Concurrence territoriale** (`MarcheConcurrenceTab`). |
| **Sécurité** | `firestore.rules` — lecture `listings_cache` pour utilisateurs authentifiés ; écriture serveur uniquement. |
| **Nettoyage** | Suppression des doublons `useTerritorialCentrisComparables` / `TerritorialCompetitionSection`. |

**HITL :** le courtier conserve la main sur le taux de capitalisation global (TGA) cible (saisie manuelle, réinitialisation au médian territorial) ; les comparables alimentent la diligence raisonnable, sans persistance automatique du prix suggéré.

---

## Mise en place du pipeline d'auto-alimentation décentralisé (Data Flywheel) et protocole d'anonymisation (chantier parallèle — 2026-05-29)

**Statut :** **[BROUILLON PR #4 — validation humaine Alain requise]** *(historique : chantier initialement suivi sans commit ; intégré au diff `4f351bd` puis documenté dans la session PR #4 ci-dessous)*

| Élément | Détail |
|---------|--------|
| **Règle #0** | SSOT `@primexpert/core/market/internalMarketFlywheel.ts` — enrichit le pipeline Big Data existant (`market_analytics_raw`, `marketSnapshots/v1`). |
| **Déclencheur** | Cloud Function `onTransactionConcludedFlywheel` — `onDocumentUpdated` sur `residences/{residenceId}`. |
| **Conditions** | Transition vers **promesse d'achat acceptée** (`promise` / `pa-acceptee`) ou **vendu** (`sold` / `vendue`) depuis un statut non terminal. |
| **Anonymisation** | Variables de performance seulement : classe d'actif, prix réel, taux de capitalisation global (TGA) via `calculateComparableCapRate`, prix au pi², région, ville, FSALDU-3. Purge : noms, UID, orgId, adresses exactes, cadastre, numéro d'inscription lié. |
| **Injection** | Collection `market_analytics_raw` — `dataSource: 'internal_flywheel'`, empreinte `internalFlywheelFingerprint`. |
| **Snapshot** | `refreshRegionalMarketSnapshotForFlywheel()` dans `injectMarketMacroStats.ts` — recalcul immédiat `marketSnapshots/v1` pour la région. |
| **Idempotence** | Marqueur `internalFlywheelIngestion` sur la fiche résidence (`promiseAtMillis` / `soldAtMillis`). |

**HITL :** l'alimentation provinciale est automatique et anonyme ; la fiche CRM résidence demeure sous contrôle du courtier titulaire de permis — aucune diffusion publique des données identifiantes.

---

## Intégration du module d'évaluation du ratio dépenses/revenus (OER) et benchmarks automatisés par classe d'actif (V3.7 — 2026-05-29)

**Statut :** **[LIVRÉ — scellé V3.7]**

| Élément | Détail |
|---------|--------|
| **Règle #0** | SSOT `@primexpert/core/analytics/marketMetrics.ts` — enrichit extraction IA, snapshots et workspace ACM existants. |
| **Modèle** | `operatingExpenseRatio` (%) — ratio des dépenses d'exploitation (RDE) = dépenses normalisées ÷ revenu brut effectif (RBE) × 100. |
| **Extraction IA** | `geminiExtract.ts` — prompt Vertex + validation par classe (`rpa`, `plex`, `commercial_pure`, `industrial`). |
| **Snapshots** | `injectMarketMacroStats.ts` — `provincialOerAggregates.operatingExpenseRatioMedian` par région / silo. |
| **UI ACM** | `AcmValuationWorkspace` — bannière jaune HITL si écart > 7 points vs médiane régionale `market_analytics_raw`. |

**HITL :** l'alerte recommande une révision des charges ; le courtier titulaire de permis valide avant toute conclusion de bancabilité.

---

## Évaluation d'infrastructure moderne — Recalage et unification des états financiers inter-onglets (SSOT Fix) (2026-05-30)

**Statut :** **[VALIDÉ PO — Build Global et Functions Exit 0 — Éradication des coquilles d'états inter-onglets]**

| Élément | Détail |
|---------|--------|
| **Règle #0** | `ResidenceDataContext` — fusion prop liste + listener Firestore ; enrichit `ResidenceDocumentContext` existant. |
| **Prix SSOT** | `getListingPrice()` — champ `price` prime sur `prixAnnonce` legacy ; normalisation inter-onglets. |
| **Calcul pur** | `getListingPricePerUnit()` — prix demandé ÷ unités totales (ex. 2 558 000 $ ÷ 23 → 111 217,39 $ / unité). |
| **Onglets alignés** | Synthèse, Identité, Finances, Déclaration, Marché, Promesse, Diffusion — consommation `useUnifiedResidence()`. |
| **Flywheel** | `internalMarketFlywheel.ts` — `computeFlywheelCapRatePct()` ; correction portée `closedAtMillis` (build functions exit 0). |
| **En-tête** | `ResidenceDetail` — prix unique via contexte ; mutation crayon → Firestore global + rafraîchissement en-tête. |

**HITL :** toute modification du prix demandé demeure validée par le courtier titulaire de permis avant diffusion ou conclusion.

---

## Évaluation d'infrastructure moderne — Redressement complet de la cohérence financière inter-onglets et élimination des données fantômes (2026-05-30)

**Statut :** **[VALIDÉ PO — commit `d232673` — build + hosting deploy 2026-05-30]**

| Élément | Détail |
|---------|--------|
| **Prix SSOT** | `resolvePrixDemande()` — interdit le `calc.prixDemande` legacy (3,5 M$) ; force `getListingPrice()` (2 558 000 $). |
| **RNE** | `resolveAdmissibleOpex()` — `depensesTotales` déclaré prioritaire si grille Firestore incomplète ; RNE = RBE − dépenses (**529 489 $** = 1 129 749 $ − 600 260 $). |
| **TGA réel** | Recalculé : 529 489 $ ÷ 2 558 000 $ = **20,70 %** (`syncCalcWithCanonicalListingPrice`). |
| **Emprunt + MFR** | Réalignement automatique quand le prix canonique diffère du `calculatedResults` figé ; somme = prix demandé. |
| **Hub Finance** | `useResidenceFinancialHints()` + `buildResidenceFinancialHints()` — hints unifiés sur tous les sous-onglets. |
| **Crash UI** | `ResidenceTabErrorBoundary` ; contextes `ResidenceDocument` / `FinancialData` mémoïsés ; gardes `ResidenceDetail`. |
| **Onglets** | Hub, Bilan, Finançabilité, Revenus & Dépenses, Ratios, Synthèse, Analyse 360° — consommation hints SSOT. |

**HITL :** le courtier valide les montants avant toute conclusion de bancabilité ou diffusion ACM.

---

## Intégration du protocole de gestion des inscriptions hors marché (Off-Market) (2026-05-29)

**Statut :** **[BROUILLON PR #4 — validation humaine Alain requise]** *(historique : chantier initialement suivi sans commit ; intégré au diff `4f351bd`)*

| Élément | Détail |
|---------|--------|
| **Schéma** | `listingSource: 'centris' \| 'off_market'` sur `residences` (inscriptions CRM) ; défaut `'centris'` pour l'historique. |
| **Création** | `CreateInscriptionForm` — sélecteur Centris vs hors marché sur « Nouv. Inscription ». |
| **Statut UI** | `InscriptionStatusDropdown` — édition libre si Off-Market ; Centris verrouillé MLS avec override manuel (`isManuallyOverridden`). |
| **PDF** | Filigrane « DOCUMENT CONFIDENTIEL — DIFFUSION RESTREINTE » sur rapports Hub Finance, ACM présentation et ACM vendeur. |
| **Sync** | `centrisListingsSyncNightly` — ignore catégoriquement `listingSource === 'off_market'`. |
| **Règle #0** | SSOT `@primexpert/core/residence/listingSource.ts` + `inscriptionBrokerageStatus.ts`. |

**HITL :** les fiches hors marché demeurent sous la responsabilité du courtier titulaire de permis ; la mention confidentielle protège le secret commercial du client vendeur.

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

**Hors périmètre sprint à cette étape (branché ensuite V3.0/V3.1) :** collection Firestore `legal_vault` + sous-collection `compliance_logs`, `firestore.rules` deny update/delete si `isFinalWormLocked`, Function Montréal append journal sur READ/WRITE/LOCK/EXPORT_ZIP, extension `UserProfile` côté `users/{uid}`.

---

## Archive — registre global de la suite logicielle — mai 2026

Statut officiel consolidé (conseil d'administration) :

| Volet | Statut certifié |
|-------|-----------------|
| Cœur CRM & fiches parties | **[OPÉRATIONNEL — PRODUCTION LIVE]** |
| Analyse de mise en marché (ACM) & benchmark taux de capitalisation (TGA) | **[OPÉRATIONNEL — PRODUCTION LIVE]** |
| Hub omnicanal (SMS / Nylas) | **[OPÉRATIONNEL — PRODUCTION LIVE]** |
| Clauses négociation Gemini | **[CÂBLÉ — MOTEUR DYNAMIQUE ACTIF]** |
| Coffre-fort WORM & sécurité | **[OPÉRATIONNEL — PRODUCTION LIVE]** |

**URL production :** https://primexpert-app-v2.web.app  
**Modules V2.8 complémentaires (hors registre exécutif) :** portail vendeur autonome (85 pièces), briefing matin, radar off-market — voir section session 2026-05-29 ci-dessus.

---

## Archive — architectures sécurisées V3.0 — mai 2026

Statut officiel post-déploiement V3.0 :

| Élément | Statut certifié |
|---------|-----------------|
| **URL officielle** | https://primexpert-app-v2.web.app |
| **Statut Firestore** | Règles WORM actives & verrouillées en prod |
| **Statut Cloud Function** | `onVaultDocumentWrite` — **[PROD LIVE — MONTRÉAL]** |
| **Registre exécutif** | 5 piliers d'élite majeurs certifiés et actifs |

---

## Mandat infrastructure V3.0 — Firestore WORM & journal Montréal (2026-05-29)

| Livrable | Emplacement | Statut |
|----------|-------------|--------|
| Règles WORM `legal_vault` | `firestore.rules` | **DEPLOYE — prod active** |
| Journal `compliance_logs` | Sous-collection append-only (Admin SDK) | **DEPLOYE** |
| Trigger journalisation | `onVaultDocumentWrite` — `northamerica-northeast1` | **PROD LIVE — MONTRÉAL** |
| Writer SHA-256 chaîné | `legalComplianceLogWriter.ts` | **ACTIF** |
| Prebuild | `sync-core-security.cjs` | **ACTIF** |

**Déploiement exécuté (2026-05-29) :**
```bash
firebase deploy --only firestore:rules                                    # ✔
FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions:onVaultDocumentWrite  # ✔ create northamerica-northeast1
```

---

Clôture officielle du cycle de développement V2.9 :

| Élément | Statut |
|---------|--------|
| **URL officielle** | https://primexpert-app-v2.web.app |
| **Monorepo** | **Archivé, validé, zéro dérive** — `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2` |
| **Mode sécurisation** | **Architectures sécurisées V3.0 — PROD LIVE** |

**Interprétation ops :** WORM Firestore + `onVaultDocumentWrite` Montréal déployés ; raccordement UI client V3.1 codé (déploiement hosting à exécuter).

**Repo :** https://github.com/alain-blip/primexpert-v2-core.git — branche `main`.

---

## 2026-05-29 — STATUT DE PRODUCTION ET RACCORDEMENT UI V3.1

**Statut sprint :** **[CODÉ — PRÊT DÉPLOIEMENT HOSTING]**

| Livrable | Emplacement | Statut |
|----------|-------------|--------|
| Orchestration onglet Documents | `DocumentsDiligenceTab.tsx` | **BRANCHÉ** — abonnement `legal_vault`, props org/licence/prix |
| Indicateur + action WORM | `LegalVaultWormPanel.tsx` | **ACTIF** — badge Brouillon / Sécurisé WORM·OACIQ, bouton verrouillage |
| Modale confirmation LCI | `LegalVaultWormLockModal.tsx` | **ACTIF** — validation nom au permis, type de permis, prix au contrat |
| Service mutation atomique | `legalVaultService.ts` | **ACTIF** — `ensureLegalVaultDraft` + `lockLegalVaultDocument`, IP client, gestion 403 |
| Liste documents (badges) | `DocumentUploadPanel.tsx` | **ÉTENDU** — badges WORM compacts par ligne |
| Panneau métadonnées | `DocumentMetadataPanel.tsx` | **ÉTENDU** — section « Verrouillage légal OACIQ » |
| Mapping types | `legalVaultDocumentMapping.ts` | **ACTIF** — ID déterministe `{propertyId}__{documentId}` |

**Mutation Firestore (verrouillage définitif) :**
```typescript
{
  isFinalWormLocked: true,
  lockedAtMillis: Date.now(),
  lastWriteClientIp: "<IP résolue ou 0.0.0.0>"
}
```
Chemin : `organizations/{orgId}/legal_vault/{documentId}` — règles V3.0 inchangées (transition `false → true` uniquement).

**Validation UX :**
- **Mobile-First** : modale bottom sheet (`items-end` → `sm:items-center`), boutons pleine largeur mobile, badges `flex-wrap`, layout Documents empilé (`flex-col lg:flex-row`).
- **Laptop Cockpit** : panneau métadonnées `lg:w-[300px]`, trois colonnes Documents / liste / détail.
- **Purge lexicale** : **0 occurrence** du mot banni « audit » dans l'UI V3.1 (libellés, modale, infobulles) — conformité OACIQ / vérification / verrouillage légal uniquement.

**Correctif build (alias Vite) :** `@primexpert/core/security` ajouté à `vite.config.ts` + `tsconfig.json` (résolution Rollup).

**Déploiement hosting recommandé :**
```bash
npm run build && firebase deploy --only hosting
```
Cible : https://primexpert-app-v2.web.app

---

## Assembleur de mandats — moteur de contrat natif & champs entre parenthèses (V3.5 — 2026-05-30)

**Statut :** **[SCELLÉ — commit `63286dc` — branche `feature/v2.8-market-stats-optimization` — HEAD = origin]**

| Élément | Détail |
|---------|--------|
| **Règle #0** | SSOT `@primexpert/core/forms/` — zéro docxtemplater ; export HTML natif (print / PDF navigateur). |
| **Legacy expulsée** | Copilote-RPA : `docxGenerator.js` (docxtemplater + PizZip) — **identifiée, non portée en V2**. Gabarit référence : `00_RPA_SYSTEME_APP/…/gabarits-v3/Promesse d'achat ACTIFS.docx`. |
| **Schéma parenthèses** | `annexeFieldSchema.ts` — `AnnexePrixFields.nouveauPrixNumerique` `( $ )`, `AnnexeRFields.retributionPct` `( % )`, `AnnexeGFields.ccvReference` `CCV-…` ; `ContractAssemblerFieldState`. |
| **Rendu dynamique** | `renderDynamicParenthesis.ts` — `.dynamic-value` / `.is-empty` ; `renderParenthesisMoney`, `renderParenthesisPercent`, `renderCcvReference`. |
| **Defaults ACM** | `buildContractAssemblerDefaults.ts` — prix annexe depuis RNE ÷ taux de capitalisation global (TGA) ajusté (`resolveCanonicalRne`, bootstrap ACM). |
| **Dossier HTML** | `renderContractAssemblerToHtml.ts` — contrat courtage + annexes cochées + promesse d'achat actifs (V3.4 `renderPaActifsToHtml`). |
| **UI** | `ContractAssemblerPanel.tsx` — checkboxes annexes, champs conditionnels, export HTML ; câblé dans `PromesseAchatTab` (`955410e` + `63286dc`). |
| **Alias build** | `@primexpert/core/forms` — `vite.config.ts` + `tsconfig.json`. |
| **Build racine** | `npm run build` — **SUCCESS exit 0** (validé avant propulsion). |

**HITL :** l'assembleur produit un brouillon HTML ; le courtier titulaire de permis valide le contenu juridique avant signature ou remise au client. Persistance Firestore de l'état assembleur — **hors périmètre V3.5** (été 2026).

**Commits de référence :**

| Commit | Contenu |
|--------|---------|
| `7ee43cb` | PA Actifs V3.4 — `paActifsTypes`, `renderPaActifsToHtml`, couplage ACM |
| `955410e` | Câblage `PromesseAchatTab` + unification SSOT onglets résidence |
| `63286dc` | V3.5 — `ContractAssemblerPanel`, schémas parenthèses, rendu HTML assembleur |

**Hors périmètre scellé (local non commité) :** docs PDF RPA (dossiers investissement).

---

## Déploiement production — redressement finance fiche résidence (2026-05-30)

| Point | Détail |
|-------|--------|
| **Commit** | `d232673` — `fix(finance): cohérence SSOT RNE et prix canonique sur toute la fiche résidence` |
| **Branche** | `feature/v2.8-market-stats-optimization` |
| **Build** | `npm run build` — exit 0 |
| **Hosting** | `firebase deploy --only hosting` → https://primexpert-app-v2.web.app |
| **Référence étalon** | 198 chemin du Roy — prix 2 558 000 $, RNE 529 489 $, TGA 20,70 % |

---

## Verrouillage technique fin de sprint — Primexpert V3.5 (2026-05-30)

| Point de contrôle | Statut |
|-------------------|--------|
| Jalon moteur de contrat | **[NATIVEMENT INTÉGRÉ AU CORE — ÉTANCHE]** |
| Gestion des parenthèses `( )` | **[SCHÉMAS TYPÉS & RENDU COMPILÉ]** |
| Synchronisation Git distante | **[PROPULSÉE — `d232673` sur `feature/v2.8-market-stats-optimization`]** |
| Build production racine | **[SUCCESS — exit 0]** |
| Hosting prod finance SSOT | **[DÉPLOYÉ — 2026-05-30]** |
| UI polish été 2026 | **[EN ATTENTE]** — PDF-A CraftMyPDF, persistance Firestore assembleur, gabarits annexes complets depuis `gabarits-v3` |

---

## Session 2026-06-01 — PR #4 « correctifs QA règles RPA » (`4f351bd`)

**Statut :** **[BROUILLON — validation humaine Alain requise]**
**Portée documentaire :** alignement Bible sur le diff `d13dadc...4f351bd`, sans modification applicative.

| Axe | Décision / fait source |
|-----|------------------------|
| **QA RPA** | Workflow `.github/workflows/rpa-transaction-test-coverage.yml`, `npm run test:rpa-coverage`, couverture Kanban `resolveColumnId` + délais PA acceptée ; aucun nouveau slug pipeline (`promise` reste la colonne PA). |
| **Règle #0 financière** | Les libellés UI retirent l'exposition `RNE ÷ TGA`; `noiGapToMarketValue()` et `resolveAdmissibleOpex()` restent dans `@primexpert/core/financial`. |
| **Inscriptions MLS / hors marché** | `listingSource: 'centris' \| 'off_market'`, `CreateInscriptionForm`, `InscriptionStatusDropdown`, sync Centris nocturne ignorée si hors marché ou override manuel. |
| **Concurrence territoriale** | `TerritorialCentrisCompetitionSection`, `useTerritorialCompetition`, `marketAnalyticsService` ; lecture `listings_cache` + `market_analytics_raw` pour médiane TGA ACM. |
| **Data Flywheel** | `onTransactionConcludedFlywheel` sur `residences/{residenceId}` ; transition `promise` / `sold` → document anonymisé `market_analytics_raw` + marqueur `internalFlywheelIngestion`. |
| **RDE/OER** | `@primexpert/core/analytics/marketMetrics.ts` calcule le ratio des dépenses d'exploitation (RDE), bornes par classe d'actif et alerte HITL si écart régional > 7 points. |
| **Marché PDF** | `marketDocumentParseIA` confirmé à **512 MiB / 60 s** ; découpage `marketPdfSlice.ts`, cache `contentHashMd5`, index `market_documents(orgId, uploadedAtMillis)` et `contentHashMd5`. |
| **WORM** | `organizations/{orgId}/legal_vault/{documentId}` + sous-collection `compliance_logs`; `onVaultDocumentWrite` Montréal écrit le journal append-only SHA-256. |
| **Authentification / hosting** | `signInWithPopup` demeure strict ; `firebase.json` ajoute `no-cache` sur `/workhub{,/**}` et `/acces-vendeur{,/**}` pour éviter les chunks obsolètes. |

**HITL :** la PR reste en brouillon ; Alain valide avant publication, déploiement ou fusion.

---

*Journal mis à jour : 2026-06-01 — PR #4 QA règles RPA documentée ; redressement finance SSOT fiche résidence (`d232673`) conservé comme jalon prod.*
