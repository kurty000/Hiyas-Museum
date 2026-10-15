import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  initializeAuth,
  inMemoryPersistence,
} from 'firebase/auth';
import { collection, doc, getDoc, setDoc, updateDoc, onSnapshot, Timestamp, getFirestore } from 'firebase/firestore';
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

/** Mirror signed-in profile so UI survives remounts / brief Firebase null glitches. */
const CACHED_USER_KEY = 'hiyas.auth.cachedUser';

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User>;
    if (!parsed || typeof parsed.username !== 'string') return null;
    return {
      username: parsed.username,
      role: normalizeRole(parsed.role),
    };
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  try {
    if (user) {
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    /* private mode / storage blocked — ignore */
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
/** Ignore brief null auth events (tab restore / token refresh races). */
const AUTH_NULL_GRACE_MS = 1500;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readCachedUser());
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(() => readCachedUser() === null);
  const intentionalSignOutRef = useRef(false);
  const nullAuthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const applyUser = (next: User | null) => {
    setUser(next);
    writeCachedUser(next);
  };

  // --- Firebase Auth Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (nullAuthTimerRef.current) {
        clearTimeout(nullAuthTimerRef.current);
        nullAuthTimerRef.current = null;
      }

      if (firebaseUser) {
        intentionalSignOutRef.current = false;
        // Always keep a signed-in user object — never clear session on metadata glitches
        const fallbackUser: User = {
          username: firebaseUser.email || userRef.current?.username || 'User',
          role: userRef.current?.role || 'curator',
        };
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            applyUser({
              username: data.username || firebaseUser.email || 'User',
              role: normalizeRole(data.role),
            });
            // Best-effort lastLogin — must not log the user out if this fails
            void updateDoc(doc(db, 'users', firebaseUser.uid), {
              lastLogin: Timestamp.now(),
            }).catch((err) => console.warn('[AUTH] lastLogin update skipped:', err));
          } else {
            applyUser(fallbackUser);
          }
        } catch (err) {
          console.error('Error fetching user metadata:', err);
          applyUser(fallbackUser);
        }
        setLoading(false);
        return;
      }

      // firebaseUser === null
      if (intentionalSignOutRef.current) {
        applyUser(null);
        setLoading(false);
        return;
      }

      // Transient null (alt-tab / token refresh / remount): keep cached session briefly
      // and only clear if Auth stays signed-out.
      nullAuthTimerRef.current = setTimeout(() => {
        nullAuthTimerRef.current = null;
        if (auth.currentUser) {
          return;
        }
        if (intentionalSignOutRef.current) {
          applyUser(null);
          setLoading(false);
          return;
        }
        // Confirmed signed out
        applyUser(null);
        setLoading(false);
      }, AUTH_NULL_GRACE_MS);

      // If we already have a cached/UI user, stay on the dashboard while we wait
      if (userRef.current) {
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (nullAuthTimerRef.current) {
        clearTimeout(nullAuthTimerRef.current);
      }
    };
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


  // Idle auto-logout disabled — museum staff often alt-tab; session persists until Logout.

  // --- Login ---
  // Note: The previous signature used 'username'. We changed it to 'email' because Firebase Auth uses Email/Password by default.
  const login = async (email: string, password: string): Promise<{ success: boolean; error: string }> => {
    try {
      intentionalSignOutRef.current = false;
      await signInWithEmailAndPassword(auth, email, password);
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
    intentionalSignOutRef.current = true;
    if (nullAuthTimerRef.current) {
      clearTimeout(nullAuthTimerRef.current);
      nullAuthTimerRef.current = null;
    }
    applyUser(null);
    await signOut(auth);
  };

  // --- User management ---
  // Any signed-in admin can create admin or curator accounts.
  // Secondary Firebase app uses in-memory auth so the admin session is never replaced.
  // Profile is written with the NEW user's secondary session (self-doc create/update),
  // which Firestore allows — then the admin table listener picks it up in realtime.
  const addUser = async (
    username: string,
    email: string,
    password: string,
    role: 'admin' | 'curator'
  ): Promise<AddUserResult> => {
    const adminUser = auth.currentUser;
    if (!adminUser) {
      throw new Error('You must be signed in as an admin to create accounts.');
    }
    if (normalizeRole(user?.role) !== 'admin') {
      throw new Error('Only admins can create staff accounts.');
    }

    const adminUid = adminUser.uid;
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
    // Isolated in-memory auth — must NOT use default persistence (that can log the admin out)
    const secondaryAuth = initializeAuth(secondaryApp, {
      persistence: inMemoryPersistence,
    });
    const secondaryDb = getFirestore(secondaryApp);
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

      if (!uid || !secondaryAuth.currentUser) {
        throw new Error('Could not resolve the new user id.');
      }

      const userRef = doc(secondaryDb, 'users', uid);
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

      // Write WHILE secondary session is the new user (allowed as own profile doc)
      await setDoc(userRef, profile, { merge: true });

      try {
        await signOut(secondaryAuth);
      } catch {
        /* ignore */
      }

      // Ensure admin session is still the primary app user
      if (!auth.currentUser || auth.currentUser.uid !== adminUid) {
        throw new Error(
          'Admin session changed while creating the account. Please sign in again as admin and retry.'
        );
      }

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
          'Firestore blocked saving the user profile. Try again, or check Authentication / Firestore users.'
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
      {/* Keep tree mounted when we have a cached session so Layout never flashes to login */}
      {(!loading || user) ? children : (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600 text-sm">
          Restoring session…
        </div>
      )}
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
