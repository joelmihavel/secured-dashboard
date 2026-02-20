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
import { colors } from '@/src/theme';

// ============================================
// FIGMA CONSTANTS -- Figma REST API (1:30448, 1:30820)
// ============================================

const F = {
  // Screen
  bg: colors.black[700],
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
  //   "Confirm" (chars 0-6) -> override 37 -> #A9A9A9 (grey)
  //   "your details" (chars 8-19) -> override 36 -> #FF9A6D (brand orange)
  title: {
    size: 48,
    lineH: 64,
    ls: -2,
    greyColor: colors.neutral[500],   // "Confirm" -- override 37 fill r=0.6627
    orangeColor: colors.brand[500],  // "your details" -- override 36 fill r=1.0,g=0.6039,b=0.4274
  },

  // Detail rows (verify mode -- 1:30448)
  // Frame 2095586321: column, gap=16
  // Horizontal row (Frame 1686557333): row, space-between, center, gap=4
  // Vertical row (Frame 1686557036): column, center, gap=4
  // Label group (Frame 1686557121/1686557120): row, flex-start, center, gap=4
  // Divider (Vector 50): stroke #4D4D4D, weight 0.25
  detail: {
    gap: 16,          // Frame 2095586321 itemSpacing
    rowGap: 4,        // within row frame gap
    labelSize: 12,    // TEXT size=12
    labelLineH: 20,
    labelColor: colors.neutral[600],
    labelIconGap: 4,  // Frame gap between icon and label text
    valueSize: 14,    // TEXT size=14
    valueLineH: 20,
    valueColor: colors.neutral[300],
    dividerColor: colors.black[400], // Vector stroke
    dividerWeight: 0.25,     // Figma stroke weight
  },

  // Input fields (edit mode -- 1:30820)
  input: {
    gap: 16,              // Frame itemSpacing
    bg: colors.neutral[900],
    borderActive: colors.black[400],
    borderFilled: colors.black[800],
    radius: 12,
    padV: 16,
    padH: 16,
    labelSize: 12,
    labelColor: colors.neutral[500],
    editSize: 14,
    editColor: colors.neutral[600],
    valueSize: 20,
    valueLineH: 32,
    filledColor: colors.neutral[200],
    placeholderColor: colors.neutral[900],
    hintSize: 14,
    hintColor: colors.neutral[600],
    labelGap: 6,
  },

  // "Enter Manually" link (verify mode only)
  manual: {
    size: 14,
    lineH: 20,
    color: colors.neutral[500],
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

/**
 * Detail row for verify mode -- matches Figma 1:30448 detail frames.
 *
 * Horizontal row (Frame 1686557333): row, space-between, center, gap=4
 *   - Label group (Frame 1686557121): row, flex-start, center, gap=4
 *   - Value (TEXT): HUG, textAlign=left
 *
 * Vertical row (Frame 1686557036): column, center, gap=4
 *   - Label group (Frame 1686557120): row, flex-start, center, gap=4, FILL width
 *   - Value (TEXT): FILL width
 */
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
      {/* Label group: icon (16x16) + label text, gap=4 */}
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

/** Divider between detail rows -- Vector stroke=#4d4d4d, weight=0.25 */
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

  // "Edit" only on EDITABLE filled fields -- not all filled fields
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
  const { extractionId, state: stateParam } = useLocalSearchParams<{
    extractionId?: string;
    state?: string;
  }>();

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

  // Mode: verify (read-only detail rows) or edit (input fields).
  // Defaults to 'verify'; can be overridden by:
  //   ?state=verify  → 'verify' mode (read-only)
  //   ?state=modify  → 'edit' mode (input fields)
  const initialMode = stateParam === 'modify' ? 'edit' : 'verify';
  const [mode, setMode] = useState<'verify' | 'edit'>(initialMode);

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
          {/* Title group (Frame 1686557318: column, gap=48, FILL width) */}
          <View style={styles.titleGroup}>
            {/* Flent logo icon (Frame 1686557264: 32x38, white) -- visible in both modes */}
            <FlentLogoIcon size={F.logo.h} color="#ffffff" />

            {/* Title text (48px, Regular, lineH=64, ls=-2) */}
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

            {/* Verify mode: detail rows (Frame 2095586321: column, gap=16) */}
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
              /* Edit mode: input fields (gap=16) */
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

          {/* Button section (Frame 2095586322: column, gap=24, FILL width, alignItems=flex-start) */}
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

            {/* Enter Manually (TEXT: 14px, Regular, lineH=20, #A9A9A9, textAlign=center, FILL width) */}
            {mode === 'verify' && (
              <TouchableOpacity
                style={styles.enterManuallyTouchable}
                onPress={handleEnterManually}
              >
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

  // Main content area (Frame 1686557268: column, gap=40, padH=48, alignItems=center)
  mainContent: {
    flex: 1,
    paddingHorizontal: F.contentPadH,
    gap: F.mainGap,
    justifyContent: 'space-between',
  },

  // Title group (Frame 1686557318: column, gap=48, FILL width, alignItems=flex-start)
  titleGroup: {
    gap: F.titleGroupGap,
  },

  // Title text base (PlusJakartaSans-Regular, 48px, lineH=64, ls=-2)
  // NEVER use fontWeight -- always fontFamily per builder rules
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.title.size,
    lineHeight: F.title.lineH,
    letterSpacing: F.title.ls,
  },
  // "Confirm" -- Figma span 0-7: #A9A9A9
  titleGrey: {
    color: F.title.greyColor,
  },
  // "your details" -- Figma span 8-20: #FF9A6D
  titleOrange: {
    color: F.title.orangeColor,
  },

  // ---- Verify Mode: Detail Rows ----

  // Container (Frame 2095586321: column, gap=16, FILL width)
  detailsContainer: {
    gap: F.detail.gap,
  },

  // Horizontal row (Frame 1686557333: row, space-between, center, gap=4, FILL width)
  // Used for: Agreement ID, Monthly Rent, One-Time Deposit, Rent Duration, Exit Date
  detailRowHorizontal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: F.detail.rowGap,
  },

  // Vertical row (Frame 1686557036: column, justify=center, gap=4, FILL width)
  // Used for: Property Name, Tenant(s), Landlord(s)
  detailRowVertical: {
    justifyContent: 'center',
    gap: F.detail.rowGap,
  },

  // Label group (Frame 1686557121/1686557120): row, flex-start, center, gap=4
  // Icon: 16x16, Label: HUG
  detailLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: F.detail.labelIconGap,
  },

  // Label text (PlusJakartaSans-Regular, 12px, lineH=20, #878787)
  detailLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.labelSize,
    lineHeight: F.detail.labelLineH,
    color: F.detail.labelColor,
  },

  // Value right-aligned (for horizontal layout)
  // Figma: HUG content, textAlign=left, #CBCBCB
  // In row with space-between, HUG naturally floats to the right
  detailValueRight: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.valueSize,
    lineHeight: F.detail.valueLineH,
    color: F.detail.valueColor,
  },

  // Value below label (for vertical layout)
  // Figma: FILL width, textAlign=left, #CBCBCB
  detailValueBelow: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.valueSize,
    lineHeight: F.detail.valueLineH,
    color: F.detail.valueColor,
  },

  // Divider (Vector 50: stroke=#4D4D4D, weight=0.25, FILL width)
  divider: {
    height: F.detail.dividerWeight,
    backgroundColor: F.detail.dividerColor,
  },

  // ---- Edit Mode: Input Fields ----

  // Container (gap=16)
  inputsContainer: {
    gap: F.input.gap,
  },

  // ---- Button Section ----

  // Container (Frame 2095586322: column, gap=24, FILL width, alignItems=flex-start)
  buttonSection: {
    gap: F.buttonGroupGap,
  },

  // "Enter Manually" touchable -- full width for easy tap target
  enterManuallyTouchable: {
    alignSelf: 'stretch',
  },

  // "Enter Manually" (PlusJakartaSans-Regular, 14px, lineH=20, #A9A9A9, textAlign=center, FILL width)
  enterManuallyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.manual.size,
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
    color: colors.white,
  },
});
