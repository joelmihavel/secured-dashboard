/**
 * Text Input Component
 * Figma: Form input with label
 *
 * EXACT Figma Values (Dark theme):
 * - Label: Plus Jakarta Sans Medium (500), 12px, line-height 20px, #a9a9a9
 * - Label to input gap: 6px
 * - Input text: Plus Jakarta Sans Regular, 20px, line-height 32px
 * - Placeholder color: #444444 (neutral/800)
 * - Filled text color: #dddddd (neutral/200)
 * - Input padding: 16px vertical, 0px horizontal
 * - No visible border by default
 *
 * Light theme variant (for white backgrounds like bottom sheets):
 * - Placeholder: #797979
 * - Filled text: #131313
 * - Border: #CBCBCB
 */

import React, { memo, useState, useCallback, forwardRef } from 'react';
import {
  View,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '../Typography';
import { duration } from '@/src/theme';

// Exact Figma color values - Dark theme
// Verified from Figma extraction 1-29108: Name input node I90:2897;47:5569
const INPUT_COLORS_DARK = {
  label: '#a9a9a9',
  labelError: '#ff8080',
  placeholder: '#222222',          // Figma REST API: #222222 (node I90:2897;47:5569)
  hintText: '#878787',             // Figma hint text color (neutral/600)
  textFilled: '#dddddd',
  textError: '#ff8080',             // Figma: error text color (matches labelError/borderError)
  border: '#4D4D4D',              // Figma: I90:2897;47:5566 borderColor #4D4D4D (full border box)
  borderFocus: '#FF9A6D',         // Figma: #ff9a6d (brand accent) on focus
  borderError: '#ff8080',
} as const;

// Light theme variant (for white backgrounds)
const INPUT_COLORS_LIGHT = {
  label: '#797979',
  labelError: '#ff8080',
  placeholder: '#797979',
  hintText: '#878787',
  textFilled: '#131313',
  textError: '#e5484d',
  border: '#cbcbcb',
  borderFocus: '#FF9A6D',         // Figma: #ff9a6d (brand accent) on focus
  borderError: '#ff8080',
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
  testID?: string;
}

const TextInputComponent = forwardRef<RNTextInput, TextInputProps>(
  ({ label, value, onChangeText, error, disabled, placeholder, variant = 'dark', hintText, testID, ...props }, ref) => {
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
            <Text style={[styles.label, dynamicStyles.label, hasError && dynamicStyles.labelError]}>
              {label}
            </Text>
            {error ? (
              <Text style={[styles.errorText, dynamicStyles.labelError]}>
                {error}
              </Text>
            ) : hintText ? (
              <Text style={[styles.hintText, { color: INPUT_COLORS.hintText }]}>
                {hintText}
              </Text>
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
  // Figma REST API: fontWeight 400 (Regular), 12px, lineHeight:20
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    // Color applied dynamically via dynamicStyles
  },
  labelError: {
    // Color applied dynamically via dynamicStyles
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    // Color applied dynamically via dynamicStyles
  },
  hintText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',  // Figma: textAlignHorizontal: RIGHT
    // Color applied inline
  },
  // Figma: I90:2897;47:5566 - full border box, borderWidth 1, borderRadius 12, borderColor #4D4D4D
  inputContainer: {
    borderWidth: 1,
    borderRadius: 12,    // Figma: borderRadius 12
    paddingHorizontal: 16, // Figma: implicit from content x-position within Input box
    // Border color applied dynamically via getBorderColor()
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
