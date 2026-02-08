import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PrimaryButton } from '../ui/Button/PrimaryButton';

describe('PrimaryButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders correctly - default', () => {
    const { toJSON } = render(
      <PrimaryButton title="Pay Now" onPress={mockOnPress} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - disabled', () => {
    const { toJSON } = render(
      <PrimaryButton title="Pay Now" onPress={mockOnPress} disabled />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - loading', () => {
    const { toJSON } = render(
      <PrimaryButton title="Pay Now" onPress={mockOnPress} loading />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - without divider', () => {
    const { toJSON } = render(
      <PrimaryButton title="Continue" onPress={mockOnPress} showDivider={false} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - not full width', () => {
    const { toJSON } = render(
      <PrimaryButton title="Submit" onPress={mockOnPress} fullWidth={false} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('calls onPress when pressed', () => {
    const { getByRole } = render(
      <PrimaryButton title="Pay Now" onPress={mockOnPress} />
    );

    fireEvent.press(getByRole('button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const { getByRole } = render(
      <PrimaryButton title="Pay Now" onPress={mockOnPress} disabled />
    );

    fireEvent.press(getByRole('button'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when loading', () => {
    const { getByRole } = render(
      <PrimaryButton title="Pay Now" onPress={mockOnPress} loading />
    );

    fireEvent.press(getByRole('button'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('has correct accessibility properties', () => {
    const { getByRole } = render(
      <PrimaryButton title="Pay Now" onPress={mockOnPress} />
    );

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Pay Now');
    expect(button.props.accessibilityState).toEqual({ disabled: false });
  });

  it('has correct accessibility state when disabled', () => {
    const { getByRole } = render(
      <PrimaryButton title="Pay Now" onPress={mockOnPress} disabled />
    );

    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
  });

  it('renders with testID', () => {
    const { getByTestId } = render(
      <PrimaryButton title="Pay Now" onPress={mockOnPress} testID="pay-button" />
    );

    expect(getByTestId('pay-button')).toBeTruthy();
  });
});
