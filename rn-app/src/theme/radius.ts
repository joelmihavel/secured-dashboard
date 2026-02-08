/**
 * Design System Border Radius
 * Source: Figma Design File - Flent-Secured_v1.2
 */

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 40,
  pill: 200,
  full: 9999,
} as const;

// Semantic aliases for common components
export const borderRadius = {
  button: radius.md,       // 12pt
  buttonSmall: radius.sm,  // 8pt
  card: radius.md,         // 12pt
  input: radius.sm,        // 8pt
  otpBox: radius.sm,       // 8pt
  sheet: radius.xl,        // 24pt
  avatar: radius.full,
  chip: radius.pill,
  badge: radius.xs,        // 4pt
} as const;

export type RadiusKey = keyof typeof radius;
export type BorderRadiusKey = keyof typeof borderRadius;
