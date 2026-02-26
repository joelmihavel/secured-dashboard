/**
 * Edit Payment Method Screen — PCI-Compliant, Type-Specific
 *
 * Figma nodes:
 * - 684:5467 (Edit UPI Method)
 * - 684:5627 (Edit Credit Card)
 * - 684:6320 (Edit Net Banking)
 *
 * Layout: DottedGridPattern background, back arrow, dual-color H1,
 * type-specific content (UPI form / Card view+replace / Bank selector).
 *
 * PCI compliance:
 * - Card data NEVER in state or text inputs
 * - Card input uses SecureCardInput (refs only, auto-zeroed)
 * - Card replace flow uses Rs.1 PayU verification via Core SDK
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text } from '@/src/components';
import { TextInput, PrimaryButton } from '@/src/components/ui';
import { DottedGridPattern } from '@/src/components/patterns';
import { RadioButton } from '@/src/components/payment/RadioButton';
import { SecureCardInput, type SecureCardInputRef } from '@/src/components/payment/SecureCardInput';
import {
  useSavedPaymentMethods,
  useAddUpiVpa,
  useVerifyUpi,
  useDeletePaymentMethod,
  useSaveBankPreference,
  useVerifyCard,
  usePaymentFlow,
  useNetworkStatus,
} from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import { BANK_LIST, POPULAR_BANKS, searchBanks, type BankInfo } from '@/src/constants/bankList';
import type { SavedPaymentMethod } from '@/src/services/api/payments';
import { colors } from '@/src/theme';

// ==============================================
// DESIGN TOKENS (from Figma 684:5467/5627/6320)
// ==============================================

const COLORS = {
  background: colors.black[700],    // #131313
  headingGray: '#A9A9A9',           // neutral.500
  headingAccent: colors.brand[500], // #FF9A6D
  white: colors.white,
  labelText: '#878787',             // neutral.600
  valueText: '#CBCBCB',            // neutral.300
  divider: '#4D4D4D',              // black.400
  cardBg: colors.black[500],       // #202020
  popularBankBg: colors.black[500],
  selectedBorder: colors.brand[500],
  footerText: '#A9A9A9',
  errorRed: colors.error?.default ?? '#FF4444',
};

type MethodType = 'upi' | 'card' | 'netbanking';

const HEADING_MAP: Record<MethodType, string> = {
  upi: 'UPI Method',
  card: 'Credit Card', // overridden by card_type param when present
  netbanking: 'Net Banking',
};

const CARD_TYPE_HEADING: Record<string, string> = {
  credit: 'Credit Card',
  debit: 'Debit Card',
};

// ==============================================
// BACK ARROW ICON
// ==============================================

const BackArrowIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 12H5M5 12L12 19M5 12L12 5"
      stroke={COLORS.white}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ==============================================
// INFO ROW (card read-only display)
// ==============================================

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

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
      style={[styles.popularBankChip, isSelected && styles.popularBankChipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.popularBankText, isSelected && styles.popularBankTextSelected]}>
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
    <TouchableOpacity style={styles.bankRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.bankRowText}>{bank.name}</Text>
      <RadioButton isSelected={isSelected} />
    </TouchableOpacity>
  );
}

// ==============================================
// UPI CONTENT
// ==============================================

function UpiContent({
  savedMethod,
  onSaved,
}: {
  savedMethod?: SavedPaymentMethod;
  onSaved: () => void;
}) {
  const [accountName, setAccountName] = useState(savedMethod?.display_name ?? '');
  const [vpa, setVpa] = useState(savedMethod?.vpa ?? '');
  const { isConnected } = useNetworkStatus();

  const addUpi = useAddUpiVpa();
  const verifyUpi = useVerifyUpi();
  const deleteMethod = useDeletePaymentMethod();

  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'verified' | 'failed'>('idle');
  const [vpaError, setVpaError] = useState('');

  /** Granular UPI validation — returns error string or null if valid */
  const validateVpa = useCallback((id: string): string | null => {
    const trimmed = id.trim();
    if (trimmed.length === 0) return 'Enter your UPI ID';
    if (trimmed.includes(' ')) return 'UPI ID cannot contain spaces';
    if (!trimmed.includes('@')) return 'UPI ID must contain @ (e.g., name@upi)';
    if (trimmed.startsWith('@')) return 'Enter your name before the @';
    if (trimmed.endsWith('@')) return 'Enter the UPI handle after @';
    if (trimmed.length < 5) return 'UPI ID is too short';
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    if (!upiRegex.test(trimmed)) return 'Only letters, numbers, dots and hyphens are allowed';
    return null;
  }, []);

  const handleVerify = useCallback(async (): Promise<boolean> => {
    const validationError = validateVpa(vpa);
    if (validationError) {
      setVpaError(validationError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    if (!isConnected) {
      setVpaError('Could not verify UPI ID. Check your connection.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    setVpaError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await verifyUpi.mutateAsync({ upiId: vpa.trim() });
      if (result.verified) {
        setVerifyStatus('verified');
        if (result.name) setAccountName(result.name);
        return true;
      } else {
        setVpaError('This UPI ID does not exist. Please check and try again.');
        setVerifyStatus('failed');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout')) {
        setVpaError('Could not verify UPI ID. Check your connection.');
      } else if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('invalid vpa')) {
        setVpaError('This UPI ID does not exist. Please check and try again.');
      } else {
        setVpaError('Could not verify this UPI ID.');
      }
      setVerifyStatus('failed');
      return false;
    }
  }, [vpa, verifyUpi, validateVpa, isConnected]);

  const handleSave = useCallback(async () => {
    if (verifyStatus !== 'verified') {
      const verified = await handleVerify();
      if (!verified) return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await addUpi.mutateAsync({ vpa: vpa.trim(), setPrimary: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save UPI');
    }
  }, [vpa, addUpi, onSaved, verifyStatus, handleVerify]);

  const handleDelete = useCallback(() => {
    if (!savedMethod) return;
    Alert.alert('Delete UPI Method', 'Are you sure you want to remove this UPI method?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMethod.mutate(savedMethod.id, { onSuccess: onSaved });
        },
      },
    ]);
  }, [savedMethod, deleteMethod, onSaved]);

  const canSave = vpa.trim().length > 0 && !vpaError;

  return (
    <View style={styles.fieldsContainer}>
      <TextInput
        label="Account holder name"
        value={accountName}
        onChangeText={setAccountName}
        placeholder="John Smith"
        autoCapitalize="words"
        testID="edit-field-accountName"
      />
      <TextInput
        label="UPI ID"
        value={vpa}
        onChangeText={(text) => {
          setVpa(text.toLowerCase().trim());
          setVerifyStatus('idle');
          setVpaError('');
        }}
        placeholder="john@oksbi"
        keyboardType="email-address"
        autoCapitalize="none"
        error={vpaError}
        testID="edit-field-upiId"
      />

      {verifyStatus === 'verified' && (
        <Text style={styles.verifiedText}>UPI verified successfully</Text>
      )}

      <View style={styles.buttonContainer}>
        <PrimaryButton
          title="Save Changes"
          onPress={handleSave}
          showDivider
          loading={addUpi.isPending || verifyUpi.isPending}
          disabled={!canSave || addUpi.isPending || verifyUpi.isPending}
          testID="save-changes-button"
        />
      </View>

      {savedMethod && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          testID="delete-method-button"
        >
          <Text style={styles.deleteButtonText}>Delete UPI Method</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ==============================================
// CARD CONTENT (PCI-compliant)
// ==============================================

function CardContent({
  savedMethod,
  onSaved,
  cardType,
}: {
  savedMethod?: SavedPaymentMethod;
  onSaved: () => void;
  cardType?: 'credit' | 'debit';
}) {
  const [showReplaceForm, setShowReplaceForm] = useState(!savedMethod);
  const [isCardValid, setIsCardValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cardInputRef = useRef<SecureCardInputRef>(null);
  const { isConnected } = useNetworkStatus();

  const verifyCardMutation = useVerifyCard();
  const deleteMethod = useDeletePaymentMethod();
  const { executePayment } = usePaymentFlow();
  const { setPayuSessionParams } = usePaymentStore();

  const handleReplaceCard = useCallback(async () => {
    if (isSubmitting) return;
    if (!isConnected) {
      Alert.alert('No Connection', "You're offline. Please check your connection and try again.");
      return;
    }
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // 1. Get Rs.1 PayU session from edge function
      const session = await verifyCardMutation.mutateAsync();

      // 2. Validate card data from SecureCardInput
      const validation = cardInputRef.current?.validate();
      if (!validation?.valid) {
        Alert.alert('Invalid Card', validation?.errors.join('\n') ?? 'Please check card details');
        setIsSubmitting(false);
        return;
      }

      const cardData = cardInputRef.current!.getCardData();

      // 3. Store session params for the payment flow
      setPayuSessionParams(session.payu as never);

      // 4. Launch Core SDK with card instrument (CC=credit, DC=debit)
      const paymentMode = cardType === 'debit' ? 'DC' : 'CC';
      const outcome = await executePayment(
        paymentMode as never,
        {
          bankcode: paymentMode as never,
          card_number: cardData.cardNumber,
          cvv: cardData.cvv,
          expiry_month: cardData.expiryMonth,
          expiry_year: cardData.expiryYear,
          name_on_card: cardData.nameOnCard,
          store_card: '1',
        },
        session.payment_id,
        () => cardInputRef.current?.clearCardData(),
      );

      // 5. Clear sensitive data immediately
      cardInputRef.current?.clearCardData();

      if (outcome.status === 'success' || outcome.status === 'navigating') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Card Saved', 'Your card has been verified and saved.', [
          { text: 'OK', onPress: onSaved },
        ]);
      } else if (outcome.status === 'failure') {
        Alert.alert('Verification Failed', outcome.error ?? 'Card verification failed');
      }
    } catch (err) {
      cardInputRef.current?.clearCardData();
      Alert.alert('Error', err instanceof Error ? err.message : 'Card verification failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isConnected, verifyCardMutation, executePayment, setPayuSessionParams, onSaved]);

  const handleDelete = useCallback(() => {
    if (!savedMethod) return;
    Alert.alert('Delete Card', 'Are you sure you want to remove this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMethod.mutate(savedMethod.id, { onSuccess: onSaved });
        },
      },
    ]);
  }, [savedMethod, deleteMethod, onSaved]);

  // Saved card: show info + replace/delete
  if (savedMethod && !showReplaceForm) {
    return (
      <View style={styles.fieldsContainer}>
        <View style={styles.cardInfoContainer}>
          <InfoRow label="Card Number" value={`**** **** **** ${savedMethod.last_four ?? '----'}`} />
          <InfoRow label="Network" value={savedMethod.card_network?.toUpperCase() ?? 'Unknown'} />
          {savedMethod.card_expiry_month && savedMethod.card_expiry_year && (
            <InfoRow
              label="Expiry"
              value={`${String(savedMethod.card_expiry_month).padStart(2, '0')}/${String(savedMethod.card_expiry_year).slice(-2)}`}
            />
          )}
        </View>

        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Replace Card"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowReplaceForm(true);
            }}
            showDivider
            testID="replace-card-button"
          />
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          testID="delete-method-button"
        >
          <Text style={styles.deleteButtonText}>Delete Card</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No card or replacing: show SecureCardInput
  return (
    <View style={styles.fieldsContainer}>
      <SecureCardInput ref={cardInputRef} onValidityChange={setIsCardValid} />

      <Text style={styles.footerNote}>
        A Rs.1 verification charge will be made and automatically refunded.
      </Text>

      <View style={styles.buttonContainer}>
        <PrimaryButton
          title={savedMethod ? 'Verify & Replace Card' : 'Verify & Add Card'}
          onPress={handleReplaceCard}
          showDivider
          loading={isSubmitting || verifyCardMutation.isPending}
          disabled={!isCardValid || isSubmitting}
          testID="save-changes-button"
        />
      </View>

      {savedMethod && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => setShowReplaceForm(false)}
          testID="cancel-replace-button"
        >
          <Text style={styles.deleteButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ==============================================
// NETBANKING CONTENT
// ==============================================

function NetbankingContent({
  savedMethod,
  onSaved,
}: {
  savedMethod?: SavedPaymentMethod;
  onSaved: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBankCode, setSelectedBankCode] = useState<string | null>(
    savedMethod?.bank_code ?? null,
  );

  const saveBankPref = useSaveBankPreference();
  const deleteMethod = useDeletePaymentMethod();

  const filteredBanks = useMemo(() => searchBanks(searchQuery), [searchQuery]);
  const isSearchActive = searchQuery.trim().length > 0;

  const selectedBank = useMemo(
    () => BANK_LIST.find((b) => b.code === selectedBankCode),
    [selectedBankCode],
  );

  const hasChanged = selectedBankCode !== (savedMethod?.bank_code ?? null);

  const handleSelectBank = useCallback((code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBankCode((prev) => (prev === code ? null : code));
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedBankCode || !selectedBank) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await saveBankPref.mutateAsync({
        bankCode: selectedBankCode,
        bankName: selectedBank.name,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save bank');
    }
  }, [selectedBankCode, selectedBank, saveBankPref, onSaved]);

  const handleDelete = useCallback(() => {
    if (!savedMethod) return;
    Alert.alert('Delete Bank Account', 'Are you sure you want to remove this bank?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMethod.mutate(savedMethod.id, { onSuccess: onSaved });
        },
      },
    ]);
  }, [savedMethod, deleteMethod, onSaved]);

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

  return (
    <View style={styles.fieldsContainer}>
      {/* Search */}
      <TextInput
        label=""
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search banks..."
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        testID="bank-search-input"
      />

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

      {/* Bank List */}
      <FlatList
        data={filteredBanks}
        renderItem={renderBankItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        style={styles.bankList}
        scrollEnabled={false}
      />

      <Text style={styles.footerNote}>
        Don't see your bank? Try paying with UPI or Card instead.
      </Text>

      <View style={styles.buttonContainer}>
        <PrimaryButton
          title="Save Changes"
          onPress={handleSave}
          showDivider
          loading={saveBankPref.isPending}
          disabled={!selectedBankCode || !hasChanged || saveBankPref.isPending}
          testID="save-changes-button"
        />
      </View>

      {savedMethod && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          testID="delete-method-button"
        >
          <Text style={styles.deleteButtonText}>Delete Bank Account</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ==============================================
// MAIN COMPONENT
// ==============================================

export default function EditPaymentMethodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type: string; id: string; card_type?: string }>();
  const methodType = (params.type as MethodType) || 'upi';
  const cardType = params.card_type as 'credit' | 'debit' | undefined;

  // Look up the saved method from React Query cache
  const { data: methods, isLoading } = useSavedPaymentMethods();
  const savedMethod = useMemo(() => {
    if (!methods) return undefined;
    if (params.id) return methods.find((m) => m.id === params.id);
    // For cards, filter by card_type (credit/debit) when specified
    if (methodType === 'card' && cardType) {
      return (
        methods.find((m) => m.type === 'card' && m.card_type === cardType && m.is_default) ??
        methods.find((m) => m.type === 'card' && m.card_type === cardType)
      );
    }
    // Fallback: find the default or first match for the type
    return (
      methods.find((m) => m.type === methodType && m.is_default) ??
      methods.find((m) => m.type === methodType)
    );
  }, [methods, methodType, params.id, cardType]);

  // Use card_type-specific heading when available, otherwise fall back to HEADING_MAP
  const headingText = methodType === 'card' && cardType
    ? (CARD_TYPE_HEADING[cardType] || HEADING_MAP.card)
    : (HEADING_MAP[methodType] || 'Payment Method');
  const isAddMode = !savedMethod && !isLoading;

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleSaved = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <Screen testID="edit-payment-method-screen" padded={false}>
      <DottedGridPattern animated={true} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Arrow */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BackArrowIcon />
          </TouchableOpacity>

          {/* H1 Heading — dual-color per Figma 684:5467 */}
          <View style={styles.headingContainer}>
            <Text style={styles.headingBase}>
              <Text inherit style={styles.headingGray}>
                {isAddMode ? 'Add your\n' : 'Edit your\n'}
              </Text>
              <Text inherit style={styles.headingAccent}>
                {headingText}
              </Text>
            </Text>
          </View>

          {/* Type-specific content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brand[500]} />
            </View>
          ) : methodType === 'upi' ? (
            <UpiContent savedMethod={savedMethod} onSaved={handleSaved} />
          ) : methodType === 'card' ? (
            <CardContent savedMethod={savedMethod} onSaved={handleSaved} cardType={cardType} />
          ) : (
            <NetbankingContent savedMethod={savedMethod} onSaved={handleSaved} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 48,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 48,
  },
  headingContainer: {
    marginBottom: 48,
  },
  headingBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
  },
  headingGray: {
    color: COLORS.headingGray,
  },
  headingAccent: {
    color: COLORS.headingAccent,
  },
  fieldsContainer: {
    gap: 16,
    marginBottom: 48,
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  loadingContainer: {
    paddingVertical: 64,
    alignItems: 'center',
  },

  // Card info display
  cardInfoContainer: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    gap: 0,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.divider,
  },
  infoLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.labelText,
  },
  infoValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.valueText,
  },

  // Bank selector
  sectionLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.labelText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
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
    backgroundColor: COLORS.popularBankBg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  popularBankChipSelected: {
    borderColor: COLORS.selectedBorder,
  },
  popularBankText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 20,
    color: colors.neutral[300],
  },
  popularBankTextSelected: {
    color: COLORS.selectedBorder,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
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
    backgroundColor: COLORS.divider,
  },
  bankList: {
    maxHeight: 300,
  },

  // Footer notes
  footerNote: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.footerText,
    textAlign: 'left',
    marginTop: 8,
  },

  // Delete button
  deleteButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  deleteButtonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.errorRed,
    textAlign: 'center',
  },

  // Status text
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.errorRed,
    textAlign: 'left',
  },
  verifiedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#4CAF50',
    textAlign: 'left',
  },
});
