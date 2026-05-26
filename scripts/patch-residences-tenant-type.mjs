/**
 * Patch one-shot — normalise `courtiersResponsables` array → string (canon V2).
 *
 * Contexte : Maillon 2 a écrit `[uid]` ; UI + rules exigent `uid` (string).
 *
 * Prérequis : serviceAccountNew.json
 *
 * Dry-run par défaut. --execute pour écrire.
 *
 * Usage :
 *   npx tsx scripts/patch-residences-tenant-type.mjs
 *   npx tsx scripts/patch-residences-tenant-type.mjs --execute
 *   npx tsx scripts/patch-residences-tenant-type.mjs --owner-id=bYwUG6mxNmPcvK9Xz2Uuy4FxqD83 --execute
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_DST_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const DEFAULT_OWNER_ID = 'bYwUG6mxNmPcvK9Xz2Uuy4FxqD83';
const BATCH_MAX = 400;
const UID_LIKE = /^[a-zA-Z0-9]{20,}$/;

const execute = process.argv.includes('--execute');
const dryRun = !execute;

const ownerIdArg = process.argv.find((a) => a.startsWith('--owner-id='));
const fallbackOwnerId = (
  process.env.MIGRATE_OWNER_ID ||
  ownerIdArg?.slice('--owner-id='.length) ||
  DEFAULT_OWNER_ID
).trim();

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').trim());
}

function resolveTenantString(raw, fallbackUid) {
  if (typeof raw === 'string' && raw.trim()) {
    const v = raw.trim();
    if (UID_LIKE.test(v)) return v;
    return fallbackUid;
  }
  if (Array.isArray(raw) && raw.length > 0) {
    for (const item of raw) {
      const v = String(item ?? '').trim();
      if (UID_LIKE.test(v)) return v;
    }
  }
  return fallbackUid;
}

async function main() {
  const dstPath = resolve(ROOT, 'serviceAccountNew.json');
  if (!existsSync(dstPath)) {
    console.error(`❌ Fichier introuvable : ${dstPath}`);
    process.exit(1);
  }

  const dstDbId = process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DST_DB;
  const sa = loadJson(dstPath);

  for (const name of ['patch-res-tenant']) {
    const existing = getApps().find((a) => a.name === name);
    if (existing) await deleteApp(existing);
  }

  const app = initializeApp({ credential: cert(sa) }, 'patch-res-tenant');
  const db = dstDbId ? getFirestore(app, dstDbId) : getFirestore(app);

  console.log('\n=== Patch courtiersResponsables (array → string) ===');
  console.log(`Mode        : ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`);
  console.log(`Projet      : ${sa.project_id}`);
  console.log(`Fallback UID: ${fallbackOwnerId}`);

  const snap = await db.collection('residences').get();
  const toPatch = [];
  let alreadyString = 0;
  let alreadyEmpty = 0;
  let other = 0;

  for (const doc of snap.docs) {
    const raw = doc.data().courtiersResponsables;
    if (typeof raw === 'string' && UID_LIKE.test(raw.trim())) {
      alreadyString += 1;
      continue;
    }
    if (raw === '' || raw == null) {
      alreadyEmpty += 1;
      continue;
    }
    if (Array.isArray(raw)) {
      const uid = resolveTenantString(raw, fallbackOwnerId);
      toPatch.push({ id: doc.id, from: raw, to: uid });
      continue;
    }
    other += 1;
  }

  const reportDir = resolve(__dirname, 'output');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, 'patch-residences-tenant-type-report.json');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run' : 'execute',
        scannedAt: new Date().toISOString(),
        totalResidences: snap.size,
        alreadyString,
        alreadyEmpty,
        other,
        toPatchCount: toPatch.length,
        sample: toPatch.slice(0, 10),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('\n--- Analyse ---');
  console.log(`Résidences scannées       : ${snap.size}`);
  console.log(`Déjà string (OK)          : ${alreadyString}`);
  console.log(`Catalogue vide / absent   : ${alreadyEmpty}`);
  console.log(`Autre format              : ${other}`);
  console.log(`À corriger (array→string) : ${toPatch.length}`);
  console.log(`Rapport JSON              : ${reportPath}`);

  if (toPatch.length === 0) {
    console.log('\n✅ Aucune correction nécessaire.');
    await deleteApp(app);
    return;
  }

  if (dryRun) {
    console.log('\n✅ Dry-run terminé — relancez avec --execute pour appliquer.');
    if (toPatch[0]) {
      console.log('\nExemple :');
      console.log(`  ${toPatch[0].id}`);
      console.log(`  ${JSON.stringify(toPatch[0].from)} → "${toPatch[0].to}"`);
    }
    await deleteApp(app);
    return;
  }

  console.log('\n--- Écriture Firestore ---');
  let patched = 0;
  let batchErrors = 0;
  let batch = db.batch();
  let inBatch = 0;
  const now = new Date().toISOString();

  for (const row of toPatch) {
    const ref = db.collection('residences').doc(row.id);
    batch.update(ref, {
      courtiersResponsables: row.to,
      updatedAt: now,
    });
    inBatch += 1;
    patched += 1;
    if (inBatch >= BATCH_MAX) {
      try {
        await batch.commit();
      } catch (err) {
        batchErrors += 1;
        throw err;
      }
      console.log(`  … ${patched} / ${toPatch.length}`);
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) {
    try {
      await batch.commit();
    } catch (err) {
      batchErrors += 1;
      throw err;
    }
  }

  console.log(`\n✅ ${patched} résidences corrigées — erreurs batch : ${batchErrors}`);
  await deleteApp(app);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
