/**
 * AuthProvider — Single Source of Truth for Auth State
 *
 * Consolidates all onAuthStateChange listeners into one location.
 * Eliminates race conditions from multiple listeners competing to navigate.
 *
 * Provides: { session, isLoading, isAuthenticated }
 * Handles: sign-out navigation (single controlled redirect)
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/services/supabase/client';
import { clearAllStores } from '@/src/stores/resetAll';
import { registerForPushNotifications } from '@/src/services/notifications';
import { isReviewMode, deactivateReviewMode } from '@/src/review/reviewMode';
import { useSessionMonitor } from '@/src/hooks/useSessionMonitor';
import type { Session } from '@supabase/supabase-js';

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  isAuthenticated: false,
});

export function useAuthContext() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const hasRedirectedRef = useRef(false);

  const handleSignOut = useCallback(() => {
    // Prevent multiple simultaneous redirects
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;

    if (isReviewMode()) deactivateReviewMode();
    clearAllStores();
    setSession(null);

    router.replace('/(auth)/beta-splash' as never);

    // Reset after navigation settles
    setTimeout(() => {
      hasRedirectedRef.current = false;
    }, 1000);
  }, [router]);

  useEffect(() => {
    // 1. Get initial session
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
      } catch {
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    // 2. Single auth state change listener for the entire app
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'SIGNED_OUT') {
          handleSignOut();
        } else if (event === 'TOKEN_REFRESHED') {
          if (newSession) {
            // Token refresh succeeded — update with fresh tokens
            setSession(newSession);
          } else {
            // Token refresh failed (likely transient network error, ISP DNS block,
            // or Cloudflare proxy cold-start). DO NOT clear the session — the user
            // stays logged in with the cached (possibly expired) session. The next
            // authenticated API call will trigger another refresh attempt.
            console.warn('[AuthProvider] TOKEN_REFRESHED returned null — keeping cached session');
          }
        } else if (event === 'SIGNED_IN' && newSession) {
          setSession(newSession);
          hasRedirectedRef.current = false;
          // Register push token after successful auth
          registerForPushNotifications().catch(() => {
            // Non-blocking — token registration failures are logged inside the function
          });
        } else if (event === 'INITIAL_SESSION') {
          // getSession() above already set the initial state. INITIAL_SESSION fires
          // with the pre-refresh (possibly expired) session BEFORE TOKEN_REFRESHED.
          // Only update if we got a valid session (don't overwrite with null).
          if (newSession) {
            setSession(newSession);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSignOut]);

  // Proactively refresh session when app returns to foreground after background
  useSessionMonitor({ enabled: !isLoading && !!session });

  const value: AuthContextValue = useMemo(() => ({
    session,
    isLoading,
    isAuthenticated: !!session || isReviewMode(),
  }), [session, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
