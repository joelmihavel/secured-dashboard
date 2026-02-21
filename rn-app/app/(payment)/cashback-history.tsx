/**
 * Cashback History Screen
 *
 * Displays cashback balance summary and paginated transaction history.
 * Uses FlatList with onEndReached for infinite scroll.
 */

import React, { useCallback, useState } from 'react';
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

import { Screen, Text } from '@/src/components';
import { useCashback } from '@/src/hooks';
import { useCashbackHistory } from '@/src/hooks/usePayments';
import type { CashbackEntry } from '@/src/services/api/payments';
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
  earned: '#4CAF50',
  applied: colors.brand[500],
  expired: '#878787',
  reversed: '#2196F3',
  emptyText: '#A9A9A9',
};

// ==============================================
// ICONS
// ==============================================

const BackArrowIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 12H5M5 12L12 19M5 12L12 5"
      stroke={COLORS.white}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ==============================================
// HELPERS
// ==============================================

function getEntryColor(type: CashbackEntry['transaction_type']): string {
  switch (type) {
    case 'earned':
      return COLORS.earned;
    case 'redeemed':
      return COLORS.applied;
    case 'expired':
      return COLORS.expired;
    case 'reversed':
      return COLORS.reversed;
    default:
      return COLORS.value;
  }
}

function getEntryPrefix(type: CashbackEntry['transaction_type']): string {
  switch (type) {
    case 'earned':
    case 'reversed':
      return '+';
    case 'redeemed':
    case 'expired':
      return '-';
    default:
      return '';
  }
}

function formatPaise(paise: number): string {
  const rupees = Math.abs(paise) / 100;
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
// BALANCE CARD
// ==============================================

interface BalanceCardProps {
  available: number;
  totalEarned: number;
  totalUsed: number;
  isLoading: boolean;
}

function BalanceCard({ available, totalEarned, totalUsed, isLoading }: BalanceCardProps) {
  return (
    <View style={styles.balanceCard}>
      {isLoading ? (
        <ActivityIndicator size="small" color={COLORS.accent} />
      ) : (
        <>
          <Text style={styles.balanceLabel}>Available Cashback</Text>
          <Text style={styles.balanceAmount}>
            {'\u20B9'}{formatPaise(available)}
          </Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={styles.statLabel}>Total Earned</Text>
              <Text style={styles.statValue}>
                {'\u20B9'}{formatPaise(totalEarned)}
              </Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStat}>
              <Text style={styles.statLabel}>Total Used</Text>
              <Text style={styles.statValue}>
                {'\u20B9'}{formatPaise(totalUsed)}
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

function HistoryItem({ entry }: { entry: CashbackEntry }) {
  const entryColor = getEntryColor(entry.transaction_type);
  const prefix = getEntryPrefix(entry.transaction_type);

  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyDot, { backgroundColor: entryColor }]} />
      <View style={styles.historyContent}>
        <Text style={styles.historyDescription} numberOfLines={2}>
          {entry.description}
        </Text>
        <Text style={styles.historyDate}>{formatDate(entry.created_at)}</Text>
      </View>
      <Text style={[styles.historyAmount, { color: entryColor }]}>
        {prefix}{'\u20B9'}{formatPaise(entry.amount_paise)}
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
      <Text style={styles.emptyText}>No cashback history yet</Text>
    </View>
  );
}

// ==============================================
// MAIN COMPONENT
// ==============================================

export default function CashbackHistoryScreen() {
  const router = useRouter();
  const { availableBalance, totalEarned, totalUsed, isLoading: isBalanceLoading } = useCashback();
  const [page, setPage] = useState(1);
  const { data: historyData, isLoading: isHistoryLoading } = useCashbackHistory(page, 20);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleEndReached = useCallback(() => {
    if (historyData?.pagination?.has_next) {
      setPage((prev) => prev + 1);
    }
  }, [historyData]);

  const renderItem = useCallback(
    ({ item }: { item: CashbackEntry }) => <HistoryItem entry={item} />,
    []
  );

  const keyExtractor = useCallback((item: CashbackEntry) => item.id, []);

  const entries = historyData?.entries ?? [];

  return (
    <Screen testID="cashback-history-screen" padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <BackArrowIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cashback</Text>
      </View>

      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <BalanceCard
            available={availableBalance}
            totalEarned={totalEarned}
            totalUsed={totalUsed}
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
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
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
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.emptyText,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
