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
 * Label:
 * - font: Plus Jakarta Sans Medium
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
const COLORS = {
  label: colors.neutral[500],          // #a9a9a9
  labelError: '#ff8080',
  hintText: '#878787',                 // Figma hint text color (neutral/600)
  countryCode: colors.neutral[200],    // #dddddd - SAME as filled text per Figma
  placeholder: '#222222',              // Updated per parity analysis (was #444444)
  textFilled: colors.neutral[200],     // #dddddd
  textError: colors.brand[500],        // #ff9a6d
  border: '#2a2a2a',
  borderFocus: colors.brand[500],      // #ff9a6d
  borderError: '#ff8080',
} as const;

// Exact Figma spacing values
const SPACING = {
  labelGap: 6,        // Gap between label and input
  inputPadding: 16,   // Vertical padding in input container
  countryCodeGap: 16, // Gap between +91 and input field
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
      if (hasError) return COLORS.borderError;
      if (isFocused) return COLORS.borderFocus;
      return COLORS.border;
    };

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

        {/* Input Container - Figma: gap-16 items-center py-16 */}
        <View style={[styles.inputContainer, { borderBottomColor: getBorderColor() }]}>
          {/* Country Code - wrapped in container to match Figma Dropdown structure */}
          <View style={styles.countryCodeContainer}>
            <RNText style={styles.countryCode}>{countryCode}</RNText>
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
  // Label - Figma: Plus Jakarta Sans Medium, 12px, line-height 20px, #a9a9a9
  label: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.label,
  },
  labelError: {
    color: COLORS.labelError,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Medium',
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
  // Input container - Figma: gap-16 items-center py-16
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center', // Figma: items-center
    gap: SPACING.countryCodeGap, // Figma: gap-[16px]
    paddingVertical: SPACING.inputPadding, // Figma: py-[16px]
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  // Country code container - matches Figma "Dropdown" container (I90:3005;48:724)
  // Figma: flex items-center, height determined by content (32px line-height)
  countryCodeContainer: {
    height: 32, // Match line-height for consistent alignment
    justifyContent: 'center', // Vertically center the text
  },
  // Country code text - Figma: Plus Jakarta Sans Regular 20px, line-height 32px, #dddddd
  countryCode: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    color: COLORS.countryCode, // #dddddd
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
