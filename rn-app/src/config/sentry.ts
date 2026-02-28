/**
 * Sentry Configuration
 *
 * Error tracking and performance monitoring.
 * DSN must be set via EXPO_PUBLIC_SENTRY_DSN env var or in app.json extra.
 *
 * Uses dynamic import to gracefully handle Expo Go where native module may not be available.
 */

// DISABLED: Sentry native SDK triggers TurboModule void method crash in release builds.
// React Native ships as a prebuilt xcframework — the RCTTurboModule.mm patch cannot fix it.
// The Sentry native init (SentryFileManager, SentryScopePersistentStore) runs during startup
// and a concurrent TurboModule void method throws an NSException → SIGABRT.
// Re-enable once RN 0.82+ ships with the upstream fix (RN #53960).
const Sentry: typeof import('@sentry/react-native') | null = null;
const SENTRY_DSN = '';

// Lazy-init navigation integration to avoid TurboModule access at module scope
let navigation: ReturnType<typeof import('@sentry/react-native').reactNavigationIntegration> | null = null;

function getNavigationIntegration() {
  if (!Sentry) return null;
  if (!navigation) {
    navigation = Sentry.reactNavigationIntegration({
      enableTimeToInitialDisplay: true,
    });
  }
  return navigation;
}

export function initSentry() {
  if (!Sentry) {
    if (__DEV__) {
      console.log('[Sentry] Native module not available — skipping initialization');
    }
    return;
  }

  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.log('[Sentry] No DSN configured — skipping initialization');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    attachStacktrace: true,
    enableNativeCrashHandling: true,
    integrations: getNavigationIntegration() ? [getNavigationIntegration()!] : [],
  });
}

export function registerNavigationContainer(ref: unknown) {
  getNavigationIntegration()?.registerNavigationContainer(ref as any);
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!Sentry) return;
  const S = Sentry;
  if (context) {
    S.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      S.captureException(error);
    });
  } else {
    S.captureException(error);
  }
}

export function setUserContext(userId: string, phone?: string) {
  if (!Sentry) return;
  Sentry.setUser({ id: userId, ...(phone ? { phone } : {}) });
}

export function clearUserContext() {
  if (!Sentry) return;
  Sentry.setUser(null);
}

export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
  if (!Sentry) return;
  Sentry.addBreadcrumb({ message, category, data, level: 'info' });
}

/**
 * Wraps a React component with Sentry performance monitoring.
 * Returns the component unwrapped if Sentry is not available (Expo Go).
 */
export function wrapWithSentry<P extends Record<string, unknown>>(
  component: React.ComponentType<P>
): React.ComponentType<P> {
  if (!Sentry) return component;
  return Sentry.wrap(component);
}

export { Sentry };
