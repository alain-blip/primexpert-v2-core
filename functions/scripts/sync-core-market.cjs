#!/usr/bin/env node
/*
 * Sync @primexpert/core/market into functions/src/documents/_vendored/
 * SOURCE UNIQUE : packages/core/src/market/ — ne pas modifier _vendored/ à la main.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..');
const CORE_MARKET_DIR = path.join(REPO_ROOT, 'packages', 'core', 'src', 'market');
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'documents', '_vendored');

const HEADER_BANNER = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GÉNÉRÉ — NE PAS MODIFIER.',
  ' * Source : packages/core/src/market/',
  ' * Régénéré : functions/scripts/sync-core-market.cjs (prebuild)',
  ' */',
  '',
].join('\n');

const FILES = ['marketDeduplication.ts', 'marketPdfSemanticAnchors.ts'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function syncFile(name) {
  const from = path.join(CORE_MARKET_DIR, name);
  if (!fs.existsSync(from)) {
    throw new Error(`[sync-core-market] Source manquante : ${from}`);
  }
  const original = fs.readFileSync(from, 'utf-8');
  const target = path.join(VENDORED_DIR, name);
  fs.writeFileSync(target, HEADER_BANNER + original, 'utf-8');
  return target;
}

function main() {
  ensureDir(VENDORED_DIR);
  const written = FILES.map(syncFile);
  process.stdout.write(
    `[sync-core-market] ${written.length} fichier(s) → ${path.relative(REPO_ROOT, VENDORED_DIR)}/\n`
  );
}

main();
