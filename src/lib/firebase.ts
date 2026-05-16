import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, type Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import baseConfig from '../../firebase-applet-config.json';

type AppletConfig = typeof baseConfig;

const env = import.meta.env;

function buildFirebaseOptions(): AppletConfig {
  return {
    ...baseConfig,
    apiKey: env.VITE_FIREBASE_API_KEY?.trim() || baseConfig.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || baseConfig.authDomain,
    projectId: env.VITE_FIREBASE_PROJECT_ID?.trim() || baseConfig.projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || baseConfig.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || baseConfig.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID?.trim() || baseConfig.appId,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || baseConfig.measurementId,
    firestoreDatabaseId: env.VITE_FIRESTORE_DATABASE_ID?.trim() || baseConfig.firestoreDatabaseId,
  };
}

const firebaseOpts = buildFirebaseOptions();

const appConfig = {
  apiKey: firebaseOpts.apiKey,
  authDomain: firebaseOpts.authDomain,
  projectId: firebaseOpts.projectId,
  storageBucket: firebaseOpts.storageBucket,
  messagingSenderId: firebaseOpts.messagingSenderId,
  appId: firebaseOpts.appId,
  ...(firebaseOpts.measurementId ? { measurementId: firebaseOpts.measurementId } : {}),
};

const app: FirebaseApp = initializeApp(appConfig);

const dbId = firebaseOpts.firestoreDatabaseId.trim();
export const db: Firestore =
  !dbId || dbId === '(default)' ? getFirestore(app) : getFirestore(app, dbId);

export const auth = getAuth(app);
export const storage = getStorage(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();
