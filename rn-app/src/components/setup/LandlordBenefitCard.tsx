/**
 * LandlordBenefitCard — notepad-style card used in:
 *   - /(setup)/invite-landlord intro ("Why this helps them?")
 *   - waitlist screens (Figma 4870:79400)
 *
 * Visual breakdown (244×321):
 *   • bg #202020
 *   • 14 perforation ellipses across the top (cut into the card edge)
 *   • paperclip vector top-left at (8, −5.31), rotated 163.65° + scaleY(−1)
 *   • two `Group 59` diagonal-stripe pairs at (44, 28) and (194, 63)
 *   • centred 200-wide column with the `Frame` house+shield icon (40×40)
 *     and a Geist-Pixel body string
 *
 * All vector paths are pulled directly from the Figma assets:
 *   imgFrame      = 34db0eee-d769-4076-b742-e5652efeb581 (house+shield)
 *   imgVector     = 4627e443-b1aa-4b27-9586-39a3aee1c252 (paperclip)
 *   imgGroup59    = 06b18be3-6026-4292-90a4-58b3605dd0ef (scratch lines)
 *   imgEllipse... = e132784a-04f6-4205-b25f-321b5cd2109b (perforation)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '../ui/Typography';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const CARD_W = s(244);
const CARD_H = sv(321);
const PERF_COUNT = 13;
const PERF_SIZE = s(14);
const PERF_SPACING = s(20);
const PERF_START_X = s(4);

function HouseShieldIcon({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M15 35V25C15 24.1159 15.3512 23.2681 15.9763 22.643C16.6014 22.0179 17.4493 21.6667 18.3333 21.6667H20.5683"
        stroke={colors.white}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M32.8033 17.8033L20 5L5 20H8.33333V31.6667C8.33333 32.5507 8.68452 33.3986 9.30964 34.0237C9.93477 34.6488 10.7826 35 11.6667 35H20"
        stroke={colors.white}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M36.6667 26.6667C36.6667 33.3333 32.5 36.6667 30.8333 36.6667C29.1667 36.6667 25 33.3333 25 26.6667C26.6667 26.6667 29.1667 25.8333 30.8333 24.1667C32.5 25.8333 35 26.6667 36.6667 26.6667Z"
        stroke={colors.brand[500]}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PaperclipSvg() {
  return (
    <Svg width={s(12.12)} height={sv(39.59)} viewBox="0 0 12.1221 39.5877" fill="none">
      <Path
        d="M12.0001 20.8239C12.0001 15.5157 12.1835 10.1714 12.0001 4.86609C11.857 0.724895 6.1445 -1.82115 3.22934 1.58326C2.3663 2.59126 2.21666 3.8089 2.20034 5.06962C2.17106 7.33714 2.20034 9.60693 2.20034 11.8746C2.20034 17.1129 2.0327 22.3811 2.20034 27.6169C2.36222 32.6708 9.82718 32.346 10.1837 27.4668C10.5562 22.3691 10.2333 30.9269 10.2333 25.8133C10.2333 25.0327 9.02024 25.0314 9.02024 25.8133C9.02024 29.978 8.97062 20.3351 8.97062 24.4997C8.97062 25.6405 9.18746 27.0356 8.87054 28.1604C8.05334 31.0607 3.54926 30.6122 3.41342 27.617C3.2297 23.5658 3.41342 19.4643 3.41342 15.4098C3.41342 11.8165 3.1589 8.12025 3.41342 4.53381C3.65042 1.19457 8.21282 0.0791738 10.1784 2.81721C10.8033 3.68769 10.7871 4.32034 10.7871 5.29294C10.7871 9.74602 10.7871 14.1992 10.7871 18.6524C10.7871 23.1055 10.7871 27.5588 10.7871 32.0119C10.7871 33.8964 10.7515 35.9761 9.22094 37.3217C7.48142 38.8511 4.38386 38.6648 2.74286 37.1162C0.414742 34.919 1.30802 29.6012 1.30802 26.7913C1.30802 22.2481 1.30802 17.705 1.30802 13.1619C1.30802 12.3813 0.0949403 12.3801 0.0949403 13.1619C0.0949403 18.1381 0.0949403 23.1143 0.0949403 28.0905C0.0949403 31.1371 -0.592898 35.4086 1.73426 37.8296C3.22178 39.377 5.73938 39.923 7.7981 39.3878C10.4531 38.6976 11.7851 36.3359 11.9769 33.722C12.2895 29.4637 12.0001 25.0897 12.0001 20.8239Z"
        fill={colors.black[400]}
      />
    </Svg>
  );
}

function ScratchMarks() {
  return (
    <Svg width={s(20.5)} height={sv(35)} viewBox="0 0 20.7132 35.2132" fill="none">
      <Path d="M20.6066 0.106586L0.106586 20.6066" stroke={colors.black[400]} strokeWidth={0.3} />
      <Path d="M20.6066 14.6066L0.106586 35.1066" stroke={colors.black[400]} strokeWidth={0.3} />
    </Svg>
  );
}

export interface LandlordBenefitCardProps {
  /** Body string with optional `accent` segments rendered in brand orange. */
  body: React.ReactNode;
  /** Card icon (40×40). Defaults to the house+shield mark. Pass a different
   *  node so adjacent cards in a carousel don't all share the same glyph. */
  icon?: React.ReactNode;
  testID?: string;
}

export function LandlordBenefitCard({ body, icon, testID }: LandlordBenefitCardProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.background} />
      {Array.from({ length: PERF_COUNT }).map((_, i) => (
        <View
          key={`p-${i}`}
          style={[styles.perforation, { left: PERF_START_X + i * PERF_SPACING, top: -PERF_SIZE / 2 }]}
        />
      ))}
      <View style={styles.scratchA} pointerEvents="none">
        <ScratchMarks />
      </View>
      <View style={styles.scratchB} pointerEvents="none">
        <ScratchMarks />
      </View>
      <View style={styles.paperclip} pointerEvents="none">
        <View style={styles.paperclipInner}>
          <PaperclipSvg />
        </View>
      </View>
      <View style={styles.content}>
        {icon ?? <HouseShieldIcon size={40} />}
        {typeof body === 'string' ? <Text style={styles.body}>{body}</Text> : body}
      </View>
    </View>
  );
}

/** Convenience styles exported so call-sites can render their own
 *  body text with the same Geist-Pixel typography. Triangle is the only
 *  Geist-Pixel variant we ship (see app/_layout.tsx font registration);
 *  the marquee bands use the same face for visual consistency. */
export const landlordCardBodyStyle = StyleSheet.create({
  body: {
    fontFamily: 'GeistPixel-Triangle',
    fontSize: sf(16),
    lineHeight: sf(24),
    color: colors.neutral[500],
    textAlign: 'center',
  },
  bodyAccent: { color: colors.brand[500] },
});

const styles = StyleSheet.create({
  container: { width: CARD_W, height: CARD_H, overflow: 'hidden' },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black[500],
  },
  perforation: {
    position: 'absolute',
    width: PERF_SIZE,
    height: PERF_SIZE,
    borderRadius: PERF_SIZE / 2,
    backgroundColor: colors.black[700],
  },
  paperclip: {
    position: 'absolute',
    left: s(8),
    top: sv(-5.31),
    width: s(22.775),
    height: sv(41.399),
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperclipInner: {
    transform: [{ rotate: '163.65deg' }, { scaleY: -1 }],
  },
  scratchA: {
    position: 'absolute',
    left: s(44),
    top: sv(28),
    width: s(20.5),
    height: sv(35),
  },
  scratchB: {
    position: 'absolute',
    left: s(194),
    top: sv(63),
    width: s(20.5),
    height: sv(35),
  },
  content: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -100 }, { translateY: -50 }],
    width: 200,
    alignItems: 'center',
    gap: sv(16),
  },
  body: {
    fontFamily: 'GeistPixel-Triangle',
    fontSize: sf(16),
    lineHeight: sf(24),
    color: colors.neutral[500],
    textAlign: 'center',
  },
});

LandlordBenefitCard.WIDTH = CARD_W;
LandlordBenefitCard.HEIGHT = CARD_H;
