/**
 * Entry Point — Journey-Aware Router
 *
 * Determines the correct screen based on auth + waitlist state:
 *  1. Not authenticated → auth flow (beta-splash)
 *  2. Authenticated, waitlist pending/rejected → waitlist screen
 *  3. Authenticated, waitlist approved → main dashboard
 *     (dashboard itself handles agreement/setup prompts)
 *
 * In __DEV__ mode, redirects to Screen Picker for quick navigation.
 * Set DISABLE_SCREEN_PICKER to true to bypass.
 */

import { useEffect, useState, useCallback } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/src/services/supabase/client';
import { getWaitlistStatus } from '@/src/services/api/waitlist';
import { DISABLE_SCREEN_PICKER, DEV_DIRECT_SCREEN } from './(dev)/screen-picker';

type JourneyTarget =
  | '/(auth)/beta-splash'
  | '/(waitlist)'
  | '/(main)';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [target, setTarget] = useState<JourneyTarget>('/(auth)/beta-splash');

  const resolveAuthenticatedJourney = useCallback(async () => {
    try {
      const { data, error } = await getWaitlistStatus();

      if (error || !data) {
        // Fail-open: if waitlist check fails, go to main (returning user likely)
        setTarget('/(main)');
        return;
      }

      if (data.state === 'approved') {
        setTarget('/(main)');
      } else {
        // pending, pending_long, rejected → waitlist screen
        setTarget('/(waitlist)');
      }
    } catch {
      // Fail-open for network errors
      setTarget('/(main)');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // In dev mode with screen picker enabled, skip auth journey entirely
    if (__DEV__ && (!DISABLE_SCREEN_PICKER || DEV_DIRECT_SCREEN)) {
      setIsLoading(false);
      return;
    }

    const resolveJourney = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setTarget('/(auth)/beta-splash');
          setIsLoading(false);
          return;
        }
        await resolveAuthenticatedJourney();
      } catch {
        setTarget('/(auth)/beta-splash');
        setIsLoading(false);
      }
    };

    resolveJourney();

    // Listen for auth state changes (sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          setTarget('/(auth)/beta-splash');
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [resolveAuthenticatedJourney]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF9A6D" />
      </View>
    );
  }

  // Dev mode: jump directly to a specific screen
  if (__DEV__ && DEV_DIRECT_SCREEN) {
    return <Redirect href={DEV_DIRECT_SCREEN as any} />;
  }

  // Dev mode: show screen picker for quick navigation
  if (__DEV__ && !DISABLE_SCREEN_PICKER) {
    return <Redirect href="/(dev)/screen-picker" />;
  }

  return <Redirect href={target} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
