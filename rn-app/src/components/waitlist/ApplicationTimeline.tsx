/**
 * Application Timeline Component - Pixel Perfect Figma Implementation
 *
 * Source: figma-parity/data/ai-enhanced/41-11206/enhanced-extraction.json
 *
 * Figma Node References:
 * - 41:11220: Frame 2095586388 (timeline card) - 313x228, #202020, borderRadius 12
 * - 41:11221: Frame 2095586385 (timeline row) - 281x44, gap 8
 * - 41:11222: Frame 2095586386 (indicator container) - 20x20
 * - 41:11223: Ellipse 21906 (indicator dot) - 12x12, centered
 * - 41:11224: Vector 59 (connector line) - height 47
 * - 41:11225: Frame 1686557332 (text container) - 253x44, gap 4
 * - 41:11226: "Application Sent" label - fontSize 12, #878787
 * - 41:11227: "Submitted on 27 Jan 2026" value - fontSize 14, #CBCBCB
 */

import React, { memo } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { Dimensions } from 'react-native';
import { colors } from '@/src/theme/colors';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ratioX = SCREEN_WIDTH / 393;
const sv = (val: number) => val * ratioX;

// ============================================
// FIGMA EXTRACTED CONSTANTS
// All values from enhanced-extraction.json
// ============================================

const FIGMA = {
  // Timeline card container (node 41:11220)
  card: {
    width: 313,
    borderRadius: 12,
    paddingTop: 24,
    paddingBottom: sv(24),
    paddingLeft: 16,
    paddingRight: 16,
    gap: 24,
  },

  // Timeline row (node 41:11221)
  row: {
    width: sv(281),
    height: sv(44),
    gap: sv(8),
  },

  // Indicator container (node 41:11222)
  indicatorContainer: {
    width: sv(20),
    height: sv(20),
  },

  // Indicator dot (node 41:11223)
  indicator: {
    size: sv(12),
  },

  // Connector line (node 41:11224)
  connector: {
    height: 47,
    width: 1,
  },

  // Text container (node 41:11225)
  textContainer: {
    width: sv(253),
    gap: sv(4),
  },

  colors: {
    cardBackground: colors.black[500],
    indicatorComplete: colors.brand[500],
    indicatorPending: colors.black[600],
    indicatorActive: colors.brand[500],
    indicatorSuccess: colors.success.default,
    indicatorError: colors.error.radix,
    connectorComplete: colors.brand[400],
    connectorPending: colors.black[200],
    textLabel: colors.neutral[600],
    textValue: colors.neutral[300],
    textSuccess: colors.success.default,
    textError: colors.error.radix,
  },

  typography: {
    label: {
      fontSize: sv(12),
      lineHeight: sv(20),
      fontFamily: 'PlusJakartaSans-Regular',
    },
    value: {
      fontSize: sv(14),
      lineHeight: sv(20),
      fontFamily: 'PlusJakartaSans-Regular',
    },
  },
} as const;

// ============================================
// TYPES
// ============================================

export type TimelineStatus = 'complete' | 'active' | 'pending' | 'accepted' | 'rejected';

export interface TimelineItemData {
  label: string;
  value: string;
  status: TimelineStatus;
}

export interface ApplicationTimelineProps {
  items: TimelineItemData[];
  testID?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getIndicatorColor(status: TimelineStatus): string {
  switch (status) {
    case 'complete':
    case 'active':
      return FIGMA.colors.indicatorComplete;
    case 'accepted':
      return FIGMA.colors.indicatorSuccess;
    case 'rejected':
      return FIGMA.colors.indicatorError;
    default:
      return FIGMA.colors.indicatorPending;
  }
}

function getValueColor(status: TimelineStatus): string {
  switch (status) {
    case 'accepted':
      return FIGMA.colors.textSuccess;
    case 'rejected':
      return FIGMA.colors.textError;
    default:
      return FIGMA.colors.textValue;
  }
}

/**
 * Get connector line color below a given item.
 * Per Figma: connector owned by the row above the gap.
 * - 41:11224 (row 1 connector): #FFAE8A (orange) when row is complete/accepted
 * - 41:11231 (row 2 connector): #A6A6A6 (gray) when row is pending
 */
function getConnectorColor(status: TimelineStatus): string {
  return status === 'complete' || status === 'accepted'
    ? FIGMA.colors.connectorComplete
    : FIGMA.colors.connectorPending;
}

// ============================================
// MAIN COMPONENT
// ============================================

function ApplicationTimelineComponent({ items, testID }: ApplicationTimelineProps) {
  return (
    <View style={styles.container} testID={testID}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const indicatorColor = getIndicatorColor(item.status);
        const valueColor = getValueColor(item.status);
        const connectorColor = getConnectorColor(item.status);

        return (
          <View key={`${item.label}-${index}`}>
            {/* Timeline row: indicator (20x20) + text column (flex) */}
            <View style={styles.timelineRow}>
              {/* Connector line below this row (except for last item) */}
              {!isLast && (
                <View
                  style={[
                    styles.connectorLine,
                    { backgroundColor: connectorColor },
                  ]}
                />
              )}

              {/* Indicator container - 20x20 with 12x12 dot centered */}
              <View style={styles.indicatorContainer}>
                <View
                  style={[
                    styles.indicatorDot,
                    { backgroundColor: indicatorColor },
                  ]}
                />
              </View>

              {/* Text column - flex fill, gap 4 */}
              <View style={styles.textColumn}>
                <RNText style={styles.labelText}>{item.label}</RNText>
                <RNText style={[styles.valueText, { color: valueColor }]}>
                  {item.value}
                </RNText>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ============================================
// STYLES - Exact Figma values
// ============================================

const styles = StyleSheet.create({
  // Timeline card container
  // Node 41:11220: VERTICAL layout, gap 24
  // The outer card wrapper (bg, padding, borderRadius) is rendered by the parent.
  // This container just manages internal vertical flow.
  container: {
    width: '100%',
  },

  // Timeline row
  // Node 2967:57519: 281x44, HORIZONTAL, gap 8, alignItems: flex-start
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: FIGMA.row.gap,
    position: 'relative',
  },

  // Indicator container - exactly 20x20 with centered 12x12 dot
  // Node 2967:57520: 20x20
  indicatorContainer: {
    width: FIGMA.indicatorContainer.width,
    height: FIGMA.indicatorContainer.height,
    alignItems: 'center',
    justifyContent: 'center', // Centers the 12x12 dot inside the 20x20 box
    zIndex: 2,
  },

  // Indicator dot - 12x12 circle
  indicatorDot: {
    width: FIGMA.indicator.size,
    height: FIGMA.indicator.size,
    borderRadius: FIGMA.indicator.size / 2,
  },

  // Connector line
  connectorLine: {
    position: 'absolute',
    left: FIGMA.indicatorContainer.width / 2 - (FIGMA.connector.width / 2),
    top: FIGMA.indicatorContainer.height,
    width: FIGMA.connector.width,
    bottom: -FIGMA.card.gap, // Spans down to the next row (gap is 24)
    zIndex: 1,
  },

  // Text column
  textColumn: {
    flex: 1,
    gap: FIGMA.textContainer.gap,
    justifyContent: 'flex-start', // Align text to the top
  },

  // Label text
  // Node 2967:57524: fontSize 12, lineHeight 20, color #878787
  labelText: {
    fontFamily: FIGMA.typography.label.fontFamily,
    fontSize: FIGMA.typography.label.fontSize,
    lineHeight: FIGMA.typography.label.lineHeight,
    color: FIGMA.colors.textLabel,
    textAlign: 'left',
  },

  // Value text
  // Node 2967:57525: fontSize 14, lineHeight 20, color #CBCBCB
  valueText: {
    fontFamily: FIGMA.typography.value.fontFamily,
    fontSize: FIGMA.typography.value.fontSize,
    lineHeight: FIGMA.typography.value.lineHeight,
    color: FIGMA.colors.textValue,
    textAlign: 'left',
  },
});

export const ApplicationTimeline = memo(ApplicationTimelineComponent);
