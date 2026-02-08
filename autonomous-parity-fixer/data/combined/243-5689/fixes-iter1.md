# Fix Instructions - Iteration 1

## Summary
- Total Issues: 10
- Critical: 1
- Major: 9
- Minor: 0
- Current Parity Score: 40%

## Required Fixes


### 1. Screen Layout (critical)

**File:** app/(home-empty)/index.tsx
**Explanation:** Implement missing screen structure based on Figma. Requires specific background colors, spacing, and footer positioning using design tokens.

**Current:**
```
null
```

**Fixed:**
```
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black[700], // #131313
  },
  header: {
    height: 157,
    paddingHorizontal: spacing.xl, // 32
  },
  scrollContent: {
    gap: spacing.lg, // 24
    paddingBottom: spacing.xxxl, // 48
  },
  horizontalList: {
    paddingLeft: spacing.huge, // 64
    paddingRight: spacing.xl, // 32
    gap: spacing.md, // 16
  },
  footer: {
    height: 118,
    backgroundColor: colors.black[500], // #202020
    position: 'absolute',
    bottom: 0,
    width: '100%',
  }
});
```


### 2. textAlign (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** Structural mismatch: The following text elements have `textAlignHorizontal: CENTER` in Figma but are missing `textAlign: 'center'` in code: 'SELECTED', 'All-time Total', 'Cashback Rate', 'Due in 28 Days', 'Time', and their values.

**Current:**
```
style={{ ... }}
```

**Fixed:**
```
style={{ textAlign: 'center' }}
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-5689 --verify-only
```
