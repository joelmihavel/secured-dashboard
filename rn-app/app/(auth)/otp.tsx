/**
 * OTP Verification Screen (Bottom Sheet)
 * Figma Nodes: 1-31175 (empty), 1-31073 (filled), 1-31277 (error1), 1-31380 (error2)
 *
 * PIXEL-PERFECT Figma Values (verified from all 4 blueprint JSONs):
 *
 * OVERLAY:
 * - Rectangle 54: opacity=0.4 fill=#000000 (error states) OR opacity=1 fill=#000000/0.6 (empty)
 * - Rectangle 55: blur=8 fill=#000000/0.6 (error states)
 * - Combined effect: BlurView intensity=8 dark tint + animated 40% black overlay
 *
 * BOTTOM SHEET STRUCTURE:
 * - Frame 2095586317: column, gap=15, alignItems=center (handle + sheet content)
 * - Rectangle 53 (handle): 48x4, #4D4D4D, borderRadius=200, y=0 (no top padding)
 * - Frame 1686557301 (sheet bg): #1A1A1A, borderRadius tl/tr=22.79, paddingTop=15.19, gap=24
 * - Frame 1686557230 (content): paddingTop=16, gap=30.38, alignItems=center
 *
 * HEADER (Frame 1686557311):
 * - Column, gap=10, paddingHorizontal=48, justifyContent=center, alignItems=center
 * - Title: PlusJakartaSans-Regular 28/40 letterSpacing=-1 #FFFFFF left-aligned
 * - Subtitle: PlusJakartaSans-Medium 12/21.6 letterSpacing=-0.132 #A9A9A9 left-aligned
 *
 * OTP INPUT:
 * - Figma Label#67:0 = false in ALL 4 states (no "Secure code" label shown)
 * - Box: 39x64, bg=#222222, border=1px #444444, radius=8
 * - Text: PlusJakartaSans-Medium 20/32, empty=#444444, filled=#FFFFFF
 * - Separator: "-" in #CBCBCB
 * - Error state (error2): Frame 2095586319 wraps OTP + error text, gap=16
 * - Error text: PlusJakartaSans-Regular 14/20 #E5484D centered
 *
 * FOOTER (Frame 1686557317):
 * - Column, gap=16, paddingHorizontal=48
 * - Button: active gradient in both error states (Figma shows Proceed with #FFFFFF text)
 * - Resend: PlusJakartaSans-Regular 12/20 #A9A9A9, "Resend" underlined
 *
 * KEY FIXES FROM BLUEPRINT ANALYSIS:
 * 1. Removed "Secure code" label (Label#67:0 = false in all states)
 * 2. Button is ACTIVE in error states (Figma: gradient fill + white text)
 * 3. Removed fontWeight: '500' (NEVER use RN fontWeight - use fontFamily)
 * 4. Handle has NO top padding (y=0 in Frame 2095586317)
 * 5. Content layout: paddingTop=16 on content frame, not additional padding
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, BackHandler, Text as RNText, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { Screen, Text, PrimaryButton, OTPInput, BottomSheet } from '@/src/components';
import { colors, typography } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';
import { useAuth } from '@/src/hooks';
import { useAuthStore } from '@/src/stores/auth';
import { supabase } from '@/src/services/supabase/client';
import { isReviewMode } from '@/src/review/reviewMode';
import { isJourneyMode } from '@/src/review/journeyMode';
import { addBreadcrumb } from '@/src/config/sentry';
import { useUploadStore } from '@/src/stores/upload';

const LAST_ROUTE_KEY = 'flent_last_journey_target';

/**
 * Resolve the correct navigation target after OTP verification.
 * Queries user_status via PostgREST and maps to a route, avoiding the
 * full journey router in index.tsx (which causes a 1-3s SkeletonLoader flash).
 */
async function resolvePostOtpTarget(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_status')
      .eq('id', userId)
      .single();

    if (error || !data?.user_status) {
      // New user row may not exist yet (RLS delay) — default to upload
      return '/(agreement)/upload';
    }

    switch (data.user_status) {
      case 'approved': {
        // Check if bank already verified (deferred name matching succeeded)
        const { data: tenancyRow } = await supabase
          .from('tenancies')
          .select('bank_verified')
          .eq('user_id', userId)
          .maybeSingle();
        // No tenancy = broken state — route to waitlist as safety net
        return !tenancyRow ? '/(waitlist)' : tenancyRow.bank_verified ? '/(main)' : '/(setup)/add-bank';
      }
      case 'active':
        return '/(main)';
      case 'agreement_confirmed':
      // ^ Defensive enum value — no code sets it, backend crons auto-advance to waitlisted
      case 'waitlisted': {
        // Check if user is in active upload flow and hasn't done bank step
        const { bankStepCompleted, uploadPhase, extractionId } = useUploadStore.getState();
        if (!bankStepCompleted && uploadPhase !== 'idle' && extractionId) {
          return '/(agreement)/add-bank-details';
        }
        // Check if extraction requires reupload (invalid document / failed).
        // Route directly to upload instead of waitlist → upload flicker.
        const { data: extraction } = await supabase
          .from('extracted_rental_info')
          .select('extraction_status, contract_status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (extraction && (extraction.contract_status === 'invalid_document' || extraction.extraction_status === 'extraction_failed')) {
          useUploadStore.getState().prepareForReupload({
            errorMessage: 'Please upload a valid rental agreement to continue.',
          });
          return '/(agreement)/upload';
        }
        return '/(waitlist)';
      }
      case 'not_eligible':
        return '/(waitlist)';
      case 'signed_up':
      default:
        return '/(agreement)/upload';
    }
  } catch {
    return '/(agreement)/upload';
  }
}

// Exact Figma color values mapped to theme tokens (verified from all 4 blueprint JSONs)
const FIGMA_COLORS = {
  titleText: colors.white,            // #FFFFFF
  subtitleText: colors.neutral[500],  // #A9A9A9
  resendText: colors.neutral[500],    // #A9A9A9
} as const;

// Exact Figma dimensions (verified from blueprints) — scaled for device
const FIGMA_DIMENSIONS = {
  containerPadding: s(48),             // Figma: (393 - 297) / 2 = 48px horizontal padding
  titleWidth: s(297),                  // Figma: title width
  subtitleWidth: s(297),               // Figma: subtitle width
  resendWidth: s(297),                 // Figma: resend text width
} as const;

// Exact Figma spacing gaps (verified from blueprint frame layouts) — scaled for device
const FIGMA_GAPS = {
  contentPaddingTop: sv(16),           // Figma: Frame 1686557230 paddingTop
  contentItemSpacing: sv(30.38),       // Figma: Frame 1686557230 itemSpacing (exact: 30.38349723815918)
  titleToSubtitle: sv(10),             // Figma: Frame 1686557311 gap
  buttonToResend: sv(16),              // Figma: Frame 1686557317 gap
} as const;

export default function OTPScreen() {
  const router = useRouter();
  const {
    phoneNumber,
    error,
    verifyCode,
    resendCode,
    isVerifyingOtp,
    isResendingOtp,
    clearError,
  } = useAuth();
  const userName = useAuthStore((s) => s.userName);

  // Ref-based guard to prevent double-submission across the synchronous gap
  // between tap and React Query's isPending becoming true.
  const isSubmittingRef = useRef(false);

  // Track consecutive verify failures for exponential backoff cooldown
  const failureCountRef = useRef(0);
  const lastFailureTimeRef = useRef(0);

  // Lock all interaction once verification succeeds and navigation begins.
  // Prevents double-press during the async gap between verifyOtp completing
  // and router.replace() firing (getWaitlistStatus API call takes 1-2s).
  const [isNavigating, setIsNavigating] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const [otp, setOtp] = React.useState('');
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);

  // Resend cooldown: 10 seconds (matches Supabase max_frequency)
  const RESEND_COOLDOWN_SECONDS = 10;
  const [resendCountdown, setResendCountdown] = React.useState(RESEND_COOLDOWN_SECONDS);
  const [canResend, setCanResend] = React.useState(false);

  // OTP expiration timer -- Supabase OTPs expire after 10 minutes (600s)
  const OTP_VALIDITY_SECONDS = 600;
  const [otpExpirySeconds, setOtpExpirySeconds] = React.useState(OTP_VALIDITY_SECONDS);
  const [isOtpExpired, setIsOtpExpired] = React.useState(false);

  const isOtpComplete = otp.length === 6;
  const errorMessage = getErrorMessage();

  // Reset the ref-based submission guard when verification completes (success or error)
  useEffect(() => {
    if (!isVerifyingOtp) {
      isSubmittingRef.current = false;
    }
  }, [isVerifyingOtp]);

  // Track failures for exponential backoff
  useEffect(() => {
    if (error) {
      failureCountRef.current += 1;
      lastFailureTimeRef.current = Date.now();

      // Apply cooldown: 2s, 4s, 8s, capped at 15s
      const cooldownMs = Math.min(
        Math.pow(2, failureCountRef.current) * 1000,
        15000
      );
      setCooldownRemaining(Math.ceil(cooldownMs / 1000));
    }
  }, [error]);

  // Countdown timer for cooldown display
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setTimeout(() => {
      setCooldownRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  // Resend countdown timer (10s)
  useEffect(() => {
    if (resendCountdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // OTP expiration countdown -- ticks every second
  useEffect(() => {
    if (isOtpExpired) return;
    if (otpExpirySeconds <= 0) {
      setIsOtpExpired(true);
      return;
    }
    const timer = setTimeout(() => {
      setOtpExpirySeconds((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [otpExpirySeconds, isOtpExpired]);

  // Map error codes to user-friendly messages
  function getErrorMessage(): string | undefined {
    if (!error) return undefined;

    switch (error.code) {
      case 'INVALID_OTP':
        return 'Wrong Code';
      case 'MAX_ATTEMPTS':
        return 'Too many Attempts';
      case 'OTP_EXPIRED':
        return 'Code Expired';
      case 'SESSION_ERROR':
        return 'Session error. Please try again.';
      case 'NETWORK_ERROR':
        return 'Check your connection';
      case 'TIMEOUT':
        return 'Request timed out. Try again.';
      default:
        return error.message;
    }
  }

  // Callbacks defined before effects that use them
  const handleOtpChange = useCallback((text: string) => {
    setOtp(text);
    if (error) clearError();
  }, [error, clearError]);

  const isClosingRef = useRef(false);
  const handleClose = useCallback(() => {
    if (isClosingRef.current || isNavigating) return;
    isClosingRef.current = true;
    setIsVisible(false);
    router.back();
  }, [router, isNavigating]);

  // Handle back button - include handleClose in dependencies to prevent stale closure
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => backHandler.remove();
  }, [handleClose]);

  // Guard: redirect to sign-up if no phone number
  useEffect(() => {
    if (!phoneNumber) {
      router.replace('/(auth)/sign-up');
    }
  }, [phoneNumber, router]);

  // Navigate when auth store confirms authenticated.
  // IMPORTANT: Do NOT use a separate onAuthStateChange listener here — it races
  // with AuthProvider's listener and the journey router, causing double navigation.
  // Instead, watch the auth store status which is set by useAuth().verifyCode().
  const authStatus = useAuthStore((s) => s.status);
  const authUserId = useAuthStore((s) => s.userId);
  useEffect(() => {
    if (authStatus === 'authenticated' && !isNavigating) {
      setIsNavigating(true);
      Keyboard.dismiss();
      setIsVisible(false);
      SplashScreen.hideAsync().catch(() => {});

      if (isReviewMode() || isJourneyMode()) {
        // Review/journey mode — index.tsx handles routing
        setTimeout(() => router.replace('/' as never), 300);
        return;
      }

      // Resolve target for real users
      if (authUserId) {
        resolvePostOtpTarget(authUserId).then((target) => {
          addBreadcrumb('OTP verified — navigating', 'navigation', { target });
          if (target === '/(main)' || target === '/(setup)/add-bank' || target === '/(waitlist)') {
            SecureStore.setItemAsync(LAST_ROUTE_KEY, target).catch(() => {});
          }
          setTimeout(() => router.replace(target as never), 300);
        }).catch(() => {
          // Fallback — let the journey router handle it
          setTimeout(() => router.replace('/' as never), 300);
        });
      } else {
        // No userId yet — let journey router handle on next render
        setTimeout(() => router.replace('/' as never), 300);
      }
    }
  }, [authStatus, authUserId, router, isNavigating]);

  const handleProceed = useCallback((otpValue?: string | any) => {
    // Ref-based guard: prevents double-fire even before React Query isPending updates.
    // isNavigating: prevents re-submission after verification succeeds (during async navigation).
    if (isSubmittingRef.current || isVerifyingOtp || isNavigating) return;

    const code = typeof otpValue === 'string' ? otpValue : otp;
    if (code.length !== 6) return;

    // Enforce exponential backoff cooldown between retries
    if (cooldownRemaining > 0) return;

    // Prevent submission if OTP has expired -- user must resend
    if (isOtpExpired) return;

    isSubmittingRef.current = true;
    verifyCode(code, userName || undefined);
  }, [otp, verifyCode, userName, isVerifyingOtp, cooldownRemaining, isOtpExpired, isNavigating]);

  const handleResend = useCallback(() => {
    if (!canResend || isVerifyingOtp || isResendingOtp) return;
    setOtp('');
    // Reset failure tracking on resend -- new OTP means fresh attempts
    failureCountRef.current = 0;
    lastFailureTimeRef.current = 0;
    setCooldownRemaining(0);
    // Reset resend countdown
    setCanResend(false);
    setResendCountdown(RESEND_COOLDOWN_SECONDS);
    // Reset OTP expiration timer for the new code
    setOtpExpirySeconds(OTP_VALIDITY_SECONDS);
    setIsOtpExpired(false);
    if (error) clearError();
    resendCode(); // Tries M360 first (preserves identity path), falls back to Supabase Auth
  }, [resendCode, error, clearError, isVerifyingOtp, isResendingOtp, canResend]);

  // Figma: Button is ACTIVE (gradient) in error states -- only disabled when OTP incomplete,
  // during cooldown/expiry, or when navigating after successful verification.
  const isButtonDisabled = !isOtpComplete || cooldownRemaining > 0 || isOtpExpired || isNavigating;

  return (
    <View style={styles.container}>
      <BottomSheet visible={isVisible} onClose={handleClose} paddingHorizontal={0}>
        <View style={styles.contentContainer}>
          {/* Header - Figma: Frame 1686557311 gap=10, paddingHorizontal=48 */}
          <View style={styles.headerBlock}>
            {/* Title - Figma: PlusJakartaSans-Regular 28/40 -1 #FFFFFF */}
            <Text style={styles.title}>
              Let's verify your number
            </Text>

            {/* Subtitle - Figma: PlusJakartaSans-Medium 12/21.6 -0.132 #A9A9A9 */}
            <Text style={styles.subtitle}>
              We've sent a 6-digit code to your phone. It'll auto-verify once entered
            </Text>
          </View>

          {/* OTP Input - Figma: OTP instance paddingHorizontal=48 */}
          {/* Label#67:0 = false in all 4 states -- no "Secure code" label */}
          <View style={styles.otpBlock}>
            <OTPInput
              value={otp}
              onChangeText={handleOtpChange}
              onComplete={handleProceed}
              error={errorMessage}
              testID="otp-input"
            />
          </View>

          {/* Footer - Figma: Frame 1686557317 gap=16, paddingHorizontal=48 */}
          <View style={styles.footerBlock}>
            {/* Proceed Button - Figma: active gradient in error states too */}
            <PrimaryButton
              title={
                isOtpExpired
                  ? 'Code Expired'
                  : cooldownRemaining > 0
                    ? `Wait ${cooldownRemaining}s`
                    : 'Proceed'
              }
              onPress={handleProceed}
              disabled={isButtonDisabled}
              loading={isVerifyingOtp || isNavigating}
              showDivider={true}
              testID="proceed-button"
            />

            {/* Resend Link - Figma: PlusJakartaSans-Regular 12/20 #A9A9A9 centered */}
            <View style={styles.resendContainer}>
              {isOtpExpired ? (
                <RNText style={styles.resendText}>
                  Code expired.{' '}
                  <RNText
                    style={styles.resendLink}
                    onPress={handleResend}
                    disabled={isResendingOtp || !canResend}
                  >
                    {isResendingOtp ? 'Sending...' : canResend ? 'Send a new code' : `Resend in ${resendCountdown}s`}
                  </RNText>
                </RNText>
              ) : canResend ? (
                <RNText style={styles.resendText}>
                  {otpExpirySeconds > 0 && otpExpirySeconds <= 60
                    ? `Code expires in ${otpExpirySeconds}s. `
                    : "Didn't receive the code? "}
                  <RNText
                    style={styles.resendLink}
                    onPress={handleResend}
                    disabled={isResendingOtp}
                  >
                    {isResendingOtp ? 'Sending...' : 'Resend'}
                  </RNText>
                </RNText>
              ) : (
                <RNText style={styles.resendText}>
                  Resend in {resendCountdown}s
                </RNText>
              )}
            </View>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent to show sign-up screen behind
  },
  // Figma: Frame 1686557230 - content area with paddingTop=16, gap=30.38
  contentContainer: {
    paddingTop: FIGMA_GAPS.contentPaddingTop,              // Figma: 16px
    gap: FIGMA_GAPS.contentItemSpacing,                    // Figma: 30.38
    alignItems: 'center',                                   // Figma: counterAxisAlignItems: CENTER
  },
  // Figma: Frame 1686557311 - header with gap=10, paddingHorizontal=48
  headerBlock: {
    paddingHorizontal: FIGMA_DIMENSIONS.containerPadding,  // 48
    gap: FIGMA_GAPS.titleToSubtitle,                       // 10
    alignItems: 'flex-start',                              // Figma: left-aligned text
    width: '100%',
  },
  // Figma: PlusJakartaSans-Regular 28/40 letterSpacing=-1 #FFFFFF
  title: {
    ...typography.h4,
    color: FIGMA_COLORS.titleText,
    width: FIGMA_DIMENSIONS.titleWidth,
    textAlign: 'left',
  },
  // Figma: PlusJakartaSans-Medium 12/21.6 letterSpacing=-0.132 #A9A9A9
  subtitle: {
    ...typography.bodySmMedium,
    lineHeight: sf(21.6), // Specific Figma override — scaled
    letterSpacing: -0.132, // Specific Figma override
    color: FIGMA_COLORS.subtitleText,
    width: FIGMA_DIMENSIONS.subtitleWidth,
    textAlign: 'left',
  },
  // Figma: OTP instance wrapper with paddingHorizontal=48
  // Label#67:0 = false in all states, so no gap needed for label
  otpBlock: {
    paddingHorizontal: FIGMA_DIMENSIONS.containerPadding,  // 48
    width: '100%',
  },
  // Figma: Frame 1686557317 - button + resend with gap=16, paddingHorizontal=48
  footerBlock: {
    paddingHorizontal: FIGMA_DIMENSIONS.containerPadding,  // 48
    gap: FIGMA_GAPS.buttonToResend,                        // 16
    alignItems: 'center',
    width: '100%',
  },
  resendContainer: {
    alignItems: 'center',
  },
  // Figma: PlusJakartaSans-Regular 12/20 letterSpacing=0 #A9A9A9 centered
  resendText: {
    ...typography.bodySm,
    color: FIGMA_COLORS.resendText,
    textAlign: 'center',
    width: FIGMA_DIMENSIONS.resendWidth,
  },
  // Figma: "Resend" span - same color, underlined
  resendLink: {
    color: FIGMA_COLORS.resendText,
    textDecorationLine: 'underline',
  },
});
