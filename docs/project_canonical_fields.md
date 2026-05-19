# Dictionnaire canonique — données Primexpert V2

Aligné sur `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2`.  
Les champs **serveur** (`billingStatus`, `gracePeriodStartedAt`) ne sont **pas** modifiables par le client (absents de `users` `allow update` dans `firestore.rules`).

Référence alias / provenance : `packages/core/src/canonical/`.  
**Identité Phase 4 (lecture + écriture)** : `packages/core/src/identity/` — définitions UI dans `identitySections.ts`, `buildingAuditSections.ts`, `servicesRecognition.ts`, `rentPricingGrid.ts`.

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
| **`trialStartDate`** | Timestamp ou `yyyy-mm-dd` | — | Début essai **45 jours** |
| **`billingStatus`** | string | `active` \| `grace_period` \| `suspended` | Chérif — **écrit serveur** |
| **`gracePeriodStartedAt`** | Timestamp / ISO | — | Début **72 h** de grâce — **écrit serveur** |
| **`lastEmailSent`** | string \| null | `J7` \| `J21` \| `J30` \| `J40` \| null | Relance onboarding |
| `accessibleSilos` | array | `RPA`, `CPE`, `PLEX` | RBAC silos Radar |
| `licenseName`, `title`, `agency` | string | optionnel | Profil OACIQ |
| `firstName`, `lastName`, `phone` | string | optionnel | Profil |
| **`j7Survey`** | map | — | Réponses enquête J+7 |
| **`emailAccounts`** | array / map | — | Comptes Nylas liés (messagerie) |

### Abonnement (démo / à migrer Stripe)

| Champ | Type | Description |
|--------|------|-------------|
| `hasPaymentMethod` | bool | Carte enregistrée |
| `planId` | string | `solo`, `pro`, `pro_plus`, … |
| `isAffiliated` | bool | Affilié Prisma |
| `billingCycle` | string | `annual` \| `monthly` |

### Sous-collections `users/{uid}/…`

| Chemin | Usage |
|--------|--------|
| `mailbox_analyses/{messageId}` | Analyse IA courriel (E-2), `matchedResidenceId` |
| `call_analyses/{driveDocumentId}` | Transcription appel (E-3), `residenceId`, `pipelineStatus` |
| `email_threads/{threadId}/messages/{messageId}` | Messagerie synchronisée Nylas |

---

## Collection `residences/{residenceId}`

Document racine — **SSOT onglet Identité** (`ResidenceDocumentContext`) + Radar + prix affiché.  
Écriture Phase 4b : `updateDoc` sur ce document (pas de sous-collection identité).

### Champs racine — multi-tenant & pipeline

| Champ | Type | Description |
|--------|------|-------------|
| **`courtiersResponsables`** | string | **UID courtier propriétaire** (clé multi-tenant) |
| `address`, `city` | string | Adresse affichée |
| `price` / `prixDemande` | number | Prix demandé (priorité finance V2) |
| `askingPrice` | number | Alias / miroir prix demandé (cartes inscriptions, Synthèse) |
| **`residenceName`**, `commercialName`, `nomCommercial`, `nom_commercial`, `name` | string | Nom commercial affiché (cartes inscriptions, mapping `mapCommercialName`) |
| **`commissionRate`**, `tauxCommission`, `commissionPct` | number | Taux commission (%) — lecture UI rétribution / inscriptions |
| **`potentialRevenue`**, `revenuPotentiel`, … | number | Revenu potentiel affiché si présent ; sinon dérivé `prix × taux` côté affichage |
| **`status`** | string | `prospect`, `mandate`, `promise`, `expired`, `unsigned`, `sold` — **ne pas renommer** |
| `assetNiche` | string | `RPA` \| `CPE` \| `PLEX` |
| `propertyType` | string | `rpa`, `cpe`, `plex`, `commercial` |
| `date` | string | Date inscription / mandat (UI) |

### Champs racine — établissement (section « Identification »)

| Champ | Type | Description |
|--------|------|-------------|
| `name` | string | Nom commercial |
| `numeroCertification` | string | Numéro de certification |
| `residenceType` | string | Type de résidence |
| `categorieRPA` | string | Catégorie RPA (également affichée dans Services) |
| `dateOuverture` | string / date | Date d'ouverture |
| `telephone`, `courriel`, `siteWeb` | string | Coordonnées |

### Champs racine — structure juridique (plats + imbriqués)

| Champ | Type | Description |
|--------|------|-------------|
| `raisonSociale` | string | Raison sociale |
| `formeJuridique` | string | Forme juridique |
| `neq` | string | NEQ |
| `dateConstitution` | string / date | Date de constitution |
| `historiqueFusionREQ` | string | Historique fusion REQ |
| `trancheSalariesREQ` | string | Tranche salariés REQ |
| **`administrateursREQ`** | array \| string | **Administrateurs issus du REQ** — liste d'objets `{ nom, fonction?, … }` ou texte sérialisé selon migration |
| `administrateursMSSS` | array | Administrateurs (registre MSSS) — distinct du REQ |
| `actionnaires` | array | Actionnaires `{ nom, pourcentage?, … }` |
| **`structureJuridique`** | map | Sous-bloc juridique imbriqué (voir ci-dessous) |

#### Objet `structureJuridique`

| Clé | Type | Description |
|-----|------|-------------|
| `administrateursREQ` | array | Copie ou source canonique des administrateurs REQ |
| **`confirmedBy`** | string | `"user"` après édition manuelle courtier — **coupe le badge Raphaël ✨** sur les champs de ce bloc |

> Lecture UI : priorité `administrateursREQ` racine, puis `structureJuridique.administrateursREQ`, alias `administrateurs` / `administrateursRegistre`.

> Le type Firestore inclut encore `expired` pour l’héritage et les filtres ; le **pipeline Kanban « chaud »** (`PIPELINE_ACTIVE_STATUSES` côté app) exclut `expired` des quatre colonnes actives.

### Bâtiment — 5 silos de vérification identité (sous-objets Firestore)

Chaque silo est un **map** sur le document racine. Les champs peuvent aussi exister en **racine** (legacy Copilote / alias) ; l'UI résout via `resolveIdentityField()` et `getResidenceField()`.

#### Silo 1 — `cadastre` (Cadastre et évaluation municipale)

| Clé | Type | Description |
|-----|------|-------------|
| `evaluationTerrain` | number | Évaluation terrain ($) |
| `evaluationBatiment` | number | Évaluation bâtiment ($) |
| **`confirmedBy`** | string | `"user"` — confirmation bloc cadastre |

| Champ racine (miroir) | Type | Description |
|----------------------|------|-------------|
| `lotsCadastraux` | string | Lots cadastraux |
| `superficieTerrain` | number | Superficie terrain (m²) |
| `evaluationFonciere` | number | Évaluation foncière totale ($) |

#### Silo 2 — `validationJLR` (Validation croisée — évaluation & JLR)

| Clé | Type | Description |
|-----|------|-------------|
| `valeurMarche` | number | Valeur marché JLR ($) |
| `comparatif` | string | Comparatif / dossier JLR |
| `historique` | string | Historique des évaluations JLR |
| `ecartPct` | number | Écart évaluation / JLR (%) |
| **`confirmedBy`** | string | `"user"` — confirmation bloc JLR |

| Champ racine (miroir) | Type | Description |
|----------------------|------|-------------|
| `valeurMarcheJLR` | number | Alias valeur marché |
| `comparatifJLR` | string | Alias comparatif |
| `historiqueEvaluationsJLR` | string | Alias historique |
| `ecartEvaluationPct` | number | Alias écart % |

#### Silo 3 — `immeuble` (Structure du bâtiment + installations techniques)

Un seul objet partagé pour **structure** et **installations** (deux blocs UI, même `confirmedBy`).

| Clé | Type | Description |
|-----|------|-------------|
| `constructionType` | string | Type de structure |
| `toiture` | string | Toiture |
| `generatrice` | boolean \| string | Génératrice de secours |
| `systemeMecanique` | string | Système mécanique |
| **`confirmedBy`** | string | `"user"` — confirmation bloc immeuble |

| Champ racine (miroir) | Type | Description |
|----------------------|------|-------------|
| `anneeConstruction` | number | Année de construction |
| `nombreEtages` | number | Nombre d'étages |
| `superficieBatiment` | number | Superficie bâtiment (m²) |
| `typeToiture` | string | Alias toiture |
| `ascenseur` | boolean | Ascenseur (Oui/Non) |
| `nombreAscenseurs` | number | Nombre d'ascenseurs |
| `climatisation` | string | Climatisation |
| `mitigeursEauChaude` | string | Mitigeurs eau chaude |
| `historiqueInvestissementsPermis` | string | Historique investissements / permis |
| `systemeGicleurs`, `giclee`, `sprinklers` | bool / string | Gicleurs (sécurité peut aussi utiliser racine) |

#### Silo 4 — `securite` (Sécurité)

| Clé | Type | Description |
|-----|------|-------------|
| `alarmeIncendie` | string | Alarme incendie |
| `conformiteIncendie` | string | Conformité incendie |
| `alarmeIntrusion` | string | Alarme intrusion |
| **`confirmedBy`** | string | `"user"` — confirmation bloc sécurité |

| Champ racine (miroir) | Type | Description |
|----------------------|------|-------------|
| `systemeGicleurs` | boolean \| string | Système de gicleurs |

### Tableaux spécialisés Phase 4

#### Objet `servicesReconnaissance` (Services & Reconnaissance)

| Clé | Type | Description |
|-----|------|-------------|
| `numeroRQRA` | string | Numéro RQRA |
| `niveauSoins` | string | Niveau de soins |
| **`servicesActifs`** | array\<string\> | **IDs de services actifs** : `repas`, `soins`, `hebergement`, `animation`, `entretienMenager`, `blanchisserie`, `transport`, `soinsInfirmiers` |
| **`confirmedBy`** | string | `"user"` après édition manuelle |

| Champ racine (legacy) | Type | Description |
|----------------------|------|-------------|
| `servicesOfferts` | array | Ancien format — lu en secours |
| `servicesActifs` | array | Ancien format racine |

> `categorieRPA` reste un champ racine canonique ; recopié dans l'UI Services.

#### Objet `tarificationLoyers` (Tarification des loyers)

| Clé | Type | Description |
|-----|------|-------------|
| **`rows`** | map | Une entrée par type d'unité (clés **fixes** ci-dessous) |
| **`confirmedBy`** | string | `"user"` après édition manuelle du tableau |

Chaque entrée de `rows.{typeKey}` :

| Clé | Type | Description |
|-----|------|-------------|
| `qty` | number | Quantité d'unités |
| `occupationPct` | number | Taux d'occupation (0–100) |
| `loyerMoyen` | number | Loyer mensuel moyen ($) |

**Clés `typeKey` autorisées dans `rows` :**

| `typeKey` | Sync champ racine (`qty`) |
|-----------|---------------------------|
| `studios` | `nombreStudios` |
| `chambresSimples` | `nombreChambresSimples` |
| `chambresDoubles` | `nombreChambresDoubles` |
| `deuxDemie` | `nombre2demie` |
| `troisDemie` | `nombre3demie` |
| `quatreDemie` | `nombre4demie` |
| `unitesSoins` | `nombreUnitesSoins` |

**Revenu potentiel annuel (dérivé, non stocké obligatoire)** :  
`qty × (occupationPct / 100) × loyerMoyen × 12` — calculé dans `@primexpert/core/identity/rentPricingGrid.ts`.

**Fail-safe finance** : si `financial/dataV2.baseData.revenusAnnuels` est absent, `normalizeFinancialData()` peut dériver le RBE depuis la somme des revenus potentiels du tableau (`deriveRevenusAnnuelsFromTarification()`).

**IDs d'édition UI (Phase 4b)** : `rent-{typeKey}-qty` \| `occupation` \| `loyer` (ex. `rent-troisDemie-loyer`).

### Effectifs & clientèle (complément identité)

| Champ | Type | Description |
|--------|------|-------------|
| `effectifs` | map | `jourSemaine`, `jourFinSemaine`, `soir`, `nuit` + `confirmedBy` |
| `clientele` | map | `ageDistribution`, etc. + `confirmedBy` |
| `nombreUnitesTotal`, `tauxOccupation` | number | Agrégats capacité |

### Enrichissement MSSS & déclaration vendeur

| Champ | Type | Description |
|--------|------|-------------|
| **`msssEnrichment`** | map | `lastEnriched`, `source`, `numeroRegistre`, `detailsScraped`, `confidence` — **prérequis badge Raphaël ✨** |
| **`declarationVendeur`** | map | Phase 5 — `status` (`draft` \| `lock`), `answers`, `certifiedAt`, `certifiedBy` |

---

## Gestion des confirmations humaines & Badge Raphaël ✨

Règle produit : **l'humain a préséance sur l'IA**. Tant qu'un champ MSSS n'est pas confirmé par le courtier, le badge ✨ peut s'afficher si `msssEnrichment` est présent.

### Mécanisme A — `confirmedBy` sur le sous-bloc parent

Lors d'une sauvegarde au **blur** (Phase 4b), si `msssEnrichment` existe, le patch Firestore positionne **`confirmedBy: "user"`** sur le map parent :

| Sous-objet parent | Déclencheur (exemples de champs édités) |
|-------------------|----------------------------------------|
| `structureJuridique` | `administrateursREQ` |
| `cadastre` | `evaluationTerrain`, `evaluationBatiment` |
| `validationJLR` | `valeurMarche`, `comparatif`, `historique`, `ecartPct` |
| `immeuble` | `constructionType`, `toiture`, `generatrice`, `systemeMecanique` |
| `securite` | `alarmeIncendie`, `conformiteIncendie`, `alarmeIntrusion` |
| `servicesReconnaissance` | `numeroRQRA`, `niveauSoins`, toggle `servicesActifs` |
| `tarificationLoyers` | toute cellule `rows.*` |
| `effectifs` | effectifs par quart |

Effet : **tous les champs** du bloc partageant ce parent perdent le badge ✨ (lecture via `parent.confirmedBy === "user"`).

### Mécanisme B — `identityConfirmations` (champs racine)

Pour les champs **sans** `confirmedPath` imbriqué (ex. `neq`, `lotsCadastraux`, `anneeConstruction`, cellules `rent-*`) :

```typescript
identityConfirmations: {
  [fieldId: string]: {
    confirmedBy: "user",
    confirmedAt: string  // ISO 8601
  }
}
```

| Exemple `fieldId` | Contexte |
|-------------------|----------|
| `neq` | Champ juridique racine |
| `rent-troisDemie-loyer` | Cellule tarification |
| `service-badge-repas` | Toggle puce service |

Effet : `shouldShowRaphaelForField()` retourne `false` pour ce `fieldId` précis.

### Code de référence

| Sujet | Fichier |
|--------|---------|
| Logique badge | `packages/core/src/identity/msssRaphaelBadge.ts` |
| Patches blur | `packages/core/src/identity/identityFieldWrite.ts`, `rentPricingGrid.ts` |

---

## Sous-collection `residences/{id}/financial/dataV2`

**SSOT financier** — listener `FinancialDataContext`.

| Bloc | Contenu |
|------|---------|
| `calculatedResults` | RBE, RNE, DSCR, emprunt max, facteurs, prix, confiance… (`FinancialCalc`) |
| `baseData` | `revenusAnnuels`, `nombreUnites`, `depenses` (grille par clé `EXPENSE_KEYS`), `financement` |
| `derivedData` | Champs dérivés / legacy |
| `lastUpdated` | Timestamp (provenance UI `ProvenanceStrip`) |

Normalisation : `normalizeFinancialData()` → source `calculatedResults` | `derivedData` | `none`, avec **fail-safe RBE** depuis `tarificationLoyers` si revenus absents.

### Sous-collection `residences/{id}/documents/{documentId}`

**SSOT Espace Documents** — UI `DocumentsDiligenceTab`, listener temps réel par fiche.

| Champ | Type | Valeurs / format | Description |
|--------|------|------------------|-------------|
| `propertyId` | string | — | ID fiche (redondant, filtrage) |
| `category` | string | `financier` \| `technique` \| `legal` | Dossier diligence |
| `fileName` | string | — | Nom fichier affiché |
| `storagePath` | string | — | Chemin Storage canonique (voir ci-dessous) |
| `mimeType` | string | — | `application/pdf`, XLSX, DOCX, … |
| `sizeBytes` | number | — | Taille octets |
| `uploadedAtMillis` | number | — | Horodatage téléversement |
| `uploadedBy` | string | UID | Courtier ayant téléversé |
| **`virusScanStatus`** | string | `pending` \| `clean` \| `infected` | Scan format serveur (callable `propertyDocumentScanDocument`) |
| **`parsingStatus`** | string | `not_applicable` \| `pending` \| `completed` \| `failed` | Parse IA (dossier Financier + `clean` uniquement) |
| **`parsingEligible`** | boolean | — | `true` si PDF/tableur Financier éligible au parseur |
| **`extractedData`** | map | — | JSON structuré Vertex : `amounts`, `dates`, `taxes`, `revenus`, `depenses`, `annee` |
| `parsedAtMillis` | number | optionnel | Fin d’analyse IA |
| **`parsingError`** | string | optionnel | Message d’échec (tronqué 500 car.) si `failed` |

#### Chemins Storage

| Schéma | Usage |
|--------|--------|
| **`primexpert/{brokerId}/properties/{propertyId}/documents/{category}/{fileName}`** | Canonique — écriture courtier (`brokerId === auth.uid`) |
| `properties/{propertyId}/documents/…` | Legacy Copilote — **lecture seule** (`storage.rules`) |

#### Pipeline document (Financier)

```text
Upload client → virusScanStatus: pending
    → propertyDocumentScanDocument → clean | infected
    → si financier + clean → parsingStatus: pending
    → propertyDocumentParseIA (Vertex gemini-2.0-flash-001)
    → completed + extractedData | failed + parsingError
```

Téléchargement client : autorisé **uniquement** si `virusScanStatus === 'clean'`.

---

## Collection `email_outbox/{outboxId}`

| Champ | Description |
|--------|-------------|
| `userId` | Courtier destinataire |
| `status` | `pending` (création client) |
| Template / type | J7 alerte support, J21 nurture, etc. |

---

## Collections connexes

| Collection | Tenant | Usage |
|------------|--------|--------|
| `proprietes/{id}` | `courtiersResponsables` | Dossiers Copilote migrés (Phase 2) |
| `drive_documents/{id}` | `courtiersResponsables` | Drive OACIQ — **delete interdit** |
| `organizations/{orgId}` | `orgId` | Agence |

---

## Fichiers code correspondants

| Sujet | Fichier |
|--------|---------|
| Profil + essai | `src/lib/auth.tsx` |
| Garde suspension | `src/lib/billingAccess.ts`, `src/App.tsx` |
| Écran blocage | `src/components/SuspendedAccountScreen.tsx` |
| Bandeau 72 h | `src/components/GracePeriodBanner.tsx` |
| Résidences multi-tenant | `src/services/residences.ts`, `@primexpert/core/tenant` |
| Listener finance | `src/context/FinancialDataContext.tsx` |
| Listener identité + écriture | `src/context/ResidenceDocumentContext.tsx` |
| View model identité | `packages/core/src/identity/buildIdentityViewModel.ts` |
| Sections juridique / établissement | `packages/core/src/identity/identitySections.ts` |
| 5 silos bâtiment | `packages/core/src/identity/buildingAuditSections.ts` |
| Services & puces | `packages/core/src/identity/servicesRecognition.ts` |
| Tarification loyers | `packages/core/src/identity/rentPricingGrid.ts` |
| Patches Firestore blur | `packages/core/src/identity/identityFieldWrite.ts` |
| Déclaration vendeur | `packages/core/src/declaration/` |
| View models finance | `packages/core/src/financial/*.ts` |
| Documents diligence | `src/types/propertyDocument.ts`, `src/services/propertyDocumentsService.ts` |
| Validation / pipeline docs | `src/lib/propertyDocumentValidation.ts`, `propertyDocumentPipeline.ts`, `propertyDocumentTaxonomy.ts` |
| Parse IA serveur | `functions/src/documents/parsePropertyDocument.ts`, `geminiExtract.ts`, `documentTaxonomy.ts` |
| Envoi sélection documents | `functions/src/emails/sendDocumentSelection.ts` |
| Vertex ADC | `functions/src/services/vertexClient.ts` |
| Priorités dashboard | `packages/core/src/intelligence/dashboardPriorityFollowUp.ts` |
| Taxes + PDF | `src/lib/quebecInvoiceTax.ts`, `src/services/invoicePdfService.ts` |
| Règles Firestore / Storage | `firestore.rules`, `storage.rules` |
| Inscriptions & cartes | `src/components/Listings.tsx`, `ListingInstitutionalCard.tsx`, `listingCardViewModel.ts` |
| Synthèse 360 | `src/components/residence/tabs/Synthese360Tab.tsx` |

---

## Sous-collection `residences/{id}/notes/{noteId}`

Notes courtier (diligence) — écoute temps réel dans l’onglet Synthèse ; tri `orderBy('createdAt', 'desc')`.

| Champ | Type | Description |
|--------|------|-------------|
| `text` | string | Contenu de la note |
| `authorId` | string | UID Firebase |
| `authorName` | string | optionnel — affichage |
| `createdAt` | Timestamp | Création |
| `updatedAt` | Timestamp | optionnel — édition |

Lors de l’ajout d’une note : mise à jour document racine `lastCommunicationAt`, `lastCommunicationType: 'note'`, `updatedAt`.

---

*Dernière mise à jour : 2026-05-19 — Champs rétribution / nom commercial, notes courtier, pipeline Kanban vs `expired`, taxonomie documents.*
