# Primexpert — mémoire de décisions (journal)

> **Emplacement canonique (code + doc jumeaux) :**  
> `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/docs/`  
> Miroir possible : `00_PRIMEXPERT_SYSTEME_APP/docs/` sur le disque de sauvegarde.

---

## Règle #0 — SSOT métier

- **Toute logique financière, identité, valuation, mail parser** vit dans `packages/core/` (`@primexpert/core`).
- Les composants React **ne calculent pas** : ils consomment des view models (`computeBilanCfoViewModel`, `buildRevenusDepensesGrid`, `buildIdentityViewModel`, etc.).
- Firestore listeners : `FinancialDataContext` → `residences/{id}/financial/dataV2` ; `ResidenceDocumentContext` → `residences/{id}`.

---

## Charte visuelle — fiche résidence (2026-05-16)

**Étalon : onglet Identité** — outil de travail CPA / auditeur.

| Token | Usage |
|-------|--------|
| Fond page | `bg-slate-50` / blanc |
| Cartes | `bg-white`, `border-slate-200`, `shadow-sm` |
| Valeurs chiffrées | `text-[#000000]` font-black |
| Labels | `text-slate-600` |
| Accent or (signature) | `#D4AF37` — statuts Déclaration / onglet actif uniquement |
| Interdit | `bg-vault`, dégradés sombres, texte blanc sur fond noir dans les onglets fiche |

Kit partagé : `src/components/residence/institutional/InstitutionalUi.tsx` (`inst`, `InstitutionalKpi`, `InstitutionalSection`, `InstitutionalPlaceholder`).

**Hotfix prod (2026-05-16) :** l’onglet Déclaration référençait encore `PlaceholderPanel` (supprimé) → `InstitutionalPlaceholder` ; commit `0a65adf`.

---

## Fiche résidence V2 — phases livrées

### Phase 3 — Hub Finance (`FinanceHubTab`)

| Sous-onglet | Phase | Core |
|-------------|-------|------|
| Bilan exécutif | 3a | `bilanCfoView.ts` |
| Revenus & Dépenses | 3b | `revenusDepensesGrid.ts` |
| Finançabilité | 3c | `computeFinancabilite.ts` (SCHL Standard / APH Select) |
| Ratios performance | 3d | `performanceRatios.ts` |
| Audit 360° | 3d | `financialOptimization360.ts` |

Données : sous-collection **`residences/{id}/financial/dataV2`** (migration depuis Copilote via `migrate_financial_subcollections.js`).

### Phase 4a — Identité fusionnée

- Package `packages/core/src/identity/`
- UI : `IdentiteImmeubleTab` + sections (`BuildingTechnicalSection`, `CapacityClienteleSection`, etc.)
- Badge MSSS : `RaphaelBadge.tsx`
- Contexte : `ResidenceDocumentProvider`

### Placeholders (phases futures)

- **Synthèse** : bilan CFO agrégé (à brancher sur Hub Finance)
- **Déclaration** : Gold Signature `#D4AF37`
- **Marché** : géointelligence, Haversine, entrée visiteurs
- **Documents** : métadonnées `residences/{id}/documents/`

### Intelligence (`ResidenceIntelligencePanel`)

- Chronologie **appels** (`users/{uid}/call_analyses`) + **courriels** (`mailbox_analyses`)
- Boutons : rapport vendeur / mise à jour → `contentGenPrefill` + onglet ContentGen
- Thème institutionnel clair (2026-05-16)

---

## Navigation & UI (2026-05-15)

### Tour de contrôle — Finance

- **Retirée de la sidebar** (menu gauche = Radar / dossiers uniquement).
- **Déplacée dans Paramètres** : bandeau *Profil et accréditations*, bouton **« Tour de contrôle — Finance »**, visibilité `admin_system` uniquement.
- Navigation : `useWorkhubNav().setActiveTab('admin-billing')`.

### Sidebar

- Colonne fixe `h-screen`, nav scrollable.
- Logos silo **RPA / CPE / PLEX** : `gap-3`.

### Essai 45 jours

- Champ **`trialStartDate`** à l’inscription ; compteurs UI via `trialTimeline.ts`.

### Rôles

| Rôle | Accès |
|------|--------|
| `admin_system` | KPIs Finance + bouton Paramètres, jamais bloqué par Chérif |
| `admin` | Équipe sans Finance |
| `member` | Courtier standard |

---

## Chantier 1 — Chérif & Ghost Billing (2026-05-16)

### Chérif (`billingStatus`)

| État | Comportement |
|------|----------------|
| `active` | Workhub complet |
| `grace_period` | 72 h après échec ; `GracePeriodBanner`, accès conservé |
| `suspended` | `SuspendedAccountScreen`, portail Stripe |

Côté client : `resolveEffectiveBillingStatus()` — règle 72 h si Firestore en retard.

### Ghost Billing

- `companyConfig.ts`, `quebecInvoiceTax.ts`, `invoicePdfService.ts` (ex. 175 $ → 201,21 $ TTC)

### Relances J7 & J21

- **J7** : `J7SurveyModal` ; `j7Survey` + `lastEmailSent: J7`
- **J21** : `maybeSendJ21NurtureEmail` ; file `email_outbox`
- Env : `VITE_SUPPORT_EMAIL`, `VITE_NURTURE_EMAIL_API_URL`

---

## Messagerie — comptes courriel (en cours)

- `EmailAccountsSettings.tsx` — intégration Nylas multi-inbox (travail parallèle).
- Functions : `functions/src/nylas/` (OAuth, webhook, sync).
- Firestore : `users/{uid}/email_threads`, `emailAccounts` (champ profil).

---

## Déploiement

```bash
cd "01_PRIMEXPERT_SYSTEME_APP_STABLE_V2"
npm run build
firebase deploy --only hosting          # primexpert-app-v2
firebase deploy --only firestore:rules  # si règles modifiées
```

**Derniers déploiements hosting :** 2026-05-16 (harmonisation fiche + hotfix `PlaceholderPanel`).

**Repo :** https://github.com/alain-blip/primexpert-v2-core.git — branche `main`.

---

*Journal mis à jour : 2026-05-16.*
