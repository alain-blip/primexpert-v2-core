import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AssetNiche } from '../types/residence';
import type { BillingStatus, NurtureEmailSent } from '../types/billing';
import type { J7SurveyResponse } from '../types/nurture';
import type { EmailAccount } from '../types/emailAccount';
import type { UserTelephony } from '@primexpert/core/telephony';
import {
  deriveBrokerProfilePhotoCompliance,
  type BrokerPhotoComplianceResult,
} from '@primexpert/core/security';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
  orgId: string;
  /** `admin_system` = direction (KPIs finance) ; `admin` = personnel (liste sans montants agrégés). */
  role: 'admin' | 'admin_system' | 'member';
  /** Début essai 45 j (yyyy-mm-dd), aligné Firestore `trialStartDate`. */
  trialStartDate?: string;
  licenseName?: string;
  title?: string;
  agency?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  j7Survey?: J7SurveyResponse;
  /** RBAC multi-niches : silos visibles pour ce courtier (absent = tous). */
  accessibleSilos?: AssetNiche[];
  /** Forfaits Radar : `rpa` | `cpe` | `plex` | `commercial` (prioritaire sur `accessibleSilos`). */
  specialties?: string[];
  /**
   * Chérif — accès Radar. Mis à jour par Stripe / Cloud Functions uniquement.
   * `grace_period` = 72 h après échec ; `suspended` = écran de blocage.
   */
  billingStatus?: BillingStatus;
  /** Grille Alain — quota Drive officiel. */
  tier?: 'solo' | 'solo_plus' | 'pro' | 'pro_plus' | 'super_pro';
  /** ISO date/heure — début période de grâce 72 h (webhook Stripe / Functions). */
  gracePeriodStartedAt?: string;
  /** Dernier courriel d’onboarding / relance (J7, J21, J30, J40). */
  lastEmailSent?: NurtureEmailSent | null;
  /** Comptes courriel synchronisés (multi-inbox). */
  emailAccounts?: EmailAccount[];
  /**
   * Téléphonie VOIP — numéro Twilio assigné par l'admin (`telephony.twilioNumber` requis pour les appels intégrés).
   */
  telephony?: UserTelephony | null;
  /** Horodatage téléversement photo permis — base du verrou chronologique OACIQ (1826 j). */
  profilePhotoUploadedAtMillis?: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  /** true si la photo de permis dépasse 5 ans (conformité publicitaire OACIQ). */
  isProfilePhotoExpired: boolean;
  /** Détail chronologique dérivé du core (`daysRemaining`, etc.). */
  photoCompliance: BrokerPhotoComplianceResult;
  signIn: () => Promise<void>;
  /** true pendant l’ouverture de la fenêtre Google OAuth (popup). */
  signInPending: boolean;
  logOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_READ_TIMEOUT_MS = 8_000;

async function readUserProfileDoc(uid: string) {
  try {
    const snap = await Promise.race([
      getDocFromServer(doc(db, 'users', uid)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('profile-read-timeout')), PROFILE_READ_TIMEOUT_MS)
      ),
    ]);
    return snap;
  } catch {
    return getDoc(doc(db, 'users', uid));
  }
}

function isPopupClosedByUser(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signInPending, setSignInPending] = useState(false);

  const loadProfile = async (firebaseUser: FirebaseUser) => {
    const profileDoc = await readUserProfileDoc(firebaseUser.uid);
    if (profileDoc.exists()) {
      setProfile(profileDoc.data() as UserProfile);
      return;
    }

    const newOrgId = `org_${firebaseUser.uid}`;
    const trialStartDate = new Date().toISOString().slice(0, 10);
    const newProfile: UserProfile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || 'Courtier Primexpert',
      photoUrl: firebaseUser.photoURL || '',
      orgId: newOrgId,
      role: 'admin',
      trialStartDate,
      billingStatus: 'active',
    };

    await setDoc(doc(db, 'organizations', newOrgId), {
      name: `${newProfile.displayName}'s Team`,
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'users', firebaseUser.uid), {
      ...newProfile,
      createdAt: serverTimestamp(),
    });

    setProfile(newProfile);
  };

  const refreshProfile = async () => {
    if (!user) return;
    await loadProfile(user);
  };

  useEffect(() => {
    let active = true;
    const bootTimeout = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 15_000);

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      try {
        if (firebaseUser) {
          await loadProfile(firebaseUser);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('[auth] loadProfile', err);
        setProfile(null);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(bootTimeout);
      unsub();
    };
  }, []);

  const signIn = async () => {
    setSignInPending(true);
    try {
      const provider = new GoogleAuthProvider();
      /**
       * Popup en dev et prod — évite la perte de session au retour OAuth
       * (ITP / cookies tiers avec signInWithRedirect sur Firebase Hosting).
       */
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (isPopupClosedByUser(err)) {
        console.warn(
          '[auth] Connexion Google annulée — fenêtre fermée par l’utilisateur.',
          err
        );
        return;
      }
      console.error('[auth] Google sign-in', err);
      throw err;
    } finally {
      setSignInPending(false);
    }
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const photoCompliance = useMemo(
    () => deriveBrokerProfilePhotoCompliance(profile?.profilePhotoUploadedAtMillis ?? 0),
    [profile?.profilePhotoUploadedAtMillis]
  );

  const isProfilePhotoExpired = Boolean(profile) && photoCompliance.isProfilePhotoExpired;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isProfilePhotoExpired,
        photoCompliance,
        signIn,
        signInPending,
        logOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
