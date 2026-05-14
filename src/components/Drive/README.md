# Drive PrimeXpert

Brief « SYSTÈME SILOS 2026 v4 » §4 — Innovation majeure.

## 🎯 Mission

Gestionnaire de documents type Google Drive, intégré nativement dans l'interface Workhub, avec :

- Classement automatique par résidence
- Lecture + extraction IA immédiate des fichiers déposés
- Multi-tenant : isolation par `brokerId`

## 📂 Structure cible

### Firebase Storage

```
primexpert/
  {brokerId}/
    residences/
      {residenceId}/
        DV-2026-01-15.pdf
        contrat-courtage.pdf
        etats-financiers-2025.pdf
        ...
```

### Firestore (métadonnées + audit IA)

Collection `drive_documents` :

| Champ | Type | Note |
|---|---|---|
| `brokerId` | string | Tenant — filtré via `@primexpert/core/tenant` |
| `residenceId` | string | Référence résidence |
| `fileName` | string | Nom original |
| `storagePath` | string | Chemin complet Storage |
| `mime` | string | `application/pdf`, `image/png`, etc. |
| `size` | number | Octets |
| `uploadedAt` | Timestamp | Date dépôt |
| `uploadedBy` | string | UID utilisateur |
| `documentType` | string | DV / Contrat / EF / Photo / Autre (extraction IA) |
| `extractedText` | string | Texte brut (OCR si scan) |
| `extractedFields` | map | Champs canoniques détectés (`@primexpert/core/canonical`) |
| `aiInsights` | map | Insights IA (risques, alertes, score) |
| `status` | enum | `pending` / `processing` / `ready` / `failed` |
| `auditLog` | array | Historique des accès (OACIQ — 6 ans) |

## 🛣️ Roadmap

| Phase | Livrable |
|---|---|
| **A** (actuelle) | ✅ Squelette UI (`Drive.tsx`) + spec |
| **B** | Branchement Firebase Storage + upload basique + grid documents |
| **C** | Pipeline extraction IA via Cloud Function (réemploi `functions-ai` V1) |
| **D** | Audit log immuable + conservation 6 ans OACIQ |
| **E** | Recherche full-text + filtres par type / résidence / date |

## 🔒 Sécurité

- **Firestore Security Rules** : `request.auth.uid == resource.data.brokerId`
- **Storage Security Rules** : `request.auth.uid == request.resource.metadata.brokerId`
- **Audit log Firestore** : append-only (Cloud Function gardien)
- **Pas d'accès cross-tenant** — Charte §IV (Zéro Communication Directe sans approbation)
