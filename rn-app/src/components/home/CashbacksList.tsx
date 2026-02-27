/**
 * CashbacksList Component
 * Cashback balance display and cashback history list - Figma pixel-perfect
 * Figma Reference: 243-7337 (REST API data 2026-02-13)
 *
 * Figma Pixel-Perfect Values (from REST API node 243:7337):
 * - Container: VERTICAL, crossAxis CENTER, padding top=8 bottom=8 left=32 right=32, gap=32
 * - Balance label (243:7344): fontSize 12, weight 500, lineHeight 20, color #A9A9A9
 * - Balance text (243:7345): base fontSize 28, weight 400, lineHeight 40, ls -1, color #BABABA
 *   - override[41] "₹ ": fontSize 14, color #444444
 *   - override[42] "325": fontSize 32, color #FF9A6D (orange!)
 *   - override[24] ".00": fontSize 14, color #444444
 * - Stats rows (243:7347, 243:7351): HORIZONTAL, SPACE_BETWEEN, CENTER, gap 16
 *   - Label: fontSize 14, weight 400, lineHeight 20, color #DDDDDD
 *   - "₹  3,256.00" override[41]: fs 14 #444444, override[43]: fs 16 #FF9A6D, override[24]: fs 14 #444444
 *   - "0.8% Avg" override[43]: fs 16 #FF9A6D, override[24]: fs 14 #444444
 * - Dividers: stroke #4D4D4D, strokeWeight 0.25
 * - History rows (gap=24): title fs 14 w500 #FFFFFF, status fs 12 #878787, amount fs 16 w600 #FFFFFF
 */

import React, { memo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

import { Text } from '@/src/components/ui';

export type CashbackStatus = 'paid' | 'delayed' | 'missed' | 'pending';

export interface CashbackEntry {
  id: string;
  title: string; // e.g., "September Cashback"
  status: CashbackStatus;
  statusLabel?: string; // e.g., "On Time", "Delayed", "No Payment"
  amount: number | null; // null for NA
  paymentId?: string; // Source payment ID for navigation to receipt
}

export interface CashbacksListProps {
  balance: number;
  allTimeTotal: number;
  cashbackRate: number; // e.g., 0.8 for 0.8%
  entries: CashbackEntry[];
  onEntryPress?: (entry: CashbackEntry) => void;
}

// Figma exact colors for status indicators
const statusConfig: Record<CashbackStatus, { color: string; defaultLabel: string }> = {
  paid: { color: '#4CAF50', defaultLabel: 'Paid \u00B7 On Time' }, // Figma: success.material
  delayed: { color: '#FFB020', defaultLabel: 'Paid \u00B7 Delayed' }, // Figma: warning.amber
  missed: { color: '#E5484D', defaultLabel: 'Missed \u00B7 No Payment' }, // Figma: error.radix
  pending: { color: '#878787', defaultLabel: 'Pending' },
};

function CashbacksListComponent({
  balance,
  allTimeTotal,
  cashbackRate,
  entries,
  onEntryPress,
}: CashbacksListProps) {
  const formatAmount = (amount: number) => {
    const formatted = amount.toLocaleString('en-IN');
    return formatted;
  };

  return (
    <View style={styles.container}>
      {/* Figma 243:7342: Balance + Stats section (VERTICAL, gap=16) */}
      <View style={styles.balanceSection}>
        <Text style={styles.balanceLabel}>CASHBACK BALANCE</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.rupeeSymbol}>₹ </Text>
          <Text style={styles.balanceAmount}>{Math.floor(balance)}</Text>
          <Text style={styles.balanceDecimal}>.00</Text>
        </View>

        {/* Figma 243:7346: divider between balance and all-time total */}
        <View style={styles.divider} />

        {/* Figma 243:7347: All-time Total row */}
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>All-time Total</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.statRupee}>₹ </Text>
            <Text style={styles.statValue}>{formatAmount(allTimeTotal)}</Text>
            <Text style={styles.statDecimal}>.00</Text>
          </View>
        </View>

        {/* Figma 243:7350: divider between all-time total and cashback rate */}
        <View style={styles.divider} />

        {/* Figma 243:7351: Cashback Rate row */}
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Cashback Rate</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.rateValue}>{cashbackRate.toFixed(1)}%</Text>
            <Text style={styles.rateAvg}> Avg</Text>
          </View>
        </View>
      </View>

      {/* Figma 243:7354: Main divider between stats and history (gap=32 from parent) */}
      <View style={styles.mainDivider} />

      {/* Cashback History */}
      <View style={styles.historySection}>
        {entries.map((entry) => {
          const config = statusConfig[entry.status];
          const statusLabel = entry.statusLabel || config.defaultLabel;

          const RowWrapper = onEntryPress ? Pressable : View;
          const rowProps = onEntryPress
            ? { onPress: () => onEntryPress(entry), style: styles.historyRow }
            : { style: styles.historyRow };

          return (
            <RowWrapper key={entry.id} {...rowProps}>
              {/* Left: Title + Status */}
              <View style={styles.historyContent}>
                <Text style={styles.historyTitle}>{entry.title}</Text>
                <View style={styles.historyStatusRow}>
                  <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                  <Text style={styles.historyStatus}>{statusLabel}</Text>
                </View>
              </View>

              {/* Right: Amount */}
              <View style={styles.historyAmountContainer}>
                {entry.amount !== null ? (
                  <>
                    <Text style={styles.historyRupee}>₹</Text>
                    <Text style={styles.historyAmount}>{entry.amount}</Text>
                  </>
                ) : (
                  <Text style={styles.historyNA}>NA</Text>
                )}
              </View>
            </RowWrapper>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32, // Figma 243:7337: paddingLeft 32, paddingRight 32
    alignSelf: 'stretch', // Ensure full width in centered parent
  },
  // Figma 243:7342: VERTICAL, gap=16
  balanceSection: {
    gap: 16, // Figma: itemSpacing 16 between label and amount
  },
  // Figma 243:7344: fontSize 12, weight 500, lineHeight 20, color #A9A9A9
  balanceLabel: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12,
    lineHeight: 20,
    color: '#A9A9A9',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  // Figma 243:7345 override[41]: fontSize 14, color #444444
  rupeeSymbol: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 14,
    lineHeight: 40,
    letterSpacing: -1,
    color: '#444444',
  },
  // Figma 243:7345 override[42]: fontSize 32, color #FF9A6D
  balanceAmount: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -1,
    color: '#FF9A6D',
  },
  // Figma 243:7345 override[24]: fontSize 14, color #444444
  balanceDecimal: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 14,
    color: '#444444',
  },
  // Figma 243:7347/7351: HORIZONTAL, SPACE_BETWEEN, CENTER, gap=16
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Figma 243:7348/7352: fontSize 14, weight 400, lineHeight 20, color #DDDDDD
  statLabel: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 14,
    lineHeight: 20,
    color: '#DDDDDD',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  // Figma 243:7349 override[41]: fontSize 14, color #444444
  statRupee: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 14,
    color: '#444444',
  },
  // Figma 243:7349 override[43]: fontSize 16, color #FF9A6D
  statValue: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 16,
    color: '#FF9A6D',
  },
  // Figma 243:7349 override[24]: fontSize 14, color #444444
  statDecimal: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: '#444444',
  },
  // Figma 243:7353 override[43]: fontSize 16, color #FF9A6D
  rateValue: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 16,
    color: '#FF9A6D',
  },
  // Figma 243:7353 override[24]: fontSize 14, color #444444
  rateAvg: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: '#444444',
  },
  // Figma 243:7346/7350: stroke #4D4D4D, strokeWeight 0.25
  divider: {
    height: StyleSheet.hairlineWidth, // Figma: strokeWeight 0.25 (hairline)
    backgroundColor: '#4D4D4D',
  },
  // Figma 243:7354: Main divider between stats and history
  mainDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#4D4D4D',
    marginVertical: 32, // Figma: gap 32 from parent frame between content sections
  },
  // Figma 243:7355: VERTICAL, gap=24
  historySection: {
    gap: 24, // Figma: itemSpacing 24
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Figma 243:7358: VERTICAL, CENTER, gap=8
  historyContent: {
    flex: 1,
    gap: 8, // Figma: itemSpacing 8 between title and status row
  },
  historyTitle: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 19.74, // Figma: lineHeight ~19.74
    letterSpacing: -0.56, // Figma: letterSpacing -0.56
    color: '#FFFFFF', // Figma: #FFFFFF
  },
  historyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Figma 243:7362: 10x10 colored dot (inside 12x12 white frame)
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4, // Figma 243:7360: gap=4
  },
  historyStatus: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, // Figma: fontSize 12
    lineHeight: 16.92, // Figma: lineHeight ~16.92
    letterSpacing: -0.24, // Figma: letterSpacing -0.24
    color: '#878787', // Figma: #878787 (neutral[600])
  },
  historyAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  // Figma 243:7364 override[1]: fontSize 12 for rupee symbol
  historyRupee: {
    fontFamily: 'PlusJakartaSans-SemiBold', // Figma: fontWeight 600
    fontSize: 12, // Figma: override[1] fontSize 12
    lineHeight: 22.56,
    letterSpacing: -0.64,
    color: '#FFFFFF',
    marginRight: 2,
  },
  historyAmount: {
    fontFamily: 'PlusJakartaSans-SemiBold', // Figma: fontWeight 600
    fontSize: 16, // Figma: fontSize 16
    lineHeight: 22.56, // Figma: lineHeight ~22.56
    letterSpacing: -0.64, // Figma: letterSpacing -0.64
    color: '#FFFFFF', // Figma: #FFFFFF
  },
  historyNA: {
    fontFamily: 'PlusJakartaSans-SemiBold', // Figma: fontWeight 600
    fontSize: 12, // Figma: fontSize 12
    lineHeight: 16.92, // Figma: lineHeight ~16.92
    letterSpacing: -0.48, // Figma: letterSpacing -0.48
    color: '#FFFFFF', // Figma: #FFFFFF
  },
});

export const CashbacksList = memo(CashbacksListComponent);
