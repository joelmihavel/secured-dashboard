/**
 * Test fixtures for BetaSplashScreen
 * Source: PM brief 1-28071-pm-brief.json
 * Source: Backend brief 1-28071-backend-brief.json
 * Source: Screen code app/(auth)/beta-splash.tsx
 */

// --- Default state (the only state: "beta") ---
// Beta splash is a static animated screen with no data fetching.
// It shows a logo + "BETA LAUNCH" badge, then auto-navigates after 2500ms.

export const EXPECTED_TEXT = {
  badgeText: 'BETA LAUNCH',
};

export const EXPECTED_NAVIGATION = {
  autoRedirect: '/(auth)/splash',
  autoRedirectDelay: 2500, // milliseconds
};

// --- testIDs found in screen code ---
export const TEST_IDS = {
  screen: 'beta-splash-screen',
  // Note: no other interactive testIDs - this is a non-interactive splash screen
};

// --- No loading/error/empty states for this screen ---
// Beta splash has a single state: display logo + badge, then navigate.
// No hooks fetch data; no error or loading branches exist in the code.
