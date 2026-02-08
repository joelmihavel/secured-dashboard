/**
 * CashbackEmptyState Component
 * Shows empty cashback state with accrued info
 * Figma Reference: 243-6296
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/ui';
import { colors, spacing, radius, typography } from '@/src/theme';

export interface CashbackEmptyStateProps {
  accruedAmount?: number;
  allTimeTotal?: number;
  cashbackRate?: number;
}

function CashbackEmptyStateComponent({
  accruedAmount = 0,
  allTimeTotal = 0,
  cashbackRate = 0.8,
}: CashbackEmptyStateProps) {
  const formatAmount = (amount: number) => {
    if (amount === 0) return '0.00';
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <View style={styles.container}>
      {/* Cashback Accrued Label */}
      <Text style={styles.sectionLabel}>CASHBACK ACCRUED</Text>

      {/* Accrued Amount with Orange Circle */}
      <View style={styles.accruedRow}>
        <View style={styles.accentDot} />
        <Text style={styles.accruedAmount}>₹ {formatAmount(accruedAmount)}</Text>
      </View>

      {/* Stats Rows */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>All-time Total</Text>
          <Text style={styles.statValue}>₹ {formatAmount(allTimeTotal)}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Cashback Rate</Text>
          <Text style={styles.statValueAccent}>{cashbackRate}% Avg</Text>
        </View>
      </View>

      {/* Empty state illustration */}
      <View style={styles.emptyIllustration}>
        <View style={styles.avatarOuter}>
          <View style={styles.avatarInner} />
        </View>
      </View>

      {/* Empty state text */}
      <Text style={styles.placeholderTitle}>No Cashback Yet</Text>
      <Text style={styles.placeholderText}>
        Start spending to earn cashback on your{'\n'}
        everyday purchases.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    letterSpacing: 0.5,
  },
  accruedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  accentDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand[500],
  },
  accruedAmount: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  statsContainer: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: colors.neutral[400],
    textAlign: 'center', // Figma 243:6462, 243:6466: textAlignHorizontal CENTER
  },
  statValue: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center', // Figma 243:6462: textAlignHorizontal CENTER
  },
  statValueAccent: {
    fontSize: 14,
    color: colors.brand[500],
    textAlign: 'center', // Figma 243:6466: textAlignHorizontal CENTER
  },
  emptyIllustration: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  avatarOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand[700],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand[500],
  },
  placeholderTitle: {
    ...typography.h4,
    color: colors.white,
    textAlign: 'center',
  },
  placeholderText: {
    ...typography.bodySm, // Figma: 12px, colors.neutral[500]
    color: colors.neutral[500],
    textAlign: 'center',
  },
});

export const CashbackEmptyState = memo(CashbackEmptyStateComponent);
