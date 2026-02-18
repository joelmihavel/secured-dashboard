import React from 'react';
import { render } from '@testing-library/react-native';

import NotificationSettingsScreen from '../notifications';

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

describe('NotificationSettingsScreen', () => {
  it('renders with testID "notification-settings-screen"', () => {
    const { getByTestId } = render(<NotificationSettingsScreen />);
    expect(getByTestId('notification-settings-screen')).toBeTruthy();
  });

  it('renders Notifications header text', () => {
    const { getByText } = render(<NotificationSettingsScreen />);
    expect(getByText('Notifications')).toBeTruthy();
  });

  it('renders Payment Reminders setting', () => {
    const { getByText } = render(<NotificationSettingsScreen />);
    expect(getByText('Payment Reminders')).toBeTruthy();
  });

  it('renders Payment Confirmations setting', () => {
    const { getByText } = render(<NotificationSettingsScreen />);
    expect(getByText('Payment Confirmations')).toBeTruthy();
  });

  it('renders Cashback Alerts setting', () => {
    const { getByText } = render(<NotificationSettingsScreen />);
    expect(getByText('Cashback Alerts')).toBeTruthy();
  });

  it('renders SMS Alerts setting', () => {
    const { getByText } = render(<NotificationSettingsScreen />);
    expect(getByText('SMS Alerts')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<NotificationSettingsScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<NotificationSettingsScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
