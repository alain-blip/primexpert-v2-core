/**
 * Migration des sous-collections Firestore Copilote → Primexpert V2.
 *
 * Copie pour chaque résidence ciblée :
 *   - residences/{id}/financial/*  (ex. dataV2)
 *   - residences/{id}/documents/*
 *
 * Prérequis : serviceAccountOld.json (Copilote) + serviceAccountNew.json (V2).
 *
 * Usage :
 *   node migrate_financial_subcollections.js --dry-run --uid=bYwUG6mxNmPcvK9Xz2Uuy4FxqD83
 *   node migrate_financial_subcollections.js --uid=bYwUG6mxNmPcvK9Xz2Uuy4FxqD83
 *   node migrate_financial_subcollections.js --residence-id=ABC123 --dry-run
 *   node migrate_financial_subcollections.js --uid=... --only=financial
 *   node migrate_financial_subcollections.js --uid=... --skip-existing
 *
 * Variables d'environnement :
 *   SRC_SERVICE_ACCOUNT, DST_SERVICE_ACCOUNT
 *   FIRESTORE_SRC_DATABASE_ID, FIRESTORE_DST_DATABASE_ID (défaut base nommée V2)
 *   BROKER_UID (= --uid)
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DST_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const TENANT_FIELD = 'courtiersResponsables';
const COLLECTION = 'residences';
const DEFAULT_SUBCOLLECTIONS = ['financial', 'documents'];
const BATCH_MAX = 400;

const dryRun = process.argv.includes('--dry-run');
const skipExisting = process.argv.includes('--skip-existing');

const uidArg = process.argv.find((a) => a.startsWith('--uid='));
const residenceIdArg = process.argv.find((a) => a.startsWith('--residence-id='));
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const limitArg = process.argv.find((a) => a.startsWith('--limit='));

const targetUid = (process.env.BROKER_UID || uidArg?.slice('--uid='.length) || '').trim();
const singleResidenceId = (residenceIdArg?.slice('--residence-id='.length) || '').trim();
const limitN = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : 0;

const subcollections = onlyArg
  ? onlyArg
      .slice('--only='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : DEFAULT_SUBCOLLECTIONS;

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').trim();
  if (raw.startsWith('{\\rtf') || raw.startsWith('{\rtf')) {
    throw new Error(`Fichier RTF détecté : ${path}`);
  }
  return JSON.parse(raw);
}

function stripUndefinedDeep(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Timestamp) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    const next = stripUndefinedDeep(v);
    if (next !== undefined) out[k] = next;
  }
  return out;
}

function resolveAccountPath(envName, fallback) {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(__dirname, fallback);
}

async function listTargetResidenceIds(dstFs) {
  if (singleResidenceId) {
    const root = await dstFs.collection(COLLECTION).doc(singleResidenceId).get();
    if (!root.exists) {
      throw new Error(`Résidence introuvable en cible : ${singleResidenceId}`);
    }
    return [singleResidenceId];
  }

  if (!targetUid) {
    throw new Error('Précise --uid=TON_UID_V2 ou --residence-id=...');
  }

  const snap = await dstFs
    .collection(COLLECTION)
    .where(TENANT_FIELD, '==', targetUid)
    .get();

  return snap.docs.map((d) => d.id);
}

async function copySubcollection({ srcFs, dstFs, residenceId, subName, stats }) {
  const srcColRef = srcFs.collection(COLLECTION).doc(residenceId).collection(subName);
  const srcSnap = await srcColRef.get();

  if (srcSnap.empty) {
    stats.missingSubcollections += 1;
    return;
  }

  for (const srcDoc of srcSnap.docs) {
    const dstRef = dstFs
      .collection(COLLECTION)
      .doc(residenceId)
      .collection(subName)
      .doc(srcDoc.id);

    stats.docsScanned += 1;

    if (skipExisting) {
      const existing = await dstRef.get();
      if (existing.exists) {
        stats.docsSkipped += 1;
        continue;
      }
    }

    const payload = stripUndefinedDeep(srcDoc.data());
    if (!payload || Object.keys(payload).length === 0) {
      stats.docsEmpty += 1;
      continue;
    }

    if (dryRun) {
      stats.docsWouldWrite += 1;
      if (subName === 'financial' && srcDoc.id === 'dataV2') {
        stats.financialDataV2Found += 1;
      }
      continue;
    }

    stats.pendingWrites.push({ ref: dstRef, data: payload });
    if (subName === 'financial' && srcDoc.id === 'dataV2') {
      stats.financialDataV2Written += 1;
    }
  }
}

async function flushWrites(dstFs, pending, stats) {
  if (pending.length === 0) return;

  let batch = dstFs.batch();
  let inBatch = 0;

  for (const { ref, data } of pending) {
    batch.set(ref, data, { merge: true });
    inBatch += 1;
    stats.docsWritten += 1;

    if (inBatch >= BATCH_MAX) {
      await batch.commit();
      batch = dstFs.batch();
      inBatch = 0;
    }
  }

  if (inBatch > 0) await batch.commit();
}

async function main() {
  const srcPath = resolveAccountPath('SRC_SERVICE_ACCOUNT', 'serviceAccountOld.json');
  const dstPath = resolveAccountPath('DST_SERVICE_ACCOUNT', 'serviceAccountNew.json');

  for (const p of [srcPath, dstPath]) {
    if (!existsSync(p)) throw new Error(`Fichier introuvable : ${p}`);
  }

  const srcDbId = process.env.FIRESTORE_SRC_DATABASE_ID?.trim() || '';
  const dstDbId = process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DST_DB;

  const oldSa = loadJson(srcPath);
  const newSa = loadJson(dstPath);

  for (const name of ['fin-mig-src', 'fin-mig-dst']) {
    const existing = getApps().find((a) => a.name === name);
    if (existing) await deleteApp(existing);
  }

  const srcApp = initializeApp({ credential: cert(oldSa) }, 'fin-mig-src');
  const dstApp = initializeApp({ credential: cert(newSa) }, 'fin-mig-dst');

  const srcFs = srcDbId ? getFirestore(srcApp, srcDbId) : getFirestore(srcApp);
  const dstFs = dstDbId ? getFirestore(dstApp, dstDbId) : getFirestore(dstApp);

  console.log(`Source      : ${oldSa.project_id} / DB "${srcDbId || '(default)'}"`);
  console.log(`Destination : ${newSa.project_id} / DB "${dstDbId || '(default)'}"`);
  console.log(`Sous-colls  : ${subcollections.join(', ')}`);
  console.log(
    dryRun
      ? 'Mode        : DRY-RUN (aucune écriture)\n'
      : `Mode        : ÉCRITURE${skipExisting ? ' (skip-existing)' : ''}\n`
  );

  let residenceIds = await listTargetResidenceIds(dstFs);
  if (limitN > 0) residenceIds = residenceIds.slice(0, limitN);

  console.log(`Résidences ciblées (cible V2) : ${residenceIds.length}\n`);

  const stats = {
    residencesProcessed: 0,
    residencesWithData: 0,
    missingSubcollections: 0,
    docsScanned: 0,
    docsWouldWrite: 0,
    docsWritten: 0,
    docsSkipped: 0,
    docsEmpty: 0,
    financialDataV2Found: 0,
    financialDataV2Written: 0,
    pendingWrites: [],
    errors: [],
  };

  for (const residenceId of residenceIds) {
    stats.residencesProcessed += 1;
    let hadData = false;

    for (const subName of subcollections) {
      const before = stats.docsScanned;
      try {
        await copySubcollection({ srcFs, dstFs, residenceId, subName, stats });
      } catch (err) {
        stats.errors.push({ residenceId, subName, message: err?.message || String(err) });
        continue;
      }
      if (stats.docsScanned > before) hadData = true;
    }

    if (hadData) stats.residencesWithData += 1;

    if (!dryRun && stats.pendingWrites.length >= BATCH_MAX) {
      const chunk = stats.pendingWrites.splice(0, BATCH_MAX);
      await flushWrites(dstFs, chunk, stats);
    }

    if (stats.residencesProcessed % 25 === 0) {
      console.log(`  … ${stats.residencesProcessed}/${residenceIds.length} résidences traitées`);
    }
  }

  if (!dryRun && stats.pendingWrites.length > 0) {
    await flushWrites(dstFs, stats.pendingWrites.splice(0), stats);
  }

  console.log('\n--- Résumé ---');
  console.log(`Résidences traitées     : ${stats.residencesProcessed}`);
  console.log(`Avec données source     : ${stats.residencesWithData}`);
  console.log(`Docs lus (source)       : ${stats.docsScanned}`);
  if (dryRun) {
    console.log(`Docs qui seraient écrits: ${stats.docsWouldWrite}`);
    console.log(`financial/dataV2 trouvés: ${stats.financialDataV2Found}`);
  } else {
    console.log(`Docs écrits             : ${stats.docsWritten}`);
    console.log(`Docs ignorés (existants): ${stats.docsSkipped}`);
    console.log(`financial/dataV2 écrits : ${stats.financialDataV2Written}`);
  }
  console.log(`Docs vides ignorés      : ${stats.docsEmpty}`);
  if (stats.errors.length) {
    console.log(`Erreurs                 : ${stats.errors.length}`);
    for (const e of stats.errors.slice(0, 10)) {
      console.log(`  - ${e.residenceId}/${e.subName}: ${e.message}`);
    }
  }

  await deleteApp(srcApp);
  await deleteApp(dstApp);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
