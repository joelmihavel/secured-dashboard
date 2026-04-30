/**
 * Referral Code Input Component - Pixel Perfect Figma Implementation
 *
 * Source: figma-parity/data/ai-enhanced/41-11206/enhanced-extraction.json
 *
 * Figma Node References:
 * - 41:11253: OTP Instance - 281x64, gap 16
 * - I41:11253;50:330: Input row - 280x64, gap 8
 * - I41:11253;50:331: _Mega input field base - 64x64, borderRadius 8
 * - I41:11253;50:331;1106:66616: Input frame - 64x64, #222222 bg, #444444 border
 * - I41:11253;50:331;1106:66617: Text - fontSize 48, lineHeight 60, color #444444
 */

import React, { memo, useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text as RNText,
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
import { Dimensions } from 'react-native';
import { colors } from '@/src/theme/colors';
import { duration } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ratioX = SCREEN_WIDTH / 393;
const sv = (val: number) => val * ratioX;

// ============================================
// FIGMA EXTRACTED CONSTANTS
// All values from enhanced-extraction.json
// ============================================

const FIGMA = {
  // OTP container (node 41:11253)
  container: {
    width: sv(281),
    height: sv(64),
    gap: sv(16), // spacing.lg
  },

  // Input row (node I41:11253;50:330)
  inputRow: {
    width: sv(280),
    height: sv(64),
    gap: sv(8), // spacing.xs
  },

  // Individual input box (node I41:11253;50:331;1106:66616)
  inputBox: {
    width: sv(64),
    height: sv(64),
    borderRadius: sv(8), // radius.sm
    padding: 0, // No padding to fit 48px text in 64px box
    borderWidth: sv(1),
  },

  // Input text (node I41:11253;50:331;1106:66617)
  // lineHeight matches the box height so the flex-centered line-box
  // sits flush in the middle. Figma spec said 60 but the actual box
  // is 64 — on iOS the 60 line-box bottom-aligns descenders (Q, 9)
  // below the visible box. Using 64 puts the glyph in the geometric centre.
  inputText: {
    fontSize: sv(48),
    lineHeight: sv(64),
    fontFamily: 'Inter-Medium',
    letterSpacing: -0.96,
  },

  // Colors from Figma with design token mappings
  colors: {
    // Input background: #222222 per Figma node
    inputBackground: '#222222',

    // Input border: #444444 → colors.neutral[800]
    inputBorder: colors.neutral[800],

    // Input border active: #FF9A6D → colors.brand[500]
    inputBorderActive: colors.brand[500],

    // Input border error: #E5484D → colors.error.radix (per design tokens)
    inputBorderError: colors.error.radix,

    // Placeholder/empty text: #444444 → colors.neutral[800]
    textPlaceholder: colors.neutral[800],

    // Filled text: #FFFFFF → colors.white
    textFilled: colors.white,
  },

  // Shadow on input (from effects)
  shadow: {
    color: 'rgba(10, 13, 18, 0.05)',
    offsetX: 0,
    offsetY: sv(1),
    blurRadius: sv(2),
  },
} as const;

// ============================================
// TYPES
// ============================================

export interface ReferralCodeInputProps {
  code: string[];
  onCharacterChange: (index: number, char: string) => void;
  error?: string;
  disabled?: boolean;
  testID?: string;
}

const CODE_LENGTH = 4;

// ============================================
// CURSOR COMPONENT
// ============================================

function BlinkingCursor({ isActive, disabled }: { isActive: boolean; disabled?: boolean }) {
  const cursorOpacity = useSharedValue(0);

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
  }, [isActive, disabled, cursorOpacity]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return <Animated.View style={[styles.cursor, cursorStyle]} />;
}

// ============================================
// MAIN COMPONENT
// ============================================

function ReferralCodeInputComponent({
  code,
  onCharacterChange,
  error,
  disabled,
  testID,
}: ReferralCodeInputProps) {
  const inputRef = useRef<RNTextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Derived single string value
  const valueString = code.join('');

  const handleChange = useCallback((text: string) => {
    if (disabled) return;
    
    // Clean to only uppercase alphanumeric
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
    
    // Call the parent's setter for each character position
    for (let i = 0; i < CODE_LENGTH; i++) {
      onCharacterChange(i, cleaned[i] || '');
    }

    if (cleaned.length > valueString.length) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Dismiss keyboard when all 4 characters are entered — prevents
    // a 5th keystroke from overriding the last character.
    if (cleaned.length >= CODE_LENGTH) {
      inputRef.current?.blur();
    }
  }, [disabled, onCharacterChange, valueString]);

  const handlePress = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  return (
    <View style={styles.container} testID={testID}>
      {/* Visible boxes mapped from string */}
      <Pressable 
        onPress={handlePress} 
        style={styles.boxesContainer} 
        accessibilityRole="none"
        accessibilityLabel={`Referral code input, ${valueString.length} of ${CODE_LENGTH} digits entered`}
      >
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const char = code[index];
          const hasValue = !!char;
          const hasError = !!error;
          
          // Current active box is the one immediately after the string length, 
          // or the last box if full
          const isCurrentBox = isFocused && (
            (index === valueString.length && index < CODE_LENGTH) || 
            (index === CODE_LENGTH - 1 && valueString.length === CODE_LENGTH)
          );

          // Determine border color based on state
          const borderColor = hasError
            ? FIGMA.colors.inputBorderError
            : isCurrentBox
              ? FIGMA.colors.inputBorderActive
              : hasValue
                ? FIGMA.colors.inputBorderActive
                : FIGMA.colors.inputBorder;

          return (
            <View
              key={index}
              style={[
                styles.inputBox,
                { borderColor },
                disabled && styles.inputBoxDisabled,
              ]}
            >
              {hasValue ? (
                <RNText style={[styles.inputText, styles.inputTextFilled]}>{char}</RNText>
              ) : isCurrentBox ? (
                <BlinkingCursor isActive={true} disabled={disabled} />
              ) : (
                <RNText style={[styles.inputText, styles.inputTextEmpty]}>0</RNText>
              )}
            </View>
          );
        })}
      </Pressable>

      {/* Transparent input overlaid on boxes — taps land directly on TextInput */}
      <RNTextInput
        ref={inputRef}
        value={valueString}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        maxLength={CODE_LENGTH}
        autoCapitalize="characters"
        keyboardType="default"
        caretHidden
        editable={!disabled}
        accessibilityLabel="Referral verification code"
        accessibilityState={{ disabled: !!disabled }}
        style={styles.hiddenInput}
        testID={`${testID}-hidden-input`}
      />
    </View>
  );
}

// ============================================
// STYLES - Exact Figma values
// ============================================

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  
  boxesContainer: {
    flexDirection: 'row',
    width: FIGMA.inputRow.width,
    height: FIGMA.inputRow.height,
    gap: FIGMA.inputRow.gap,
    justifyContent: 'center',
  },

  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02, // Must be > 0.01 for iOS hit-testing
    color: 'transparent',
    backgroundColor: 'transparent',
  },

  // Input box - 64x64, borderRadius 8, #222222 bg, #444444 border
  // Node I41:11253;50:331;1106:66616
  inputBox: {
    width: FIGMA.inputBox.width,
    height: FIGMA.inputBox.height,
    borderRadius: FIGMA.inputBox.borderRadius,
    backgroundColor: FIGMA.colors.inputBackground,
    borderWidth: FIGMA.inputBox.borderWidth,
    borderColor: FIGMA.colors.inputBorder,
    padding: FIGMA.inputBox.padding,
    justifyContent: 'center',
    alignItems: 'center',
    // Drop shadow from Figma effects
    shadowColor: FIGMA.shadow.color,
    shadowOffset: {
      width: FIGMA.shadow.offsetX,
      height: FIGMA.shadow.offsetY,
    },
    shadowOpacity: 1,
    shadowRadius: FIGMA.shadow.blurRadius,
    elevation: 1,
  },

  inputBoxDisabled: {
    opacity: 0.5,
  },

  // Input text - fontSize 48, lineHeight 60, letterSpacing -0.96
  // Node I41:11253;50:331;1106:66617
  inputText: {
    fontFamily: FIGMA.inputText.fontFamily,
    fontSize: FIGMA.inputText.fontSize,
    lineHeight: FIGMA.inputText.lineHeight,
    letterSpacing: FIGMA.inputText.letterSpacing,
    textAlign: 'center',
  },

  // Empty state - placeholder color #444444
  inputTextEmpty: {
    color: FIGMA.colors.textPlaceholder,
  },

  // Filled state - text color #FFFFFF
  inputTextFilled: {
    color: FIGMA.colors.textFilled,
  },
  
  cursor: {
    width: 2,
    height: 32,
    backgroundColor: FIGMA.colors.textFilled,
    borderRadius: 1,
  },
});

export const ReferralCodeInput = memo(ReferralCodeInputComponent);
