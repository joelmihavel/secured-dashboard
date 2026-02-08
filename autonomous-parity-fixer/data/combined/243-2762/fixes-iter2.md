# Fix Instructions - Iteration 2

## Summary
- Total Issues: 1
- Critical: 1
- Major: 0
- Minor: 0
- Current Parity Score: 85%

## Required Fixes


### 1. File Existence (critical)

**File:** app/(home-active)/index.tsx
**Explanation:** Generated missing screen file based on Figma design. Applied structural fixes: added textAlign: 'center' to 'selectedText' (Node 243:2776) and verified 'dueText' alignment.

**Current:**
```
// File not found
```

**Fixed:**
```
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function HomeActive() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoPlaceholder} />
            <Text style={styles.headerTitle}>Hi, Rishabh</Text>
          </View>
          <View style={styles.profilePic} />
        </View>

        {/* Main Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.rentDueText}>Your rent is due{'
'}in 10 days</Text>
          <Text style={styles.payingWithText}>Paying with:</Text>
        </View>

        {/* Cards ScrollView */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.cardsScrollContainer}
          style={styles.cardsScrollView}
        >
          {/* Credit Card */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardBrand}>Visa</Text>
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedText}>SELECTED</Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardNumber}>•••• 2341</Text>
              <View>
                <Text style={styles.cardLabel}>EXPIRY 06/26</Text>
                <Text style={styles.cardLabel}>CVV •••</Text>
              </View>
            </View>
          </View>

          {/* UPI Card */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardBrand}>UPI</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardText}>ICICI a/c - xxx23</Text>
              <Text style={styles.cardText}>rishabh@•••</Text>
            </View>
          </View>

          {/* Netbanking Card */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardBrand}>NET BANKING</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardText}>ICICI a/c - xxx23</Text>
            </View>
          </View>

          {/* Add More Card */}
          <View style={[styles.cardContainer, styles.addMoreCard]}>
            <Text style={styles.addMoreTitle}>Setup your payment method to start</Text>
            <Text style={styles.addMoreSubtitle}>Add UPI, card, or bank to start earning rewards</Text>
            <TouchableOpacity style={styles.addPaymentButton}>
              <Text style={styles.addPaymentButtonText}>+ Add Payment</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Recent Payments */}
        <View style={styles.recentPaymentsContainer}>
          <View style={styles.toggleContainer}>
            <View style={styles.toggleActive}>
              <Text style={styles.toggleTextActive}>Recent Payments</Text>
            </View>
            <View style={styles.toggleInactive}>
              <Text style={styles.toggleTextInactive}>Cashbacks</Text>
            </View>
          </View>

          <View style={styles.paymentsList}>
            {/* Payment Item 1 */}
            <View style={styles.paymentItem}>
              <View style={styles.paymentLeft}>
                <View style={styles.paymentIcon} />
                <View>
                  <Text style={styles.paymentTitle}>September rent</Text>
                  <View style={styles.paymentStatusRow}>
                    <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={styles.paymentStatus}>Paid · 15 Sep, 9:40am</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.paymentAmount}>₹ 32,500</Text>
            </View>
            <View style={styles.separator} />
            
            {/* Payment Item 2 */}
            <View style={styles.paymentItem}>
              <View style={styles.paymentLeft}>
                <View style={styles.paymentIcon} />
                <View>
                  <Text style={styles.paymentTitle}>August rent</Text>
                  <View style={styles.paymentStatusRow}>
                    <View style={[styles.statusDot, { backgroundColor: '#FFB020' }]} />
                    <Text style={styles.paymentStatus}>Pending · 15 Sep, 9:40am</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.paymentAmount}>₹ 32,500</Text>
            </View>
            <View style={styles.separator} />

            {/* Payment Item 3 */}
            <View style={styles.paymentItem}>
              <View style={styles.paymentLeft}>
                <View style={styles.paymentIcon} />
                <View>
                  <Text style={styles.paymentTitle}>July rent</Text>
                  <View style={styles.paymentStatusRow}>
                    <View style={[styles.statusDot, { backgroundColor: '#E5484D' }]} />
                    <Text style={styles.paymentStatus}>Failed · 15 Sep, 9:40am</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.paymentAmount}>₹ 32,500</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.dueText}>Due in 10 Days</Text>
          <Text style={styles.totalAmount}>₹ 32,500</Text>
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
  scrollContent: {
    paddingBottom: 140,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoPlaceholder: {
    width: 26,
    height: 32,
    backgroundColor: '#FFF',
  },
  headerTitle: {
    color: '#CBCBCB',
    fontSize: 14,
    fontFamily: 'Plus Jakarta Sans',
  },
  profilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFCC8A',
  },
  titleContainer: {
    paddingHorizontal: 64,
    marginBottom: 24,
  },
  rentDueText: {
    color: '#BABABA',
    fontSize: 28,
    lineHeight: 40,
    fontFamily: 'Plus Jakarta Sans',
    marginBottom: 10,
  },
  payingWithText: {
    color: '#A6A6A6',
    fontSize: 14,
    fontFamily: 'Plus Jakarta Sans',
  },
  cardsScrollView: {
    marginBottom: 48,
  },
  cardsScrollContainer: {
    paddingLeft: 64,
    paddingRight: 32,
    gap: 16,
  },
  cardContainer: {
    width: 270,
    height: 400,
    backgroundColor: '#202020',
    borderRadius: 12,
    padding: 24,
    justifyContent: 'space-between',
  },
  addMoreCard: {
    height: 408,
    justifyContent: 'flex-start',
    gap: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBrand: {
    color: '#CBCBCB',
    fontSize: 14,
    fontFamily: 'Plus Jakarta Sans',
  },
  selectedBadge: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 200,
  },
  selectedText: {
    color: '#FF9A6D',
    fontSize: 12,
    fontFamily: 'Plus Jakarta Sans',
    textAlign: 'center',
  },
  cardBody: {
    gap: 28,
  },
  cardNumber: {
    color: '#FF9A6D',
    fontSize: 20,
    fontFamily: 'Plus Jakarta Sans',
  },
  cardLabel: {
    color: '#4D4D4D',
    fontSize: 16,
    fontFamily: 'Plus Jakarta Sans',
  },
  cardText: {
    color: '#4D4D4D',
    fontSize: 16,
    fontFamily: 'Plus Jakarta Sans',
  },
  addMoreTitle: {
    color: '#CBCBCB',
    fontSize: 20,
    lineHeight: 32,
    fontFamily: 'Plus Jakarta Sans',
  },
  addMoreSubtitle: {
    color: '#878787',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Plus Jakarta Sans',
  },
  addPaymentButton: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9A6D',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  addPaymentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Plus Jakarta Sans',
  },
  recentPaymentsContainer: {
    paddingHorizontal: 32,
    gap: 48,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 200,
    padding: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#202020',
  },
  toggleActive: {
    backgroundColor: '#1A1A1A',
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  toggleInactive: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Plus Jakarta Sans',
  },
  toggleTextInactive: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Plus Jakarta Sans',
  },
  paymentsList: {
    gap: 24,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
  },
  paymentTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Plus Jakarta Sans',
  },
  paymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentStatus: {
    color: '#878787',
    fontSize: 12,
    fontFamily: 'Plus Jakarta Sans',
  },
  paymentAmount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Plus Jakarta Sans',
  },
  separator: {
    height: 1,
    backgroundColor: '#4D4D4D',
    opacity: 0.25,
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
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 40,
  },
  dueText: {
    color: '#A9A9A9',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'Plus Jakarta Sans',
  },
  totalAmount: {
    color: '#EEEEEE',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Plus Jakarta Sans',
  },
  payButton: {
    width: 164.5,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Plus Jakarta Sans',
  },
});
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-2762 --verify-only
```
