/**
 * PaymentBadge — Circular stamp badge for flip card payment status
 *
 * Figma nodes:
 *   - Paid (orange FL):    694:6661
 *   - Upcoming (grey FL):  694:6667
 *   - Late (red + count):  694:6673
 *   - Missed (yellow + count): 694:6679
 *
 * Layout (128×128 viewBox, Figma ring SVGs):
 *   - Solid background circle (r=64)
 *   - Circular text along path between rings (r=50, circumference ≈ 314)
 *   - Outer ring: r=63.875, strokeWidth=0.25 (Figma Ellipse 21916)
 *   - Inner ring: r=36.875, strokeWidth=0.25 (Figma Ellipse 21915)
 *   - Center: FL logo or count number
 *
 * Tokens (from Figma):
 *   - Circular text: sm/Medium 500 → fontSize 12px design
 *   - Center number: H1/Regular 400 → fontSize 48px, letterSpacing -2px
 *   - Ring strokes: per-variant colors from Figma SVG exports
 */

import React, { memo } from 'react';
import Svg, {
  Circle,
  Path,
  Text as SvgText,
  TextPath,
  Defs,
  G,
} from 'react-native-svg';

export type BadgeVariant = 'paid' | 'late' | 'missed' | 'upcoming';

export interface PaymentBadgeProps {
  variant: BadgeVariant;
  /** Cumulative count for late/missed variants */
  count?: number;
  /** Render size in px (default 94, matching flip card sticker area) */
  size?: number;
}

// FL logo path — from Figma badge-specific SVG (viewBox 0 0 35.3699 42.3908)
const FL_LOGO_PATH =
  'M13.2208 42.3908H3.94903V22.4737H0V16.9794H3.94903C1.75129 8.46307 7.95534 3.35794 11.3321 1.86991C21.2219 -3.34974 31.4781 3.58687 35.3699 7.70763V42.3908H26.0982V12.3435C20.7412 3.55251 14.022 5.59001 11.3321 7.70763C7.89811 13.6141 12.7629 16.3498 15.6246 16.9794H20.4321V22.4737H13.2208V42.3908Z';

// Logo bounding box (from Figma SVG viewBox)
const LOGO_W = 35.3699;
const LOGO_H = 42.3908;
// Logo path y ranges from -3.35 to 42.39, so vertical center ≈ (42.39 + (-3.35)) / 2 = 19.52
const LOGO_CENTER_X = LOGO_W / 2; // 17.685
const LOGO_CENTER_Y = 19.52;

// ViewBox dimensions (Figma: 128×128 content area)
const VB = 128;
const CX = VB / 2; // 64
const CY = VB / 2; // 64

// Ring geometry from Figma SVG exports (Ellipse 21915 & 21916)
const OUTER_R = 63.875;
const INNER_R = 36.875;
const RING_STROKE_W = 0.25;

// Circular text path: midpoint between rings
// (63.875 + 36.875) / 2 = 50.375 → round to 50
const TEXT_R = 50;
// Circumference: 2π × 50 ≈ 314 viewBox units

// Font size for circular text: Figma sm/Medium = 12px design.
// Badge viewBox is 128 matching the ring area. At 94px render:
// 9 vb-units → ~6.6px actual, readable for the circular band.
const TEXT_FONT_SIZE = 12;

// Figma-exact values per variant
const BADGE_CONFIGS: Record<
  BadgeVariant,
  {
    bg: string;
    ringStroke: string;
    textFill: string;
    /** Single repeat of the circular text — will be repeated 6× to fill circumference */
    label: string;
    centerType: 'logo' | 'count';
    centerColor: string;
  }
> = {
  paid: {
    bg: '#FF9A6D', // colours/brand/500
    ringStroke: '#4D4D4D', // Figma Ellipse 21915/21916
    textFill: '#000000',
    label: 'paid | ',
    centerType: 'logo',
    centerColor: '#000000',
  },
  upcoming: {
    bg: '#202020', // colours/black/500
    ringStroke: '#797979',
    textFill: '#878787',
    label: 'due soon | ',
    centerType: 'count', // Figma 694:6667: shows number, not logo
    centerColor: '#878787', // colours/neutral/600
  },
  late: {
    bg: '#892B2E', // colour/icons/error/default-3
    ringStroke: '#EF9194',
    textFill: '#EF9194',
    label: 'late | ',
    centerType: 'count',
    centerColor: '#EF9194', // colour/icons/error/default-2
  },
  missed: {
    bg: '#FFC04D', // colours/warning/400
    ringStroke: '#332306',
    textFill: '#332306',
    label: 'missed | ',
    centerType: 'count',
    centerColor: '#332306', // colours/warning/900
  },
};

// Circular path d-string: clockwise circle starting at top
const TEXT_PATH_D = `M ${CX},${CY - TEXT_R} a ${TEXT_R},${TEXT_R} 0 1,1 0,${TEXT_R * 2} a ${TEXT_R},${TEXT_R} 0 1,1 0,${-TEXT_R * 2}`;

// Scale the logo to fit ~32px wide within the badge center
const LOGO_SCALE = 1.0;

function PaymentBadgeComponent({
  variant,
  count = 1,
  size = 94,
}: PaymentBadgeProps) {
  const cfg = BADGE_CONFIGS[variant];
  const pathId = `badge-text-${variant}`;

  // Use exact repeat count so text fills the circle without overflowing mid-word.
  // Circumference ≈ 314 units. At fontSize 12, avg char width ≈ 6.8 units → ~46 chars fit.
  // floor() ensures the last repeat completes fully — small gap beats partial "mi".
  const maxChars = Math.floor((2 * Math.PI * TEXT_R) / 6.8); // ~46
  const repeatCount = Math.max(Math.floor(maxChars / cfg.label.length), 3);
  const fullLabel = cfg.label.repeat(repeatCount);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      <Defs>
        <Path id={pathId} d={TEXT_PATH_D} />
      </Defs>

      {/* 1. Solid background circle */}
      <Circle cx={CX} cy={CY} r={CX} fill={cfg.bg} />

      {/* 2. Circular text along path (between the two rings) */}
      <SvgText
        fill={cfg.textFill}
        fontSize={TEXT_FONT_SIZE}
        fontFamily="PlusJakartaSans-Medium"
        fontWeight="500"
      >
        <TextPath href={`#${pathId}`}>{fullLabel}</TextPath>
      </SvgText>

      {cfg.ringStroke !== 'transparent' && (
        <>
          {/* 3. Outer decorative ring — Figma Ellipse 21916 */}
          <Circle
            cx={CX}
            cy={CY}
            r={OUTER_R}
            fill="none"
            stroke={cfg.ringStroke}
            strokeWidth={RING_STROKE_W}
          />

          {/* 4. Inner decorative ring — Figma Ellipse 21915 */}
          <Circle
            cx={CX}
            cy={CY}
            r={INNER_R}
            fill="none"
            stroke={cfg.ringStroke}
            strokeWidth={RING_STROKE_W}
          />
        </>
      )}

      {/* 4. Inner decorative ring — Figma Ellipse 21915 */}
      <Circle
        cx={CX}
        cy={CY}
        r={INNER_R}
        fill="none"
        stroke={cfg.ringStroke}
        strokeWidth={RING_STROKE_W}
        opacity={cfg.centerType === 'count' ? 0.3 : 1}
      />

      {/* 5. Center content — FL logo (paid/upcoming) or count number (late/missed) */}
      {cfg.centerType === 'logo' ? (
        <G
          transform={`translate(${CX}, ${CY}) scale(${LOGO_SCALE}) translate(${-LOGO_CENTER_X}, ${-LOGO_CENTER_Y})`}
        >
          <Path d={FL_LOGO_PATH} fill={cfg.centerColor} />
        </G>
      ) : (
        <SvgText
          x={CX}
          y={CY + 16}
          fill={cfg.centerColor}
          fontSize={48}
          fontFamily="PlusJakartaSans-Regular"
          fontWeight="400"
          textAnchor="middle"
          letterSpacing={-2}
        >
          {String(count)}
        </SvgText>
      )}
    </Svg>
  );
}

export const PaymentBadge = memo(PaymentBadgeComponent);
