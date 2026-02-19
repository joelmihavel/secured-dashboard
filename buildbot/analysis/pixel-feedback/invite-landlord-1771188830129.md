# Pixel-Perfect Feedback Report

**Screen:** Onboarding / Invite Landlord
**Figma ID:** 1-31671
**Route:** /(setup)/invite-landlord
**Generated:** 2026-02-15T20:53:50.128Z

## Summary

| Metric | Value |
|--------|-------|
| Total Issues | 7 |
| Critical | 0 |
| Major | 5 |
| Minor | 2 |
| Files Affected | 2 |

## Batch 0: Structural Analysis (Deterministic)

These issues were detected by analyzing Figma data directly - **visual comparison cannot catch these**:

## Consolidated Fixes

### Major Issues

- **Progress Bar** in `app/(waitlist)/index.tsx`: The progress bar is not present in the Figma design for this screen and should be removed.
  - Fix: `{/* Progress Bar removed to match Figma */}`
- **backgroundColor** in `app/(waitlist)/index.tsx`: The input fields require a dark background (#202020) to be visible against the screen background.
  - Fix: `  inputContainer: {
    width: scaled(FIGMA.dimensions.inputWidth), // 297px
    height: scaled(FIGMA.dimensions.inputHeight), // 64px
    backgroundColor: '#202020', // colors.black[500]
    borderRadius: scaled(FIGMA.dimensions.inputRadius), // 12px
    paddingVertical: scaledSpacing(16),`
- **Footer Toggle** in `app/(waitlist)/index.tsx`: The footer requires a Toggle Switch component alongside the consent text to match the design.
  - Fix: `            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <Switch trackColor={{ false: '#444444', true: '#FF9A6D' }} thumbColor={'#FFFFFF'} />
              <Text style={[styles.footerText, { flex: 1 }]}>
                I consent to a one-time verification to confirm my profile details. Verification is securely handled via{' '}
                <Text style={{ fontFamily: 'PlusJakartaSans-Medium', color: '#EEEEEE', textDecorationLine: 'underline' }}>Cashfree</Text>
              </Text>
            </View>`
- **Typography (Title)** in `app/(waitlist)/index.tsx`: Fix title font size inheritance issues by applying styles directly to nested Text components, and correct the color to White.
  - Fix: `            <Text style={styles.title}>
              <Text style={[styles.title, { color: '#FFFFFF' }]}>{"Let's get to "}</Text>
              {'\n'}
              <Text style={[styles.title, styles.titleAccent]}>know you</Text>
            </Text>`
- **titleStyle** in `ErrorBoundary.tsx`: Update ErrorBoundary title to match design system H4 style (28px, Regular).
  - Fix: `    fontSize: 28,
    lineHeight: 40,
    fontWeight: '400',`

### Minor Issues

- **marginBottom** in `app/(waitlist)/index.tsx`: Increase spacing between header and title to 48px.
- **borderRadius** in `ErrorBoundary.tsx`: Update button border radius to 12px to match design tokens.