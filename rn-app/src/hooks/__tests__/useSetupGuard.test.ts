/**
 * Tests for useSetupGuard hook
 *
 * Verifies sequential setup flow enforcement:
 * bank -> utility -> landlord
 */

import { renderHook } from '@testing-library/react-native';

// Mock dependencies
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
  }),
}));

// Mutable verification state for tests
let mockVerificationStatus = {
  bankVerified: false,
  utilityVerified: false,
  landlordApproved: false,
  allVerified: false,
  isLoading: false,
  error: null,
  pendingSteps: ['bank', 'utility', 'landlord'] as string[],
};

jest.mock('../useDashboard', () => ({
  useVerificationStatus: () => mockVerificationStatus,
  dashboardKeys: {
    all: ['dashboard'],
    data: () => ['dashboard', 'data'],
  },
}));

import { useSetupGuard } from '../useSetupGuard';

describe('useSetupGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerificationStatus = {
      bankVerified: false,
      utilityVerified: false,
      landlordApproved: false,
      allVerified: false,
      isLoading: false,
      error: null,
      pendingSteps: ['bank', 'utility', 'landlord'],
    };
  });

  describe('activeStep determination', () => {
    it('returns bank as active step when nothing is verified', () => {
      const { result } = renderHook(() => useSetupGuard());

      expect(result.current.activeStep).toBe('bank');
      expect(result.current.activeStepIndex).toBe(0);
      expect(result.current.isSetupComplete).toBe(false);
    });

    it('returns utility as active step when bank is verified', () => {
      mockVerificationStatus = {
        ...mockVerificationStatus,
        bankVerified: true,
        pendingSteps: ['utility', 'landlord'],
      };

      const { result } = renderHook(() => useSetupGuard());

      expect(result.current.activeStep).toBe('utility');
      expect(result.current.activeStepIndex).toBe(1);
    });

    it('returns landlord as active step when bank and utility are verified', () => {
      mockVerificationStatus = {
        ...mockVerificationStatus,
        bankVerified: true,
        utilityVerified: true,
        pendingSteps: ['landlord'],
      };

      const { result } = renderHook(() => useSetupGuard());

      expect(result.current.activeStep).toBe('landlord');
      expect(result.current.activeStepIndex).toBe(2);
    });

    it('marks setup as complete when all steps are verified', () => {
      mockVerificationStatus = {
        ...mockVerificationStatus,
        bankVerified: true,
        utilityVerified: true,
        landlordApproved: true,
        allVerified: true,
        pendingSteps: [],
      };

      const { result } = renderHook(() => useSetupGuard());

      expect(result.current.isSetupComplete).toBe(true);
      expect(result.current.activeStep).toBe('landlord');
    });
  });

  describe('canAccess enforcement', () => {
    it('allows access to bank step when nothing is verified', () => {
      const { result } = renderHook(() => useSetupGuard());

      expect(result.current.canAccess('bank')).toBe(true);
      expect(result.current.canAccess('utility')).toBe(false);
      expect(result.current.canAccess('landlord')).toBe(false);
    });

    it('allows access to bank and utility when bank is verified', () => {
      mockVerificationStatus = {
        ...mockVerificationStatus,
        bankVerified: true,
        pendingSteps: ['utility', 'landlord'],
      };

      const { result } = renderHook(() => useSetupGuard());

      expect(result.current.canAccess('bank')).toBe(true);
      expect(result.current.canAccess('utility')).toBe(true);
      expect(result.current.canAccess('landlord')).toBe(false);
    });

    it('allows access to all steps when bank and utility are verified', () => {
      mockVerificationStatus = {
        ...mockVerificationStatus,
        bankVerified: true,
        utilityVerified: true,
        pendingSteps: ['landlord'],
      };

      const { result } = renderHook(() => useSetupGuard());

      expect(result.current.canAccess('bank')).toBe(true);
      expect(result.current.canAccess('utility')).toBe(true);
      expect(result.current.canAccess('landlord')).toBe(true);
    });
  });

  describe('shouldRedirectTo', () => {
    it('returns null when no step is requested', () => {
      const { result } = renderHook(() => useSetupGuard());

      expect(result.current.shouldRedirectTo).toBeNull();
    });

    it('returns null when requested step is accessible', () => {
      const { result } = renderHook(() => useSetupGuard('bank'));

      expect(result.current.shouldRedirectTo).toBeNull();
    });

    it('redirects to bank when trying to access utility without bank verification', () => {
      const { result } = renderHook(() => useSetupGuard('utility'));

      expect(result.current.shouldRedirectTo).toBe('/(setup)/add-bank');
    });

    it('redirects to utility when trying to access landlord without utility verification', () => {
      mockVerificationStatus = {
        ...mockVerificationStatus,
        bankVerified: true,
        pendingSteps: ['utility', 'landlord'],
      };

      const { result } = renderHook(() => useSetupGuard('landlord'));

      expect(result.current.shouldRedirectTo).toBe('/(setup)/add-utility');
    });

    it('returns null for landlord when bank and utility are verified', () => {
      mockVerificationStatus = {
        ...mockVerificationStatus,
        bankVerified: true,
        utilityVerified: true,
        pendingSteps: ['landlord'],
      };

      const { result } = renderHook(() => useSetupGuard('landlord'));

      expect(result.current.shouldRedirectTo).toBeNull();
    });
  });

  describe('steps array', () => {
    it('provides enriched steps with verification and accessibility status', () => {
      mockVerificationStatus = {
        ...mockVerificationStatus,
        bankVerified: true,
        pendingSteps: ['utility', 'landlord'],
      };

      const { result } = renderHook(() => useSetupGuard());
      const { steps } = result.current;

      expect(steps).toHaveLength(3);

      expect(steps[0]).toEqual({
        id: 'bank',
        index: 0,
        verified: true,
        accessible: true,
        route: '/(setup)/add-bank',
      });

      expect(steps[1]).toEqual({
        id: 'utility',
        index: 1,
        verified: false,
        accessible: true,
        route: '/(setup)/add-utility',
      });

      expect(steps[2]).toEqual({
        id: 'landlord',
        index: 2,
        verified: false,
        accessible: false,
        route: '/(setup)/invite-landlord',
      });
    });
  });

  describe('navigateToActiveStep', () => {
    it('navigates to the correct active step route', () => {
      mockVerificationStatus = {
        ...mockVerificationStatus,
        bankVerified: true,
        pendingSteps: ['utility', 'landlord'],
      };

      const { result } = renderHook(() => useSetupGuard());
      result.current.navigateToActiveStep();

      expect(mockPush).toHaveBeenCalledWith('/(setup)/add-utility');
    });
  });

  describe('loading state', () => {
    it('passes through loading state from verification status', () => {
      mockVerificationStatus = {
        ...mockVerificationStatus,
        isLoading: true,
      };

      const { result } = renderHook(() => useSetupGuard());

      expect(result.current.isLoading).toBe(true);
    });
  });
});
