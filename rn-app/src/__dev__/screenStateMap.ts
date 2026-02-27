/**
 * Screen State Map — Route → Backend State Mapping
 *
 * Maps each app route to the backend state required
 * for that screen to render with real data.
 * Used by jumpToScreen() to seed the correct state before navigation.
 */

export interface ScreenSeedConfig {
  targetState: 'signed_up' | 'extraction_confirmed' | 'waitlisted' | 'waitlisted_rejected' | 'approved' | 'active';
  seedOptions?: {
    with_payment_history?: boolean;
    payment_count?: number;
    with_cashback?: boolean;
    with_saved_methods?: boolean;
    bank_verified?: boolean;
    utility_verified?: boolean;
    landlord_approved?: boolean;
  };
  noSeedNeeded?: boolean;
  runtimeNote?: string;
}

export const SCREEN_STATE_MAP: Record<string, ScreenSeedConfig> = {
  // Auth — no seed needed, just navigate
  '/(auth)/splash':      { noSeedNeeded: true, targetState: 'signed_up' },
  '/(auth)/beta-splash': { noSeedNeeded: true, targetState: 'signed_up' },
  '/(auth)/carousel':    { noSeedNeeded: true, targetState: 'signed_up' },
  '/(auth)/sign-up':     { noSeedNeeded: true, targetState: 'signed_up' },
  '/(auth)/otp':         { noSeedNeeded: true, targetState: 'signed_up', runtimeNote: 'Start sign-up first' },

  // Agreement
  '/(agreement)/upload':  { targetState: 'signed_up' },
  '/(agreement)/review':  { targetState: 'signed_up', runtimeNote: 'Upload a document first' },
  '/(agreement)/success': { targetState: 'extraction_confirmed' },

  // Waitlist
  '/(waitlist)':          { targetState: 'waitlisted' },
  '/(waitlist)/approved': { targetState: 'approved' },

  // Setup
  '/(setup)':                { targetState: 'approved' },
  '/(setup)/add-bank':       { targetState: 'approved' },
  '/(setup)/add-utility':    { targetState: 'approved' },
  '/(setup)/invite-landlord':{ targetState: 'approved' },
  '/(setup)/pending-steps':  { targetState: 'approved' },

  // Main
  '/(main)': {
    targetState: 'active',
    seedOptions: {
      with_payment_history: true,
      payment_count: 3,
      with_cashback: true,
      with_saved_methods: true,
    },
  },

  // Payment
  '/(payment)/confirm': {
    targetState: 'active',
    seedOptions: {
      with_payment_history: true,
      payment_count: 3,
      with_saved_methods: true,
    },
    runtimeNote: 'Tap Pay Now from home for full payment context',
  },
  '/(payment)/status': {
    targetState: 'active',
    runtimeNote: 'Needs an in-flight payment — seed alone is not enough',
  },

  // Profile
  '/(profile)': {
    targetState: 'active',
    seedOptions: {
      with_payment_history: true,
      payment_count: 3,
      with_saved_methods: true,
    },
  },
  '/(profile)/edit':            { targetState: 'active' },
  '/(profile)/payment-methods': { targetState: 'active', seedOptions: { with_saved_methods: true } },
  '/(profile)/agreement':       { targetState: 'active' },
};
