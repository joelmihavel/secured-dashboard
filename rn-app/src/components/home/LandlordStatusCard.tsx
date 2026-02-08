/**
 * LandlordStatusCard Component
 * Shows landlord invitation status with appropriate messaging
 * Figma References:
 * - 243-4258: Invitation sent
 * - 243-4462: Waiting for response (<24hrs)
 * - 243-4666: Still pending (>24hrs)
 * - 243-4870: Invite pending/failed
 * - 243-5074: Declined
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '@/src/components/ui';

export type LandlordStatus =
  | 'invitation_sent'
  | 'waiting_response_recent' // <24hrs
  | 'waiting_response_old' // >24hrs
  | 'invite_pending'
  | 'declined';

export interface LandlordStatusCardProps {
  status: LandlordStatus;
  onSendReminder?: () => void;
  onContactSupport?: () => void;
}

function LandlordStatusCardComponent({
  status,
  onSendReminder,
  onContactSupport,
}: LandlordStatusCardProps) {
  const getContent = () => {
    switch (status) {
      case 'invitation_sent':
        return {
          title: 'Landlord invitation sent',
          description:
            "We've notified your landlord. You'll be able to unlock rewards once they review the request.",
          actionLabel: null,
          actionHandler: null,
        };
      case 'waiting_response_recent':
        return {
          title: "Waiting for your landlord's response",
          description:
            'Most landlords respond after a quick reminder. You can nudge them again.',
          actionLabel: 'Send Reminder',
          actionHandler: onSendReminder,
        };
      case 'waiting_response_old':
        return {
          title: 'Still pending with your landlord',
          description:
            "If they haven't seen the invite yet, a personal message often helps.",
          actionLabel: 'Send Reminder',
          actionHandler: onSendReminder,
        };
      case 'invite_pending':
        return {
          title: 'Invite pending',
          description:
            'You can still pay rent. Rewards unlock when your landlord joins.',
          actionLabel: 'Contact Support',
          actionHandler: onContactSupport,
        };
      case 'declined':
        return {
          title: 'Your landlord declined the invite',
          description:
            'Some landlords prefer to understand before joining. You can continue paying rent.',
          actionLabel: 'Contact Support',
          actionHandler: onContactSupport,
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.description}>{content.description}</Text>
      {content.actionLabel && content.actionHandler && (
        <TouchableOpacity onPress={content.actionHandler}>
          <Text style={styles.actionLink}>{content.actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A', // Figma: #1A1A1A (black[600])
    borderRadius: 12, // Figma: borderRadius 12
    padding: 24, // Figma: padding 24
    gap: 8, // Figma: gap 8
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14, // Figma: fontSize 14
    fontWeight: '500', // Figma: fontWeight 500
    lineHeight: 20, // Figma: lineHeight 20
    color: '#FFFFFF', // Figma: #FFFFFF (white)
  },
  description: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, // Figma: fontSize 14
    fontWeight: '400', // Figma: fontWeight 400
    lineHeight: 20, // Figma: lineHeight 20
    color: '#BABABA', // Figma: #BABABA (neutral[400])
  },
  actionLink: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, // Figma: fontSize 14
    fontWeight: '400', // Figma: fontWeight 400
    lineHeight: 20, // Figma: lineHeight 20
    color: '#FF9A6D', // Figma: #FF9A6D (brand[500])
    marginTop: 4, // Figma: small gap
  },
});

export const LandlordStatusCard = memo(LandlordStatusCardComponent);
