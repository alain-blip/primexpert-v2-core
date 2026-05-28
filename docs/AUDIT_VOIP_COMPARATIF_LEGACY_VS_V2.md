# Audit comparatif — Module d’appels intégrés (VOIP / Twilio)

**Date :** 2026-05-26  
**Mode :** analyse seule — aucune modification de code applicatif  
**Règle PO :** enrichir l’existant, pas de duplication (Règle #0)

| Répertoire mandaté | Rôle réel observé | Projet Firebase |
|--------------------|-------------------|-----------------|
| `01_PRIMEXPERT_SYSTEME_APP_STABLE_V2` | **PrimeXpert V2** (cible de restauration) | `primexpert-app-v2` |
| `00_RPA_SYSTEME_APP/Copilote-RPA` | **Copilote Legacy V1** (source de la téléphonie intégrée) | `copilote-pour-courtiers-en-rpa` |

> **Note de lecture :** le mandat nomme STABLE_V2 « ancienne » et RPA « actuelle ». En pratique, la **fonctionnalité VOIP CRM complète** (Twilio Voice SDK, click-to-call navigateur, journal `communications`, webhooks) est dans **Copilote-RPA** ; STABLE_V2 contient une **version allégée** (Softphone Lite). Le plan de restauration vise donc à **porter Copilote → PrimeXpert V2**, pas l’inverse.

---

## 1. Différences exactes entre les deux versions (module d’appel)

### 1.1 Synthèse

| Capacité | Copilote-RPA (Legacy) | PrimeXpert V2 (STABLE_V2) |
|----------|----------------------|---------------------------|
| **Technologie d’appel** | **Twilio** (`@twilio/voice-sdk`, WebRTC navigateur) + PSTN callback (`makeCallV2`) | **`tel:` natif** + **MediaRecorder** (micro local uniquement) |
| **Appels depuis le CRM** | Oui — fiche contact, propriétaires, synthèse 360, barre supérieure | Non — pas de `makeBrowserCall` ; pas de dépendance Twilio |
| **Numéroteur (dialer)** | `QuickDialer.jsx` (Topbar, compact) + clavier dans flux contact | Clavier dans `Softphone.tsx` (onglet dédié « Téléphonie logicielle ») |
| **Barre d’appel actif** | `ActiveCallBar.jsx` (global, `Layout.jsx`) | ❌ |
| **Historique d’appels CRM** | Collection Firestore `communications` (`type: 'call'`) + `CallHistorySection.jsx` par contact | `users/{uid}/call_analyses` lié aux **enregistrements Drive**, pas aux SID Twilio |
| **Enregistrement** | Twilio `record: true` + webhook `twilioRecordingStatus` + proxy `getRecording` | Blob WebM local → Storage `primexpert/{brokerId}/residences/{id}/recordings/` |
| **Transcription / IA post-appel** | `callSummary.service` (core-services) + media stream WS | `transcriptionService.ts` (Gemini client + Whisper optionnel) |
| **SMS intégré** | `sendSmsV2` + webhooks `twilioInboundSms` | ❌ (hors périmètre softphone V2) |
| **Appels entrants** | Webhook `twilioInboundCall` → transfert cellulaire | ❌ |
| **Cloud Functions Twilio** | Codebase dédiée `functions-twilio/` | ❌ (aucune référence Twilio dans `functions/`) |
| **Cloud Run** | `copilote-core-services` — media stream, réceptionniste, GPS appels | ❌ |
| **Intégration chronologie** | Activités / `communications` + SmartMatch téléphone | `communicationTimelineService` lit `call_analyses` + courriels Nylas |

### 1.2 Legacy — stack technique détaillée

**Frontend (React / Vite)**

| Fichier | Rôle |
|---------|------|
| `src/services/twilioVoiceService.js` | Device Twilio, token, `makeBrowserCall`, appels entrants, mute |
| `src/services/communications.js` | Façade : `makeCall` (callback PSTN), `makeBrowserCall`, SMS, email |
| `src/components/calls/QuickDialer.jsx` | Numéroteur rapide (validation E.164 `libphonenumber-js`) |
| `src/components/calls/ActiveCallBar.jsx` | UI appel en cours + lookup contact |
| `src/components/CallHistorySection.jsx` | Historique + lecture enregistrements Twilio authentifiés |
| `src/components/Topbar.jsx` | `QuickDialer` compact global |
| `src/Layout.jsx` | `ActiveCallBar` monté sur toutes les pages |
| `src/pages/SimpleContactDetail.jsx`, `OwnersManagement.jsx`, `Synthese360Tab.jsx` | Click-to-call + `initializeTwilioDevice()` |

**Dépendances clés :** `@twilio/voice-sdk`, `twilio` (Functions), `libphonenumber-js`.

**Backend — Firebase Functions (codebase `functions-twilio`)**

| Endpoint | Rôle |
|----------|------|
| `getTwilioToken` | JWT Voice SDK (identity = `EMAIL_TO_CLIENT_ID` ou `userId`) |
| `twilioVoiceResponse` | TwiML sortant WebRTC + **Media Stream** vers Cloud Run |
| `makeCallV2` | Mode callback : Twilio appelle le **cellulaire du courtier**, puis le contact |
| `twilioInboundCall` / `twilioInboundSms` | Entrants + journal Firestore |
| `twilioCallStatus`, `twilioRecordingStatus`, `twilioSmsStatus` | Statuts et enregistrements |
| `getTwiml` (dans `communicationsV2.js`) | Pont callback agent ↔ contact |

**Backend — Cloud Run `copilote-core-services`**

- WebSocket `/ws/media-stream` — transcription temps réel (Gemini Live, Legacy).
- `/api/calls/lookup` — SmartMatch numéro → contact.
- Routes `/gps/calls/*` — tâches d’appels (formation / relances).
- `receptionist.service.js` — configs par client (`CLIENT_CONFIGS`).

**Données Firestore (Legacy)**

- `communications/{id}` — journal omnicanal (`type: 'call'`, `twilioSid`, `contactId`, `residenceId`, `direction`, `status`, durée).
- `contacts/{id}` — `lastCommunicationAt`, `lastCommunicationType`.
- `users/{uid}` — voir section 2.

### 1.3 V2 (STABLE_V2) — stack actuelle

**Frontend**

| Fichier | Rôle |
|---------|------|
| `src/components/Softphone/Softphone.tsx` | Phase **D-2.C-lite** : sélecteur résidence, clavier, `tel:` + MediaRecorder |
| `src/services/driveStorage.ts` | `uploadDriveRecording()` |
| `src/services/transcriptionService.ts` | Pipeline E-3 → `users/{brokerId}/call_analyses/{driveDocumentId}` |
| `src/components/Layout.tsx` | Entrée nav `phone` → lazy `Softphone` |
| `src/services/communicationTimelineService.ts` | Lecture `call_analyses` (pas `communications`) |

**Limitations documentées dans le code (Softphone.tsx) :**

- Pas de Twilio Voice SDK.
- Enregistrement **unidirectionnel** (micro courtier seulement).
- `tel:` délègue au téléphone système (Mac/iPhone).

**Backend V2**

- Aucune Function Twilio.
- Pas de `@twilio/voice-sdk` dans `package.json`.

**Données V2**

- `users/{brokerId}/call_analyses/{driveDocumentId}` — transcription, résumé, `residenceId`, `pipelineStatus`.
- Storage : `primexpert/{brokerId}/residences/{residenceId}/recordings/…`
- Profil courtier : `profile.phone` (affichage PDF / fiche) — **pas de champs Twilio**.

---

## 2. Gestion des numéros payants par courtier (Legacy — logique codée)

### 2.1 Modèle métier réel

Il n’existe **pas** de flux automatisé « achat de numéro Twilio » (Stripe checkout → provisioning API) dans le dépôt analysé. Le modèle Legacy est :

1. **Le courtier (ou l’admin) possède un numéro Twilio** assigné manuellement (achat hors application, console Twilio ou facturation agence).
2. **L’admin enregistre ce numéro** dans le profil utilisateur Firestore.
3. **L’application vérifie la présence** des champs requis avant d’autoriser certains modes d’appel.

La règle PO « chaque courtier doit acheter/posséder son propre numéro » correspond à ce modèle **configuration + contrôle d’accès**, pas à un module e-commerce intégré.

### 2.2 Champs Firestore `users/{uid}`

| Champ | Emplacement | Usage |
|-------|-------------|--------|
| `agentNumber` | Racine et/ou `settings.profile.agentNumber` | Cellulaire du courtier — **obligatoire** pour `makeCallV2` (mode callback) |
| `twilioNumber` | Racine (doc ops `CONFIGURATION_TWILIO_AGENTS.md`) | Numéro Twilio **public** (clients appellent) — routage entrant |
| `settings.profile.twilioVoiceFrom` | Profil | Numéro sortant / Caller ID (admin Settings) |
| `settings.profile.twilioAccountSid` | Profil | Option BYO Twilio (admin) |
| `settings.profile.twilioAuthToken` | Profil | Option BYO Twilio (admin) |
| `phone` | Racine | Fallback lecture `makeCallV2` |
| `subscription` | Racine (`dbSchema.js`) | Plans `solo` / `team` / `agency` — **pas de flag « téléphonie » dédié** |

**Documentation ops (Legacy) :** `twilioNumber` ≠ `agentNumber` (sinon boucle d’appels) — voir `CORRECTION_BOUCLE_TWILIO.md`.

### 2.3 Vérifications d’accès dans le code

| Point | Comportement |
|-------|----------------|
| **`getTwilioToken`** | Auth Firebase obligatoire ; identity Twilio via table `EMAIL_TO_CLIENT_ID` (emails hardcodés) → sinon `userId` (appels entrants limités). **Ne vérifie pas** `twilioVoiceFrom` avant d’émettre le token. |
| **`makeBrowserCall`** | Initialise le Device si besoin ; **pas de garde** explicite sur numéro possédé (dépend du token + TwiML App). |
| **`makeCallV2`** | `400` si `agentNumber` / `phone` / `settings.profile.agentNumber` **absent** — message : *« Numéro de téléphone utilisateur non configuré dans votre profil »*. |
| **Appels entrants** | `TWILIO_TO_AGENT_MAP` (env) : map `+numéro Twilio` → cellulaire agent ; fallback `TWILIO_FORWARD_NUMBER`. Doc mentionne aussi recherche `users` où `twilioNumber == To` (config manuelle Firestore). |
| **Admin UI** | `SettingsPage.jsx` — formulaire communications par utilisateur (`twilioAgentNumber`, `twilioVoiceFrom`, SID/token). |
| **Abonnement Stripe** | Schéma `users.subscription` prévu ; **aucune liaison code** « plan actif → téléphonie activée » trouvée pour la VOIP. |

### 2.4 Numéros sortants WebRTC

`twilioVoiceResponse` utilise un **Caller ID global** (`TWILIO_AGENT_NUMBER` / secret) pour tous les appels navigateur — la personnalisation par courtier via `settings.profile.twilioVoiceFrom` est **préparée côté admin UI** mais **non lue** dans `functions-twilio/index.js` au moment de l’audit.

### 2.5 V2 — état actuel

- Pas de champs Twilio sur le profil.
- `billingAccess.ts` gère `billingStatus` / grâce 72 h — **sans addon téléphonie**.
- Softphone : aucune vérification « numéro possédé » (pas applicable au flux `tel:`).

---

## 3. Plan d’action — Réimplantation KISS dans PrimeXpert V2

Objectif : restaurer l’expérience **click-to-call CRM + historique + enregistrement bidirectionnel**, avec **garde par courtier** sur numéro possédé, en **étendant** l’architecture V2 (pas de second softphone parallèle).

### Phase 0 — Cadrage PO (0,5 j)

- [ ] Confirmer le **mode prioritaire** : WebRTC navigateur (Legacy `makeBrowserCall`) vs callback cellulaire (`makeCallV2`) vs les deux.
- [ ] Confirmer le **projet Firebase** cible : tout migrer vers `primexpert-app-v2` (recommandé) vs pont temporaire vers Functions Legacy.
- [ ] Définir la règle d’affaires « numéro possédé » : champ canonique unique (proposition : `users/{uid}/telephony.twilioNumberE164` + `telephony.status: 'active'|'pending'|'none'`).
- [ ] Décider facturation : flag dans `subscription` vs collection `telephony_provisions/{uid}`.

### Phase 1 — Données & garde d’accès (1–2 j)

- [ ] Étendre le schéma profil / `docs/project_canonical_fields.md` : `telephony.twilioNumber`, `telephony.agentNumber`, `telephony.voiceEnabled`, `telephony.provisionedAt`.
- [ ] Ajouter helper `canUseVoip(profile)` dans `src/lib/` (miroir `billingAccess.ts`).
- [ ] UI Paramètres V2 (écran existant) : section « Téléphonie » — affichage état + message si non provisionné (pas d’achat Twilio in-app en V1 du portage).

### Phase 2 — Backend minimal sur `primexpert-app-v2` (3–5 j)

- [ ] Créer codebase Functions `functions-twilio/` (ou module `functions/src/telephony/`) — **porter** depuis Copilote :
  - `getTwilioToken` (remplacer `EMAIL_TO_CLIENT_ID` par lecture Firestore `telephony.twilioClientIdentity` + **refus 403** si `!voiceEnabled`).
  - `twilioVoiceResponse` (Caller ID = `telephony.twilioNumber` du `brokerId` passé en param).
  - Webhooks statut + enregistrement (signature Twilio).
- [ ] Secrets : `TWILIO_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`.
- [ ] **Ne pas** dupliquer `communicationsV2.js` en entier — extraire seulement les exports voix nécessaires.

### Phase 3 — Client : un seul service téléphonie (2–3 j)

- [ ] Porter `twilioVoiceService.js` → `src/services/twilioVoiceService.ts` (auth `primexpert-app-v2`, URL Functions V2).
- [ ] Ajouter dépendance `@twilio/voice-sdk` + `libphonenumber-js`.
- [ ] **Enrichir** `Softphone.tsx` (ne pas créer un second module) :
  - Onglet ou toggle « Appel intégré (Twilio) » vs « Appel local (tel: + enregistrement) » si le PO veut conserver le Lite.
  - Si `!canUseVoip` → bannière + lien paramètres.
- [ ] Monter `ActiveCallBar` dans `Layout.tsx` V2 (comme Legacy).
- [ ] Exposer `QuickDialer` compact dans la barre existante (équivalent Topbar).

### Phase 4 — CRM & fiche résidence (2–3 j)

- [ ] Bouton appeler sur `ContactFormDrawer` / fiche contact V2 → `makeBrowserCall` si `canUseVoip`, sinon `tel:`.
- [ ] Porter la logique d’historique : **option A (KISS)** — réutiliser `call_analyses` + enrichir avec `twilioSid` quand Twilio ; **option B** — sous-collection `users/{uid}/communications` alignée Legacy pour parité CRM.
- [ ] Brancher `communicationTimelineService.ts` pour fusionner les deux sources (éviter doublon UI).

### Phase 5 — Enregistrement & IA (2–4 j)

- [ ] Webhook `twilioRecordingStatus` → Storage V2 + ligne `call_analyses` (déclencher pipeline E-3 existant).
- [ ] Évaluer si Media Stream Cloud Run est requis en V1 portage ou si enregistrement Twilio + transcription batch suffit (réduction scope).
- [ ] Reprendre **validation humaine** post-résumé si exigée (Legacy `callSummary.service`).

### Phase 6 — Appels entrants & SMS (optionnel, +3–5 j)

- [ ] Porter `twilioInboundCall` avec routage `telephony.twilioNumber` → `telephony.agentNumber` (Firestore query, remplacer map env hardcodée).
- [ ] SMS : seulement si le PO le remet dans le périmètre V2 (déjà partiellement hors scope actuel).

### Phase 7 — QA & déploiement (1–2 j)

- [ ] Tests : courtier sans numéro → token refusé / UI bloquée.
- [ ] Tests : courtier avec numéro → sortant + entrant + historique contact.
- [ ] Config Twilio Console : webhooks pointant vers `primexpert-app-v2` Functions.
- [ ] Conformité OACIQ : conserver bandeau annonce enregistrement (déjà dans Softphone Lite).

### Risques & écarts connus

| Risque | Mitigation |
|--------|------------|
| Double softphone (Lite vs Twilio) | Un composant, deux modes ; déprécier `tel:` quand Twilio actif |
| Identity hardcodée Legacy | 100 % Firestore par courtier |
| Caller ID global | Lire `telephony.twilioNumber` dans `twilioVoiceResponse` |
| Projet Firebase différent | Migration données `communications` si historique Legacy requis |
| Cloud Run media stream | Phase 2 optionnelle ; coût ops |

### Estimation globale

**~15–25 jours** selon périmètre (WebRTC seul vs entrant + SMS + media stream + parité historique Legacy).

---

## Annexe — Fichiers de référence rapide

**Legacy (source)**  
`Copilote-RPA/src/services/twilioVoiceService.js`  
`Copilote-RPA/functions-twilio/index.js`  
`Copilote-RPA/functions-twilio/twilioWebhooks.js`  
`Copilote-RPA/src/components/calls/QuickDialer.jsx`  
`Copilote-RPA/src/components/CallHistorySection.jsx`  
`Copilote-RPA/CONFIGURATION_TWILIO_AGENTS.md`

**V2 (cible)**  
`01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/src/components/Softphone/Softphone.tsx`  
`01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/src/services/transcriptionService.ts`  
`01_PRIMEXPERT_SYSTEME_APP_STABLE_V2/src/services/communicationTimelineService.ts`

**Audit croisé IA**  
`docs/AUDIT_IA_LEGACY_VS_V2.md` (section Voix / réceptionniste)

---

*Rapport généré par analyse statique des dépôts — valider avec le PO les choix de mode d’appel et de facturation « numéro par courtier » avant Phase 1.*
