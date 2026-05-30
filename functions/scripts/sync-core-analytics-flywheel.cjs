#!/usr/bin/env node
/*
 * Sync @primexpert/core/market/internalMarketFlywheel.ts → functions/src/analytics/_vendored/
 * Réécrit les imports pour le runtime Cloud Functions (marketDeduplication documents/_vendored).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..');
const SOURCE = path.join(
  REPO_ROOT,
  'packages',
  'core',
  'src',
  'market',
  'internalMarketFlywheel.ts'
);
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'analytics', '_vendored');
const TARGET = path.join(VENDORED_DIR, 'internalMarketFlywheel.ts');

const HEADER_BANNER = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GÉNÉRÉ — NE PAS MODIFIER.',
  ' * Source : packages/core/src/market/internalMarketFlywheel.ts',
  ' * Régénéré : functions/scripts/sync-core-analytics-flywheel.cjs (prebuild)',
  ' */',
  '',
].join('\n');

const CAP_RATE_FN = `
function calculateComparableCapRate(
  listing: {
    soldPrice: number;
    revenuBrutEffectif: number;
    densesExploitation: number;
    netOperatingIncome: number;
  }
): number {
  if (!listing.soldPrice || listing.soldPrice <= 0) return 0;
  const rne =
    listing.netOperatingIncome > 0
      ? listing.netOperatingIncome
      : listing.revenuBrutEffectif - listing.densesExploitation;
  if (!Number.isFinite(rne) || rne <= 0) return 0;
  return Number(((rne / listing.soldPrice) * 100).toFixed(2));
}
`;

function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`[sync-core-analytics-flywheel] Source manquante : ${SOURCE}`);
  }
  fs.mkdirSync(VENDORED_DIR, { recursive: true });

  let body = fs.readFileSync(SOURCE, 'utf-8');
  body = body.replace(
    /import \{ calculateComparableCapRate \} from '\.\/centrisComparableCapRate';\n/,
    `${CAP_RATE_FN}\n`
  );
  body = body.replace(
    "import { internalFlywheelFingerprint } from './marketDeduplication';",
    "import { internalFlywheelFingerprint } from '../../documents/_vendored/marketDeduplication';"
  );

  fs.writeFileSync(TARGET, HEADER_BANNER + body, 'utf-8');
  process.stdout.write(
    `[sync-core-analytics-flywheel] 1 fichier → ${path.relative(REPO_ROOT, TARGET)}\n`
  );
}

main();
