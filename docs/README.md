# Documentation Primexpert V2 (Bible)

**Source unique avec le code :** `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/docs/`
**URL officielle :** https://primexpert-app-v2.web.app
**Cycle technique :** V3.5 — sécurité WORM, pipeline marché multi-tenant, ACM Centris, SSOT RNE/TGA et assembleur de mandats natif (PR #17, juin 2026)

| Fichier | Contenu |
|---------|---------|
| [MEMORY.md](./MEMORY.md) | Journal de décisions — UI, billing, fiche résidence, documents, Vertex, Big Data, déploiement |
| [project_canonical_fields.md](./project_canonical_fields.md) | Champs Firestore (`users`, `residences`, `organizations/*/legal_vault`, `market_documents`, `listings_cache`, `market_analytics_raw`, …) |
| [project_pipeline_gps.md](./project_pipeline_gps.md) | Flux essai 45 j, Chérif, pipeline fiche résidence, messagerie, Statistiques du marché |
| [arborescence.md](./arborescence.md) | Structure du dépôt, onglets, Firebase, Cloud Functions, modules `@primexpert/core` et fichiers clés |
| [CANON_UNIQUE_PRIMEXPERT_V2.md](./CANON_UNIQUE_PRIMEXPERT_V2.md) | Version consolidée unique (gouvernance, architecture, SSOT, modules, déploiement) |
| [VERIFICATION_COHERENCE_CROISEE.md](./VERIFICATION_COHERENCE_CROISEE.md) | Vérification transversale des docs avec écarts et actions de normalisation |
| [CHECKLIST_PREDEPLOIEMENT_PROD.md](./CHECKLIST_PREDEPLOIEMENT_PROD.md) | Checklist opérationnelle Go/No-Go avant déploiement production |

---

## Projet & déploiement

| Élément | Valeur |
|---------|--------|
| **Firebase** | `primexpert-app-v2` |
| **Hosting** | https://primexpert-app-v2.web.app |
| **Repo** | https://github.com/alain-blip/primexpert-v2-core.git |
| **Legacy référence** | `00_RPA_SYSTEME_APP/Copilote-RPA` |

```bash
cd "01_PRIMEXPERT_SYSTEME_APP_STABLE_V2"
npm install
npm run dev                              # local
npm run build && firebase deploy --only hosting
cd functions && npm run build
FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions
# Déploiement complet :
npm run build && FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy
```

---

## Principes d’architecture

1. **Règle #0** — Calculs métier dans `packages/core/`, pas dans React.
2. **Multi-tenant** — `courtiersResponsables` sur `residences` ; filtre `@primexpert/core/tenant` + `firestore.rules`.
3. **Finance** — Document unique `residences/{id}/financial/dataV2` ; contexte `FinancialDataProvider` + `ResidenceDataContext` ; RNE/TGA centralisés dans `@primexpert/core/financial/capitalization`.
4. **Identité** — Document racine `residences/{id}` ; contexte `ResidenceDocumentProvider` + `ResidenceDataProvider` (prix canonique, unités, hints finance).
5. **Documents** — Sous-collection `residences/{id}/documents/` ; scan + parse IA via Cloud Functions (Vertex ADC) ; verrouillage WORM légal dans `organizations/{orgId}/legal_vault`.
6. **UI fiche & inscriptions** — Tokens **`primexpert-*`** ; coquilles `InstitutionalResidenceTabShell` ; cartes **Mes inscriptions** (Kanban DnD, filtres régions QC).
7. **Langage Québec** — Pas de « audit » à l’écran ; abréviations toujours développées (voir [MEMORY.md](./MEMORY.md)).
8. **Messagerie omnicanale** — SSOT `users/{uid}/email_threads` + `messages` ; canaux `email` \| `sms` \| `facebook` \| `instagram` ; liaison CRM (`matchedContactId`, téléphone) ; webhooks Twilio/Meta (Montréal).
9. **Notes vocales** — Storage `organizations/{orgId}/voice_notes/` → `onVoiceNoteUploaded` → notes/tâches résidence.
10. **Promesse d'achat** — SSOT `packages/core/src/transaction/` + objet Firestore `offre` / `promesseAchat`.
11. **Diffusion Web** — `@primexpert/core/diffusion` vendoré dans Cloud Functions (prebuild).
12. **CRM Contacts** — SSOT `organizations/{orgId}/contacts` ; import Storage legacy `npm run migrate:contacts` ; Matchmaker Raphaël (acheteurs `QUALIFIED`).
13. **Statistiques du marché** — Vault `market_documents` multi-tenant (`orgId`), cache `contentHashMd5`, découpage PDF sémantique ; injection idempotente vers `market_analytics_raw` / `market_macro_stats`.
14. **Analyse de mise en marché (ACM)** — Fiche résidence, onglet Marché : bootstrap `residenceAcmBootstrap.ts`, workspace `AcmValuationWorkspace`, taux de capitalisation (TGA) médian GPS + Centris, ajustement qualitatif courtier.
15. **Centris / hors marché** — `listings_cache` en lecture ACM, `listingSource` (`centris` / `off_market`) sur résidence ; sync nocturne ignore les fiches hors marché.
16. **Data Flywheel** — `onTransactionConcludedFlywheel` anonymise les transactions conclues vers `market_analytics_raw` avec marqueur `internalFlywheelIngestion`.
17. **Coffre-fort WORM** — `@primexpert/core/security`, `onVaultDocumentWrite` Montréal, journal SHA-256 append-only sous `legal_vault/*/compliance_logs`.
18. **Assembleur de mandats (V3.5)** — `@primexpert/core/forms` ; champs entre parenthèses typés ; export HTML natif dans `ContractAssemblerPanel`.
19. **Contrôle qualité RPA** — règles RNE/TGA/colonnes Kanban testées ; couverture Vitest pour taux de capitalisation Centris et délais PA acceptée.
20. **VoIP** (parallèle) — Twilio Voice SDK ; `packages/core/src/telephony/`, Functions `getTwilioToken` / `twilioVoiceResponse`.

---

## Scripts npm — ops & tests (2026-05-28)

| Script | Usage |
|--------|--------|
| `npm run migrate:contacts` | Dry-run import contacts legacy (Storage + Firestore) |
| `npm run migrate:contacts:execute` | Exécution réelle vers `organizations/{orgId}/contacts` |
| `npm run test:voice-note` | Pipeline note vocale (Whisper si clé OpenAI) |
| `npm run test:voice-note:gemini` | Pipeline note vocale — STT Gemini uniquement |
| `npm run test:incoming-sms` | Injection SMS test → fil `crm_{contactId}` |

---

## Workhub — modules principaux (2026-06-01)

| Module | Accès | SSOT | Statut |
|--------|-------|------|--------|
| **Tableau de bord** | `Dashboard.tsx` | Briefing matin, radar off-market, priorités KISS | LIVE |
| **Mes inscriptions** | `Listings.tsx` | Pipeline Kanban 4 colonnes, DnD, filtres régions, recherche | LIVE |
| **CRM** | `ContactsListPage` | `organizations/{orgId}/contacts` ; Matchmaker dans Bilan 360° | LIVE |
| **Accès Vendeur** | `/acces-vendeur` · bouton fiche résidence | `vendorPortalTimeline`, catalogue 85 pièces, contact VENDEUR lié | LIVE |
| **Messagerie** | `MailboxContainer` + `CommunicationHub` | `email_threads` / `messages` — courriel, SMS, Meta | LIVE |
| **Statistiques du marché** | `MarketLibraryDashboard` | `market_documents`, parse Vertex, cache MD5, injection HITL | LIVE |
| **ACM territorial Centris** | Onglet Marché | `listings_cache`, `market_analytics_raw`, `centrisComparableCapRate` | EN REVUE PR #17 |
| **Coffre-fort légal** | Onglet Documents | `organizations/{orgId}/legal_vault` + journal `compliance_logs` | EN REVUE PR #17 |
| **Assembleur mandat / PA** | Onglet Promesse | `@primexpert/core/forms` — export HTML natif | EN REVUE PR #17 |
| **Paramètres** | `Settings.tsx` | Profil, conformité photo, comptes courriel, Finance (admin_system) | LIVE |

---

## Répertoire clients (CRM)

| Élément | Détail |
|---------|--------|
| **Core** | `packages/core/src/crm/` |
| **Service** | `src/services/contacts.ts` |
| **Fiche** | `ContactFormDrawer` — LCI, tiers acheteur/vendeur, chronologie omnicanale |
| **Import Maillon 1 (Firestore)** | `scripts/migrate-legacy-contacts-to-v2.mjs` — dry-run par défaut |
| **Import Storage legacy** | `npm run migrate:contacts` — `migrateLegacyContacts.ts` + `legacyContactImport.ts` (90 contacts org défaut, 2026-05-28) |
| **Matchmaker Raphaël** | `raphaelEngine.ts` + `RaphaelMatchmakerPanel` sous notes Bilan 360° |

---

## Statistiques du marché (Big Data)

| Couche | Détail |
|--------|--------|
| UI | `MarketLibraryDashboard.tsx` — upload PDF, grilles HITL (macro / transactions / ratios) |
| Parse | `marketDocumentParseIA` — découpage sémantique PDF, cache `contentHashMd5`, **512 MiB / 60 s** |
| Injection | `injectMarketMacroStats` — empreintes déterministes, `orgId`, `set(merge: true)` |
| Anti-doublons | `packages/core/src/market/marketDeduplication.ts` + cache binaire MD5 |
| Collections | `market_documents`, `market_macro_stats`, `market_analytics_raw`, `marketSnapshots/v1`, `listings_cache` |
| Benchmarks | Ratio des dépenses d'exploitation (RDE/OER) via `@primexpert/core/analytics/marketMetrics.ts` |

---

## État des onglets fiche résidence

| Onglet | Statut |
|--------|--------|
| Synthèse | ✅ Bilan, rétribution éditable, C-73.2, notes, **note vocale** (`AudioRecorderButton`), **Matchmaker Raphaël** |
| Identité | ✅ Édition inline Confort 66+ ; courtier responsable |
| Finances (Hub 5 sous-onglets) | ✅ + benchmark global + prix/RNE/TGA SSOT (`ResidenceDataContext`, `capitalization.ts`) |
| Déclaration | ✅ Questionnaire OACIQ |
| Marché | ✅ **Analyse de mise en marché (ACM)** (SSOT finances + TGA GPS/Centris) + concurrence territoriale |
| Documents | ✅ Scan + parse Vertex + distribution + verrouillage WORM/OACIQ |
| Intelligence | ✅ Chronologie + **`CommunicationHub`** (SMS / Meta / courriel) |
| Accès Vendeur (depuis fiche) | ✅ Portail vendeur — timeline, conformité mandat, pièces |
| Promesse | ✅ Cockpit PA (`offre` SSOT) + assembleur mandat/PA V3.5 |

**Tableau de bord :** priorités KISS (J+3 / J+5 / J+7).

---

## Miroir sauvegarde

Copie possible sur disque de sauvegarde (`00_PRIMEXPERT_SYSTEME_APP/docs/` ou volume miroir) — maintenir aligné avec ce dossier après changements majeurs.

> **Note :** le chemin `SAUVEGARDE GRIS 1/…` n’est pas le dépôt actif ; canonique = `SAUVEGARDE GRIS/01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/`.

---

*Index mis à jour : 2026-06-01 — alignement PR #17 : WORM, marché multi-tenant, Centris, RNE/TGA SSOT, assembleur V3.5.*
