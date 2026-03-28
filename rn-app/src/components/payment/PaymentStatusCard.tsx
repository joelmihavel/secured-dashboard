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
import { View, StyleSheet, TouchableOpacity, type TextStyle } from 'react-native';
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

function HourglassIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M4 2H12M4 14H12M5 2V5.2C5 5.48 5.14 5.74 5.37 5.9L8 8L5.37 10.1C5.14 10.26 5 10.52 5 10.8V14M11 2V5.2C11 5.48 10.86 5.74 10.63 5.9L8 8L10.63 10.1C10.86 10.26 11 10.52 11 10.8V14"
        stroke="#FFB020"
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



// -----------------------------------------------
// Status Config
// -----------------------------------------------

const STATUS_ICON_MAP: Record<TransactionCardStatus, React.FC> = {
  settled: CheckmarkIcon,
  in_progress: HourglassIcon,
  initiated: HourglassIcon,
  retrying: HourglassIcon,
  refunded: InfoCircleIcon,
  failed: XCircleIcon,
  settlement_failed: XCircleIcon,
};

const SHOW_PROGRESS_BAR: Record<TransactionCardStatus, boolean> = {
  settled: true,
  in_progress: true,
  initiated: true,
  retrying: true,
  refunded: false,
  failed: true,
  settlement_failed: true,
};

const SHOW_ACTION_BAR: Record<TransactionCardStatus, boolean> = {
  settled: true,
  in_progress: true,
  initiated: true,
  retrying: false,
  refunded: false,
  failed: true,
  settlement_failed: true,
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
    case 'settlement_failed':
      return `Settlement failed \u00B7 ${date}`;
  }
  return '';
}

function getBannerText(cardStatus: TransactionCardStatus, formattedAmount: string): string | null {
  switch (cardStatus) {
    case 'settled':
      return null;
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
    case 'settlement_failed':
      return 'Settlement to landlord failed. We\u2019re looking into it';
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

  const amountStr = amount.toLocaleString('en-IN');
  const formattedAmount = `\u20B9 ${amountStr}`;
  const StatusIcon = STATUS_ICON_MAP[cardStatus];
  const statusText = getStatusText(cardStatus, date);
  const bannerText = getBannerText(cardStatus, formattedAmount);
  const showProgressBar = SHOW_PROGRESS_BAR[cardStatus];
  const showActionBar = SHOW_ACTION_BAR[cardStatus];

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

        {/* Right side: Amount — Figma: ₹ in 12px, number in 16px */}
        <Text style={styles.amountWrap}>
          <Text style={styles.amountSymbol}>{'\u20B9  '}</Text>
          <Text style={styles.amountValue}>{amountStr}</Text>
        </Text>
      </View>

      {/* 2. Progress Bar — hidden for refunded */}
      {showProgressBar && <PaymentProgressBar cardStatus={cardStatus} />}

      {/* 3. Info Banner (not shown for settled) */}
      {bannerText != null && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{bannerText}</Text>
        </View>
      )}

      {/* 4. Action Bar — hidden for retrying and refunded */}
      {showActionBar && (
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

            {(cardStatus === 'failed' || cardStatus === 'settlement_failed') && (
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
                  <Text style={styles.actionText}>Need help?</Text>
                </TouchableOpacity>
              </>
            )}

            {cardStatus === 'in_progress' || cardStatus === 'initiated' ? (
              <TouchableOpacity
                style={styles.actionButton}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                onPress={onNeedHelp}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Need help"
              >
                <Text style={styles.actionText}>Need help?</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}
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
  amountWrap: {
    flexShrink: 0,
  },
  amountSymbol: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.64,
    color: colors.white,
  },
  amountValue: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 22.56,
    letterSpacing: -0.64,
    color: colors.white,
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
    textDecorationLine: 'underline',
  } as TextStyle,
});

export const PaymentStatusCard = memo(PaymentStatusCardComponent);
