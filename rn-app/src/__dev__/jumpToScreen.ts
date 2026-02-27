/**
 * Jump-to-Screen Orchestrator
 *
 * Seeds backend state → logs in → clears caches → ready for navigation.
 * Used by DevNavigator's Jump button for one-tap screen testing.
 *
 * Flow:
 *   1. Disable mocks (we want real backend data)
 *   2. Call dev-seed edge function (seeds user to correct journey state)
 *   3. Login via sendOtp/verifyOtp if needed (reuses demo phone flow)
 *   4. Clear React Query cache + Zustand stores
 */

import { SCREEN_STATE_MAP, type ScreenSeedConfig } from './screenStateMap';
import { TEST_PHONES, setAllMocks } from './devConfig';
import { useDevStore } from './devStore';
import { supabase, callEdgeFunction } from '@/src/services/supabase';
import { sendOtp, verifyOtp } from '@/src/services/api/auth';
import { clearAllStores } from '@/src/stores/resetAll';
import { queryClient } from '@/src/providers/QueryProvider';

// ==============================================
// TYPES
// ==============================================

export interface JumpResult {
  success: boolean;
  error?: string;
  skippedSeed?: boolean;
  seededState?: string;
  runtimeNote?: string;
}

interface DevSeedResponse {
  success: boolean;
  data: {
    user_id: string;
    phone: string;
    target_state: string;
    created_entities: string[];
    cleaned_entities: string[];
  };
}

// ==============================================
// MAIN ORCHESTRATOR
// ==============================================

/**
 * Seeds backend state and authenticates for a target screen.
 * Does NOT navigate — caller handles navigation on success.
 *
 * @param targetPath - Expo Router path, e.g. '/(setup)/add-bank'
 * @returns JumpResult with success status and any warnings
 */
export async function jumpToScreen(targetPath: string): Promise<JumpResult> {
  const config = SCREEN_STATE_MAP[targetPath];

  if (!config) {
    return { success: false, error: `No seed config for ${targetPath}` };
  }

  // Auth screens don't need seeding
  if (config.noSeedNeeded) {
    return {
      success: true,
      skippedSeed: true,
      runtimeNote: config.runtimeNote,
    };
  }

  const phone = TEST_PHONES[0].phone;  // +919999900001
  const otp = TEST_PHONES[0].otp;      // 123456

  try {
    // 1. Turn off mocks — we want real backend data
    setAllMocks(false);

    // 2. Seed backend state via dev-seed edge function
    const { data, error: seedError } = await callEdgeFunction<DevSeedResponse>(
      'dev-seed',
      {
        phone,
        target_state: config.targetState,
        options: config.seedOptions ?? {},
      },
      false, // No auth required — dev-seed uses anon key
      'POST',
      30_000 // 30s timeout for seeding
    );

    if (seedError) {
      // Seed failed — continue without seeding (screen will use existing/mock data)
      console.warn(`[jumpToScreen] Seed failed (continuing anyway): ${seedError}`);
    }

    // 3. Login if needed
    const loginResult = await ensureLoggedIn(phone, otp);
    const needsBypass = !loginResult.success;
    if (needsBypass) {
      console.warn(`[jumpToScreen] Auth failed, will enable dev bypass: ${loginResult.error}`);
    }

    // 4. Clear all caches so screens fetch fresh seeded data
    await queryClient.cancelQueries();
    queryClient.clear();
    clearAllStores();

    // 5. Set dev bypass AFTER clearing stores so it isn't accidentally wiped
    if (needsBypass) {
      (useDevStore as any).getState().setDevAuthBypass(true);
    }

    return {
      success: true,
      seededState: config.targetState,
      runtimeNote: config.runtimeNote,
    };
  } catch (err) {
    // Even on unexpected errors, enable dev bypass so navigation works
    console.warn(`[jumpToScreen] Unexpected error, enabling dev bypass`);
    (useDevStore as any).getState().setDevAuthBypass(true);
    return {
      success: true,
      runtimeNote: `Jump had errors but dev bypass enabled: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
}

/**
 * Gets the seed config for a path (used by DevNavigator for UI hints).
 */
export function getSeedConfig(path: string): ScreenSeedConfig | undefined {
  return SCREEN_STATE_MAP[path];
}

// ==============================================
// INTERNAL HELPERS
// ==============================================

async function ensureLoggedIn(
  phone: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  // Check current session
  const { data: { session } } = await supabase.auth.getSession();

  // Strip leading + for comparison (Supabase stores phone without +)
  const normalizedPhone = phone.replace('+', '');

  if (session && session.user?.phone === normalizedPhone) {
    // Already logged in as this test user — skip login
    return { success: true };
  }

  // Sign out if logged in as someone else
  if (session) {
    await supabase.auth.signOut();
  }

  // Send OTP (edge function recognizes test number, skips SMS)
  const { data: sendData, error: sendError } = await sendOtp({
    phone_number: phone,
  });

  if (sendError) {
    return { success: false, error: `Login send OTP failed: ${sendError.message}` };
  }

  // Verify OTP (auto-accepted for test phones)
  const { error: verifyError } = await verifyOtp({
    phone_number: phone,
    otp,
    otp_request_id: sendData?.otp_request_id,
  });

  if (verifyError) {
    return { success: false, error: `Login verify OTP failed: ${verifyError.message}` };
  }

  return { success: true };
}
