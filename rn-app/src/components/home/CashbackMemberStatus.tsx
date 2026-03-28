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

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M13.3 4L6 11.3L2.7 8"
        stroke="#4CAF50"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C11.314 2 14 4.686 14 8Z"
        stroke="#FF9A6D"
        strokeWidth={1}
      />
      <Path d="M8 5V8L10 10" stroke="#FF9A6D" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
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
            <CheckIcon />
            <Text style={styles.verifiedText}>Verified</Text>
          </>
        ) : (
          <>
            <ClockIcon />
            <Text style={styles.pendingText}>Pending</Text>
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
  },
  pendingText: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: colors.brand[500], // Figma: #FF9A6D pending
  },
});

export const CashbackMemberStatus = memo(CashbackMemberStatusComponent);
