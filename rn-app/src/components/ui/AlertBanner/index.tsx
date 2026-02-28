import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from '../Typography';
import { colors } from '@/src/theme';

export type AlertBannerType = 'error' | 'success';

export interface AlertBannerProps {
  type: AlertBannerType;
  message: string;
  style?: StyleProp<ViewStyle>;
}

export function AlertBanner({ type, message, style }: AlertBannerProps) {
  return (
    <View style={[styles.container, type === 'error' ? styles.errorContainer : styles.successContainer, style]}>
      <Text 
        inherit
        style={[styles.text, type === 'error' ? styles.errorText : styles.successText]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(229, 72, 77, 0.12)',
    borderColor: 'rgba(229, 72, 77, 0.3)',
  },
  successContainer: {
    backgroundColor: 'rgba(70, 167, 88, 0.12)',
    borderColor: 'rgba(70, 167, 88, 0.3)',
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    color: colors.error.radix,
  },
  successText: {
    fontFamily: 'PlusJakartaSans-Medium',
    color: colors.success.material,
  },
});
