/**
 * Phone Input Component
 * Figma Node: 1:31073 (Sign Up - Filled state)
 *
 * CORRECTED Figma Values from get_design_context (2026-02-01):
 *
 * Container (I90:3005;48:723):
 * - gap: 16px between country code and input
 * - items-center (vertical alignment)
 * - padding: 16px vertical, 0px horizontal
 * - rounded: 12px
 *
 * Country Code (+91) (I90:3005;48:725):
 * - font: Plus Jakarta Sans Regular (NOT Inter!)
 * - size: 20px (NOT 16px!)
 * - line-height: 32px
 * - color: #dddddd (neutral/200) - same as filled text
 * - NO chevron/dropdown per user request
 *
 * Input Text (I90:3005;48:728):
 * - font: Plus Jakarta Sans Regular
 * - size: 20px
 * - line-height: 32px
 * - color: #444444 (placeholder), #dddddd (filled)
 *
 * Label (VERIFIED via Figma MCP get_design_context 2026-02-08):
 * - font: Plus Jakarta Sans Medium (500)
 * - size: 12px
 * - line-height: 20px
 * - color: #a9a9a9 (normal), #ff8080 (error)
 * - gap to input: 6px
 *
 * Border:
 * - 1px bottom border
 * - color: #2a2a2a (default), #ff9a6d (focus), #ff8080 (error)
 */

import React, { memo, useState, useCallback, forwardRef } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text as RNText,
  StyleSheet,
} from 'react-native';

import { Text } from '../Typography';
import { colors } from '@/src/theme';

// Exact Figma color values mapped to theme tokens
// Verified from Figma extraction 1-29108 (sign-up empty state)
const COLORS = {
  label: colors.neutral[500],          // #a9a9a9
  labelError: '#ff8080',
  hintText: '#878787',                 // Figma hint text color (neutral/600)
  countryCodeEmpty: '#444444',         // Figma: I1:29184;48:714 - #444444 in empty state
  countryCodeFilled: colors.neutral[200], // #dddddd - filled state per Figma 1-31073
  placeholder: '#444444',              // Figma: #444444
  textFilled: colors.neutral[200],     // #dddddd
  textError: '#ff8080',                 // Figma: error text color (matches labelError/borderError)
  inputBorder: colors.black[400],      // #4D4D4D - Figma: I1:29184;48:712 borderColor
  inputBorderFocus: '#FF9A6D',         // Figma: #ff9a6d (brand accent) on focus
  inputBorderError: '#ff8080',
} as const;

// Exact Figma spacing values
const SPACING = {
  labelGap: 6,        // Gap between label and input - Figma: I1:29184;48:606 gap:6
  inputPaddingV: 16,  // Vertical padding in input container - Figma: py-[16px]
  countryCodeGap: 16, // Gap between +91 and input field - Figma: I1:29184;48:712 gap:16
  inputBorderRadius: 12, // Figma: I1:29184;48:712 borderRadius:12
} as const;

export interface PhoneInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  countryCode?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  hintText?: string;
  testID?: string;
}

const PhoneInputComponent = forwardRef<RNTextInput, PhoneInputProps>(
  (
    {
      label,
      value,
      onChangeText,
      countryCode = '+91',
      error,
      disabled,
      placeholder = 'Enter Number',
      hintText,
      testID,
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
    }, []);

    // Format phone number with space (98765 43210)
    const formatPhoneNumber = useCallback((text: string) => {
      const cleaned = text.replace(/\D/g, '');
      if (cleaned.length > 5) {
        return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 10)}`;
      }
      return cleaned;
    }, []);

    const handleChange = useCallback(
      (text: string) => {
        const formatted = formatPhoneNumber(text);
        onChangeText(formatted);
      },
      [onChangeText, formatPhoneNumber]
    );

    const hasError = !!error;
    const hasValue = value.length > 0;

    const getBorderColor = () => {
      if (hasError) return COLORS.inputBorderError;
      if (isFocused) return COLORS.inputBorderFocus;
      return 'transparent'; // Figma REST API: border visible:false in empty state (1:29108)
    };

    // Country code color: #444444 when empty, #dddddd when filled
    const countryCodeColor = hasValue ? COLORS.countryCodeFilled : COLORS.countryCodeEmpty;

    return (
      <View style={styles.container}>
        {/* Label Row - Figma: label + hint/error on same row */}
        <View style={styles.labelRow}>
          <Text style={[styles.label, hasError && styles.labelError]}>
            {label}
          </Text>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : hintText ? (
            <Text style={styles.hintText}>{hintText}</Text>
          ) : null}
        </View>

        {/* Input Container - Figma: I1:29184;48:712 - full border box, gap-16, items-center, py-16, radius-12 */}
        <View style={[styles.inputContainer, { borderColor: getBorderColor() }]}>
          {/* Country Code - wrapped in container to match Figma Dropdown structure */}
          <View style={styles.countryCodeContainer}>
            <RNText style={[styles.countryCode, { color: countryCodeColor }]}>{countryCode}</RNText>
          </View>

          {/* Input Field - Figma: Plus Jakarta Sans Regular 20px, line-height 32px */}
          <RNTextInput
            ref={ref}
            value={value}
            onChangeText={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor={COLORS.placeholder}
            editable={!disabled}
            keyboardType="phone-pad"
            maxLength={11}
            style={[
              styles.input,
              hasValue && styles.inputFilled,
              hasError && hasValue && styles.inputError,
              disabled && styles.inputDisabled,
            ]}
            testID={testID}
          />
        </View>
      </View>
    );
  }
);

PhoneInputComponent.displayName = 'PhoneInput';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.labelGap,
  },
  // Label - Figma REST API: fontWeight 400 (Regular), 12px, line-height 20px, #A9A9A9
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.label,
  },
  labelError: {
    color: COLORS.labelError,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.labelError,
  },
  hintText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',  // Figma: textAlignHorizontal: RIGHT
    color: COLORS.hintText,
  },
  // Input container - Figma: I1:29184;48:712 - full border box, gap-16, items-center, py-16, radius-12
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center', // Figma: items-center
    gap: SPACING.countryCodeGap, // Figma: gap-[16px]
    paddingVertical: SPACING.inputPaddingV, // Figma: py-[16px]
    borderWidth: 1,
    borderColor: COLORS.inputBorder, // Figma: #4D4D4D
    borderRadius: SPACING.inputBorderRadius, // Figma: 12px
    paddingHorizontal: 16, // Figma: implicit from Dropdown x-position within Input box
  },
  // Country code container - matches Figma "Dropdown" container (I90:3005;48:724)
  // Figma: flex items-center, height determined by content (32px line-height)
  countryCodeContainer: {
    height: 32, // Match line-height for consistent alignment
    justifyContent: 'center', // Vertically center the text
  },
  // Country code text - Figma: Plus Jakarta Sans Regular 20px, line-height 32px
  // Color is dynamic: #444444 empty, #dddddd filled (set inline)
  countryCode: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32, // Figma: line-height 32px
    includeFontPadding: false, // Remove Android extra font padding
  },
  // Input field - Figma: Plus Jakarta Sans 20px, line-height 32px
  // Height 32 to match countryCodeContainer for alignment
  input: {
    flex: 1,
    height: 32, // Match countryCodeContainer height
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    color: COLORS.placeholder,
    padding: 0,
    margin: 0,
    includeFontPadding: false, // Remove Android extra font padding
    textAlignVertical: 'center', // Center text vertically within height
  },
  inputFilled: {
    color: COLORS.textFilled,
  },
  inputError: {
    color: COLORS.textError,
  },
  inputDisabled: {
    opacity: 0.5,
  },
});

export const PhoneInput = memo(PhoneInputComponent);
