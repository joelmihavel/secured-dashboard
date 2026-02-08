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
import { colors, spacing, radius, typography } from '@/src/theme';

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
    backgroundColor: colors.black[600],
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.white,
    fontFamily: typography.bodyMd2Medium.fontFamily,
  },
  description: {
    fontSize: 14,
    color: colors.neutral[400],
    fontFamily: typography.bodyMd2.fontFamily,
    lineHeight: 20,
  },
  actionLink: {
    fontSize: 14,
    color: colors.brand[500],
    fontFamily: typography.bodyMd2.fontFamily,
    marginTop: spacing.xxs,
  },
});

export const LandlordStatusCard = memo(LandlordStatusCardComponent);
