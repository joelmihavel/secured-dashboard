import React from 'react';
import { View } from 'react-native';

const createSvgMock = (name: string) => {
  const Component = ({ children, ...props }: any) => (
    <View {...props}>{children}</View>
  );
  Component.displayName = name;
  return Component;
};

export const Svg = createSvgMock('Svg');
export const Circle = createSvgMock('Circle');
export const Rect = createSvgMock('Rect');
export const Path = createSvgMock('Path');
export const G = createSvgMock('G');
export const Defs = createSvgMock('Defs');
export const Pattern = createSvgMock('Pattern');
export const LinearGradient = createSvgMock('LinearGradient');
export const RadialGradient = createSvgMock('RadialGradient');
export const Stop = createSvgMock('Stop');
export const Mask = createSvgMock('Mask');
export const Line = createSvgMock('Line');
export const Text = createSvgMock('SvgText');
export const TSpan = createSvgMock('TSpan');
export const ClipPath = createSvgMock('ClipPath');
export const Use = createSvgMock('Use');
export const Image = createSvgMock('SvgImage');
export const Ellipse = createSvgMock('Ellipse');
export const Polygon = createSvgMock('Polygon');
export const Polyline = createSvgMock('Polyline');

export default Svg;
