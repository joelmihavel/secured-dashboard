# Legacy post-waitlist bank-details fix (TEMP)

A surgical, self-cancelling fix for the cohort of approved users who never
collected landlord bank details. Owns three artifacts that must be removed
together once the cohort hits zero.

## Why this exists

The 2026-05-01 release moved the **add-bank-details** screen from
post-waitlist to **pre-waitlist**. Every user signed up against a build
shipped before that release was approved without a verified landlord bank
row, because the only place to collect bank used to be the
`/(agreement)/add-bank-details` step *after* admin approval.

After the cutover the journey router at `rn-app/app/index.tsx` for
`user_status='approved'` routes straight to `/(main)`. The pre-cutover
cohort lands on the dashboard with `tenancies.bank_verified=false`, so:

- Pay-Now opens the verification sheet, "Skip" routes to enter-rent.
- `initiate-cashfree-payment` only `console.warn`s on missing landlord
  bank — does not block.
- Cashfree charges the tenant.
- `settle-to-landlord` cron later finds no `bank_accounts.party_type='landlord'`
  row, marks `landlord_payout_status='failed'` with reason
  `BANK_NOT_VERIFIED`, and notifies the user of `settlement_failed`.
- Money sits in the merchant account; landlord never receives rent.

At cutover the cohort was 89 users (audit run 2026-05-02).

## What this fix does

Adds a temporary boolean `users.legacy_post_waitlist_bank_required`,
flipped to `true` on the cohort by a one-shot migration. The journey
router on the client checks the flag on cold start and bounces flagged
users to `/(agreement)/add-bank-details` instead of `/(main)`.

Once the user verifies bank, `verify-bank` calls
`check_and_advance_to_active`, which flips `user_status` to `'active'`.
The journey router's approved branch never fires for them again — the
flag becomes inert without needing to be cleared. New users created after
the cutover will never have the flag set; the migration was a snapshot.

## Artifacts owned by this fix

| Artifact | Path |
|---|---|
| Migration (column + backfill) | `supabase/migrations/20260502120000_legacy_post_waitlist_bank_required.sql` |
| Helper + routing edits | `rn-app/app/index.tsx` (`userNeedsLegacyBank`, two call sites in approved branch) |
| This doc | `docs/legacy-post-waitlist-bank-fix.md` |

A separate, **permanent** fix lives in
`supabase/functions/admin-waitlist/index.ts` — that one calls
`check_and_advance_to_active` after approval, closing the new-flow gap.
**Do not remove that change** when removing this fix; it is unrelated.

## Monitoring

```sql
-- Remaining flagged users
SELECT count(*) FROM users WHERE legacy_post_waitlist_bank_required = true;

-- Drilldown
SELECT id, full_name, phone, status_updated_at, created_at
FROM users
WHERE legacy_post_waitlist_bank_required = true
ORDER BY status_updated_at DESC;

-- Conversion (flag-then-active = success path)
SELECT
  count(*) FILTER (WHERE legacy_post_waitlist_bank_required) AS still_flagged_approved,
  count(*) FILTER (WHERE NOT legacy_post_waitlist_bank_required AND user_status = 'active') AS converted_to_active
FROM users;
```

## Deploy — CRITICAL OTA required

The client OTA **must be marked critical** so users get the bundle on the
next cold start (auto-reload via `useOTAUpdates`) instead of waiting for
their next normal app cycle. Without this, the 89 affected users could
attempt payments on the stale bundle and trigger settlement failures.

Critical detection (see `rn-app/src/config/updates.ts:203-220`) matches
update messages whose `--message` starts with `CRITICAL:`.

Publish:
```bash
eas update \
  --branch production \
  --message "CRITICAL: legacy post-waitlist bank cohort — reroute approved users with no landlord bank back to add-bank-details" \
  --non-interactive
```

After publishing, monitor critical-update reach:
- `ota_check`, `ota_reload` analytics events should spike within ~10 min.
- The `setupAutoUpdateCheck` cycle (5-min throttle) means most foreground
  users converge within 5–15 minutes.

## Removal checklist

When `count(*) WHERE legacy_post_waitlist_bank_required = true` reaches
0 (or hits a tail of unreachable users we'll deal with manually):

1. New migration:
   ```sql
   ALTER TABLE public.users DROP COLUMN legacy_post_waitlist_bank_required;
   ```
2. `rn-app/app/index.tsx`: delete the `userNeedsLegacyBank` helper and
   inline both approved-branch call sites back to:
   ```ts
   const { data: tenancyRow } = await supabase
     .from('tenancies').select('id').eq('user_id', userId).maybeSingle();
   correctTarget = !tenancyRow ? '/(waitlist)' : await decideApprovedTarget(userId);
   ```
   Search for `TEMP — legacy_post_waitlist_bank_required` and
   `TEMP: legacy cohort bounce` to find every reference.
3. Delete this doc.
4. OTA the client.

## Trapdoor — what to do if a NEW user gets stuck after cutover

If you discover any user post-2026-05-02 that ends up `approved` with
no verified landlord bank, that's a regression in the new flow (likely
PR2's `check_and_advance_to_active` call was bypassed somehow). The
quickest patch is:

```sql
UPDATE users SET legacy_post_waitlist_bank_required = true WHERE id = '<user_id>';
```

Then root-cause why the new-flow gap fix didn't catch them.
