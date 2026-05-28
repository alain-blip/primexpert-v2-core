/**
 * Migration CRM — bucket Storage legacy `contacts/` → organizations/{orgId}/contacts
 *
 * Source : gs://copilote-pour-courtiers-en-rpa.firebasestorage.app/contacts
 * SSOT    : @primexpert/core/crm/legacyContactImport.ts (Règle #0)
 *
 * Dry-run par défaut. --execute pour écrire Firestore (primexpert-app-v2).
 *
 * Usage :
 *   npm run migrate:contacts -- --org-id=org_xxx --owner-id=UID
 *   npm run migrate:contacts -- --org-id=... --owner-id=... --execute
 *   npm run migrate:contacts -- --limit=50
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import {
  buildStorageContactsMigrationPlan,
  deterministicImportContactId,
  normalizeImportEmail,
  normalizeImportPhone,
  type LegacyRawContactRow,
} from '../crm/legacyContactImport.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');

export const DEFAULT_STORAGE_BUCKET = 'copilote-pour-courtiers-en-rpa.firebasestorage.app';
export const DEFAULT_STORAGE_PREFIX = 'contacts/';
export const DEFAULT_DST_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
export const DEFAULT_OWNER_ID = 'bYwUG6mxNmPcvK9Xz2Uuy4FxqD83';
export const DEFAULT_ORG_ID = 'org_bYwUG6mxNmPcvK9Xz2Uuy4FxqD83';

const BATCH_MAX = 400;

export interface MigrateLegacyContactsOptions {
  orgId: string;
  ownerId: string;
  visibility: 'PRIVATE' | 'AGENCY_SHARED';
  execute: boolean;
  limit: number;
  bucket: string;
  prefix: string;
  srcServiceAccountPath: string;
  dstServiceAccountPath: string;
  dstDatabaseId: string;
  reportDir: string;
}

export function parseMigrateLegacyContactsArgv(argv: string[]): MigrateLegacyContactsOptions {
  const execute = argv.includes('--execute');
  const orgId = (
    process.env.MIGRATE_ORG_ID ||
    argv.find((a) => a.startsWith('--org-id='))?.slice('--org-id='.length) ||
    DEFAULT_ORG_ID
  ).trim();
  const ownerId = (
    process.env.MIGRATE_OWNER_ID ||
    argv.find((a) => a.startsWith('--owner-id='))?.slice('--owner-id='.length) ||
    DEFAULT_OWNER_ID
  ).trim();
  const visibility = (argv.find((a) => a.startsWith('--visibility='))?.slice('--visibility='.length) ||
    'AGENCY_SHARED') as 'PRIVATE' | 'AGENCY_SHARED';
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : 0;
  const bucket = (
    process.env.MIGRATE_STORAGE_BUCKET ||
    argv.find((a) => a.startsWith('--bucket='))?.slice('--bucket='.length) ||
    DEFAULT_STORAGE_BUCKET
  ).trim();
  const prefix = (
    process.env.MIGRATE_STORAGE_PREFIX ||
    argv.find((a) => a.startsWith('--prefix='))?.slice('--prefix='.length) ||
    DEFAULT_STORAGE_PREFIX
  ).trim();

  const srcPath = resolveAccountPath('SRC_SERVICE_ACCOUNT', 'serviceAccountOld.json', ROOT);
  const dstPath = resolveAccountPath('DST_SERVICE_ACCOUNT', 'serviceAccountNew.json', ROOT);
  const dstDbId = process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DST_DB;

  return {
    orgId,
    ownerId,
    visibility,
    execute,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 0,
    bucket,
    prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
    srcServiceAccountPath: srcPath,
    dstServiceAccountPath: dstPath,
    dstDatabaseId: dstDbId,
    reportDir: resolve(ROOT, 'scripts/output'),
  };
}

function resolveAccountPath(envName: string, fallback: string, root: string): string {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(root, fallback);
}

function loadJson(path: string): Record<string, unknown> {
  const raw = readFileSync(path, 'utf8').trim();
  if (raw.startsWith('{\\rtf') || raw.startsWith('{\rtf')) {
    throw new Error(`Fichier RTF détecté : ${path}`);
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Timestamp) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    const next = stripUndefinedDeep(v);
    if (next !== undefined) out[k] = next;
  }
  return out;
}

/** Parse JSON contact depuis Storage (objet racine ou enveloppe `{ data: … }`). */
export function parseStorageContactJson(
  raw: string,
  fileName: string
): { legacyId: string; data: Record<string, unknown> } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`  ⚠ JSON invalide : ${fileName}`);
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn(`  ⚠ Racine non-objet : ${fileName}`);
    return null;
  }
  const root = parsed as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const baseName = fileName.split('/').pop() ?? fileName;
  const legacyId =
    pickLegacyId(data) ||
    baseName.replace(/\.json$/i, '').trim() ||
    `file_${Buffer.from(fileName).toString('base64url').slice(0, 16)}`;
  return { legacyId, data };
}

function pickLegacyId(data: Record<string, unknown>): string | null {
  for (const key of ['id', 'contactId', 'legacyId', 'uid', '_id']) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

export function storageObjectToLegacyRow(
  fileName: string,
  data: Record<string, unknown>
): LegacyRawContactRow {
  const email = normalizeImportEmail(data.courriel ?? data.email);
  if (email) data.email = email;
  const phone = normalizeImportPhone(
    data.telephone ?? data.cellulaire ?? data.phone ?? data.mobile
  );
  if (phone) data.telephone = phone;

  return {
    source: 'contacts',
    legacyId: pickLegacyId(data) ?? fileName.replace(/\.json$/i, ''),
    data,
  };
}

const CONTACT_FILE_RE = /\.(json|JSON)$/;

/** IDs contact déduits des chemins `contacts/{contactId}/…`. */
export function extractContactIdsFromStoragePaths(paths: string[], prefix: string): string[] {
  const norm = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const ids = new Set<string>();
  for (const full of paths) {
    if (!full.startsWith(norm)) continue;
    const rest = full.slice(norm.length);
    const seg = rest.split('/').filter(Boolean)[0];
    if (seg && !seg.includes('.')) ids.add(seg);
  }
  return [...ids];
}

export async function listAllStorageObjectNames(
  bucketName: string,
  prefix: string,
  storageAppName: string
): Promise<string[]> {
  const bucket = getStorage(getApps().find((a) => a.name === storageAppName)!).bucket(bucketName);
  const names: string[] = [];
  let pageToken: string | undefined;
  do {
    const [files, , resp] = await bucket.getFiles({ prefix, autoPaginate: false, maxResults: 500, pageToken });
    names.push(...files.map((f) => f.name));
    pageToken = resp?.nextPageToken;
  } while (pageToken);
  return names;
}

export interface StorageContactEvidence {
  contactId: string;
  hasNdaFile: boolean;
  hasFundsFile: boolean;
  storagePaths: string[];
}

export function buildStorageEvidenceByContact(
  paths: string[],
  prefix: string
): Map<string, StorageContactEvidence> {
  const norm = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const map = new Map<string, StorageContactEvidence>();

  for (const full of paths) {
    if (!full.startsWith(norm)) continue;
    const rest = full.slice(norm.length);
    const contactId = rest.split('/').filter(Boolean)[0];
    if (!contactId || contactId.includes('.')) continue;

    const lower = full.toLowerCase();
    const isNda = lower.includes('confidentiality') || lower.includes('nda') || lower.includes('entente');
    const isFunds =
      lower.includes('/funds_') ||
      lower.includes('funds_') ||
      lower.includes('mise de fond') ||
      lower.includes('preuve');

    const cur = map.get(contactId) ?? {
      contactId,
      hasNdaFile: false,
      hasFundsFile: false,
      storagePaths: [],
    };
    cur.hasNdaFile = cur.hasNdaFile || isNda;
    cur.hasFundsFile = cur.hasFundsFile || isFunds;
    cur.storagePaths.push(full);
    map.set(contactId, cur);
  }
  return map;
}

export async function listStorageContactFiles(
  bucketName: string,
  prefix: string,
  storageAppName: string
): Promise<string[]> {
  const bucket = getStorage(getApps().find((a) => a.name === storageAppName)!).bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix });
  return files
    .map((f) => f.name)
    .filter((name) => CONTACT_FILE_RE.test(name) && !name.endsWith('/'));
}

/** Aide diagnostic — premiers objets du bucket si le préfixe est vide. */
export async function probeStorageBucketPrefixes(
  bucketName: string,
  storageAppName: string,
  maxSamples = 15
): Promise<{ prefixes: string[]; samples: string[] }> {
  const bucket = getStorage(getApps().find((a) => a.name === storageAppName)!).bucket(bucketName);
  const [files] = await bucket.getFiles({ maxResults: 200 });
  const samples = files.map((f) => f.name).slice(0, maxSamples);
  const prefixes = new Set<string>();
  for (const name of files.map((f) => f.name)) {
    const slash = name.indexOf('/');
    prefixes.add(slash >= 0 ? `${name.slice(0, slash + 1)}` : '(racine)');
  }
  return { prefixes: [...prefixes].sort(), samples };
}

export function enrichLegacyDataWithStorageEvidence(
  data: Record<string, unknown>,
  evidence: StorageContactEvidence
): Record<string, unknown> {
  const next = { ...data };
  if (evidence.hasNdaFile) {
    next.hasNdaSigned = true;
    next.ndaSigned = true;
    next.statutNda = next.statutNda ?? 'signe';
  }
  if (evidence.hasFundsFile) {
    next.hasProofOfFunds = true;
    next.proofOfFunds = true;
  }
  next.storageEvidencePaths = evidence.storagePaths;
  return next;
}

export async function fetchLegacyFirestoreContactsByIds(
  fs: Firestore,
  contactIds: string[]
): Promise<LegacyRawContactRow[]> {
  const rows: LegacyRawContactRow[] = [];
  const chunk = 25;
  for (let i = 0; i < contactIds.length; i += chunk) {
    const slice = contactIds.slice(i, i + chunk);
    const snaps = await Promise.all(
      slice.map((id) => fs.collection('contacts').doc(id).get().catch(() => null))
    );
    for (let j = 0; j < slice.length; j++) {
      const snap = snaps[j];
      if (!snap?.exists) continue;
      rows.push({
        source: 'contacts',
        legacyId: slice[j],
        data: snap.data() as Record<string, unknown>,
      });
    }
  }
  return rows;
}

export async function buildRowsFromStorageAndFirestore(
  bucketName: string,
  prefix: string,
  storageAppName: string,
  legacyFs: Firestore,
  limit: number
): Promise<{ rows: LegacyRawContactRow[]; storageObjectCount: number; missingInFirestore: number }> {
  const allPaths = await listAllStorageObjectNames(bucketName, prefix, storageAppName);
  const evidenceMap = buildStorageEvidenceByContact(allPaths, prefix);
  let contactIds = [...evidenceMap.keys()];
  if (limit > 0) contactIds = contactIds.slice(0, limit);

  const firestoreRows = await fetchLegacyFirestoreContactsByIds(legacyFs, contactIds);
  const firestoreById = new Map(firestoreRows.map((r) => [r.legacyId, r]));

  const rows: LegacyRawContactRow[] = [];
  let missingInFirestore = 0;

  for (const id of contactIds) {
    const evidence = evidenceMap.get(id)!;
    const fsRow = firestoreById.get(id);
    if (fsRow) {
      rows.push({
        ...fsRow,
        data: enrichLegacyDataWithStorageEvidence(fsRow.data, evidence),
      });
    } else {
      missingInFirestore += 1;
      rows.push({
        source: 'contacts',
        legacyId: id,
        data: enrichLegacyDataWithStorageEvidence(
          {
            id,
            type: 'acheteur',
            nom: `Contact import (${id.slice(0, 8)}…)`,
            notes: `[Storage seulement — fiche absente de Firestore contacts/]`,
          },
          evidence
        ),
      });
    }
  }

  return { rows, storageObjectCount: allPaths.length, missingInFirestore };
}

export async function downloadStorageContactRows(
  bucketName: string,
  prefix: string,
  storageAppName: string,
  limit: number
): Promise<{ rows: LegacyRawContactRow[]; skipped: number }> {
  const bucket = getStorage(getApps().find((a) => a.name === storageAppName)!).bucket(bucketName);
  const names = await listStorageContactFiles(bucketName, prefix, storageAppName);
  const selected = limit > 0 ? names.slice(0, limit) : names;
  const rows: LegacyRawContactRow[] = [];
  let skipped = 0;

  for (const name of selected) {
    try {
      const [buf] = await bucket.file(name).download();
      const parsed = parseStorageContactJson(buf.toString('utf8'), name);
      if (!parsed) {
        skipped += 1;
        continue;
      }
      rows.push(storageObjectToLegacyRow(name, parsed.data));
    } catch (e) {
      skipped += 1;
      console.warn(`  ⚠ Échec lecture ${name}:`, e instanceof Error ? e.message : e);
    }
  }

  return { rows, skipped };
}

export interface MigrateLegacyContactsReport {
  options: Pick<
    MigrateLegacyContactsOptions,
    'orgId' | 'ownerId' | 'visibility' | 'bucket' | 'prefix' | 'execute'
  >;
  storageObjectCount: number;
  storageContactIds: number;
  missingInFirestore: number;
  stats: ReturnType<typeof buildStorageContactsMigrationPlan>['stats'];
  qualifiedBuyers: number;
  pendingNdaBuyers: number;
  withBudgetMax: number;
  withTgaMinimum: number;
  withRegions: number;
  samplePayloads: unknown[];
}

export function summarizeMigrationPlan(
  opts: MigrateLegacyContactsOptions,
  rows: LegacyRawContactRow[],
  missingInFirestore: number,
  storageObjectCount: number
): MigrateLegacyContactsReport {
  const ctx = { orgId: opts.orgId, ownerId: opts.ownerId, visibility: opts.visibility };
  const { payloads, stats } = buildStorageContactsMigrationPlan(rows, ctx);

  const buyers = payloads.filter((p) => p.relationRoles?.includes('buyer'));
  const qualifiedBuyers = buyers.filter((p) => p.buyerQualificationStatus === 'QUALIFIED').length;
  const pendingNdaBuyers = buyers.filter((p) => p.buyerQualificationStatus === 'PENDING_NDA').length;
  const withBudgetMax = buyers.filter((p) => p.buyerCriteria?.budgetMax != null).length;
  const withTgaMinimum = buyers.filter((p) => p.buyerCriteria?.tgaMinimum != null).length;
  const withRegions = buyers.filter((p) => (p.buyerCriteria?.regions?.length ?? 0) > 0).length;

  return {
    options: {
      orgId: opts.orgId,
      ownerId: opts.ownerId,
      visibility: opts.visibility,
      bucket: opts.bucket,
      prefix: opts.prefix,
      execute: opts.execute,
    },
    storageObjectCount,
    storageContactIds: rows.length,
    missingInFirestore,
    stats,
    qualifiedBuyers,
    pendingNdaBuyers,
    withBudgetMax,
    withTgaMinimum,
    withRegions,
    samplePayloads: payloads.slice(0, 5),
  };
}

export function printMigrationReport(report: MigrateLegacyContactsReport): void {
  const { stats } = report;
  console.log('\n--- Rapport migration Storage → CRM V2 ---');
  console.log(`Objets Storage (bucket)     : ${report.storageObjectCount}`);
  console.log(`Dossiers contacts/{id}     : ${report.storageContactIds}`);
  console.log(`Absents Firestore legacy   : ${report.missingInFirestore}`);
  console.log(`Contacts bruts importés    : ${stats.legacyTotalRaw}`);
  console.log(`Groupes doublons           : ${stats.duplicateGroups}`);
  console.log(`Fiches fusionnées          : ${stats.recordsMergedAway}`);
  console.log(`Fiches prêtes (V2)         : ${stats.finalReadyCount}`);
  console.log(`Acheteurs QUALIFIED        : ${report.qualifiedBuyers}`);
  console.log(`Acheteurs PENDING_NDA      : ${report.pendingNdaBuyers}`);
  console.log(`Avec budgetMax (Raphaël)   : ${report.withBudgetMax}`);
  console.log(`Avec tgaMinimum (Raphaël)  : ${report.withTgaMinimum}`);
  console.log(`Avec régions cibles        : ${report.withRegions}`);
  console.log(`Clé dédup courriel         : ${stats.withEmailKey}`);
  console.log(`Clé dédup téléphone        : ${stats.withPhoneKeyOnly}`);
  console.log(`Sans clé dédup             : ${stats.withoutDedupeKey}`);
  console.log(`LCI incomplète             : ${stats.lciIncompleteCount}`);
}

export async function runMigrateLegacyContacts(
  opts: MigrateLegacyContactsOptions
): Promise<MigrateLegacyContactsReport> {
  for (const p of [opts.srcServiceAccountPath, opts.dstServiceAccountPath]) {
    if (!existsSync(p)) {
      throw new Error(`Fichier introuvable : ${p}`);
    }
  }

  const srcSa = loadJson(opts.srcServiceAccountPath);
  const dstSa = loadJson(opts.dstServiceAccountPath);
  const srcDbId = process.env.FIRESTORE_SRC_DATABASE_ID?.trim() || '';

  for (const name of ['migrate-storage-src', 'migrate-storage-dst']) {
    const existing = getApps().find((a) => a.name === name);
    if (existing) await deleteApp(existing);
  }

  const srcApp = initializeApp({ credential: cert(srcSa), storageBucket: opts.bucket }, 'migrate-storage-src');
  const dstApp = initializeApp({ credential: cert(dstSa) }, 'migrate-storage-dst');

  const srcFs = srcDbId ? getFirestore(srcApp, srcDbId) : getFirestore(srcApp);
  const dstFs = opts.dstDatabaseId
    ? getFirestore(dstApp, opts.dstDatabaseId)
    : getFirestore(dstApp);

  console.log('\n=== Migration CRM — Storage legacy contacts/ ===');
  console.log(`Mode       : ${opts.execute ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`Bucket     : gs://${opts.bucket}/${opts.prefix}`);
  console.log(`orgId      : ${opts.orgId}`);
  console.log(`ownerId    : ${opts.ownerId}`);
  console.log(`visibility : ${opts.visibility}`);
  console.log(`Source FS   : ${srcSa.project_id} / ${srcDbId || '(default)'}`);
  console.log(`Cible FS    : ${dstSa.project_id} / ${opts.dstDatabaseId || '(default)'}`);
  console.log(
    'Stratégie   : dossiers Storage contacts/{id}/ + métadonnées Firestore contacts/{id}'
  );

  const { rows, storageObjectCount, missingInFirestore } = await buildRowsFromStorageAndFirestore(
    opts.bucket,
    opts.prefix,
    'migrate-storage-src',
    srcFs,
    opts.limit
  );

  const jsonOnly = await listStorageContactFiles(opts.bucket, opts.prefix, 'migrate-storage-src');
  let allRows = rows;
  if (jsonOnly.length > 0) {
    const { rows: jsonRows, skipped } = await downloadStorageContactRows(
      opts.bucket,
      opts.prefix,
      'migrate-storage-src',
      opts.limit
    );
    console.log(`Fichiers JSON additionnels : ${jsonRows.length} (ignorés ${skipped})`);
    allRows = [...rows, ...jsonRows];
  }

  const report = summarizeMigrationPlan(opts, allRows, missingInFirestore, storageObjectCount);
  printMigrationReport(report);

  mkdirSync(opts.reportDir, { recursive: true });
  const reportPath = resolve(opts.reportDir, 'storage-contacts-migration-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nRapport JSON : ${reportPath}`);

  if (!opts.execute) {
    console.log('\n✅ Dry-run terminé — aucune écriture Firestore.');
    console.log('Relancez avec --execute après approbation du PO.');
    await deleteApp(srcApp);
    await deleteApp(dstApp);
    return report;
  }

  console.log('\n--- Injection Firestore ---');
  const ctx = { orgId: opts.orgId, ownerId: opts.ownerId, visibility: opts.visibility };
  const { payloads } = buildStorageContactsMigrationPlan(allRows, ctx);
  let written = 0;
  let batch = dstFs.batch();
  let inBatch = 0;
  const now = new Date().toISOString();

  for (const payload of payloads) {
    const contactId = deterministicImportContactId(payload);
    const ref = dstFs.collection('organizations').doc(opts.orgId).collection('contacts').doc(contactId);
    const company = payload.buyerCriteria?.corporateMandate?.companyName?.trim();
    const doc = stripUndefinedDeep({
      ...payload,
      ...(company ? { entreprise: company } : {}),
      updatedAt: now,
      createdAt: now,
    });
    batch.set(ref, doc as Record<string, unknown>, { merge: true });
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

  console.log(`\n✅ ${written} contacts écrits dans organizations/${opts.orgId}/contacts`);

  await deleteApp(srcApp);
  await deleteApp(dstApp);
  return report;
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('migrateLegacyContacts.ts') ||
    process.argv[1].endsWith('migrateLegacyContacts.js'));

if (isMain) {
  const opts = parseMigrateLegacyContactsArgv(process.argv.slice(2));
  runMigrateLegacyContacts(opts).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
