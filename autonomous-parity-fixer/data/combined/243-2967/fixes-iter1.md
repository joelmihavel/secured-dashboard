# Fix Instructions - Iteration 1

## Summary
- Total Issues: 4
- Critical: 1
- Major: 3
- Minor: 0
- Current Parity Score: 70%

## Required Fixes


### 1. rootLayout (critical)

**File:** app/(home-active)/index.tsx
**Explanation:** The screen requires a specific root layout structure with dark background and fixed header/footer areas. Note: Structural analysis detected content, so integrate this layout around existing content.

**Current:**
```
// Root View
```

**Fixed:**
```
<View style={{ flex: 1, backgroundColor: colors.black[700] }}>
  <Header style={{ height: 157 }} />
  <ScrollView contentContainerStyle={{ paddingBottom: 140, gap: spacing.lg }}>
    {/* Existing Content */}
  </ScrollView>
  <Footer style={{ height: 118, position: 'absolute', bottom: 0 }} />
</View>
```


### 2. horizontalScroll (major)

**File:** app/(home-active)/index.tsx
**Explanation:** The payment cards section requires a horizontal ScrollView with specific spacing tokens.

**Current:**
```
<ScrollView horizontal ...>
```

**Fixed:**
```
<ScrollView 
  horizontal 
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{ 
    paddingLeft: spacing.huge, // 64
    paddingRight: spacing.xl, // 32
    gap: spacing.md // 16
  }}
>
```


### 3. footerStyle (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Footer must be docked bottom with specific styling.

**Current:**
```
style={{ ... }}
```

**Fixed:**
```
style={{ 
  position: 'absolute', 
  bottom: 0, 
  width: '100%', 
  height: 118, 
  backgroundColor: colors.black[500], // #202020
  paddingHorizontal: spacing.xl, // 32
  flexDirection: 'row', 
  alignItems: 'center', 
  justifyContent: 'space-between' 
}}
```


### 4. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Multiple text elements (including 'SELECTED', 'Due in 10 Days', 'Time') are centered in Figma but lack explicit alignment in RN.

**Current:**
```
style={{ ... }}
```

**Fixed:**
```
textAlign: 'center'
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-2967 --verify-only
```
