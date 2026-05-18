import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
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
  /** ISO date/heure — début période de grâce 72 h (webhook Stripe / Functions). */
  gracePeriodStartedAt?: string;
  /** Dernier courriel d’onboarding / relance (J7, J21, J30, J40). */
  lastEmailSent?: NurtureEmailSent | null;
  /** Comptes courriel synchronisés (multi-inbox). */
  emailAccounts?: EmailAccount[];
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  /** true pendant le retour Google OAuth (redirect). */
  signInPending: boolean;
  logOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signInPending, setSignInPending] = useState(false);

  const loadProfile = async (firebaseUser: FirebaseUser) => {
    let profileDoc;
    try {
      profileDoc = await getDocFromServer(doc(db, 'users', firebaseUser.uid));
    } catch {
      profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    }
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

    void getRedirectResult(auth)
      .catch((err) => {
        console.warn('[auth] getRedirectResult', err);
      })
      .finally(() => {
        if (active) setSignInPending(false);
      });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const signIn = async () => {
    setSignInPending(true);
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signInPending, logOut, refreshProfile }}
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
