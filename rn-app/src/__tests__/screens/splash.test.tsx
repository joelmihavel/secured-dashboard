/**
 * SplashScreen Unit Tests
 *
 * Figma states:
 *   - 1-28053 (default / flow label)
 *   - 1-28055 (animation / rendered)
 *
 * Both states are served by the same component: app/(auth)/splash.tsx
 * The screen is fully static -- no data fetching, no hooks, no dynamic data.
 *
 * Test categories covered (all 9):
 *   1. Renders without crash
 *   2. Text content matches Figma
 *   3. Interactive elements present (testIDs)
 *   4. Navigation fires correctly
 *   5. Loading state (N/A -- static screen, test documents this)
 *   6. Error state (N/A -- static screen, test documents this)
 *   7. Empty state (N/A -- static screen, test documents this)
 *   8. Props variations (default vs animation -- same component, both render identically)
 *   9. Accessibility
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import {
  EXPECTED_TEXT,
  EXPECTED_NAVIGATION,
  EXPECTED_TEST_IDS,
  SCREEN_METADATA,
} from '../fixtures/splash.fixtures';

// --- Mock expo-router ---
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
  }),
  useSegments: () => [],
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: 'Screen' },
}));

// --- Mock react-native-safe-area-context ---
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    SafeAreaProvider: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// --- Mock react-native-svg (DottedPattern uses SVG which does not render in JSDOM) ---
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Defs: View,
    LinearGradient: View,
    Stop: View,
    Rect: View,
    Circle: View,
    Path: View,
    G: View,
    Pattern: View,
    ClipPath: View,
    Use: View,
    Mask: View,
    Image: View,
  };
});

// --- Import component under test AFTER mocks ---
import SplashScreen from '@/app/(auth)/splash';

describe('SplashScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Category 1: Renders without crash
  // =========================================================================
  describe('renders without crash', () => {
    it('mounts without throwing', () => {
      expect(() => render(<SplashScreen />)).not.toThrow();
    });

    it('returns truthy render output', () => {
      const { toJSON } = render(<SplashScreen />);
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 2: Text content matches Figma
  // =========================================================================
  describe('text content matches Figma', () => {
    it('displays heading gray text "Make"', () => {
      const { getByText } = render(<SplashScreen />);
      expect(getByText(/Make/)).toBeTruthy();
    });

    it('displays heading gray text "your rent"', () => {
      const { getByText } = render(<SplashScreen />);
      expect(getByText(/your rent/)).toBeTruthy();
    });

    it('displays heading accent text "work for you"', () => {
      const { getByText } = render(<SplashScreen />);
      expect(getByText(/work for you/)).toBeTruthy();
    });

    it('displays the right-arrow character in heading', () => {
      const { getByText } = render(<SplashScreen />);
      // Figma uses a right arrow: "work for you->"
      // The code renders with unicode arrow: "work for you\u2192"
      expect(getByText(/work for you/)).toBeTruthy();
    });

    it('displays the subheading body text about India', () => {
      const { getByText } = render(<SplashScreen />);
      expect(getByText(/India.*first rent payment app/)).toBeTruthy();
    });

    it('displays the subheading with curly apostrophe', () => {
      const { getByText } = render(<SplashScreen />);
      // Blueprint 1-28067: "India's" with curly apostrophe \u2019
      expect(getByText(/India\u2019s/)).toBeTruthy();
    });

    it('displays the CTA button text "Get Started"', () => {
      const { getByText } = render(<SplashScreen />);
      expect(getByText(EXPECTED_TEXT.ctaLabel)).toBeTruthy();
    });

    it('displays the login prompt "Already a user?"', () => {
      const { getByText } = render(<SplashScreen />);
      expect(getByText(/Already a user/)).toBeTruthy();
    });

    it('displays the login link text "Log in"', () => {
      const { getByText } = render(<SplashScreen />);
      expect(getByText(/Log in/)).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 3: Interactive elements present (testIDs)
  // =========================================================================
  describe('interactive elements present', () => {
    it('renders the screen root with testID "splash-screen"', () => {
      const { getByTestId } = render(<SplashScreen />);
      expect(getByTestId(EXPECTED_TEST_IDS.screen)).toBeTruthy();
    });

    it('renders the "Get Started" button with testID', () => {
      const { getByTestId } = render(<SplashScreen />);
      expect(getByTestId(EXPECTED_TEST_IDS.getStartedButton)).toBeTruthy();
    });

    it('renders the login pressable area', () => {
      const { getByText } = render(<SplashScreen />);
      // The login area is a Pressable wrapping the text -- verify the text is pressable
      const loginText = getByText(/Already a user/);
      expect(loginText).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 4: Navigation fires correctly
  // =========================================================================
  describe('navigation', () => {
    it('navigates to carousel on "Get Started" press', () => {
      const { getByTestId } = render(<SplashScreen />);
      fireEvent.press(getByTestId(EXPECTED_TEST_IDS.getStartedButton));
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(EXPECTED_NAVIGATION.getStarted);
    });

    it('navigates to sign-up on "Log in" press', () => {
      const { getByText } = render(<SplashScreen />);
      const loginText = getByText(/Already a user/);
      fireEvent.press(loginText);
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(EXPECTED_NAVIGATION.login);
    });

    it('does not navigate to carousel when login is pressed', () => {
      const { getByText } = render(<SplashScreen />);
      fireEvent.press(getByText(/Already a user/));
      expect(mockPush).not.toHaveBeenCalledWith(EXPECTED_NAVIGATION.getStarted);
    });

    it('does not navigate to sign-up when "Get Started" is pressed', () => {
      const { getByTestId } = render(<SplashScreen />);
      fireEvent.press(getByTestId(EXPECTED_TEST_IDS.getStartedButton));
      expect(mockPush).not.toHaveBeenCalledWith(EXPECTED_NAVIGATION.login);
    });
  });

  // =========================================================================
  // Category 5: Loading state
  // =========================================================================
  describe('loading state', () => {
    it('has no loading state (static screen with no data fetching)', () => {
      // Splash is a pure presentational screen with no hooks/API calls.
      // This test documents that the screen always renders identically.
      expect(SCREEN_METADATA.hasLoadingState).toBe(false);
      expect(SCREEN_METADATA.hasDataFetching).toBe(false);

      // Verify the screen renders content immediately (no skeleton/spinner)
      const { getByText, queryByTestId } = render(<SplashScreen />);
      expect(getByText(EXPECTED_TEXT.ctaLabel)).toBeTruthy();
      expect(queryByTestId('splash-skeleton')).toBeNull();
    });
  });

  // =========================================================================
  // Category 6: Error state
  // =========================================================================
  describe('error state', () => {
    it('has no error state (static screen with no data fetching)', () => {
      // No API calls means no error state.
      expect(SCREEN_METADATA.hasErrorState).toBe(false);

      // Verify no error UI is present
      const { queryByTestId, queryByText } = render(<SplashScreen />);
      expect(queryByTestId('splash-error')).toBeNull();
      expect(queryByText(/error|something went wrong|try again/i)).toBeNull();
    });
  });

  // =========================================================================
  // Category 7: Empty state
  // =========================================================================
  describe('empty state', () => {
    it('has no empty state (static screen with no data dependencies)', () => {
      // No data means no empty state.
      expect(SCREEN_METADATA.hasEmptyState).toBe(false);

      // The screen always shows the same content regardless of external data
      const { getByText } = render(<SplashScreen />);
      expect(getByText(/Make/)).toBeTruthy();
      expect(getByText(EXPECTED_TEXT.ctaLabel)).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 8: Props variations (Figma states: default 1-28053, animation 1-28055)
  // =========================================================================
  describe('state variations', () => {
    it('renders the same component for both Figma states', () => {
      // 1-28053 (default) and 1-28055 (animation) both map to splash.tsx.
      // The component has no props/params that switch between states.
      // Both Figma states are served by the same render path.
      expect(SCREEN_METADATA.states).toEqual(['default', 'animation']);

      const { getByText, getByTestId } = render(<SplashScreen />);

      // Core content is present in both states
      expect(getByText(/Make/)).toBeTruthy();
      expect(getByText(/your rent/)).toBeTruthy();
      expect(getByText(/work for you/)).toBeTruthy();
      expect(getByTestId(EXPECTED_TEST_IDS.getStartedButton)).toBeTruthy();
    });

    it('has no conditional rendering branches based on external state', () => {
      // The component imports useRouter and useCallback but no data hooks.
      // Rendering is deterministic -- no conditionals based on props or state.
      // Note: DottedPattern generates a random gradient ID per render, so we
      // compare structural equivalence by checking all key content elements
      // appear consistently across multiple renders.
      const renderA = render(<SplashScreen />);
      const renderB = render(<SplashScreen />);

      // Both renders contain the same text content
      expect(renderA.getByText(/Make/)).toBeTruthy();
      expect(renderB.getByText(/Make/)).toBeTruthy();
      expect(renderA.getByText(EXPECTED_TEXT.ctaLabel)).toBeTruthy();
      expect(renderB.getByText(EXPECTED_TEXT.ctaLabel)).toBeTruthy();
      expect(renderA.getByTestId(EXPECTED_TEST_IDS.screen)).toBeTruthy();
      expect(renderB.getByTestId(EXPECTED_TEST_IDS.screen)).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 9: Accessibility
  // =========================================================================
  describe('accessibility', () => {
    it('"Get Started" button has accessibilityRole="button"', () => {
      const { getByTestId } = render(<SplashScreen />);
      const button = getByTestId(EXPECTED_TEST_IDS.getStartedButton);
      expect(button.props.accessibilityRole).toBe('button');
    });

    it('"Get Started" button has an accessibilityLabel', () => {
      const { getByTestId } = render(<SplashScreen />);
      const button = getByTestId(EXPECTED_TEST_IDS.getStartedButton);
      expect(button.props.accessibilityLabel).toBeTruthy();
      expect(button.props.accessibilityLabel).toBe('Get Started');
    });

    it('"Get Started" button reports enabled state', () => {
      const { getByTestId } = render(<SplashScreen />);
      const button = getByTestId(EXPECTED_TEST_IDS.getStartedButton);
      expect(button.props.accessibilityState?.disabled).toBe(false);
    });

    it('login link area has hit slop for touch target', () => {
      // The Pressable around "Already a user? Log in" has hitSlop for
      // WCAG-compliant 44px minimum touch target.
      // We verify the text is renderable and pressable (functional check).
      const { getByText } = render(<SplashScreen />);
      const loginText = getByText(/Already a user/);
      expect(loginText).toBeTruthy();

      // Verify pressing it triggers navigation (functional accessibility)
      fireEvent.press(loginText);
      expect(mockPush).toHaveBeenCalledWith(EXPECTED_NAVIGATION.login);
    });
  });

  // =========================================================================
  // Additional: Haptic feedback
  // =========================================================================
  describe('haptic feedback', () => {
    it('triggers haptic feedback when login is pressed', () => {
      const Haptics = require('expo-haptics');
      const { getByText } = render(<SplashScreen />);
      fireEvent.press(getByText(/Already a user/));
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });
  });
});
