'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { setSessionExpiredHandler } from '../api/client';
import { authApi } from './auth-api';
import { sessionStore } from './session-store';
import type { AuthSessionResponse, AuthUser } from './types';

/**
 * Holds the signed-in user for the whole app.
 *
 *   const { user, hasPermission, signOut } = useAuth();
 *
 * Wrap pages that require a session in <RequireAuth> rather than checking
 * `user` by hand in every component.
 */

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the stored session has been checked on first load. */
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  completeSignIn: (session: AuthSessionResponse) => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the session on first load, and confirm it is still valid with the API.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const storedUser = sessionStore.getUser();
      const accessToken = sessionStore.getAccessToken();

      if (!storedUser || !accessToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      // Show the cached user immediately, then verify against the server.
      if (!cancelled) setUser(storedUser);

      try {
        const { user: fresh } = await authApi.me();
        if (cancelled) return;
        sessionStore.saveUser(fresh);
        setUser(fresh);
      } catch {
        if (cancelled) return;
        sessionStore.clear();
        setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // The API client calls this when a refresh fails and the session is gone.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      router.replace('/login?reason=expired');
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  const completeSignIn = useCallback((session: AuthSessionResponse) => {
    sessionStore.save({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    });
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout(sessionStore.getRefreshToken());
    } catch {
      // Signing out locally matters more than the server acknowledging it.
    }
    sessionStore.clear();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    const { user: fresh } = await authApi.me();
    sessionStore.saveUser(fresh);
    setUser(fresh);
  }, []);

  const updateUser = useCallback((updatedUser: AuthUser) => {
    sessionStore.saveUser(updatedUser);
    setUser(updatedUser);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => Boolean(user?.permissions?.includes(permission)),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      hasPermission,
      completeSignIn,
      signOut,
      refreshUser,
      updateUser,
    }),
    [user, isLoading, hasPermission, completeSignIn, signOut, refreshUser, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider> (see src/app/layout.tsx)');
  }
  return context;
}
