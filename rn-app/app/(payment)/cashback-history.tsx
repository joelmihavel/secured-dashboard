/**
 * Savings History Screen (formerly Cashback History)
 *
 * Displays total lifetime savings from 1% instant rent discount,
 * and a list of per-payment discount entries.
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, BackButton } from '@/src/components';
import { useCashback } from '@/src/hooks';
import { useSavingsHistory } from '@/src/hooks/usePayments';
import type { SavingsEntry } from '@/src/services/api/payments';
import { colors } from '@/src/theme';

// ==============================================
// DESIGN TOKENS
// ==============================================

const COLORS = {
  background: colors.black[700],
  card: colors.black[500],
  accent: colors.brand[500],
  label: '#878787',
  value: '#CBCBCB',
  white: colors.white,
  savingsGreen: '#4CAF50',
  emptyText: '#A9A9A9',
};

// ==============================================
// ICONS
// ==============================================

// ==============================================
// HELPERS
// ==============================================

function formatRupees(rupees: number): string {
  return rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ==============================================
// SAVINGS SUMMARY CARD
// ==============================================

interface SavingsCardProps {
  totalSavings: number;
  discountCount: number;
  discountRate: number;
  isLoading: boolean;
}

function SavingsCard({ totalSavings, discountCount, discountRate, isLoading }: SavingsCardProps) {
  return (
    <View style={styles.balanceCard}>
      {isLoading ? (
        <ActivityIndicator size="small" color={COLORS.accent} />
      ) : (
        <>
          <Text style={styles.balanceLabel}>Total Savings with Flent</Text>
          <Text style={styles.balanceAmount}>
            {'\u20B9'}{formatRupees(totalSavings)}
          </Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.statLabel}>Payments</Text>
              <Text style={styles.statValue}>
                {discountCount}
              </Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStat}>
              <Text style={styles.statLabel}>Discount Rate</Text>
              <Text style={styles.statValue}>
                {(discountRate * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ==============================================
// HISTORY ITEM
// ==============================================

function HistoryItem({ entry }: { entry: SavingsEntry }) {
  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyDot, { backgroundColor: COLORS.savingsGreen }]} />
      <View style={styles.historyContent}>
        <Text style={styles.historyDescription} numberOfLines={2}>
          {entry.description}
        </Text>
        <Text style={styles.historyDate}>{formatDate(entry.created_at)}</Text>
      </View>
      <Text style={[styles.historyAmount, { color: COLORS.savingsGreen }]}>
        -{'\u20B9'}{formatRupees(entry.amount)}
      </Text>
    </View>
  );
}

// ==============================================
// EMPTY STATE
// ==============================================

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No savings yet. Complete setup to start saving 1% on rent.</Text>
    </View>
  );
}

// ==============================================
// MAIN COMPONENT
// ==============================================

export default function SavingsHistoryScreen() {
  const router = useRouter();
  const { totalSavings, discountRate, isLoading: isBalanceLoading } = useCashback();
  const { data: savingsData, isLoading: isHistoryLoading } = useSavingsHistory();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: SavingsEntry }) => <HistoryItem entry={item} />,
    []
  );

  const keyExtractor = useCallback((item: SavingsEntry) => item.id, []);

  const entries = savingsData?.history ?? [];

  return (
    <Screen testID="savings-history-screen" padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton
          onPress={handleBack}
          style={styles.backButton}
          color={COLORS.white}
        />
        <Text style={styles.headerTitle}>Lifetime Savings</Text>
      </View>

      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <SavingsCard
            totalSavings={totalSavings}
            discountCount={savingsData?.discount_count ?? 0}
            discountRate={discountRate}
            isLoading={isBalanceLoading}
          />
        }
        ListEmptyComponent={isHistoryLoading ? null : EmptyState}
        ListFooterComponent={
          isHistoryLoading ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={COLORS.accent} />
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
      />
    </Screen>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 20,
    lineHeight: 28,
    color: COLORS.white,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    flexGrow: 1,
  },
  // Balance card
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.label,
    marginBottom: 4,
  },
  balanceAmount: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 32,
    lineHeight: 40,
    color: COLORS.accent,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  balanceStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  balanceDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.label,
    opacity: 0.3,
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.label,
  },
  statValue: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.value,
  },
  // History items
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyContent: {
    flex: 1,
    gap: 2,
  },
  historyDescription: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.value,
  },
  historyDate: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.label,
  },
  historyAmount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: 'rgba(77, 77, 77, 0.3)',
    marginLeft: 20,
  },
  // Empty & loading
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.emptyText,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
