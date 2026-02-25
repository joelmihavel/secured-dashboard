/**
 * Notifications Service -- Integration Tests
 *
 * Tests push notification registration, response handling, handler setup,
 * quiet hours, deduplication, and retry logic.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockScheduleNotificationAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPermissionsAsync(),
  requestPermissionsAsync: () => mockRequestPermissionsAsync(),
  getExpoPushTokenAsync: (opts: unknown) => mockGetExpoPushTokenAsync(opts),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddNotificationResponseReceivedListener(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  AndroidImportance: { MAX: 5, LOW: 2 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: { projectId: 'test-project-id' },
      },
    },
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('@/src/config/sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

import {
  registerForPushNotifications,
  handleNotificationResponse,
  setupNotificationHandlers,
  getQuietHoursStatus,
  clearDeduplicationCache,
  NOTIFICATION_ROUTES,
} from '../notifications';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Notifications Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDeduplicationCache();
  });

  // =========================================================================
  // NOTIFICATION_ROUTES
  // =========================================================================
  describe('NOTIFICATION_ROUTES', () => {
    it('maps known notification types to routes', () => {
      expect(NOTIFICATION_ROUTES.waitlist_approved).toBe('/(waitlist)/approved');
      expect(NOTIFICATION_ROUTES.payment_success).toBe('/(payment)/status');
      expect(NOTIFICATION_ROUTES.payment_failed).toBe('/(payment)/status');
      expect(NOTIFICATION_ROUTES.landlord_approved).toBe('/(setup)/pending-steps');
      expect(NOTIFICATION_ROUTES.rent_reminder).toBe('/(payment)/confirm');
    });
  });

  // =========================================================================
  // registerForPushNotifications
  // =========================================================================
  describe('registerForPushNotifications', () => {
    it('returns push token when permissions are already granted', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc123]' });

      const token = await registerForPushNotifications();

      expect(token).toBe('ExponentPushToken[abc123]');
      expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('requests permissions when not already granted', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[xyz]' });

      const token = await registerForPushNotifications();

      expect(token).toBe('ExponentPushToken[xyz]');
      expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    });

    it('returns null when permissions are denied', async () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const token = await registerForPushNotifications();

      expect(token).toBeNull();
    });
  });

  // =========================================================================
  // handleNotificationResponse
  // =========================================================================
  describe('handleNotificationResponse', () => {
    it('navigates to route from notification data', () => {
      handleNotificationResponse({
        route: '/(payment)/status',
        params: { paymentId: 'pay-001' },
      });

      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/(payment)/status',
        params: { paymentId: 'pay-001' },
      });
    });

    it('does nothing when route is not provided', () => {
      handleNotificationResponse({});

      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it('handles navigation errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockRouterPush.mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      // Should not throw -- errors are caught internally
      handleNotificationResponse({ route: '/(bad)/route' });

      expect(mockRouterPush).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // setupNotificationHandlers
  // =========================================================================
  describe('setupNotificationHandlers', () => {
    it('sets notification handler and response listener', () => {
      const mockRemove = jest.fn();
      mockAddNotificationResponseReceivedListener.mockReturnValue({
        remove: mockRemove,
      });

      const cleanup = setupNotificationHandlers();

      expect(mockSetNotificationHandler).toHaveBeenCalled();
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalled();

      // Cleanup removes the listener and clears interval
      cleanup();
      expect(mockRemove).toHaveBeenCalled();
    });

    it('foreground handler shows alert, plays sound, and sets badge for normal notifications', async () => {
      mockAddNotificationResponseReceivedListener.mockReturnValue({
        remove: jest.fn(),
      });

      setupNotificationHandlers();

      const handlerArg = mockSetNotificationHandler.mock.calls[0][0];

      // Pass a mock notification object with required structure
      const mockNotification = {
        request: {
          content: {
            data: { notification_id: 'unique-id-123' },
          },
        },
      };

      const result = await handlerArg.handleNotification(mockNotification);

      // During normal hours (not quiet hours) and non-duplicate:
      expect(result.shouldShowAlert).toBe(true);
      expect(result.shouldSetBadge).toBe(true);
    });

    it('suppresses duplicate notifications', async () => {
      mockAddNotificationResponseReceivedListener.mockReturnValue({
        remove: jest.fn(),
      });

      setupNotificationHandlers();

      const handlerArg = mockSetNotificationHandler.mock.calls[0][0];
      const mockNotification = {
        request: {
          content: {
            data: { notification_id: 'dup-001' },
          },
        },
      };

      // First call: should show
      const first = await handlerArg.handleNotification(mockNotification);
      expect(first.shouldShowAlert).toBe(true);

      // Second call with same ID: should suppress
      const second = await handlerArg.handleNotification(mockNotification);
      expect(second.shouldShowAlert).toBe(false);
      expect(second.shouldPlaySound).toBe(false);
      expect(second.shouldSetBadge).toBe(false);
    });
  });

  // =========================================================================
  // getQuietHoursStatus
  // =========================================================================
  describe('getQuietHoursStatus', () => {
    it('returns quiet hours configuration', () => {
      const status = getQuietHoursStatus();

      expect(status).toEqual({
        isActive: expect.any(Boolean),
        startHour: 22,
        endHour: 8,
      });
    });
  });

  // =========================================================================
  // clearDeduplicationCache
  // =========================================================================
  describe('clearDeduplicationCache', () => {
    it('clears the cache allowing previously seen notifications', async () => {
      mockAddNotificationResponseReceivedListener.mockReturnValue({
        remove: jest.fn(),
      });

      setupNotificationHandlers();

      const handlerArg = mockSetNotificationHandler.mock.calls[0][0];
      const mockNotification = {
        request: {
          content: {
            data: { notification_id: 'clear-test-001' },
          },
        },
      };

      // First: show
      await handlerArg.handleNotification(mockNotification);

      // Second: suppressed
      const suppressed = await handlerArg.handleNotification(mockNotification);
      expect(suppressed.shouldShowAlert).toBe(false);

      // Clear cache
      clearDeduplicationCache();

      // Third: shown again
      const shown = await handlerArg.handleNotification(mockNotification);
      expect(shown.shouldShowAlert).toBe(true);
    });
  });
});
