# Documentation Primexpert V2 (Bible)

**Source unique avec le code :** `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/docs/`

| Fichier | Contenu |
|---------|---------|
| [MEMORY.md](./MEMORY.md) | Journal de décisions — UI, billing, fiche résidence, SSOT, déploiement |
| [project_canonical_fields.md](./project_canonical_fields.md) | Champs Firestore (`users`, `residences`, `financial/dataV2`, …) |
| [project_pipeline_gps.md](./project_pipeline_gps.md) | Flux essai 45 j, Chérif, pipeline fiche résidence |
| [arborescence.md](./arborescence.md) | Structure du dépôt, onglets, Firebase, fichiers clés |

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
npm run dev          # local
npm run build        # dist/
firebase deploy --only hosting
```

---

## Principes d’architecture

1. **Règle #0** — Calculs métier dans `packages/core/`, pas dans React.
2. **Multi-tenant** — `courtiersResponsables` sur `residences` ; filtre `@primexpert/core/tenant` + `firestore.rules`.
3. **Finance** — Document unique `residences/{id}/financial/dataV2` ; contexte `FinancialDataProvider`.
4. **Identité** — Document racine `residences/{id}` ; contexte `ResidenceDocumentProvider`.
5. **UI fiche** — Charte institutionnelle (fond clair, valeurs `#000000`) via `InstitutionalUi.tsx`.

---

## État des onglets fiche résidence (2026-05-16)

| Onglet | Statut |
|--------|--------|
| Identité | ✅ Livré |
| Finances (Hub 5 sous-onglets) | ✅ Livré |
| Intelligence | ✅ Livré |
| Synthèse, Déclaration, Marché, Documents | ⏳ Placeholders institutionnels |

---

## Miroir sauvegarde

Copie possible sur disque : `00_PRIMEXPERT_SYSTEME_APP/docs/` — maintenir aligné avec ce dossier après changements majeurs.

---

*Index mis à jour : 2026-05-16.*
