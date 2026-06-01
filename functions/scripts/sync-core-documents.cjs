#!/usr/bin/env node
/*
 * Sync @primexpert/core/documents into functions/src/documents/_vendored/
 * SOURCE UNIQUE : packages/core/src/documents/ — ne pas modifier _vendored/ à la main.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..');
const CORE_DIR = path.join(REPO_ROOT, 'packages', 'core', 'src', 'documents');
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'documents', '_vendored');

const HEADER_BANNER = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GÉNÉRÉ — NE PAS MODIFIER.',
  ' * Source : packages/core/src/documents/',
  ' * Régénéré : functions/scripts/sync-core-documents.cjs (prebuild)',
  ' */',
  '',
].join('\n');

const FILES = ['extractionSchemas.ts', 'marketReportTypes.ts', 'marketReportNormalize.ts'];
const ANALYTICS_VENDOR_FILES = ['marketMetrics.ts'];
const ANALYTICS_CORE_DIR = path.join(REPO_ROOT, 'packages', 'core', 'src', 'analytics');
const FINANCIAL_VENDOR_FILES = ['nonOpexFinancialLines.ts'];
const FINANCIAL_CORE_DIR = path.join(REPO_ROOT, 'packages', 'core', 'src', 'financial');
const VENDORED_FINANCIAL_DIR = path.join(VENDORED_DIR, 'financial');

const VENDORED_INDEX = [
  "export * from './extractionSchemas';",
  "export * from './marketReportTypes';",
  "export * from './marketReportNormalize';",
  "export * from './marketMetrics';",
  '',
].join('\n');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function syncFile(name, options = {}) {
  const from = options.fromDir
    ? path.join(options.fromDir, name)
    : path.join(CORE_DIR, name);
  if (!fs.existsSync(from)) {
    throw new Error(`[sync-core-documents] Source manquante : ${from}`);
  }
  let original = fs.readFileSync(from, 'utf-8');
  if (name === 'extractionSchemas.ts') {
    original = original.replace(
      "from '../financial/nonOpexFinancialLines'",
      "from './financial/nonOpexFinancialLines'"
    );
    original = original.replace(
      "from '../analytics/marketMetrics'",
      "from './marketMetrics'"
    );
  }
  if (name === 'marketMetrics.ts') {
    original = original.replace(
      "from '../market/marketDataNormalize'",
      "from './marketDataNormalizeLite'"
    );
  }
  const targetDir = options.toDir ?? VENDORED_DIR;
  const target = path.join(targetDir, name);
  fs.writeFileSync(target, HEADER_BANNER + original, 'utf-8');
  return target;
}

function main() {
  ensureDir(VENDORED_DIR);
  ensureDir(VENDORED_FINANCIAL_DIR);
  const written = FILES.map((name) => syncFile(name));
  for (const name of FINANCIAL_VENDOR_FILES) {
    written.push(
      syncFile(name, { fromDir: FINANCIAL_CORE_DIR, toDir: VENDORED_FINANCIAL_DIR })
    );
  }
  for (const name of ANALYTICS_VENDOR_FILES) {
    written.push(syncFile(name, { fromDir: ANALYTICS_CORE_DIR }));
  }
  const litePath = path.join(VENDORED_DIR, 'marketDataNormalizeLite.ts');
  fs.writeFileSync(
    litePath,
    HEADER_BANNER +
      `export function coerceOperatingRatioPct(value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  let v = value;
  if (v > 0 && v <= 1) v *= 100;
  else if (v > 100 && v <= 10_000) v /= 100;
  if (v <= 0 || v > 100) return undefined;
  return Math.round(v * 1000) / 1000;
}
`,
    'utf-8'
  );
  written.push(litePath);
  const indexPath = path.join(VENDORED_DIR, 'index.ts');
  fs.writeFileSync(indexPath, HEADER_BANNER + VENDORED_INDEX, 'utf-8');
  written.push(indexPath);
  process.stdout.write(
    `[sync-core-documents] ${written.length} fichier(s) → ${path.relative(REPO_ROOT, VENDORED_DIR)}/\n`
  );
}

main();
