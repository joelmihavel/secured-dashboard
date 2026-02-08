# Fix Instructions - Iteration 2

## Summary
- Total Issues: 8
- Critical: 1
- Major: 7
- Minor: 0
- Current Parity Score: 50%

## Required Fixes


### 1. File Content (critical)

**File:** app/(home-active)/index.tsx
**Explanation:** Generated full screen implementation to resolve missing file issue reported by visual analysis. This implementation includes the required 'textAlign: center' for the footer text ('Due in 10 Days') identified in structural analysis. Note: Other structural alignment issues (for 'SELECTED' and 'Time' nodes) apply to placeholder components (Cards/Lists) and should be addressed when those specific components are fully implemented.

**Current:**
```
// Screen file not found or incomplete
```

**Fixed:**
```
import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function HomeActiveScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusBarPlaceholder} />
        <View style={styles.headerContent}>
          <View style={styles.greetingContainer}>
            <View style={styles.greetingRow}>
              <View style={styles.logoPlaceholder} />
              <Text style={styles.greetingText}>Hi, Rishabh</Text>
            </View>
            <View style={styles.profilePicContainer}>
               <View style={styles.profilePic} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={styles.bannerContainer}>
          <Text style={styles.bannerTitle}>Your rent is due{'
'}in 10 days</Text>
          <Text style={styles.bannerSubtitle}>Paying with:</Text>
        </View>

        {/* Cards Carousel */}
        <View style={styles.carouselContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
          >
            {/* Card 1: Credit Card */}
            <View style={styles.card}>
              {/* Placeholder for Card Component */}
            </View>
            {/* Card 2: UPI */}
            <View style={styles.card} />
            {/* Card 3: Netbanking */}
            <View style={styles.card} />
            {/* Card 4: Add More */}
            <View style={styles.card} />
          </ScrollView>
        </View>

        {/* Recent Payments */}
        <View style={styles.recentPaymentsContainer}>
          <View style={styles.toggleContainer}>
             {/* Placeholder for Toggle */}
             <Text style={{color: 'white'}}>Recent Payments Toggle</Text>
          </View>
          
          <View style={styles.paymentList}>
            {/* Placeholder for Payment Items */}
            <Text style={{color: 'white'}}>Payment List Item</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerDueText}>Due in 10 Days</Text>
          <Text style={styles.footerAmount}>₹ 32,500</Text>
        </View>
        <TouchableOpacity>
          <LinearGradient colors={['#FF9A6D', '#FF9A6D']} style={styles.payButton}>
            <Text style={styles.payButtonText}>Review & pay</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 157,
    backgroundColor: '#131313',
    zIndex: 10,
  },
  statusBarPlaceholder: {
    height: 53,
  },
  headerContent: {
    height: 80,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  greetingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  greetingText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    color: '#CBCBCB',
  },
  logoPlaceholder: {
    width: 26.7,
    height: 32,
    backgroundColor: '#FFFFFF',
  },
  profilePicContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  profilePic: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFCC8A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 157,
    paddingBottom: 166, // 118 (footer) + 48 (padding)
    gap: 24,
  },
  bannerContainer: {
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 64,
  },
  bannerTitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 28,
    color: '#BABABA',
    textAlign: 'left',
    lineHeight: 40,
  },
  bannerSubtitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    color: '#A6A6A6',
    lineHeight: 20,
  },
  carouselContainer: {
    height: 440,
  },
  carouselContent: {
    paddingLeft: 64,
    paddingRight: 32,
    gap: 16,
    alignItems: 'center',
  },
  card: {
    width: 270,
    height: 400,
    borderRadius: 12,
    backgroundColor: '#202020',
  },
  recentPaymentsContainer: {
    alignItems: 'center',
    gap: 48,
    paddingHorizontal: 32,
  },
  toggleContainer: {
    width: 297,
    height: 44,
    backgroundColor: '#1A1A1A',
    borderRadius: 200,
    borderWidth: 1,
    borderColor: '#202020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentList: {
    width: '100%',
    gap: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 118,
    backgroundColor: '#202020',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 40,
  },
  footerInfo: {
    flexDirection: 'column',
    gap: 4,
  },
  footerDueText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    color: '#A9A9A9',
    textAlign: 'center',
  },
  footerAmount: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    fontWeight: '600',
    color: '#EEEEEE',
  },
  payButton: {
    width: 164.5,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButtonText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-2967 --verify-only
```
