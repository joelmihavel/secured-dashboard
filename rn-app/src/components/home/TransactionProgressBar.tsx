/**
 * TransactionProgressBar Component
 * 3-step progress bar: Initiated -> Processing -> Settled
 * Figma Reference: 4123:2116
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/src/theme';
import { Text } from '@/src/components/ui';
import type { TransactionCardStatus } from '@/src/services/api/dashboard';

interface TransactionProgressBarProps {
  cardStatus: TransactionCardStatus;
}

const ACTIVE = colors.brand[500];
const INACTIVE = colors.black[400];
const FAILED_RED = colors.error.radix;
const SUCCESS_GREEN = colors.success.material;

interface StepConfig { dotColor: string; label: string; }
interface LineConfig { color: string; }

function getConfig(cardStatus: TransactionCardStatus): {
  steps: [StepConfig, StepConfig, StepConfig];
  lines: [LineConfig, LineConfig];
} {
  switch (cardStatus) {
    case 'settled':
      return {
        steps: [
          { dotColor: ACTIVE, label: 'Initiated' },
          { dotColor: ACTIVE, label: 'Processing' },
          { dotColor: ACTIVE, label: 'Settled' },
        ],
        lines: [{ color: ACTIVE }, { color: ACTIVE }],
      };
    case 'in_progress':
      return {
        steps: [
          { dotColor: ACTIVE, label: 'Initiated' },
          { dotColor: ACTIVE, label: 'Processing' },
          { dotColor: INACTIVE, label: 'Settled' },
        ],
        lines: [{ color: ACTIVE }, { color: INACTIVE }],
      };
    case 'initiated':
    case 'retrying':
      return {
        steps: [
          { dotColor: ACTIVE, label: 'Initiated' },
          { dotColor: INACTIVE, label: 'Processing' },
          { dotColor: INACTIVE, label: 'Settled' },
        ],
        lines: [{ color: INACTIVE }, { color: INACTIVE }],
      };
    case 'refunded':
      return {
        steps: [
          { dotColor: INACTIVE, label: 'Initiated' },
          { dotColor: INACTIVE, label: 'Processing' },
          { dotColor: INACTIVE, label: 'Settled' },
        ],
        lines: [{ color: INACTIVE }, { color: INACTIVE }],
      };
    case 'failed':
    case 'settlement_failed':
      return {
        steps: [
          { dotColor: SUCCESS_GREEN, label: 'Initiated' },
          { dotColor: FAILED_RED, label: 'Processing' },
          { dotColor: INACTIVE, label: 'Settled' },
        ],
        lines: [{ color: SUCCESS_GREEN }, { color: INACTIVE }],
      };
    default:
      return {
        steps: [
          { dotColor: INACTIVE, label: 'Initiated' },
          { dotColor: INACTIVE, label: 'Processing' },
          { dotColor: INACTIVE, label: 'Settled' },
        ],
        lines: [{ color: INACTIVE }, { color: INACTIVE }],
      };
  }
}

function TransactionProgressBarComponent({ cardStatus }: TransactionProgressBarProps) {
  const { steps, lines } = getConfig(cardStatus);

  return (
    <View style={styles.wrapper}>
      <View style={styles.trackRow}>
        <View style={[styles.dot, { backgroundColor: steps[0].dotColor }]} />
        <View style={[styles.line, { backgroundColor: lines[0].color }]} />
        <View style={[styles.dot, { backgroundColor: steps[1].dotColor }]} />
        <View style={[styles.line, { backgroundColor: lines[1].color }]} />
        <View style={[styles.dot, { backgroundColor: steps[2].dotColor }]} />
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.label, styles.labelLeft]}>{steps[0].label}</Text>
        <Text style={[styles.label, styles.labelCenter]}>{steps[1].label}</Text>
        <Text style={[styles.label, styles.labelRight]}>{steps[2].label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    gap: 8,
    paddingTop: 16,
    paddingHorizontal: 8,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 4,
  },
  line: {
    flex: 1,
    height: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: colors.neutral[600],
  },
  labelLeft: { textAlign: 'left' },
  labelCenter: { textAlign: 'center' },
  labelRight: { textAlign: 'right' },
});

export const TransactionProgressBar = memo(TransactionProgressBarComponent);
export type { TransactionProgressBarProps };
