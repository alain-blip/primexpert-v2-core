#!/usr/bin/env bash
# Point d'entrée unique PO — téléphonie fiche résidence (Parties et intervenants).
# 1) Vérification de conformité des clés → Secret Manager
# 2) Déploiement getTwilioToken + twilioVoiceResponse
# 3) Rappel test HITL dans l'application

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }

bold "╔══════════════════════════════════════════════════════════════╗"
bold "║  Primexpert — mise à jour infrastructure téléphonie (VOIP) ║"
bold "╚══════════════════════════════════════════════════════════════╝"
echo ""

"$ROOT/scripts/provision-twilio-secrets.sh"
echo ""
"$ROOT/scripts/deploy-voip-functions.sh"

echo ""
bold "=== Test HITL (Product Owner) ==="
echo "1. Ouvrir https://primexpert-app-v2.web.app"
echo "2. Fiche résidence → Identité → Parties et intervenants"
echo "3. Cocher un contact → Appeler"
echo ""
echo "Journal de conformité Cloud (attendu : verificationClesConforme: true) :"
echo "  gcloud logging read 'resource.labels.service_name=\"gettwiliotoken\" AND textPayload=~\"verificationClesConforme\"' --project=primexpert-app-v2 --limit=3 --freshness=15m --format='value(textPayload)'"
