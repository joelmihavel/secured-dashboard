# Fix Instructions - Iteration 1

## Summary
- Total Issues: 3
- Critical: 1
- Major: 2
- Minor: 0
- Current Parity Score: 75%

## Required Fixes


### 1. Screen Structure (critical)

**File:** app/(home-active)/index.tsx
**Explanation:** The screen requires a specific layout structure: Root background 'colors.black[700]', Absolute Header (zIndex: 10), Absolute Bottom Bar (zIndex: 10), and a ScrollView with content padding to prevent overlap.

**Current:**
```
// Existing code or missing file
```

**Fixed:**
```
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black[700], // #131313
  },
  header: {
    position: 'absolute',
    top: 0,
    zIndex: 10,
    height: 157,
    width: '100%',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    zIndex: 10,
    height: 118,
    width: '100%',
  },
  scrollContent: {
    paddingTop: 157,
    paddingBottom: 118,
  }
});
```


### 2. paddingHorizontal (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Apply strict horizontal paddings: Header & List Sections = 32px (spacing.xl), Top Text = 64px (spacing.huge), Horizontal Card Scroll = 64px left / 32px right.

**Current:**
```
paddingHorizontal: 20
```

**Fixed:**
```
paddingHorizontal: spacing.xl, // 32px
// For Top Text:
paddingHorizontal: spacing.huge, // 64px
```


### 3. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Multiple text elements (including 'Due in 10 Days', 'Time', and selected state labels) are centered in Figma but missing the style in RN.

**Current:**
```
style={{ ... }}
```

**Fixed:**
```
style={{ ..., textAlign: 'center' }}
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-2762 --verify-only
```
