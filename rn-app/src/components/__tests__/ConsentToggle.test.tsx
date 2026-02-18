import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConsentToggle } from '../composed/auth/ConsentToggle';

describe('ConsentToggle', () => {
  const mockOnValueChange = jest.fn();

  beforeEach(() => {
    mockOnValueChange.mockClear();
  });

  // ── Snapshot Tests ──────────────────────────────────────────────────────

  it('renders correctly - off state', () => {
    const { toJSON } = render(
      <ConsentToggle value={false} onValueChange={mockOnValueChange} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - on state', () => {
    const { toJSON } = render(
      <ConsentToggle value={true} onValueChange={mockOnValueChange} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - disabled off', () => {
    const { toJSON } = render(
      <ConsentToggle
        value={false}
        onValueChange={mockOnValueChange}
        disabled
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly - disabled on', () => {
    const { toJSON } = render(
      <ConsentToggle
        value={true}
        onValueChange={mockOnValueChange}
        disabled
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Interaction Tests ───────────────────────────────────────────────────

  it('calls onValueChange with true when toggled from off', () => {
    const { getByRole } = render(
      <ConsentToggle value={false} onValueChange={mockOnValueChange} />
    );

    fireEvent.press(getByRole('switch'));
    expect(mockOnValueChange).toHaveBeenCalledWith(true);
  });

  it('calls onValueChange with false when toggled from on', () => {
    const { getByRole } = render(
      <ConsentToggle value={true} onValueChange={mockOnValueChange} />
    );

    fireEvent.press(getByRole('switch'));
    expect(mockOnValueChange).toHaveBeenCalledWith(false);
  });

  it('does not call onValueChange when disabled', () => {
    const { getByRole } = render(
      <ConsentToggle
        value={false}
        onValueChange={mockOnValueChange}
        disabled
      />
    );

    fireEvent.press(getByRole('switch'));
    expect(mockOnValueChange).not.toHaveBeenCalled();
  });

  // ── Accessibility Tests ─────────────────────────────────────────────────

  it('has correct accessibility role (switch)', () => {
    const { getByRole } = render(
      <ConsentToggle value={false} onValueChange={mockOnValueChange} />
    );

    expect(getByRole('switch')).toBeTruthy();
  });

  it('has correct accessibility state when off', () => {
    const { getByRole } = render(
      <ConsentToggle value={false} onValueChange={mockOnValueChange} />
    );

    const toggle = getByRole('switch');
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
  });

  it('has correct accessibility state when on', () => {
    const { getByRole } = render(
      <ConsentToggle value={true} onValueChange={mockOnValueChange} />
    );

    const toggle = getByRole('switch');
    expect(toggle.props.accessibilityState).toMatchObject({ checked: true });
  });

  // ── Display Tests ───────────────────────────────────────────────────────

  it('displays consent text', () => {
    const { getByText } = render(
      <ConsentToggle value={false} onValueChange={mockOnValueChange} />
    );

    expect(getByText(/I consent to a one-time verification/)).toBeTruthy();
  });

  it('displays Cashfree link text', () => {
    const { getByText } = render(
      <ConsentToggle value={false} onValueChange={mockOnValueChange} />
    );

    expect(getByText('Cashfree')).toBeTruthy();
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  it('renders with testID', () => {
    const { getByTestId } = render(
      <ConsentToggle
        value={false}
        onValueChange={mockOnValueChange}
        testID="consent-toggle"
      />
    );

    expect(getByTestId('consent-toggle')).toBeTruthy();
  });
});
