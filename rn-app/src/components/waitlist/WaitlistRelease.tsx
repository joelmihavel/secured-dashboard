/**
 * Waitlist Release — half-ellipse gauge
 * Figma: 4651:78274 (Ellipse 21888 with the orange progress + drop tail)
 *
 * The arc in Figma is a SHALLOW (flattened) half-ellipse — wider than tall,
 * not a perfect half-circle. Two paths share the same elliptical curve:
 *  - the dark grey track (full arc),
 *  - the orange progress (clipped via strokeDasharray to {progress × len}).
 * A solid filled circle anchored at the orange arc's start gives the
 * "drop / pendant" tail that hangs below the gauge baseline.
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

interface WaitlistReleaseProps {
  currentOnboarded: number;
  totalMemberSlots: number;
}

// All gauge geometry derived from these constants. The arc is wider than tall
// (rx > ry) to match the shallow rainbow shape in Figma. The "drop" effect at
// the start of the orange portion is just the strokeLinecap="round" — no
// separate circle, no manual blob (those produced an elbow). The rounded cap
// extends STROKE_WIDTH/2 below the arc start, which IS the teardrop.
const STROKE_WIDTH = 18;
const RX = 110;
const RY = 56;
const ARC_TOP_MARGIN = STROKE_WIDTH / 2 + 4;
const CENTER_X = RX + STROKE_WIDTH / 2;
const CENTER_Y = ARC_TOP_MARGIN + RY;
const VIEW_WIDTH = RX * 2 + STROKE_WIDTH;
// CENTER_Y is the arc baseline; the round end-cap of the stroke extends
// STROKE_WIDTH/2 below that, so we add it to the height plus a 4px safety pad.
const VIEW_HEIGHT = CENTER_Y + STROKE_WIDTH / 2 + 4;
const ARC_START_X = CENTER_X - RX;
const ARC_END_X = CENTER_X + RX;
const ARC_PATH = `M ${ARC_START_X} ${CENTER_Y} A ${RX} ${RY} 0 0 1 ${ARC_END_X} ${CENTER_Y}`;

// Ramanujan's second approximation for ellipse circumference: more accurate
// than (rx + ry) × π / 2 for non-circular ellipses.
function halfEllipseLength(a: number, b: number): number {
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  const fullCircumference = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  return fullCircumference / 2;
}
const ARC_LENGTH = halfEllipseLength(RX, RY);

function WaitlistReleaseComponent({ currentOnboarded, totalMemberSlots }: WaitlistReleaseProps) {
  const progress = totalMemberSlots > 0
    ? Math.min(currentOnboarded / totalMemberSlots, 1)
    : 0;
  const filledLen = ARC_LENGTH * progress;

  return (
    <View style={styles.container}>
      <View style={styles.gaugeWrap}>
        <Svg width={VIEW_WIDTH} height={VIEW_HEIGHT} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
          <Path
            d={ARC_PATH}
            stroke={colors.black[500]}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            fill="none"
          />
          {progress > 0 && (
            <Path
              d={ARC_PATH}
              stroke={colors.brand[500]}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${filledLen} ${ARC_LENGTH}`}
            />
          )}
        </Svg>

        {/* "This release" label — tucked into the upper-left curve of the arc */}
        <Text style={styles.releaseLabel}>This{'\n'}release</Text>

        {/* Count + caption — centered under the arc apex */}
        <View style={styles.gaugeCenterText}>
          <Text style={styles.countText}>
            {currentOnboarded} / {totalMemberSlots}
          </Text>
          <Text style={styles.captionText}>members onboarded</Text>
        </View>
      </View>
    </View>
  );
}

export const WaitlistRelease = memo(WaitlistReleaseComponent);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  gaugeWrap: {
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    position: 'relative',
  },
  releaseLabel: {
    position: 'absolute',
    top: ARC_TOP_MARGIN + 12,
    left: STROKE_WIDTH + 8,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 10,
    lineHeight: 12,
    color: colors.neutral[500],
    textAlign: 'left',
  },
  gaugeCenterText: {
    position: 'absolute',
    top: CENTER_Y - 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 1,
  },
  countText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: colors.white,
    textAlign: 'center',
  },
  captionText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 14,
    color: colors.brand[500],
    textAlign: 'center',
  },
});
