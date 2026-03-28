/**
 * Dev-only preview of CriticalUpdateScreen in both modes.
 * Navigate here from DevNavigator or screen picker to see the UI.
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text as RNText } from 'react-native';
import { CriticalUpdateScreen } from '@/src/components/ui/CriticalUpdateScreen';
import { colors } from '@/src/theme';

export default function CriticalUpdatePreview() {
  const [mode, setMode] = useState<'select' | 'native' | 'ota'>('select');

  if (mode === 'native') {
    return (
      <CriticalUpdateScreen
        policy={{
          type: 'native',
          isRequired: true,
          title: 'Update required',
          message: 'A new version of Flent Secured is available with important security changes',
          isLoading: false,
          minAppVersion: '3.0.0',
        }}
      />
    );
  }

  if (mode === 'ota') {
    return (
      <CriticalUpdateScreen
        policy={{
          type: 'ota',
          isRequired: true,
          title: 'Applying update',
          message: "We've made important changes to keep your account secure",
          isLoading: false,
          minAppVersion: null,
        }}
        onDismiss={() => setMode('select')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <RNText style={styles.title}>Critical Update Preview</RNText>
      <RNText style={styles.subtitle}>Select a mode to preview</RNText>

      <TouchableOpacity style={styles.button} onPress={() => setMode('native')}>
        <RNText style={styles.buttonText}>Native App Update</RNText>
        <RNText style={styles.buttonDesc}>Shows "Update now" → App Store</RNText>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => setMode('ota')}>
        <RNText style={styles.buttonText}>OTA Critical Update</RNText>
        <RNText style={styles.buttonDesc}>Auto-download → auto-apply flow</RNText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black[700],
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 24,
    color: colors.white,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: 16,
  },
  button: {
    width: '100%',
    backgroundColor: colors.black[500],
    borderRadius: 12,
    padding: 20,
    gap: 4,
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    color: colors.white,
  },
  buttonDesc: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: colors.neutral[500],
  },
});
