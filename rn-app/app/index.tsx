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
import { colors } from '@/src/theme';

// Global screenshot params for buildbot pipeline — set state for screens that need mock data
// e.g. SCREENSHOT_PARAMS = { state: 'filled' } injects state into useScreenshotParams()
export const SCREENSHOT_PARAMS: Record<string, string> | null = null;

type JourneyTarget =
  | '/(auth)/beta-splash'
  | '/(agreement)/upload'
  | '/(waitlist)'
  | '/(setup)'
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

      // Route based on userStatus (master journey state from users table)
      switch (data.userStatus) {
        case 'signed_up':
          // Haven't confirmed agreement yet
          setTarget('/(agreement)/upload');
          break;
        case 'agreement_confirmed':
        case 'waitlisted':
        case 'not_eligible':
          // On waitlist or rejected — waitlist screen handles all sub-states
          setTarget('/(waitlist)');
          break;
        case 'approved':
          // Admin approved, setup pending
          setTarget('/(setup)');
          break;
        case 'active':
          // Fully onboarded
          setTarget('/(main)');
          break;
        default:
          // Unknown status — safe fallback
          setTarget('/(agreement)/upload');
          break;
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
    backgroundColor: colors.black[700],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
