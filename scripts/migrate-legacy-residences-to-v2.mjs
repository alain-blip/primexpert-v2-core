/**
 * Maillon 2 — résidences Legacy → V2 + liaison vendeurs (partiesImpliquees).
 *
 * Règles : docs/DATA_MAPPING_LEGACY_V2.md §2
 *   - Statut pipeline → enum V2 (prospect, mandate, promise, sold, expired, unsigned)
 *   - courtiersResponsables (UID V2, défaut --owner-id)
 *   - Match vendeur Phase 1 → partiesImpliquees VENDEUR + contact.residenceIds
 *
 * Prérequis :
 *   - serviceAccountOld.json (lecture Copilote)
 *   - serviceAccountNew.json (lecture/écriture primexpert-app-v2)
 *
 * Dry-run par défaut. --execute pour écrire (feu vert PO requis).
 *
 * Usage :
 *   npx tsx scripts/migrate-legacy-residences-to-v2.mjs --org-id=ORG --owner-id=UID
 *   npx tsx scripts/migrate-legacy-residences-to-v2.mjs --org-id=... --owner-id=... --limit=50
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { buildLegacyResidenceMigrationPlan } from '../packages/core/src/residence/legacyResidenceImport.ts';
import { syncAddResidenceIdToContact } from '../packages/core/src/residence/partiesImpliquees.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_DST_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const DEFAULT_OWNER_ID = 'bYwUG6mxNmPcvK9Xz2Uuy4FxqD83';
const DEFAULT_ORG_ID = 'org_bYwUG6mxNmPcvK9Xz2Uuy4FxqD83';
const BATCH_MAX = 400;

const execute = process.argv.includes('--execute');
const dryRun = !execute;

const orgIdArg = process.argv.find((a) => a.startsWith('--org-id='));
const ownerIdArg = process.argv.find((a) => a.startsWith('--owner-id='));
const limitArg = process.argv.find((a) => a.startsWith('--limit='));

const orgId = (process.env.MIGRATE_ORG_ID || orgIdArg?.slice('--org-id='.length) || DEFAULT_ORG_ID).trim();
const ownerId = (
  process.env.MIGRATE_OWNER_ID ||
  ownerIdArg?.slice('--owner-id='.length) ||
  DEFAULT_OWNER_ID
).trim();
const limitN = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : 0;

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

function mapV2ContactEntry(docId, data) {
  const legacyContactIds = [];
  const sources = data.importMeta?.legacySources;
  if (Array.isArray(sources)) {
    for (const src of sources) {
      if (src?.collection === 'contacts' && typeof src.id === 'string' && src.id.trim()) {
        legacyContactIds.push(src.id.trim());
      }
    }
  }
  return {
    contactId: docId,
    email: typeof data.email === 'string' ? data.email : undefined,
    telephone: typeof data.telephone === 'string' ? data.telephone : undefined,
    legacyContactIds,
    residenceIds: Array.isArray(data.residenceIds) ? data.residenceIds.map(String) : [],
    relationRoles: Array.isArray(data.relationRoles) ? data.relationRoles.map(String) : [],
  };
}

async function main() {
  const srcPath = resolveAccountPath('SRC_SERVICE_ACCOUNT', 'serviceAccountOld.json');
  const dstPath = resolveAccountPath('DST_SERVICE_ACCOUNT', 'serviceAccountNew.json');

  for (const p of [srcPath, dstPath]) {
    if (!existsSync(p)) {
      console.error(`\n❌ Fichier introuvable : ${p}`);
      process.exit(1);
    }
  }

  const srcDbId = process.env.FIRESTORE_SRC_DATABASE_ID?.trim() || '';
  const dstDbId = process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DST_DB;

  const oldSa = loadJson(srcPath);
  const newSa = loadJson(dstPath);

  for (const name of ['migrate-res-src', 'migrate-res-dst']) {
    const existing = getApps().find((a) => a.name === name);
    if (existing) await deleteApp(existing);
  }

  const srcApp = initializeApp({ credential: cert(oldSa) }, 'migrate-res-src');
  const dstApp = initializeApp({ credential: cert(newSa) }, 'migrate-res-dst');

  const srcFs = srcDbId ? getFirestore(srcApp, srcDbId) : getFirestore(srcApp);
  const dstFs = dstDbId ? getFirestore(dstApp, dstDbId) : getFirestore(dstApp);

  console.log('\n=== Migration résidences legacy → V2 (Maillon 2) ===');
  console.log(`Mode          : ${dryRun ? 'DRY-RUN (aucune écriture)' : 'EXECUTE (écriture active)'}`);
  console.log(`Source projet : ${oldSa.project_id}`);
  console.log(`Cible projet  : ${newSa.project_id}`);
  console.log(`orgId         : ${orgId}`);
  console.log(`ownerId défaut: ${ownerId}`);
  console.log(`Référence     : docs/DATA_MAPPING_LEGACY_V2.md §2`);

  const [legacyResSnap, v2ContactsSnap, legacyContactsSnap] = await Promise.all([
    srcFs.collection('residences').get(),
    dstFs.collection('organizations').doc(orgId).collection('contacts').get(),
    srcFs.collection('contacts').get(),
  ]);

  let legacyRows = legacyResSnap.docs.map((d) => ({
    legacyId: d.id,
    data: d.data(),
  }));
  if (limitN > 0) legacyRows = legacyRows.slice(0, limitN);

  const contactEntries = v2ContactsSnap.docs.map((d) => mapV2ContactEntry(d.id, d.data()));

  const legacyContactById = new Map();
  for (const doc of legacyContactsSnap.docs) {
    legacyContactById.set(doc.id, doc.data());
  }

  const { rows, stats } = buildLegacyResidenceMigrationPlan(legacyRows, contactEntries, {
    defaultOwnerId: ownerId,
    legacyContactById,
  });

  const matchByMethod = {};
  for (const row of rows) {
    const m = row.sellerMatch.method ?? 'none';
    matchByMethod[m] = (matchByMethod[m] ?? 0) + 1;
  }

  const sampleMatches = rows
    .filter((r) => r.sellerMatch.contactId)
    .slice(0, 5)
    .map((r) => ({
      residenceId: r.legacyId,
      status: r.status,
      statusLegacyRaw: r.statusLegacyRaw,
      sellerContactId: r.sellerMatch.contactId,
      matchMethod: r.sellerMatch.method,
      courtiersResponsables: r.courtiersResponsables,
    }));

  const sampleOrphans = rows
    .filter((r) => !r.sellerMatch.contactId)
    .slice(0, 5)
    .map((r) => ({
      residenceId: r.legacyId,
      status: r.status,
      sellerHints: r.sellerMatch.hints.slice(0, 6),
    }));

  const SPOTLIGHT_NAMES = ['Manoir St-Damase', 'Résidence Bedford'];
  const spotlightRows = rows
    .filter((r) => SPOTLIGHT_NAMES.some((label) => r.name.includes(label)))
    .map((r) => ({
      residenceId: r.legacyId,
      nom: r.name,
      prix: r.askingPrice,
      statutV2: r.status,
      statutLegacyRaw: r.statusLegacyRaw,
      catalogReference: r.catalogReference,
      courtier: r.courtiersResponsables,
      brokerResolvedFrom: r.importMeta.brokerResolvedFrom,
      legacyBrokerToken: r.importMeta.legacyBrokerToken,
      nameSource: r.importMeta.nameSource,
      priceSource: r.importMeta.priceSource,
    }));

  const reportDir = resolve(__dirname, 'output');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, 'legacy-residences-dry-run-report.json');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        orgId,
        ownerId,
        stats: {
          ...stats,
          matchByMethod,
          v2ContactsLoaded: contactEntries.length,
          legacyContactsLoaded: legacyContactById.size,
        },
        sampleMatches,
        sampleOrphans,
        spotlightRows,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('\n--- Rapport Dry-Run ---');
  console.log(`Résidences legacy analysées     : ${stats.legacyResidenceCount}`);
  console.log(`Contacts V2 chargés (Phase 1)   : ${contactEntries.length}`);
  console.log(`Liaisons vendeur réussies       : ${stats.sellerMatches}`);
  console.log(`Résidences sans vendeur (orphelin): ${stats.sellerOrphans}`);
  console.log(`Indices ownerIds / courriel     : ${stats.withOwnerIdsHint} / ${stats.withEmailHint}`);
  console.log('\nRépartition statuts V2 :');
  for (const [st, n] of Object.entries(stats.statusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${st.padEnd(10)} : ${n}`);
  }
  console.log('\nRépartition méthode de match vendeur :');
  for (const [m, n] of Object.entries(matchByMethod).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${m.padEnd(22)} : ${n}`);
  }
  console.log(`\nRapport JSON : ${reportPath}`);

  if (spotlightRows.length) {
    console.log('\n--- Contrôle PO (Manoir St-Damase / Résidence Bedford) ---');
    for (const s of spotlightRows) {
      console.log(JSON.stringify(s, null, 2));
    }
  } else {
    console.log('\n⚠️ Aucune fiche spotlight trouvée (vérifiez les libellés nomResidence).');
  }

  if (dryRun) {
    console.log('\n✅ Dry-run terminé — aucune écriture Firestore.');
    console.log('Relancez avec --execute uniquement après approbation du PO (Alain).');
    await deleteApp(srcApp);
    await deleteApp(dstApp);
    return;
  }

  console.log('\n--- Injection V2 (writeBatch) ---');
  let written = 0;
  let contactUpdates = 0;
  let batchErrors = 0;
  let batchesCommitted = 0;

  /** État cumulatif residenceIds par contact (évite écrasement si plusieurs résidences → même vendeur). */
  const contactResidenceIdsState = new Map(
    contactEntries.map((c) => [c.contactId, [...(c.residenceIds ?? [])]])
  );

  let batch = dstFs.batch();
  let inBatch = 0;

  async function commitBatch() {
    if (inBatch === 0) return;
    try {
      await batch.commit();
      batchesCommitted += 1;
    } catch (err) {
      batchErrors += 1;
      console.error('  ❌ batch.commit failed:', err.message ?? err);
      throw err;
    }
    batch = dstFs.batch();
    inBatch = 0;
  }

  for (const row of rows) {
    const ref = dstFs.collection('residences').doc(row.legacyId);
    const now = new Date().toISOString();
    const patch = stripUndefinedDeep({
      status: row.status,
      statut: row.status,
      courtiersResponsables: row.courtiersResponsables,
      name: row.name || undefined,
      nomResidence: row.name || undefined,
      residenceName: row.name || undefined,
      askingPrice: row.askingPrice ?? undefined,
      prixDemande: row.askingPrice ?? undefined,
      price: row.askingPrice ?? undefined,
      address: row.address,
      city: row.city,
      partiesImpliquees: row.partiesImpliquees.length ? row.partiesImpliquees : undefined,
      importMetaResidence: {
        legacyResidenceId: row.legacyId,
        statusLegacyRaw: row.statusLegacyRaw,
        catalogReference: row.catalogReference,
        sellerMatchMethod: row.sellerMatch.method,
        nameSource: row.importMeta.nameSource,
        priceSource: row.importMeta.priceSource,
        legacyBrokerToken: row.importMeta.legacyBrokerToken,
        brokerResolvedFrom: row.importMeta.brokerResolvedFrom,
        migratedAt: now,
      },
      updatedAt: now,
    });
    batch.set(ref, patch, { merge: true });
    inBatch += 1;
    written += 1;

    if (row.sellerMatch.contactId) {
      const contactId = row.sellerMatch.contactId;
      const prev = contactResidenceIdsState.get(contactId) ?? [];
      const nextIds = syncAddResidenceIdToContact(prev, row.legacyId);
      contactResidenceIdsState.set(contactId, nextIds);

      const contactRef = dstFs
        .collection('organizations')
        .doc(orgId)
        .collection('contacts')
        .doc(contactId);
      batch.set(
        contactRef,
        stripUndefinedDeep({
          residenceIds: nextIds,
          updatedAt: now,
        }),
        { merge: true }
      );
      inBatch += 1;
      contactUpdates += 1;
    }

    if (inBatch >= BATCH_MAX) {
      await commitBatch();
      console.log(`  … ${written} résidences / ${contactUpdates} écritures contact liées`);
    }
  }
  await commitBatch();

  const executeReportPath = resolve(reportDir, 'legacy-residences-execute-report.json');
  writeFileSync(
    executeReportPath,
    JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        orgId,
        ownerId,
        residencesWritten: written,
        contactLinkWrites: contactUpdates,
        sellerMatches: stats.sellerMatches,
        batchesCommitted,
        batchErrors,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`\n✅ ${written} résidences mises à jour ; ${contactUpdates} écritures contact (liaisons).`);
  console.log(`   Batches commités : ${batchesCommitted} — erreurs : ${batchErrors}`);
  console.log(`   Rapport exécution : ${executeReportPath}`);
  await deleteApp(srcApp);
  await deleteApp(dstApp);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
