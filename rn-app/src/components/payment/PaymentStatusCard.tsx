/**
 * PaymentStatusCard Component
 * Rich transaction card with status-aware progress bar, info banner, and action bar.
 * Supports 6 states: settled, in_progress, initiated, retrying, refunded, failed.
 * Figma Reference: 4109:67659
 *
 * Figma Pixel-Perfect Values:
 * - Card: bg #202020, borderRadius 12, padding 16, gap 16
 * - Title: PlusJakartaSans-Medium, 14px, lineHeight 19.74, letterSpacing -0.56, #FFFFFF
 * - Status text: PlusJakartaSans-Regular, 12px, lineHeight 16.92, letterSpacing -0.24, #878787
 * - Amount: PlusJakartaSans-SemiBold, 16px, lineHeight 22.56, letterSpacing -0.64, #FFFFFF
 * - Banner: bg #1A1A1A, borderRadius 200, paddingH 12, paddingV 8, gap 10
 * - Banner text: PlusJakartaSans-Regular, 12px, lineHeight 20, #878787
 * - Action text: PlusJakartaSans-SemiBold, 12px, lineHeight 16.92, letterSpacing -0.24, #FF9A6D
 * - Separator: hairlineWidth, #4D4D4D
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/src/components/ui';
import { Avatar } from '@/src/components/ui/Avatar';
import { PaymentProgressBar } from './PaymentProgressBar';
import { colors } from '@/src/theme';
import type { TransactionCardStatus, MappedTransaction } from '@/src/services/api/dashboard';

// -----------------------------------------------
// Props
// -----------------------------------------------

interface PaymentStatusCardProps {
  transaction: MappedTransaction;
  landlordName?: string;
  onViewReceipt?: (transaction: MappedTransaction) => void;
  onNeedHelp?: () => void;
  onTryAgain?: (transaction: MappedTransaction) => void;
}

// -----------------------------------------------
// Status Icon SVGs (inline, 12x12)
// -----------------------------------------------

function CheckmarkIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        d="M10 3L4.5 8.5L2 6"
        stroke="#4CAF50"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WarningIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        d="M6 4V6.5M6 8.5H6.005M10.5 6C10.5 8.485 8.485 10.5 6 10.5C3.515 10.5 1.5 8.485 1.5 6C1.5 3.515 3.515 1.5 6 1.5C8.485 1.5 10.5 3.515 10.5 6Z"
        stroke="#FFB020"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function XCircleIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        d="M7.5 4.5L4.5 7.5M4.5 4.5L7.5 7.5M10.5 6C10.5 8.485 8.485 10.5 6 10.5C3.515 10.5 1.5 8.485 1.5 6C1.5 3.515 3.515 1.5 6 1.5C8.485 1.5 10.5 3.515 10.5 6Z"
        stroke="#E5484D"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function InfoCircleIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        d="M6 8V6M6 4H6.005M10.5 6C10.5 8.485 8.485 10.5 6 10.5C3.515 10.5 1.5 8.485 1.5 6C1.5 3.515 3.515 1.5 6 1.5C8.485 1.5 10.5 3.515 10.5 6Z"
        stroke="#878787"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HelpIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M6 6C6 4.895 6.895 4 8 4C9.105 4 10 4.895 10 6C10 6.736 9.596 7.376 9 7.723V8.5"
        stroke="#FF9A6D"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Path
        d="M8 11H8.005M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C11.314 2 14 4.686 14 8Z"
        stroke="#FF9A6D"
        strokeWidth={1}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// -----------------------------------------------
// Status Config
// -----------------------------------------------

const STATUS_ICON_MAP: Record<TransactionCardStatus, React.FC> = {
  settled: CheckmarkIcon,
  in_progress: WarningIcon,
  initiated: WarningIcon,
  retrying: WarningIcon,
  refunded: InfoCircleIcon,
  failed: XCircleIcon,
};

function getStatusText(cardStatus: TransactionCardStatus, date: string): string {
  switch (cardStatus) {
    case 'settled':
      return `Settled \u00B7 ${date}`;
    case 'in_progress':
      return 'In progress';
    case 'initiated':
      return 'Initiated';
    case 'retrying':
      return 'Retrying';
    case 'refunded':
      return `Refunded \u00B7 ${date}`;
    case 'failed':
      return `Failed \u00B7 ${date}`;
  }
  return '';
}

function getBannerText(cardStatus: TransactionCardStatus, formattedAmount: string): string | null {
  switch (cardStatus) {
    case 'settled':
      return null; // No banner for settled
    case 'in_progress':
      return 'Your landlord will receive this payment shortly';
    case 'initiated':
      return 'Payment complete. Settlement will begin shortly';
    case 'retrying':
      return 'Attempting the transaction again';
    case 'refunded':
      return `${formattedAmount} returned to your account`;
    case 'failed':
      return 'If deducted, it will be refunded within 48 hours';
  }
}

// -----------------------------------------------
// Component
// -----------------------------------------------

function PaymentStatusCardComponent({
  transaction,
  landlordName,
  onViewReceipt,
  onNeedHelp,
  onTryAgain,
}: PaymentStatusCardProps) {
  const { cardStatus, title, date, amount } = transaction;

  const formattedAmount = `\u20B9 ${amount.toLocaleString('en-IN')}`;
  const StatusIcon = STATUS_ICON_MAP[cardStatus];
  const statusText = getStatusText(cardStatus, date);
  const bannerText = getBannerText(cardStatus, formattedAmount);

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`${title}, ${statusText}, ${formattedAmount}`}
    >
      {/* 1. Header Row */}
      <View style={styles.headerRow}>
        {/* Left side: Avatar + Title column */}
        <View style={styles.headerLeft}>
          <Avatar size="sm" name={landlordName || title} />
          <View style={styles.titleColumn}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.statusRow}>
              <StatusIcon />
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
          </View>
        </View>

        {/* Right side: Amount */}
        <Text style={styles.amount}>{formattedAmount}</Text>
      </View>

      {/* 2. Progress Bar */}
      <PaymentProgressBar cardStatus={cardStatus} />

      {/* 3. Info Banner (not shown for settled) */}
      {bannerText != null && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{bannerText}</Text>
        </View>
      )}

      {/* 4. Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.separator} />
        <View style={styles.actionRow}>
          {cardStatus === 'settled' && (
            <TouchableOpacity
              style={styles.actionButton}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              onPress={() => onViewReceipt?.(transaction)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View Receipt"
            >
              <Text style={styles.actionText}>View Receipt</Text>
            </TouchableOpacity>
          )}

          {cardStatus === 'failed' && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                onPress={() => onTryAgain?.(transaction)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Try Again"
              >
                <Text style={styles.actionText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                onPress={onNeedHelp}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Need help"
              >
                <View style={styles.helpRow}>
                  <HelpIcon />
                  <Text style={styles.actionText}>Need help?</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {cardStatus !== 'settled' && cardStatus !== 'failed' && (
            <TouchableOpacity
              style={styles.actionButton}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              onPress={onNeedHelp}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Need help"
            >
              <View style={styles.helpRow}>
                <HelpIcon />
                <Text style={styles.actionText}>Need help?</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// -----------------------------------------------
// Styles
// -----------------------------------------------

const styles = StyleSheet.create({
  // Card wrapper
  card: {
    backgroundColor: colors.black[500], // Figma: #202020
    borderRadius: 12,
    padding: 16,
    gap: 16,
    alignSelf: 'stretch',
  },

  // Header row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  titleColumn: {
    gap: 8,
    flex: 1,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 19.74,
    letterSpacing: -0.56,
    color: colors.white, // Figma: #FFFFFF
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: colors.neutral[600], // Figma: #878787
  },
  amount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 22.56,
    letterSpacing: -0.64,
    color: colors.white, // Figma: #FFFFFF
  },

  // Info banner
  banner: {
    backgroundColor: colors.black[600], // Figma: #1A1A1A
    borderRadius: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    color: colors.neutral[600], // Figma: #878787
    textAlign: 'center',
  },

  // Action bar
  actionBar: {
    gap: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.black[400], // Figma: #4D4D4D
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: colors.brand[500], // Figma: #FF9A6D
    textAlign: 'center',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

export const PaymentStatusCard = memo(PaymentStatusCardComponent);
