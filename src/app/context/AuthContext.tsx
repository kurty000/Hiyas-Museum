import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser, getAuth as getSecondaryAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase';

export interface User {
  username: string;
  role: 'admin' | 'curator';
}

export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  password?: string; // We won't store passwords in Firestore, only used for creation if we handle it
  role: 'admin' | 'curator';
  createdAt: Date;
  lastLogin?: Date;
  archived: boolean;
  failedAttempts: number;
  lockedUntil?: Date;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error: string }>;
  logout: () => void;
  isAdmin: boolean;
  // User management (Admin only)
  managedUsers: ManagedUser[];
  addUser: (username: string, email: string, password: string, role: 'admin' | 'curator') => Promise<void>;
  archiveUser: (id: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<Pick<ManagedUser, 'username' | 'email' | 'role'>>) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Firebase Auth Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user metadata from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUser({
              username: data.username || firebaseUser.email,
              role: data.role || 'curator',
            });
            // Update last login
            await updateDoc(doc(db, 'users', firebaseUser.uid), {
              lastLogin: Timestamp.now()
            });
          } else {
            // Fallback if no user doc exists
            setUser({
              username: firebaseUser.email || 'User',
              role: 'curator',
            });
          }
        } catch (err) {
          console.error("Error fetching user metadata:", err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- Real-time listeners for Managed Users (Admin only) ---
  useEffect(() => {
    if (user?.role !== 'admin') {
      setManagedUsers([]);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: ManagedUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          username: data.username || '',
          email: data.email || '',
          role: data.role || 'curator',
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
          archived: data.archived || false,
          failedAttempts: data.failedAttempts || 0,
          lockedUntil: data.lockedUntil?.toDate(),
        });
      });
      setManagedUsers(usersData);
    });

    return () => unsubscribe();
  }, [user]);


  // --- Session Timeout: track user activity ---
  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!user) return;

    const activityEvents = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    activityEvents.forEach(event =>
      window.addEventListener(event, resetActivityTimer, { passive: true })
    );

    // Check every 30 seconds if user has been idle for 5 min
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= SESSION_TIMEOUT_MS) {
        auth.signOut();
      }
    }, 30_000);

    return () => {
      activityEvents.forEach(event =>
        window.removeEventListener(event, resetActivityTimer)
      );
      clearInterval(interval);
    };
  }, [user, resetActivityTimer]);

  // --- Login ---
  // Note: The previous signature used 'username'. We changed it to 'email' because Firebase Auth uses Email/Password by default.
  const login = async (email: string, password: string): Promise<{ success: boolean; error: string }> => {
    try {
      // For a robust lockout system, you'd check Firestore before attempting auth, 
      // but without a backend, we just rely on Firebase Auth limits and client-side checks if they exist in managedUsers.
      // Simplest approach: let Firebase handle password validation.
      
      await signInWithEmailAndPassword(auth, email, password);
      lastActivityRef.current = Date.now();
      return { success: true, error: '' };
    } catch (error: any) {
      console.error("Login error", error);
      let errMsg = "Invalid email or password.";
      if (error.code === 'auth/too-many-requests') {
        errMsg = "Account temporarily locked due to many failed attempts. Try again later.";
      }
      return { success: false, error: errMsg };
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  // --- User management ---
  const addUser = async (username: string, email: string, password: string, role: 'admin' | 'curator') => {
    try {
      // Use a secondary app instance to create the user without logging out the current admin
      const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp-${Date.now()}`);
      const secondaryAuth = getSecondaryAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      
      // Write metadata to Firestore using the real UID from Auth
      const docRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(docRef, {
        username,
        email,
        role,
        createdAt: Timestamp.now(),
        archived: false,
        failedAttempts: 0
      });
      
      // Clean up the secondary app
      await deleteApp(secondaryApp);
    } catch (error) {
      console.error("Error adding user", error);
      throw error;
    }
  };

  const archiveUser = async (id: string) => {
    try {
      // Prevent archiving the primary admin - logic is slightly fuzzy here since we don't know who is who exactly
      // We will just do a simple check.
      const target = managedUsers.find(u => u.id === id);
      if (target?.username === 'admin') return;

      await updateDoc(doc(db, 'users', id), {
        archived: true
      });
    } catch (error) {
      console.error("Error archiving user", error);
    }
  };

  const updateUser = async (id: string, updates: Partial<Pick<ManagedUser, 'username' | 'email' | 'role'>>) => {
    try {
      await updateDoc(doc(db, 'users', id), {
        ...updates
      });
    } catch (error) {
      console.error("Error updating user", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAdmin: user?.role === 'admin',
        managedUsers,
        addUser,
        archiveUser,
        updateUser,
        loading
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
