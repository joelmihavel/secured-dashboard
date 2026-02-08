/**
 * Design System Colors
 * Source: Figma Design File - Flent-Secured_v1.2
 * Matches iOS AppColors.swift exactly
 */

export const colors = {
  // Black Scale (Dark Theme Primary)
  black: {
    900: '#000000', // Pure black (overlays)
    800: '#0D0D0D', // Near-black (gradient end)
    700: '#131313', // Primary dark background
    600: '#1A1A1A', // Secondary background (cards, surfaces)
    500: '#202020', // Disabled button background
    400: '#4D4D4D', // Border/divider color
    350: '#656565', // Mid-gray (secondary icons)
    300: '#797979', // Muted text color
    200: '#A6A6A6', // Secondary text color
  },

  // Neutral Scale
  neutral: {
    100: '#EEEEEE', // Light background
    200: '#DDDDDD', // High emphasis text
    300: '#CBCBCB', // Medium emphasis, underlines
    400: '#BABABA', // Light gray (subtle text)
    500: '#A9A9A9', // Gray text (headline variant)
    600: '#878787', // Medium gray
    800: '#444444', // Dark gray text
    900: '#222222', // Near-black (input text on light)
  },

  // Brand Colors (Orange/Coral Accent)
  brand: {
    300: '#FFCC8A', // Lightest accent (subtle highlights)
    400: '#FFAE8A', // Accent light (gradient top)
    500: '#FF9A6D', // Primary accent
    600: '#CC7B57', // Accent dark (pressed state)
    700: '#F06321', // Deep orange (warnings, emphasis)
    800: '#E9661C', // Darker orange (active states)
  },

  // Semantic Colors
  success: {
    default: '#70BF73',
    approved: '#06C270',
    dark: '#27803B',    // Dark green (contrast text)
    material: '#4CAF50', // Material green
  },
  error: {
    default: '#FF8080',
    radix: '#E5484D',   // Radix red (alerts)
    dark: '#AE282E',    // Dark red (emphasis)
  },
  warning: {
    default: '#FFD580',
    amber: '#FFB020',   // Amber (strong warnings)
  },

  // Base
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

// Semantic Aliases for easier usage
export const semanticColors = {
  background: {
    primary: colors.black[700],
    secondary: colors.black[600],
    elevated: colors.black[500],
  },
  text: {
    primary: colors.white,
    secondary: colors.black[200],
    muted: colors.black[300],
    disabled: colors.black[300],
    onAccent: colors.black[700],
    accent: colors.brand[500],
  },
  accent: {
    primary: colors.brand[500],
    light: colors.brand[400],
    dark: colors.brand[600],
  },
  border: {
    default: colors.black[400],
    active: colors.brand[500],
    error: colors.error.default,
  },
  state: {
    disabled: colors.black[500],
    error: colors.error.default,
    success: colors.success.default,
    warning: colors.warning.default,
  },
} as const;

// Gradient definitions (EXACT Figma values)
export const gradients = {
  // Primary button: dark gradient with orange border (NOT orange fill)
  button: {
    colors: ['#202020', '#0d0d0d'] as const,
    locations: [0, 0.9018] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  buttonDisabled: {
    colors: ['#202020', '#202020'] as const,
    locations: [0, 1] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  // Active state button (filled form): orange gradient
  buttonActive: {
    colors: [colors.brand[500], colors.brand[600]] as const,
    locations: [0, 1] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
} as const;

// Opacity Tokens
export const opacity = {
  disabled: 0.5,
  overlay: 0.5,
  shimmer: 0.5,
  pressed: 0.9,
  iconBackground: 0.2,
} as const;

export type ColorKey = keyof typeof colors;
export type SemanticColorKey = keyof typeof semanticColors;
