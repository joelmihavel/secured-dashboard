import React from 'react';
import { render } from '@testing-library/react-native';

import HelpScreen from '../help';

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

describe('HelpScreen', () => {
  it('renders with testID "help-screen"', () => {
    const { getByTestId } = render(<HelpScreen />);
    expect(getByTestId('help-screen')).toBeTruthy();
  });

  it('renders Help & Support title', () => {
    const { getByText } = render(<HelpScreen />);
    expect(getByText('Help & Support')).toBeTruthy();
  });

  it('renders CONTACT US section', () => {
    const { getByText } = render(<HelpScreen />);
    expect(getByText('CONTACT US')).toBeTruthy();
  });

  it('renders WhatsApp contact option', () => {
    const { getByText } = render(<HelpScreen />);
    expect(getByText('WhatsApp')).toBeTruthy();
  });

  it('renders Email contact option', () => {
    const { getByText } = render(<HelpScreen />);
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders Call contact option', () => {
    const { getByText } = render(<HelpScreen />);
    expect(getByText('Call')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<HelpScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<HelpScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
