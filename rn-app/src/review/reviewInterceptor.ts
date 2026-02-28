/**
 * Apple Review Mode — Edge Function Interceptor
 *
 * Called from callEdgeFunction() before the real network request.
 * Returns mock data when review mode is active, null otherwise.
 */

import { isReviewMode } from './reviewMode';
import { getReviewResponse } from './reviewData';

export function interceptEdgeFunction(
  functionName: string,
  _body?: Record<string, unknown> | object
): { data: unknown; error: null } | null {
  if (!isReviewMode()) return null;

  const response = getReviewResponse(functionName);

  console.log('[review-mode] Intercepted:', functionName.split('?')[0]);

  return {
    data: { success: true, data: response },
    error: null,
  };
}
