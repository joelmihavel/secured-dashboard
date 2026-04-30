/**
 * Agreement Intro Screen
 * Figma Node: 4651:76190
 *
 * Lands here right after sign-up OTP for new users. Explains why we need the
 * rental agreement (KYC compliance, cashback enablement) before sending them
 * to the upload screen. "Enter details manually" link bypasses the upload.
 */

import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { Marquee, TOP_MARQUEE_ITEMS, BOTTOM_MARQUEE_ITEMS } from '@/src/components/auth/landing-decor';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const VERIFY_CHIPS = [
  { emoji: '📍', label: 'Where you live' },
  { emoji: '💰', label: 'Your rent details' },
  { emoji: '👤', label: 'Your rental agreement' },
  { emoji: '🔐', label: 'Eligibility for Flent Secured' },
] as const;

export default function AgreementIntroScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const navigating = useRef(false);

  const handleUpload = useCallback(() => {
    if (navigating.current) return;
    navigating.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push('/(agreement)/upload' as never);
    setTimeout(() => { navigating.current = false; }, 1000);
  }, []);

  const handleManual = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push('/(agreement)/manual-entry' as never);
  }, []);

  return (
    <Screen padded={false} testID="agreement-intro-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Marquee bands — inline so they scroll up with the content */}
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
            <Text inherit style={styles.headingWhite}>Upload rental agreement{' '}</Text>
            <Text inherit style={styles.headingAccent}>to unlock cashback on your rent</Text>
          </Text>
          <Text style={styles.subtitle}>
            To ensure compliance with RBI KYC regulations, we will verify your rental information for rent payments and cashback.
          </Text>
        </View>

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

        {/* CTA + manual entry */}
        <View style={styles.ctaBlock}>
          <PrimaryButton
            title="Upload Agreement"
            onPress={handleUpload}
            showDivider
            testID="upload-agreement-button"
          />
          {/*<Pressable
            onPress={handleManual}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="enter-manually-link"
          >
            <Text style={styles.manualLink}>Enter details manually</Text>
          </Pressable>*/}
        </View>

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.black[700],
    flex: 1,
  },
  scrollContent: {
    paddingTop: sv(78),
    paddingBottom: sv(48),
    paddingHorizontal: s(40),
    // Section gap. Controls both subtitle→divider AND chips→Upload-Agreement.
    gap: sv(40),
  },

  // Inline marquee — scrolls with content
  marqueeStack: {
    marginHorizontal: -s(227),
  },
  marqueeRow: {
    width: s(847),
    alignSelf: 'center',
  },

  // Heading — Figma 4651:76216
  headerBlock: {
    gap: sv(10),
  },
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(28),
    lineHeight: sf(40),
    letterSpacing: -1,
  },
  headingWhite: {
    color: colors.white,
  },
  headingAccent: {
    color: colors.brand[500],
  },
  // Subtitle — Figma 4651:76217: Plus Jakarta Sans Medium, 12px, lh 21.6 (1.8), tracking -0.132.
  subtitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sf(12),
    lineHeight: sf(21.6),
    letterSpacing: -0.132,
    color: colors.neutral[500],
  },

  // Verify chips
  verifyBlock: {
    gap: sv(16),
    // paddingTop matches scrollContent.gap so the divider line has equal
    // breathing room on both sides (subtitle → line = line → title).
    paddingTop: sv(40),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.black[400],
  },
  // Figma 4651:76220 — Plus Jakarta Sans Regular, 16px, lh 24.
  verifyTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(16),
    lineHeight: sf(24),
    color: colors.white,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
  },
  // Tighter padding/text than Figma spec so chips pack 2-per-row on a 393-wide
  // viewport (Figma's 14px / 16px-pad chips wrap one-per-row in practice).
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[900],
    borderColor: colors.black[500],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 200,
    paddingHorizontal: s(14),
    paddingVertical: sv(10),
    gap: s(8),
  },
  chipEmoji: {
    // iOS emoji glyphs render taller than their reported lineHeight box —
    // an 18-line-height clipped the top of 📍/💰/💼/🔐. Drop fontSize
    // slightly and grow lineHeight so the glyph sits centered with room
    // on top + bottom.
    fontSize: sf(14),
    lineHeight: sf(22),
  },
  chipLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(13),
    lineHeight: sf(18),
    color: colors.neutral[500],
  },

  // CTA block
  ctaBlock: {
    alignItems: 'center',
    gap: sv(12),
  },
  // Figma 4651:76232 — 12px Regular, lh 20, neutral/500.
  manualLink: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: colors.neutral[500],
    textDecorationLine: 'underline',
  },

});
