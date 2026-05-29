/**
 * Connexion Google — chunk isolé (chargé au clic, pas au paint de la page publique).
 */

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './lib/firebase';

export async function runPublicSignIn(): Promise<boolean> {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    return Boolean(auth.currentUser);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return false;
    }
    console.error('[auth-signin] Connexion Google', err);
    throw err;
  }
}
