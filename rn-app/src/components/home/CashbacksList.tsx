/**
 * CashbacksList Component
 * Cashback balance display and cashback history list - Figma pixel-perfect
 * Figma Reference: 243-7185
 *
 * Figma Pixel-Perfect Values:
 * - Container padding: horizontal 32px
 * - Balance label: "CASHBACK BALANCE", fontSize 12, fontWeight 500, lineHeight 20, color #A9A9A9
 * - Balance amount: fontSize 16/28, fontWeight 600, lineHeight ~22.56, color #FFFFFF/green
 * - Stats row:
 *   - Label: fontSize 14, lineHeight 20, color #DDDDDD (neutral[200])
 *   - Value: fontSize 28, lineHeight 40, letterSpacing -1, color #BABABA (neutral[400])
 * - Divider: borderColor #4D4D4D, borderWidth 1
 * - History items:
 *   - Title: fontSize 14, fontWeight 500, lineHeight ~19.74, letterSpacing -0.56, color #FFFFFF
 *   - Status: fontSize 12, lineHeight ~16.92, letterSpacing -0.24, color #878787
 *   - Status dot: width 10, height 10, colors: #4CAF50/#FFB020/#E5484D
 *   - Amount: fontSize 16, fontWeight 600, lineHeight ~22.56, letterSpacing -0.64, color #FFFFFF
 *   - NA text: fontSize 12, fontWeight 600, color #FFFFFF
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

export type CashbackStatus = 'paid' | 'delayed' | 'missed' | 'pending';

export interface CashbackEntry {
  id: string;
  title: string; // e.g., "September Cashback"
  status: CashbackStatus;
  statusLabel?: string; // e.g., "On Time", "Delayed", "No Payment"
  amount: number | null; // null for NA
}

export interface CashbacksListProps {
  balance: number;
  allTimeTotal: number;
  cashbackRate: number; // e.g., 0.8 for 0.8%
  entries: CashbackEntry[];
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
}: CashbacksListProps) {
  const formatAmount = (amount: number) => {
    const formatted = amount.toLocaleString('en-IN');
    return formatted;
  };

  return (
    <View style={styles.container}>
      {/* Balance Section */}
      <View style={styles.balanceSection}>
        <Text style={styles.balanceLabel}>CASHBACK BALANCE</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.rupeeSymbol}>₹ </Text>
          <Text style={styles.balanceAmount}>{Math.floor(balance)}</Text>
          <Text style={styles.balanceDecimal}>.00</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsSection}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>All-time Total</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.statRupee}>₹ </Text>
            <Text style={styles.statValue}>{formatAmount(allTimeTotal)}</Text>
            <Text style={styles.statDecimal}>.00</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Cashback Rate</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.rateValue}>{cashbackRate.toFixed(1)}%</Text>
            <Text style={styles.rateAvg}> Avg</Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Cashback History */}
      <View style={styles.historySection}>
        {entries.map((entry) => {
          const config = statusConfig[entry.status];
          const statusLabel = entry.statusLabel || config.defaultLabel;

          return (
            <View key={entry.id} style={styles.historyRow}>
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
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32, // Figma: 32px exact
  },
  // Balance section
  balanceSection: {
    gap: 8, // Figma: gap between label and amount
  },
  balanceLabel: {
    fontSize: 12, // Figma: fontSize 12
    fontWeight: '500', // Figma: fontWeight 500
    lineHeight: 20, // Figma: lineHeight 20
    color: '#A9A9A9', // Figma: #A9A9A9 (neutral[500])
    letterSpacing: 0,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rupeeSymbol: {
    fontSize: 16, // Figma: fontSize 16
    fontWeight: '600', // Figma: fontWeight 600
    lineHeight: 22.56, // Figma: lineHeight ~22.56
    letterSpacing: -0.64, // Figma: letterSpacing -0.64
    color: colors.white,
  },
  balanceAmount: {
    fontSize: 16, // Figma: fontSize 16
    fontWeight: '600', // Figma: fontWeight 600
    lineHeight: 22.56, // Figma: lineHeight ~22.56
    letterSpacing: -0.64, // Figma: letterSpacing -0.64
    color: colors.white, // Figma: #FFFFFF
  },
  balanceDecimal: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  // Stats section - Figma layout
  statsSection: {
    marginTop: 24, // Figma: gap
    gap: 12, // Figma: gap between stat rows
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400',
    color: '#DDDDDD', // Figma: #DDDDDD (neutral[200])
    textAlign: 'center', // Figma 243:6462, 243:6466: textAlignHorizontal CENTER
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statRupee: {
    fontSize: 28, // Figma: fontSize 28
    lineHeight: 40, // Figma: lineHeight 40
    letterSpacing: -1, // Figma: letterSpacing -1
    fontWeight: '400',
    color: '#BABABA', // Figma: #BABABA (neutral[400])
  },
  statValue: {
    fontSize: 28, // Figma: fontSize 28
    lineHeight: 40, // Figma: lineHeight 40
    letterSpacing: -1, // Figma: letterSpacing -1
    fontWeight: '400',
    color: '#BABABA', // Figma: #BABABA (neutral[400])
  },
  statDecimal: {
    fontSize: 14,
    color: '#BABABA',
  },
  rateValue: {
    fontSize: 28, // Figma: fontSize 28
    lineHeight: 40, // Figma: lineHeight 40
    letterSpacing: -1, // Figma: letterSpacing -1
    fontWeight: '400',
    color: '#BABABA', // Figma: same as other values
  },
  rateAvg: {
    fontSize: 14,
    color: '#BABABA',
  },
  // Divider - Figma: vector line
  divider: {
    height: 1, // Figma: borderWidth 1
    backgroundColor: '#4D4D4D', // Figma: #4D4D4D (black[400])
    marginVertical: 24, // Figma: spacing
  },
  // History section
  historySection: {
    gap: 16, // Figma: gap between history rows
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyContent: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    fontSize: 14, // Figma: fontSize 14
    fontWeight: '500', // Figma: fontWeight 500
    lineHeight: 19.74, // Figma: lineHeight ~19.74
    letterSpacing: -0.56, // Figma: letterSpacing -0.56
    color: colors.white, // Figma: #FFFFFF
  },
  historyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10, // Figma: width 10
    height: 10, // Figma: height 10
    borderRadius: 5, // Figma: fully rounded
    marginRight: 6,
  },
  historyStatus: {
    fontSize: 12, // Figma: fontSize 12
    lineHeight: 16.92, // Figma: lineHeight ~16.92
    letterSpacing: -0.24, // Figma: letterSpacing -0.24
    color: '#878787', // Figma: #878787 (neutral[600])
  },
  historyAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  historyRupee: {
    fontSize: 16, // Figma: fontSize 16
    fontWeight: '600', // Figma: fontWeight 600
    lineHeight: 22.56, // Figma: lineHeight ~22.56
    letterSpacing: -0.64, // Figma: letterSpacing -0.64
    color: colors.white,
    marginRight: 2,
  },
  historyAmount: {
    fontSize: 16, // Figma: fontSize 16
    fontWeight: '600', // Figma: fontWeight 600
    lineHeight: 22.56, // Figma: lineHeight ~22.56
    letterSpacing: -0.64, // Figma: letterSpacing -0.64
    color: colors.white,
  },
  historyNA: {
    fontSize: 12, // Figma: fontSize 12
    fontWeight: '600', // Figma: fontWeight 600
    lineHeight: 16.92, // Figma: lineHeight ~16.92
    letterSpacing: -0.48, // Figma: letterSpacing -0.48
    color: colors.white, // Figma: #FFFFFF
  },
});

export const CashbacksList = memo(CashbacksListComponent);
