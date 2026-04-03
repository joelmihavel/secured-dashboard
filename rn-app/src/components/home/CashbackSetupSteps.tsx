/**
 * CashbackSetupSteps Component
 * Horizontal setup step cards for the "COMPLETE SETUP TO ACCESS YOUR CASHBACK" section.
 * Figma Reference: 4111:71008
 *
 * 3 cards, flex=1 each, gap=4, icon + text
 * - Completed: opacity=0.48, strikethrough, #FF9A6D
 * - Pending: opacity=1.0, #878787
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '@/src/theme';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/src/components/ui';

import type { SetupStep, SetupStepStatus } from '@/src/services/api/dashboard';
export type { SetupStep, SetupStepStatus };

export interface CashbackSetupStepsProps {
  steps: SetupStep[];
  onStepPress?: (step: SetupStep) => void;
}

// Figma visual states (4111:71008):
// completed = filled checkmark #FF9A6D with #131313 tick, text strikethrough, opacity 0.48
// active/in_progress = circle outline #FF9A6D, text #878787
// not_started = circle outline #4D4D4D, text #878787
function StepIcon({ status }: { status: SetupStepStatus }) {
  switch (status) {
    case 'completed':
      return (
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Path
            d="M14.65 8C14.65 11.672 11.672 14.65 8 14.65C4.328 14.65 1.35 11.672 1.35 8C1.35 4.328 4.328 1.35 8 1.35C11.672 1.35 14.65 4.328 14.65 8Z"
            fill={colors.brand[500]}
          />
          <Path d="M11 5.5L7 10L5 8" stroke="#131313" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'active':
    case 'in_progress':
      return (
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Path
            d="M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C11.314 2 14 4.686 14 8Z"
            stroke={colors.brand[500]}
            strokeWidth={1}
          />
        </Svg>
      );
    case 'not_started':
    default:
      return (
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Path
            d="M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C11.314 2 14 4.686 14 8Z"
            stroke={colors.brand[500]}
            strokeWidth={1}
          />
        </Svg>
      );
  }
}

// Text color per status
const TEXT_COLOR: Record<SetupStepStatus, string> = {
  completed: colors.brand[500],     // #FF9A6D
  active: colors.neutral[600],      // #878787
  in_progress: colors.neutral[600], // #878787
  not_started: colors.neutral[600], // #878787
};

function CashbackSetupStepsComponent({ steps, onStepPress }: CashbackSetupStepsProps) {
  return (
    <View style={styles.container}>
      {steps.map((step) => {
        const isCompleted = step.status === 'completed';
        return (
          <TouchableOpacity
            key={step.id}
            style={[styles.card, isCompleted && styles.completedCard]}
            onPress={() => !isCompleted && onStepPress?.(step)}
            activeOpacity={isCompleted ? 1 : 0.7}
            disabled={isCompleted}
          >
            <StepIcon status={step.status} />
            <Text
              style={[
                styles.labelText,
                { color: TEXT_COLOR[step.status] },
                isCompleted && styles.completedTextDecoration,
              ]}
            >
              {step.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
  },
  card: {
    flex: 1,
    minHeight: 115,
    backgroundColor: colors.black[500], // #202020
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  labelText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    textAlign: 'left',
  },
  completedCard: {
    opacity: 0.48,
  },
  completedTextDecoration: {
    textDecorationLine: 'line-through',
  },
});

export const CashbackSetupSteps = memo(CashbackSetupStepsComponent);
