/**
 * Screen Component
 * Standard screen wrapper with safe area handling
 */

import React, { memo, ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, layout } from '@/src/theme';

export interface ScreenProps {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  paddingVariant?: 'default' | 'compact';
  safeAreaTop?: boolean;
  safeAreaBottom?: boolean;
  testID?: string;
}

function ScreenComponent({
  children,
  style,
  padded = true,
  paddingVariant = 'default',
  safeAreaTop = true,
  safeAreaBottom = true,
  testID,
}: ScreenProps) {
  const horizontalPadding =
    paddingVariant === 'compact' ? layout.screenHorizontalCompact : layout.screenHorizontal;

  const edges = [
    safeAreaTop && 'top',
    safeAreaBottom && 'bottom',
    'left',
    'right',
  ].filter(Boolean) as ('top' | 'bottom' | 'left' | 'right')[];

  return (
    <View style={[styles.container, style]} testID={testID}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black[700]} />
      <SafeAreaView style={styles.safeArea} edges={edges}>
        <View
          style={[
            styles.content,
            padded && { paddingHorizontal: horizontalPadding },
          ]}
        >
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black[700],
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export const Screen = memo(ScreenComponent);
