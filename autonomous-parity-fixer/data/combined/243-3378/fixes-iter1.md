# Fix Instructions - Iteration 1

## Summary
- Total Issues: 6
- Critical: 1
- Major: 5
- Minor: 0
- Current Parity Score: 60%

## Required Fixes


### 1. backgroundColor (critical)

**File:** app/(home-active)/index.tsx
**Explanation:** Root screen background must be #131313 to match Figma root frame.

**Current:**
```
N/A
```

**Fixed:**
```
backgroundColor: colors.black[700]
```


### 2. position (major)

**File:** app/(home-active)/index.tsx
**Explanation:** The Bottom Action Bar ('Review & pay') is pinned to the bottom in Figma. It requires absolute positioning.

**Current:**
```
N/A
```

**Fixed:**
```
position: 'absolute',
bottom: 0,
left: 0,
right: 0,
```


### 3. contentContainerStyle (major)

**File:** app/(home-active)/index.tsx
**Explanation:** The Payment Cards List (horizontal ScrollView) requires specific padding and gap to match design.

**Current:**
```
N/A
```

**Fixed:**
```
contentContainerStyle={{ paddingLeft: spacing.huge, gap: spacing.md }}
```


### 4. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Multiple instances of text 'SELECTED' have textAlignHorizontal: CENTER in Figma but missing textAlign in RN.

**Current:**
```
N/A
```

**Fixed:**
```
textAlign: 'center'
```


### 5. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'Due in 10 Days' has textAlignHorizontal: CENTER in Figma but missing textAlign in RN.

**Current:**
```
N/A
```

**Fixed:**
```
textAlign: 'center'
```


### 6. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'Time' has textAlignHorizontal: CENTER in Figma but missing textAlign in RN.

**Current:**
```
N/A
```

**Fixed:**
```
textAlign: 'center'
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-3378 --verify-only
```
