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

const VENDORED_INDEX = [
  "export * from './extractionSchemas';",
  "export * from './marketReportTypes';",
  "export * from './marketReportNormalize';",
  '',
].join('\n');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function syncFile(name) {
  const from = path.join(CORE_DIR, name);
  if (!fs.existsSync(from)) {
    throw new Error(`[sync-core-documents] Source manquante : ${from}`);
  }
  const original = fs.readFileSync(from, 'utf-8');
  const target = path.join(VENDORED_DIR, name);
  fs.writeFileSync(target, HEADER_BANNER + original, 'utf-8');
  return target;
}

function main() {
  ensureDir(VENDORED_DIR);
  const written = FILES.map(syncFile);
  const indexPath = path.join(VENDORED_DIR, 'index.ts');
  fs.writeFileSync(indexPath, HEADER_BANNER + VENDORED_INDEX, 'utf-8');
  written.push(indexPath);
  process.stdout.write(
    `[sync-core-documents] ${written.length} fichier(s) → ${path.relative(REPO_ROOT, VENDORED_DIR)}/\n`
  );
}

main();
