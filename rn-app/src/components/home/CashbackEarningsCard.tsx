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
import Svg, { Path, Rect } from 'react-native-svg';

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

const STATUS_CONFIG: Record<CashbackCardStatus, { dotColor: string; label: string }> = {
  received: { dotColor: colors.success.material, label: 'Recieved' }, // Figma spelling preserved
  accrued: { dotColor: colors.warning.amber, label: 'Accrued \uD83D\uDD12' }, // lock emoji
  missed: { dotColor: colors.error.radix, label: 'Missed' },
};

// ==============================================
// Receipt Icon
// ==============================================

function ReceiptIcon() {
  return (
    <View style={styles.iconCircle}>
      <Svg width={19} height={19} viewBox="0 0 19 19" fill="none">
        <Rect x={5} y={4} width={9} height={11} rx={1} stroke="#FFAE8A" strokeWidth={1.2} />
        <Path d="M7 8H12" stroke="#FFAE8A" strokeWidth={1.2} strokeLinecap="round" />
        <Path d="M7 10.5H10" stroke="#FFAE8A" strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// ==============================================
// Amount Renderer
// ==============================================

function AmountDisplay({ status, amount }: { status: CashbackCardStatus; amount: number | null }) {
  if (status === 'missed' || amount == null) {
    return <Text style={styles.amountMissed}>NA</Text>;
  }

  const formatted = amount.toLocaleString('en-IN');

  if (status === 'accrued') {
    return <Text style={styles.amountAccrued}>+ ₹  {formatted}</Text>;
  }

  // received — Figma: " + ₹  325" (leading space)
  return <Text style={styles.amountReceived}> + ₹  {formatted}</Text>;
}

// ==============================================
// Component
// ==============================================

function CashbackEarningsCardComponent({ entry, onPress }: CashbackEarningsCardProps) {
  const config = STATUS_CONFIG[entry.status];

  const content = (
    <View style={styles.card}>
      {/* Left: Icon + Date/Status */}
      <View style={styles.leftSide}>
        <ReceiptIcon />
        <View style={styles.dateColumn}>
          <Text style={styles.dateText}>{entry.date}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: config.dotColor }]} />
            <Text style={styles.statusText}>{config.label}</Text>
          </View>
        </View>
      </View>

      {/* Right: Amount */}
      <AmountDisplay status={entry.status} amount={entry.amount} />
    </View>
  );

  if (onPress) {
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
    lineHeight: 20, // Figma: 20 (extracted from node)
    letterSpacing: -0.56, // Figma: -0.56
    color: colors.white, // Figma: #FFFFFF
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: colors.neutral[600], // Figma: #878787
  },

  // Amount - Received
  amountReceived: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 22.56,
    letterSpacing: -0.64,
    color: colors.white, // Figma: #FFFFFF
  },

  // Amount - Accrued (locked)
  amountAccrued: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.48,
    color: colors.warning.amber, // Figma: #FFB020
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
