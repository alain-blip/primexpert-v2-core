# Checklist predeploiement production — Primexpert V2

Objectif: reduire le risque fonctionnel, conformite et exploitation avant tout deploiement sur `primexpert-app-v2`.

---

## 1) Gate fonctionnelle (produit)

- [ ] Workhub charge sans erreur sur les modules critiques: Inscriptions, CRM, Fiche residence, Messagerie, Statistiques du marche.
- [ ] Fiche residence: chargement valide des onglets actifs et des providers (`FinancialDataProvider`, `ResidenceDocumentProvider`).
- [ ] Pipeline Mes inscriptions: transitions autorisees, blocage des transitions interdites (ex. vers promesse sans prix accepte).
- [ ] Promesse d'achat: ecriture `offre` complete, pas d'effacement de sous-sections en merge.
- [ ] Documents diligence: upload, scan, parse, etat final coherent (clean/completed ou failed avec message).
- [ ] Messagerie: fils et messages visibles, liaison CRM manuelle/auto fonctionnelle.

## 2) Gate conformite metier

- [ ] Libelles visibles utilisateur: pas de mot "audit".
- [ ] Abreviations UI affichees en format complet + (abreviation).
- [ ] Mention legale et bloc signature conformes sur sorties marketing/courriel.
- [ ] Validation humaine conservee sur sorties IA critiques (prix, contenu, interpretation).
- [ ] Regles de conservation et verrouillage documentaire non regressees.

## 3) Gate donnees et SSOT

- [ ] Aucun nouveau moteur metier duplique dans React hors `@primexpert/core`.
- [ ] Aucune nouvelle collection parallele CRM hors `organizations/{orgId}/contacts`.
- [ ] Messagerie conservee en SSOT `users/{uid}/email_threads/messages`.
- [ ] `mailbox_analyses` non utilise comme source courante.
- [ ] Ecritures identite et promesse utilisent les utilitaires/patterns etablis (serialisation/patch).

## 4) Gate securite et acces

- [ ] `firestore.rules` et `storage.rules` valident les cas multi-tenant attendus.
- [ ] Donnees inter-organisation non accessibles sans autorisation.
- [ ] Fonctions sensibles protegees (auth context, verifications d'entree).
- [ ] Webhooks verifies (signature Nylas/Twilio/Meta selon flux deploye).
- [ ] Aucune cle secrete committee dans le repo.

## 5) Gate IA et traitements lourds

- [ ] Vertex ADC operationnel en production (pas de cle JSON locale forcee).
- [ ] Region/modeles verifies pour parse documents.
- [ ] Parse PDF massif marche passe dans les limites memoire/timeout configurees.
- [ ] Flux idempotent d'injection marche valide (merge par fingerprint).
- [ ] En cas echec parse, reprise/reconciliation et messages utilisateur adequats.

## 6) Gate operations Firebase

- [ ] `npm run build` front sans erreur.
- [ ] `cd functions && npm run build` sans erreur.
- [ ] Index Firestore requis presentes et deployables.
- [ ] Deploiement planifie par lot: hosting, rules/indexes, functions, storage.
- [ ] Fallback et rollback connus (version precedente accessible).

## 7) Secrets, variables et dependances

- [ ] Secrets requis presents en environnement:
  - [ ] `NYLAS_API_KEY`
  - [ ] `NYLAS_CLIENT_ID`
  - [ ] `NYLAS_CLIENT_SECRET`
  - [ ] `NYLAS_WEBHOOK_SECRET`
  - [ ] `TWILIO_AUTH_TOKEN` (si SMS/VoIP)
  - [ ] `META_VERIFY_TOKEN` (si Meta)
  - [ ] `GEMINI_API_KEY` ou ADC selon fonction cible
- [ ] Variables client `VITE_*` minimales en place (support/nurture si active).
- [ ] Versions npm verrouillees et install propres.

## 8) Tests de fumee post-deploiement (obligatoire)

- [ ] Connexion utilisateur standard + admin_system.
- [ ] Ouverture d'une fiche residence existante avec donnees finance.
- [ ] Upload d'un document financier test et verification des statuts.
- [ ] Envoi/reception d'un message dans la messagerie (ou simulation).
- [ ] Chargement d'un document marche et verification extraction/injection.
- [ ] Verifier l'absence d'erreurs console bloquantes sur les ecrans critiques.

## 9) Commandes recommandees

```bash
cd "01_PRIMEXPERT_SYSTEME_APP_STABLE_V2"
npm run build
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
cd functions && npm run build
FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions
```

## 10) Decision Go / No-Go

- GO seulement si toutes les gates critiques (1 a 6) sont vertes.
- Si une gate critique est rouge: No-Go, correction, revalidation complete.

---

Version initiale: 2026-05-28.
