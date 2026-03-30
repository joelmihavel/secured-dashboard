/**
 * Pre-Waitlist Bank Details Screen
 *
 * Identical to /(setup)/add-bank but:
 * - No tenancy_id (extraction not done yet — omitted from all API calls)
 * - Navigate to /(waitlist) on confirm (not dashboard)
 * - Skip option ("I'll do this later")
 * - No progress bar (not part of numbered setup steps)
 *
 * PAN + bank/UPI verification run normally via Cashfree penny drop.
 * Name matching is deferred — runs when extraction completes on backend.
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
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

import { AlertBanner, Text, TextInput, PrimaryButton, ScreenTitle, Logo } from '@/src/components';
import { TabSwitcher } from '@/src/components/home';
import { DottedGridPattern } from '@/src/components/patterns/DottedGridPattern';
import { useVerifyBank, useVerifyUpiVpa, useVerifyPan, validateAccountNumber, validateIfscCode, validateUpiVpa } from '@/src/hooks';
import { useUploadStore } from '@/src/stores/upload';
import type { BankVerificationResponse, UpiVerificationResponse, PanVerificationResponse, SetupError, PaymentMethodType } from '@/src/types/setup';
import { colors } from '@/src/theme';

const PAYMENT_METHOD_TABS = [
  { id: 'upi', label: 'UPI' },
  { id: 'bank', label: 'Bank Account' },
];

type ScreenState = 'form' | 'loading' | 'success' | 'failure';

const FIGMA = {
  bg: colors.black[700],
  footer: colors.neutral[500],
  white: colors.white,
  infoLabel: '#878787',
  infoValue: '#CBCBCB',
  infoIcon: '#A6A6A6',
  divider: '#4D4D4D',
  accent: '#FF9A6D',
  spinnerBg: '#202020',
  spinnerFg: '#FF9A6D',
  loadingTitle: '#A9A9A9',
  loadingBody: '#CBCBCB',
} as const;

function isValidPanFormat(pan: string): boolean {
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan.toUpperCase());
}

// ── Loading Spinner ──────────────────────────────────────────────────
function VerificationSpinner() {
  const spinValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [spinValue]);
  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={spinnerStyles.container}>
      <View style={spinnerStyles.bgRing} />
      <Animated.View style={[spinnerStyles.fgRing, { transform: [{ rotate: spin }] }]}>
        <Svg width={148} height={148} viewBox="0 0 148 148" fill="none">
          <Path d="M74 6C111.555 6 142 36.4446 142 74" stroke={FIGMA.spinnerFg} strokeWidth={12} strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const spinnerStyles = StyleSheet.create({
  container: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  bgRing: { width: 148, height: 148, borderRadius: 74, borderWidth: 12, borderColor: FIGMA.spinnerBg, position: 'absolute' },
  fgRing: { position: 'absolute', width: 148, height: 148 },
});

// ── Verified Info Row (matches post-approval add-bank) ──────────────
function InfoRow({ label, value, showDivider = true }: { label: string; value: string | null; showDivider?: boolean }) {
  if (!value) return null;
  return (
    <>
      <View style={infoStyles.row}>
        <View style={infoStyles.labelGroup}>
          <Text style={infoStyles.hash}>#</Text>
          <Text style={infoStyles.label}>{label}</Text>
        </View>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
      {showDivider && <View style={infoStyles.divider} />}
    </>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  labelGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hash: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, lineHeight: 20, color: FIGMA.infoLabel },
  label: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, lineHeight: 20, color: FIGMA.infoLabel },
  value: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, lineHeight: 20, color: FIGMA.infoValue },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: FIGMA.divider },
});

// ── Main Screen ──────────────────────────────────────────────────────

export default function AddBankDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const verifyBankMutation = useVerifyBank();
  const verifyUpiMutation = useVerifyUpiVpa();
  const verifyPanMutation = useVerifyPan();
  const completeBankStep = useUploadStore((s) => s.completeBankStep);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('upi');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [panCard, setPanCard] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [foundName, setFoundName] = useState<string | null>(null);

  const [verificationResult, setVerificationResult] = useState<BankVerificationResponse | null>(null);
  const [upiVerificationResult, setUpiVerificationResult] = useState<UpiVerificationResponse | null>(null);
  const [panResult, setPanResult] = useState<PanVerificationResponse | null>(null);

  const [screenState, setScreenState] = useState<ScreenState>('form');

  const bankVerified = verificationResult?.verified === true;
  const panVerified = panResult?.panVerified === true;

  const clearVerification = useCallback(() => {
    setApiError(null);
    setFoundName(null);
    setVerificationResult(null);
    setUpiVerificationResult(null);
    setPanResult(null);
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

  const handlePanCardChange = useCallback((text: string) => {
    setPanCard(text.toUpperCase());
    setErrors((prev) => { const { panCard: _, ...rest } = prev; return rest; });
    setApiError(null);
    setPanResult(null);
  }, []);

  const handleMethodSwitch = useCallback((tabId: string) => {
    setPaymentMethod(tabId as PaymentMethodType);
    setScreenState('form');
    setApiError(null);
    setErrors({});
    setFoundName(null);
    setVerificationResult(null);
    setUpiVerificationResult(null);
    setPanResult(null);
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
    if (!panCard.trim()) newErrors.panCard = 'Required';
    else if (!isValidPanFormat(panCard)) newErrors.panCard = 'Invalid PAN format';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [paymentMethod, accountNumber, ifscCode, upiVpa, panCard]);

  // PAN verification — no tenancy_id (pre-waitlist)
  const firePanVerification = useCallback((bankAccountId: string) => {
    verifyPanMutation.mutate(
      { panNumber: panCard.toUpperCase(), bankAccountId },
      {
        onSuccess: (data) => {
          setPanResult(data);
          if (data.panVerified) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setScreenState('form');
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setApiError(data.message || "PAN verification failed");
            setErrors((prev) => ({ ...prev, panCard: 'Incorrect PAN' }));
            setScreenState('form');
          }
        },
        onError: (error: SetupError) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setApiError(error.message || 'PAN verification failed');
          setErrors((prev) => ({ ...prev, panCard: 'Incorrect PAN' }));
          setScreenState('form');
          if (error.foundName) setFoundName(error.foundName);
        },
      }
    );
  }, [panCard, verifyPanMutation]);

  // Submit — no tenancy_id in any API call
  const handleSubmit = useCallback(() => {
    if (!validateAllFields()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setApiError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScreenState('loading');

    if (paymentMethod === 'upi') {
      const upiVerified = upiVerificationResult?.verified === true;
      if (upiVerified && upiVerificationResult?.bankAccountId) {
        setPanResult(null);
        firePanVerification(upiVerificationResult.bankAccountId);
        return;
      }

      setUpiVerificationResult(null);
      setPanResult(null);

      verifyUpiMutation.mutate(
        { upiVpa: upiVpa.toLowerCase().trim() },
        {
          onSuccess: (data) => {
            setUpiVerificationResult(data);
            if (data.verified) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              firePanVerification(data.bankAccountId);
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
            if (error.foundName) setFoundName(error.foundName);
          },
        }
      );
    } else {
      if (bankVerified && verificationResult?.bankAccountId) {
        setPanResult(null);
        firePanVerification(verificationResult.bankAccountId);
        return;
      }

      setVerificationResult(null);
      setPanResult(null);

      verifyBankMutation.mutate(
        {
          accountNumber: accountNumber.replace(/\s/g, ''),
          ifscCode: ifscCode.toUpperCase(),
        },
        {
          onSuccess: (data) => {
            setVerificationResult(data);
            if (data.verified) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              firePanVerification(data.bankAccountId);
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
  }, [validateAllFields, paymentMethod, bankVerified, verificationResult?.bankAccountId, upiVerificationResult, firePanVerification, verifyBankMutation, verifyUpiMutation, accountNumber, ifscCode, upiVpa]);

  // Confirm → waitlist
  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    completeBankStep();
    router.replace('/(waitlist)' as never);
  }, [router, completeBankStep]);

  // Skip → waitlist
  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    completeBankStep();
    router.replace('/(waitlist)' as never);
  }, [router, completeBankStep]);

  const isUpi = paymentMethod === 'upi';
  const upiVerified = upiVerificationResult?.verified === true;
  const accountVerified = isUpi ? upiVerified : bankVerified;
  const allVerified = accountVerified && panVerified;
  const verifiedName = isUpi
    ? (upiVerificationResult?.verifiedName ?? null)
    : (verificationResult?.verifiedName ?? null);

  const allFieldsFilled = isUpi
    ? upiVpa.length > 0 && panCard.length > 0
    : accountNumber.length > 0 && ifscCode.length > 0 && panCard.length > 0;

  const fieldsDisabled = screenState === 'loading';
  const bankFieldSuccess = bankVerified ? 'verified' : undefined;
  const upiFieldSuccess = upiVerified ? 'verified' : undefined;
  const panFieldSuccess = panVerified ? 'verified' : undefined;

  // ── LOADING STATE ──
  if (screenState === 'loading') {
    return (
      <View style={styles.container}>
        <DottedGridPattern fadeMask={false} />
        <View style={[styles.loadingLogoRow, { paddingTop: insets.top + 48 }]}>
          <Logo size={40} />
        </View>
        <View style={styles.loadingContent}>
          <Text style={styles.loadingTitle}>
            <Text style={styles.loadingTitleGray}>Verifying </Text>
            <Text style={styles.loadingTitleAccent}>Details</Text>
          </Text>
          <VerificationSpinner />
          <Text style={styles.loadingBody}>
            {isUpi
              ? 'Verifying the UPI ID and PAN with partners. This takes few seconds.'
              : 'Verifying the bank account and PAN with partners. This takes few seconds.'}
          </Text>
        </View>
      </View>
    );
  }

  // ── FORM STATE ──
  return (
    <View style={styles.container}>
      <DottedGridPattern fadeMask={false} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{
            paddingHorizontal: 48,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Logo size={32} />
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            {allVerified ? (
              <ScreenTitle gray="Details " accent="Verified" />
            ) : (
              <ScreenTitle gray="Add your landlord's " accent="bank details" />
            )}
          </View>

          {/* Subtitle — pre-waitlist context */}
          <Text style={styles.subtitle}>While we review your agreement</Text>

          {/* Payment Method Selector */}
          <View style={styles.selectorContainer}>
            <TabSwitcher
              tabs={PAYMENT_METHOD_TABS}
              activeTabId={paymentMethod}
              onTabChange={handleMethodSwitch}
              disabled={screenState !== 'form'}
              compact
            />
          </View>

          {/* Error Banner */}
          {apiError && (
            <View style={styles.errorBannerWrap}>
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorBannerText}>{apiError}</Text>
              </View>
            </View>
          )}

          {/* Form Inputs */}
          <View style={styles.formContainer}>
            {isUpi ? (
              <TextInput
                label="UPI ID"
                value={upiVpa}
                onChangeText={handleUpiVpaChange}
                placeholder="e.g. name@oksbi"
                error={errors.upiVpa}
                errorDetail={foundName ? `Account holder: ${foundName}` : undefined}
                success={upiFieldSuccess}
                disabled={fieldsDisabled}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <>
                <TextInput
                  label="Account Number"
                  value={accountNumber}
                  onChangeText={handleAccountNumberChange}
                  placeholder="e.g. 1234567890"
                  error={errors.accountNumber}
                  success={bankFieldSuccess}
                  disabled={fieldsDisabled}
                  keyboardType="number-pad"
                />
                <TextInput
                  label="IFSC Code"
                  value={ifscCode}
                  onChangeText={handleIfscCodeChange}
                  placeholder="e.g. SBIN0002125"
                  error={errors.ifscCode}
                  success={bankFieldSuccess}
                  disabled={fieldsDisabled}
                  autoCapitalize="characters"
                />
              </>
            )}

            <TextInput
              label="PAN card"
              value={panCard}
              onChangeText={handlePanCardChange}
              placeholder="e.g. CSNPM9874A"
              error={errors.panCard}
              success={panFieldSuccess}
              disabled={fieldsDisabled}
              autoCapitalize="characters"
            />
          </View>

          {/* Button + Verified Name Section */}
          <View style={styles.buttonSection}>
            {/* Verified name — compact green badge */}
            {accountVerified && verifiedName && (
              <View style={styles.verifiedNameBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success.material} />
                <Text style={styles.verifiedNameText}>{verifiedName}</Text>
              </View>
            )}

            {allVerified ? (
              <PrimaryButton title="Confirm & continue" onPress={handleConfirm} />
            ) : (
              <PrimaryButton title="Verify details" onPress={handleSubmit} disabled={!allFieldsFilled} />
            )}

            <Text style={styles.footerText}>
              PAN is required for rent compliance and verification.
            </Text>

            {/* Skip link — pre-waitlist only */}
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>I'll do this later</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FIGMA.bg },
  flex: { flex: 1 },

  loadingLogoRow: { alignItems: 'center' },
  loadingContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 48, paddingHorizontal: 32,
  },
  loadingTitle: { textAlign: 'center' },
  loadingTitleGray: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 32, lineHeight: 48, letterSpacing: -1,
    color: FIGMA.loadingTitle,
  },
  loadingTitleAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 32, lineHeight: 48, letterSpacing: -1,
    color: FIGMA.accent,
  },
  loadingBody: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, lineHeight: 20,
    color: FIGMA.loadingBody,
    textAlign: 'center', maxWidth: 273,
  },

  logoContainer: { alignSelf: 'flex-start', marginBottom: 40 },
  titleContainer: { marginBottom: 8 },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: colors.neutral[500],
    marginBottom: 32,
  },
  selectorContainer: { marginBottom: 32, flexDirection: 'row', justifyContent: 'flex-start' },

  errorBannerWrap: { flexDirection: 'row', marginBottom: 24 },
  errorBanner: {
    backgroundColor: 'rgba(229, 72, 77, 0.12)',
    borderWidth: 1, borderColor: 'rgba(229, 72, 77, 0.3)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  errorBannerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20, color: '#E5484D',
  },

  formContainer: { gap: 16 },

  buttonSection: { gap: 16, marginTop: 24, alignItems: 'center' },

  // Compact verified name badge — single line, green accent
  verifiedNameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(70, 167, 88, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(70, 167, 88, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  verifiedNameText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14, lineHeight: 20,
    color: colors.white,
    flex: 1,
  },

  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: FIGMA.footer, textAlign: 'left', alignSelf: 'flex-start',
  },

  skipButton: { padding: 12 },
  skipText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14, lineHeight: 20,
    color: FIGMA.white, textDecorationLine: 'underline',
  },
});
