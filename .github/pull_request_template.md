<!--
PR template for Secured-v2. Sections marked (REQUIRED for cleanup/destructive PRs)
must be filled. Fill in the others when relevant.
-->

## Summary

<!-- What does this PR change and why? 1–3 sentences. -->

## Risk classification

<!-- Pick one: -->
- [ ] **Local-only** (repo hygiene, docs, dev tooling) — no prod runtime impact
- [ ] **Build-time only** (env modules, lint, CI config) — affects builds, not running prod
- [ ] **Backend low-risk** (read-only docs, archived edge functions, dev-only schema)
- [ ] **Backend prod runtime** (edge functions, migrations, Cloud Run env, RLS policies)
- [ ] **Payments / KYC / auth surface** (anything that touches money or identity flow)

## Test plan

<!-- How was this verified locally? Bullet list of what was actually run. -->

- [ ]

## Audit-trail (REQUIRED for cleanup/destructive PRs)

<!-- For PRs that delete/archive/move files, drop columns, change RLS, rotate secrets, etc.
Fill in:
- Actor: <github handle>
- Date: <YYYY-MM-DD>
- Rationale: <why this is being done>
- Mitigation if regression: <how is this revertible>

Skip this section for additive code changes. -->

## Rollback plan

<!-- One command per surface affected. If migration: copy the `-- rollback:` SQL block here. -->

## Checklist

- [ ] No secrets / JWTs / tokens committed
- [ ] No direct `process.env.X` reads outside `rn-app/src/config/env.ts`, `admin-app/src/lib/env.ts`, `cloud-run/extraction-service/src/config.ts` (run `npm run lint:env`)
- [ ] If migration: idempotent + includes `-- rollback:` block
- [ ] If touching `supabase/functions/` shared code: all importers redeployed
- [ ] If Cloud Run: env preservation verified (`--no-traffic` + health probe + `update-traffic --to-latest`)
- [ ] If admin-app: no `NEXT_PUBLIC_*_SERVICE_KEY` reads in client-side code
- [ ] If payment surface: Maestro full regression run + manual TestFlight smoke on all 4 payment statuses (pending/success/failed/refunded)
