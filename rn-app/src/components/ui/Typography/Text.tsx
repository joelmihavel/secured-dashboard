/**
 * Text Component
 * Design system typography wrapper
 */

import React, { memo } from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { typography, TypographyVariant, colors, semanticColors } from '@/src/theme';

type TextColor =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'disabled'
  | 'accent'
  | 'error'
  | 'success'
  | 'onAccent';

interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}

const colorMap: Record<TextColor, string> = {
  primary: semanticColors.text.primary,
  secondary: semanticColors.text.secondary,
  muted: semanticColors.text.muted,
  disabled: semanticColors.text.disabled,
  accent: semanticColors.text.accent,
  onAccent: semanticColors.text.onAccent,
  error: colors.error.default,
  success: colors.success.default,
};

function TextComponent({
  variant = 'bodyMdRegular',
  color = 'primary',
  align = 'left',
  style,
  children,
  ...props
}: TextProps) {
  const typographyStyle = typography[variant];
  const textColor = colorMap[color];

  return (
    <RNText
      style={[
        {
          fontSize: typographyStyle.fontSize,
          lineHeight: typographyStyle.lineHeight,
          letterSpacing: typographyStyle.letterSpacing,
          fontFamily: typographyStyle.fontFamily,
          fontWeight: typographyStyle.fontWeight,
          color: textColor,
          textAlign: align,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

export const Text = memo(TextComponent);

// Convenience components for common variants
export const Heading1 = memo((props: Omit<TextProps, 'variant'>) => (
  <Text variant="h1" {...props} />
));

export const Heading2 = memo((props: Omit<TextProps, 'variant'>) => (
  <Text variant="h2" {...props} />
));

export const Heading3 = memo((props: Omit<TextProps, 'variant'>) => (
  <Text variant="h3" {...props} />
));

export const Heading5 = memo((props: Omit<TextProps, 'variant'>) => (
  <Text variant="h5" {...props} />
));

export const BodyText = memo((props: Omit<TextProps, 'variant'>) => (
  <Text variant="bodyMdRegular" {...props} />
));

export const Caption = memo((props: Omit<TextProps, 'variant'>) => (
  <Text variant="caption" {...props} />
));
