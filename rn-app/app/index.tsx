/**
 * Entry Point
 * Redirects to appropriate screen based on auth state.
 *
 * In __DEV__ mode, redirects to the Screen Picker for quick navigation.
 * Set DISABLE_SCREEN_PICKER to true to bypass (e.g. during parity testing).
 */

import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/src/services/supabase/client';
import { DISABLE_SCREEN_PICKER } from './(dev)/screen-picker';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuthState = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF9A6D" />
      </View>
    );
  }

  // Dev mode: show screen picker for quick navigation
  // Disable with DISABLE_SCREEN_PICKER flag during parity testing
  if (__DEV__ && !DISABLE_SCREEN_PICKER) {
    return <Redirect href="/(dev)/screen-picker" />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(main)" />;
  }

  return <Redirect href="/(auth)/beta-splash" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
