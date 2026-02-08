# Fix Instructions - Iteration 1

## Summary
- Total Issues: 2
- Critical: 1
- Major: 1
- Minor: 0
- Current Parity Score: 80%

## Required Fixes


### 1. Screen Structure (critical)

**File:** app/(home-active)/index.tsx
**Explanation:** The screen file is missing or incomplete. Implement the base structure matching Figma node 243:2762 using correct design tokens for background, header, carousel, and bottom bar.

**Current:**
```
// File missing or empty
```

**Fixed:**
```
import { View, ScrollView } from 'react-native';
import { colors, spacing } from '@/constants/tokens';

export default function HomeActiveScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.black[700] }}>
      {/* Header: Height 157px */}
      <View style={{ height: 157 }} />

      <ScrollView>
        {/* Carousel: PaddingLeft 64px, Gap 16px */}
        <ScrollView horizontal contentContainerStyle={{ paddingLeft: spacing.huge, gap: spacing.md }}>
          {/* Cards */}
        </ScrollView>
      </ScrollView>

      {/* Bottom Action Bar: Height 118px, Bg #202020 */}
      <View style={{ height: 118, backgroundColor: colors.black[500] }} />
    </View>
  );
}
```


### 2. textAlign (major)

**File:** app/(home-active)/index.tsx
**Explanation:** Structural analysis detected 7 text nodes ('SELECTED', 'Due in 10 Days', 'Time', and generic Text) that are centered in Figma but missing `textAlign: 'center'` in code. This is critical for the Segmented Control/Toggle and Status labels.

**Current:**
```
style={{ ... }} // Missing textAlign
```

**Fixed:**
```
style={{ textAlign: 'center', ... }}
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-3170 --verify-only
```
