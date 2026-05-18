import type { Firestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';

let dbInstance: Firestore | undefined;

/** Admin Firestore (lazy) — évite timeout au déploiement Functions. */
export function getDb(): Firestore {
  if (dbInstance) return dbInstance;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require('firebase-admin') as typeof import('firebase-admin');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirestore } = require('firebase-admin/firestore') as typeof import('firebase-admin/firestore');

  let app;
  try {
    app = admin.app();
  } catch {
    app = admin.initializeApp();
  }

  dbInstance =
    FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== '(default)'
      ? getFirestore(app, FIRESTORE_DATABASE_ID)
      : getFirestore(app);
  dbInstance.settings({ ignoreUndefinedProperties: true });
  return dbInstance;
}

export const EMAIL_THREADS = 'email_threads';
export const EMAIL_MESSAGES = 'messages';

export function userThreadsCol(uid: string) {
  return getDb().collection('users').doc(uid).collection(EMAIL_THREADS);
}

export function threadMessagesCol(uid: string, threadId: string) {
  return userThreadsCol(uid).doc(threadId).collection(EMAIL_MESSAGES);
}
