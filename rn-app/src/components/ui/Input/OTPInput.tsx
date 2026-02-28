/**
 * OTP Input Component
 * Figma: 6-digit OTP input with dark boxes
 *
 * EXACT Figma Values (verified from Figma extraction 1-31175, 1-31277, 1-31380):
 * - Box background: #222222 (neutral/900)
 * - Border: 1px #444444 (neutral/800)
 * - Border radius: 8px
 * - Size: 39x64px per box
 * - Gap between boxes: 8px within each group
 * - Separator: "-" character in #cbcbcb
 * - Separator gap: 8px on each side
 * - Text: Plus Jakarta Sans Medium, 20px, line-height 32px
 * - Empty state: shows "0" in #444444
 * - Filled text color: #dddddd (neutral/200) for regular, #FFFFFF for error state
 * - Active box: cursor blinks (no white background in dark theme)
 * - Error state: All boxes get red border #E5484D (error.radix), error text below
 * - Error text: Plus Jakarta Sans Regular, 14px, line-height 20px, #E5484D, centered
 * - Error container gap: 16px between OTP boxes and error text
 * - Shadow: 0px 1px 2px rgba(10,13,18,0.05)
 */

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput as RNTextInput,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Text } from '../Typography';
import { spacing, duration } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

export interface OTPInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onComplete?: (otp: string) => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  testID?: string;
  /** Pass BottomSheetTextInput from @gorhom/bottom-sheet when rendered inside a bottom sheet */
  TextInputComponent?: React.ElementType;
}

const OTP_LENGTH = 6;

// Exact Figma color values (verified from Figma extraction 1-31277 OTP Filled state)
// CRITICAL FIX: Text nodes show #FFFFFF fill for filled digits
const OTP_COLORS = {
  boxBackground: '#222222',
  boxBorder: '#444444',
  boxBorderActive: '#FFFFFF', // Keep same border in active state per Figma
  boxBackgroundActive: '#222222', // Same background, just show cursor
  textEmpty: '#444444',
  textFilled: '#FFFFFF',          // CRITICAL FIX: Figma node I31:2866;50:319;1106:66617 shows #FFFFFF
  textFilledError: '#FFFFFF',     // Figma shows white text in error state too
  textActive: '#FFFFFF',
  separator: '#cbcbcb',           // Figma node I31:2866;50:322 shows #CBCBCB
  error: '#E5484D',               // Figma: error.radix - used for border in error state
  errorBackground: '#222222',     // Keep background same, only border changes
  errorText: '#E5484D',           // Figma: error.radix - used for error text
} as const;

// Exact Figma dimensions - verified from Figma extraction 1-31380 — scaled for device
const OTP_DIMENSIONS = {
  boxWidth: s(39),     // Figma: width 39px per box — scaled
  boxHeight: sv(64),   // Figma: height 64px — scaled
  boxPaddingH: s(12),  // Figma: px-[var(--scale\/12,12px)] — scaled
  boxPaddingV: sv(8),  // Figma: py-[8px] — scaled
  boxGap: s(8),        // Gap between boxes in each group — scaled
  separatorGap: s(8),  // Figma: gap around "-" separator — scaled
  borderRadius: 8,     // Figma: rounded-[8px] (keep as-is for visual consistency)
  errorGap: sv(16),    // Figma: Frame 2095586319 gap between OTP and error text — scaled
} as const;

function OTPInputComponent({
  value,
  onChangeText,
  onComplete,
  error,
  disabled,
  autoFocus = true,
  testID,
  TextInputComponent,
}: OTPInputProps) {
  const inputRef = useRef<any>(null);
  const InputComponent = TextInputComponent || RNTextInput;
  const [isFocused, setIsFocused] = useState(false);

  // Convert value to array of digits
  const digits = value.split('').slice(0, OTP_LENGTH);

  // Handle text change
  const handleChange = useCallback(
    (text: string) => {
      // Only allow digits
      const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
      onChangeText(cleaned);

      // Haptic feedback for each digit
      if (cleaned.length > value.length) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      // Call onComplete when all digits entered
      if (cleaned.length === OTP_LENGTH && onComplete) {
        onComplete(cleaned);
      }
    },
    [value, onChangeText, onComplete]
  );

  // Focus input on mount
  useEffect(() => {
    if (autoFocus) {
      // Multiple attempts to ensure focus succeeds across different transition timings
      const t1 = setTimeout(() => inputRef.current?.focus(), 100);
      const t2 = setTimeout(() => inputRef.current?.focus(), 400);
      const t3 = setTimeout(() => inputRef.current?.focus(), 800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [autoFocus]);

  // Focus input when pressing on boxes
  const handlePress = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  const hasError = !!error;

  return (
    <View style={styles.container}>
      {/* Visible boxes */}
      <Pressable onPress={handlePress} style={styles.boxesContainer} accessibilityRole="none" accessibilityLabel={`OTP input, ${digits.length} of ${OTP_LENGTH} digits entered`}>
        {/* First group (0-2) */}
        <View style={styles.group}>
          {[0, 1, 2].map((index) => (
            <OTPBox
              key={index}
              digit={digits[index]}
              isActive={isFocused && digits.length === index}
              hasError={hasError}
              disabled={disabled}
            />
          ))}
        </View>

        {/* Separator */}
        <Text variant="bodyLg" allowFontScaling={false} style={styles.separator}>
          -
        </Text>

        {/* Second group (3-5) */}
        <View style={styles.group}>
          {[3, 4, 5].map((index) => (
            <OTPBox
              key={index}
              digit={digits[index]}
              isActive={isFocused && digits.length === index}
              hasError={hasError}
              disabled={disabled}
            />
          ))}
        </View>
      </Pressable>

      {/* Transparent input overlaid on boxes — taps land directly on TextInput.
          Use BottomSheetTextInput (via TextInputComponent prop) when inside @gorhom/bottom-sheet
          to avoid gesture handler touch interception. */}
      <InputComponent
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        caretHidden
        editable={!disabled}
        accessibilityLabel="OTP verification code"
        accessibilityState={{ disabled: !!disabled }}
        style={styles.hiddenInput}
        testID={testID}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
      />

      {/* Error message - Figma shows error text centered below OTP boxes */}
      {error && (
        <Text allowFontScaling={false} style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}

// Individual OTP box
interface OTPBoxProps {
  digit?: string;
  isActive: boolean;
  hasError: boolean;
  disabled?: boolean;
}

function OTPBox({ digit, isActive, hasError, disabled }: OTPBoxProps) {
  const cursorOpacity = useSharedValue(0);

  // Blinking cursor animation
  useEffect(() => {
    if (isActive && !disabled) {
      cursorOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0, { duration: 500 })
        ),
        -1,
        false
      );
    } else {
      cursorOpacity.value = withTiming(0, { duration: duration.fast });
    }
  }, [isActive, disabled]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  // Determine box style based on state - Figma shows red border on ALL boxes when error
  const getBoxStyle = () => {
    if (hasError) {
      return [styles.box, styles.boxError];
    }
    return [styles.box];
  };

  // Determine text color - Figma 1-31380 shows white (#FFFFFF) text in error state
  const getTextColor = () => {
    if (digit) {
      return hasError ? OTP_COLORS.textFilledError : OTP_COLORS.textFilled;
    }
    return OTP_COLORS.textEmpty;
  };

  return (
    <View style={[...getBoxStyle(), disabled && styles.boxDisabled]}>
      {digit ? (
        <Text allowFontScaling={false} style={[styles.digitText, { color: getTextColor() }]}>
          {digit}
        </Text>
      ) : isActive ? (
        <Animated.View style={[styles.cursor, cursorStyle]} />
      ) : (
        // Empty state shows "0" per Figma design
        <Text allowFontScaling={false} style={[styles.digitText, { color: OTP_COLORS.textEmpty }]}>
          0
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    // Note: gap is not used here because error text uses marginTop for spacing
    // This allows the container to have no gap when there's no error
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02, // Must be > 0.01 for iOS hit-testing (UIView ignores alpha <= 0.01)
    color: 'transparent',
    backgroundColor: 'transparent',
  },
  boxesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    flexDirection: 'row',
    gap: OTP_DIMENSIONS.boxGap, // 8px between boxes in each group
  },
  separator: {
    marginHorizontal: OTP_DIMENSIONS.separatorGap, // 8px on each side — scaled
    color: OTP_COLORS.separator,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sf(20),
    lineHeight: sf(32),
  },
  box: {
    width: OTP_DIMENSIONS.boxWidth, // Figma: fixed 39px per box — scaled
    height: OTP_DIMENSIONS.boxHeight, // 64px — scaled
    paddingHorizontal: OTP_DIMENSIONS.boxPaddingH, // 12px per Figma
    paddingVertical: OTP_DIMENSIONS.boxPaddingV, // 8px per Figma
    borderRadius: OTP_DIMENSIONS.borderRadius, // 8px
    borderWidth: 1,
    borderColor: OTP_COLORS.boxBorder,
    backgroundColor: OTP_COLORS.boxBackground,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow: 0px 1px 2px rgba(10,13,18,0.05) per Figma
    shadowColor: 'rgb(10, 13, 18)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  boxError: {
    borderColor: OTP_COLORS.error, // Red border for error state
    backgroundColor: OTP_COLORS.errorBackground, // Keep dark background
  },
  boxDisabled: {
    opacity: 0.5,
  },
  digitText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sf(20),
    lineHeight: sf(32),
    textAlign: 'center',
  },
  cursor: {
    width: 2,
    height: sv(24),
    backgroundColor: '#FF9A6D', // Use filled text color for cursor
    borderRadius: 1,
  },
  errorText: {
    marginTop: OTP_DIMENSIONS.errorGap, // Figma: 16px gap between OTP and error text — scaled
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: sf(14),
    lineHeight: sf(20),
    color: OTP_COLORS.errorText, // Figma: #E5484D
    textAlign: 'center',
  },
});

export const OTPInput = memo(OTPInputComponent);
