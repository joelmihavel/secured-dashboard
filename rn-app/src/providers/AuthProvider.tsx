/**
 * AuthProvider — Single Source of Truth for Auth State
 *
 * Consolidates all onAuthStateChange listeners into one location.
 * Eliminates race conditions from multiple listeners competing to navigate.
 *
 * Provides: { session, isLoading, isAuthenticated }
 * Handles: sign-out navigation (single controlled redirect)
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/services/supabase/client';
import { useAuthStore } from '@/src/stores/auth';
import { useUploadStore } from '@/src/stores/upload';
import { useWaitlistStore } from '@/src/stores/waitlist';
import { usePaymentStore } from '@/src/stores/payment';
import { useSetupStore } from '@/src/stores/setup';
import { useProfileStore } from '@/src/stores/profile';
import { queryClient } from './QueryProvider';
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

function clearAllStores() {
  useAuthStore.getState().reset();
  useUploadStore.getState().reset();
  useWaitlistStore.getState().reset();
  usePaymentStore.getState().reset();
  useSetupStore.getState().reset();
  useProfileStore.getState().reset();
  queryClient.clear();
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
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          // Token refresh with valid session — update silently
          setSession(newSession);
        } else if (event === 'SIGNED_IN' && newSession) {
          setSession(newSession);
          hasRedirectedRef.current = false;
        } else if (event === 'INITIAL_SESSION') {
          // Already handled by getSession() above — but update if different
          setSession(newSession);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSignOut]);

  const value: AuthContextValue = {
    session,
    isLoading,
    isAuthenticated: !!session,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
