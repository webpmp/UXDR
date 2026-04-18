import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

type Role = "Admin" | "Facilitator" | "Reviewer" | "Requestor" | "Participant" | "Watcher" | "Guest";

export interface AvailabilityBlock {
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  available: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  role: Role;
  availability?: AvailabilityBlock[]; 
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  testRole: Role | null;
  setTestRole: (role: Role | null) => void;
  originalRole: Role | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  testRole: null,
  setTestRole: () => {},
  originalRole: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [testRole, setTestRole] = useState<Role | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (!userDoc.exists()) {
            // Check if invited by email
            const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
               const inviteDoc = querySnapshot.docs[0];
               const inviteData = inviteDoc.data() as UserProfile;
               
               // Create the real doc using UID
               await setDoc(doc(db, 'users', firebaseUser.uid), inviteData);
               setProfile(inviteData);
               
               // Delete the temporary invite doc so it doesn't clutter
               await deleteDoc(doc(db, 'users', inviteDoc.id));
            } else {
               // New user, create default Guest profile
               const isBootstrappedAdmin = firebaseUser.email === "webpmp@gmail.com";
               const newProfile: UserProfile = {
                 name: firebaseUser.displayName || 'Anonymous',
                 email: firebaseUser.email || '',
                 role: isBootstrappedAdmin ? 'Admin' : 'Guest',
               };
               
               await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
               setProfile(newProfile);
            }
          } else {
            setProfile(userDoc.data() as UserProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          // Set a fallback profile or logout if fetch fails to prevent infinite loops
          setProfile({
            name: firebaseUser.displayName || 'Error Loading Profile',
            email: firebaseUser.email || '',
            role: 'Guest',
          });
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Sign in failed", error);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  // Compute the effective profile by applying the test role if present
  const effectiveProfile = profile ? {
    ...profile,
    role: testRole || profile.role
  } : null;

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile: effectiveProfile, 
      loading, 
      signIn, 
      signOut, 
      testRole, 
      setTestRole, 
      originalRole: profile?.role || null 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
