#!/usr/bin/env node
/**
 * Vérifie 100 % de couverture sur resolveColumnId() — protection Kanban RPA.
 * Lit le rapport Istanbul JSON produit par vitest --coverage.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coverageDir = path.resolve(__dirname, '../coverage/rpa-transaction');
const coverageFile = path.join(coverageDir, 'coverage-final.json');

let raw;
try {
  raw = readFileSync(coverageFile, 'utf8');
} catch {
  console.error(`❌ Rapport de couverture introuvable : ${coverageFile}`);
  console.error('   Exécutez : npm run test:rpa-coverage');
  process.exit(1);
}

const coverage = JSON.parse(raw);
const targetSuffix = `${path.sep}src${path.sep}config${path.sep}pipelineStages.ts`;
const entry = Object.entries(coverage).find(([file]) => file.endsWith(targetSuffix));

if (!entry) {
  console.error(`❌ Fichier pipelineStages.ts absent du rapport de couverture.`);
  process.exit(1);
}

const [, data] = entry;
const fnMap = data.fnMap ?? {};
const f = data.f ?? {};
const branchMap = data.branchMap ?? {};
const b = data.b ?? {};

const resolveEntries = Object.entries(fnMap).filter(([, meta]) => meta.name === 'resolveColumnId');

if (resolveEntries.length === 0) {
  console.error('❌ resolveColumnId() introuvable dans fnMap — couverture 0 %.');
  process.exit(1);
}

let fnHits = 0;
let fnTotal = 0;
for (const [id] of resolveEntries) {
  fnTotal += 1;
  fnHits += f[id] > 0 ? 1 : 0;
}

const fnPct = fnTotal === 0 ? 0 : (fnHits / fnTotal) * 100;

let branchHits = 0;
let branchTotal = 0;
for (const [id, meta] of Object.entries(branchMap)) {
  if (meta.loc?.start == null) continue;
  const fnId = String(meta.loc.start.line);
  const belongsToResolve = resolveEntries.some(([rid, rmeta]) => {
    const start = rmeta.decl?.start?.line ?? rmeta.loc?.start?.line;
    const end = rmeta.decl?.end?.line ?? rmeta.loc?.end?.line;
    return start != null && end != null && meta.loc.start.line >= start && meta.loc.end.line <= end;
  });
  if (!belongsToResolve) continue;
  const counts = b[id] ?? [];
  branchTotal += counts.length;
  branchHits += counts.filter((n) => n > 0).length;
}

const branchPct = branchTotal === 0 ? 100 : (branchHits / branchTotal) * 100;

console.log(`resolveColumnId() — fonctions : ${fnPct.toFixed(1)} % (${fnHits}/${fnTotal})`);
console.log(`resolveColumnId() — branches  : ${branchPct.toFixed(1)} % (${branchHits}/${branchTotal})`);

if (fnPct < 100 || branchPct < 100) {
  console.error('❌ Couverture insuffisante sur resolveColumnId() — Kanban non protégé.');
  process.exit(1);
}

console.log('✅ resolveColumnId() — couverture 100 % confirmée.');
