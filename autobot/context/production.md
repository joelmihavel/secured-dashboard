# Production Readiness Context -- Flent Secured v2 React Native

Gap analysis and implementation requirements for production deployment.

---

## 1. Current State Summary

| Feature | Status | Readiness |
|---------|--------|-----------|
| Expo Config | Complete | 95% |
| Deep Linking | Working | 90% |
| Error Handling | Basic + ErrorBoundary | 40% |
| Push Notifications | Stubbed code only | 20% |
| Sentry/Crash Reporting | TODO comments only | 0% |
| Analytics | Not started | 0% |
| OTA Updates | Not started | 0% |
| Accessibility | Basic labels only | 25% |
| CI/CD (Backend) | Comprehensive | 85% |
| CI/CD (Frontend) | Manual only | 10% |
| App Store Metadata | Not started | 0% |
| Performance Monitoring | Not started | 0% |

---

## 2. Implemented Features

### Error Handling
- **ErrorBoundary** (`src/components/ErrorBoundary.tsx`): catches render errors, shows "Something went wrong" UI in production, error messages in dev
- **Error utilities** (`src/utils/errorHandling.ts`):
  - `AppError` interface, `Result<T>` discriminated union
  - `tryCatch()` async wrapper, `getErrorMessage()`, `logError()` (dev-only console)
  - TODO comments: "send to crash reporting service (Sentry, etc.)"

### Deep Linking
- URL scheme: `flentsecured://`
- Expo Router v4 typed routes
- Dev screen picker at `/(dev)/screen-picker` with 46 screens registered
- `DEV_DIRECT_SCREEN` config for parity testing bypass

### Data Validation
- Zod ~3.23.0 for schema validation
- Immer ~11.1.3 for immutable state updates

### Storage Security
- `expo-secure-store` for tokens/secrets (iOS Keychain, Android Keystore)

---

## 3. Push Notifications (Stubbed)

**File**: `src/services/notifications.ts`

All code is commented out pending `expo-notifications` installation.

### What's Ready (Code Stubs)
- `registerForPushNotifications()` -- device token registration
- `setupNotificationHandlers()` -- listener setup
- `handleNotificationResponse()` -- deep link routing from notifications
- `NOTIFICATION_ROUTES` map: notification type -> screen route
  - `waitlist_approved` -> `/(waitlist)/approved`
  - `payment_success` -> `/(payment)/success`
  - `payment_failed` -> `/(payment)/failed`
  - etc.
- Android notification channel setup (vibration, importance)
- Token persistence to Supabase schema

### Installation Steps
```bash
npx expo install expo-notifications expo-device expo-constants
npx expo prebuild --clean
# Add "expo-notifications" to app.json plugins
# Uncomment implementation in notifications.ts
```

---

## 4. Sentry Error Tracking (NOT STARTED)

### Implementation Plan
```bash
npx expo install @sentry/react-native
```

### Integration Points
- Root layout (`app/_layout.tsx`): `Sentry.init()` with DSN
- ErrorBoundary: replace TODO with `Sentry.captureException(error)`
- `logError()` in errorHandling.ts: add `Sentry.captureException()` for prod
- Edge functions: add Sentry breadcrumbs for API calls
- Custom context: user ID, tenancy ID, payment status

### Config Required
- Sentry DSN (env var: `EXPO_PUBLIC_SENTRY_DSN`)
- Source maps upload in EAS build
- Performance monitoring sample rate

---

## 5. OTA Updates (NOT STARTED)

### Implementation Plan
```bash
npx expo install expo-updates
```

### Integration Points
- `app.json`: add `expo-updates` plugin with EAS Update config
- Root layout: check for updates on app launch
- Silent background updates for minor fixes
- Forced update screen for breaking changes
- EAS Update channel per build profile (dev, preview, production)

---

## 6. Analytics (NOT STARTED)

### Recommended: Mixpanel or Amplitude

### Critical Events to Track
- **Auth funnel**: splash_view, carousel_complete, sign_up_start, otp_sent, otp_verified, auth_complete
- **Onboarding**: agreement_upload_start, agreement_processed, bank_verified, utility_verified, landlord_invited
- **Payment**: payment_initiated, method_selected, payment_processing, payment_success, payment_failed
- **Engagement**: home_view, profile_view, transaction_view, cashback_earned
- **Errors**: api_error, upload_error, payment_error (with context)

### Properties
- User: userId, tenancyId, city, platform, appVersion
- Session: sessionId, timestamp, screen

---

## 7. Accessibility (PARTIAL)

### Current Coverage
- PrimaryButton: `accessibilityLabel`, `accessibilityState`
- TextInput: testID, error text
- Payment components: basic labels on UPI/Credit/Netbanking cards
- FileUploadZone: accessible zone

### Gaps
- No ARIA roles beyond buttons
- No VoiceOver testing documented
- No semantic grouping for complex screens
- Missing labels on navigation elements, icons, images
- No `accessibilityHint` usage
- No high-contrast/large-text support

---

## 8. CI/CD

### Backend CI (`.github/workflows/ci-backend.yml`) -- IMPLEMENTED
- Triggers on PRs to main affecting `supabase/`
- Steps: setup Supabase CLI + Deno, reset schema, apply migrations, seed data, deploy edge functions, run pgTAP tests, run Deno tests, coverage to Codecov
- Claude Code review: security checks, test coverage validation, PR comments

### Visual Regression (`.github/workflows/visual-tests.yml`) -- INFRASTRUCTURE ONLY
- Manual dispatch, iOS + Web platforms
- iOS: Xcode 15.2 build -> Sauce Labs XCUITest
- Web: Next.js build -> Sauce Labs Playwright
- Status: Config exists, no actual test suites or baseline images

### Frontend CI -- NOT IMPLEMENTED
Needed:
- `npx tsc --noEmit` -- type check
- `npx eslint .` -- lint
- `jest --coverage` -- unit tests
- Maestro Cloud E2E on PRs (when ready)

---

## 9. App Store Preparation (NOT STARTED)

### Needed
- App Store Connect metadata (descriptions, keywords, categories)
- Screenshots for all device sizes (iPhone 14 Pro, iPhone SE, iPad)
- Privacy nutrition labels
- App Review information (demo account, test instructions)
- Fastlane setup for automated metadata + screenshot submission
- Play Store listing (descriptions, screenshots, feature graphic)

---

## 10. Performance Baseline (NOT STARTED)

### Metrics to Establish
- Cold start time (< 2s target)
- TTI (Time to Interactive) for home screen
- FPS during animations (Reanimated, Moti, Lottie)
- Bundle size (JS bundle < 5MB target)
- Memory usage during payment flow
- Network request latency to Supabase edge functions

### Tools
- React Native Perf Monitor (dev menu)
- Flipper (if needed)
- Sentry Performance (after Sentry integration)
- EAS Build size tracking
