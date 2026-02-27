/**
 * Avatar Component
 * Reusable pixel-art avatar with fallback chain:
 * 1. Network image (expo-image with caching)
 * 2. Initials circle (brand orange bg + white initial)
 * 3. Loading shimmer
 *
 * Sizes: sm=32, md=48, lg=80
 */

import React, { memo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { Text } from './Typography';
import { colors } from '@/src/theme';

const SIZE_MAP = {
  sm: 32,
  md: 48,
  lg: 80,
} as const;

const FONT_SIZE_MAP = {
  sm: 14,
  md: 18,
  lg: 28,
} as const;

export type AvatarSize = keyof typeof SIZE_MAP;

export interface AvatarProps {
  /** Remote image URL */
  uri?: string | null;
  /** User's display name (used for initials fallback) */
  name?: string;
  /** Avatar size preset */
  size?: AvatarSize;
  /** Test ID for testing */
  testID?: string;
}

function AvatarComponent({ uri, name, size = 'sm', testID }: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const px = SIZE_MAP[size];
  const fontSize = FONT_SIZE_MAP[size];
  const borderRadius = px / 2;

  const initial = name?.charAt(0).toUpperCase() || '?';

  if (uri && !hasError) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: px, height: px, borderRadius }]}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={uri}
        onError={() => setHasError(true)}
        testID={testID}
      />
    );
  }

  return (
    <View
      style={[styles.placeholder, { width: px, height: px, borderRadius }]}
      testID={testID}
    >
      <Text
        style={[
          styles.initial,
          { fontSize, lineHeight: fontSize + 4 },
        ]}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.black[500],
  },
  placeholder: {
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: colors.white,
    textAlign: 'center',
  },
});

export const Avatar = memo(AvatarComponent);
