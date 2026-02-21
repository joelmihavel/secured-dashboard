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
import { View, StyleSheet, Pressable, BackHandler, Text as RNText, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';

import { Screen, Text, PrimaryButton, OTPInput } from '@/src/components';
import { colors, springConfig, duration, radius, spacing, typography } from '@/src/theme';
import { useAuth } from '@/src/hooks';
import { useAuthStore } from '@/src/stores/auth';
import { getWaitlistStatus } from '@/src/services/api/waitlist';

// Exact Figma color values mapped to theme tokens (verified from all 4 blueprint JSONs)
const FIGMA_COLORS = {
  overlay: 'rgba(0,0,0,0.4)',          // Figma: Rectangle 54 opacity=0.4
  sheetBackground: colors.black[600], // #1A1A1A - Frame 1686557301
  handle: '#4D4D4D',                   // Figma: Rectangle 53 - dark gray handle
  titleText: colors.white,            // #FFFFFF
  subtitleText: colors.neutral[500],  // #A9A9A9
  resendText: colors.neutral[500],    // #A9A9A9
} as const;

// Exact Figma dimensions (verified from blueprints)
const FIGMA_DIMENSIONS = {
  sheetBorderRadius: 22.79,            // Figma: Frame 1686557301 borderRadius tl/tr
  handleWidth: 48,                     // Figma: Rectangle 53 width
  handleHeight: 4,                     // Figma: Rectangle 53 height
  handleRadius: 200,                   // Figma: Rectangle 53 borderRadius
  containerPadding: 48,                // Figma: (393 - 297) / 2 = 48px horizontal padding
  titleWidth: 297,                     // Figma: title width
  subtitleWidth: 297,                  // Figma: subtitle width
  resendWidth: 297,                    // Figma: resend text width
  homeIndicatorHeight: 34,             // Home indicator space
} as const;

// Exact Figma spacing gaps (verified from blueprint frame layouts)
const FIGMA_GAPS = {
  wrapperGap: 15,                      // Figma: Frame 2095586317 gap (handle to sheet content)
  sheetPaddingTop: 15.19,              // Figma: Frame 1686557301 paddingTop (exact: 15.19174861907959)
  sheetItemSpacing: 24,                // Figma: Frame 1686557301 itemSpacing
  contentPaddingTop: 16,               // Figma: Frame 1686557230 paddingTop
  contentItemSpacing: 30.38,           // Figma: Frame 1686557230 itemSpacing (exact: 30.38349723815918)
  titleToSubtitle: 10,                 // Figma: Frame 1686557311 gap
  buttonToResend: 16,                  // Figma: Frame 1686557317 gap
} as const;

export default function OTPScreen() {
  const router = useRouter();
  const {
    phoneNumber,
    status,
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

  const [otp, setOtp] = React.useState('');
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);

  // OTP expiration timer -- Supabase OTPs expire after 5 minutes (300s)
  const OTP_VALIDITY_SECONDS = 300;
  const [otpExpirySeconds, setOtpExpirySeconds] = React.useState(OTP_VALIDITY_SECONDS);
  const [isOtpExpired, setIsOtpExpired] = React.useState(false);

  // Animation values
  const translateY = useSharedValue(500); // Start offscreen
  const overlayOpacity = useSharedValue(0);

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

  const figmaTransition = { duration: 300, easing: Easing.out(Easing.quad) };

  const handleClose = useCallback(() => {
    overlayOpacity.value = withTiming(0, { duration: 300 });
    translateY.value = withTiming(500, figmaTransition, (finished) => {
      if (finished) {
        runOnJS(router.back)();
      }
    });
  }, [router, overlayOpacity, translateY]);

  // Animate in on mount
  useEffect(() => {
    overlayOpacity.value = withTiming(0.4, { duration: 300 });
    translateY.value = withTiming(0, figmaTransition);
  }, [overlayOpacity, translateY]);

  // Handle back button - include handleClose in dependencies to prevent stale closure
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => backHandler.remove();
  }, [handleClose]);

  // Navigate based on user journey state after authentication.
  // Sets isNavigating=true immediately to lock the UI (prevents double-press),
  // then fades the overlay to fully opaque to hide sign-up underneath during
  // the cross-group transition from (auth) modal → (agreement) stack.
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (isNavigating) return; // Prevent duplicate runs

    setIsNavigating(true);

    const resolveRoute = async () => {
      try {
        const { data, error } = await getWaitlistStatus();

        if (error || !data) {
          // No waitlist data → new user, needs agreement upload
          router.replace('/(agreement)/upload');
          return;
        }

        if (data.state === 'approved') {
          router.replace('/(main)');
        } else if (data.position === null && data.submissionDate === null) {
          // Has entry but no position/submission → hasn't uploaded agreement yet
          router.replace('/(agreement)/upload');
        } else {
          router.replace('/(waitlist)');
        }
      } catch {
        // Fail to agreement upload for new users (safe default)
        router.replace('/(agreement)/upload');
      }
    };

    resolveRoute();
  }, [status, router, isNavigating, overlayOpacity]);

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
    setOtp('');
    // Reset failure tracking on resend -- new OTP means fresh attempts
    failureCountRef.current = 0;
    lastFailureTimeRef.current = 0;
    setCooldownRemaining(0);
    // Reset OTP expiration timer for the new code
    setOtpExpirySeconds(OTP_VALIDITY_SECONDS);
    setIsOtpExpired(false);
    if (error) clearError();
    resendCode();
  }, [resendCode, error, clearError]);

  // Pan gesture for dismiss
  const panGesture = Gesture.Pan()
    .activeOffsetY([-20, 20]) // Increase threshold slightly
    .failOffsetX([-10, 10])   // Do not activate on horizontal movement
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withTiming(0, figmaTransition);
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value, // Figma: 40% opacity (0.4 target)
  }));

  // Figma: Button is ACTIVE (gradient) in error states -- only disabled when OTP incomplete,
  // during cooldown/expiry, or when navigating after successful verification.
  const isButtonDisabled = !isOtpComplete || cooldownRemaining > 0 || isOtpExpired || isNavigating;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Blurred overlay - tap to dismiss */}
      {/* Figma: Rectangle 55 = blur 8px + 60% black, Rectangle 54 = 40% black overlay */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.overlay, overlayAnimatedStyle]} />
      </Pressable>

      {/* Bottom Sheet - Figma: Frame 2095586317 column, gap=15, alignItems=center */}
      {/* GestureDetector moved INSIDE Animated.View to only wrap the handle area.
          Previously it wrapped the entire sheet, which caused RNGH's native gesture
          handler to intercept all touches before they could reach the OTP TextInput. */}
      <Animated.View style={[styles.sheetWrapper, sheetAnimatedStyle]}>
        {/* Handle - wrapped in GestureDetector for swipe-to-dismiss */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        {/* Sheet Content - Figma: Frame 1686557301 bg=#1A1A1A, radius=22.79 */}
        <View style={styles.sheetContent}>
          {/* Content - Figma: Frame 1686557230 paddingTop=16, gap=30.38 */}
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
                      disabled={isResendingOtp}
                    >
                      {isResendingOtp ? 'Sending...' : 'Send a new code'}
                    </RNText>
                  </RNText>
                ) : (
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
                )}
              </View>
            </View>
          </View>

          {/* Home Indicator space */}
          <View style={styles.homeIndicatorSpace} />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent', // Transparent to show sign-up screen behind
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000', // Base black - opacity controlled by animation (0.4 per Figma Rectangle 54)
  },
  // Figma: Frame 2095586317 - transparent wrapper, column layout, gap=15, alignItems=center
  sheetWrapper: {
    gap: FIGMA_GAPS.wrapperGap,        // Figma: 15px gap between handle and sheet content
    alignItems: 'center',              // Figma: counterAxisAlignItems: CENTER
  },
  // Figma: Frame 1686557301 - sheet content with dark background
  sheetContent: {
    backgroundColor: FIGMA_COLORS.sheetBackground,     // #1A1A1A
    borderTopLeftRadius: FIGMA_DIMENSIONS.sheetBorderRadius,   // 22.79
    borderTopRightRadius: FIGMA_DIMENSIONS.sheetBorderRadius,  // 22.79
    overflow: 'hidden',
    paddingTop: FIGMA_GAPS.sheetPaddingTop,             // 15.19
    width: '100%',                                       // Figma: sizingH=FILL
  },
  // Figma: Handle floats above sheet, no top padding (y=0 in Frame 2095586317)
  // Extra vertical padding provides a larger touch target for the swipe-to-dismiss gesture
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    width: '100%',
  },
  handle: {
    width: FIGMA_DIMENSIONS.handleWidth,     // 48
    height: FIGMA_DIMENSIONS.handleHeight,   // 4
    backgroundColor: FIGMA_COLORS.handle,    // #4D4D4D
    borderRadius: FIGMA_DIMENSIONS.handleRadius, // 200
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
    lineHeight: 21.6, // Specific Figma override
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
  homeIndicatorSpace: {
    height: FIGMA_DIMENSIONS.homeIndicatorHeight,          // 34
  },
});
