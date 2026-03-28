/**
 * Add Bank Screen
 * Figma References:
 * - 4109:3096 (empty), 4109:3183 (filled), 4109:3579 (loading)
 * - 4109:3270 (success/verified), 4109:3488 (failure)
 *
 * States:
 * - form: Input fields for account, IFSC, PAN
 * - loading: Full-screen spinner "Verifying Details"
 * - success: "Details Verified" + info rows (name, bank, branch) + "Confirm & Continue"
 * - failure: Error banner + form with "Try Again"
 *
 * Flow: Form → Loading → Success/Failure → (Success) Confirm → add-utility
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
  Animated,
  Easing,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { AlertBanner, Text, TextInput, PrimaryButton, ScreenTitle, Logo } from '@/src/components';
import { useVerifyBank, useVerifyPan, useDashboard, validateAccountNumber, validateIfscCode } from '@/src/hooks';
import type { BankVerificationResponse, PanVerificationResponse, SetupError } from '@/src/types/setup';
import { colors } from '@/src/theme';

type ScreenState = 'form' | 'loading' | 'success' | 'failure';

// Figma exact color values
const FIGMA = {
  bg: colors.black[700],           // #131313
  progressTrack: colors.black[400], // #4D4D4D
  progressFill: colors.brand[600],  // #CC7B57
  footer: colors.neutral[500],      // #A9A9A9
  white: colors.white,
  infoLabel: '#878787',
  infoValue: '#CBCBCB',
  infoIcon: '#A6A6A6',
  divider: '#4D4D4D',
  errorBannerBg: '#202020',
  accent: '#FF9A6D',
  spinnerBg: '#202020',
  spinnerFg: '#FF9A6D',
  loadingTitle: '#A9A9A9',
  loadingBody: '#CBCBCB',
  disabledText: '#656565',
} as const;

function isValidPanFormat(pan: string): boolean {
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan.toUpperCase());
}

// ── Verified Info Icon (small bank/person icon placeholder) ──────────────
function InfoIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5ZM8 4.5C9.1 4.5 10 5.4 10 6.5C10 7.6 9.1 8.5 8 8.5C6.9 8.5 6 7.6 6 6.5C6 5.4 6.9 4.5 8 4.5ZM8 12.5C6.33 12.5 4.86 11.63 4 10.32C4.03 9.16 6.67 8.5 8 8.5C9.33 8.5 11.97 9.16 12 10.32C11.14 11.63 9.67 12.5 8 12.5Z"
        fill={FIGMA.infoIcon}
      />
    </Svg>
  );
}

// ── Loading Spinner (animated ring) ──────────────────────────────────────
function VerificationSpinner() {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={spinnerStyles.container}>
      {/* Background ring */}
      <View style={spinnerStyles.bgRing} />
      {/* Animated accent ring (partial arc) */}
      <Animated.View style={[spinnerStyles.fgRing, { transform: [{ rotate: spin }] }]}>
        <Svg width={148} height={148} viewBox="0 0 148 148" fill="none">
          <Path
            d="M74 6C111.555 6 142 36.4446 142 74"
            stroke={FIGMA.spinnerFg}
            strokeWidth={12}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const spinnerStyles = StyleSheet.create({
  container: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  bgRing: {
    width: 148, height: 148, borderRadius: 74,
    borderWidth: 12, borderColor: FIGMA.spinnerBg,
    position: 'absolute',
  },
  fgRing: { position: 'absolute', width: 148, height: 148 },
});

// ── Verified Info Row ────────────────────────────────────────────────────
function InfoRow({ label, value, showDivider = true }: { label: string; value: string | null; showDivider?: boolean }) {
  if (!value) return null;
  return (
    <>
      <View style={infoStyles.row}>
        <View style={infoStyles.labelGroup}>
          <InfoIcon />
          <Text style={infoStyles.label}>{label}</Text>
        </View>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
      {showDivider && <View style={infoStyles.divider} />}
    </>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4, // Figma: gap=4
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Figma: gap=4
  },
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: FIGMA.infoLabel, // Figma: #878787
  },
  value: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, lineHeight: 20,
    color: FIGMA.infoValue, // Figma: #CBCBCB
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: FIGMA.divider, // Figma: #4D4D4D
  },
});

// ── Main Screen ──────────────────────────────────────────────────────────

export default function AddBankScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const verifyBank = useVerifyBank();
  const verifyPanMutation = useVerifyPan();
  const { tenancy } = useDashboard();

  // Form state
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [panCard, setPanCard] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // Verification results
  const [verificationResult, setVerificationResult] = useState<BankVerificationResponse | null>(null);
  const [panResult, setPanResult] = useState<PanVerificationResponse | null>(null);

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('form');

  const bankVerified = verificationResult?.verified === true;
  const panVerified = panResult?.panVerified === true;

  // Clear field errors on input
  const handleAccountNumberChange = useCallback((text: string) => {
    setAccountNumber(text);
    setErrors((prev) => { const { accountNumber: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handleIfscCodeChange = useCallback((text: string) => {
    setIfscCode(text);
    setErrors((prev) => { const { ifscCode: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handlePanCardChange = useCallback((text: string) => {
    setPanCard(text);
    setErrors((prev) => { const { panCard: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const validateAllFields = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!accountNumber.trim()) newErrors.accountNumber = 'Required';
    else if (!validateAccountNumber(accountNumber)) newErrors.accountNumber = '9-18 digits required';
    if (!ifscCode.trim()) newErrors.ifscCode = 'Required';
    else if (!validateIfscCode(ifscCode)) newErrors.ifscCode = 'Invalid IFSC format';
    if (!panCard.trim()) newErrors.panCard = 'Required';
    else if (!isValidPanFormat(panCard)) newErrors.panCard = 'Invalid PAN format';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [accountNumber, ifscCode, panCard]);

  // PAN verification (chained after bank success)
  const firePanVerification = useCallback((bankAccountId: string) => {
    if (!tenancy?.id) return;
    verifyPanMutation.mutate(
      { tenancyId: tenancy.id, panNumber: panCard.toUpperCase(), bankAccountId },
      {
        onSuccess: (data) => {
          setPanResult(data);
          if (data.panVerified) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setScreenState('success');
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setErrors((prev) => ({ ...prev, panCard: data.message || 'PAN check failed' }));
            setScreenState('failure');
            setApiError(data.message || 'PAN verification failed. Please check and try again.');
          }
        },
        onError: (error: SetupError) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setErrors((prev) => ({ ...prev, panCard: error.message || 'PAN verification failed' }));
          setScreenState('failure');
          setApiError(error.message || 'PAN verification failed. Please try again.');
        },
      }
    );
  }, [tenancy?.id, panCard, verifyPanMutation]);

  // Submit handler
  const handleSubmit = useCallback(() => {
    if (!validateAllFields()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!tenancy?.id) {
      setApiError('No active tenancy found.');
      return;
    }

    setApiError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScreenState('loading');

    // If bank already verified, just retry PAN
    if (bankVerified && verificationResult?.bankAccountId) {
      setPanResult(null);
      firePanVerification(verificationResult.bankAccountId);
      return;
    }

    setVerificationResult(null);
    setPanResult(null);

    verifyBank.mutate(
      {
        tenancyId: tenancy.id,
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
            setApiError(data.message || 'Bank account verification failed.');
            setScreenState('failure');
          }
        },
        onError: (error: SetupError) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setApiError(error.message || 'Bank verification failed.');
          setScreenState('failure');
          if (error.fields && typeof error.fields === 'object') {
            setErrors((prev) => ({ ...prev, ...error.fields }));
          }
        },
      }
    );
  }, [validateAllFields, tenancy?.id, bankVerified, verificationResult?.bankAccountId, firePanVerification, verifyBank, accountNumber, ifscCode]);

  // "Confirm & Continue" on success screen
  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(main)' as never);
  }, [router]);

  // "Try Again" on failure screen
  const handleRetry = useCallback(() => {
    setScreenState('form');
    setApiError(null);
  }, []);

  const allFieldsFilled = accountNumber.length > 0 && ifscCode.length > 0 && panCard.length > 0;
  const bankFieldsDisabled = screenState === 'loading' || (screenState === 'success' && bankVerified);
  const panFieldDisabled = screenState === 'loading' || (screenState === 'success' && panVerified);
  const bankFieldSuccess = bankVerified ? 'Verified' : undefined;
  const panFieldSuccess = panVerified ? 'Verified' : undefined;

  // ── LOADING STATE — Figma 4109:3579 ─────────────────────────────────────
  if (screenState === 'loading') {
    return (
      <View style={styles.container}>
        {/* Logo — centered horizontally at top (Figma: Frame 2095586381, main=CENTER cross=CENTER) */}
        <View style={[styles.loadingLogoRow, { paddingTop: insets.top + 16 }]}>
          <Logo size={32} />
        </View>
        {/* Form Container — centered vertically + horizontally (Figma: gap=48 cross=CENTER main=CENTER 329x649) */}
        <View style={styles.loadingContent}>
          <Text style={styles.loadingTitle}>Verifying Details</Text>
          <VerificationSpinner />
          <Text style={styles.loadingBody}>
            Verifying the bank account and PAN with partners. This takes few seconds.
          </Text>
        </View>
      </View>
    );
  }

  // ── FORM / SUCCESS / FAILURE STATES ────────────────────────────────────
  const isSuccess = screenState === 'success';
  const isFailure = screenState === 'failure';

  return (
    <View style={styles.container}>
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
          <View style={styles.logoContainer}>
            <Logo size={32} />
          </View>

          {/* Title — changes on success */}
          <View style={styles.titleContainer}>
            {isSuccess ? (
              <Text style={styles.successTitle}>Details Verified</Text>
            ) : (
              <ScreenTitle gray="Add your landlord's " accent="bank details" />
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>

          {/* Error Banner (failure state) — Figma 4109:3488: #202020 bg, r=12, pad h12 v8, gap=10, 297x56 */}
          {isFailure && apiError && (
            <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Text style={styles.errorBannerText}>{apiError}</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://flent.in/help/bank-verification')}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.errorBannerLink}>Learn More</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* API Error (form state, non-banner) */}
          {!isFailure && apiError && <AlertBanner type="error" message={apiError} />}

          {/* Form Inputs */}
          <View style={styles.formContainer}>
            <TextInput
              label="Account Number"
              value={accountNumber}
              onChangeText={handleAccountNumberChange}
              placeholder="e.g. 1234567890"
              error={errors.accountNumber}
              success={bankFieldSuccess}
              disabled={bankFieldsDisabled}
              keyboardType="number-pad"
            />

            <TextInput
              label="IFSC Code"
              value={ifscCode}
              onChangeText={handleIfscCodeChange}
              placeholder="e.g. SBIN0002125"
              error={errors.ifscCode}
              success={bankFieldSuccess}
              disabled={bankFieldsDisabled}
              autoCapitalize="characters"
            />

            {/* Verified Info Rows (success state) — between IFSC and PAN */}
            {isSuccess && verificationResult && (
              <View style={styles.infoSection}>
                <InfoRow label="Holder Name" value={verificationResult.verifiedName} />
                <InfoRow label="Bank" value={verificationResult.bankName} />
                <InfoRow label="Branch" value={verificationResult.branch} showDivider={false} />
              </View>
            )}

            <TextInput
              label="PAN CARD"
              value={panCard}
              onChangeText={handlePanCardChange}
              placeholder="e.g. CSNPM9874A"
              error={errors.panCard}
              success={panFieldSuccess}
              disabled={panFieldDisabled}
              autoCapitalize="characters"
            />
          </View>

          {/* Button Section */}
          <View style={styles.buttonSection}>
            {isSuccess ? (
              <PrimaryButton
                title="Confirm & Continue"
                onPress={handleConfirm}
              />
            ) : isFailure ? (
              <PrimaryButton
                title="Try Again"
                onPress={handleRetry}
              />
            ) : (
              <PrimaryButton
                title="Verify Details"
                onPress={handleSubmit}
                disabled={!allFieldsFilled}
              />
            )}

            <Text style={styles.footerText}>
              PAN is required for rent compliance and verification.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FIGMA.bg },
  flex: { flex: 1 },

  // Loading state — Figma 4109:3579
  loadingLogoRow: {
    alignItems: 'center', // Figma: logo frame cross=CENTER main=CENTER
    justifyContent: 'center',
  },
  loadingContent: {
    flex: 1,
    alignItems: 'center', // Figma: cross=CENTER
    justifyContent: 'center', // Figma: main=CENTER
    gap: 48, // Figma: Form Container gap=48
    paddingHorizontal: 32, // Keep text centered within 329px equiv
  },
  loadingTitle: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: 400
    fontSize: 32, lineHeight: 48, letterSpacing: -1,
    color: FIGMA.loadingTitle, // Figma: #A9A9A9
    textAlign: 'center',
  },
  loadingBody: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: 400
    fontSize: 14, lineHeight: 20,
    color: FIGMA.loadingBody, // Figma: #CBCBCB
    textAlign: 'center',
    maxWidth: 273, // Figma: 273px width
  },

  // Logo
  logoContainer: { alignSelf: 'flex-start', marginBottom: 40 },

  // Title
  titleContainer: { marginBottom: 48 },
  successTitle: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: 400
    fontSize: 48, lineHeight: 64, letterSpacing: -2,
    color: FIGMA.white, // Figma: #FFFFFF
  },

  // Progress bar — Figma: full width
  progressContainer: {
    marginBottom: 48,
    marginHorizontal: -48,
    width: Dimensions.get('window').width,
    height: 3,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 3, // Figma: 3px track height (was 12, masked by overflow:hidden)
    backgroundColor: FIGMA.progressTrack,
    width: '100%',
  },
  progressFill: {
    width: '33.33%',
    height: '100%',
    backgroundColor: FIGMA.progressFill,
  },

  // Error banner — Figma 4109:3488: HORIZONTAL, #202020, r=12, pad h12 v8, gap=10, 297x56
  errorBanner: {
    flexDirection: 'row', // Figma: HORIZONTAL
    alignItems: 'center', // Figma: cross=CENTER
    backgroundColor: FIGMA.errorBannerBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10, // Figma: itemSpacing=10
    marginBottom: 24,
  },
  errorBannerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: FIGMA.accent, // Figma: #FF9A6D
    textDecorationLine: 'underline',
    flex: 1, // Figma: FILL
  },
  errorBannerLink: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: FIGMA.accent, // Figma: #FF9A6D
    textDecorationLine: 'underline',
  },

  // Form
  formContainer: { gap: 16 },

  // Verified info section — Figma: Frame 2095586626, gap=16
  infoSection: { gap: 16 },

  // Button section — Figma: gap=16 internal, 48px from form in success, 16px in form state
  buttonSection: { gap: 16, marginTop: 48, alignItems: 'center' },

  // Footer — Figma: 12px Regular #A9A9A9
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: FIGMA.footer,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
});
