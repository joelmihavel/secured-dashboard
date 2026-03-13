/**
 * Pending Steps / Personalized Cashback Plan Screen
 * Figma Reference: 684:4968
 *
 * Screen: "onboarding / summary"
 * Blueprint: Figma design HZaVuwWn6B6jOjrmxZ7Kzv
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, Image, Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Screen, Text, Logo, PrimaryButton } from '@/src/components';
import { BgLine } from '@/src/components/ui/BgLine';
import { DottedGridPattern } from '@/src/components/patterns';
import { useDashboard } from '@/src/hooks';
import { isJourneyMode, advanceJourneyStage } from '@/src/review/journeyMode';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

// Figma exact values from 684:4968 blueprint — scaled for device
const FIGMA = {
  // Background
  backgroundColor: colors.black[700],

  // Card (node 684:5039) — scaled
  card: {
    width: s(270),
    height: sv(321),
    backgroundColor: colors.black[500],
  },

  // Perforations — scaled
  perforationCount: 14,
  perforationSize: s(14),
  perforationStartX: s(4),
  perforationSpacing: s(20),
} as const;

function DecorativeVector({ x, y }: { x: number; y: number }) {
  return (
    <View style={[{ position: 'absolute', left: x, top: y }]} pointerEvents="none">
      <Svg width={23} height={41} viewBox="0 0 40 77" fill="none">
        <Path d="M9.31406 43.5656C6.31081 33.3271 2.93346 23.1227 0.285513 12.7861C-1.78135 4.71751 7.79641 -3.42527 15.3453 1.49182C17.5802 2.94776 18.5578 5.21169 19.3025 7.63414C20.6419 11.9912 21.8696 16.3857 23.1526 20.7596C26.1163 30.8633 29.4203 40.9296 32.0592 51.1234C34.6064 60.963 20.0241 64.5599 16.576 55.3506C12.9734 45.7289 18.4379 62.0525 15.5448 52.1895C15.1031 50.6838 17.4422 49.995 17.8845 51.5031C20.2408 59.5361 14.8808 40.9086 17.237 48.9413C17.8825 51.1418 18.2536 53.9553 19.5012 55.9455C22.7183 61.0772 31.1521 57.6639 29.7195 51.8099C27.7818 43.892 25.1069 36.085 22.8129 28.2646C20.78 21.3339 19.1796 14.0605 16.6596 7.28701C14.3132 0.980362 4.88219 1.41027 2.64005 7.80349C1.92735 9.836 2.31652 11.0471 2.86679 12.923C5.38623 21.5121 7.90574 30.1015 10.4252 38.6908C12.9447 47.2799 15.4643 55.8695 17.9837 64.4586C19.0499 68.0934 20.2951 72.0847 24.0086 73.814C28.2291 75.7798 34.0983 73.668 36.3873 69.7526C39.6346 64.1975 34.903 54.4459 33.3132 49.0261C30.7428 40.2632 28.1724 31.5005 25.6021 22.7378C25.1604 21.2321 27.4995 20.5435 27.9419 22.0514C30.7573 31.6495 33.5726 41.2475 36.3881 50.8458C38.1118 56.722 41.8552 64.5717 38.7363 70.558C36.7426 74.3842 32.1956 76.8618 27.9219 76.9942C22.4104 77.165 18.5051 73.3633 16.6564 68.4303C13.6442 60.3937 11.7275 51.7934 9.31406 43.5656Z" fill={colors.black[400]}/>
      </Svg>
    </View>
  );
}

// Decorative bg_line — Figma 768:303932 (Vector 45)

export default function PendingStepsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, tenancy } = useDashboard();

  // User data for display
  const userName = user?.first_name
    ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
    : 'Rohan Joshi';
  const cashbackRate = 1;
  const monthlyRent = tenancy?.monthly_rent ?? 32500;
  const monthlyCashback = Math.floor(monthlyRent * cashbackRate / 100);

  const handleStartEarning = useCallback(() => {
    if (isJourneyMode()) advanceJourneyStage(); // setup → active
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(main)' as never);
  }, [router]);

  return (
    <Screen testID="pending-steps-screen" padded={false} safeAreaTop={false} style={{ backgroundColor: FIGMA.backgroundColor }}>
      {/* Background pattern */}
      <DottedGridPattern fadeMask={false} />
      
      {/* Background Shape */}
      <Image 
        source={require('@/assets/images/background_shape.png')} 
        style={styles.backgroundShape} 
        resizeMode="contain" 
      />

      {/* Grid decorative lines — Figma 768:303932 */}
      <BgLine style={{ position: 'absolute', top: sv(462), left: s(12) }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title -- Figma 684:5074 */}
        <View style={styles.titleContainer}>
          <RNText style={styles.titleText}>
            <RNText style={styles.titleGray}>Here is your{'\n'}</RNText>
            <RNText style={styles.titleAccent}>personalized cashback plan</RNText>
          </RNText>
        </View>

        {/* Cashback Card -- Figma 684:5039 */}
        <View style={styles.cardContainer}>
          <View style={styles.card}>
            {/* Top perforations - 14 circles */}
            {[...Array(FIGMA.perforationCount)].map((_, i) => (
              <View
                key={`perf-${i}`}
                style={[
                  styles.perforation,
                  {
                    left: FIGMA.perforationStartX + i * FIGMA.perforationSpacing,
                    top: -4,
                  },
                ]}
              />
            ))}

            {/* Top Left Vector - 684:5058 */}
            <DecorativeVector x={8} y={-5} />

            {/* Top Right Logo - 684:5064 */}
            <View style={styles.logoRight}>
              <Logo size={38} color={colors.neutral[500]} />
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
                <Text variant="bodyMd2Medium" color="muted">{userName}</Text>
                <Text variant="bodySm" style={{ color: colors.neutral[600] }}>Welcome to Flent Secured</Text>
              </View>
            </View>

            {/* Cashback section -- Figma 684:5066 */}
            <View style={styles.cashbackSection}>
              <View style={styles.cashbackHeaderRow}>
                <Text variant="bodySm" style={{ color: colors.neutral[600] }}>Your Cashback Rate</Text>
              </View>

              <View style={styles.cashbackRateSection}>
                <View style={styles.cashbackBadgeContainer}>
                  <View style={styles.cashbackBadge}>
                    <Text variant="bodySmMedium" style={{ color: colors.black[900] }}>
                      {cashbackRate}% back
                    </Text>
                  </View>
                  <Text variant="bodyMd2Medium" color="muted">on every on-time rent</Text>
                </View>

                {/* Monthly amount -- Figma 684:5072 */}
                <View style={styles.amountRow}>
                  <Text style={styles.amountText}>
                    <Text inherit style={styles.amountSymbol}>₹  </Text>
                    {monthlyCashback.toLocaleString('en-IN')}
                    <Text inherit style={styles.amountUnit}> /month</Text>
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

      {/* Bottom button -- Figma 684:5073 */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.buttonWrapper}>
          <PrimaryButton
            title="Start Earning"
            onPress={handleStartEarning}
            showDivider
            testID="start-earning-button"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundShape: {
    position: 'absolute',
    left: s(-44),
    top: sv(-100),
    width: s(481),
    height: sv(405),
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: s(62), // Figma: left 62px — scaled
  },
  titleContainer: {
    width: s(269), // Figma 684:5074: width 269px — scaled
    marginBottom: sv(40),
  },
  titleText: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: weight 500
    fontSize: sf(40), // Figma: Scale/40 — scaled
    lineHeight: sf(56), // Figma: Line Height/Heading/h2
    letterSpacing: -1, // Figma: Paragraph Spacing/Heading/h2
  },
  titleGray: {
    color: '#A9A9A9', // Figma 684:5074: "Here is your" in neutral gray
  },
  titleAccent: {
    color: '#FF9A6D', // Figma 684:5074: "personalized cashback plan" in brand orange
  },
  cardContainer: {
    alignItems: 'center',
    marginBottom: sv(24),
    marginLeft: s(-1), // Adjusting to visually match x=61 if container is 62
  },
  card: {
    width: FIGMA.card.width,
    height: FIGMA.card.height,
    backgroundColor: FIGMA.card.backgroundColor,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: sv(24) },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  perforation: {
    position: 'absolute',
    width: FIGMA.perforationSize,
    height: FIGMA.perforationSize,
    borderRadius: FIGMA.perforationSize / 2,
    backgroundColor: colors.black[700],
  },
  logoRight: {
    position: 'absolute',
    left: s(218),
    top: sv(36),
  },
  welcomeSection: {
    position: 'absolute',
    left: s(26),
    top: sv(68),
    width: s(145),
    gap: sv(16),
  },
  avatar: {
    width: s(32),
    height: s(32),
    borderRadius: s(16),
    backgroundColor: '#E91E63',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameContainer: {
    gap: sv(8),
  },
  cashbackSection: {
    position: 'absolute',
    left: s(26),
    top: sv(216),
    width: s(233),
    gap: sv(4),
  },
  cashbackHeaderRow: {
    height: sv(20),
    justifyContent: 'center',
  },
  cashbackRateSection: {
    gap: sv(12),
  },
  cashbackBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cashbackBadge: {
    backgroundColor: colors.brand[500],
    borderRadius: 4,
    paddingHorizontal: s(6),
    paddingVertical: sv(2),
    marginRight: s(8),
    marginLeft: s(-4),
  },
  amountRow: {
    // No extra margin
  },
  amountText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: sf(16), // Figma 684:5072
    lineHeight: sf(23),
    color: colors.white,
  },
  amountSymbol: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: sf(12), // Figma: rupee symbol at 12px
    color: colors.white,
  },
  amountUnit: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sf(14), // Figma: "/month" at 14px
    color: colors.white,
  },
  cardSidePerforations: {
    position: 'absolute',
    top: sv(256),
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
    paddingHorizontal: s(40), // Figma 684:5073: left 40px — scaled
    paddingTop: sv(12),
    alignItems: 'center',
  },
  buttonWrapper: {
    width: s(297), // Figma 684:5073: width 297px — scaled
  },
});
