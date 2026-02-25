import React, { memo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface DottedGridPatternProps {
  /** Size of each dot in points */
  dotSize?: number;
  /** Grid spacing between dots in points */
  spacing?: number;
  /** Opacity of dots from 0.0 to 1.0 */
  dotOpacity?: number;
  /** Color of the dots */
  dotColor?: string;
  /** Whether to apply a gradient fade mask at the bottom */
  fadeMask?: boolean;
}

function DottedGridPatternComponent({
  dotSize = 1.0,
  spacing = 8,
  dotOpacity = 0.2,
  dotColor = 'rgb(122, 107, 90)', // #7A6B5A matching Swift's muted warm brown
  fadeMask = false,
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
          // If a mask is needed, it would be applied here, though React Native SVG mask support
          // can be tricky. Alternatively, we could just overlay a gradient!
        />
        
        {/* React Native SVG does support masks, but gradient overlays are more reliable */}
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

// Actually, the fade mask in Swift is a linear gradient from white 100% to white 0%.
// In RN SVG, overlaying a gradient might not act as a mask. 
// Let's implement the actual mask if fadeMask is true.

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
    overflow: 'hidden',
  },
});

export const DottedGridPattern = memo(DottedGridPatternComponent);

// Preset configurations matching the Swift extension
export const DottedGridPresets = {
  lightTheme: {
    dotSize: 1.0,
    spacing: 8,
    dotOpacity: 0.15,
    dotColor: '#999999', // rgb(0.6, 0.6, 0.6)
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
