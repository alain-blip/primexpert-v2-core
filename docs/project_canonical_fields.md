# Dictionnaire canonique — données Primexpert V2

Aligné sur `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2`.  
Les champs **serveur** (`billingStatus`, `gracePeriodStartedAt`) ne sont **pas** modifiables par le client (absents de `users` `allow update` dans `firestore.rules`).

Référence alias / provenance : `packages/core/src/canonical/`.  
**Identité Phase 4 (lecture + écriture)** : `packages/core/src/identity/` — définitions UI dans `identitySections.ts`, `buildingAuditSections.ts`, `servicesRecognition.ts`, `rentPricingGrid.ts`.  
**Promesse d'achat (PA)** : `packages/core/src/transaction/` — `offreTronc.ts`, `offreConditions.ts`, `offreCloture.ts`, `promesseAchatEngine.ts`.  
**Assembleur contrat / formulaires natifs (V3.4–V3.5)** : `packages/core/src/forms/` — HTML sans OpenXML ; schéma parenthèses `annexeFieldSchema.ts` ; PA Actifs `paActifsTypes.ts`, `renderPaActifsToHtml.ts`.  
**Messagerie (Hub omnicanal)** : **SSOT unique** `users/{uid}/email_threads` (alias canonique `communication_threads` dans `@primexpert/core/mail`) + `messages` — Nylas, SMS Twilio, Meta ; analyse `@primexpert/core/mail` à l’écriture serveur.  
**Diffusion Web** : `packages/core/src/diffusion/` — vendoré dans `functions/src/diffusion/_vendored/` au prebuild.  
**CRM Contacts** : `packages/core/src/crm/` — fiche `organizations/{orgId}/contacts` ; liaisons `coBuyerIds` / `coSellerIds` ; typologie acheteur `deriveBuyerTier` ; **Loi 25** — `QuebecLaw25Consent` + `validateLaw25Compliance()`.  
**Après-vente (V2.7)** : `packages/core/src/market/closingEngine.ts` — tâches `source: 'closing_pipeline'` dans `residences/{id}/tasks`.  
**Copilote négociation (V2.6)** : `packages/core/src/ai/` — brouillons HITL `manualVerifications` (`kind: 'commercial_negotiation_clause'`).  
**Sécurité WORM (V3.0–V3.1)** : `packages/core/src/security/` — `legal_vault`, journal `compliance_logs`, conformité photo courtier.  
**Marché / analytics (V3.7–V3.8)** : `packages/core/src/analytics/marketMetrics.ts`, `market/internalMarketFlywheel.ts`, `financial/capitalization.ts` — ratio dépenses/revenus (RDE/OER), flywheel anonymisé, RNE/TGA centralisés.

---

## Collection `organizations/{orgId}/contacts/{contactId}`

**SSOT répertoire client** — remplace les collections legacy `clients/` / `vendors/` (interdit de dupliquer).

| Champ | Type | Description |
|--------|------|-------------|
| `orgId` | string | Organisation |
| **`ownerId`** | string | Courtier propriétaire (cloison ; réassignation admin) |
| `silo` | string | `RESIDENTIEL` \| `RES_COM` \| `COMMERCIAL_SPEC` |
| `assetNiche` | string | `RPA` \| `PLEX` \| `CPE` si `COMMERCIAL_SPEC` |
| `visibility` | string | `PRIVATE` \| `AGENCY_SHARED` (pool RPA seulement) |
| `leadSource` | string | `AGENCY_AD`, `BROKER_GENERATED`, `REFERRAL`, `IMPORT_LEGACY`, `OTHER` |
| `nom`, `prenom` | string | LCI |
| `adresse` | map | `ligne1`, `ville`, `province`, `codePostal` |
| `dateNaissance` | string | ISO `yyyy-mm-dd` |
| `occupationProfession` | string | Métier de la partie (≠ taux d’occupation immeuble) |
| `relationRoles` | array | `buyer`, `seller`, `professional`, `broker`, `former_owner`, `blacklist` |
| `email`, `telephone` | string | Coordonnées |
| **`residenceIds`** | array | Dossiers résidence liés (cache bidirectionnel avec `partiesImpliquees`) |
| **`coBuyerIds`** | array | Coacheteurs — liaison bidirectionnelle writeBatch |
| **`coSellerIds`** | array | Covendeurs — liaison bidirectionnelle writeBatch |
| **`buyerQualificationStatus`** | string \| null | État pipeline acheteur **aplati** (pas de collection `buyerPipeline/` en V2). Valeurs : `PENDING_NDA`, `NDA_SIGNED`, `FUNDS_VERIFIED`, `QUALIFIED`. Import legacy : voir règle ci-dessous. |
| **`buyerCriteria`** | map | Critères acheteur — voir ci-dessous |
| **`sellerCriteria`** | map | Critères vendeur — voir ci-dessous |
| **`communicationPreferences`** | map | `unsubscribedFromEmails`, `excludedFromMassMailing` (Loi 25 / LCAP) ; voir **`law25Consent`** ci-dessous |
| `legalVerification` | map | OACIQ art. 30 — identité / sollicitation |
| **`importMeta`** | map | Import legacy — voir ci-dessous |
| `notes` | string | Notes libres |

### `buyerQualificationStatus` — import Maillon 1 (`legacyContactImport.ts`)

| Règle | Comportement |
|-------|----------------|
| Stage explicitement qualifié | `QUALIFIE`, `QUALIFIED`, `ACHETEURS_QUALIFIES`, … → `QUALIFIED` seulement si preuves cohérentes ; sinon dégradation `NDA_SIGNED` / `FUNDS_VERIFIED` / `PENDING_NDA` |
| Stage suivi / nouveaux | `ACHETEURS_EN_SUIVI_NOUVEAUX`, … → **`PENDING_NDA`** par défaut |
| Preuves contact + pipeline | `QUALIFIED` **uniquement** si NDA **et** fonds (`ndaFile` / `hasNdaSigned` + `proofOfFundsFile` / `hasProofOfFunds`, etc.) |
| Exemple validé dry-run | Pichette (`ndaSigned: false`) → `PENDING_NDA` ; Verret (NDA + fonds fichiers) → `QUALIFIED` |

### Objet `importMeta` (contacts importés)

| Clé | Type | Description |
|-----|------|-------------|
| `legacySources` | array | `{ collection: contacts \| vendors, id }` |
| `mergedCount` | number | Nombre de fiches legacy fusionnées |
| `lciIncomplete`, `missingLciFields` | bool / array | LCI à compléter post-import |
| **`pipelineHistory`** | array | Journal stages `buyerPipeline/` — `{ collection, id, stage, pipelineOverride?, assignedTo? }` |
| `pipelineOverride` | string \| null | Dernière colonne Kanban override legacy |

### Objet `buyerCriteria`

| Clé | Type | Description |
|-----|------|-------------|
| `ndaFile`, `proofOfFundsFile`, `bankLetterFile`, `mortgagePreApprovalFile` | map | `{ url, storagePath, uploadedAt? }` — Storage `buyer_documents/{kind}/` |
| `corporateMandate` | map | `isMandatory`, `companyName`, `reqNumber`, `reqFile?` |
| `budgetMax`, `tgaMinimum`, `downpaymentAmount` | number | Critères financiers / web |
| `regions` | array | Marchés visés |
| `residenceTypes` | array | `RPA`, `RI`, `CHSLD` |
| `unitsMin`, `unitsMax` | number | Taille cible |
| `experienceDescription` | string | Expérience gestion |
| `hasBroker` | bool | Déjà accompagné d’un courtier |
| `timeline` | string | Échéancier acquisition (`IMMEDIATE`, `0_3_MONTHS`, …) |

> **Typologie dérivée (non éditable)** : `deriveBuyerTier()` → `PRIVILEGED` \| `CONFIDENTIAL` \| null.

### Objet `sellerCriteria`

| Clé | Type | Description |
|-----|------|-------------|
| `brokerageContractFile` | map | Contrat de courtage |
| `ownershipProofFile` | map | Titre de propriété |
| `sellerDeclarationFile` | map | Déclaration du vendeur |
| `corporateMandate` | map | Inc. / NEQ / REQ — Storage `seller_documents/{kind}/` |

### Chemins Storage contact

| Schéma | Usage |
|--------|--------|
| `primexpert/{orgId}/contacts/{contactId}/id_proofs/…` | Pièce d’identité LCI |
| `primexpert/{orgId}/contacts/{contactId}/buyer_documents/{kind}/…` | Pièces acheteur |
| `primexpert/{orgId}/contacts/{contactId}/seller_documents/{kind}/…` | Pièces vendeur |

### Objet `communicationPreferences.law25Consent` (`QuebecLaw25Consent`)

Preuve affirmative Loi 25 — requis avant envois SMS/courriel marketing omnicanal (garde-fou `ingestOmnichannelMessage` planifié).

| Clé | Type | Description |
|-----|------|-------------|
| `smsOptIn` | bool | Consentement SMS |
| `emailOptIn` | bool | Consentement courriel |
| `consentGrantedTimestamp` | number | Horodatage collecte (ms) |
| `collectedFromIpAddress` | string | Adresse IP formulaire |
| `consentSourceForm` | string | ex. `RpaEvaluationRequestForm`, `VendorPortalSignup` |
| `dataRetentionExpiryTimestamp` | number | Fin rétention — **6 ans** après collecte (`computeLaw25DataRetentionExpiryMillis`) |
| `consentRevokedTimestamp` | number | optionnel — révocation |

Validation : `validateLaw25Compliance(consent)` dans `contactTypes.ts`.

---

## Sous-collection `organizations/{orgId}/tasks/{taskId}`

Tâches courtier (CRM, SMS critique, téléversement portail vendeur).

| Champ | Type | Description |
|--------|------|-------------|
| `title` | string | Intitulé |
| `description` | string | Détail |
| `dueAtMillis` | number | Échéance (ms) |
| `ownerId` | string | UID courtier assigné |
| `status` | string | `a_faire` \| `fait` |
| `priority` | string | optionnel |
| `source` | string | `voice_intent`, `vendor_portal_upload`, … |
| `residenceId` | string | optionnel |

---

## Document `organizations/{orgId}/morning_briefings/{brokerId}`

Briefing du matin — cron `morningBriefingGenerator` (06:00 Toronto) ou recalcul client.

| Champ | Type | Description |
|--------|------|-------------|
| `dateKey` | string | Jour `yyyy-mm-dd` |
| `generatedAtMillis` | number | Horodatage génération |
| `brokerId`, `orgId` | string | Contexte |
| `criticalTasks` | array | Tâches critiques |
| `appointments` | array | Rendez-vous |
| `hotLeadsTop3` | array | Top 3 contacts chauds |

---

## Document `organizations/{orgId}/prospects_radar/{prospectId}`

Radar off-market — signaux faibles (`radarOpportunitesEngine.ts`).

| Champ | Type | Description |
|--------|------|-------------|
| `brokerId`, `orgId`, `residenceId` | string | Contexte |
| `signalType` | string | `occupancy_drop` \| `certification_expiry` |
| `score` | number | 0–100 |
| `propertyLabel`, `titleFr`, `titleEn`, `summaryFr`, `summaryEn` | string | Affichage |
| `detectedAtMillis` | number | Détection |

> ID : `{residenceId}__{signalType}`.

---

## Collection `vendor_portal_invites/{token}`

Jetons portail vendeur autonome (TTL 30 j).

| Champ | Type | Description |
|--------|------|-------------|
| `token`, `orgId`, `contactId`, `residenceId`, `brokerId` | string | Contexte |
| `createdAtMillis`, `expiresAtMillis` | number | Validité |
| `active` | bool | Révoqué si `false` |

**Callables :** `createVendorPortalInvite` · `validateVendorPortalToken` (+ `customToken` Auth).

---

## Collection `organizations/{orgId}/legal_vault/{documentId}`

Coffre légal WORM OACIQ — brouillon créable par le courtier, verrouillage final irréversible (`false → true` seulement), suppression interdite.

| Champ | Type | Description |
|--------|------|-------------|
| `documentId` | string | ID du document, identique à l'ID Firestore |
| `orgId` | string | Organisation du chemin |
| `brokerId` | string | UID courtier créateur |
| `propertyId` | string | Résidence liée |
| `propertyDocumentId` | string | Document source `residences/{id}/documents/{documentId}` |
| `documentType` | string | `CONTRAT_COURTAGE` \| `PROMESSE_ACHAT` \| `FICHE_DESCRIPTIVE` \| `ACM_REPORT` |
| `storageUrl` | string | URL / chemin coffre sécurisé |
| `isFinalWormLocked` | bool | `false` au brouillon ; `true` après verrouillage final |
| `createdAtMillis`, `lockedAtMillis` | number | Création et verrouillage |
| `oaciqRetentionExpiryTimestamp` | number | Rétention minimale 2190 jours |
| `metadataFieldsCrossChecked` | map | `contractPrice`, `validatedLicenseName`, `licenseType` — validation croisée avant verrouillage |
| `lastWriteClientIp` | string | IP client résolue au verrouillage |

**ID déterministe UI :** `{propertyId}__{propertyDocumentId}` via `legalVaultDocumentMapping.ts`.

### Sous-collection `organizations/{orgId}/legal_vault/{documentId}/compliance_logs/{entryId}`

Journal de conformité append-only écrit par Admin SDK (`onVaultDocumentWrite`, Montréal).

| Champ | Type | Description |
|--------|------|-------------|
| `entryId` | string | ID journal, identique à l'ID Firestore |
| `userId`, `userRole` | string | Acteur (`COURTIER`, `ADJOINT`, `DIRIGEANT`, `SUPPORT`) |
| `actionType` | string | `READ` \| `WRITE` \| `LOCK` \| `EXPORT_ZIP` |
| `targetDocumentId` | string | Document vault parent |
| `timestampMillis` | number | Horodatage |
| `clientIpAddress` | string | IP client ou `cloud-function` |
| `integrityHash` | string | SHA-256 chaîné |

> Règles : lecture par membre de l'organisation ; création client, mise à jour et suppression interdites sur le journal.

---

## Collection `users/{uid}`

| Champ | Type Firestore | Valeurs / format | Description |
|--------|----------------|------------------|-------------|
| `uid` | string | — | Firebase Auth UID |
| `email` | string | — | Courriel |
| `displayName` | string | — | Nom affiché |
| `photoUrl` | string | — | Avatar |
| **`profilePhotoUploadedAtMillis`** | number | — | Horodatage conformité photo courtier ; validité 1826 jours via `brokerProfileCompliance.ts` |
| `orgId` | string | — | Organisation |
| `role` | string | `admin` \| `admin_system` \| `member` | `admin_system` = direction / Finance |
| **`trialStartDate`** | Timestamp ou `yyyy-mm-dd` | — | Début essai **45 jours** |
| **`billingStatus`** | string | `active` \| `grace_period` \| `suspended` | Chérif — **écrit serveur** |
| **`gracePeriodStartedAt`** | Timestamp / ISO | — | Début **72 h** de grâce — **écrit serveur** |
| **`lastEmailSent`** | string \| null | `J7` \| `J21` \| `J30` \| `J40` \| null | Relance onboarding |
| `accessibleSilos` | array | `RPA`, `CPE`, `PLEX` | RBAC silos Radar |
| `licenseName`, `title`, `agency` | string | optionnel | Profil OACIQ |
| `firstName`, `lastName`, `phone` | string | optionnel | Profil |
| **`telephony`** | map | — | VOIP — attribution admin (Phase 0–1) |
| **`telephony.twilioNumber`** | string | E.164 | Numéro Twilio assigné — **obligatoire** pour `getTwilioToken` |
| **`telephony.agentCellNumber`** | string | E.164, optionnel | Cellulaire de secours / callback |
| **`j7Survey`** | map | — | Réponses enquête J+7 |
| **`emailAccounts`** | array / map | — | Comptes Nylas liés (messagerie) |

### Abonnement (démo / à migrer Stripe)

| Champ | Type | Description |
|--------|------|-------------|
| `hasPaymentMethod` | bool | Carte enregistrée |
| `planId` | string | `solo`, `pro`, `pro_plus`, … |
| `isAffiliated` | bool | Affilié Prisma |
| `billingCycle` | string | `annual` \| `monthly` |

### Sous-collections `users/{uid}/…`

| Chemin | Usage |
|--------|--------|
| **`email_threads/{threadId}`** | **SSOT absolu des communications** — seule source pour la boîte courriel Workhub, la chronologie Intelligence et les envois métier (Nylas) |
| **`email_threads/{threadId}/messages/{messageId}`** | **SSOT message** — corps + métadonnées d’analyse OACIQ (plus de duplication dans une autre collection) |
| `call_analyses/{driveDocumentId}` | Transcription appel (E-3), `residenceId`, `pipelineStatus` |
| `mailbox_analyses/{messageId}` | **Déprécié / fusionné** — ne plus écrire ; données historiques seulement. Remplacé par les champs d’analyse sur `messages` |

> **Règle #0 messagerie :** une communication = un document `messages/{id}`. L’UI lit via `mailboxAnalysis.ts` (collectionGroup `messages`), pas via `mailbox_analyses`.

#### Document fil `email_threads/{threadId}`

| Champ | Type | Description |
|--------|------|-------------|
| `brokerId` | string | UID courtier (= `users/{uid}`) |
| `accountId` | string | Compte `users.emailAccounts[].id` |
| `nylasThreadId` | string \| null | Identifiant fil Nylas |
| `subject` | string | Objet |
| `contactName` | string | Nom affiché du correspondant |
| `contactEmail` | string \| null | Courriel correspondant |
| `lastMessageSnippet` | string | Extrait dernier message |
| `lastMessageAtMillis` | number | Horodatage dernier message (ms) |
| `isUnread` | bool | Non-lu côté PrimeXpert |
| `mailboxFolder` | string | `INBOX`, `SENT`, `ARCHIVE`, `TRASH`, `DRAFT` |
| `propertyId` | string \| null | Fiche résidence liée (envoi métier ou match analyse) |
| `propertyLabel` | string \| null | Libellé affiché inscription |
| **`matchedContactId`** | string \| null | Contact CRM lié explicitement (Phase 2 messagerie) |
| **`primaryChannel`** | string | `email` \| `sms` \| `facebook` \| `instagram` — canal dominant |
| **`externalThreadKey`** | string \| null | Clé stable (`crm_{contactId}`, `sms_{digits}`, `meta_{senderId}`) |
| **`contactPhone`** | string \| null | Téléphone correspondant (SMS) |
| `createdAtMillis` | number | Création fil (ms) |

#### Sous-document `messages/{messageId}`

| Champ | Type | Description |
|--------|------|-------------|
| `threadId` | string | Parent |
| **`channel`** | string | `email` \| `sms` \| `facebook` \| `instagram` (défaut `email` si absent) |
| `brokerId` | string | UID courtier (requêtes `collectionGroup`) |
| **`metadata`** | map | `externalSenderId`, `fromPhone`, `twilioMessageSid`, `metaMessageId`, … |
| **`isCritical`** | bool | Alerte mobile — urgence détectée (SMS / Meta entrants) |
| `nylasMessageId` | string | Clé déduplication Nylas |
| `body` | string | Corps (texte / HTML selon Nylas) |
| `sentAtMillis` | number | Date envoi (ms) |
| `direction` | string | `inbound` \| `outbound` |
| `fromAccountId` | string | Boîte source |
| `fromEmailAddress` | string | Adresse expéditeur |
| `attachments` | array | PJ (vide à l’ingestion — Phase ultérieure) |
| `isOpened` | bool | Accusé lecture (sortant, webhook `message.opened`) |
| **`mailAnalysisAtMillis`** | number | Horodatage analyse (@primexpert/core/mail) |
| **`matchedResidenceId`** | string \| null | Fiche résidence / inscription rattachée (heuristique inventaire courtier) |
| **`mailContactEmail`** | string \| null | **`contactEmail`** — courriel partie (traçabilité Loi 25 / chronologie) |
| **`mailContactName`** | string \| null | Nom correspondant |
| **`mailIntent`** | string \| null | **`intent`** — `buyer` \| `seller` \| `peer` \| `agency` \| `unknown` |
| **`summaryOneLine`** | string | Résumé une ligne (diligence / Intelligence) |
| **`mailUrgency`** | string | `low` \| `medium` \| `high` |
| **`mailAnalysisSource`** | string | `heuristic` (enrichissement Gemini optionnel — hors webhook Phase 1) |
| **`matchedContactId`** | string \| null | Contact CRM lié (Phase 2 — liaison manuelle ou auto par courriel) |
| **`linkedContactAtMillis`** | number | Horodatage liaison CRM (ms) — chronologie si pas d’analyse serveur |

> **Écriture analyse :** serveur uniquement (`syncNylasMessageToFirestore` + `verifyNylasWebhookSignature`). **Écriture liaison CRM :** client authentifié via `linkEmailThreadToContact()` (`emailSyncService.ts`). Index Firestore : `messages` collectionGroup (`brokerId` + `mailAnalysisAtMillis` ; `brokerId` + `matchedResidenceId` + `mailAnalysisAtMillis` ; **`brokerId` + `matchedContactId`**).

---

## Collection `residences/{residenceId}`

Document racine — **SSOT onglet Identité** (`ResidenceDocumentContext`) + Radar + prix affiché.  
Écriture Phase 4b : `updateDoc` sur ce document (pas de sous-collection identité).

### Champs racine — multi-tenant & pipeline

| Champ | Type | Description |
|--------|------|-------------|
| **`courtiersResponsables`** | string | **UID courtier propriétaire** (clé multi-tenant) |
| `address`, `city` | string | Adresse affichée |
| `price` / `prixDemande` | number | Prix demandé — **SSOT lecture** : `getListingPrice()` (`price` prime sur `prixAnnonce` legacy) via `ResidenceDataContext` |
| `prixAnnonce` | number | Miroir legacy Copilote — **ne pas utiliser seul** pour Hub Finance si `price` présent |
| `askingPrice` | number | Alias / miroir prix demandé (cartes inscriptions, Synthèse) |
| **`residenceName`**, `commercialName`, `nomCommercial`, `nom_commercial`, `name` | string | Nom commercial affiché (cartes inscriptions, mapping `mapCommercialName`) |
| **`commissionRate`**, `tauxCommission`, `commissionPct` | number | Taux commission (%) — lecture UI rétribution / inscriptions |
| **`potentialRevenue`**, `revenuPotentiel`, … | number | Revenu potentiel affiché si présent ; sinon dérivé `prix × taux` côté affichage |
| **`status`** | string | `prospect`, `mandate`, `promise`, `expired`, `unsigned`, `sold` — **ne pas renommer** |
| **`statut`** | string | Miroir français MLS / courtage : `actif`, `suspendue`, `expiree`, `vendue`, `annulee`, `prospect` |
| **`listingSource`** | string | `centris` \| `off_market` — défaut `centris` pour historique |
| **`isManuallyOverridden`** | bool | Empêche la réconciliation MLS automatique si le courtier reprend le statut |
| **`lastManualStatusUpdateAt`** | number \| null | Horodatage override manuel |
| **`centrisLastSyncAtMillis`** | number | Dernière synchronisation serveur Centris |
| **`region`** | string | Région administrative Québec (filtre inscriptions — `QUEBEC_REGIONS`) |
| **`prixAccepte`** | number | Prix accepté (promesse) — requis pour glisser vers colonne `promise` (DnD Kanban) |
| **`contratCourtage`** | map | Mandat courtage — complétude OACIQ (`mandateCompleteness.ts`) |
| `assetNiche` | string | `RPA` \| `CPE` \| `PLEX` |
| `propertyType` | string | `rpa`, `cpe`, `plex`, `commercial` |
| `date` | string | Date inscription / mandat (UI) |

### Objet `internalFlywheelIngestion`

Marqueur d'idempotence sur `residences/{id}` pour éviter les doubles injections anonymisées dans `market_analytics_raw`.

| Clé | Type | Description |
|-----|------|-------------|
| `promiseAtMillis` | number | Première transition vers promesse acceptée |
| `soldAtMillis` | number | Première transition vers vendu |
| `lastAnalyticsDocId` | string | Empreinte du dernier document analytics |
| `lastTransitionKind` | string | `promise` \| `sold` |
| `updatedAtMillis` | number | Dernière mise à jour du marqueur |

### Champs racine — parties & diligence (Phase C CRM RPA)

| Champ | Type | Description |
|--------|------|-------------|
| **`partiesImpliquees`** | array | Intervenants liés au CRM — `{ contactId, role, assigneLe }` |
| **`complianceChecklist`** | map | Checklist diligence RPA — voir ci-dessous |

#### Objet élément `partiesImpliquees[]`

| Clé | Type | Description |
|-----|------|-------------|
| `contactId` | string | ID `organizations/{orgId}/contacts/{contactId}` |
| `role` | string | `VENDEUR` \| `ACHETEUR` \| `NOTAIRE` \| `COLLABORATEUR` |
| `assigneLe` | string (ISO) ou Timestamp | Date d’assignation au dossier |

> Écriture : patches diff-based via `@primexpert/core/residence` (`buildAddPartiePatch`, `buildRemovePartiePatch`) — ne pas écraser le reste du document.

#### Objet `complianceChecklist`

| Clé | Type | Description |
|-----|------|-------------|
| `items` | map | Clé = id item (ex. `certification_ciusss`) → `{ status, verifiedAt?, notes? }` |
| `updatedAt` | string (ISO) | Dernière mise à jour checklist |

Statuts item : `PENDING` \| `VERIFIED` \| `REJECTED` \| `NOT_APPLICABLE`.

Items RPA de base (SSOT `RPA_DILIGENCE_CHECKLIST_ITEMS`) : certification CIUSSS, registre des baux, inspection incendie, états financiers normalisés, assurance responsabilité.

> Écriture : `buildComplianceItemStatusPatch()` fusionne un item sans écraser les autres clés du document racine.

### Champs racine — établissement (section « Identification »)

| Champ | Type | Description |
|--------|------|-------------|
| `name` | string | Nom commercial |
| `numeroCertification` | string | Numéro de certification |
| `residenceType` | string | Type de résidence |
| `categorieRPA` | string | Catégorie RPA (également affichée dans Services) |
| `dateOuverture` | string / date | Date d'ouverture |
| `telephone`, `courriel`, `siteWeb` | string | Coordonnées |

### Champs racine — structure juridique (plats + imbriqués)

| Champ | Type | Description |
|--------|------|-------------|
| `raisonSociale` | string | Raison sociale |
| `formeJuridique` | string | Forme juridique |
| `neq` | string | NEQ |
| `dateConstitution` | string / date | Date de constitution |
| `historiqueFusionREQ` | string | Historique fusion REQ |
| `trancheSalariesREQ` | string | Tranche salariés REQ |
| **`administrateursREQ`** | array \| string | **Administrateurs issus du REQ** — liste d'objets `{ nom, fonction?, … }` ou texte sérialisé selon migration |
| `administrateursMSSS` | array | Administrateurs (registre MSSS) — distinct du REQ |
| `actionnaires` | array | Actionnaires `{ nom, pourcentage?, … }` |
| **`structureJuridique`** | map | Sous-bloc juridique imbriqué (voir ci-dessous) |

#### Objet `structureJuridique`

| Clé | Type | Description |
|-----|------|-------------|
| `administrateursREQ` | array | Copie ou source canonique des administrateurs REQ |
| **`confirmedBy`** | string | `"user"` après édition manuelle courtier — **coupe le badge Raphaël ✨** sur les champs de ce bloc |

> Lecture UI : priorité `administrateursREQ` racine, puis `structureJuridique.administrateursREQ`, alias `administrateurs` / `administrateursRegistre`.

> Le type Firestore inclut encore `expired` pour l’héritage et les filtres ; le **pipeline Kanban « chaud »** (`PIPELINE_ACTIVE_STATUSES` côté app) exclut `expired` des quatre colonnes actives.

### Bâtiment — 5 silos de vérification identité (sous-objets Firestore)

Chaque silo est un **map** sur le document racine. Les champs peuvent aussi exister en **racine** (legacy Copilote / alias) ; l'UI résout via `resolveIdentityField()` et `getResidenceField()`.

#### Silo 1 — `cadastre` (Cadastre et évaluation municipale)

| Clé | Type | Description |
|-----|------|-------------|
| `evaluationTerrain` | number | Évaluation terrain ($) |
| `evaluationBatiment` | number | Évaluation bâtiment ($) |
| **`confirmedBy`** | string | `"user"` — confirmation bloc cadastre |

| Champ racine (miroir) | Type | Description |
|----------------------|------|-------------|
| `lotsCadastraux` | string | Lots cadastraux |
| `superficieTerrain` | number | Superficie terrain (m²) |
| `evaluationFonciere` | number | Évaluation foncière totale ($) |

#### Silo 2 — `validationJLR` (Validation croisée — évaluation & JLR)

| Clé | Type | Description |
|-----|------|-------------|
| `valeurMarche` | number | Valeur marché JLR ($) |
| `comparatif` | string | Comparatif / dossier JLR |
| `historique` | string | Historique des évaluations JLR |
| `ecartPct` | number | Écart évaluation / JLR (%) |
| **`confirmedBy`** | string | `"user"` — confirmation bloc JLR |

| Champ racine (miroir) | Type | Description |
|----------------------|------|-------------|
| `valeurMarcheJLR` | number | Alias valeur marché |
| `comparatifJLR` | string | Alias comparatif |
| `historiqueEvaluationsJLR` | string | Alias historique |
| `ecartEvaluationPct` | number | Alias écart % |

#### Silo 3 — `immeuble` (Structure du bâtiment + installations techniques)

Un seul objet partagé pour **structure** et **installations** (deux blocs UI, même `confirmedBy`).

| Clé | Type | Description |
|-----|------|-------------|
| `constructionType` | string | Type de structure |
| `toiture` | string | Toiture |
| `generatrice` | boolean \| string | Génératrice de secours |
| `systemeMecanique` | string | Système mécanique |
| **`confirmedBy`** | string | `"user"` — confirmation bloc immeuble |

| Champ racine (miroir) | Type | Description |
|----------------------|------|-------------|
| `anneeConstruction` | number | Année de construction |
| `nombreEtages` | number | Nombre d'étages |
| `superficieBatiment` | number | Superficie bâtiment (m²) |
| `typeToiture` | string | Alias toiture |
| `ascenseur` | boolean | Ascenseur (Oui/Non) |
| `nombreAscenseurs` | number | Nombre d'ascenseurs |
| `climatisation` | string | Climatisation |
| `mitigeursEauChaude` | string | Mitigeurs eau chaude |
| `historiqueInvestissementsPermis` | string | Historique investissements / permis |
| `systemeGicleurs`, `giclee`, `sprinklers` | bool / string | Gicleurs (sécurité peut aussi utiliser racine) |

#### Silo 4 — `securite` (Sécurité)

| Clé | Type | Description |
|-----|------|-------------|
| `alarmeIncendie` | string | Alarme incendie |
| `conformiteIncendie` | string | Conformité incendie |
| `alarmeIntrusion` | string | Alarme intrusion |
| **`confirmedBy`** | string | `"user"` — confirmation bloc sécurité |

| Champ racine (miroir) | Type | Description |
|----------------------|------|-------------|
| `systemeGicleurs` | boolean \| string | Système de gicleurs |

### Tableaux spécialisés Phase 4

#### Objet `servicesReconnaissance` (Services & Reconnaissance)

| Clé | Type | Description |
|-----|------|-------------|
| `numeroRQRA` | string | Numéro RQRA |
| `niveauSoins` | string | Niveau de soins |
| **`servicesActifs`** | array\<string\> | **IDs de services actifs** : `repas`, `soins`, `hebergement`, `animation`, `entretienMenager`, `blanchisserie`, `transport`, `soinsInfirmiers` |
| **`confirmedBy`** | string | `"user"` après édition manuelle |

| Champ racine (legacy) | Type | Description |
|----------------------|------|-------------|
| `servicesOfferts` | array | Ancien format — lu en secours |
| `servicesActifs` | array | Ancien format racine |

> `categorieRPA` reste un champ racine canonique ; recopié dans l'UI Services.

#### Objet `tarificationLoyers` (Tarification des loyers)

| Clé | Type | Description |
|-----|------|-------------|
| **`rows`** | map | Une entrée par type d'unité (clés **fixes** ci-dessous) |
| **`confirmedBy`** | string | `"user"` après édition manuelle du tableau |

Chaque entrée de `rows.{typeKey}` :

| Clé | Type | Description |
|-----|------|-------------|
| `qty` | number | Quantité d'unités |
| `occupationPct` | number | Taux d'occupation (0–100) |
| `loyerMoyen` | number | Loyer mensuel moyen ($) |

**Clés `typeKey` autorisées dans `rows` :**

| `typeKey` | Sync champ racine (`qty`) |
|-----------|---------------------------|
| `studios` | `nombreStudios` |
| `chambresSimples` | `nombreChambresSimples` |
| `chambresDoubles` | `nombreChambresDoubles` |
| `deuxDemie` | `nombre2demie` |
| `troisDemie` | `nombre3demie` |
| `quatreDemie` | `nombre4demie` |
| `unitesSoins` | `nombreUnitesSoins` |

**Revenu potentiel annuel (dérivé, non stocké obligatoire)** :  
`qty × (occupationPct / 100) × loyerMoyen × 12` — calculé dans `@primexpert/core/identity/rentPricingGrid.ts`.

**Fail-safe finance** : si `financial/dataV2.baseData.revenusAnnuels` est absent, `normalizeFinancialData()` peut dériver le RBE depuis la somme des revenus potentiels du tableau (`deriveRevenusAnnuelsFromTarification()`).

**IDs d'édition UI (Phase 4b)** : `rent-{typeKey}-qty` \| `occupation` \| `loyer` (ex. `rent-troisDemie-loyer`).

### Effectifs & clientèle (complément identité)

| Champ | Type | Description |
|--------|------|-------------|
| `effectifs` | map | `jourSemaine`, `jourFinSemaine`, `soir`, `nuit` + `confirmedBy` |
| `clientele` | map | `ageDistribution`, etc. + `confirmedBy` |
| `nombreUnitesTotal`, `tauxOccupation` | number | Agrégats capacité |

### Enrichissement MSSS & déclaration vendeur

| Champ | Type | Description |
|--------|------|-------------|
| **`msssEnrichment`** | map | `lastEnriched`, `source`, `numeroRegistre`, `detailsScraped`, `confidence` — **prérequis badge Raphaël ✨** |
| **`declarationVendeur`** | map | Phase 5 — `status` (`draft` \| `lock`), `answers`, `certifiedAt`, `certifiedBy` |

---

## Gestion des confirmations humaines & Badge Raphaël ✨

Règle produit : **l'humain a préséance sur l'IA**. Tant qu'un champ MSSS n'est pas confirmé par le courtier, le badge ✨ peut s'afficher si `msssEnrichment` est présent.

### Mécanisme A — `confirmedBy` sur le sous-bloc parent

Lors d'une sauvegarde au **blur** (Phase 4b), si `msssEnrichment` existe, le patch Firestore positionne **`confirmedBy: "user"`** sur le map parent :

| Sous-objet parent | Déclencheur (exemples de champs édités) |
|-------------------|----------------------------------------|
| `structureJuridique` | `administrateursREQ` |
| `cadastre` | `evaluationTerrain`, `evaluationBatiment` |
| `validationJLR` | `valeurMarche`, `comparatif`, `historique`, `ecartPct` |
| `immeuble` | `constructionType`, `toiture`, `generatrice`, `systemeMecanique` |
| `securite` | `alarmeIncendie`, `conformiteIncendie`, `alarmeIntrusion` |
| `servicesReconnaissance` | `numeroRQRA`, `niveauSoins`, toggle `servicesActifs` |
| `tarificationLoyers` | toute cellule `rows.*` |
| `effectifs` | effectifs par quart |

Effet : **tous les champs** du bloc partageant ce parent perdent le badge ✨ (lecture via `parent.confirmedBy === "user"`).

### Mécanisme B — `identityConfirmations` (champs racine)

Pour les champs **sans** `confirmedPath` imbriqué (ex. `neq`, `lotsCadastraux`, `anneeConstruction`, cellules `rent-*`) :

```typescript
identityConfirmations: {
  [fieldId: string]: {
    confirmedBy: "user",
    confirmedAt: string  // ISO 8601
  }
}
```

| Exemple `fieldId` | Contexte |
|-------------------|----------|
| `neq` | Champ juridique racine |
| `rent-troisDemie-loyer` | Cellule tarification |
| `service-badge-repas` | Toggle puce service |

Effet : `shouldShowRaphaelForField()` retourne `false` pour ce `fieldId` précis.

### Code de référence

| Sujet | Fichier |
|--------|---------|
| Logique badge | `packages/core/src/identity/msssRaphaelBadge.ts` |
| Patches blur | `packages/core/src/identity/identityFieldWrite.ts`, `rentPricingGrid.ts` |

---

## Sous-collection `residences/{id}/financial/dataV2`

**SSOT financier** — listener `FinancialDataContext`.

| Bloc | Contenu |
|------|---------|
| `calculatedResults` | RBE, RNE, DSCR, emprunt max, facteurs, prix, confiance… (`FinancialCalc`) |
| `baseData` | `revenusAnnuels`, `nombreUnites`, `depenses` (grille par clé `EXPENSE_KEYS`), `financement` |
| `derivedData` | Champs dérivés / legacy |
| `lastUpdated` | Timestamp (provenance UI `ProvenanceStrip`) |

Normalisation : `normalizeFinancialData()` → source `calculatedResults` | `derivedData` | `none`, avec **fail-safe RBE** depuis `tarificationLoyers` si revenus absents.

**Règles SSOT lecture (`d232673`) — ne pas recalculer dans React :**

| Règle | Module core |
|-------|-------------|
| Prix affiché / emprunt / MFR | `getListingPrice()` + `syncCalcWithCanonicalListingPrice()` — ignore `calculatedResults.prixDemande` figé (ex. 3,5 M$) |
| RNE canonique | `resolveAdmissibleOpex()` — **`depensesTotales` déclaré** prioritaire ; RNE = RBE − OPEX déclaré (pas le normalisé seul) |
| Hints UI inter-onglets | `ResidenceDataContext` → `useResidenceFinancialHints()` → `buildResidenceFinancialHints()` |
| Étalon QA | 198 chemin du Roy : 2 558 000 $ · RBE 1 129 749 $ · dépenses 600 260 $ · **RNE 529 489 $** · **TGA 20,70 %** |

### Sous-collection `residences/{id}/documents/{documentId}`

**SSOT Espace Documents** — UI `DocumentsDiligenceTab`, listener temps réel par fiche.

| Champ | Type | Valeurs / format | Description |
|--------|------|------------------|-------------|
| `propertyId` | string | — | ID fiche (redondant, filtrage) |
| `category` | string | `financier` \| `technique` \| `legal` | Dossier diligence |
| `fileName` | string | — | Nom fichier affiché |
| `storagePath` | string | — | Chemin Storage canonique (voir ci-dessous) |
| `mimeType` | string | — | `application/pdf`, XLSX, DOCX, … |
| `sizeBytes` | number | — | Taille octets |
| `uploadedAtMillis` | number | — | Horodatage téléversement |
| `uploadedBy` | string | UID | Courtier ayant téléversé |
| **`virusScanStatus`** | string | `pending` \| `clean` \| `infected` | Scan format serveur (callable `propertyDocumentScanDocument`) |
| **`parsingStatus`** | string | `not_applicable` \| `pending` \| `completed` \| `failed` | Parse IA (dossier Financier + `clean` uniquement) |
| **`parsingEligible`** | boolean | — | `true` si PDF/tableur Financier éligible au parseur |
| **`extractedData`** | map | — | JSON structuré Vertex : `amounts`, `dates`, `taxes`, `revenus`, `depenses`, `annee` |
| `parsedAtMillis` | number | optionnel | Fin d’analyse IA |
| **`parsingError`** | string | optionnel | Message d’échec (tronqué 500 car.) si `failed` |
| **`uploadSource`** | string | optionnel | `vendor_portal` \| `broker` |
| **`vendorPortalTypeId`** | string | optionnel | ID catalogue `vendorPortalCatalogue.ts` |
| **`vendorPortalLabelFr`** | string | optionnel | Libellé portail vendeur |

#### Chemins Storage

| Schéma | Usage |
|--------|--------|
| **`primexpert/{brokerId}/properties/{propertyId}/documents/{category}/{fileName}`** | Canonique — écriture courtier (`brokerId === auth.uid`) |
| `properties/{propertyId}/documents/…` | Legacy Copilote — **lecture seule** (`storage.rules`) |

#### Pipeline document (Financier)

```text
Upload client → virusScanStatus: pending
    → propertyDocumentScanDocument → clean | infected
    → si financier + clean → parsingStatus: pending
    → propertyDocumentParseIA (Vertex gemini-2.0-flash-001)
    → completed + extractedData | failed + parsingError
```

Téléchargement client : autorisé **uniquement** si `virusScanStatus === 'clean'`.

---

## Collection `email_outbox/{outboxId}`

| Champ | Description |
|--------|-------------|
| `userId` | Courtier destinataire |
| `status` | `pending` (création client) |
| Template / type | J7 alerte support, J21 nurture, etc. |

---

## Collections connexes

| Collection | Tenant | Usage |
|------------|--------|--------|
| `proprietes/{id}` | `courtiersResponsables` | Dossiers Copilote migrés (Phase 2) |
| `drive_documents/{id}` | `courtiersResponsables` | Drive OACIQ — **delete interdit** |
| `organizations/{orgId}` | `orgId` | Agence |
| **`organizations/{orgId}/contacts`** | `ownerId` + `visibility` | Répertoire CRM LCI (SSOT parties) |
| **`organizations/{orgId}/morning_briefings/{brokerId}`** | `brokerId` | Briefing du matin (cron 06:00 Toronto) |
| **`organizations/{orgId}/prospects_radar/{id}`** | `brokerId` | Radar off-market — signaux faibles |
| **`organizations/{orgId}/tasks`** | `ownerId` | Tâches courtier (org-wide) |
| **`vendor_portal_invites/{token}`** | `brokerId` | Jetons portail vendeur autonome (30 j) |
| **`market_documents/{docId}`** | `uploadedBy` | Vault rapports marché (Statistiques du marché — Workhub) |
| **`market_macro_stats/{fingerprint}`** | — | Stats macro validées (écriture serveur `injectMarketMacroStats`) |
| **`market_analytics_raw/{fingerprint}`** | — | Transactions comparables & ratios anonymisés (écriture serveur) |
| **`marketSnapshots/v1`** | — | Agrégat lecture macro + transactions + benchmarks (merge dédupliqué) |
| **`market_financial_benchmarks/{entryId}`** | — | Médianes régionales benchmark Hub Finance (lecture client, écriture serveur) |
| **`listings_cache/{entryId}`** | serveur | Cache Centris RESO / OData — lecture authentifiée, écriture serveur uniquement |
| **`organizations/{orgId}/legal_vault/{documentId}`** | `orgId` | Coffre WORM OACIQ + sous-journal `compliance_logs` |

### Document `market_documents/{docId}`

Collection **top-level** (pas sous `organizations/`).

| Champ | Type | Description |
|--------|------|-------------|
| `orgId` | string | Organisation propriétaire — requis pour les nouveaux documents |
| `uploadedBy` | string | UID courtier propriétaire |
| `uploadedAtMillis` | number | Horodatage téléversement (index composite) |
| `fileName` | string | Nom fichier |
| `mimeType` | string | `application/pdf` |
| `sizeBytes` | number | Taille octets |
| `storagePath` | string | `primexpert/{brokerId}/market_documents/{fileName}` |
| `documentCategory` | string | `MARKET_REPORT` |
| `virusScanStatus` | string | `pending` \| `clean` |
| `parsingStatus` | string | `pending` \| `completed` \| `failed` \| `verified` |
| `parsingError` | string \| null | Message d'échec parse |
| `extractedData` | map | Extraction omnivore Vertex — `macroTrends`, `comparableTransactions`, `operationalBenchmarks` (@primexpert/core/documents) |
| `isValidated` | bool | HITL complété |
| `validatedAtMillis` | number | Horodatage validation / injection |
| `contentHashMd5` | string | Empreinte binaire PDF — cache parse idempotent |
| `parseCacheHit` | bool | `true` si extraction clonée depuis un PDF identique |
| `cacheSourceDocumentId` | string | Document source du cache |
| `originalPageCount`, `semanticPageCount` | number | Pages originales et pages envoyées à Vertex |
| `semanticHit` | bool | Ancrages sémantiques détectés |
| `iaOpportunityScoring` | map | Score opportunité IA, facteurs critiques, horodatage |

Clés canoniques ajoutées dans `extractedData` : `tgaPct`, `population75_plus`, `monthsOfInventory`, `sellingPriceListingPriceRatio`, `operatingExpenseRatio`.

### Document `market_macro_stats/{fingerprint}`

| Champ | Type | Description |
|--------|------|-------------|
| **`dedupeFingerprint`** | string | ID document = empreinte `macro__{region}__{annee}__{type}` |
| `orgId` | string | Organisation source de l'injection HITL |
| `regionAdministrative` | string | Région QC |
| `documentType` | string | Type rapport (ex. Guide Altus) |
| `anneeDonnees` | number | Année de référence |
| `tauxPenetration`, `coutRemplacementNeuf`, … | mixed | Données macro extraites |
| `marketDocumentId` | string | Provenance vault |
| `injectedAtMillis` | number | Horodatage injection |
| `validatedBy` | string | UID courtier |

### Document `market_analytics_raw/{fingerprint}`

| Champ | Type | Description |
|--------|------|-------------|
| **`dedupeFingerprint`** | string | ID document = empreinte transaction ou benchmark |
| `orgId` | string | Organisation source quand disponible |
| `dataSource` | string | `market_report` \| `internal_flywheel` selon provenance |
| `siloType` | string | ex. `rpa_ri_chsld` |
| `regionAdministrative` | string | Région |
| `anneeDonnees` | number | Année |
| `provenance` | string | `market_report` (injection serveur) \| `etats_financiers` \| `rapport_evaluation` (résidence) \| `internal_flywheel` |
| `comparableSnapshot` | map | `{ city, units, salePrice, capRatePct, netIncomePerUnit }` — **sans adresse civique** |
| `marketTransactionMeta` | map | Métadonnées transaction (date, type immeuble, `marketDocumentId`) |
| `operationalBenchmarkMeta` | map | Ratios opérationnels (label, catégorie) |
| `validatedAmounts` | array | Montants validés (ratios / dépenses) |
| `injectedAtMillis` | number | Horodatage |
| `validatedBy` | string | UID courtier |
| `postalFsa3` | string | FSALDU-3 anonymisé pour flywheel interne |
| `regionDisplayName` | string | Libellé région |
| `operatingExpenseRatio` | number | Ratio des dépenses d'exploitation (RDE/OER) |
| `revenuBrutEffectif`, `depensesExploitation` | number | Variables comparables lues par ACM |

Champs flywheel dans `comparableSnapshot` / `marketTransactionMeta` : `prixParPi2`, `assetClassLabel`, `transactionKind` (`promise` \| `sold`), `nbPortes`.

> **Anti-doublons :** réinjection du même PDF ou rapports chevauchants → `set(..., { merge: true })` sur l'ID empreinte ; pas de `add()` aveugle. Legacy : `packages/core/src/market/marketDeduplication.ts` (adresse normalisée + prix + date ±3 jours pour détection UI).

### Document `marketSnapshots/v1`

Agrégat lecture macro + transactions + benchmarks, enrichi par `injectMarketMacroStats` et le flywheel interne.

| Champ | Type | Description |
|--------|------|-------------|
| `macroStats[]`, `transactions[]`, `operationalBenchmarks[]` | array | Lignes dédupliquées par empreinte |
| `orgId` | string | Propagé sur les lignes récentes quand disponible |
| `provincialOerAggregates` | map | Médianes RDE/OER par région / silo (`operatingExpenseRatioMedian`) |
| `operationalBenchmarks[].operatingExpenseRatio` | number | RDE/OER par benchmark |

### Collection `listings_cache/{entryId}`

Cache serveur Centris RESO / OData utilisé pour la concurrence territoriale et la réconciliation des statuts.

| Champ | Type | Description |
|--------|------|-------------|
| `source` | string | `centris_odata` |
| `centrisListingId` | string | Identifiant MLS |
| `residenceId`, `linkedResidenceId` | string | Lien vers inscription CRM |
| `standardStatus`, `resoStandardStatus` | string | Statuts MLS normalisés |
| `canonicalPreview` | map | Aperçu : MLS, prix demandé/vendu, RBE, dépenses, région, classe |
| `financials` | map | RBE / dépenses exploitables pour comparables |
| `closedAtMillis`, `modificationTimestamp`, `receivedAt` | number / string | Récence |
| `regionAdministrative`, `classeImmeuble`, `soldPrice` | mixed | Filtres territoriaux |

> Règles : lecture authentifiée ; écriture client interdite.

### ~~Document `organizations/…/market_documents`~~

**Obsolète** — utiliser la collection top-level **`market_documents`**.

---

## Fichiers code correspondants

| Sujet | Fichier |
|--------|---------|
| Profil + essai | `src/lib/auth.tsx` |
| Garde suspension | `src/lib/billingAccess.ts`, `src/App.tsx` |
| Écran blocage | `src/components/SuspendedAccountScreen.tsx` |
| Bandeau 72 h | `src/components/GracePeriodBanner.tsx` |
| Résidences multi-tenant | `src/services/residences.ts`, `@primexpert/core/tenant` |
| Listener finance | `src/context/FinancialDataContext.tsx` |
| Listener identité + écriture | `src/context/ResidenceDocumentContext.tsx` |
| View model identité | `packages/core/src/identity/buildIdentityViewModel.ts` |
| Sections juridique / établissement | `packages/core/src/identity/identitySections.ts` |
| 5 silos bâtiment | `packages/core/src/identity/buildingAuditSections.ts` |
| Services & puces | `packages/core/src/identity/servicesRecognition.ts` |
| Tarification loyers | `packages/core/src/identity/rentPricingGrid.ts` |
| Patches Firestore blur | `packages/core/src/identity/identityFieldWrite.ts` |
| Déclaration vendeur | `packages/core/src/declaration/` |
| View models finance | `packages/core/src/financial/*.ts` |
| Documents diligence | `src/types/propertyDocument.ts`, `src/services/propertyDocumentsService.ts` |
| Validation / pipeline docs | `src/lib/propertyDocumentValidation.ts`, `propertyDocumentPipeline.ts`, `propertyDocumentTaxonomy.ts` |
| Parse IA serveur | `functions/src/documents/parsePropertyDocument.ts`, `geminiExtract.ts`, `documentTaxonomy.ts` |
| Envoi sélection documents | `functions/src/emails/sendDocumentSelection.ts` |
| Vertex ADC | `functions/src/services/vertexClient.ts` |
| Priorités dashboard | `packages/core/src/intelligence/dashboardPriorityFollowUp.ts` |
| Taxes + PDF | `src/lib/quebecInvoiceTax.ts`, `src/services/invoicePdfService.ts` |
| Règles Firestore / Storage | `firestore.rules`, `storage.rules` |
| Inscriptions & cartes | `src/components/Listings.tsx`, `ListingInstitutionalCard.tsx`, `listingCardViewModel.ts` |
| Synthèse 360 | `src/components/residence/tabs/Synthese360Tab.tsx` |
| CRM contacts | `packages/core/src/crm/`, `src/services/contacts.ts`, `src/components/contacts/` |
| Liaisons coacheteurs/covendeurs | `coBuyers.ts`, `coSellers.ts`, `linkCoBuyer`, `linkCoSeller` |
| Import contacts legacy (Firestore) | `scripts/migrate-legacy-contacts-to-v2.mjs` |
| Import contacts legacy (Storage) | `packages/core/src/scripts/migrateLegacyContacts.ts` — `npm run migrate:contacts` |
| Hub omnicanal — ingestion | `functions/src/messaging/ingestOmnichannelMessage.ts` |
| Webhooks SMS / Meta | `twilioSmsWebhook`, `metaMessagingWebhook` (`northamerica-northeast1`) |
| Note vocale — Functions | `onVoiceNoteUploaded` (trigger Storage ; STT Whisper ou Gemini) |
| Matchmaker Raphaël | `packages/core/src/crm/raphaelEngine.ts` + `Synthese360Tab` |
| Portail vendeur — catalogue 85 pièces | `vendorPortalCatalogue.ts`, `vendorPortalCompliance.ts`, `vendorPortalAccess.ts` |
| Briefing matin & radar | `morningBriefing.ts`, `radarOpportunitesEngine.ts`, `morningBriefingService.ts`, `morningBriefingGenerator.ts` |
| Recherche CRM multi-critères | `contactSearch.ts`, `filterContactsBySearchQuery` |
| Loi 25 consentement contact | `QuebecLaw25Consent`, `validateLaw25Compliance`, `communicationPreferences.law25Consent` |
| Après-vente closing | `closingEngine.ts`, `CLOSING_TASK_CODES` |
| Copilote négociation | `negotiationEngine.ts`, `oaciqSpecsTypes.ts`, `generateNegotiationClauseWithGemini` |
| Courtier responsable inscription | `ResponsibleBrokerCard.tsx`, `courtiersResponsables` |
| Liaison messagerie ↔ CRM | `matchedContactId`, `linkEmailThreadToContact`, `contactMatch.ts`, `MailContactLinkBar.tsx` |
| Inscriptions Kanban DnD | `ListingsPipelineKanban.tsx`, `pipelineDragRules.ts`, `updateResidencePipelineStatus` |
| Bibliothèque marché | `marketDocumentsService.ts`, `parseMarketDocument.ts`, `injectMarketMacroStats.ts`, `MarketLibraryDashboard.tsx`, `marketDeduplication.ts` |
| Anti-doublons Big Data | `marketTransactionFingerprint`, `marketMacroRegionFingerprint`, empreintes Firestore merge |
| Assembleur contrat V3.5 | `annexeFieldSchema.ts`, `renderContractAssemblerToHtml.ts`, `ContractAssemblerPanel.tsx` |
| Coffre WORM OACIQ | `vaultSpecsTypes.ts`, `legalVaultService.ts`, `legalVaultDocumentMapping.ts`, `onVaultDocumentWrite.ts` |
| Conformité photo courtier | `brokerProfileCompliance.ts`, `BrokerPhotoComplianceBanner.tsx`, `auth.tsx` |
| Centris / off-market | `listingSource.ts`, `inscriptionBrokerageStatus.ts`, `inscriptionsService.ts`, `centrisListingsSyncNightly.ts` |
| Flywheel marché | `internalMarketFlywheel.ts`, `flywheelIngestion.ts`, `onTransactionConcludedTrigger.ts` |
| RNE / TGA centralisés | `capitalization.ts`, `resolveCanonicalRne.ts`, `financialDataService.ts` |

---

## Objet racine `residences/{id}.offre` (promesse d'achat — tronc & conditions)

SSOT : `serializeOffreForFirestore(tronc, conditions?, cloture?)` dans `offreConditions.ts`.  
**Important** : à chaque écriture, envoyer l’objet `offre` **complet** (merge contexte React = shallow).

### Tronc financier (Sprint 5.1)

| Champ | Type | Description |
|--------|------|-------------|
| `offre.prixOffert` | number | Prix offert |
| `offre.acompteMontant` | number | Acompte |
| `offre.balanceVenteMontant` | number | Balance de vente |
| `offre.acheteurId` | string | ID contact acheteur (optionnel) |
| `offre.acheteurNom` | string | Nom acheteur affiché |

### Conditions suspensives & diligences RPA (Sprint 5.2)

| Champ | Type | Description |
|--------|------|-------------|
| `offre.dateLimiteFinancement` | string (ISO `yyyy-mm-dd`) | Date limite financement |
| `offre.conditionPermisMsss` | bool \| null | Permis MSSS (ternaire UI) |
| `offre.dateLimitePermisMsss` | string | Date limite permis MSSS |
| `offre.conditionAnnexe6` | bool \| null | Annexe 6 (clé conservée ; **retirée de l’UI** en 5.4) |
| `offre.clauseAjustementNoi` | bool \| null | Clause ajustement RNE (clé conservée ; **retirée de l’UI** en 5.4) |
| `offre.tgaAjustement` | number | Taux de capitalisation (TGA) d’ajustement (clé conservée ; **retirée de l’UI** en 5.4) |

### Clôture & proratas (Sprint 5.3)

| Champ | Type | Description |
|--------|------|-------------|
| `offre.datePrisePossession` | string | Date de prise de possession |
| `offre.transfertFiducie` | bool \| null | Transfert fiducie (**retiré de l’UI** en 5.4) |
| `offre.prorataSubventions` | bool \| null | Prorata subventions MSSS (**retiré de l’UI** en 5.4) |

---

## Objet racine `residences/{id}.promesseAchat`

SSOT moteur : `promesseAchatEngine.ts` — dates limites dérivées de `dateAcceptation` + délais en **jours**.

| Champ | Type | Description |
|--------|------|-------------|
| `promesseAchat.statut` | string | `draft`, `received`, `accepted`, `refused`, `cancelled` |
| `promesseAchat.dateAcceptation` | string | Date d’acceptation (référence calcul délais) |
| `promesseAchat.dateLimiteVisiteLieux` | string | Calculée (lecture seule UI) |
| `promesseAchat.dateLimiteVerificationDocuments` | string | Calculée |
| `promesseAchat.dateLimiteInspection` | string | Calculée |
| `promesseAchat.dateLimiteFinancement` | string | Calculée (peut coexister avec `offre.dateLimiteFinancement`) |
| `promesseAchat.dateLimitePermis` | string | Calculée |
| `promesseAchat.dateLimiteDeduitLci` | string | Calculée — 7e délai critique, dédit Loi sur le courtage immobilier art. 73.2 |
| `promesseAchat.delais.visiteLieuxJours` | number \| null | Jours — éditable ; sérialisé `null` si vide |
| `promesseAchat.delais.verificationDocumentsJours` | number \| null | Jours |
| `promesseAchat.delais.inspectionJours` | number \| null | Jours |
| `promesseAchat.delais.financementJours` | number \| null | Jours |
| `promesseAchat.delais.permisJours` | number \| null | Jours |
| `promesseAchat.commission.totalePct` | number \| null | Commission totale (%) |
| `promesseAchat.commission.inscripteurPct` | number \| null | Part inscripteur (%) |
| `promesseAchat.commission.collaborateurPct` | number \| null | Part collaborateur (%) |
| `promesseAchat.collaborateur` | map | `nom`, `telephone`, `courriel`, `partCommissionPct` |

Sous-collection documents PA : `residences/{id}/documents` (filtre type promesse ; règles `canReadResidenceSubcollection`).

---

## Assembleur de contrat — état UI (V3.5 — éphémère client)

**SSOT rendu :** `@primexpert/core/forms` — **non persisté Firestore en V3.5** (export HTML navigateur uniquement).

### Objet `ContractAssemblerFieldState` (TypeScript — panneau)

| Bloc | Champs | Description |
|------|--------|-------------|
| `selection` | `contratCourtage`, `annexePrix`, `annexeG`, `annexeR`, `promesseActifs` | bool — pièces incluses dans le dossier HTML |
| `annexePrix` | `nouveauPrixNumerique` | number — zone `(       $ )` |
| `annexeR` | `retributionPct` | number — zone `(       % )` |
| `annexeG` | `ccvReference` | string — zone `CCV-     ` |

**Defaults :** `buildContractAssemblerDefaults()` — prix annexe depuis revenu net d'exploitation (RNE) ÷ taux de capitalisation global (TGA) ACM (`resolveCanonicalRne`, `bootstrapResidenceAcm`).

**UI :** `ContractAssemblerPanel.tsx` dans onglet Promesse — consomme `residence`, `residenceDoc`, `financial/dataV2`.

**Persistance planifiée (été 2026) :** sous-objet optionnel `residences/{id}.contractAssembler` ou doc dédié — hors scope commit `63286dc`.

---

## Sous-collection `residences/{id}/notes/{noteId}`

Notes courtier (diligence) — écoute temps réel dans l’onglet Synthèse ; tri `orderBy('createdAt', 'desc')`.

| Champ | Type | Description |
|--------|------|-------------|
| `text` | string | Contenu de la note |
| `authorId` | string | UID Firebase |
| `authorName` | string | optionnel — affichage |
| **`source`** | string | `voice` si note vocale (pipeline IA) ; absent = saisie manuelle |
| **`voiceUploadId`** | string | ID téléversement Storage (notes vocales) |
| **`hasActionItem`** | bool | Intention d’action détectée (note vocale) |
| `createdAt` | Timestamp | Création |
| `updatedAt` | Timestamp | optionnel — édition |

Lors de l’ajout d’une note : mise à jour document racine `lastCommunicationAt`, `lastCommunicationType: 'note'`, `updatedAt`.

### Sous-collection `residences/{id}/tasks/{taskId}`

Tâches et rendez-vous courtier (Synthèse 360°) ; création auto depuis note vocale ou pipeline closing V2.7.

| Champ | Type | Description |
|--------|------|-------------|
| `title` | string | Intitulé tâche |
| `description` | string | Détail |
| `dueAtMillis` | number | Échéance (ms) |
| `kind` | string | `task` \| `appointment` |
| `status` | string | `a_faire` \| `fait` |
| **`source`** | string | `voice_intent` \| **`closing_pipeline`** |
| **`voiceUploadId`** | string | Lien note vocale source |
| **`closingPackId`** | string | Idempotence pack closing (`closingRunId`) — V2.7 |
| **`closingTaskCode`** | string | `CLOSING_RPA_DOSSIER_HYPOTHEQUE` \| `CLOSING_SUIVI_INSPECTION` \| `CLOSING_ENVOI_NOTAIRE` |
| **`priority`** | string | `high` \| `normal` |
| **`orgId`** | string | Organisation |

### Storage — notes vocales & documents contact

| Chemin Storage | Usage |
|----------------|--------|
| `organizations/{orgId}/voice_notes/residences\|contacts/{parentId}/{uploadId}.webm` | Audio mobile → trigger `onVoiceNoteUploaded` |
| `primexpert/{orgId}/contacts/{contactId}/…` | Pièces CRM (inchangé) |

---

## Analyse de mise en marché (ACM) — consommation SSOT (2026-05-20)

**Bootstrap :** `bootstrapResidenceAcm()` dans `residenceAcmBootstrap.ts` — **aucun champ Firestore dédié « acm »** ; lecture compose :

### `residences/{id}/financial/dataV2`

| Champ (`calculatedResults`) | Usage ACM |
|-----------------------------|-----------|
| `revenuBrutEffectif` / `revenusAnnuels` | Affichage verrouillé RBE ; ancrage `potentialRevenue` moteur |
| `revenuNetExploitation` | Affichage verrouillé RNE ; ancrage dépenses SSOT (RBE − RNE) |
| `prixDemande` / `tauxCapitalisation` | Prix demandé ; repli TGA si GPS insuffisant |
| `nombreUnites` | Unités sujet (avec repli `residence` / `residenceDoc`) |

### `residences/{id}` (document racine — marché territorial)

| Champ | Usage ACM |
|--------|-----------|
| `competitorsList[]` | Unités RPA du secteur (somme + sujet) |
| `marcheDemographie.population75_plus` | Bassin 75+ (pénétration) |
| `marketScope.radiusKm` | Périmètre Haversine (ex. 50 km) |
| `classeImmeuble` / `niveauSoins` / niche RPA | Classe pour médiane TGA GPS |
| `regionAdministrative` / `region` | Filtre médiane TGA |

### Collections GPS (lecture seule)

| Collection | Usage |
|------------|--------|
| `market_analytics_raw` + `marketSnapshots/v1` | Transactions comparables ; `tgaPct`, `classeImmeuble`, région → `selectGpsCapRateMedian()` |
| `listings_cache` | Comparables Centris RESO, statuts MLS, prix vendu / RBE / dépenses pour concurrence territoriale |

**UI éditable (non persisté automatiquement sur le doc)** : TGA cible (%) et pénétration RPA 75+ (%) dans `AcmValuationWorkspace` — recalcul client uniquement jusqu’à action d’enregistrement explicite future.

### Brouillons HITL — `manualVerifications` (UI ACM / négociation)

État client éphémère ou persisté sur fiche — validation humaine avant application.

| Contexte | `kind` | SSOT |
|----------|--------|------|
| Suggestions prix ACM | `pricingSuggestions[]` | `AcmValuationWorkspace.tsx` — statut `pending_human_review` |
| Copilote négociation V2.6 | `commercial_negotiation_clause` | `negotiationEngine.ts`, `oaciqSpecsTypes.ts` |

Modes négociation : `OACIQ_FORM`, `CUSTOM_CONTRACT`, `LETTER_OF_INTENT`.

---

*Dernière mise à jour : 2026-06-01 — PR #10 : QA RNE / TGA centralisés, WORM, Centris, flywheel et schémas marché multi-tenant.*
