/**
 * Tests for useDeepLink hook and routing logic (ST-107/ST-108)
 *
 * Tests deep link resolution, notification routing, and URL handling.
 */

import { resolveDeepLink, handleDeepLinkUrl, consumeDeepLinkParams } from '../useDeepLink';

// Mock expo-router
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  parse: (url: string) => {
    const urlObj = new URL(url.replace('flentsecured:///', 'https://x.com/'));
    return {
      scheme: url.startsWith('flentsecured') ? 'flentsecured' : 'https',
      path: urlObj.pathname,
      queryParams: Object.fromEntries(urlObj.searchParams.entries()),
    };
  },
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

// Mock Sentry breadcrumb
jest.mock('../../config/sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

describe('resolveDeepLink', () => {
  it('should resolve auth routes', () => {
    expect(resolveDeepLink('/auth/login')).toBe('/(auth)/login');
    expect(resolveDeepLink('/login')).toBe('/(auth)/login');
  });

  it('should resolve waitlist routes', () => {
    expect(resolveDeepLink('/waitlist')).toBe('/(waitlist)');
    expect(resolveDeepLink('/waitlist/approved')).toBe('/(waitlist)/approved');
  });

  it('should resolve agreement routes', () => {
    expect(resolveDeepLink('/agreement/upload')).toBe('/(agreement)/upload-agreement');
    expect(resolveDeepLink('/agreement/review')).toBe('/(agreement)/review-agreement');
    expect(resolveDeepLink('/agreement/success')).toBe('/(waitlist)');
  });

  it('should resolve setup routes', () => {
    expect(resolveDeepLink('/setup')).toBe('/(setup)/pending-steps');
    expect(resolveDeepLink('/setup/bank')).toBe('/(setup)/add-bank');
    expect(resolveDeepLink('/setup/utility')).toBe('/(setup)/add-utility');
    expect(resolveDeepLink('/setup/landlord')).toBe('/(setup)/invite-landlord');
  });

  it('should resolve payment routes', () => {
    expect(resolveDeepLink('/payment')).toBe('/(payment)/select-method');
    expect(resolveDeepLink('/payment/success')).toBe('/(payment)/success');
    expect(resolveDeepLink('/payment/failed')).toBe('/(payment)/failed');
    expect(resolveDeepLink('/payment/receipt')).toBe('/(payment)/receipt');
  });

  it('should resolve main/dashboard routes', () => {
    expect(resolveDeepLink('/home')).toBe('/(main)');
    expect(resolveDeepLink('/dashboard')).toBe('/(main)');
  });

  it('should resolve profile routes', () => {
    expect(resolveDeepLink('/profile')).toBe('/(profile)');
    expect(resolveDeepLink('/profile/edit')).toBe('/(profile)/edit-profile');
    expect(resolveDeepLink('/profile/payment-methods')).toBe('/(profile)/payment-methods');
    expect(resolveDeepLink('/profile/notifications')).toBe('/(profile)/notification-settings');
  });

  it('should resolve transaction routes', () => {
    expect(resolveDeepLink('/transactions')).toBe('/(transactions)');
  });

  it('should pass through expo-router group paths', () => {
    expect(resolveDeepLink('/(main)')).toBe('/(main)');
    expect(resolveDeepLink('/(payment)/success')).toBe('/(payment)/success');
  });

  it('should return null for unknown paths', () => {
    expect(resolveDeepLink('/unknown')).toBeNull();
    expect(resolveDeepLink('/foo/bar')).toBeNull();
  });

  it('should return null for empty path', () => {
    expect(resolveDeepLink('')).toBeNull();
  });

  it('should strip query params for route matching', () => {
    expect(resolveDeepLink('/payment/success?id=123')).toBe('/(payment)/success');
  });

  it('should handle paths without leading slash', () => {
    expect(resolveDeepLink('home')).toBe('/(main)');
  });
});

describe('handleDeepLinkUrl', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    // Clear any pending deep link params
    consumeDeepLinkParams();
  });

  it('should navigate to resolved route for custom scheme', () => {
    const result = handleDeepLinkUrl('flentsecured:///payment/success');

    expect(result).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('/(payment)/success');
  });

  it('should store query params in deep link params store', () => {
    const result = handleDeepLinkUrl('flentsecured:///payment/success?txn=abc123');

    expect(result).toBe(true);
    // Navigate without params (Expo Router v4 crashes with params on route groups)
    expect(mockNavigate).toHaveBeenCalledWith('/(payment)/success');
    // Params stored separately for target screen to consume
    const storedParams = consumeDeepLinkParams();
    expect(storedParams).toEqual({ txn: 'abc123' });
  });

  it('should not store params when URL has no query params', () => {
    handleDeepLinkUrl('flentsecured:///payment/success');
    const storedParams = consumeDeepLinkParams();
    expect(storedParams).toBeNull();
  });

  it('should return false for unknown routes', () => {
    const result = handleDeepLinkUrl('flentsecured:///unknown-page');

    expect(result).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should return false for empty URL', () => {
    expect(handleDeepLinkUrl('')).toBe(false);
  });

  it('should handle navigation errors gracefully', () => {
    mockNavigate.mockImplementation(() => {
      throw new Error('Navigation error');
    });

    // Should not throw
    const result = handleDeepLinkUrl('flentsecured:///home');
    expect(result).toBe(false);
  });
});
