/**
 * Auth Firebase chargé à la demande — hors bundle d'entrée publique `/` (évite OOM mobile).
 */

export async function publicSignIn(): Promise<boolean> {
  const [{ auth }, firebaseAuth] = await Promise.all([
    import('./firebase'),
    import('firebase/auth'),
  ]);

  try {
    const provider = new firebaseAuth.GoogleAuthProvider();
    await firebaseAuth.signInWithPopup(auth, provider);
    return Boolean(auth.currentUser);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return false;
    }
    console.error('[publicEntryAuth] Connexion Google', err);
    throw err;
  }
}

/** Vérifie une session existante (desktop uniquement, après paint). */
export async function checkExistingSession(): Promise<boolean> {
  const [{ auth }, { onAuthStateChanged }] = await Promise.all([
    import('./firebase'),
    import('firebase/auth'),
  ]);

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(false), 4_000);
    const unsub = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsub();
      resolve(Boolean(user));
    });
  });
}
