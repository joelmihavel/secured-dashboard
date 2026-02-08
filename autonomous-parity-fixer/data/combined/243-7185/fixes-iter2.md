# Fix Instructions - Iteration 2

## Summary
- Total Issues: 8
- Critical: 1
- Major: 7
- Minor: 0
- Current Parity Score: 50%

## Required Fixes


### 1. Source Code (critical)

**File:** app/home-active.tsx
**Explanation:** The React Native screen code was not provided in the input. Unable to perform pixel-perfect analysis or provide specific line numbers for fixes.

**Current:**
```
// Screen file not found
```

**Fixed:**
```
// Please ensure app/home-active.tsx or app/(home-active)/index.tsx is accessible
```


### 2. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'SELECTED' (Node 243:2776) is centered in Figma but missing textAlign: 'center' in RN.

**Current:**
```
Code context unavailable
```

**Fixed:**
```
textAlign: 'center' // Add to style
```


### 3. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'SELECTED' (Node 243:2861) is centered in Figma but missing textAlign: 'center' in RN.

**Current:**
```
Code context unavailable
```

**Fixed:**
```
textAlign: 'center' // Add to style
```


### 4. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'SELECTED' (Node 243:2883) is centered in Figma but missing textAlign: 'center' in RN.

**Current:**
```
Code context unavailable
```

**Fixed:**
```
textAlign: 'center' // Add to style
```


### 5. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text element (Node I243:2906) is centered in Figma but missing textAlign: 'center' in RN.

**Current:**
```
Code context unavailable
```

**Fixed:**
```
textAlign: 'center' // Add to style
```


### 6. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'Due in 10 Days' (Node 243:2954) is centered in Figma but missing textAlign: 'center' in RN.

**Current:**
```
Code context unavailable
```

**Fixed:**
```
textAlign: 'center' // Add to style
```


### 7. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text element (Node I243:2956) is centered in Figma but missing textAlign: 'center' in RN.

**Current:**
```
Code context unavailable
```

**Fixed:**
```
textAlign: 'center' // Add to style
```


### 8. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'Time' (Node I243:2959) is centered in Figma but missing textAlign: 'center' in RN.

**Current:**
```
Code context unavailable
```

**Fixed:**
```
textAlign: 'center' // Add to style
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-7185 --verify-only
```
