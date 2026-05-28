#!/usr/bin/env node
/*
 * Sync @primexpert/core/crm (moteurs cron) → functions/src/cron/_vendored/
 * SOURCE UNIQUE : packages/core/src/crm/ — ne pas modifier _vendored/ à la main.
 *
 * Fichiers SSOT :
 *   - radarOpportunitesEngine.ts
 *   - hotLeadsEngine.ts
 *   - morningBriefing.ts (agrégateur requis par morningBriefingGenerator — compile only)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..');
const CORE_CRM_DIR = path.join(REPO_ROOT, 'packages', 'core', 'src', 'crm');
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'cron', '_vendored');

const HEADER_BANNER = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GÉNÉRÉ — NE PAS MODIFIER.',
  ' * Source : packages/core/src/crm/',
  ' * Régénéré : functions/scripts/sync-core-crm.cjs (prebuild)',
  ' */',
  '',
].join('\n');

/** Moteurs SSOT (spec v2026.2) + morningBriefing (import cron existant). */
const FILES = ['radarOpportunitesEngine.ts', 'hotLeadsEngine.ts', 'morningBriefing.ts'];

function purgeVendoredDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function transformHotLeadsEngine(source) {
  if (!source.includes("from '../mail'")) {
    return source;
  }
  return source.replace(
    /import type \{ CommunicationChannel \} from '\.\.\/mail';\s*\n/,
    "type CommunicationChannel = 'email' | 'sms' | 'whatsapp' | 'messenger' | 'voice' | 'portal' | string;\n\n"
  );
}

function syncFile(name) {
  const from = path.join(CORE_CRM_DIR, name);
  if (!fs.existsSync(from)) {
    throw new Error(`[sync-core-crm] Source manquante : ${from}`);
  }
  let original = fs.readFileSync(from, 'utf-8');
  if (name === 'hotLeadsEngine.ts') {
    original = transformHotLeadsEngine(original);
  }
  const target = path.join(VENDORED_DIR, name);
  fs.writeFileSync(target, HEADER_BANNER + original, 'utf-8');
  return target;
}

function main() {
  purgeVendoredDir(VENDORED_DIR);
  const written = FILES.map(syncFile);
  process.stdout.write(
    `[sync-core-crm] ${written.length} fichier(s) → ${path.relative(REPO_ROOT, VENDORED_DIR)}/\n`
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(`[sync-core-crm] ${err?.message ?? err}\n`);
  process.exit(1);
}
