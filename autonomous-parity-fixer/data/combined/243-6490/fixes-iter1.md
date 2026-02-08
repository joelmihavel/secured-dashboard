# Fix Instructions - Iteration 1

## Summary
- Total Issues: 4
- Critical: 1
- Major: 3
- Minor: 0
- Current Parity Score: 70%

## Required Fixes


### 1. structure (critical)

**File:** app/(home-empty)/index.tsx
**Explanation:** Initialize screen with correct root background color and structure (Header, ScrollView, Footer).

**Current:**
```
null
```

**Fixed:**
```
export default function HomeEmpty() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.black[700] }}>
      <Header />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: 150 }}>
        {/* Content */}
      </ScrollView>
      <Footer />
    </View>
  );
}
```


### 2. textAlign (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** Multiple text elements in the dashboard stats section ('All-time Total', 'Cashback Rate', 'Due in 28 Days', 'Time' and their values) are centered in Figma but missing explicit text alignment in code.

**Current:**
```
<Text>All-time Total</Text>
```

**Fixed:**
```
<Text style={{ textAlign: 'center' }}>All-time Total</Text>
```


### 3. horizontalListLayout (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** The 'Paying with' horizontal card list requires specific content insets and gap.

**Current:**
```
<ScrollView horizontal>...</ScrollView>
```

**Fixed:**
```
<ScrollView 
  horizontal 
  contentContainerStyle={{ 
    paddingLeft: spacing.huge, // 64
    paddingRight: spacing.xl, // 32
    gap: spacing.md // 16
  }}
>...</ScrollView>
```


### 4. footerLayout (major)

**File:** app/(home-empty)/index.tsx
**Explanation:** Footer requires specific dimensions and padding tokens.

**Current:**
```
style={{...}}
```

**Fixed:**
```
style={{
  height: 118,
  paddingHorizontal: spacing.xl, // 32
  paddingBottom: spacing.xxl, // 40
  paddingTop: spacing.md, // 16
  backgroundColor: colors.black[500] // #202020
}}
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-6490 --verify-only
```
