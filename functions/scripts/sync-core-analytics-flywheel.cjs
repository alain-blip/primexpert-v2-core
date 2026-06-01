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
const CAP_RATE_SOURCE = path.join(
  REPO_ROOT,
  'packages',
  'core',
  'src',
  'market',
  'comparableCapRate.ts'
);
const PIPELINE_STATUS_SOURCE = path.join(
  REPO_ROOT,
  'packages',
  'core',
  'src',
  'residence',
  'pipelineStatusResolve.ts'
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

function syncSupportFile(source, name) {
  if (!fs.existsSync(source)) {
    throw new Error(`[sync-core-analytics-flywheel] Source manquante : ${source}`);
  }
  fs.writeFileSync(path.join(VENDORED_DIR, name), HEADER_BANNER + fs.readFileSync(source, 'utf-8'), 'utf-8');
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`[sync-core-analytics-flywheel] Source manquante : ${SOURCE}`);
  }
  fs.mkdirSync(VENDORED_DIR, { recursive: true });

  let body = fs.readFileSync(SOURCE, 'utf-8');
  body = body.replace(
    "import { internalFlywheelFingerprint } from './marketDeduplication';",
    "import { internalFlywheelFingerprint } from '../../documents/_vendored/marketDeduplication';"
  );
  body = body.replace(
    "} from '../residence/pipelineStatusResolve';",
    "} from './pipelineStatusResolve';"
  );

  syncSupportFile(CAP_RATE_SOURCE, 'comparableCapRate.ts');
  syncSupportFile(PIPELINE_STATUS_SOURCE, 'pipelineStatusResolve.ts');
  fs.writeFileSync(TARGET, HEADER_BANNER + body, 'utf-8');
  process.stdout.write(
    `[sync-core-analytics-flywheel] 3 fichier(s) → ${path.relative(REPO_ROOT, VENDORED_DIR)}/\n`
  );
}

main();
