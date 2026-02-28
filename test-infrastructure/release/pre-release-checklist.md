# Pre-Release Checklist - Flent Secured

Use this checklist before every production App Store / Play Store submission.

---

## P0 - Blockers (must ALL pass before submission)

- [ ] **Privacy Manifest** (`PrivacyInfo.xcprivacy`) is present and up-to-date with all declared APIs
- [ ] **Permissions audit**: all `NSUsageDescription` keys in `Info.plist` are accurate and user-friendly
- [ ] **Demo auth disabled**: `DEMO_PHONES` secret is NOT set in production environment (or set to empty string)
- [ ] **Test data cleaned**: Run `sql/stale-data-audit.sql` against production — zero rows returned for all checks
- [ ] **No hardcoded secrets**: Grep codebase for API keys, tokens, passwords — none found outside `.env` / EAS Secrets
- [ ] **Bundle ID correct**: `com.flent.secured` in `app.json` and Xcode project
- [ ] **Version bump**: `version` and `ios.buildNumber` / `android.versionCode` incremented in `app.json`
- [ ] **Crash-free on launch**: Fresh install on physical device boots to splash without crash

---

## P1 - Pre-Submission (must pass before clicking Submit)

### API & Backend
- [ ] **Production Supabase URL**: `EXPO_PUBLIC_SUPABASE_URL` points to production project
- [ ] **Production Supabase anon key**: `EXPO_PUBLIC_SUPABASE_ANON_KEY` is the production anon key
- [ ] **Production PayU key**: `EXPO_PUBLIC_PAYU_KEY` is the production merchant key (not sandbox)
- [ ] **Cashfree production keys**: Production `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` set in edge function secrets
- [ ] **Edge functions deployed**: All Supabase edge functions are deployed to production
- [ ] **RLS verification**: Run `sql/rls-verify.sql` — all cross-tenant queries return 0 rows

### Monitoring & Error Tracking
- [ ] **Sentry enabled**: `SENTRY_DISABLE_AUTO_UPLOAD=false` for production build profile
- [ ] **Sentry DSN configured**: Production DSN set in `app.json` Sentry plugin config
- [ ] **Source maps uploaded**: Sentry receives source maps during EAS Build

### App Quality
- [ ] **All Jest tests passing**: `npx jest` in `rn-app/` — 0 failures
- [ ] **TypeScript clean**: `npx tsc --noEmit` — 0 errors
- [ ] **No console.log in production**: Babel plugin strips `console.*` or manual audit complete
- [ ] **Splash screen**: Loads correctly, no flash of white/black
- [ ] **Deep linking**: `flentsecured://` scheme works from external link
- [ ] **Offline handling**: App shows appropriate error state when network is unavailable

### PCI & Security
- [ ] **No card data stored locally**: Payment card details are never persisted to AsyncStorage or device storage
- [ ] **PayU SDK handles card input**: All card number/CVV input goes through PayU SDK, not custom TextInputs
- [ ] **SSL pinning**: Supabase client uses HTTPS only
- [ ] **Auth token refresh**: Token refresh works correctly (test with expired token)

### Apple-Specific
- [ ] **Apple review account seeded**: Run `scripts/seed-apple-review.sh` — phone +91 99999 00017 is ready
- [ ] **Review notes updated**: App Store Connect review notes match `apple-review/README.md`
- [ ] **Screenshots current**: App Store screenshots reflect current UI
- [ ] **App category**: Finance (primary), Lifestyle (secondary)

---

## P2 - Post-Submission (after submission accepted)

### Monitoring (First 24 Hours)
- [ ] **Sentry dashboard**: Monitor for new crashes or errors
- [ ] **Supabase logs**: Check edge function invocation errors
- [ ] **User reports**: Monitor support channels for issues
- [ ] **Crash-free rate**: Target > 99.5% in first 24h

### Rollback Plan
- [ ] **OTA update channel ready**: `eas update --channel production` can push JS-only hotfix
- [ ] **Previous build archived**: Previous production build is accessible in EAS for emergency resubmission
- [ ] **Edge function rollback**: Previous edge function versions can be redeployed via `supabase functions deploy`
- [ ] **Database migration rollback**: Down migrations exist for any schema changes in this release

### Post-Launch
- [ ] **OTA update tested**: Push a no-op OTA update to verify the update channel works
- [ ] **Analytics verified**: Key events (sign_up, payment_initiated, payment_success) are firing correctly
- [ ] **Rate limiting verified**: Auth OTP rate limiting is active and working in production
- [ ] **DEMO_PHONES confirmed empty**: Double-check production secret is not set
