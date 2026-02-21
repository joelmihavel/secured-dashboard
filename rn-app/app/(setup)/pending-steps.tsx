/**
 * Pending Steps / Personalized Cashback Plan Screen
 * Figma Reference: 1-34236
 *
 * Screen: "onboarding / summary"
 * Blueprint: /buildbot/data/blueprints/1-34236-blueprint.json
 *
 * Figma structure:
 * - Background: #131313 + DottedPattern + Background Shape
 * - Vector 45 (decorative grid lines at y:462)
 * - Title (160:3185): "Here is your personalized cashback plan"
 *   - x:62, y:128, width:269, height:168
 *   - fontSize 40, lineHeight 56, letterSpacing -1, PlusJakartaSans-Medium
 *   - Spans: "Here is your " (0-12) = #A9A9A9, newline (12-13) = #FFFFFF,
 *     "personalized cashback plan" (13-39) = #FF9A6D
 * - Card (1:34308): x:61, y:371, width:270, height:321
 *   - Rectangle 136 bg: #202020, shadow rgba(0,0,0) y:9 blur:19
 *   - Perforations, avatar circle, user name, welcome text
 *   - Cashback rate section, monthly amount
 *   - Flent logo vector (32x38.4, #A9A9A9)
 * - Start Earning button (I1:34342): 313x52, border #FF9A6D, radius 8
 *   - Text: "Start Earning" -- 14/20, #FFFFFF, PlusJakartaSans-Medium
 *
 * The "Start Earning" button is a floating CTA at bottom.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Screen, Text, Logo } from '@/src/components';
import { DottedPattern } from '@/src/components/patterns/DottedPattern';
import { useDashboard } from '@/src/hooks';
import { colors } from '@/src/theme';
import { s } from '@/src/theme/scale';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Figma exact values from 1-34236 blueprint
const FIGMA = {
  // Background
  backgroundColor: colors.black[700],

  // Title (node 160:3185)
  title: {
    width: s(269),
  },

  // Card (node 1:34308)
  card: {
    width: s(270),
    height: s(321),
    backgroundColor: colors.black[500],
    shadowColor: colors.black[900],
    shadowOffsetY: s(9),
    shadowRadius: s(19),
  },

  // Grid / Decorative lines
  gridLineColor: colors.black[400],
  gridStrokeWidth: 1,

  // Perforations
  perforationSize: s(14),

  // Button (I1:34342;100:1564)
  button: {
    width: s(313),
    height: s(52),
    borderColor: colors.brand[500],
    borderRadius: s(8),
    shadowColor: '#995C41',
    shadowOffsetY: s(6),
    shadowRadius: s(12),
  },
} as const;

// Decorative grid lines from Figma Vector 45 at y:462
function GridBackground() {
  return (
    <View style={gridStyles.container} pointerEvents="none">
      <Svg width="100%" height="235" style={StyleSheet.absoluteFill}>
        <G stroke={FIGMA.gridLineColor} strokeWidth={FIGMA.gridStrokeWidth} opacity={0.5}>
          {/* Vertical line at x ~37 (from vector path) */}
          <Line x1="37" y1="0" x2="37" y2="235" />
          {/* Vertical line at x ~339 */}
          <Line x1="339" y1="0" x2="339" y2="235" />
          {/* Horizontal line at y ~198 */}
          <Line x1="0" y1="198" x2="369" y2="198" />
        </G>
      </Svg>
    </View>
  );
}

const gridStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: s(462),
    left: s(12),
    right: s(12),
    height: s(235),
  },
});

export default function PendingStepsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, tenancy } = useDashboard();

  // User data for display
  const userName = user?.first_name
    ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
    : 'Rohan Joshi';
  const cashbackRate = 1;
  const monthlyRent = tenancy?.monthly_rent ?? 32175;
  const monthlyCashback = Math.floor(monthlyRent * cashbackRate / 100);

  const handleStartEarning = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(main)' as never);
  }, [router]);

  return (
    <Screen testID="pending-steps-screen" padded={false} style={{ backgroundColor: FIGMA.backgroundColor }}>
      {/* Background pattern */}
      <DottedPattern backgroundShape="summary" />

      {/* Grid decorative lines */}
      <GridBackground />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + s(48) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title -- Figma 160:3185 */}
        <View style={styles.titleContainer}>
          <Text variant="h2" color="muted">
            Here is your{"\n"}
            <Text inherit color="accent">personalized cashback plan</Text>
          </Text>
        </View>

        {/* Cashback Card -- Figma 1:34308 */}
        <View style={styles.cardContainer}>
          <View style={styles.card}>
            {/* Top perforations */}
            <View style={styles.cardPerforations}>
              {[...Array(8)].map((_, i) => (
                <View key={i} style={styles.perforation} />
              ))}
            </View>

            {/* Card header with Flent logo */}
            <View style={styles.cardHeader}>
              <Logo size={s(24)} color={colors.white} />
              <View style={styles.logoRight}>
                <Logo size={s(38)} color={colors.neutral[500]} />
              </View>
            </View>

            {/* Welcome section -- avatar + name + subtitle */}
            <View style={styles.welcomeSection}>
              {/* Avatar -- Figma: Ellipse 8, 32x32 circle */}
              <View style={styles.avatar}>
                <Text inherit variant="bodyMd2Medium" style={{ color: colors.white }}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.nameContainer}>
                <Text variant="bodyMd2Medium" color="primary">{userName}</Text>
                <Text variant="bodySm" color="muted">Welcome to Flent Secured</Text>
              </View>
            </View>

            {/* Cashback section -- Figma 1:34335 */}
            <View style={styles.cashbackSection}>
              <View style={styles.cashbackHeaderRow}>
                <Text variant="bodySm" color="muted">Your Cashback Rate</Text>
              </View>

              <View style={styles.cashbackRateSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.cashbackBadge}>
                    <Text variant="bodySmSemiBold" style={{ color: colors.black[900] }}>
                      {cashbackRate}% back
                    </Text>
                  </View>
                  <Text variant="bodyMd2" color="muted">on every on-time rent</Text>
                </View>

                {/* Monthly amount -- Figma 1:34341 */}
                <View style={styles.amountRow}>
                  <Text variant="bodyMd" color="primary">
                    <Text inherit variant="bodySm">₹  </Text>
                    {monthlyCashback.toLocaleString('en-IN')}
                    <Text inherit variant="bodyMd2" color="muted"> /month</Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* Side perforations at bottom */}
            <View style={styles.cardSidePerforations}>
              <View style={[styles.perforationLarge, styles.perforationLeft]} />
              <View style={[styles.perforationLarge, styles.perforationRight]} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom button -- Figma I1:34342 */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + s(24) }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleStartEarning}
          testID="start-earning-button"
        >
          <Text variant="button" color="primary" style={{ color: colors.white }}>
            Start Earning
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: s(62),
  },
  titleContainer: {
    width: FIGMA.title.width,
    marginBottom: s(32),
  },
  cardContainer: {
    alignItems: 'center',
    marginBottom: s(32),
  },
  card: {
    width: FIGMA.card.width,
    height: FIGMA.card.height,
    backgroundColor: FIGMA.card.backgroundColor,
    overflow: 'hidden',
    shadowColor: FIGMA.card.shadowColor,
    shadowOffset: { width: 0, height: FIGMA.card.shadowOffsetY },
    shadowOpacity: 0.1,
    shadowRadius: FIGMA.card.shadowRadius,
    elevation: 10,
  },
  cardPerforations: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: s(4),
    marginTop: s(-7),
  },
  perforation: {
    width: FIGMA.perforationSize,
    height: FIGMA.perforationSize,
    borderRadius: FIGMA.perforationSize / 2,
    backgroundColor: colors.black[700],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: s(26),
    paddingTop: s(16),
  },
  logoRight: {},
  welcomeSection: {
    paddingHorizontal: s(26),
    paddingTop: s(12),
    marginBottom: s(24),
  },
  avatar: {
    width: s(32),
    height: s(32),
    borderRadius: s(16),
    backgroundColor: '#E91E63',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s(8),
  },
  nameContainer: {
    gap: s(4),
  },
  cashbackSection: {
    paddingHorizontal: s(26),
    gap: s(4),
  },
  cashbackHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: s(8),
  },
  cashbackRateSection: {
    gap: s(12),
  },
  cashbackBadge: {
    backgroundColor: colors.brand[500],
    borderRadius: s(4),
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    marginRight: s(8),
  },
  amountRow: {
    marginTop: s(4),
  },
  cardSidePerforations: {
    position: 'absolute',
    bottom: s(24),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  perforationLarge: {
    width: FIGMA.perforationSize,
    height: FIGMA.perforationSize,
    borderRadius: FIGMA.perforationSize / 2,
    backgroundColor: colors.black[700],
  },
  perforationLeft: {
    marginLeft: s(-7),
  },
  perforationRight: {
    marginRight: s(-7),
  },
  buttonContainer: {
    paddingHorizontal: s(40),
    paddingTop: s(16),
    alignItems: 'center',
  },
  button: {
    width: FIGMA.button.width,
    height: FIGMA.button.height,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FIGMA.button.borderColor,
    borderRadius: FIGMA.button.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.black[900],
    shadowColor: FIGMA.button.shadowColor,
    shadowOffset: { width: 0, height: FIGMA.button.shadowOffsetY },
    shadowOpacity: 0.24,
    shadowRadius: FIGMA.button.shadowRadius,
    elevation: 8,
  },
});
