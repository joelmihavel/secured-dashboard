/**
 * Auth Guard Hook
 *
 * Redirects to auth flow if no valid Supabase session exists.
 * Use in protected route layouts to prevent unauthenticated access.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/src/services/supabase/client';

/**
 * Returns { isReady, isAuthenticated } after checking Supabase session.
 * Redirects to /(auth)/beta-splash if session is missing.
 *
 * Usage in a protected layout:
 *   const { isReady } = useRequireAuth();
 *   if (!isReady) return null; // or loading spinner
 */
export function useRequireAuth() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    // In dev mode, skip auth checks so screen picker can navigate freely
    if (__DEV__) {
      setIsAuthenticated(true);
      setIsReady(true);
      return;
    }

    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session) {
          setIsAuthenticated(true);
          setIsReady(true);
        } else {
          // Not authenticated — redirect to auth flow
          setIsAuthenticated(false);
          setIsReady(true);
          router.replace('/(auth)/beta-splash' as never);
        }
      } catch {
        if (!mounted) return;
        setIsAuthenticated(false);
        setIsReady(true);
        router.replace('/(auth)/beta-splash' as never);
      }
    };

    check();

    // Listen for sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        if (!session) {
          setIsAuthenticated(false);
          // Only redirect if we're in a protected route (not already in auth)
          const inAuthGroup = segments[0] === '(auth)';
          if (!inAuthGroup) {
            router.replace('/(auth)/beta-splash' as never);
          }
        } else {
          setIsAuthenticated(true);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, segments]);

  return { isReady, isAuthenticated };
}
