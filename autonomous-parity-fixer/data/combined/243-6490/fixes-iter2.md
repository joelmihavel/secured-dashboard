# Fix Instructions - Iteration 2

## Summary
- Total Issues: 6
- Critical: 1
- Major: 4
- Minor: 1
- Current Parity Score: 64%

## Required Fixes


### 1. Screen Structure & Background (critical)

**File:** app/(home-empty)/index.tsx
**Explanation:** Ensure the screen root has the correct dark background color and flex layout.

**Current:**
```
backgroundColor: '...'
```

**Fixed:**
```
flex: 1,
backgroundColor: colors.black[700], // #131313
```


### 2. Text Alignment (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** Multiple text elements (Stats, Labels, 'All-time Total', 'Cashback Rate') are centered in Figma but missing 'textAlign: center' in RN. This affects 9 identified nodes.

**Current:**
```
style={{ ... }}
```

**Fixed:**
```
textAlign: 'center'
```


### 3. Cards Section Layout (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** The payment cards section requires a horizontal ScrollView with specific content padding and gap.

**Current:**
```
<View>...</View>
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


### 4. Bottom Footer (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** The review section must be absolutely positioned at the bottom with specific styling.

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
height: 118,
backgroundColor: colors.black[500], // #202020
paddingHorizontal: spacing.xl, // 32
paddingBottom: spacing.xxl, // 40
paddingTop: spacing.md // 16
```


### 5. Gradient Buttons (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** 'Review' and '+ Add Payment' buttons require LinearGradient and specific shadow properties.

**Current:**
```
backgroundColor: '...'
```

**Fixed:**
```
<LinearGradient 
  colors={['#FFCC8A', '#FFAE8A']} // Example brand colors
  style={{
    shadowColor: '#995C41',
    shadowOffset: {width: 0, height: 6},
    shadowRadius: 12,
    shadowOpacity: 1
  }}
>
```


### 6. Header Spacing (minor)

**File:** app/(home-empty)/index.tsx
**Explanation:** Header section requires specific padding.

**Current:**
```
padding: ...
```

**Fixed:**
```
paddingHorizontal: spacing.xl, // 32
paddingVertical: spacing.lg // 24
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-6490 --verify-only
```
