#!/usr/bin/env node
/**
 * Ghost Billing — génération facture PDF côté Node (sans navigateur).
 * Usage : node scripts/generate-invoice-sample.mjs [sous-total]
 * Ex. : node scripts/generate-invoice-sample.mjs 175
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

const COMPANY = {
  name: 'Primexpert Inc. (En attente)',
  neq: 'NEQ-XXXXXXXXXXXXXXXXX',
  tpsNumber: 'TPS-XXXXXXXXX-RT0001',
  tvqNumber: 'TVQ-XXXXXXXXX-TQ0001',
  email: 'comptabilite@primexpert.ca',
  address: 'À venir, Québec, Canada',
};

function roundCad(n) {
  return Math.round(n * 100) / 100;
}

function computeTaxes(subtotal) {
  const subtotalCad = roundCad(subtotal);
  const tpsCad = roundCad(subtotalCad * TPS_RATE);
  const tvqCad = roundCad(subtotalCad * TVQ_RATE);
  const totalCad = roundCad(subtotalCad + tpsCad + tvqCad);
  return { subtotalCad, tpsCad, tvqCad, totalCad };
}

const subtotal = Number(process.argv[2] || 175);
const taxes = computeTaxes(subtotal);

const lines = [
  `FACTURE PRIMEXPERT (échantillon)`,
  ``,
  `${COMPANY.name}`,
  `${COMPANY.address}`,
  `NEQ: ${COMPANY.neq}`,
  `TPS: ${COMPANY.tpsNumber}`,
  `TVQ: ${COMPANY.tvqNumber}`,
  ``,
  `Sous-total : ${taxes.subtotalCad.toFixed(2)} $`,
  `TPS (5 %)   : ${taxes.tpsCad.toFixed(2)} $`,
  `TVQ (9,975 %): ${taxes.tvqCad.toFixed(2)} $`,
  `TOTAL       : ${taxes.totalCad.toFixed(2)} $`,
  ``,
  `→ Utiliser downloadInvoicePdf() dans l'app pour un PDF formaté.`,
];

const outDir = dirname(fileURLToPath(import.meta.url));
const outPath = join(outDir, '..', 'dist', 'invoice-sample.txt');
writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(lines.join('\n'));
console.log(`\nÉcrit : ${outPath}`);
