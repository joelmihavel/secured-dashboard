/**
 * Upload Agreement Edit
 * Figma Node: 4651:77601
 *
 * The edit form within the UPLOAD flow. Reached when the user taps "Edit
 * Missing Details" or any individual row on `upload-review`. Save Changes
 * returns to `upload-review` (router.back), where the pill flips to
 * "Confirm & Continue" once everything validates.
 *
 * Visually identical to `manual-entry` (same 8 fields), but:
 *  - Heading reads "Review your details" (not "Add your Rental details")
 *  - Subtitle reads "We've filled this from your agreement. You can edit anything."
 *  - Save Changes goes BACK to upload-review instead of pushing /review
 *  - Lives at /(agreement)/upload-edit so the routing stack stays distinct
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Text, BackButton, DottedGridPattern } from '@/src/components';
import {
  useManualAgreementStore,
  validators,
  isAllValid,
  formatRupees,
  type ManualAgreementData,
} from '@/src/stores/manualAgreement';
import { useUpdateExtraction } from '@/src/hooks/useAgreement';
import { useUploadStore } from '@/src/stores/upload';
import { GradientPill } from '@/src/components/agreement/GradientPill';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

/** "30 Nov 2026" or "30/11/2026" → "2026-11-30". Returns null if unparseable. */
function parseExitDateToISO(input: string): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  // Fallback: dd/mm/yyyy or dd-mm-yyyy
  const m = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    if (!Number.isNaN(new Date(iso).getTime())) return iso;
  }
  return null;
}

/** Split a comma-joined names field ("Alice, Bob, Carol") into a clean
 *  array. Trims whitespace and drops empty segments. */
function splitNames(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Build the update-extraction payload from the local manual-agreement store.
 *  Only fields in MODIFIABLE_FIELDS (server-side whitelist) are included.
 *  For tenants/landlords we send BOTH the singular `*_name` (joined string)
 *  and the plural `*_names` (array) so the user's edit round-trips cleanly:
 *  the read path in agreement.ts:extractNames prefers the array when present. */
function buildUpdatePayload(
  data: ManualAgreementData,
): Record<string, string | number | string[]> {
  const payload: Record<string, string | number | string[]> = {};
  if (data.agreementId.trim()) payload.registration_number = data.agreementId.trim();
  if (data.tenants.trim()) {
    payload.tenant_name = data.tenants.trim();
    payload.tenant_names = splitNames(data.tenants);
  }
  if (data.landlords.trim()) {
    payload.landlord_name = data.landlords.trim();
    payload.landlord_names = splitNames(data.landlords);
  }
  const rent = Number((data.monthlyRent || '').replace(/\D/g, ''));
  if (Number.isFinite(rent) && rent > 0) payload.monthly_rent = rent;
  const dep = Number((data.oneTimeDeposit || '').replace(/\D/g, ''));
  if (Number.isFinite(dep) && dep > 0) payload.security_deposit = dep;
  const iso = parseExitDateToISO(data.exitDate);
  if (iso) payload.lease_end_date = iso;
  // propertyName + rentDuration aren't in the server whitelist (no
  // property_name or rent_duration write targets) — skipping silently.
  return payload;
}

const BG_SHAPE = require('../../assets/images/background_shape.png');

type FieldKey = keyof ManualAgreementData;
const VALID_FIELDS: FieldKey[] = [
  'agreementId',
  'propertyName',
  'tenants',
  'landlords',
  'monthlyRent',
  'oneTimeDeposit',
  'rentDuration',
  'exitDate',
];

export default function UploadEditScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const data = useManualAgreementStore();
  const setField = useManualAgreementStore((s) => s.setField);
  const { focus } = useLocalSearchParams<{ focus?: string }>();

  // Auto-focus a specific field when arriving via /upload-edit?focus=<key>.
  const focusKey: FieldKey | null = focus && (VALID_FIELDS as string[]).includes(focus)
    ? (focus as FieldKey)
    : null;
  const fieldRefs = useRef<Record<FieldKey, TextInput | null>>({
    agreementId: null,
    propertyName: null,
    tenants: null,
    landlords: null,
    monthlyRent: null,
    oneTimeDeposit: null,
    rentDuration: null,
    exitDate: null,
  });
  useEffect(() => {
    if (!focusKey) return;
    const t = setTimeout(() => fieldRefs.current[focusKey]?.focus(), 80);
    return () => clearTimeout(t);
  }, [focusKey]);

  const valid = isAllValid(data);
  const extractionId = useUploadStore((s) => s.extractionId);
  const updateMutation = useUpdateExtraction();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.back();
  }, []);

  const handleSave = useCallback(async () => {
    if (!valid || updateMutation.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Persist whitelisted fields to extracted_rental_info before navigating
    // back. Without this, edits live only in the local Zustand store and
    // never reach the backend, so admin review and the rest of the flow see
    // the original (possibly-empty) values.
    if (extractionId) {
      const modifications = buildUpdatePayload(data);
      if (Object.keys(modifications).length > 0) {
        try {
          await updateMutation.mutateAsync({ extractionId, modifications });
        } catch (err) {
          console.warn('[upload-edit] Failed to persist edits:', err);
          // Non-blocking — local store still has the values, user can retry
          // later via re-edit. Falling through to back nav so they aren't
          // stranded on this screen.
        }
      }
    }

    routerRef.current.back();
  }, [valid, extractionId, data, updateMutation]);

  return (
    <Screen padded={false} testID="upload-edit-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + sv(40) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <BackButton onPress={handleBack} style={styles.backButton} color={colors.white} />
          <GradientPill label="Save Changes" onPress={handleSave} disabled={!valid} testID="save-changes" />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.heading}>
            <Text inherit style={styles.headingAccent}>Review</Text>
            {' '}
            <Text inherit style={styles.headingWhite}>your details</Text>
          </Text>
          <Text style={styles.subtitle}>
            We&apos;ve filled this from your agreement. You can edit anything.
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.fieldsStack}>
          <Field
            inputRef={(r) => { fieldRefs.current.agreementId = r; }}
            label="Agreement ID"
            placeholder="e.g. KIA123456789"
            value={data.agreementId}
            onChange={(v) => setField('agreementId', v)}
            autoCapitalize="characters"
            isValid={validators.agreementId}
            testID="agreement-id"
          />
          <Field
            inputRef={(r) => { fieldRefs.current.propertyName = r; }}
            label="Property Name"
            placeholder="e.g. Prestow Glasglow"
            value={data.propertyName}
            onChange={(v) => setField('propertyName', v)}
            isValid={validators.propertyName}
            testID="property-name"
          />
          <Field
            inputRef={(r) => { fieldRefs.current.tenants = r; }}
            label="Tenant(s)"
            placeholder="e.g. John Appleseed"
            value={data.tenants}
            onChange={(v) => setField('tenants', v)}
            isValid={validators.tenants}
            testID="tenants"
          />
          <Field
            inputRef={(r) => { fieldRefs.current.landlords = r; }}
            label="Landlord(s)"
            placeholder="e.g. Lisa Appleseed"
            value={data.landlords}
            onChange={(v) => setField('landlords', v)}
            isValid={validators.landlords}
            testID="landlords"
          />
          <Field
            inputRef={(r) => { fieldRefs.current.monthlyRent = r; }}
            label="Monthly Rent"
            placeholder="₹40,000"
            value={data.monthlyRent ? formatRupees(data.monthlyRent) : ''}
            onChange={(v) => setField('monthlyRent', v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            isValid={validators.monthlyRent}
            testID="monthly-rent"
          />
          <Field
            inputRef={(r) => { fieldRefs.current.oneTimeDeposit = r; }}
            label="One-Time Deposit"
            placeholder="₹130,000"
            value={data.oneTimeDeposit ? formatRupees(data.oneTimeDeposit) : ''}
            onChange={(v) => setField('oneTimeDeposit', v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            isValid={validators.oneTimeDeposit}
            testID="one-time-deposit"
          />
          <Field
            inputRef={(r) => { fieldRefs.current.rentDuration = r; }}
            label="Rent Duration"
            placeholder="11 Months"
            value={data.rentDuration}
            onChange={(v) => setField('rentDuration', v)}
            isValid={validators.rentDuration}
            testID="rent-duration"
          />
          <Field
            inputRef={(r) => { fieldRefs.current.exitDate = r; }}
            label="Exit Date"
            placeholder="31 Dec 2027"
            value={data.exitDate}
            onChange={(v) => setField('exitDate', v)}
            isValid={validators.exitDate}
            testID="exit-date"
          />
        </View>

        <View style={{ height: sv(48) }} />
      </ScrollView>
    </Screen>
  );
}

interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  isValid: (v: string) => boolean;
  testID?: string;
  inputRef?: (instance: TextInput | null) => void;
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  isValid,
  testID,
  inputRef,
}: FieldProps) {
  const showError = value.length > 0 && !isValid(value);
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={[styles.fieldInput, showError && styles.fieldInputError]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.black[300]}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        testID={testID}
      />
    </View>
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
  scrollContent: { paddingHorizontal: s(36), paddingBottom: sv(48) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { width: 32, height: 32, justifyContent: 'center' },
  titleBlock: { marginTop: sv(16), gap: sv(10) },
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.black[400],
    marginTop: sv(40),
  },
  fieldsStack: { marginTop: sv(40), gap: sv(16) },
  fieldRow: {
    gap: sv(6),
    borderBottomColor: colors.black[800],
    borderBottomWidth: 0.5,
  },
  fieldLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: colors.neutral[500],
  },
  fieldInput: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(20),
    lineHeight: sf(32),
    color: colors.neutral[200],
    paddingTop: sv(8),
    paddingBottom: sv(16),
    padding: 0,
  },
  fieldInputError: { color: colors.error.radix },
});
