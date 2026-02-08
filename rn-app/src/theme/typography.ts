/**
 * Design System Typography
 * Source: Figma Design File - Flent-Secured_v1.2
 * Primary Font: Plus Jakarta Sans
 */

import { TextStyle } from 'react-native';

export const fontFamily = {
  primary: {
    regular: 'PlusJakartaSans-Regular',
    medium: 'PlusJakartaSans-Medium',
    semibold: 'PlusJakartaSans-SemiBold',
    bold: 'PlusJakartaSans-Bold',
  },
  secondary: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
} as const;

// Typography style definition
interface TypographyStyle {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily: string;
  fontWeight: TextStyle['fontWeight'];
}

export const typography: Record<string, TypographyStyle> = {
  // Headlines
  h1: {
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  h2: {
    fontSize: 40,
    lineHeight: 52,
    letterSpacing: -1.5,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  h3: {
    fontSize: 32,
    lineHeight: 44,
    letterSpacing: -1,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  h4: {
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  h5: {
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: -0.5,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  h6: {
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.semibold,
    fontWeight: '600',
  },

  // Body Text
  bodyLg: {
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  bodyLgMedium: {
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.medium,
    fontWeight: '500',
  },
  bodyLgSemibold: {
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.semibold,
    fontWeight: '600',
  },
  bodyMd: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.semibold,
    fontWeight: '600',
  },
  bodyMdRegular: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  bodyMdMedium: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.medium,
    fontWeight: '500',
  },
  bodyMd2: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  bodyMd2Medium: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.medium,
    fontWeight: '500',
  },
  bodySm: {
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  bodySmMedium: {
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.medium,
    fontWeight: '500',
  },
  bodySmSemiBold: {
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.semibold,
    fontWeight: '600',
  },

  // Labels & Captions
  label: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.semibold,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.semibold,
    fontWeight: '600',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  captionSm: {
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.regular,
    fontWeight: '400',
  },
  overline: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
    fontFamily: fontFamily.primary.semibold,
    fontWeight: '600',
  },

  // Special Purpose
  button: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.medium,
    fontWeight: '500',
  },
  buttonSmall: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.medium,
    fontWeight: '500',
  },
  otpInput: {
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: 0,
    fontFamily: fontFamily.primary.medium,
    fontWeight: '500',
  },

  // Amount displays
  amountLarge: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -1,
    fontFamily: fontFamily.primary.bold,
    fontWeight: '700',
  },
  amountMedium: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.5,
    fontFamily: fontFamily.primary.semibold,
    fontWeight: '600',
  },
} as const;

export type TypographyVariant = keyof typeof typography;
