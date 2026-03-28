/**
 * CashbackEarningsCard Component
 * Transaction card for cashback earnings with 3 variants: received, accrued, missed.
 * Figma Reference: 4124:2380 (received), 4124:2396 (accrued), 4124:2411 (missed)
 *
 * - Card: 329x77 HUG, horizontal, SPACE_BETWEEN, #202020 bg, r=12, pad=16
 * - Icon circle: 32x32 #663E2C, inner receipt icon #FFAE8A
 * - Date: Medium/14px/19.74lh/-0.56ls/#FFFFFF
 * - Status: dot 12x12 + text Regular/12px/16.92lh/-0.24ls/#878787
 * - Amount varies: received=16px white, accrued=12px amber, missed="NA" 12px white
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

// ==============================================
// Types
// ==============================================

import type { CashbackCardStatus, CashbackEarningsEntry } from '@/src/services/api/dashboard';
export type { CashbackCardStatus, CashbackEarningsEntry };

interface CashbackEarningsCardProps {
  entry: CashbackEarningsEntry;
  onPress?: (entry: CashbackEarningsEntry) => void;
}

// ==============================================
// Status Config
// ==============================================

const STATUS_CONFIG: Record<CashbackCardStatus, { label: string }> = {
  received: { label: 'received' },
  accrued: { label: 'accrued \uD83D\uDD12' }, // lock emoji
  missed: { label: 'missed' },
  reversed: { label: 'reversed' },
};

// ==============================================
// Rupee Icon — Figma 4124:2400 (₹ symbol, stroke #FFAE8A)
// ViewBox 24x24, rendered at 19.2x19.2 inside 32x32 circle
// ==============================================

function RupeeIcon() {
  return (
    <View style={styles.iconCircle}>
      <Svg width={19.2} height={19.2} viewBox="0 0 24 24" fill="none">
        {/* Top line + curve + diagonal slash */}
        <Path
          d="M18 5L7 5L10 5C11.0609 5 12.0783 5.4214 12.8284 6.1716C13.5786 6.9217 14 7.9391 14 9C14 10.0609 13.5786 11.0783 12.8284 11.8284C12.0783 12.5786 11.0609 13 10 13L7 13L13 19"
          stroke="#FFAE8A"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Horizontal line through curve */}
        <Path
          d="M7 9L18 9"
          stroke="#FFAE8A"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// ==============================================
// Status Icons — Figma: 10x10 filled SVG inside 12x12 container
// ==============================================

/** Green checkmark circle — Figma 4124:2393 */
function ReceivedIcon() {
  return (
    <View style={styles.statusIconContainer}>
      <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
        <Path
          d="M5 10C7.7614 10 10 7.7614 10 5C10 2.23857 7.7614 0 5 0C2.23857 0 0 2.23857 0 5C0 7.7614 2.23857 10 5 10ZM7.72855 3.72856L4.5 6.9571L2.39645 4.85355L3.10356 4.14645L4.5 5.5429L7.02145 3.02144L7.72855 3.72856Z"
          fill={colors.success.material}
        />
      </Svg>
    </View>
  );
}

/** Amber info circle — Figma I4124:2408 */
function AccruedIcon() {
  return (
    <View style={styles.statusIconContainer}>
      <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
        <Path
          d="M5 0C7.7615 0 10 2.2385 10 5C10 7.7615 7.7615 10 5 10C2.2385 10 0 7.7615 0 5C0 2.2385 2.2385 0 5 0ZM5.005 6.5C4.862 6.5 4.725 6.557 4.627 6.668C4.545 6.76 4.501 6.878 4.501 7C4.501 7.122 4.545 7.241 4.627 7.332C4.725 7.443 4.862 7.5 5.005 7.5C5.148 7.5 5.285 7.443 5.378 7.332C5.46 7.241 5.504 7.122 5.504 7C5.504 6.878 5.46 6.76 5.378 6.668C5.285 6.557 5.148 6.5 5.005 6.5ZM5 2.5C4.878 2.5 4.759 2.545 4.668 2.626C4.576 2.708 4.518 2.82 4.504 2.942L4.5 3V5L4.504 5.059C4.518 5.18 4.576 5.292 4.668 5.373C4.759 5.455 4.878 5.499 5 5.499C5.122 5.499 5.241 5.455 5.332 5.373C5.424 5.292 5.482 5.18 5.497 5.059L5.5 5V3L5.497 2.942C5.482 2.82 5.424 2.708 5.332 2.626C5.241 2.545 5.122 2.5 5 2.5Z"
          fill={colors.warning.amber}
        />
      </Svg>
    </View>
  );
}

/** Red info circle — Figma I4124:2423 (same shape, red fill) */
function MissedIcon() {
  return (
    <View style={styles.statusIconContainer}>
      <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
        <Path
          d="M5 0C7.7615 0 10 2.2385 10 5C10 7.7615 7.7615 10 5 10C2.2385 10 0 7.7615 0 5C0 2.2385 2.2385 0 5 0ZM5.005 6.5C4.862 6.5 4.725 6.557 4.627 6.668C4.545 6.76 4.501 6.878 4.501 7C4.501 7.122 4.545 7.241 4.627 7.332C4.725 7.443 4.862 7.5 5.005 7.5C5.148 7.5 5.285 7.443 5.378 7.332C5.46 7.241 5.504 7.122 5.504 7C5.504 6.878 5.46 6.76 5.378 6.668C5.285 6.557 5.148 6.5 5.005 6.5ZM5 2.5C4.878 2.5 4.759 2.545 4.668 2.626C4.576 2.708 4.518 2.82 4.504 2.942L4.5 3V5L4.504 5.059C4.518 5.18 4.576 5.292 4.668 5.373C4.759 5.455 4.878 5.499 5 5.499C5.122 5.499 5.241 5.455 5.332 5.373C5.424 5.292 5.482 5.18 5.497 5.059L5.5 5V3L5.497 2.942C5.482 2.82 5.424 2.708 5.332 2.626C5.241 2.545 5.122 2.5 5 2.5Z"
          fill={colors.error.radix}
        />
      </Svg>
    </View>
  );
}

/** Gray info circle — reversed/refunded cashback */
function ReversedIcon() {
  return (
    <View style={styles.statusIconContainer}>
      <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
        <Path
          d="M5 0C7.7615 0 10 2.2385 10 5C10 7.7615 7.7615 10 5 10C2.2385 10 0 7.7615 0 5C0 2.2385 2.2385 0 5 0ZM6.35 3.65C6.16 3.46 5.84 3.46 5.65 3.65L5 4.3L4.35 3.65C4.16 3.46 3.84 3.46 3.65 3.65C3.46 3.84 3.46 4.16 3.65 4.35L4.3 5L3.65 5.65C3.46 5.84 3.46 6.16 3.65 6.35C3.84 6.54 4.16 6.54 4.35 6.35L5 5.7L5.65 6.35C5.84 6.54 6.16 6.54 6.35 6.35C6.54 6.16 6.54 5.84 6.35 5.65L5.7 5L6.35 4.35C6.54 4.16 6.54 3.84 6.35 3.65Z"
          fill={colors.black[300]}
        />
      </Svg>
    </View>
  );
}

const STATUS_ICON: Record<CashbackCardStatus, React.ComponentType> = {
  received: ReceivedIcon,
  accrued: AccruedIcon,
  missed: MissedIcon,
  reversed: ReversedIcon,
};

// ==============================================
// Amount Renderer — Figma: mixed font sizes
// Prefix "+ ₹  " at 12px, digits at 16px
// ==============================================

function AmountDisplay({ status, amount }: { status: CashbackCardStatus; amount: number | null }) {
  if (status === 'missed' || amount == null) {
    return <Text style={styles.amountMissed}>NA</Text>;
  }

  const formatted = amount.toLocaleString('en-IN');

  if (status === 'reversed') {
    // Reversed: show negative amount in muted gray
    return (
      <Text style={styles.amountReversed}>
        {'- ₹  '}
        <Text style={styles.amountDigitsLarge}>{formatted}</Text>
      </Text>
    );
  }

  if (status === 'accrued') {
    // Figma: base 12px amber, digits override to 16px amber
    return (
      <Text style={styles.amountAccrued}>
        {'+ ₹  '}
        <Text style={styles.amountDigitsLarge}>{formatted}</Text>
      </Text>
    );
  }

  // received — Figma: base 16px white, prefix override to 12px white
  return (
    <Text style={styles.amountReceived}>
      <Text style={styles.amountPrefixSmall}>{' + ₹  '}</Text>
      {formatted}
    </Text>
  );
}

// ==============================================
// Component
// ==============================================

function CashbackEarningsCardComponent({ entry, onPress }: CashbackEarningsCardProps) {
  const config = STATUS_CONFIG[entry.status];
  const StatusIcon = STATUS_ICON[entry.status];

  const content = (
    <View style={styles.card}>
      {/* Left: Icon + Date/Status */}
      <View style={styles.leftSide}>
        <RupeeIcon />
        <View style={styles.dateColumn}>
          <Text style={styles.dateText}>{entry.date}</Text>
          <View style={styles.statusRow}>
            <StatusIcon />
            <Text style={styles.statusText}>{config.label}</Text>
          </View>
        </View>
      </View>

      {/* Right: Amount */}
      <AmountDisplay status={entry.status} amount={entry.amount} />
    </View>
  );

  // Reversed/missed entries are not clickable — no receipt to show
  if (onPress && entry.status !== 'reversed' && entry.status !== 'missed') {
    return (
      <TouchableOpacity onPress={() => onPress(entry)} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// ==============================================
// Styles
// ==============================================

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.black[500], // Figma: #202020
    borderRadius: 12, // Figma: 12px
    padding: 16, // Figma: 16px all sides
    alignSelf: 'stretch',
  },

  // Left side
  leftSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // Figma: 16px gap
    flex: 1,
  },
  iconCircle: {
    width: 32, // Figma: 32x32
    height: 32,
    borderRadius: 160, // Figma: circle
    backgroundColor: '#663E2C', // Figma: dark brown-orange
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateColumn: {
    gap: 8, // Figma: 8px between date and status
    flex: 1,
  },
  dateText: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 14, // Figma: 14px
    lineHeight: 19.74, // Figma: 19.74 (~141%)
    letterSpacing: -0.56, // Figma: -0.56
    color: colors.white, // Figma: #FFFFFF
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Figma: 12x12 container for 10x10 SVG status icons
  statusIconContainer: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: colors.neutral[600], // Figma: #878787
  },

  // Amount - Received (base 16px for digits, prefix overridden to 12px)
  amountReceived: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16, // Figma: base for digits
    lineHeight: 22.56,
    letterSpacing: -0.64,
    color: colors.white, // Figma: #FFFFFF
  },
  // Figma: prefix " + ₹  " rendered at 12px inside 16px base
  amountPrefixSmall: {
    fontSize: 12,
  },

  // Amount - Accrued (base 12px for prefix, digits overridden to 16px)
  amountAccrued: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12, // Figma: base for prefix
    lineHeight: 16.92,
    letterSpacing: -0.48,
    color: colors.warning.amber, // Figma: #FFB020
  },
  // Figma: digit chars rendered at 16px inside 12px base
  amountDigitsLarge: {
    fontSize: 16,
  },

  // Amount - Reversed (refunded/settlement failed — muted gray with minus)
  amountReversed: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.48,
    color: colors.black[300], // #797979 — muted
  },

  // Amount - Missed
  amountMissed: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.48,
    color: colors.white, // Figma: #FFFFFF
  },
});

export const CashbackEarningsCard = memo(CashbackEarningsCardComponent);
