/**
 * Profile Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-8760
 *
 * Blueprint: buildbot/data/blueprints/41-8760-blueprint.json
 *
 * Layout hierarchy (from blueprint):
 * - Root frame (41:8760): Screen, bg #131313
 *   - Status bar frame (41:8878): handled by SafeArea
 *   - Main content frame (41:8761): column, gap=40, paddingBottom=48
 *     - Header frame (41:8762): column, gap=24, paddingH=40
 *       - Back arrow icon (41:8763): 32x32, rotated (left arrow), stroke #FFFFFF
 *       - Title text (41:8764): "My  Profile" 48px Regular, width=313 (forces 2-line wrap)
 *     - Payment history section (41:8765): column, gap=24, paddingH=40, clipsContent
 *       - Section title (41:8767): "Your payment history" 12px SemiBold #878787 uppercase
 *       - Chart wrapper (41:8768): column, gap=24, clipsContent
 *         - Chart bars frame (41:8769): row, gap=16, paddingH=16, width=345, height=161
 *         - Scroll indicator (41:8825): centered pill 24x2
 *     - Secured Account section (41:8828): column, gap=24, paddingH=40
 *       - Menu stack (41:8830): column, gap=4
 *         - User info row (41:8831): row, gap=16, padding 16/24, bg #202020, radius=12
 *         - View Agreement row (41:8839): row, gap=16, padding 16/24, bg #202020, radius=12
 *     - Payment Information section (41:8842): column, gap=24, paddingH=40
 *       - Card (41:8844): bg #202020, radius=12, gap=8, shadow
 *         - Edit UPI Method, divider, Edit Credit Card, divider, Edit Bank Account
 *     - Support section (41:8856): column, gap=24, paddingH=40
 *       - Card (41:8858): bg #202020, radius=12, gap=8, shadow
 *         - Contact Support, divider, Rate the App
 *     - App section (41:8866): column, gap=24, paddingH=40
 *       - Card (41:8868): bg #202020, radius=12, gap=8, shadow
 *         - Sign Out, divider, Delete Account
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text } from '@/src/components';
import { useDashboard, useAuth, usePaymentHistory } from '@/src/hooks';
import { colors } from '@/src/theme';

// Blueprint colors (verified against 41-8760-blueprint.json)
const FIGMA_COLORS = {
  background: colors.black[700],       // colors.black[700]
  cardBackground: colors.black[500],   // colors.black[500]
  sectionTitle: colors.neutral[600],     // colors.neutral[600]
  accentOrange: colors.brand[500],     // colors.brand[500]
  titleGray: colors.neutral[500],        // colors.neutral[500]
  textPrimary: colors.white,      // colors.white
  menuItemText: colors.neutral[300],     // colors.neutral[300]
  divider: colors.black[400],          // colors.black[400]
} as const;

// Demo chart data matching Figma design exactly (verified via Figma REST API node 41:8769)
// JAN: bar h=99, #FFFFFF, legend "on time" | FEB: bar h=56, #FFFFFF, legend "Paid late"
// MAR: bar h=1, #4D4D4D, legend "Not Paid", month label #FF9A6D | APR-DEC: bar h=1, #4D4D4D
const DEMO_CHART_DATA: Array<{ month: string; status: 'ontime' | 'late' | 'unpaid' }> = [
  { month: 'JAN', status: 'ontime' },
  { month: 'FEB', status: 'late' },
  { month: 'MAR', status: 'unpaid' },
  { month: 'APR', status: 'unpaid' },
  { month: 'MAY', status: 'unpaid' },
  { month: 'JUN', status: 'unpaid' },
  { month: 'JUL', status: 'unpaid' },
  { month: 'AUG', status: 'unpaid' },
  { month: 'SEP', status: 'unpaid' },
  { month: 'OCT', status: 'unpaid' },
  { month: 'NOV', status: 'unpaid' },
  { month: 'DEC', status: 'unpaid' },
];

interface MenuItemProps {
  title: string;
  onPress: () => void;
  testID?: string;
}

/**
 * MenuItem - Blueprint node pattern: row, gap=16, padding 16/24, bg #202020, radius=12
 * Text: 14px/20 Regular #CBCBCB, flex:1 (sizingH FILL via textAutoResize HEIGHT)
 * Arrow: 16x16 #FF9A6D
 */
function MenuItem({ title, onPress, testID }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text
        style={styles.menuItemText}
      >
        {title}
      </Text>
      <Ionicons name="arrow-forward" size={16} color={FIGMA_COLORS.accentOrange} />
    </TouchableOpacity>
  );
}

/**
 * CardMenuItem - For items inside a single card (Payment Info, Support, App sections)
 * Blueprint: row, justifyContent space-between, gap=16, padding 16/24
 * Text: 14px/20 Regular #CBCBCB
 * Arrow: 16x16 #FF9A6D
 */
function CardMenuItem({ title, onPress, testID }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.cardMenuRow}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={styles.menuItemText}>{title}</Text>
      <Ionicons name="arrow-forward" size={16} color={FIGMA_COLORS.accentOrange} />
    </TouchableOpacity>
  );
}

/** Thin divider inside card sections - Blueprint: #4D4D4D, 0.25 weight */
function CardDivider() {
  return <View style={styles.cardDivider} />;
}

interface PaymentHistoryChartProps {
  data: Array<{ month: string; status: 'ontime' | 'late' | 'unpaid' }>;
  selectedMonth?: string;
}

// Blueprint chart frame (41:8769): width=345, height=161
// Bar columns (41:8771 etc): 24px wide, gap=16 between columns
// Bars: 16px wide, heights: ontime=99, late=56, unpaid=1
// Unpaid bar color: #4D4D4D, other bars: #FFFFFF
// Chart padding: left=16, right=16
const CHART_COLUMN_WIDTH = 24;
const CHART_GAP = 16;
const CHART_BAR_WIDTH = 16;
const CHART_HEIGHT = 161;
const CHART_PADDING_H = 16;

function PaymentHistoryChart({ data, selectedMonth = 'MAR' }: PaymentHistoryChartProps) {
  const chartContentWidth = CHART_PADDING_H * 2 + data.length * CHART_COLUMN_WIDTH + (data.length - 1) * CHART_GAP;

  return (
    <View style={styles.chartContainer}>
      {/* Horizontal scrolling chart per blueprint */}
      <View style={styles.chartClipWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chartScrollContent}
        >
          <View style={[styles.chartInner, { width: chartContentWidth }]}>
            {/* First vertical divider line (dashed, #4D4D4D, 0.5 weight) */}
            <View style={styles.chartDividerLine} />

            {/* Bar columns */}
            <View style={styles.chartBarsContainer}>
              {data.map((item, index) => {
                // Heights from blueprint: ontime=99 (41:8772), late=56 (41:8778), unpaid=1 (41:8784)
                const barHeight = item.status === 'ontime' ? 99 : item.status === 'late' ? 56 : 1;
                const isSelected = item.month === selectedMonth;
                // Unpaid bars use #4D4D4D (41:8784), others use #FFFFFF (41:8772)
                const barColor = item.status === 'unpaid' ? FIGMA_COLORS.divider : colors.white;

                // Determine legend text if applicable (matching Figma demo state)
                let legendText = null;
                if (item.month === 'JAN') legendText = 'on time';
                else if (item.month === 'FEB') legendText = 'Paid late';
                else if (item.month === 'MAR') legendText = 'Not Paid';

                return (
                  <View key={item.month} style={styles.chartColumn}>
                    {/* Legend pill - absolute positioned above the bar */}
                    {legendText && (
                      <View style={[styles.legendItem, { position: 'absolute', top: -30 }]}>
                        <Text style={styles.legendText}>{legendText}</Text>
                      </View>
                    )}

                    {/* Bar rectangle */}
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: barHeight,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                    {/* Month label - blueprint: 12px/16.92 Regular, letterSpacing -0.24, center */}
                    <Text
                      style={[
                        styles.chartMonthLabel,
                        isSelected && styles.chartMonthLabelSelected,
                      ]}
                    >
                      {item.month}
                    </Text>
                    {/* Vertical dashed dividers between columns */}
                    {index < data.length - 1 && <View style={styles.chartColumnDivider} />}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Scroll indicator - blueprint (41:8825/41:8826): centered pill 24x2, bg #4D4D4D, radius 100 */}
      <View style={styles.scrollIndicatorContainer}>
        <View style={styles.scrollIndicator}>
          <View style={styles.scrollIndicatorProgress} />
        </View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useDashboard();
  const { signOut } = useAuth();
  const { data: paymentHistoryData } = usePaymentHistory();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleViewAgreement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/agreement' as never);
  }, [router]);

  const handleUserProfile = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/edit' as never);
  }, [router]);

  const handleEditPaymentMethod = useCallback((tab: 'upi' | 'credit' | 'bank') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/(profile)/payment-methods' as never, params: { tab } });
  }, [router]);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/help' as never);
  }, [router]);

  const handleRateApp = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/about' as never);
  }, [router]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  }, [signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Wire to delete account edge function
          },
        },
      ],
    );
  }, []);

  // Chart data from real payment history, or demo data when empty
  const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const chartData = useMemo(() => {
    const payments = paymentHistoryData?.payments ?? [];

    if (payments.length === 0) {
      return DEMO_CHART_DATA;
    }

    const monthStatusMap = new Map<number, 'ontime' | 'late' | 'unpaid'>();
    for (const payment of payments) {
      if (!payment.rent_month) continue;
      const parts = payment.rent_month.split('-');
      const monthIndex = parseInt(parts[1], 10) - 1;
      if (monthIndex < 0 || monthIndex > 11) continue;

      if (payment.status === 'success') {
        const paidDate = payment.paid_at ? new Date(payment.paid_at) : null;
        const isLate = paidDate ? paidDate.getDate() > 7 : false;
        monthStatusMap.set(monthIndex, isLate ? 'late' : 'ontime');
      } else if (payment.status === 'failed') {
        if (!monthStatusMap.has(monthIndex)) {
          monthStatusMap.set(monthIndex, 'unpaid');
        }
      }
    }

    return MONTH_LABELS.map((month, index) => ({
      month,
      status: monthStatusMap.get(index) ?? 'unpaid',
    }));
  }, [paymentHistoryData]);

  const [avatarError, setAvatarError] = useState(false);

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'User';
  const initials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const joinDate = '15th sept 9:40am'; // Blueprint placeholder text

  return (
    <Screen testID="profile-screen" padded={false}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main content frame (41:8761): column, gap=40, paddingBottom=48 */}
        <View style={styles.mainContent}>
          {/* Header frame (41:8762): column, gap=24, paddingH=40 */}
          <View style={styles.headerSection}>
            {/* Back arrow (41:8763): 32x32, stroke #FFFFFF */}
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={FIGMA_COLORS.textPrimary} />
            </TouchableOpacity>

            {/* Title (41:8764): "My  Profile" single text with spans */}
            {/* Blueprint: width=313, height=128 (2 lines x 64px lineHeight) */}
            <Text style={styles.titleBase}>
              <Text inherit style={styles.titleMy}>{'My '}</Text>
              <Text inherit style={styles.titleSpace}>{' '}</Text>
              <Text inherit style={styles.titleProfile}>{'Profile'}</Text>
            </Text>
          </View>

          {/* Payment History section (41:8765): column, gap=24, paddingH=40, clipsContent */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Your payment history
            </Text>
            {/* Chart wrapper (41:8768): NO background fill, gap=24 */}
            <PaymentHistoryChart data={chartData} selectedMonth="MAR" />
          </View>

          {/* Secured Account section (41:8828): column, gap=24, paddingH=40 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Secured Account
            </Text>
            {/* Menu stack (41:8830): column, gap=4 */}
            <View style={styles.menuStack}>
              {/* User Info Row (41:8831): row, gap=16, padding 16/24, bg #202020, radius=12 */}
              <TouchableOpacity
                style={styles.userInfoRow}
                onPress={handleUserProfile}
                accessibilityRole="button"
                accessibilityLabel={`View profile for ${fullName}`}
              >
                <View style={styles.avatarContainer}>
                  {avatarError ? (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  ) : (
                    <Image
                      source={require('@/assets/images/profile-avatar.png')}
                      style={styles.avatar}
                      resizeMode="cover"
                      onError={() => setAvatarError(true)}
                    />
                  )}
                </View>
                {/* User details (41:8833): column, gap=4, flex=1 */}
                {/* Note: Credit Card XX25 (41:8837) has fill.visible=false in Figma -- NOT shown */}
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{fullName}</Text>
                  <Text style={styles.userJoinDate}>{joinDate}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={FIGMA_COLORS.accentOrange} />
              </TouchableOpacity>

              {/* View Agreement (41:8839) */}
              <MenuItem
                title="View Agreement"
                onPress={handleViewAgreement}
                testID="view-agreement-button"
              />
            </View>
          </View>

          {/* Payment Information section (41:8842): column, gap=24, paddingH=40 */}
          {/* Card (41:8844): single card bg #202020, radius=12, gap=8, with dividers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Payment Information
            </Text>
            <View style={styles.cardContainer}>
              <CardMenuItem
                title="Edit UPI Method"
                onPress={() => handleEditPaymentMethod('upi')}
                testID="edit-upi-button"
              />
              <CardDivider />
              <CardMenuItem
                title="Edit Credit Card"
                onPress={() => handleEditPaymentMethod('credit')}
                testID="edit-credit-card-button"
              />
              <CardDivider />
              <CardMenuItem
                title="Edit Bank Account"
                onPress={() => handleEditPaymentMethod('bank')}
                testID="edit-bank-account-button"
              />
            </View>
          </View>

          {/* Support section (41:8856): column, gap=24, paddingH=40 */}
          {/* Card (41:8858): single card bg #202020, radius=12, gap=8, with dividers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              support
            </Text>
            <View style={styles.cardContainer}>
              <CardMenuItem
                title="Contact Support"
                onPress={handleContactSupport}
                testID="contact-support-button"
              />
              <CardDivider />
              <CardMenuItem
                title="Rate the App"
                onPress={handleRateApp}
                testID="rate-app-button"
              />
            </View>
          </View>

          {/* App section (41:8866): column, gap=24, paddingH=40 */}
          {/* Card (41:8868): single card bg #202020, radius=12, gap=8, with dividers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              App
            </Text>
            <View style={styles.cardContainer}>
              <CardMenuItem
                title="Sign Out"
                onPress={handleSignOut}
                testID="sign-out-button"
              />
              <CardDivider />
              <CardMenuItem
                title="Delete Account"
                onPress={handleDeleteAccount}
                testID="delete-account-button"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // No paddingHorizontal - each section has its own paddingH=40 per blueprint
  },
  // Main content frame (41:8761): column, gap=40, paddingBottom=48
  mainContent: {
    flexDirection: 'column',
    gap: 40,           // Blueprint: itemSpacing 40
    paddingBottom: 48,  // Blueprint: padding.bottom 48
  },
  // Header frame (41:8762): column, gap=24, paddingH=40
  headerSection: {
    flexDirection: 'column',
    gap: 24,                  // Blueprint: itemSpacing 24
    paddingHorizontal: 40,    // Blueprint: padding left=40, right=40
  },
  // Back button (41:8763): 32x32
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  // Title base: 48px/64 Regular, letterSpacing -2
  // Blueprint (41:8764): width=313, height=128 -> forces 2-line wrap on "My  Profile"
  titleBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    color: colors.white,
    maxWidth: 313,    // Blueprint: text node width=313, forces 2-line wrap
  },
  // "My " span (chars 0-3): #A9A9A9
  titleMy: {
    color: colors.neutral[500],
  },
  // " " span (chars 3-4): inherits default #FFFFFF
  titleSpace: {
    color: colors.white,
  },
  // "Profile" span (chars 4-11): #FF9A6D
  titleProfile: {
    color: colors.brand[500],
  },
  // Section container: column, gap=24, paddingH=40
  section: {
    flexDirection: 'column',
    gap: 24,
    paddingHorizontal: 40,
  },
  // Section title: 12px/16.92 SemiBold #878787, letterSpacing 0, uppercase
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: 0,
    color: colors.neutral[600],
    textTransform: 'uppercase',
    textAlign: 'left',
  },
  // Menu stack (41:8830): column, gap=4
  menuStack: {
    gap: 4,
  },
  // Chart container - NO background (blueprint 41:8768 has no fills)
  chartContainer: {
    flexDirection: 'column',
    gap: 24, // Blueprint: 41:8768 gap=24 between chart and scroll indicator
  },
  // Clip wrapper for chart - matches Figma clipsContent=true on 41:8768
  chartClipWrapper: {
    overflow: 'hidden',
  },
  chartScrollContent: {
    paddingHorizontal: 0,
  },
  // Chart inner (41:8769): row, gap=16, paddingH=16, height=161, alignItems flex-end
  chartInner: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // Legend container - positioned at top of chart area
  // Blueprint: pills at y=6 (column.y=36 + pill.y=-30 = 6) within chart bars frame
  legendContainer: {
    position: 'absolute',
    top: 6,
    left: CHART_PADDING_H,
    flexDirection: 'row',
    gap: 10,            // Blueprint: gap 10
    zIndex: 1,
  },
  // Legend pill (41:8774 etc): bg #FFFFFF, borderRadius=40, padding 4/8, row, center
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 40,
  },
  // Legend text: 12px/16.92 Regular #000000, letterSpacing -0.24, center
  legendText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: colors.black[900],
    textAlign: 'center',
  },
  // First vertical divider (41:8770): dashed line, stroke #4D4D4D, 0.5 weight
  chartDividerLine: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: FIGMA_COLORS.divider,
    borderRadius: 8,
  },
  // Bar columns container
  chartBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: CHART_GAP,
    paddingHorizontal: CHART_PADDING_H,
    height: CHART_HEIGHT,
  },
  // Individual chart column (41:8771 etc): column, width=24, gap=9, alignItems center
  chartColumn: {
    width: CHART_COLUMN_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 9,
  },
  // Bar rectangle: width=16
  chartBar: {
    width: CHART_BAR_WIDTH,
    borderRadius: 2,
  },
  // Month label: 12px/16.92 Regular #878787, letterSpacing -0.24, center
  chartMonthLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  // Selected month: same font but color #FF9A6D
  chartMonthLabelSelected: {
    color: colors.brand[500],
  },
  // Dashed vertical dividers between columns
  chartColumnDivider: {
    position: 'absolute',
    right: -CHART_GAP / 2 - 0.25,
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: FIGMA_COLORS.divider,
  },
  // Scroll indicator (41:8825): centered
  scrollIndicatorContainer: {
    alignItems: 'center',
  },
  // Scroll indicator pill (41:8826): 24x2, bg #4D4D4D, radius=100
  scrollIndicator: {
    width: 24,
    height: 2,
    backgroundColor: colors.black[400],
    borderRadius: 100,
    overflow: 'hidden',
  },
  // Progress portion (41:8827): 7x2, bg #FF9A6D
  scrollIndicatorProgress: {
    width: 7,
    height: 2,
    backgroundColor: colors.brand[500],
  },
  // Card container for Payment Info / Support / App sections
  // Blueprint (41:8844, 41:8858, 41:8868): bg #202020, radius=12, gap=8, drop shadows
  cardContainer: {
    backgroundColor: colors.black[500],
    borderRadius: 12,
    gap: 8,
    // Blueprint: 3 drop shadows (largest shadow)
    shadowColor: colors.black[900],
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.1,
    shadowRadius: 9.5,  // blur 19 / 2
    elevation: 4,
  },
  // Row inside card: justifyContent space-between, gap=16, padding 16/24
  cardMenuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  // Divider inside card: #4D4D4D, 0.25 weight
  cardDivider: {
    height: 0.25,
    backgroundColor: colors.black[400],
  },
  // User info row (41:8831): row, gap=16, padding 16/24, bg #202020, radius=12
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: colors.black[500],
    borderRadius: 12,
  },
  // Avatar (41:8832): 48x48 ellipse with image fill
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
  // Fallback when profile-avatar.png fails to load
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: colors.black[700],
    textAlign: 'center',
  },
  // User details (41:8833): column, gap=4, grow=1 (flex=1)
  userDetails: {
    flex: 1,
    gap: 4,
  },
  // User name (41:8834): 14px/19.74 Medium #FFFFFF, letterSpacing -0.56
  userName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 19.74,
    letterSpacing: -0.56,
    color: colors.white,
  },
  // Join date (41:8836): 12px/16.92 Regular #878787, letterSpacing -0.24
  userJoinDate: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: colors.neutral[600],
  },
  // Menu item row (41:8839 pattern): row, gap=16, padding 16/24, bg #202020, radius=12
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: colors.black[500],
    borderRadius: 12,
  },
  // Menu item text (41:8840): 14px/20 Regular #CBCBCB, letterSpacing 0
  menuItemText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    color: colors.neutral[300],
    textAlign: 'left',
  },
});
