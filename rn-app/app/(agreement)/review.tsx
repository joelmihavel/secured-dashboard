/**
 * Agreement Review Screen
 *
 * Two modes based on Figma designs:
 * - Verify (1:30448): Read-only detail rows with "Proceed" button
 * - Edit (1:30820): Editable input fields with "Save Changes" button
 *
 * Flow: verify → (Enter Manually) → edit → (Save Changes) → verify → (Proceed) → success
 *
 * All values sourced from Figma REST API — no AI guesswork.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput as RNTextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Text } from '@/src/components';
import { DottedPattern } from '@/src/components/patterns';
import { useAgreement } from '@/src/hooks';
import {
  formatPaiseToRupees,
  formatDateDisplay,
  type ExtractedAgreementData,
} from '@/src/services/api/agreement';

// ============================================
// FIGMA CONSTANTS — Figma REST API (1:30448, 1:30820)
// ============================================

const F = {
  // Screen
  bg: '#131313',
  contentPadH: 48, // Frame 1686557268 paddingLeft/Right

  // Layout gaps (from Figma frame itemSpacing)
  mainGap: 40,       // Frame 1686557268 gap
  titleGroupGap: 48, // Frame 1686557318 gap
  buttonGroupGap: 24, // Frame 2095586322 gap

  // Title (both screens: size=48, w=400, lineH=64, ls=-2, #ffffff)
  title: {
    size: 48,
    weight: '400' as const,
    lineH: 64,
    ls: -2,
    color: '#ffffff',
  },

  // Detail rows (verify mode — 1:30448)
  detail: {
    gap: 16,          // Frame 2095586321 itemSpacing
    rowGap: 4,        // within row frame gap
    labelSize: 12,    // TEXT "Agreement ID" size=12
    labelWeight: '400' as const,
    labelColor: '#878787',
    valueSize: 14,    // TEXT "KIA 123456789" size=14
    valueWeight: '400' as const,
    valueColor: '#cbcbcb',
    dividerColor: '#4d4d4d', // Vector stroke
  },

  // Input fields (edit mode — 1:30820)
  input: {
    gap: 16,              // Frame 2095586312 itemSpacing
    bg: '#222222',        // Input bg
    borderActive: '#4d4d4d',  // stroke on first 2 inputs
    borderFilled: '#0d0d0d',  // stroke on filled inputs 3-8
    radius: 12,
    padV: 16,             // Input paddingTop/Bottom
    padH: 16,             // Input paddingLeft
    labelSize: 12,        // w=500
    labelWeight: '500' as const,
    labelColor: '#a9a9a9',
    editSize: 14,         // "Edit" text w=400
    editWeight: '400' as const,
    editColor: '#878787',
    valueSize: 20,        // value text size=20
    valueWeight: '400' as const,
    valueLineH: 32,
    filledColor: '#dddddd',
    placeholderColor: '#222222',
    hintSize: 14,
    hintWeight: '400' as const,
    hintColor: '#878787',
    labelGap: 6,          // gap between label row and input
  },

  // Button (both screens — stroke=#ff9a6d, r=8)
  button: {
    height: 56,           // Frame 2095586312 (button inner) height
    radius: 8,
    border: '#ff9a6d',
    textSize: 16,         // "Proceed"/"Save Changes" size=16
    textWeight: '500' as const,
    textColor: '#ffffff',
    textLineH: 24,
    pad: 16,
  },

  // Decorative pill above button
  pill: {
    w: 24,               // Rectangle 140 width
    h: 2,                // Rectangle 140 height
    color: '#4d4d4d',
    radius: 200,
  },

  // "Enter Manually" link (verify mode only)
  manual: {
    size: 14,            // size=14, w=400
    weight: '400' as const,
    lineH: 20,
    color: '#a9a9a9',
  },
} as const;

// ============================================
// FIELD DEFINITIONS
// ============================================

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  hintText?: string;
  /** Key for update-extraction modifications object */
  backendKey?: string;
  isMonetary?: boolean;
  getValue: (data: ExtractedAgreementData) => string;
}

const FIELDS: FieldDef[] = [
  {
    key: 'certificateNo',
    label: 'Agreement ID',
    placeholder: 'e.g. KIA123456789',
    hintText: 'Certificate number from agreement',
    // Not in backend MODIFIABLE_FIELDS — no backendKey
    getValue: (d) => d.certificateNo ?? '',
  },
  {
    key: 'propertyName',
    label: 'Property Name',
    placeholder: 'e.g. Prestige Pinestripe, Bengaluru',
    hintText: 'Full property address',
    backendKey: 'property_address',
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
    getValue: (d) => d.tenantNames?.join(', ') ?? '',
  },
  {
    key: 'landlords',
    label: 'Landlord(s)',
    placeholder: 'e.g. Lisa Appleseed',
    backendKey: 'landlord_name',
    getValue: (d) => d.landlordNames?.join(', ') ?? '',
  },
  {
    key: 'monthlyRent',
    label: 'Monthly Rent',
    placeholder: 'e.g. 40,000',
    backendKey: 'monthly_rent',
    isMonetary: true,
    getValue: (d) => d.monthlyRentPaise ? `\u20B9 ${formatPaiseToRupees(d.monthlyRentPaise)}` : '',
  },
  {
    key: 'deposit',
    label: 'One-Time Deposit',
    placeholder: 'e.g. 130,000',
    backendKey: 'security_deposit',
    isMonetary: true,
    getValue: (d) => d.securityDepositPaise ? `\u20B9 ${formatPaiseToRupees(d.securityDepositPaise)}` : '',
  },
  {
    key: 'duration',
    label: 'Rent Duration',
    placeholder: 'e.g. 11 Months',
    // Derived from dates — no backendKey
    getValue: (d) => d.rentDurationMonths ? `${d.rentDurationMonths} Months` : '',
  },
  {
    key: 'exitDate',
    label: 'Exit Date',
    placeholder: 'e.g. 31 Dec 2027',
    backendKey: 'lease_end_date',
    getValue: (d) => d.leaseEndDate ? formatDateDisplay(d.leaseEndDate) : '',
  },
];

// ============================================
// SUB-COMPONENTS
// ============================================

/** Detail row for verify mode — matches Figma 1:30448 detail frames */
const DetailRow = ({ label, value }: { label: string; value: string }) => {
  const isLong = value.length > 30;

  return (
    <View style={isLong ? styles.detailRowVertical : styles.detailRowHorizontal}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={isLong ? styles.detailValueBelow : styles.detailValueRight}>
        {value}
      </Text>
    </View>
  );
};

/** Divider between detail rows — Vector stroke=#4d4d4d */
const Divider = () => <View style={styles.divider} />;

/** Outline button matching Figma button instance */
const OutlineButton = ({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) => (
  <View style={styles.buttonOuter}>
    <View style={styles.buttonPill} />
    <TouchableOpacity
      style={[styles.button, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <Text style={styles.buttonText}>
        {loading ? 'Saving...' : label}
      </Text>
    </TouchableOpacity>
  </View>
);

/** Editable field for edit mode — matches Figma 1:30820 input instances */
const EditField = ({
  field,
  value,
  isEditing,
  onEdit,
  onChangeText,
}: {
  field: FieldDef;
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onChangeText: (text: string) => void;
}) => {
  const hasValue = value.length > 0;
  const showEditButton = hasValue && !isEditing;
  const isFieldEditable = isEditing || !hasValue;

  return (
    <View style={styles.editFieldContainer}>
      {/* Label row */}
      <View style={styles.editLabelRow}>
        <Text style={styles.editLabel}>{field.label}</Text>
        {showEditButton ? (
          <TouchableOpacity
            onPress={onEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        ) : !hasValue && field.hintText ? (
          <Text style={styles.editHint}>{field.hintText}</Text>
        ) : null}
      </View>

      {/* Input */}
      <View
        style={[
          styles.editInput,
          {
            borderColor: isFieldEditable
              ? F.input.borderActive
              : F.input.borderFilled,
          },
        ]}
      >
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          editable={isFieldEditable}
          placeholder={field.placeholder}
          placeholderTextColor={F.input.placeholderColor}
          style={[
            styles.editInputText,
            hasValue && { color: F.input.filledColor },
          ]}
          keyboardType={field.isMonetary ? 'numeric' : 'default'}
        />
      </View>
    </View>
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

    // Build modifications: only include fields with a backendKey that changed
    const modifications: Record<string, string | number> = {};

    for (const field of FIELDS) {
      if (!field.backendKey) continue;
      const edited = editValues[field.key];
      const original = fieldValues[field.key];

      if (edited !== undefined && edited !== original) {
        if (field.isMonetary) {
          // Strip currency symbol and commas, convert to rupees
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
    <Screen testID="review-screen">
      {/* Background pattern */}
      <View style={styles.backgroundPattern}>
        <DottedPattern />
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
            <Text style={styles.title}>
              {mode === 'verify'
                ? 'Confirm your\ndetails'
                : "Let's fix the\ndetails"}
            </Text>

            {/* Verify mode: detail rows */}
            {mode === 'verify' ? (
              <View style={styles.detailsContainer}>
                {FIELDS.map((field, index) => {
                  const value = getFieldValue(field.key);
                  if (!value) return null;

                  return (
                    <React.Fragment key={field.key}>
                      <DetailRow label={field.label} value={value} />
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
                  />
                ))}
              </View>
            )}
          </View>

          {/* Button section (Frame 2095586322) */}
          <View style={styles.buttonSection}>
            <OutlineButton
              label={mode === 'verify' ? 'Proceed' : 'Save Changes'}
              onPress={mode === 'verify' ? handleProceed : handleSaveChanges}
              disabled={mode === 'verify' ? isConfirming : isUpdating}
              loading={mode === 'verify' ? isConfirming : isUpdating}
            />

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
// STYLES — All values from Figma REST API
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

  // Title text (size=48, w=400, lineH=64, ls=-2, #ffffff)
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.title.size,
    fontWeight: F.title.weight,
    lineHeight: F.title.lineH,
    letterSpacing: F.title.ls,
    color: F.title.color,
  },

  // ---- Verify Mode: Detail Rows ----

  // Container (Frame 2095586321: gap=16)
  detailsContainer: {
    gap: F.detail.gap,
  },

  // Horizontal row (short values, e.g. "Agreement ID")
  detailRowHorizontal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: F.detail.rowGap,
  },

  // Vertical row (long values, e.g. "Property Name")
  detailRowVertical: {
    gap: F.detail.rowGap,
  },

  // Label (size=12, w=400, #878787)
  detailLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.labelSize,
    fontWeight: F.detail.labelWeight,
    lineHeight: 20,
    color: F.detail.labelColor,
  },

  // Value right-aligned (for horizontal layout)
  detailValueRight: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.valueSize,
    fontWeight: F.detail.valueWeight,
    lineHeight: 20,
    color: F.detail.valueColor,
    textAlign: 'right',
    flex: 1,
  },

  // Value below (for vertical layout)
  detailValueBelow: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.valueSize,
    fontWeight: F.detail.valueWeight,
    lineHeight: 20,
    color: F.detail.valueColor,
  },

  // Divider (Vector stroke=#4d4d4d)
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: F.detail.dividerColor,
  },

  // ---- Edit Mode: Input Fields ----

  // Container (Frame 2095586312: gap=16)
  inputsContainer: {
    gap: F.input.gap,
  },

  // Field wrapper (gap=6 between label and input)
  editFieldContainer: {
    gap: F.input.labelGap,
  },

  // Label row (horizontal: label + "Edit"/"hint")
  editLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Label (size=12, w=500, #a9a9a9)
  editLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: F.input.labelSize,
    fontWeight: F.input.labelWeight,
    lineHeight: 20,
    color: F.input.labelColor,
  },

  // "Edit" button text (size=14, w=400, #878787)
  editButtonText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.input.editSize,
    fontWeight: F.input.editWeight,
    lineHeight: 20,
    color: F.input.editColor,
  },

  // Hint text (size=14, w=400, #878787)
  editHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.input.hintSize,
    fontWeight: F.input.hintWeight,
    lineHeight: 20,
    color: F.input.hintColor,
  },

  // Input container (bg=#222222, border, r=12)
  editInput: {
    backgroundColor: F.input.bg,
    borderWidth: 1,
    borderRadius: F.input.radius,
    paddingHorizontal: F.input.padH,
  },

  // Input text (size=20, w=400, lineH=32, placeholder=#222222)
  editInputText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.input.valueSize,
    fontWeight: F.input.valueWeight,
    lineHeight: F.input.valueLineH,
    color: F.input.placeholderColor,
    paddingVertical: F.input.padV,
  },

  // ---- Button Section ----

  // Container (Frame 2095586322: gap=24)
  buttonSection: {
    gap: F.buttonGroupGap,
    alignItems: 'center',
  },

  // Button outer (contains pill + button)
  buttonOuter: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },

  // Decorative pill (Rectangle 140: 24x2, #4d4d4d, r=200)
  buttonPill: {
    width: F.pill.w,
    height: F.pill.h,
    backgroundColor: F.pill.color,
    borderRadius: F.pill.radius,
  },

  // Button (Frame 2095586312: h=56, stroke=#ff9a6d, r=8)
  button: {
    width: '100%',
    height: F.button.height,
    borderWidth: 1,
    borderColor: F.button.border,
    borderRadius: F.button.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: F.button.pad,
  },

  // Button text (size=16, w=500, #ffffff)
  buttonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: F.button.textSize,
    fontWeight: F.button.textWeight,
    lineHeight: F.button.textLineH,
    color: F.button.textColor,
    textAlign: 'center',
  },

  // "Enter Manually" (size=14, w=400, #a9a9a9)
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
