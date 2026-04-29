/**
 * Setup Rent Payments — Intro
 * Figma Node: 4651:76235
 *
 * Lands here from review (manual flow) or upload-extraction success.
 * Explains what we verify (bank details + PAN) and routes to the actual
 * bank/UPI form.
 */

import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Linking, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Screen, Text, PrimaryButton, DottedGridPattern } from '@/src/components';
import { Marquee, TOP_MARQUEE_ITEMS, BOTTOM_MARQUEE_ITEMS } from '@/src/components/auth/landing-decor';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const BG_SHAPE = require('../../assets/images/background_shape.png');

const VERIFY_CHIPS = [
  { emoji: '🏦', label: 'Bank account details' },
  { emoji: '💳', label: 'PAN for verification' },
] as const;

const RBI_KYC_URL = 'https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=11566';

export default function SetupIntroScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const navigating = useRef(false);
  // ?context=approved is set by the journey router for waitlist-approved users
  // so this same intro screen can lead into /(setup)/add-bank instead of the
  // pre-waitlist /(agreement)/add-bank-details. Default (unset) is pre-waitlist.
  const { context } = useLocalSearchParams<{ context?: string }>();
  const isPostApproval = context === 'approved';

  const handleAddDetails = useCallback(() => {
    if (navigating.current) return;
    navigating.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const target = isPostApproval ? '/(setup)/add-bank' : '/(agreement)/add-bank-details';
    routerRef.current.push(target as never);
    setTimeout(() => { navigating.current = false; }, 1000);
  }, [isPostApproval]);

  const handleDoItLater = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Pre-waitlist: skip → waitlist directly (same as AddBankForm.handleSkip).
    // Post-approval: not shown (see render).
    routerRef.current.replace('/(waitlist)' as never);
  }, []);

  const handleLearnMore = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(RBI_KYC_URL);
  }, []);

  return (
    <Screen padded={false} testID="setup-intro-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      {/* Decorative arch shape + faint dotted pattern, per Figma */}
      <Image
        source={BG_SHAPE}
        style={styles.bgShape}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <DottedGridPattern dotOpacity={0.08} animated={false} fadeMask={false} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Marquee bands — inline, scroll with content */}
        <View style={styles.marqueeStack} pointerEvents="none">
          <View style={[styles.marqueeRow, { transform: [{ rotate: '0.22deg' }] }]}>
            <Marquee items={TOP_MARQUEE_ITEMS} backgroundColor={colors.black[600]} />
          </View>
          <View style={[styles.marqueeRow, { transform: [{ rotate: '-0.48deg' }] }]}>
            <Marquee items={BOTTOM_MARQUEE_ITEMS} backgroundColor={colors.brand[600]} textColor={colors.black[700]} reverse />
          </View>
        </View>

        {/* Heading */}
        <View style={styles.headerBlock}>
          <Text style={styles.heading}>
            <Text inherit style={styles.headingWhite}>Set up</Text>
            {'\n'}
            <Text inherit style={styles.headingAccent}>rent payments</Text>
          </Text>
          <Text style={styles.subtitle}>
            Used to verify your landlord and enable secure rent payments.
          </Text>
        </View>

        <View style={styles.divider} />

        {/* "What we verify?" + chips */}
        <View style={styles.verifyBlock}>
          <Text style={styles.verifyTitle}>What we verify?</Text>
          <View style={styles.chipsWrap}>
            {VERIFY_CHIPS.map(({ emoji, label }) => (
              <View key={label} style={styles.chip}>
                <Text style={styles.chipEmoji}>{emoji}</Text>
                <Text style={styles.chipLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA + skip */}
        <View style={styles.ctaBlock}>
          <PrimaryButton
            title="Add landlord details"
            onPress={handleAddDetails}
            showDivider
            testID="add-landlord-details-button"
          />
          {!isPostApproval && (
            <Pressable
              onPress={handleDoItLater}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID="do-it-later"
            >
              <Text style={styles.skipLink}>Do it later</Text>
            </Pressable>
          )}
        </View>

        {/* Learn more card */}
        <Pressable
          style={styles.learnMoreCard}
          onPress={handleLearnMore}
          accessibilityRole="link"
          testID="rbi-kyc-link"
        >
          <Text style={styles.learnMoreText}>Learn more about RBI guidelines on KYC →</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.black[700],
    flex: 1,
  },
  bgShape: {
    position: 'absolute',
    top: sv(-100),
    left: '50%',
    width: s(481),
    height: sv(405),
    marginLeft: -s(481) / 2,
    opacity: 0.48,
  },
  scrollContent: {
    paddingTop: sv(78),
    paddingBottom: sv(48),
    paddingHorizontal: s(40),
    gap: sv(40),
  },

  marqueeStack: {
    marginHorizontal: -s(227),
  },
  marqueeRow: {
    width: s(847),
    alignSelf: 'center',
  },

  headerBlock: {
    gap: sv(16),
  },
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(28),
    lineHeight: sf(36),
    letterSpacing: -1,
  },
  headingWhite: { color: colors.white },
  headingAccent: { color: colors.brand[500] },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(13),
    lineHeight: sf(18),
    color: colors.neutral[500],
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.black[400],
  },

  verifyBlock: {
    gap: sv(16),
  },
  verifyTitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sf(16),
    lineHeight: sf(22),
    color: colors.white,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.black[500],
    borderRadius: 999,
    paddingHorizontal: s(14),
    paddingVertical: sv(10),
    gap: s(8),
  },
  chipEmoji: {
    fontSize: sf(15),
    lineHeight: sf(18),
  },
  chipLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(13),
    lineHeight: sf(18),
    color: colors.neutral[300],
  },

  ctaBlock: {
    alignItems: 'center',
    gap: sv(12),
  },
  skipLink: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(13),
    lineHeight: sf(18),
    color: colors.white,
    textDecorationLine: 'underline',
  },

  learnMoreCard: {
    backgroundColor: colors.black[500],
    borderRadius: 12,
    paddingVertical: sv(14),
    paddingHorizontal: s(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnMoreText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(13),
    lineHeight: sf(18),
    color: colors.brand[500],
    textDecorationLine: 'underline',
  },
});
