/**
 * CashbackInviteStatus Component
 * Single row with 3 states based on landlord invite progress.
 *
 * - Pre-invite: "What does my landlord get?" + "Learn more" → URL
 * - Invite sent: "Nudge your landlord for approval" + "Send invite" → WhatsApp
 * - Not approved: "Landlord hasn't approved your tenancy" + "Need help?" → email
 * - Card: 329x49, #202020 bg, r=12, pad=16
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';

import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

export type LandlordInviteState = 'pre_invite' | 'invited' | 'not_approved';

export interface CashbackInviteStatusProps {
  state: LandlordInviteState;
}

const WHATSAPP_MESSAGE = `Hi! I'm setting up my rent payments on Secured. It rewards tenants for paying rent on time and gives landlords free protection against vacancy and sudden tenant exits. It's completely free and built by Flent, a trusted rental platform.

A small request: could you please sign in with your mobile number and confirm my tenancy here: https://flent.in/secured/invite-landlord`;

function CashbackInviteStatusComponent({ state }: CashbackInviteStatusProps) {
  const handlePress = () => {
    switch (state) {
      case 'pre_invite':
        Linking.openURL('https://flent.in/secured/how-it-works').catch((e) => {
          console.warn('Failed to open URL:', e);
        });
        break;
      case 'invited':
        Linking.openURL(
          `https://wa.me/?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
        ).catch(() => {
          // Fallback: copy-able alert if WhatsApp not installed
          Alert.alert('Send this to your landlord', WHATSAPP_MESSAGE);
        });
        break;
      case 'not_approved':
        Linking.openURL('mailto:secured@flent.in').catch(() => {
          Alert.alert('Contact Support', 'Email us at secured@flent.in');
        });
        break;
    }
  };

  const config = STATE_CONFIG[state];

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={[styles.statusText, { color: config.color }]}>
          {config.label}
        </Text>
        <TouchableOpacity
          onPress={handlePress}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionText, { color: config.color }]}>
            {config.action}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const STATE_CONFIG: Record<LandlordInviteState, { label: string; action: string; color: string }> = {
  pre_invite: {
    label: 'What does my landlord get?',
    action: 'Learn more',
    color: colors.brand[500], // #FF9A6D
  },
  invited: {
    label: 'Nudge your landlord for approval',
    action: 'Send invite',
    color: colors.brand[500], // #FF9A6D
  },
  not_approved: {
    // Figma 4651:142257 — rejected variant of the invite row
    label: 'Landlord rejected invite link',
    action: 'Need help?',
    color: colors.error.radix, // #E5484D
  },
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black[600], // #1A1A1A — consistent with pill UI
    borderRadius: 200, // Pill shape
    paddingVertical: 8,
    paddingHorizontal: 16,
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
