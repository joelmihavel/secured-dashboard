/**
 * Agreement Review Screen
 *
 * Two modes based on Figma designs:
 * - Verify (1:30448): Read-only detail rows with "Proceed" button
 * - Edit (1:30820): Editable input fields with "Save Changes" button
 *
 * Flow: verify -> (Enter Manually) -> edit -> (Save Changes) -> verify -> (Proceed) -> success
 *
 * All values sourced from Figma REST API -- no AI guesswork.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import type { TextInput as RNTextInputRef } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Text, PrimaryButton, TextInput } from '@/src/components';
import { DottedPattern } from '@/src/components/patterns';
import {
  FlentLogoIcon,
  AgreementIdIcon,
  PropertyIcon,
  TenantIcon,
  LandlordIcon,
} from '@/src/components/icons/AgreementIcons';
import { useAgreement } from '@/src/hooks';
import {
  formatPaiseToRupees,
  formatDateDisplay,
  type ExtractedAgreementData,
} from '@/src/services/api/agreement';

// ============================================
// FIGMA CONSTANTS -- Figma REST API (1:30448, 1:30820)
// ============================================

const F = {
  // Screen
  bg: '#131313',
  contentPadH: 48, // Frame 1686557268 paddingLeft/Right

  // Layout gaps (from Figma frame itemSpacing)
  outerGap: 64,      // Frame 2095586323 gap
  mainGap: 40,       // Frame 1686557268 gap
  titleGroupGap: 48, // Frame 1686557318 gap
  buttonGroupGap: 24, // Frame 2095586322 gap

  // Flent logo (Frame 1686557264: 32x38, Vector fill=#ffffff)
  logo: {
    w: 32,
    h: 38,
  },

  // Title (size=48, w=400, lineH=64, ls=-2)
  // Character style overrides from Figma REST API (charStyleOverrides):
  //   "Confirm" (chars 0-6) → override 37 → #A9A9A9 (grey)
  //   "your details" (chars 8-19) → override 36 → #FF9A6D (brand orange)
  title: {
    size: 48,
    weight: '400' as const,
    lineH: 64,
    ls: -2,
    greyColor: '#a9a9a9',   // "Confirm" — override 37 fill r=0.6627
    orangeColor: '#ff9a6d',  // "your details" — override 36 fill r=1.0,g=0.6039,b=0.4274
  },

  // Detail rows (verify mode -- 1:30448)
  detail: {
    gap: 16,          // Frame 2095586321 itemSpacing
    rowGap: 4,        // within row frame gap
    labelSize: 12,    // TEXT size=12
    labelWeight: '400' as const,
    labelLineH: 20,
    labelColor: '#878787',
    labelIconGap: 4,  // Frame gap between icon and label text
    valueSize: 14,    // TEXT size=14
    valueWeight: '400' as const,
    valueLineH: 20,
    valueColor: '#cbcbcb',
    dividerColor: '#4d4d4d', // Vector stroke
  },

  // Input fields (edit mode -- 1:30820)
  input: {
    gap: 16,              // Frame itemSpacing
    bg: '#222222',
    borderActive: '#4d4d4d',
    borderFilled: '#0d0d0d',
    radius: 12,
    padV: 16,
    padH: 16,
    labelSize: 12,
    labelWeight: '500' as const,
    labelColor: '#a9a9a9',
    editSize: 14,
    editWeight: '400' as const,
    editColor: '#878787',
    valueSize: 20,
    valueWeight: '400' as const,
    valueLineH: 32,
    filledColor: '#dddddd',
    placeholderColor: '#222222',
    hintSize: 14,
    hintWeight: '400' as const,
    hintColor: '#878787',
    labelGap: 6,
  },

  // "Enter Manually" link (verify mode only)
  manual: {
    size: 14,
    weight: '400' as const,
    lineH: 20,
    color: '#a9a9a9',
  },
} as const;

// ============================================
// FIELD DEFINITIONS
// ============================================

type FieldLayout = 'horizontal' | 'vertical';

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  hintText?: string;
  backendKey?: string;
  isMonetary?: boolean;
  /** Whether the field is user-editable in edit mode */
  editable?: boolean;
  layout: FieldLayout;
  icon: React.FC<{ size?: number; color?: string }>;
  getValue: (data: ExtractedAgreementData) => string;
}

const FIELDS: FieldDef[] = [
  {
    key: 'certificateNo',
    label: 'Agreement ID',
    placeholder: 'e.g. KIA123456789',
    hintText: 'Certificate number from agreement',
    layout: 'horizontal',
    icon: AgreementIdIcon,
    getValue: (d) => d.certificateNo ?? '',
  },
  {
    key: 'propertyName',
    label: 'Property Name',
    placeholder: 'e.g. Prestige Pinestripe, Bengaluru',
    hintText: 'Full property address',
    backendKey: 'property_address',
    editable: true,
    layout: 'vertical',
    icon: PropertyIcon,
    getValue: (d) => {
      const parts = [d.propertyName, d.propertyAddress, d.propertyCity, d.propertyPincode].filter(Boolean);
      return parts.join(', ') || '';
    },
  },
  {
    key: 'tenants',
    label: 'Tenant(s)',
    placeholder: 'e.g. John Appleseed',
    backendKey: 'tenant_name',
    editable: true,
    layout: 'vertical',
    icon: TenantIcon,
    getValue: (d) => d.tenantNames?.join(', ') ?? '',
  },
  {
    key: 'landlords',
    label: 'Landlord(s)',
    placeholder: 'e.g. Lisa Appleseed',
    backendKey: 'landlord_name',
    editable: true,
    layout: 'vertical',
    icon: LandlordIcon,
    getValue: (d) => d.landlordNames?.join(', ') ?? '',
  },
  {
    key: 'monthlyRent',
    label: 'Monthly Rent',
    placeholder: 'e.g. 40,000',
    backendKey: 'monthly_rent',
    isMonetary: true,
    layout: 'horizontal',
    icon: AgreementIdIcon,
    getValue: (d) => d.monthlyRentPaise ? `\u20B9 ${formatPaiseToRupees(d.monthlyRentPaise)}` : '',
  },
  {
    key: 'deposit',
    label: 'One-Time Deposit',
    placeholder: 'e.g. 130,000',
    backendKey: 'security_deposit',
    isMonetary: true,
    layout: 'horizontal',
    icon: AgreementIdIcon,
    getValue: (d) => d.securityDepositPaise ? `\u20B9 ${formatPaiseToRupees(d.securityDepositPaise)}` : '',
  },
  {
    key: 'duration',
    label: 'Rent Duration',
    placeholder: 'e.g. 11 Months',
    layout: 'horizontal',
    icon: AgreementIdIcon,
    getValue: (d) => d.rentDurationMonths ? `${d.rentDurationMonths} Months` : '',
  },
  {
    key: 'exitDate',
    label: 'Exit Date',
    placeholder: 'e.g. 31 Dec 2027',
    backendKey: 'lease_end_date',
    layout: 'horizontal',
    icon: AgreementIdIcon,
    getValue: (d) => d.leaseEndDate ? formatDateDisplay(d.leaseEndDate) : '',
  },
];

// ============================================
// SUB-COMPONENTS
// ============================================

/** Detail row for verify mode -- matches Figma 1:30448 detail frames */
const DetailRow = ({
  field,
  value,
}: {
  field: FieldDef;
  value: string;
}) => {
  const IconComponent = field.icon;
  const isVertical = field.layout === 'vertical';

  return (
    <View style={isVertical ? styles.detailRowVertical : styles.detailRowHorizontal}>
      {/* Label group: icon + label text */}
      <View style={styles.detailLabelGroup}>
        <IconComponent />
        <Text style={styles.detailLabel}>{field.label}</Text>
      </View>
      <Text style={isVertical ? styles.detailValueBelow : styles.detailValueRight}>
        {value}
      </Text>
    </View>
  );
};

/** Divider between detail rows -- Vector stroke=#4d4d4d */
const Divider = () => <View style={styles.divider} />;

/**
 * Edit mode field -- uses shared TextInput component.
 *
 * Figma component variants (1:30820):
 *   - Disabled (1:25417): empty fields, no bg, no border, placeholder text
 *   - Focus (1:25369): filled fields, "Edit" in hint slot, value displayed
 *
 * Per Figma, "Edit" shows on ALL filled fields. Only editable fields (Property Name,
 * Tenant(s), Landlord(s)) actually respond to the Edit tap.
 */
const EditField = ({
  field,
  value,
  isEditing,
  onEdit,
  onChangeText,
  editableFields,
}: {
  field: FieldDef;
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onChangeText: (text: string) => void;
  /** Backend-driven editable field keys; overrides static field.editable when present */
  editableFields?: string[];
}) => {
  const inputRef = React.useRef<RNTextInputRef>(null);
  const hasValue = value.length > 0;

  // Backend flag overrides static default: check backendKey OR field key
  const isFieldEditable = editableFields
    ? editableFields.includes(field.backendKey ?? field.key)
    : field.editable === true;

  // Determine input interactivity: only editable fields can type
  const canType = isFieldEditable && (isEditing || !hasValue);

  // Handle Edit tap: only editable fields respond
  const handleEdit = useCallback(() => {
    if (!isFieldEditable) return;
    onEdit();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [onEdit, isFieldEditable]);

  // "Edit" only on EDITABLE filled fields — not all filled fields
  const hintText = hasValue && !isEditing && isFieldEditable
    ? 'Edit'
    : !hasValue && field.hintText
      ? field.hintText
      : undefined;

  return (
    <TextInput
      ref={inputRef}
      label={field.label}
      value={value}
      onChangeText={onChangeText}
      placeholder={field.placeholder}
      hintText={hintText}
      onHintPress={hasValue && !isEditing && isFieldEditable ? handleEdit : undefined}
      editable={canType}
      keyboardType={field.isMonetary ? 'numeric' : 'default'}
    />
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { extractionId } = useLocalSearchParams<{ extractionId?: string }>();

  const useMock = !extractionId;
  const {
    extractedData,
    isLoadingExtraction,
    confirm,
    isConfirming,
    update,
    isUpdating,
  } = useAgreement({
    useMock,
    extractionId: extractionId ?? null,
  });

  // Mode: verify (read-only detail rows) or edit (input fields)
  const [mode, setMode] = useState<'verify' | 'edit'>('verify');

  // Per-field editing state (which fields user has tapped "Edit" on)
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());

  // Edit values (overrides for extracted data)
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Build display values from extracted data
  const fieldValues = useMemo(() => {
    if (!extractedData) return {};
    const values: Record<string, string> = {};
    for (const field of FIELDS) {
      values[field.key] = field.getValue(extractedData);
    }
    return values;
  }, [extractedData]);

  // Get current value: edit override > extracted data
  const getFieldValue = useCallback(
    (key: string) => editValues[key] ?? fieldValues[key] ?? '',
    [editValues, fieldValues]
  );

  // Unlock a field for editing
  const toggleEditing = useCallback((key: string) => {
    setEditingFields((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // Update a field value
  const updateFieldValue = useCallback((key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Switch to edit mode, pre-populate edit values
  const handleEnterManually = useCallback(() => {
    const values: Record<string, string> = {};
    for (const field of FIELDS) {
      const v = fieldValues[field.key];
      if (v) values[field.key] = v;
    }
    setEditValues(values);
    setMode('edit');
  }, [fieldValues]);

  // Save changes via update-extraction endpoint
  const handleSaveChanges = useCallback(async () => {
    if (!extractedData) return;

    const modifications: Record<string, string | number> = {};

    for (const field of FIELDS) {
      if (!field.backendKey) continue;
      const edited = editValues[field.key];
      const original = fieldValues[field.key];

      if (edited !== undefined && edited !== original) {
        if (field.isMonetary) {
          const numStr = edited.replace(/[\u20B9,\s]/g, '');
          const num = parseInt(numStr, 10);
          if (!isNaN(num)) modifications[field.backendKey] = num;
        } else {
          modifications[field.backendKey] = edited;
        }
      }
    }

    if (Object.keys(modifications).length === 0) {
      setMode('verify');
      return;
    }

    try {
      await update(modifications);
      setMode('verify');
      setEditingFields(new Set());
      setEditValues({});
    } catch (error) {
      const msg =
        (error as { message?: string })?.message ?? 'Failed to save changes';
      Alert.alert('Save Failed', msg);
    }
  }, [extractedData, update, editValues, fieldValues]);

  // Confirm extraction and navigate to success
  const handleProceed = useCallback(async () => {
    if (!extractedData) return;

    try {
      await confirm({ confirmedRole: 'tenant' });
      router.push({
        pathname: '/(agreement)/success',
        params: { extractionId: extractedData.extractionId },
      } as never);
    } catch (error) {
      const msg =
        (error as { message?: string })?.message ??
        'Something went wrong. Please try again.';
      Alert.alert('Confirmation Failed', msg);
    }
  }, [extractedData, confirm, router]);

  // Loading state
  if (isLoadingExtraction) {
    return (
      <Screen testID="review-screen">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff9a6d" />
          <Text style={styles.loadingText}>Loading your details...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="review-screen" padded={false}>
      {/* Background pattern */}
      <View style={styles.backgroundPattern}>
        <DottedPattern backgroundShape="agreement" />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mainContent}>
          {/* Title group (Frame 1686557318) */}
          <View style={styles.titleGroup}>
            {/* Flent logo icon (Frame 1686557264: 32x38, white) -- visible in both modes */}
            <FlentLogoIcon size={F.logo.h} color="#ffffff" />

            <Text style={styles.title}>
              {mode === 'verify' ? (
                <>
                  <Text inherit style={styles.titleGrey}>Confirm</Text>
                  {'\n'}
                  <Text inherit style={styles.titleOrange}>your details</Text>
                </>
              ) : (
                <>
                  <Text inherit style={styles.titleGrey}>{"Let's"}</Text>
                  {'\n'}
                  <Text inherit style={styles.titleOrange}>fix the details</Text>
                </>
              )}
            </Text>

            {/* Verify mode: detail rows */}
            {mode === 'verify' ? (
              <View style={styles.detailsContainer}>
                {FIELDS.map((field, index) => {
                  const value = getFieldValue(field.key);
                  if (!value) return null;

                  return (
                    <React.Fragment key={field.key}>
                      <DetailRow field={field} value={value} />
                      {index < FIELDS.length - 1 && <Divider />}
                    </React.Fragment>
                  );
                })}
              </View>
            ) : (
              /* Edit mode: input fields */
              <View style={styles.inputsContainer}>
                {FIELDS.map((field) => (
                  <EditField
                    key={field.key}
                    field={field}
                    value={getFieldValue(field.key)}
                    isEditing={editingFields.has(field.key)}
                    onEdit={() => toggleEditing(field.key)}
                    onChangeText={(text) => updateFieldValue(field.key, text)}
                    editableFields={extractedData?.editableFields}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Button section (Frame 2095586322) */}
          <View style={styles.buttonSection}>
            {mode === 'verify' ? (
              <PrimaryButton
                title="Proceed"
                onPress={handleProceed}
                disabled={isConfirming}
                loading={isConfirming}
                showDivider
              />
            ) : (
              <PrimaryButton
                title="Save Changes"
                onPress={handleSaveChanges}
                disabled={isUpdating}
                loading={isUpdating}
                showDivider
              />
            )}

            {mode === 'verify' && (
              <TouchableOpacity onPress={handleEnterManually}>
                <Text style={styles.enterManuallyText}>Enter Manually</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

// ============================================
// STYLES -- All values from Figma REST API
// ============================================

const styles = StyleSheet.create({
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 405,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Main content area (Frame 1686557268: pad=48h, gap=40)
  mainContent: {
    flex: 1,
    paddingHorizontal: F.contentPadH,
    gap: F.mainGap,
    justifyContent: 'space-between',
  },

  // Title group (Frame 1686557318: gap=48)
  titleGroup: {
    gap: F.titleGroupGap,
  },

  // Title text base (size=48, w=400, lineH=64, ls=-2)
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.title.size,
    fontWeight: F.title.weight,
    lineHeight: F.title.lineH,
    letterSpacing: F.title.ls,
  },
  // "Confirm" — Figma override 37: #A9A9A9
  titleGrey: {
    color: F.title.greyColor,
  },
  // "your details" — Figma override 36: #FF9A6D
  titleOrange: {
    color: F.title.orangeColor,
  },

  // ---- Verify Mode: Detail Rows ----

  // Container (Frame 2095586321: gap=16)
  detailsContainer: {
    gap: F.detail.gap,
  },

  // Horizontal row (Agreement ID, Monthly Rent, One-Time Deposit, Rent Duration, Exit Date)
  detailRowHorizontal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: F.detail.rowGap,
  },

  // Vertical row (Property Name, Tenant(s), Landlord(s))
  detailRowVertical: {
    gap: F.detail.rowGap,
  },

  // Label group: icon (16x16) + label text, gap=4
  detailLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: F.detail.labelIconGap,
  },

  // Label (size=12, w=400, lineH=20, #878787)
  detailLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.labelSize,
    fontWeight: F.detail.labelWeight,
    lineHeight: F.detail.labelLineH,
    color: F.detail.labelColor,
  },

  // Value right-aligned (for horizontal layout)
  detailValueRight: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.valueSize,
    fontWeight: F.detail.valueWeight,
    lineHeight: F.detail.valueLineH,
    color: F.detail.valueColor,
    textAlign: 'right',
    flex: 1,
  },

  // Value below (for vertical layout)
  detailValueBelow: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.valueSize,
    fontWeight: F.detail.valueWeight,
    lineHeight: F.detail.valueLineH,
    color: F.detail.valueColor,
  },

  // Divider (Vector stroke=#4d4d4d)
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: F.detail.dividerColor,
  },

  // ---- Edit Mode: Input Fields ----

  // Container (gap=16)
  inputsContainer: {
    gap: F.input.gap,
  },

  // ---- Button Section ----

  // Container (Frame 2095586322: gap=24)
  buttonSection: {
    gap: F.buttonGroupGap,
    alignItems: 'center',
  },

  // "Enter Manually" (size=14, w=400, lineH=20, #a9a9a9)
  enterManuallyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.manual.size,
    fontWeight: F.manual.weight,
    lineHeight: F.manual.lineH,
    color: F.manual.color,
    textAlign: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#ffffff',
  },
});
