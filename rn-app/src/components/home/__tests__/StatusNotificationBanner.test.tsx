import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { StatusNotificationBanner } from '../StatusNotificationBanner';

describe('StatusNotificationBanner', () => {
  it('renders verification_pending text', () => {
    const { getByText } = render(
      <StatusNotificationBanner type="verification_pending" />
    );
    expect(getByText('Cashbacks will be accumulated till verifications are complete.')).toBeTruthy();
  });

  it('renders landlord_rejected text with red color', () => {
    const { getByText } = render(
      <StatusNotificationBanner type="landlord_rejected" />
    );
    const text = getByText('Your landlord has rejected your tenancy request.');
    expect(text).toBeTruthy();
    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#E5484D' })])
    );
  });

  it('renders custom message for rent_due', () => {
    const { getByText } = render(
      <StatusNotificationBanner type="rent_due" customMessage="Your rent is due on 5 Mar" />
    );
    expect(getByText('Your rent is due on 5 Mar')).toBeTruthy();
  });

  it('renders default text when no customMessage for rent_due', () => {
    const { getByText } = render(
      <StatusNotificationBanner type="rent_due" />
    );
    expect(getByText('Your rent is due')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <StatusNotificationBanner type="verification_pending" onPress={onPress} />
    );
    // The Pressable wraps the Animated.View, so we find the container's parent
    const banner = getByTestId('status-notification-banner');
    // fireEvent.press on parent pressable
    fireEvent.press(banner);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders with testID', () => {
    const { getByTestId } = render(
      <StatusNotificationBanner type="verification_pending" />
    );
    expect(getByTestId('status-notification-banner')).toBeTruthy();
  });
});
