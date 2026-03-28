/**
 * TransactionProgressBar Component
 * 3-step progress bar (Initiated -> Processing -> Settled) for transaction cards
 * Figma Reference: 4109:67659
 *
 * Figma Pixel-Perfect Values:
 * - Container: horizontal, gap 4px between step cells
 * - Step cell: background #1A1A1A, borderRadius 12, padding top=16 left=8 right=8 bottom=0
 * - Initiated cell has 2 decorative lines (Vector 61: 133.5px, Vector 62: 133px) that overflow
 * - Dot: 11x11, borderRadius 4 (rounded square)
 * - Active dot: #FF9A6D, Inactive dot: #4D4D4D, Failed dot: #E5484D
 * - Label: PlusJakartaSans-Regular, fontSize 12, lineHeight 16.92, letterSpacing -0.24, color #878787
 * - Shadow: 3-layer (rgba(0,0,0,0.10) y:9 blur:19, rgba(0,0,0,0.09) y:35 blur:35, rgba(0,0,0,0.05) y:78 blur:47)
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/src/theme';

import { Text } from '@/src/components/ui';
import type { TransactionCardStatus } from '@/src/services/api/dashboard';

interface TransactionProgressBarProps {
  cardStatus: TransactionCardStatus;
}

// Step alignment configuration
const STEP_ALIGN = ['flex-start', 'center', 'flex-end'] as const;
const STEP_TEXT_ALIGN = ['left', 'center', 'right'] as const;

// Color constants — using theme tokens
const ACTIVE = colors.brand[500]; // #FF9A6D
const INACTIVE = colors.black[400]; // #4D4D4D
const FAILED_RED = colors.error.radix; // #E5484D
const SUCCESS_GREEN = colors.success.material; // #4CAF50

/** Derive dot colors, labels, and line colors for each step based on card status */
function getStepConfig(cardStatus: TransactionCardStatus): Array<{
  color: string;
  label: string;
  line1?: string; // Vector 61 stroke color (only on Initiated cell)
  line2?: string; // Vector 62 stroke color (only on Initiated cell)
}> {
  switch (cardStatus) {
    case 'settled':
      return [
        { color: ACTIVE, label: 'Initiated', line1: ACTIVE, line2: ACTIVE },
        { color: ACTIVE, label: 'Processing' },
        { color: ACTIVE, label: 'Settled' },
      ];
    case 'in_progress':
      return [
        { color: ACTIVE, label: 'Initiated', line1: ACTIVE, line2: INACTIVE },
        { color: ACTIVE, label: 'Processing' },
        { color: INACTIVE, label: 'Settled' },
      ];
    case 'initiated':
    case 'retrying':
      return [
        { color: ACTIVE, label: 'Initiated', line1: INACTIVE, line2: INACTIVE },
        { color: INACTIVE, label: 'Processing' },
        { color: INACTIVE, label: 'Settled' },
      ];
    case 'refunded':
      return [
        { color: INACTIVE, label: 'Initiated', line1: INACTIVE, line2: INACTIVE },
        { color: INACTIVE, label: 'Processing' },
        { color: INACTIVE, label: 'Settled' },
      ];
    case 'failed':
      return [
        { color: SUCCESS_GREEN, label: 'Initiated', line1: SUCCESS_GREEN, line2: INACTIVE },
        { color: FAILED_RED, label: 'Processing' },
        { color: INACTIVE, label: 'Settled' },
      ];
    default:
      return [
        { color: INACTIVE, label: 'Initiated', line1: INACTIVE, line2: INACTIVE },
        { color: INACTIVE, label: 'Processing' },
        { color: INACTIVE, label: 'Settled' },
      ];
  }
}

function TransactionProgressBarComponent({ cardStatus }: TransactionProgressBarProps) {
  const steps = getStepConfig(cardStatus);
  const completedCount = steps.filter(s => s.color === ACTIVE).length;

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={`Payment progress: ${completedCount} of 3 steps complete`}
    >
      {steps.map((step, index) => (
        <View
          key={index}
          style={[
            styles.cell,
            { alignItems: STEP_ALIGN[index] },
            // Initiated cell needs overflow visible for the decorative lines
            index === 0 && styles.cellOverflow,
          ]}
        >
          {/* Decorative progress lines — only in Initiated cell (index 0) */}
          {/* Figma: Vector 61 (133.5px) + Vector 62 (133px), 1px stroke, overflow the 97px cell */}
          {index === 0 && step.line1 && (
            <View style={styles.linesContainer}>
              <View style={[styles.progressLine, styles.line1, { backgroundColor: step.line1 }]} />
              <View style={[styles.progressLine, styles.line2, { backgroundColor: step.line2 }]} />
            </View>
          )}

          {/* Dot — Figma: Rectangle 54, 11x11, r=4 */}
          <View
            style={[
              styles.dot,
              { backgroundColor: step.color },
            ]}
          />

          {/* Label — Figma: 12px/400, lh=16.92, ls=-0.24, #878787 */}
          <Text
            style={[
              styles.label,
              { textAlign: STEP_TEXT_ALIGN[index] },
            ]}
          >
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 4, // Figma: 4px gap between step cells
  },
  cell: {
    flex: 1,
    backgroundColor: colors.black[600], // Figma: #1A1A1A
    borderRadius: 12, // Figma: cornerRadius 12
    paddingTop: 16, // Figma: padding top 16
    paddingLeft: 8, // Figma: padding left 8
    paddingRight: 8, // Figma: padding right 8
    paddingBottom: 0, // Figma: padding bottom 0
    gap: 8, // Figma: 8px gap between dot and label
    overflow: 'hidden', // Default: clip content
    // Shadow: Figma specifies 3 layers but RN supports only 1 shadow per View.
    // Using the most prominent layer. Layers 2 (y:35 blur:35) and 3 (y:78 blur:47)
    // are extremely subtle on dark backgrounds and omitted intentionally.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.1,
    shadowRadius: 19,
    elevation: 4,
  },
  cellOverflow: {
    overflow: 'visible', // Initiated cell: lines overflow to the right
  },
  // Lines container — absolutely positioned at top of Initiated cell
  linesContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: -140, // Extend past the cell boundary (lines are 133.5px in a 81px content area)
    gap: 4, // Small gap between the two lines
  },
  progressLine: {
    height: 1, // Figma: strokeWeight 1
  },
  line1: {
    width: 133.5, // Figma: Vector 61 width
  },
  line2: {
    width: 133, // Figma: Vector 62 width
  },
  dot: {
    width: 11, // Figma: 11x11
    height: 11,
    borderRadius: 4, // Figma: rounded square
  },
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, // Figma: fontSize 12
    lineHeight: 16.92, // Figma: lineHeight 16.92
    letterSpacing: -0.24, // Figma: letterSpacing -0.24
    color: colors.neutral[600], // Figma: #878787
  },
});

export const TransactionProgressBar = memo(TransactionProgressBarComponent);
export type { TransactionProgressBarProps };
