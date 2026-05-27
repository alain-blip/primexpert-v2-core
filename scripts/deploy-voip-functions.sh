#!/usr/bin/env bash
# Déploiement VOIP — aligne Secret Manager (dernières versions) + getTwilioToken.
# Usage : ./scripts/deploy-voip-functions.sh
# Prérequis : firebase CLI connecté au projet primexpert-app-v2.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${FIREBASE_PROJECT:-primexpert-app-v2}"

cd "$ROOT"

echo "=== Projet Firebase : $PROJECT ==="
echo ""
echo "=== Versions actives Secret Manager (Twilio) ==="
for NAME in TWILIO_SID TWILIO_API_KEY TWILIO_API_SECRET TWILIO_TWIML_APP_SID; do
  echo "--- $NAME ---"
  gcloud secrets versions list "$NAME" \
    --project="$PROJECT" \
    --filter="state=ENABLED" \
    --limit=3 \
    --format='table(name,createTime)' 2>/dev/null || echo "(secret absent ou accès refusé)"
done

echo ""
echo "=== Déploiement Functions (recharge les secrets liés) ==="
export FUNCTIONS_DISCOVERY_TIMEOUT=120
firebase deploy --only functions:getTwilioToken,functions:twilioVoiceResponse --project "$PROJECT"

echo ""
echo "=== Vérification post-déploiement (journal de conformité Cloud Logging) ==="
echo "Rechercher : verificationClesConforme: true"
echo "  gcloud logging read 'resource.labels.service_name=\"gettwiliotoken\" AND textPayload=~\"verificationClesConforme\"' --project=$PROJECT --limit=3 --freshness=10m"
