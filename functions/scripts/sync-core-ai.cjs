#!/usr/bin/env node
/*
 * Sync @primexpert/core/ai (+ audio/transcriber pour extractJsonObject) → functions/src/audio/_vendored/
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..');
const CORE_AI = path.join(REPO_ROOT, 'packages', 'core', 'src', 'ai');
const CORE_AUDIO = path.join(REPO_ROOT, 'packages', 'core', 'src', 'audio');
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'audio', '_vendored');
const AI_VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'ai', '_vendored');

const HEADER = [
  '/* eslint-disable */',
  '/** AUTO-GÉNÉRÉ — sync-core-ai.cjs */',
  '',
].join('\n');

function writeVendored(name, fromPath, rewriteImports) {
  let src = fs.readFileSync(fromPath, 'utf-8');
  if (rewriteImports) {
    src = src.replace("from '../audio/transcriber'", "from './transcriber'");
  }
  fs.mkdirSync(VENDORED_DIR, { recursive: true });
  fs.writeFileSync(path.join(VENDORED_DIR, name), HEADER + src, 'utf-8');
}

writeVendored('voiceParser.ts', path.join(CORE_AI, 'voiceParser.ts'), true);
writeVendored('transcriber.ts', path.join(CORE_AUDIO, 'transcriber.ts'), false);

const index = [
  "export * from './voiceParser';",
  "export * from './transcriber';",
  '',
].join('\n');
fs.writeFileSync(path.join(VENDORED_DIR, 'index.ts'), HEADER + index, 'utf-8');

function writeAiVendored(name, fromPath) {
  let src = fs.readFileSync(fromPath, 'utf-8');
  src = src.replace(
    "from '../audio/transcriber'",
    "from '../../audio/_vendored/transcriber'"
  );
  fs.mkdirSync(AI_VENDORED_DIR, { recursive: true });
  fs.writeFileSync(path.join(AI_VENDORED_DIR, name), HEADER + src, 'utf-8');
}

writeAiVendored('oaciqSpecsTypes.ts', path.join(CORE_AI, 'oaciqSpecsTypes.ts'));
writeAiVendored('negotiationPrompts.ts', path.join(CORE_AI, 'negotiationPrompts.ts'));

const aiIndex = [
  "export * from './oaciqSpecsTypes';",
  "export * from './negotiationPrompts';",
  '',
].join('\n');
fs.writeFileSync(path.join(AI_VENDORED_DIR, 'index.ts'), HEADER + aiIndex, 'utf-8');

console.info('[sync-core-ai] OK →', VENDORED_DIR, '+', AI_VENDORED_DIR);
