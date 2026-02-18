/**
 * Phone Input Component
 * Figma Node: 1:29184 (Sign Up - Empty state, REST API verified 2026-02-13)
 *
 * Input Container (I1:29184;48:712):
 * - gap: 16px, items-center, py:16px, radius:12px
 * - fill: INVISIBLE (#1A1A1A visible:false) — no background in empty state
 * - stroke: INVISIBLE (#4D4D4D visible:false) — no border in empty state
 * - Border shows on focus (#FF9A6D) and error (#E5484D)
 *
 * Dropdown (I1:29184;48:713):
 * - row, center, gap:4px between "+91" text and chevron icon
 *
 * Country Code "+91" (I1:29184;48:714):
 * - PlusJakartaSans-Regular, 20px, lineHeight 32px
 * - color: #444444 (empty), #dddddd (filled)
 *
 * Chevron Icon (I1:29184;48:715):
 * - 16x16, stroke #444444 (empty) / #dddddd (filled), strokeWidth 1.6
 *
 * Input Text (I1:29184;48:717):
 * - PlusJakartaSans-Regular, 20px, lineHeight 32px, #444444
 *
 * Label (I1:29184;99:1497):
 * - PlusJakartaSans-Regular (400), 12px, lineHeight 20px, #A9A9A9
 */

import React, { memo, useState, useCallback, forwardRef } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text as RNText,
  StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '../Typography';

// Figma REST API verified colors (node 1:29184, 2026-02-13)
const COLORS = {
  label: '#A9A9A9',
  labelError: '#E5484D',
  hintText: '#878787',
  countryCodeEmpty: '#444444',
  countryCodeFilled: '#DDDDDD',
  placeholder: '#444444',
  textFilled: '#DDDDDD',
  textError: '#E5484D',
  borderFocus: '#FF9A6D',
  borderError: '#E5484D',
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
      if (hasError) return COLORS.borderError;
      if (isFocused) return COLORS.borderFocus;
      return 'transparent'; // Figma REST API: border visible:false in empty state (1:29108)
    };

    // Country code color: #444444 when empty, #dddddd when filled
    const countryCodeColor = hasValue ? COLORS.countryCodeFilled : COLORS.countryCodeEmpty;

    return (
      <View style={styles.container}>
        {/* Label Row - Figma: label + hint/error on same row */}
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
          </Text>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : hintText ? (
            <Text style={styles.hintText}>{hintText}</Text>
          ) : null}
        </View>

        {/* Input Container - Figma: I1:29184;48:712 - NO fill, NO stroke in empty state */}
        <View style={[styles.inputContainer, { borderColor: getBorderColor() }]}>
          {/* Dropdown - Figma: I1:29184;48:713 - row, center, space-between, gap:4, w:48, h:32 */}
          <View style={styles.dropdownContainer}>
            <RNText style={[styles.countryCode, { color: countryCodeColor }]}>{countryCode}</RNText>
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Path
                d="M4 6L8 10L12 6"
                stroke={countryCodeColor}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
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
            accessibilityLabel={label}
            accessibilityState={{ disabled: !!disabled }}
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
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right' as const,
    color: COLORS.textError,   // Figma: #E5484D — error hint text (node I90:3059;99:1529)
  },
  hintText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',  // Figma: textAlignHorizontal: RIGHT
    color: COLORS.hintText,
  },
  // Input container - Figma: I1:29184;48:712 - fill:invisible, stroke:invisible in empty state
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.countryCodeGap, // Figma: gap-[16px]
    paddingVertical: SPACING.inputPaddingV, // Figma: py-[16px]
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: SPACING.inputBorderRadius, // Figma: 12px
    paddingHorizontal: 16,
  },
  // Dropdown container - Figma: I1:29184;48:713 - row, center, gap:4
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Figma: itemSpacing 4 between "+91" and chevron
  },
  // Country code text - Figma: I1:29184;48:714 - PlusJakartaSans-Regular 20px, lineHeight 32px
  countryCode: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    includeFontPadding: false,
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
