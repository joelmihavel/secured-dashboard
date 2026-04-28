/**
 * Manual Agreement Review
 * Figma Node: 4651:77691
 *
 * Read-only review of the rental details typed on `manual-entry`. Data
 * arriving here is always valid (manual-entry's Save Changes is gated by
 * `isAllValid`), so the pill is always "Confirm & Continue". Each row is
 * still tappable in case the user wants to tweak a single field — that
 * jumps to `manual-entry?focus=<key>` and on Save Changes returns here.
 */

import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';

import { Screen, Text, BackButton, DottedGridPattern } from '@/src/components';
import { Marquee, TOP_MARQUEE_ITEMS, BOTTOM_MARQUEE_ITEMS } from '@/src/components/auth/landing-decor';
import {
  useManualAgreementStore,
  formatRupees,
  type ManualAgreementData,
} from '@/src/stores/manualAgreement';
import { GradientPill } from '@/src/components/agreement/GradientPill';
import { ReviewRowSingle, ReviewRowMultiline } from '@/src/components/agreement/ReviewRow';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const BG_SHAPE = require('../../assets/images/background_shape.png');

type FieldKey = keyof ManualAgreementData;

export default function ReviewScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const data = useManualAgreementStore();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.back();
  }, []);

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    routerRef.current.push('/(agreement)/setup-intro' as never);
  }, []);

  const handleEditField = useCallback((focus: FieldKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push({
      pathname: '/(agreement)/manual-entry',
      params: { focus },
    } as never);
  }, []);

  return (
    <Screen padded={false} testID="review-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
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
        <View style={styles.marqueeStack} pointerEvents="none">
          <View style={[styles.marqueeRow, { transform: [{ rotate: '0.22deg' }] }]}>
            <Marquee items={TOP_MARQUEE_ITEMS} backgroundColor={colors.black[600]} />
          </View>
          <View style={[styles.marqueeRow, { transform: [{ rotate: '-0.48deg' }] }]}>
            <Marquee items={BOTTOM_MARQUEE_ITEMS} backgroundColor={colors.brand[600]} reverse />
          </View>
        </View>

        <View style={[styles.headerRow, { marginTop: sv(40) }]}>
          <BackButton onPress={handleBack} style={styles.backButton} color={colors.white} />
          <GradientPill label="Confirm & Continue" onPress={handleConfirm} testID="confirm-continue" />
        </View>

        <View style={styles.titleBlock}>
          {/* Figma 4651:77788 — single line: orange "Review" + double space + white "your details" */}
          <Text style={styles.heading}>
            <Text inherit style={styles.headingAccent}>Review</Text>
            <Text inherit>{'  '}</Text>
            <Text inherit style={styles.headingWhite}>your details</Text>
          </Text>
          <Text style={styles.subtitle}>
            We&apos;ve filled this from your agreement. You can edit anything.
          </Text>
        </View>

        <View style={styles.rowsStack}>
          <ReviewRowSingle icon="hash" label="Agreement ID" value={data.agreementId} onPress={() => handleEditField('agreementId')} />
          <ReviewRowMultiline icon="building" label="Property Name" value={data.propertyName} onPress={() => handleEditField('propertyName')} />
          <ReviewRowMultiline icon="person" label="Tenant(s)" value={data.tenants} onPress={() => handleEditField('tenants')} />
          <ReviewRowMultiline icon="people" label="Landlord(s)" value={data.landlords} onPress={() => handleEditField('landlords')} />
          <ReviewRowSingle icon="hash" label="Monthly Rent" value={formatRupees(data.monthlyRent)} onPress={() => handleEditField('monthlyRent')} />
          <ReviewRowSingle icon="hash" label="One-Time Deposit" value={formatRupees(data.oneTimeDeposit)} onPress={() => handleEditField('oneTimeDeposit')} />
          <ReviewRowSingle icon="hash" label="Rent Duration" value={data.rentDuration} onPress={() => handleEditField('rentDuration')} />
          <ReviewRowSingle icon="hash" label="Exit Date" value={data.exitDate} onPress={() => handleEditField('exitDate')} />
        </View>
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
  marqueeStack: { marginHorizontal: -s(227) },
  marqueeRow: { width: s(847), alignSelf: 'center' },
  scrollContent: { paddingHorizontal: s(36), paddingBottom: sv(48) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { width: 32, height: 32, justifyContent: 'center' },
  titleBlock: { marginTop: sv(40), gap: sv(10) },
  heading: { fontFamily: 'PlusJakartaSans-Regular', fontSize: sf(28), lineHeight: sf(40), letterSpacing: -1 },
  headingAccent: { color: colors.brand[500] },
  headingWhite: { color: colors.white },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sf(12),
    lineHeight: sf(21.6),
    letterSpacing: -0.132,
    color: colors.neutral[500],
  },
  rowsStack: { marginTop: sv(40), gap: sv(16) },
});
