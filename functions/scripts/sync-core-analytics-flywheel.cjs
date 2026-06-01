#!/usr/bin/env node
/*
 * Sync @primexpert/core/market/internalMarketFlywheel.ts → functions/src/analytics/_vendored/
 * Réécrit les imports pour le runtime Cloud Functions.
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
const FINANCIAL_SOURCE = path.join(
  REPO_ROOT,
  'packages',
  'core',
  'src',
  'financial',
  'capitalization.ts'
);
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'analytics', '_vendored');
const TARGET = path.join(VENDORED_DIR, 'internalMarketFlywheel.ts');
const FINANCIAL_TARGET = path.join(VENDORED_DIR, 'financialCapitalization.ts');

const HEADER_BANNER = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GÉNÉRÉ — NE PAS MODIFIER.',
  ' * Source : packages/core/src/market/internalMarketFlywheel.ts',
  ' * Régénéré : functions/scripts/sync-core-analytics-flywheel.cjs (prebuild)',
  ' */',
  '',
].join('\n');

const FINANCIAL_HEADER_BANNER = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GÉNÉRÉ — NE PAS MODIFIER.',
  ' * Source : packages/core/src/financial/capitalization.ts',
  ' * Régénéré : functions/scripts/sync-core-analytics-flywheel.cjs (prebuild)',
  ' */',
  '',
].join('\n');

function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`[sync-core-analytics-flywheel] Source manquante : ${SOURCE}`);
  }
  if (!fs.existsSync(FINANCIAL_SOURCE)) {
    throw new Error(`[sync-core-analytics-flywheel] Source manquante : ${FINANCIAL_SOURCE}`);
  }
  fs.mkdirSync(VENDORED_DIR, { recursive: true });

  let body = fs.readFileSync(SOURCE, 'utf-8');
  body = body.replace(
    "import { internalFlywheelFingerprint } from './marketDeduplication';",
    "import { internalFlywheelFingerprint } from '../../documents/_vendored/marketDeduplication';"
  );
  body = body.replace(
    "import {\n  computeCapRatePctFromRneAndPrice,\n  resolveRneFromRevenueAndExpenses,\n} from '../financial/capitalization';",
    "import {\n  computeCapRatePctFromRneAndPrice,\n  resolveRneFromRevenueAndExpenses,\n} from './financialCapitalization';"
  );

  fs.writeFileSync(TARGET, HEADER_BANNER + body, 'utf-8');
  fs.writeFileSync(
    FINANCIAL_TARGET,
    FINANCIAL_HEADER_BANNER + fs.readFileSync(FINANCIAL_SOURCE, 'utf-8'),
    'utf-8'
  );
  process.stdout.write(
    `[sync-core-analytics-flywheel] 2 fichiers → ${path.relative(REPO_ROOT, VENDORED_DIR)}\n`
  );
}

main();
