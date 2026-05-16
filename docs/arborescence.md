# Arborescence — Primexpert app (référence continuité)

## Emplacement unique (code + doc)

| Élément | Rôle |
|---------|------|
| **`01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/`** | Application **Vite + React** + **documentation** (`docs/`), déployée sur Firebase Hosting **`primexpert-app-v2`**. |

---

## `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2` (vue logique)

```
01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/
├── docs/                      # Bible Primexpert (MEMORY, champs, pipeline, arborescence)
│   ├── MEMORY.md
│   ├── project_canonical_fields.md
│   ├── project_pipeline_gps.md
│   └── arborescence.md
├── firebase.json              # Hosting (dist), Firestore (DB nommée), storage
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── index.html
├── package.json
├── vite.config.ts
├── public/                    # Assets statiques (logos silo, logo Primexpert…)
└── src/
    ├── main.tsx
    ├── App.tsx                  # Routes / Workhub / lazy routes / garde admin-billing
    ├── components/
    │   ├── Layout.tsx           # Sidebar, header, assistant — pas d’entrée Finance dans nav
    │   ├── Settings.tsx         # Bandeau Profil + bouton Finance (admin_system)
    │   ├── AdminSubscriptionsDashboard.tsx
    │   ├── Dashboard.tsx
    │   ├── Listings*.tsx, ListingRow.tsx
    │   ├── CRM.tsx
    │   ├── ACM.tsx, ContentGen.tsx, Mailbox.tsx
    │   ├── Drive/
    │   └── Softphone/
    ├── context/
    │   └── SiloContext.tsx
    ├── hooks/
    ├── lib/
    │   ├── auth.tsx             # UserProfile, trialStartDate, rôles
    │   ├── firebase.ts
    │   ├── i18n.tsx
    │   ├── subscriptionPricing.ts   # DEMO subscribers, MRR, essai 45j
    │   ├── workhubNav.tsx
    │   └── …
    ├── services/                # Gemini, Drive, mailbox, transcriptions…
    └── types/
        └── residence.ts
```

---

## Firebase

- **Projet :** `primexpert-app-v2`
- **Hosting :** répertoire de build **`dist/`** (SPA, réécriture `**` → `index.html`).
- **Firestore :** base configurée dans `firebase.json` (ID base *ai-studio-…* — vérifier la console pour l’URL exacte).

---

## Fichiers clés pour la « Bible » métier Finance

| Sujet | Fichier |
|--------|---------|
| Rôles & essai à l’inscription | `src/lib/auth.tsx` |
| Règles sécurité | `firestore.rules` |
| KPIs & démo abonnés | `src/lib/subscriptionPricing.ts`, `src/components/AdminSubscriptionsDashboard.tsx` |
| Accès route Finance | `src/App.tsx` (`admin-billing`, `admin_system` uniquement) |
| Bouton Finance | `src/components/Settings.tsx` |
| Décisions & données (texte) | `docs/MEMORY.md`, `docs/project_canonical_fields.md`, `docs/project_pipeline_gps.md` |

---

*Dernière mise à jour du schéma : 2026-05-15 — docs regroupées dans ce dépôt.*
