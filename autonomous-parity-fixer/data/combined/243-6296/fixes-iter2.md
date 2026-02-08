# Fix Instructions - Iteration 2

## Summary
- Total Issues: 10
- Critical: 10
- Major: 0
- Minor: 0
- Current Parity Score: 0%

## Required Fixes


### 1. Entire File (critical)

**File:** app/(home-empty)/index.tsx
**Explanation:** Generated complete screen implementation based on Figma design. This includes 9 critical structural fixes for text alignment (textAlign: 'center' on stats, toggles, and footer labels) and applies correct design tokens for colors and typography.

**Current:**
```
// File not found
```

**Fixed:**
```
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function HomeEmptyScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <View style={styles.logoPlaceholder} />
            <Text style={styles.greetingText}>Hi, Rishabh</Text>
          </View>
          <View style={styles.profileImage} />
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.rentSection}>
          <Text style={styles.rentText}>Your rent is due\nin 10 days</Text>
          <Text style={styles.payingWithText}>Paying with:</Text>
        </View>

        <View style={styles.carouselContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            decelerationRate="fast"
            snapToInterval={270 + 16}
          >
            {/* Placeholders for Cards - Replace with actual components */}
            <View style={styles.cardPlaceholder} />
            <View style={styles.cardPlaceholder} />
            <View style={styles.cardPlaceholder} />
          </ScrollView>
        </View>

        <View style={styles.toggleSection}>
          <View style={styles.toggleContainer}>
            <View style={styles.toggleButton}>
              <Text style={styles.toggleTextInactive}>Recent Payments</Text>
            </View>
            <View style={[styles.toggleButton, styles.toggleActive]}>
              <Text style={styles.toggleTextActive}>Cashbacks</Text>
            </View>
          </View>
        </View>

        <View style={styles.cashbackSection}>
          <View style={styles.cashbackHeader}>
            <Text style={styles.cashbackLabel}>CASHBACK ACCRUED</Text>
            <Text style={styles.cashbackValue}>₹ 0.00</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>All-time Total</Text>
            <Text style={styles.statValue}>₹ 0.00</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Cashback Rate</Text>
            <Text style={styles.statValue}>0.8% Avg</Text>
          </View>
          
          <View style={styles.graphSection}>
            <View style={styles.graphIcon} />
            <View style={styles.graphTexts}>
              <Text style={styles.graphTitle}>Lorem Ipsum Dolor Et</Text>
              <Text style={styles.graphSubtitle}>Lorem Ipsum Dolor Et Lorem Ipsum Dolor Et\nLorem Ipsum Dolor Et Lorem Ipsum Dolor Et</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>Due in 28 Days</Text>
          <Text style={styles.footerValue}>₹ 32,500</Text>
        </View>
        <TouchableOpacity>
          <LinearGradient
            colors={['#FF9A6D', '#FF9A6D']} 
            start={{x: 0, y: 0}} end={{x: 1, y: 0}}
            style={styles.reviewButton}
          >
            <Text style={styles.reviewButtonText}>Review</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131313' },
  headerSafeArea: { backgroundColor: '#131313' },
  headerContainer: { height: 80, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoPlaceholder: { width: 27, height: 32, backgroundColor: '#FFFFFF' },
  greetingText: { fontFamily: 'Plus Jakarta Sans', fontSize: 14, lineHeight: 20, color: '#CBCBCB' },
  profileImage: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFCC8A' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  rentSection: { marginTop: 24, paddingHorizontal: 64, alignItems: 'center', gap: 10 },
  rentText: { fontFamily: 'Plus Jakarta Sans', fontSize: 28, lineHeight: 40, color: '#BABABA', textAlign: 'center' },
  payingWithText: { fontFamily: 'Plus Jakarta Sans', fontSize: 14, lineHeight: 20, color: '#A6A6A6' },
  carouselContainer: { marginTop: 24, height: 440 },
  carouselContent: { paddingLeft: 64, paddingRight: 32, gap: 16 },
  cardPlaceholder: { width: 270, height: 400, backgroundColor: '#202020', borderRadius: 12 },
  toggleSection: { marginTop: 48, alignItems: 'center' },
  toggleContainer: { width: 297, height: 44, backgroundColor: '#1A1A1A', borderRadius: 200, flexDirection: 'row', padding: 4, borderWidth: 1, borderColor: '#202020' },
  toggleButton: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 50 },
  toggleActive: { backgroundColor: '#1A1A1A', shadowColor: '#000', shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 10 } },
  toggleTextInactive: { fontFamily: 'Plus Jakarta Sans', color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '500', textAlign: 'center' },
  toggleTextActive: { fontFamily: 'Plus Jakarta Sans', color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  cashbackSection: { marginTop: 24, paddingHorizontal: 32, gap: 24 },
  cashbackHeader: { gap: 16 },
  cashbackLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 12, lineHeight: 20, fontWeight: '500', color: '#A9A9A9' },
  cashbackValue: { fontFamily: 'Plus Jakarta Sans', fontSize: 28, lineHeight: 40, color: '#BABABA' },
  separator: { height: 0.25, backgroundColor: '#4D4D4D' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 14, lineHeight: 20, color: '#DDDDDD', textAlign: 'center' },
  statValue: { fontFamily: 'Plus Jakarta Sans', fontSize: 28, lineHeight: 40, color: '#BABABA' },
  graphSection: { marginTop: 24, alignItems: 'center', gap: 16 },
  graphIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333333' },
  graphTexts: { alignItems: 'center', gap: 8 },
  graphTitle: { fontFamily: 'Plus Jakarta Sans', fontSize: 14, lineHeight: 20, fontWeight: '500', color: '#FFFFFF' },
  graphSubtitle: { fontFamily: 'Plus Jakarta Sans', fontSize: 12, lineHeight: 20, color: '#878787', textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 118, backgroundColor: '#202020', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, paddingTop: 16, paddingBottom: 40 },
  footerInfo: { gap: 4 },
  footerLabel: { fontFamily: 'Plus Jakarta Sans', fontSize: 12, lineHeight: 20, color: '#A9A9A9', textAlign: 'center' },
  footerValue: { fontFamily: 'Plus Jakarta Sans', fontSize: 12, lineHeight: 20, fontWeight: '600', color: '#EEEEEE' },
  reviewButton: { width: 164.5, height: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FF9A6D' },
  reviewButtonText: { fontFamily: 'Plus Jakarta Sans', fontSize: 14, lineHeight: 20, fontWeight: '500', color: '#FFFFFF' }
});
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-6296 --verify-only
```
