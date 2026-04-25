# Agreement Upload → Waitlist Implementation Plan

## Goal
Route users to waitlist immediately after upload, process agreements asynchronously, bounce invalid documents back to upload with reupload state, and remove the old confirmation-screen backend dependency without breaking approval/setup/payment.

## Tasks
- [ ] Deploy the new waitlist status contract in `supabase/functions/get-waitlist-status/index.ts` so waitlist can read `contract_status`, `review_reason`, `requiresReupload`, `extraction_id`, and filename metadata → Verify: a processed invalid document returns reupload metadata and the app redirects back to upload with the backend error message.
- [ ] Fix the missing-entry fallback by updating `supabase/functions/join-waitlist/index.ts` to support the post-upload async flow (or remove the client fallback if server-side join becomes guaranteed) → Verify: if `waitlist_entries` is missing, opening waitlist does not hit `AGREEMENT_NOT_CONFIRMED` and the user stays on waitlist.
- [ ] Extract the side effects currently trapped in `supabase/functions/confirm-extraction/index.ts` into a shared backend finalization helper that can be called from async processing and the legacy confirm endpoint → Verify: the helper can lock role, set compatibility verification fields, run tenant matching, create/link tenancy, and return idempotently when rerun.
- [ ] Call that finalization helper from `supabase/functions/process-document/index.ts` only for accepted/manual-review outcomes, not for invalid/reupload-required outcomes → Verify: valid or manual-review agreements create the downstream tenancy path automatically, while invalid documents do not create tenancies and do require reupload.
- [ ] Keep approval and downstream flows resilient by making `supabase/functions/admin-waitlist/index.ts` recover or create a tenancy if approval finds one missing, instead of assuming `confirm-extraction` already did it → Verify: approving a waitlisted user with no tenancy still leaves them with an `active` or `pending_verification` tenancy.
- [ ] Remove remaining product-level dependency on the confirmation route by deleting or hard-disabling the review/confirm navigation path in app routing, while keeping `confirm-extraction` as a compatibility wrapper until all callers are gone → Verify: cold start, resumed session, and reupload flows never navigate to confirmation.
- [ ] Run targeted verification last across upload, async processing, reupload, approval, and setup/payment entry → Verify: automated tests pass for changed app/backend contracts, and manual scenarios confirm `upload → waitlist`, `invalid doc → upload error → reupload → waitlist`, and `approved user → tenancy-backed next step`.

## Done When
- [ ] Users always land on waitlist immediately after upload completion.
- [ ] Invalid or wrong documents reliably return from waitlist to upload error state and require a fresh reupload.
- [ ] No live onboarding path requires the old confirmation screen to create tenancies or advance backend state.
- [ ] Approved users can continue into setup/payment without missing tenancy data.

## Notes
- Use a shared backend finalization helper as the root-cause fix; do not duplicate the current `confirm-extraction` side effects in multiple edge functions.
- For the first pass, it is acceptable to keep `user_verified` as a compatibility flag set by backend finalization, even though the user no longer manually confirms; changing that schema is a larger migration and should be separate.
- Do not delete recovery/compatibility code until the new async finalization path is deployed, verified in production-like data, and no callers depend on `confirm-extraction`.
