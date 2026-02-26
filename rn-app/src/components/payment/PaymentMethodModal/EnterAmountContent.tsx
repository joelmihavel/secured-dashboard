import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/src/components/ui/Typography/Text';
import { PrimaryButton } from '@/src/components/ui/Button/PrimaryButton';
import { useDashboard } from '@/src/hooks';
import { colors } from '@/src/theme';

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
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  
  const [amount, setAmount] = useState(initialAmount > 0 ? String(initialAmount) : '');

  const { tenancy, upcomingPayment } = useDashboard();
  
  const baseRent = tenancy?.monthly_rent || 30000;
  const daysUntilDue = upcomingPayment?.days_until_due ?? 10;
  const maxRent = baseRent + 500;
  
  const date = new Date();
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const rentMonthText = upcomingPayment?.rent_month 
    ? upcomingPayment.rent_month.toUpperCase() 
    : `${monthNames[date.getMonth()]} ${date.getFullYear()} RENT`;

  useEffect(() => {
    // Auto-focus input when this view mounts
    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  const handlePayPress = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > maxRent || numAmount <= 0 || !amount) return;
    Keyboard.dismiss();
    onProceed(numAmount);
  };

  const numAmount = parseFloat(amount) || 0;
  const isExceededRent = numAmount > maxRent;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>{rentMonthText}</Text>
        <Text style={styles.headerLabel}>DUE IN {Math.max(0, daysUntilDue)} DAYS</Text>
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          ref={inputRef}
          style={[
            styles.amountInput,
            isExceededRent && styles.amountInputError
          ]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor="#4D4D4D"
          selectionColor={colors.brand[500]}
          maxLength={8}
        />
      </View>

      {isExceededRent && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            Amount cannot exceed ₹{maxRent.toLocaleString('en-IN')}
          </Text>
        </View>
      )}

      {/* Cashaback pill placeholder for spacing match */}
      <View style={styles.cashbackContainer}>
        <Text style={styles.cashbackText}>Cashback Potential: ₹ 325.00</Text>
      </View>

      <View style={styles.footerRow}>
        <PrimaryButton
          title="Select Payment Method →"
          onPress={handlePayPress}
          disabled={!amount || numAmount <= 0 || isExceededRent}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 16,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  headerLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: '#A9A9A9',
    letterSpacing: 1,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  currencySymbol: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    color: '#BABABA',
    marginRight: 8,
    marginTop: -4,
  },
  amountInput: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    color: '#FF9A6D',
    letterSpacing: -2,
    minWidth: 150,
    textAlign: 'center',
  },
  amountInputError: {
    color: '#FF3B30',
  },
  warningContainer: {
    backgroundColor: '#331B1B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    alignItems: 'center',
  },
  warningText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: '#FF9A6D',
  },
  cashbackContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  cashbackText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: '#A9A9A9',
  },
  footerRow: {
    width: '100%',
  },
  button: {
    width: '100%',
  },
});
