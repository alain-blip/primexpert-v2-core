/**
 * Purge des doublons d'import — organizations/{orgId}/contacts
 *
 * Contexte : double import Maillon 1 (schéma d'ID `imp_*` ancien vs nouveau).
 * Détection : union par courriel normalisé et/ou legacySources[0].id.
 * Conservation : fiche la plus récente (createdAt) ; ex-aequo → schéma ID actuel
 *   (`imp_{hash}_{legacyId}` — aligné sur deterministicImportContactId).
 *
 * Prérequis : serviceAccountNew.json (primexpert-app-v2)
 *
 * Dry-run par défaut. --execute pour supprimer (feu vert PO requis).
 *
 * Usage :
 *   npx tsx scripts/cleanup-duplicate-contacts.mjs --org-id=org_...
 *   npx tsx scripts/cleanup-duplicate-contacts.mjs --org-id=... --execute
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_DST_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const BATCH_MAX = 400;

const execute = process.argv.includes('--execute');
const dryRun = !execute;

const orgIdArg = process.argv.find((a) => a.startsWith('--org-id='));
const orgId = (process.env.MIGRATE_ORG_ID || orgIdArg?.slice('--org-id='.length) || '').trim();

if (!orgId) {
  console.error('Précisez --org-id=ORG_FIRESTORE (ex. org_bYwUG6mxNmPcvK9Xz2Uuy4FxqD83).');
  process.exit(1);
}

/** Schéma actuel Maillon 1 : imp_{hash}_{legacyPrefix} */
function isCurrentImportIdSchema(docId) {
  return /^imp_[0-9a-f]+_[A-Za-z0-9_]{4,}$/i.test(docId);
}

/** Ancien schéma (import 2026-05-20) : imp_{hash} sans suffixe legacy */
function isLegacyImportIdSchema(docId) {
  return /^imp_[0-9a-f]+$/i.test(docId) && !isCurrentImportIdSchema(docId);
}

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').trim();
  if (raw.startsWith('{\\rtf') || raw.startsWith('{\rtf')) {
    throw new Error(`Fichier RTF détecté : ${path}`);
  }
  return JSON.parse(raw);
}

function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return v && v.includes('@') ? v : null;
}

function primaryLegacyId(data) {
  const sources = data?.importMeta?.legacySources;
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const first = sources[0];
  const id = first?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function parseCreatedAtMillis(data) {
  const raw = data?.createdAt ?? data?.updatedAt;
  if (!raw) return 0;
  if (raw instanceof Timestamp) return raw.toMillis();
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof raw?.toDate === 'function') return raw.toDate().getTime();
  return 0;
}

function createdAtIso(data) {
  const ms = parseCreatedAtMillis(data);
  return ms ? new Date(ms).toISOString() : null;
}

/** Score de rétention (plus élevé = à conserver). */
function retentionScore(row) {
  const ms = parseCreatedAtMillis(row.data);
  const schemaBonus = isCurrentImportIdSchema(row.id) ? 2 : isLegacyImportIdSchema(row.id) ? 0 : 1;
  return ms * 10 + schemaBonus;
}

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i) {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

function pickKeeperAndVictims(members) {
  const sorted = [...members].sort((a, b) => retentionScore(b) - retentionScore(a));
  const keeper = sorted[0];
  const toDelete = sorted.slice(1);
  return { keeper, toDelete };
}

async function main() {
  const dstPath = process.env.DST_SERVICE_ACCOUNT?.trim()
    ? resolve(process.env.DST_SERVICE_ACCOUNT)
    : resolve(ROOT, 'serviceAccountNew.json');

  if (!existsSync(dstPath)) {
    console.error(`\n❌ Fichier introuvable : ${dstPath}`);
    process.exit(1);
  }

  const dstDbId = process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DST_DB;
  const sa = loadJson(dstPath);

  for (const name of ['cleanup-dup-contacts']) {
    const existing = getApps().find((a) => a.name === name);
    if (existing) await deleteApp(existing);
  }

  const app = initializeApp({ credential: cert(sa) }, 'cleanup-dup-contacts');
  const db = dstDbId ? getFirestore(app, dstDbId) : getFirestore(app);

  console.log('\n=== Purge doublons contacts V2 ===');
  console.log(`Mode     : ${dryRun ? 'DRY-RUN (aucune suppression)' : 'EXECUTE (suppression active)'}`);
  console.log(`Projet   : ${sa.project_id}`);
  console.log(`orgId    : ${orgId}`);

  const snap = await db.collection('organizations').doc(orgId).collection('contacts').get();
  const rows = snap.docs.map((d) => ({
    id: d.id,
    data: d.data(),
    email: normalizeEmail(d.data().email),
    legacyId: primaryLegacyId(d.data()),
    createdAt: createdAtIso(d.data()),
    schema: isCurrentImportIdSchema(d.id)
      ? 'current'
      : isLegacyImportIdSchema(d.id)
        ? 'legacy_may20'
        : 'other',
  }));

  const n = rows.length;
  const uf = new UnionFind(n);

  const emailToIndices = new Map();
  const legacyToIndices = new Map();

  for (let i = 0; i < n; i++) {
    const { email, legacyId } = rows[i];
    if (email) {
      const list = emailToIndices.get(email) ?? [];
      list.push(i);
      emailToIndices.set(email, list);
    }
    if (legacyId) {
      const list = legacyToIndices.get(legacyId) ?? [];
      list.push(i);
      legacyToIndices.set(legacyId, list);
    }
  }

  for (const indices of emailToIndices.values()) {
    for (let j = 1; j < indices.length; j++) uf.union(indices[0], indices[j]);
  }
  for (const indices of legacyToIndices.values()) {
    for (let j = 1; j < indices.length; j++) uf.union(indices[0], indices[j]);
  }

  const groupsByRoot = new Map();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const list = groupsByRoot.get(root) ?? [];
    list.push(rows[i]);
    groupsByRoot.set(root, list);
  }

  const duplicateGroups = [...groupsByRoot.values()].filter((g) => g.length > 1);
  const toDelete = [];
  const toKeep = new Set();

  for (const group of duplicateGroups) {
    const { keeper, toDelete: victims } = pickKeeperAndVictims(group);
    toKeep.add(keeper.id);
    for (const v of victims) {
      toDelete.push({
        id: v.id,
        email: v.email,
        legacyId: v.legacyId,
        createdAt: v.createdAt,
        schema: v.schema,
        keeperId: keeper.id,
        keeperCreatedAt: keeper.createdAt,
        keeperSchema: keeper.schema,
      });
    }
  }

  const singletonCount = n - duplicateGroups.reduce((s, g) => s + g.length, 0);
  const keptFromDupes = duplicateGroups.length;
  const keptTotal = singletonCount + keptFromDupes;

  const exampleEmail = 'anais_boies92@hotmail.com';
  const exampleGroup = duplicateGroups.find((g) =>
    g.some((r) => r.email === exampleEmail)
  );

  let exampleReport = null;
  if (exampleGroup) {
    const { keeper, toDelete: victims } = pickKeeperAndVictims(exampleGroup);
    exampleReport = {
      email: exampleEmail,
      legacyId: keeper.legacyId,
      keep: {
        id: keeper.id,
        createdAt: keeper.createdAt,
        schema: keeper.schema,
      },
      delete: victims.map((v) => ({
        id: v.id,
        createdAt: v.createdAt,
        schema: v.schema,
      })),
    };
  }

  const report = {
    orgId,
    mode: dryRun ? 'dry-run' : 'execute',
    scannedAt: new Date().toISOString(),
    totals: {
      contactsScanned: n,
      duplicateGroups: duplicateGroups.length,
      contactsToKeep: keptTotal,
      contactsToDelete: toDelete.length,
      contactsUnchangedSingletons: singletonCount,
    },
    example: exampleReport,
    sampleDeletes: toDelete.slice(0, 15),
    sampleGroups: duplicateGroups.slice(0, 5).map((g) => {
      const { keeper, toDelete: victims } = pickKeeperAndVictims(g);
      return {
        email: keeper.email,
        legacyId: keeper.legacyId,
        keepId: keeper.id,
        deleteIds: victims.map((v) => v.id),
      };
    }),
  };

  const reportDir = resolve(__dirname, 'output');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, 'cleanup-duplicate-contacts-dry-run.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n--- Rapport ---');
  console.log(`Contacts analysés              : ${n}`);
  console.log(`Groupes de doublons            : ${duplicateGroups.length}`);
  console.log(`Contacts conservés (finaux)    : ${keptTotal}`);
  console.log(`Contacts marqués SUPPRESSION   : ${toDelete.length}`);
  console.log(`Fiches seules (sans doublon)   : ${singletonCount}`);

  if (exampleReport) {
    console.log('\n--- Exemple PO (anais_boies92@hotmail.com) ---');
    console.log(`  CONSERVER : ${exampleReport.keep.id} (${exampleReport.keep.createdAt}, ${exampleReport.keep.schema})`);
    for (const d of exampleReport.delete) {
      console.log(`  SUPPRIMER : ${d.id} (${d.createdAt}, ${d.schema})`);
    }
  }

  console.log(`\nRapport JSON : ${reportPath}`);

  if (dryRun) {
    console.log('\n✅ Dry-run terminé — aucune suppression Firestore.');
    console.log('Relancez avec --execute uniquement après approbation du PO (Alain).');
    await deleteApp(app);
    return;
  }

  console.log('\n--- Suppression (batch.delete) ---');
  let deleted = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const row of toDelete) {
    const ref = db.collection('organizations').doc(orgId).collection('contacts').doc(row.id);
    batch.delete(ref);
    inBatch += 1;
    deleted += 1;
    if (inBatch >= BATCH_MAX) {
      await batch.commit();
      console.log(`  … ${deleted} / ${toDelete.length}`);
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log(`\n✅ ${deleted} contacts supprimés.`);
  await deleteApp(app);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
