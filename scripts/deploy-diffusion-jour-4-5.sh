#!/usr/bin/env bash
# Déploiement Jour 4.5 — hosting + functions diffusion
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Build app (hosting)"
npm run build

echo "==> Deploy hosting (primexpert-app-v2)"
firebase deploy --only hosting

echo "==> Deploy functions diffusion"
export FUNCTIONS_DISCOVERY_TIMEOUT=60
firebase deploy --only functions:diffusionPublishListing,diffusionSaveDraftListing,diffusionHideListing

echo "==> Terminé. Republier la fiche depuis l’onglet Diffusion (Brouillon ou Publier)."
