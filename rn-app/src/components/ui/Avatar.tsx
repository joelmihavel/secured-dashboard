/**
 * Avatar Component
 * Deterministic SVG avatar using Boring Avatars (beam variant).
 * Renders based on userId or name — no network requests, no storage.
 *
 * Sizes: sm=32, md=48, lg=80
 */

import React, { memo } from 'react';
import { View } from 'react-native';
import BoringAvatar from '@mealection/react-native-boring-avatars';

const SIZE_MAP = {
  sm: 32,
  md: 48,
  lg: 80,
} as const;

const AVATAR_COLORS = [
  '#FF9A6D', // brand[500] — anchor orange
  '#FFCC8A', // brand[300] — warm highlight
  '#4D9B8A', // teal — cool contrast
  '#E8DDD3', // warm neutral — skin-friendly
  '#202020', // black[500] — dark accent
];

export type AvatarSize = keyof typeof SIZE_MAP;

export interface AvatarProps {
  /** User ID — primary deterministic seed */
  userId?: string | null;
  /** User's display name (fallback seed if no userId) */
  name?: string;
  /** Avatar size preset */
  size?: AvatarSize;
  /** Test ID for testing */
  testID?: string;
}

function AvatarComponent({ userId, name, size = 'sm', testID }: AvatarProps) {
  const px = SIZE_MAP[size];

  return (
    <View
      testID={testID}
      style={{
        width: px,
        height: px,
        borderRadius: px / 2,
        overflow: 'hidden',
      }}
    >
      <BoringAvatar
        name={userId ?? name ?? '?'}
        size={px}
        variant="beam"
        colors={AVATAR_COLORS}
      />
    </View>
  );
}

export const Avatar = memo(AvatarComponent);
