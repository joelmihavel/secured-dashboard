# Fix Instructions - Iteration 1

## Summary
- Total Issues: 8
- Critical: 1
- Major: 7
- Minor: 0
- Current Parity Score: 50%

## Required Fixes


### 1. file_creation (critical)

**File:** app/(home-active)/index.tsx
**Explanation:** Create missing screen 'Home --active'. This fix consolidates the missing file issue (Batch 2) and 7 structural text alignment issues (Batch 0). Requirements: 1. Background colors.black[700]. 2. Header (157px). 3. Horizontal ScrollView (paddingLeft: 64). 4. Bottom Bar colors.black[500]. 5. Center alignment for text elements ('Due in 10 Days', 'Time', 'SELECTED').

**Current:**
```
null
```

**Fixed:**
```
import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { colors, typography, spacing } from '../../constants/tokens';

export default function HomeActiveScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header - 157px height */}
      <View style={styles.header}>
        {/* Header content placeholder */}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Horizontal Cards - 64px left padding */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsContainer}
        >
          {/* Card Placeholder - Addressing Structural Alignment Issues */}
          <View style={styles.card}>
            <Text style={styles.cardText}>Due in 10 Days</Text>
            <Text style={styles.cardTime}>Time</Text>
          </View>
          <View style={styles.card}>
             <Text style={styles.cardText}>SELECTED</Text>
          </View>
        </ScrollView>

        {/* Recent Payments */}
        <View style={styles.section}>
           <Text style={styles.sectionTitle}>Recent Payments</Text>
           {/* List items */}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {/* Actions */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black[700], // #131313
  },
  header: {
    height: 157,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  cardsContainer: {
    paddingLeft: spacing.huge, // 64px
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.black[600],
    padding: spacing.md,
    borderRadius: 16,
    width: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    ...typography.bodySm,
    color: colors.neutral[400],
    textAlign: 'center', // Fix for Node 243:2954, 243:2776
  },
  cardTime: {
    ...typography.bodySm,
    color: colors.neutral[600],
    textAlign: 'center', // Fix for Node I243:2959
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h6,
    color: colors.neutral.white,
    marginBottom: spacing.md,
  },
  bottomBar: {
    height: 80,
    backgroundColor: colors.black[500], // #202020
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  }
});
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-7185 --verify-only
```
