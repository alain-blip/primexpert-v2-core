import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(
  __dirname,
  '../../00_RPA_SYSTEME_APP/Copilote-RPA/src/utils/marketContextUtils.js'
);
const outPath = join(__dirname, '../packages/core/src/financial/regionsQuebec.ts');

const src = readFileSync(srcPath, 'utf8');
const start = src.indexOf('export const REGIONS_QUEBEC = ');
const end = src.indexOf('\n};', start) + 3;
const block = src.slice(start + 'export const REGIONS_QUEBEC = '.length, end - 1);
// eslint-disable-next-line no-new-func
const REGIONS_QUEBEC = Function(`return (${block})`)();

const header = `/** Régions sociosanitaires QC — port Copilote (ISQ/MSSS 2024). */\n\nexport interface QuebecRegionRow {\n  code: string;\n  name: string;\n  aliases: string[];\n  dominantCity: string;\n  population70plus: number;\n  rpaUnits: number;\n  refYear: number;\n  isSubregionOf?: string | null;\n}\n\nexport const REGIONS_QUEBEC: Record<string, QuebecRegionRow> = `;

writeFileSync(outPath, header + JSON.stringify(REGIONS_QUEBEC, null, 2) + ';\n');
console.log('Wrote', outPath, Object.keys(REGIONS_QUEBEC).length, 'regions');
