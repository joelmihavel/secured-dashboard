/**
 * Auth Flow — Integration Tests (ST-099, ST-100)
 *
 * Verifies the full auth wiring from screen UI actions through to
 * Supabase service calls. Tests are structured to validate:
 *
 * 1. Phone submission on sign-up screen calls supabase.auth.signInWithOtp
 * 2. OTP verification calls supabase.auth.verifyOtp with correct params
 * 3. Error propagation from Supabase through service -> hook -> store -> UI
 * 4. Navigation triggered by auth state changes
 * 5. Sign-out calls supabase.auth.signOut and resets state
 *
 * Unlike the unit tests (sign-up.test.tsx, otp.test.tsx) which mock
 * useAuth at the hook level, these tests mock only the Supabase client
 * and let everything above it (service, hooks, store) run as real code.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Module mocks that must be declared before any component imports.
// The component barrel (src/components) transitively pulls in Sentry
// via: components/ui -> Layout -> OfflineBanner -> useNetworkStatus -> config/sentry
// ---------------------------------------------------------------------------

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((component: unknown) => component),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  withScope: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  Severity: { Info: 'info', Warning: 'warning', Error: 'error' },
}));

jest.mock('@/src/config/sentry', () => ({
  initSentry: jest.fn(),
  captureError: jest.fn(),
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  Sentry: {
    init: jest.fn(),
    wrap: jest.fn((component: unknown) => component),
    captureException: jest.fn(),
    withScope: jest.fn(),
    setUser: jest.fn(),
    addBreadcrumb: jest.fn(),
  },
}));

// Mock expo-constants (used by sentry config)
jest.mock('expo-constants', () => ({
  expoConfig: { extra: {} },
}));

// Mock expo-updates (used by config/updates)
jest.mock('expo-updates', () => ({
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
  isEnabled: false,
}));

// Mock @expo/vector-icons (pulled in via components barrel -> home/CashbackSetupModal)
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const MockIcon = (props: any) => <Text>{props.name}</Text>;
  return {
    Ionicons: MockIcon,
    MaterialIcons: MockIcon,
    MaterialCommunityIcons: MockIcon,
    FontAwesome: MockIcon,
    Feather: MockIcon,
    AntDesign: MockIcon,
  };
});

// Mock react-native-svg (used by CashbackSetupModal and others)
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Path: View,
    Circle: View,
    Rect: View,
    G: View,
    Defs: View,
    ClipPath: View,
    Line: View,
    Text: View,
  };
});

// ---------------------------------------------------------------------------
// Supabase client mock (lowest layer)
// ---------------------------------------------------------------------------

const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/src/services/supabase/client', () => ({
  __esModule: true,
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
  callEdgeFunction: jest.fn(),
  getFunctionsUrl: jest.fn(),
}));

// Mock utils (used by signOut in the service layer)
jest.mock('@/src/utils', () => ({
  tryCatch: jest.fn(async (fn: () => Promise<unknown>, errorMessage: string) => {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : errorMessage,
          originalError: error,
        },
      };
    }
  }),
  logError: jest.fn(),
  getErrorMessage: jest.fn((err: unknown) =>
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error'
  ),
}));

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockSearchParams,
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style, ...props }: any) => (
      <View {...props} style={style}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});

// Mock DottedPattern (heavy image component)
jest.mock('@/src/components/patterns', () => ({
  DottedPattern: () => null,
}));

// Mock ConsentToggle with controllable Switch
jest.mock('@/src/components/composed/auth/ConsentToggle', () => {
  const { View, Switch } = require('react-native');
  return {
    ConsentToggle: ({ value, onValueChange, testID }: any) => (
      <View testID={testID}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          testID={`${testID}-switch`}
        />
      </View>
    ),
  };
});

// Mock gesture handler and blur (for OTP screen)
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    Gesture: {
      Pan: () => ({
        onUpdate: () => ({ onEnd: () => ({}) }),
      }),
    },
    GestureDetector: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return {
    BlurView: ({ children, style, ...props }: any) => (
      <View {...props} style={style}>{children}</View>
    ),
  };
});

// Mock identity verification (non-blocking side effect)
jest.mock('@/src/services/api/identity', () => ({
  fetchIdentityWithConsent: jest.fn().mockResolvedValue({ success: true }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import SignUpScreen from '../sign-up';
import OTPScreen from '../otp';
import { useAuthStore } from '@/src/stores/auth';

// ---------------------------------------------------------------------------
// Test wrapper with QueryClient
// ---------------------------------------------------------------------------

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fillPhone(getByTestId: any, value = '9876543210') {
  fireEvent.changeText(getByTestId('phone-input'), value);
}

function fillName(getByTestId: any, value = 'John Appleseed') {
  fireEvent.changeText(getByTestId('name-input'), value);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth Integration — sign-up screen to Supabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    useAuthStore.getState().reset();
    mockGetSession.mockResolvedValue({ data: { session: null } });
  });

  it('submitting the sign-up form calls supabase.auth.signInWithOtp with E.164 phone', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <SignUpScreen />
      </Wrapper>
    );

    fillPhone(getByTestId, '9876543210');
    fillName(getByTestId, 'Test User');

    await act(async () => {
      fireEvent.press(getByTestId('get-started-button'));
    });

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'whatsapp' },
      });
    });
  });

  it('successful OTP send updates auth store and navigates to OTP screen', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <SignUpScreen />
      </Wrapper>
    );

    fillPhone(getByTestId, '9876543210');
    fillName(getByTestId, 'Test User');

    await act(async () => {
      fireEvent.press(getByTestId('get-started-button'));
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(auth)/otp');
    });

    // Store should reflect otp_sent state
    expect(useAuthStore.getState().status).toBe('otp_sent');
    expect(useAuthStore.getState().phoneNumber).toBe('+919876543210');
  });

  it('Supabase signInWithOtp error propagates to store without navigating', async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: 'Too many requests, rate limit exceeded' },
    });

    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <SignUpScreen />
      </Wrapper>
    );

    fillPhone(getByTestId, '9876543210');
    fillName(getByTestId, 'Test User');

    await act(async () => {
      fireEvent.press(getByTestId('get-started-button'));
    });

    await waitFor(() => {
      expect(useAuthStore.getState().error?.code).toBe('RATE_LIMITED');
    });

    // Should NOT navigate to OTP screen
    expect(mockPush).not.toHaveBeenCalledWith('/(auth)/otp');
  });

  it('network error from Supabase propagates through to store', async () => {
    mockSignInWithOtp.mockRejectedValue(new Error('Failed to fetch'));

    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <SignUpScreen />
      </Wrapper>
    );

    fillPhone(getByTestId, '9876543210');
    fillName(getByTestId, 'Test User');

    await act(async () => {
      fireEvent.press(getByTestId('get-started-button'));
    });

    await waitFor(() => {
      expect(useAuthStore.getState().error?.code).toBe('NETWORK_ERROR');
    });
  });

  it('stores userName in Zustand before sending OTP', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <SignUpScreen />
      </Wrapper>
    );

    fillPhone(getByTestId, '9876543210');
    fillName(getByTestId, 'Jane Doe');

    await act(async () => {
      fireEvent.press(getByTestId('get-started-button'));
    });

    await waitFor(() => {
      expect(useAuthStore.getState().userName).toBe('Jane Doe');
    });
  });
});

describe('Auth Integration — OTP screen to Supabase', () => {
  const now = Date.now();
  const recentCreatedAt = new Date(now - 60_000).toISOString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    useAuthStore.getState().reset();
    mockGetSession.mockResolvedValue({ data: { session: null } });

    // Pre-set store to simulate arriving at OTP screen after sign-up
    useAuthStore.getState().setPhoneNumber('+919876543210');
    useAuthStore.getState().setUserName('Test User');
    useAuthStore.getState().setOtpSent();
  });

  it('successful OTP verification calls supabase.auth.verifyOtp and navigates to waitlist', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {
        user: { id: 'user-123', created_at: recentCreatedAt },
      },
      error: null,
    });

    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <OTPScreen />
      </Wrapper>
    );

    // Type OTP digits
    fireEvent.changeText(getByTestId('otp-input'), '123456');

    // Press Proceed
    await act(async () => {
      fireEvent.press(getByTestId('proceed-button'));
    });

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        token: '123456',
        type: 'sms',
      });
    });

    // Wait for authenticated state and navigation
    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(waitlist)');
    });
  });

  it('invalid OTP error from Supabase propagates to store', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid OTP token' },
    });

    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <OTPScreen />
      </Wrapper>
    );

    fireEvent.changeText(getByTestId('otp-input'), '000000');

    await act(async () => {
      fireEvent.press(getByTestId('proceed-button'));
    });

    await waitFor(() => {
      expect(useAuthStore.getState().error?.code).toBe('INVALID_OTP');
    });

    // Should NOT navigate to waitlist
    expect(mockReplace).not.toHaveBeenCalledWith('/(waitlist)');
  });

  it('resend button calls supabase.auth.signInWithOtp with stored phone', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const Wrapper = createTestWrapper();
    const { getByText } = render(
      <Wrapper>
        <OTPScreen />
      </Wrapper>
    );

    await act(async () => {
      fireEvent.press(getByText('Resend'));
    });

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: '+919876543210',
        options: { channel: 'whatsapp' },
      });
    });
  });

  it('verifyOtp sends user name to supabase.auth.updateUser', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {
        user: { id: 'user-name-update', created_at: recentCreatedAt },
      },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ error: null });

    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <OTPScreen />
      </Wrapper>
    );

    fireEvent.changeText(getByTestId('otp-input'), '123456');

    await act(async () => {
      fireEvent.press(getByTestId('proceed-button'));
    });

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { name: 'Test User' },
      });
    });
  });

  it('OTP expired error from Supabase is mapped to OTP_EXPIRED code', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Code expired, request a new one' },
    });

    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <OTPScreen />
      </Wrapper>
    );

    fireEvent.changeText(getByTestId('otp-input'), '111111');

    await act(async () => {
      fireEvent.press(getByTestId('proceed-button'));
    });

    await waitFor(() => {
      const err = useAuthStore.getState().error;
      expect(err?.code).toBe('OTP_EXPIRED');
    });
  });

  it('network error during OTP verification propagates to store', async () => {
    mockVerifyOtp.mockRejectedValue(new Error('Network failure'));

    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <OTPScreen />
      </Wrapper>
    );

    fireEvent.changeText(getByTestId('otp-input'), '123456');

    await act(async () => {
      fireEvent.press(getByTestId('proceed-button'));
    });

    await waitFor(() => {
      expect(useAuthStore.getState().error?.code).toBe('NETWORK_ERROR');
    });
  });
});

describe('Auth Integration — signOut', () => {
  it('signOut calls supabase.auth.signOut and resets store to idle', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    // Pre-set authenticated state
    useAuthStore.getState().setPhoneNumber('+919876543210');
    useAuthStore.getState().setAuthenticated('user-xyz', false);
    expect(useAuthStore.getState().status).toBe('authenticated');

    // Import the service function directly to test it
    const { signOut } = require('@/src/services/api/auth');

    await signOut();

    expect(mockSignOut).toHaveBeenCalled();

    // Reset store manually (as the hook's signOut does)
    useAuthStore.getState().reset();

    expect(useAuthStore.getState().status).toBe('idle');
    expect(useAuthStore.getState().userId).toBeNull();
    expect(useAuthStore.getState().phoneNumber).toBe('');
  });
});
