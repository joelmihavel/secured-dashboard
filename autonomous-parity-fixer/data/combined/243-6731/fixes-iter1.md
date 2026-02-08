# Fix Instructions - Iteration 1

## Summary
- Total Issues: 10
- Critical: 1
- Major: 9
- Minor: 0
- Current Parity Score: 40%

## Required Fixes


### 1. file (critical)

**File:** app/(home-empty)/index.tsx
**Explanation:** Implement full screen based on Figma design 'Home --Empty State'. This fix resolves the missing file issue and incorporates 9 critical structural text-alignment fixes (specifically for 'SELECTED' badges and stats labels) that were detected as missing in the initial analysis.

**Current:**
```
// File not found or empty
```

**Fixed:**
```
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function HomeEmptyScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarPlaceholder} />
              <Text style={styles.headerTitle}>Hi, Rishabh</Text>
            </View>
          </View>

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={styles.heroText}>Your rent is due{'\n'}in 10 days</Text>
          </View>

          {/* Paying With Label */}
          <Text style={styles.sectionLabel}>Paying with:</Text>

          {/* Cards ScrollView */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsContainer}
            decelerationRate="fast"
            snapToInterval={270 + 16}
          >
            {/* Card 1: Credit Card */}
            <View style={styles.cardWrapper}>
              <View style={styles.cardVisual}>
                <View style={styles.cardTopRow}>
                  <View style={styles.visaLogo}><Text style={styles.logoText}>Visa</Text></View>
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedText}>SELECTED</Text>
                  </View>
                </View>
                <View style={styles.cardDetails}>
                  <Text style={styles.cardNumber}>•••• 2341</Text>
                  <View style={styles.cardExpiryRow}>
                    <Text style={styles.cardLabel}>EXPIRY 06/26</Text>
                    <Text style={styles.cardLabel}>CVV •••</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>CREDIT CARD</Text>
                <Ionicons name="information-circle-outline" size={16} color="#CBCBCB" />
              </View>
            </View>

            {/* Card 2: UPI */}
            <View style={styles.cardWrapper}>
              <View style={styles.cardVisual}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.upiLogo}>UPI</Text>
                </View>
                <View style={styles.cardDetails}>
                  <Text style={[styles.cardNumber, { opacity: 0 }]}>•••• 2341</Text>
                  <View style={styles.cardExpiryRow}>
                    <Text style={styles.cardLabel}>ICICI a/c - xxx23</Text>
                  </View>
                  <Text style={styles.cardLabel}>rishabh@•••</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>UPI</Text>
                <Ionicons name="information-circle-outline" size={16} color="#CBCBCB" />
              </View>
            </View>

            {/* Card 3: Netbanking */}
            <View style={styles.cardWrapper}>
              <View style={styles.cardVisual}>
                <View style={styles.cardTopRow}>
                  <View style={styles.bankLogo} />
                </View>
                <View style={styles.cardDetails}>
                   <View style={styles.cardExpiryRow}>
                    <Text style={styles.cardLabel}>ICICI a/c - xxx23</Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>NET BANKING</Text>
                <Ionicons name="information-circle-outline" size={16} color="#CBCBCB" />
              </View>
            </View>

            {/* Card 4: Add New */}
            <View style={styles.cardWrapper}>
              <View style={styles.cardVisual}>
                <Text style={styles.addCardTitle}>Setup your payment method to start</Text>
                <Text style={styles.addCardSubtitle}>Add UPI, card, or bank to start earning rewards</Text>
                
                <LinearGradient
                  colors={['#FF9A6D', '#FFCC8A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.addButtonGradient}
                >
                  <TouchableOpacity style={styles.addButtonInner}>
                     <Text style={styles.addButtonText}>+ Add Payment</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>NEW PAYMENT</Text>
              </View>
            </View>
          </ScrollView>

          {/* Pagination Dots */}
          <View style={styles.pagination}>
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          {/* Toggle */}
          <View style={styles.toggleContainer}>
            <View style={styles.toggleWrapper}>
              <TouchableOpacity style={styles.toggleButton}>
                <Text style={styles.toggleText}>Recent Payments</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleButton, styles.toggleActive]}>
                <Text style={styles.toggleTextActive}>Cashbacks</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cashback Section */}
          <View style={styles.cashbackSection}>
            <View style={styles.cashbackHeader}>
              <Text style={styles.cashbackLabel}>CASHBACK ACCRUED</Text>
            </View>
            <Text style={styles.cashbackAmount}>₹ 0.00</Text>
            
            <View style={styles.cashbackStatsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>All-time Total</Text>
                <Text style={styles.statValue}>₹ 0.00</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Cashback Rate</Text>
                <Text style={styles.statValue}>0.8% Avg</Text>
              </View>
            </View>

            <View style={styles.cashbackInfo}>
              <View style={styles.infoIcon} />
              <View>
                <Text style={styles.infoTitle}>Lorem Ipsum Dolor Et</Text>
                <Text style={styles.infoDesc}>Lorem Ipsum Dolor Et Lorem Ipsum Dolor Et{'\n'}Lorem Ipsum Dolor Et Lorem Ipsum Dolor Et</Text>
              </View>
            </View>
          </View>

          {/* Bottom Spacer for Footer */}
          <View style={{ height: 140 }} />
        </ScrollView>

        {/* Sticky Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.dueLabel}>Due in 28 Days</Text>
            <Text style={styles.dueAmount}>₹ 32,500</Text>
          </View>
          <TouchableOpacity style={styles.reviewButton}>
            <LinearGradient
              colors={['#FF9A6D', '#FFCC8A']}
              style={styles.reviewGradient}
            >
              <Text style={styles.reviewText}>Review</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313', // colors.black[700]
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFCC8A', // colors.brand[300]
  },
  headerTitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    color: '#CBCBCB', // colors.neutral[300]
  },
  heroSection: {
    paddingHorizontal: 64,
    marginBottom: 10,
    height: 110,
    justifyContent: 'center',
  },
  heroText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 28,
    color: '#BABABA', // colors.neutral[400]
    lineHeight: 40,
  },
  sectionLabel: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    color: '#A6A6A6', // colors.black[200]
    paddingLeft: 64,
    marginBottom: 24,
  },
  cardsContainer: {
    paddingLeft: 64,
    paddingRight: 32,
    gap: 16,
  },
  cardWrapper: {
    width: 270,
    height: 400,
  },
  cardVisual: {
    width: 270,
    height: 336,
    backgroundColor: '#202020', // colors.black[500]
    padding: 24,
    paddingLeft: 32,
    justifyContent: 'space-between',
    borderRadius: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visaLogo: {
    width: 50,
    height: 16,
    backgroundColor: '#FFF',
  },
  upiLogo: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  bankLogo: {
    width: 24,
    height: 24,
    backgroundColor: '#F06321', // colors.brand[700]
    borderRadius: 12,
  },
  selectedBadge: {
    backgroundColor: '#1A1A1A', // colors.black[600]
    borderRadius: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedText: {
    color: '#FF9A6D', // colors.brand[500]
    fontSize: 12,
    fontFamily: 'Plus Jakarta Sans',
    textAlign: 'center', // STRUCTURAL FIX: Alignment mismatch
  },
  cardDetails: {
    gap: 8,
  },
  cardNumber: {
    fontSize: 20,
    color: '#FF9A6D', // colors.brand[500]
    fontFamily: 'Plus Jakarta Sans',
    marginBottom: 20,
  },
  cardExpiryRow: {
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 16,
    color: '#4D4D4D', // colors.black[400]
    fontFamily: 'Plus Jakarta Sans',
  },
  cardFooter: {
    height: 64,
    backgroundColor: '#1A1A1A', // colors.black[600]
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  cardFooterText: {
    color: '#CBCBCB', // colors.neutral[300]
    fontSize: 14,
    fontFamily: 'Plus Jakarta Sans',
  },
  addCardTitle: {
    fontSize: 20,
    color: '#CBCBCB', // colors.neutral[300]
    fontFamily: 'Plus Jakarta Sans',
    marginBottom: 8,
  },
  addCardSubtitle: {
    fontSize: 14,
    color: '#878787', // colors.neutral[600]
    fontFamily: 'Plus Jakarta Sans',
    marginBottom: 24,
  },
  addButtonGradient: {
    borderRadius: 8,
    padding: 1,
  },
  addButtonInner: {
    backgroundColor: '#202020', // colors.black[500]
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 24,
    marginBottom: 48,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#202020',
  },
  activeDot: {
    backgroundColor: '#FF9A6D', // colors.brand[500]
  },
  toggleContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  toggleWrapper: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A', // colors.black[600]
    borderRadius: 200,
    padding: 4,
    borderWidth: 1,
    borderColor: '#202020',
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 50,
  },
  toggleActive: {
    backgroundColor: '#1A1A1A',
  },
  toggleText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Plus Jakarta Sans',
    textAlign: 'center',
  },
  toggleTextActive: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Plus Jakarta Sans',
    textAlign: 'center',
  },
  cashbackSection: {
    paddingHorizontal: 32,
    gap: 24,
  },
  cashbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cashbackLabel: {
    color: '#A9A9A9', // colors.neutral[500]
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Plus Jakarta Sans',
  },
  cashbackAmount: {
    color: '#BABABA', // colors.neutral[400]
    fontSize: 28,
    fontFamily: 'Plus Jakarta Sans',
  },
  cashbackStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statItem: {
    gap: 4,
  },
  statLabel: {
    color: '#DDDDDD', // colors.neutral[200]
    fontSize: 14,
    textAlign: 'center', // STRUCTURAL FIX: Alignment mismatch
    fontFamily: 'Plus Jakarta Sans',
  },
  statValue: {
    color: '#BABABA', // colors.neutral[400]
    fontSize: 28,
    fontFamily: 'Plus Jakarta Sans',
  },
  cashbackInfo: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  infoDesc: {
    color: '#878787', // colors.neutral[600]
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#202020', // colors.black[500]
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  dueLabel: {
    color: '#A9A9A9', // colors.neutral[500]
    fontSize: 12,
    textAlign: 'center', // STRUCTURAL FIX: Alignment mismatch
    fontFamily: 'Plus Jakarta Sans',
  },
  dueAmount: {
    color: '#EEEEEE', // colors.neutral[100]
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Plus Jakarta Sans',
  },
  reviewButton: {
    width: 164,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
  },
  reviewGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'Plus Jakarta Sans',
  },
  logoText: {
    color: '#000',
    fontWeight: 'bold',
    textAlign: 'center',
  }
});
```


## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
```
npm run pipeline:v2 -- single 243-6731 --verify-only
```
