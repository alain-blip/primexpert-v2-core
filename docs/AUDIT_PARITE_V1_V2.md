# Audit comparatif V1 → V2 — Parité fonctionnelle et architecturale

**Date :** 2026-05-20  
**Périmètre :**  
- **V1 :** `/Volumes/SAUVEGARDE GRIS/00_RPA_SYSTEME_APP` (Copilote-RPA + copilote-core-services)  
- **V2 :** `/Volumes/SAUVEGARDE GRIS/01_PRIMEXPERT_SYSTEME_APP_STABLE_V2` (Primexpert monorepo)

**Contexte PO :** Valider la parité avant le chantier **analyse comparative de marché (ACM)**.

---

## Verdict global

| Dimension | Évaluation |
|-----------|------------|
| **Architecture** | V2 nettement supérieure — SSOT `@primexpert/core`, séparation UI / logique, multi-silo (RPA/CPE/PLEX) |
| **Cœur financier (RBE, RNE, TGA, RDE, DSCR, SCHL)** | **Parité élevée** — moteurs portés et enrichis dans `packages/core` |
| **Hub Finance résidence** | **Parité partielle** — 5 sous-onglets vs 6 en V1 ; PDF partiellement branchés |
| **Marché / comparables / ACM** | **Écart majeur** — V2 a le moteur de valorisation mais pas le workflow comparables complet de V1 |
| **CRM / ops / campagnes** | **Non reprise** — V1 reste le système « full CRM » ; V2 est un cockpit broker ciblé |
| **Exports & partage** | **Régression** — plusieurs livrables PDF V1 absents ou en placeholder |

**Conclusion :** La V2 est **solide sur le plan architectural et mathématique du cœur RPA**, mais **n’atteint pas la parité fonctionnelle globale** de la V1. Avant le module ACM, il faut réintégrer en priorité le **flux comparables**, l’**ajustement TGA pénétration**, les **PDF vendeur/banque**, et la **vérification EEE bancaire** — sans réimporter le bruit legacy de V1.

---

## 1. Fonctionnalités manquantes dans la V2 — à réintégrer d’urgence

### 1.1 Priorité CRITIQUE (bloquant ACM / mandat PO)

| Fonctionnalité V1 | Emplacement V1 | État V2 | Action recommandée |
|-------------------|----------------|---------|-------------------|
| **Import / export comparables CSV** (modèle CoStar/Centris, validation doublons) | `pages/MarketDashboard.jsx`, `utils/gpsComparablesImport.js` | Absent (`MarketLibraryDashboard` = coffre Big Data, pas grille comparables) | Porter le flux CSV + modal de validation dans le module ACM / Stats marché |
| **Import PDF comparables** (extraction + réconciliation) | `DataExtractionModal.jsx`, `functions-ai/extractionV2IA.js` | Extraction serveur existe (`geminiExtract.ts`, `parseMarketDocument.ts`) mais **pas de modal UI résidence** | Brancher une modale HITL sur fiche résidence + lien vers `market_analytics_raw` |
| **Ajustement TGA pénétration + taille** (+75/+50/+25 bps) | `domain/valuation/penetrationTgaAdjustment.ts` | Fichier **porté** (`packages/core/src/valuation/penetrationTgaAdjustment.ts`) mais **non exporté** ni appelé UI | Exporter depuis `valuation/index.ts` ; appliquer dans `ACM.tsx`, `AcmTab`, `calculateValuation` |
| **PDF analyse vendeur & stratégie mise en marché** | `utils/generateFinancialAnalysis.js` → `FinancialReportsSection.jsx` | `FinancialReportsSection.tsx` = **placeholder texte** ; seuls certifiable + acheteur dans `FinanceHubMasterPanel` | Réactiver le rapport vendeur (jsPDF ou CraftMyPDF) ; retirer le placeholder du Bilan |
| **Panneau vérification EEE / réserve capex bancaire** | `FinancialAuditEeePanel.jsx`, `financialAuditEee.js` | Logique partielle (`CAPEX_RESERVE` dans `normalizationSuggestions.ts`) — **pas de panneau UI** | Porter `computeFinancialAuditEee` en core + onglet ou section Finançabilité |
| **Scénarios stress / what-if / price strategy** | `copilote-core-services/domain/valuation/stressTest.ts`, `whatIf.ts`, `priceStrategy.ts` | **Absents** de `packages/core` | Porter les 3 modules avant ACM avancé (fourchette valeur, scénarios occupation) |

### 1.2 Priorité HAUTE (parité dossier résidence)

| Fonctionnalité V1 | État V2 |
|-------------------|---------|
| **Export dataset audience** (INTERNAL / BANK / BUYER) + lien sécurisé | `buildExportDataset.ts` en core + tests — **aucun trigger UI**, pas de `SharePage` |
| **PDF teaser acheteur, rapport visite, synthèse prix, fiche/portrait résidence** | Absents |
| **Valuation Pack / JVM Calculator** (`JvmCalculatorSection`, `ValuationPackButton`) | Absents |
| **Actions vs actifs** (sous-onglet Finance) | Absent — remplacé partiellement par **Ratios performance** (gain net, pas équivalent) |
| **Stratégie fiscale** (`FiscalStrategyPanel`) | Absent |
| **Zonage & conformité / vigilance stratégique** (`AnalyseChatTab`, `VigilanceStrategiquePanel`) | Absent |
| **Onglets identité éclatés** (Capacité, Unités/revenus, Loyers/services, Localisation, Notes) | **Consolidés** dans `IdentiteImmeubleTab` — vérifier que tous les champs éditables sont présents |
| **Transaction dédiée** (`TransactionTab`) | Absorbé dans Synthèse / Promesse — valider champs vendeur/acheteur/date |

### 1.3 Priorité MOYENNE (écosystème CRM — hors ACM immédiat)

Modules V1 **non repris** en V2 (décision produit probable, pas des oublis techniques isolés) :

- Campagnes email (`/campagnes/*`)
- Hot leads, Deal scoring, Compliance guardian
- Calendrier, AI Agent, Raphael practice (`/raphael`, call simulator)
- Buyer dashboard (`/buyer-dashboard/:id`)
- Portail propriétaire complet (`ResidenceOwnerPortal` ~4 300 lignes) vs `AccesVendeurPage` amorcé
- Admin : ingestion, MSSS scraper, monitoring, fusion doublons
- Brochure generator, scripts courriel, design system page
- Dashboard GPS cockpit (`DashboardGPS.jsx`) vs `Dashboard.tsx` V2 (KPIs différents)

### 1.4 Exports — matrice comparative

| Export | V1 | V2 |
|--------|----|----|
| Rapport certifiable / financier broker | jsPDF | ✅ `certifiableReportPdfService.ts` |
| Dossier acheteur détaillé | jsPDF | ✅ `buyerReportPdfService.ts` (CraftMyPDF) |
| Analyse vendeur mise en marché | ✅ `generateFinancialAnalysis.js` | ❌ Placeholder |
| Présentation ACM PDF | Partiel V1 | ✅ `AcmTab.tsx` + `acmPresentationPdfService.ts` |
| Déclaration vendeur PDF | ✅ | ✅ `vendorDeclarationPdf.ts` |
| CSV comparables GPS | ✅ `MarketDashboard` | ❌ |
| Partage sécurisé PDF (`/share/:id`) | ✅ | ❌ |
| Excel export rapports | Import seulement | Import seulement (rejet IA parsing) |

---

## 2. Différences de logique mathématique

### 2.1 Parité confirmée (portage réussi)

| Domaine | V1 | V2 | Notes |
|---------|----|----|-------|
| **Normalisation financière** | `normalizeFinancialData.js` | `packages/core/src/financial/normalizeFinancialData.ts` | Mêmes primitives : `normalizedOperatingAmount`, `getAuditNormalizedNoi`, `computeReconciliationAudit` ; V2 ajoute `sumRpaAncillaryRevenues` |
| **Moteur valorisation** | `domain/valuation/valuationEngine.ts` v2.1.0 | Idem dans `packages/core` | 60 % revenu (TGA) + 40 % comparaison (MRB) ; plafond DSCR/LTV |
| **TGA marché / comparables** | `marketCapRate.ts`, `comparableBenchmarks.ts` | Portés | `selectMarketCapRate`, `computeComparableBenchmarks` |
| **TGA prêteur ajusté** | `lenderCapRate.ts` | Porté | Ajustements performance + risque |
| **Manque à gagner 360°** | `financialOptimization360.js` | `financialOptimization360.ts` | `computePerformanceAudit360` — UI dans `Analyse360FinanceTab.tsx` |
| **Benchmark portefeuille** | Callable `getGlobalFinancialBenchmark` | ✅ Porté | Hook `useGlobalFinancialBenchmark` dans Revenus & Dépenses |
| **Finançabilité SCHL** | `financialRules.js`, onglet Finançabilité | `schlMultilogementRules.ts`, `computeFinancabilite.ts` | Parité APH Select |
| **RDE GPS régional** | Agrégats marché V1 | `marketGpsViewModel.ts` + correctif `marketDataNormalize.ts` | Corrigé récemment ($/unité, plafond 100 %) |

### 2.2 Écarts mathématiques à combler

| Logique V1 | V2 | Impact |
|------------|-----|--------|
| **`computeFinancialAuditEee`** — réserve 500 $/unité, DSCR-linked, scan `autresDepenses` | Suggestion `CAPEX_RESERVE` seulement dans normalisation | Banques / comité crédit : lecture EEE incomplète |
| **`computeTgaAdjustment`** (pénétration RPA + taille) | Code présent, **non branché** | Sous-estimation risque marché → TGA optimiste |
| **`runStressTests`** (occ 85/90/100 %) | Absent du core V2 | Fourchette valeur ACM non défendable |
| **`whatIf` / `priceStrategy`** | Absents | Pas de scénarios « et si » pour mandat |
| **`buildMarketListingValuationPack`** (pack complet) | Absent | Export banque / LOI structuré impossible |
| **`valuationLogic.js`** (legacy JS) | Remplacé par TS engine | ✅ Purge saine — ne pas réimporter |
| **Pondération MRN / prix-unité** | Désactivée (poids 0) dans les deux | Cohérent — comportement voulu |

### 2.3 Lexique & conformité UI

V2 applique la règle Québec (MEMORY.md) : « vérification » vs « audit », abréviations développées. V1 mélange encore « audit EEE » à l’écran — **amélioration V2**, pas une régression.

---

## 3. Architecture des données — champs et modèles

### 3.1 Parité / migration

| Concept V1 | V2 |
|----------|-----|
| `residences/{id}/financial/dataV2` | ✅ Identique |
| `calculatedResults`, `baseData`, `depenses`, `expenseAdjustments` | ✅ |
| Canonique unités (`nombreUnitesTotal` + alias) | ✅ `packages/core/src/canonical/fieldAliases.ts` |
| Identité RPA / MSSS | ✅ `packages/core/src/identity/` |
| Promesse / `offre` | ✅ `packages/core/src/transaction/` |
| Pipeline Kanban | ✅ `transactionPipelineEngine.ts` |

### 3.2 Écarts modélisation

| Champ / collection V1 | V2 | Risque |
|-------------------------|-----|--------|
| `comparablesVente` (sur doc résidence, extraction PDF) | Remplacé par **`market_analytics_raw`** + **`marketSnapshots/v1`** | Données migrées ? Lier explicitement comparables → fiche ACM |
| `market_stats_rpa` | Agrégats dans snapshots / analytics | Vérifier scripts `migrate_*.js` |
| **`extraInsights`** (ingestion PDF, réconciliation 2.0) | **Non trouvé** en V2 | Perte métadonnées extraction si données legacy en dépendent |
| Dual `status` / `statut` pipeline | Nettoyé en V2 | ✅ Migration positive |
| `dvRpaMapping.js` (~2 900 lignes) | `packages/core/src/declaration/` + canonical | Valider couverture champs OACIQ |

---

## 4. « Poids morts » — purge saine en V2 (à ne pas réimporter)

| Élément V1 | Pourquoi ne pas le porter |
|------------|---------------------------|
| Routes désactivées (inbox Gmail, call simulator) | Dette technique ; V2 a `MailboxContainer` Nylas propre |
| 10+ générateurs PDF redondants / `@legacy` | V2 cible 2–3 pipelines PDF SSOT |
| `ValuationCalculator.jsx` orphelin | Non monté même en V1 |
| 29 composants `vendor-dashboard/*` supprimés V1 | Remplacés par portail vendeur V2 ciblé |
| `valuationLogic.js` parallèle au TS engine | Doublon |
| Double arbre `copilote-core-services/` dans Copilote-RPA | Confusion déploiement |
| Racine repo V1 (centaines de briefs `.md`, HTML test) | Bruit opérationnel |
| Calculs financiers dans composants React | V2 Rule #0 — **bonne discipline** |
| Gemini hardcodé dans ACM | Remplacé par `@primexpert/core/valuation` |
| MUI massif | Tailwind institutionnel Primexpert — cohérence charte |

---

## 5. Cartographie rapide — modules Workhub

| Zone | V1 | V2 |
|------|----|----|
| Accueil broker | `DashboardGPS` | `Dashboard` + `SuiviDossiersTab` |
| Inscriptions | `ResidencesList` | `Listings` (Kanban 4 col.) |
| ACM standalone | Intégré marché + calculateur | `ACM.tsx` (formulaire simplifié) |
| Stats marché | `MarketDashboard` | `MarketLibraryDashboard` (GPS P&L, tendances) |
| CRM | Contacts + pages multiples | `CRM` unifié |
| Fiche résidence | `ResidenceDetailV3` (routes URL) | `ResidenceDetail` (inline, 9 onglets) |
| Portail vendeur | `VendorDashboard` / `ResidenceOwnerPortal` | `/acces-vendeur` (amorce) |

---

## 6. Recommandations avant chantier ACM

### Sprint 0 — Parité minimale ACM (1–2 semaines)

1. **Grille comparables** — import CSV + validation doublons (porter depuis V1 `gpsComparablesImport.js`).
2. **Brancher `penetrationTgaAdjustment`** dans le moteur et l’UI ACM.
3. **Porter `stressTest` + `priceStrategy`** dans `@primexpert/core/valuation`.
4. **Réactiver PDF vendeur** — remplacer le placeholder `FinancialReportsSection`.
5. **Panneau vérification EEE** — porter `financialAuditEee` en core + UI Finançabilité.

### Sprint 1 — Livrables institutionnels

6. Wire `buildExportDataset` + partage sécurisé (ou équivalent Primexpert).
7. Lier comparables `market_analytics_raw` ↔ fiche résidence ACM (pas seulement coffre global).
8. Audit champs `IdentiteImmeubleTab` vs onglets V1 éclatés (checklist PO).

### Ne pas faire

- Réimporter le monolithe CRM V1 entier.
- Restaurer les générateurs PDF legacy en parallèle des services V2.
- Réintroduire calculs dans les composants React.

---

## Annexe — Fichiers de référence

### V2 (SSOT)

- `packages/core/src/financial/` — finances
- `packages/core/src/valuation/` — ACM / TGA
- `packages/core/src/market/` — GPS Big Data
- `src/components/residence/` — fiche dossier
- `src/components/residence/finance/FinanceHubMasterPanel.tsx` — PDF actifs
- `docs/MEMORY.md` — décisions produit

### V1 (référence parité)

- `Copilote-RPA/src/utils/normalizeFinancialData.js`
- `Copilote-RPA/src/domain/valuation/`
- `Copilote-RPA/src/pages/MarketDashboard.jsx`
- `Copilote-RPA/src/components/financial/FinancialAuditEeePanel.jsx`
- `copilote-core-services/src/domain/valuation/stressTest.ts`

---

*Rapport généré par audit comparatif automatisé — à valider par le PO (Alain) avant planification ACM.*
