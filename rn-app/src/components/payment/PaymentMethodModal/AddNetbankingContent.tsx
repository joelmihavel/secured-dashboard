/**
 * AddNetbankingContent — Bank Selection + Payment
 *
 * Extracted from add-netbanking.tsx for use inside the PaymentMethodModal.
 * Renders inside the modal panel (no Screen wrapper, no safe area).
 *
 * Flow: search/select bank -> proceed (executes payment via SDK).
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Text, PrimaryButton, ScreenTitle, TextInput } from '@/src/components';
import { RadioButton } from '@/src/components/payment/RadioButton';
import { usePaymentFlow } from '@/src/hooks/usePaymentFlow';
import { usePaymentStore } from '@/src/stores';
import { BANK_LIST, POPULAR_BANKS, searchBanks, type BankInfo } from '@/src/constants/bankList';
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
};

// ==============================================
// BACK ARROW (24x24 chevron, white stroke 2px)
// ==============================================

const BackArrow = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={FIGMA_COLORS.white}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

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
// BANK ROW
// ==============================================

function BankRow({
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
      style={styles.bankRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.bankRowText}>{bank.name}</Text>
      <RadioButton isSelected={isSelected} />
    </TouchableOpacity>
  );
}

// ==============================================
// ADD NETBANKING CONTENT
// ==============================================

export function AddNetbankingContent({ paymentId, onBack }: AddMethodContentProps) {
  const sessionParams = usePaymentStore((s) => s.payuSessionParams);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBankCode, setSelectedBankCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { executePayment } = usePaymentFlow();

  const filteredBanks = useMemo(() => searchBanks(searchQuery), [searchQuery]);
  const isSearchActive = searchQuery.trim().length > 0;

  const handleSelectBank = useCallback(
    (code: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedBankCode((prev) => (prev === code ? null : code));
    },
    [],
  );

  const handleProceed = useCallback(async () => {
    if (!selectedBankCode || isSubmitting) return;

    if (!sessionParams) {
      Alert.alert('Session Expired', 'Please go back and try again.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSubmitting(true);

    const outcome = await executePayment(
      'NB',
      { bankcode: selectedBankCode },
      paymentId,
      () => {},
    );

    if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
      setIsSubmitting(false);
    }
  }, [selectedBankCode, sessionParams, paymentId, isSubmitting, executePayment]);

  const renderBankItem = useCallback(
    ({ item }: { item: BankInfo }) => (
      <BankRow
        bank={item}
        isSelected={selectedBankCode === item.code}
        onPress={() => handleSelectBank(item.code)}
      />
    ),
    [selectedBankCode, handleSelectBank],
  );

  const keyExtractor = useCallback((item: BankInfo) => item.code, []);

  const ListHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        {/* Popular Banks (hidden during search) */}
        {!isSearchActive && (
          <>
            <Text style={styles.sectionLabel}>Popular Banks</Text>
            <View style={styles.popularBanksRow}>
              {POPULAR_BANKS.map((bank) => (
                <PopularBankChip
                  key={bank.code}
                  bank={bank}
                  isSelected={selectedBankCode === bank.code}
                  onPress={() => handleSelectBank(bank.code)}
                />
              ))}
            </View>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionLabel}>All Banks</Text>
          </>
        )}
      </View>
    ),
    [isSearchActive, selectedBankCode, handleSelectBank],
  );

  const ListFooter = useMemo(
    () => (
      <View style={styles.listFooter}>
        <Text style={styles.footerText}>
          Don't see your bank? Try paying with UPI or Card instead.
        </Text>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.container}>
      {/* Header area (scrolls with content conceptually, but pinned above FlatList) */}
      <View style={styles.headerSection}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onBack();
          }}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back to method selection"
        >
          <BackArrow />
        </TouchableOpacity>

        {/* Title */}
        <ScreenTitle gray="Add your " accent="Bank Account" />

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            label=""
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search banks..."
            testID="modal-bank-search-input"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Bank List */}
      <FlatList
        data={filteredBanks}
        renderItem={renderBankItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        style={styles.flatList}
      />

      {/* Proceed Button */}
      <View style={styles.buttonSection}>
        <PrimaryButton
          title="Save bank account"
          onPress={handleProceed}
          disabled={!selectedBankCode || isSubmitting}
          loading={isSubmitting}
          testID="modal-proceed-netbanking-button"
        />
        <Text style={[styles.footerText, { marginTop: 16 }]}>
          You may receive a verification message to confirm your bank account and unlock benefits.
        </Text>
      </View>
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
    // Let FlatList handle its own scroll; limit overall height
    maxHeight: 600,
  },
  headerSection: {
    gap: 24,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  searchContainer: {
    marginTop: 8,
  },
  flatList: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 16,
  },
  listHeader: {
    gap: 12,
    marginBottom: 8,
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
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: FIGMA_COLORS.divider,
    marginVertical: 8,
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  bankRowText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[300],
    flex: 1,
    marginRight: 12,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: FIGMA_COLORS.divider,
  },
  listFooter: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footerText,
    textAlign: 'left',
  },
  buttonSection: {
    paddingTop: 16,
    paddingBottom: 24,
  },
});
