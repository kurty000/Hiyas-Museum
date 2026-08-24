import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

export interface User {
  username: string;
  role: 'admin' | 'curator';
}

export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'curator';
  createdAt: Date;
  lastLogin?: Date;
  archived: boolean;
  failedAttempts: number;
  lockedUntil?: Date;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => { success: boolean; error: string };
  logout: () => void;
  isAdmin: boolean;
  // User management (Admin only)
  managedUsers: ManagedUser[];
  addUser: (username: string, email: string, password: string, role: 'admin' | 'curator') => void;
  archiveUser: (id: string) => void;
  updateUser: (id: string, updates: Partial<Pick<ManagedUser, 'username' | 'email' | 'role'>>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const INITIAL_USERS: ManagedUser[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@museum.com',
    password: 'admin123',
    role: 'admin',
    createdAt: new Date('2024-01-15'),
    lastLogin: new Date(),
    archived: false,
    failedAttempts: 0,
  },
  {
    id: '2',
    username: 'curator',
    email: 'curator@museum.com',
    password: 'curator123',
    role: 'curator',
    createdAt: new Date('2024-02-20'),
    lastLogin: new Date('2024-03-25'),
    archived: false,
    failedAttempts: 0,
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(INITIAL_USERS);
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setUser(null);
      }
    }, 30_000);

    return () => {
      activityEvents.forEach(event =>
        window.removeEventListener(event, resetActivityTimer)
      );
      clearInterval(interval);
    };
  }, [user, resetActivityTimer]);

  // --- Login with lockout ---
  const login = (username: string, password: string): { success: boolean; error: string } => {
    const foundUser = managedUsers.find(
      u => u.username === username && !u.archived
    );

    if (!foundUser) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Check lockout
    if (foundUser.lockedUntil && new Date() < foundUser.lockedUntil) {
      const remainingMs = foundUser.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60_000);
      return {
        success: false,
        error: `Account locked. Try again in ${remainingMin} minute(s).`,
      };
    }

    // Check password
    if (foundUser.password !== password) {
      const newAttempts = foundUser.failedAttempts + 1;
      const isLocked = newAttempts >= MAX_FAILED_ATTEMPTS;

      setManagedUsers(prev =>
        prev.map(u =>
          u.id === foundUser.id
            ? {
                ...u,
                failedAttempts: newAttempts,
                lockedUntil: isLocked ? new Date(Date.now() + LOCKOUT_DURATION_MS) : undefined,
              }
            : u
        )
      );

      if (isLocked) {
        return {
          success: false,
          error: 'Account locked after 3 failed attempts. Try again in 15 minutes.',
        };
      }

      return {
        success: false,
        error: `Invalid username or password. ${MAX_FAILED_ATTEMPTS - newAttempts} attempt(s) remaining.`,
      };
    }

    // Successful login — reset failed attempts, set lastLogin
    setManagedUsers(prev =>
      prev.map(u =>
        u.id === foundUser.id
          ? { ...u, failedAttempts: 0, lockedUntil: undefined, lastLogin: new Date() }
          : u
      )
    );

    lastActivityRef.current = Date.now();
    setUser({ username: foundUser.username, role: foundUser.role });
    return { success: true, error: '' };
  };

  const logout = () => {
    setUser(null);
  };

  // --- User management ---
  const addUser = (username: string, email: string, password: string, role: 'admin' | 'curator') => {
    const newUser: ManagedUser = {
      id: Date.now().toString(),
      username,
      email,
      password,
      role,
      createdAt: new Date(),
      archived: false,
      failedAttempts: 0,
    };
    setManagedUsers(prev => [...prev, newUser]);
  };

  const archiveUser = (id: string) => {
    // Prevent archiving the primary admin
    const target = managedUsers.find(u => u.id === id);
    if (target?.username === 'admin') return;

    setManagedUsers(prev =>
      prev.map(u => (u.id === id ? { ...u, archived: true } : u))
    );
  };

  const updateUser = (id: string, updates: Partial<Pick<ManagedUser, 'username' | 'email' | 'role'>>) => {
    setManagedUsers(prev =>
      prev.map(u => (u.id === id ? { ...u, ...updates } : u))
    );
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
      }}
    >
      {children}
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
