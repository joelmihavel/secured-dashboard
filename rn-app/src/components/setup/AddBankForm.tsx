/**
 * Add Bank Screen
 * Figma References:
 * - 4109:3096 (empty), 4109:3183 (filled), 4109:3579 (loading)
 * - 4109:3270 (success/verified), 4109:3488 (failure)
 *
 * States:
 * - form: Input fields for account, IFSC, PAN
 * - loading: Full-screen spinner "Verifying Details"
 * - success: "Details Verified" + info rows (name, bank, branch) + "Confirm and continue"
 * - failure: Error banner + form with "Try again"
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
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// CRITICAL: Expo Router's `router` is NOT referentially stable — changes on every
// navigation state update. Using it in deps causes infinite re-render loops.
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { AlertBanner, Text, TextInput, PrimaryButton, ScreenTitle, Logo } from '@/src/components';
import { TabSwitcher } from '@/src/components/home';
import { DottedGridPattern } from '@/src/components/patterns/DottedGridPattern';
import { useVerifyBank, useVerifyUpiVpa, useVerifyPan, useDashboard, validateAccountNumber, validateIfscCode, validateUpiVpa } from '@/src/hooks';
import { useUploadStore } from '@/src/stores/upload';
import type { BankVerificationResponse, UpiVerificationResponse, PanVerificationResponse, SetupError, SetupPaymentMethodType } from '@/src/types/setup';
import { colors } from '@/src/theme';

const PAYMENT_METHOD_TABS = [
  { id: 'upi', label: 'UPI' },
  { id: 'bank', label: 'Bank Account' },
];

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

// ── Verified Info Row — Figma 4109:3270: "#" prefix, no icon ─────────────
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
  hash: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: FIGMA.infoLabel,
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

export interface AddBankProps {
  /** Pre-waitlist mode: no tenancy_id, skip option, navigate to waitlist */
  preWaitlist?: boolean;
}

export default function AddBankScreen({ preWaitlist = false }: AddBankProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const verifyBankMutation = useVerifyBank();
  const verifyUpiMutation = useVerifyUpiVpa();
  const verifyPanMutation = useVerifyPan();
  const { tenancy, landlordBank } = useDashboard();

  // Stable refs for mutation .mutate functions — React Query v5 returns a new
  // mutation OBJECT every render (status/data/error change the wrapper), but
  // the .mutate function itself is referentially stable. Using the object in
  // useCallback deps caused firePanVerification + handleSubmit to be recreated
  // every render, amplifying any re-render trigger into a cascade that hit
  // React's 50-update limit ("Maximum update depth exceeded").
  const verifyBankMutateRef = useRef(verifyBankMutation.mutate);
  verifyBankMutateRef.current = verifyBankMutation.mutate;
  const verifyUpiMutateRef = useRef(verifyUpiMutation.mutate);
  verifyUpiMutateRef.current = verifyUpiMutation.mutate;
  const verifyPanMutateRef = useRef(verifyPanMutation.mutate);
  verifyPanMutateRef.current = verifyPanMutation.mutate;

  // Stable ref for tenancy ID — useDashboard() returns a new object on every
  // render (React Query wrapper), which would recreate firePanVerification +
  // handleSubmit on every dashboard refetch (realtime events, focus, etc.).
  // Using a ref breaks this cascade chain that was hitting React's 50-update limit.
  const tenancyIdRef = useRef(tenancy?.id);
  tenancyIdRef.current = tenancy?.id;

  // Payment method selector — default based on rent amount
  const rent = tenancy?.monthly_rent ?? 0;
  const [paymentMethod, setPaymentMethod] = useState<SetupPaymentMethodType>(
    rent >= 100000 ? 'bank' : 'upi'
  );

  // Form state
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [panCard, setPanCard] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [foundName, setFoundName] = useState<string | null>(null);

  // Verification results
  const [verificationResult, setVerificationResult] = useState<BankVerificationResponse | null>(null);
  const [upiVerificationResult, setUpiVerificationResult] = useState<UpiVerificationResponse | null>(null);
  const [panResult, setPanResult] = useState<PanVerificationResponse | null>(null);

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('form');

  // Upload store — needed by redirect effect + handleConfirm + handleSkip
  const completeBankStep = useUploadStore((s) => s.completeBankStep);

  // If bank was ALREADY verified when this screen mounted (e.g., deferred name
  // match succeeded in background), redirect away. Captures the initial value
  // once — ignores changes from optimistic updates during the current session,
  // which would otherwise redirect before the user sees the success state and
  // taps "Confirm & continue".
  // Pre-waitlist → waitlist (user isn't approved yet, dashboard would be empty).
  // Post-approval → main dashboard.
  const bankAlreadyVerifiedOnMount = useRef(
    !__DEV__ && (tenancy?.verification_status?.bank_verified || landlordBank?.verified)
  );
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (bankAlreadyVerifiedOnMount.current && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      if (preWaitlist) {
        completeBankStep();
        routerRef.current.replace('/(waitlist)' as never);
      } else {
        routerRef.current.replace('/(main)' as never);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bankVerified = verificationResult?.verified === true;
  const panVerified = panResult?.panVerified === true;

  // Clear errors + verification on edit — user must re-verify after any change
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
    // Only clear PAN result, not account verification — PAN edit shouldn't force re-verifying bank/UPI
    setApiError(null);
    setPanResult(null);
  }, []);

  // Method switch — resets all form/verification state
  const handleMethodSwitch = useCallback((tabId: string) => {
    setPaymentMethod(tabId as SetupPaymentMethodType);
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

  // PAN verification (chained after bank success)
  // Reads tenancyIdRef (not tenancy?.id) to avoid recreating this callback on
  // every dashboard refetch. panCard is also read from a ref inside the closure
  // since it only matters at invocation time, not at render time.
  const panCardRef = useRef(panCard);
  panCardRef.current = panCard;
  const firePanVerification = useCallback((bankAccountId: string) => {
    const tid = tenancyIdRef.current;
    const pan = panCardRef.current;
    if (!preWaitlist && !tid) return;
    verifyPanMutateRef.current(
      { ...(tid && { tenancyId: tid }), panNumber: pan.toUpperCase(), bankAccountId },
      {
        onSuccess: (data) => {
          setPanResult(data);
          if (data.panVerified) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setScreenState('form'); // Stay in form — derive success from verification results
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            // Banner: reason | Field: what failed | Detail: verbose context
            setApiError(data.message || "PAN holder name doesn't match your landlord");
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
  }, [preWaitlist]); // Only preWaitlist (stable prop) — tenancyId + panCard read from refs

  // ── Refs for handleSubmit ──
  // handleSubmit is only invoked on user tap, so all rapidly-changing values
  // (form fields, verification results, dashboard data) are read from refs
  // at invocation time. This prevents the callback from being recreated on
  // every re-render caused by useDashboard refetches, keystroke state changes,
  // or verification result state updates — the cascade that was hitting
  // React's 50-update limit ("Maximum update depth exceeded").
  const paymentMethodRef = useRef(paymentMethod);
  paymentMethodRef.current = paymentMethod;
  const accountNumberRef = useRef(accountNumber);
  accountNumberRef.current = accountNumber;
  const ifscCodeRef = useRef(ifscCode);
  ifscCodeRef.current = ifscCode;
  const upiVpaRef = useRef(upiVpa);
  upiVpaRef.current = upiVpa;
  const verificationResultRef = useRef(verificationResult);
  verificationResultRef.current = verificationResult;
  const upiVerificationResultRef = useRef(upiVerificationResult);
  upiVerificationResultRef.current = upiVerificationResult;
  const bankVerifiedRef = useRef(bankVerified);
  bankVerifiedRef.current = bankVerified;
  const validateAllFieldsRef = useRef(validateAllFields);
  validateAllFieldsRef.current = validateAllFields;

  // Submit handler — branches by payment method
  // CRITICAL: Only preWaitlist (stable prop) and firePanVerification (stable
  // callback) in deps. Everything else is read from refs at invocation time.
  // This breaks the re-render cascade: useDashboard refetch -> tenancy changes ->
  // firePanVerification recreated -> handleSubmit recreated -> 50+ renders.
  const handleSubmit = useCallback(() => {
    if (!validateAllFieldsRef.current()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const tid = tenancyIdRef.current;
    if (!preWaitlist && !tid) {
      setApiError('No active tenancy found.');
      return;
    }

    setApiError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScreenState('loading');

    const method = paymentMethodRef.current;
    if (method === 'upi') {
      // ── UPI flow ──
      const upiResult = upiVerificationResultRef.current;
      const upiVerified = upiResult?.verified === true;
      if (upiVerified && upiResult?.bankAccountId) {
        setPanResult(null);
        firePanVerification(upiResult.bankAccountId);
        return;
      }

      setUpiVerificationResult(null);
      setPanResult(null);

      verifyUpiMutateRef.current(
        { ...(tid && { tenancyId: tid }), upiVpa: upiVpaRef.current.toLowerCase().trim() },
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
            const fieldHint = error.code === 'UPI_VPA_INVALID' ? 'Invalid VPA'
              : error.code === 'NAME_MISMATCH' ? 'Invalid VPA'
              : 'Verification failed';
            setErrors((prev) => ({ ...prev, upiVpa: fieldHint }));
            setScreenState('form');
            if (error.foundName) setFoundName(error.foundName);
          },
        }
      );
    } else {
      // ── Bank flow (existing, unchanged) ──
      const bankResult = verificationResultRef.current;
      if (bankVerifiedRef.current && bankResult?.bankAccountId) {
        setPanResult(null);
        firePanVerification(bankResult.bankAccountId);
        return;
      }

      setVerificationResult(null);
      setPanResult(null);

      verifyBankMutateRef.current(
        {
          ...(tid && { tenancyId: tid }),
          accountNumber: accountNumberRef.current.replace(/\s/g, ''),
          ifscCode: ifscCodeRef.current.toUpperCase(),
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
  }, [firePanVerification, preWaitlist]);

  // "Confirm and continue" → dashboard (post-approval) or waitlist (pre-waitlist)
  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (preWaitlist) {
      completeBankStep();
      routerRef.current.replace('/(waitlist)' as never);
    } else {
      routerRef.current.replace('/(main)' as never);
    }
  }, [preWaitlist, completeBankStep]);

  // Skip — pre-waitlist only
  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    completeBankStep();
    routerRef.current.replace('/(waitlist)' as never);
  }, [completeBankStep]);

  // "Try again" on failure screen — reset everything so fields are editable
  const handleRetry = useCallback(() => {
    setScreenState('form');
    setApiError(null);
    setErrors({});
    setFoundName(null);
    setVerificationResult(null);
    setUpiVerificationResult(null);
    setPanResult(null);
  }, []);

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

  // Fields disabled only during loading — editable otherwise (even after verification)
  const fieldsDisabled = screenState === 'loading';
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  // Only show "verified" on the read-only name fields, not on editable inputs
  const bankFieldSuccess = undefined;
  const upiFieldSuccess = undefined;
  const panFieldSuccess = undefined;

  // ── BANK ALREADY VERIFIED on mount — show empty while effect redirects ──
  if (bankAlreadyVerifiedOnMount.current && !hasRedirectedRef.current) {
    return <View style={styles.container} />;
  }

  // ── LOADING STATE — Figma 4109:3579 ─────────────────────────────────────
  if (screenState === 'loading') {
    return (
      <View style={styles.container}>
        <DottedGridPattern fadeMask={false} />
        {/* Logo — centered at top */}
        <View style={[styles.loadingLogoRow, { paddingTop: insets.top + 48 }]}>
          <Logo size={40} />
        </View>
        {/* Centered content: title + spinner + body text, gap=48 */}
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

  // ── FORM STATE (only state besides loading) ──────────────────────────

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
          showsVerticalScrollIndicator={true}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Logo size={32} />
          </View>

          {/* Title */}
          <View style={preWaitlist ? styles.titleContainerCompact : styles.titleContainer}>
            {allVerified ? (
              <ScreenTitle gray="Details " accent="Verified" />
            ) : (
              <ScreenTitle gray="Add your landlord's " accent="bank details" />
            )}
          </View>

          {/* Progress Bar — hidden in pre-waitlist mode */}
          {!preWaitlist && (
            <View style={[styles.progressContainer, allVerified && { marginTop: 16 }]}>
              <View style={styles.progressTrack}>
                <View style={styles.progressFill} />
              </View>
            </View>
          )}

          {/* Payment Method Selector — always visible */}
          <View style={styles.selectorContainer}>
            <TabSwitcher
              tabs={PAYMENT_METHOD_TABS}
              activeTabId={paymentMethod}
              onTabChange={handleMethodSwitch}
              disabled={screenState !== 'form'}
              compact
              />
          </View>

          {/* UPI amount limit warning */}
          {isUpi && rent >= 100000 && screenState === 'form' && (
            <View style={styles.amountWarning}>
              <AlertBanner type="error" message="UPI transfers are limited to amounts under ₹1,00,000. Switch to Bank Account for higher amounts." />
            </View>
          )}

          {/* Error Banner — adapts to text length */}
          {apiError && (
            <View style={styles.errorBannerWrap}>
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorBannerText}>{apiError}</Text>
              </View>
            </View>
          )}

          {/* Form — verified output fields on top, input fields below */}
          <View style={styles.formContainer}>
            {/* Verified names — read-only, shown above inputs for confirmation */}
            {accountVerified && verifiedName && (
              <TextInput
                label="Account Holder Name"
                value={verifiedName}
                onChangeText={() => {}}
                disabled
                success="verified"
              />
            )}
            {panVerified && panResult?.registeredName && (
              <TextInput
                label="PAN Registered Name"
                value={panResult.registeredName}
                onChangeText={() => {}}
                disabled
                success="verified"
              />
            )}

            {/* Input fields */}
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
              label="PAN Card"
              value={panCard}
              onChangeText={handlePanCardChange}
              placeholder="e.g. CSNPM9874A"
              error={errors.panCard}
              success={panFieldSuccess}
              disabled={fieldsDisabled}
              autoCapitalize="characters"
            />
          </View>

          {/* Bottom spacer — taller when verified names are showing */}
          <View style={{ height: allVerified ? 200 : 150 }} />
        </ScrollView>

        {/* Sticky bottom button — hidden when keyboard is open to avoid covering inputs */}
        {!keyboardVisible && (
        <View style={[styles.stickyBottom, { paddingBottom: insets.bottom + 16 }]}>
          {allVerified ? (
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

          {preWaitlist && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>I'll do this later</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.footerText}>
            PAN is required for rent compliance and verification.
          </Text>
        </View>
        )}
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
    alignItems: 'center',
  },
  loadingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48, // Figma: Form Container gap=48
    paddingHorizontal: 32,
  },
  loadingTitle: {
    textAlign: 'center',
  },
  loadingTitleGray: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 32, lineHeight: 48, letterSpacing: -1,
    color: FIGMA.loadingTitle, // Figma: #A9A9A9
  },
  loadingTitleAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 32, lineHeight: 48, letterSpacing: -1,
    color: FIGMA.accent, // Figma: #FF9A6D
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
  titleContainerCompact: { marginBottom: 32 },

  // Subtitle (pre-waitlist)
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: colors.neutral[500],
    marginBottom: 32,
  },

  // Payment method selector — below progress bar, left-aligned with form fields
  selectorContainer: { marginBottom: 32, flexDirection: 'row', justifyContent: 'flex-start' },

  // Amount limit warning
  amountWarning: { marginBottom: 16 },

  // Progress bar — Figma: full width
  progressContainer: {
    marginBottom: 24,
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

  // Error banner — red bg pill, self-sizing to text length
  errorBannerWrap: {
    flexDirection: 'row',
    marginBottom: 24,
  },
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

  // Form
  formContainer: { gap: 16 },

  // Sticky bottom — button overlays scroll content
  stickyBottom: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 48,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center' as const,
    backgroundColor: colors.black[700],
  },

  // Divider before verified info
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#4D4D4D',
  },
  // Verified info section — receipt below divider
  infoSection: { gap: 16 },

  // Button section — closer to form so it's visible on initial load
  // buttonSection removed — button is now in stickyBottom

  // Skip (pre-waitlist)
  skipButton: { paddingVertical: 4, paddingHorizontal: 12 },
  skipText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14, lineHeight: 20,
    color: colors.white,
    textDecorationLine: 'underline' as const,
  },

  // Footer — Figma: 12px Regular #A9A9A9
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: FIGMA.footer,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 0,
  },
});
