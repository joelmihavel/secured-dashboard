/**
 * Landing screen decor — shared between splash (Frame 1) and welcome (Frame 2).
 * Contains the rotated marquee bands, "flent" wordmark, and bg_line crosshair.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Text as RNText, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

// Figma 4651:75993 — black band order: WELCOME×2 / FLAT×3 / WELCOME×3
const W = 'Welcome to the right side of renting';
const F = 'FLAT ₹1000 CASHBACK ON RENT PAYMENTS THIS MONTH';
export const TOP_MARQUEE_ITEMS = [W, W, F, F, F, W, W, W];

// Figma 4651:76002 — orange band order: BECAUSE×2 / FLAT×3 / BECAUSE×2
const B = 'Because responsibility should feel rewarding';
export const BOTTOM_MARQUEE_ITEMS = [B, B, F, F, F, B, B];

/** Continuous horizontal marquee. Renders the items list twice and loops translateX.
 *  Speed is measured in pixels per second so that adding more items (longer text)
 *  doesn't make the band scroll faster — duration self-scales with track width. */
export function Marquee({
  items,
  backgroundColor,
  textColor = colors.white,
  speedPxPerSec = 36,
  reverse = false,
}: {
  items: string[];
  backgroundColor: string;
  textColor?: string;
  /** Scroll speed in pixels per second. Default 36 — matches the comfortable pace
   *  of the splash/welcome bands. Lower = slower. */
  speedPxPerSec?: number;
  reverse?: boolean;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (!trackWidth) return;
    const durationMs = (trackWidth / speedPxPerSec) * 1000;
    tx.setValue(reverse ? -trackWidth : 0);
    const anim = Animated.loop(
      Animated.timing(tx, {
        toValue: reverse ? 0 : -trackWidth,
        duration: durationMs,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [trackWidth, speedPxPerSec, reverse, tx]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== trackWidth) setTrackWidth(w);
  };

  return (
    <View style={[styles.marqueeBand, { backgroundColor }]}>
      <Animated.View style={[styles.marqueeTrack, { transform: [{ translateX: tx }] }]}>
        <View style={styles.marqueeRowInner} onLayout={onTrackLayout}>
          {items.map((t, i) => (
            <RNText key={`a-${i}`} style={[styles.marqueeText, { color: textColor }]} numberOfLines={1}>{t}</RNText>
          ))}
        </View>
        <View style={styles.marqueeRowInner}>
          {items.map((t, i) => (
            <RNText key={`b-${i}`} style={[styles.marqueeText, { color: textColor }]} numberOfLines={1}>{t}</RNText>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

/** Top marquee stack — two rotated bands. Reused on both splash and welcome. */
export function MarqueeStack() {
  return (
    <View style={styles.marqueeStack} pointerEvents="none">
      <View style={[styles.marqueeRow, { transform: [{ rotate: '0.22deg' }] }]}>
        <Marquee items={TOP_MARQUEE_ITEMS} backgroundColor={colors.black[600]} />
      </View>
      <View style={[styles.marqueeRow, { transform: [{ rotate: '-0.48deg' }] }]}>
        <Marquee items={BOTTOM_MARQUEE_ITEMS} backgroundColor={colors.brand[600]} textColor={colors.black[700]} reverse />
      </View>
    </View>
  );
}

/** "flent" wordmark — inline SVG paths from Figma asset. */
export function Wordmark({ width, height, color }: { width: number; height: number; color: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 38.9353 13.5386" fill="none">
      <Path d="M6.10098 0C2.65682 0 0.508704 2.74238 1.29257 5.41885L0 5.42348V7.14498H1.29488V13.5385H4.25115V7.14498H6.54378V5.40729H5.49516C4.04188 5.40729 3.20252 4.59799 3.20252 3.46728C3.20252 2.52271 4.15865 1.79318 5.24196 1.79318C7.66177 1.79318 8.37512 3.88002 8.37512 3.88002V13.5385H11.3314V2.4649C10.6597 1.59086 8.80983 0 6.10098 0Z" fill={color} />
      <Path d="M15.4018 8.97321L21.044 7.27499C21.044 7.165 21.044 7.05622 21.0258 6.94622C20.8796 5.43052 19.7108 3.86042 17.0081 3.86042C14.5061 3.86042 12.4066 5.79554 12.4066 8.84509C12.4066 11.7121 14.5617 13.5385 17.0625 13.5385C19.5633 13.5385 20.8977 12.2971 21.0802 10.3608C20.5508 10.8358 19.6564 11.1283 18.6338 11.1283C17.5194 11.1283 15.9674 10.6352 15.4018 8.97321ZM16.7349 5.3036C17.5569 5.3036 18.1963 5.88741 18.0681 7.5131H15.183C15.183 6.19804 15.8405 5.3036 16.7349 5.3036Z" fill={color} />
      <Path d="M28.1627 4.04294C26.5563 4.04294 25.6607 4.91924 25.2231 5.85115V4.06107L22.1554 4.40796V13.5385H25.2231V6.25243C25.4781 6.17991 25.7163 6.12431 26.0088 6.12431C27.2501 6.12431 27.8351 6.83624 27.8351 8.22382V13.5373H30.9028V7.23752C30.9028 5.00989 29.6796 4.04173 28.1639 4.04173L28.1627 4.04294Z" fill={color} />
      <Path d="M36.4706 4.22556V1.48665L33.4029 1.85167V4.22556H31.9778V5.86938H33.4029V13.5386H36.4706V5.86938H38.9351V4.22556H36.4706Z" fill={color} />
    </Svg>
  );
}

/** Small orange "+" marker — Figma 4651:76010 / 4651:76012. Used decoratively
 *  on splash + welcome screens (and anywhere else the design dots a brand-orange
 *  plus on the canvas). 16×16. */
export function Plus({ style }: { style?: object }) {
  return (
    <View style={[styles.plusWrap, style]} pointerEvents="none">
      <Svg width={s(16)} height={s(16)} viewBox="0 0 16 16" fill="none">
        <Path
          d="M7.33333 7.33333V3.33333H8.66667V7.33333H12.6667V8.66667H8.66667V12.6667H7.33333V8.66667H3.33333V7.33333H7.33333Z"
          fill={colors.brand[500]}
        />
      </Svg>
    </View>
  );
}

/** Subtle crosshair gridlines — Figma "bg_line" decoration. Pass viewBox-relative position via wrapper. */
export function BgLine({ style }: { style?: object }) {
  return (
    <View style={[styles.bgLineWrap, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 405 269" preserveAspectRatio="none">
        <Path
          d="M40.3676 106 V269 M0 226.817 H405 M372.574 0 V269"
          stroke={colors.black[400]}
          strokeWidth={0.5}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  marqueeStack: {
    position: 'absolute',
    top: sv(78),
    left: s(-227),
    right: s(-227),
  },
  marqueeRow: {
    width: s(847),
  },
  marqueeBand: {
    height: sv(39),
    overflow: 'hidden',
    justifyContent: 'center',
  },
  marqueeTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    // Track must be allowed to overflow its parent so the two rowInner
    // copies sit side-by-side; the band's overflow:hidden does the masking.
    alignSelf: 'flex-start',
  },
  marqueeRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(10),
    gap: s(20),
    // Without this, RN's default flexShrink:1 squeezes the two rowInner
    // copies on top of each other when their combined width exceeds the
    // parent — which is what caused the visible text overlap.
    flexShrink: 0,
  },
  marqueeText: {
    // Figma references Geist Pixel:Triangle, but the pixel TTF has no bold cut
    // — swapped to PlusJakartaSans-Bold so the marquee reads as a real bold.
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: sf(10),
    lineHeight: sf(15),
    textTransform: 'uppercase',
  },
  bgLineWrap: {
    position: 'absolute',
    width: s(405),
    height: sv(269),
  },
  plusWrap: {
    position: 'absolute',
    width: s(16),
    height: s(16),
  },
});
