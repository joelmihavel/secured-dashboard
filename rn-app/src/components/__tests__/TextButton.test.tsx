import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TextButton } from '../ui/Button/TextButton';

describe('TextButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - default (with underline)', () => {
    const { toJSON } = render(
      <TextButton title="Forgot Password?" onPress={mockOnPress} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - without underline', () => {
    const { toJSON } = render(
      <TextButton title="Skip" onPress={mockOnPress} underline={false} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - disabled', () => {
    const { toJSON } = render(
      <TextButton title="Resend OTP" onPress={mockOnPress} disabled />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - with custom style', () => {
    const { toJSON } = render(
      <TextButton
        title="Custom"
        onPress={mockOnPress}
        style={{ marginTop: 16 }}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Interaction Tests ───────────────────────────────────────────────────

  it('calls onPress when pressed', () => {
    const { getByRole } = render(
      <TextButton title="Forgot Password?" onPress={mockOnPress} />
    );

    fireEvent.press(getByRole('button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const { getByRole } = render(
      <TextButton title="Resend OTP" onPress={mockOnPress} disabled />
    );

    fireEvent.press(getByRole('button'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  // ── Accessibility Tests ─────────────────────────────────────────────────

  it('has correct accessibility role', () => {
    const { getByRole } = render(
      <TextButton title="Learn more" onPress={mockOnPress} />
    );

    expect(getByRole('button')).toBeTruthy();
  });

  it('has correct accessibility label matching title', () => {
    const { getByRole } = render(
      <TextButton title="Terms & Conditions" onPress={mockOnPress} />
    );

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Terms & Conditions');
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with testID', () => {
    const { getByTestId } = render(
      <TextButton title="Test" onPress={mockOnPress} testID="text-btn" />
    );

    expect(getByTestId('text-btn')).toBeTruthy();
  });

  it('renders with long text', () => {
    const longTitle = 'This is a very long button title that might overflow the container width';
    const { toJSON } = render(
      <TextButton title={longTitle} onPress={mockOnPress} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders with empty string title', () => {
    const { toJSON } = render(
      <TextButton title="" onPress={mockOnPress} />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
