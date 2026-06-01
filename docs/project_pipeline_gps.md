# Pipeline GPS — abonnements, essai 45 j, facturation & fiche résidence

Vision produit Primexpert V2.5.  
**Hosting prod :** https://primexpert-app-v2.web.app

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
    ├─ Hub Finance       [✅ dataV2 + 5 sous-onglets + master panel PDF]
    ├─ Déclaration       [✅ DeclarationVendeurTab — OACIQ]
    ├─ Marché            [✅ MarcheConcurrenceTab]
    ├─ Documents         [✅ Espace Documents + scan + parse IA Vertex + distribution / courriel]
    ├─ Intelligence      [✅ call_analyses + courriels email_threads/messages (ex-mailbox_analyses)]
    ├─ Accès Vendeur     [✅ bouton fiche → /acces-vendeur — jeton 30 j + catalogue 85 lignes + docs]
    └─ Promesse          [✅ PromesseAchatTab — offre SSOT + conditions & délais RPA + date notaire + closing]
```

**Accès Vendeur (portail externe autonome) :**

```text
ResidenceDetail — « Ouvrir l'Accès Vendeur » (ResidenceAccesVendeurButton)
    ↓ contact VENDEUR dans partiesImpliquees
createVendorPortalInvite → vendor_portal_invites/{token} (TTL 30 j)
    ↓
Route /acces-vendeur?token=… (AccesVendeurPage)
    ↓ validateVendorPortalToken → custom token vendorPortal
    ↓ vendorPortalService — onSnapshot contact + résidence liée
    ↓ VendorDocumentDropzone
        → documents/{docId}.vendorPortalTypeId / uploadSource
        → notifyVendorPortalDocumentUpload → tâche courtier + vendorPortalLastUpload*
Core vendorPortalTimeline + mandateCompleteness + vendorPortalCompliance
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
| **Accès Vendeur** | ✅ `/acces-vendeur` + `ResidenceAccesVendeurButton` — timeline, jauge mandat, service temps réel |
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
| **Portail vendeur autonome** | ✅ `vendor_portal_invites`, custom token vendeur, catalogue 85 lignes UI |
| **Briefing matin + radar off-market** | ✅ Cron 06:00, `morning_briefings`, `prospects_radar` |
| **Négociation OACIQ / LOI** | ✅ Core AI + Vertex/Gemini, brouillon HITL `pending_human_review` |
| **Closing PA acceptée** | ✅ Core `closingEngine` — 3 tâches idempotentes sous `residences/{id}/tasks` |

---

## D. Jalons session 2026-05-20 — trois chantiers (fin de session)

Commits poussés sur `main` : `b9fe455`, `0e64e83`, `1c4f3c6`, `9b8a70c`, `da105ca`.

### Chantier 1 — CRM & répertoire client (`b9fe455`)

| Jalon | Détail |
|-------|--------|
| **SSOT contacts** | `organizations/{orgId}/contacts` — interdit `clients/`, `vendors/`, `buyerPipeline/` |
| **Qualification acheteur** | `buyerCriteria` + pièces Storage ; typologie `deriveBuyerTier` (privilégié / qualifié) |
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

### Chantier 3 — Fiche résidence & finance (`0e64e83`, `b9fe455`)

| Jalon | Détail |
|-------|--------|
| **Courtier responsable** | `ResponsibleBrokerCard` dans Identité — `courtiersResponsables` |
| **Parties intervenants** | `PartiesIntervenantsSection` — rôles VENDEUR/ACHETEUR/NOTAIRE/COLLABORATEUR |
| **Hub Finance** | Master panel, verrouillage contexte, rapports PDF certifiables |
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

## E. Session 2026-05-20 (soir) — Analyse de mise en marché (ACM) résidence (`c1b5e62` → `e1a900c`)

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
| **Hub omnicanal** | `email_threads` enrichi (`channel`, urgence) ; webhooks Twilio/Meta Montréal — **déploiement webhooks en attente** |
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

## H. Session 2026-05-29 / alignement 2026-06-01 — V2.8/V2.9 opérationnel

| Jalon | Détail |
|-------|--------|
| **Portail vendeur autonome** | `createVendorPortalInvite` → `vendor_portal_invites/{token}` ; `validateVendorPortalToken` → custom token vendeur ; `patchVendorPortalResidence` pour identité / déclaration |
| **Catalogue documents vendeur** | `vendorPortalCatalogue.ts` : 82 types canoniques + 3 hors liste ; `vendorPortalCompliance.ts` calcule le pourcentage sur les requis |
| **Téléversement vendeur** | `VendorDocumentDropzone` → `residences/{id}/documents/{docId}` avec `vendorPortalTypeId`, `vendorPortalLabelFr`, `uploadSource`; notification courtier via tâche org |
| **Briefing du matin** | `morningBriefingGenerator` (06:00 America/Toronto) agrège tâches critiques, rendez-vous et `hotLeadsTop3` |
| **Radar off-market** | `scoreRadarOpportunities()` produit `occupancy_drop` et `certification_expiry` dans `organizations/{orgId}/prospects_radar` |
| **Négociation OACIQ / LOI** | `generateCommercialContextualClause()` route `OACIQ_FORM`, `CUSTOM_CONTRACT`, `LETTER_OF_INTENT`; statut HITL `pending_human_review` obligatoire |
| **Closing PA acceptée** | `generateClosingSequenceTasks()` prépare les tâches hypothèque RPA, inspection et notaire avec `closingPackId` idempotent |

```text
PA acceptée (promesseAchat.dateAcceptation)
  → closingEngine.buildClosingPackId(residenceId, dateAcceptation)
  → résidences/{id}/tasks
      ├─ CLOSING_RPA_DOSSIER_HYPOTHEQUE (J+1)
      ├─ CLOSING_SUIVI_INSPECTION (J+2)
      └─ CLOSING_ENVOI_NOTAIRE (dateNotairePrevue - 10 j ou J+30 provisoire)
```

```text
Cron 06:00 America/Toronto
  → users/{uid} avec orgId
  → residences où courtiersResponsables == uid
  → prospects_radar (signaux faibles)
  → organizations/{orgId}/tasks + email_threads/messages
  → morning_briefings/{uid}
```

---

## I. Prochaines priorités (au choix du PO — prochaine session)

| Option | Thème |
|--------|--------|
| ~~**A**~~ | ~~Phase 2 Email Center — rattachement message → contact CRM~~ **✅ livré 2026-05-24** |
| ~~**E (contacts)**~~ | ~~Maillon 1 contacts `--execute`~~ **✅ Storage 90 contacts 2026-05-28** |
| **B** | Module ACM — **base résidence livrée** ; suite : ingestion Centris/Matrix, comparables liés fiche |
| **C** | Coffre-fort WORM OACIQ — règles Firestore verrouillage 6 ans (documents « Final ») |
| **D** | Mes inscriptions Phase 3 — actions bulk, export pipeline, alertes stagnation |
| **F** | Déployer webhooks SMS/Meta + secrets Twilio ; activer VoIP prod |
| **G** | Migration maillons 2+ — résidences, finance, documents Storage |
| **H** | Brancher runtime closing PA acceptée (trigger Firestore) si Alain confirme l'automatisation post-acceptation |

### Backlog technique (inchangé)

1. **Stripe** : webhook `invoice.payment_failed` → `grace_period` ; succès → `active`.
2. **Cron** : `grace_period` → `suspended` après 72 h ; relances J30/J40.
3. **Documents** : enrichir `extractedData` → préremplissage Hub Finance / preuves A2.
4. **Vertex** : surveiller cycle de vie `gemini-2.0-flash-001`.
5. **Déploiement** : `firebase deploy --only hosting,firestore,functions,storage` — commit `6d31058` déployé 2026-05-24.

---

*Dernière mise à jour : 2026-06-01 — alignement groupé V2.8/V2.9 : portail vendeur autonome, briefing/radar, négociation OACIQ/LOI, closing PA acceptée.*
