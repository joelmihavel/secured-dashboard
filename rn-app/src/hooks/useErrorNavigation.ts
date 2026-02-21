/**
 * Error Bus → Router Bridge
 *
 * Subscribes to the error event bus and navigates to /error.
 * Must be called inside router context (RootLayoutInner).
 */

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { setErrorListener, type ErrorReport } from '../services/errorReporting';

/**
 * Hook that bridges the error event bus to Expo Router.
 * Uses router.replace() to avoid stacking on corrupted screens.
 */
export function useErrorNavigation(): void {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = setErrorListener((report: ErrorReport) => {
      router.replace({
        pathname: '/error',
        params: {
          title: report.title,
          message: report.message,
          errorId: report.id,
          timestamp: String(report.timestamp),
          source: report.source,
          technicalMessage: report.technicalMessage || '',
          action: report.action || 'back',
          actionLabel: report.actionLabel || 'Try Again',
          isLooping: report.isLooping ? 'true' : 'false',
        },
      } as never);
    });

    return unsubscribe;
  }, [router]);
}
