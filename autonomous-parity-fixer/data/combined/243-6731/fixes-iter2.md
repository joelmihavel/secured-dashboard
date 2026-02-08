# Fix Instructions - Iteration 2

## Summary
- Total Issues: 2
- Critical: 1
- Major: 1
- Minor: 0
- Current Parity Score: 80%

## Required Fixes


### 1. backgroundColor (critical)

**File:** app/(home-empty)/index.tsx
**Explanation:** Ensure root view background is #131313 and footer background is #202020 as per Figma specs.

**Current:**
```
// Check root container and footer styles
```

**Fixed:**
```
backgroundColor: colors.black[700], // Root #131313
backgroundColor: colors.black[500], // Footer #202020
```


### 2. textAlign (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** Multiple text elements ('SELECTED', 'All-time Total', 'Cashback Rate', 'Due in 28 Days', 'Time') have textAlignHorizontal: CENTER in Figma but lack explicit textAlign in RN.

**Current:**
```
<Text ...>All-time Total</Text>
<Text ...>SELECTED</Text>
```

**Fixed:**
```
<Text style={[..., { textAlign: 'center' }]}>All-time Total</Text>
<Text style={[..., { textAlign: 'center' }]}>SELECTED</Text>
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-6731 --verify-only
```
