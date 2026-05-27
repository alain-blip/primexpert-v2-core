#!/usr/bin/env bash
# Déploiement VOIP — recharge les dernières versions Secret Manager + Functions.
# Appelé par voip-mise-a-jour-infrastructure.sh (ne pas utiliser secrets:set manuel).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${FIREBASE_PROJECT:-primexpert-app-v2}"

cd "$ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }

bold "=== Projet Firebase : $PROJECT ==="
echo ""
bold "=== Journal de conformité — versions Secret Manager (Twilio) ==="
for NAME in TWILIO_SID TWILIO_API_KEY TWILIO_API_SECRET TWILIO_TWIML_APP_SID; do
  echo "--- $NAME ---"
  gcloud secrets versions list "$NAME" \
    --project="$PROJECT" \
    --filter="state=ENABLED" \
    --limit=3 \
    --format='table(name,createTime)' 2>/dev/null || echo "(secret absent ou accès refusé)"
done

echo ""
bold "=== Déploiement Functions (liaison defineSecret — dernières versions) ==="
export FUNCTIONS_DISCOVERY_TIMEOUT=120
firebase deploy --only functions:getTwilioToken,functions:twilioVoiceResponse --project "$PROJECT"

echo ""
bold "=== Journal de conformité — vérification post-déploiement ==="
echo "Après un appel test, confirmer dans Cloud Logging :"
echo "  verificationClesConforme: true"
echo ""
echo "Commande :"
echo "  gcloud logging read 'resource.labels.service_name=\"gettwiliotoken\" AND textPayload=~\"verificationClesConforme\"' --project=$PROJECT --limit=3 --freshness=15m --format='value(textPayload)'"
