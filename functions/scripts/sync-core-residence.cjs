#!/usr/bin/env node
/*
 * Sync @primexpert/core/residence (listing off-market) → functions/src/centris/_vendored/
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..');
const CORE_RESIDENCE_DIR = path.join(REPO_ROOT, 'packages', 'core', 'src', 'residence');
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'centris', '_vendored');

const HEADER_BANNER = [
  '/* eslint-disable */',
  '/** AUTO-GÉNÉRÉ — packages/core/src/residence/ — sync-core-residence.cjs */',
  '',
].join('\n');

const FILES = ['listingSource.ts', 'inscriptionBrokerageStatus.ts'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function syncFile(name) {
  const from = path.join(CORE_RESIDENCE_DIR, name);
  if (!fs.existsSync(from)) {
    throw new Error(`[sync-core-residence] Source manquante : ${from}`);
  }
  const target = path.join(VENDORED_DIR, name);
  fs.writeFileSync(target, HEADER_BANNER + fs.readFileSync(from, 'utf-8'), 'utf-8');
  return target;
}

function main() {
  ensureDir(VENDORED_DIR);
  const written = FILES.map(syncFile);
  process.stdout.write(
    `[sync-core-residence] ${written.length} fichier(s) → ${path.relative(REPO_ROOT, VENDORED_DIR)}/\n`
  );
}

main();
