/**
 * Payment Methods Edit Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-8450 (UPI), 41-8515 (Credit Card), 41-8580 (Bank Account)
 *
 * Displays an EDIT FORM for a single payment type, determined by `tab` query param.
 * Supported tabs: upi | credit | bank
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text, TextInput } from '@/src/components';
import { useProfilePaymentMethods, useAddPaymentMethod } from '@/src/hooks';
import { colors, spacing, radius, gradients } from '@/src/theme';

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

/**
 * Populate initial form values from saved payment method data.
 */
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
  const insets = useSafeAreaInsets();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const activeTab: PaymentTab = (tab === 'credit' || tab === 'bank' || tab === 'upi') ? tab : 'upi';

  const { data: methodsData } = useProfilePaymentMethods();
  const addMethod = useAddPaymentMethod();

  // Form state: keyed by field key
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);

  // Populate form from saved data when it loads
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

    // Build mutation payload based on tab
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

  // Check if form has any values to enable save
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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button — Figma: 32x32 icon area */}
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>

          {/* Title — Figma: 297x128, 48/400, 2-line wrap */}
          <View style={styles.titleContainer}>
            <Text
              style={styles.titleBase}
            >
              <Text inherit style={styles.titleGray}>
                {'Edit your  '}
              </Text>
              <Text inherit style={styles.titleAccent}>
                {config.typeName}
              </Text>
            </Text>
          </View>

          {/* Form Fields — Figma: 297px wide, gap=16 */}
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

          {/* Save Button — Figma: 297x66 total (2px pill + 8px gap + 56px button) */}
          <View style={styles.saveContainer}>
            {/* Indicator pill — Figma: 24x2, bg=#4D4D4D, borderRadius=200 */}
            <View style={styles.indicatorPill} />

            {/* Gradient button — Figma: 297x56, borderRadius=8, border 0.1px #FF9A6D */}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ==============================================
// STYLES — Pixel-perfect from Figma blueprint
// ==============================================

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  // Figma: content frame paddingH=48
  scrollContent: {
    paddingHorizontal: 48,
    paddingTop: 0,
  },
  // Figma: back arrow 32x32 icon area, positioned at top of content
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  // Figma: title area 297x128, gap=48 from back button
  // 48px gap between back arrow and title
  titleContainer: {
    width: 297,
    marginTop: 48,
    marginBottom: 48,
  },
  // Figma: 48px fontSize, fontWeight 400 (Regular), wraps to 2 lines
  titleBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -1,
  },
  // Figma: "Edit your " in #A9A9A9
  titleGray: {
    color: '#A9A9A9',
  },
  // Figma: type name in #FF9A6D (brand accent)
  titleAccent: {
    color: '#FF9A6D',
  },
  // Figma: form container 297px wide, gap=16 between fields
  formContainer: {
    width: 297,
    gap: 16,
  },
  // Figma: save area 297x66 total, 48px gap from form
  saveContainer: {
    width: 297,
    marginTop: 48,
    alignItems: 'center',
  },
  // Figma: 24x2, bg=#4D4D4D, borderRadius=200
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
  // Figma: 297x56, gradient bg, borderRadius=8, border 0.1px #FF9A6D
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
  // Figma: "Save Changes" 16/500 #FFFFFF
  saveButtonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
