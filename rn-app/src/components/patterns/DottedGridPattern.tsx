import React, { memo, useId } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  Pattern,
  Circle,
  Rect,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';

export interface DottedGridPatternProps {
  dotSize?: number;
  spacing?: number;
  dotOpacity?: number;
  dotColor?: string;
  fadeMask?: boolean;
  /** @deprecated Spotlight animation removed to fix release-mode crashes */
  animated?: boolean;
}

function DottedGridPatternComponent({
  dotSize = 1.0,
  spacing = 8,
  dotOpacity = 0.2,
  dotColor = 'rgb(122, 107, 90)',
  fadeMask = false,
}: DottedGridPatternProps) {
  const id = useId();
  const patternId = `dotted-pattern-${id}`;
  const maskId = `fade-mask-${id}`;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Static SVG dot grid — no animation, safe */}
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
            <SvgLinearGradient id={maskId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="white" stopOpacity="1" />
              <Stop offset="0.4" stopColor="white" stopOpacity="1" />
              <Stop offset="1" stopColor="white" stopOpacity="0" />
            </SvgLinearGradient>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
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
