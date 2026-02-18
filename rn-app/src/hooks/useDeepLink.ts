/**
 * Deep Link Hook (ST-107)
 *
 * Handles deep link routing for both custom scheme (flentsecured:///)
 * and universal links. Integrates with expo-router for navigation.
 *
 * Deep link format:
 *   flentsecured:///path        -> navigates to /path
 *   flentsecured:///path?a=1    -> navigates to /path with params { a: '1' }
 *   https://app.flent.in/path   -> universal link, same routing
 *
 * Usage:
 *   // In root layout:
 *   useDeepLink();
 *
 *   // In target screens, read deep link params:
 *   const params = consumeDeepLinkParams();
 */

import { useState, useEffect, useCallback } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { addBreadcrumb } from '../config/sentry';

// ==============================================
// DEEP LINK PARAMS STORE
// ==============================================

/**
 * Module-level store for deep link query params.
 *
 * Expo Router v4 crashes when navigating to route group paths (e.g. /(waitlist))
 * with query params appended. We work around this by navigating without params
 * and storing them here for target screens to consume.
 */
let _pendingDeepLinkParams: Record<string, string> | null = null;

/**
 * Consume (read and clear) pending deep link params.
 * Call this in the target screen to retrieve params passed via deep link.
 * Returns null if no params are pending.
 */
export function consumeDeepLinkParams(): Record<string, string> | null {
  const params = _pendingDeepLinkParams;
  _pendingDeepLinkParams = null;
  return params;
}

/**
 * Peek at pending deep link params without consuming them.
 */
export function peekDeepLinkParams(): Record<string, string> | null {
  return _pendingDeepLinkParams;
}

// ==============================================
// DEV MOCK STATE (reactive pub/sub for BuildBot)
// ==============================================

/**
 * Reactive mock state store for BuildBot state switching.
 * When a deep link like /waitlist/state/accepted arrives while the screen
 * is already mounted, router.navigate is a no-op. This pub/sub system
 * lets the screen react to state changes without needing re-navigation.
 */
let _devMockState: string | null = null;
const _devMockStateListeners = new Set<(state: string) => void>();

export function setDevMockState(state: string): void {
  _devMockState = state;
  _devMockStateListeners.forEach(fn => fn(state));
}

export function getDevMockState(): string | null {
  return _devMockState;
}

/**
 * Hook that subscribes to dev mock state changes.
 * Returns the current dev mock state and re-renders when it changes.
 */
export function useDevMockState(): string | null {
  const [state, setState] = useState<string | null>(_devMockState);
  useEffect(() => {
    // Sync with current value on mount (in case it changed before subscription)
    if (_devMockState !== null) setState(_devMockState);
    _devMockStateListeners.add(setState);
    return () => { _devMockStateListeners.delete(setState); };
  }, []);
  return state;
}

// ==============================================
// ROUTE RESOLUTION
// ==============================================

/**
 * Known deep link paths mapped to internal routes.
 * Paths not in this map are passed through directly.
 */
const DEEP_LINK_ROUTES: Record<string, string> = {
  // Auth
  '/auth/login': '/(auth)/login',
  '/login': '/(auth)/login',

  // Waitlist
  '/waitlist': '/(waitlist)',
  '/waitlist/approved': '/(waitlist)/approved',
  // Path-based state switching for BuildBot (query params unreliable in dev client)
  '/waitlist/state/pending': '/(waitlist)',
  '/waitlist/state/accepted': '/(waitlist)',
  '/waitlist/state/rejected': '/(waitlist)',
  '/waitlist/state/pending_long': '/(waitlist)',
  '/waitlist/state/referral': '/(waitlist)',
  '/waitlist/state/referral_invalid': '/(waitlist)',

  // Agreement
  '/agreement/upload': '/(agreement)/upload',
  '/agreement/review': '/(agreement)/review',
  '/agreement/success': '/(agreement)/success',

  // Setup
  '/setup': '/(setup)/pending-steps',
  '/setup/onboarding': '/(setup)',
  '/setup/bank': '/(setup)/add-bank',
  '/setup/utility': '/(setup)/add-utility',
  '/setup/landlord': '/(setup)/invite-landlord',

  // Payment
  '/payment': '/(payment)/select-method',
  '/payment/success': '/(payment)/success',
  '/payment/failed': '/(payment)/failed',
  '/payment/receipt': '/(payment)/receipt',

  // Main
  '/home': '/(main)',
  '/dashboard': '/(main)',

  // Profile
  '/profile': '/(profile)',
  '/profile/edit': '/(profile)/edit',
  '/profile/payment-methods': '/(profile)/payment-methods',
  '/profile/agreement': '/(profile)/agreement',
  '/profile/notifications': '/(profile)/notifications',

  // Transactions
  '/transactions': '/(transactions)',
};

/**
 * Resolve a deep link path to an internal route.
 *
 * @param path - The incoming deep link path (e.g., '/payment/success')
 * @returns The resolved internal route (e.g., '/(payment)/success')
 */
export function resolveDeepLink(path: string): string | null {
  if (!path) return null;

  // Clean the path
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Strip query params for route matching
  const pathWithoutQuery = cleanPath.split('?')[0];

  // Check known routes
  const resolved = DEEP_LINK_ROUTES[pathWithoutQuery];
  if (resolved) return resolved;

  // If the path starts with a route group marker, pass through WITHOUT query params
  // (Expo Router v4 crashes when route group paths include query strings)
  if (pathWithoutQuery.startsWith('/(')) return pathWithoutQuery;

  // Unknown path -- return null
  return null;
}

// ==============================================
// DEEP LINK HANDLER
// ==============================================

/**
 * Process an incoming deep link URL and navigate.
 *
 * Navigates to the resolved route WITHOUT query params in the URL
 * (Expo Router v4 crashes with params on route group paths like /(waitlist)?state=x).
 * Params are stored in the module-level store for target screens to consume
 * via consumeDeepLinkParams().
 *
 * @param url - The full deep link URL
 * @returns true if navigation was performed, false otherwise
 */
export function handleDeepLinkUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = Linking.parse(url);
    const path = parsed.path ?? '';
    const params = parsed.queryParams ?? {};

    if (__DEV__) {
      console.log('[DeepLink] Received:', url, '→ path:', path, '→ params:', JSON.stringify(params));
    }
    addBreadcrumb('Deep link received', 'deeplink', {
      url,
      path,
      scheme: parsed.scheme,
    });

    const resolvedRoute = resolveDeepLink(path);
    if (!resolvedRoute) {
      addBreadcrumb('Deep link route not found', 'deeplink', { path });
      return false;
    }

    // Store query params for the target screen to consume
    const paramEntries = Object.entries(params as Record<string, string>).filter(
      ([, v]) => v != null && v !== ''
    );
    if (paramEntries.length > 0) {
      _pendingDeepLinkParams = Object.fromEntries(paramEntries);
    }

    // Extract state from path-based routes (e.g., /waitlist/state/accepted → state=accepted)
    const cleanPath = (path.startsWith('/') ? path : `/${path}`).split('?')[0];
    const statePathMatch = cleanPath.match(/\/state\/([a-z_]+)$/);
    if (statePathMatch) {
      const extractedState = statePathMatch[1];
      _pendingDeepLinkParams = { ...(_pendingDeepLinkParams ?? {}), state: extractedState };
      // Publish to reactive listeners so already-mounted screens can pick up the change
      // (router.navigate to the same route is a no-op — the component won't re-mount)
      if (__DEV__) {
        setDevMockState(extractedState);
      }
    }

    if (__DEV__) {
      console.log('[DeepLink] Resolved:', resolvedRoute, '→ stored params:', JSON.stringify(_pendingDeepLinkParams));
    }

    // Navigate using router.navigate (better for deep links than push)
    // Do NOT append query params to the URL — Expo Router v4 crashes
    // with "Cannot read property 'filter' of undefined" when route group
    // paths include query strings.
    router.navigate(resolvedRoute as never);

    addBreadcrumb('Deep link navigated', 'deeplink', {
      path,
      resolvedRoute,
      hasParams: paramEntries.length > 0,
    });

    return true;
  } catch (error) {
    addBreadcrumb('Deep link handling failed', 'deeplink', {
      url,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}

// ==============================================
// HOOK
// ==============================================

/**
 * Hook to handle incoming deep links.
 *
 * Call once in the root layout. Listens for both:
 * - Initial URL (app launched via deep link)
 * - Incoming URLs (app already running, receives deep link)
 */
export function useDeepLink() {
  const handleUrl = useCallback(({ url }: { url: string }) => {
    handleDeepLinkUrl(url);
  }, []);

  useEffect(() => {
    // Handle the URL that opened the app (cold start)
    const handleInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        // Small delay to ensure router is ready
        setTimeout(() => {
          handleDeepLinkUrl(initialUrl);
        }, 500);
      }
    };

    handleInitialUrl();

    // Listen for incoming URLs (warm start)
    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [handleUrl]);
}
