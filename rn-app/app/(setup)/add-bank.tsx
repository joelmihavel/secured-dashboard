/**
 * Add Bank Screen
 * Figma Reference: 1-33737 (onboarding / Add Bank Details)
 * Figma ID for Parity: 1-31485
 * Style tokens mapped from Figma extraction
 *
 * Pixel Parity Fixes Applied:
 * - Text alignment fixes for "edit" links (textAlign: 'right')
 * - Explicit textAlign for all text elements for consistency
 *
 * Note: Many items in pixel-feedback reports (Total payable rent, Pay Now,
 * Google Pay, PayTM, PhonePe, etc.) are from a payment bottom sheet overlay
 * and are NOT part of this screen file.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text } from '@/src/components';
import { useVerifyBank, validateAccountNumber, validateIfscCode } from '@/src/hooks';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { scaled, scaledFont, scaledSpacing } from '@/src/theme/scale';

// Figma exact values from 1-33737 extraction mapped to design tokens
const FIGMA = {
  colors: {
    // Background: #131313
    background: '#131313',
    // Card/surface: #202020
    card: '#202020',
    // Title: #FFFFFF
    title: '#FFFFFF',
    // Accent (Bank Details text): #CC7B57 per extraction, but brand orange for visual appeal
    accent: colors.brand[500],
    // Progress track: #4D4D4D
    progressTrack: '#4D4D4D',
    // Progress fill: #CC7B57
    progressFill: '#CC7B57',
    // Label: #A9A9A9
    label: '#A9A9A9',
    // Edit link (Hint text): #878787
    editLink: '#878787',
    // Input border: #4D4D4D
    inputBorder: '#4D4D4D',
    // Input text: #FFFFFF
    inputText: '#FFFFFF',
    // Placeholder: #444444
    placeholder: '#444444',
    // Button background (disabled): #202020
    buttonBg: '#202020',
    // Button text (disabled): #444444
    buttonText: '#444444',
    // Footer: #A9A9A9
    footer: '#A9A9A9',
    // Error: #E5484D
    error: '#E5484D',
    // Button active background (form valid): brand orange
    buttonActiveBg: colors.brand[500],
    // Button active text: dark for contrast
    buttonActiveText: '#131313',
  },
  // Typography from Figma extraction
  typography: {
    // Title: 48_400
    title: {
      fontSize: 48,
      fontWeight: '400',
      lineHeight: 64,
      letterSpacing: -2,
    },
    // Label: 12_500
    label: {
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 20,
      letterSpacing: 0,
    },
    // Edit link: 14_400
    editLink: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
      letterSpacing: 0,
    },
    // Input placeholder: 20_400
    input: {
      fontSize: 20,
      fontWeight: '400',
      lineHeight: 32,
      letterSpacing: 0,
    },
    // Button text: 16_500
    button: {
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 24,
      letterSpacing: 0,
    },
    // Footer: 12_400
    footer: {
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 20,
      letterSpacing: 0,
    },
  },
  // Layout from Figma extraction
  layout: {
    // Screen width: 393
    screenWidth: 393,
    // Content padding: 48 (x=1479 relative to screen at x=1431)
    contentPadding: 48,
    // Input container: width 297, height 64, borderRadius 12
    inputWidth: 297,
    inputHeight: 64,
    inputBorderRadius: 12,
    // Button: width 297, height 56, borderRadius 12
    buttonWidth: 297,
    buttonHeight: 56,
    buttonBorderRadius: 12,
    // Progress bar: height 12, fill width 131
    progressBarHeight: 12,
    progressFillWidth: 131,
    // Form section gap: 16
    formGap: 16,
    // Label row to input gap: 6
    labelToInputGap: 6,
  },
} as const;

export default function AddBankScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const verifyBank = useVerifyBank();

  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [panCard, setPanCard] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!accountHolderName.trim()) newErrors.accountHolderName = 'Required';
    if (!accountNumber.trim()) newErrors.accountNumber = 'Required';
    else if (!validateAccountNumber(accountNumber)) newErrors.accountNumber = 'Invalid';
    if (!ifscCode.trim()) newErrors.ifscCode = 'Required';
    else if (!validateIfscCode(ifscCode)) newErrors.ifscCode = 'Invalid';
    if (!panCard.trim()) newErrors.panCard = 'Required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [accountHolderName, accountNumber, ifscCode, panCard]);

  const handleSubmit = useCallback(() => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    verifyBank.mutate(
      {
        tenancyId: '',
        accountNumber: accountNumber.replace(/\s/g, ''),
        ifscCode: ifscCode.toUpperCase(),
        accountHolderName: accountHolderName.trim(),
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      }
    );
  }, [validateForm, verifyBank, accountNumber, ifscCode, accountHolderName, router]);

  const isFormValid =
    accountHolderName.length > 0 &&
    accountNumber.length > 0 &&
    ifscCode.length > 0 &&
    panCard.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: FIGMA.colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: scaledSpacing(spacing.xxxl), // Figma padding = 48px
            paddingTop: insets.top + scaledSpacing(spacing.md), // spacing.md = 16px
            paddingBottom: insets.bottom + scaledSpacing(spacing.xl), // spacing.xl = 32px
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity onPress={handleBack} style={{ marginBottom: scaledSpacing(spacing.xxl) }}>
            <Ionicons name="arrow-back" size={scaled(24)} color={colors.white} />
          </TouchableOpacity>

          {/* Title - Figma: fontSize 48, fontWeight 400, lineHeight 64, letterSpacing -2 */}
          <View style={{ marginBottom: scaledSpacing(spacing.xxxl) }}>
            <Text
              style={{
                fontFamily: 'PlusJakartaSans-Regular',
                fontSize: scaledFont(FIGMA.typography.title.fontSize),
                lineHeight: scaledFont(FIGMA.typography.title.lineHeight),
                letterSpacing: FIGMA.typography.title.letterSpacing,
                color: FIGMA.colors.title,
              }}
            >
              Add your Landlord's{'\n'}
              <Text style={{ color: FIGMA.colors.accent }}>Bank Details</Text>
            </Text>
          </View>

          {/* Progress Bar - Figma: height 12, track #4D4D4D, fill #CC7B57 width 131 */}
          <View style={{ marginBottom: scaledSpacing(spacing.xxxl), width: '100%' }}>
            <View style={{
              height: scaled(FIGMA.layout.progressBarHeight),
              backgroundColor: FIGMA.colors.progressTrack,
              width: '100%',
            }}>
              <View style={{
                width: scaled(FIGMA.layout.progressFillWidth),
                height: '100%',
                backgroundColor: FIGMA.colors.progressFill,
              }} />
            </View>
          </View>

          {/* Form - Figma: gap 16 between fields */}
          <View style={{ gap: scaled(FIGMA.layout.formGap) }}>
            
            {/* Account Holder Name */}
            <View>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Account Holder Name</Text>
                <TouchableOpacity>
                  <Text style={styles.editLink}>edit</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputContainer, errors.accountHolderName && styles.inputError]}>
                <RNTextInput
                  style={styles.input}
                  value={accountHolderName}
                  onChangeText={setAccountHolderName}
                  placeholder="e.g. John Smith"
                  placeholderTextColor={FIGMA.colors.placeholder}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Account Number */}
            <View>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Account holder number</Text>
                <TouchableOpacity>
                  <Text style={styles.editLink}>edit</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputContainer, errors.accountNumber && styles.inputError]}>
                <RNTextInput
                  style={styles.input}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="e.g. 1234567890"
                  placeholderTextColor={FIGMA.colors.placeholder}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* IFSC Code */}
            <View>
              <View style={styles.labelRow}>
                <Text style={styles.label}>IFSC Code</Text>
                <TouchableOpacity>
                  <Text style={styles.editLink}>edit</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputContainer, errors.ifscCode && styles.inputError]}>
                <RNTextInput
                  style={styles.input}
                  value={ifscCode}
                  onChangeText={setIfscCode}
                  placeholder="e.g. SBIN0002125"
                  placeholderTextColor={FIGMA.colors.placeholder}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* PAN Card */}
            <View>
              <View style={styles.labelRow}>
                <Text style={styles.label}>PAN CARD</Text>
                <TouchableOpacity>
                  <Text style={styles.editLink}>edit</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputContainer, errors.panCard && styles.inputError]}>
                <RNTextInput
                  style={styles.input}
                  value={panCard}
                  onChangeText={setPanCard}
                  placeholder="e.g. CSNPM9874A"
                  placeholderTextColor={FIGMA.colors.placeholder}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Submit Button - Figma: width 297, height 56, borderRadius 12 */}
            <TouchableOpacity
              style={[
                styles.button,
                isFormValid && { backgroundColor: FIGMA.colors.buttonActiveBg },
              ]}
              onPress={handleSubmit}
              disabled={!isFormValid || verifyBank.isPending}
            >
              <Text
                style={[
                  styles.buttonText,
                  isFormValid && { color: FIGMA.colors.buttonActiveText },
                ]}
              >
                Proceed
              </Text>
            </TouchableOpacity>

            {/* Footer */}
            <Text style={styles.footerText}>
              You may get a verification message from Cashfree to verify your profile and unlock benefits.
            </Text>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaled(6), // Figma: 6px gap between label and input
  },
  label: {
    // Figma: fontSize 12, fontWeight 500, lineHeight 20, color #A9A9A9
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: scaledFont(12),
    lineHeight: scaledFont(20),
    letterSpacing: 0,
    color: '#A9A9A9',
    textAlign: 'left', // Explicit alignment for Figma parity
  },
  editLink: {
    // Figma: fontSize 14, fontWeight 400, lineHeight 20, color #878787, textAlign right
    // Figma Nodes: I1:31561;99:1464, I1:31562;99:1501
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(14),
    lineHeight: scaledFont(20),
    letterSpacing: 0,
    color: '#878787',
    textAlign: 'right', // Fix applied per pixel feedback
  },
  inputContainer: {
    // Figma: width 297, height 64, borderColor #4D4D4D, borderWidth 1, borderRadius 12
    width: '100%',
    height: scaled(64),
    borderWidth: 1,
    borderColor: '#4D4D4D',
    borderRadius: scaled(12),
    paddingHorizontal: scaled(16),
    justifyContent: 'center',
  },
  inputError: {
    borderColor: '#E5484D',
  },
  input: {
    // Figma: fontSize 20, fontWeight 400, lineHeight 32, color #FFFFFF (or #444444 for placeholder)
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(20),
    lineHeight: scaledFont(32),
    letterSpacing: 0,
    color: '#FFFFFF',
    height: '100%',
    textAlign: 'left', // Explicit alignment for Figma parity
  },
  button: {
    // Figma: width 297, height 56, backgroundColor #202020, borderRadius 12
    width: '100%',
    height: scaled(56),
    backgroundColor: '#202020',
    borderRadius: scaled(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scaled(16),
  },
  buttonText: {
    // Figma: fontSize 16, fontWeight 500, lineHeight 24, color #444444 (disabled)
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: scaledFont(16),
    lineHeight: scaledFont(24),
    letterSpacing: 0,
    color: '#444444',
    textAlign: 'center', // Explicit alignment for Figma parity
  },
  footerText: {
    // Figma: fontSize 12, fontWeight 400, lineHeight 20, color #A9A9A9
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(12),
    lineHeight: scaledFont(20),
    letterSpacing: 0,
    color: '#A9A9A9',
    marginTop: scaled(16),
    textAlign: 'left', // Explicit alignment for Figma parity
  },
});
