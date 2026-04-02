/**
 * Setup Guard Hook
 *
 * Enforces sequential setup flow completion (bank -> utility -> landlord).
 * Prevents users from skipping steps by determining the correct active step
 * based on server-side verification status from the dashboard.
 *
 * Usage:
 *   const { activeStep, canAccess, shouldRedirectTo } = useSetupGuard('utility');
 *   // If canAccess is false, redirect to shouldRedirectTo
 */

import { useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useVerificationStatus } from './useDashboard';
import type { SetupStepId } from '../stores/setup';

// Ordered setup steps -- must complete in this sequence
const SETUP_STEP_ORDER: SetupStepId[] = ['bank', 'utility', 'landlord'];

// Route map for each setup step
const STEP_ROUTES: Record<SetupStepId, string> = {
  bank: '/(setup)/add-bank',
  utility: '/(setup)/add-utility',
  landlord: '/(setup)/invite-landlord',
};

export interface SetupGuardResult {
  /** The step the user should currently be on based on verification status */
  activeStep: SetupStepId;

  /** Index of the active step (0-based) */
  activeStepIndex: number;

  /** Whether the requested step can be accessed (all prior steps are verified) */
  canAccess: (step: SetupStepId) => boolean;

  /** Route to redirect to if the requested step is not accessible */
  shouldRedirectTo: string | null;

  /** Whether all setup steps are complete */
  isSetupComplete: boolean;

  /** Whether data is still loading */
  isLoading: boolean;

  /** Navigate to the correct active step */
  navigateToActiveStep: () => void;

  /** The ordered list of steps with their verification status */
  steps: Array<{
    id: SetupStepId;
    index: number;
    verified: boolean;
    accessible: boolean;
    route: string;
  }>;
}

/**
 * Hook that enforces sequential setup flow.
 *
 * @param requestedStep - The step the user is trying to access (optional).
 *   If provided, the hook will compute whether access should be granted.
 */
export function useSetupGuard(requestedStep?: SetupStepId): SetupGuardResult {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const {
    bankVerified,
    utilityVerified,
    landlordApproved,
    allVerified,
    isLoading,
  } = useVerificationStatus();

  // Map verification status to step IDs
  const verificationMap = useMemo<Record<SetupStepId, boolean>>(
    () => ({
      bank: bankVerified,
      utility: utilityVerified,
      landlord: landlordApproved,
    }),
    [bankVerified, utilityVerified, landlordApproved]
  );

  // Determine the first incomplete step (the active step)
  const activeStep = useMemo<SetupStepId>(() => {
    for (const step of SETUP_STEP_ORDER) {
      if (!verificationMap[step]) {
        return step;
      }
    }
    // All steps complete -- return last step
    return 'landlord';
  }, [verificationMap]);

  const activeStepIndex = SETUP_STEP_ORDER.indexOf(activeStep);

  // Build enriched steps array
  const steps = useMemo(
    () =>
      SETUP_STEP_ORDER.map((id, index) => ({
        id,
        index,
        verified: verificationMap[id],
        accessible: index <= activeStepIndex,
        route: STEP_ROUTES[id],
      })),
    [verificationMap, activeStepIndex]
  );

  // Check if a given step can be accessed
  const canAccess = useCallback(
    (step: SetupStepId): boolean => {
      const stepIndex = SETUP_STEP_ORDER.indexOf(step);
      // A step is accessible if all previous steps are verified,
      // meaning the step index is at most the active step index
      return stepIndex <= activeStepIndex;
    },
    [activeStepIndex]
  );

  // Compute redirect target for the requested step
  const shouldRedirectTo = useMemo<string | null>(() => {
    if (!requestedStep) return null;
    if (canAccess(requestedStep)) return null;
    // User tried to access a step they haven't unlocked yet
    return STEP_ROUTES[activeStep];
  }, [requestedStep, canAccess, activeStep]);

  // Navigate to the active step
  const navigateToActiveStep = useCallback(() => {
    const route = STEP_ROUTES[activeStep];
    routerRef.current.push(route as never);
  }, [activeStep]);

  return {
    activeStep,
    activeStepIndex,
    canAccess,
    shouldRedirectTo,
    isSetupComplete: allVerified,
    isLoading,
    navigateToActiveStep,
    steps,
  };
}
