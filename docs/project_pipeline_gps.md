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
    └─ Promesse          [✅ PromesseAchatTab — offre SSOT + conditions & délais RPA + clôture]
```

**Inscriptions :** vue **pipeline** en **4 colonnes** (prospect · mandat · promesse · vendu) ; statut `expired` conservé en données mais **hors** colonnes actives (`PIPELINE_ACTIVE_STATUSES`).

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
| Onglet Synthèse 360 + notes `residences/{id}/notes` | ✅ |
| Déclaration, Marché, Promesse (cockpit PA + `offre` SSOT) | ✅ |
| Webhooks Stripe → Firestore | ⏳ |
| Cron relances J30/J40 | ⏳ |
| Stripe Customer Portal prod | ⏳ env |
| Cloud Functions Nylas | ✅ déployées (us-central1) |
| Webhook Nylas — signature HMAC (Loi 25) | ✅ `verifyNylasWebhookSignature` — POST non signé → 401 |
| Email Center — SSOT `email_threads` / `messages` | ✅ Phase 1 — analyse à l’ingestion, `mailbox_analyses` déprécié |
| Diffusion Web — vendor prebuild + `tsc` | ✅ `sync-core-diffusion` + `financialCalcTypes` |
| Promesse d'achat — persistance `offre` / DRY | ✅ `serializeOffreForFirestore`, merge objet complet |
| CRM — répertoire contacts LCI | ✅ `organizations/{orgId}/contacts` — tiers, documents, coacheteurs/covendeurs |
| Parties résidence ↔ CRM | ✅ `partiesImpliquees` + `linkContactToResidence` (writeBatch) |
| Identité — courtier responsable | ✅ `ResponsibleBrokerCard` → `courtiersResponsables` |
| Hub Finance — master panel & rapports PDF | ✅ `FinanceHubMasterPanel`, glossaire Québec |
| Diffusion Web — enrichissements publics | ✅ `publicBuyerDisclosures`, `transactionBanner`, aperçu brouillon |

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

### Pipeline messagerie (SSOT — post Phase 1)

```text
Nylas webhook (signature validée)
    → syncNylasMessageToFirestore
    → users/{uid}/email_threads/{threadId}
    → messages/{messageId} + champs analyse (matchedResidenceId, mailContactEmail, mailIntent, summaryOneLine…)
    → @primexpert/core/mail (heuristique + match inventaire residences)
    ↓
Workhub MailboxContainer (lecture temps réel)
Intelligence / Dashboard (lecture collectionGroup messages via mailboxAnalysis.ts)
    ↓
[Phase 2 — backlog] rattachement explicite message → contact CRM LCI
```

---

## E. Prochaines priorités (au choix du PO — prochaine session)

| Option | Thème |
|--------|--------|
| **A** | Phase 2 Email Center — rattachement explicite message → contact CRM (`organizations/…/contacts`) |
| **B** | Module ACM prédictif — ingestion Centris/Matrix, ajustements comparables |
| **C** | Coffre-fort WORM OACIQ — règles Firestore verrouillage 6 ans (documents « Final ») |

### Backlog technique (inchangé)

1. **Stripe** : webhook `invoice.payment_failed` → `grace_period` ; succès → `active`.
2. **Cron** : `grace_period` → `suspended` après 72 h ; relances J30/J40.
3. **Documents** : enrichir `extractedData` → préremplissage Hub Finance / preuves A2.
4. **Vertex** : surveiller cycle de vie `gemini-2.0-flash-001`.
5. **Déploiement** : `firebase deploy --only functions:nylasWebhook,firestore:indexes` après Phase 1 mail.

---

*Dernière mise à jour : 2026-05-20 — CRM contacts, tiers acheteur/vendeur, parties résidence, PA, Email SSOT, Hub Finance, courtier responsable, diffusion.*
