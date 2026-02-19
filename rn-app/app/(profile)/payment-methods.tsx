/**
 * Payment Methods Edit Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-8450 (UPI), 41-8612 (Credit Card), 41-9307 (Bank Account)
 *
 * Blueprint: buildbot/data/blueprints/41-8450-blueprint.json (UPI reference)
 *
 * Layout hierarchy (from blueprint 41-8450):
 * - Root (41:8450): 393x852, bg #131313
 *   - Background vector (41:8451): decorative T shape, opacity 0.01 (invisible)
 *   - Content area (41:8519): column, gap=64
 *     - Status bar (41:8520): handled by SafeArea
 *     - Form wrapper (41:8521): column, gap=40, paddingH=48
 *       - Inner frame (41:8522): 297px wide, column, gap=48
 *         - Back arrow (41:8523): 32x32
 *         - Title (41:8524): "Edit your  UPI Method" 297x128
 *         - Form fields (41:8525): 297px wide, column, gap=16
 *           - Input fields (41:8526, 41:8527): 297x90 each
 *         - Save button (41:8528): 297x66, column, gap=8
 *           - Pill indicator: 24x2, bg #4D4D4D, radius=200
 *           - Gradient button: 297x56, radius=8, border 0.1px #FF9A6D
 *
 * All three payment screens share the same layout structure:
 * - UPI: 2 fields (Account holder name, UPI ID)
 * - Credit Card: 4 fields (Cardholder name, Card number, Expiry date, CVV)
 * - Bank Account: 4 fields (Bank name, Account holder name, Account number, IFSC code)
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text, TextInput } from '@/src/components';
import { useProfilePaymentMethods, useAddPaymentMethod } from '@/src/hooks';
import { colors, gradients } from '@/src/theme';

// ==============================================
// TYPES
// ==============================================

type PaymentTab = 'upi' | 'credit' | 'bank';

interface FormField {
  key: string;
  label: string;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  maxLength?: number;
}

// ==============================================
// FORM CONFIGURATION PER TAB
// ==============================================

const FORM_CONFIG: Record<PaymentTab, { typeName: string; fields: FormField[] }> = {
  upi: {
    typeName: 'UPI Method',
    fields: [
      { key: 'holderName', label: 'Account holder name', placeholder: 'John Smith' },
      { key: 'upiId', label: 'UPI ID', placeholder: 'john@oksbi' },
    ],
  },
  credit: {
    typeName: 'Credit Card',
    fields: [
      { key: 'holderName', label: 'Cardholder name', placeholder: 'John Smith' },
      { key: 'cardNumber', label: 'Card number', placeholder: '1234 5678 9012 3456', keyboardType: 'numeric', maxLength: 19 },
      { key: 'expiry', label: 'Expiry date', placeholder: 'MM/YY', keyboardType: 'numeric', maxLength: 5 },
      { key: 'cvv', label: 'CVV', placeholder: '123', keyboardType: 'numeric', secureTextEntry: true, maxLength: 4 },
    ],
  },
  bank: {
    typeName: 'Bank Account',
    fields: [
      { key: 'bankName', label: 'Bank name', placeholder: 'State Bank of India' },
      { key: 'holderName', label: 'Account holder name', placeholder: 'John Smith' },
      { key: 'accountNumber', label: 'Account number', placeholder: '1234567890', keyboardType: 'numeric' },
      { key: 'ifsc', label: 'IFSC code', placeholder: 'SBIN0001234' },
    ],
  },
};

// ==============================================
// HELPERS
// ==============================================

function getInitialValues(
  tab: PaymentTab,
  data: ReturnType<typeof useProfilePaymentMethods>['data'],
): Record<string, string> {
  if (!data) return {};

  if (tab === 'upi') {
    const method = data.groupedMethods.upi[0];
    if (!method) return {};
    return {
      holderName: method.displayName || '',
      upiId: method.upiVpa || '',
    };
  }

  if (tab === 'credit') {
    const method = data.groupedMethods.cards[0];
    if (!method) return {};
    return {
      holderName: method.displayName || '',
      cardNumber: method.cardLast4 ? `**** **** **** ${method.cardLast4}` : '',
      expiry:
        method.cardExpiryMonth && method.cardExpiryYear
          ? `${String(method.cardExpiryMonth).padStart(2, '0')}/${String(method.cardExpiryYear).slice(-2)}`
          : '',
      cvv: '',
    };
  }

  if (tab === 'bank') {
    const method = data.groupedMethods.netbanking[0];
    if (!method) return {};
    return {
      bankName: method.bankName || '',
      holderName: method.displayName || '',
      accountNumber: '',
      ifsc: method.bankCode || '',
    };
  }

  return {};
}

// ==============================================
// MAIN COMPONENT
// ==============================================

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const activeTab: PaymentTab = (tab === 'credit' || tab === 'bank' || tab === 'upi') ? tab : 'upi';

  const { data: methodsData } = useProfilePaymentMethods();
  const addMethod = useAddPaymentMethod();

  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    if (methodsData) {
      const initial = getInitialValues(activeTab, methodsData);
      setFormValues(initial);
    }
  }, [methodsData, activeTab]);

  const config = FORM_CONFIG[activeTab];

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleEditPress = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingField(prev => (prev === key ? null : key));
  }, []);

  const handleSave = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (activeTab === 'upi' && formValues.upiId) {
      addMethod.mutate(
        {
          type: 'upi',
          details: formValues.upiId,
          metadata: { displayName: formValues.holderName },
        },
        { onSuccess: () => router.back() },
      );
    } else if (activeTab === 'credit' && formValues.cardNumber) {
      addMethod.mutate(
        {
          type: 'card',
          details: formValues.cardNumber.replace(/\s/g, ''),
          metadata: {
            displayName: formValues.holderName,
            expiry: formValues.expiry,
          },
        },
        { onSuccess: () => router.back() },
      );
    } else if (activeTab === 'bank' && formValues.accountNumber) {
      addMethod.mutate(
        {
          type: 'netbanking',
          details: formValues.accountNumber,
          metadata: {
            displayName: formValues.holderName,
            bankName: formValues.bankName,
            ifsc: formValues.ifsc,
          },
        },
        { onSuccess: () => router.back() },
      );
    }
  }, [activeTab, formValues, addMethod, router]);

  const hasValues = useMemo(() => {
    return config.fields.some(f => (formValues[f.key] ?? '').trim().length > 0);
  }, [config.fields, formValues]);

  return (
    <Screen testID="payment-methods-screen" padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Content area matching blueprint (41:8521/41:8522) */}
          {/* paddingH=48, inner 297px wide, gap=48 between sections */}
          <View style={styles.contentWrapper}>
            {/* Back arrow (41:8523): 32x32 */}
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>

            {/* Title (41:8524): "Edit your  UPI Method" 297x128 */}
            <Text style={styles.titleBase}>
              <Text inherit style={styles.titleGray}>
                {'Edit your  '}
              </Text>
              <Text inherit style={styles.titleAccent}>
                {config.typeName}
              </Text>
            </Text>

            {/* Form fields (41:8525): 297px wide, gap=16 */}
            <View style={styles.formContainer}>
              {config.fields.map((field) => (
                <TextInput
                  key={field.key}
                  label={field.label}
                  value={formValues[field.key] ?? ''}
                  onChangeText={(text) => handleFieldChange(field.key, text)}
                  placeholder={field.placeholder}
                  hintText="edit"
                  onHintPress={() => handleEditPress(field.key)}
                  variant="dark"
                  keyboardType={field.keyboardType}
                  secureTextEntry={field.secureTextEntry}
                  maxLength={field.maxLength}
                  editable={editingField === field.key || !formValues[field.key]}
                  testID={`input-${field.key}`}
                />
              ))}
            </View>

            {/* Save button area (41:8528): 297x66, column, gap=8 */}
            <View style={styles.saveContainer}>
              {/* Indicator pill: 24x2, bg=#4D4D4D, borderRadius=200 */}
              <View style={styles.indicatorPill} />

              {/* Gradient button: 297x56, borderRadius=8, border 0.1px #FF9A6D */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={!hasValues || addMethod.isPending}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Save changes"
                style={styles.saveButtonTouchable}
              >
                <LinearGradient
                  colors={gradients.button.colors as unknown as readonly [string, string, ...string[]]}
                  locations={gradients.button.locations as unknown as readonly [number, number, ...number[]]}
                  start={gradients.button.start}
                  end={gradients.button.end}
                  style={[
                    styles.saveButtonGradient,
                    (!hasValues || addMethod.isPending) && styles.saveButtonDisabled,
                  ]}
                >
                  <Text style={styles.saveButtonText}>
                    {addMethod.isPending ? 'Saving...' : 'Save Changes'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ==============================================
// STYLES -- Pixel-perfect from Figma blueprint
// ==============================================

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  // Content wrapper (41:8521): paddingH=48
  // Inner frame (41:8522): 297px wide, gap=48
  contentWrapper: {
    paddingHorizontal: 48,
    gap: 48,
  },
  // Back arrow (41:8523): 32x32 icon area
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  // Title (41:8524): 48px/64 Regular, wraps to 2 lines in 297px
  titleBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -1,
    maxWidth: 297,
  },
  // "Edit your " in #A9A9A9
  titleGray: {
    color: '#A9A9A9',
  },
  // Type name in #FF9A6D
  titleAccent: {
    color: '#FF9A6D',
  },
  // Form container (41:8525): 297px wide, gap=16
  formContainer: {
    gap: 16,
  },
  // Save area (41:8528): 297x66 total, gap=8, center aligned
  saveContainer: {
    alignItems: 'center',
  },
  // Indicator pill: 24x2, bg=#4D4D4D, borderRadius=200
  indicatorPill: {
    width: 24,
    height: 2,
    backgroundColor: '#4D4D4D',
    borderRadius: 200,
    marginBottom: 8,
  },
  saveButtonTouchable: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  // Gradient button: 297x56, borderRadius=8, border 0.1px #FF9A6D
  saveButtonGradient: {
    height: 56,
    borderRadius: 8,
    borderWidth: 0.1,
    borderColor: '#FF9A6D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  // "Save Changes" 16px/24 Medium #FFFFFF
  saveButtonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
