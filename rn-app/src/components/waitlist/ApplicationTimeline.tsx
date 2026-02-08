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
import { colors } from '@/src/theme/colors';

// ============================================
// FIGMA EXTRACTED CONSTANTS
// All values from enhanced-extraction.json
// ============================================

const FIGMA = {
  // Timeline card container (node 41:11220)
  card: {
    width: 313,
    borderRadius: 12, // radius.lg
    paddingTop: 24, // spacing[6]
    paddingBottom: 24,
    paddingLeft: 16, // spacing.lg
    paddingRight: 16,
    gap: 24, // spacing[6]
  },

  // Timeline row (node 41:11221)
  row: {
    width: 281,
    height: 44,
    gap: 8, // spacing.sm
  },

  // Indicator container (node 41:11222)
  indicatorContainer: {
    width: 20,
    height: 20,
  },

  // Indicator dot (node 41:11223)
  // Ellipse 21906: 12x12, centered in 20x20 container
  indicator: {
    size: 12,
  },

  // Connector line (node 41:11224)
  // Vector 59: height 47
  connector: {
    height: 47,
    width: 1,
  },

  // Text container (node 41:11225)
  textContainer: {
    width: 253,
    gap: 4, // spacing.xs
  },

  // Colors from Figma with design token mappings
  colors: {
    // Card background: #202020 → colors.black[500]
    cardBackground: colors.black[500],

    // Complete status indicator: #FF9A6D → colors.brand[500]
    indicatorComplete: colors.brand[500],

    // Pending status indicator: #1A1A1A → colors.black[600]
    indicatorPending: colors.black[600],

    // Active status indicator (same as complete for now)
    indicatorActive: colors.brand[500],

    // Accepted status: #70BF73 → colors.success.default
    indicatorSuccess: colors.success.default,

    // Rejected status: #E5484D → colors.error.radix
    indicatorError: colors.error.radix,

    // Connector line complete: #FFAE8A → colors.brand[400]
    connectorComplete: colors.brand[400],

    // Connector line pending: #A6A6A6 → colors.black[200]
    connectorPending: colors.black[200],

    // Label text: #878787 → colors.neutral[600]
    textLabel: colors.neutral[600],

    // Value text: #CBCBCB → colors.neutral[300]
    textValue: colors.neutral[300],

    // Success text: #70BF73 → colors.success.default
    textSuccess: colors.success.default,

    // Error text: #E5484D → colors.error.radix
    textError: colors.error.radix,
  },

  // Typography from Figma
  typography: {
    // Label: fontSize 12, lineHeight 20 → typography.bodySm
    label: {
      fontSize: 12,
      lineHeight: 20,
      fontFamily: 'PlusJakartaSans-Regular',
      fontWeight: '400' as const,
    },
    // Value: fontSize 14, lineHeight 20 → typography.bodyMd2
    value: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: 'PlusJakartaSans-Regular',
      fontWeight: '400' as const,
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
// MAIN COMPONENT
// ============================================

function ApplicationTimelineComponent({ items, testID }: ApplicationTimelineProps) {
  return (
    <View style={styles.container} testID={testID}>
      {items.map((item, index) => (
        <TimelineItem
          key={`${item.label}-${index}`}
          {...item}
          isFirst={index === 0}
          isLast={index === items.length - 1}
          prevStatus={index > 0 ? items[index - 1].status : undefined}
        />
      ))}
    </View>
  );
}

// ============================================
// TIMELINE ITEM
// ============================================

interface TimelineItemProps extends TimelineItemData {
  isFirst: boolean;
  isLast: boolean;
  prevStatus?: TimelineStatus;
}

function TimelineItem({ label, value, status, isFirst, isLast, prevStatus }: TimelineItemProps) {
  // Get indicator color based on status
  const getIndicatorColor = () => {
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
  };

  // Get connector color based on previous item status
  const getConnectorColor = () => {
    if (prevStatus === 'complete' || prevStatus === 'active') {
      return FIGMA.colors.connectorComplete;
    }
    return FIGMA.colors.connectorPending;
  };

  // Get value text color based on status
  const getValueColor = () => {
    switch (status) {
      case 'accepted':
        return FIGMA.colors.textSuccess;
      case 'rejected':
        return FIGMA.colors.textError;
      default:
        return FIGMA.colors.textValue;
    }
  };

  const indicatorColor = getIndicatorColor();
  const connectorColor = getConnectorColor();
  const valueColor = getValueColor();

  return (
    <View style={styles.timelineRow}>
      {/* Indicator column - 20x20 container with 12x12 dot */}
      <View style={styles.indicatorColumn}>
        {/* Connector line above (if not first) */}
        {!isFirst && (
          <View style={[styles.connectorTop, { backgroundColor: connectorColor }]} />
        )}

        {/* Indicator container - 20x20 */}
        <View style={styles.indicatorContainer}>
          {/* Indicator dot - 12x12, centered */}
          <View style={[styles.indicatorDot, { backgroundColor: indicatorColor }]} />
        </View>

        {/* Connector line below (if not last) */}
        {!isLast && (
          <View style={[styles.connectorBottom, { backgroundColor: getConnectorColor() }]} />
        )}
      </View>

      {/* Text column - 253x44, gap 4 */}
      <View style={styles.textColumn}>
        {/* Label: fontSize 12, color #878787 */}
        <RNText style={styles.labelText}>{label}</RNText>

        {/* Value: fontSize 14, color #CBCBCB (or status color) */}
        <RNText style={[styles.valueText, { color: valueColor }]}>{value}</RNText>
      </View>
    </View>
  );
}

// ============================================
// STYLES - Exact Figma values
// ============================================

const styles = StyleSheet.create({
  // Timeline card container
  // Node 41:11220: 313x228, #202020, borderRadius 12, padding 24/16, gap 24
  container: {
    width: '100%',
    gap: FIGMA.card.gap,
  },

  // Timeline row
  // Node 41:11221: 281x44, gap 8
  timelineRow: {
    flexDirection: 'row',
    gap: FIGMA.row.gap,
    minHeight: FIGMA.row.height,
  },

  // Indicator column
  indicatorColumn: {
    width: FIGMA.indicatorContainer.width,
    alignItems: 'center',
  },

  // Indicator container - 20x20
  // Node 41:11222
  indicatorContainer: {
    width: FIGMA.indicatorContainer.width,
    height: FIGMA.indicatorContainer.height,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Indicator dot - 12x12
  // Node 41:11223: Ellipse 21906
  indicatorDot: {
    width: FIGMA.indicator.size,
    height: FIGMA.indicator.size,
    borderRadius: FIGMA.indicator.size / 2,
  },

  // Connector line above indicator
  connectorTop: {
    width: FIGMA.connector.width,
    height: 8, // Small gap above indicator
  },

  // Connector line below indicator
  // Node 41:11224: Vector 59, height 47
  connectorBottom: {
    flex: 1,
    width: FIGMA.connector.width,
    minHeight: FIGMA.connector.height - 8, // Account for spacing
    marginTop: 4,
  },

  // Text column
  // Node 41:11225: 253x44, gap 4
  textColumn: {
    flex: 1,
    gap: FIGMA.textContainer.gap,
    justifyContent: 'center',
    // Removed paddingBottom: 16 - not in Figma extraction
    // The timeline uses gap: 24 between rows, no extra padding needed
  },

  // Label text
  // Node 41:11226: fontSize 12, lineHeight 20, color #878787
  labelText: {
    fontFamily: FIGMA.typography.label.fontFamily,
    fontSize: FIGMA.typography.label.fontSize,
    lineHeight: FIGMA.typography.label.lineHeight,
    fontWeight: FIGMA.typography.label.fontWeight,
    color: FIGMA.colors.textLabel,
  },

  // Value text
  // Node 41:11227: fontSize 14, lineHeight 20, color #CBCBCB
  valueText: {
    fontFamily: FIGMA.typography.value.fontFamily,
    fontSize: FIGMA.typography.value.fontSize,
    lineHeight: FIGMA.typography.value.lineHeight,
    fontWeight: FIGMA.typography.value.fontWeight,
    color: FIGMA.colors.textValue,
  },
});

export const ApplicationTimeline = memo(ApplicationTimelineComponent);
