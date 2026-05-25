/**
 * Import one-off : contacts + vendors + buyerPipeline (aplati) → organizations/{orgId}/contacts (V2).
 *
 * Règles : docs/DATA_MAPPING_LEGACY_V2.md (Phase 1 — Maillon contacts)
 *   A. Fusion contacts/ + vendors/ (dédoublonnage courriel / téléphone)
 *   B. Aplatissement buyerPipeline/ sur buyerQualificationStatus + buyerCriteria (aucune collection V2)
 *   C. orgId + ownerId (courtierResponsable legacy ou --owner-id)
 *
 * Prérequis :
 *   - serviceAccountOld.json (lecture Copilote)
 *   - serviceAccountNew.json (écriture primexpert-app-v2)
 *
 * Dry-run par défaut. --execute pour écrire (feu vert PO requis).
 *
 * Usage :
 *   npx tsx scripts/migrate-legacy-contacts-to-v2.mjs --org-id=ORG --owner-id=UID
 *   npx tsx scripts/migrate-legacy-contacts-to-v2.mjs --org-id=... --owner-id=... --execute
 *   npx tsx scripts/migrate-legacy-contacts-to-v2.mjs --limit=50
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import {
  buildLegacyContactMigrationPlan,
  deterministicImportContactId,
} from '../packages/core/src/crm/legacyContactImport.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_DST_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const DEFAULT_OWNER_ID = 'bYwUG6mxNmPcvK9Xz2Uuy4FxqD83';
const BATCH_MAX = 400;

const execute = process.argv.includes('--execute');
const dryRun = !execute;

const orgIdArg = process.argv.find((a) => a.startsWith('--org-id='));
const ownerIdArg = process.argv.find((a) => a.startsWith('--owner-id='));
const visibilityArg = process.argv.find((a) => a.startsWith('--visibility='));
const limitArg = process.argv.find((a) => a.startsWith('--limit='));

const orgId = (process.env.MIGRATE_ORG_ID || orgIdArg?.slice('--org-id='.length) || '').trim();
const ownerId = (
  process.env.MIGRATE_OWNER_ID ||
  ownerIdArg?.slice('--owner-id='.length) ||
  DEFAULT_OWNER_ID
).trim();
const visibility = (visibilityArg?.slice('--visibility='.length) || 'AGENCY_SHARED').trim();
const limitN = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : 0;

if (!orgId) {
  console.error(
    'Précisez --org-id=ORG_FIRESTORE (JWT orgId) ou MIGRATE_ORG_ID dans l’environnement.'
  );
  process.exit(1);
}

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').trim();
  if (raw.startsWith('{\\rtf') || raw.startsWith('{\rtf')) {
    throw new Error(`Fichier RTF détecté : ${path}`);
  }
  return JSON.parse(raw);
}

function resolveAccountPath(envName, fallback) {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(ROOT, fallback);
}

function stripUndefinedDeep(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Timestamp) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    const next = stripUndefinedDeep(v);
    if (next !== undefined) out[k] = next;
  }
  return out;
}

async function fetchLegacyCollection(fs, name) {
  const snap = await fs.collection(name).get();
  return snap.docs.map((d) => ({
    source: name,
    legacyId: d.id,
    data: d.data(),
  }));
}

async function main() {
  const srcPath = resolveAccountPath('SRC_SERVICE_ACCOUNT', 'serviceAccountOld.json');
  const dstPath = resolveAccountPath('DST_SERVICE_ACCOUNT', 'serviceAccountNew.json');

  for (const p of [srcPath, dstPath]) {
    if (!existsSync(p)) {
      console.error(`\n❌ Fichier introuvable : ${p}`);
      console.error(
        'Placez serviceAccountOld.json / serviceAccountNew.json à la racine du projet V2.'
      );
      process.exit(1);
    }
  }

  const srcDbId = process.env.FIRESTORE_SRC_DATABASE_ID?.trim() || '';
  const dstDbId = process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DST_DB;

  const oldSa = loadJson(srcPath);
  const newSa = loadJson(dstPath);

  for (const name of ['migrate-contacts-src', 'migrate-contacts-dst']) {
    const existing = getApps().find((a) => a.name === name);
    if (existing) await deleteApp(existing);
  }

  const srcApp = initializeApp({ credential: cert(oldSa) }, 'migrate-contacts-src');
  const dstApp = initializeApp({ credential: cert(newSa) }, 'migrate-contacts-dst');

  const srcFs = srcDbId ? getFirestore(srcApp, srcDbId) : getFirestore(srcApp);
  const dstFs = dstDbId ? getFirestore(dstApp, dstDbId) : getFirestore(dstApp);

  console.log('\n=== Migration contacts legacy → V2 (Maillon 1) ===');
  console.log(`Mode          : ${dryRun ? 'DRY-RUN (aucune écriture)' : 'EXECUTE (écriture active)'}`);
  console.log(`Source projet : ${oldSa.project_id}`);
  console.log(`Cible projet  : ${newSa.project_id}`);
  console.log(`orgId         : ${orgId}`);
  console.log(`ownerId défaut: ${ownerId}`);
  console.log(`visibility    : ${visibility}`);
  console.log(`Référence     : docs/DATA_MAPPING_LEGACY_V2.md`);

  const [contactRows, vendorRows, pipelineSnap] = await Promise.all([
    fetchLegacyCollection(srcFs, 'contacts'),
    fetchLegacyCollection(srcFs, 'vendors'),
    srcFs.collection('buyerPipeline').get().catch(() => ({ docs: [] })),
  ]);

  const pipelineRows = pipelineSnap.docs.map((d) => ({
    legacyId: d.id,
    data: d.data(),
  }));

  let contactLegacyRows = [
    ...contactRows.map((r) => ({ ...r, source: 'contacts' })),
    ...vendorRows.map((r) => ({ ...r, source: 'vendors' })),
  ];

  if (limitN > 0) {
    contactLegacyRows = contactLegacyRows.slice(0, limitN);
  }

  const ctx = { orgId, ownerId, visibility };
  const { payloads, stats } = buildLegacyContactMigrationPlan(
    contactLegacyRows,
    pipelineRows,
    ctx
  );

  const reportDir = resolve(__dirname, 'output');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, 'legacy-contacts-dry-run-report.json');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        stats,
        samplePayloads: payloads.slice(0, 5),
        sampleWithPipeline: payloads
          .filter((p) => (p.importMeta.pipelineHistory?.length ?? 0) > 0)
          .slice(0, 3),
        sampleMerged: payloads.filter((p) => p.importMeta.mergedCount > 1).slice(0, 3),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('\n--- Rapport Dry-Run ---');
  console.log(`Contacts legacy (contacts/)     : ${stats.legacyContactsCount}`);
  console.log(`Vendeurs legacy (vendors/)      : ${stats.legacyVendorsCount}`);
  console.log(`Documents buyerPipeline/        : ${stats.legacyBuyerPipelineCount}`);
  console.log(`Total brut contacts+vendors     : ${stats.legacyTotalRaw}`);
  console.log(`Groupes doublons (email/tél.)   : ${stats.duplicateGroups}`);
  console.log(`Fiches fusionnées (écart)       : ${stats.recordsMergedAway}`);
  console.log(`Fiches finales V2               : ${stats.finalReadyCount}`);
  console.log(`Pipeline liés à un contact      : ${stats.buyerPipelineLinkedCount}`);
  console.log(`Pipeline orphelins (buyerId)  : ${stats.buyerPipelineOrphanCount}`);
  console.log(`Clé dédup courriel              : ${stats.withEmailKey}`);
  console.log(`Clé dédup téléphone seul        : ${stats.withPhoneKeyOnly}`);
  console.log(`Sans clé dédup                  : ${stats.withoutDedupeKey}`);
  console.log(`LCI incomplète                  : ${stats.lciIncompleteCount}`);
  console.log(`\nRapport JSON : ${reportPath}`);

  if (dryRun) {
    console.log('\n✅ Dry-run terminé — aucune écriture Firestore.');
    console.log('Relancez avec --execute uniquement après approbation du PO (Alain).');
    await deleteApp(srcApp);
    await deleteApp(dstApp);
    return;
  }

  console.log('\n--- Injection V2 (writeBatch) ---');
  let written = 0;
  let batch = dstFs.batch();
  let inBatch = 0;
  const now = new Date().toISOString();

  for (const payload of payloads) {
    const contactId = deterministicImportContactId(payload);
    const ref = dstFs.collection('organizations').doc(orgId).collection('contacts').doc(contactId);
    const doc = stripUndefinedDeep({
      ...payload,
      updatedAt: now,
      createdAt: now,
    });
    batch.set(ref, doc, { merge: true });
    inBatch += 1;
    written += 1;
    if (inBatch >= BATCH_MAX) {
      await batch.commit();
      console.log(`  … ${written} / ${payloads.length}`);
      batch = dstFs.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log(`\n✅ ${written} contacts écrits dans organizations/${orgId}/contacts`);
  await deleteApp(srcApp);
  await deleteApp(dstApp);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
