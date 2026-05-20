#!/usr/bin/env node
/*
 * Sync @primexpert/core/mail into functions/src/nylas/_vendored/mail/
 * SOURCE UNIQUE : packages/core/src/mail/ — ne pas modifier _vendored/ à la main.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..');
const CORE_MAIL_DIR = path.join(REPO_ROOT, 'packages', 'core', 'src', 'mail');
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'nylas', '_vendored', 'mail');

const HEADER_BANNER = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GÉNÉRÉ — NE PAS MODIFIER.',
  ' * Source : packages/core/src/mail/',
  ' * Régénéré : functions/scripts/sync-core-mail.cjs (prebuild)',
  ' */',
  '',
].join('\n');

const FILES = ['types.ts', 'mailParser.ts', 'index.ts'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function syncFile(name) {
  const from = path.join(CORE_MAIL_DIR, name);
  if (!fs.existsSync(from)) {
    throw new Error(`[sync-core-mail] Source manquante : ${from}`);
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
    `[sync-core-mail] ${written.length} fichier(s) → ${path.relative(REPO_ROOT, VENDORED_DIR)}/\n`
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(`[sync-core-mail] ${err?.message ?? err}\n`);
  process.exit(1);
}
