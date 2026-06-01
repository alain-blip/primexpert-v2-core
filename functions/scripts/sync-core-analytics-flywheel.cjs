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
const CAPITALIZATION_SOURCE = path.join(
  REPO_ROOT,
  'packages',
  'core',
  'src',
  'financial',
  'capitalization.ts'
);
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'analytics', '_vendored');
const TARGET = path.join(VENDORED_DIR, 'internalMarketFlywheel.ts');
const CAPITALIZATION_TARGET = path.join(VENDORED_DIR, 'capitalization.ts');

function headerBanner(sourceLabel) {
  return [
    '/* eslint-disable */',
    '/**',
    ' * AUTO-GÉNÉRÉ — NE PAS MODIFIER.',
    ` * Source : ${sourceLabel}`,
    ' * Régénéré : functions/scripts/sync-core-analytics-flywheel.cjs (prebuild)',
    ' */',
    '',
  ].join('\n');
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`[sync-core-analytics-flywheel] Source manquante : ${SOURCE}`);
  }
  if (!fs.existsSync(CAPITALIZATION_SOURCE)) {
    throw new Error(`[sync-core-analytics-flywheel] Source manquante : ${CAPITALIZATION_SOURCE}`);
  }
  fs.mkdirSync(VENDORED_DIR, { recursive: true });

  let body = fs.readFileSync(SOURCE, 'utf-8');
  body = body.replace(
    "import { internalFlywheelFingerprint } from './marketDeduplication';",
    "import { internalFlywheelFingerprint } from '../../documents/_vendored/marketDeduplication';"
  );
  body = body.replace(
    "import {\n  computeCapitalizationRatePct,\n  resolveNetOperatingIncome,\n} from '../financial/capitalization';",
    "import {\n  computeCapitalizationRatePct,\n  resolveNetOperatingIncome,\n} from './capitalization';"
  );

  const capitalizationBody = fs.readFileSync(CAPITALIZATION_SOURCE, 'utf-8');
  fs.writeFileSync(
    CAPITALIZATION_TARGET,
    headerBanner('packages/core/src/financial/capitalization.ts') + capitalizationBody,
    'utf-8'
  );
  fs.writeFileSync(
    TARGET,
    headerBanner('packages/core/src/market/internalMarketFlywheel.ts') + body,
    'utf-8'
  );
  process.stdout.write(
    `[sync-core-analytics-flywheel] 2 fichiers → ${path.relative(
      REPO_ROOT,
      TARGET
    )}, ${path.relative(REPO_ROOT, CAPITALIZATION_TARGET)}\n`
  );
}

main();
