/**
 * Profile Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-8760
 *
 * Features:
 * - "My Profile" headline (Figma shows white, design splits gray/orange)
 * - Payment history chart section with horizontal scroll
 * - Secured account section with user info
 * - Payment information section (grouped items with dividers per Figma)
 * - Support section
 * - App section (Sign Out, Delete Account)
 *
 * Figma-verified values (from 41-8760 extraction):
 * - Background: #131313 (colors.black[700])
 * - Section gap: 40px (spacing.xxl)
 * - Horizontal padding: 40px (spacing.xxl)
 * - Section title: 12px/600/16.92 letterSpacing 0, color #878787, uppercase
 * - Menu item text: 14px/400/19.74 letterSpacing -0.56, color #CBCBCB
 * - User name: 14px/500/19.74 letterSpacing -0.56, color #FFFFFF
 * - Join date: 12px/400/16.92 letterSpacing -0.24, color #878787
 * - Chart month labels: 12px/400/16.92 letterSpacing -0.24, textAlign center
 * - Legend pills: bg #FFFFFF, text #000000, borderRadius 40, padding 4/8
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text } from '@/src/components';
import { useDashboard, useAuth, usePaymentHistory } from '@/src/hooks';
import { colors, spacing, radius, semanticColors, fontFamily } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design System Colors - mapped from theme (verified against Figma 41-8760)
const PROFILE_COLORS = {
  background: colors.black[700],         // #131313 - Figma verified
  cardBackground: colors.black[500],     // #202020 - Figma: card/menuItem bg
  sectionTitle: colors.neutral[600],     // #878787 - Figma: section title text
  accentOrange: colors.brand[500],       // #FF9A6D - Figma verified
  titleGray: colors.neutral[500],        // #A9A9A9 - Figma: "My" text color
  textPrimary: colors.white,             // #FFFFFF
  menuItemText: colors.neutral[300],     // #CBCBCB - Figma: menu item text
  textSecondary: colors.black[300],      // #797979
  arrowOrange: colors.brand[500],        // #FF9A6D
  divider: colors.black[400],            // #4D4D4D - Figma: divider/legend bg
  chartGreen: colors.success.default,    // #70BF73
  chartYellow: colors.warning.default,   // #FFD580
  chartRed: colors.error.default,        // #FF8080
  avatarBorder: colors.brand[500],       // #FF9A6D
} as const;

interface MenuItemProps {
  title: string;
  onPress: () => void;
  testID?: string;
}

function MenuItem({ title, onPress, testID }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
    >
      <Text variant="bodyMd2" style={styles.menuItemText}>
        {title}
      </Text>
      <Ionicons name="arrow-forward" size={16} color={PROFILE_COLORS.arrowOrange} />
    </TouchableOpacity>
  );
}

interface PaymentHistoryChartProps {
  data: Array<{ month: string; status: 'ontime' | 'late' | 'unpaid' }>;
  selectedMonth?: string;
}

// Figma Chart: 345px wide with horizontal scroll, 161px height
// Bar columns are 24px wide with 16px gap, bars are 16px wide white rectangles
const CHART_COLUMN_WIDTH = 24;
const CHART_GAP = 16;
const CHART_BAR_WIDTH = 16;
const CHART_HEIGHT = 161;
const CHART_PADDING_H = 16;

function PaymentHistoryChart({ data, selectedMonth = 'JAN' }: PaymentHistoryChartProps) {
  // Calculate total width based on number of items
  const chartContentWidth = CHART_PADDING_H * 2 + data.length * CHART_COLUMN_WIDTH + (data.length - 1) * CHART_GAP;

  return (
    <View style={styles.chartContainer}>
      {/* Horizontal scrolling chart per Figma */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScrollContent}
      >
        <View style={[styles.chartInner, { width: chartContentWidth }]}>
          {/* Vertical divider line on left */}
          <View style={styles.chartDividerLine} />

          {/* Bar columns */}
          <View style={styles.chartBarsContainer}>
            {data.map((item, index) => {
              // Heights: ontime=99, late=56, unpaid=1 (per Figma extraction)
              const barHeight = item.status === 'ontime' ? 99 : item.status === 'late' ? 56 : 1;
              const isSelected = item.month === selectedMonth;
              const barColor = item.status === 'unpaid' ? PROFILE_COLORS.divider : colors.white;

              return (
                <View key={item.month} style={styles.chartColumn}>
                  {/* Bar */}
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: barHeight,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                  {/* Month label */}
                  <Text
                    style={[
                      styles.chartMonthLabel,
                      isSelected && styles.chartMonthLabelSelected,
                    ]}
                  >
                    {item.month}
                  </Text>
                  {/* Vertical divider after each column */}
                  {index < data.length - 1 && <View style={styles.chartColumnDivider} />}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Legend - Figma: white pills with black text */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <Text style={styles.legendText}>on time</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendText}>Paid late</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendText}>Not Paid</Text>
        </View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, tenancy } = useDashboard();
  const { signOut } = useAuth();
  const { data: paymentHistory } = usePaymentHistory();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleViewAgreement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/agreement' as never);
  }, [router]);

  const handleEditUPI = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/payment-methods' as never);
  }, [router]);

  const handleEditCreditCard = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/payment-methods' as never);
  }, [router]);

  const handleEditBankAccount = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/payment-methods' as never);
  }, [router]);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/help' as never);
  }, [router]);

  const handleRateApp = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Open app store rating
  }, []);

  const handleSignOut = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
    router.replace('/(auth)/splash' as never);
  }, [signOut, router]);

  const handleDeleteAccount = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // TODO: Show delete account confirmation
  }, []);

  // Mock payment history data for chart - 12 months per Figma
  const chartData = useMemo(() => {
    return [
      { month: 'JAN', status: 'ontime' as const },
      { month: 'FEB', status: 'late' as const },
      { month: 'MAR', status: 'unpaid' as const },
      { month: 'APR', status: 'unpaid' as const },
      { month: 'MAY', status: 'unpaid' as const },
      { month: 'JUN', status: 'unpaid' as const },
      { month: 'JUL', status: 'unpaid' as const },
      { month: 'AUG', status: 'unpaid' as const },
      { month: 'SEP', status: 'unpaid' as const },
      { month: 'OCT', status: 'unpaid' as const },
      { month: 'NOV', status: 'unpaid' as const },
      { month: 'DEC', status: 'unpaid' as const },
    ];
  }, []);

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'User';
  const joinDate = '15th sept 9:40am'; // Mock date - actual implementation would use user metadata

  return (
    <Screen testID="profile-screen">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={PROFILE_COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Title - Figma 41:8764: "My" #A9A9A9 + line break + "Profile" #FF9A6D */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleMy}>My </Text>
          <Text style={styles.titleProfile}>Profile</Text>
        </View>

        {/* Your Payment History Section */}
        <View style={styles.section}>
          <Text variant="overline" style={styles.sectionTitle}>
            YOUR PAYMENT HISTORY
          </Text>
          <View style={styles.chartCard}>
            <PaymentHistoryChart data={chartData} selectedMonth="MAR" />
          </View>
        </View>

        {/* Secured Account Section */}
        <View style={styles.section}>
          <Text variant="overline" style={styles.sectionTitle}>
            SECURED ACCOUNT
          </Text>
          <View style={styles.menuStack}>
            {/* User Info Row */}
            <TouchableOpacity style={styles.userInfoRow} accessibilityRole="button">
              <View style={styles.avatarContainer}>
                <Image
                  source={require('@/assets/images/profile-avatar.png')}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{fullName}</Text>
                <View style={styles.userSubtitleRow}>
                  <Text style={styles.userJoinDate}>{joinDate}</Text>
                  <Text style={styles.userCardInfo}>Credit Card XX25</Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={16} color={PROFILE_COLORS.arrowOrange} />
            </TouchableOpacity>

            <MenuItem
              title="View Agreement"
              onPress={handleViewAgreement}
              testID="view-agreement-button"
            />
          </View>
        </View>

        {/* Payment Information Section */}
        <View style={styles.section}>
          <Text variant="overline" style={styles.sectionTitle}>
            PAYMENT INFORMATION
          </Text>
          <View style={styles.menuStack}>
            <MenuItem
              title="Edit UPI Method"
              onPress={handleEditUPI}
              testID="edit-upi-button"
            />
            <MenuItem
              title="Edit Credit Card"
              onPress={handleEditCreditCard}
              testID="edit-credit-card-button"
            />
            <MenuItem
              title="Edit Bank Account"
              onPress={handleEditBankAccount}
              testID="edit-bank-account-button"
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text variant="overline" style={styles.sectionTitle}>
            SUPPORT
          </Text>
          <View style={styles.menuStack}>
            <MenuItem
              title="Contact Support"
              onPress={handleContactSupport}
              testID="contact-support-button"
            />
            <MenuItem
              title="Rate the App"
              onPress={handleRateApp}
              testID="rate-app-button"
            />
          </View>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text variant="overline" style={styles.sectionTitle}>
            APP
          </Text>
          <View style={styles.menuStack}>
            <MenuItem
              title="Sign Out"
              onPress={handleSignOut}
              testID="sign-out-button"
            />
            <MenuItem
              title="Delete Account"
              onPress={handleDeleteAccount}
              testID="delete-account-button"
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: PROFILE_COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,  // 40px per Figma
  },
  backButton: {
    width: 32,  // Figma: 32x32
    height: 32,
    justifyContent: 'center',
    marginBottom: spacing.lg,  // 24px gap to title
  },
  titleContainer: {
    marginBottom: spacing.xxl,
  },
  titleMy: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    color: '#A9A9A9',  // Figma 41:8764: "My" in gray
    letterSpacing: -2,
  },
  titleProfile: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    color: '#FF9A6D',  // Figma 41:8764: "Profile" in brand orange
    letterSpacing: -2,
  },
  section: {
    marginBottom: spacing.xxl,  // 40px gap between sections per Figma
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16.92,  // Figma: 16.92
    letterSpacing: 0,
    color: PROFILE_COLORS.sectionTitle,  // #878787 - Figma verified
    textTransform: 'uppercase',
    textAlign: 'left',
    marginBottom: spacing.lg,  // 24px gap to content per Figma
  },
  menuStack: {
    gap: 4,  // Figma: itemSpacing 4 between cards
  },
  chartCard: {
    backgroundColor: PROFILE_COLORS.cardBackground,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  chartContainer: {
    alignItems: 'flex-start',
  },
  chartScrollContent: {
    paddingHorizontal: 0,
  },
  chartInner: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  chartDividerLine: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: PROFILE_COLORS.divider,  // #4D4D4D
    borderRadius: 8,
  },
  chartBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: CHART_GAP,
    paddingHorizontal: CHART_PADDING_H,
    height: CHART_HEIGHT,
  },
  chartColumn: {
    width: CHART_COLUMN_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 9,  // Figma: gap 9 between bar and label
  },
  chartBar: {
    width: CHART_BAR_WIDTH,
    backgroundColor: colors.white,
  },
  chartMonthLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: PROFILE_COLORS.sectionTitle,  // #878787
    textAlign: 'center',
  },
  chartMonthLabelSelected: {
    color: PROFILE_COLORS.accentOrange,  // #FF9A6D
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  chartColumnDivider: {
    position: 'absolute',
    right: -CHART_GAP / 2 - 0.25,
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: PROFILE_COLORS.divider,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,  // Figma: gap 10 between legend items
    marginTop: spacing.lg,  // Figma: 24px gap from chart to legend
    alignSelf: 'flex-start',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,  // Figma: #FFFFFF white pills
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 40,  // Figma: cornerRadius 40 (pill)
    minHeight: 25,
  },
  legendText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,  // Figma: -0.24
    color: '#000000',  // Figma: #000000 black text on white pills
    textAlign: 'center',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 16,  // Figma: itemSpacing 16
    backgroundColor: PROFILE_COLORS.cardBackground,  // #202020
    borderRadius: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userDetails: {
    flex: 1,
    gap: 4,  // Figma: itemSpacing 4
  },
  userSubtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,  // Figma: itemSpacing 8
  },
  userName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 19.74,
    letterSpacing: -0.56,
    color: colors.white,  // Figma: #FFFFFF
  },
  userJoinDate: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: PROFILE_COLORS.sectionTitle,  // #878787
  },
  userCardInfo: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 19.74,
    letterSpacing: -0.56,
    color: PROFILE_COLORS.sectionTitle,  // #878787 - Figma: fill color
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,  // Figma: 24px horizontal padding
    backgroundColor: PROFILE_COLORS.cardBackground,  // #202020
    borderRadius: 12,  // Figma: cornerRadius 12
  },
  menuItemText: {
    color: PROFILE_COLORS.menuItemText,  // #CBCBCB - Figma verified
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,                      // Figma: "View Agreement" node lineHeightPx 20.0
    letterSpacing: 0,                    // Figma: "View Agreement" node letterSpacing 0.0
    textAlign: 'left',
  },
});
