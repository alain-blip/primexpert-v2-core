#!/usr/bin/env bash
# Pousse les clés Twilio vers Secret Manager (sans firebase secrets:set interactif).
# Lit scripts/twilio-secrets.local.env (éditeur de texte — pas de saisie masquée Terminal).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${FIREBASE_PROJECT:-primexpert-app-v2}"
ENV_FILE="${TWILIO_SECRETS_FILE:-$ROOT/scripts/twilio-secrets.local.env}"
EXAMPLE_FILE="$ROOT/scripts/twilio-secrets.env.example"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }

if [[ ! -f "$ENV_FILE" ]]; then
  bold "=== Téléphonie — préparation du fichier de clés (HITL) ==="
  echo ""
  echo "1. Copie du modèle vers :"
  echo "   $ENV_FILE"
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo ""
  echo "2. Ouvrez ce fichier dans Cursor (ou TextEdit)."
  echo "   Collez les 4 valeurs depuis la console Twilio (sans guillemets ni espaces)."
  echo "   Enregistrez le fichier."
  echo ""
  echo "3. Relancez :"
  echo "   ./scripts/voip-mise-a-jour-infrastructure.sh"
  exit 2
fi

# shellcheck disable=SC1090
set -a
# Ignore les commentaires et lignes vides
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$line" ]] && continue
  if [[ "$line" != *=* ]]; then
    red "Ligne ignorée (format attendu CLE=valeur) : $line"
    continue
  fi
  key="${line%%=*}"
  val="${line#*=}"
  val="$(echo "$val" | sed 's/^["'\'']//;s/["'\'']$//;s/^[[:space:]]*//;s/[[:space:]]*$//')"
  export "$key=$val"
done < "$ENV_FILE"
set +a

missing=()
[[ -z "${TWILIO_SID:-}" ]] && missing+=("TWILIO_SID")
[[ -z "${TWILIO_API_KEY:-}" ]] && missing+=("TWILIO_API_KEY")
[[ -z "${TWILIO_API_SECRET:-}" ]] && missing+=("TWILIO_API_SECRET")
[[ -z "${TWILIO_TWIML_APP_SID:-}" ]] && missing+=("TWILIO_TWIML_APP_SID")

if ((${#missing[@]})); then
  red "Champs vides dans $ENV_FILE : ${missing[*]}"
  exit 1
fi

issues=()
[[ "${TWILIO_SID}" != AC* ]] && issues+=("TWILIO_SID doit commencer par AC")
[[ "${TWILIO_API_KEY}" != SK* ]] && issues+=("TWILIO_API_KEY doit commencer par SK")
[[ "${TWILIO_API_SECRET}" == SK* || "${TWILIO_API_SECRET}" == AC* ]] && \
  issues+=("TWILIO_API_SECRET ne doit pas être un SID (utiliser le secret de la clé API)")
[[ "${TWILIO_TWIML_APP_SID}" != AP* ]] && \
  issues+=("TWILIO_TWIML_APP_SID doit commencer par AP (TwiML App Primexpert V2)")

if ((${#issues[@]})); then
  bold "=== Journal de conformité — vérification de conformité des clés (écart) ==="
  for i in "${issues[@]}"; do red "  • $i"; done
  echo ""
  echo "Corrigez $ENV_FILE puis relancez le script."
  exit 1
fi

green "=== Journal de conformité — vérification de conformité des clés : OK (format) ==="

push_secret() {
  local name="$1"
  local value="$2"
  if ! gcloud secrets describe "$name" --project="$PROJECT" &>/dev/null; then
    echo "Création du secret $name…"
    gcloud secrets create "$name" \
      --project="$PROJECT" \
      --replication-policy=automatic
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" \
    --project="$PROJECT" \
    --data-file=- >/dev/null
  echo "  ✓ $name — nouvelle version publiée"
}

bold "=== Publication vers Secret Manager ($PROJECT) ==="
push_secret TWILIO_SID "$TWILIO_SID"
push_secret TWILIO_API_KEY "$TWILIO_API_KEY"
push_secret TWILIO_API_SECRET "$TWILIO_API_SECRET"
push_secret TWILIO_TWIML_APP_SID "$TWILIO_TWIML_APP_SID"

green "=== Clés enregistrées — prochaine étape : déploiement Functions ==="
