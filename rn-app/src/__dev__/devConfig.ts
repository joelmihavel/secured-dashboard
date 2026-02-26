/**
 * Dev Configuration — Mock Toggles & Test Phone Numbers
 *
 * Plain module-level config (NOT a Zustand store — environment config is not UI state).
 * Resets on app restart, which is correct behavior.
 *
 * ONLY imported behind __DEV__ guards — Metro dead-code-eliminates in production.
 */

export type ServiceName = 'dashboard' | 'payments' | 'waitlist' | 'agreement' | 'setup' | 'profile';

export const devMockConfig: Record<ServiceName, boolean> = {
  dashboard: true,
  payments: true,
  waitlist: false,
  agreement: false,
  setup: false,
  profile: false,
};

/** Test phone numbers for Quick Login (matches Supabase DEMO_PHONES secret + auth-otp edge function) */
export const TEST_PHONES = [
  { phone: '+919999900001', otp: '123456', label: 'Active User' },
  { phone: '+919999900002', otp: '654321', label: 'Waitlisted User' },
  { phone: '+919999900003', otp: '111111', label: 'New Signup' },
] as const;

export function setMockToggle(service: ServiceName, enabled: boolean) {
  devMockConfig[service] = enabled;
}

export function setAllMocks(enabled: boolean) {
  (Object.keys(devMockConfig) as ServiceName[]).forEach(k => {
    devMockConfig[k] = enabled;
  });
}
