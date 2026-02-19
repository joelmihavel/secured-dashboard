# Pixel-Perfect Feedback Report

**Screen:** Pay Rent / Transaction Page --with cashback
**Figma ID:** 41-8695
**Route:** /(transactions)/[id]
**Generated:** 2026-02-15T21:00:18.419Z

## Summary

| Metric | Value |
|--------|-------|
| Total Issues | 9 |
| Critical | 2 |
| Major | 4 |
| Minor | 3 |
| Files Affected | 2 |

## Batch 0: Structural Analysis (Deterministic)

These issues were detected by analyzing Figma data directly - **visual comparison cannot catch these**:

## Consolidated Fixes

### Critical Issues (Fix Immediately)

#### button in `src/components/ErrorBoundary.tsx`
**Lines:** 80-85
**Problem:** Convert solid button to text link style to match design.
**Figma:** Text Link (No Background) | **Current:** Solid Orange Button

```typescript
// Before:
  button: {
    backgroundColor: '#FF9A6D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

// After:
  button: {
    marginTop: 12,
    padding: 12,
  },
```

#### buttonText in `src/components/ErrorBoundary.tsx`
**Lines:** 86-90
**Problem:** Update button text color to standard link blue.
**Figma:** Blue (#007AFF) | **Current:** Black (#000000)

```typescript
// Before:
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },

// After:
  buttonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
```

### Major Issues

- **iconName** in `TransactionDetailScreen.tsx`: Use correct icon for receipt breakdown rows.
  - Fix: `    <Ionicons
      name="hashtag"
      size={16}
      color={FIGMA_COLORS.rowIconFill}
    />`
- **notchStyles** in `TransactionDetailScreen.tsx`: Update receipt notch size, radius, and vertical position to match Figma layout.
  - Fix: `    width: 20.5,
    height: 20.5,
    borderRadius: 10.25,
    position: 'absolute',
    top: '46%',`
- **container** in `src/components/ErrorBoundary.tsx`: Update background color to pure black.
  - Fix: `  container: {
    flex: 1,
    backgroundColor: colors.neutral.black,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },`
- **title** in `src/components/ErrorBoundary.tsx`: Increase title size and weight.
  - Fix: `  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },`

### Minor Issues

- **notchOffsets** in `TransactionDetailScreen.tsx`: Adjust notch horizontal offsets to be exactly half the width.
- **message** in `src/components/ErrorBoundary.tsx`: Increase message font size and adjust color.
- **paddingBottom** in `TransactionDetailScreen.tsx`: Increase bottom padding to 48px (spacing.xxxl).