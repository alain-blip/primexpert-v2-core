import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AssetNiche } from '../types/residence';

interface UserProfile {
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
  /** RBAC multi-niches : silos visibles pour ce courtier (absent = tous). */
  accessibleSilos?: AssetNiche[];
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        let profileDoc;
        try {
          profileDoc = await getDocFromServer(doc(db, 'users', firebaseUser.uid));
        } catch {
          profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        }
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        } else {
          // New user - auto-create organization for now (or join existing if we had invites)
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
          };

          await setDoc(doc(db, 'organizations', newOrgId), {
            name: `${newProfile.displayName}'s Team`,
            createdAt: serverTimestamp()
          });

          await setDoc(doc(db, 'users', firebaseUser.uid), {
            ...newProfile,
            createdAt: serverTimestamp()
          });
          
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logOut }}>
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
