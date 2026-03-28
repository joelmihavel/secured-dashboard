/**
 * CashbackSetupSteps Component
 * Setup steps with two layout variants: horizontal cards (pending) or vertical list (active).
 * Figma Reference: 4109:66469 (horizontal), 4109:67067 (vertical)
 *
 * Horizontal (State 1/2): 3 cards, 107px each, gap=4, icon + text
 *   - Completed: opacity=0.48, strikethrough, #FF9A6D
 *   - Pending: opacity=1.0, #878787
 * Vertical (State 3): 3 rows 329x49, gap=4, checkbox + text + arrow
 *   - Checkbox: 11x11, r=4, filled=#FF9A6D (done), #202020 (pending)
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
  /** 'horizontal' for setup pending states, 'vertical' for active/verified */
  layout: 'horizontal' | 'vertical';
  onStepPress?: (step: SetupStep) => void;
}

// Figma visual states for horizontal cards (4111:71008):
// completed = filled checkmark #FF9A6D, text strikethrough, opacity 0.48
// active/in_progress/not_started = circle outline (pending), text #878787
// Icon color: completed & active/in_progress = #FF9A6D, not_started = #4D4D4D
function StepIcon({ status }: { status: SetupStepStatus }) {
  switch (status) {
    case 'completed':
      return (
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Path
            d="M14.65 8C14.65 11.672 11.672 14.65 8 14.65C4.328 14.65 1.35 11.672 1.35 8C1.35 4.328 4.328 1.35 8 1.35C11.672 1.35 14.65 4.328 14.65 8Z"
            fill={colors.brand[500]}
          />
          <Path d="M11 5.5L7 10L5 8" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'active':
    case 'in_progress':
      // Figma: empty circle outline, stroke #FF9A6D, weight 1
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
            stroke={colors.black[400]}
            strokeWidth={1}
          />
        </Svg>
      );
  }
}

// Text color per status — Figma: completed=#FF9A6D, all pending states=#878787
const TEXT_COLOR: Record<SetupStepStatus, string> = {
  completed: colors.brand[500],   // Figma: #FF9A6D
  active: colors.neutral[600],    // Figma: #878787 (pending)
  in_progress: colors.neutral[600], // Figma: #878787 (pending)
  not_started: colors.neutral[600], // Figma: #878787 (inactive)
};

function CashbackSetupStepsComponent({ steps, layout, onStepPress }: CashbackSetupStepsProps) {
  if (layout === 'horizontal') {
    return (
      <View style={styles.horizontalContainer}>
        {steps.map((step) => {
          const isCompleted = step.status === 'completed';
          return (
            <TouchableOpacity
              key={step.id}
              style={[styles.horizontalCard, isCompleted && styles.completedCard]}
              onPress={() => !isCompleted && onStepPress?.(step)}
              activeOpacity={isCompleted ? 1 : 0.7}
              disabled={isCompleted}
            >
              <StepIcon status={step.status} />
              <Text
                style={[
                  styles.horizontalText,
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

  // Vertical layout (active/verified state)
  return (
    <View style={styles.verticalContainer}>
      {steps.map((step) => {
        const isCompleted = step.status === 'completed';
        return (
          <TouchableOpacity
            key={step.id}
            style={[styles.verticalRow, isCompleted && styles.completedCard]}
            onPress={() => !isCompleted && onStepPress?.(step)}
            activeOpacity={isCompleted ? 1 : 0.7}
            disabled={isCompleted}
          >
            {/* Checkbox — Figma: filled #FF9A6D (completed), outline #FF9A6D (pending) */}
            <View
              style={[
                styles.checkbox,
                isCompleted ? styles.checkboxFilled : styles.checkboxEmpty,
              ]}
            >
              {isCompleted && (
                <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
                  <Path
                    d="M8.5 2.5L4 7.5L1.5 5"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </View>

            {/* Label */}
            <Text
              style={[
                styles.verticalText,
                { color: TEXT_COLOR[step.status] },
                isCompleted && styles.completedTextDecoration,
              ]}
              numberOfLines={1}
            >
              {step.label}
            </Text>

            {/* Arrow for actionable items */}
            {!isCompleted && (
              <Svg width={12} height={12} viewBox="0 0 12 12" fill="none" style={styles.chevron}>
                <Path d="M4.5 2.5L8 6L4.5 9.5" stroke={TEXT_COLOR[step.status]} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Horizontal layout (State 1/2)
  horizontalContainer: {
    flexDirection: 'row',
    gap: 4, // Figma: 4px between cards
  },
  horizontalCard: {
    flex: 1,
    minHeight: 115, // Figma: 107x115 card height
    backgroundColor: colors.black[500], // Figma: #202020
    borderRadius: 12, // Figma: 12px
    padding: 16, // Figma: 16px all sides
    gap: 16, // Figma: 16px between icon and text
  },
  horizontalText: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: 12px
    lineHeight: 16.92, // Figma: 16.92
    letterSpacing: -0.24, // Figma: -0.24
    textAlign: 'left', // Figma: LEFT aligned
  },

  // Vertical layout (State 3)
  verticalContainer: {
    gap: 4, // Figma: 4px between rows
  },
  verticalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.black[500], // Figma: #202020
    borderRadius: 12, // Figma: 12px
    padding: 16, // Figma: 16px all sides
    gap: 16, // Figma: 16px between checkbox and text
  },
  verticalText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    flex: 1,
  },

  // Checkbox (vertical layout)
  checkbox: {
    width: 16, // Enough to contain the 10px check SVG
    height: 16,
    borderRadius: 4, // Figma: cornerRadius 4
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFilled: {
    backgroundColor: colors.brand[500], // Figma: #FF9A6D completed
  },
  checkboxEmpty: {
    backgroundColor: colors.black[500], // Figma: #202020
    borderWidth: 1,
    borderColor: colors.brand[500], // Figma: #FF9A6D (pending outline)
  },

  // States
  completedCard: {
    opacity: 0.48, // Figma: dimmed for completed
  },
  completedTextDecoration: {
    textDecorationLine: 'line-through', // Figma: STRIKETHROUGH on completed
  },
  // SVG chevron arrow
  chevron: {
    marginLeft: 'auto',
  },
});

export const CashbackSetupSteps = memo(CashbackSetupStepsComponent);
