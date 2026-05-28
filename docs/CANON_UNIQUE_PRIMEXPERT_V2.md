# CANON UNIQUE — Primexpert V2

Version consolidée des documents de gouvernance, architecture, dictionnaire de données et pipeline d'execution.

---

## 1) Mission et regles non negociables

- Primexpert V2 est un systeme SaaS immobilier Quebec orienté conformite, productivite courtier et execution terrain.
- Regle #0: enrichir l'existant, ne pas dupliquer les moteurs metier.
- SSOT metier: `packages/core` (`@primexpert/core`) pour finance, identite, transactions, CRM, messagerie, diffusion et marche.
- Conformite documentaire: conservation 6 ans, verrouillage des pieces finales, tracabilite.
- Validation humaine obligatoire sur les sorties IA importantes (prix, contenu publicitaire, interpretation de donnees).
- Multi-tenant strict: isolation par `orgId` et `courtiersResponsables`.

## 2) Regle linguistique Quebec (visible utilisateur)

- Ne pas afficher "audit" dans l'UI, libelles, boutons, rapports clients.
- Utiliser: verification, conformite, diligence, diligence raisonnable, preuves de conformite.
- Abreviations jamais seules a l'ecran.
- Format obligatoire: terme complet + (abreviation), ex. revenu net d'exploitation (RNE), taux de capitalisation (TGA), analyse comparative de marche (ACM).
- Les identifiants techniques internes peuvent rester en anglais si non exposes au client.

## 3) Architecture canonique

- Frontend: Vite + React (`src/`), UI institutionnelle via tokens `primexpert-*`.
- Core: `packages/core/src/*` (moteurs metier et view models).
- Backend: Firebase Functions Gen2 (`functions/src/*`), Firestore, Storage, Hosting.
- Projet Firebase: `primexpert-app-v2`.
- Hosting prod: <https://primexpert-app-v2.web.app>

### 3.1 Regles de separation

- Calculs metier hors React.
- React consomme des view models et services, n'implemente pas une logique metier parallele.
- Ecritures Firestore sensibles via fonctions de serialisation et patchs dedies (`offre`, identite, delais PA, etc.).

## 4) SSOT donnees (resumes)

### 4.1 CRM contacts

- Collection canonique: `organizations/{orgId}/contacts/{contactId}`.
- Interdit: recreer des collections paralleles `clients/`, `vendors/`, `buyerPipeline/`.
- Liens bidirectionnels:
  - `coBuyerIds` / `coSellerIds`
  - `residenceIds` <-> `residences.partiesImpliquees`
- Qualification acheteur aplatit en `buyerQualificationStatus`.

### 4.2 Fiche residence

- Document racine: `residences/{residenceId}` (identite, pipeline, parties, champs transverses).
- Sous-collection finances: `residences/{id}/financial/dataV2` (SSOT financier).
- Sous-collection documents: `residences/{id}/documents/{documentId}` (scan, parse, metadata).
- Sous-collections activites: `residences/{id}/notes`, `residences/{id}/tasks`.

### 4.3 Messagerie omnicanale

- SSOT unique: `users/{uid}/email_threads/{threadId}` + `messages/{messageId}`.
- Canaux: `email`, `sms`, `facebook`, `instagram`.
- Liaison CRM: `matchedContactId` sur thread + messages.
- `mailbox_analyses` est deprecie pour la production courante.

### 4.4 Marche (Big Data)

- Vault uploads: `market_documents/{docId}`.
- Sorties injectees:
  - `market_macro_stats/{fingerprint}`
  - `market_analytics_raw/{fingerprint}`
  - `marketSnapshots/v1`
- Anti-doublons obligatoire via empreintes deterministes (`set(..., { merge: true })`).

## 5) Modules Workhub (etat canonique)

- Mes inscriptions: pipeline 4 colonnes, DnD, filtres regions QC, badge conformite mandat.
- CRM: fiche unifiee, tiers acheteur/vendeur, pieces, chronologie.
- Fiche residence:
  - Synthese
  - Identite
  - Finances (5 sous-onglets)
  - Declaration vendeur
  - Marche (ACM)
  - Documents
  - Intelligence
  - Promesse d'achat
- Acces vendeur: route dediee + bouton depuis fiche residence.
- Messagerie: UI unique `MailboxContainer` + hub communication.
- Statistiques du marche: parse IA + validation humaine + injection idempotente.

## 6) Analyse comparative de marche (ACM) canonique

- Point d'entree fiche: onglet Marche.
- Bootstrap: `residenceAcmBootstrap.ts`.
- Donnees d'ancrage: `financial/dataV2.calculatedResults` + contexte territorial residence + donnees marche.
- TGA initial: mediane GPS region/classe.
- TGA editable par courtier avec recalcul en direct.
- Positionnement produit: opinion fondee et motivee, jamais valeur garantie.

## 7) Documents et IA (diligence)

- Upload categories: financier, technique, legal.
- Pipeline:
  1) upload
  2) scan
  3) parse IA (si eligible)
  4) reconciliation pending/failed
- Telechargement conditionnel: seulement si `virusScanStatus === 'clean'`.
- Vertex en production: auth ADC, pas de cle JSON hardcodee.

## 8) Billing et acces (Chérif)

- Etats: `active`, `grace_period`, `suspended`.
- Grace period: 72h apres echec de paiement.
- Ecran blocage en `suspended`.
- Exemption `admin_system`.
- Essai 45 jours: `trialStartDate`.

## 9) Deploiement canonique

```bash
cd "01_PRIMEXPERT_SYSTEME_APP_STABLE_V2"
npm run build
firebase deploy --only hosting
firebase deploy --only firestore:rules,storage:rules
cd functions && npm run build
FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions
```

## 10) Priorites ouvertes (canon court terme)

- Deployer completement les webhooks SMS/Meta + secrets de prod.
- Finaliser VoIP production (allocation, controles et observabilite).
- Completer maillons migration legacy restants (residences, finance detaillee, documents).
- Consolider cron relances J30/J40 et webhooks Stripe prod.
- Poursuivre verrouillage coffre 6 ans selon exigences reglementaires.

---

Derniere consolidation: 2026-05-28.
