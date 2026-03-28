/**
 * AddNetbankingContent — Bank Selection + Payment
 *
 * Extracted from add-netbanking.tsx for use inside the PaymentMethodModal.
 * Renders inside the modal panel (no Screen wrapper, no safe area).
 *
 * Flow: popular chip / trigger → Modal picker → select bank → proceed.
 * Bank picker uses country-picker-style pageSheet Modal (matching PhoneInput).
 */

import React, { useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Modal,
  SafeAreaView,
  Alert,
  TextInput as RNTextInput,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui/Typography';
import { PrimaryButton, BackButton } from '@/src/components/ui/Button';
import { Text as RNText } from 'react-native';
import { usePaymentFlow } from '@/src/hooks/usePaymentFlow';
import { useBankList } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import { BANK_LIST, type BankInfo } from '@/src/constants/bankList';
import type { NetbankingBank } from '@/src/services/api/payments';
import { colors } from '@/src/theme';

import type { AddMethodContentProps } from './types';

// ==============================================
// FIGMA COLORS
// ==============================================

const FIGMA_COLORS = {
  white: colors.white,
  labelText: colors.neutral[500],
  footerText: colors.neutral[500],
  popularBankBg: colors.black[500],
  selectedBorder: colors.brand[500],
  divider: colors.black[400],
  placeholder: colors.neutral[500],
  accent: colors.brand[500],
  triggerBg: colors.black[500],
  triggerBorder: colors.black[400],
  modalBg: colors.black[700],
  searchBg: colors.black[500],
  searchBorder: '#2A2A2A',
  rowBorder: '#2A2A2A',
};

// ==============================================
// POPULAR BANK CHIP
// ==============================================

function PopularBankChip({
  bank,
  isSelected,
  onPress,
}: {
  bank: BankInfo;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.popularBankChip,
        isSelected && styles.popularBankChipSelected,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.popularBankText,
          isSelected && styles.popularBankTextSelected,
        ]}
      >
        {bank.shortName ?? bank.name}
      </Text>
    </TouchableOpacity>
  );
}

// ==============================================
// CHEVRON DOWN ICON
// ==============================================

function ChevronDown({ color = FIGMA_COLORS.placeholder }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M4 6L8 10L12 6"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ==============================================
// ADD NETBANKING CONTENT
// ==============================================

/** Map API NetbankingBank to local BankInfo shape */
function toBankInfo(b: NetbankingBank): BankInfo {
  return { code: b.bank_code, name: b.bank_name, shortName: b.short_name ?? undefined, isPopular: b.is_popular };
}

export function AddNetbankingContent({ paymentId, onBack, onInitiatePayment, onReadyForConfirm }: AddMethodContentProps) {
  const sessionParams = usePaymentStore((s) => s.payuSessionParams);
  const storedAmount = usePaymentStore((s) => s.amount);
  const amount = sessionParams?.amount ?? (storedAmount > 0 ? String(storedAmount) : '0');

  const [selectedBankCode, setSelectedBankCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const { executePayment } = usePaymentFlow();

  // Dynamic bank list from Supabase, fallback to static BANK_LIST
  const { data: apiBanks } = useBankList();
  const banks: BankInfo[] = useMemo(
    () => (apiBanks && apiBanks.length > 0) ? apiBanks.map(toBankInfo) : BANK_LIST,
    [apiBanks],
  );
  const popularBanks = useMemo(() => banks.filter(b => b.isPopular), [banks]);

  const selectedBank = useMemo(
    () => banks.find(b => b.code === selectedBankCode),
    [banks, selectedBankCode],
  );

  const pickerFilteredBanks = useMemo(() => {
    if (!pickerSearch.trim()) return banks;
    const lower = pickerSearch.toLowerCase().trim();
    return banks.filter(
      (b) =>
        b.name.toLowerCase().includes(lower) ||
        b.code.toLowerCase().includes(lower) ||
        (b.shortName && b.shortName.toLowerCase().includes(lower)),
    );
  }, [pickerSearch, banks]);

  const handleSelectBank = useCallback(
    (code: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedBankCode(code);
    },
    [],
  );

  const handlePickerSelect = useCallback(
    (code: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedBankCode(code);
      setShowPicker(false);
    },
    [],
  );

  const handleOpenPicker = useCallback(() => {
    setPickerSearch('');
    setShowPicker(true);
  }, []);

  const handleProceed = useCallback(async () => {
    if (!selectedBankCode || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // Payment context with confirm step: hand off to confirm
      if (onReadyForConfirm) {
        const bankName = banks.find(b => b.code === selectedBankCode)?.name ?? selectedBankCode;
        onReadyForConfirm('netbanking', 'NB', { bankcode: selectedBankCode }, `Netbanking \u2022 ${bankName}`);
        return;
      }

      let currentPaymentId = paymentId;

      // Setup flow: initiate payment first if no paymentId yet
      if (!currentPaymentId && onInitiatePayment) {
        const result = await onInitiatePayment('netbanking');
        if (!result) {
          return;
        }
        currentPaymentId = result.paymentId;
      }

      // Re-read sessionParams after potential initiatePayment call
      const currentSessionParams = usePaymentStore.getState().payuSessionParams;
      if (!currentSessionParams) {
        Alert.alert('Session Error', 'Please go back and try again');
        return;
      }

      const outcome = await executePayment(
        'NB',
        { bankcode: selectedBankCode },
        currentPaymentId,
        () => {},
      );

      if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
        // Reset so user can retry
      } else if (outcome.status === 'failure') {
        Alert.alert('Payment Error', outcome.error || 'Unable to process payment. Please try again');
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [selectedBankCode, paymentId, executePayment, onInitiatePayment, banks, onReadyForConfirm]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerSection}>
        <BackButton
          onPress={onBack}
          style={styles.backButton}
          color={FIGMA_COLORS.white}
        />

        <RNText style={styles.title}>
          {'Add your\n'}
          <RNText style={styles.titleAccent}>Net Banking</RNText>
        </RNText>
      </View>

      {/* Popular Banks */}
      {popularBanks.length > 0 && (
        <View style={styles.popularSection}>
          <Text style={styles.sectionLabel}>Popular Banks</Text>
          <View style={styles.popularBanksRow}>
            {popularBanks.map((bank) => (
              <PopularBankChip
                key={bank.code}
                bank={bank}
                isSelected={selectedBankCode === bank.code}
                onPress={() => handleSelectBank(bank.code)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Bank Selector Trigger */}
      <View style={styles.triggerSection}>
        <Text style={styles.sectionLabel}>Select Bank</Text>
        <Pressable
          style={styles.trigger}
          onPress={handleOpenPicker}
          testID="bank-picker-trigger"
        >
          <Text
            style={[
              styles.triggerText,
              selectedBank && styles.triggerTextSelected,
            ]}
            numberOfLines={1}
          >
            {selectedBank ? selectedBank.name : 'Select your bank'}
          </Text>
          <ChevronDown color={selectedBank ? FIGMA_COLORS.white : FIGMA_COLORS.placeholder} />
        </Pressable>
      </View>

      {/* Proceed Button */}
      <View style={styles.buttonSection}>
        <PrimaryButton
          title={parseFloat(amount) > 0 ? `Pay \u20B9${parseFloat(amount).toLocaleString('en-IN')}` : 'Select Bank'}
          onPress={handleProceed}
          disabled={!selectedBankCode || isSubmitting}
          loading={isSubmitting}
          testID="modal-proceed-netbanking-button"
        />
        <Text style={[styles.footerText, { marginTop: 16 }]}>
          You may receive a verification message to confirm your bank account and unlock benefits
        </Text>
      </View>

      {/* Bank Picker Modal — pageSheet style matching PhoneInput */}
      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}
      >
        <SafeAreaView style={pickerStyles.container}>
          {/* Header */}
          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>Select Bank</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Text style={pickerStyles.doneButton}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={pickerStyles.searchContainer}>
            <RNTextInput
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Search banks..."
              placeholderTextColor={FIGMA_COLORS.placeholder}
              style={pickerStyles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              testID="bank-picker-search"
            />
          </View>

          {/* Bank List */}
          <FlatList
            data={pickerFilteredBanks}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selectedBankCode === item.code;
              return (
                <TouchableOpacity
                  style={[
                    pickerStyles.row,
                    isSelected && pickerStyles.rowSelected,
                  ]}
                  onPress={() => handlePickerSelect(item.code)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      pickerStyles.bankName,
                      isSelected && pickerStyles.bankNameSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {isSelected && (
                    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                      <Path
                        d="M3 8L6.5 11.5L13 5"
                        stroke={FIGMA_COLORS.accent}
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={pickerStyles.emptyState}>
                <Text style={pickerStyles.emptyText}>No banks found</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 48,
    paddingTop: 16,
  },
  headerSection: {
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
    color: colors.white,
    textAlign: 'left',
  },
  titleAccent: {
    color: colors.brand[500],
  },
  popularSection: {
    gap: 12,
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.labelText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  popularBanksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  popularBankChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: FIGMA_COLORS.popularBankBg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  popularBankChipSelected: {
    borderColor: FIGMA_COLORS.selectedBorder,
  },
  popularBankText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 20,
    color: colors.neutral[300],
  },
  popularBankTextSelected: {
    color: FIGMA_COLORS.selectedBorder,
  },
  triggerSection: {
    gap: 8,
    marginBottom: 24,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: FIGMA_COLORS.triggerBg,
    borderWidth: 1,
    borderColor: FIGMA_COLORS.triggerBorder,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  triggerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: FIGMA_COLORS.placeholder,
    flex: 1,
    marginRight: 8,
  },
  triggerTextSelected: {
    color: colors.white,
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footerText,
    textAlign: 'left',
  },
  buttonSection: {
    paddingTop: 8,
    paddingBottom: 24,
  },
});

// ==============================================
// PICKER MODAL STYLES (matches PhoneInput pattern)
// ==============================================

const pickerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FIGMA_COLORS.modalBg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: FIGMA_COLORS.rowBorder,
  },
  title: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 18,
    color: '#DDDDDD',
  },
  doneButton: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    color: FIGMA_COLORS.accent,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: FIGMA_COLORS.searchBg,
    borderWidth: 1,
    borderColor: FIGMA_COLORS.searchBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    color: colors.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FIGMA_COLORS.rowBorder,
  },
  rowSelected: {
    backgroundColor: '#1A1A1A',
  },
  bankName: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    color: '#DDDDDD',
    flex: 1,
  },
  bankNameSelected: {
    color: FIGMA_COLORS.accent,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: FIGMA_COLORS.placeholder,
  },
});
