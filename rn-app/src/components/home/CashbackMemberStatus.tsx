/**
 * CashbackMemberStatus Component
 * Member status card showing "Verified" badge. Only shown in active/verified state.
 * Figma Reference: 4109:67067 (State 3)
 *
 * - Card: 329x56, #202020 bg, r=12, padding h=24 v=16
 * - Left: avatar circle 24x24 #FFCC8A + "MEMBER STATUS" label
 * - Right: checkmark icon + "Verified" green text / clock icon + "Pending" orange text
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme';

import { Text } from '@/src/components/ui';

export interface CashbackMemberStatusProps {
  /** Called when user taps status badge — opens VerificationStatusSheet */
  onPress?: () => void;
  /** Whether user is verified */
  verified?: boolean;
}

/** Figma 4130:2648 — circle outline + checkmark, both stroke #4CAF50 */
function VerifiedIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      {/* Circle outline — 12x12 at 2px inset */}
      <Path
        d="M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C11.314 2 14 4.686 14 8Z"
        stroke="#4CAF50"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Checkmark inside circle */}
      <Path
        d="M5.5 8L7 9.5L10.5 6.5"
        stroke="#4CAF50"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Figma 4130:2628 — rounded square + clock hand + dot, stroke #FF9A6D */
function PendingIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      {/* Rounded square body — 12x12 at 2px inset */}
      <Path
        d="M8 2H8C10.4 2 11.7 2.31 12.45 3.55C13.19 4.29 13.5 5.6 13.5 8C13.5 10.4 13.19 11.71 12.45 12.45C11.7 13.19 10.4 13.5 8 13.5C5.6 13.5 4.29 13.19 3.55 12.45C2.81 11.71 2.5 10.4 2.5 8C2.5 5.6 2.81 4.29 3.55 3.55C4.29 2.81 5.6 2.5 8 2.5"
        stroke="#FF9A6D"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Vertical clock hand */}
      <Path
        d="M8 5.33V8"
        stroke="#FF9A6D"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center dot */}
      <Path
        d="M8 10.67H8.007"
        stroke="#FF9A6D"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CashbackMemberStatusComponent({ onPress, verified = true }: CashbackMemberStatusProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {/* Left: Avatar + Label */}
      <View style={styles.left}>
        <View style={styles.avatar} />
        <Text style={styles.label}>MEMBER STATUS</Text>
      </View>

      {/* Right: Status badge — tappable to show verification details */}
      <View style={styles.right}>
        {verified ? (
          <>
            <VerifiedIcon />
            <Text style={styles.verifiedText}>Verified →</Text>
          </>
        ) : (
          <>
            <PendingIcon />
            <Text style={styles.pendingText}>Pending →</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.black[500], // Figma: #202020
    borderRadius: 12, // Figma: 12px
    paddingVertical: 16, // Figma: top=16, bottom=16
    paddingHorizontal: 24, // Figma: left=24, right=24
    alignSelf: 'stretch',
    // Figma: 3 drop shadows (use strongest for RN single-shadow limitation)
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 9 },
        shadowOpacity: 0.1,
        shadowRadius: 19,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Figma: 8px gap
  },
  avatar: {
    width: 24, // Figma: 24x24
    height: 24,
    borderRadius: 12, // Figma: circle
    backgroundColor: colors.brand[300], // Figma: #FFCC8A
  },
  label: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: colors.neutral[500], // Figma: #A9A9A9
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Figma: 4px gap
  },
  verifiedText: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: colors.success.material, // Figma: #4CAF50
    textDecorationLine: 'underline' as const, // Figma: UNDERLINE
  },
  pendingText: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: colors.brand[500], // Figma: #FF9A6D
    textDecorationLine: 'underline' as const, // Figma: UNDERLINE
  },
});

export const CashbackMemberStatus = memo(CashbackMemberStatusComponent);
