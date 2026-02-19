/**
 * Text Input Component
 * Figma: Form input with label
 *
 * EXACT Figma Values (Dark theme) — verified from blueprint data:
 * - Label: Plus Jakarta Sans Regular (400), 12px, line-height 20px, #A9A9A9
 * - Label to input gap: 6px
 * - Input text: Plus Jakarta Sans Regular (400), 20px, line-height 32px
 * - Placeholder color: #444444 (neutral/800) — confirmed from Figma text node fills
 * - Filled text color: #DDDDDD (neutral/200)
 * - Input padding: 16px vertical, 0px horizontal
 * - No visible border by default (Figma: stroke visible:false in empty state)
 * - Focus border: #FF9A6D (brand accent)
 * - Error border: #E5484D
 *
 * Light theme variant (for white backgrounds like bottom sheets):
 * - Placeholder: #797979
 * - Filled text: #131313
 * - Border: #CBCBCB
 *
 * NOTE: #222222 is the INPUT CONTAINER background fill (invisible), NOT the placeholder text color.
 * All screens use this same component — do NOT rebuild inputs per screen.
 */

import React, { memo, useState, useCallback, forwardRef } from 'react';
import {
  View,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Text } from '../Typography';

// Exact Figma color values - Dark theme
// Verified from Figma blueprints: text node fills confirm #444444 for placeholder text.
// #222222 was the CONTAINER background fill (visible:false), NOT the text color.
const INPUT_COLORS_DARK = {
  label: '#A9A9A9',                // Figma: neutral/500
  labelError: '#E5484D',
  placeholder: '#444444',          // Figma blueprint: text fill #444444 (neutral/800)
  hintText: '#878787',             // Figma: hint text color (neutral/600)
  textFilled: '#DDDDDD',           // Figma: neutral/200
  textError: '#E5484D',            // Figma: error text color
  border: '#4D4D4D',              // Figma: stroke (visible:false in empty state, used on focus)
  borderFocus: '#FF9A6D',         // Figma: brand accent on focus
  borderError: '#E5484D',
} as const;

// Light theme variant (for white backgrounds)
const INPUT_COLORS_LIGHT = {
  label: '#797979',
  labelError: '#E5484D',
  placeholder: '#797979',
  hintText: '#878787',
  textFilled: '#131313',
  textError: '#e5484d',
  border: '#cbcbcb',
  borderFocus: '#FF9A6D',         // Figma: #ff9a6d (brand accent) on focus
  borderError: '#E5484D',
} as const;

// Exact Figma spacing values
const INPUT_SPACING = {
  labelInputGap: 6,
  inputPaddingVertical: 16,
} as const;

export interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
  variant?: 'dark' | 'light';
  hintText?: string;
  onHintPress?: () => void;
  testID?: string;
}

const TextInputComponent = forwardRef<RNTextInput, TextInputProps>(
  ({ label, value, onChangeText, error, disabled, placeholder, variant = 'dark', hintText, onHintPress, testID, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const INPUT_COLORS = variant === 'light' ? INPUT_COLORS_LIGHT : INPUT_COLORS_DARK;

    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
    }, []);

    const hasError = !!error;
    const hasValue = value.length > 0;

    // Determine border color based on state
    // Figma REST API: border visible:false in empty state (1:29108)
    const getBorderColor = () => {
      if (hasError) return INPUT_COLORS.borderError;
      if (isFocused) return INPUT_COLORS.borderFocus;
      return 'transparent';
    };

    // Dynamic styles based on variant
    const dynamicStyles = {
      label: { color: INPUT_COLORS.label },
      labelError: { color: INPUT_COLORS.labelError },
      input: { color: INPUT_COLORS.placeholder },
      inputFilled: { color: INPUT_COLORS.textFilled },
      inputError: { color: INPUT_COLORS.textError },
    };

    return (
      <View style={styles.container}>
        {label ? (
          <View style={styles.labelRow}>
            <Text style={[styles.label, dynamicStyles.label]}>
              {label}
            </Text>
            {error ? (
              <Text style={[styles.errorText, dynamicStyles.inputError]}>
                {error}
              </Text>
            ) : hintText ? (
              onHintPress ? (
                <TouchableOpacity
                  onPress={onHintPress}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${hintText} for ${label}`}
                >
                  <Text style={[styles.hintText, { color: INPUT_COLORS.hintText }]}>
                    {hintText}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.hintText, { color: INPUT_COLORS.hintText }]}>
                  {hintText}
                </Text>
              )
            ) : null}
          </View>
        ) : null}

        <View style={[styles.inputContainer, { borderColor: getBorderColor() }]}>
          <RNTextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor={INPUT_COLORS.placeholder}
            editable={!disabled}
            accessibilityLabel={label}
            accessibilityState={{ disabled: !!disabled }}
            style={[
              styles.input,
              dynamicStyles.input,
              hasValue && dynamicStyles.inputFilled,
              hasError && hasValue && dynamicStyles.inputError,
              disabled && styles.inputDisabled,
            ]}
            testID={testID}
            {...props}
          />
        </View>
      </View>
    );
  }
);

TextInputComponent.displayName = 'TextInput';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: INPUT_SPACING.labelInputGap,
  },
  // Figma REST API: fontWeight 500 (Medium), 12px, lineHeight:20
  // Verified from blueprint: "Account holder name" label uses PlusJakartaSans-Medium
  label: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    // Color applied dynamically via dynamicStyles
  },
  labelError: {
    // Color applied dynamically via dynamicStyles
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,          // Figma: error hint text 14px (node I90:3059;99:1529)
    lineHeight: 20,
    textAlign: 'right' as const,  // Figma: textAlignHorizontal: RIGHT
    // Color applied dynamically via dynamicStyles.inputError (#E5484D)
  },
  hintText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',  // Figma: textAlignHorizontal: RIGHT
    // Color applied inline
  },
  // Figma: I90:2897;47:5566 - fill:invisible, stroke:invisible in empty state
  // paddingHorizontal: 0 per Figma (label and input text left-aligned)
  inputContainer: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
  },
  input: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    paddingVertical: INPUT_SPACING.inputPaddingVertical,
    paddingHorizontal: 0,
    // Color applied dynamically via dynamicStyles
  },
  inputDisabled: {
    opacity: 0.5,
  },
});

export const TextInput = memo(TextInputComponent);
