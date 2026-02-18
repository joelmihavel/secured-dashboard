import React from 'react';
import { render } from '@testing-library/react-native';

import AboutScreen from '../about';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

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

jest.mock('@/src/components/patterns', () => ({
  DottedPattern: () => null,
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: (props: any) => <View {...props} /> };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.0.0', ios: { buildNumber: '1' } },
  },
}));

jest.mock('@/src/components/ui/Layout/Logo', () => {
  const { View } = require('react-native');
  return { __esModule: true, Logo: (props: any) => <View testID="logo" /> };
});

describe('AboutScreen', () => {
  it('renders with testID "about-screen"', () => {
    const { getByTestId } = render(<AboutScreen />);
    expect(getByTestId('about-screen')).toBeTruthy();
  });

  it('renders About header text', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('About')).toBeTruthy();
  });

  it('renders Flent Secured title', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('Flent Secured')).toBeTruthy();
  });

  it('renders Terms of Service link', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('Terms of Service')).toBeTruthy();
  });

  it('renders Privacy Policy link', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('Privacy Policy')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<AboutScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<AboutScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
