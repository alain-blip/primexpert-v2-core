/**
 * Diagnostic lecture seule — mapping résidences Legacy vs V2.
 * Usage: npx tsx scripts/diag-residence-mapping.mjs
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import {
  mapLegacyResidenceStatus,
  extractLegacyPipelineStatusRaw,
  resolveLegacyCourtiersResponsables,
} from '../packages/core/src/residence/legacyResidenceImport.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ALAIN_UID = 'bYwUG6mxNmPcvK9Xz2Uuy4FxqD83';
const DST_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';

const NAME_KEYS = [
  'nomResidence',
  'nom',
  'name',
  'residenceName',
  'nomCommercial',
  'nom_commercial',
  'commercialName',
];
const PRICE_KEYS = [
  'prixDemande',
  'askingPrice',
  'price',
  'prix',
  'prixAnnonce',
  'prixListe',
  'listPrice',
  'montant',
  'valeurEstimee',
];
const STATUS_KEYS = [
  'status',
  'statut',
  'pipelineStatus',
  'etat',
  'phase',
  'stage',
  'pipelineStage',
  'pipelineColumn',
  'columnId',
  'statutPipeline',
  'statutInscription',
  'inscriptionStatus',
];

function pickFirstString(data, keys) {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return { key: k, value: v.trim() };
  }
  return null;
}

function pickFirstNumber(data, keys) {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return { key: k, value: v };
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v.replace(/[^\d.,-]/g, '').replace(',', '.'));
      if (Number.isFinite(n) && n > 0) return { key: k, value: n };
    }
  }
  return null;
}

function inc(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

async function main() {
  const srcPath = resolve(ROOT, 'serviceAccountOld.json');
  const dstPath = resolve(ROOT, 'serviceAccountNew.json');
  if (!existsSync(srcPath) || !existsSync(dstPath)) {
    console.error('Service accounts manquants');
    process.exit(1);
  }

  const srcApp = initializeApp({ credential: cert(JSON.parse(readFileSync(srcPath, 'utf8'))) }, 'diag-src');
  const dstApp = initializeApp({ credential: cert(JSON.parse(readFileSync(dstPath, 'utf8'))) }, 'diag-dst');
  const srcFs = getFirestore(srcApp);
  const dstFs = getFirestore(dstApp, DST_DB);

  const [legacySnap, v2Snap] = await Promise.all([
    srcFs.collection('residences').get(),
    dstFs.collection('residences').get(),
  ]);

  const v2ById = new Map(v2Snap.docs.map((d) => [d.id, d.data()]));

  const legacyStatusRaw = {};
  const legacyStatusAlt = {};
  const mappedStatus = {};
  const legacyExtractEmpty = { empty: 0, hasValue: 0 };
  const namePresenceLegacy = {};
  const pricePresenceLegacy = {};
  const namePresenceV2 = {};
  const pricePresenceV2 = {};
  const mismatches = { mandateLost: [], promiseLost: [], nameInLegacyNotV2: [], priceInLegacyZeroV2: [] };

  const brokerMapped = {};
  const mandateByBroker = { [ALAIN_UID]: 0, other: 0 };
  const promiseByBroker = { [ALAIN_UID]: 0, other: 0 };

  for (const doc of legacySnap.docs) {
    const data = doc.data();
    const id = doc.id;

    const extracted = extractLegacyPipelineStatusRaw(data);
    if (!extracted) legacyExtractEmpty.empty += 1;
    else legacyExtractEmpty.hasValue += 1;

    inc(legacyStatusRaw, extracted || '(vide)');

    for (const k of STATUS_KEYS) {
      const v = data[k];
      if (v == null || v === '') continue;
      const label = `${k}=${String(v).slice(0, 40)}`;
      inc(legacyStatusAlt, label);
    }

    const { status, raw } = mapLegacyResidenceStatus(data);
    inc(mappedStatus, status);

    const broker = resolveLegacyCourtiersResponsables(data, ALAIN_UID);
    inc(brokerMapped, broker.resolvedFrom);

    const slug = String(raw || extracted).toLowerCase();
    const looksMandate =
      slug.includes('mandat') || ['mandat', 'en-mandat', 'actif', 'listed', 'mandate'].includes(slug);
    const looksPromise =
      slug.includes('promess') ||
      ['promesse', 'pa-acceptee', 'promise', 'en promesse'].some((s) => slug.includes(s));

    if (looksMandate) {
      if (broker.uid === ALAIN_UID) mandateByBroker[ALAIN_UID] += 1;
      else mandateByBroker.other += 1;
      if (status !== 'mandate') {
        mismatches.mandateLost.push({
          id,
          legacyRaw: raw,
          extracted,
          mapped: status,
          brokerUid: broker.uid,
          alt: pickFirstString(data, STATUS_KEYS),
        });
      }
    }
    if (looksPromise) {
      if (broker.uid === ALAIN_UID) promiseByBroker[ALAIN_UID] += 1;
      else promiseByBroker.other += 1;
      if (status !== 'promise') {
        mismatches.promiseLost.push({
          id,
          legacyRaw: raw,
          mapped: status,
          brokerUid: broker.uid,
        });
      }
    }

    const nameL = pickFirstString(data, NAME_KEYS);
    inc(namePresenceLegacy, nameL ? `legacy.${nameL.key}` : 'legacy.(aucun)');

    const priceL = pickFirstNumber(data, PRICE_KEYS);
    inc(pricePresenceLegacy, priceL ? `legacy.${priceL.key}` : 'legacy.(aucun)');

    const v2 = v2ById.get(id);
    if (v2) {
      const nameV = pickFirstString(v2, NAME_KEYS);
      inc(namePresenceV2, nameV ? `v2.${nameV.key}` : 'v2.(aucun)');
      const priceV = pickFirstNumber(v2, PRICE_KEYS);
      inc(pricePresenceV2, priceV ? `v2.${priceV.key}` : 'v2.(aucun)');

      if (nameL && !nameV) {
        mismatches.nameInLegacyNotV2.push({ id, legacyKey: nameL.key, legacyVal: nameL.value.slice(0, 60) });
      }
      if (priceL && !priceV) {
        mismatches.priceInLegacyZeroV2.push({
          id,
          legacyKey: priceL.key,
          legacyVal: priceL.value,
          v2Status: v2.status,
        });
      }
    }
  }

  const alainV2 = v2Snap.docs.filter((d) => d.data().courtiersResponsables === ALAIN_UID);
  const alainStatus = {};
  for (const d of alainV2) inc(alainStatus, String(d.data().status ?? d.data().statut ?? '(vide)'));

  const report = {
    counts: {
      legacy: legacySnap.size,
      v2: v2Snap.size,
      alainTenantV2: alainV2.length,
    },
    legacyExtractEmpty,
    legacyStatusRawTop: Object.entries(legacyStatusRaw)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25),
    legacyStatusAltTop: Object.entries(legacyStatusAlt)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30),
    mappedStatus,
    mandateByBroker,
    promiseByBroker,
    brokerResolvedFrom: brokerMapped,
    namePresenceLegacyTop: Object.entries(namePresenceLegacy)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12),
    pricePresenceLegacyTop: Object.entries(pricePresenceLegacy)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12),
    namePresenceV2Top: Object.entries(namePresenceV2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12),
    pricePresenceV2Top: Object.entries(pricePresenceV2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12),
    alainV2Status: alainStatus,
    samples: {
      mandateLost: mismatches.mandateLost.slice(0, 8),
      promiseLost: mismatches.promiseLost.slice(0, 8),
      nameInLegacyNotV2: mismatches.nameInLegacyNotV2.slice(0, 8),
      priceInLegacyZeroV2: mismatches.priceInLegacyZeroV2.slice(0, 8),
      emptyStatusWithMandateHint: [],
    },
  };

  mkdirSync(resolve(__dirname, 'output'), { recursive: true });
  const outPath = resolve(__dirname, 'output', 'diag-residence-mapping-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nRapport : ${outPath}`);

  await deleteApp(srcApp);
  await deleteApp(dstApp);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
