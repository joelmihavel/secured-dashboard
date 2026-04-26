# Cashfree Integration — As Shipped

Cashfree replaced PayU as the primary payment + identity vendor in March 2026 (commit `26000003 cashfree_migration`). This doc captures the as-shipped integration in production. PayU still has live code paths as a legacy fallback — slated for removal per the PayU workstream in the cleanup plan.

> **Last reviewed:** 2026-04-25

Cashfree exposes two distinct platforms we use:

| Platform | What it does | Edge fns / services |
|---|---|---|
| **Cashfree Payment Gateway (PG)** | Payment processing — UPI / cards / netbanking. Vendor settlement to landlord happens AFTER payment via createAdjustment + scheduled vendor transfer (NOT via auto-Easy-Split at order time). | `initiate-cashfree-payment`, `payment-webhook`, `cashfree-split-webhook`, `cashfree-vendor-webhook`, `cashfree-pay-order` (legacy/dead — verify-then-archive in Phase 6), `settle-to-landlord`, `poll-settlement-status` |
| **Cashfree Mobile 360 (M360)** | Identity verification — PAN, mobile intelligence, credit score | `verify-identity`, `verify-pan`, `verify-bank` |

## Environment variables

| Variable | Where set | Purpose |
|---|---|---|
| `CASHFREE_APP_ID` | Supabase function secrets | M360 client ID (production) |
| `CASHFREE_SECRET_KEY` | Supabase function secrets | M360 secret |
| `CASHFREE_BASE_URL` | Supabase function secrets | `https://api.cashfree.com/verification` (prod) or `https://sandbox.cashfree.com/verification` |
| `CASHFREE_PUBLIC_KEY` | Supabase function secrets | RSA public key for `x-cf-signature` (M360 webhooks) |
| `CASHFREE_PG_APP_ID` | Supabase function secrets | PG client ID |
| `CASHFREE_PG_APP_SECRET` | Supabase function secrets | PG secret. Doubles as HMAC key for legacy webhook signing — see Phase 7e for the secret-separation fix |
| `CASHFREE_PG_BASE_URL` | Supabase function secrets | `https://api.cashfree.com/pg` |
| `CASHFREE_SPLIT_WEBHOOK_SECRET` | Supabase function secrets | **Should be different from `CASHFREE_PG_APP_SECRET`** — Phase 7e's bug fix. Read by `cashfree-split-webhook` with PG-secret fallback for phased rollout |
| `CASHFREE_VENDOR_WEBHOOK_SECRET` | Supabase function secrets | Same pattern as split secret, for `cashfree-vendor-webhook` |
| `EXPO_PUBLIC_PAYMENT_GATEWAY` | EAS dashboard / `.env.local` | `cashfree` (default) — switches RN client between Cashfree and PayU paths |
| `EXPO_PUBLIC_CASHFREE_ENV` | EAS dashboard | `SANDBOX` (development/preview) or `PRODUCTION` |

## Webhooks registered in Cashfree merchant dashboard

| Event | URL | Edge fn | Signature header |
|---|---|---|---|
| `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `REFUND_STATUS_WEBHOOK` | `https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/payment-webhook` | `payment-webhook` | `x-webhook-signature` (HMAC-SHA256 Base64 of `timestamp + rawBody`, signed with `CASHFREE_PG_APP_SECRET`) |
| `VENDOR_SETTLEMENT_SUCCESS`, `VENDOR_SETTLEMENT_FAILED`, `VENDOR_SETTLEMENT_REVERSED` | `https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/cashfree-split-webhook` | `cashfree-split-webhook` | `x-webhook-signature` (signed with `CASHFREE_SPLIT_WEBHOOK_SECRET` if set, falls back to PG secret with warning) |
| `VENDOR_STATUS_UPDATE` | `https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/cashfree-vendor-webhook` | `cashfree-vendor-webhook` | `x-webhook-signature` (signed with `CASHFREE_VENDOR_WEBHOOK_SECRET` if set, falls back to PG secret with warning) |

API version pinned to `2025-01-01` across all calls.

## Payment flow

```
User taps "Pay rent" in rn-app
   │
   │  initiateUnifiedPayment() — rn-app/src/services/payment/index.ts
   │  resolves payment_gateway via env.paymentGateway (build-time, env.ts)
   ▼
Edge fn `initiate-cashfree-payment`
   │
   │  Creates a Cashfree PG order with order_meta.payment_methods scoped
   │  to the user's chosen instrument (UPI / card / netbanking)
   │  Returns payment_session_id + order_id
   ▼
RN client launches Cashfree Web Checkout via react-native-cashfree-pg-sdk
   │  (CFPaymentGatewayService.doPayment with CFSession)
   │  All card/bank data stays inside Cashfree's hosted WebView — zero PCI
   │  scope for our client.
   ▼
User completes payment on Cashfree's hosted page
   │
   ├─► Cashfree fires payment-webhook with PAYMENT_SUCCESS / FAILED
   │   → payments.status updated, audit_logs entry, downstream notifications
   │
   └─► RN client gets onVerify callback with order_id
       → check-payment-status edge fn polls Cashfree to confirm
       → UI updates to success / failure state
```

Server-side `order_meta.payment_methods` restricts which instruments Cashfree shows in the checkout — we control the menu, not the user.

## Settlement to landlord (Cashfree vendor adjustments)

We do NOT use auto-Easy-Split (the `vendor_split` array at order creation). Settlement happens AFTER payment success via the Cashfree Vendor Adjustments API. The Cashfree dashboard / API URL namespace still includes `/pg/easy-split/...` because that's how Cashfree organizes vendor management endpoints — we just don't use the auto-split feature itself.

When a payment succeeds:
1. The payment is logged in `payments` with `status='success'`
2. The `settle-to-landlord` cron (every 5 min, `2-57/5 * * * *` UTC) finds completed payments not yet settled
3. Calls `settle-to-landlord` edge fn → Cashfree `createAdjustment()` (`POST /pg/easy-split/vendors/{vendor_id}/adjustment`) → credits the vendor's ledger inside Cashfree
4. Cashfree's vendor schedule (every 3h per `schedule_option=9`) eventually transfers the vendor balance to the landlord's bank account, generating a UTR
5. Cashfree fires `cashfree-split-webhook` (the URL retains the historical name) on `VENDOR_SETTLEMENT_SUCCESS` — handler updates `payments.landlord_payout_status='settled'` + writes the bank UTR
6. **Backup path:** `poll-settlement-and-reconcile` cron runs every 30 min calling `/pg/recon/vendor` (Vendor Recon API) — `reconcileVendorSettlements()` matches settled entries to stuck payments via `entity_id → cf_adjustment_id`, then by amount tolerance, and updates the same fields the webhook would. Catches missed webhooks self-healingly.

## M360 Identity Flow

```
RN client uploads PAN photo + name
   │
   ▼
verify-pan edge fn
   │  Creates verification request via Cashfree M360 PAN endpoint
   │  Stores response in identity_verifications.m360_pan_details (JSONB)
   │
verify-identity edge fn
   │  Fetches mobile intelligence (operator, connection type, age of number)
   │  Stores in identity_verifications.m360_mobile_intelligence
   │  Pulls credit score → m360_credit_score
   │  Computes m360_risk_intelligence (safe/risky/unknown)
   ▼
identity_verifications.status updated → SUCCESS | PENDING | FAILED
v_user_funnel view exposes flattened m360_* fields for the admin dashboard
```

## Webhook secrets

The `cashfree-split-webhook` and `cashfree-vendor-webhook` previously read `CASHFREE_PG_APP_SECRET` for HMAC verification despite header docs claiming a separate secret. Anyone with the PG secret could forge settlement / vendor webhooks → double-credit landlord payouts or fake KYC status.

**Fix (Phase 7e, 2026-04-25):** both webhooks now prefer `CASHFREE_SPLIT_WEBHOOK_SECRET` / `CASHFREE_VENDOR_WEBHOOK_SECRET` with PG-secret fallback. To complete the fix:

1. Generate two random secrets (e.g., `openssl rand -hex 32`)
2. `supabase secrets set CASHFREE_SPLIT_WEBHOOK_SECRET=<value> --project-ref uowjtrzmszuaiokqxgir`
3. `supabase secrets set CASHFREE_VENDOR_WEBHOOK_SECRET=<value> --project-ref uowjtrzmszuaiokqxgir`
4. In Cashfree merchant dashboard → Webhooks (Vendor Settlement + Vendor Status sections) → update each webhook's signing key to match
5. Verify settlement + vendor webhooks for 24h
6. Remove the PG-secret fallback in code (follow-up commit)
7. Repeat steps 2–5 with different values for the dev project (`zqlowjveyqiagnbmfwsb`)

## Replay defense

**Current state:** webhook handlers already dedup via the existing `processed_webhooks` table. Each handler:

1. Computes a dedup key (e.g. `cf-split-${settlement_id}-${event_type}` for split webhooks)
2. SELECTs `processed_webhooks` for that key — if found, returns "Already processed" success
3. After processing, UPSERTs the key into `processed_webhooks`

This pattern is already in place across `payment-webhook`, `cashfree-split-webhook`, `cashfree-vendor-webhook`.

**Redundant new table (Phase 7e plan deviation):** migration `20260425131920_payment_webhook_events_dedup.sql` added `payment_webhook_events` (composite PK `(source, event_id)` + 30-day retention helper). It's **not currently wired into handlers** — `processed_webhooks` already does the job. Cleanup options:

- **Option A (preferred):** drop `payment_webhook_events` in a follow-up migration; document `processed_webhooks` as canonical
- **Option B:** migrate handlers from `processed_webhooks` → `payment_webhook_events` (better hygiene: composite PK + auto-retention via `cleanup_payment_webhook_events()`), then drop `processed_webhooks`

Either way, do not leave both tables long-term. Today's behavior is correct because handlers all use the older table; the new table is dormant.

## Webhook timestamp freshness (observe-only)

Both `cashfree-split-webhook` and `cashfree-vendor-webhook` log `[STALE_TIMESTAMP age=Ns]` warnings when Cashfree's `x-webhook-timestamp` is more than 5 min old (Phase 7e, observe-only). They do **not reject** stale events yet — first we measure how often legitimate Cashfree retries land outside the window.

Once observation shows ≥99.9% of legit webhooks land inside 5 min over a sample, swap the `console.warn` for an early `return jsonResponse({ status: "ignored", reason: "stale" })`. This protects against captured-payload replays beyond the freshness window.

## Sandbox vs production

| Aspect | Sandbox | Production |
|---|---|---|
| Base URLs | `https://sandbox.cashfree.com/{verification,pg}` | `https://api.cashfree.com/{verification,pg}` |
| Test cards | Cashfree provides a static set in their docs | Real cards / real money |
| Webhook target | Same Supabase URL — sandbox vs prod is distinguished by which `CASHFREE_*` secrets are set on the project | Same |
| Settlement | Settles to a test bank account in T+0 | Settles to landlord's real account in T+1 |

Set `EXPO_PUBLIC_CASHFREE_ENV=SANDBOX` in EAS development/preview profiles, `PRODUCTION` in the production profile. Set the matching `CASHFREE_*` sandbox/prod secrets on the corresponding Supabase project.

## PayU vs Cashfree (current state)

`rn-app/src/services/payment/index.ts#getPaymentGateway()` resolves to `cashfree` by default in current builds. The PayU code paths (`payuCoreService`, `generate-payu-hash`, `get-payu-stored-cards`, etc.) are still wired but cold — slated for phased removal per the PayU workstream in `/Users/atrishabh/.claude/plans/okay-now-i-ticklish-castle.md` (3–6 month natural app-store soak before any function archival).

Until PayU is removed, both gateways coexist and the RN client picks based on `EXPO_PUBLIC_PAYMENT_GATEWAY`.
