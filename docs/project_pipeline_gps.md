# Pipeline GPS — abonnements, essai 45 j et facturation

Vision produit Primexpert V2.5. Une partie est **implémentée en UI** ; Stripe, courriels et cron sont **à brancher** (Cloud Functions).

---

## Flux principal (courtier)

```text
Inscription (Auth + users/{uid})
    ↓
Saisie carte Stripe (Customer + PaymentMethod)     [futur]
    ↓
trialStartDate enregistré → Essai 45 jours gratuits
    ↓
Relances courriel J+7, J+21, J+30, J+40          [futur — lastEmailSent]
    ↓
J+38 (fin essai − 7 j) : envoi facture PDF       [Ghost Billing — invoicePdfService]
    ↓
J+45 (J-0 prélèvement) : tentative Stripe
    ├─ Succès → billingStatus: active, accès maintenu
    └─ Échec  → billingStatus: grace_period (+ gracePeriodStartedAt)
                    ↓
              72 h sans régularisation
                    ↓
              billingStatus: suspended → SuspendedAccountScreen
                    ↓
              Paiement via portail Stripe → active (webhook)
```

---

## États `billingStatus` (Chérif)

| État | Déclencheur | Expérience utilisateur |
|------|-------------|------------------------|
| `active` | Paiement OK ou essai en cours sans échec | Workhub normal |
| `grace_period` | Échec prélèvement (ex. J45) | Bandeau 72 h, accès conservé |
| `suspended` | 72 h après `gracePeriodStartedAt` sans paiement | Écran de blocage, bouton « Mettre à jour ma carte » |

**Exemption :** `role === admin_system` (direction) — jamais bloqué.

---

## Séquence de relance (courriels)

| Jalon | Champ `lastEmailSent` | Objectif |
|--------|----------------------|----------|
| J+7 | `J7` | Première semaine — aide |
| J+21 | `J21` | Valeur Radar / mandat |
| J+30 | `J30` | Transition (15 j restants) |
| J+40 | `J40` | Urgence paiement |

Transporteur prévu : Postmark ou SendGrid. Mise à jour Firestore après chaque envoi.

---

## Facturation (Ghost Billing)

### Calcul taxes Québec (exemple forfait mensuel)

| Ligne | Montant |
|--------|---------|
| Sous-total | 175,00 $ |
| TPS (5 %) | 8,75 $ |
| TVQ (9,975 %) | 17,46 $ |
| **Total** | **201,21 $** |

Implémentation : `computeQuebecTaxes()` dans `src/lib/quebecInvoiceTax.ts`.

### PDF

- Génération : `downloadInvoicePdf()` / `downloadSampleMonthlyInvoice()` dans `src/services/invoicePdfService.ts`.
- En-tête légal : `src/config/companyConfig.ts` (placeholders jusqu’à incorporation).

---

## Intégration actuelle (code)

| Composant | Statut |
|-----------|--------|
| Garde `/workhub` + `SuspendedAccountScreen` | ✅ |
| Bandeau `grace_period` | ✅ |
| Résolution 72 h côté client | ✅ `resolveEffectiveBillingStatus` |
| PDF + taxes | ✅ |
| Webhooks Stripe → Firestore | ⏳ |
| Cron relances + `lastEmailSent` | ⏳ |
| Envoi facture automatique J−7 | ⏳ |

---

## Prochaines étapes techniques

1. Cloud Function : webhook `invoice.payment_failed` → `grace_period` + `gracePeriodStartedAt`.
2. Cloud Function : cron quotidien → `grace_period` → `suspended` après 72 h ; relances J7–J40.
3. Stripe Customer Portal : `VITE_STRIPE_CUSTOMER_PORTAL_URL`.
4. Déployer `firestore.rules` ( `billingStatus` non modifiable par le client ).
