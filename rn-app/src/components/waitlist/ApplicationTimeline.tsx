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
          <View key={`${item.label}-${index}`} style={styles.timelineRow}>
            {/* Left column: Dot and Line */}
            <View style={styles.leftColumn}>
              <View
                style={[
                  styles.indicatorDot,
                  { backgroundColor: indicatorColor },
                ]}
              />
              {!isLast && (
                <View
                  style={[
                    styles.connectorLine,
                    { backgroundColor: connectorColor },
                  ]}
                />
              )}
            </View>

            {/* Right column: Text (with padding bottom for spacing instead of gap) */}
            <View style={[styles.textColumn, !isLast && styles.textColumnPadding]}>
              <RNText style={styles.labelText}>{item.label}</RNText>
              <RNText style={[styles.valueText, { color: valueColor }]}>
                {item.value}
              </RNText>
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
  container: {
    width: '100%',
  },
  timelineRow: {
    flexDirection: 'row',
  },
  leftColumn: {
    width: 20, // FIGMA.indicatorContainer.width
    alignItems: 'center',
  },
  indicatorDot: {
    width: 12, // FIGMA.indicator.size
    height: 12,
    borderRadius: 6,
    // The label text has a lineHeight of 20px. 
    // To perfectly center a 12px dot beside a 20px line of text: (20 - 12) / 2 = 4px
    marginTop: 4, 
    zIndex: 2,
  },
  connectorLine: {
    width: 1, // FIGMA.connector.width
    flex: 1, // Takes up remaining height in the row
    marginTop: 4, // 4px gap below the dot
    marginBottom: -4, // Pulls the line down 4px into the next row's space to exactly touch the next dot
    zIndex: 1,
  },
  textColumn: {
    flex: 1,
    marginLeft: 8, // FIGMA.row.gap
    gap: 4, // FIGMA.textContainer.gap
    justifyContent: 'flex-start',
  },
  textColumnPadding: {
    paddingBottom: 24, // Matches the Figma row gap. The row expands, causing the leftColumn line to stretch perfectly.
  },
  labelText: {
    fontFamily: FIGMA.typography.label.fontFamily,
    fontSize: FIGMA.typography.label.fontSize,
    lineHeight: FIGMA.typography.label.lineHeight,
    color: FIGMA.colors.textLabel,
    textAlign: 'left',
  },
  valueText: {
    fontFamily: FIGMA.typography.value.fontFamily,
    fontSize: FIGMA.typography.value.fontSize,
    lineHeight: FIGMA.typography.value.lineHeight,
    color: FIGMA.colors.textValue,
    textAlign: 'left',
  },
});

export const ApplicationTimeline = memo(ApplicationTimelineComponent);
