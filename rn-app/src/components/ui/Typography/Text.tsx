/**
 * Text Component
 * Design system typography wrapper
 *
 * Use `inherit` prop when nesting <Text> inside another <Text> for
 * multicolor/styled spans. This skips the variant defaults so the
 * child inherits fontSize, lineHeight, fontFamily etc. from the parent.
 */

import React, { memo } from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { typography, TypographyVariant, colors, semanticColors } from '@/src/theme';
import { sf } from '@/src/theme/scale';

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
  /** When true, skip variant defaults and inherit text styles from parent Text. */
  inherit?: boolean;
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
  color,
  align = 'left',
  inherit = false,
  style,
  children,
  ...props
}: TextProps) {
  // Nested span mode: only apply color + style, inherit everything else from parent
  if (inherit) {
    return (
      <RNText
        allowFontScaling={true}
        maxFontSizeMultiplier={1.2}
        style={[color ? { color: colorMap[color] } : undefined, style]}
        {...props}
      >
        {children}
      </RNText>
    );
  }

  const typographyStyle = typography[variant];
  const textColor = color ? colorMap[color] : colorMap.primary;

  // fontWeight is intentionally NOT applied here.
  // Per buildbot-learnings: "Map Figma fontWeight to fontFamily, never to RN fontWeight."
  // RN's fontWeight resolves to system fonts, not custom font files.
  // fontFamily already encodes the weight (e.g., PlusJakartaSans-Medium = 500).
  return (
    <RNText
      allowFontScaling={true}
      maxFontSizeMultiplier={1.2}
      style={[
        {
          fontSize: sf(typographyStyle.fontSize),
          lineHeight: typographyStyle.lineHeight ? sf(typographyStyle.lineHeight) : undefined,
          letterSpacing: typographyStyle.letterSpacing,
          fontFamily: typographyStyle.fontFamily,
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
