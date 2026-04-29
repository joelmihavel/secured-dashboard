/**
 * Invite Landlord — Intro Screen
 * Figma Node: 4651:144441 ("Onboarding / address proof --1")
 *
 * Entry point for the invite-landlord flow. Sells the "why" before asking
 * for the landlord's phone. Layout (top→bottom, gap 32):
 *  - Marquee bands (rotated)
 *  - Header row: Logo + "Invite Landlord" gradient pill (CTA → form)
 *  - Title "Invite\nyour landlord" + subtitle (gap 40 between header & title)
 *  - Hairline divider
 *  - "What we'll do?" + 3 stepped rows (icon + title + body)
 *  - Hairline divider
 *  - "Why this helps them?" + horizontal pager of 4 notepad benefit cards
 *  - "Learn more about Secured for landlords →" footer pill
 *
 * The "Invite Landlord" header CTA and the cards' tap target both push to
 * `/(setup)/invite-landlord-form` which carries the existing send-invite
 * functionality.
 */

import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text, Logo, DottedGridPattern, BackButton } from '@/src/components';
import { Marquee, TOP_MARQUEE_ITEMS, BOTTOM_MARQUEE_ITEMS } from '@/src/components/auth/landing-decor';
import { LandlordBenefitCard, landlordCardBodyStyle } from '@/src/components/setup/LandlordBenefitCard';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const BG_SHAPE = require('../../assets/images/background_shape.png');

const LEARN_MORE_URL = 'https://flent.in/secured/landlords';

// ── Step icons (24×24) — exact paths supplied for Figma parity. Solid
// white fills, even-odd path geometry that matches the Figma asset family
// (imgFrame / imgFrame1 / imgFrame2).
function HeadsetIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 17.0022C21.999 19.8731 19.9816 22.2726 17.2872 22.8616L16.6492 20.9476C17.8532 20.7511 18.8765 20.0171 19.4649 19H17C15.8954 19 15 18.1046 15 17V13C15 11.8954 15.8954 11 17 11H19.9381C19.446 7.05369 16.0796 4 12 4C7.92038 4 4.55399 7.05369 4.06189 11H7C8.10457 11 9 11.8954 9 13V17C9 18.1046 8.10457 19 7 19H4C2.89543 19 2 18.1046 2 17V12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12V12.9987V13V17V17.0022ZM20 17V13H17V17H20ZM4 13V17H7V13H4Z"
        fill={colors.white}
      />
    </Svg>
  );
}

function BankIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 20H22V22H2V20ZM4 12H6V19H4V12ZM9 12H11V19H9V12ZM13 12H15V19H13V12ZM18 12H20V19H18V12ZM2 7L12 2L22 7V11H2V7ZM4 8.23607V9H20V8.23607L12 4.23607L4 8.23607ZM12 8C11.4477 8 11 7.55228 11 7C11 6.44772 11.4477 6 12 6C12.5523 6 13 6.44772 13 7C13 7.55228 12.5523 8 12 8Z"
        fill={colors.white}
      />
    </Svg>
  );
}

function AlertHexIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.5 2.5L23 12L17.5 21.5H6.5L1 12L6.5 2.5H17.5ZM16.3469 4.5H7.65311L3.311 12L7.65311 19.5H16.3469L20.689 12L16.3469 4.5ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z"
        fill={colors.white}
      />
    </Svg>
  );
}

// "Why this helps them?" card content. Visual chrome (notepad bg, paperclip,
// scratch marks, house+shield icon, perforations) all lives in
// `LandlordBenefitCard` so the waitlist + this screen share one component.
const CARDS: { id: string; text: React.ReactNode }[] = [
  {
    id: '1',
    text: (
      <Text style={landlordCardBodyStyle.body}>
        Get guaranteed rent protection cover{' '}
        <Text inherit style={landlordCardBodyStyle.bodyAccent}>upto INR 1.5 lakhs</Text>
      </Text>
    ),
  },
  {
    id: '2',
    text: (
      <Text style={landlordCardBodyStyle.body}>
        If tenant abandons the property,{' '}
        <Text inherit style={landlordCardBodyStyle.bodyAccent}>get guaranteed rent placement within 30 days</Text>
      </Text>
    ),
  },
  {
    id: '3',
    text: (
      <Text style={landlordCardBodyStyle.body}>
        Complimentary tenant{' '}
        <Text inherit style={landlordCardBodyStyle.bodyAccent}>background verification</Text>
        {' '}report
      </Text>
    ),
  },
  {
    id: '4',
    text: (
      <Text style={landlordCardBodyStyle.body}>
        We guarantee a tenant replacement{' '}
        <Text inherit style={landlordCardBodyStyle.bodyAccent}>in less than 30 days</Text>
      </Text>
    ),
  },
];

// ── Step row (icon + title + body) ─────────────────────────────────────
interface StepRowProps {
  icon: React.ReactNode;
  titleAccent: string;
  titleRest: string;
  body: string;
}

function StepRow({ icon, titleAccent, titleRest, body }: StepRowProps) {
  return (
    <View style={stepStyles.row}>
      <View style={stepStyles.icon}>{icon}</View>
      <View style={stepStyles.textCol}>
        <Text style={stepStyles.title}>
          <Text inherit style={stepStyles.titleAccent}>{titleAccent}</Text>
          <Text inherit style={stepStyles.titleRest}>{titleRest}</Text>
        </Text>
        <Text style={stepStyles.body}>{body}</Text>
      </View>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: s(24), alignItems: 'flex-start' },
  icon: { width: 24, height: 24 },
  textCol: { flex: 1, gap: sv(8) },
  title: { fontFamily: 'PlusJakartaSans-Regular', fontSize: sf(14), lineHeight: sf(20) },
  titleAccent: { color: colors.brand[500] },
  titleRest: { color: colors.neutral[500] },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: colors.black[200] ?? '#A6A6A6',
  },
});

// ── Header CTA pill (gradient bg, brand stroke, 3D recess) ─────────────
// Figma 4651:144470 layers (inside-out):
//   1. outer container: 0.1px brand[500] border, radius 8, drop-shadow
//      0 6px 12px rgba(153,92,65,0.24)
//   2. linear gradient bg from black[500] (top) to black[800] (bottom 90%)
//   3. inset shadows: -2/-4 black bottom-right + 0/-3 white@12 bottom
//      → fakes a recessed 3D pill. RN can't render `box-shadow: inset`,
//      so we approximate with a thin bottom-right black overlay and a
//      faint top white highlight.
function HeaderCtaPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="invite-landlord-cta">
      <View style={pillStyles.outer}>
        <LinearGradient
          colors={[colors.black[500], colors.black[800]]}
          locations={[0, 0.9]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Bottom-right inset (-2/-4 black) */}
        <View pointerEvents="none" style={pillStyles.insetBR} />
        {/* Bottom highlight (-3 white@12%) */}
        <View pointerEvents="none" style={pillStyles.insetHighlight} />
        <Text style={pillStyles.label}>Invite Landlord</Text>
      </View>
    </Pressable>
  );
}

const pillStyles = StyleSheet.create({
  outer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brand[500],
    borderRadius: 8,
    paddingHorizontal: s(16),
    paddingVertical: sv(12),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Figma: 0 6px 12px rgba(153,92,65,0.24)
    shadowColor: '#995C41',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  // Approx inset_-2px_-4px_0_0_black: dark ring along right + bottom edges
  insetBR: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.black[900],
    opacity: 0.6,
  },
  // Approx inset_0_-3px_4px_0_rgba(255,255,255,0.12): faint top highlight band
  insetHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: colors.white,
    textAlign: 'center',
  },
});

// ──────────────────────────────────────────────────────────────────────
//                              SCREEN
// ──────────────────────────────────────────────────────────────────────
export default function InviteLandlordIntroScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (routerRef.current.canGoBack()) routerRef.current.back();
    else routerRef.current.replace('/(main)' as never);
  }, []);

  const goToForm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    routerRef.current.push('/(setup)/invite-landlord-form' as never);
  }, []);

  const handleLearnMore = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(LEARN_MORE_URL).catch(() => {});
  }, []);

  return (
    <Screen padded={false} testID="invite-landlord-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
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

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + sv(36) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Marquees */}
        <View style={styles.marqueeStack} pointerEvents="none">
          <View style={[styles.marqueeRow, { transform: [{ rotate: '0.22deg' }] }]}>
            <Marquee items={TOP_MARQUEE_ITEMS} backgroundColor={colors.black[600]} />
          </View>
          <View style={[styles.marqueeRow, { transform: [{ rotate: '-0.48deg' }] }]}>
            <Marquee items={BOTTOM_MARQUEE_ITEMS} backgroundColor={colors.brand[600]} reverse />
          </View>
        </View>

        {/* Back button — Figma intro doesn't show one, but the user
             needs a way back to /(main) when this screen is the cold-start
             target. Sits above the Logo+CTA row. */}
        <View style={[styles.backRow, { marginTop: sv(8) }]}>
          <BackButton onPress={handleBack} style={styles.backButton} color={colors.white} />
        </View>

        {/* Header row — Figma 4651:144466: Logo (left) + Invite Landlord pill (right) */}
        <View style={[styles.headerRow, { marginTop: sv(24) }]}>
          <Logo size={32} />
          <HeaderCtaPill onPress={goToForm} />
        </View>

        {/* Title — Figma 4651:144473: "Invite\nyour landlord" */}
        <View style={styles.titleBlock}>
          <Text style={styles.heading}>
            <Text inherit style={styles.headingWhite}>Invite</Text>
            {'\n'}
            <Text inherit style={styles.headingAccent}>your landlord</Text>
          </Text>
          <Text style={styles.subtitle}>
            To enable rent payments and cashback, we&apos;ll need to verify your landlord.
          </Text>
        </View>

        <View style={styles.divider} />

        {/* What we'll do? — Figma 4651:144476, 4679:152072 (stacks gap 32) */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>What we&apos;ll do?</Text>
          <View style={styles.stepStack}>
            <StepRow
              icon={<HeadsetIcon />}
              titleAccent="Call your landlord "
              titleRest="once"
              body="We'll explain Flent Secured, how rent payments work, and answer any questions they may have."
            />
            <StepRow
              icon={<BankIcon />}
              titleAccent="Verify your landlord's bank details"
              titleRest=" for payments"
              body="We'll securely check their account details so your rent always goes to the right person."
            />
            <StepRow
              icon={<AlertHexIcon />}
              titleAccent="No spam calls"
              titleRest=", we promise"
              body="We'll only reach out once to get things set up, no follow-ups or unnecessary messages."
            />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Why this helps them? — Figma 4651:144485 + 151304 */}
        <View style={[styles.sectionBlock, { gap: sv(16) }]}>
          <Text style={styles.sectionHeading}>Why this helps them?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsRow}
            decelerationRate="fast"
            snapToInterval={LandlordBenefitCard.WIDTH + s(16)}
          >
            {CARDS.map((c) => (
              <LandlordBenefitCard key={c.id} body={c.text} />
            ))}
          </ScrollView>
        </View>

        {/* Footer pill — Figma 4679:151843 */}
        <Pressable style={styles.footerPill} onPress={handleLearnMore} accessibilityRole="link" testID="learn-more-secured-landlords">
          <Text style={styles.footerPillText}>Learn more about Secured for landlords →</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.black[700], flex: 1 },
  bgShape: {
    position: 'absolute',
    top: sv(-100),
    left: '50%',
    width: s(481),
    height: sv(405),
    marginLeft: -s(481) / 2,
    opacity: 0.48,
  },
  scrollContent: { paddingHorizontal: s(36), paddingBottom: sv(48), gap: sv(32) },

  marqueeStack: { marginHorizontal: -s(227) },
  marqueeRow: { width: s(847), alignSelf: 'center' },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backButton: { width: 32, height: 32, justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  titleBlock: { gap: sv(10) },
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(28),
    lineHeight: sf(40),
    letterSpacing: -1,
  },
  headingWhite: { color: colors.white },
  headingAccent: { color: colors.brand[500] },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: colors.neutral[500],
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.black[400],
  },

  sectionBlock: { gap: sv(32), alignItems: 'stretch' },
  sectionHeading: {
    // Figma 4651:144477 / 144486: parent is `items-start`, heading is
    // `whitespace-nowrap shrink-0` → intrinsic width, aligned LEFT.
    // We keep the section as `alignItems: 'stretch'` so the step rows
    // (flexDirection: row + flex: 1 on the text column) actually have a
    // width to fill — and pin only the heading to `alignSelf: 'flex-start'`
    // so it shrinks to its own text width instead of stretching.
    alignSelf: 'flex-start',
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(16),
    lineHeight: sf(24),
    color: colors.white,
    textAlign: 'left',
  },

  stepStack: { gap: sv(32) },

  cardsRow: { gap: s(16), paddingRight: s(16) },

  footerPill: {
    backgroundColor: colors.black[600],
    borderRadius: 8,
    paddingVertical: sv(8),
    paddingHorizontal: s(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerPillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: colors.brand[500],
    textAlign: 'center',
  },
});
