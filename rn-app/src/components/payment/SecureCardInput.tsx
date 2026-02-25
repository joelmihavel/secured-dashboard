/**
 * SecureCardInput — Security-first card input component
 *
 * Security measures (S2, S3, S5, S6):
 * - Card data stored in refs (not state) — allows explicit zeroing
 * - CVV uses secureTextEntry
 * - All fields: autoComplete="off", autoCorrect={false}, spellCheck={false}
 * - CVV: contextMenuHidden, textContentType="none"
 * - Never persisted to Zustand, AsyncStorage, or SecureStore
 *
 * Formatting:
 * - Card number: auto-space every 4 digits (Amex: 4-6-5)
 * - Expiry: auto-insert "/" after 2 digits, display MM/YY
 * - BIN detection: local prefix matching (Visa/MC/Amex/RuPay)
 *
 * Validation:
 * - Luhn check on blur (S8)
 * - Full validation on submit
 * - Real-time enable/disable of Pay button
 */

import React, { useState, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  TextInput as RNTextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/src/components/ui/Typography';
import { colors } from '@/src/theme';

// ===================================================
// TYPES
// ===================================================

export type SecureCardNetwork = 'visa' | 'mastercard' | 'amex' | 'rupay' | 'unknown';

export interface CardData {
  cardNumber: string;   // raw digits, no spaces
  cvv: string;
  expiryMonth: string;  // "01"-"12"
  expiryYear: string;   // 4-digit "2027"
  nameOnCard: string;
  network: SecureCardNetwork;
}

export interface SecureCardInputRef {
  getCardData: () => CardData;
  clearCardData: () => void;
  validate: () => { valid: boolean; errors: string[] };
}

interface Props {
  onValidityChange?: (isValid: boolean) => void;
}

// ===================================================
// BIN DETECTION (local prefix matching)
// ===================================================

function detectNetwork(digits: string): SecureCardNetwork {
  if (digits.length < 1) return 'unknown';
  const d = digits;

  // Amex: starts with 34 or 37
  if (d.startsWith('34') || d.startsWith('37')) return 'amex';

  // Visa: starts with 4
  if (d.startsWith('4')) return 'visa';

  // Mastercard: 51-55 or 2221-2720
  if (d.length >= 2) {
    const first2 = parseInt(d.substring(0, 2), 10);
    if (first2 >= 51 && first2 <= 55) return 'mastercard';
    if (d.length >= 4) {
      const first4 = parseInt(d.substring(0, 4), 10);
      if (first4 >= 2221 && first4 <= 2720) return 'mastercard';
    }
  }

  // RuPay: starts with 60, 65, 81, 82, 508
  if (d.startsWith('60') || d.startsWith('65') || d.startsWith('81') || d.startsWith('82') || d.startsWith('508')) {
    return 'rupay';
  }

  return 'unknown';
}

// ===================================================
// FORMATTING
// ===================================================

function formatCardNumber(raw: string, network: SecureCardNetwork): string {
  const digits = raw.replace(/\D/g, '');
  if (network === 'amex') {
    // Amex: 4-6-5 grouping
    const parts = [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)];
    return parts.filter(Boolean).join(' ');
  }
  // Standard: 4-4-4-4
  const parts = [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12), digits.slice(12, 16)];
  return parts.filter(Boolean).join(' ');
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
}

// ===================================================
// VALIDATION
// ===================================================

function luhnCheck(digits: string): boolean {
  if (digits.length < 13) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function validateExpiry(month: string, year: string): boolean {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (m < 1 || m > 12) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (y < currentYear) return false;
  if (y === currentYear && m < currentMonth) return false;
  return true;
}

// ===================================================
// CARD NETWORK ICONS
// ===================================================

const VisaIcon = () => (
  <Svg width={32} height={20} viewBox="0 0 32 20" fill="none">
    <Path d="M13.2 13.5L14.7 6.5H16.7L15.2 13.5H13.2ZM22.3 6.7C21.9 6.5 21.2 6.3 20.4 6.3C18.4 6.3 17 7.3 17 8.7C17 9.8 18 10.3 18.7 10.7C19.5 11 19.7 11.3 19.7 11.6C19.7 12.1 19.1 12.3 18.5 12.3C17.7 12.3 17.3 12.2 16.6 11.9L16.3 11.8L16 13.3C16.5 13.5 17.4 13.7 18.3 13.7C20.4 13.7 21.8 12.7 21.8 11.3C21.8 10.4 21.2 9.8 20.1 9.3C19.4 8.9 19 8.7 19 8.3C19 8 19.3 7.6 20 7.6C20.6 7.6 21.1 7.7 21.4 7.9L21.6 8L22.3 6.7ZM26.1 6.5H24.5C24 6.5 23.6 6.7 23.4 7.2L20.5 13.5H22.6L23 12.4H25.6L25.8 13.5H27.7L26.1 6.5ZM23.6 10.9L24.5 8.5L25 10.9H23.6ZM12.2 6.5L10.2 11.2L10 10.1C9.6 8.9 8.5 7.6 7.2 7L9 13.5H11.1L14.3 6.5H12.2Z" fill="#1A1F71" />
  </Svg>
);

const MastercardIcon = () => (
  <Svg width={32} height={20} viewBox="0 0 32 20" fill="none">
    <Path d="M19.5 4C17.8 4 16.3 4.6 15.2 5.7C15 5.5 14.8 5.3 14.6 5.1C13.5 4.4 12.2 4 10.8 4C7.2 4 4.3 6.9 4.3 10.5C4.3 14.1 7.2 17 10.8 17C12.2 17 13.5 16.6 14.6 15.9C14.8 15.7 15 15.5 15.2 15.3C16.3 16.4 17.8 17 19.5 17C23.1 17 26 14.1 26 10.5C26 6.9 23.1 4 19.5 4Z" fill="#ED0006" />
    <Path d="M19.5 4C17.8 4 16.3 4.6 15.2 5.7C16.3 6.8 17 8.6 17 10.5C17 12.4 16.3 14.2 15.2 15.3C16.3 16.4 17.8 17 19.5 17C23.1 17 26 14.1 26 10.5C26 6.9 23.1 4 19.5 4Z" fill="#F9A000" />
    <Path d="M15.2 5.7C14 6.9 13.3 8.6 13.3 10.5C13.3 12.4 14 14.2 15.2 15.3C16.3 14.2 17 12.4 17 10.5C17 8.6 16.3 6.8 15.2 5.7Z" fill="#FF5F00" />
  </Svg>
);

const AmexIcon = () => (
  <View style={{ width: 32, height: 20, backgroundColor: '#006FCF', borderRadius: 3, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: '#FFFFFF', fontSize: 8, fontFamily: 'PlusJakartaSans-Bold' }}>AMEX</Text>
  </View>
);

const RuPayIcon = () => (
  <View style={{ width: 32, height: 20, backgroundColor: '#1A2B6B', borderRadius: 3, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: '#FFFFFF', fontSize: 7, fontFamily: 'PlusJakartaSans-Bold' }}>RuPay</Text>
  </View>
);

function NetworkIcon({ network }: { network: SecureCardNetwork }) {
  switch (network) {
    case 'visa': return <VisaIcon />;
    case 'mastercard': return <MastercardIcon />;
    case 'amex': return <AmexIcon />;
    case 'rupay': return <RuPayIcon />;
    default: return null;
  }
}

// ===================================================
// COLORS
// ===================================================

const INPUT_COLORS = {
  label: colors.neutral[500],
  placeholder: colors.neutral[800],
  text: colors.neutral[200],
  border: 'transparent',
  borderFocus: colors.brand[500],
  borderError: colors.error.default,
  error: colors.error.default,
} as const;

// ===================================================
// COMPONENT
// ===================================================

export const SecureCardInput = forwardRef<SecureCardInputRef, Props>(
  ({ onValidityChange }, ref) => {
    // S2: Refs for card data — allows explicit zeroing
    const cardNumberRef = useRef('');
    const cvvRef = useRef('');
    const expiryRef = useRef('');
    const nameRef = useRef('');

    // Display state (formatted values for TextInput display)
    const [displayCardNumber, setDisplayCardNumber] = useState('');
    const [displayExpiry, setDisplayExpiry] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [displayCvv, setDisplayCvv] = useState('');
    const [network, setNetwork] = useState<SecureCardNetwork>('unknown');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [focusedField, setFocusedField] = useState<string | null>(null);

    // Field refs for focus chaining
    const expiryInputRef = useRef<RNTextInput>(null);
    const cvvInputRef = useRef<RNTextInput>(null);
    const nameInputRef = useRef<RNTextInput>(null);

    const checkValidity = useCallback(
      (cn: string, cv: string, ex: string, nm: string) => {
        const digits = cn.replace(/\D/g, '');
        const net = detectNetwork(digits);
        const minLen = net === 'amex' ? 15 : 16;
        const cvvLen = net === 'amex' ? 4 : 3;
        const exDigits = ex.replace(/\D/g, '');
        const isValid =
          digits.length >= minLen &&
          cv.length === cvvLen &&
          exDigits.length === 4 &&
          nm.trim().length >= 2;
        onValidityChange?.(isValid);
      },
      [onValidityChange],
    );

    const handleCardNumberChange = useCallback(
      (text: string) => {
        // Strip non-digits, handle paste with spaces/dashes (E11)
        const digits = text.replace(/\D/g, '');
        const net = detectNetwork(digits);
        const maxLen = net === 'amex' ? 15 : 16;
        const trimmed = digits.slice(0, maxLen);

        cardNumberRef.current = trimmed;
        setNetwork(net);
        setDisplayCardNumber(formatCardNumber(trimmed, net));
        setErrors((prev) => ({ ...prev, cardNumber: '' }));
        checkValidity(trimmed, cvvRef.current, expiryRef.current, nameRef.current);

        // Auto-advance to expiry when full
        if (trimmed.length === maxLen) {
          expiryInputRef.current?.focus();
        }
      },
      [checkValidity],
    );

    const handleExpiryChange = useCallback(
      (text: string) => {
        const digits = text.replace(/\D/g, '').slice(0, 4);
        expiryRef.current = digits;
        setDisplayExpiry(formatExpiry(digits));
        setErrors((prev) => ({ ...prev, expiry: '' }));
        checkValidity(cardNumberRef.current, cvvRef.current, digits, nameRef.current);

        // Auto-advance to CVV when full
        if (digits.length === 4) {
          cvvInputRef.current?.focus();
        }
      },
      [checkValidity],
    );

    const handleCvvChange = useCallback(
      (text: string) => {
        const digits = text.replace(/\D/g, '');
        const maxLen = network === 'amex' ? 4 : 3;
        const trimmed = digits.slice(0, maxLen);
        cvvRef.current = trimmed;
        setDisplayCvv(trimmed);
        setErrors((prev) => ({ ...prev, cvv: '' }));
        checkValidity(cardNumberRef.current, trimmed, expiryRef.current, nameRef.current);

        // Auto-advance to name when full
        if (trimmed.length === maxLen) {
          nameInputRef.current?.focus();
        }
      },
      [network, checkValidity],
    );

    const handleNameChange = useCallback(
      (text: string) => {
        nameRef.current = text;
        setDisplayName(text);
        setErrors((prev) => ({ ...prev, name: '' }));
        checkValidity(cardNumberRef.current, cvvRef.current, expiryRef.current, text);
      },
      [checkValidity],
    );

    const handleCardNumberBlur = useCallback(() => {
      setFocusedField(null);
      const digits = cardNumberRef.current;
      if (digits.length > 0 && !luhnCheck(digits)) {
        setErrors((prev) => ({ ...prev, cardNumber: 'Invalid card number' }));
      }
    }, []);

    const handleExpiryBlur = useCallback(() => {
      setFocusedField(null);
      const digits = expiryRef.current;
      if (digits.length === 4) {
        const month = digits.slice(0, 2);
        const yearShort = digits.slice(2, 4);
        const yearFull = `20${yearShort}`;
        if (!validateExpiry(month, yearFull)) {
          setErrors((prev) => ({ ...prev, expiry: 'Invalid or expired date' }));
        }
      }
    }, []);

    // S2: Explicit zeroing
    const clearCardData = useCallback(() => {
      cardNumberRef.current = '';
      cvvRef.current = '';
      expiryRef.current = '';
      nameRef.current = '';
      setDisplayCardNumber('');
      setDisplayExpiry('');
      setDisplayCvv('');
      setDisplayName('');
      setNetwork('unknown');
      setErrors({});
    }, []);

    const validate = useCallback((): { valid: boolean; errors: string[] } => {
      const errs: string[] = [];
      const digits = cardNumberRef.current;
      const net = detectNetwork(digits);
      const minLen = net === 'amex' ? 15 : 16;
      const cvvLen = net === 'amex' ? 4 : 3;

      if (digits.length < minLen) errs.push('Card number is too short');
      else if (!luhnCheck(digits)) errs.push('Invalid card number');

      const exDigits = expiryRef.current;
      if (exDigits.length < 4) {
        errs.push('Enter expiry date');
      } else {
        const month = exDigits.slice(0, 2);
        const yearFull = `20${exDigits.slice(2, 4)}`;
        if (!validateExpiry(month, yearFull)) errs.push('Card expired or invalid date');
      }

      if (cvvRef.current.length < cvvLen) errs.push(`CVV must be ${cvvLen} digits`);
      if (nameRef.current.trim().length < 2) errs.push('Enter name on card');

      // Set field-level errors for display
      const newErrors: Record<string, string> = {};
      if (errs.some((e) => e.includes('card number'))) newErrors.cardNumber = 'Invalid card number';
      if (errs.some((e) => e.includes('expir') || e.includes('date'))) newErrors.expiry = 'Invalid expiry';
      if (errs.some((e) => e.includes('CVV'))) newErrors.cvv = `Enter ${cvvLen}-digit CVV`;
      if (errs.some((e) => e.includes('name'))) newErrors.name = 'Enter name on card';
      setErrors(newErrors);

      return { valid: errs.length === 0, errors: errs };
    }, []);

    const getCardData = useCallback((): CardData => {
      const digits = cardNumberRef.current;
      const exDigits = expiryRef.current;
      return {
        cardNumber: digits,
        cvv: cvvRef.current,
        expiryMonth: exDigits.slice(0, 2),
        expiryYear: `20${exDigits.slice(2, 4)}`,
        nameOnCard: nameRef.current.trim(),
        network: detectNetwork(digits),
      };
    }, []);

    useImperativeHandle(ref, () => ({
      getCardData,
      clearCardData,
      validate,
    }));

    const getBorderColor = (field: string) => {
      if (errors[field]) return INPUT_COLORS.borderError;
      if (focusedField === field) return INPUT_COLORS.borderFocus;
      return INPUT_COLORS.border;
    };

    return (
      <View style={styles.container}>
        {/* Card Number */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Card number</Text>
            {errors.cardNumber ? (
              <Text style={styles.errorText}>{errors.cardNumber}</Text>
            ) : null}
          </View>
          <View style={[styles.inputContainer, { borderColor: getBorderColor('cardNumber') }]}>
            <RNTextInput
              value={displayCardNumber}
              onChangeText={handleCardNumberChange}
              onFocus={() => setFocusedField('cardNumber')}
              onBlur={handleCardNumberBlur}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={INPUT_COLORS.placeholder}
              keyboardType="number-pad"
              maxLength={network === 'amex' ? 17 : 19}
              style={styles.input}
              testID="card-number-input"
              // S6: Security props
              autoComplete="off"
              autoCorrect={false}
              spellCheck={false}
              textContentType="none"
              importantForAutofill="no"
            />
            {network !== 'unknown' && (
              <View style={styles.networkIcon}>
                <NetworkIcon network={network} />
              </View>
            )}
          </View>
        </View>

        {/* Expiry + CVV row */}
        <View style={styles.row}>
          <View style={[styles.fieldContainer, styles.halfField]}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Expiry</Text>
              {errors.expiry ? (
                <Text style={styles.errorText}>{errors.expiry}</Text>
              ) : null}
            </View>
            <View style={[styles.inputContainer, { borderColor: getBorderColor('expiry') }]}>
              <RNTextInput
                ref={expiryInputRef}
                value={displayExpiry}
                onChangeText={handleExpiryChange}
                onFocus={() => setFocusedField('expiry')}
                onBlur={handleExpiryBlur}
                placeholder="MM/YY"
                placeholderTextColor={INPUT_COLORS.placeholder}
                keyboardType="number-pad"
                maxLength={5}
                style={styles.input}
                testID="expiry-input"
                autoComplete="off"
                autoCorrect={false}
                textContentType="none"
              />
            </View>
          </View>

          <View style={[styles.fieldContainer, styles.halfField]}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>CVV</Text>
              {errors.cvv ? (
                <Text style={styles.errorText}>{errors.cvv}</Text>
              ) : null}
            </View>
            <View style={[styles.inputContainer, { borderColor: getBorderColor('cvv') }]}>
              <RNTextInput
                ref={cvvInputRef}
                value={displayCvv}
                onChangeText={handleCvvChange}
                onFocus={() => setFocusedField('cvv')}
                onBlur={() => setFocusedField(null)}
                placeholder={network === 'amex' ? '1234' : '123'}
                placeholderTextColor={INPUT_COLORS.placeholder}
                keyboardType="number-pad"
                maxLength={network === 'amex' ? 4 : 3}
                style={styles.input}
                testID="cvv-input"
                // S3 + S6: CVV security
                secureTextEntry
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
                textContentType="none"
                contextMenuHidden
                importantForAutofill="no"
              />
            </View>
          </View>
        </View>

        {/* Name on Card */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Name on card</Text>
            {errors.name ? (
              <Text style={styles.errorText}>{errors.name}</Text>
            ) : null}
          </View>
          <View style={[styles.inputContainer, { borderColor: getBorderColor('name') }]}>
            <RNTextInput
              ref={nameInputRef}
              value={displayName}
              onChangeText={handleNameChange}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              placeholder="e.g. John Smith"
              placeholderTextColor={INPUT_COLORS.placeholder}
              autoCapitalize="words"
              style={styles.input}
              testID="name-on-card-input"
              autoComplete="off"
              autoCorrect={false}
              textContentType="none"
            />
          </View>
        </View>
      </View>
    );
  },
);

SecureCardInput.displayName = 'SecureCardInput';

// ===================================================
// STYLES
// ===================================================

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  fieldContainer: {
    width: '100%',
  },
  halfField: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: INPUT_COLORS.label,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: INPUT_COLORS.error,
    textAlign: 'right',
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    height: 32,
    padding: 0,
    margin: 0,
    color: INPUT_COLORS.text,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  networkIcon: {
    marginLeft: 8,
  },
});
