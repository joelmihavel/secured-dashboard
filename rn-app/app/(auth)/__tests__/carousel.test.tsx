import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

// ── Module mocks (must be declared before component imports) ─────────────────
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(), wrap: jest.fn((c: unknown) => c), captureException: jest.fn(),
  captureMessage: jest.fn(), withScope: jest.fn(), setUser: jest.fn(),
  addBreadcrumb: jest.fn(), Severity: { Info: 'info', Warning: 'warning', Error: 'error' },
}));
jest.mock('@/src/config/sentry', () => ({
  initSentry: jest.fn(), captureError: jest.fn(), setUserContext: jest.fn(),
  clearUserContext: jest.fn(), addBreadcrumb: jest.fn(),
  Sentry: { init: jest.fn(), wrap: jest.fn((c: unknown) => c), captureException: jest.fn(), withScope: jest.fn(), setUser: jest.fn(), addBreadcrumb: jest.fn() },
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const MockIcon = (props: any) => <Text>{props.name}</Text>;
  return { Ionicons: MockIcon, MaterialIcons: MockIcon, MaterialCommunityIcons: MockIcon, FontAwesome: MockIcon, Feather: MockIcon, AntDesign: MockIcon };
});
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Svg: View, Path: View, Circle: View, Rect: View, G: View, Defs: View, ClipPath: View, Line: View, Text: View };
});

import CarouselScreen from '../carousel';

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style, ...props }: any) => (
      <View {...props} style={style}>
        {children}
      </View>
    ),
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});

// Mock DottedPattern (from patterns module)
jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
}));

// Mock CarouselDots (from composed/auth module)
jest.mock('@/src/components/composed/auth/CarouselDots', () => ({
  CarouselDots: () => null,
}));

describe('CarouselScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  it('renders correctly and matches snapshot', () => {
    const { toJSON } = render(<CarouselScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders the Screen wrapper with testID', () => {
    const { getByTestId } = render(<CarouselScreen />);
    expect(getByTestId('carousel-screen')).toBeTruthy();
  });

  it('renders first slide heading', () => {
    const { getByText } = render(<CarouselScreen />);
    // Heading is now a single text node with colored spans; check for segment text
    expect(getByText(/Earn 1% back/)).toBeTruthy();
  });

  it('renders first slide body text', () => {
    const { getByText } = render(<CarouselScreen />);
    expect(getByText(/For every timely payment made via UPI/)).toBeTruthy();
  });

  it('renders Skip link on each slide', () => {
    const { getAllByText } = render(<CarouselScreen />);
    expect(getAllByText(/Skip/).length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to sign-up when Skip is pressed', () => {
    const { getAllByText } = render(<CarouselScreen />);
    fireEvent.press(getAllByText(/Skip/)[0]);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-up');
  });

  it('triggers haptic feedback when Skip is pressed', () => {
    const { getAllByText } = render(<CarouselScreen />);
    fireEvent.press(getAllByText(/Skip/)[0]);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
  });
});
