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
  Linking,
  Image,
} from 'react-native';

const BG_SHAPE = require('../../../assets/images/background_shape.png');
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// CRITICAL: Expo Router's `router` is NOT referentially stable — changes on every
// navigation state update. Using it in deps causes infinite re-render loops.
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { AlertBanner, Text, TextInput, PrimaryButton, ScreenTitle, Logo, BackButton } from '@/src/components';
import { GradientPill } from '@/src/components/agreement/GradientPill';
import { TabSwitcher } from '@/src/components/home';
import { DottedGridPattern } from '@/src/components/patterns/DottedGridPattern';
import { useVerifyBank, useVerifyUpiVpa, useVerifyPan, useDashboard, useExtractionStatus, validateAccountNumber, validateIfscCode, validateUpiVpa } from '@/src/hooks';
import { useUploadStore } from '@/src/stores/upload';
import { useAuthStore } from '@/src/stores/auth';
import { resetForReupload } from '@/src/services/agreement/resetForReupload';
import type { BankVerificationResponse, UpiVerificationResponse, PanVerificationResponse, SetupError, SetupPaymentMethodType } from '@/src/types/setup';
import { colors } from '@/src/theme';

const PAYMENT_METHOD_TABS = [
  { id: 'bank', label: 'Bank Details' },
  { id: 'upi', label: 'UPI Details' },
];

// 'agreement_invalid' = full-screen "We couldn't read your agreement" overlay
//   shown when the extraction pipeline reaches a terminal error
//   (extraction_status ∈ {failed, extraction_failed} OR contract_status === 'invalid_document').
//   Replaces the form entirely; the only escape is "Upload again".
type ScreenState = 'form' | 'loading' | 'success' | 'failure' | 'agreement_invalid';

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

/** Generic server/network failures that warrant the full-screen failure UI. */
function isGenericApiError(code: string | undefined): boolean {
  return (
    code === 'NETWORK_ERROR' ||
    code === 'SERVICE_UNAVAILABLE' ||
    code === 'EMPTY_RESPONSE' ||
    code === 'UNKNOWN_ERROR'
  );
}

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
function VerificationSpinner({ failed = false }: { failed?: boolean }) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (failed) return; // freeze rotation in error state — looks intentional
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
  }, [spinValue, failed]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const arcColor = failed ? colors.error.radix : FIGMA.spinnerFg;

  return (
    <View style={spinnerStyles.container}>
      {/* Background ring */}
      <View style={spinnerStyles.bgRing} />
      {/* Accent ring — animated when verifying, static when failed */}
      <Animated.View style={[spinnerStyles.fgRing, { transform: [{ rotate: failed ? '0deg' : spin }] }]}>
        <Svg width={148} height={148} viewBox="0 0 148 148" fill="none">
          <Path
            d="M74 6C111.555 6 142 36.4446 142 74"
            stroke={arcColor}
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

// "Pre-waitlist" means: no tenancy yet, post-submit goes to /(waitlist).
// "Post-waitlist" (i.e., user_status='approved'|'active') means: tenancy
// exists, post-submit goes to /(main). The screen derives this from the
// cached user_status on the auth store — single source of truth — instead
// of accepting a prop. See useAuthStore.userStatus (populated by the
// journey router and OTP handler after every queryUserStatus).
function deriveIsPreWaitlist(userStatus: string | null): boolean {
  // Null / unknown defaults to pre-waitlist (the safe path for new users).
  // Post-waitlist requires an explicit approved/active read.
  return userStatus !== 'approved' && userStatus !== 'active';
}

export default function AddBankScreen() {
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
  // IMPORTANT: Only update when a valid ID is present. A transient dashboard
  // refetch failure should NOT erase a previously fetched tenancy ID — the
  // server validates it independently on each mutation call.
  const tenancyIdRef = useRef(tenancy?.id);
  if (tenancy?.id) {
    tenancyIdRef.current = tenancy.id;
  }

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

  // user_status (cached by journey router / OTP handler) determines whether
  // we treat this mount as pre-waitlist or post-approval. Single source of
  // truth — replaces the old isPreWaitlist prop.
  const userStatus = useAuthStore((s) => s.userStatus);
  const userId = useAuthStore((s) => s.userId);
  const isPreWaitlist = deriveIsPreWaitlist(userStatus);

  // If bank was ALREADY verified when this screen mounted (e.g., deferred name
  // match succeeded in background), and the user landed here via journey
  // router (no back stack, ex: cold-start straight onto /add-bank-details),
  // redirect away. If the user pushed here from another screen, DO NOT
  // redirect — they explicitly came to view/edit, bouncing them surprises them.
  // Pre-waitlist → waitlist (user isn't approved yet, dashboard would be empty).
  // Post-approval → main dashboard.
  const bankAlreadyVerifiedOnMount = useRef(
    !__DEV__ &&
    !routerRef.current.canGoBack() &&
    (tenancy?.verification_status?.bank_verified || landlordBank?.verified)
  );
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (bankAlreadyVerifiedOnMount.current && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      if (isPreWaitlist) {
        routerRef.current.replace('/(waitlist)' as never);
      } else {
        routerRef.current.replace('/(main)' as never);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Extraction-state gating ──────────────────────────────────────────────
  // The bank/PAN name match relies on landlord names from the agreement scan.
  // Three relevant outcomes:
  //   pending/processing → form editable, Verify CTA disabled w/ "Verifying agreement…"
  //   completed          → form editable, Verify CTA enabled (current default)
  //   failed/extraction_failed/invalid_document → flip screenState to
  //                                               'agreement_invalid' overlay
  const extraction = useExtractionStatus({ enabled: true });

  const hasExtractionContext = !!extraction.extractionId || !!extraction.data;
  const isExtractionInFlight =
    hasExtractionContext &&
    (extraction.isLoading ||
      extraction.data?.extractionStatus === 'pending' ||
      extraction.data?.extractionStatus === 'processing');
  const isAgreementInvalid =
    !!extraction.data &&
    (extraction.data.extractionStatus === 'failed' ||
      extraction.data.extractionStatus === 'extraction_failed' ||
      extraction.data.contractStatus === 'invalid_document');

  // Flip to the agreement-invalid overlay as soon as a terminal-error state is
  // observed — wins over any in-progress bank/UPI verify (the agreement is
  // moot anyway). Only flips once; "Upload again" navigates the user out.
  const flippedToInvalidRef = useRef(false);
  useEffect(() => {
    if (isAgreementInvalid && !flippedToInvalidRef.current) {
      flippedToInvalidRef.current = true;
      setScreenState('agreement_invalid');
    }
  }, [isAgreementInvalid]);

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
    if (!isPreWaitlist && !tid) return;
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
          // Only show "Incorrect PAN" field hint for actual PAN errors, not auth failures.
          // Auth errors (code NOT_AUTHENTICATED) get a generic field hint to avoid confusion.
          const fieldHint = error.code === 'NOT_AUTHENTICATED' ? 'Error' : 'Incorrect PAN';
          setErrors((prev) => ({ ...prev, panCard: fieldHint }));
          // Generic server/network errors → full-screen failure UI; field-specific errors → form
          setScreenState(isGenericApiError(error.code) ? 'failure' : 'form');
          if (error.foundName) setFoundName(error.foundName);
        },
      }
    );
  }, [isPreWaitlist]); // Only isPreWaitlist (stable for a given user) — tenancyId + panCard read from refs

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
  // CRITICAL: Only isPreWaitlist (stable for a given user) and firePanVerification (stable
  // callback) in deps. Everything else is read from refs at invocation time.
  // This breaks the re-render cascade: useDashboard refetch -> tenancy changes ->
  // firePanVerification recreated -> handleSubmit recreated -> 50+ renders.
  const handleSubmit = useCallback(() => {
    if (!validateAllFieldsRef.current()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const tid = tenancyIdRef.current;
    if (!isPreWaitlist && !tid) {
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
            setScreenState(isGenericApiError(error.code) ? 'failure' : 'form');
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
            setScreenState(isGenericApiError(error.code) ? 'failure' : 'form');
          },
        }
      );
    }
  }, [firePanVerification, isPreWaitlist]);

  // "Confirm and continue" → route by isPreWaitlist (derived from userStatus).
  // Pre-waitlist → /(waitlist). Post-approval → /(main).
  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isPreWaitlist) {
      routerRef.current.replace('/(waitlist)' as never);
    } else {
      routerRef.current.replace('/(main)' as never);
    }
  }, [isPreWaitlist]);

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

  // "Upload again" — shown on the agreement_invalid overlay when the
  // extraction pipeline failed or the doc isn't a rental agreement. Clears
  // the in-flight extraction + any pre-waitlist landlord bank rows + manual
  // form store, then routes to upload with ?forceNew=true so the upload
  // screen resets to idle on mount.
  const handleUploadAgain = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (userId) {
      await resetForReupload({
        userId,
        extractionId: extraction.extractionId ?? undefined,
      });
    }
    routerRef.current.replace('/(agreement)/upload?forceNew=true' as never);
  }, [userId, extraction.extractionId]);

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
              ? 'Verifying the UPI ID and PAN with our partners. This takes few seconds.'
              : 'Verifying the bank account and PAN with our partners. This takes few seconds.'}
          </Text>
        </View>
      </View>
    );
  }

  // ── AGREEMENT_INVALID STATE ──────────────────────────────────────────────
  // Reached when the extraction pipeline reports a terminal error
  // (extraction_status ∈ {failed, extraction_failed} OR contract_status === 'invalid_document').
  // The agreement is unusable — landlord-name match would never resolve — so
  // the only path forward is to re-upload. Mirrors the failure-state layout
  // but uses the failure spinner colours and an "Upload again" CTA.
  if (screenState === 'agreement_invalid') {
    const errorBody =
      extraction.data?.extractionError ||
      "We couldn't read your rental agreement. Please upload a clearer copy to continue.";
    return (
      <View style={styles.container}>
        <DottedGridPattern fadeMask={false} />
        <View style={[styles.loadingLogoRow, { paddingTop: insets.top + 48 }]}>
          <Logo size={40} />
        </View>
        <View style={styles.loadingContent}>
          <Text style={styles.loadingTitle}>
            <Text style={styles.loadingTitleGray}>We couldn&apos;t{'\n'}</Text>
            <Text style={styles.failureTitleAccent}>read your agreement</Text>
          </Text>
          <VerificationSpinner failed />
          <Text style={styles.loadingBody}>{errorBody}</Text>
        </View>
        <View style={[styles.failureCtaWrap, { paddingBottom: insets.bottom + 24 }]}>
          <PrimaryButton title="Upload again" onPress={handleUploadAgain} showDivider />
        </View>
      </View>
    );
  }

  // ── FAILURE STATE — Figma 4651:140624 ───────────────────────────────────
  // Full-screen "We couldn't / Verify these Details" with red spinner + Try Again.
  // Reached on generic server/network failures; field-specific errors stay in form.
  if (screenState === 'failure') {
    return (
      <View style={styles.container}>
        <DottedGridPattern fadeMask={false} />
        <View style={[styles.loadingLogoRow, { paddingTop: insets.top + 48 }]}>
          <Logo size={40} />
        </View>
        <View style={styles.loadingContent}>
          <Text style={styles.loadingTitle}>
            <Text style={styles.loadingTitleGray}>We couldn&apos;t{'\n'}</Text>
            <Text style={styles.failureTitleAccent}>Verify these Details</Text>
          </Text>
          <VerificationSpinner failed />
          <Text style={styles.loadingBody}>
            {apiError || 'Please check the details and try again'}
          </Text>
        </View>
        <View style={[styles.failureCtaWrap, { paddingBottom: insets.bottom + 24 }]}>
          <PrimaryButton title="Try Again" onPress={handleRetry} showDivider />
        </View>
      </View>
    );
  }

  // ── FORM STATE (only state besides loading) ──────────────────────────

  return (
    <View style={styles.container}>
      {/* Decorative arch + faint dotted pattern, per Figma 4651:76437 */}
      <Image
        source={BG_SHAPE}
        style={styles.bgShape}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <DottedGridPattern dotOpacity={0.08} fadeMask={false} animated={false} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{
            paddingHorizontal: 36,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top row — back arrow only. The action button moved back to the
              sticky bottom bar (see below the ScrollView) for visibility —
              the top-right gradient pill was hard to discover. */}
          <View style={styles.topRow}>
            <BackButton
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // After a cold restart the journey router lands the user
                // directly on this screen with no back stack — `router.back()`
                // is then a no-op. Fall back to a sensible "home": waitlist
                // for pre-waitlist users, dashboard for approved users.
                if (routerRef.current.canGoBack()) {
                  routerRef.current.back();
                } else {
                  routerRef.current.replace((isPreWaitlist ? '/(waitlist)' : '/(main)') as never);
                }
              }}
              style={styles.topRowBack}
              color={colors.white}
            />
          </View>

          {/* Title + subtitle — Figma keeps "Verify / bank details" in success state too,
              with a different subtitle that surfaces the verified holder name. */}
          <View style={styles.titleBlock}>
            {allVerified ? (
              <Text style={styles.heading}>
                <Text inherit style={styles.headingWhite}>Verify</Text>
                {'\n'}
                <Text inherit style={styles.headingAccent}>bank details</Text>
              </Text>
            ) : (
              <Text style={styles.heading}>
                <Text inherit style={styles.headingWhite}>Enter your</Text>
                {'\n'}
                <Text inherit style={styles.headingAccent}>Landlord&apos;s bank details</Text>
              </Text>
            )}
            {allVerified && verifiedName ? (
              <Text style={styles.subtitleText}>
                Payments will be sent to{' '}
                <Text inherit style={styles.subtitleNameAccent}>{verifiedName}</Text>
              </Text>
            ) : (
              <Text style={styles.subtitleText}>
                Setup your rent payments by verifying the bank details of your landlord.
              </Text>
            )}
          </View>

          <View style={styles.headerDivider} />

          {/* Payment method selector — Bank Details / UPI Details pill tabs (full width) */}
          <View style={styles.selectorContainer}>
            <TabSwitcher
              tabs={PAYMENT_METHOD_TABS}
              activeTabId={paymentMethod}
              onTabChange={handleMethodSwitch}
              disabled={screenState !== 'form'}
              fullWidth
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

            {isUpi ? (
              <TextInput
                label="UPI Account ID"
                value={upiVpa}
                onChangeText={handleUpiVpaChange}
                placeholder="e.g. john@bank"
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
                  label="Account holder number"
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
              label="PAN CARD"
              value={panCard}
              onChangeText={handlePanCardChange}
              placeholder="e.g. CSNPM9874A"
              error={errors.panCard}
              success={panFieldSuccess}
              disabled={fieldsDisabled}
              autoCapitalize="characters"
            />
          </View>

          {/* Read-only info section — Figma 4651:76989 / 77303
              Surfaces the bank/UPI metadata returned by the verification API once
              everything is verified. Each row has a # icon, label, value. */}
          {allVerified && (
            <View style={styles.infoSection}>
              {verifiedName && (
                <InfoRow label="Holder Name" value={verifiedName} />
              )}
              {!isUpi && verificationResult?.bankName && (
                <InfoRow label="Bank" value={verificationResult.bankName} />
              )}
              {!isUpi && verificationResult?.branch && (
                <InfoRow label="Branch" value={verificationResult.branch} showDivider={false} />
              )}
              {isUpi && upiVerificationResult?.bankName && (
                <InfoRow label="Bank" value={upiVerificationResult.bankName} showDivider={false} />
              )}
            </View>
          )}

          {/* "Payments will be sent to ..." line under heading once verified */}
          {/* (rendered via subtitle replacement below — see titleBlock) */}

          {/* Bottom helper — only shows once user starts filling */}
          {(accountNumber || ifscCode || upiVpa || panCard) && (
            <Text style={styles.bottomHelper}>
              Required for landlord verification and compliance (not stored publicly)
            </Text>
          )}

          {/* Bottom spacer — taller when verified info is showing so it
              scrolls clear of the sticky bottom button. */}
          <View style={{ height: allVerified ? 200 : 150 }} />
        </ScrollView>

        {/* Sticky bottom — primary action sits here so it's always visible.
            Hidden when keyboard is open so it doesn't cover inputs. The
            previous gradient pill at the top of the form was hard to spot. */}
        {!keyboardVisible && (
          <View style={[styles.stickyBottom, { paddingBottom: insets.bottom + 16 }]}>
            {allVerified ? (
              <PrimaryButton
                title="Confirm & continue"
                onPress={handleConfirm}
              />
            ) : (
              <PrimaryButton
                title={isExtractionInFlight ? 'Verifying agreement…' : 'Verify details'}
                onPress={handleSubmit}
                disabled={!allFieldsFilled || isExtractionInFlight}
              />
            )}

            <Text style={styles.footerText}>
              {isExtractionInFlight
                ? "We're checking your agreement. This usually takes a couple of minutes."
                : 'PAN is required for rent compliance and verification.'}
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
  bgShape: {
    position: 'absolute',
    top: -100,
    left: '50%',
    width: 481,
    height: 405,
    marginLeft: -481 / 2,
    opacity: 0.48,
  },

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
  // Failure state ("We couldn't / Verify these Details") — red accent
  failureTitleAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 32, lineHeight: 48, letterSpacing: -1,
    color: colors.error.radix, // Figma: red verification fail
  },
  failureCtaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 48,
    paddingTop: 16,
    alignItems: 'center',
  },
  loadingBody: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: 400
    fontSize: 14, lineHeight: 20,
    color: FIGMA.loadingBody, // Figma: #CBCBCB
    textAlign: 'center',
    maxWidth: 273, // Figma: 273px width
  },

  // Logo (legacy — unused after redesign, kept for any other referrers)
  logoContainer: { alignSelf: 'flex-start', marginBottom: 40 },

  // Top row — back arrow only (action button is in stickyBottom now)
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  topRowBack: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },

  // Title block (Figma: "Enter / bank details")
  titleBlock: {
    gap: 8,
    marginBottom: 24,
  },
  heading: {
    // Figma 4651:76469 — 28/40/-1 (was 32, which made "Landlord's bank details"
    // wrap onto two lines on smaller devices).
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28, lineHeight: 40, letterSpacing: -1,
  },
  headingWhite: { color: colors.white },
  headingAccent: { color: colors.brand[500] },
  subtitleText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13, lineHeight: 18,
    color: colors.neutral[500],
  },
  subtitleNameAccent: {
    color: colors.brand[500],
    textDecorationLine: 'underline' as const,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.black[400],
    marginBottom: 24,
  },

  // Title (legacy — unused, kept to avoid breakage if referenced elsewhere)
  titleContainer: { marginBottom: 48 },
  titleContainerCompact: { marginBottom: 32 },

  // Subtitle (pre-waitlist)
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, lineHeight: 20,
    color: colors.neutral[500],
    marginBottom: 32,
  },

  // Payment method selector — full-width pill stretching across the form
  selectorContainer: { marginBottom: 32 },

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


  // Bottom helper (replaces footerText for new design)
  bottomHelper: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13, lineHeight: 18,
    color: colors.neutral[500],
    marginTop: 24,
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
