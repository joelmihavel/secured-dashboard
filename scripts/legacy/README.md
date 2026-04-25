# Legacy migration scripts

One-shot scripts from the v1 → v2 cutover (March 2026). Moved here on 2026-04-25 from `scripts/` to declutter the active scripts dir while preserving them in case of emergency rerun.

| File | Purpose | When used |
|---|---|---|
| migrate_all.js / migrate_all_v2.js | Full v1→v2 data migration runner | March 2026 cutover |
| migrate_auth.js | auth.users + identities migration | March 2026 cutover |
| migrate_data.js / migrate_data_v2.js | Domain data migration in batches | March 2026 cutover |
| migrate_direct.js | Direct postgres connection variant (non-Supabase API) | Used for tables Supabase API choked on |
| migrate_fix.js / migrate_fix2.js | Iterative correction passes | Bug fixes during cutover |

All require `DEV_DB_URL` and `MAIN_DB_URL` env vars + node 18+. Run from repo root: `node scripts/legacy/migrate_X.js`.
