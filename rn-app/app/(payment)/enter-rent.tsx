/**
 * Enter Rent Amount Screen
 *
 * Allows the user to view/edit the rent amount before proceeding to the
 * payment confirmation screen. Auto-populated from tenancy.monthly_rent,
 * with validation bubbles for over-limit, reduced-rent, and unverified
 * cashback scenarios.
 *
 * Route: /(payment)/enter-rent
 * Next: /(payment)/confirm
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton, BackButton } from '@/src/components';
import { useDashboard } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores/payment';
import { colors } from '@/src/theme';
import { PaymentMethodModal } from '@/src/components/payment/PaymentMethodModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number): string => n.toLocaleString('en-IN');

const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
] as const;

/**
 * Converts an ISO-ish rent_month string ("2026-12-01" or "2026-12")
 * into "DECEMBER 2026" display format.
 */
const formatMonth = (rentMonth: string): string => {
  const match = rentMonth.match(/^(\d{4})-(\d{2})/);
  if (match) {
    const monthIdx = parseInt(match[2], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTHS[monthIdx]} ${match[1]}`;
    }
  }
  return rentMonth;
};

// ── SVG Icons ────────────────────────────────────────────────────────────────

// ── Validation Types ─────────────────────────────────────────────────────────

type ValidationSeverity = 'error' | 'warning' | 'info';

interface ValidationBubble {
  severity: ValidationSeverity;
  message: string;
}

const SEVERITY_COLORS: Record<ValidationSeverity, { bg: string; text: string; border: string }> = {
  error: {
    bg: 'rgba(255, 128, 128, 0.12)',
    text: colors.error.default,
    border: 'rgba(255, 128, 128, 0.25)',
  },
  warning: {
    bg: 'rgba(255, 213, 128, 0.12)',
    text: colors.warning.default,
    border: 'rgba(255, 213, 128, 0.25)',
  },
  info: {
    bg: 'rgba(169, 169, 169, 0.12)',
    text: colors.neutral[500],
    border: 'rgba(169, 169, 169, 0.25)',
  },
};

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function EnterRentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // Data sources
  const { tenancy, upcomingPayment } = useDashboard();
  const setEnteredAmount = usePaymentStore((s) => s.setEnteredAmount);
  const setAmount = usePaymentStore((s) => s.setAmount);
  const setRentMonth = usePaymentStore((s) => s.setRentMonth);
  const setSelectedInstrument = usePaymentStore((s) => s.setSelectedInstrument);
  const [showMethodModal, setShowMethodModal] = useState(false);

  // Derived values
  const monthlyRent = tenancy?.monthly_rent ?? 0;
  const rentMonth = upcomingPayment?.rent_month ?? '';
  const daysUntilDue = upcomingPayment?.days_until_due ?? 0;
  const isOverdue = daysUntilDue < 0;
  const isAllVerified =
    tenancy?.verification_status?.bank_verified &&
    tenancy?.verification_status?.utility_verified &&
    tenancy?.verification_status?.landlord_approved;

  // Input state — stored as raw numeric string (no commas)
  const [rawValue, setRawValue] = useState<string>('');

  // Auto-populate on mount
  useEffect(() => {
    if (monthlyRent > 0 && rawValue === '') {
      setRawValue(String(monthlyRent));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyRent]);

  // Parsed amount
  const parsedAmount = useMemo(() => {
    const n = parseFloat(rawValue);
    return isNaN(n) ? 0 : n;
  }, [rawValue]);

  // Formatted display value (with Indian comma separators)
  const displayValue = useMemo(() => {
    if (rawValue === '' || rawValue === '0') return '';
    // If the user typed a decimal, preserve trailing dot/zeros for editing
    if (rawValue.includes('.')) {
      const [intPart, decPart] = rawValue.split('.');
      const intNum = parseInt(intPart || '0', 10);
      return `${intNum.toLocaleString('en-IN')}.${decPart}`;
    }
    const intNum = parseInt(rawValue, 10);
    if (isNaN(intNum)) return '';
    return intNum.toLocaleString('en-IN');
  }, [rawValue]);

  // Validation bubble
  const validation = useMemo((): ValidationBubble | null => {
    if (parsedAmount <= 0) return null;

    if (parsedAmount > monthlyRent && monthlyRent > 0) {
      return {
        severity: 'error',
        message: 'Rent cannot exceed contract value',
      };
    }

    if (parsedAmount < monthlyRent && monthlyRent > 0) {
      return {
        severity: 'warning',
        message: 'Cashback will apply on reduced rent',
      };
    }

    // Amount equals monthly_rent but not all verified
    if (parsedAmount === monthlyRent && !isAllVerified) {
      return {
        severity: 'info',
        message: 'Cashback will be accumulated',
      };
    }

    return null;
  }, [parsedAmount, monthlyRent, isAllVerified]);

  // Header display values
  const monthDisplay = rentMonth ? formatMonth(rentMonth) : (() => {
    const now = new Date();
    return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  })();

  const dueBadgeText = isOverdue
    ? 'OVERDUE'
    : `DUE IN ${Math.abs(daysUntilDue)} DAYS`;

  // Can continue?
  const canContinue = parsedAmount > 0 && (monthlyRent === 0 || parsedAmount <= monthlyRent);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleChangeText = useCallback((text: string) => {
    // Strip everything except digits and a single decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = cleaned.split('.');
    const sanitized = parts.length > 2
      ? `${parts[0]}.${parts.slice(1).join('')}`
      : cleaned;
    setRawValue(sanitized);
  }, []);

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    // Store the entered amount and metadata
    setEnteredAmount(parsedAmount);
    setAmount(parsedAmount);
    if (rentMonth) {
      setRentMonth(rentMonth);
    }

    setShowMethodModal(true);
  }, [canContinue, parsedAmount, rentMonth, setEnteredAmount, setAmount, setRentMonth]);

  /** Called when user picks a method in the modal */
  const handleMethodSelected = useCallback((methodType: string) => {
    setSelectedInstrument({ type: methodType as any });
    setShowMethodModal(false);
    router.push('/(payment)/confirm' as never);
  }, [setSelectedInstrument, router]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Screen testID="enter-rent-screen" padded={false} safeAreaTop={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* ── Header ────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <BackButton onPress={handleBack} />

            <View style={styles.headerRow}>
              <Text
                variant="bodySm"
                style={styles.monthLabel}
                accessibilityRole="header"
              >
                {monthDisplay}
              </Text>

              <View
                style={[
                  styles.dueBadge,
                  isOverdue && styles.dueBadgeOverdue,
                ]}
              >
                <Text
                  variant="bodySm"
                  style={[
                    styles.dueBadgeText,
                    isOverdue && styles.dueBadgeTextOverdue,
                  ]}
                >
                  {dueBadgeText}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Amount Input ──────────────────────────────────────────── */}
          <View style={styles.inputSection}>
            <View style={styles.amountRow}>
              <Text style={styles.rupeeSymbol}>{'\u20B9'}</Text>
              <TextInput
                ref={inputRef}
                style={styles.amountInput}
                value={displayValue}
                onChangeText={handleChangeText}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.black[400]}
                selectionColor={colors.brand[500]}
                autoFocus
                maxLength={12}
                accessibilityLabel="Rent amount"
                accessibilityHint="Enter the rent amount in rupees"
              />
            </View>

            {/* Subtle helper showing contract value */}
            {monthlyRent > 0 && (
              <Text style={styles.contractHint}>
                Monthly rent: {'\u20B9'}{fmt(monthlyRent)}
              </Text>
            )}
          </View>

          {/* ── Validation Bubble ─────────────────────────────────────── */}
          <View style={styles.validationContainer}>
            {validation && (
              <Animated.View
                entering={FadeIn.duration(250)}
                exiting={FadeOut.duration(200)}
                style={[
                  styles.validationBubble,
                  {
                    backgroundColor: SEVERITY_COLORS[validation.severity].bg,
                    borderColor: SEVERITY_COLORS[validation.severity].border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.validationText,
                    { color: SEVERITY_COLORS[validation.severity].text },
                  ]}
                >
                  {validation.message}
                </Text>
              </Animated.View>
            )}
          </View>

          {/* ── Spacer pushes CTA to bottom ───────────────────────────── */}
          <View style={styles.flex} />

          {/* ── CTA Button ────────────────────────────────────────────── */}
          <View style={[styles.ctaContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <PrimaryButton
              title="Continue"
              onPress={handleContinue}
              disabled={!canContinue}
              testID="enter-rent-continue-button"
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Payment Method Selection Modal */}
      <PaymentMethodModal
        visible={showMethodModal}
        onClose={() => setShowMethodModal(false)}
        tenancyId={tenancy?.id ?? ''}
        rentMonth={rentMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
        onProceed={handleMethodSelected}
        initialView="selector"
      />
    </Screen>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.black[700],
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: colors.neutral[200],
    letterSpacing: 1.2,
  },
  dueBadge: {
    backgroundColor: 'rgba(255, 154, 109, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dueBadgeOverdue: {
    backgroundColor: 'rgba(255, 128, 128, 0.12)',
  },
  dueBadgeText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    color: colors.brand[500],
    letterSpacing: 0.8,
  },
  dueBadgeTextOverdue: {
    color: colors.error.default,
  },

  // Amount Input
  inputSection: {
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
    gap: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rupeeSymbol: {
    fontWeight: '500',
    fontSize: 40,
    color: colors.neutral[500],
    marginRight: 4,
  },
  amountInput: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 48,
    color: colors.neutral[100],
    minWidth: 80,
    textAlign: 'center',
    padding: 0,
  },
  contractHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: colors.neutral[600],
    marginTop: 4,
  },

  // Validation Bubble
  validationContainer: {
    minHeight: 52,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  validationBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  validationText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    textAlign: 'center',
  },

  // CTA
  ctaContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});
