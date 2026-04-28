/**
 * Manual Agreement Entry — Form
 * Figma Node: 4651:77846
 *
 * Reached via "Enter details manually" on the agreement intro. User fills
 * in rental details by hand. "Save Changes" pushes to the review screen.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Pressable, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Text, BackButton, DottedGridPattern } from '@/src/components';
import { GradientPill } from '@/src/components/agreement/GradientPill';
import {
  useManualAgreementStore,
  validators,
  isAllValid,
  formatRupees,
  type ManualAgreementData,
} from '@/src/stores/manualAgreement';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

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

const BG_SHAPE = require('../../assets/images/background_shape.png');

export default function ManualEntryScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const data = useManualAgreementStore();
  const setField = useManualAgreementStore((s) => s.setField);
  const { focus } = useLocalSearchParams<{ focus?: string }>();

  // Tap-a-field-to-edit edge case: route arrived with `?focus=X` so we need
  // to focus that specific TextInput on mount. Validate the param against the
  // known field list before threading it through (no untrusted refs).
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
    // Defer to next frame so the ScrollView has laid out — otherwise focus()
    // can fire before the input mounts and silently no-op.
    const t = setTimeout(() => {
      fieldRefs.current[focusKey]?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [focusKey]);

  const valid = isAllValid(data);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.back();
  }, []);

  const handleSave = useCallback(() => {
    if (!valid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push('/(agreement)/review' as never);
  }, [valid]);

  return (
    <Screen padded={false} testID="manual-entry-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      {/* Decorative arch + faint dotted pattern, per Figma */}
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
        {/* Header — back arrow + Save Changes pill */}
        <View style={styles.headerRow}>
          <BackButton onPress={handleBack} style={styles.backButton} color={colors.white} />
          <GradientPill label="Save Changes" onPress={handleSave} disabled={!valid} testID="save-changes" />
        </View>

        {/* Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.heading}>
            <Text inherit style={styles.headingAccent}>Add</Text>
            {'  '}
            <Text inherit style={styles.headingWhite}>your Rental details</Text>
          </Text>
          <Text style={styles.subtitle}>Used to verify your rental details</Text>
        </View>

        <View style={styles.divider} />

        {/* Form fields */}
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
    paddingHorizontal: s(36),
    paddingBottom: sv(48),
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },

  // Title block — Figma: items-center wrapper with full-width text (left-aligned)
  titleBlock: {
    marginTop: sv(40),
    gap: sv(10),
  },
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(28),
    lineHeight: sf(40),
    letterSpacing: -1,
  },
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

  // Form fields
  fieldsStack: {
    marginTop: sv(40),
    gap: sv(16),
  },
  fieldRow: {
    gap: sv(6),
    borderBottomColor: colors.black[800],
    borderBottomWidth: 0.5,
    paddingBottom: sv(0),
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
  fieldInputError: {
    color: colors.error.radix,
  },
});
