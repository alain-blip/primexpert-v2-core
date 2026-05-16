/**
 * Backfill multi-tenant : assigne ton UID V2 sur les fiches `residences` (base nommée V2).
 *
 * IMPORTANT — Charte V2 : `courtiersResponsables` est une STRING (un seul UID), pas un tableau.
 *
 * Usage :
 *   node backfill_tenant.js --dry-run --uid=TON_UID_V2 --from-uid=ANCIEN_UID_COPIOTE
 *   node backfill_tenant.js --uid=TON_UID_V2 --from-uid=ANCIEN_UID_COPIOTE
 *   node backfill_tenant.js --uid=TON_UID_V2 --from-name="Alain St-Jean"
 *   node backfill_tenant.js --dry-run --uid=TON_UID_V2 --all
 *   node backfill_tenant.js --uid=TON_UID_V2 --all --normalize-status
 *
 * Variables d'environnement :
 *   BROKER_UID              (= --uid)
 *   BROKER_UID_FROM         (= --from-uid, filtre optionnel)
 *   DST_SERVICE_ACCOUNT     défaut ./serviceAccountNew.json
 *   FIRESTORE_DST_DATABASE_ID défaut ai-studio-1214d671-efd2-47da-93b7-425feb92155a
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

const CANONICAL_STATUSES = new Set([
  'prospect',
  'mandate',
  'promise',
  'expired',
  'unsigned',
  'sold',
]);

const dryRun = process.argv.includes('--dry-run');
const assignAll = process.argv.includes('--all');
const normalizeStatus = process.argv.includes('--normalize-status');

const uidArg = process.argv.find((a) => a.startsWith('--uid='));
const fromUidArg = process.argv.find((a) => a.startsWith('--from-uid='));
const fromNameArg = process.argv.find((a) => a.startsWith('--from-name='));
const collectionArg = process.argv.find((a) => a.startsWith('--collection='));
const limitArg = process.argv.find((a) => a.startsWith('--limit='));

const targetUid = (process.env.BROKER_UID || uidArg?.slice('--uid='.length) || '').trim();
const fromUid = (process.env.BROKER_UID_FROM || fromUidArg?.slice('--from-uid='.length) || '').trim();
const fromName = (process.env.BROKER_NAME_FROM || fromNameArg?.slice('--from-name='.length) || '').trim();
const COLLECTION = (collectionArg?.slice('--collection='.length) || 'residences').trim();
const limitN = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : 0;

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').trim();
  if (raw.startsWith('{\\rtf') || raw.startsWith('{\rtf')) {
    throw new Error(`Fichier RTF détecté : ${path}`);
  }
  return JSON.parse(raw);
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
  if (CANONICAL_STATUSES.has(lower)) return lower;
  if (
    lower === 'unsigned' ||
    lower === 'archive' ||
    lower === 'sans status' ||
    lower === 'sans statut' ||
    stripDiacritics(lower) === 'non signe'
  ) {
    return 'unsigned';
  }
  if (lower === 'lead') return 'prospect';

  const slug = stripDiacritics(lower).replace(/[^a-z0-9]+/g, '');
  const table = {
    prospect: 'prospect',
    prospection: 'prospect',
    lead: 'prospect',
    enprospection: 'prospect',
    mandate: 'mandate',
    mandat: 'mandate',
    enmandat: 'mandate',
    listed: 'mandate',
    promise: 'promise',
    promesse: 'promise',
    enpromesse: 'promise',
    expired: 'expired',
    expire: 'expired',
    sold: 'sold',
    vendu: 'sold',
    vendue: 'sold',
  };
  if (table[slug]) return table[slug];
  if (slug.includes('mandat')) return 'mandate';
  if (slug.includes('promess')) return 'promise';
  if (slug.includes('vendu') || slug.includes('vendue') || slug.includes('sold')) return 'sold';
  if (slug.includes('expir')) return 'expired';
  if (slug.includes('prospect') || slug.includes('prosp')) return 'prospect';
  return 'prospect';
}

/** Lit l'UID courtier présent sur la fiche (string ou legacy). */
function readOwnerUid(data) {
  const raw = data[TENANT_FIELD] ?? data.courtierResponsable ?? data.brokerId ?? data.assignedTo;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
    return raw[0].trim();
  }
  return '';
}

function matchesFromName(data, name) {
  const want = name.trim().toLowerCase();
  for (const field of [TENANT_FIELD, 'courtierResponsable']) {
    const raw = data[field];
    if (typeof raw === 'string' && raw.trim().toLowerCase() === want) return true;
  }
  return false;
}

function shouldUpdate(data) {
  if (assignAll) return true;
  if (fromUid && readOwnerUid(data) === fromUid) return true;
  if (fromName && matchesFromName(data, fromName)) return true;
  return false;
}

async function main() {
  if (!targetUid) {
    console.error('UID cible requis : --uid=TON_UID_V2 ou BROKER_UID=...');
    process.exit(1);
  }
  if (!assignAll && !fromUid && !fromName) {
    console.error(
      'Précise --from-uid=..., --from-name="Nom Copilote", ou --all (dangereux multi-courtiers).'
    );
    process.exit(1);
  }

  const dstPath = process.env.DST_SERVICE_ACCOUNT?.trim()
    ? resolve(process.env.DST_SERVICE_ACCOUNT)
    : resolve(__dirname, 'serviceAccountNew.json');
  if (!existsSync(dstPath)) throw new Error(`Fichier introuvable : ${dstPath}`);

  const dstDbId = process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DST_DB;
  const sa = loadJson(dstPath);

  const app = initializeApp({ credential: cert(sa) }, 'backfill-tenant');
  const db = dstDbId ? getFirestore(app, dstDbId) : getFirestore(app);

  console.log(`Projet     : ${sa.project_id}`);
  console.log(`Base       : ${dstDbId || '(default)'}`);
  console.log(`Collection : ${COLLECTION}`);
  console.log(`UID cible  : ${targetUid}`);
  const filterDesc = assignAll
    ? 'TOUTES les fiches'
    : [fromUid && `from-uid=${fromUid}`, fromName && `from-name="${fromName}"`]
        .filter(Boolean)
        .join(' + ');
  console.log(`Filtre     : ${filterDesc}`);
  console.log(`Status     : ${normalizeStatus ? 'normalisation active' : 'inchangé'}`);
  console.log(dryRun ? 'Mode       : DRY-RUN\n' : 'Mode       : ÉCRITURE\n');

  const snap = await db.collection(COLLECTION).get();
  const candidates = [];
  for (const doc of snap.docs) {
    if (!shouldUpdate(doc.data())) continue;
    candidates.push(doc);
    if (limitN > 0 && candidates.length >= limitN) break;
  }

  console.log(`Documents lus : ${snap.size}`);
  console.log(`À mettre à jour : ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('\nRien à faire. Vérifie --from-uid ou ouvre une fiche dans la console Firestore.');
    await deleteApp(app);
    return;
  }

  if (dryRun) {
    const sample = candidates.slice(0, 5);
    for (const doc of sample) {
      const d = doc.data();
      const owner = readOwnerUid(d);
      const st = normalizeStatus ? mapLegacyStatus(d) : d.status;
      console.log(`  ${doc.id} | owner=${owner || '(vide)'} → ${targetUid} | status→${st}`);
    }
    if (candidates.length > 5) console.log(`  … +${candidates.length - 5} autres`);
    await deleteApp(app);
    return;
  }

  let batch = db.batch();
  let inBatch = 0;
  let updated = 0;

  const flush = async () => {
    if (inBatch === 0) return;
    await batch.commit();
    batch = db.batch();
    inBatch = 0;
  };

  for (const doc of candidates) {
    const patch = { [TENANT_FIELD]: targetUid };
    if (normalizeStatus) {
      patch.status = mapLegacyStatus(doc.data());
    }
    batch.update(doc.ref, patch);
    inBatch++;
    updated++;
    if (inBatch >= BATCH_MAX) {
      process.stdout.write(`… commit lot (${updated}/${candidates.length})\n`);
      await flush();
    }
  }
  await flush();

  console.log(`\nTerminé : ${updated} fiche(s) — ${TENANT_FIELD}="${targetUid}" (string, pas tableau).`);
  await deleteApp(app);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
