/**
 * Avatar Component
 * Deterministic SVG avatar using Boring Avatars (bauhaus variant).
 * Renders based on userId or name — no network requests, no storage.
 *
 * Bauhaus generates abstract geometric compositions (circles, rectangles,
 * triangles) that feel modern and subtle on a dark UI. Colors are muted
 * warm tones from the design system with reduced saturation to avoid
 * competing with the brand accent.
 *
 * Sizes: sm=32, md=48, lg=80
 */

import React, { memo } from 'react';
import { View } from 'react-native';
import BoringAvatar from '@mealection/react-native-boring-avatars';

const SIZE_MAP = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 80,
} as const;

// Muted, warm palette — subtle enough for dark #131313/#202020 backgrounds
// while still feeling alive. Avoids pure brand[500] to not compete with CTAs.
const AVATAR_COLORS = [
  '#CC7B57', // brand[600] — muted warm brown
  '#FFCC8A', // brand[300] — soft amber
  '#3D7A6D', // desaturated teal — cool balance
  '#A67C5B', // earthy brown — grounding tone
  '#1A1A1A', // black[600] — dark anchor for contrast
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
        variant="bauhaus"
        colors={AVATAR_COLORS}
      />
    </View>
  );
}

export const Avatar = memo(AvatarComponent);
