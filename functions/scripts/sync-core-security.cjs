#!/usr/bin/env node
/*
 * Sync @primexpert/core/security → functions/src/security/_vendored/
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..');
const CORE_SECURITY = path.join(REPO_ROOT, 'packages', 'core', 'src', 'security');
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'security', '_vendored');

const HEADER = [
  '/* eslint-disable */',
  '/** AUTO-GÉNÉRÉ — sync-core-security.cjs */',
  '',
].join('\n');

function writeVendored(name) {
  const src = fs.readFileSync(path.join(CORE_SECURITY, name), 'utf-8');
  fs.mkdirSync(VENDORED_DIR, { recursive: true });
  fs.writeFileSync(path.join(VENDORED_DIR, name), HEADER + src, 'utf-8');
}

writeVendored('vaultSpecsTypes.ts');

const index = ["export * from './vaultSpecsTypes';", ''].join('\n');
fs.writeFileSync(path.join(VENDORED_DIR, 'index.ts'), HEADER + index, 'utf-8');

console.info('[sync-core-security] OK →', VENDORED_DIR);
