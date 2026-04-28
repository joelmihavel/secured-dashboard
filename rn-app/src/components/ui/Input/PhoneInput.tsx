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
  Pressable,
  Modal,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
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
  labelGap: 8,        // Gap between label and input
  inputPaddingV: 16,  // Vertical padding in input container - Figma: py-[16px]
  countryCodeGap: 16, // Gap between +91 and input field - Figma: I1:29184;48:712 gap:16
  inputBorderRadius: 12, // Figma: I1:29184;48:712 borderRadius:12
} as const;

// Country data for picker
export interface CountryData {
  code: string;
  flag: string;
  name: string;
  maxDigits: number;
}

export const COUNTRY_LIST: CountryData[] = [
  { code: '+91', flag: '🇮🇳', name: 'India', maxDigits: 10 },
  { code: '+1', flag: '🇺🇸', name: 'United States', maxDigits: 10 },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom', maxDigits: 10 },
  { code: '+971', flag: '🇦🇪', name: 'UAE', maxDigits: 9 },
  { code: '+1', flag: '🇨🇦', name: 'Canada', maxDigits: 10 },
  { code: '+61', flag: '🇦🇺', name: 'Australia', maxDigits: 9 },
  { code: '+65', flag: '🇸🇬', name: 'Singapore', maxDigits: 8 },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia', maxDigits: 10 },
  { code: '+49', flag: '🇩🇪', name: 'Germany', maxDigits: 11 },
  { code: '+33', flag: '🇫🇷', name: 'France', maxDigits: 9 },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia', maxDigits: 9 },
  { code: '+974', flag: '🇶🇦', name: 'Qatar', maxDigits: 8 },
  { code: '+968', flag: '🇴🇲', name: 'Oman', maxDigits: 8 },
  { code: '+977', flag: '🇳🇵', name: 'Nepal', maxDigits: 10 },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka', maxDigits: 9 },
];

export interface PhoneInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  countryCode?: string;
  onCountryChange?: (country: CountryData) => void;
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
      onBlur: onBlurProp,
      countryCode = '+91',
      onCountryChange,
      error,
      disabled,
      placeholder = 'Enter Number',
      hintText,
      testID,
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [pickerVisible, setPickerVisible] = useState(false);

    const selectedCountry = COUNTRY_LIST.find(c => c.code === countryCode && c.name !== 'Canada') ?? COUNTRY_LIST[0];

    const handleFocus = useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      onBlurProp?.();
    }, [onBlurProp]);

    // Format phone number with space (98765 43210 for 10-digit, raw for others)
    const formatPhoneNumber = useCallback((text: string, maxDigits: number) => {
      const cleaned = text.replace(/\D/g, '');
      const clamped = cleaned.slice(0, maxDigits);
      if (maxDigits === 10 && clamped.length > 5) {
        return `${clamped.slice(0, 5)} ${clamped.slice(5)}`;
      }
      return clamped;
    }, []);

    const handleChange = useCallback(
      (text: string) => {
        const formatted = formatPhoneNumber(text, selectedCountry.maxDigits);
        onChangeText(formatted);
      },
      [onChangeText, formatPhoneNumber, selectedCountry.maxDigits]
    );

    const handleCountrySelect = useCallback((country: CountryData) => {
      setPickerVisible(false);
      onCountryChange?.(country);
      // Clear phone number when switching countries to avoid stale formatting
      onChangeText('');
    }, [onCountryChange, onChangeText]);

    const hasError = !!error;
    const hasValue = value.length > 0;

    const getBorderColor = () => {
      if (hasError) return COLORS.borderError;
      if (isFocused) return COLORS.borderFocus;
      return 'transparent'; // Figma REST API: border visible:false in empty state (1:29108)
    };

    // Country code color: #444444 when empty, #dddddd when filled
    const countryCodeColor = hasValue ? COLORS.countryCodeFilled : COLORS.countryCodeEmpty;

    // Max length includes space for formatted display
    const maxInputLength = selectedCountry.maxDigits >= 10
      ? selectedCountry.maxDigits + 1 // space in 5+5 format
      : selectedCountry.maxDigits;

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
          <Pressable
            style={styles.dropdownContainer}
            onPress={() => !disabled && setPickerVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
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
          </Pressable>

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
            maxLength={maxInputLength}
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

        {/* Country Picker Modal */}
        <Modal
          visible={pickerVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setPickerVisible(false)}
        >
          <SafeAreaView style={modalStyles.container}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Select Country</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={modalStyles.closeButton}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRY_LIST}
              keyExtractor={(item) => `${item.code}-${item.name}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    modalStyles.row,
                    item.code === countryCode && item.name === selectedCountry.name && modalStyles.rowSelected,
                  ]}
                  onPress={() => handleCountrySelect(item)}
                >
                  <RNText style={modalStyles.flag}>{item.flag}</RNText>
                  <View style={modalStyles.rowContent}>
                    <Text style={modalStyles.countryName}>{item.name}</Text>
                    <Text style={modalStyles.countryCode}>{item.code}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>
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
    paddingHorizontal: 12,
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
    borderCurve: 'continuous', // iOS corner smoothing (from Figma cornerSmoothing: 0.6)
    paddingHorizontal: 12,
  },
  // Dropdown container - Figma: I1:29184;48:713 - row, center, gap:4
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Figma: itemSpacing 4 between "+91" and chevron
    height: 32, // Match input height for baseline alignment
  },
  flagText: {
    fontSize: 18,
    marginRight: 2,
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
  // NOTE: lineHeight omitted on iOS TextInput — it causes asymmetric vertical offset.
  // height + fontSize + padding:0 lets iOS center text naturally.
  input: {
    flex: 1,
    height: 32,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    color: COLORS.placeholder,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
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

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  title: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 18,
    color: '#DDDDDD',
  },
  closeButton: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    color: '#FF9A6D',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A2A',
  },
  rowSelected: {
    backgroundColor: '#1A1A1A',
  },
  flag: {
    fontSize: 24,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countryName: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    color: '#DDDDDD',
  },
  countryCode: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    color: '#878787',
  },
});

export const PhoneInput = memo(PhoneInputComponent);
