/**
 * Progress Arc Component - Figma-Parity Implementation
 *
 * Figma Node References:
 * - 41:11543: Frame 2095586334 (gauge container) - 278x139
 * - 41:11544: Ellipse 21888 (background ring) - 278x278, fill #1A1A1A, innerRadius 0.8
 * - 41:11545: Ellipse 21889 (progress ring) - 278x278, fill #FF9A6D, innerRadius 0.8
 * - 41:11546: "18 / 150  members onboarded" text - 147x40, centered
 * - 41:11547: Vector 56 (dashed line) - stroke #FFAE8A, strokeWeight 0.5, strokeDashes [3,3]
 * - 41:11548: Polygon 1 (triangle marker) - fill #CC7B57
 * - 41:11549: "This release" hint text - 42x40, color #797979
 *
 * Both ellipses have arcData.innerRadius = 0.8 (from Figma REST API).
 * This means they are RING/DONUT shapes, not filled circles.
 * Rendered as thick stroked arcs with strokeLinecap="round".
 * A 278x139 container clips to show the top semicircle.
 *
 * Callout positioning strategy:
 * - At the Figma reference (18/150 = 12%), positions use exact Figma relativeTransform matrices.
 * - For other progress values, all callout elements rotate around the arc center (139, 139)
 *   by the angular difference from reference. This keeps the callout group rigid.
 */

import React, { memo, useMemo } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import Svg, { Path, Line, G } from 'react-native-svg';
import { sv } from '@/src/theme/scale';

// ============================================
// FIGMA EXTRACTED CONSTANTS
// Source: Figma REST API arcData + node data
// ============================================

/** Gauge container: 41:11543 — 278x139 */
const CONTAINER_W = 278;
const CONTAINER_H = 139;

/** Ellipse dimensions: 41:11544 + 41:11545 — both 278x278 */
const ELLIPSE_SIZE = 278;
const OUTER_RADIUS = ELLIPSE_SIZE / 2; // 139

/**
 * From Figma REST API: arcData.innerRadius = 0.8 for both ellipses.
 * Ring inner edge at 80% of outer radius.
 */
const INNER_RATIO = 0.8;
const INNER_RADIUS = OUTER_RADIUS * INNER_RATIO; // 111.2
const ARC_RADIUS = (OUTER_RADIUS + INNER_RADIUS) / 2; // 125.1 — center of ring
const ARC_STROKE = OUTER_RADIUS - INNER_RADIUS; // 27.8 — ring thickness

/** Colors — directly from Figma fills/strokes */
const BG_FILL = '#1A1A1A';
const PROGRESS_FILL = '#FF9A6D';
const DASHED_STROKE = '#FFAE8A';
const TRIANGLE_FILL = '#CC7B57';
const HINT_COLOR = '#797979';
const TEXT_GRAY = '#A9A9A9';
const TEXT_ORANGE = '#FF9A6D';

/** Text: 41:11546 — 147x40, centered within gauge */
const TEXT_W = 147;
const TEXT_H = 40;
const TEXT_REL_X = 65.5;
const TEXT_REL_Y = 74.6;

/** Hint text: 41:11549 — 42x40, "This\nrelease" */
const HINT_W = 42;
const HINT_H = 40;

/** Reference progress from Figma design (visually drawn at ~23% despite 18/150 text) */
const REF_PROGRESS = 0.2305;

/** Reference angle at 12% progress */
const REF_ANGLE = Math.PI * (1 - REF_PROGRESS);

/** Arc center — rotation pivot for callout positioning */
const CX = OUTER_RADIUS; // 139
const CY = OUTER_RADIUS; // 139

/**
 * Triangle relativeTransform from Figma REST API (node 41:11548).
 * Maps from the triangle's local path coordinates to the gauge container.
 * SVG matrix format: matrix(a, b, c, d, e, f) where:
 *   [a c e]
 *   [b d f]
 *
 * Figma relativeTransform: [[0.7532, -0.6577, 38.12], [-0.6577, -0.7532, 49.73]]
 * Decomposes as: Rotate(-41.13°) × Scale(1, -1) + translate(38.12, 49.73)
 */
const TRI_MATRIX = '0.7532426118850708 -0.6577427983283997 -0.6577427983283997 -0.7532426118850708 38.119140625 49.725341796875';

/** Triangle SVG path (from Figma fillGeometry — includes corner rounding) */
const TRIANGLE_PATH =
  'M12.5167 14.9143C13.649 15.3014 14.7757 14.3176 14.5447 13.1435L12.2064 1.25577C11.9755 0.0816735 10.5601 -0.402134 9.65882 0.384916L0.532906 8.3538C-0.368419 9.14085 -0.0797377 10.6085 1.05253 10.9955L12.5167 14.9143Z';

/**
 * Dashed line reference endpoints (from vectorNetwork vertices
 * transformed via relativeTransform to gauge container coords).
 * Node 41:11547 — strokeWeight 0.5, strokeDashes [3,3], color #FFAE8A
 */
const DASH_REF_X1 = 35.5;
const DASH_REF_Y1 = 34.60;
const DASH_REF_X2 = 64.5;
const DASH_REF_Y2 = 64.10;

/**
 * Hint text reference position (from absoluteBoundingBox relative to gauge container).
 * Node 41:11549 — "This release", relX=17.5, relY=-28.4
 */
const HINT_REF_X = 17.5;
const HINT_REF_Y = -28.4;

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
// GEOMETRY HELPERS
// ============================================

/**
 * Build SVG arc path for the background semicircular ring.
 */
function bgArcPath(): string {
  const startX = OUTER_RADIUS - ARC_RADIUS;
  const endX = OUTER_RADIUS + ARC_RADIUS;
  const cy = OUTER_RADIUS;
  return `M ${startX} ${cy} A ${ARC_RADIUS} ${ARC_RADIUS} 0 1 1 ${endX} ${cy}`;
}

/**
 * Build SVG arc path for the progress ring segment.
 */
function progressArcPath(progress: number): string {
  if (progress <= 0) return '';
  const clamped = Math.min(progress, 1);
  const angle = Math.PI * (1 - clamped);
  const startX = OUTER_RADIUS - ARC_RADIUS;
  const startY = OUTER_RADIUS;
  const endX = OUTER_RADIUS + ARC_RADIUS * Math.cos(angle);
  const endY = OUTER_RADIUS - ARC_RADIUS * Math.sin(angle);
  const largeArc = clamped > 0.5 ? 1 : 0;
  return `M ${startX} ${startY} A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${largeArc} 1 ${endX} ${endY}`;
}

/**
 * Compute rotation delta (degrees) from reference progress.
 * All callout elements rotate around the arc center by this amount.
 */
function rotationDelta(progress: number): number {
  const curAngle = Math.PI * (1 - progress);
  return ((REF_ANGLE - curAngle) * 180) / Math.PI;
}

/**
 * Rotate a point (px, py) around the arc center (CX, CY) by angleDeg degrees.
 * Returns the new position.
 */
function rotateAroundCenter(px: number, py: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const dx = px - CX;
  const dy = py - CY;
  return {
    x: CX + dx * cosR - dy * sinR,
    y: CY + dx * sinR + dy * cosR,
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

function ProgressArcComponent({
  current,
  total,
  testID,
}: Omit<ProgressArcProps, 'label'>) {
  const progress = Math.min(current / Math.max(total, 1), 1);

  const bgPath = useMemo(() => bgArcPath(), []);
  const progressPath = useMemo(() => progressArcPath(progress), [progress]);

  return (
    <View
      style={styles.outerWrapper}
      testID={testID}
    >
      {/* Gauge — thick stroked arcs clipped to top semicircle */}
      <View style={styles.gaugeClip}>
        <Svg
          width={ELLIPSE_SIZE}
          height={ELLIPSE_SIZE}
          viewBox={`0 0 ${ELLIPSE_SIZE} ${ELLIPSE_SIZE}`}
        >
          {/* Background ring arc — node 41:11544 */}
          <Path
            d={bgPath}
            fill="none"
            stroke={BG_FILL}
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
          />

          {/* Progress ring arc — node 41:11545 */}
          {progress > 0 && (
            <Path
              d={progressPath}
              fill="none"
              stroke={PROGRESS_FILL}
              strokeWidth={ARC_STROKE}
              strokeLinecap="round"
            />
          )}
        </Svg>

        {/* Members text — node 41: sv(11546), centered within gauge */}
        <View
          style={[
            styles.textContainer,
            { left: TEXT_REL_X, top: TEXT_REL_Y, width: TEXT_W, height: TEXT_H },
          ]}
        >
          <RNText style={styles.membersText}>
            <RNText style={styles.textGray}>
              {current} / {total}{'  '}
            </RNText>
            <RNText style={styles.textOrange}>
              {'members\nonboarded'}
            </RNText>
          </RNText>
        </View>
        
        {/* Hint text - "This release" */}
        <View style={[styles.hintContainer, { left: 139 + HINT_REF_X, top: 139 + HINT_REF_Y }]}>
          <RNText style={styles.hintText}>This{'\n'}release</RNText>
        </View>
        
        {/* Callout SVG */}
        <View style={styles.calloutSvg} pointerEvents="none">
           <Svg width={ELLIPSE_SIZE} height={ELLIPSE_SIZE} viewBox={`0 0 ${ELLIPSE_SIZE} ${ELLIPSE_SIZE}`}>
             <G transform={`translate(${CX}, ${CY}) rotate(${rotationDelta(progress)}) translate(${-CX}, ${-CY})`}>
               {/* Dashed line */}
               <Line
                 x1={DASH_REF_X1}
                 y1={DASH_REF_Y1}
                 x2={DASH_REF_X2}
                 y2={DASH_REF_Y2}
                 stroke={DASHED_STROKE}
                 strokeWidth={0.5}
                 strokeDasharray="3,3"
               />
               {/* Triangle */}
               <Path
                 d={TRIANGLE_PATH}
                 fill={TRIANGLE_FILL}
                 transform={`matrix(${TRI_MATRIX})`}
               />
             </G>
           </Svg>
        </View>
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  outerWrapper: {
    width: CONTAINER_W,
    height: CONTAINER_H,
    alignSelf: 'center',
    position: 'relative',
  },

  gaugeClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CONTAINER_W,
    height: CONTAINER_H,
    overflow: 'visible', // Must be visible so the 13.9px bottom strokeLinecaps don't get chopped off!
  },

  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },

  membersText: {
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(14),
    lineHeight: sv(20),
  },

  textGray: {
    color: TEXT_GRAY,
  },

  textOrange: {
    color: TEXT_ORANGE,
  },

  hintContainer: {
    position: 'absolute',
    zIndex: 10,
  },

  hintText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(12),
    lineHeight: sv(20),
    color: HINT_COLOR,
    textAlign: 'center',
  },

  calloutSvg: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 5,
  },
});

export const ProgressArc = memo(ProgressArcComponent);
