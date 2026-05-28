# Audit IA — Legacy (Copilote-RPA) vs V2 (Primexpert)

**Date :** 2026-05-26  
**Périmètre :** fonctions d’intelligence artificielle uniquement (prompts, extraction, génération, LLM, Gemini, Vertex, OpenAI).  
**Mode :** lecture seule — aucune modification de code de production.

| Source | Chemin |
|--------|--------|
| **A — Legacy** | `/Volumes/SAUVEGARDE GRIS/00_RPA_SYSTEME_APP` — `Copilote-RPA/` (Functions multi-codebases) + **`Copilote-RPA/copilote-core-services/`** (API Node déployée, build `dist/`) + `functions/processCentrisPdf.js` |
| **B — V2** | `/Volumes/SAUVEGARDE GRIS/01_PRIMEXPERT_SYSTEME_APP_STABLE_V2` |

**Mention obligatoire :** on enrichit / on étend / on modifie l’existant — aucune duplication autorisée (Règle #0).

---

## Verdict exécutif

| Dimension | Évaluation |
|-----------|------------|
| **Extraction documentaire (PDF financier, évaluation, marché, CL)** | **V2 ≥ Legacy** — pipeline Vertex unifié (`geminiExtract.ts`), schémas `@primexpert/core`, taxonomie, injection HITL marché |
| **Valorisation / ACM chiffrée** | **Choix architectural différent** — Legacy mélange moteur déterministe + **GPT-4o** (`valuationPredictor`) ; V2 = **`calculateValuation` déterministe** (core) sans LLM sur le prix |
| **Narratif vendeur (lecture signée)** | **Régression fonctionnelle** — Legacy **OpenAI serveur** (`generateSellerNarrative`) ; V2 = templates **RULES** seulement (`aiNarrativeService` stub → `null`) |
| **Assistant conversationnel / RAG** | **Régression majeure** — Legacy **Raphaël RAG** (embeddings + GPT) ; **absent V2** |
| **CRM / radar / briefing IA** | **Régression majeure** — Legacy (briefing matinal, radar opportunités, hot leads, brouillons courriel) ; **absent V2** |
| **MSSS (registre + enrichissement web)** | **Régression** — Legacy GPT-4o sur HTML/PDF MSSS ; V2 sans équivalent serveur |
| **Messagerie (analyse leads)** | **Régression partielle** — Legacy + V1 client IA opportunités ; V2 Nylas + **heuristiques** (`mailMessageAnalysis`) ; fonctions Gemini mailbox **non branchées UI** |
| **Voix (transcription + analyse appel)** | **Parité partielle** — V2 Whisper + Gemini client (`transcriptionService`, `analyzeQuebecBrokerCallTranscript`) ; Legacy **core-services** : Gemini Live WS, résumé structuré + brouillon courriel, réceptionniste voicemail |
| **Coaching téléphonique « Raphaël GPS »** | **Régression majeure** — stack `/gps/raphael/*` (training, quality, practice, playbooks, audio-coach) dans **core-services** ; **absent V2** |
| **Centris / import listings PDF** | **Hors V2** — `processCentrisPDF` (Gemini API) sur projet `00_RPA_SYSTEME_APP/functions`, pas porté dans `primexpert-app-v2` |

**Conclusion :** la V2 **n’a pas perdu** la brique critique « extraction PDF → Firestore » ; elle l’a **centralisée et durcie** (Vertex ADC, persona statisticien, schéma MARKET_REPORT). En revanche, plusieurs **capacités IA « couche conseil »** (narratif serveur, RAG, matching acheteur, briefing, MSSS, détection opportunités courriel) **ne sont pas migrées** ou existent seulement en **code mort / stub** côté V2.

---

## Méthodologie

1. Inventaire par `rg` (gemini, vertex, openai, gpt, prompt, GenerativeModel) sur les deux arborescences.
2. Lecture ciblée des points d’entrée : `functions-ai/index.js`, `Copilote-RPA/functions/index.js`, **`copilote-core-services/dist/server.js`** et services associés, `functions/src/index.ts` (V2), `src/services/gemini.ts`, `packages/core/src/narrative/`, `functions/src/documents/geminiExtract.ts`.
3. Croisement avec `docs/AUDIT_PARITE_V1_V2.md` (parité globale, hors focus IA strict).

**Limites :** dépôts Legacy volumineux (timeouts `rg` sur racine entière). **`copilote-core-services`** : seul le dossier **`dist/`** est présent dans le dépôt (sources TypeScript référencées via `.map` mais non versionnées ici). Sandbox `lab-ia-nextgen` et scripts ops non exhaustifs.

---

## Architecture IA — comparaison

| Aspect | Legacy (A) | V2 (B) |
|--------|------------|--------|
| **Projet Firebase** | `copilote-pour-courtiers-en-rpa` (multi-codebases Functions) | `primexpert-app-v2` (Functions + Hosting unifiés) |
| **Fournisseur dominant serveur** | **OpenAI** (`OPENAI_API_KEY`, gpt-4o / gpt-4o-mini) | **Vertex AI** (`gemini-2.5-flash`, `us-central1`, ADC compte de service) |
| **Fournisseur dominant client** | `geminiService.js`, `geminiLiveService.js` (clé navigateur) | `@google/genai` via `VITE_GEMINI_API_KEY` (`src/services/gemini.ts`) |
| **SSOT prompts extraction** | Dispersé (`pdfFinancialExtractor`, `extractionV2IA`, `evaluationReportExtractor`, `marketDocumentAnalysis`, parsers PDF) | **`functions/src/documents/geminiExtract.ts`** + vendoring `@primexpert/core/documents` |
| **Rate limiting** | Firestore `rateLimits/{uid}_{function}` (functions-ai) | Auth Firebase + quotas implicites ; pas de rate limit IA dédié documenté |
| **Sécurité clés** | Secrets Functions OpenAI ; clés Gemini parfois côté client V1 | Vertex **sans clé JSON prod** ; clé Gemini **exposée Vite** pour usages client (Loi 25 / gouvernance à cadrer) |

---

## 1. Fonctions IA migrées avec succès (ou équivalent supérieur)

| Capacité Legacy | Emplacement Legacy | Équivalent V2 | Notes |
|-----------------|-------------------|---------------|-------|
| Extraction PDF états financiers | `extractFinancialDataFromPDF`, `pdfFinancialExtractor.js`, `financialExtraction.js` | `propertyDocumentParseIA` → `geminiExtract` + `extractionSchemas.ts` | Prompts structurés par `documentType` ; règles RBE/RNE/OPEX explicites ; injection `extractedDataInjectionService` + modale STOP |
| Extraction rapport d’évaluation | `extractEvaluationReport`, `evaluationReportExtractor.js` | Même pipeline (`rapport_evaluation` dans `geminiExtract`) | Comparables + sujet dans schéma |
| Analyse document marché (macro) | `analyzeMarketDocument`, `marketDocumentAnalysis.js` | `marketDocumentParseIA` + `normalizeMasterMarketExtract` | Persona **STATISTICIAN_PERSONA** ; 2 GiB / 540 s ; injection `injectMarketMacroStats` |
| Extraction « IA pure » preuve textuelle | `extractFinancialDataFromPDFV2`, `extractionV2IA.js` | Philosophie reprise dans taxonomie + preuves ; pas de fonction nommée V2 | Legacy modal multi-docs ; V2 = fiche résidence `DocumentsDiligenceTab` |
| Certificat de localisation | Parsers + IA MSSS/ PDF divers | Bloc `certificat_localisation` dans `geminiExtract` | `irregularites`, `suggestionClauseDV` |
| Narratif vendeur **déterministe** | Templates + lint V1 | `packages/core/src/narrative/` (`selectSellerNarrative`, `sellerNarrativeTemplates`, `narrativeLint`) | **Sans** couche OpenAI serveur |
| Transcription / résumé appel | `callSummary.service.js` (Gemini 2.0-flash, prompt `SUMMARY_PROMPT`, validation humaine, brouillon SendGrid) + `geminiTranscription.service.js` (Live API) | `transcriptionService.ts` + `analyzeQuebecBrokerCallTranscript` | V2 : pas de flux **validation humaine + email_followup** identique ; persistance `call_analyses` |
| Réceptionniste / voicemail | `receptionist.service.js` (Gemini transcription + analyse) | ❌ | Portail / softphone V2 partiel (`Softphone.tsx`) |
| Upload & Forget (post-ingest PDF) | Trigger `autoAnalyzeDocument` → POST `core-services/ai/documents/analyze-auto` | Remplacé par scan/parse **callable** `propertyDocumentParseIA` sur `residences/…/documents/` | **Équivalent fonctionnel** si PO valide le nouveau chemin ; endpoint HTTP Legacy **non retrouvé** dans `dist/` actuel |
| Génération description inscription | Client `geminiService.js` | `generateListingDescription` (`ContentGen.tsx`) | Modèle `gemini-3-flash-preview` |
| Rapport hebdo vendeur (texte) | Partiel V1 communications | `generateSellerWeeklyUpdateReport` (`SellerWeeklyReportModule`) | Gemini client |
| Drive — lecture document | functions-ai (projet séparé) | `driveExtraction.ts` (Gemini client, décision Phase C documentée) | Évite pont inter-projets |
| Benchmark / injection marché post-parse | Agrégats V1 | `injectMarketMacroStats`, `marketDeduplication.ts` | Couche **non-LLM** mais complète le flux IA |

### Qualité des prompts — extraction (A vs B)

| Critère | Legacy | V2 |
|---------|--------|-----|
| **Typologie document** | Registres champs + parsers spécialisés (MSSS, contrat, etc.) | **Inférence** `documentType` / `MARKET_REPORT` dans un prompt universel |
| **RBE / RNE / OPEX** | Règles dans `extractionV2IA` + normaliseurs JS | Règles **explicites** dans `PNL_BLOCK` + `resolveCanonicalRne` côté core |
| **Marché omnivore** | `marketDocumentAnalysis` (OpenAI, tranches taille) | Schéma **MasterMarketExtraction** + normalisation déterministe post-LLM |
| **Contexte fichier** | PDF text slice, File API Gemini (Centris) | Base64 / PDF via Vertex `generateContent` |
| **Modèle** | souvent gpt-4o (OpenAI) | gemini-2.5-flash (Vertex) |

---

## 2. Fonctions IA manquantes, régressées ou non branchées

### 2.1 Régressions majeures (capacité Legacy absente en V2)

| Capacité | Legacy | V2 | Impact métier |
|----------|--------|-----|---------------|
| **Raphaël RAG** | `raphaelRAG.js` — embeddings `text-embedding-3-small`, retrieval, GPT-4o-mini, chunks Firestore | ❌ | Assistant documentaire / Q&R sur dossiers |
| **Narratif vendeur IA serveur** | `generateSellerNarrative` — prompt verrouillé, JSON strict, lint serveur | `aiNarrativeService.generateAINarrative` → **toujours `null`** | ACM affiche lecture **RULES** seulement (`AcmValuationWorkspace`) |
| **Matching résidences ↔ acheteur** | `findMatchingResidences` (GPT-4o) | ❌ | Prospection acheteurs qualifiés |
| **Prédiction valeur GPT** | `valuationPredictor` / `predictResidenceValue` (GPT-4o) | Remplacé par `calculateValuation` **sans LLM** | Choix sain pour OACIQ si prix = moteur explicable ; perte « story IA » |
| **Briefing matinal / radar / contact** | `generateMorningBriefing`, `generateOpportunityRadar`, `generateContactBriefing` | ❌ | Tableau de bord courtier |
| **Brouillon communication** | `generateCommunicationDraft` | ❌ | Productivité CRM |
| **Hot lead / deal score IA** | `scoreHotLead`, `calculateDealScore` | ❌ | Priorisation pipeline |
| **Agent IA conversationnel** | `functions-ai/aiAgent.js` (GPT-4o, outils) | ❌ | Module `/raphael`, simulateur |
| **Analyse conversation** | `conversationAnalysis.js` | ❌ | Coaching Twilio / formation |
| **MSSS enrichissement IA** | `aiMsssEnrichment.js`, `extractMsssRegisterIaPrimary.js` | ❌ | Identité RPA / registre MSSS |
| **Email opportunités** | `EmailOpportunityDetectionWidget` + API | ❌ | Radar GPS courriel entrant |
| **Upload & Forget** | `autoAnalyzeDocument` → POST `/ai/documents/analyze-auto` (core-services — **route absente du `dist/` scanné**) | Équivalent : trigger parse après scan `clean` | Vérifier déploiement prod Legacy vs V2 `propertyDocumentParseIA` |
| **Coaching GPS Raphaël** | `raphaelTraining`, `raphaelPractice`, `raphaelPlaybook`, `raphaelAudioCoach`, `raphaelAdvice`, `raphaelQuality`, `raphaelPerformance` | ❌ | PRE_CALL / IN_CALL / POST_CALL, simulateur, playbooks |
| **Résumé appel + courriel suivi** | `callSummary.service` — JSON (actions, RDV, `email_followup`) | Partiel — analyse transcript sans même contrat JSON | Productivité post-appel |
| **Gemini Live (temps réel)** | WebSocket `BidiGenerateContent` (`gemini-2.0-flash-exp`) + Twilio media stream | ❌ | Transcription live appels V1 |
| **Centris PDF → listings** | `00_RPA_SYSTEME_APP/functions/processCentrisPdf.js` (Gemini File API + `CENTRIS_MASTER_PROMPT`) | ❌ dans V2 | Import Centris (prévu pipeline GPS, non livré) |
| **Batch analyse marché / financiers** | `batchAnalyzeMarketDocuments`, `batchIngestFinancials` | Partiel (unitaire via UI Vault / documents) | Ops masse |
| **Brochure comparative IA** | `generateComparativeBrochure` | ❌ | Marketing |
| **Manuel / contenu IA** | `generateManualContent`, `manualGenerator.js` | ❌ | Formation |
| **Apprentissage IA** | `aiLearning.js`, `aiLearningCore.js` | ❌ | Boucle feedback (si encore utilisée) |
| **Adjointe analyste** | `adjointeAnalyste.js` | ❌ | Assistant métier |
| **Réputation / batch analysis** | `reputationWrapper`, `runBatchAnalysis` | ❌ | À valider usage PO |

### 2.2 Régressions partielles ou code V2 non utilisé

| Élément | Détail |
|---------|--------|
| **`analyzeMarketValue`** (`gemini.ts`) | Prompt ACM JSON (gemini-3.1-pro-preview) — **aucun import UI** ; ACM résidence = `calculateValuation` (core) |
| **`analyzeMailboxMessageForLeads` / `generateMailboxReplyDraft`** | Implémentés dans `gemini.ts` — **non référencés** dans `src/components/` ; Nylas utilise `buildInboundMailAnalysis` **heuristique** |
| **Modal extraction multi-docs V1** | `DataExtractionModal.jsx` + `extractMultipleDocumentsV2` — V2 : pas de modal équivalent « batch résidence » |
| **Gemini Live** | `geminiLiveService.js` (V1) | Non porté |
| **OpenAI sur matching / narrative** | Secrets `OPENAI_API_KEY` centralisés V1 | V2 : option Whisper (`VITE_OPENAI_API_KEY`) transcription seulement |

### 2.3 Cartographie providers — fonctions serveur V2 (référence)

| Export Cloud Function | IA ? | Fichier cœur |
|----------------------|------|--------------|
| `propertyDocumentParseIA` | ✅ Vertex | `parsePropertyDocument.ts` → `geminiExtract.ts` |
| `marketDocumentParseIA` | ✅ Vertex | `parseMarketDocument.ts` |
| `propertyDocumentsReconcileParse` | ✅ (relance parse) | idem |
| `injectMarketMacroStats` | ❌ (règles) | `injectMarketMacroStats.ts` |
| `nylas*` / messagerie | Heuristique | `mailMessageAnalysis.ts` |
| `getGlobalFinancialBenchmark` | ❌ | agrégats |

---

## 3. Fonctions IA côté client V2 (hors Vertex)

| Fonction | Fichier | Modèle (défaut code) | Branché UI |
|----------|---------|----------------------|------------|
| `generateListingDescription` | `gemini.ts` | gemini-3-flash-preview | `ContentGen.tsx` |
| `analyzeMarketValue` | `gemini.ts` | gemini-3.1-pro-preview | ❌ |
| `analyzeMailboxMessageForLeads` | `gemini.ts` | — | ❌ |
| `generateMailboxReplyDraft` | `gemini.ts` | — | ❌ |
| `transcribeAudioPlainTextWithGemini` | `gemini.ts` | — | `transcriptionService.ts` |
| `analyzeQuebecBrokerCallTranscript` | `gemini.ts` | — | idem |
| `generateSellerWeeklyUpdateReport` | `gemini.ts` | — | `SellerWeeklyReportModule.tsx` |
| `extractDriveDocument` | `driveExtraction.ts` | Gemini structured output | `Drive.tsx` |

**Risque gouvernance :** clé `VITE_GEMINI_API_KEY` dans le navigateur (même pattern que V1 client). Préférer à terme des **callables** pour les flux sensibles (alignement charte « zéro diffusion IA sans validation »).

---

## 4. Inventaire Legacy — codebases IA (référence rapide)

### 4.1 `Copilote-RPA/functions-ai/` (exports principaux)

| Export | Module | Provider |
|--------|--------|----------|
| `analyzeFinancials` | financialAnalysis | OpenAI |
| `extractMultipleDocumentsV2` | smartFinancialExtraction | OpenAI |
| `extractEvaluationReport` | evaluationReportExtractor | OpenAI |
| `generateSellerNarrative` | generateSellerNarrative | OpenAI (prompt serveur) |
| `findMatchingResidences` | residenceMatching | OpenAI |
| `analyzeMarketDocument` | marketDocumentAnalysis | OpenAI |
| `autoAnalyzeDocument` | autoAnalyzeDocument | HTTP core-services |
| `extractFinancialDataFromPDF` | pdfFinancialExtractor | OpenAI |
| `extractFinancialDataFromPDFV2` | extractionV2IA | OpenAI |

### 4.2 Autres codebases Legacy (Firebase Functions)

| Dossier | Rôle IA |
|---------|---------|
| `functions-valuation/` | `predictResidenceValue` — GPT-4o |
| `functions-msss/` | Enrichissement pages MSSS — GPT-4o |
| `functions-briefing/` | Briefings — gpt-4o-mini + templates |
| `functions-conversations/` | Analyse / génération conversation — OpenAI |
| `functions/raphaelRAG.js` | RAG documents RPA (embeddings OpenAI + GPT-4o-mini) |
| `functions/index.js` | Briefing, radar, hot leads, brouillons, batch, geminiWebhook, etc. |
| `00_RPA_SYSTEME_APP/functions/processCentrisPdf.js` | Import Centris PDF — Gemini API + `CENTRIS_MASTER_PROMPT` |

### 4.3 `copilote-core-services` (API Node — Legacy)

Service Express séparé du bundle Firebase (URL via `CORE_SERVICES_URL`). Build audité : `Copilote-RPA/copilote-core-services/dist/`.

| Module / route | Fichier `dist/` | Provider / rôle IA |
|----------------|-----------------|-------------------|
| **Transcription temps réel** | `services/geminiTranscription.service.js` | Gemini **Live** WebSocket (`gemini-2.0-flash-exp`) ; branché `server.js` + Twilio media stream |
| **Résumé d’appel** | `services/callSummary.service.js` | Gemini **2.0-flash** REST ; prompt métier `SUMMARY_PROMPT` (résumé markdown, actions, rendez-vous ISO, sentiment, **`email_followup` HTML**) ; validation humaine avant persistance |
| **Réceptionniste** | `services/receptionist.service.js` | Gemini 2.0-flash — transcription + analyse voicemail |
| **Raphaël Training** | `services/raphaelTraining.service.js` + `/gps/raphael/training` | PRE_CALL / IN_CALL / POST_CALL ; cache &lt; 1,5 s ; fallback « light » si LLM lent (Prisma + logique coaching) |
| **Raphaël Practice** | `raphaelPractice.routes.js` + `raphaelPractice.service.js` | Sessions d’entraînement / simulation |
| **Raphaël Playbooks** | `raphaelPlaybook.service.js` | Scripts dynamiques (contenus métier seedés) |
| **Raphaël Audio Coach** | `raphaelAudioCoach.routes.js` | Coaching audio asynchrone |
| **Raphaël Advice** | `raphaelAdvice.routes.js` | Conseils quotidiens |
| **Raphaël Quality / Performance** | `raphaelQuality`, `raphaelPerformance` routes | Scoring appels, KPI (agrégation ; LLM selon route) |
| **Coaching insights** | `GET /gps/raphael/coaching-insights` | Agrégation dashboard (réponse souvent template si données vides) |
| **Pont Firebase** | `functions-ai/autoAnalyzeDocument.js` | Appelle `POST /ai/documents/analyze-auto` — **handler non localisé dans le `dist/` du dépôt** (endpoint peut exister seulement en prod ou branche non commitée) |

**Comparaison prompts — appels téléphoniques**

| Aspect | Legacy `SUMMARY_PROMPT` | V2 `analyzeQuebecBrokerCallTranscript` |
|--------|----------------------|----------------------------------------|
| Sortie | JSON strict (summary, actions, appointments, email_followup) | Résumé structuré + engagements (voir `gemini.ts`) |
| Validation humaine | Oui (`/call-summary/validate`, pending) | Non équivalent documenté |
| Courriel suivi | Génération HTML dans le JSON | Non intégré au même flux |
| Modèle | gemini-2.0-flash (API key serveur) | Modèles preview client (`@google/genai`) |

**Équivalent V2 le plus proche :** `transcriptionService.ts` + `IntelligenceChronologie` + `generateSellerWeeklyUpdateReport` — **pas** la stack GPS Raphaël ni le workflow validation + email.

---

## 5. Recommandations — réintégrer l’intelligence sans briser le SSOT

Priorisation alignée Règle #0 (enrichir l’existant, pas de second moteur parallèle).

### Priorité 1 — Quick wins (faible risque)

1. **Réactiver le narratif vendeur IA**  
   - Étendre `packages/core/src/services/aiNarrativeService.ts` : callable V2 `generateSellerNarrative` (porter prompt Legacy **tel quel** + lint core) **ou** proxy contrôlé vers functions-ai si migration projet non terminée.  
   - Brancher `selectSellerNarrative` mode `AI` dans `AcmValuationWorkspace` (déjà appelle `selectSellerNarrative`).

2. **Brancher ou retirer le code mort `gemini.ts`**  
   - Soit connecter `analyzeMailboxMessageForLeads` / `generateMailboxReplyDraft` à `MailboxContainer` (fallback heuristique).  
   - Soit supprimer / documenter comme « réservé Phase X » pour éviter fausse impression de parité.

3. **Documenter explicitement** que `analyzeMarketValue` est **déprécié** au profit de `calculateValuation` + ACM résidence (éviter double vérité prix).

### Priorité 2 — Parité dossier & marché

4. **Modal extraction multi-preuves**  
   - Réutiliser `propertyDocumentParseIA` + UI `DocumentMetadataPanel` ; ne pas recréer `extractionV2IA` — ajouter mode « lot » si PO l’exige.

5. **Centris / Matrix**  
   - Porter `processCentrisPDF` comme **callable V2** (secret `GEMINI_API_KEY` Functions, pas Vite) vers `listings_cache` ou collection V2 canonique — une seule pipeline (cf. `project_pipeline_gps.md`).

6. **Messagerie**  
   - Enrichir `buildInboundMailAnalysis` : option `mailAnalysisSource: 'vertex'` post-webhook Nylas (même pattern que parse documents).

### Priorité 3 — CRM & stratégique (décision produit)

7. **Raphaël RAG** — décision PO : réimplémenter sur Vertex (embeddings + Firestore vector) **ou** reporter ; ne pas dupliquer OpenAI + Gemini en parallèle.

8. **Briefing / radar / hot leads** — si repris : un module `packages/core/src/intelligence/briefing/` + 1 callable, templates déterministes + couche LLM optionnelle.

9. **MSSS** — script batch admin ou callable isolé ; champs cibles = `identity` core + `residences` (pas nouvelle collection).

10. **Matching acheteur** — étendre `organizations/.../contacts` + règles `buyerCriteria` ; LLM en **suggestion** seulement, validation courtier obligatoire.

### Principes techniques (V2)

- **SSOT extraction :** tout nouveau prompt PDF passe par `geminiExtract.ts` + schémas `packages/core/src/documents/`.  
- **SSOT prix / ACM :** `@primexpert/core/valuation` — l’IA ne remplace pas `calculateValuation` sans note courtier validée.  
- **Secrets :** OpenAI/Gemini clés **Functions** pour extraction et narrative serveur ; réduire surface `VITE_*` pour données clients.  
- **Tests de non-régression :** jeux PDF golden (financier, évaluation, rapport Altus) comparés Legacy vs V2 sur champs canoniques.

---

## 6. Protocole de sortie (audit)

| Section | Contenu |
|---------|---------|
| **Fichiers touchés** | **Aucun** code production — création de `docs/AUDIT_IA_LEGACY_VS_V2.md` uniquement |
| **Impact conformité** | Document de référence pour priorisation PO ; rappel : prix ACM = opinion fondée, pas sortie LLM brute |
| **Ce qui change** | Inventaire IA, écarts, recommandations |
| **Ce qui ne change pas** | Pipelines Vertex déployés, `financial/dataV2`, règles Firestore, moteur valuation déterministe |

---

## 7. Synthèse une page (PO)

```
MIGRÉ / RENFORCÉ          │  MANQUANT / RÉGRESSÉ
──────────────────────────┼──────────────────────────────────
Extraction PDF résidence   │  Raphaël RAG (Functions)
Vault marché (omnivore)    │  Narratif vendeur OpenAI serveur
CL + évaluation + P&L      │  Matching acheteur IA
Injection marché HITL      │  Briefing / radar / hot leads
Transcription appel (V2)   │  Coaching GPS Raphaël (core-services)
Rapport hebdo vendeur      │  Gemini Live + résumé validé + email_followup
ContentGen description     │  MSSS IA · Centris PDF · Email opportunités
Narratif RULES (core)      │  aiAgent · conversation coach · playbooks
                           │  analyzeMarketValue / Mailbox Gemini (mort V2)
```

---

*Rapport généré en mode auditeur — 2026-05-26 (révision : périmètre **copilote-core-services** ajouté). Aucun code de production modifié. Parité hors IA : `docs/AUDIT_PARITE_V1_V2.md`.*
