import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { Screen } from '../ui/Layout/Screen';

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, edges, style, ...props }: any) => (
      <View {...props} style={style} testID="safe-area-view">
        {children}
      </View>
    ),
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});

describe('Screen', () => {
  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - default (padded, safe area top+bottom)', () => {
    const { toJSON } = render(
      <Screen>
        <Text>Screen content</Text>
      </Screen>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - not padded', () => {
    const { toJSON } = render(
      <Screen padded={false}>
        <Text>Full width content</Text>
      </Screen>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - compact padding variant', () => {
    const { toJSON } = render(
      <Screen paddingVariant="compact">
        <Text>Compact content</Text>
      </Screen>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - without safe area top', () => {
    const { toJSON } = render(
      <Screen safeAreaTop={false}>
        <Text>No top safe area</Text>
      </Screen>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - without safe area bottom', () => {
    const { toJSON } = render(
      <Screen safeAreaBottom={false}>
        <Text>No bottom safe area</Text>
      </Screen>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - no safe areas', () => {
    const { toJSON } = render(
      <Screen safeAreaTop={false} safeAreaBottom={false}>
        <Text>No safe areas</Text>
      </Screen>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - with custom style', () => {
    const { toJSON } = render(
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Text>Centered content</Text>
      </Screen>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Structure Tests ─────────────────────────────────────────────────────

  it('renders children correctly', () => {
    const { getByText } = render(
      <Screen>
        <Text>Hello World</Text>
      </Screen>
    );

    expect(getByText('Hello World')).toBeTruthy();
  });

  it('renders multiple children', () => {
    const { getByText } = render(
      <Screen>
        <Text>First child</Text>
        <Text>Second child</Text>
      </Screen>
    );

    expect(getByText('First child')).toBeTruthy();
    expect(getByText('Second child')).toBeTruthy();
  });

  // ── TestID Tests ────────────────────────────────────────────────────────

  it('renders with testID', () => {
    const { getByTestId } = render(
      <Screen testID="home-screen">
        <Text>Content</Text>
      </Screen>
    );

    expect(getByTestId('home-screen')).toBeTruthy();
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with nested Views', () => {
    const { toJSON } = render(
      <Screen>
        <View>
          <View>
            <Text>Deeply nested</Text>
          </View>
        </View>
      </Screen>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with empty children', () => {
    const { toJSON } = render(
      <Screen>
        <View />
      </Screen>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
