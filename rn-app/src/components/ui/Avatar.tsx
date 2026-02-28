/**
 * Avatar Component
 * Reusable pixel-art avatar with fallback chain:
 * 1. Network image (expo-image with caching)
 * 2. Default Pokemon avatar (deterministic per userId, from Supabase Storage)
 * 3. Initials circle (brand orange bg + white initial)
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

/**
 * Deterministic default avatar URL from Supabase Storage.
 * Hashes userId to one of 30 Pokemon sprite PNGs (orange-tinted pixel art).
 */
function getDefaultAvatarUrl(userId: string): string | null {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  // Simple hash: sum char codes, mod 30, 1-indexed
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  const index = (Math.abs(hash) % 30) + 1;
  return `${supabaseUrl}/storage/v1/object/public/avatars/defaults/${index}.png`;
}

export type AvatarSize = keyof typeof SIZE_MAP;

export interface AvatarProps {
  /** Remote image URL */
  uri?: string | null;
  /** User ID — used to pick a deterministic default Pokemon avatar */
  userId?: string | null;
  /** User's display name (used for initials fallback) */
  name?: string;
  /** Avatar size preset */
  size?: AvatarSize;
  /** Test ID for testing */
  testID?: string;
}

function AvatarComponent({ uri, userId, name, size = 'sm', testID }: AvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const px = SIZE_MAP[size];
  const fontSize = FONT_SIZE_MAP[size];
  const borderRadius = px / 2;

  const initial = name?.charAt(0).toUpperCase() || '?';

  // Resolve image URL: custom avatar → default Pokemon avatar
  const defaultUrl = userId ? getDefaultAvatarUrl(userId) : null;
  const resolvedUri = uri || defaultUrl;

  // Show image if we have a URI that hasn't failed
  if (resolvedUri && resolvedUri !== failedUri) {
    return (
      <Image
        key={resolvedUri}
        source={{ uri: resolvedUri }}
        style={[styles.image, { width: px, height: px, borderRadius }]}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={resolvedUri}
        onError={() => {
          setFailedUri(resolvedUri);
        }}
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
