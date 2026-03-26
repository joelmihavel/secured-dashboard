# PayU → Cashfree Payment Gateway Migration — Technical Specification

**Branch:** `atrishabh/cashfree-migration`
**Base:** `main`
**Target env:** Supabase Dev DB (`zqlowjveyqiagnbmfwsb`) for testing + Expo Preview
**Note:** Dev DB was previously read-only but is reactivated for this migration testing per user directive.
**Source branch for Cashfree backend:** `origin/dev`
**Promotion path:** Dev DB testing → Main DB (`uowjtrzmszuaiokqxgir`) after validation
**Review mode:** HOLD SCOPE — strict feature parity, zero expansions
**Date:** 2026-03-26

---

## 1. Architecture Overview

### Hybrid Native Approach
```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    REACT NATIVE APP                             │
  │                                                                 │
  │  ┌──────────────────┐                                           │
  │  │ Payment Flow     │  100% Our Native UI:                      │
  │  │ (Custom Native)  │  - Amount entry                           │
  │  │                  │  - Method selection (UPI/Card/NB)         │
  │  │                  │  - Confirmation + receipt preview          │
  │  │                  │  - Status polling                         │
  │  └────────┬─────────┘                                           │
  │           │                                                     │
  │  ┌────────┼──────────────────────────────────────────────────┐  │
  │  │        │  PAYMENT EXECUTION (per method)                  │  │
  │  │        │                                                  │  │
  │  │  UPI Intent ──→ Cashfree SDK: CFUPIIntentCheckoutPayment  │  │
  │  │                 (native app picker: GPay, PhonePe, Paytm) │  │
  │  │                                                           │  │
  │  │  UPI Collect ──→ Cashfree REST API: Order Pay             │  │
  │  │                  (fully headless, custom VPA input)        │  │
  │  │                                                           │  │
  │  │  Card ─────────→ Cashfree SDK: CFDropCheckoutPayment      │  │
  │  │                  (themed overlay, handles 3DS/OTP)         │  │
  │  │                  PCI scope: ZERO                           │  │
  │  │                                                           │  │
  │  │  Net Banking ──→ Cashfree REST API: Order Pay             │  │
  │  │                  (bank selector → redirect URL)            │  │
  │  └───────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                  SUPABASE EDGE FUNCTIONS                        │
  │                                                                 │
  │  initiate-payment ──→ POST /pg/orders (Cashfree)               │
  │    Returns: payment_session_id, cf_order_id                     │
  │                                                                 │
  │  payment-webhook ──→ Receives PAYMENT_SUCCESS/FAILED            │
  │    Verifies: HMAC-SHA256 signature                             │
  │    Posts: Split to landlord vendor (Easy Split)                 │
  │                                                                 │
  │  check-payment-status ──→ GET /pg/orders/{order_id}            │
  │    Returns: order_status (ACTIVE/PAID/EXPIRED)                 │
  │                                                                 │
  │  cashfree-split-webhook ──→ VENDOR_SETTLEMENT_SUCCESS/FAILED   │
  │    Updates: landlord_payout_status                             │
  │                                                                 │
  │  sync-vendors ──→ Landlord bank → Cashfree vendor (cron)       │
  │  settle-to-landlord ──→ Retry failed splits (cron)             │
  │  poll-settlement-status ──→ Reconcile stuck payments (cron)    │
  └─────────────────────────────────────────────────────────────────┘
```

### PCI-DSS Scope: NONE
- Card data: handled entirely within Cashfree Drop Checkout SDK (never touches our code/server)
- UPI VPA: not PCI-sensitive (just a string identifier)
- Net banking: redirect-based (bank login on bank's website)
- We only handle: payment_session_id, cf_order_id, amounts, statuses

---

## 2. Backward Compatibility Strategy

### Problem
Users who don't update via OTA still have the PayU SDK code. We need to handle:
1. **Old app + new backend**: User has PayU client code, backend now speaks Cashfree
2. **In-flight payments**: Payments initiated on PayU that haven't resolved yet
3. **Webhook coexistence**: PayU may still send webhooks for old payments

### Solution: Gateway Version Flag
```
  ┌─────────────────────────────────────────────────────────┐
  │ initiate-payment edge function                          │
  │                                                         │
  │ Input: { gateway_version?: 'payu' | 'cashfree' }       │
  │                                                         │
  │ If gateway_version === 'payu' OR missing:               │
  │   → Legacy path: generate PayU hashes, return payu_params│
  │   → payment.payment_gateway = 'payu'                    │
  │                                                         │
  │ If gateway_version === 'cashfree':                      │
  │   → New path: create Cashfree order, return session_id  │
  │   → payment.payment_gateway = 'cashfree'                │
  └─────────────────────────────────────────────────────────┘
```

### `payments` table: combined migration (single file `20260326000001_cashfree_migration.sql`)
```sql
-- NOTE: Existing migration 20260228100000 tightened constraint to ('payu', 'demo').
-- We must DROP that constraint and recreate with 'cashfree' included.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_gateway_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_gateway_check
  CHECK (payment_gateway IN ('payu', 'cashfree', 'demo'));

-- Set DEFAULT so old code paths that don't set payment_gateway get 'payu'
ALTER TABLE payments ALTER COLUMN payment_gateway SET DEFAULT 'payu';

-- Add 'expired' to status constraint if not already present
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('initiated', 'processing', 'success', 'failed', 'refunded', 'expired'));

-- New columns for Cashfree integration (from dev branch migration, combined here)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cf_order_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cf_split_posted BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS split_retry_count INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS actual_pg_fee_paise INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS net_collected_paise INTEGER;

-- Indexes for Cashfree operations
CREATE INDEX IF NOT EXISTS idx_payments_cf_order_id
  ON payments(cf_order_id) WHERE cf_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_split_pending
  ON payments(cf_split_posted, split_retry_count)
  WHERE status = 'success' AND cf_split_posted = FALSE AND split_retry_count < 3;
```

### Webhook routing
```
  payment-webhook receives POST
    │
    ├─ PRIORITY 1: Has x-webhook-signature header?
    │   → Cashfree webhook path (HMAC-SHA256 verification)
    │
    ├─ PRIORITY 2: Has PayU form data (mihpayid, status)?
    │   → Legacy PayU path (SHA-512 hash verification — existing code, unchanged)
    │
    └─ PRIORITY 3: Neither matches?
        → Reject with 400 Bad Request + audit log
```

**Why this priority order:** Cashfree headers are checked first because a malicious
request could theoretically send both Cashfree headers and PayU form data. Cashfree
signature check is more secure (HMAC-SHA256 vs SHA-512 hash chain), so it takes
precedence. If Cashfree sig fails, we do NOT fall through to PayU — we reject.

### Timeline
- **Phase 1** (this PR): Both gateways supported. New app sends `gateway_version: 'cashfree'`. Old app omits it → gets PayU path.
- **Phase 2** (after 100% OTA adoption): Remove PayU code paths. No rush — dual support is cheap.

---

## 3. Files to Change

### Backend — Merge Strategy (from eng review)
**CRITICAL:** The `origin/dev` branch REMOVED PayU entirely from `initiate-payment` and
`payment-webhook`. They are Cashfree-only. We need dual-gateway support for backward
compatibility. Strategy: **cherry-pick clean files, rewrite routing files**.

| File | Action | Notes |
|------|--------|-------|
| `supabase/functions/_shared/cashfree-easysplit.ts` | Cherry-pick from dev | Ready as-is. Fix `verify_account: false` → `true` for production |
| `supabase/functions/initiate-payment/index.ts` | **Rewrite on main** (use dev as reference) | Dev removed PayU — must add dual-gateway routing with `gateway_version` param |
| `supabase/functions/payment-webhook/index.ts` | **Rewrite on main** (use dev as reference) | Dev removed PayU — must add webhook routing by header detection (priority order) |
| `supabase/functions/check-payment-status/index.ts` | **New work** (not on dev) | Add Cashfree order status check via `getOrderPaymentStatus()`, keep PayU path |
| `supabase/functions/cashfree-pay-order/index.ts` | **New** | Proxies Cashfree Order Pay API for UPI Collect + Net Banking. **MUST validate payment ownership** (see security note below) |
| `supabase/functions/cashfree-split-webhook/index.ts` | Cherry-pick from dev | Ready as-is |
| `supabase/functions/sync-vendors/index.ts` | Cherry-pick from dev | Ready as-is |
| `supabase/functions/settle-to-landlord/index.ts` | Cherry-pick from dev | Ready as-is |
| `supabase/functions/poll-settlement-status/index.ts` | Cherry-pick from dev | Ready as-is |
| `supabase/migrations/20260326000001_cashfree_migration.sql` | **New** (single combined) | Combines dev's column additions + CHECK constraint updates + `DEFAULT 'payu'` on payment_gateway |
| `supabase/functions/_shared/cors.ts` | No change | Already shared |

**Why `cashfree-pay-order` is server-side:** UPI Collect and Net Banking are headless/redirect-based.
They require calling Cashfree's Order Pay API which needs the `payment_session_id` + payment method
details. This MUST go through our server (not direct from client) to avoid exposing the session to
raw API manipulation. Card and UPI Intent use the SDK directly because the SDK handles security
internally.

**SECURITY: `cashfree-pay-order` ownership validation (from eng review):**
This function receives `payment_session_id` from the client. Before forwarding to Cashfree,
it MUST: (1) look up the payment record by the associated `cf_order_id`, (2) verify `user_id`
matches the authenticated caller, (3) reject with 403 if not. Without this, User A could
call this function with User B's payment_session_id.

### Frontend — New files
| File | Purpose |
|------|---------|
| `rn-app/src/services/payment/cashfreeService.ts` | Cashfree SDK bridge: init, launch Drop/UPI/NB |
| `rn-app/src/types/cashfree-sdk.d.ts` | TypeScript declarations for Cashfree RN SDK |

### Frontend — Modified files
| File | Changes |
|------|---------|
| `rn-app/src/services/payment/index.ts` | RISK: `UnifiedInitiateResult` interface has `payuParams` but no Cashfree fields. Must add `cashfreeSessionId?: string`, `cfOrderId?: string` to the interface. The `callEdgeFunction` response type (line 159) must include Cashfree response shape. Add `gateway_version: 'cashfree'` to request body. The `PAYU_FEE_RATES` hardcoded fallback stays for old path; add `CASHFREE_FEE_RATES` fallback alongside (or dynamic fetch). |
| `rn-app/src/services/payment/payuCoreService.ts` | Keep for backward compat (old builds), add `@deprecated` |
| `rn-app/src/hooks/usePaymentFlow.ts` | RISK: Hook is tightly coupled to PayU types (`CorePaymentMode`, `InstrumentParams`, `launchCorePayment`). Must add gateway-conditional routing: if Cashfree → call `cashfreeService.launchX()`, else → existing PayU path. Do NOT remove PayU imports — both paths must coexist. The hook's `executePayment()` signature will need a `gateway` param or read it from the store. |
| `rn-app/src/stores/payment.ts` | Add `cashfreeSessionId`, `cfOrderId` fields ALONGSIDE `payuSessionParams` (RISK: do NOT remove PayU fields — old code paths still reference them). Add `setCashfreeSession()` / `clearCashfreeSession()` actions. |
| `rn-app/src/components/payment/PaymentMethodModal/index.tsx` | RISK: Modal calls `initiatePayment()` at 2 locations (lines ~152, ~327) and reads `payuSessionParams` from store (line ~254). For Cashfree: after `initiatePayment()` returns, must branch on gateway: store `cashfreeSessionId`/`cfOrderId` instead of `payuSessionParams`, then call appropriate Cashfree SDK method instead of `executePayment()`. Wire `CFPaymentGatewayService.setCallback({ onVerify, onError })` in useEffect. |
| `rn-app/src/components/payment/PaymentMethodModal/MethodSelectorContent.tsx` | UPI Intent app list (Cashfree SDK provides installed apps) |
| `rn-app/app/(payment)/status.tsx` | Poll using Cashfree order ID instead of PayU mihpayid |
| `rn-app/app.json` | Add `LSApplicationQueriesSchemes` for UPI apps |
| `rn-app/package.json` | Add `react-native-cashfree-pg-sdk`, `cashfree-pg-api-contract` |

### Frontend — No changes needed
| File | Reason |
|------|--------|
| `EnterAmountContent.tsx` | Gateway-agnostic (amount + validation) |
| `ConfirmPaymentContent.tsx` | Gateway-agnostic (receipt preview + cashback) |
| `PaymentReceiptCard.tsx` | Gateway-agnostic (receipt display) |
| `CashbackPill.tsx` | Gateway-agnostic |
| `stores/payment.ts` (most fields) | Status, amount, method — all gateway-agnostic |
| All cashback logic | Identical computation in both gateways |

---

## 4. Payment Method Flows (Detailed)

### 4A. UPI Intent (Native App Picker)
```
  User taps "UPI" → selects app (GPay/PhonePe/Paytm)
       │
       ▼
  [Client] callEdgeFunction('initiate-payment', {
    gateway_version: 'cashfree',
    payment_method: 'upi',
    amount, tenancy_id, rent_month
  })
       │
       ▼
  [Edge] POST https://api.cashfree.com/pg/orders
    → Returns: { payment_session_id, cf_order_id }
    → DB: INSERT payment (status=initiated, payment_gateway=cashfree)
       │
       ▼
  [Client] CFPaymentGatewayService.doUPIPayment(
    new CFUPIIntentCheckoutPayment(session, theme)
  )
       │
       ▼
  [Native] iOS/Android shows installed UPI apps
  User taps GPay → approves in GPay → returns to app
       │
       ▼
  [Client] onVerify(orderId) callback
    → Navigate to status screen
    → Poll check-payment-status until resolved
       │
       ▼
  [Edge] Cashfree webhook: PAYMENT_SUCCESS
    → Verify HMAC-SHA256
    → Update payment.status = success
    → postSplit() to landlord vendor
    → Record cashback in ledger
```

### 4B. UPI Collect (Headless — Custom VPA Input)
```
  User taps "UPI" → enters VPA (e.g., user@okaxis)
       │
       ▼
  [Client] initiate-payment (same as above)
       │
       ▼
  [Client] callEdgeFunction('cashfree-pay-order', {
    payment_session_id,
    payment_method: { upi: { channel: 'collect', upi_id: vpa } }
  })
       │
       ▼
  [Edge] POST https://api.cashfree.com/pg/orders/sessions
    → Cashfree sends collect request to user's VPA
    → Response: { cf_payment_id, action: 'custom' }
       │
       ▼
  [Client] Show "Waiting for approval..." screen
    → Poll check-payment-status every 5s
    → Client-side timeout: 6 min (NPCI mandate: 5 min approval window + 1 min buffer)
    → On timeout: show "Payment pending — check back later" (NOT "failed")
      The payment stays in `processing` state in DB. cleanup-stale-payments cron
      handles server-side expiration after 15 min. Webhook may still arrive and
      resolve to success.
       │
       ▼
  [Edge] Cashfree webhook: PAYMENT_SUCCESS → same as UPI Intent
```

### 4C. Card (Cashfree Drop Checkout — Themed)
```
  User taps "Card" (credit or debit)
       │
       ▼
  [Client] initiate-payment (same as above, method: 'card')
       │
       ▼
  [Client] CFPaymentGatewayService.doPayment(
    new CFDropCheckoutPayment(session, components, theme)
  )
    where:
      components = [CFPaymentModes.CARD]  // Only show card tab
      theme = {
        navBarBgColor: '#131313',        // app background
        navBarTextColor: '#FFFFFF',
        buttonBgColor: '#FF9A6D',        // brand accent
        buttonTextColor: '#000000',
        primaryTextColor: '#CBCBCB',
        secondaryTextColor: '#878787'
      }
       │
       ▼
  [Native] Cashfree SDK overlay:
    - Card number input
    - Expiry + CVV
    - 3DS/OTP (native or redirect)
    - All within SDK — zero PCI scope
       │
       ▼
  [Client] onVerify(orderId) → navigate to status screen → poll + webhook
  [Client] onError(error, orderId) → STILL navigate to status screen
    (Cashfree SDK callbacks are NOT authoritative — only the webhook is.
     The SDK may report error while the payment still processes server-side.
     Status screen polls check-payment-status for the final determination.)
```

### 4D. Net Banking (API + Redirect)
```
  User taps "Net Banking" → selects bank from list
       │
       ▼
  [Client] initiate-payment (method: 'netbanking')
       │
       ▼
  [Client] callEdgeFunction('cashfree-pay-order', {
    payment_session_id,
    payment_method: { netbanking: { channel: 'link', bank_code: 3022 } }
  })
       │
       ▼
  [Edge] Response: { action: 'link', data: { url: 'https://bank...' } }
       │
       ▼
  [Client] Open redirect URL in expo-web-browser (InAppBrowser)
    → User logs into bank → approves
    → Bank redirects to return_url: flentsecured:///(payment)/status?order_id={order_id}
      NOTE: Triple-slash is Expo Router convention. Route matches app/(payment)/status.tsx
       │
       ▼
  [Client] Deep link handler (useDeepLink) catches flentsecured://payment-callback
    → Extracts order_id from query params
    → Navigates to status screen with paymentId
    → If user closes browser without completing: no deep link fires
      → App returns to confirm screen → user can retry or check status
  [Edge] Cashfree webhook → same flow as above
```

---

## 5. State Machine

### Payment Status Transitions
```
  ┌──────────┐     ┌────────────┐     ┌──────────┐
  │ initiated │────▶│ processing │────▶│ success  │
  └──────┬───┘     └─────┬──────┘     └──────────┘
         │               │
         │               │             ┌──────────┐
         │               └────────────▶│  failed  │
         │                             └──────────┘
         │
         │  (timeout, no SDK launch)
         └────────────────────────────▶│  failed  │
                                       └──────────┘

  ALLOWED TRANSITIONS:
    initiated  → processing (SDK launched / Order Pay called)
    initiated  → failed     (timeout / cleanup cron)
    initiated  → expired    (Cashfree order TTL expired, no payment attempt)
    processing → success    (webhook PAYMENT_SUCCESS)
    processing → failed     (webhook PAYMENT_FAILED / timeout)
    failed     → success    (late webhook — race condition edge case)

  FORBIDDEN:
    success  → anything (terminal)
    expired  → anything (terminal — user must start new payment)
    failed   → processing (ambiguous; only failed→success allowed)
```

### Landlord Payout Status (Easy Split)
```
  ┌──────────┐     ┌────────────┐     ┌──────────┐
  │ pending  │────▶│ processing │────▶│ settled  │
  └──────┬───┘     └─────┬──────┘     └──────────┘
         │               │
         │               │             ┌──────────┐
         │               └────────────▶│  failed  │
         └────────────────────────────▶│  (retry) │
                                       └──────────┘

  pending    = payment succeeded, postSplit not yet called or pending
  processing = postSplit succeeded, waiting for Cashfree settlement
  settled    = VENDOR_SETTLEMENT_SUCCESS webhook received
  failed     = split_retry_count >= 3 OR VENDOR_SETTLEMENT_FAILED
```

---

## 6. Webhook Signature Verification

### Cashfree (new)
```typescript
function verifyCashfreeWebhook(
  timestamp: string,
  rawBody: string,
  receivedSignature: string,
  secretKey: string
): boolean {
  // CRITICAL: Dev branch uses timestamp + "." + rawBody (dot separator)
  // Verify against Cashfree docs which format is correct before implementation
  const signedPayload = timestamp + rawBody; // FIXME: may need "." separator
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(signedPayload)
    .digest('base64');
  return expectedSignature === receivedSignature;
}

// Headers: x-webhook-timestamp, x-webhook-signature
// CRITICAL: Use RAW body string, NOT parsed-then-re-serialized JSON
```

### PayU (legacy — kept for old payments)
```typescript
// Existing: verifyPayUWebhookHashWithCharges()
// SHA-512 of key|txnid|amount|productinfo|...|salt
// Kept unchanged for payments where payment_gateway='payu'
```

---

## 7. Cashfree SDK Integration (React Native)

### Dependencies
```json
{
  "react-native-cashfree-pg-sdk": "^2.3.0",
  "cashfree-pg-api-contract": "^2.1.0"
}
```

### Expo Config
```json
// app.json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "LSApplicationQueriesSchemes": [
          "upi", "phonepe", "tez", "paytm", "paytmmp", "bhim"
        ]
      }
    },
    "android": {
      "intentFilters": [],
      "queries": {
        "intent": [
          { "action": "android.intent.action.VIEW", "data": { "scheme": "upi" } }
        ],
        "package": [
          "com.google.android.apps.nbu.paisa.user",
          "com.phonepe.app",
          "net.one97.paytm"
        ]
      }
    }
  }
}
```

### Build Requirements
- **`npx expo prebuild --clean` is REQUIRED** after adding the Cashfree SDK (it's a native module)
- Reapply spaces-in-path patches (lesson 12): `patches/expo-constants+18.0.13.patch`
- Fix `ios/FlentSecured.xcodeproj/project.pbxproj` backtick script after prebuild
- Add `SENTRY_DISABLE_AUTO_UPLOAD=true` to `ios/.xcode.env.local` after prebuild
- Run `cd ios && pod install --repo-update` after prebuild

### SDK Compatibility Assessment (from autoresearch validation)
- **RISK: SDK uses old bridge pattern (NativeModules, not TurboModules)**
  - Cashfree SDK tested on RN 0.73.6, peer dep is `"*"` (no version constraint)
  - RN 0.81.x interop layer supports old-arch modules → SHOULD work but UNTESTED by Cashfree
  - No GitHub issues reporting New Architecture breakage (0 open, 12+ closed — none mention Fabric/TurboModules)
  - **BLOCKER-if-broken:** Test SDK import + basic `doPayment()` call FIRST in a dev build before writing any integration code
- Expo prebuild officially supported by Cashfree (documented with `npx expo install` + `expo-dev-client`)
- If incompatible: fallback is Cashfree Web Checkout (`CFWebCheckoutPayment`) in WebView

### SDK Initialization
```typescript
// cashfreeService.ts
import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import {
  CFEnvironment, CFSession,
  CFDropCheckoutPayment, CFUPIIntentCheckoutPayment,
  CFPaymentComponentBuilder, CFPaymentModes, CFThemeBuilder
} from 'cashfree-pg-api-contract';

const ENV = __DEV__ ? CFEnvironment.SANDBOX : CFEnvironment.PRODUCTION;

export function setupCallbacks(
  onVerify: (orderId: string) => void,
  onError: (error: any, orderId: string) => void
) {
  CFPaymentGatewayService.setCallback({ onVerify, onError });
}

export function removeCallbacks() {
  CFPaymentGatewayService.removeCallback();
}

export function launchCardPayment(paymentSessionId: string, orderId: string) {
  const session = new CFSession(paymentSessionId, orderId, ENV);
  const components = new CFPaymentComponentBuilder()
    .add(CFPaymentModes.CARD)
    .build();
  const theme = new CFThemeBuilder()
    .setNavigationBarBackgroundColor('#131313')
    .setNavigationBarTextColor('#FFFFFF')
    .setButtonBackgroundColor('#FF9A6D')
    .setButtonTextColor('#000000')
    .setPrimaryTextColor('#CBCBCB')
    .setSecondaryTextColor('#878787')
    .build();
  const payment = new CFDropCheckoutPayment(session, components, theme);
  CFPaymentGatewayService.doPayment(payment);
}

export function launchUPIIntent(paymentSessionId: string, orderId: string) {
  const session = new CFSession(paymentSessionId, orderId, ENV);
  const theme = new CFThemeBuilder()
    .setNavigationBarBackgroundColor('#131313')
    .build();
  const payment = new CFUPIIntentCheckoutPayment(session, theme);
  CFPaymentGatewayService.doUPIPayment(payment);
}
```

---

## 8. Environment & Secrets

### Supabase Dev DB (zqlowjveyqiagnbmfwsb) — Secrets
```
CASHFREE_PG_APP_ID=<retrieve from Cashfree dashboard or ~/Downloads/APIKey.csv>
CASHFREE_PG_APP_SECRET=<retrieve from Cashfree dashboard or ~/Downloads/APIKey.csv>
CASHFREE_PG_BASE_URL=https://api.cashfree.com
CASHFREE_SPLIT_WEBHOOK_SECRET=<set from Cashfree Easy Split webhook config>

# Existing (kept for backward compat):
PAYU_MERCHANT_KEY=<existing in Supabase secrets>
PAYU_MERCHANT_SALT=<existing in Supabase secrets>
```
**SECURITY:** Never commit API keys to spec documents or source code. All secrets
are set via `supabase secrets set` CLI or the Supabase dashboard.

**For sandbox testing:** Use Cashfree sandbox keys (test prefix `cfsk_ma_test_*`)
from the Cashfree dashboard. The SDK environment switches via `CFEnvironment.SANDBOX`
in dev mode and `CFEnvironment.PRODUCTION` in production builds.

### App (rn-app/.env)
```
EXPO_PUBLIC_CASHFREE_ENV=PRODUCTION
# No API keys in client — all via edge functions
```

### Fee Rates — Dynamic via Cashfree API
```
Current PayU rates (hardcoded in payment/index.ts):
  UPI: 0%  |  CC: 1.85%  |  DC: 0.9%  |  NB: ₹15 flat

Cashfree approach: Fetch fee rates dynamically via Cashfree MCP/API.
  - Use Cashfree's settlement/charges API to get actual gateway fees
  - Cache in edge function (refresh daily or on payment initiation)
  - Fallback to conservative hardcoded defaults if API unavailable
  - Return rates per gateway_version in getGatewayFeeRates()

IMPLEMENTATION:
  1. Add fetchCashfreeFeeRates() to cashfree-easysplit.ts
  2. Update initiate-payment to use dynamic rates for Cashfree path
  3. Keep hardcoded PayU rates for legacy path (unchanged)
  4. Frontend computeFee() already accepts rates as input — no change needed
```

---

## 9. Testing Strategy

### Supabase Dev Branch
- Deploy all edge functions to dev DB (zqlowjveyqiagnbmfwsb)
- Apply migration on dev DB
- Set Cashfree secrets on dev DB
- Register webhook URLs pointing to dev DB

### Expo Preview
- Build preview profile with `eas build --profile preview`
- OTA updates via `eas update --channel preview`
- Test on physical devices (UPI Intent requires real UPI apps)

### Test Matrix
| Method | Sandbox Test | Real Device Test |
|--------|-------------|-----------------|
| UPI Intent | Mock response | GPay/PhonePe installed |
| UPI Collect | Test VPA | Real VPA approval |
| Credit Card | 4111... test card | N/A (Cashfree handles) |
| Debit Card | Test card | N/A |
| Net Banking | Test bank redirect | Real bank login |
| Webhook | Cashfree sandbox webhook | Production webhook |
| Split | Sandbox vendor | Dev vendor |

### Required Unit Tests (from eng review)
These tests are mandatory before shipping. They cover critical security and routing logic.

**Webhook Verification:**
- `test_valid_hmac_sha256_signature_accepted` — correct timestamp + body + secret → verify returns true
- `test_invalid_signature_rejected` — wrong secret → verify returns false
- `test_tampered_body_rejected` — correct secret but modified body → verify returns false
- `test_missing_timestamp_rejected` — no x-webhook-timestamp header → 400
- `test_replay_attack_blocked` — duplicate event_id in processed_webhooks → skip

**Gateway Routing:**
- `test_gateway_version_cashfree_routes_to_cashfree` — `gateway_version: 'cashfree'` → Cashfree createOrder
- `test_gateway_version_payu_routes_to_payu` — `gateway_version: 'payu'` → PayU hash generation
- `test_missing_gateway_version_defaults_to_payu` — no param → PayU path (backward compat)
- `test_unknown_gateway_version_defaults_to_payu` — `gateway_version: 'xyz'` → PayU fallback

**Webhook Header Detection:**
- `test_cashfree_headers_detected_first` — both Cashfree + PayU headers → Cashfree path
- `test_payu_form_data_detected` — PayU form fields only → PayU path
- `test_neither_gateway_rejected` — no matching headers → 400

**Amount Validation:**
- `test_amount_mismatch_rejected` — webhook amount != DB initiated amount → reject + ops alert
- `test_amount_match_accepted` — exact paise match → process normally

**State Transitions:**
- `test_initiated_to_success` — valid transition
- `test_processing_to_success` — valid transition
- `test_failed_to_success_late_webhook` — valid (edge case: late webhook flips failed to success)
- `test_success_to_anything_blocked` — success is terminal, skip silently

**Ownership Validation (cashfree-pay-order):**
- `test_owner_can_pay_own_order` — user_id matches → proceed
- `test_non_owner_rejected_403` — user_id mismatch → 403 Forbidden

---

## 10. Rollback Plan

1. **Feature flag**: `gateway_version` param. If Cashfree breaks, old app clients automatically use PayU path.
2. **New app rollback**: Push OTA update reverting `gateway_version` to 'payu' in the service layer.
3. **Backend rollback**: Edge functions support both gateways simultaneously. No destructive migration.
4. **DB rollback**: New columns have defaults. No data loss on revert.
5. **Timeline**: Rollback to PayU takes ~5 minutes (OTA push + edge function redeploy).

---

## 11. NOT in Scope

- Token Vault / saved cards (future phase)
- Auto-pay / subscriptions (future phase)
- Multi-gateway routing / A-B testing (future phase)
- Payment analytics dashboard (future phase)
- Removing PayU code entirely (Phase 2, after 100% adoption)
- Cashfree Payouts (separate from Easy Split)

---

## 12. Error & Rescue Map

| Codepath | What Can Go Wrong | Error Type | Rescued? | User Sees |
|----------|-------------------|-----------|----------|-----------|
| `initiate-payment` (Cashfree) | Cashfree API timeout | `CashfreeError` | Y - retry 1x | "Payment service busy, try again" |
| `initiate-payment` (Cashfree) | Cashfree returns 401 (bad credentials) | `CashfreeError` | Y - log + alert | "Payment unavailable" + ops alert |
| `initiate-payment` (Cashfree) | Cashfree returns 409 (duplicate order_id) | `CashfreeError` | Y - generate new ID, retry | Transparent to user |
| `initiate-payment` (Cashfree) | Cashfree returns 5xx | `CashfreeError` | Y - retry 1x | "Payment service temporarily unavailable" |
| `initiate-payment` (gateway routing) | Unknown `gateway_version` value | `ValidationError` | Y - default to 'payu' | Transparent (fallback) |
| `cashfree-pay-order` (UPI Collect) | Invalid VPA format | `CashfreeError` | Y - return error | "Invalid UPI ID" |
| `cashfree-pay-order` (UPI Collect) | Cashfree returns payment_status=FAILED | `PaymentFailedError` | Y - update DB | "Payment failed" on status screen |
| `cashfree-pay-order` (Net Banking) | Bank not supported | `CashfreeError` | Y - return error | "Bank not available" |
| `payment-webhook` | HMAC signature mismatch | `SecurityError` | Y - reject + audit log | Silent (webhook rejected) |
| `payment-webhook` | Amount mismatch (webhook vs DB) | `ValidationError` | Y - reject + ops alert | Silent + manual review |
| `payment-webhook` | Payment not found in DB | `NotFoundError` | Y - log + ignore | Silent (orphan webhook) |
| `payment-webhook` | postSplit() fails | `CashfreeError` | Y - `cf_split_posted=false`, cron retries | Transparent (settled later) |
| `cashfree-split-webhook` | VENDOR_SETTLEMENT_REVERSED | `SettlementError` | Y - status=failed + ops alert | Notification: "Settlement delayed" |
| SDK `onError` callback | User cancelled | `CFErrorResponse` | Y - navigate to status screen | Status screen shows current state |
| SDK `onError` callback | Network error during payment | `CFErrorResponse` | Y - navigate to status screen | Poll for resolution |
| SDK `onError` callback | SDK initialization failure | `CFErrorResponse` | Y - fallback to PayU? | "Payment unavailable, try again" |
| `check-payment-status` | Cashfree API down | `CashfreeError` | Y - return last known DB status | Show cached status |
| `sync-vendors` | Landlord PAN missing | `KYCError` | Y - skip + log | Vendor stays in `IN_BENE_CREATION` |
| `sync-vendors` | Cashfree vendor API down | `CashfreeError` | Y - skip batch, retry next cron | Silent (cron retry) |

### Critical Gap: None identified
All error paths are rescued. The key insight is that SDK `onError` should NEVER be treated as
authoritative — always navigate to status screen and let the webhook determine the final state.

---

## 13. Security Assessment

| Threat | Likelihood | Impact | Mitigated? |
|--------|-----------|--------|-----------|
| Forged webhook (no signature) | High | Critical | YES — HMAC-SHA256 verification required |
| Replay attack (old webhook resubmitted) | Med | High | YES — `processed_webhooks` dedup table |
| Amount tampering (webhook says lower amount) | Med | Critical | YES — compare webhook amount vs DB initiated amount |
| Gateway version spoofing (force PayU path) | Low | Med | YES — old app gets PayU, new app gets Cashfree, both work |
| SDK callback spoofing | Low | Low | MITIGATED — callbacks are not authoritative, webhook is |
| Cashfree credentials leak | Low | Critical | YES — secrets in Supabase secrets, never in client code |
| Man-in-middle on Cashfree API calls | Low | Critical | YES — HTTPS enforced, certificate pinning in SDK |
| Vendor settlement to wrong account | Low | Critical | YES — vendor_id validated against landlord's bank_account |
| Race condition: double postSplit() | Med | Med | YES — idempotency key `split-{paymentId}` |
| PCI scope via card data interception | Low | Critical | YES — card data never leaves Cashfree SDK |

### No new attack surfaces beyond what PayU already had.
The migration actually improves security: HMAC-SHA256 (Cashfree) is stronger than the SHA-512 hash
chain (PayU) for webhook verification. The `processed_webhooks` dedup is a net improvement.

---

## 14. Deployment Sequence

### Phase 1: Backend (Supabase Dev DB)
```
  Step 1: Set Cashfree secrets on Dev DB
    supabase secrets set CASHFREE_PG_APP_ID=<value> --project-ref zqlowjveyqiagnbmfwsb
    supabase secrets set CASHFREE_PG_APP_SECRET=<value> --project-ref zqlowjveyqiagnbmfwsb
    supabase secrets set CASHFREE_PG_BASE_URL=https://api.cashfree.com --project-ref zqlowjveyqiagnbmfwsb
    supabase secrets set CASHFREE_SPLIT_WEBHOOK_SECRET=<value> --project-ref zqlowjveyqiagnbmfwsb

  Step 2: Apply migration
    supabase db push --project-ref zqlowjveyqiagnbmfwsb

  Step 3: Deploy edge functions (order matters — shared module first)
    supabase functions deploy _shared --project-ref zqlowjveyqiagnbmfwsb
    supabase functions deploy initiate-payment --project-ref zqlowjveyqiagnbmfwsb
    supabase functions deploy payment-webhook --project-ref zqlowjveyqiagnbmfwsb
    supabase functions deploy cashfree-pay-order --project-ref zqlowjveyqiagnbmfwsb
    supabase functions deploy check-payment-status --project-ref zqlowjveyqiagnbmfwsb
    supabase functions deploy cashfree-split-webhook --project-ref zqlowjveyqiagnbmfwsb
    supabase functions deploy sync-vendors --project-ref zqlowjveyqiagnbmfwsb
    supabase functions deploy settle-to-landlord --project-ref zqlowjveyqiagnbmfwsb
    supabase functions deploy poll-settlement-status --project-ref zqlowjveyqiagnbmfwsb

  Step 4: Register webhook URLs in Cashfree dashboard
    Payment webhook: https://zqlowjveyqiagnbmfwsb.supabase.co/functions/v1/payment-webhook
    Split webhook: https://zqlowjveyqiagnbmfwsb.supabase.co/functions/v1/cashfree-split-webhook
```

### Phase 2: Frontend (Expo Preview)
```
  Step 1: Install Cashfree SDK
    cd rn-app && npx expo install react-native-cashfree-pg-sdk cashfree-pg-api-contract

  Step 2: Regenerate native dirs
    npx expo prebuild --clean
    # Reapply patches (lesson 12)

  Step 3: Verify SDK compatibility
    npx tsc --noEmit  (TypeScript check)
    npx expo start    (Metro bundler check)

  Step 4: Build preview
    eas build --profile preview --platform ios
    eas build --profile preview --platform android

  Step 5: OTA updates for JS-only changes
    eas update --channel preview --message "Cashfree migration v1"
```

### Phase 3: Smoke Test Checklist (first 30 minutes)
```
  [ ] Initiate payment with gateway_version='cashfree' → get payment_session_id
  [ ] UPI Intent → native app picker shows installed apps
  [ ] Card → Cashfree Drop Checkout opens with dark theme
  [ ] Net Banking → redirect to bank login page
  [ ] Webhook received and verified → payment status updates
  [ ] Legacy PayU path still works (gateway_version='payu' or missing)
  [ ] postSplit() fires on success → landlord_payout_status=processing
  [ ] cleanup-stale-payments cron handles expired Cashfree orders
  [ ] Status screen polls correctly for Cashfree payments
```

### Rollback (if Phase 3 fails)
```
  1. Push OTA: revert gateway_version to 'payu' in payment service
  2. Backend: no rollback needed (both gateways supported simultaneously)
  3. Time to rollback: ~5 minutes
```

---

## 15. Reviewer Concerns (from adversarial review)

All 17 issues from the initial review have been resolved. The spec has been through
1 round of adversarial review with all issues fixed.
