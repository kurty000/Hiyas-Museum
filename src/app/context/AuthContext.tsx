import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, getAuth as getSecondaryAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, setDoc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase';
import { toast } from 'sonner';

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

export type AddUserResult = {
  uid: string;
  linkedExistingAuth: boolean;
};

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error: string }>;
  logout: () => void;
  isAdmin: boolean;
  // User management (Admin only)
  managedUsers: ManagedUser[];
  addUser: (
    username: string,
    email: string,
    password: string,
    role: 'admin' | 'curator'
  ) => Promise<AddUserResult>;
  archiveUser: (id: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<Pick<ManagedUser, 'username' | 'email' | 'role'>>) => Promise<void>;
  loading: boolean;
}

function normalizeRole(value: unknown): 'admin' | 'curator' {
  return String(value || '').trim().toLowerCase() === 'admin' ? 'admin' : 'curator';
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
              username: data.username || firebaseUser.email || 'User',
              role: normalizeRole(data.role),
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

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const usersData: ManagedUser[] = [];
        snapshot.forEach((userSnap) => {
          const data = userSnap.data();
          const createdAt =
            typeof data.createdAt?.toDate === 'function'
              ? data.createdAt.toDate()
              : data.createdAt instanceof Date
                ? data.createdAt
                : new Date(0);
          const lastLogin =
            typeof data.lastLogin?.toDate === 'function'
              ? data.lastLogin.toDate()
              : data.lastLogin instanceof Date
                ? data.lastLogin
                : undefined;
          usersData.push({
            id: userSnap.id,
            username: data.username || data.email || userSnap.id,
            email: data.email || '',
            role: normalizeRole(data.role),
            createdAt,
            lastLogin,
            archived: Boolean(data.archived),
            failedAttempts: Number(data.failedAttempts) || 0,
            lockedUntil:
              typeof data.lockedUntil?.toDate === 'function'
                ? data.lockedUntil.toDate()
                : undefined,
          });
        });
        usersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setManagedUsers(usersData);
      },
      (error) => {
        console.error('Users list listener failed:', error);
        toast.error('Could not load staff accounts. Check Firestore permissions.');
      }
    );

    return () => unsubscribe();
  }, [user?.role]);


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
  // Any signed-in admin can create admin or curator accounts.
  // Uses a secondary Firebase app so the admin session stays logged in.
  // If Auth already has the email (orphaned login with no table row), signs in on
  // the secondary app with the given password to recover the UID and upsert Firestore.
  const addUser = async (
    username: string,
    email: string,
    password: string,
    role: 'admin' | 'curator'
  ): Promise<AddUserResult> => {
    if (!auth.currentUser) {
      throw new Error('You must be signed in as an admin to create accounts.');
    }
    if (normalizeRole(user?.role) !== 'admin') {
      throw new Error('Only admins can create staff accounts.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    const normalizedRole = normalizeRole(role);

    if (!normalizedUsername || !normalizedEmail || !password) {
      throw new Error('Username, email, and password are required.');
    }
    if (password.length < 6) {
      throw new Error('Password should be at least 6 characters.');
    }

    const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp-${Date.now()}`);
    const secondaryAuth = getSecondaryAuth(secondaryApp);
    let uid = '';
    let linkedExistingAuth = false;

    try {
      try {
        const created = await createUserWithEmailAndPassword(
          secondaryAuth,
          normalizedEmail,
          password
        );
        uid = created.user.uid;
      } catch (createError: any) {
        if (createError?.code !== 'auth/email-already-in-use') {
          throw createError;
        }

        // Auth user exists (often from a previous create that never wrote Firestore).
        // Sign in on the secondary app to resolve UID, then upsert the staff profile.
        try {
          const existingAuth = await signInWithEmailAndPassword(
            secondaryAuth,
            normalizedEmail,
            password
          );
          uid = existingAuth.user.uid;
          linkedExistingAuth = true;
        } catch {
          throw new Error(
            'This email already has a login. Use that account’s current password to add it to the table, or pick a different email.'
          );
        }
      }

      try {
        await signOut(secondaryAuth);
      } catch {
        /* ignore */
      }

      if (!auth.currentUser) {
        throw new Error('Admin session was lost while creating the account. Please sign in again.');
      }
      if (!uid) {
        throw new Error('Could not resolve the new user id.');
      }

      const userRef = doc(db, 'users', uid);
      const existing = await getDoc(userRef);
      const createdAt =
        existing.exists() && existing.data()?.createdAt
          ? existing.data()!.createdAt
          : Timestamp.now();

      const profile = {
        username: normalizedUsername,
        email: normalizedEmail,
        role: normalizedRole,
        createdAt,
        archived: false,
        failedAttempts: existing.exists()
          ? Number(existing.data()?.failedAttempts) || 0
          : 0,
        updatedAt: Timestamp.now(),
      };

      // Admin (primary auth) writes/merges Firestore so the row appears in Account Management
      await setDoc(userRef, profile, { merge: true });

      const createdAtDate =
        typeof createdAt?.toDate === 'function' ? createdAt.toDate() : new Date();

      setManagedUsers((prev) => {
        const row: ManagedUser = {
          id: uid,
          username: normalizedUsername,
          email: normalizedEmail,
          role: normalizedRole,
          createdAt: createdAtDate,
          lastLogin:
            typeof existing.data()?.lastLogin?.toDate === 'function'
              ? existing.data()!.lastLogin.toDate()
              : undefined,
          archived: false,
          failedAttempts: profile.failedAttempts,
        };
        const others = prev.filter(
          (u) => u.id !== uid && u.email.trim().toLowerCase() !== normalizedEmail
        );
        return [row, ...others];
      });

      return { uid, linkedExistingAuth };
    } catch (error: any) {
      console.error('Error adding user', error);
      if (error?.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters.');
      }
      if (error?.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      if (error?.code === 'permission-denied') {
        throw new Error(
          'Firestore blocked saving the user profile. Your account must have role "admin" in Firestore.'
        );
      }
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error(error?.message || 'Failed to create account.');
    } finally {
      try {
        await deleteApp(secondaryApp);
      } catch {
        /* ignore */
      }
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
