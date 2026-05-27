# Téléphonie — directive unique pour le PO (Alain)

> **Règle #0** — On enrichit l’existant (`Parties et intervenants`, `getTwilioToken`).  
> Aucune commande `firebase functions:secrets:set` ni saisie masquée (`read -s`) dans le Terminal.

---

## Ce que vous faites (3 étapes)

### Étape A — Copier les 4 clés Twilio (dans le navigateur)

1. Ouvrir [console.twilio.com](https://console.twilio.com).
2. Noter :
   - **Account SID** → commence par `AC…`
   - **API Key** (créer si besoin) → SID `SK…` + **Secret** (longue chaîne, **une seule fois** à la création)
   - **TwiML App « Primexpert V2 »** → SID `AP…` (Voice → TwiML Apps)

### Étape B — Coller dans un fichier texte (Cursor)

1. Ouvrir le projet dans Cursor.
2. Le script créera au premier lancement : `scripts/twilio-secrets.local.env`  
   (fichier **local**, jamais envoyé sur GitHub).
3. Remplir les 4 lignes, **sans guillemets ni espaces** :

```env
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=votre_secret_api_key_ici
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

4. **Enregistrer** le fichier (`Cmd+S`).

### Étape C — Une seule commande dans le Terminal

Copier-coller **tout le bloc** (adapter le chemin si votre disque diffère) :

```bash
cd "/Volumes/SAUVEGARDE GRIS/01_PRIMEXPERT_SYSTEME_APP_STABLE_V2" && chmod +x scripts/voip-mise-a-jour-infrastructure.sh scripts/provision-twilio-secrets.sh scripts/deploy-voip-functions.sh && ./scripts/voip-mise-a-jour-infrastructure.sh
```

**Premier lancement** : le script crée `twilio-secrets.local.env` et s’arrête → compléter l’étape B, puis **relancer la même commande**.

Le script :
1. Fait la **vérification de conformité des clés** (format AC / SK / AP).
2. Publie vers **Secret Manager** (sans interaction).
3. **Déploie** `getTwilioToken` et `twilioVoiceResponse`.

---

## Test HITL dans l’application

1. https://primexpert-app-v2.web.app  
2. Fiche résidence → **Identité** → **Parties et intervenants**  
3. Cocher un contact avec numéro → **Appeler**

---

## Journal de conformité (confirmation technique)

Si besoin, demander à l’équipe technique de vérifier dans Google Cloud :

- Message attendu : `verificationClesConforme: true`
- Libellés : **journal de conformité**, **vérification de conformité des clés** (jamais « audit »)

---

## Dépannage rapide

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Script s’arrête au début | Fichier `.local.env` vide | Remplir les 4 lignes, sauvegarder, relancer |
| « TWILIO_TWIML_APP_SID doit commencer par AP » | Account SID collé par erreur | Reprendre le SID `AP…` dans Twilio → TwiML Apps |
| « TWILIO_API_SECRET ne doit pas être un SID » | Secret = `SK…` ou `AC…` | Coller le **secret** de la clé API, pas son identifiant |
| Erreur 503 dans l’app | Clés encore non conformes en prod | Relancer la commande unique après correction du fichier |

---

*Référence technique : `docs/MEMORY.md` (chantier VOIP), branche `infrastructure/voip-secrets-alignment`.*
