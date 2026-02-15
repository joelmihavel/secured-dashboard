/**
 * RecentPaymentsList Component
 * List of recent payment transactions with status indicators - Figma pixel-perfect
 * Figma Reference: 243-2762, 243-2967, 243-7185
 *
 * Figma Pixel-Perfect Values:
 * - Container padding: horizontal 32px
 * - Row height: ~64px with padding
 * - Avatar (ellipse_8): width 32, height 32, backgroundColor #FFCC8A (brand[300])
 * - Title: fontSize 14, fontWeight 500, lineHeight ~19.74, letterSpacing -0.56, color #FFFFFF
 * - Status + Date row:
 *   - Status dot (Vector): width 10, height 10, colors: #4CAF50 (paid), #FFB020 (pending), #E5484D (failed)
 *   - Status text: fontSize 12, lineHeight ~16.92, letterSpacing -0.24, color #878787
 * - Amount: fontSize 12/16, fontWeight 600, lineHeight ~16.92, letterSpacing -0.48, color #EEEEEE
 * - Divider: width 329, borderColor #4D4D4D, borderWidth 1
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '@/src/components/ui';

export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'processing';

export interface RecentPayment {
  id: string;
  title: string; // e.g., "September rent"
  status: PaymentStatus;
  date: string; // e.g., "15 Sep, 9:40am"
  amount: number;
}

export interface RecentPaymentsListProps {
  payments: RecentPayment[];
  onPaymentPress?: (payment: RecentPayment) => void;
}

// Figma exact colors for status indicators
const statusConfig: Record<PaymentStatus, { color: string; label: string }> = {
  paid: { color: '#4CAF50', label: 'Paid' }, // Figma: success.material
  pending: { color: '#FFB020', label: 'Pending' }, // Figma: warning.amber
  failed: { color: '#E5484D', label: 'Failed' }, // Figma: error.radix
  processing: { color: '#FFB020', label: 'Processing' },
};

function RecentPaymentsListComponent({ payments, onPaymentPress }: RecentPaymentsListProps) {
  if (payments.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {payments.map((payment, index) => (
        <View key={payment.id}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => onPaymentPress?.(payment)}
            activeOpacity={0.7}
          >
            {/* Avatar placeholder - Figma: ellipse_8 */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {payment.title.charAt(0).toUpperCase()}
              </Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.title}>{payment.title}</Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: statusConfig[payment.status].color },
                  ]}
                />
                <Text style={styles.statusText}>
                  {statusConfig[payment.status].label} {'\u00B7'} {payment.date}
                </Text>
              </View>
            </View>

            {/* Amount - Figma format: single Text with nested spans for inline display */}
            <Text style={styles.amountBase}>
              <Text inherit style={styles.rupeeSymbol}>{'₹ '}</Text>
              <Text inherit style={styles.amount}>{payment.amount.toLocaleString('en-IN')}</Text>
            </Text>
          </TouchableOpacity>

          {/* Divider line between rows */}
          {index < payments.length - 1 && <View style={styles.divider} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32, // Figma: 32px exact
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16, // Figma: ~16px padding
  },
  rowLast: {
    // No bottom border on last item
  },
  divider: {
    height: 0.25, // Figma 243:2931: very thin divider
    backgroundColor: '#4D4D4D', // Figma: #4D4D4D (black[400])
    marginLeft: 48, // Offset to align with content (32 avatar + 16 gap)
  },
  // Avatar - Figma: ellipse_8
  avatar: {
    width: 32, // Figma: 32px
    height: 32, // Figma: 32px
    borderRadius: 16, // Figma: fully rounded
    backgroundColor: '#FFCC8A', // Figma: #FFCC8A (brand[300])
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16, // Figma 243:2922: gap 16 between avatar and content
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF', // Figma: #FFFFFF
  },
  // Content
  content: {
    flex: 1,
    gap: 8, // Figma 243:2924: gap 8 between title and status row
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14, // Figma: fontSize 14
    fontWeight: '500', // Figma: fontWeight 500
    lineHeight: 19.74, // Figma: lineHeight ~19.74
    letterSpacing: -0.56, // Figma: letterSpacing -0.56
    color: '#FFFFFF', // Figma: #FFFFFF
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12, // Figma 243:2927: 12x12 status icon
    height: 12, // Figma 243:2927: 12x12 status icon
    borderRadius: 6, // Figma: fully rounded
    marginRight: 4, // Figma 243:2926: gap 4
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, // Figma: fontSize 12
    lineHeight: 16.92, // Figma: lineHeight ~16.92
    letterSpacing: -0.24, // Figma: letterSpacing -0.24
    color: '#878787', // Figma: #878787 (neutral[600])
  },
  separator: {
    fontSize: 12,
    color: '#878787', // Figma: #878787
  },
  dateText: {
    fontSize: 12, // Figma: fontSize 12
    lineHeight: 16.92, // Figma: lineHeight ~16.92
    letterSpacing: -0.24, // Figma: letterSpacing -0.24
    color: '#878787', // Figma: #878787 (neutral[600])
  },
  // Amount - Figma: single Text with nested spans for mixed font sizes
  amountBase: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontWeight: '600', // Figma: fontWeight 600
    letterSpacing: -0.64, // Figma 243:2930: letterSpacing -0.64
    color: '#FFFFFF', // Figma 243:2930: white
  },
  rupeeSymbol: {
    fontSize: 12, // Figma: fontSize 12 (style override for Rs symbol)
  },
  amount: {
    fontSize: 16, // Figma: fontSize 16 (numeric portion)
    lineHeight: 16.92, // Figma: lineHeight ~16.92
  },
});

export const RecentPaymentsList = memo(RecentPaymentsListComponent);
