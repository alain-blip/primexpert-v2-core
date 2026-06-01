# Documentation Primexpert V2 (Bible)

**Source unique avec le code :** `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/docs/`  
**URL officielle :** https://primexpert-app-v2.web.app  
**Cycle technique :** **V3.8 — QA RNE/TGA centralisée** · V3.7 marché/OER/flywheel + assembleur de mandats V3.5 · **couverture RPA PR #3** (Kanban + délais PA acceptée) · architectures sécurisées V3.0 en production

## Registre global des architectures sécurisées — mai 2026

| Élément | Statut |
|---------|--------|
| **URL officielle** | https://primexpert-app-v2.web.app |
| **Firestore** | Règles WORM actives & verrouillées en prod |
| **Cloud Function** | `onVaultDocumentWrite` — **PROD LIVE — Montréal** (`northamerica-northeast1`) |
| **Registre exécutif** | 5 piliers d'élite majeurs certifiés et actifs |

## Registre global de la suite — mai 2026

| Volet | Statut certifié |
|-------|-----------------|
| Cœur CRM & fiches parties | **OPÉRATIONNEL — PRODUCTION LIVE** |
| Analyse de mise en marché (ACM) & benchmark taux de capitalisation (TGA) | **OPÉRATIONNEL — PRODUCTION LIVE** |
| Hub omnicanal (SMS / Nylas) | **OPÉRATIONNEL — PRODUCTION LIVE** |
| Clauses négociation Gemini | **CÂBLÉ — MOTEUR DYNAMIQUE ACTIF** |
| Coffre-fort WORM & sécurité | **OPÉRATIONNEL — PRODUCTION LIVE** |
| Assembleur contrat & annexes (V3.5) | **SCELLÉ — commit `63286dc`** (HTML natif, sans docxtemplater) |
| Hub Finance — cohérence RNE / prix inter-onglets | **DÉPLOYÉ PROD — commit `d232673`** (hosting 2026-05-30) |
| QA RNE / taux de capitalisation (TGA) centralisée | **EN VALIDATION PR #36** — `capitalizationMetrics`, Finançabilité, EEE, ACM, injection IA |
| Inscriptions Centris / hors marché + concurrence territoriale | **EN REVUE PR #3** — `listings_cache`, `listingSource`, override manuel |
| Couverture tests flux RPA | **EN REVUE PR #3** — Vitest Kanban `resolveColumnId` + 7 délais PA acceptée |

> Détail technique et historique : [`MEMORY.md`](./MEMORY.md)

---

| Fichier | Contenu |
|---------|---------|
| [MEMORY.md](./MEMORY.md) | **Journal primaire** — registre global, déploiements, volets V2.5–V2.9 |
| [project_canonical_fields.md](./project_canonical_fields.md) | Champs Firestore (`users`, `residences`, `contacts`, `market_*`, …) |
| [project_pipeline_gps.md](./project_pipeline_gps.md) | Flux essai 45 j, Chérif, pipeline fiche résidence, messagerie, régions Functions |
| [arborescence.md](./arborescence.md) | Structure du dépôt, onglets, Firebase, Cloud Functions, fichiers clés |
| [CANON_UNIQUE_PRIMEXPERT_V2.md](./CANON_UNIQUE_PRIMEXPERT_V2.md) | Version consolidée unique (gouvernance, architecture, SSOT, modules) |
| [VERIFICATION_COHERENCE_CROISEE.md](./VERIFICATION_COHERENCE_CROISEE.md) | Vérification transversale docs ↔ code |
| [CHECKLIST_PREDEPLOIEMENT_PROD.md](./CHECKLIST_PREDEPLOIEMENT_PROD.md) | Checklist Go/No-Go avant déploiement production |
| [CLOSING_AND_COMPLIANCE_DRAFT.md](./CLOSING_AND_COMPLIANCE_DRAFT.md) | Après-vente V2.7 — closing, Loi 25, `onPromiseAcceptedTrigger` |
| [CENTRIS_RESO_MAPPING_DRAFT.md](./CENTRIS_RESO_MAPPING_DRAFT.md) | Dictionnaire diffusion Centris RESO (OData v4) |

### Gouvernance (PO — lecture humaine)

| Fichier | Contenu |
|---------|---------|
| [CHARTE SUPRÊME & GOUVERNANCE PRIMEXPERT .rtf](./CHARTE%20SUPR%C3%8AME%20%26%20GOUVERNANCE%20PRIMEXPERT%20.rtf) | Règle #0, KISS, zone rouge, protocole déploiement, postures Cursor/Gemini (v2026.2) |
| [Primexpert Normes d'implantation.rtf](./Primexpert%20Normes%20d'implantation.rtf) | Exigences OACIQ/LCI, arborescence produit, annexe état V2.8 |

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
3. **Finance** — Document unique `residences/{id}/financial/dataV2` ; contexte `FinancialDataProvider` ; prix/RNE via `@primexpert/core/financial` + `ResidenceDataContext` ; QA taux de capitalisation (TGA) via `capitalizationMetrics.ts`.
4. **Identité** — Document racine `residences/{id}` ; contexte `ResidenceDocumentProvider` + **`ResidenceDataProvider`** (fusion liste + Firestore).
5. **Documents** — Sous-collection `residences/{id}/documents/` ; scan + parse IA via Cloud Functions (Vertex ADC).
6. **UI fiche & inscriptions** — Tokens **`primexpert-*`** ; coquilles `InstitutionalResidenceTabShell` ; cartes **Mes inscriptions** (Kanban DnD, filtres régions QC).
7. **Langage Québec** — Pas de « audit » à l’écran ; abréviations toujours développées (voir [MEMORY.md](./MEMORY.md)).
8. **Messagerie omnicanale** — SSOT `users/{uid}/email_threads` + `messages` ; canaux `email` \| `sms` \| `facebook` \| `instagram` ; liaison CRM (`matchedContactId`, téléphone) ; webhooks Twilio/Meta (Montréal).
9. **Notes vocales** — Storage `organizations/{orgId}/voice_notes/` → `onVoiceNoteUploaded` → notes/tâches résidence.
10. **Promesse d'achat** — SSOT `packages/core/src/transaction/` + objet Firestore `offre` / `promesseAchat`.
11. **Diffusion Web** — `@primexpert/core/diffusion` vendoré dans Cloud Functions (prebuild).
12. **CRM Contacts** — SSOT `organizations/{orgId}/contacts` ; import Storage legacy `npm run migrate:contacts` ; Matchmaker Raphaël (acheteurs `QUALIFIED`).
13. **Statistiques du marché** — Vault `market_documents` ; injection idempotente vers `market_analytics_raw` / `market_macro_stats` (`marketDeduplication.ts`).
14. **Analyse de mise en marché (ACM)** — Fiche résidence, onglet Marché : bootstrap `residenceAcmBootstrap.ts`, workspace `AcmValuationWorkspace`, TGA médian GPS par région/classe, recalcul live.
15. **Copilote négociation (V2.6)** — SSOT `packages/core/src/ai/` (`negotiationEngine`, `oaciqSpecsTypes`) ; LLM JSON Gemini ; HITL `manualVerifications` ; modes formulaire OACIQ / contrat personnalisé / lettre d'intention (LOI).
16. **Après-vente & conformité Loi 25 (V2.7)** — SSOT `closingEngine.ts` ; consentement `law25Consent` sur contacts ; conception [`CLOSING_AND_COMPLIANCE_DRAFT.md`](./CLOSING_AND_COMPLIANCE_DRAFT.md) ; trigger prod `onPromiseAcceptedTrigger` planifié.
17. **Rédacteur IA Centris** — Workhub `ContentGen.tsx` + lint OACIQ `@primexpert/core/narrative` ; validation humaine obligatoire avant diffusion.
18. **VoIP** (parallèle) — Twilio Voice SDK ; `packages/core/src/telephony/`, Functions `getTwilioToken` / `twilioVoiceResponse`.
19. **Accès Vendeur autonome (V2.8)** — Jeton 30 j (`vendor_portal_invites`) ; catalogue **85 pièces** ; mode client `/acces-vendeur?token=…` ; alertes téléversement courtier.
20. **Briefing du matin & Radar off-market (V2.8)** — Cron `morningBriefingGenerator` (06:00 Toronto) ; `organizations/{orgId}/morning_briefings` + `prospects_radar` ; tableau de bord.
21. **Routage SPA (V2.8)** — `App.tsx` → lazy `AuthenticatedApp.tsx` ; routes `/workhub`, `/acces-vendeur` (jeton = session client sans Google) ; sortie landing publique par `PublicLandingRedirect` avec garde `signInPending`.
22. **Recherche multi-critères** — CRM (`contactSearch.ts`) et inscriptions (villes, municipalités).
23. **Assembleur de mandats (V3.5)** — `@primexpert/core/forms` ; champs entre parenthèses typés ; `ContractAssemblerPanel` onglet Promesse ; export HTML natif (legacy docxtemplater expulsé).
24. **Inscriptions Centris / hors marché** — `@primexpert/core/residence` (`listingSource`, `inscriptionBrokerageStatus`) ; création contrôlée depuis `CreateInscriptionForm` ; sync Centris bloquée sur `off_market` ou override manuel.
25. **Marché V3.2–V3.7** — `@primexpert/core/market` + `@primexpert/core/analytics` ; cache `listings_cache`, flywheel anonymisé `market_analytics_raw`, ratio des dépenses d'exploitation (RDE/OER) et benchmarks régionaux.
26. **Qualité RPA automatisée** — `npm run test:rpa-coverage` ; couverture `resolveColumnId()` et validations des 7 échéances critiques PA acceptée (`dateLimiteDeduitLci` incluse).
27. **QA RNE / TGA centralisée (PR #36)** — `@primexpert/core/financial/capitalizationMetrics.ts` normalise les taux en décimal, calcule `RNE ÷ prix`, `RNE ÷ TGA`, et l'écart RNE déclaré/vérifié ; consommation par ACM, rapports, Finançabilité et sauvegardes `financial/dataV2`.

---

## Scripts npm — ops & tests (2026-05-29)

| Script | Usage |
|--------|--------|
| `npm run migrate:contacts` | Dry-run import contacts legacy (Storage + Firestore) |
| `npm run migrate:contacts:execute` | Exécution réelle vers `organizations/{orgId}/contacts` |
| `npm run test:voice-note` | Pipeline note vocale (Whisper si clé OpenAI) |
| `npm run test:voice-note:gemini` | Pipeline note vocale — STT Gemini uniquement |
| `npm run test:incoming-sms` | Injection SMS test → fil `crm_{contactId}` |
| `npm run test:rpa-coverage` | Vitest ciblé Kanban + délais PA acceptée ; contrôle 100 % `resolveColumnId()` |
| `npm test` | Suite Vitest configurée (`vitest.config.ts`) |

---

## Workhub — modules principaux (2026-05-29)

| Module | Accès | SSOT | Statut |
|--------|-------|------|--------|
| **Tableau de bord** | `Dashboard.tsx` | Briefing matin, radar off-market, priorités KISS | LIVE |
| **Mes inscriptions** | `Listings.tsx` | Pipeline Kanban 4 colonnes, DnD, filtres régions, recherche, création Centris / hors marché | LIVE + PR #3 |
| **CRM** | `ContactsListPage` | `organizations/{orgId}/contacts` ; recherche LCI ; Matchmaker | LIVE |
| **Accès Vendeur** | `/acces-vendeur` · lien invité · bouton fiche | Catalogue 85 pièces, `vendorPortalCompliance`, `vendor_portal_invites` | LIVE |
| **Messagerie** | `MailboxContainer` + `CommunicationHub` | `email_threads` / `messages` — courriel, SMS, Meta | LIVE |
| **Statistiques du marché** | `MarketLibraryDashboard` | `market_documents`, parse Vertex, injection HITL | LIVE |
| **Rédacteur IA** | `ContentGen.tsx` | `@primexpert/core/narrative` — lint OACIQ | LIVE |
| **Copilote négociation** | core + Vertex | `negotiationEngine`, `oaciqSpecsTypes` | CÂBLÉ (core) |
| **Après-vente closing** | core | `closingEngine.ts` → `residences/…/tasks` | CÂBLÉ — trigger prod planifié |
| **Paramètres** | `Settings.tsx` | Profil, comptes courriel, Finance (admin_system) | LIVE |

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
| **Recherche LCI** | `contactSearch.ts` — nom, entreprise, courriel, téléphone (haystack normalisé) |

---

## Statistiques du marché (Big Data)

| Couche | Détail |
|--------|--------|
| UI | `MarketLibraryDashboard.tsx` — upload PDF, grilles HITL (macro / transactions / ratios) |
| Parse | `marketDocumentParseIA` — **512 MiB**, **60 s** ; découpage sémantique PDF avant Vertex |
| Injection | `injectMarketMacroStats` — empreintes déterministes, `set(merge: true)` |
| Anti-doublons | `packages/core/src/market/marketDeduplication.ts` + cache `contentHashMd5` sur `market_documents` |
| Concurrence territoriale | `listings_cache` Centris Matrix + `market_analytics_raw` → TGA médian ACM |
| Flywheel interne | `onTransactionConcludedFlywheel` — PA acceptée / vendu → `market_analytics_raw` anonymisé |
| OER / RDE | `@primexpert/core/analytics/marketMetrics.ts` — ratio dépenses/RBE et benchmarks régionaux |
| Collections | `market_documents`, `market_macro_stats`, `market_analytics_raw`, `marketSnapshots/v1`, `listings_cache` |

---

## État des onglets fiche résidence

| Onglet | Statut |
|--------|--------|
| Synthèse | ✅ Bilan, rétribution éditable, prix demandé éditable, C-73.2, notes, **note vocale**, **Matchmaker Raphaël**, nœuds canoniques HITL |
| Identité | ✅ Édition inline Confort 66+ ; courtier responsable |
| Finances (Hub 5 sous-onglets) | ✅ + benchmark global + QA RNE déclaré/vérifié (`computeNoiVarianceRatio`) |
| Déclaration | ✅ Questionnaire OACIQ |
| Marché | ✅ **Analyse de mise en marché (ACM)** (SSOT finances + TGA GPS) + concurrence territoriale + TGA centralisé |
| Documents | ✅ Scan + parse Vertex + distribution + Verrouillage WORM/OACIQ client (V3.1) |
| Intelligence | ✅ Chronologie + **`CommunicationHub`** (SMS / Meta / courriel) |
| Accès Vendeur (depuis fiche) | ✅ Portail autonome — catalogue 85 pièces, lien invité 30 j, alertes téléversement |
| Promesse | ✅ Cockpit PA (`offre` SSOT) + **assembleur contrat V3.5** (`ContractAssemblerPanel`, export HTML) |

**Tableau de bord :** briefing du matin (tâches critiques, rendez-vous, hot leads), radar à opportunités off-market, priorités KISS (J+3 / J+5 / J+7).

---

## Miroir sauvegarde

Copie possible sur disque de sauvegarde (`00_PRIMEXPERT_SYSTEME_APP/docs/` ou volume miroir) — maintenir aligné avec ce dossier après changements majeurs.

> **Note :** le chemin `SAUVEGARDE GRIS 1/…` n’est pas le dépôt actif ; canonique = `SAUVEGARDE GRIS/01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/`.

---

*Index mis à jour : 2026-06-01 — alignement PR #36 (QA RNE/TGA centralisée) après PR #3 (couverture RPA, Centris/off-market, flywheel/OER, coffre-fort WORM documenté).*
