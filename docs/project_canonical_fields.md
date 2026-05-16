# Dictionnaire canonique — données Primexpert V2

Aligné sur `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2`.  
Les champs **serveur** (`billingStatus`, `gracePeriodStartedAt`) ne sont **pas** modifiables par le client (absents de `users` `allow update` dans `firestore.rules`).

Référence alias / provenance : `packages/core/src/canonical/`.

---

## Collection `users/{uid}`

| Champ | Type Firestore | Valeurs / format | Description |
|--------|----------------|------------------|-------------|
| `uid` | string | — | Firebase Auth UID |
| `email` | string | — | Courriel |
| `displayName` | string | — | Nom affiché |
| `photoUrl` | string | — | Avatar |
| `orgId` | string | — | Organisation |
| `role` | string | `admin` \| `admin_system` \| `member` | `admin_system` = direction / Finance |
| **`trialStartDate`** | Timestamp ou `yyyy-mm-dd` | — | Début essai **45 jours** |
| **`billingStatus`** | string | `active` \| `grace_period` \| `suspended` | Chérif — **écrit serveur** |
| **`gracePeriodStartedAt`** | Timestamp / ISO | — | Début **72 h** de grâce — **écrit serveur** |
| **`lastEmailSent`** | string \| null | `J7` \| `J21` \| `J30` \| `J40` \| null | Relance onboarding |
| `accessibleSilos` | array | `RPA`, `CPE`, `PLEX` | RBAC silos Radar |
| `licenseName`, `title`, `agency` | string | optionnel | Profil OACIQ |
| `firstName`, `lastName`, `phone` | string | optionnel | Profil |
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
| `mailbox_analyses/{messageId}` | Analyse IA courriel (E-2), `matchedResidenceId` |
| `call_analyses/{driveDocumentId}` | Transcription appel (E-3), `residenceId`, `pipelineStatus` |
| `email_threads/{threadId}/messages/{messageId}` | Messagerie synchronisée Nylas |

---

## Collection `residences/{residenceId}`

Document racine — lecture Identité, liste Radar, prix affiché.

| Champ | Type | Description |
|--------|------|-------------|
| **`courtiersResponsables`** | string | **UID courtier propriétaire** (clé multi-tenant) |
| `address`, `city` | string | Adresse affichée |
| `price` / `prixDemande` | number | Prix demandé (priorité finance V2) |
| **`status`** | string | Pipeline : `prospect`, `mandate`, `promise`, `expired`, `unsigned`, `sold` |
| `assetNiche` | string | `RPA` \| `CPE` \| `PLEX` — filtre silo |
| `propertyType` | string | `rpa`, `cpe`, `plex`, `commercial` (Radar) |
| `date` | string | Date inscription / mandat (UI) |
| `name`, `numeroCertification`, `residenceType`, `categorieRPA` | string | Identité établissement |
| `dateOuverture`, `telephone`, `courriel`, `siteWeb` | divers | Coordonnées |
| Champs juridiques / bâtiment / capacité | divers | Voir `packages/core/src/identity/identitySections.ts` |
| Enrichissement MSSS | divers | `msssEnrichment`, registre RPA — badge Raphaël |

> Les clés exactes suivent les **alias canoniques** (`canonicalKey` dans `identitySections.ts`) et le document Copilote migré ; l’UI résout via `resolveIdentityField()`.

### Sous-collection `residences/{id}/financial/dataV2`

**SSOT financier** — listener `FinancialDataContext`.

| Bloc | Contenu |
|------|---------|
| `calculatedResults` | RBE, RNE, DSCR, emprunt max, facteurs, prix, confiance… (`FinancialCalc`) |
| `baseData` | `revenusAnnuels`, `nombreUnites`, `depenses` (grille par clé `EXPENSE_KEYS`), `financement` |
| `derivedData` | Champs dérivés / legacy |
| `lastUpdated` | Timestamp (provenance UI `ProvenanceStrip`) |

Normalisation : `normalizeFinancialData()` → source `calculatedResults` | `derivedData` | `none`.

### Sous-collection `residences/{id}/documents/{documentId}`

Bibliothèque documentaire migrée depuis Copilote (onglet Documents — UI placeholder).

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
| Listener identité | `src/context/ResidenceDocumentContext.tsx` |
| View model identité | `packages/core/src/identity/buildIdentityViewModel.ts` |
| View models finance | `packages/core/src/financial/*.ts` |
| Taxes + PDF | `src/lib/quebecInvoiceTax.ts`, `src/services/invoicePdfService.ts` |
| Config légal | `src/config/companyConfig.ts` |
| Règles Firestore | `firestore.rules` |

---

*Dernière mise à jour : 2026-05-16.*
