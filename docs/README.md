# Documentation Primexpert V2 (Bible)

**Source unique avec le code :** `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/docs/`

| Fichier | Contenu |
|---------|---------|
| [MEMORY.md](./MEMORY.md) | Journal de décisions — UI, billing, fiche résidence, documents, Vertex, déploiement |
| [project_canonical_fields.md](./project_canonical_fields.md) | Champs Firestore (`users`, `residences`, `documents`, `financial/dataV2`, …) |
| [project_pipeline_gps.md](./project_pipeline_gps.md) | Flux essai 45 j, Chérif, pipeline fiche résidence & documents |
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
```

---

## Principes d’architecture

1. **Règle #0** — Calculs métier dans `packages/core/`, pas dans React.
2. **Multi-tenant** — `courtiersResponsables` sur `residences` ; filtre `@primexpert/core/tenant` + `firestore.rules`.
3. **Finance** — Document unique `residences/{id}/financial/dataV2` ; contexte `FinancialDataProvider`.
4. **Identité** — Document racine `residences/{id}` ; contexte `ResidenceDocumentProvider`.
5. **Documents** — Sous-collection `residences/{id}/documents/` ; scan + parse IA via Cloud Functions (Vertex ADC).
6. **UI fiche & inscriptions** — Tokens **`primexpert-*`** (`tailwind.config.js`, `src/index.css`) ; coquilles `InstitutionalResidenceTabShell` ; cartes **Mes inscriptions** (`ListingInstitutionalCard`, `listingCardViewModel.ts`).
7. **Langage Québec** — Pas de « audit » à l’écran ; abréviations toujours développées (voir [MEMORY.md](./MEMORY.md)).

---

## État des onglets fiche résidence (2026-05-19)

| Onglet | Statut |
|--------|--------|
| Synthèse | ✅ `Synthese360Tab` — bilan, rétribution, C-73.2, notes |
| Identité | ✅ Livré — édition inline Confort 66+ (`onBlur` → `updateResidence`) |
| Finances (Hub 5 sous-onglets) | ✅ Livré |
| Déclaration | ✅ Livré — questionnaire OACIQ |
| Marché | ✅ Livré — marché & concurrence |
| Documents (Financier / Technique / Légal) | ✅ Livré — scan sécurité + extraction Vertex + distribution / courriel |
| Intelligence (chronologie + rapport vendeur) | ✅ Livré |
| Promesse | ✅ Livré — cockpit PA (tronc `offre`, conditions & délais RPA, clôture, délais jours→dates, commission) |

**Mes inscriptions :** pipeline **4 colonnes** + inventaire virtualisé — charte **primexpert-blue** / cartes blanches bordées **primexpert-dark**.

**Tableau de bord :** priorités de suivi KISS (J+3 / J+5 / J+7) — `PriorityFollowUpList`.

---

## Espace Documents — résumé technique

| Couche | Détail |
|--------|--------|
| UI | `DocumentsDiligenceTab` — 3 colonnes, onglets, réconciliation auto scan/parse, distribution, courriel |
| Storage | `primexpert/{brokerId}/properties/{propertyId}/documents/{category}/` |
| Parse IA | Vertex `gemini-2.0-flash-001` (`us-central1`) — `functions/src/services/vertexClient.ts` |
| Auth prod | ADC compte de service `250702494735-compute@developer.gserviceaccount.com` — **sans** clé JSON |

---

## Miroir sauvegarde

Copie possible sur disque : `00_PRIMEXPERT_SYSTEME_APP/docs/` — maintenir aligné avec ce dossier après changements majeurs.

---

*Index mis à jour : 2026-05-19 — Identité Confort 66+, cockpit promesse d'achat (Sprints PA 5.1–5.4).*
