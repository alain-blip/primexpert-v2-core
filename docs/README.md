# Documentation Primexpert V2 (Bible)

**Source unique avec le code :** `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/docs/`

| Fichier | Contenu |
|---------|---------|
| [MEMORY.md](./MEMORY.md) | Journal de décisions — UI, billing, fiche résidence, documents, Vertex, Big Data, déploiement |
| [project_canonical_fields.md](./project_canonical_fields.md) | Champs Firestore (`users`, `residences`, `market_documents`, `market_analytics_raw`, …) |
| [project_pipeline_gps.md](./project_pipeline_gps.md) | Flux essai 45 j, Chérif, pipeline fiche résidence, messagerie, Statistiques du marché |
| [arborescence.md](./arborescence.md) | Structure du dépôt, onglets, Firebase, Cloud Functions, fichiers clés |

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
3. **Finance** — Document unique `residences/{id}/financial/dataV2` ; contexte `FinancialDataProvider`.
4. **Identité** — Document racine `residences/{id}` ; contexte `ResidenceDocumentProvider`.
5. **Documents** — Sous-collection `residences/{id}/documents/` ; scan + parse IA via Cloud Functions (Vertex ADC).
6. **UI fiche & inscriptions** — Tokens **`primexpert-*`** ; coquilles `InstitutionalResidenceTabShell` ; cartes **Mes inscriptions** (Kanban DnD, filtres régions QC).
7. **Langage Québec** — Pas de « audit » à l’écran ; abréviations toujours développées (voir [MEMORY.md](./MEMORY.md)).
8. **Messagerie** — SSOT `users/{uid}/email_threads` + `messages` ; Phase 2 liaison CRM (`matchedContactId`).
9. **Promesse d'achat** — SSOT `packages/core/src/transaction/` + objet Firestore `offre` / `promesseAchat`.
10. **Diffusion Web** — `@primexpert/core/diffusion` vendoré dans Cloud Functions (prebuild).
11. **CRM Contacts** — SSOT `organizations/{orgId}/contacts` ; liaisons `coBuyerIds` / `coSellerIds` et `partiesImpliquees` en writeBatch.
12. **Statistiques du marché** — Vault `market_documents` ; injection idempotente vers `market_analytics_raw` / `market_macro_stats` (`marketDeduplication.ts`).
13. **Analyse de mise en marché (ACM)** — Fiche résidence, onglet Marché : bootstrap `residenceAcmBootstrap.ts`, workspace `AcmValuationWorkspace`, TGA médian GPS par région/classe, recalcul live (`e1a900c`).

---

## Workhub — modules principaux (2026-05-24)

| Module | Accès | SSOT |
|--------|-------|------|
| **Mes inscriptions** | `Listings.tsx` | Pipeline Kanban 4 colonnes, DnD, filtres régions |
| **CRM** | `ContactsListPage` | `organizations/{orgId}/contacts` |
| **Accès Vendeur** | `/acces-vendeur` · bouton fiche résidence | `vendorPortalTimeline`, `vendorPortalService`, contact VENDEUR lié |
| **Messagerie** | `MailboxContainer` | `email_threads` / `messages` + `matchedContactId` |
| **Statistiques du marché** | `MarketLibraryDashboard` | `market_documents`, parse Vertex, injection HITL |
| **Paramètres** | `Settings.tsx` | Profil, comptes courriel, Finance (admin_system) |

---

## Répertoire clients (CRM)

| Élément | Détail |
|---------|--------|
| **Core** | `packages/core/src/crm/` |
| **Service** | `src/services/contacts.ts` |
| **Fiche** | `ContactFormDrawer` — LCI, tiers acheteur/vendeur, chronologie omnicanale |
| **Import Maillon 1** | `scripts/migrate-legacy-contacts-to-v2.mjs` — dry-run par défaut ; SSOT `legacyContactImport.ts` (fusion contacts/vendors, aplatissement `buyerPipeline`, qualification stricte : `QUALIFIED` = NDA + fonds ou stage explicitement qualifié) |

---

## Statistiques du marché (Big Data)

| Couche | Détail |
|--------|--------|
| UI | `MarketLibraryDashboard.tsx` — upload PDF, grilles HITL (macro / transactions / ratios) |
| Parse | `marketDocumentParseIA` — **2 GiB**, **540 s** (PDF massifs ~100 p.) |
| Injection | `injectMarketMacroStats` — empreintes déterministes, `set(merge: true)` |
| Anti-doublons | `packages/core/src/market/marketDeduplication.ts` |
| Collections | `market_documents`, `market_macro_stats`, `market_analytics_raw`, `marketSnapshots/v1` |

---

## État des onglets fiche résidence

| Onglet | Statut |
|--------|--------|
| Synthèse | ✅ Bilan, rétribution, C-73.2, notes |
| Identité | ✅ Édition inline Confort 66+ ; courtier responsable |
| Finances (Hub 5 sous-onglets) | ✅ + benchmark global |
| Déclaration | ✅ Questionnaire OACIQ |
| Marché | ✅ **Analyse de mise en marché (ACM)** (SSOT finances + TGA GPS) + concurrence territoriale |
| Documents | ✅ Scan + parse Vertex + distribution |
| Intelligence | ✅ Chronologie appels + courriels |
| Accès Vendeur (depuis fiche) | ✅ Portail vendeur — timeline, conformité mandat, pièces |
| Promesse | ✅ Cockpit PA (`offre` SSOT) |

**Tableau de bord :** priorités KISS (J+3 / J+5 / J+7).

---

## Miroir sauvegarde

Copie possible sur disque de sauvegarde (`00_PRIMEXPERT_SYSTEME_APP/docs/` ou volume miroir) — maintenir aligné avec ce dossier après changements majeurs.

> **Note :** le chemin `SAUVEGARDE GRIS 1/…` n’est pas le dépôt actif ; canonique = `SAUVEGARDE GRIS/01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/`.

---

*Index mis à jour : 2026-05-20 (fin de journée) — Accès Vendeur, Maillon 1 contacts, **Analyse de mise en marché (ACM)** SSOT (`e1a900c` sur `main`).*
