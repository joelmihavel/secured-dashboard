# Figma 1:1 Parity - Progress Tracker

> Last updated: 2026-02-20
> Workflow: figma-1on1parity (replaces buildbot extraction for new pipeline)

## Overall Status

| Metric | Value |
|--------|-------|
| Total screen groups | 22 |
| Total screen states | 71 |
| Extracted | 4 (sign-up) |
| PM Validated | 4 (sign-up) |
| Code Fixed | 4 (sign-up) |
| QA Tested | 0 (in progress) |
| Certified | 0 |

---

## Screen Progress

### Auth Screens

| Screen | Figma ID | State | Route | Extraction | PM | Code Fix | QA | Status |
|--------|----------|-------|-------|------------|-----|----------|-----|--------|
| Splash | 1-28055 | default | /(auth)/splash | -- | -- | -- | -- | Pending |
| Beta Splash | 1-28071 | beta | /(auth)/beta-splash | -- | -- | -- | -- | Pending |
| Carousel Slide 1 | 1-28985 | page1 | /(auth)/carousel?page=1 | -- | -- | -- | -- | Pending |
| Carousel Slide 2 | 1-29025 | page2 | /(auth)/carousel?page=2 | -- | -- | -- | -- | Pending |
| Carousel Slide 3 | 1-29065 | page3 | /(auth)/carousel?page=3 | -- | -- | -- | -- | Pending |
| **Sign Up (empty)** | **1-29108** | **empty** | **/(auth)/sign-up** | **Done** | **PASS** | **Done** | In Progress | **Active** |
| **Sign Up (filled)** | **1-31073** | **filled** | **/(auth)/sign-up** | **Done** | **PASS** | **Done** | In Progress | **Active** |
| **Sign Up (error1)** | **1-31590** | **error1** | **/(auth)/sign-up** | **Done** | **PASS** | **Done** | In Progress | **Active** |
| **Sign Up (error2)** | **1-31671** | **error2** | **/(auth)/sign-up** | **Done** | **PASS** | **Done** | In Progress | **Active** |
| OTP (empty) | 1-31175 | empty | /(auth)/otp | **Done** | **PASS** | **Done** | In Progress | **Active** |
| OTP (filled) | 1-31277 | filled | /(auth)/otp | **Done** | **PASS** | **Done** | In Progress | **Active** |
| OTP (error1) | 1-31485 | error1 | /(auth)/otp | **Done** | **PASS** | **Done** | In Progress | **Active** |
| OTP (error2) | 1-31380 | error2 | /(auth)/otp | **Done** | **PASS** | **Done** | In Progress | **Active** |

### Onboarding Screens

| Screen | Figma ID | State | Route | Extraction | PM | Code Fix | QA | Status |
|--------|----------|-------|-------|------------|-----|----------|-----|--------|
| Waitlist (pending) | 41-11206 | default | /(waitlist) | -- | -- | -- | -- | Pending |
| Waitlist (accepted) | 41-11313 | accepted | /(waitlist)/approved | Done | PASS | Done | -- | Done |
| Waitlist (rejected) | 41-11410 | rejected | /(waitlist) | Done | PASS | Done | -- | Done |
| Waitlist (24hrs) | 41-11506 | 24hrs | /(waitlist) | -- | -- | -- | -- | Pending |
| Waitlist (referral) | 41-11613 | referral | /(waitlist) | -- | -- | -- | -- | Pending |
| Waitlist (referral-invalid) | 41-11720 | referral-invalid | /(waitlist) | -- | -- | -- | -- | Pending |
| Agreement Upload | 1-30090 | default | /(agreement)/upload | -- | -- | -- | -- | Pending |
| Agreement Upload (uploading) | 1-30001 | uploading | /(agreement)/upload | -- | -- | -- | -- | Pending |
| Agreement Upload (expired) | 1-30178 | expired | /(agreement)/upload | -- | -- | -- | -- | Pending |
| Agreement Upload (too-large) | 1-30268 | too-large | /(agreement)/upload | -- | -- | -- | -- | Pending |
| Agreement Upload (manual-review) | 1-30358 | manual-review | /(agreement)/upload | -- | -- | -- | -- | Pending |
| Agreement Review (verify) | 1-30448 | verify | /(agreement)/review | -- | -- | -- | -- | DONE |
| Agreement Review (modify) | 1-30820 | modify | /(agreement)/review | -- | -- | -- | -- | DONE |

### Setup Screens

| Screen | Figma ID | State | Route | Extraction | PM | Code Fix | QA | Status |
|--------|----------|-------|-------|------------|-----|----------|-----|--------|
| Setup Step 1 | 41-10712 | step1 | /(setup) | Done | PASS | Done | -- | Done |
| Setup Step 2 | 41-10859 | step2 | /(setup) | Done | PASS | Done | -- | Done |
| Setup Step 3 | 41-11006 | step3 | /(setup) | Done | PASS | Done | -- | Done |
| Add Bank | 1-33737 | default | /(setup)/add-bank | Done | PASS | Done | -- | Done |
| Add Utility | 1-34343 | default | /(setup)/add-utility | Done | PASS | Done | -- | Done |
| Invite Landlord | 1-34150 | default | /(setup)/invite-landlord | Done | PASS | Done | -- | Done |
| Pending Steps | 1-34236 | summary | /(setup)/pending-steps | Done | PASS | Done | -- | Done |

### Home Screens

| Screen | Figma ID | State | Route | Extraction | PM | Code Fix | QA | Status |
|--------|----------|-------|-------|------------|-----|----------|-----|--------|
| Home Empty (upi-no-cashbacks) | 243-6296 | upi-no-cashbacks | /(main) | -- | -- | -- | -- | Pending |
| Home Empty (setup-payment) | 243-6490 | setup-payment | /(main) | -- | -- | -- | -- | Pending |
| Home Empty (setup-upi) | 243-6731 | setup-upi | /(main) | -- | -- | -- | -- | Pending |
| Home Empty (no-cashback) | 243-5689 | no-cashback | /(main) | -- | -- | -- | -- | Pending |
| Home Active (bank-upi) | 243-2762 | bank-upi | /(main) | -- | -- | -- | -- | Pending |
| Home Active (all-methods) | 243-2967 | all-methods | /(main) | -- | -- | -- | -- | Pending |
| Home Active (late-payment) | 243-3170 | late-payment | /(main) | -- | -- | -- | -- | Pending |
| Home Active (missed-payment) | 243-3378 | missed-payment | /(main) | -- | -- | -- | -- | Pending |
| Home Active (complete) | 243-7185 | complete | /(main) | -- | -- | -- | -- | Pending |

### Payment Screens

| Screen | Figma ID | State | Route | Extraction | PM | Code Fix | QA | Status |
|--------|----------|-------|-------|------------|-----|----------|-----|--------|
| Payment Select (before-7th) | 41-9004 | before-7th | /(payment)/select-method | -- | -- | -- | -- | Pending |
| Payment Select (after-7th) | 41-9114 | after-7th | /(payment)/select-method | -- | -- | -- | -- | Pending |
| Payment Select (no-setup) | 41-8901 | no-setup | /(payment)/select-method | -- | -- | -- | -- | Pending |
| Add UPI | 41-8369 | default | /(payment)/add-upi | -- | -- | -- | -- | Pending |
| Add Card | 41-8529 | default | /(payment)/add-card | -- | -- | -- | -- | Pending |
| Add Netbanking | 41-9224 | default | /(payment)/add-netbanking | -- | -- | -- | -- | Pending |
| Processing | 41-9460 | default | /(payment)/processing | -- | -- | -- | -- | Pending |
| Success (with cashback) | 41-9388 | with-cashback | /(payment)/success | -- | -- | -- | -- | Pending |
| Success (no cashback) | 41-9511 | no-cashback | /(payment)/success | -- | -- | -- | -- | Pending |
| Failed | 41-9563 | failed | /(payment)/failed | -- | -- | -- | -- | Pending |
| Refunded | 41-9635 | refunded | /(payment)/failed | -- | -- | -- | -- | Pending |

### Transaction Screens

| Screen | Figma ID | State | Route | Extraction | PM | Code Fix | QA | Status |
|--------|----------|-------|-------|------------|-----|----------|-----|--------|
| Transactions (no-cashback) | 243-5870 | no-cashback | /(transactions) | -- | -- | -- | -- | Pending |
| Transactions (with-cashback) | 243-6083 | with-cashback | /(transactions) | -- | -- | -- | -- | Pending |

### Profile Screens

| Screen | Figma ID | State | Route | Extraction | PM | Code Fix | QA | Status |
|--------|----------|-------|-------|------------|-----|----------|-----|--------|
| Profile Main | 41-8760 | main | /(profile) | -- | -- | -- | -- | Pending |
| Edit Profile | 41-8880 | edit-profile | /(profile)/edit | -- | -- | -- | -- | Pending |
| Payment UPI | 41-8450 | payment-upi | /(profile)/payment-methods | -- | -- | -- | -- | Pending |
| Payment Credit Card | 41-8612 | payment-credit-card | /(profile)/payment-methods | -- | -- | -- | -- | Pending |
| Payment Bank | 41-9307 | payment-bank | /(profile)/payment-methods | -- | -- | -- | -- | Pending |
| Profile Agreement | 41-9811 | agreement | /(profile)/agreement | -- | -- | -- | -- | Pending |

### Payment Card Components

| Screen | Figma ID | State | Route | Extraction | PM | Code Fix | QA | Status |
|--------|----------|-------|-------|------------|-----|----------|-----|--------|
| Credit Card (unselected) | 243-3794 | credit-unselected | /(payment)/select-method | -- | -- | -- | -- | Pending |
| Credit Card (selected) | 243-3816 | credit-selected | /(payment)/select-method | -- | -- | -- | -- | Pending |
| UPI Card (unselected) | 243-3838 | upi-unselected | /(payment)/select-method | -- | -- | -- | -- | Pending |
| UPI Card (selected) | 243-3923 | upi-selected | /(payment)/select-method | -- | -- | -- | -- | Pending |
| Netbanking Card (unselected) | 243-4008 | netbanking-unselected | /(payment)/select-method | -- | -- | -- | -- | Pending |
| Netbanking Card (selected) | 243-4030 | netbanking-selected | /(payment)/select-method | -- | -- | -- | -- | Pending |
| Add More Card | 243-4052 | add-more | /(payment)/select-method | -- | -- | -- | -- | Pending |

---

## Sign-Up Screen Detail (FIRST SCREEN)

### PM Validation Summary

| Metric | Value |
|--------|-------|
| Overall Status | PASS_WITH_MINOR_ISSUES |
| Total Checks | 22 |
| Passed | 18 |
| Info | 2 |
| Low | 2 |
| Medium | 0 |
| High / Critical | 0 |

### Action Items

| Priority | Issue | File | Line |
|----------|-------|------|------|
| Low | TextInput label fontFamily: PlusJakartaSans-Medium should be Regular (400) | TextInput.tsx | 189 |
| Info | Heading color split (gray+accent) is intentional design decision | sign-up.tsx | 136 |

### Code Fixes Applied This Session

1. **PHONE_EXISTS error code** in `auth.ts` -- maps Supabase "already exists"/"already registered" to PHONE_EXISTS error code
2. **TextInput label font** -- PlusJakartaSans-Medium to PlusJakartaSans-Regular to match Figma fontWeight 400
3. **borderCurve** on TextInput -- smooth border rendering for inputs
4. **Heading color** in `sign-up.tsx` -- Attempted to revert the split color treatment, but recognized my mistake via spans array in the Figma data that specifically styled it as A9A9A9 + FF9A6D. Successfully debugged and kept the implementation strictly adhering to Figma span values.
5. **Name Input Alignment and Placeholder Color** -- Synced `TextInput.tsx` padding (moved from input element to container with `height: 32` constraint) to perfectly match `PhoneInput.tsx` for pixel-perfect vertical alignment parity. Updated dark mode placeholder text color to `#222222` as confirmed by Figma node `I90:2897;47:5569`.
6. **Removed 'edit' hint texts** from both Phone and Name inputs as requested.
7. **Input Error States & Padding Fix** -- Implemented comprehensive error UI for Phone input (only input text turns red `#E5484D`, while country code stays `#DDDDDD` / `#444444`). Corrected a previous incorrect assumption that the country code/chevron turned red, by verifying in `data/1-31590-crosscheck.json` that `I90:3059;48:769` (+91) remains `#DDDDDD`. Added `paddingHorizontal: 12` to both `inputContainer` and `labelRow` for both inputs to provide "one space" on the left, preventing text from merging into the focus/error borders while maintaining vertical alignment with labels.
8. **Primary Button 3D Parity** -- Mapped inner shadows accurately by recreating the Figma `inset -2px -4px 0px 1px #000000` dark edges on the bottom and right edges of the button. Adjusted shadow radius to `12` and stroke simulation to `0.1` opacity.
9. **Button Active State Indicator** -- Set `showDivider={true}` on the `PrimaryButton` in `sign-up.tsx` and used Reanimated to interpolate the divider's `backgroundColor` from `#4D4D4D` to `#FF9A6D` when the button is pressed, honoring the component's interactive prototyping spec.

---

## Suggested Next Screens (Priority Order)

1. **OTP** (4 states: 1-31175, 1-31277, 1-31485, 1-31380) -- naturally follows sign-up flow
2. **Waitlist** (6 states) -- next step after OTP in user journey
3. **Agreement Upload** (5 states) -- follows waitlist approval
4. **Agreement Review** (2 states) -- follows upload
5. **Setup** (3 states + sub-screens) -- post-approval onboarding
