/**
 * OTP Verification Screen (Bottom Sheet)
 * Figma Nodes: 1-31175 (empty), 1-31277 (filled)
 *
 * PIXEL-PERFECT Figma Values:
 * - Overlay: background rgba(0,0,0,0.4) (Figma Rectangle 54 opacity=0.4)
 * - Sheet background: #1A1A1A (black.600)
 * - Sheet width: 393px (full width)
 * - Sheet height: 409.96px (OTP filled state)
 * - Sheet border radius: 22.79px top (Figma: borderRadius)
 * - Handle: 48px width, 4px height, #4D4D4D (dark gray), radius 200px
 * - Handle top padding: 15.19px
 * - Container padding: 48px horizontal (per content width 297px)
 * - Title: Plus Jakarta Sans Regular, 28px, line-height 39.48px, tracking -0.56px, #FFFFFF
 *   Text: "Let's verify your number"
 * - Subtitle: Plus Jakarta Sans Medium, 12px, line-height 21.6px (1.8), tracking -0.132px, #A9A9A9
 *   Text: "We've sent a 6-digit code to your phone. It'll auto-verify once entered"
 * - Title to subtitle gap: 10px (estimated)
 * - OTP Input boxes: 39px width, 64px height, background #222222, border #444444, radius 8px
 * - OTP text: Plus Jakarta Sans Medium, 16px, line-height 24px, #444444 (empty) / #FFFFFF (filled)
 * - Divider: 24px width, 2px height, #4D4D4D, radius 200px
 * - Button: 297px width, 56px height, border #FF9A6D, radius 8px
 * - Button active: background gradient, border #FF9A6D, shadow #995C41
 * - Button text: Plus Jakarta Sans Medium, 16px, line-height 24px, #FFFFFF
 * - Resend text: Plus Jakarta Sans Regular, 12px, line-height 20px, #A9A9A9, centered
 *   Text: "Didn't receive the code? Resend"
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, BackHandler, Text as RNText } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';

import { Text, PrimaryButton, OTPInput } from '@/src/components';
import { colors, springConfig, duration, radius, spacing } from '@/src/theme';
import { useAuth } from '@/src/hooks';
import { useAuthStore } from '@/src/stores/auth';

// Exact Figma color values mapped to theme tokens (verified from 1-31277 extraction)
const FIGMA_COLORS = {
  overlay: 'rgba(0,0,0,0.4)',          // Figma: Rectangle 54 opacity=0.4 = 40% opacity
  sheetBackground: colors.black[600], // #1A1A1A - Frame 1686557301
  handle: '#4D4D4D',                   // Figma: node 1:31258 Rectangle 53 - dark gray handle
  titleText: colors.white,            // #FFFFFF
  subtitleText: colors.neutral[500],  // #A9A9A9
  otpBoxBg: colors.neutral[900],      // #222222
  otpBoxBorder: colors.neutral[800],  // #444444
  otpTextEmpty: colors.neutral[800],  // #444444
  otpTextFilled: colors.white,        // #FFFFFF - node I31:2866;50:319;1106:66617
  divider: colors.black[400],         // #4D4D4D - Rectangle 140
  resendText: colors.neutral[500],    // #A9A9A9
  secureCodeLabel: '#DDDDDD',         // Figma: I31:2866;50:317 "Secure code" label
} as const;

// Exact Figma dimensions
const FIGMA_DIMENSIONS = {
  sheetWidth: 393,                     // Figma: full width
  sheetHeight: 409.96,                 // Figma: frame_1686557301 height (filled)
  sheetBorderRadius: 22.79,            // Figma: exact radius (24 for cleaner value)
  handleWidth: 48,                     // Figma: rectangle_53 width (node 1:31258)
  handleHeight: 4,                     // Figma: rectangle_53 height
  handleRadius: 200,                   // Figma: rectangle_53 borderRadius
  handleToSheetGap: 15,                // Figma: Frame 2095586317 gap between handle and sheet
  handleTopPadding: 0,                  // Figma: handle sits at top of wrapper (no top padding)
  containerPadding: 48,                // (393 - 297) / 2 = 48
  contentWidth: 297,                   // Figma: content width
  titleWidth: 297,                     // Figma: letsVerifyYourNumber width
  titleHeight: 40,                     // Figma: letsVerifyYourNumber height
  subtitleWidth: 297,                  // Figma: subtitle width
  subtitleHeight: 44,                  // Figma: subtitle height
  otpBoxWidth: 39,                     // Figma: input width
  otpBoxHeight: 64,                    // Figma: input height
  otpBoxRadius: 8,                     // Figma: input borderRadius
  otpBoxGap: 8,                        // Gap between boxes
  dividerWidth: 24,                    // Figma: rectangle_140 width
  dividerHeight: 2,                    // Figma: rectangle_140 height
  buttonWidth: 297,                    // Figma: frame_2095586312 width
  buttonHeight: 56,                    // Figma: frame_2095586312 height
  resendWidth: 297,                    // Figma: resend text width
  homeIndicatorHeight: 34,             // Home indicator space
} as const;

// Exact Figma spacing gaps (from extracted-values.json 1-31277)
const FIGMA_GAPS = {
  sheetItemSpacing: 24,                // Figma: Frame 1686557301 itemSpacing
  contentItemSpacing: 30.38,           // Figma: Frame 1686557260 itemSpacing (30.38349723815918)
  titleToSubtitle: 10,                 // Figma: header section gap
  subtitleToOtp: 30.38,                // Subtitle to OTP gap (matches content item spacing)
  otpToButton: 30.38,                  // OTP to button gap (matches content item spacing)
  buttonToResend: 16,                  // Button to resend gap
  otpLabelGap: 6,                      // Figma: OTP instance gap between label and boxes (I31:2866;50:316)
} as const;

export default function OTPScreen() {
  const router = useRouter();
  const { state } = useLocalSearchParams<{ state?: 'empty' | 'filled' | 'error1' | 'error2' }>();
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

  // Mock OTP for testing states
  const getMockOtp = () => {
    switch (state) {
      case 'filled':
        return '123456';
      case 'error1':
      case 'error2':
        return '000000';
      default:
        return '';
    }
  };

  // Mock error messages for testing
  const getMockError = (): string | undefined => {
    switch (state) {
      case 'error1':
        return 'Wrong Code';
      case 'error2':
        return 'Too many Attempts';
      default:
        return undefined;
    }
  };

  const [otp, setOtp] = React.useState(getMockOtp);
  const [mockError, setMockError] = React.useState<string | undefined>(getMockError);
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);

  // OTP expiration timer -- Supabase OTPs expire after 5 minutes (300s)
  const OTP_VALIDITY_SECONDS = 300;
  const [otpExpirySeconds, setOtpExpirySeconds] = React.useState(OTP_VALIDITY_SECONDS);
  const [isOtpExpired, setIsOtpExpired] = React.useState(false);

  // Animation values
  const translateY = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  const isOtpComplete = otp.length === 6;

  // Reset the ref-based submission guard when verification completes (success or error)
  useEffect(() => {
    if (!isVerifyingOtp) {
      isSubmittingRef.current = false;
    }
  }, [isVerifyingOtp]);

  // Track failures for exponential backoff
  useEffect(() => {
    if (error && !mockError) {
      failureCountRef.current += 1;
      lastFailureTimeRef.current = Date.now();

      // Apply cooldown: 2s, 4s, 8s, capped at 15s
      const cooldownMs = Math.min(
        Math.pow(2, failureCountRef.current) * 1000,
        15000
      );
      setCooldownRemaining(Math.ceil(cooldownMs / 1000));
    }
  }, [error, mockError]);

  // Countdown timer for cooldown display
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setTimeout(() => {
      setCooldownRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  // OTP expiration countdown -- ticks every second when not in mock mode
  useEffect(() => {
    if (state) return; // Skip for mock/testing states
    if (isOtpExpired) return;
    if (otpExpirySeconds <= 0) {
      setIsOtpExpired(true);
      return;
    }
    const timer = setTimeout(() => {
      setOtpExpirySeconds((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [otpExpirySeconds, isOtpExpired, state]);

  // Map error codes to user-friendly messages
  const getErrorMessage = (): string | undefined => {
    // Return mock error for testing if set
    if (mockError) return mockError;
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
  };

  // Callbacks defined before effects that use them
  const handleOtpChange = useCallback((text: string) => {
    setOtp(text);
    if (mockError) setMockError(undefined);
    if (error) clearError();
  }, [error, clearError, mockError]);

  const handleClose = useCallback(() => {
    overlayOpacity.value = withTiming(0, { duration: duration.fast });
    translateY.value = withSpring(500, springConfig.stiff, (finished) => {
      if (finished) {
        runOnJS(router.back)();
      }
    });
  }, [router, overlayOpacity, translateY]);

  // Animate in on mount
  useEffect(() => {
    overlayOpacity.value = withTiming(0.4, { duration: duration.normal }); // Figma: 40% opacity overlay
  }, [overlayOpacity]);

  // Handle back button - include handleClose in dependencies to prevent stale closure
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => backHandler.remove();
  }, [handleClose]);

  // Navigate to main app when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/(waitlist)');
    }
  }, [status, router]);

  const handleProceed = useCallback((otpValue?: string) => {
    // Ref-based guard: prevents double-fire even before React Query isPending updates
    if (isSubmittingRef.current || isVerifyingOtp) return;

    const code = otpValue ?? otp;
    if (code.length !== 6) return;

    // Enforce exponential backoff cooldown between retries
    if (cooldownRemaining > 0) return;

    // Prevent submission if OTP has expired -- user must resend
    if (isOtpExpired) return;

    isSubmittingRef.current = true;
    verifyCode(code, userName || undefined);
  }, [otp, verifyCode, userName, isVerifyingOtp, cooldownRemaining, isOtpExpired]);

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
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, springConfig.snappy);
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value, // Figma: 40% opacity (0.4 target)
  }));

  return (
    <View style={styles.container}>
      {/* Blurred overlay - tap to dismiss */}
      {/* BlurView intensity=8 + dark tint, overlay at 40% opacity (Figma Rectangle 54) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
        {/* Glass blur effect - shows sign-up screen in a hazy manner behind modal */}
        {/* Figma: Rectangle 55 = blur 8px + 60% black, Rectangle 54 = 40% black overlay */}
        <BlurView intensity={8} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.overlay, overlayAnimatedStyle]} />
      </Pressable>

      {/* Bottom Sheet - Figma: Frame 2095586317 contains handle + sheet content with gap:15 */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.sheetWrapper, sheetAnimatedStyle]}>
          {/* Handle - Figma: node 1:31361 Rectangle 53 - Above sheet content */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          {/* Sheet Content with background - Figma: Frame 1686557301 */}
          <View style={styles.sheetContent}>
            {/* Content - Figma: Frame 1686557260 with paddingTop:16, itemSpacing:30.38 */}
            <View style={styles.contentContainer}>
            {/* Header block - Figma: Frame 1686557269 with gap:10, paddingHorizontal:48 */}
            <View style={styles.headerBlock}>
              {/* Title - Figma: "Let's verify your number" */}
              <Text style={styles.title}>
                Let's verify your number
              </Text>

              {/* Subtitle - Figma: exact text */}
              <Text style={styles.subtitle}>
                We've sent a 6-digit code to your phone. It'll auto-verify once entered
              </Text>
            </View>

            {/* OTP Input - Figma: OTP instance with paddingLeft:48, paddingRight:48, gap:6 */}
            {/* Includes "Secure code" label per Figma node I31:2866;50:317 */}
            <View style={styles.otpBlock}>
              {/* Secure code label - Figma: Inter 14px 500 #DDDDDD */}
              <RNText style={styles.secureCodeLabel}>Secure code</RNText>
              <OTPInput
                value={otp}
                onChangeText={handleOtpChange}
                onComplete={handleProceed}
                error={getErrorMessage()}
                testID="otp-input"
              />
            </View>

            {/* Footer block - Button + Resend with 16px gap */}
            <View style={styles.footerBlock}>
              {/* Proceed Button - Figma: "Proceed" with 12px border radius */}
              <PrimaryButton
                title={
                  isOtpExpired
                    ? 'Code Expired'
                    : cooldownRemaining > 0
                      ? `Wait ${cooldownRemaining}s`
                      : 'Proceed'
                }
                onPress={handleProceed}
                disabled={!isOtpComplete || !!error || cooldownRemaining > 0 || isOtpExpired}
                loading={isVerifyingOtp}
                showDivider={true}
                testID="proceed-button"
              />

              {/* Resend / Expiry Link */}
              {/* Using RNText directly to bypass custom Text component's default styles */}
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
                    {!state && otpExpirySeconds > 0 && otpExpirySeconds <= 60
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

              {/* Cashfree text removed - belongs to underlying sign-up screen, not OTP sheet (Gemini feedback) */}
            </View>
          </View>

            {/* Home Indicator space */}
            <View style={styles.homeIndicatorSpace} />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
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
  // Figma: Floating handle structure - wrapper is transparent, handle floats above content
  sheetWrapper: {
    // Transparent wrapper allows handle to float above content background
  },
  // Figma: Sheet content with dark background - Frame 1686557301
  sheetContent: {
    backgroundColor: FIGMA_COLORS.sheetBackground,
    borderTopLeftRadius: FIGMA_DIMENSIONS.sheetBorderRadius,  // Figma: 22.79 (exact value)
    borderTopRightRadius: FIGMA_DIMENSIONS.sheetBorderRadius, // Figma: 22.79 (exact value)
    overflow: 'hidden', // Clip content to rounded corners
    paddingTop: 15.19,                                         // Figma: Frame 1686557301 paddingTop (exact)
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.xs,                                    // 8px - small top margin for handle
    paddingBottom: FIGMA_DIMENSIONS.handleToSheetGap,          // Figma: 15px gap between handle and sheet content
  },
  handle: {
    width: FIGMA_DIMENSIONS.handleWidth,
    height: FIGMA_DIMENSIONS.handleHeight,
    backgroundColor: FIGMA_COLORS.handle,
    borderRadius: FIGMA_DIMENSIONS.handleRadius,
  },
  contentContainer: {
    // Figma: Frame 1686557260 - NO horizontal padding (children have it)
    // paddingTop moved to sheetContent (15.19px per Figma Frame 1686557301)
    paddingBottom: 24,                                     // Figma: 24px gap before home indicator (Gemini fix)
    gap: FIGMA_GAPS.contentItemSpacing,                   // Figma: 30.38 (itemSpacing between header, OTP, button blocks)
    alignItems: 'center',                                  // Figma: counterAxisAlignItems: CENTER
  },
  headerBlock: {
    // Figma: Frame 1686557269 - vertical layout with gap:10, paddingHorizontal:48
    paddingHorizontal: FIGMA_DIMENSIONS.containerPadding, // Figma: 48px horizontal padding
    gap: FIGMA_GAPS.titleToSubtitle,                      // Figma: 10px gap between title and subtitle
    alignItems: 'flex-start',                             // Figma: left-aligned text per pixel-feedback
    width: '100%',                                        // Full width for proper alignment
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,                                        // Figma: lineHeightPx 40.0
    letterSpacing: -1.0,                                    // Figma: letterSpacing -1.0
    color: FIGMA_COLORS.titleText,
    width: FIGMA_DIMENSIONS.titleWidth,                   // Figma: 297px
    textAlign: 'left',                                    // Figma: left-aligned per pixel-feedback
  },
  subtitle: {
    // EXACT Figma: node 1:31271 - fontSize 12, fontWeight 500, lineHeight 21.6, letterSpacing -0.13
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 21.6,
    letterSpacing: -0.132,                                  // Figma: exact -0.132
    color: FIGMA_COLORS.subtitleText,                     // #A9A9A9
    width: FIGMA_DIMENSIONS.subtitleWidth,                // Figma: 297px
    textAlign: 'left',                                    // Figma: left-aligned per pixel-feedback
  },
  secureCodeLabel: {
    // Figma: node I31:2866;50:317 - "Secure code" label
    // Figma specifies Inter 14px fontWeight 500, lineHeight 20, color #DDDDDD, textAlign LEFT
    // INTENTIONAL DEVIATION: Using PlusJakartaSans-Medium instead of Inter-Medium because
    // Inter-Medium is not loaded in the app (only Inter-Regular is available in _layout.tsx).
    // The app consistently uses PlusJakartaSans everywhere else. Visual impact is minimal.
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: FIGMA_COLORS.secureCodeLabel,                   // #DDDDDD
    textAlign: 'left',
  },
  otpBlock: {
    // Figma: OTP instance wrapper with paddingHorizontal:48, gap:6 between label and boxes
    paddingHorizontal: FIGMA_DIMENSIONS.containerPadding, // Figma: 48px horizontal padding
    width: '100%',                                         // Full width for proper centering
    gap: FIGMA_GAPS.otpLabelGap,                          // Figma: 6px gap between label and OTP boxes
  },
  footerBlock: {
    // Button and Resend grouped with 16px gap between them
    paddingHorizontal: FIGMA_DIMENSIONS.containerPadding, // Figma: 48px horizontal padding
    gap: FIGMA_GAPS.buttonToResend,                       // Figma: 16px gap between button and resend
    alignItems: 'center',                                  // Center the button and resend text
    width: '100%',                                         // Full width to center properly
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    // EXACT Figma: fontSize 12, fontWeight 400, lineHeight 20, letterSpacing 0
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    color: FIGMA_COLORS.resendText, // #A9A9A9
    textAlign: 'center',
    width: FIGMA_DIMENSIONS.resendWidth, // 297
  },
  resendLink: {
    color: FIGMA_COLORS.resendText,                        // Figma: same #A9A9A9 as base text, only underline differs
    textDecorationLine: 'underline',
  },
  // cashfreeText style removed - text belongs to underlying screen (Gemini feedback)
  homeIndicatorSpace: {
    height: FIGMA_DIMENSIONS.homeIndicatorHeight,
  },
});
