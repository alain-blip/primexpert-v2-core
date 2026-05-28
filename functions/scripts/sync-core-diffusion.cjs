#!/usr/bin/env node
/*
 * Sync core diffusion sources into functions/src/diffusion/_vendored/.
 *
 * RAISON : functions/ est un package npm indépendant sans accès au monorepo
 * lors du déploiement Firebase (Cloud Build ne reçoit que le dossier
 * functions/). On vendore donc les sources canoniques du core diffusion
 * AUTOMATIQUEMENT avant chaque build via le script `prebuild` de
 * functions/package.json.
 *
 * SOURCE UNIQUE DE VÉRITÉ : packages/core/src/diffusion/ — ne JAMAIS modifier
 * directement les fichiers du dossier _vendored/.
 *
 * Files copied :
 *   packages/core/src/diffusion/types.ts                → _vendored/types.ts
 *   packages/core/src/diffusion/villeToSecteur.ts       → _vendored/villeToSecteur.ts
 *   packages/core/src/diffusion/priceRanges.ts          → _vendored/priceRanges.ts
 *   packages/core/src/diffusion/anonymizeResidence.ts   → _vendored/anonymizeResidence.ts
 *   packages/core/src/diffusion/publicationGuardrails.ts → _vendored/publicationGuardrails.ts
 *   packages/core/src/diffusion/index.ts                → _vendored/index.ts
 *   packages/core/src/financial/safeNumbers.ts          → _vendored/safeNumbers.ts
 *
 * Rewrite : `from '../financial/safeNumbers'` → `from './safeNumbers'`
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '..');
const CORE_DIFFUSION_DIR = path.join(REPO_ROOT, 'packages', 'core', 'src', 'diffusion');
const CORE_FINANCIAL_DIR = path.join(REPO_ROOT, 'packages', 'core', 'src', 'financial');
const VENDORED_DIR = path.join(FUNCTIONS_DIR, 'src', 'diffusion', '_vendored');

const HEADER_BANNER = [
  '/* eslint-disable */',
  '/**',
  ' * AUTO-GÉNÉRÉ — NE PAS MODIFIER.',
  ' *',
  ' * Source canonique : packages/core/src/diffusion/',
  ' * Régénéré par   : functions/scripts/sync-core-diffusion.cjs (prebuild)',
  ' */',
  '',
].join('\n');

const FILES = [
  { from: path.join(CORE_DIFFUSION_DIR, 'types.ts'), to: 'types.ts' },
  { from: path.join(CORE_DIFFUSION_DIR, 'villeToSecteur.ts'), to: 'villeToSecteur.ts' },
  { from: path.join(CORE_DIFFUSION_DIR, 'priceRanges.ts'), to: 'priceRanges.ts' },
  { from: path.join(CORE_DIFFUSION_DIR, 'anonymizeResidence.ts'), to: 'anonymizeResidence.ts' },
  { from: path.join(CORE_DIFFUSION_DIR, 'publicationGuardrails.ts'), to: 'publicationGuardrails.ts' },
  { from: path.join(CORE_DIFFUSION_DIR, 'index.ts'), to: 'index.ts' },
  {
    from: path.join(CORE_DIFFUSION_DIR, 'publicBuyerDisclosures.ts'),
    to: 'publicBuyerDisclosures.ts',
  },
  {
    from: path.join(CORE_DIFFUSION_DIR, 'transactionBanner.ts'),
    to: 'transactionBanner.ts',
  },
  {
    from: path.join(CORE_DIFFUSION_DIR, 'buyerPreviewKpis.ts'),
    to: 'buyerPreviewKpis.ts',
  },
  {
    from: path.join(CORE_DIFFUSION_DIR, 'formatPublicListingHeadline.ts'),
    to: 'formatPublicListingHeadline.ts',
  },
  { from: path.join(CORE_FINANCIAL_DIR, 'safeNumbers.ts'), to: 'safeNumbers.ts' },
  {
    from: path.join(CORE_FINANCIAL_DIR, 'bankingSubscriptionLimits.ts'),
    to: 'bankingSubscriptionLimits.ts',
  },
];

function rewriteImports(source) {
  return source
    .replace(/from\s+['"]\.\.\/financial\/safeNumbers['"]/g, "from './safeNumbers'")
    .replace(
      /from\s+['"]\.\.\/financial\/normalizeFinancialData['"]/g,
      "from './financialCalcTypes'"
    )
    .replace(
      /from\s+['"]\.\.\/financial\/bankingSubscriptionLimits['"]/g,
      "from './bankingSubscriptionLimits'"
    )
    .replace(
      /from\s+['"]\.\/normalizeFinancialData['"]/g,
      "from './financialCalcTypes'"
    );
}

/** Sous-ensemble de FinancialCalc pour buyerPreviewKpis (évite vendor normalizeFinancialData entier). */
function writeFinancialCalcTypes() {
  const body = `export interface FinancialCalc {
  revenuNetExploitation?: number | null;
  cashFlow?: number | null;
  empruntMaxTransaction?: number | null;
  empruntMaxDSCR?: number | null;
  hypothequeMaxRecommandee?: number | null;
  miseDeFondsRequise?: number | null;
  [key: string]: unknown;
}
`;
  const target = path.join(VENDORED_DIR, 'financialCalcTypes.ts');
  fs.writeFileSync(target, HEADER_BANNER + body, 'utf-8');
  return target;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function syncFile({ from, to }) {
  if (!fs.existsSync(from)) {
    throw new Error(`[sync-core-diffusion] Source manquante : ${from}`);
  }
  const original = fs.readFileSync(from, 'utf-8');
  const rewritten = HEADER_BANNER + rewriteImports(original);
  const target = path.join(VENDORED_DIR, to);
  fs.writeFileSync(target, rewritten, 'utf-8');
  return target;
}

function main() {
  ensureDir(VENDORED_DIR);
  const written = [...FILES.map(syncFile), writeFinancialCalcTypes()];
  process.stdout.write(
    `[sync-core-diffusion] ${written.length} fichier(s) vendorés depuis @primexpert/core/diffusion → ${path.relative(REPO_ROOT, VENDORED_DIR)}/\n`
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(`[sync-core-diffusion] ${err && err.message ? err.message : err}\n`);
  process.exit(1);
}
