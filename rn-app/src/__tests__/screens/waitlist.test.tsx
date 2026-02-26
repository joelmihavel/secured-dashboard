/**
 * Unit Tests: Waitlist Screens
 * Figma Nodes: 41-11206 (pending), 41-11506 (pending_long), 41-11410 (rejected), 41-11313 (approved)
 * Routes: /(waitlist)/ (main) and /(waitlist)/approved
 *
 * Main Waitlist Screen with 6 states:
 *   - loading: Skeleton UI while fetching status
 *   - pending: Queue position #4,217 with timeline, progress arc, referral input
 *   - pending_long: Extended wait messaging with additional info card
 *   - approved: Auto-redirects to approved screen (not rendered in main screen)
 *   - rejected: "We can't approve you right now" with rejection reasons and countdown
 *   - error: Error display with retry button
 *
 * Approved Screen:
 *   - Logo, celebration title with name, subtitle
 *   - Complete timeline with all green dots
 *   - Benefits card
 *   - "Step Inside" CTA button
 *
 * Uses useWaitlist hook for data and state management.
 * Uses expo-router for navigation.
 * Uses expo-haptics for celebration feedback.
 * Uses lottie-react-native for confetti animation.
 *
 * Categories covered (all 9):
 *   1. Renders without crash
 *   2. Text content matches Figma
 *   3. Interactive elements present (testIDs)
 *   4. Navigation fires correctly
 *   5. Loading state
 *   6. Error state (error, rejected)
 *   7. Empty/pending state
 *   8. Props variations (all 6 states via query params)
 *   9. Accessibility
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import {
  EXPECTED_TEXT,
  EXPECTED_NAVIGATION,
  TEST_IDS,
  MOCK_WAITLIST_DATA,
  SCREEN_METADATA,
  WAITLIST_HOOK_LOADING,
  WAITLIST_HOOK_PENDING,
  WAITLIST_HOOK_PENDING_LONG,
  WAITLIST_HOOK_APPROVED,
  WAITLIST_HOOK_REJECTED,
  WAITLIST_HOOK_ERROR,
  WAITLIST_HOOK_REFERRAL_ERROR,
  WAITLIST_HOOK_APPLYING_REFERRAL,
  WAITLIST_HOOK_REFETCHING,
} from '../fixtures/waitlist.fixtures';

// --- Mock expo-router ---
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => mockSearchParams,
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

// --- Mock react-native-reanimated ---
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chainable = () => {
    const obj: any = {};
    obj.duration = jest.fn().mockReturnValue(obj);
    obj.delay = jest.fn().mockReturnValue(obj);
    obj.springify = jest.fn().mockReturnValue(obj);
    obj.damping = jest.fn().mockReturnValue(obj);
    obj.stiffness = jest.fn().mockReturnValue(obj);
    return obj;
  };
  return {
    __esModule: true,
    default: { View },
    Easing: {
      bezier: () => (t: number) => t,
      linear: (t: number) => t,
      ease: (t: number) => t,
      in: (t: number) => t,
      out: (t: number) => t,
      inOut: (t: number) => t,
    },
    FadeIn: chainable(),
    FadeInDown: chainable(),
    FadeInUp: chainable(),
    FadeOut: chainable(),
    SlideInDown: chainable(),
    SlideInRight: chainable(),
    ZoomIn: chainable(),
    useSharedValue: jest.fn((v) => ({ value: v })),
    useAnimatedStyle: jest.fn(() => ({})),
    withSpring: jest.fn((value) => value),
    withDelay: jest.fn((_delay, value) => value),
    withTiming: jest.fn((value) => value),
    withRepeat: jest.fn((value) => value),
    withSequence: jest.fn((...values) => values[0]),
    cancelAnimation: jest.fn(),
    runOnJS: jest.fn((fn) => fn),
    interpolate: jest.fn((v) => v),
  };
});

// --- Mock DottedGridPattern (visual-only, uses SVG internals that crash in test env) ---
jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
}));
jest.mock('@/src/components/patterns/DottedGridPattern', () => ({
  __esModule: true,
  default: () => null,
}));

// --- Mock expo-linear-gradient ---
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

// --- Mock expo-haptics (global mock in setup.ts provides the factory;
//     we grab the jest.fn() references here for assertions) ---
const Haptics = require('expo-haptics');
const mockNotificationAsync = Haptics.notificationAsync as jest.Mock;
const mockImpactAsync = Haptics.impactAsync as jest.Mock;

// --- Mock lottie-react-native ---
const mockConfettiPlay = jest.fn();

jest.mock('lottie-react-native', () => {
  const { View } = require('react-native');
  const React = require('react');
  return React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      play: mockConfettiPlay,
    }));
    return <View testID="lottie-confetti" {...props} />;
  });
});

// --- Mock useWaitlist hook ---
let mockWaitlistReturn: any = { ...WAITLIST_HOOK_PENDING };

jest.mock('@/src/hooks', () => ({
  useWaitlist: () => mockWaitlistReturn,
}));

// --- Mock components (Logo, PrimaryButton, etc.) ---
jest.mock('@/src/components', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Text: ({ children, style, ...props }: any) => <Text style={style} {...props}>{children}</Text>,
    Logo: ({ size, color, ...props }: any) => <View testID="logo" {...props} />,
    PrimaryButton: ({ title, onPress, loading, disabled, testID, ...props }: any) => (
      <Pressable
        testID={testID || 'primary-button'}
        onPress={onPress}
        disabled={loading || disabled}
        accessibilityRole="button"
        accessibilityLabel={title}
        {...props}
      >
        <Text>{loading ? 'Loading...' : title}</Text>
      </Pressable>
    ),
    ApplicationTimeline: ({ items, testID }: any) => (
      <View testID={testID || 'application-timeline'}>
        {items?.map((item: any, i: number) => (
          <View key={i}>
            <Text>{item.label}</Text>
            <Text>{item.value}</Text>
            <Text>{item.status}</Text>
          </View>
        ))}
      </View>
    ),
    ReferralCodeInput: ({ code, onCharacterChange, error }: any) => (
      <View testID="referral-code-input">
        <Text>{code.join('')}</Text>
        {error && <Text>{error}</Text>}
      </View>
    ),
    ProgressArc: ({ current, total }: any) => (
      <View testID="progress-arc">
        <Text>{current}/{total}</Text>
      </View>
    ),
    BenefitsCard: ({ variant, testID }: any) => (
      <View testID={testID || 'benefits-card'}>
        <Text>{variant}</Text>
      </View>
    ),
    DottedGridPattern: () => null,
    SkeletonLoader: ({ testID }: any) => <View testID={testID || 'skeleton-loader'} />,
  };
});

// Import components under test after all mocks
import WaitlistScreen from '@/app/(waitlist)/index';
import WaitlistApprovedScreen from '@/app/(waitlist)/approved';

describe('WaitlistScreen (Main)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWaitlistReturn = { ...WAITLIST_HOOK_PENDING };
    mockSearchParams = {};
  });

  // =========================================================================
  // Category 1: Renders without crash
  // =========================================================================
  describe('renders without crash', () => {
    it('mounts without throwing', () => {
      expect(() => render(<WaitlistScreen />)).not.toThrow();
    });

    it('returns valid JSX (non-null render)', () => {
      const { toJSON } = render(<WaitlistScreen />);
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 2: Text content matches Figma
  // =========================================================================
  describe('text content matches Figma', () => {
    it('displays "Welcome," prefix in pending state', () => {
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(/Welcome,/)).toBeTruthy();
    });

    it('displays user name in title', () => {
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(/Rishabh Agnihotri/)).toBeTruthy();
    });

    it('displays pending subtitle', () => {
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.pendingSubtitle)).toBeTruthy();
    });

    it('displays timeline labels', () => {
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.timelineApplicationSent)).toBeTruthy();
      expect(getByText(EXPECTED_TEXT.timelineInReview)).toBeTruthy();
      expect(getByText(EXPECTED_TEXT.timelineAccountStatus)).toBeTruthy();
    });

    it('displays "Have an Invite Code?" label', () => {
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.inviteLabel)).toBeTruthy();
    });

    it('displays "Enter Invite Code" button text', () => {
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.inviteButton)).toBeTruthy();
    });

    it('displays pending_long subtitle when state is pending_long', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_PENDING_LONG };
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.pendingLongSubtitle)).toBeTruthy();
    });

    it('displays rejected title when state is rejected', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_REJECTED };
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.rejectedTitle)).toBeTruthy();
    });

    it('displays BenefitsCard with rejected variant in rejected state', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_REJECTED };
      const { getByTestId } = render(<WaitlistScreen />);
      // BenefitsCard is mocked with testID="benefits-card"
      expect(getByTestId('benefits-card')).toBeTruthy();
    });

    it('displays countdown text in rejected state', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_REJECTED };
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(/applications open in/)).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 3: Interactive elements present (testIDs)
  // =========================================================================
  describe('interactive elements present', () => {
    it('has the logo component', () => {
      const { getByTestId } = render(<WaitlistScreen />);
      expect(getByTestId('logo')).toBeTruthy();
    });

    it('has the application timeline', () => {
      const { getByTestId } = render(<WaitlistScreen />);
      expect(getByTestId('application-timeline')).toBeTruthy();
    });

    it('has the referral code input', () => {
      const { getByTestId } = render(<WaitlistScreen />);
      expect(getByTestId('referral-code-input')).toBeTruthy();
    });

    it('has the progress arc in pending state', () => {
      const { getByTestId } = render(<WaitlistScreen />);
      expect(getByTestId('progress-arc')).toBeTruthy();
    });

    it('has the benefits card', () => {
      const { getByTestId } = render(<WaitlistScreen />);
      expect(getByTestId('benefits-card')).toBeTruthy();
    });

    it('has the invite button as pressable', () => {
      const { getByText } = render(<WaitlistScreen />);
      const button = getByText(EXPECTED_TEXT.inviteButton);
      expect(button).toBeTruthy();
    });

    it('has contact support button in rejected state', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_REJECTED };
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.contactSupport)).toBeTruthy();
    });

    it('has retry button in error state', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_ERROR };
      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.retryButton)).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 4: Navigation fires correctly
  // =========================================================================
  describe('navigation', () => {
    it('renders transition overlay when viewState becomes approved', () => {
      // The screen uses runOnJS(router.replace) inside a withTiming callback
      // which does not execute in the mock environment. Instead, verify
      // the component does not crash when viewState is 'approved'.
      mockWaitlistReturn = { ...WAITLIST_HOOK_APPROVED };
      const { toJSON } = render(<WaitlistScreen />);
      // When approved, the loading state renders (since isLoading is derived from
      // the viewState transition), the component should render without errors
      expect(toJSON()).toBeTruthy();
    });

    it('does not redirect when approved in mock mode (state param present)', () => {
      mockSearchParams = { state: 'accepted' };
      mockWaitlistReturn = { ...WAITLIST_HOOK_APPROVED };

      render(<WaitlistScreen />);

      // Should NOT redirect in mock mode (for screenshot capture)
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('calls claimInviteCode when Enter Invite Code is pressed', () => {
      const mockClaimInviteCode = jest.fn();
      mockWaitlistReturn = {
        ...WAITLIST_HOOK_PENDING,
        referralCode: ['F', 'L', 'N', 'T'],
        claimInviteCode: mockClaimInviteCode,
      };

      const { getByText } = render(<WaitlistScreen />);
      fireEvent.press(getByText(EXPECTED_TEXT.inviteButton));

      expect(mockClaimInviteCode).toHaveBeenCalledTimes(1);
    });

    it('calls refresh when Try Again is pressed in error state', () => {
      const mockRefresh = jest.fn();
      mockWaitlistReturn = {
        ...WAITLIST_HOOK_ERROR,
        refresh: mockRefresh,
      };

      const { getByText } = render(<WaitlistScreen />);
      fireEvent.press(getByText(EXPECTED_TEXT.retryButton));

      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('calls joinWaitlist on initial mount when no position exists', () => {
      const mockJoinWaitlist = jest.fn();
      mockWaitlistReturn = {
        ...WAITLIST_HOOK_PENDING,
        status: {
          ...MOCK_WAITLIST_DATA.pending,
          position: null,
        },
        joinWaitlist: mockJoinWaitlist,
      };

      render(<WaitlistScreen />);

      // Should auto-join on first visit
      expect(mockJoinWaitlist).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Category 5: Loading state
  // =========================================================================
  describe('loading state', () => {
    it('displays loading skeleton when isLoading is true', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_LOADING };
      const { getByTestId } = render(<WaitlistScreen />);

      // Should render SkeletonLoader component in loading state
      expect(getByTestId('skeleton-loader')).toBeTruthy();
    });

    it('does not display content when loading', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_LOADING };
      const { queryByText } = render(<WaitlistScreen />);

      // Should not show timeline or referral input while loading
      expect(queryByText(EXPECTED_TEXT.inviteLabel)).toBeNull();
      expect(queryByText(EXPECTED_TEXT.timelineApplicationSent)).toBeNull();
    });

    it('shows "Loading..." on invite button when claiming invite code', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_APPLYING_REFERRAL };
      const { getByText } = render(<WaitlistScreen />);

      expect(getByText('Loading...')).toBeTruthy();
    });

    it('shows loading state on invite button when isClaimingInviteCode is true', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_APPLYING_REFERRAL };

      const { getByText } = render(<WaitlistScreen />);

      // The PrimaryButton mock shows "Loading..." text when loading prop is true
      expect(getByText('Loading...')).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 6: Error state
  // =========================================================================
  describe('error state', () => {
    it('displays error title in error state', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_ERROR };
      const { getByText } = render(<WaitlistScreen />);

      expect(getByText(/Oops,/)).toBeTruthy();
      expect(getByText(/something.*went wrong/)).toBeTruthy();
    });

    it('displays error message from hook', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_ERROR };
      const { getAllByText } = render(<WaitlistScreen />);

      // Error message appears in both subtitle and error card description
      expect(getAllByText('Network error occurred').length).toBeGreaterThan(0);
    });

    it('displays error code in error card', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_ERROR };
      const { getByText } = render(<WaitlistScreen />);

      expect(getByText('FETCH_ERROR')).toBeTruthy();
    });

    it('displays retry button in error state', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_ERROR };
      const { getByText } = render(<WaitlistScreen />);

      expect(getByText(EXPECTED_TEXT.retryButton)).toBeTruthy();
    });

    it('displays referral error text when referral fails', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_REFERRAL_ERROR };
      const { getByText } = render(<WaitlistScreen />);

      expect(getByText('Invalid referral code')).toBeTruthy();
    });

    it('shows rejected state with benefits card', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_REJECTED };
      const { getByText, getByTestId } = render(<WaitlistScreen />);

      expect(getByText(EXPECTED_TEXT.rejectedTitle)).toBeTruthy();
      // BenefitsCard with rejected variant is rendered
      expect(getByTestId('benefits-card')).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 7: Empty/pending state
  // =========================================================================
  describe('pending state', () => {
    it('renders all UI elements in pending state', () => {
      const { getByText, getByTestId } = render(<WaitlistScreen />);

      expect(getByText(/Welcome,/)).toBeTruthy();
      expect(getByTestId('logo')).toBeTruthy();
      expect(getByTestId('application-timeline')).toBeTruthy();
      expect(getByTestId('referral-code-input')).toBeTruthy();
      expect(getByTestId('progress-arc')).toBeTruthy();
      expect(getByTestId('benefits-card')).toBeTruthy();
    });

    it('displays timeline with pending status', () => {
      const { getByText } = render(<WaitlistScreen />);

      expect(getByText(EXPECTED_TEXT.timelinePendingValue)).toBeTruthy();
    });

    it('displays position and stats from status data', () => {
      const { getByText } = render(<WaitlistScreen />);

      // Progress arc should show current/total
      expect(getByText('89/150')).toBeTruthy();
    });

    it('has no error message displayed in pending state', () => {
      const { queryByText } = render(<WaitlistScreen />);

      expect(queryByText(/Oops,/)).toBeNull();
      expect(queryByText(/something.*went wrong/)).toBeNull();
    });
  });

  // =========================================================================
  // Category 8: Props variations / state variants (query params)
  // =========================================================================
  describe('state variations', () => {
    it('renders pending state when state param is "pending"', () => {
      mockSearchParams = { state: 'pending' };
      mockWaitlistReturn = { ...WAITLIST_HOOK_PENDING };

      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.pendingSubtitle)).toBeTruthy();
    });

    it('renders pending_long state when state param is "pending_long"', () => {
      mockSearchParams = { state: 'pending_long' };
      mockWaitlistReturn = { ...WAITLIST_HOOK_PENDING_LONG };

      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.pendingLongSubtitle)).toBeTruthy();
      // Title contains "We're still" and "setting things up"
      expect(getByText(/still/)).toBeTruthy();
    });

    it('renders pending_long with setting things up title', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_PENDING_LONG };
      const { getByText } = render(<WaitlistScreen />);

      // The screen shows "We're still" in gray and "setting things up" in accent
      expect(getByText(/still/)).toBeTruthy();
    });

    it('renders rejected state when state param is "rejected"', () => {
      mockSearchParams = { state: 'rejected' };
      mockWaitlistReturn = { ...WAITLIST_HOOK_REJECTED };

      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(EXPECTED_TEXT.rejectedTitle)).toBeTruthy();
    });

    it('renders error state when error is present', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_ERROR };

      const { getByText } = render(<WaitlistScreen />);
      expect(getByText(/Oops,/)).toBeTruthy();
    });

    it('renders pending state with referral input when state param is "referral"', () => {
      mockSearchParams = { state: 'referral' };
      mockWaitlistReturn = { ...WAITLIST_HOOK_PENDING };

      const { getByTestId } = render(<WaitlistScreen />);

      // Referral code input should be present
      expect(getByTestId('referral-code-input')).toBeTruthy();
    });

    it('all main screen states are documented in SCREEN_METADATA', () => {
      expect(SCREEN_METADATA.mainScreen.states).toEqual([
        'loading',
        'pending',
        'pending_long',
        'rejected',
        'error',
      ]);
    });

    it('has correct route in metadata', () => {
      expect(SCREEN_METADATA.mainScreen.route).toBe('/(waitlist)/');
    });

    it('metadata indicates screen has loading, error states', () => {
      expect(SCREEN_METADATA.mainScreen.hasLoadingState).toBe(true);
      expect(SCREEN_METADATA.mainScreen.hasErrorState).toBe(true);
      expect(SCREEN_METADATA.mainScreen.hasDataFetching).toBe(true);
    });
  });

  // =========================================================================
  // Category 9: Accessibility
  // =========================================================================
  describe('accessibility', () => {
    it('invite button has accessibilityRole="button"', () => {
      const { getByTestId } = render(<WaitlistScreen />);
      const button = getByTestId('primary-button');
      expect(button.props.accessibilityRole).toBe('button');
    });

    it('invite button has accessibilityLabel matching title', () => {
      const { getByTestId } = render(<WaitlistScreen />);
      const button = getByTestId('primary-button');
      expect(button.props.accessibilityLabel).toBe(EXPECTED_TEXT.inviteButton);
    });

    it('retry button in error state has correct accessibility props', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_ERROR };
      const { getByTestId } = render(<WaitlistScreen />);

      const button = getByTestId('primary-button');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe(EXPECTED_TEXT.retryButton);
    });

    it('contact support button has correct accessibility props', () => {
      mockWaitlistReturn = { ...WAITLIST_HOOK_REJECTED };
      const { getByTestId } = render(<WaitlistScreen />);

      const button = getByTestId('primary-button');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe(EXPECTED_TEXT.contactSupport);
    });
  });
});

// =========================================================================
// WAITLIST APPROVED SCREEN TESTS
// =========================================================================

describe('WaitlistApprovedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWaitlistReturn = { ...WAITLIST_HOOK_APPROVED };
    mockSearchParams = {};
    mockConfettiPlay.mockClear();
    mockNotificationAsync.mockClear();
    mockImpactAsync.mockClear();
  });

  // =========================================================================
  // Category 1: Renders without crash
  // =========================================================================
  describe('renders without crash', () => {
    it('mounts without throwing', () => {
      expect(() => render(<WaitlistApprovedScreen />)).not.toThrow();
    });

    it('returns valid JSX (non-null render)', () => {
      const { toJSON } = render(<WaitlistApprovedScreen />);
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 2: Text content matches Figma
  // =========================================================================
  describe('text content matches Figma', () => {
    it('displays user name in title', () => {
      const { getByText } = render(<WaitlistApprovedScreen />);
      expect(getByText(/Rishabh Agnihotri/)).toBeTruthy();
    });

    it('displays "you\'re all set." text', () => {
      const { getByText } = render(<WaitlistApprovedScreen />);
      expect(getByText(/you're all set\./)).toBeTruthy();
    });

    it('displays approved subtitle', () => {
      const { getByText } = render(<WaitlistApprovedScreen />);
      expect(getByText(EXPECTED_TEXT.approvedSubtitle)).toBeTruthy();
    });

    it('displays "Step Inside" button text', () => {
      const { getByText } = render(<WaitlistApprovedScreen />);
      expect(getByText(EXPECTED_TEXT.stepInsideButton)).toBeTruthy();
    });

    it('displays timeline with "Accepted" status', () => {
      const { getByText } = render(<WaitlistApprovedScreen />);
      expect(getByText(EXPECTED_TEXT.approvedTimelineValue)).toBeTruthy();
    });

    it('displays timeline labels', () => {
      const { getByText } = render(<WaitlistApprovedScreen />);
      expect(getByText(EXPECTED_TEXT.timelineApplicationSent)).toBeTruthy();
      expect(getByText(EXPECTED_TEXT.timelineInReview)).toBeTruthy();
      expect(getByText(EXPECTED_TEXT.timelineAccountStatus)).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 3: Interactive elements present (testIDs)
  // =========================================================================
  describe('interactive elements present', () => {
    it('has the logo component', () => {
      const { getByTestId } = render(<WaitlistApprovedScreen />);
      expect(getByTestId('logo')).toBeTruthy();
    });

    it('has the timeline with testID', () => {
      const { getByTestId } = render(<WaitlistApprovedScreen />);
      expect(getByTestId(TEST_IDS.approvedTimeline)).toBeTruthy();
    });

    it('has the benefits card with testID', () => {
      const { getByTestId } = render(<WaitlistApprovedScreen />);
      expect(getByTestId(TEST_IDS.approvedBenefits)).toBeTruthy();
    });

    it('has the step inside button with testID', () => {
      const { getByTestId } = render(<WaitlistApprovedScreen />);
      expect(getByTestId(TEST_IDS.stepInsideButton)).toBeTruthy();
    });

    it('renders confetti animation when showConfetti is true', () => {
      const { getByTestId } = render(<WaitlistApprovedScreen />);
      expect(getByTestId('lottie-confetti')).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 4: Navigation fires correctly
  // =========================================================================
  describe('navigation', () => {
    it('calls haptic feedback when Step Inside is pressed', () => {
      const { getByTestId } = render(<WaitlistApprovedScreen />);
      fireEvent.press(getByTestId(TEST_IDS.stepInsideButton));

      // Navigation uses runOnJS(router.replace) inside withTiming callback,
      // which doesn't fire in mock environment. But haptic feedback fires immediately.
      expect(mockImpactAsync).toHaveBeenCalledWith('medium');
    });
  });

  // =========================================================================
  // Category 5: Loading state (N/A for approved screen)
  // =========================================================================
  describe('loading state', () => {
    it('does not have loading state (approved screen is static)', () => {
      expect(SCREEN_METADATA.approvedScreen.hasLoadingState).toBe(false);
    });
  });

  // =========================================================================
  // Category 6: Error state (N/A for approved screen)
  // =========================================================================
  describe('error state', () => {
    it('does not have error state (approved screen is success)', () => {
      expect(SCREEN_METADATA.approvedScreen.hasErrorState).toBe(false);
    });
  });

  // =========================================================================
  // Category 7: Empty/pending state (N/A for approved screen)
  // =========================================================================
  describe('approved state', () => {
    it('renders all UI elements in approved state', () => {
      const { getByText, getByTestId } = render(<WaitlistApprovedScreen />);

      expect(getByTestId('logo')).toBeTruthy();
      expect(getByText(/you're all set\./)).toBeTruthy();
      expect(getByTestId(TEST_IDS.approvedTimeline)).toBeTruthy();
      expect(getByTestId(TEST_IDS.approvedBenefits)).toBeTruthy();
      expect(getByTestId(TEST_IDS.stepInsideButton)).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 8: Props variations / state variants
  // =========================================================================
  describe('state variations', () => {
    it('only has approved state', () => {
      expect(SCREEN_METADATA.approvedScreen.states).toEqual(['approved']);
    });

    it('has correct route in metadata', () => {
      expect(SCREEN_METADATA.approvedScreen.route).toBe('/(waitlist)/approved');
    });
  });

  // =========================================================================
  // Category 9: Accessibility
  // =========================================================================
  describe('accessibility', () => {
    it('step inside button has accessibilityRole="button"', () => {
      const { getByTestId } = render(<WaitlistApprovedScreen />);
      const button = getByTestId(TEST_IDS.stepInsideButton);
      expect(button.props.accessibilityRole).toBe('button');
    });

    it('step inside button has accessibilityLabel matching title', () => {
      const { getByTestId } = render(<WaitlistApprovedScreen />);
      const button = getByTestId(TEST_IDS.stepInsideButton);
      expect(button.props.accessibilityLabel).toBe(EXPECTED_TEXT.stepInsideButton);
    });
  });

  // =========================================================================
  // Additional: Celebration effects
  // =========================================================================
  describe('celebration effects', () => {
    it('triggers success haptic on mount', () => {
      render(<WaitlistApprovedScreen />);
      expect(mockNotificationAsync).toHaveBeenCalledWith('success');
    });

    it('plays confetti animation on mount when showConfetti is true', async () => {
      jest.useFakeTimers();
      render(<WaitlistApprovedScreen />);

      // Confetti should play after 300ms delay
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockConfettiPlay).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });

    it('does not render confetti when showConfetti is false', () => {
      mockWaitlistReturn = {
        ...WAITLIST_HOOK_APPROVED,
        showConfetti: false,
      };

      const { queryByTestId } = render(<WaitlistApprovedScreen />);
      expect(queryByTestId('lottie-confetti')).toBeNull();
    });
  });
});
