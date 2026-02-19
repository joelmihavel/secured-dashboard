# Pixel-Perfect Feedback Report

**Screen:** Onboarding / Agreement --upload
**Figma ID:** 1-29914
**Route:** /(agreement)/upload
**Generated:** 2026-02-15T21:08:15.336Z

## Summary

| Metric | Value |
|--------|-------|
| Total Issues | 8 |
| Critical | 0 |
| Major | 3 |
| Minor | 5 |
| Files Affected | 2 |

## Batch 0: Structural Analysis (Deterministic)

These issues were detected by analyzing Figma data directly - **visual comparison cannot catch these**:

## Consolidated Fixes

### Major Issues

- **navigationOptions** in `UploadScreen.tsx`: The design shows no navigation header, but the simulator shows a back button. Hide the header.
  - Fix: `<Stack.Screen options={{ headerShown: false }} />`
- **color** in `UploadScreen.tsx`: The text 'One' should be White according to Figma, currently rendered as Gray.
  - Fix: `titleGray: colors.neutral[white],`
- **typography** in `src/components/ErrorBoundary.tsx`: Title typography mismatch. Update to use the correct design token.
  - Fix: `...typography.h4,`

### Minor Issues

- **backgroundPattern** in `UploadScreen.tsx`: Ensure the background pattern extends to the top of the screen behind the status bar.
- **backgroundColor** in `src/components/ErrorBoundary.tsx`: Use design token for background color.
- **color** in `src/components/ErrorBoundary.tsx`: Use design token for text color.
- **backgroundColor** in `src/components/ErrorBoundary.tsx`: Use design token for button background.
- **borderRadius** in `src/components/ErrorBoundary.tsx`: Use design token for border radius.