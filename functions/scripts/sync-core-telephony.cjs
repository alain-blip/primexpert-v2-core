#!/usr/bin/env node
/*
 * Sync @primexpert/core/telephony into functions/src/telephony/_vendored/
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..');
const CORE_DIR = path.join(REPO_ROOT, 'packages', 'core', 'src', 'telephony');
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'telephony', '_vendored');

const HEADER_BANNER = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GÉNÉRÉ — NE PAS MODIFIER.',
  ' * Source : packages/core/src/telephony/',
  ' * Régénéré : functions/scripts/sync-core-telephony.cjs (prebuild)',
  ' */',
  '',
].join('\n');

const FILES = ['types.ts', 'canUseVoip.ts'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function syncFile(name) {
  const from = path.join(CORE_DIR, name);
  if (!fs.existsSync(from)) {
    throw new Error(`[sync-core-telephony] Source manquante : ${from}`);
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
    `[sync-core-telephony] ${written.length} fichier(s) → ${path.relative(REPO_ROOT, VENDORED_DIR)}/\n`
  );
}

main();
