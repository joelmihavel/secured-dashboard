/**
 * RecentPaymentsList Component
 * Renders transaction cards with progress bars, info banners, and action buttons.
 * Figma Reference: 4109-67659
 *
 * Layout: "YOUR TRANSACTIONS" section label + stacked PaymentStatusCards (4px gap).
 * Sits inside the "Recent Payments" tab content, below TabSwitcher.
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/ui';
import { PaymentStatusCard } from '../payment/PaymentStatusCard';
import { colors } from '@/src/theme';
import type { MappedTransaction } from '@/src/services/api/dashboard';

export interface RecentPaymentsListProps {
  transactions: MappedTransaction[];
  landlordName?: string;
  onViewReceipt?: (transaction: MappedTransaction) => void;
  onNeedHelp?: () => void;
  onTryAgain?: (transaction: MappedTransaction) => void;
}

function RecentPaymentsListComponent({
  transactions,
  landlordName,
  onViewReceipt,
  onNeedHelp,
  onTryAgain,
}: RecentPaymentsListProps) {
  if (transactions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section label — Figma 4109:67660 */}
      <Text style={styles.sectionLabel}>YOUR TRANSACTIONS</Text>

      {/* Card list — Figma 4109:67661 */}
      <View style={styles.cardList}>
        {transactions.map((tx) => (
          <PaymentStatusCard
            key={tx.id}
            transaction={tx}
            landlordName={landlordName}
            onViewReceipt={onViewReceipt}
            onNeedHelp={onNeedHelp}
            onTryAgain={onTryAgain}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32, // Figma: match screen padding
    gap: 16, // Figma: 16px between section label and card list
    alignSelf: 'stretch',
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    letterSpacing: 0, // Figma: 0
    color: colors.neutral[500], // Figma: #A9A9A9
  },
  cardList: {
    gap: 12, // Increased from Figma 4px for better readability
  },
});

export const RecentPaymentsList = memo(RecentPaymentsListComponent);
