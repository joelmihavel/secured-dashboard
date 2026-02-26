/**
 * withMock() — Higher-Order Function for Service Mock Switching
 *
 * Replaces scattered DEV_USE_MOCK_* flags with a type-safe adapter.
 * - Enforces same return type for mock and real at compile time
 * - Built-in latency simulation to expose race conditions
 * - `__DEV__` gate ensures Metro dead-code-eliminates the mock path in production
 */

import type { ServiceName } from './devConfig';

export function withMock<TArgs extends unknown[], TResult>(
  serviceName: ServiceName,
  realFn: (...args: TArgs) => Promise<TResult>,
  mockFn: (...args: TArgs) => Promise<TResult>,
  options?: { delayMs?: number }
): (...args: TArgs) => Promise<TResult> {
  if (!__DEV__) return realFn; // compile-time dead-code elimination

  return async (...args: TArgs) => {
    const { devMockConfig } = await import('./devConfig');
    if (!devMockConfig[serviceName]) return realFn(...args);

    // Simulate network latency to expose race conditions
    if (options?.delayMs) {
      await new Promise(r => setTimeout(r, options.delayMs));
    }
    return mockFn(...args);
  };
}
