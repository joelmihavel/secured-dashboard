import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PhoneInput } from '../ui/Input/PhoneInput';

describe('PhoneInput', () => {
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    mockOnChangeText.mockClear();
  });

  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - empty state', () => {
    const { toJSON } = render(
      <PhoneInput
        label="Phone Number"
        value=""
        onChangeText={mockOnChangeText}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - with value', () => {
    const { toJSON } = render(
      <PhoneInput
        label="Phone Number"
        value="98765 43210"
        onChangeText={mockOnChangeText}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - with error', () => {
    const { toJSON } = render(
      <PhoneInput
        label="Phone Number"
        value="98765 43210"
        onChangeText={mockOnChangeText}
        error="This number is already registered."
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - disabled', () => {
    const { toJSON } = render(
      <PhoneInput
        label="Phone Number"
        value=""
        onChangeText={mockOnChangeText}
        disabled
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - with hint text', () => {
    const { toJSON } = render(
      <PhoneInput
        label="Phone Number"
        value=""
        onChangeText={mockOnChangeText}
        hintText="We'll send you an OTP"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - custom country code', () => {
    const { toJSON } = render(
      <PhoneInput
        label="Phone Number"
        value=""
        onChangeText={mockOnChangeText}
        countryCode="+1"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - custom placeholder', () => {
    const { toJSON } = render(
      <PhoneInput
        label="Mobile"
        value=""
        onChangeText={mockOnChangeText}
        placeholder="Your phone number"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Interaction Tests ───────────────────────────────────────────────────

  it('calls onChangeText with formatted value when text is entered', () => {
    const { getByTestId } = render(
      <PhoneInput
        label="Phone Number"
        value=""
        onChangeText={mockOnChangeText}
        testID="phone-input"
      />
    );

    fireEvent.changeText(getByTestId('phone-input'), '9876543210');
    expect(mockOnChangeText).toHaveBeenCalledWith('98765 43210');
  });

  it('formats phone number with space after 5 digits', () => {
    const { getByTestId } = render(
      <PhoneInput
        label="Phone Number"
        value=""
        onChangeText={mockOnChangeText}
        testID="phone-input"
      />
    );

    fireEvent.changeText(getByTestId('phone-input'), '123456');
    expect(mockOnChangeText).toHaveBeenCalledWith('12345 6');
  });

  it('strips non-digit characters', () => {
    const { getByTestId } = render(
      <PhoneInput
        label="Phone Number"
        value=""
        onChangeText={mockOnChangeText}
        testID="phone-input"
      />
    );

    fireEvent.changeText(getByTestId('phone-input'), '98-76-54');
    expect(mockOnChangeText).toHaveBeenCalledWith('98765 4');
  });

  it('handles focus event', () => {
    const { getByTestId } = render(
      <PhoneInput
        label="Phone Number"
        value=""
        onChangeText={mockOnChangeText}
        testID="phone-input"
      />
    );

    fireEvent(getByTestId('phone-input'), 'focus');
    // No crash, focus state handled internally
  });

  it('handles blur event', () => {
    const { getByTestId } = render(
      <PhoneInput
        label="Phone Number"
        value=""
        onChangeText={mockOnChangeText}
        testID="phone-input"
      />
    );

    fireEvent(getByTestId('phone-input'), 'blur');
    // No crash, blur state handled internally
  });

  // ── Display Tests ───────────────────────────────────────────────────────

  it('displays label text', () => {
    const { getByText } = render(
      <PhoneInput
        label="Mobile Number"
        value=""
        onChangeText={mockOnChangeText}
      />
    );

    expect(getByText('Mobile Number')).toBeTruthy();
  });

  it('displays country code', () => {
    const { getByText } = render(
      <PhoneInput
        label="Phone"
        value=""
        onChangeText={mockOnChangeText}
        countryCode="+91"
      />
    );

    expect(getByText('+91')).toBeTruthy();
  });

  it('displays error message when provided', () => {
    const { getByText } = render(
      <PhoneInput
        label="Phone"
        value="98765 43210"
        onChangeText={mockOnChangeText}
        error="Invalid number"
      />
    );

    expect(getByText('Invalid number')).toBeTruthy();
  });

  it('displays hint text when no error', () => {
    const { getByText } = render(
      <PhoneInput
        label="Phone"
        value=""
        onChangeText={mockOnChangeText}
        hintText="10 digits"
      />
    );

    expect(getByText('10 digits')).toBeTruthy();
  });

  it('shows error instead of hint when both provided', () => {
    const { getByText, queryByText } = render(
      <PhoneInput
        label="Phone"
        value="98765 43210"
        onChangeText={mockOnChangeText}
        error="Invalid"
        hintText="10 digits"
      />
    );

    expect(getByText('Invalid')).toBeTruthy();
    expect(queryByText('10 digits')).toBeNull();
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with testID', () => {
    const { getByTestId } = render(
      <PhoneInput
        label="Phone"
        value=""
        onChangeText={mockOnChangeText}
        testID="phone-field"
      />
    );

    expect(getByTestId('phone-field')).toBeTruthy();
  });

  it('renders with empty label', () => {
    const { toJSON } = render(
      <PhoneInput
        label=""
        value=""
        onChangeText={mockOnChangeText}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
