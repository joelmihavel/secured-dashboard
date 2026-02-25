/**
 * Edit Payment Method Screen
 *
 * Figma nodes:
 * - 684:5467 (Edit UPI Method)
 * - 684:5627 (Edit Credit Card)
 * - 684:6320 (Edit Net Banking)
 *
 * Shared layout: DottedGridPattern background, back arrow, H1 heading
 * "Edit your\n{Method}", input fields with "edit" hints, "Save Changes" PrimaryButton.
 *
 * Design tokens from Figma:
 * - H1: PlusJakartaSans-Regular, 48px, lineHeight 64, letterSpacing -2
 * - "Edit your" color: #A9A9A9
 * - Method name color: #FF9A6D (brand accent)
 * - Content padding: 48px horizontal
 * - Section gap: 48px (heading to inputs, inputs to button)
 * - Input gap: 16px
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput as RNTextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Screen } from '@/src/components';
import { TextInput, PrimaryButton } from '@/src/components/ui';
import { useSavedPaymentMethods } from '@/src/hooks';
import { addUpiVpa } from '@/src/services/api/payments';
import type { SavedPaymentMethod } from '@/src/services/api/payments';
import { colors } from '@/src/theme';
import { useQueryClient } from '@tanstack/react-query';
import { Text } from '@/src/components';

// ==============================================
// DESIGN TOKENS (from Figma 684:5467/5627/6320)
// ==============================================

const COLORS = {
  background: colors.black[700], // #131313
  headingGray: '#A9A9A9',
  headingAccent: colors.brand[500], // #FF9A6D
  white: colors.white,
};

// ==============================================
// BACK ARROW ICON
// ==============================================

const BackArrowIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 12H5M5 12L12 19M5 12L12 5"
      stroke={COLORS.white}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ==============================================
// FIELD CONFIGS PER METHOD TYPE
// ==============================================

type MethodType = 'upi' | 'card' | 'netbanking';

interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  secureTextEntry?: boolean;
  maxLength?: number;
}

const FIELD_CONFIGS: Record<MethodType, FieldConfig[]> = {
  upi: [
    {
      key: 'accountName',
      label: 'Account holder name',
      placeholder: 'John Smith',
      autoCapitalize: 'words',
    },
    {
      key: 'upiId',
      label: 'UPI ID',
      placeholder: 'john@oksbi',
      keyboardType: 'email-address',
      autoCapitalize: 'none',
    },
  ],
  card: [
    {
      key: 'cardholderName',
      label: 'Cardholder name',
      placeholder: 'John Smith',
      autoCapitalize: 'words',
    },
    {
      key: 'cardNumber',
      label: 'Card number',
      placeholder: '1234 5678 9012 3456',
      keyboardType: 'number-pad',
      maxLength: 19,
    },
    {
      key: 'expiryDate',
      label: 'Expiry date',
      placeholder: '01 / 27',
      keyboardType: 'number-pad',
      maxLength: 7,
    },
    {
      key: 'cvv',
      label: 'CVV',
      placeholder: '***',
      keyboardType: 'number-pad',
      secureTextEntry: true,
      maxLength: 4,
    },
  ],
  netbanking: [
    {
      key: 'bankName',
      label: 'Bank name',
      placeholder: 'ICICI Bank',
      autoCapitalize: 'words',
    },
    {
      key: 'accountName',
      label: 'Account holder name',
      placeholder: 'John Smith',
      autoCapitalize: 'words',
    },
    {
      key: 'accountNumber',
      label: 'Account number',
      placeholder: '1234567890',
      keyboardType: 'number-pad',
    },
    {
      key: 'ifscCode',
      label: 'IFSC code',
      placeholder: 'HDFC0001234',
      autoCapitalize: 'none',
    },
  ],
};

const HEADING_MAP: Record<MethodType, string> = {
  upi: 'UPI Method',
  card: 'Credit Card',
  netbanking: 'Net Banking',
};

// ==============================================
// HELPERS
// ==============================================

/** Pre-fill field values from saved method data */
function getInitialValues(method: SavedPaymentMethod | undefined, type: MethodType): Record<string, string> {
  if (!method) return {};

  switch (type) {
    case 'upi':
      return {
        accountName: method.display_name || '',
        upiId: method.vpa || '',
      };
    case 'card':
      return {
        cardholderName: method.display_name || '',
        cardNumber: method.last_four ? `**** **** **** ${method.last_four}` : '',
        expiryDate:
          method.card_expiry_month && method.card_expiry_year
            ? `${String(method.card_expiry_month).padStart(2, '0')} / ${String(method.card_expiry_year).slice(-2)}`
            : '',
        cvv: '***',
      };
    case 'netbanking':
      return {
        bankName: method.bank_name || '',
        accountName: method.display_name || '',
        accountNumber: '',
        ifscCode: '',
      };
    default:
      return {};
  }
}

// ==============================================
// MAIN COMPONENT
// ==============================================

export default function EditPaymentMethodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ type: string; id: string }>();
  const methodType = (params.type as MethodType) || 'upi';
  const methodId = params.id;

  // Look up the saved method from React Query cache
  const { data: methods } = useSavedPaymentMethods();
  const savedMethod = useMemo(
    () => methods?.find((m) => m.id === methodId),
    [methods, methodId],
  );

  // Field values state
  const [values, setValues] = useState<Record<string, string>>(() =>
    getInitialValues(savedMethod, methodType),
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRefs = useRef<Record<string, RNTextInput | null>>({});

  const fields = FIELD_CONFIGS[methodType] || [];
  const headingText = HEADING_MAP[methodType] || 'Payment Method';

  // Track whether any field has been modified
  const initialValues = useMemo(
    () => getInitialValues(savedMethod, methodType),
    [savedMethod, methodType],
  );
  const hasChanges = useMemo(() => {
    return Object.keys(values).some((key) => values[key] !== (initialValues[key] || ''));
  }, [values, initialValues]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleFieldChange = useCallback((key: string, text: string) => {
    setValues((prev) => ({ ...prev, [key]: text }));
  }, []);

  const handleEditPress = useCallback((key: string) => {
    setEditingField(key);
    // Focus the input after a tick
    setTimeout(() => {
      inputRefs.current[key]?.focus();
    }, 100);
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (methodType === 'upi' && values.upiId) {
        const { error } = await addUpiVpa(values.upiId.trim());
        if (error) {
          Alert.alert('Error', error);
          return;
        }
      }
      // Card and netbanking don't have direct update APIs — the save is a no-op
      // since card tokens are managed by PayU and netbanking is saved via webhook

      // Invalidate cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ['saved-payment-methods'] });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, methodType, values, queryClient, router]);

  return (
    <Screen testID="edit-payment-method-screen" padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Arrow — Figma: 32px icon, paddingHorizontal 48 */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BackArrowIcon />
          </TouchableOpacity>

          {/* H1 Heading — Figma: 48px, 64 lineHeight */}
          <View style={styles.headingContainer}>
            <Text style={styles.heading}>Edit your{'\n'}{headingText}</Text>
          </View>

          {/* Input Fields — Figma: gap 16 between fields */}
          <View style={styles.fieldsContainer}>
            {fields.map((field) => (
              <TextInput
                key={field.key}
                ref={(ref) => { inputRefs.current[field.key] = ref; }}
                label={field.label}
                value={values[field.key] || ''}
                onChangeText={(text) => handleFieldChange(field.key, text)}
                placeholder={field.placeholder}
                hintText="edit"
                onHintPress={() => handleEditPress(field.key)}
                keyboardType={field.keyboardType}
                autoCapitalize={field.autoCapitalize}
                secureTextEntry={field.secureTextEntry}
                maxLength={field.maxLength}
                editable={editingField === field.key || !savedMethod}
                testID={`edit-field-${field.key}`}
              />
            ))}
          </View>

          {/* Save Button — Figma: PrimaryButton with showDivider, centered */}
          <View style={styles.buttonContainer}>
            <PrimaryButton
              title="Save Changes"
              onPress={handleSave}
              showDivider
              loading={isSaving}
              disabled={!hasChanges && !!savedMethod}
              testID="save-changes-button"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 48,
  },
  // Figma: back arrow at top, gap 48 to heading
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 48,
  },
  // Figma: H1 heading block, gap 48 to inputs
  headingContainer: {
    marginBottom: 48,
  },
  // Figma: PlusJakartaSans-Regular 48px, lineHeight 64, color #FFFFFF
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    color: COLORS.white,
  },
  // Figma: 16px gap between input fields
  fieldsContainer: {
    gap: 16,
    marginBottom: 48,
  },
  // Figma: button centered, width fills available (297px in 393px - 48*2 padding)
  buttonContainer: {
    alignItems: 'center',
  },
});
