/**
 * Analyse et hydratation du pipeline sur fiches orphelines (sans courtier assigné).
 *
 * Usage :
 *   node hydrate_pipeline.js --analyze
 *   node hydrate_pipeline.js --analyze --dry-run
 *   node hydrate_pipeline.js --hydrate-pipeline --uid=TON_UID_V2 --dry-run
 *   node hydrate_pipeline.js --hydrate-pipeline --uid=bYwUG6mxNmPcvK9Xz2Uuy4FxqD83
 *   node hydrate_pipeline.js --stamp-catalog-empty --dry-run   # passive → courtiersResponsables ""
 *
 * Ne modifie jamais les fiches dont courtierResponsable / courtiersResponsables
 * contient Stella Caputo ou Francois Lachance.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DST_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const TENANT_FIELD = 'courtiersResponsables';
const BATCH_MAX = 500;

const PIPELINE_ACTIVE = ['prospect', 'mandate', 'promise', 'expired', 'sold'];

const PROTECTED_OWNER_SUBSTRINGS = ['stella caputo', 'francois lachance', 'françois lachance'];

const ATTRIBUTION_FIELD_HINTS = [
  'createur',
  'createdBy',
  'auteur',
  'courtier',
  'broker',
  'assigned',
  'responsable',
  'historique',
  'owner',
  'utilisateur',
];

const analyzeOnly = process.argv.includes('--analyze');
const hydratePipeline = process.argv.includes('--hydrate-pipeline');
const stampCatalog = process.argv.includes('--stamp-catalog-empty');
const dryRun = process.argv.includes('--dry-run');

const uidArg = process.argv.find((a) => a.startsWith('--uid='));
const targetUid = (process.env.BROKER_UID || uidArg?.slice('--uid='.length) || '').trim();

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').trim());
}

function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function mapLegacyStatus(data) {
  const raw =
    data.status ??
    data.pipelineStatus ??
    data.etat ??
    data.phase ??
    data.stage ??
    data.statut ??
    '';
  if (typeof raw !== 'string' || !raw.trim()) return 'unsigned';

  const lower = raw.trim().toLowerCase();
  if (PIPELINE_ACTIVE.includes(lower)) return lower;
  if (
    lower === 'unsigned' ||
    lower === 'archive' ||
    lower === 'sans status' ||
    lower === 'sans statut'
  ) {
    return 'unsigned';
  }
  if (lower === 'lead') return 'prospect';

  const slug = stripDiacritics(lower).replace(/[^a-z0-9]+/g, '');
  const table = {
    prospect: 'prospect',
    prospection: 'prospect',
    mandate: 'mandate',
    mandat: 'mandate',
    promise: 'promise',
    promesse: 'promise',
    expired: 'expired',
    sold: 'sold',
    vendu: 'sold',
    unsigned: 'unsigned',
  };
  if (table[slug]) return table[slug];
  if (slug.includes('mandat')) return 'mandate';
  if (slug.includes('promess')) return 'promise';
  if (slug.includes('vendu')) return 'sold';
  if (slug.includes('expir')) return 'expired';
  if (slug.includes('prospect')) return 'prospect';
  return 'prospect';
}

function readAnyOwner(data) {
  for (const field of [TENANT_FIELD, 'courtierResponsable', 'brokerId', 'assignedTo']) {
    const raw = data[field];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (Array.isArray(raw) && raw[0] && typeof raw[0] === 'string') return String(raw[0]).trim();
  }
  return '';
}

function isOrphan(data) {
  return readAnyOwner(data) === '';
}

function isProtectedOwner(data) {
  const owner = readAnyOwner(data).toLowerCase();
  if (!owner) return false;
  return PROTECTED_OWNER_SUBSTRINGS.some((p) => owner.includes(p));
}

function isPipelineActiveStatus(status) {
  return PIPELINE_ACTIVE.includes(status);
}

function attributionSample(data) {
  const out = {};
  for (const [key, val] of Object.entries(data)) {
    const lk = key.toLowerCase();
    if (!ATTRIBUTION_FIELD_HINTS.some((h) => lk.includes(h))) continue;
    if (val === undefined || val === null || val === '') continue;
    out[key] = typeof val === 'object' ? JSON.stringify(val).slice(0, 80) : String(val).slice(0, 80);
  }
  return out;
}

async function main() {
  if (!analyzeOnly && !hydratePipeline && !stampCatalog) {
    console.error('Usage : --analyze | --hydrate-pipeline --uid=... | --stamp-catalog-empty');
    process.exit(1);
  }
  if ((hydratePipeline || stampCatalog) && !targetUid && hydratePipeline) {
    console.error('--hydrate-pipeline requiert --uid=TON_UID_V2');
    process.exit(1);
  }

  const dstPath = resolve(__dirname, 'serviceAccountNew.json');
  if (!existsSync(dstPath)) throw new Error(`Fichier introuvable : ${dstPath}`);

  const dstDbId = process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DST_DB;
  const sa = loadJson(dstPath);
  const app = initializeApp({ credential: cert(sa) }, 'hydrate-pipeline');
  const db = getFirestore(app, dstDbId);

  console.log(`Projet : ${sa.project_id}`);
  console.log(`Base   : ${dstDbId}\n`);

  const snap = await db.collection('residences').get();
  const orphans = [];
  const assigned = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (isOrphan(data)) orphans.push({ id: doc.id, data, ref: doc.ref });
    else assigned.push({ id: doc.id, data });
  }

  const statusCounts = {};
  const rawStatusCounts = {};
  const activeOrphans = [];
  const passiveOrphans = [];
  let protectedCount = 0;

  for (const row of orphans) {
    const st = mapLegacyStatus(row.data);
    statusCounts[st] = (statusCounts[st] ?? 0) + 1;
    const raw =
      row.data.status ??
      row.data.pipelineStatus ??
      row.data.etat ??
      row.data.statut ??
      '(vide)';
    const rawKey = String(raw).slice(0, 60);
    rawStatusCounts[rawKey] = (rawStatusCounts[rawKey] ?? 0) + 1;

    if (isPipelineActiveStatus(st)) activeOrphans.push({ ...row, status: st });
    else passiveOrphans.push({ ...row, status: st });
  }

  console.log(`Documents total     : ${snap.size}`);
  console.log(`Avec courtier       : ${assigned.length}`);
  console.log(`Orphelins (vide)    : ${orphans.length}\n`);

  console.log('--- Statuts normalisés (orphelins) ---');
  for (const [st, n] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    const tag = isPipelineActiveStatus(st) ? ' [pipeline actif]' : ' [inventaire / passif]';
    console.log(`  ${String(n).padStart(5)}  ${st}${tag}`);
  }

  console.log('\n--- Pipeline actif (orphelins) — cible hydratation ---');
  const byActive = {};
  for (const row of activeOrphans) {
    byActive[row.status] = (byActive[row.status] ?? 0) + 1;
  }
  for (const st of PIPELINE_ACTIVE) {
    if (byActive[st]) console.log(`  ${String(byActive[st]).padStart(5)}  ${st}`);
  }
  console.log(`  TOTAL actifs orphelins : ${activeOrphans.length}`);

  console.log('\n--- Échantillon champs d\'attribution (5 orphelins actifs) ---');
  for (const row of activeOrphans.slice(0, 5)) {
    const hint = attributionSample(row.data);
    console.log(`  ${row.id} status→${row.status}`);
  if (Object.keys(hint).length) console.log(`    ${JSON.stringify(hint)}`);
    else console.log('    (aucun champ createur/courtier détecté)');
  }

  if (analyzeOnly) {
    console.log('\n--- Règle catalogue (état actuel du code) ---');
    console.log(
      '  Firestore rules : lecture UNIQUEMENT si courtiersResponsables == ton UID.'
    );
    console.log(
      '  Les orphelins (champ absent/vide) sont INVISIBLES dans l\'app tant que les rules'
    );
    console.log(
      '  ne permettent pas la lecture catalogue OU qu\'on ne requête pas courtiersResponsables == "".'
    );
    console.log(
      '\n  Prochaine passe suggérée :\n' +
        `    node hydrate_pipeline.js --hydrate-pipeline --uid=${targetUid || 'TON_UID'} --dry-run\n` +
        '    node hydrate_pipeline.js --stamp-catalog-empty --dry-run  (passifs → champ vide explicite)'
    );
    await deleteApp(app);
    return;
  }

  if (hydratePipeline) {
    const toWrite = activeOrphans.filter((row) => !isProtectedOwner(row.data));
    protectedCount = activeOrphans.length - toWrite.length;

    console.log(`\nHydratation pipeline → ${targetUid}`);
    console.log(`  Fiches actives orphelines : ${activeOrphans.length}`);
    console.log(`  Exclues (Stella/François) : ${protectedCount}`);
    console.log(`  À assigner              : ${toWrite.length}`);
    console.log(dryRun ? '  Mode : DRY-RUN\n' : '  Mode : ÉCRITURE\n');

    if (dryRun) {
      for (const row of toWrite.slice(0, 8)) {
        console.log(`  ${row.id} → ${targetUid} | status=${row.status}`);
      }
      if (toWrite.length > 8) console.log(`  … +${toWrite.length - 8} autres`);
      await deleteApp(app);
      return;
    }

    let batch = db.batch();
    let n = 0;
    const flush = async () => {
      if (n === 0) return;
      await batch.commit();
      batch = db.batch();
      n = 0;
    };

    let updated = 0;
    for (const row of toWrite) {
      batch.update(row.ref, {
        [TENANT_FIELD]: targetUid,
        status: row.status,
      });
      n++;
      updated++;
      if (n >= BATCH_MAX) {
        await flush();
        process.stdout.write(`… ${updated}/${toWrite.length}\n`);
      }
    }
    await flush();
    console.log(`\nTerminé : ${updated} fiche(s) pipeline assignées à ${targetUid}.`);
  }

  if (stampCatalog) {
    const toStamp = passiveOrphans.filter((row) => !isProtectedOwner(row.data));
    console.log(`\nCatalogue passif → courtiersResponsables="" (${toStamp.length} fiches)`);
    console.log(dryRun ? 'Mode : DRY-RUN\n' : 'Mode : ÉCRITURE\n');

    if (dryRun) {
      console.log(`  ${toStamp.length} fiches recevraient "" (lecture catalogue partagée côté rules/app).`);
      await deleteApp(app);
      return;
    }

    let batch = db.batch();
    let n = 0;
    let updated = 0;
    const flush = async () => {
      if (n === 0) return;
      await batch.commit();
      batch = db.batch();
      n = 0;
    };

    for (const row of toStamp) {
      batch.update(row.ref, {
        [TENANT_FIELD]: '',
        status: row.status,
      });
      n++;
      updated++;
      if (n >= BATCH_MAX) await flush();
    }
    await flush();
    console.log(`Terminé : ${updated} fiche(s) marquées catalogue (courtiersResponsables="").`);
  }

  await deleteApp(app);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
