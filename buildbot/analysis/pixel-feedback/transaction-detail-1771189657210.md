# Pixel-Perfect Feedback Report

**Screen:** Pay Rent / Transaction Page --with cashback
**Figma ID:** 41-8695
**Route:** /(transactions)/[id]
**Generated:** 2026-02-15T21:07:37.209Z

## Summary

| Metric | Value |
|--------|-------|
| Total Issues | 8 |
| Critical | 0 |
| Major | 5 |
| Minor | 2 |
| Files Affected | 2 |

## Batch 0: Structural Analysis (Deterministic)

These issues were detected by analyzing Figma data directly - **visual comparison cannot catch these**:

## Consolidated Fixes

### Major Issues

- **typography** in `src/components/ErrorBoundary.tsx`: Update title typography to match design token typography.h4.
  - Fix: `    fontSize: 28,
    lineHeight: 40,
    fontWeight: '400',`
- **children** in `TransactionDetailScreen.tsx`: Remove the divider between 'Base rent' and 'Maintenance' to match the contiguous block design in Figma.
  - Fix: `              <BreakdownRow
                label="Base rent"
                value={formatRupees(baseRent)}
              />
              {/* Divider removed */}
              <BreakdownRow`
- **top** in `TransactionDetailScreen.tsx`: Fix left notch positioning to align with the section divider (approx 96px from top of container).
  - Fix: `    left: -7,
    top: 96,
  },`
- **top** in `TransactionDetailScreen.tsx`: Fix right notch positioning to align with the section divider (approx 96px from top of container).
  - Fix: `    right: -7,
    top: 96,
  },`
- **gap** in `TransactionDetailScreen.tsx`: Increase gap in summary header to 16px (spacing.md) to match Figma.
  - Fix: `  summaryHeaderSection: {
    alignItems: 'center',
    gap: 16,
  },`

### Minor Issues

- **marginTop** in `TransactionDetailScreen.tsx`: Increase top margin to 16px (spacing.md) to achieve the correct visual separation for the pill.
- **paddingVertical** in `TransactionDetailScreen.tsx`: Increase vertical padding of receipt section to 24px (spacing.lg) to match the summary card style.