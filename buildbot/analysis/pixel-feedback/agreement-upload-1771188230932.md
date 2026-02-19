# Pixel-Perfect Feedback Report

**Screen:** Onboarding / Agreement --upload
**Figma ID:** 1-29914
**Route:** /(agreement)/upload
**Generated:** 2026-02-15T20:43:50.931Z

## Summary

| Metric | Value |
|--------|-------|
| Total Issues | 3 |
| Critical | 0 |
| Major | 2 |
| Minor | 1 |
| Files Affected | 2 |

## Batch 0: Structural Analysis (Deterministic)

These issues were detected by analyzing Figma data directly - **visual comparison cannot catch these**:

## Consolidated Fixes

### Major Issues

- **typography** in `src/components/ErrorBoundary.tsx`: The title uses hardcoded typography values that differ from the provided design tokens. The 'h4' token (28px) should be used instead of 24px to align with the design system.
  - Fix: `  title: {
    fontSize: 28, // typography.h4
    lineHeight: 40, // typography.h4
    fontWeight: '400', // typography.h4
    color: '#FFFFFF',
    marginBottom: 12,
  },`
- **color** in `UploadScreen.tsx`: The text color for the title is rendered as gray (#A9A9A9) but should be White (#FFFFFF) according to Figma.
  - Fix: `  titleGray: {
    ...FIGMA.typography.title,
    color: colors.neutral.white,
  },`

### Minor Issues

- **opacity** in `UploadScreen.tsx`: The background pattern opacity constant is defined but not passed to the component.