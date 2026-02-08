/**
 * Progress Arc Component - Pixel Perfect Figma Implementation
 *
 * Source: figma-parity/data/ai-enhanced/41-11206/enhanced-extraction.json
 *
 * Figma Node References (with exact positions relative to gauge container):
 * - 41:11243: Frame 2095586334 (gauge container) - 278x139 at (0, 0)
 * - 41:11244: Ellipse 21888 (background circle) - 278x278, #1A1A1A
 * - 41:11245: Ellipse 21889 (progress arc) - 278x278, #FF9A6D
 * - 41:11246: "18 / 150 members onboarded" text - 147x40 at (65.5, 74.6) - CENTERED
 * - 41:11247: Vector 56 (dashed line) - 29x30 at (35.5, 34.4)
 * - 41:11248: Polygon 1 (triangle marker) - 22x22 at (28.5, 27.6)
 * - 41:11249: "This release" hint text - 42x40 at (17.5, -28.4)
 *
 * IMPORTANT: Text "18 / 150  members onboarded" is ONE LINE with mixed colors,
 * NOT two separate lines. The characterStyleOverrides define:
 * - chars 0-8 ("18 / 150 "): gray #A9A9A9 (styleOverride 44)
 * - char 9 (" "): transition
 * - chars 10-26 ("members onboarded"): orange #FF9A6D (styleOverride 42)
 */

import React, { memo } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

// ============================================
// FIGMA EXTRACTED CONSTANTS
// All values from enhanced-extraction.json with EXACT positions
// ============================================

const FIGMA = {
  // Gauge container (node 41:11243)
  // Position: x=9278, y=1137.4
  container: {
    width: 278,
    height: 139, // Half of 278 - shows semi-circle
  },

  // Ellipse dimensions (nodes 41:11244, 41:11245)
  ellipse: {
    size: 278, // Both width and height
  },

  // Relative positions (calculated from absolute Figma coordinates)
  // All positions relative to gauge container top-left (0, 0)
  positions: {
    // "This release" hint (41:11249): x=9295.5, y=1109 → relative: (17.5, -28.4)
    hint: {
      left: 17.5,
      top: -28.4, // Above gauge container
      width: 42,
      height: 40,
    },
    // Vector 56 dashed line (41:11247): x=9313.5, y=1171.8 → relative: (35.5, 34.4)
    dashedLine: {
      left: 35.5,
      top: 34.4,
      width: 29,
      height: 30,
    },
    // Polygon 1 triangle (41:11248): x=9306.5, y=1165 → relative: (28.5, 27.6)
    triangle: {
      left: 28.5,
      top: 27.6,
      width: 22.34,
      height: 22.12,
    },
    // Members text (41:11246): x=9343.5, y=1212 → relative: (65.5, 74.6)
    // This is centered: (278 - 147) / 2 = 65.5
    membersText: {
      left: 65.5,
      top: 74.6,
      width: 147,
      height: 40,
    },
  },

  // Colors from Figma with design token mappings
  colors: {
    // Ellipse 21888 background: #1A1A1A → colors.black[600]
    backgroundCircle: '#1A1A1A',

    // Ellipse 21889 progress: #FF9A6D → colors.brand[500]
    progressArc: '#FF9A6D',

    // Text "18 / 150  " gray: #A9A9A9 → colors.neutral[500]
    // styleOverride 44
    textGray: '#A9A9A9',

    // Text "members onboarded" orange: #FF9A6D → colors.brand[500]
    // styleOverride 42
    textOrange: '#FF9A6D',

    // Vector 56 stroke: #FFAE8A → colors.brand[400]
    dashedLine: '#FFAE8A',

    // Polygon 1 fill: #CC7B57
    triangleMarker: '#CC7B57',

    // "This release" hint: #797979 → colors.black[300]
    hintText: '#797979',
  },

  // Text specs
  text: {
    // Node 41:11246: fontSize 14, lineHeight 20, textAlign CENTER
    members: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: 'PlusJakartaSans-Regular',
    },
    // Node 41:11249: fontSize 12, lineHeight 20
    hint: {
      fontSize: 12,
      lineHeight: 20,
      fontFamily: 'PlusJakartaSans-Regular',
    },
  },

  // Vector 56 (dashed line): stroke specs
  dashedLine: {
    strokeWidth: 1,
    dashArray: '3 3',
  },
} as const;

// ============================================
// TYPES
// ============================================

export interface ProgressArcProps {
  current: number;
  total: number;
  label?: string;
  testID?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

function ProgressArcComponent({
  current,
  total,
  label = 'This release',
  testID,
}: ProgressArcProps) {
  // Calculate progress percentage (capped at 100%)
  const progress = Math.min(current / total, 1);

  // Calculate the arc angle (180 degrees = half circle, starting from left)
  const progressAngle = progress * 180;

  return (
    <View style={styles.container} testID={testID}>
      {/* "This release" hint label - positioned using exact Figma coordinates */}
      <View style={styles.hintContainer}>
        <RNText style={styles.hintText}>{label}</RNText>
      </View>

      {/* Dashed line (Vector 56) - positioned absolutely */}
      <View style={styles.dashedLineContainer}>
        <Svg
          width={FIGMA.positions.dashedLine.width}
          height={FIGMA.positions.dashedLine.height}
          viewBox={`0 0 ${FIGMA.positions.dashedLine.width} ${FIGMA.positions.dashedLine.height}`}
        >
          <Line
            x1={0}
            y1={0}
            x2={FIGMA.positions.dashedLine.width}
            y2={FIGMA.positions.dashedLine.height}
            stroke={FIGMA.colors.dashedLine}
            strokeWidth={FIGMA.dashedLine.strokeWidth}
            strokeDasharray={FIGMA.dashedLine.dashArray}
          />
        </Svg>
      </View>

      {/* Triangle marker (Polygon 1) - positioned absolutely */}
      <View style={styles.triangleContainer}>
        <Svg
          width={FIGMA.positions.triangle.width}
          height={FIGMA.positions.triangle.height}
          viewBox="0 0 15 15"
        >
          <Path
            d="M12.5167 14.9143C13.649 15.3014 14.7757 14.3176 14.5447 13.1435L12.2064 1.25577C11.9755 0.0816735 10.5601 -0.402134 9.65882 0.384916L0.532906 8.3538C-0.368419 9.14085 -0.0797377 10.6085 1.05253 10.9955L12.5167 14.9143Z"
            fill={FIGMA.colors.triangleMarker}
          />
        </Svg>
      </View>

      {/* Gauge container - clips to show semi-circle */}
      <View style={styles.gaugeContainer}>
        <Svg
          width={FIGMA.ellipse.size}
          height={FIGMA.ellipse.size}
          viewBox={`0 0 ${FIGMA.ellipse.size} ${FIGMA.ellipse.size}`}
        >
          <Defs>
            <LinearGradient id="progressGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={FIGMA.colors.progressArc} stopOpacity={1} />
              <Stop offset="100%" stopColor={FIGMA.colors.progressArc} stopOpacity={0.8} />
            </LinearGradient>
          </Defs>
          {(() => {
            const STROKE_WIDTH = 40;
            const RADIUS = FIGMA.ellipse.size / 2 - STROKE_WIDTH / 2;
            const CENTER = FIGMA.ellipse.size / 2;

            const backgroundArcPath = `M ${CENTER - RADIUS},${CENTER} A ${RADIUS},${RADIUS} 0 0 1 ${CENTER + RADIUS},${CENTER}`;

            const angleRad = ((180 - progressAngle) * Math.PI) / 180;
            const endX = CENTER + RADIUS * Math.cos(angleRad);
            const endY = CENTER - RADIUS * Math.sin(angleRad);
            const progressArcPath = `M ${CENTER - RADIUS},${CENTER} A ${RADIUS},${RADIUS} 0 0 1 ${endX},${endY}`;

            return (
              <>
                {/* Background Arc */}
                <Path
                  d={backgroundArcPath}
                  stroke={FIGMA.colors.backgroundCircle}
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                />
                {/* Progress Arc */}
                {progress > 0 && (
                  <Path
                    d={progressArcPath}
                    stroke="url(#progressGradient)"
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                    strokeLinecap="round"
                  />
                )}
              </>
            );
          })()}
        </Svg>

        {/* Members text - ONE LINE with mixed colors, centered */}
        {/* Figma: "18 / 150  members onboarded" - textAlignHorizontal: CENTER */}
        <View style={styles.textContainer}>
          <RNText style={styles.membersText}>
            <RNText style={styles.membersTextGray}>{current} / {total}  </RNText>
            <RNText style={styles.membersTextOrange}>members onboarded</RNText>
          </RNText>
        </View>
      </View>
    </View>
  );
}

// ============================================
// STYLES - Exact Figma positions
// ============================================

const styles = StyleSheet.create({
  // Main container - needs overflow visible for hint above
  container: {
    width: FIGMA.container.width,
    height: FIGMA.container.height,
    position: 'relative',
    overflow: 'visible', // Allow hint to show above container
  },

  // "This release" hint - exact Figma position (17.5, -28.4) relative to gauge
  // Node 41:11249
  hintContainer: {
    position: 'absolute',
    left: FIGMA.positions.hint.left,
    top: FIGMA.positions.hint.top,
    width: FIGMA.positions.hint.width,
    height: FIGMA.positions.hint.height,
    zIndex: 10,
  },

  hintText: {
    fontFamily: FIGMA.text.hint.fontFamily,
    fontSize: FIGMA.text.hint.fontSize,
    lineHeight: FIGMA.text.hint.lineHeight,
    color: FIGMA.colors.hintText,
    textAlign: 'center',
  },

  // Dashed line - exact Figma position (35.5, 34.4)
  // Node 41:11247
  dashedLineContainer: {
    position: 'absolute',
    left: FIGMA.positions.dashedLine.left,
    top: FIGMA.positions.dashedLine.top,
    zIndex: 5,
  },

  // Triangle marker - exact Figma position (28.5, 27.6)
  // Node 41:11248
  triangleContainer: {
    position: 'absolute',
    left: FIGMA.positions.triangle.left,
    top: FIGMA.positions.triangle.top,
    zIndex: 5,
  },

  // Gauge container - shows semi-circle (half height)
  // Node 41:11243: width=278, height=139
  gaugeContainer: {
    width: FIGMA.container.width,
    height: FIGMA.container.height,
    overflow: 'hidden', // Clips to show only top half of circle
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  // Members text container - exact Figma position (65.5, 74.6)
  // Node 41:11246: width=147, height=40, textAlign=CENTER
  textContainer: {
    position: 'absolute',
    left: FIGMA.positions.membersText.left,
    top: FIGMA.positions.membersText.top,
    width: FIGMA.positions.membersText.width,
    height: FIGMA.positions.membersText.height,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Single line text with mixed colors - textAlign CENTER per Figma
  membersText: {
    textAlign: 'center',
    fontFamily: FIGMA.text.members.fontFamily,
    fontSize: FIGMA.text.members.fontSize,
    lineHeight: FIGMA.text.members.lineHeight,
  },

  // "18 / 150  " in gray (styleOverride 44)
  membersTextGray: {
    color: FIGMA.colors.textGray,
  },

  // "members onboarded" in orange (styleOverride 42)
  membersTextOrange: {
    color: FIGMA.colors.textOrange,
  },
});

export const ProgressArc = memo(ProgressArcComponent);
