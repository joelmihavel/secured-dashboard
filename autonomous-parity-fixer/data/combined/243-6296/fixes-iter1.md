# Fix Instructions - Iteration 1

## Summary
- Total Issues: 5
- Critical: 1
- Major: 4
- Minor: 0
- Current Parity Score: 65%

## Required Fixes


### 1. File Existence (critical)

**File:** app/(home-empty)/index.tsx
**Explanation:** The screen file is missing. Create the file to serve as the entry point for the Home Empty state.

**Current:**
```
N/A
```

**Fixed:**
```
import { View, ScrollView, Text, FlatList } from 'react-native';
import { Stack } from 'expo-router';

export default function HomeEmptyScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#131313' }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Content will go here */}
    </View>
  );
}
```


### 2. Root Layout & Header (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** Implement root background color using token colors.black[700] and a custom header container of height 157px.

**Current:**
```
N/A
```

**Fixed:**
```
<View style={{ flex: 1, backgroundColor: colors.black[700] }}>
  <View style={{ height: 157, paddingTop: 60 /* StatusBar */, paddingHorizontal: 32 }}>
    {/* Header Content: Hi, Rishabh */}
  </View>
  {/* ... */}
</View>
```


### 3. Main ScrollView & Horizontal List (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** Implement main ScrollView with spacing.lg (24px) gap. Implement Horizontal Card List with spacing.huge (64px) left padding and spacing.xl (32px) right padding.

**Current:**
```
N/A
```

**Fixed:**
```
<ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: 120 }}>
  {/* Title Section */}
  <FlatList 
    horizontal 
    contentContainerStyle={{ paddingLeft: spacing.huge, paddingRight: spacing.xl, gap: spacing.md }}
    data={[]} 
    renderItem={() => <View style={{ width: 270 }} />}
  />
</ScrollView>
```


### 4. Footer & Text Alignment (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** Implement fixed footer (height 118px, bg colors.black[500]). CRITICAL: Ensure 'Due in 28 Days', 'All-time Total', and 'Cashback Rate' text elements have textAlign: 'center' as detected in structural analysis.

**Current:**
```
N/A
```

**Fixed:**
```
<View style={{ position: 'absolute', bottom: 0, width: '100%', height: 118, backgroundColor: colors.black[500], paddingHorizontal: spacing.xl }}>
  <Text style={{ textAlign: 'center', color: colors.neutral[300] }}>Due in 28 Days</Text>
  {/* Review Button */}
</View>
```


### 5. Stats Text Alignment (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** Structural analysis detected 'All-time Total', 'Cashback Rate', and 'Time' text nodes are centered in Figma. Apply textAlign: 'center' to these elements in the main body.

**Current:**
```
N/A
```

**Fixed:**
```
<Text style={{ textAlign: 'center', ...typography.bodySm }}>All-time Total</Text>
<Text style={{ textAlign: 'center', ...typography.h4 }}>$0.00</Text>
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-6296 --verify-only
```
