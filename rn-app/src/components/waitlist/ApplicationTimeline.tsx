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
import { s, sf } from '@/src/theme/scale';

// ============================================
// FIGMA EXTRACTED CONSTANTS
// All values from enhanced-extraction.json
// ============================================

const FIGMA = {
  // Timeline card container (node 41:11220)
  card: {
    width: s(313),
    borderRadius: 12,
    paddingTop: s(24),
    paddingBottom: s(24),
    paddingLeft: s(16),
    paddingRight: s(16),
    gap: s(24),
  },

  // Timeline row (node 41:11221)
  row: {
    width: s(281),
    height: s(44),
    gap: s(8),
  },

  // Indicator container (node 41:11222)
  indicatorContainer: {
    width: s(20),
    height: s(20),
  },

  // Indicator dot (node 41:11223)
  indicator: {
    size: s(12),
  },

  // Connector line (node 41:11224)
  connector: {
    height: s(47),
    width: 1,
  },

  // Text container (node 41:11225)
  textContainer: {
    width: s(253),
    gap: s(4),
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
      fontSize: sf(12),
      lineHeight: sf(20),
      fontFamily: 'PlusJakartaSans-Regular',
    },
    value: {
      fontSize: sf(14),
      lineHeight: sf(20),
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
  /** When 'value-first', renders value (14px) above label (12px). Default: 'label-first'. */
  textOrder?: 'label-first' | 'value-first';
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

function ApplicationTimelineComponent({ items, testID, textOrder = 'label-first' }: ApplicationTimelineProps) {
  return (
    <View style={styles.container} testID={testID}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const indicatorColor = getIndicatorColor(item.status);
        const valueColor = getValueColor(item.status);
        const connectorColor = getConnectorColor(item.status);

        return (
          <View key={`${item.label}-${index}`} style={styles.timelineRow}>
            {/* Left column: Indicator dot + optional connector line */}
            <View style={styles.indicatorColumn}>
              <View style={styles.indicatorContainer}>
                <View
                  style={[
                    styles.indicatorDot,
                    { backgroundColor: indicatorColor },
                  ]}
                />
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.connectorLine,
                    { backgroundColor: connectorColor },
                  ]}
                />
              )}
            </View>

            {/* Right column: Text content */}
            <View style={[styles.textColumn, isLast && { paddingBottom: 0 }]}>
              {textOrder === 'value-first' ? (
                <>
                  <RNText style={[styles.valueText, { color: valueColor }]}>
                    {item.value}
                  </RNText>
                  <RNText style={styles.labelText}>{item.label}</RNText>
                </>
              ) : (
                <>
                  <RNText style={styles.labelText}>{item.label}</RNText>
                  <RNText style={[styles.valueText, { color: valueColor }]}>
                    {item.value}
                  </RNText>
                </>
              )}
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
  // Node 41:11221: 281x44, HORIZONTAL, gap 8, layoutSizingHorizontal FILL
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: FIGMA.row.gap,
  },

  indicatorColumn: {
    width: FIGMA.indicatorContainer.width,
    alignItems: 'center',
    // Must stretch to fill row height so the connector line extends
    // continuously from one dot to the next (row uses alignItems: flex-start).
    alignSelf: 'stretch',
  },

  // Indicator container - exactly 20x20 with centered 12x12 dot
  // Node 41:11222: 20x20, FIXED sizing both axes
  indicatorContainer: {
    width: FIGMA.indicatorContainer.width,
    height: FIGMA.indicatorContainer.height,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Indicator dot - 12x12 circle
  // Node 41:11223: Ellipse 21906, 12x12, centered in 20x20 container
  indicatorDot: {
    width: FIGMA.indicator.size,
    height: FIGMA.indicator.size,
    borderRadius: FIGMA.indicator.size / 2,
  },

  // Connector wrapper - aligns the 1px line centered under the 20px indicator column
  connectorWrapper: {
    width: FIGMA.indicatorContainer.width,
    alignItems: 'center',
  },

  // Connector line
  // Node 41:11224: Vector 59, width 0 (stroke-based = 1px), height 47
  connectorLine: {
    width: FIGMA.connector.width,
    // The total height of a row in Figma is 44. The line sits below the 20px dot container.
    // However, since we now nest it inside the row, we need it to fill the gap to the next item.
    // Figma gap is 24 between rows + 44 row height = 68px.
    // The text column itself is 44px (20px line + 4px gap + 20px line).
    flex: 1,
    minHeight: 24, // Bridge the gap completely to the next item
  },

  // Text column
  // Node 41:11225: 253x44, VERTICAL, primaryAxisAlignItems CENTER, gap 4
  // layoutSizingHorizontal FILL = flex 1 in RN
  textColumn: {
    flex: 1,
    gap: FIGMA.textContainer.gap,
    justifyContent: 'center',
    paddingBottom: 24, // Figma gap between timeline rows
  },

  // Label text
  // Node 41:11226: fontSize 12, lineHeight 20, fontWeight 400, color #878787
  // PlusJakartaSans-Regular, textAlignHorizontal CENTER (but HUG width in FILL parent)
  labelText: {
    fontFamily: FIGMA.typography.label.fontFamily,
    fontSize: FIGMA.typography.label.fontSize,
    lineHeight: FIGMA.typography.label.lineHeight,
    color: FIGMA.colors.textLabel,
    textAlign: 'left',
  },

  // Value text
  // Node 41:11227: fontSize 14, lineHeight 20, fontWeight 400, color #CBCBCB
  // PlusJakartaSans-Regular, textAlignHorizontal LEFT, layoutSizingHorizontal FILL
  valueText: {
    fontFamily: FIGMA.typography.value.fontFamily,
    fontSize: FIGMA.typography.value.fontSize,
    lineHeight: FIGMA.typography.value.lineHeight,
    color: FIGMA.colors.textValue,
    textAlign: 'left',
  },
});

export const ApplicationTimeline = memo(ApplicationTimelineComponent);
