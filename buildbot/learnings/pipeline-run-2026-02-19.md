# BuildBot Pipeline Run - Feb 19, 2026

## Summary
Full pipeline run across entire Figma design file (HZaVuwWn6B6jOjrmxZ7Kzv).
- 79 blueprints extracted from Figma REST API
- 33 screen files fixed across 7 flows
- 18 shared home components updated
- 193 total pixel-perfect fixes applied
- All screen files compile cleanly (0 new TS errors)

## Flows Completed
1. **Auth Flow** (splash, beta-splash, carousel, sign-up, OTP) - 25 fixes
2. **Agreement Flow** (upload, review) - 15 fixes
3. **Onboarding Flow** (setup steps, add-bank, add-utility, invite-landlord, pending-steps) - 31 fixes
4. **Waitlist Flow** (index, approved) - 18 fixes
5. **Payment Flow** (select-method, add-upi, add-card, add-netbanking, success, processing, failed) - 37 fixes
6. **Profile Flow** (index, edit, payment-methods, agreement) - 20 fixes
7. **Home Flow** (main index + 18 sub-components) - 35 fixes
8. **Transactions Flow** (index, [id]) - 12 fixes

## Top Recurring Issues Found
1. **fontWeight vs fontFamily** (ALL screens) - Every screen had `fontWeight` style properties that should use `fontFamily` instead (400→PlusJakartaSans-Regular, 500→Medium, 600→SemiBold)
2. **Double padding** (8 screens) - Screen component adds padding, then screen code adds more
3. **Title color: white vs gray** (5 screens) - "Add your" text was white (#FFFFFF) but should be gray (#A9A9A9) per Figma spans
4. **Nested Text missing `inherit`** (4 screens) - Child Text components need `inherit` prop to inherit parent styles
5. **FILL sizing as width:'100%'** (3 screens) - Should be `flex: 1` per builder rules
6. **textAlign mismatch** (3 screens) - Left-aligned in Figma but centered in code
7. **Unused imports** (ALL screens) - scaling functions, unused theme tokens
8. **Gap vs margin** (6 screens) - Manual margins where Figma uses auto-layout gap

## Component-Level Issues Found
- **TextInput label font** - Was Regular (400), should be Medium (500) per Figma
- **TabSwitcher shape** - Was pill (radius 200), should be rounded rectangle (radius 4) with gradient
- **ScreenTitle documentation** - Docblock example showed white where gray is correct
- **PaymentMethodCard** - Missing explicit fontFamily on decorative text elements

## Pipeline Performance
- Extraction: ~30s per screen (79 screens = ~40min total, parallelized in 5 batches)
- Building: 16 parallel builder agents completed in ~25min
- Total wall-clock time: ~45 minutes for full pipeline run

## Notes for Future Runs
- Test files have pre-existing discriminated union type errors that should be fixed separately
- `useScreenshotParams.ts` has a pre-existing import error
- Home screen is the most complex (188 nodes, 25+ states) - needs dedicated agent
- Payment add-netbanking was completely wrong (was card confirmation, should be bank form)
