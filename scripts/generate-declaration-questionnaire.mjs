/**
 * Génère packages/core/src/declaration/questionnaire.ts depuis Copilote dvRpaMapping.js
 * Source : 00_RPA_SYSTEME_APP/Copilote-RPA/src/config/dvRpaMapping.js
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DV_SECTIONS, DV_FIELD_MAPPING } from 'file:///Volumes/SAUVEGARDE%20GRIS%201/00_RPA_SYSTEME_APP/Copilote-RPA/src/config/dvRpaMapping.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../packages/core/src/declaration/questionnaire.ts');

function escapeStr(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const sections = Object.values(DV_SECTIONS)
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  .map((s) => ({
    id: s.id,
    titleFr: s.title,
    titleEn: s.title,
    category: s.category,
    sectionOptional: !!s.optional,
    questions: [],
  }));

const sectionMap = Object.fromEntries(sections.map((s) => [s.id, s]));

for (const [wordField, m] of Object.entries(DV_FIELD_MAPPING)) {
  const sec = sectionMap[m.section];
  if (!sec) {
    console.warn('Section manquante:', m.section, wordField);
    continue;
  }
  sec.questions.push({
    id: wordField,
    firestorePath: m.firestoreField,
    labelFr: m.label,
    labelEn: m.label,
    fieldType: m.type,
    optional: !!(m.optional || m.isConditional),
    subSection: m.subSection ?? null,
  });
}

const total = sections.reduce((n, s) => n + s.questions.length, 0);

const lines = [];
lines.push(`/**`);
lines.push(` * Questionnaire Déclaration du Vendeur RPA — sections D1 à D25.`);
lines.push(` * Généré depuis Copilote dvRpaMapping.js (${total} champs).`);
lines.push(` * Regénérer : node scripts/generate-declaration-questionnaire.mjs`);
lines.push(` */`);
lines.push('');
lines.push(`import type { DeclarationSectionDef } from './types';`);
lines.push('');
lines.push(`export const DECLARATION_SECTION_COUNT = 25;`);
lines.push('');
lines.push(`export const DECLARATION_SECTIONS: DeclarationSectionDef[] = [`);

for (const s of sections) {
  lines.push(`  {`);
  lines.push(`    id: '${s.id}',`);
  lines.push(`    titleFr: '${escapeStr(s.titleFr)}',`);
  lines.push(`    titleEn: '${escapeStr(s.titleEn)}',`);
  lines.push(`    category: '${s.category}',`);
  if (s.sectionOptional) lines.push(`    sectionOptional: true,`);
  lines.push(`    questions: [`);
  for (const q of s.questions) {
    lines.push(`      {`);
    lines.push(`        id: '${q.id}',`);
    lines.push(`        firestorePath: '${escapeStr(q.firestorePath)}',`);
    lines.push(`        labelFr: '${escapeStr(q.labelFr)}',`);
    lines.push(`        labelEn: '${escapeStr(q.labelEn)}',`);
    lines.push(`        fieldType: '${q.fieldType}',`);
    if (q.optional) lines.push(`        optional: true,`);
    if (q.subSection) lines.push(`        subSection: '${q.subSection}',`);
    lines.push(`      },`);
  }
  lines.push(`    ],`);
  lines.push(`  },`);
}

lines.push(`];`);
lines.push('');
lines.push(`export const ALL_DECLARATION_QUESTION_IDS: string[] = DECLARATION_SECTIONS.flatMap(`);
lines.push(`  (s) => s.questions.map((q) => q.id)`);
lines.push(`);`);
lines.push('');
lines.push(`export const DECLARATION_REQUIRED_QUESTION_IDS: string[] = DECLARATION_SECTIONS.flatMap(`);
lines.push(`  (s) => s.questions.filter((q) => !q.optional).map((q) => q.id)`);
lines.push(`);`);

writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`Wrote ${OUT} (${total} questions, ${sections.length} sections)`);
