# Primexpert — mémoire de décisions (journal)

> **Emplacement canonique (code + doc jumeaux) :**  
> `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/docs/`  
> Miroir possible : `00_PRIMEXPERT_SYSTEME_APP/docs/` sur le disque de sauvegarde.

## Navigation & UI (2026-05-15)

### Tour de contrôle — Finance

- **Retirée de la sidebar** (menu gauche = Radar / dossiers uniquement).
- **Déplacée dans Paramètres** : bandeau *Profil et accréditations*, bouton **« Tour de contrôle — Finance »** (icône bouclier), **à gauche de « Réinitialiser »**.
- Visibilité : `showFinanceButton = (user.role === 'admin_system')` dans `Settings.tsx`.
- Navigation : `useWorkhubNav().setActiveTab('admin-billing')`.

### Sidebar

- **Fixe** : colonne `h-screen`, header et pied `shrink-0`, nav `flex-1 min-h-0 overflow-y-auto` (pas de rollup qui masque des entrées).
- Logos silo **RPA / CPE / PLEX** : espacement **`gap-3`** (réduction ~50 % vs `gap-8`).

### Essai 45 jours

- Campagne et compteurs UI validés ; champ **`trialStartDate`** à l’inscription.

### Rôles

- **`admin_system`** : KPIs Finance + bouton Paramètres.
- **`admin`** : équipe sans Finance.
- **`member`** : courtier standard.

## Chantier 1 — Chérif & Ghost Billing (2026-05-16)

### Chérif (`billingStatus`)

| État | Comportement |
|------|----------------|
| `active` | Accès Radar complet |
| `grace_period` | 72 h après échec de paiement ; bandeau d’avertissement, accès conservé |
| `suspended` | Écran plein écran `<SuspendedAccountScreen />`, pas de sidebar, bouton Stripe |

Transitions prévues (Stripe webhooks + Cloud Functions) :

1. Échec prélèvement J45 → `grace_period` + `gracePeriodStartedAt`
2. Après **72 h** sans régularisation → `suspended`
3. Paiement réussi → `active`

Côté client : `resolveEffectiveBillingStatus()` applique la règle des 72 h si Firestore est en retard.

### Ghost Billing

- `src/config/companyConfig.ts` — placeholders `[NEQ EN ATTENTE]`, etc.
- `src/lib/quebecInvoiceTax.ts` — TPS 5 %, TVQ 9,975 %
- `src/services/invoicePdfService.ts` — PDF `jspdf` (ex. 175 $ → 201,21 $)

### Relances J7 & J21 (2026-05-16)

- **J7** : `J7SurveyModal` au jour 7+ ; options B/C → alerte `supportEmail` ; `j7Survey` + `lastEmailSent: J7`.
- **J21** : template CMA/Radar ; envoi auto J+21 via `maybeSendJ21NurtureEmail` ; file `email_outbox`.
- Env : `VITE_SUPPORT_EMAIL`, `VITE_NURTURE_EMAIL_API_URL` (optionnel).

### Déploiement

- Hosting : `primexpert-app-v2` — `firebase deploy --only hosting`
- Règles : `firebase deploy --only firestore:rules` (incl. `email_outbox`, champs `j7Survey`)
