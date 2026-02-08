/**
 * Logo Component
 * Flent stylized logo - exact SVG from Figma design
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/src/theme';

export interface LogoProps {
  size?: number;
  color?: string;
}

function LogoComponent({ size = 48, color = colors.white }: LogoProps) {
  // Figma exact: Logo is 32w x 38.4h — aspect ratio 0.8333
  const FIGMA_WIDTH = 32;
  const FIGMA_HEIGHT = 38.4;
  const VIEWBOX_HEIGHT = 40; // SVG viewBox is 40 units tall
  const scale = size / FIGMA_HEIGHT;
  const width = FIGMA_WIDTH * scale;
  const height = FIGMA_HEIGHT * scale;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 34 40" fill="none">
        {/* Flent logo - exact path from Figma asset */}
        <Path
          d="M12.4751 40H3.72631V21.2062H0V16.0217H3.72631C1.65252 7.98576 7.50667 3.16855 10.693 1.76445C20.025 -3.16081 29.7028 3.38457 33.3751 7.27293V40H24.6263V11.6473C19.5714 3.35216 13.2312 5.27474 10.693 7.27293C7.45266 12.8463 12.0431 15.4277 14.7433 16.0217H19.2798V21.2062H12.4751V40Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const Logo = memo(LogoComponent);
