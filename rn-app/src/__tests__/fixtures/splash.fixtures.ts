/**
 * Test fixtures for SplashScreen
 * Source: Blueprint 1-28053 (default state), 1-28055 (animation/rendered state)
 * Figma route: /(auth)/splash
 *
 * The splash screen is a static presentation screen with no data fetching,
 * no loading/error/empty states. It has 2 Figma states:
 *   - 1-28053: "default" (flow label frame, not user-facing)
 *   - 1-28055: "animation" (the actual rendered splash screen)
 *
 * Both map to the same splash.tsx component.
 */

// --- Expected text content from Figma blueprint 1-28055 ---
export const EXPECTED_TEXT = {
  // Heading gray portion (node 1:28066 spans 0-15): "Make  your rent "
  headingGray1: 'Make',
  headingGray2: 'your rent',
  // Heading accent portion (node 1:28066 spans 17-30): "work for you->"
  headingAccent: 'work for you',
  // Subheading (node 1:28067): full text with curly apostrophe
  subheading:
    'Secured is India\u2019s first rent payment app built to reward reliable tenants.',
  // Button text (node I1:28069;100:1565)
  ctaLabel: 'Get Started',
  // Login text (node 1:28070)
  loginPrompt: 'Already a user?',
  loginLink: 'Log in',
} as const;

// --- Navigation targets from Figma flow ---
export const EXPECTED_NAVIGATION = {
  getStarted: '/(auth)/carousel',
  login: '/(auth)/sign-up',
} as const;

// --- testID values expected on the screen ---
export const EXPECTED_TEST_IDS = {
  screen: 'splash-screen',
  getStartedButton: 'get-started-button',
} as const;

// --- Static screen: no loading, error, or empty states ---
// Splash has no data hooks, no API calls, no dynamic data.
// Loading/error/empty tests will assert the screen is always rendered
// identically (since there is no conditional rendering based on data).
export const SCREEN_METADATA = {
  screenId: '1-28055',
  defaultStateId: '1-28053',
  route: '/(auth)/splash',
  hasDataFetching: false,
  hasLoadingState: false,
  hasErrorState: false,
  hasEmptyState: false,
  states: ['default', 'animation'],
  interactiveElements: ['get-started-button', 'login-pressable'],
  exitPoints: ['/(auth)/carousel', '/(auth)/sign-up'],
} as const;
