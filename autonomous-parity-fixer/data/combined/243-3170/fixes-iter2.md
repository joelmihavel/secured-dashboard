# Fix Instructions - Iteration 2

## Summary
- Total Issues: 5
- Critical: 1
- Major: 4
- Minor: 0
- Current Parity Score: 65%

## Required Fixes


### 1. Source Code (critical)

**File:** app/home-active.tsx
**Explanation:** The React Native screen code was not provided in the inputs (File not found). Unable to perform pixel-perfect analysis against Figma design. Please ensure the file exists at the expected path.

**Current:**
```
N/A
```

**Fixed:**
```
N/A
```


### 2. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'Due in 10 Days' has textAlignHorizontal: CENTER in Figma but is missing textAlign: 'center' in RN code.

**Current:**
```
<Text ...>Due in 10 Days</Text>
```

**Fixed:**
```
<Text style={{ textAlign: 'center' }} ...>Due in 10 Days</Text>
```


### 3. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Multiple text elements containing 'SELECTED' have textAlignHorizontal: CENTER in Figma but are missing textAlign: 'center' in RN code.

**Current:**
```
<Text ...>SELECTED</Text>
```

**Fixed:**
```
<Text style={{ textAlign: 'center' }} ...>SELECTED</Text>
```


### 4. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'Time' has textAlignHorizontal: CENTER in Figma but is missing textAlign: 'center' in RN code.

**Current:**
```
<Text ...>Time</Text>
```

**Fixed:**
```
<Text style={{ textAlign: 'center' }} ...>Time</Text>
```


### 5. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Several generic Text nodes have textAlignHorizontal: CENTER in Figma but are missing textAlign: 'center' in RN code.

**Current:**
```
<Text ...>...</Text>
```

**Fixed:**
```
<Text style={{ textAlign: 'center' }} ...>...</Text>
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-3170 --verify-only
```
