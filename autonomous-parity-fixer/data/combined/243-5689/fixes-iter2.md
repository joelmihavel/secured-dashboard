# Fix Instructions - Iteration 2

## Summary
- Total Issues: 10
- Critical: 1
- Major: 9
- Minor: 0
- Current Parity Score: 40%

## Required Fixes


### 1. Whole File (critical)

**File:** app/(home-empty)/index.tsx
**Explanation:** Implement missing screen file. This implementation includes fixes for 9 structural text-alignment issues (centering 'SELECTED', 'All-time Total', 'Due in 28 Days', etc.) identified in Batch 0 analysis.

**Current:**
```
// File not found
```

**Fixed:**
```
import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function HomeEmptyScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <View style={styles.logoPlaceholder} />
            <Text style={styles.headerTitle}>Hi, Rishabh</Text>
          </View>
          <View style={styles.profileImageContainer}>
             {/* Profile Image Placeholder */}
             <View style={styles.profileImage} />
          </View>
        </View>

        {/* Rent Due Text */}
        <View style={styles.rentDueContainer}>
          <Text style={styles.rentDueText}>Your rent is due{'
'}in 10 days</Text>
          <Text style={styles.payingWithText}>Paying with:</Text>
        </View>

        {/* Cards ScrollView */}
        <View style={styles.cardsWrapper}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsScrollContent}
            decelerationRate="fast"
            snapToInterval={270 + 16}
          >
            {/* Credit Card */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeader}>
                <View style={styles.visaLogo} />
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedText}>SELECTED</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardNumber}>•••• 2341</Text>
                <View>
                  <Text style={styles.cardDetail}>EXPIRY 06/26</Text>
                  <Text style={styles.cardDetail}>CVV •••</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={styles.cardFooterLeft}>
                   <Text style={styles.cardFooterText}>CREDIT CARD</Text>
                </View>
                <View style={styles.cardIcon} />
              </View>
            </View>

            {/* UPI Card */}
            <View style={styles.cardContainer}>
               <View style={styles.cardHeader}>
                <View style={styles.upiLogo} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardNumber}>•••• 2341</Text>
                <View>
                  <Text style={styles.cardDetail}>ICICI a/c - xxx23</Text>
                  <Text style={styles.cardDetail}>rishabh@•••</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={styles.cardFooterLeft}>
                   <Text style={styles.cardFooterText}>UPI</Text>
                </View>
                <View style={styles.cardIcon} />
              </View>
            </View>

            {/* Add More Card */}
            <View style={styles.addCardContainer}>
               <View style={styles.addCardContent}>
                 <Text style={styles.addCardTitle}>Setup your payment method to start</Text>
                 <Text style={styles.addCardSubtitle}>Add UPI, card, or bank to start earning rewards</Text>
                 <TouchableOpacity>
                   <LinearGradient 
                     colors={['#2A2A2A', '#1A1A1A']} 
                     style={styles.addPaymentButton}
                   >
                     <Text style={styles.addPaymentButtonText}>+ Add Payment</Text>
                   </LinearGradient>
                 </TouchableOpacity>
               </View>
               <View style={styles.cardFooter}>
                <View style={styles.cardFooterLeft}>
                   <Text style={styles.cardFooterText}>NEW PAYMENT</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Pagination Dots */}
        <View style={styles.paginationContainer}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        {/* Toggle */}
        <View style={styles.toggleWrapper}>
          <View style={styles.toggleContainer}>
            <View style={styles.toggleActive}>
              <Text style={styles.toggleActiveText}>Recent Payments</Text>
            </View>
            <View style={styles.toggleInactive}>
              <Text style={styles.toggleInactiveText}>Cashbacks</Text>
            </View>
          </View>
        </View>

        {/* Cashback Stats */}
        <View style={styles.cashbackContainer}>
          <View style={styles.cashbackHeader}>
             <Text style={styles.cashbackLabel}>CASHBACK ACCRUED</Text>
          </View>
          <Text style={styles.cashbackMainAmount}>₹ 0.00</Text>
          <View style={styles.divider} />
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>All-time Total</Text>
              <Text style={styles.statValue}>₹ 0.00</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Cashback Rate</Text>
              <Text style={styles.statValue}>0.8% Avg</Text>
            </View>
          </View>
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.dueInfo}>
          <Text style={styles.dueLabel}>Due in 28 Days</Text>
          <Text style={styles.dueAmount}>₹ 32,500</Text>
        </View>
        <TouchableOpacity>
          <LinearGradient 
            colors={['#FF9A6D', '#FFCC8A']} 
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
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
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
  scrollContent: {
    paddingTop: 60,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoPlaceholder: {
    width: 26.7,
    height: 32,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    color: '#CBCBCB',
  },
  profileImageContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFCC8A',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  rentDueContainer: {
    paddingHorizontal: 64,
    alignItems: 'center',
    marginBottom: 24,
  },
  rentDueText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 28,
    lineHeight: 40,
    color: '#BABABA',
    textAlign: 'left',
    width: '100%',
    letterSpacing: -1,
    marginBottom: 10,
  },
  payingWithText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    color: '#A6A6A6',
    textAlign: 'left',
    width: '100%',
  },
  cardsWrapper: {
    marginBottom: 24,
  },
  cardsScrollContent: {
    paddingLeft: 64,
    paddingRight: 32,
    gap: 16,
  },
  cardContainer: {
    width: 270,
    height: 400,
    backgroundColor: '#202020',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 24,
    marginBottom: 120,
  },
  visaLogo: {
    width: 50,
    height: 16,
    backgroundColor: '#FFFFFF',
  },
  upiLogo: {
    width: 45,
    height: 16,
    backgroundColor: '#FFFFFF',
  },
  selectedBadge: {
    backgroundColor: '#1A1A1A',
    borderRadius: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    color: '#FF9A6D',
    textAlign: 'center',
  },
  cardBody: {
    paddingHorizontal: 32,
    gap: 28,
    marginBottom: 28,
  },
  cardNumber: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 20,
    color: '#FF9A6D',
  },
  cardDetail: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 16,
    color: '#4D4D4D',
    lineHeight: 24,
  },
  cardFooter: {
    height: 64,
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    marginTop: 'auto',
  },
  cardFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardFooterText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    color: '#CBCBCB',
  },
  cardIcon: {
    width: 16,
    height: 16,
    borderColor: '#CBCBCB',
    borderWidth: 1,
    borderRadius: 8,
  },
  addCardContainer: {
    width: 270,
    height: 400,
    backgroundColor: '#202020',
    borderRadius: 12,
    overflow: 'hidden',
  },
  addCardContent: {
    padding: 32,
    gap: 24,
    flex: 1,
  },
  addCardTitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 20,
    color: '#CBCBCB',
    lineHeight: 32,
  },
  addCardSubtitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    color: '#878787',
    lineHeight: 20,
  },
  addPaymentButton: {
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF9A6D',
  },
  addPaymentButtonText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#202020',
  },
  activeDot: {
    backgroundColor: '#FF9A6D',
  },
  toggleWrapper: {
    alignItems: 'center',
    marginBottom: 48,
  },
  toggleContainer: {
    width: 297,
    height: 44,
    backgroundColor: '#1A1A1A',
    borderRadius: 200,
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
    borderColor: '#202020',
  },
  toggleActive: {
    width: 165,
    height: 36,
    backgroundColor: '#333333',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleActiveText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  toggleInactive: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleInactiveText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cashbackContainer: {
    marginHorizontal: 32,
    gap: 16,
  },
  cashbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cashbackLabel: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    fontWeight: '500',
    color: '#A9A9A9',
  },
  cashbackMainAmount: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 28,
    color: '#BABABA',
    letterSpacing: -1,
  },
  divider: {
    height: 1,
    backgroundColor: '#4D4D4D',
    opacity: 0.25,
    marginVertical: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    gap: 4,
  },
  statLabel: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    color: '#DDDDDD',
    textAlign: 'center',
  },
  statValue: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 28,
    color: '#BABABA',
    letterSpacing: -1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 118,
    backgroundColor: '#202020',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingHorizontal: 32,
  },
  dueInfo: {
    gap: 4,
  },
  dueLabel: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    color: '#A9A9A9',
    textAlign: 'center',
  },
  dueAmount: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    fontWeight: '600',
    color: '#EEEEEE',
  },
  reviewButton: {
    width: 164.5,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewButtonText: {
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
npm run pipeline:v2 -- single 243-5689 --verify-only
```
