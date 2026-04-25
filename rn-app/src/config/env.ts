/**
 * env.ts — single source of truth for environment configuration in rn-app.
 *
 * Reads every EXPO_PUBLIC_* + APP_ENV env var ONCE at module load.
 * Validates required fields. Exports a typed frozen `env` object.
 *
 * RULE: every other file in rn-app/src/ + rn-app/app/ MUST import from
 * here. Do NOT call process.env.X anywhere else. Enforced by
 * scripts/check-env-isolation.sh in CI.
 *
 * Why: previously, EXPO_PUBLIC_SUPABASE_URL was read in 4 different
 * places with subtly different fallback behavior (||  '' vs ??), and
 * the dev/prod boundary was implicit. Centralizing makes the contract
 * obvious and lets us add a single `isLocal` getter for everywhere
 * that needs to switch behavior between local Supabase and cloud.
 *
 * Expo's behavior: EXPO_PUBLIC_* is read at BUILD time (compiled into
 * the JS bundle), not at runtime. Changes to .env.local require
 * restarting `expo start`. APP_ENV is set by EAS profiles in eas.json
 * (development | preview | production) — the runtime app sees it via
 * process.env.APP_ENV.
 */

type AppEnv = "development" | "preview" | "production";
type CashfreeEnv = "SANDBOX" | "PRODUCTION";
type PaymentGateway = "cashfree" | "payu";

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    // Don't process.exit in RN — a clear error helps debugging on device.
    throw new Error(
      `[env] Required env var ${name} is not set. ` +
      `Check your rn-app/.env.local (local dev) or EAS dashboard (build/OTA).`,
    );
  }
  return value;
}

const RAW_APP_ENV = (process.env.APP_ENV ?? "development") as AppEnv;
const RAW_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

export const env = Object.freeze({
  /** development | preview | production. Set via APP_ENV in EAS profiles. */
  appEnv: RAW_APP_ENV,

  /** Supabase project URL. Must be set. */
  supabaseUrl: required("EXPO_PUBLIC_SUPABASE_URL", RAW_SUPABASE_URL),

  /** Supabase anon (publishable) key. Safe to ship in JS bundle. */
  supabaseAnonKey: required(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),

  /** Payment gateway: cashfree (current) or payu (legacy fallback). */
  paymentGateway: ((process.env.EXPO_PUBLIC_PAYMENT_GATEWAY ?? "cashfree").toLowerCase() as PaymentGateway),

  /** Cashfree sandbox vs production. Drives Cashfree SDK init. */
  cashfreeEnv: ((process.env.EXPO_PUBLIC_CASHFREE_ENV ?? "PRODUCTION").toUpperCase() as CashfreeEnv),

  /** PayU merchant key (legacy — used only when paymentGateway='payu'). */
  payuKey: process.env.EXPO_PUBLIC_PAYU_KEY ?? "",

  /** Whether the app should use OTP routing (Twilio-backed) vs demo OTP. */
  useOtpRouting: process.env.EXPO_PUBLIC_USE_OTP_ROUTING === "true",

  /** True if running against local Supabase (dev-up.sh boots local). */
  get isLocal(): boolean {
    return (
      RAW_SUPABASE_URL?.includes("127.0.0.1") === true ||
      RAW_SUPABASE_URL?.includes("localhost") === true ||
      // LAN binding in dev-up.sh — anything in the 192.168.x.x or 10.x.x.x range
      // pointing at port 54321 is treated as local.
      (RAW_SUPABASE_URL?.includes(":54321") === true)
    );
  },

  /** Convenience: are we in production EAS build? */
  get isProduction(): boolean {
    return RAW_APP_ENV === "production";
  },
});

export type Env = typeof env;
