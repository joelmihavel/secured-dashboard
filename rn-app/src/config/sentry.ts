/**
 * Sentry Stubs
 *
 * The @sentry/react-native package has been fully removed from this project.
 * These no-op stubs preserve the same export surface so that every file
 * importing from this module continues to compile without changes.
 *
 * If Sentry is re-added in the future, replace these stubs with real
 * initialisation logic.
 */

export const Sentry: null = null;

export function initSentry(): void {
  // no-op
}

export function registerNavigationContainer(_ref: unknown): void {
  // no-op
}

export function captureError(_error: Error, _context?: Record<string, unknown>): void {
  // no-op
}

export function setUserContext(_userId: string, _phone?: string): void {
  // no-op
}

export function clearUserContext(): void {
  // no-op
}

export function addBreadcrumb(
  _message: string,
  _category: string,
  _data?: Record<string, unknown>,
): void {
  // no-op
}

/**
 * Identity function -- returns the component unchanged.
 */
export function wrapWithSentry<P extends Record<string, unknown>>(
  component: React.ComponentType<P>,
): React.ComponentType<P> {
  return component;
}
