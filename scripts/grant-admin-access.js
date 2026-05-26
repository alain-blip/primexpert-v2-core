/**
 * Accorde le rôle administrateur (Firestore + Custom Claims).
 *
 * Usage — compte existant (déjà connecté une fois avec Google sur cette adresse) :
 *   node scripts/grant-admin-access.js --email=collaborateur@exemple.com --org-from-uid=bYwUG6mxNmPcvK9Xz2Uuy4FxqD83
 *
 * Usage — créer compte courriel + mot de passe temporaire (nécessite Email/Password activé dans Firebase Auth) :
 *   node scripts/grant-admin-access.js --email=collaborateur@exemple.com --create --org-from-uid=bYwUG6mxNmPcvK9Xz2Uuy4FxqD83
 *
 * Rôles : admin (défaut) | admin_system (direction / KPIs finance)
 *
 * Prérequis : serviceAccountNew.json à la racine (ou DST_SERVICE_ACCOUNT=/chemin/sa.json)
 */

import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEFAULT_DB = 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';
const DEFAULT_ORG_FROM_UID = 'bYwUG6mxNmPcvK9Xz2Uuy4FxqD83';

const emailArg = process.argv.find((a) => a.startsWith('--email='));
const orgFromUidArg = process.argv.find((a) => a.startsWith('--org-from-uid='));
const orgIdArg = process.argv.find((a) => a.startsWith('--org-id='));
const roleArg = process.argv.find((a) => a.startsWith('--role='));
const createFlag = process.argv.includes('--create');
const dryRun = process.argv.includes('--dry-run');

const email = (emailArg?.slice('--email='.length) || '').trim().toLowerCase();
const orgFromUid = (orgFromUidArg?.slice('--org-from-uid='.length) || DEFAULT_ORG_FROM_UID).trim();
const orgIdOverride = (orgIdArg?.slice('--org-id='.length) || '').trim();
const role = (roleArg?.slice('--role='.length) || 'admin').trim();

if (!email || !email.includes('@')) {
  console.error(
    'Usage: node scripts/grant-admin-access.js --email=courriel@domaine.com [--create] [--org-from-uid=UID_ALAIN] [--org-id=org_xxx] [--role=admin|admin_system] [--dry-run]'
  );
  process.exit(1);
}

if (role !== 'admin' && role !== 'admin_system') {
  console.error('Rôle invalide. Utiliser admin ou admin_system.');
  process.exit(1);
}

function loadServiceAccount() {
  const path = process.env.DST_SERVICE_ACCOUNT?.trim()
    ? resolve(process.env.DST_SERVICE_ACCOUNT)
    : resolve(ROOT, 'serviceAccountNew.json');
  if (!existsSync(path)) {
    throw new Error(
      `Fichier compte de service introuvable : ${path}\nPlacez serviceAccountNew.json à la racine ou définissez DST_SERVICE_ACCOUNT.`
    );
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function tempPassword() {
  const raw = randomBytes(12).toString('base64url');
  return `Px!${raw.slice(0, 14)}9`;
}

async function resolveOrgId(db) {
  if (orgIdOverride) return orgIdOverride;
  const ref = db.collection('users').doc(orgFromUid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Utilisateur modèle introuvable : users/${orgFromUid}`);
  }
  const orgId = snap.data()?.orgId;
  if (!orgId || typeof orgId !== 'string') {
    throw new Error(`orgId manquant sur users/${orgFromUid}`);
  }
  return orgId;
}

async function main() {
  const sa = loadServiceAccount();
  const app = initializeApp({ credential: cert(sa) });
  const auth = getAuth(app);
  const db = getFirestore(app, process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DB);

  const orgId = await resolveOrgId(db);
  console.log(`Projet Firebase : ${sa.project_id}`);
  console.log(`Base Firestore  : ${process.env.FIRESTORE_DST_DATABASE_ID?.trim() || DEFAULT_DB}`);
  console.log(`Courriel cible  : ${email}`);
  console.log(`Organisation    : ${orgId}`);
  console.log(`Rôle            : ${role}`);

  let userRecord;
  let generatedPassword = null;

  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`Compte Auth existant — uid=${userRecord.uid}`);
  } catch (e) {
    const code = e?.code || e?.errorInfo?.code;
    if (code !== 'auth/user-not-found') throw e;
    if (!createFlag) {
      console.error(
        '\nAucun compte Auth pour ce courriel. Options :\n' +
          '  1) Le collaborateur se connecte une fois avec Google (même courriel), puis relancez ce script.\n' +
          '  2) Relancez avec --create (Email/Password doit être activé dans Firebase Console → Authentication).'
      );
      process.exit(1);
    }
    generatedPassword = tempPassword();
    if (dryRun) {
      console.log('[dry-run] Créerait un utilisateur Auth avec mot de passe temporaire.');
      userRecord = { uid: '(dry-run-uid)', email, displayName: email.split('@')[0] };
    } else {
      userRecord = await auth.createUser({
        email,
        password: generatedPassword,
        emailVerified: false,
        displayName: email.split('@')[0],
      });
      console.log(`Compte Auth créé — uid=${userRecord.uid}`);
    }
  }

  const uid = userRecord.uid;
  const displayName =
    userRecord.displayName || email.split('@')[0].replace(/\./g, ' ').slice(0, 80);

  const userDoc = {
    uid,
    email,
    displayName,
    photoUrl: userRecord.photoURL || '',
    orgId,
    role,
    billingStatus: 'active',
    updatedAt: FieldValue.serverTimestamp(),
  };

  const claims = { admin: true, role };

  if (dryRun) {
    console.log('[dry-run] Firestore users/', uid, userDoc);
    console.log('[dry-run] Custom claims', claims);
    if (generatedPassword) console.log('[dry-run] Mot de passe temporaire (non créé)');
    if (getApps().length) await deleteApp(app);
    return;
  }

  await auth.setCustomUserClaims(uid, claims);
  console.log('Custom claims définis :', claims);

  const userRef = db.collection('users').doc(uid);
  const existing = await userRef.get();
  if (existing.exists) {
    await userRef.update({
      orgId,
      role,
      email,
      displayName,
      billingStatus: 'active',
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`Firestore users/${uid} mis à jour (rôle ${role}, orgId ${orgId}).`);
  } else {
    await userRef.set({
      ...userDoc,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`Firestore users/${uid} créé.`);
  }

  const orgRef = db.collection('organizations').doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    await orgRef.set({
      name: `Équipe ${displayName}`,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`Organisation ${orgId} créée.`);
  }

  console.log('\n=== RÉSUMÉ POUR LE PO ===');
  console.log(`Courriel     : ${email}`);
  console.log(`UID          : ${uid}`);
  console.log(`Rôle         : ${role}`);
  console.log(`Organisation : ${orgId}`);
  if (generatedPassword) {
    console.log(`Mot de passe temporaire : ${generatedPassword}`);
    console.log(
      '\nImportant : l’application PrimeXpert utilise la connexion Google par défaut.\n' +
        '  • Si le collaborateur a Google Workspace sur ce courriel → « Connexion Google ».\n' +
        '  • Sinon : activer « E-mail/Mot de passe » dans Firebase Console → Authentication,\n' +
        '    puis fournir ce mot de passe (ou réinitialiser via la console Firebase).'
    );
  } else {
    console.log(
      '\nConnexion : utiliser « Connexion Google » avec ce courriel (compte déjà en Auth).'
    );
  }
  console.log('Après connexion : forcer un rafraîchissement (déconnexion/reconnexion) pour les Custom Claims.');

  if (getApps().length) await deleteApp(app);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
