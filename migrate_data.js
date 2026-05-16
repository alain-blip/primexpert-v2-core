/**
 * Migration Firestore (projet source Copilote → primexpert-app-v2).
 *
 * Prérequis :
 *   - `serviceAccountOld.json` et `serviceAccountNew.json` = JSON Google pur (pas RTF).
 *   - Comptes de service avec droits Firestore en lecture (source) et écriture (cible).
 *
 * Usage :
 *   node migrate_data.js --dry-run
 *   node migrate_data.js
 *   node migrate_data.js --collection=proprietes --dry-run
 *   node migrate_data.js --collection=proprietes
 *   node migrate_data.js --collection=deals --no-asset-niche   # copie sans forcer assetNiche
 *
 * Après migration `proprietes` : chaque doc doit pouvoir passer les Security Rules V2
 * (champ `courtiersResponsables` == UID courtier, comme pour `residences`). Sinon prévoir
 * un script de normalisation ou ajuster les rules.
 * Variables d’environnement (optionnel) :
 *   SRC_SERVICE_ACCOUNT, DST_SERVICE_ACCOUNT, FIRESTORE_SRC_DATABASE_ID, FIRESTORE_DST_DATABASE_ID
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DST_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const ASSET_NICHE_RPA = 'RPA';
const BATCH_MAX = 500;

const dryRun = process.argv.includes('--dry-run');
const noAssetNiche = process.argv.includes('--no-asset-niche');

const collectionArg = process.argv.find((a) => a.startsWith('--collection='));
const COLLECTION = collectionArg ? collectionArg.slice('--collection='.length).trim() : 'residences';
if (!COLLECTION) {
  console.error('Usage : --collection=nom (ex. residences, proprietes)');
  process.exit(1);
}

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').trim();
  if (raw.startsWith('{\\rtf') || raw.startsWith('{\rtf')) {
    throw new Error(
      `Fichier RTF détecté : ${path}\nOuvre la clé dans un éditeur texte brut ou retélécharge le JSON depuis la console GCP.`
    );
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

  for (const name of ['migration-src', 'migration-dst']) {
    const existing = getApps().find((a) => a.name === name);
    if (existing) await deleteApp(existing);
  }

  const srcApp = initializeApp({ credential: cert(oldSa) }, 'migration-src');
  const dstApp = initializeApp({ credential: cert(newSa) }, 'migration-dst');

  const srcFs = srcDbId ? getFirestore(srcApp, srcDbId) : getFirestore(srcApp);
  const dstFs = dstDbId ? getFirestore(dstApp, dstDbId) : getFirestore(dstApp);

  console.log(`Source      : ${oldSa.project_id} / DB "${srcDbId || '(default)'}"`);
  console.log(`Destination : ${newSa.project_id} / DB "${dstDbId || '(default)'}"`);
  console.log(`Collection  : ${COLLECTION}`);
  console.log(`assetNiche   : ${noAssetNiche ? 'non (brut Copilote)' : `injecté "${ASSET_NICHE_RPA}"`}`);
  console.log(dryRun ? 'Mode        : DRY-RUN (aucune écriture)\n' : 'Mode        : ÉCRITURE\n');

  const snap = await srcFs.collection(COLLECTION).get();
  console.log(`Documents lus : ${snap.size}`);

  if (dryRun) {
    await deleteApp(srcApp);
    await deleteApp(dstApp);
    return;
  }

  let batch = dstFs.batch();
  let inBatch = 0;
  let written = 0;

  const flush = async () => {
    if (inBatch === 0) return;
    await batch.commit();
    batch = dstFs.batch();
    inBatch = 0;
  };

  for (const doc of snap.docs) {
    const raw = doc.data();
    const merged = noAssetNiche ? { ...raw } : { ...raw, assetNiche: ASSET_NICHE_RPA };
    const data = stripUndefinedDeep(merged);
    const ref = dstFs.collection(COLLECTION).doc(doc.id);
    batch.set(ref, data, { merge: false });
    inBatch++;
    written++;
    if (inBatch >= BATCH_MAX) {
      process.stdout.write(`… commit lot (${written}/${snap.size})\n`);
      await flush();
    }
  }
  await flush();

  console.log(
    `\nTerminé : ${written} document(s) écrit(s) dans ${COLLECTION} (IDs conservés` +
      (noAssetNiche ? ').' : `, assetNiche="${ASSET_NICHE_RPA}").`)
  );

  await deleteApp(srcApp);
  await deleteApp(dstApp);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
