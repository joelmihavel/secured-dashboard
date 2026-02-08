/**
 * Home Screen - Pixel Perfect Implementation
 *
 * Generated using Combined Approach:
 * - LOCAL EXTRACTION: Exact numerical values from figma-parity/data/screens/243-2762
 * - FIGMA MCP: Semantic structure and hierarchy
 *
 * Figma Reference: 243-2762 "Home --active --Bank / UPI only"
 * All values are EXACT from Figma extraction - no guessing
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Logo } from '@/src/components/ui';
import { useDashboard, useRefreshDashboard } from '@/src/hooks';

// ============================================
// FIGMA EXTRACTED CONSTANTS
// Source: 243-2762 "Home --active --Bank / UPI only"
// ============================================

const FIGMA = {
  // Screen
  screen: {
    width: 393,
    height: 1284,
    backgroundColor: '#131313',
  },
  // Main content container
  mainContent: {
    gap: 24,
    paddingBottom: 48,
  },
  // Headline section
  headlineSection: {
    paddingHorizontal: 64,
    gap: 10,
  },
  headline: {
    width: 265,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 40,
    letterSpacing: -1,
    grayColor: '#BABABA',
    accentColor: '#FF9A6D',
  },
  payingWithLabel: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: '#A6A6A6',
  },
  // Payment carousel
  carousel: {
    paddingLeft: 64,
    paddingRight: 32,
    gap: 16,
    cardWidth: 270,
    cardHeight: 400,
    cardRadius: 12,
  },
  // UPI Card
  upiCard: {
    bodyBg: '#202020',
    footerBg: '#1A1A1A',
    footerHeight: 64,
    selectedBadgeBg: '#1A1A1A',
    selectedBadgeRadius: 200,
    selectedTextColor: '#FF9A6D',
    selectedTextSize: 12,
    accountColor: '#4D4D4D',
    accountAccentColor: '#FF9A6D',
    accountSize: 16,
    typeLabelColor: '#CBCBCB',
    typeLabelSize: 14,
  },
  // Toggle tabs
  toggle: {
    width: 297,
    height: 44,
    backgroundColor: '#1A1A1A',
    borderColor: '#202020',
    borderWidth: 1,
    borderRadius: 200,
    padding: 4,
  },
  toggleActive: {
    backgroundColor: '#1A1A1A',
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 8,
    textColor: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleInactive: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    textColor: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  // Payment list
  paymentItem: {
    titleColor: '#FFFFFF',
    titleSize: 14,
    titleWeight: '500',
    titleLetterSpacing: -0.56,
    subtitleColor: '#878787',
    subtitleSize: 12,
    subtitleLetterSpacing: -0.24,
    amountColor: '#FFFFFF',
    amountSymbolSize: 12,
    amountValueSize: 16,
    amountWeight: '600',
    amountLetterSpacing: -0.64,
  },
  // Bottom footer
  footer: {
    backgroundColor: '#202020',
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 40,
  },
  footerLabel: {
    color: '#A9A9A9',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
  },
  footerAmount: {
    color: '#EEEEEE',
    symbolSize: 12,
    valueSize: 16,
    fontWeight: '600',
    letterSpacing: -0.48,
  },
  // Header
  header: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 16,
  },
  headerText: {
    color: '#CBCBCB',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
} as const;

// ============================================
// TYPES
// ============================================

type TabId = 'recent_payments' | 'cashbacks';

interface PaymentItem {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_PAYMENTS: PaymentItem[] = [
  { id: '1', title: 'September rent', subtitle: 'Paid · 15 Sep, 9:40am', amount: 32500, status: 'paid' },
  { id: '2', title: 'August rent', subtitle: 'Pending · 15 Sep, 9:40am', amount: 32500, status: 'pending' },
  { id: '3', title: 'July rent', subtitle: 'Failed · 15 Sep, 9:40am', amount: 32500, status: 'failed' },
];

// ============================================
// COMPONENT
// ============================================

export default function HomePixelPerfectScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('recent_payments');
  const [refreshing, setRefreshing] = useState(false);

  const { user, tenancy, upcomingPayment, cashback } = useDashboard();
  const refresh = useRefreshDashboard();

  const userName = user?.name?.split(' ')[0] || 'Rishabh';
  const rentAmount = tenancy?.rent_amount || 32500;
  const dueDate = upcomingPayment?.due_date ? new Date(upcomingPayment.due_date) : null;
  const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 10;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handlePayNow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(payment)/initiate' as never);
  }, [router]);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-IN');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={FIGMA.headline.accentColor}
            />
          }
        >
          {/* Header: Logo + "Hi, [Name]" + Avatar */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Logo size={32} />
              <Text style={styles.headerText}>Hi, {userName}</Text>
            </View>
            <View style={styles.avatar} />
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Headline Section */}
            <View style={styles.headlineSection}>
              <Text style={styles.headline}>
                <Text style={styles.headlineGray}>Your rent is due{'\n'}</Text>
                <Text style={styles.headlineAccent}>in {daysUntilDue} days</Text>
              </Text>
              <Text style={styles.payingWithLabel}>Paying with:</Text>
            </View>

            {/* Payment Method Carousel */}
            <View style={styles.carouselSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
                snapToInterval={FIGMA.carousel.cardWidth + FIGMA.carousel.gap}
                decelerationRate="fast"
              >
                {/* UPI Card (Selected) */}
                <View style={styles.paymentCard}>
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <View style={styles.upiLogo}>
                        <Text style={styles.upiLogoText}>UPI</Text>
                        <View style={styles.upiLogoIcon}>
                          <Text style={styles.upiIconText}>P</Text>
                        </View>
                      </View>
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>SELECTED</Text>
                      </View>
                    </View>
                    <View style={styles.cardDetails}>
                      <Text style={styles.accountText}>
                        <Text style={styles.accountLabel}>ICICI a/c - </Text>
                        <Text style={styles.accountAccent}>xxx23</Text>
                      </Text>
                      <Text style={styles.upiIdText}>
                        <Text style={styles.accountLabel}>rishabh@</Text>
                        <Text style={styles.accountAccent}>{'\u2022\u2022\u2022'}</Text>
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardFooter}>
                    <View style={styles.cardTypeRow}>
                      <Text style={styles.cardTypeLabel}>UPI</Text>
                    </View>
                    <Logo size={24} />
                  </View>
                </View>

                {/* Add More Card */}
                <View style={styles.paymentCard}>
                  <View style={styles.addCardBody}>
                    <Text style={styles.addCardTitle}>
                      <Text style={styles.addCardAccent}>Setup</Text>
                      <Text style={styles.addCardGray}> your payment method to start</Text>
                    </Text>
                    <Text style={styles.addCardSubtitle}>
                      Add UPI, card, or bank to start earning rewards
                    </Text>
                    <TouchableOpacity style={styles.addCardButton}>
                      <Text style={styles.addCardButtonText}>+ Add Payment</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cardFooter}>
                    <View style={styles.cardTypeRow}>
                      <Text style={styles.cardTypeLabel}>NEW PAYMENT</Text>
                    </View>
                    <Logo size={24} />
                  </View>
                </View>
              </ScrollView>

              {/* Pagination dots */}
              <View style={styles.pagination}>
                <View style={[styles.dot, styles.dotActive]} />
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>
            </View>

            {/* Tab Toggle */}
            <View style={styles.toggleContainer}>
              <View style={styles.toggle}>
                <TouchableOpacity
                  style={[styles.toggleTab, activeTab === 'recent_payments' && styles.toggleTabActive]}
                  onPress={() => setActiveTab('recent_payments')}
                >
                  <Text style={[styles.toggleText, activeTab === 'recent_payments' && styles.toggleTextActive]}>
                    Recent Payments
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleTab, activeTab === 'cashbacks' && styles.toggleTabActive]}
                  onPress={() => setActiveTab('cashbacks')}
                >
                  <Text style={[styles.toggleText, activeTab === 'cashbacks' && styles.toggleTextActive]}>
                    Cashbacks
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Payment List */}
            <View style={styles.paymentList}>
              {MOCK_PAYMENTS.map((payment, index) => (
                <View key={payment.id}>
                  <View style={styles.paymentItem}>
                    <View style={styles.paymentItemLeft}>
                      <View style={styles.paymentAvatar} />
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentTitle}>{payment.title}</Text>
                        <View style={styles.paymentSubtitleRow}>
                          <View style={[styles.statusDot, styles[`statusDot_${payment.status}`]]} />
                          <Text style={styles.paymentSubtitle}>{payment.subtitle}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.paymentAmount}>
                      <Text style={styles.amountSymbol}>{'\u20B9'}  </Text>
                      <Text style={styles.amountValue}>{formatAmount(payment.amount)}</Text>
                    </Text>
                  </View>
                  {index < MOCK_PAYMENTS.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Fixed Bottom Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerLabel}>Due in {daysUntilDue} Days</Text>
          <Text style={styles.footerAmount}>
            <Text style={styles.footerAmountSymbol}>{'\u20B9'}  </Text>
            <Text style={styles.footerAmountValue}>{formatAmount(rentAmount)}</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.footerButton} onPress={handlePayNow}>
          <Text style={styles.footerButtonText}>Review & pay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================
// STYLES - Exact Figma Values
// ============================================

const styles = StyleSheet.create({
  // Screen container
  container: {
    flex: 1,
    backgroundColor: FIGMA.screen.backgroundColor,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Space for footer
  },

  // Header - Figma: 243:2962
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: FIGMA.header.paddingHorizontal,
    paddingVertical: FIGMA.header.paddingVertical,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FIGMA.header.gap,
  },
  headerText: {
    color: FIGMA.headerText.color,
    fontSize: FIGMA.headerText.fontSize,
    fontWeight: FIGMA.headerText.fontWeight as any,
    lineHeight: FIGMA.headerText.lineHeight,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF9A6D',
  },

  // Main Content - Figma: 243:2763
  mainContent: {
    gap: FIGMA.mainContent.gap,
    paddingBottom: FIGMA.mainContent.paddingBottom,
  },

  // Headline Section - Figma: 243:2764
  headlineSection: {
    paddingHorizontal: FIGMA.headlineSection.paddingHorizontal,
    gap: FIGMA.headlineSection.gap,
  },
  headline: {
    width: FIGMA.headline.width,
    fontSize: FIGMA.headline.fontSize,
    fontWeight: FIGMA.headline.fontWeight as any,
    lineHeight: FIGMA.headline.lineHeight,
    letterSpacing: FIGMA.headline.letterSpacing,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  headlineGray: {
    color: FIGMA.headline.grayColor,
  },
  headlineAccent: {
    color: FIGMA.headline.accentColor,
  },
  payingWithLabel: {
    color: FIGMA.payingWithLabel.color,
    fontSize: FIGMA.payingWithLabel.fontSize,
    fontWeight: FIGMA.payingWithLabel.fontWeight as any,
    lineHeight: FIGMA.payingWithLabel.lineHeight,
    fontFamily: 'PlusJakartaSans-Regular',
  },

  // Carousel - Figma: 243:2769
  carouselSection: {
    gap: 24,
  },
  carouselContent: {
    paddingLeft: FIGMA.carousel.paddingLeft,
    paddingRight: FIGMA.carousel.paddingRight,
    gap: FIGMA.carousel.gap,
  },
  paymentCard: {
    width: FIGMA.carousel.cardWidth,
    borderRadius: FIGMA.carousel.cardRadius,
    overflow: 'hidden',
  },
  cardBody: {
    backgroundColor: FIGMA.upiCard.bodyBg,
    padding: 24,
    paddingLeft: 32,
    paddingRight: 16,
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 336,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  upiLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 2,
  },
  upiLogoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#27803B',
  },
  upiLogoIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#F06321',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiIconText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  selectedBadge: {
    backgroundColor: FIGMA.upiCard.selectedBadgeBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: FIGMA.upiCard.selectedBadgeRadius,
  },
  selectedBadgeText: {
    color: FIGMA.upiCard.selectedTextColor,
    fontSize: FIGMA.upiCard.selectedTextSize,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  cardDetails: {
    gap: 4,
  },
  accountText: {
    fontSize: FIGMA.upiCard.accountSize,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  accountLabel: {
    color: FIGMA.upiCard.accountColor,
  },
  accountAccent: {
    color: FIGMA.upiCard.accountAccentColor,
    fontSize: 20,
  },
  upiIdText: {
    fontSize: FIGMA.upiCard.accountSize,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  cardFooter: {
    backgroundColor: FIGMA.upiCard.footerBg,
    height: FIGMA.upiCard.footerHeight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  cardTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTypeLabel: {
    color: FIGMA.upiCard.typeLabelColor,
    fontSize: FIGMA.upiCard.typeLabelSize,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  addCardBody: {
    backgroundColor: FIGMA.upiCard.bodyBg,
    padding: 24,
    paddingLeft: 32,
    paddingRight: 16,
    flex: 1,
    gap: 24,
    minHeight: 336,
  },
  addCardTitle: {
    fontSize: 20,
    lineHeight: 32,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  addCardAccent: {
    color: FIGMA.headline.accentColor,
  },
  addCardGray: {
    color: '#CBCBCB',
  },
  addCardSubtitle: {
    color: '#878787',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  addCardButton: {
    backgroundColor: '#202020',
    borderWidth: 0.1,
    borderColor: FIGMA.headline.accentColor,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  addCardButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans-Medium',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4D4D4D',
  },
  dotActive: {
    backgroundColor: '#CBCBCB',
  },

  // Toggle - Figma: 243:2917
  toggleContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  toggle: {
    width: FIGMA.toggle.width,
    height: FIGMA.toggle.height,
    backgroundColor: FIGMA.toggle.backgroundColor,
    borderColor: FIGMA.toggle.borderColor,
    borderWidth: FIGMA.toggle.borderWidth,
    borderRadius: FIGMA.toggle.borderRadius,
    flexDirection: 'row',
    alignItems: 'center',
    padding: FIGMA.toggle.padding,
  },
  toggleTab: {
    flex: 1,
    paddingHorizontal: FIGMA.toggleInactive.paddingHorizontal,
    paddingVertical: FIGMA.toggleInactive.paddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
  },
  toggleTabActive: {
    backgroundColor: FIGMA.toggleActive.backgroundColor,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  toggleText: {
    color: FIGMA.toggleInactive.textColor,
    fontSize: FIGMA.toggleInactive.fontSize,
    fontWeight: FIGMA.toggleInactive.fontWeight as any,
    fontFamily: 'PlusJakartaSans-Medium',
  },
  toggleTextActive: {
    fontWeight: FIGMA.toggleActive.fontWeight as any,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },

  // Payment List - Figma: 243:2920
  paymentList: {
    paddingHorizontal: 32,
    gap: 24,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  paymentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF9A6D',
  },
  paymentInfo: {
    gap: 8,
  },
  paymentTitle: {
    color: FIGMA.paymentItem.titleColor,
    fontSize: FIGMA.paymentItem.titleSize,
    fontWeight: FIGMA.paymentItem.titleWeight as any,
    letterSpacing: FIGMA.paymentItem.titleLetterSpacing,
    fontFamily: 'PlusJakartaSans-Medium',
  },
  paymentSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDot_paid: {
    backgroundColor: '#27AE60',
  },
  statusDot_pending: {
    backgroundColor: '#F2994A',
  },
  statusDot_failed: {
    backgroundColor: '#EB5757',
  },
  paymentSubtitle: {
    color: FIGMA.paymentItem.subtitleColor,
    fontSize: FIGMA.paymentItem.subtitleSize,
    letterSpacing: FIGMA.paymentItem.subtitleLetterSpacing,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  paymentAmount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  amountSymbol: {
    color: FIGMA.paymentItem.amountColor,
    fontSize: FIGMA.paymentItem.amountSymbolSize,
    fontWeight: FIGMA.paymentItem.amountWeight as any,
    letterSpacing: FIGMA.paymentItem.amountLetterSpacing,
  },
  amountValue: {
    color: FIGMA.paymentItem.amountColor,
    fontSize: FIGMA.paymentItem.amountValueSize,
    fontWeight: FIGMA.paymentItem.amountWeight as any,
    letterSpacing: FIGMA.paymentItem.amountLetterSpacing,
  },
  divider: {
    height: 1,
    backgroundColor: '#202020',
    marginVertical: 24,
  },

  // Footer - Figma: 243:2952
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: FIGMA.footer.backgroundColor,
    paddingHorizontal: FIGMA.footer.paddingHorizontal,
    paddingTop: FIGMA.footer.paddingTop,
    paddingBottom: FIGMA.footer.paddingBottom,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flex: 1,
    gap: 4,
  },
  footerLabel: {
    color: FIGMA.footerLabel.color,
    fontSize: FIGMA.footerLabel.fontSize,
    fontWeight: FIGMA.footerLabel.fontWeight as any,
    lineHeight: FIGMA.footerLabel.lineHeight,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  footerAmount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  footerAmountSymbol: {
    color: FIGMA.footerAmount.color,
    fontSize: FIGMA.footerAmount.symbolSize,
    fontWeight: FIGMA.footerAmount.fontWeight as any,
    letterSpacing: FIGMA.footerAmount.letterSpacing,
  },
  footerAmountValue: {
    color: FIGMA.footerAmount.color,
    fontSize: FIGMA.footerAmount.valueSize,
    fontWeight: FIGMA.footerAmount.fontWeight as any,
    letterSpacing: FIGMA.footerAmount.letterSpacing,
  },
  footerButton: {
    flex: 1,
    backgroundColor: '#202020',
    borderWidth: 0.1,
    borderColor: FIGMA.headline.accentColor,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: 'rgba(153, 92, 65, 0.24)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  footerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans-Medium',
    lineHeight: 24,
  },
});
