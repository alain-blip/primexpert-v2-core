#!/usr/bin/env bash
# Provisionne OPENAI_API_KEY dans Secret Manager (Firebase Functions Gen2).
# Usage : OPENAI_API_KEY=sk-... ./scripts/provision-openai-secret.sh

set -euo pipefail
PROJECT="${GCLOUD_PROJECT:-primexpert-app-v2}"
KEY="${OPENAI_API_KEY:-}"

if [[ -z "$KEY" ]]; then
  echo "Erreur : définissez OPENAI_API_KEY avant d'exécuter ce script." >&2
  exit 1
fi

if gcloud secrets describe OPENAI_API_KEY --project="$PROJECT" &>/dev/null; then
  printf '%s' "$KEY" | gcloud secrets versions add OPENAI_API_KEY --data-file=- --project="$PROJECT"
  echo "✓ Nouvelle version OPENAI_API_KEY ajoutée ($PROJECT)"
else
  printf '%s' "$KEY" | gcloud secrets create OPENAI_API_KEY --data-file=- --project="$PROJECT" --replication-policy=automatic
  echo "✓ Secret OPENAI_API_KEY créé ($PROJECT)"
fi

echo "Redéployez : firebase deploy --only functions:onVoiceNoteUploaded"
