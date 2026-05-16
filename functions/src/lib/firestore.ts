import * as admin from 'firebase-admin';

const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-1214d671-efd2-47da-93b7-425feb92155a';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db =
  FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== '(default)'
    ? admin.firestore(admin.app(), FIRESTORE_DATABASE_ID)
    : admin.firestore();

export const EMAIL_THREADS = 'email_threads';
export const EMAIL_MESSAGES = 'messages';

export function userThreadsCol(uid: string) {
  return db.collection('users').doc(uid).collection(EMAIL_THREADS);
}

export function threadMessagesCol(uid: string, threadId: string) {
  return userThreadsCol(uid).doc(threadId).collection(EMAIL_MESSAGES);
}
