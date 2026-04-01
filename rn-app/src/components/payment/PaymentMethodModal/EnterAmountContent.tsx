import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Keyboard,
  ScrollView,
} from 'react-native';
import Animated, { FadeIn, FadeOut, BounceIn } from 'react-native-reanimated';

import { Text } from '@/src/components/ui/Typography/Text';
import { PrimaryButton } from '@/src/components/ui/Button/PrimaryButton';
import { useDashboard } from '@/src/hooks';
import { colors } from '@/src/theme';

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
] as const;

/** "2026-03-01" → "MARCH 2026" */
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

// ── Validation ───────────────────────────────────────────────────────────────

type ValidationSeverity = 'error' | 'warning' | 'info';

interface ValidationBubble {
  severity: ValidationSeverity;
  message: string;
}

const SEVERITY_COLORS: Record<ValidationSeverity, { text: string }> = {
  error: { text: colors.error.default },
  warning: { text: colors.brand[500] },
  info: { text: colors.brand[500] },
};

// ── Component ────────────────────────────────────────────────────────────────

interface EnterAmountContentProps {
  initialAmount?: number;
  onProceed: (amount: number) => void;
  onBack: () => void;
}

export function EnterAmountContent({
  initialAmount = 0,
  onProceed,
  onBack,
}: EnterAmountContentProps) {
  const inputRef = useRef<TextInput>(null);
  const [rawValue, setRawValue] = useState<string>('');

  const { tenancy, upcomingPayment } = useDashboard();

  const monthlyRent = tenancy?.monthly_rent ?? 0;
  const daysUntilDue = upcomingPayment?.days_until_due ?? 0;
  const alreadyPaid = upcomingPayment?.already_paid ?? false;
  const isOverdue = daysUntilDue < 0 && !alreadyPaid;
  const rentMonth = upcomingPayment?.rent_month ?? '';
  // Auto-populate on mount
  useEffect(() => {
    const rent = initialAmount > 0 ? initialAmount : monthlyRent;
    if (rent > 0 && rawValue === '') {
      setRawValue(String(rent));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyRent, initialAmount]);

  // Auto-focus — trigger immediately on mount so the keyboard animates in
  // parallel with the bottom sheet spring. The BottomSheet's keyboardOffset
  // handles layout adjustment, so no delay is needed.
  useEffect(() => {
    // Single rAF ensures the TextInput is laid out before focusing
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Parsed amount (whole rupees only)
  const parsedAmount = useMemo(() => {
    const n = parseInt(rawValue, 10);
    return isNaN(n) ? 0 : n;
  }, [rawValue]);

  // Display value with Indian number formatting
  const displayValue = useMemo(() => {
    if (rawValue === '' || rawValue === '0') return '';
    const intNum = parseInt(rawValue, 10);
    if (isNaN(intNum)) return '';
    return intNum.toLocaleString('en-IN');
  }, [rawValue]);

  // Header display
  const monthDisplay = rentMonth
    ? `${formatMonth(rentMonth)} RENT`
    : (() => {
        const now = new Date();
        return `${MONTHS[now.getMonth()]} ${now.getFullYear()} RENT`;
      })();

  const dueBadgeText = alreadyPaid
    ? 'RENT PAID'
    : isOverdue
      ? 'OVERDUE'
      : daysUntilDue === 0
        ? 'DUE TODAY'
        : `DUE IN ${Math.abs(daysUntilDue)} DAYS`;

  // Validation
  const validation = useMemo((): ValidationBubble | null => {
    if (alreadyPaid) {
      return { severity: 'error', message: 'Rent for this month is already paid' };
    }
    if (parsedAmount <= 0) return null;

    if (parsedAmount > MAX_AMOUNT) {
      return { severity: 'error', message: `Amount cannot exceed ₹${MAX_AMOUNT.toLocaleString('en-IN')}` };
    }
    if (parsedAmount < monthlyRent && monthlyRent > 0) {
      return { severity: 'warning', message: 'Cashback will apply on reduced rent' };
    }
    if (parsedAmount === monthlyRent) {
      return { severity: 'info', message: '1% cashback will be applied' };
    }
    return null;
  }, [alreadyPaid, parsedAmount, monthlyRent]);

  // Can proceed? Block if already paid or amount exceeds gateway limits
  const MAX_AMOUNT = 10_00_000; // Rs 10 lakh — PayU gateway limit
  const canContinue = parsedAmount > 0 && !alreadyPaid && parsedAmount <= MAX_AMOUNT;

  // Default pill (when no validation message)
  const showDefaultPill = !validation && parsedAmount > 0;

  // Handlers
  const handleChangeText = useCallback((text: string) => {
    // Only allow digits — no decimals (rent is whole rupees)
    const cleaned = text.replace(/[^0-9]/g, '');
    setRawValue(cleaned);
  }, []);

  const handleProceed = useCallback(() => {
    if (!canContinue) return;
    Keyboard.dismiss();
    onProceed(parsedAmount);
  }, [canContinue, parsedAmount, onProceed]);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.container}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={styles.headerLabelLeft}>{monthDisplay}</Text>
          <Text style={[styles.headerLabelRight, isOverdue && styles.headerLabelOverdue, alreadyPaid && styles.headerLabelPaid]}>
            {dueBadgeText}
          </Text>
        </View>

        {/* Amount Display */}
        <View style={styles.amountContainer}>
          <Text style={styles.currencySymbol}>{'\u20B9'}  </Text>
          <TextInput
            ref={inputRef}
            style={[
              styles.amountInput,
              validation?.severity === 'error' && styles.amountInputError,
            ]}
            value={displayValue}
            onChangeText={handleChangeText}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#4D4D4D"
            selectionColor={colors.brand[500]}
            maxLength={12}
            accessibilityLabel="Rent amount"
          />
          <Text style={styles.decimalSuffix}>.00</Text>
        </View>

        {/* Validation / Cashback Pill */}
        <View style={styles.pillContainer}>
          {validation ? (
            <Animated.View
              entering={FadeIn.springify().damping(14).stiffness(120)}
              exiting={FadeOut.duration(200)}
              style={styles.pill}
            >
              <Text style={[styles.pillText, { color: SEVERITY_COLORS[validation.severity].text }]}>
                {validation.message}
              </Text>
            </Animated.View>
          ) : showDefaultPill ? (
            <Animated.View
              entering={FadeIn.springify().damping(14).stiffness(120)}
              exiting={FadeOut.duration(200)}
              style={styles.pill}
            >
              <Text style={styles.pillTextDefault}>
                1% cashback will be applied
              </Text>
            </Animated.View>
          ) : null}
        </View>

        {/* CTA Button */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Proceed →"
            onPress={handleProceed}
            disabled={!canContinue}
            showDivider
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: '100%',
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    paddingHorizontal: 48,
    paddingTop: 16,
    paddingBottom: 24,
    width: '100%',
  },

  // Header row — Figma 759:299537
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLabelLeft: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: '#A9A9A9',
    letterSpacing: 0,
    textAlign: 'left',
  },
  headerLabelRight: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: '#A9A9A9',
    letterSpacing: 0,
    textAlign: 'right',
  },
  headerLabelOverdue: {
    color: colors.error.default,
  },
  headerLabelPaid: {
    color: colors.brand[500],
  },

  // Amount — Figma 759:299540
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  currencySymbol: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#444444',
  },
  // NOTE: lineHeight omitted on iOS TextInput — it causes asymmetric vertical offset.
  amountInput: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 32,
    letterSpacing: -1,
    color: colors.brand[500], // #FF9A6D
    minWidth: 60,
    textAlign: 'center',
    padding: 0,
  },
  amountInputError: {
    color: colors.error.default,
  },
  decimalSuffix: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#444444',
  },

  // Cashback / Validation Pill — Figma 782:6323
  pillContainer: {
    marginTop: 16,
    minHeight: 36,
  },
  pill: {
    backgroundColor: '#131313', // colors.black[700]
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  pillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
  pillTextDefault: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.brand[500], // #FF9A6D
    textAlign: 'center',
  },

  // CTA Button — Figma 759:299542
  buttonContainer: {
    marginTop: 30,
    width: '100%',
  },
});
