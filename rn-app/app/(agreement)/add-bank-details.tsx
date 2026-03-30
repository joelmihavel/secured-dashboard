/**
 * Pre-Waitlist Bank Details Screen
 *
 * Stripped-down bank verification screen shown AFTER agreement upload,
 * BEFORE joining the waitlist. Collects landlord bank/UPI details via
 * penny drop only (no PAN, no tenancy_id — extraction not done yet).
 *
 * Name matching runs later via deferred matching in onboarding.ts
 * when extraction completes and tenancy is created.
 *
 * User can skip — bank becomes mandatory post-approval if skipped.
 */

import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { Text, TextInput, PrimaryButton, ScreenTitle, Logo } from '@/src/components';
import { TabSwitcher } from '@/src/components/home';
import { DottedGridPattern } from '@/src/components/patterns/DottedGridPattern';
import { useVerifyBank, useVerifyUpiVpa, validateAccountNumber, validateIfscCode, validateUpiVpa } from '@/src/hooks';
import { useUploadStore } from '@/src/stores/upload';
import type { BankVerificationResponse, UpiVerificationResponse, SetupError, PaymentMethodType } from '@/src/types/setup';
import { colors } from '@/src/theme';

const PAYMENT_METHOD_TABS = [
  { id: 'upi', label: 'UPI' },
  { id: 'bank', label: 'Bank Account' },
];

type ScreenState = 'form' | 'loading' | 'success' | 'failure';

const FIGMA = {
  bg: colors.black[700],
  white: colors.white,
  accent: '#FF9A6D',
  spinnerBg: '#202020',
  spinnerFg: '#FF9A6D',
  loadingTitle: '#A9A9A9',
  loadingBody: '#CBCBCB',
} as const;

// ── Loading Spinner ──────────────────────────────────────────────────
function LoadingRing() {
  const spin = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true,
      })
    ).start();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={loadingStyles.ringWrap}>
      <View style={[loadingStyles.bgRing, { width: 148, height: 148, borderRadius: 74, borderWidth: 4, borderColor: FIGMA.spinnerBg }]} />
      <Animated.View style={[loadingStyles.fgRing, { transform: [{ rotate }] }]}>
        <Svg width={148} height={148} viewBox="0 0 148 148">
          <Path
            d="M74 4 A70 70 0 0 1 144 74"
            stroke={FIGMA.spinnerFg} strokeWidth={4} strokeLinecap="round" fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  ringWrap: { width: 148, height: 148, justifyContent: 'center', alignItems: 'center' },
  bgRing: { position: 'absolute' },
  fgRing: { position: 'absolute', width: 148, height: 148 },
});

// ── Main Screen ──────────────────────────────────────────────────────

export default function AddBankDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const verifyBankMutation = useVerifyBank();
  const verifyUpiMutation = useVerifyUpiVpa();
  const completeBankStep = useUploadStore((s) => s.completeBankStep);

  // Payment method selector — default to UPI
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('upi');

  // Form state
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // Verification results
  const [verificationResult, setVerificationResult] = useState<BankVerificationResponse | null>(null);
  const [upiVerificationResult, setUpiVerificationResult] = useState<UpiVerificationResponse | null>(null);

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('form');

  const bankVerified = verificationResult?.verified === true;
  const upiVerified = upiVerificationResult?.verified === true;
  const isUpi = paymentMethod === 'upi';
  const accountVerified = isUpi ? upiVerified : bankVerified;

  // Clear errors + verification on edit
  const clearVerification = useCallback(() => {
    setApiError(null);
    setVerificationResult(null);
    setUpiVerificationResult(null);
  }, []);

  const handleAccountNumberChange = useCallback((text: string) => {
    setAccountNumber(text);
    setErrors((prev) => { const { accountNumber: _, ...rest } = prev; return rest; });
    clearVerification();
  }, [clearVerification]);

  const handleIfscCodeChange = useCallback((text: string) => {
    setIfscCode(text);
    setErrors((prev) => { const { ifscCode: _, ...rest } = prev; return rest; });
    clearVerification();
  }, [clearVerification]);

  const handleUpiVpaChange = useCallback((text: string) => {
    setUpiVpa(text);
    setErrors((prev) => { const { upiVpa: _, ...rest } = prev; return rest; });
    clearVerification();
  }, [clearVerification]);

  const handleMethodSwitch = useCallback((tabId: string) => {
    setPaymentMethod(tabId as PaymentMethodType);
    setScreenState('form');
    setApiError(null);
    setErrors({});
    setVerificationResult(null);
    setUpiVerificationResult(null);
  }, []);

  const validateAllFields = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (paymentMethod === 'bank') {
      if (!accountNumber.trim()) newErrors.accountNumber = 'Required';
      else if (!validateAccountNumber(accountNumber)) newErrors.accountNumber = '9-18 digits required';
      if (!ifscCode.trim()) newErrors.ifscCode = 'Required';
      else if (!validateIfscCode(ifscCode)) newErrors.ifscCode = 'Invalid IFSC format';
    } else {
      if (!upiVpa.trim()) newErrors.upiVpa = 'Required';
      else {
        const vpaCheck = validateUpiVpa(upiVpa);
        if (!vpaCheck.valid) newErrors.upiVpa = vpaCheck.message || 'Invalid UPI ID format';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [paymentMethod, accountNumber, ifscCode, upiVpa]);

  // Submit — penny drop only, no tenancy_id, no PAN
  const handleSubmit = useCallback(() => {
    if (!validateAllFields()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setApiError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScreenState('loading');

    if (paymentMethod === 'upi') {
      verifyUpiMutation.mutate(
        { upiVpa: upiVpa.toLowerCase().trim() }, // no tenancyId
        {
          onSuccess: (data) => {
            setUpiVerificationResult(data);
            if (data.verified) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setScreenState('form');
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setApiError(data.message || 'UPI verification failed');
              setErrors((prev) => ({ ...prev, upiVpa: 'Invalid VPA' }));
              setScreenState('form');
            }
          },
          onError: (error: SetupError) => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setApiError(error.message || 'UPI verification failed');
            const fieldHint = error.code === 'UPI_VPA_INVALID' ? 'Invalid VPA' : 'Verification failed';
            setErrors((prev) => ({ ...prev, upiVpa: fieldHint }));
            setScreenState('form');
          },
        }
      );
    } else {
      verifyBankMutation.mutate(
        {
          accountNumber: accountNumber.replace(/\s/g, ''),
          ifscCode: ifscCode.toUpperCase(),
          // no tenancyId — pre-waitlist flow
        },
        {
          onSuccess: (data) => {
            setVerificationResult(data);
            if (data.verified) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setScreenState('form');
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setApiError(data.message || 'Bank account verification failed');
              setErrors((prev) => ({ ...prev, accountNumber: 'Invalid Bank A/C' }));
              setScreenState('form');
            }
          },
          onError: (error: SetupError) => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setApiError(error.message || 'Bank verification failed');
            setErrors((prev) => ({ ...prev, accountNumber: 'Invalid Bank A/C' }));
            setScreenState('form');
          },
        }
      );
    }
  }, [validateAllFields, paymentMethod, verifyBankMutation, verifyUpiMutation, accountNumber, ifscCode, upiVpa]);

  // Confirm verified name → proceed to waitlist
  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    completeBankStep();
    router.replace('/(waitlist)' as never);
  }, [router, completeBankStep]);

  // Skip → proceed to waitlist without bank verification
  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    completeBankStep();
    router.replace('/(waitlist)' as never);
  }, [router, completeBankStep]);

  const fieldsDisabled = screenState === 'loading';
  const allFieldsFilled = paymentMethod === 'upi'
    ? upiVpa.trim().length > 0
    : accountNumber.trim().length > 0 && ifscCode.trim().length > 0;

  const bankFieldSuccess = bankVerified ? 'verified' : undefined;
  const upiFieldSuccess = upiVerified ? 'verified' : undefined;

  // ── Loading overlay ──
  if (screenState === 'loading') {
    return (
      <View style={styles.container}>
        <DottedGridPattern fadeMask={false} />
        <View style={styles.loadingContent}>
          <LoadingRing />
          <View style={{ gap: 12, alignItems: 'center' }}>
            <Text style={styles.loadingTitle}>Verifying Details</Text>
            <Text style={styles.loadingBody}>
              {isUpi ? 'Checking your UPI ID...' : 'Verifying bank account details...'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Form / Success ──
  const verifiedName = isUpi
    ? (upiVerificationResult?.verifiedName ?? null)
    : (verificationResult?.verifiedName ?? null);

  return (
    <View style={styles.container}>
      <DottedGridPattern fadeMask={false} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{
            paddingHorizontal: 48,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Logo size={32} style={{ marginBottom: 40 }} />

          {/* Title */}
          <View style={{ marginBottom: 8 }}>
            <ScreenTitle
              gray={accountVerified ? 'Details' : "Add your landlord's"}
              accent={accountVerified ? 'Verified' : 'bank details'}
            />
          </View>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            While we review your agreement
          </Text>

          {/* Payment method tabs */}
          <View style={styles.tabContainer}>
            <TabSwitcher
              tabs={PAYMENT_METHOD_TABS}
              activeTab={paymentMethod}
              onTabChange={handleMethodSwitch}
              disabled={fieldsDisabled}
            />
          </View>

          {/* Error banner */}
          {apiError && (
            <View style={styles.errorBannerWrap}>
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorBannerText}>{apiError}</Text>
              </View>
            </View>
          )}

          {/* Form fields */}
          <View style={styles.formContainer}>
            {isUpi ? (
              <TextInput
                label="UPI ID"
                value={upiVpa}
                onChangeText={handleUpiVpaChange}
                placeholder="e.g. name@oksbi"
                error={errors.upiVpa}
                success={upiFieldSuccess}
                disabled={fieldsDisabled}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            ) : (
              <>
                <TextInput
                  label="Account number"
                  value={accountNumber}
                  onChangeText={handleAccountNumberChange}
                  placeholder="e.g. 1234567890"
                  error={errors.accountNumber}
                  success={bankFieldSuccess}
                  disabled={fieldsDisabled}
                  keyboardType="number-pad"
                />
                <TextInput
                  label="IFSC code"
                  value={ifscCode}
                  onChangeText={handleIfscCodeChange}
                  placeholder="e.g. SBIN0001234"
                  error={errors.ifscCode}
                  success={bankFieldSuccess}
                  disabled={fieldsDisabled}
                  autoCapitalize="characters"
                />
              </>
            )}
          </View>

          {/* Button + Verification Section */}
          <View style={styles.buttonSection}>
            {/* Green verified name card */}
            {accountVerified && verifiedName && (
              <View style={styles.verifiedNameCard}>
                <View style={styles.verifiedNameHeader}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success.material} />
                  <Text style={styles.verifiedNameLabel}>Account Holder</Text>
                </View>
                <Text style={styles.verifiedNameValue}>{verifiedName}</Text>
                <Text style={styles.verifiedNameHint}>
                  Please confirm this is your landlord
                </Text>
              </View>
            )}

            {accountVerified ? (
              <PrimaryButton
                title="Confirm & continue"
                onPress={handleConfirm}
              />
            ) : (
              <PrimaryButton
                title="Verify details"
                onPress={handleSubmit}
                disabled={!allFieldsFilled}
              />
            )}

            {/* Skip link */}
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>I'll do this later</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FIGMA.bg },
  flex: { flex: 1 },

  loadingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
    paddingHorizontal: 32,
  },
  loadingTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 24, lineHeight: 32,
    color: FIGMA.loadingTitle,
    textAlign: 'center',
  },
  loadingBody: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, lineHeight: 20,
    color: FIGMA.loadingBody,
    textAlign: 'center',
  },

  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: colors.neutral[500],
    marginBottom: 32,
  },

  tabContainer: { marginBottom: 24 },

  errorBannerWrap: { flexDirection: 'row', marginBottom: 24 },
  errorBanner: {
    backgroundColor: 'rgba(229, 72, 77, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 72, 77, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorBannerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: '#E5484D',
  },

  formContainer: { gap: 16 },

  buttonSection: { gap: 16, marginTop: 24, alignItems: 'center' },

  // Green verified name card
  verifiedNameCard: {
    backgroundColor: 'rgba(70, 167, 88, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(70, 167, 88, 0.3)',
    borderRadius: 8,
    padding: 16,
    gap: 4,
    width: '100%',
  },
  verifiedNameHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  verifiedNameLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12, lineHeight: 20,
    color: colors.success.material,
  },
  verifiedNameValue: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 18, lineHeight: 28,
    color: colors.white,
    marginTop: 2,
  },
  verifiedNameHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 18,
    color: colors.neutral[500],
  },

  // Skip
  skipButton: { padding: 12 },
  skipText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14, lineHeight: 20,
    color: FIGMA.white,
    textDecorationLine: 'underline',
  },
});
