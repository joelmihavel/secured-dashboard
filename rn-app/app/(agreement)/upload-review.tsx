/**
 * Upload Agreement Review
 * Figma Nodes:
 *  - 4651:76829 (with missing fields → "Edit Missing Details" pill)
 *  - 4651:77446 (all valid → "Confirm & Continue" pill)
 *  - 4651:77601 (edit mode — reuses /manual-entry?focus=<key>)
 *
 * After a successful agreement upload + extraction, the user lands here to
 * verify the auto-filled fields. Missing/invalid fields render as red
 * "- (missing)". Tap any row to edit that specific field via manual-entry.
 *
 * Edge cases handled:
 *  - All fields valid → pill is "Confirm & Continue", confirms to setup-intro
 *  - Some fields missing → pill is "Edit Missing Details", routes to manual-entry
 *  - Tap any row (filled or empty) → manual-entry?focus=<fieldKey>
 *  - Confirm pressed when invalid (e.g. via deep-link) → routes to manual-entry
 *    instead of progressing forward, with a warning haptic
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Text, BackButton, DottedGridPattern } from '@/src/components';
import { Marquee, TOP_MARQUEE_ITEMS, BOTTOM_MARQUEE_ITEMS } from '@/src/components/auth/landing-decor';
import {
  useManualAgreementStore,
  formatRupees,
  isAllValid,
  validators,
  type ManualAgreementData,
} from '@/src/stores/manualAgreement';
import { useExtractedData } from '@/src/hooks/useAgreement';
import { useUploadStore } from '@/src/stores/upload';
import { GradientPill } from '@/src/components/agreement/GradientPill';
import { ReviewRowSingle, ReviewRowMultiline } from '@/src/components/agreement/ReviewRow';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const BG_SHAPE = require('../../assets/images/background_shape.png');

type FieldKey = keyof ManualAgreementData;

/** Map paise → rupee digit string (store holds raw digits, formatRupees adds the ₹ + commas). */
function paiseToRupeeDigits(paise: number | undefined): string {
  if (!paise || paise <= 0) return '';
  return String(Math.round(paise / 100));
}

/** "2026-11-30" → "30 Nov 2026". Falls back to the raw string if parsing fails. */
function formatExitDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function UploadReviewScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const data = useManualAgreementStore();
  const setField = useManualAgreementStore((s) => s.setField);

  // Hydrate the manual-agreement store from the completed extraction. The
  // store is empty after a fresh upload (only manual-entry path writes to it
  // directly), so without this the review screen renders every row as
  // "missing" even though the DB has all the data.
  const extractionId = useUploadStore((s) => s.extractionId);
  const { data: extracted } = useExtractedData(extractionId, { enabled: !!extractionId });
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!extracted || hydratedRef.current) return;
    hydratedRef.current = true;
    // registration_number is the editable target (only it's in update-extraction's
    // MODIFIABLE_FIELDS whitelist). Prefer it on read so user edits round-trip
    // cleanly; fall back to certificate_no since Gemini sometimes extracts only
    // the cert and not the registration number.
    setField('agreementId', extracted.registrationNumber ?? extracted.certificateNo ?? '');
    setField('propertyName', extracted.propertyName ?? extracted.propertyAddress ?? '');
    setField('tenants', (extracted.tenantNames ?? []).join(', '));
    setField('landlords', (extracted.landlordNames ?? []).join(', '));
    setField('monthlyRent', paiseToRupeeDigits(extracted.monthlyRentPaise));
    setField('oneTimeDeposit', paiseToRupeeDigits(extracted.securityDepositPaise));
    setField(
      'rentDuration',
      extracted.rentDurationMonths ? `${extracted.rentDurationMonths} months` : '',
    );
    setField('exitDate', formatExitDate(extracted.leaseEndDate));
  }, [extracted, setField]);

  const valid = isAllValid(data);
  const isFieldMissing = (key: FieldKey): boolean => !validators[key](data[key]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.back();
  }, []);

  const handlePillPress = useCallback(() => {
    if (!valid) {
      // "Edit Missing Details" branch — open manual-entry on the first missing field.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const firstMissing = (Object.keys(validators) as FieldKey[]).find(
        (k) => !validators[k](data[k]),
      );
      routerRef.current.push({
        pathname: '/(agreement)/upload-edit',
        params: firstMissing ? { focus: firstMissing } : undefined,
      } as never);
      return;
    }
    // "Confirm & Continue" — only reachable when every field validates.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    routerRef.current.push('/(agreement)/setup-intro' as never);
  }, [valid, data]);

  const handleEditField = useCallback((focus: FieldKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push({
      pathname: '/(agreement)/upload-edit',
      params: { focus },
    } as never);
  }, []);

  return (
    <Screen padded={false} testID="upload-review-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
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
          <GradientPill
            label={valid ? 'Confirm & Continue' : 'Edit Missing Details'}
            onPress={handlePillPress}
            testID={valid ? 'confirm-continue' : 'edit-missing-details'}
          />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.heading}>
            <Text inherit style={styles.headingAccent}>Review</Text>
            {'\n'}
            <Text inherit style={styles.headingWhite}>your details</Text>
          </Text>
          <Text style={styles.subtitle}>
            We&apos;ve filled this from your agreement. You can edit anything.
          </Text>
        </View>

        <View style={styles.rowsStack}>
          <ReviewRowSingle
            icon="hash"
            label="Agreement ID"
            value={data.agreementId}
            missing={isFieldMissing('agreementId')}
            onPress={() => handleEditField('agreementId')}
          />
          <ReviewRowMultiline
            icon="building"
            label="Property Name"
            value={data.propertyName}
            missing={isFieldMissing('propertyName')}
            onPress={() => handleEditField('propertyName')}
          />
          <ReviewRowMultiline
            icon="person"
            label="Tenant(s)"
            value={data.tenants}
            missing={isFieldMissing('tenants')}
            onPress={() => handleEditField('tenants')}
          />
          <ReviewRowMultiline
            icon="people"
            label="Landlord(s)"
            value={data.landlords}
            missing={isFieldMissing('landlords')}
            onPress={() => handleEditField('landlords')}
          />
          <ReviewRowSingle
            icon="hash"
            label="Monthly Rent"
            value={formatRupees(data.monthlyRent)}
            missing={isFieldMissing('monthlyRent')}
            onPress={() => handleEditField('monthlyRent')}
          />
          <ReviewRowSingle
            icon="hash"
            label="One-Time Deposit"
            value={formatRupees(data.oneTimeDeposit)}
            missing={isFieldMissing('oneTimeDeposit')}
            onPress={() => handleEditField('oneTimeDeposit')}
          />
          <ReviewRowSingle
            icon="hash"
            label="Rent Duration"
            value={data.rentDuration}
            missing={isFieldMissing('rentDuration')}
            onPress={() => handleEditField('rentDuration')}
          />
          <ReviewRowSingle
            icon="hash"
            label="Exit Date"
            value={data.exitDate}
            missing={isFieldMissing('exitDate')}
            onPress={() => handleEditField('exitDate')}
          />
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
