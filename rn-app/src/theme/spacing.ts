/**
 * Design System Spacing
 * Source: Figma Design File - Flent-Secured_v1.2
 * Matches iOS Spacing.swift exactly
 */

export const spacing = {
  zero: 0,
  xxxs: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
  huge: 64,
} as const;

// Semantic aliases for common use cases
export const layout = {
  // Screen padding
  screenHorizontal: spacing.xxl,       // 40pt - onboarding screens
  screenHorizontalCompact: spacing.lg, // 24pt - main app screens
  screenTop: spacing.md,               // 16pt
  screenBottom: spacing.xl,            // 32pt

  // Components
  cardPadding: spacing.md,             // 16pt
  stackSpacing: spacing.sm,            // 12pt
  buttonPadding: spacing.md,           // 16pt
  inputPadding: spacing.md,            // 16pt
  sectionSpacing: spacing.xxl,         // 40pt
  iconSpacing: spacing.xs,             // 8pt

  // Form spacing
  formFieldSpacing: spacing.lg,        // 24pt between form fields
  labelSpacing: spacing.xs,            // 8pt between label and input

  // Bottom sheet
  sheetHandleSpacing: spacing.sm,      // 12pt
  sheetContentPadding: spacing.lg,     // 24pt
} as const;

export type SpacingKey = keyof typeof spacing;
export type LayoutKey = keyof typeof layout;
