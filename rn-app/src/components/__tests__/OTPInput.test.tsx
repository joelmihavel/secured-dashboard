import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OTPInput } from '../ui/Input/OTPInput';

describe('OTPInput', () => {
  const mockOnChangeText = jest.fn();
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    mockOnChangeText.mockClear();
    mockOnComplete.mockClear();
  });

  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - empty state', () => {
    const { toJSON } = render(
      <OTPInput
        value=""
        onChangeText={mockOnChangeText}
        autoFocus={false}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - partially filled', () => {
    const { toJSON } = render(
      <OTPInput
        value="123"
        onChangeText={mockOnChangeText}
        autoFocus={false}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - fully filled', () => {
    const { toJSON } = render(
      <OTPInput
        value="123456"
        onChangeText={mockOnChangeText}
        autoFocus={false}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - with error', () => {
    const { toJSON } = render(
      <OTPInput
        value="123456"
        onChangeText={mockOnChangeText}
        error="Invalid OTP. Please try again."
        autoFocus={false}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - disabled', () => {
    const { toJSON } = render(
      <OTPInput
        value="123"
        onChangeText={mockOnChangeText}
        disabled
        autoFocus={false}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Interaction Tests ───────────────────────────────────────────────────

  it('calls onChangeText when digits are entered', () => {
    const { getByTestId } = render(
      <OTPInput
        value=""
        onChangeText={mockOnChangeText}
        testID="otp-input"
        autoFocus={false}
      />
    );

    fireEvent.changeText(getByTestId('otp-input'), '1');
    expect(mockOnChangeText).toHaveBeenCalledWith('1');
  });

  it('strips non-digit characters', () => {
    const { getByTestId } = render(
      <OTPInput
        value=""
        onChangeText={mockOnChangeText}
        testID="otp-input"
        autoFocus={false}
      />
    );

    fireEvent.changeText(getByTestId('otp-input'), '12a3b');
    expect(mockOnChangeText).toHaveBeenCalledWith('123');
  });

  it('limits input to 6 digits', () => {
    const { getByTestId } = render(
      <OTPInput
        value=""
        onChangeText={mockOnChangeText}
        testID="otp-input"
        autoFocus={false}
      />
    );

    fireEvent.changeText(getByTestId('otp-input'), '12345678');
    expect(mockOnChangeText).toHaveBeenCalledWith('123456');
  });

  it('calls onComplete when 6 digits are entered', () => {
    const { getByTestId } = render(
      <OTPInput
        value="12345"
        onChangeText={mockOnChangeText}
        onComplete={mockOnComplete}
        testID="otp-input"
        autoFocus={false}
      />
    );

    fireEvent.changeText(getByTestId('otp-input'), '123456');
    expect(mockOnComplete).toHaveBeenCalledWith('123456');
  });

  it('does not call onComplete for partial input', () => {
    const { getByTestId } = render(
      <OTPInput
        value=""
        onChangeText={mockOnChangeText}
        onComplete={mockOnComplete}
        testID="otp-input"
        autoFocus={false}
      />
    );

    fireEvent.changeText(getByTestId('otp-input'), '123');
    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  // ── Display Tests ───────────────────────────────────────────────────────

  it('shows "0" placeholder in empty boxes', () => {
    const { getAllByText } = render(
      <OTPInput
        value=""
        onChangeText={mockOnChangeText}
        autoFocus={false}
      />
    );

    // Empty boxes show "0" per Figma design (but one might be active/cursor)
    const zeros = getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(5);
  });

  it('displays error message when provided', () => {
    const { getByText } = render(
      <OTPInput
        value="123456"
        onChangeText={mockOnChangeText}
        error="OTP expired. Request a new one."
        autoFocus={false}
      />
    );

    expect(getByText('OTP expired. Request a new one.')).toBeTruthy();
  });

  it('does not display error text when no error', () => {
    const { queryByText } = render(
      <OTPInput
        value="123456"
        onChangeText={mockOnChangeText}
        autoFocus={false}
      />
    );

    expect(queryByText('Invalid OTP')).toBeNull();
  });

  it('displays separator between digit groups', () => {
    const { getByText } = render(
      <OTPInput
        value=""
        onChangeText={mockOnChangeText}
        autoFocus={false}
      />
    );

    expect(getByText('-')).toBeTruthy();
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with testID', () => {
    const { getByTestId } = render(
      <OTPInput
        value=""
        onChangeText={mockOnChangeText}
        testID="otp-field"
        autoFocus={false}
      />
    );

    expect(getByTestId('otp-field')).toBeTruthy();
  });

  it('handles empty string value', () => {
    const { toJSON } = render(
      <OTPInput
        value=""
        onChangeText={mockOnChangeText}
        autoFocus={false}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
