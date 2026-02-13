# Assumptions to Test - Flent Secured Build

## Backend Assumptions

### Database Migration (Task #6 - COMPLETED)
- [x] Migration file created: `20260129100000_add_payment_methods_refunds_referrals.sql`
- [ ] **ASSUMPTION: Migration deploys successfully to v2-backend-dev**
  - Test: Run `supabase db push` and verify tables exist
- [ ] **ASSUMPTION: RLS policies work correctly**
  - Test: Try to access other users' payment methods (should fail)
- [ ] **ASSUMPTION: Triggers fire correctly**
  - Test: Insert payment method with is_default=true, verify only one default

### Backend APIs (Tasks #7, #8 - IN PROGRESS)
Created functions (need testing):
- [ ] `update-profile` - Test: Update name, verify in DB
- [ ] `upload-avatar` - Test: Get presigned URL, upload image
- [ ] `add-upi-vpa` - Test: Add VPA, verify format validation
- [ ] `get-saved-payment-methods` - Test: Retrieve after adding
- [ ] `add-card-token` - Test: Add tokenized card
- [ ] `register-device-token` - Test: Register APNs token
- [ ] `delete-payment-method` - Test: Soft delete, verify hidden
- [ ] `mark-notification-read` - Test: Mark and verify is_read=true

Missing functions (still needed):
- [ ] `initiate-refund` - PayU Refund API integration
- [ ] `get-refund-status` - Refund tracking
- [ ] `apply-referral-code` - Referral system (DB function exists, edge function needed)
- [ ] `validate-referral-code` - Code validation

## iOS Assumptions

### Design System (Need to verify)
- [ ] **ASSUMPTION: AppColors, Spacing, Typography are in scope**
  - Test: Build project, check for import errors
- [ ] **ASSUMPTION: Plus Jakarta Sans font is included**
  - Test: Verify font files in bundle

### Type Definitions (iOS Lead fixing)
- [ ] **ASSUMPTION: DashboardModels.swift will define all types**
  - Types needed: HomeState, DashboardData, UserProfileData, TenancyData, etc.
- [ ] **ASSUMPTION: iOS project compiles after fixes**
  - Test: Run `xcodebuild build`

### Screens Implementation
- [ ] **ASSUMPTION: All 100 Figma screens match implementation**
  - Test: Design validator agent comparing each screen
- [ ] **ASSUMPTION: State machine handles all home states**
  - Test: Trigger each state and verify UI

## Integration Assumptions

- [ ] **ASSUMPTION: iOS can call new backend APIs**
  - Test: End-to-end flow from app to database
- [ ] **ASSUMPTION: Realtime subscriptions work for new tables**
  - Test: Insert payment_method, verify iOS receives update
- [ ] **ASSUMPTION: PayU WebView handles all payment scenarios**
  - Test: Complete payment in sandbox mode

## Testing Checklist (To run at end)

1. Build iOS app: `xcodebuild build -scheme FlentSecured`
2. Deploy migrations: `supabase db push`
3. Deploy functions: `supabase functions deploy --all`
4. Run unit tests: Check test files exist
5. Manual flow test: New user → Payment complete
6. Design validation: Compare all 100 screens
