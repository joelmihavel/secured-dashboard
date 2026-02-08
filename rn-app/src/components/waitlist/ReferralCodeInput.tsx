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

import React, { memo, useRef, useCallback } from 'react';
import {
  View,
  TextInput as RNTextInput,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/src/theme/colors';

// ============================================
// FIGMA EXTRACTED CONSTANTS
// All values from enhanced-extraction.json
// ============================================

const FIGMA = {
  // OTP container (node 41:11253)
  container: {
    width: 281,
    height: 64,
    gap: 16, // spacing.lg
  },

  // Input row (node I41:11253;50:330)
  inputRow: {
    width: 280,
    height: 64,
    gap: 8, // spacing.xs
  },

  // Individual input box (node I41:11253;50:331;1106:66616)
  inputBox: {
    width: 64,
    height: 64,
    borderRadius: 8, // radius.sm
    padding: 0, // No padding to fit 48px text in 64px box
    borderWidth: 1,
  },

  // Input text (node I41:11253;50:331;1106:66617)
  inputText: {
    fontSize: 48,
    lineHeight: 60,
    fontWeight: '500' as const,
    fontFamily: 'Inter',
    letterSpacing: -0.96,
  },

  // Colors from Figma with design token mappings
  colors: {
    // Input background: #202020 → colors.black[500]
    inputBackground: colors.black[500],

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
    offsetY: 1,
    blurRadius: 2,
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
// MAIN COMPONENT
// ============================================

function ReferralCodeInputComponent({
  code,
  onCharacterChange,
  error,
  disabled,
  testID,
}: ReferralCodeInputProps) {
  const inputRefs = useRef<(RNTextInput | null)[]>([]);

  const handleChange = useCallback(
    (index: number, text: string) => {
      if (disabled) return;
      const char = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
      onCharacterChange(index, char);
      if (char && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [disabled, onCharacterChange]
  );

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      if (disabled) return;
      if (key === 'Backspace' && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [disabled, code]
  );

  const handleFocus = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  return (
    <View style={styles.container} testID={testID}>
      {Array.from({ length: CODE_LENGTH }, (_, index) => {
        const hasValue = !!code[index];
        const hasError = !!error;

        // Determine border color based on state
        const borderColor = hasError
          ? FIGMA.colors.inputBorderError
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
            <RNTextInput
              ref={(ref) => (inputRefs.current[index] = ref)}
              value={code[index]}
              onChangeText={(text) => handleChange(index, text)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              onFocus={handleFocus}
              style={[
                styles.inputText,
                hasValue ? styles.inputTextFilled : styles.inputTextEmpty,
              ]}
              maxLength={1}
              autoCapitalize="characters"
              keyboardType="default"
              textAlign="center"
              placeholder="0"
              placeholderTextColor={FIGMA.colors.textPlaceholder}
              editable={!disabled}
              testID={`${testID}-box-${index}`}
            />
          </View>
        );
      })}
    </View>
  );
}

// ============================================
// STYLES - Exact Figma values
// ============================================

const styles = StyleSheet.create({
  // Container - 280x64, gap 8
  // Node I41:11253;50:330
  container: {
    flexDirection: 'row',
    width: FIGMA.inputRow.width,
    height: FIGMA.inputRow.height,
    gap: FIGMA.inputRow.gap,
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
    fontWeight: FIGMA.inputText.fontWeight,
    letterSpacing: FIGMA.inputText.letterSpacing,
    textAlign: 'center',
    width: '100%',
    // Removed height: '100%' for better cross-platform text alignment
    // The inputBox container already has fixed height of 64
    padding: 0,
  },

  // Empty state - placeholder color #444444
  inputTextEmpty: {
    color: FIGMA.colors.textPlaceholder,
  },

  // Filled state - text color #FFFFFF
  inputTextFilled: {
    color: FIGMA.colors.textFilled,
  },
});

export const ReferralCodeInput = memo(ReferralCodeInputComponent);
