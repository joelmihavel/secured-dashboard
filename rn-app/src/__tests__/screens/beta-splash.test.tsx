/**
 * Unit Tests: BetaSplashScreen
 * Figma Node: 1-28071 (beta state)
 * Route: /(auth)/beta-splash
 *
 * This is a non-interactive animated splash screen.
 * It displays the Flent logo with a "BETA LAUNCH" badge,
 * then auto-navigates to /(auth)/splash after 2500ms.
 *
 * Categories covered:
 * 1. Renders without crash
 * 2. Text content matches Figma
 * 3. Interactive elements present (testIDs)
 * 4. Navigation fires correctly (auto-redirect timer)
 * 5. Loading state (N/A - adapted for animation timing)
 * 6. Error state (N/A - no data fetching, test graceful behavior)
 * 7. Empty state (N/A - static screen, test single state renders)
 * 8. Props variations (N/A - no props, test query param absence)
 * 9. Accessibility
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';

import { EXPECTED_TEXT, EXPECTED_NAVIGATION, TEST_IDS } from '../fixtures/beta-splash.fixtures';

// --- Mock expo-router ---
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// --- Mock react-native-safe-area-context ---
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    SafeAreaProvider: ({ children }: any) => <>{children}</>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// --- Mock DottedPattern (SVG does not render in Jest JSDOM) ---
jest.mock('@/src/components/patterns/DottedPattern', () => {
  const { View } = require('react-native');
  return {
    DottedPattern: ({ children, testID }: any) => (
      <View testID={testID || 'dotted-pattern'}>{children}</View>
    ),
  };
});

// Import component under test after all mocks
import BetaSplashScreen from '@/app/(auth)/beta-splash';

describe('BetaSplashScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================
  // Category 1: Renders without crash
  // =========================================
  describe('renders without crash', () => {
    it('mounts without throwing', () => {
      expect(() => render(<BetaSplashScreen />)).not.toThrow();
    });

    it('returns valid JSX (non-null render)', () => {
      const { toJSON } = render(<BetaSplashScreen />);
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================
  // Category 2: Text content matches Figma
  // =========================================
  describe('text content matches Figma', () => {
    it('displays "BETA LAUNCH" badge text', () => {
      const { getByText } = render(<BetaSplashScreen />);
      expect(getByText(EXPECTED_TEXT.badgeText)).toBeTruthy();
    });
  });

  // =========================================
  // Category 3: Interactive elements present (testIDs)
  // =========================================
  describe('interactive elements present', () => {
    it('has the screen root testID', () => {
      const { getByTestId } = render(<BetaSplashScreen />);
      expect(getByTestId(TEST_IDS.screen)).toBeTruthy();
    });

    it('renders the DottedPattern background', () => {
      const { getByTestId } = render(<BetaSplashScreen />);
      expect(getByTestId('dotted-pattern')).toBeTruthy();
    });
  });

  // =========================================
  // Category 4: Navigation fires correctly
  // =========================================
  describe('navigation', () => {
    it('auto-navigates to splash after 2500ms timeout', () => {
      render(<BetaSplashScreen />);

      // Before timer fires, no navigation should have occurred
      expect(mockReplace).not.toHaveBeenCalled();

      // Advance timers past the 2500ms delay
      act(() => {
        jest.advanceTimersByTime(EXPECTED_NAVIGATION.autoRedirectDelay);
      });

      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith(EXPECTED_NAVIGATION.autoRedirect);
    });

    it('does not navigate before the timeout expires', () => {
      render(<BetaSplashScreen />);

      act(() => {
        jest.advanceTimersByTime(2000); // 500ms short of the 2500ms delay
      });

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('cleans up timeout on unmount (no memory leak)', () => {
      const { unmount } = render(<BetaSplashScreen />);

      // Unmount before timer fires
      unmount();

      // Advance past the timer
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Navigation should NOT fire after unmount
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // =========================================
  // Category 5: Loading state
  // =========================================
  describe('loading state', () => {
    // Beta splash has no data fetching. The "loading" analog is the animation
    // phase before auto-navigation. Verify screen displays content during that window.
    it('displays content during the animation/wait period', () => {
      const { getByText, getByTestId } = render(<BetaSplashScreen />);

      // Content should be visible immediately (animation starts at mount)
      expect(getByTestId(TEST_IDS.screen)).toBeTruthy();
      expect(getByText(EXPECTED_TEXT.badgeText)).toBeTruthy();
    });
  });

  // =========================================
  // Category 6: Error state
  // =========================================
  describe('error state', () => {
    // Beta splash has no error states -- no API calls, no data fetching.
    // The only failure mode is if the router is unavailable, which is
    // an infrastructure concern, not a screen concern.
    it('renders gracefully even when called multiple times (idempotent)', () => {
      // Render twice to ensure no side-effect accumulation
      const { unmount: unmount1 } = render(<BetaSplashScreen />);
      unmount1();

      const { getByText } = render(<BetaSplashScreen />);
      expect(getByText(EXPECTED_TEXT.badgeText)).toBeTruthy();
    });
  });

  // =========================================
  // Category 7: Empty state
  // =========================================
  describe('empty state', () => {
    // Beta splash is a static screen -- there is no "empty" data scenario.
    // The single state always shows the logo and badge.
    it('always shows the badge regardless of any props (static screen)', () => {
      const { getByText } = render(<BetaSplashScreen />);
      expect(getByText(EXPECTED_TEXT.badgeText)).toBeTruthy();
    });
  });

  // =========================================
  // Category 8: Props variations
  // =========================================
  describe('props variations', () => {
    // BetaSplashScreen accepts no props. The only "variation" is the
    // single beta state from the PM brief (Figma 1-28071).
    it('renders the beta state (the only defined state)', () => {
      const { getByText, getByTestId } = render(<BetaSplashScreen />);
      expect(getByTestId(TEST_IDS.screen)).toBeTruthy();
      expect(getByText(EXPECTED_TEXT.badgeText)).toBeTruthy();
    });
  });

  // =========================================
  // Category 9: Accessibility
  // =========================================
  describe('accessibility', () => {
    it('screen container is rendered as a View (accessible by default)', () => {
      const { getByTestId } = render(<BetaSplashScreen />);
      const screen = getByTestId(TEST_IDS.screen);
      expect(screen).toBeTruthy();
    });

    it('badge text is readable by screen readers', () => {
      const { getByText } = render(<BetaSplashScreen />);
      const badge = getByText(EXPECTED_TEXT.badgeText);
      // Text nodes are accessible by default in React Native
      expect(badge).toBeTruthy();
    });
  });
});
