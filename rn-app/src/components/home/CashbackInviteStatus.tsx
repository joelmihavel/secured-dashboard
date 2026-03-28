/**
 * CashbackInviteStatus Component
 * Invite status bar with sent/rejected states.
 * Figma Reference: 4109:66469 (sent), 4109:66768 (rejected)
 *
 * - Sent: "Invite Sent" + "Copy Invite Link" (both #FF9A6D)
 * - Rejected: "Landlord rejected invite link" + "Need help?" (both #E5484D)
 * - Card: 329x49, #202020 bg, r=12, pad=16
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

import type { InviteState } from '@/src/services/api/dashboard';
export type { InviteState };

export interface CashbackInviteStatusProps {
  state: InviteState;
  onCopyInviteLink?: () => void;
  onNeedHelp?: () => void;
}

function CashbackInviteStatusComponent({
  state,
  onCopyInviteLink,
  onNeedHelp,
}: CashbackInviteStatusProps) {
  const isSent = state === 'sent';
  const color = isSent ? colors.brand[500] : colors.error.radix;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={[styles.statusText, { color }]}>
          {isSent ? 'Invite Sent' : 'Landlord rejected invite link'}
        </Text>
        <TouchableOpacity
          onPress={isSent ? onCopyInviteLink : onNeedHelp}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionText, { color }]}>
            {isSent ? 'Copy Invite Link' : 'Need help?'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black[500], // Figma: #202020
    borderRadius: 12, // Figma: 12px
    padding: 16, // Figma: 16px all sides
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // Figma: 16px gap
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: 12px
    lineHeight: 16.92, // Figma: 16.92
    letterSpacing: -0.24, // Figma: -0.24
    flex: 1, // Figma: FILL
  },
  actionText: {
    fontFamily: 'PlusJakartaSans-SemiBold', // Figma: fontWeight 600
    fontSize: 12, // Figma: 12px
    lineHeight: 16.92, // Figma: 16.92
    letterSpacing: -0.24, // Figma: -0.24
    textDecorationLine: 'underline', // Figma: UNDERLINE on action links
  },
});

export const CashbackInviteStatus = memo(CashbackInviteStatusComponent);
