import React, { memo, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, Pattern, Circle, Rect, LinearGradient, RadialGradient, Stop, Mask } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Spotlight size scaled proportionally to screen width (700 / 393 = ~1.78) */
const SPOTLIGHT_SIZE = Math.round(SCREEN_WIDTH * 1.78);

export interface DottedGridPatternProps {
  dotSize?: number;
  spacing?: number;
  dotOpacity?: number;
  dotColor?: string;
  fadeMask?: boolean;
  /** Enable drifting spotlight animation (default: true) */
  animated?: boolean;
}

function DottedGridPatternComponent({
  dotSize = 1.0,
  spacing = 8,
  dotOpacity = 0.2,
  dotColor = 'rgb(122, 107, 90)',
  fadeMask = false,
  animated = true,
}: DottedGridPatternProps) {
  const patternId = `dotted-pattern-${dotSize}-${spacing}-${dotOpacity}`;
  const maskId = `fade-mask-${Math.random().toString(36).slice(2)}`;

  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id={patternId}
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <Circle
              cx={spacing / 2}
              cy={spacing / 2}
              r={dotSize / 2}
              fill={dotColor}
              fillOpacity={dotOpacity}
            />
          </Pattern>

          {fadeMask && (
            <LinearGradient id={maskId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="white" stopOpacity="1" />
              <Stop offset="0.4" stopColor="white" stopOpacity="1" />
              <Stop offset="1" stopColor="white" stopOpacity="0" />
            </LinearGradient>
          )}
        </Defs>

        <Rect
          width="100%"
          height="100%"
          fill={`url(#${patternId})`}
        />

        {fadeMask && (
          <Rect
            width="100%"
            height="100%"
            fill={`url(#${maskId})`}
          />
        )}
      </Svg>

      {animated && (
        <>
          <Spotlight size={SPOTLIGHT_SIZE} durationX={5000} durationY={7000} startX={0.0} startY={-0.2} minY={-0.2} maxY={0.8} dotOpacity={0.6} />
          <Spotlight size={SPOTLIGHT_SIZE} durationX={5500} durationY={7500} startX={0.3} startY={0.7} minY={0.0} maxY={0.9} dotOpacity={0.6} />
        </>
      )}
    </View>
  );
}

// ==============================================
// SPOTLIGHT
// Two 700px radial spotlights sweep top-to-bottom in
// Lissajous curves. Orange dots glow where they pass,
// masked by a RadialGradient for soft falloff.
// ==============================================

interface SpotlightProps {
  size: number;
  durationX: number;
  durationY: number;
  startX: number;
  startY: number;
  minY: number;
  maxY: number;
  dotOpacity: number;
}

const Spotlight = memo(function Spotlight({
  size, durationX, durationY, startX, startY, minY, maxY, dotOpacity,
}: SpotlightProps) {
  const tx = useSharedValue(SCREEN_WIDTH * startX);
  const ty = useSharedValue(SCREEN_HEIGHT * startY);

  const gradId = `spot-grad-${size}-${minY}`;
  const maskSvgId = `spot-mask-${size}-${minY}`;
  const patId = `spot-dots-${size}-${minY}`;

  useEffect(() => {
    tx.value = withRepeat(
      withSequence(
        withTiming(SCREEN_WIDTH - size * 0.5, {
          duration: durationX,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(-size * 0.3, {
          duration: durationX,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
    ty.value = withRepeat(
      withSequence(
        withTiming(SCREEN_HEIGHT * maxY, {
          duration: durationY,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(SCREEN_HEIGHT * minY, {
          duration: durationY,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size }, animStyle]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="white" stopOpacity="1" />
            <Stop offset="0.3" stopColor="white" stopOpacity="0.6" />
            <Stop offset="0.6" stopColor="white" stopOpacity="0.2" />
            <Stop offset="1" stopColor="white" stopOpacity="0" />
          </RadialGradient>
          <Mask id={maskSvgId}>
            <Rect width={size} height={size} fill={`url(#${gradId})`} />
          </Mask>
          <Pattern id={patId} width={8} height={8} patternUnits="userSpaceOnUse">
            <Circle cx={4} cy={4} r={0.5} fill="#FF9A6D" fillOpacity={dotOpacity} />
          </Pattern>
        </Defs>
        <Rect
          width={size}
          height={size}
          fill={`url(#${patId})`}
          mask={`url(#${maskSvgId})`}
        />
      </Svg>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
    overflow: 'hidden',
  },
});

export const DottedGridPattern = memo(DottedGridPatternComponent);

export const DottedGridPresets = {
  lightTheme: {
    dotSize: 1.0,
    spacing: 8,
    dotOpacity: 0.15,
    dotColor: '#999999',
  },
  darkTheme: {
    dotSize: 1.0,
    spacing: 8,
    dotOpacity: 0.2,
    dotColor: '#7A6B5A',
  },
  accent: (color: string, opacity: number = 0.25) => ({
    dotSize: 1.5,
    spacing: 10,
    dotOpacity: opacity,
    dotColor: color,
  }),
  dense: {
    dotSize: 0.75,
    spacing: 4,
    dotOpacity: 0.25,
    dotColor: '#7A6B5A',
  },
  sparse: {
    dotSize: 1.0,
    spacing: 16,
    dotOpacity: 0.1,
    dotColor: '#7A6B5A',
  },
};
