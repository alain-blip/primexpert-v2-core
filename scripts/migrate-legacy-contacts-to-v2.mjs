/**
 * Import one-off : contacts + vendors legacy (Copilote) → organizations/{orgId}/contacts (V2).
 *
 * Prérequis :
 *   - serviceAccountOld.json (lecture Copilote / copilote-pour-courtiers-en-rpa)
 *   - serviceAccountNew.json (écriture primexpert-app-v2)
 *
 * Dry-run par défaut (aucune écriture). Ajouter --execute pour injecter.
 *
 * Usage :
 *   node scripts/migrate-legacy-contacts-to-v2.mjs --org-id=VOTRE_ORG --owner-id=bYwUG6mxNmPcvK9Xz2Uuy4FxqD83
 *   node scripts/migrate-legacy-contacts-to-v2.mjs --org-id=... --owner-id=... --execute
 *   node scripts/migrate-legacy-contacts-to-v2.mjs --limit=50
 *   node scripts/migrate-legacy-contacts-to-v2.mjs --visibility=PRIVATE
 *
 * Variables d'environnement :
 *   SRC_SERVICE_ACCOUNT, DST_SERVICE_ACCOUNT
 *   FIRESTORE_SRC_DATABASE_ID, FIRESTORE_DST_DATABASE_ID
 *   MIGRATE_ORG_ID, MIGRATE_OWNER_ID
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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
    'Précisez --org-id=ORG_FIRESTORE (JWT orgId Alain) ou MIGRATE_ORG_ID dans l’environnement.'
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

function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return v.includes('@') ? v : null;
}

function normalizePhone(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.slice(-10);
}

function legacyUpdatedAtMillis(data) {
  const toMs = (v) => {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return Number.isNaN(t) ? 0 : t;
    }
    if (typeof v?.toMillis === 'function') return v.toMillis();
    if (typeof v?._seconds === 'number') return v._seconds * 1000;
    return 0;
  };
  return Math.max(toMs(data.updatedAt), toMs(data.createdAt));
}

function pickString(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function mapLegacyRelationRoles(data) {
  const roles = new Set();
  const typeRaw = pickString(data.type).toLowerCase();
  const roleList = Array.isArray(data.roles) ? data.roles.map(String) : [];
  const add = (token) => {
    const t = token.toLowerCase();
    if (t.includes('blacklist') || t.includes('liste noire')) roles.add('blacklist');
    if (t.includes('former') || t.includes('ancien')) roles.add('former_owner');
    if (t.includes('courtier') || t.includes('broker') || t.includes('collabor')) roles.add('broker');
    if (t.includes('notaire') || t.includes('avocat') || t.includes('profession')) roles.add('professional');
    if (t.includes('vendeur') || t === 'seller') roles.add('seller');
    if (t.includes('acheteur') || t === 'buyer' || t.includes('qualifiedbuyer')) roles.add('buyer');
  };
  add(typeRaw);
  for (const r of roleList) add(r);
  if (roles.size === 0) roles.add('buyer');
  return [...roles];
}

function mapBuyerQualification(data, relationRoles) {
  if (!relationRoles.includes('buyer')) return null;
  const roles = Array.isArray(data.roles) ? data.roles.map((r) => String(r).toLowerCase()) : [];
  const type = pickString(data.type).toLowerCase();
  if (roles.some((r) => r.includes('qualified')) || type.includes('qualifi')) return 'QUALIFIED';
  if (data.ndaSigned === true || data.hasNDASigned === true) return 'NDA_SIGNED';
  if (data.proofOfFunds === true || data.hasProofOfFunds === true) return 'FUNDS_VERIFIED';
  return null;
}

const LCI_DATE_PLACEHOLDER = '0000-00-00';
const LCI_OCC_PLACEHOLDER = 'À compléter (import legacy)';
const LCI_ADDR_LINE = 'À compléter (import legacy)';
const LCI_CITY = 'Non renseigné';
const LCI_POSTAL = 'H0H 0H0';

function rowToPayload(row, ctx) {
  const data = row.data;
  const prenom = pickString(data.prenom, data.firstName);
  const nom =
    pickString(data.nom, data.lastName) ||
    pickString(data.displayName, data.companyName, data.nomCompagnie) ||
    'Contact (import legacy)';
  const ligne1 = pickString(data.adresse, data.address) || LCI_ADDR_LINE;
  const ville = pickString(data.ville, data.city) || LCI_CITY;
  const codePostal = pickString(data.codePostal, data.postalCode) || LCI_POSTAL;
  const missingLci = [];
  if (!pickString(data.nom, data.lastName, data.displayName)) missingLci.push('nom');
  if (!pickString(data.dateNaissance, data.dateOfBirth)) missingLci.push('dateNaissance');
  if (!pickString(data.occupationProfession, data.occupation, data.profession)) {
    missingLci.push('occupationProfession');
  }
  if (ligne1 === LCI_ADDR_LINE) missingLci.push('adresse');

  const relationRoles = mapLegacyRelationRoles(data);
  return {
    orgId: ctx.orgId,
    ownerId: ctx.ownerId,
    silo: 'COMMERCIAL_SPEC',
    assetNiche: 'RPA',
    visibility: ctx.visibility,
    leadSource: 'IMPORT_LEGACY',
    nom,
    prenom: prenom || undefined,
    adresse: { ligne1, ville, province: pickString(data.province) || 'QC', codePostal },
    dateNaissance: pickString(data.dateNaissance, data.dateOfBirth) || LCI_DATE_PLACEHOLDER,
    occupationProfession:
      pickString(data.occupationProfession, data.occupation, data.profession) || LCI_OCC_PLACEHOLDER,
    relationRoles,
    email: normalizeEmail(data.courriel ?? data.email) ?? undefined,
    telephone:
      normalizePhone(data.telephone ?? data.cellulaire ?? data.phone) ?? undefined,
    residenceIds: Array.isArray(data.residenceIds)
      ? [...new Set(data.residenceIds.map(String).filter(Boolean))]
      : undefined,
    buyerQualificationStatus: mapBuyerQualification(data, relationRoles),
    notes: `[Import legacy: ${row.source}/${row.legacyId}]`,
    importMeta: {
      legacySources: [{ collection: row.source, id: row.legacyId }],
      mergedCount: 1,
      lciIncomplete: missingLci.length > 0,
      missingLciFields: missingLci,
    },
  };
}

function dedupeKey(row) {
  const email = normalizeEmail(row.data.courriel ?? row.data.email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(row.data.telephone ?? row.data.cellulaire ?? row.data.phone);
  if (phone) return `phone:${phone}`;
  return null;
}

function mergeTwo(a, b) {
  const roles = new Set([...(a.relationRoles ?? []), ...(b.relationRoles ?? [])]);
  const residences = new Set([...(a.residenceIds ?? []), ...(b.residenceIds ?? [])]);
  const rank = { QUALIFIED: 4, FUNDS_VERIFIED: 3, NDA_SIGNED: 2, PENDING_NDA: 1 };
  let bq = a.buyerQualificationStatus;
  if (
    b.buyerQualificationStatus &&
    (!bq || (rank[b.buyerQualificationStatus] ?? 0) > (rank[bq] ?? 0))
  ) {
    bq = b.buyerQualificationStatus;
  }
  return {
    ...a,
    email: a.email || b.email,
    telephone: a.telephone || b.telephone,
    relationRoles: [...roles],
    residenceIds: residences.size ? [...residences] : undefined,
    buyerQualificationStatus: bq,
    notes: [a.notes, b.notes].filter(Boolean).join('\n'),
    importMeta: {
      legacySources: [...a.importMeta.legacySources, ...b.importMeta.legacySources],
      mergedCount: a.importMeta.mergedCount + b.importMeta.mergedCount,
      lciIncomplete: a.importMeta.lciIncomplete || b.importMeta.lciIncomplete,
      missingLciFields: [
        ...new Set([...a.importMeta.missingLciFields, ...b.importMeta.missingLciFields]),
      ],
    },
  };
}

function deterministicId(payload) {
  const seed =
    payload.email?.toLowerCase() ||
    (payload.telephone ? `phone:${payload.telephone}` : null) ||
    payload.importMeta.legacySources.map((s) => `${s.collection}_${s.id}`).join('|');
  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return `imp_${hash}`;
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
        'Placez les clés serviceAccountOld.json / serviceAccountNew.json à la racine du projet V2.'
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

  console.log('\n=== Import contacts legacy → V2 ===');
  console.log(`Mode          : ${dryRun ? 'DRY-RUN (aucune écriture)' : 'EXECUTE (écriture active)'}`);
  console.log(`Source projet : ${oldSa.project_id}`);
  console.log(`Cible projet  : ${newSa.project_id}`);
  console.log(`orgId         : ${orgId}`);
  console.log(`ownerId       : ${ownerId}`);
  console.log(`visibility    : ${visibility}`);

  const [contactRows, vendorRows] = await Promise.all([
    fetchLegacyCollection(srcFs, 'contacts'),
    fetchLegacyCollection(srcFs, 'vendors'),
  ]);

  let allRows = [
    ...contactRows.map((r) => ({ ...r, source: 'contacts' })),
    ...vendorRows.map((r) => ({ ...r, source: 'vendors' })),
  ];

  if (limitN > 0) allRows = allRows.slice(0, limitN);

  const ctx = { orgId, ownerId, visibility };
  const byKey = new Map();
  const orphans = [];

  for (const row of allRows) {
    const key = dedupeKey(row);
    if (!key) {
      orphans.push(row);
      continue;
    }
    const ms = legacyUpdatedAtMillis(row.data);
    const bucket = byKey.get(key);
    if (!bucket) byKey.set(key, { rows: [row], latestMs: ms });
    else {
      bucket.rows.push(row);
      bucket.latestMs = Math.max(bucket.latestMs, ms);
    }
  }

  const payloads = [];
  let recordsMergedAway = 0;
  let duplicateGroups = 0;

  for (const { rows } of byKey.values()) {
    if (rows.length > 1) {
      duplicateGroups += 1;
      recordsMergedAway += rows.length - 1;
    }
    const sorted = [...rows].sort(
      (a, b) => legacyUpdatedAtMillis(b.data) - legacyUpdatedAtMillis(a.data)
    );
    let merged = rowToPayload(sorted[0], ctx);
    for (let i = 1; i < sorted.length; i++) {
      merged = mergeTwo(merged, rowToPayload(sorted[i], ctx));
    }
    payloads.push(merged);
  }
  for (const row of orphans) {
    payloads.push(rowToPayload(row, ctx));
  }

  const stats = {
    legacyContactsCount: contactRows.length,
    legacyVendorsCount: vendorRows.length,
    legacyTotalRaw: contactRows.length + vendorRows.length,
    duplicateGroups,
    recordsMergedAway,
    finalReadyCount: payloads.length,
    withEmailDedupeKey: [...byKey.keys()].filter((k) => k.startsWith('email:')).length,
    withPhoneDedupeKeyOnly: [...byKey.keys()].filter((k) => k.startsWith('phone:')).length,
    withoutDedupeKey: orphans.length,
    lciIncompleteCount: payloads.filter((p) => p.importMeta.lciIncomplete).length,
    generatedAt: new Date().toISOString(),
    dryRun,
  };

  const reportDir = resolve(__dirname, 'output');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, 'legacy-contacts-dry-run-report.json');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        stats,
        samplePayloads: payloads.slice(0, 5),
        sampleMergedGroups: duplicateGroups > 0 ? payloads.filter((p) => p.importMeta.mergedCount > 1).slice(0, 3) : [],
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('\n--- Rapport Dry-Run ---');
  console.log(`Contacts legacy (collection contacts/) : ${stats.legacyContactsCount}`);
  console.log(`Vendeurs legacy (collection vendors/)  : ${stats.legacyVendorsCount}`);
  console.log(`Total brut lu                          : ${stats.legacyTotalRaw}`);
  console.log(`Groupes doublons (email/téléphone)     : ${stats.duplicateGroups}`);
  console.log(`Fiches fusionnées (écart)              : ${stats.recordsMergedAway}`);
  console.log(`Fiches finales prêtes pour V2          : ${stats.finalReadyCount}`);
  console.log(`Clé dédup courriel                     : ${stats.withEmailDedupeKey}`);
  console.log(`Clé dédup téléphone seul               : ${stats.withPhoneDedupeKeyOnly}`);
  console.log(`Sans clé dédup (1 doc / legacy id)     : ${stats.withoutDedupeKey}`);
  console.log(`LCI incomplète (flag importMeta)       : ${stats.lciIncompleteCount}`);
  console.log(`\nRapport JSON : ${reportPath}`);

  if (dryRun) {
    console.log('\n✅ Dry-run terminé — aucune écriture. Relancez avec --execute après feu vert d’Alain.');
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
    const contactId = deterministicId(payload);
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
