# Dictionnaire canonique — données Primexpert

Aligné sur `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2`. Les champs sensibles (`billingStatus`, `lastEmailSent`) sont **écrits par le serveur** (Stripe / Cloud Functions), pas par le client.

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
| **`trialStartDate`** | **Timestamp** (recommandé) ou string `yyyy-mm-dd` | — | Début essai **45 jours gratuits** |
| **`billingStatus`** | string | **`active`** \| **`grace_period`** \| **`suspended`** | Chérif — accès Radar |
| **`gracePeriodStartedAt`** | Timestamp ou string ISO | — | Début des **72 h** de grâce après échec paiement |
| **`lastEmailSent`** | string \| null | **`J7`** \| **`J21`** \| **`J30`** \| **`J40`** \| `null` | Dernier courriel de relance onboarding |
| `accessibleSilos` | array | `RPA`, `CPE`, `PLEX` | RBAC silos |
| `licenseName`, `title`, `agency` | string | optionnel | Profil OACIQ |

### Abonnement (à migrer depuis démo ou sous-collection)

| Champ | Type | Description |
|--------|------|-------------|
| `hasPaymentMethod` | bool | Carte Stripe enregistrée |
| `planId` | string | `solo`, `pro`, `pro_plus`, etc. |
| `isAffiliated` | bool | Affilié Prisma (exonération facturation) |
| `billingCycle` | string | `annual` \| `monthly` |

---

## Fichiers code correspondants

| Sujet | Fichier |
|--------|---------|
| Profil + essai | `src/lib/auth.tsx` |
| Garde suspension | `src/lib/billingAccess.ts`, `src/App.tsx` |
| Écran blocage | `src/components/SuspendedAccountScreen.tsx` |
| Bandeau 72 h | `src/components/GracePeriodBanner.tsx` |
| Bouton Finance | `src/components/Settings.tsx` (`showFinanceButton`) |
| Taxes + PDF | `src/lib/quebecInvoiceTax.ts`, `src/services/invoicePdfService.ts` |
| Config légal | `src/config/companyConfig.ts` |
