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
**Explanation:** The React Native screen code file was not provided in the input, making it impossible to compare the current implementation against the Figma design. Please provide the source code to proceed with the analysis.

**Current:**
```
// Screen file not found
```

**Fixed:**
```
// Code required for analysis
```


### 2. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Multiple 'SELECTED' text elements have textAlignHorizontal: CENTER in Figma but lack 'textAlign: center' in RN code. This likely affects a tab or segment control component.

**Current:**
```
// Look for Text containing 'SELECTED'
<Text>SELECTED</Text>
```

**Fixed:**
```
<Text style={{ textAlign: 'center' }}>SELECTED</Text>
```


### 3. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'Due in 10 Days' has textAlignHorizontal: CENTER in Figma but lacks 'textAlign: center' in RN code.

**Current:**
```
// Look for Text containing 'Due in 10 Days'
<Text>Due in 10 Days</Text>
```

**Fixed:**
```
<Text style={{ textAlign: 'center' }}>Due in 10 Days</Text>
```


### 4. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Text 'Time' has textAlignHorizontal: CENTER in Figma but lacks 'textAlign: center' in RN code.

**Current:**
```
// Look for Text containing 'Time'
<Text>Time</Text>
```

**Fixed:**
```
<Text style={{ textAlign: 'center' }}>Time</Text>
```


### 5. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Generic Text elements identified by structural analysis (Node I243:2906, I243:2956) require centered alignment.

**Current:**
```
// Look for other centered text elements
<Text>...</Text>
```

**Fixed:**
```
<Text style={{ textAlign: 'center' }}>...</Text>
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-3378 --verify-only
```
