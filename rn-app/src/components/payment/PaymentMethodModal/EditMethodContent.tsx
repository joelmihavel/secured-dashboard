import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { PrimaryButton, Text, BackButton } from '@/src/components';
import { PaymentCard } from '@/src/components/payment/PaymentCard';
import { useSavedPaymentMethods, useDeletePaymentMethod } from '@/src/hooks';
import { colors } from '@/src/theme';

import type { EditMethodContentProps } from './types';
import type { SavedPaymentMethod } from '@/src/services/api/payments';

const FIGMA_COLORS = {
  white: colors.white,
  muted: '#A9A9A9',
  accent: colors.brand[500],
  background: '#1A1A1A',
  cardBg: '#202020',
  cardBorder: '#4D4D4D',
};

/** Get the replace CTA text */
function getReplaceCta(methodType: string): string {
  switch (methodType) {
    case 'upi': return 'Replace UPI ID';
    case 'card': return 'Replace Card';
    case 'debit_card': return 'Replace Card';
    case 'netbanking': return 'Replace Netbanking';
    default: return 'Replace Method';
  }
}

export function EditMethodContent({
  onBack,
  methodType,
  savedMethodId,
  onProceed,
  onDeleteSuccess,
  isInitiating,
}: EditMethodContentProps) {
  const { data: savedMethods } = useSavedPaymentMethods();
  const { mutateAsync: deletePaymentMethod } = useDeletePaymentMethod();
  const [isDeleting, setIsDeleting] = useState(false);

  const methodData = useMemo(() => {
    return savedMethods?.find((m: SavedPaymentMethod) => m.id === savedMethodId);
  }, [savedMethods, savedMethodId]);

  const handleReplace = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDeleting(true);
    try {
      await deletePaymentMethod(savedMethodId);
      onDeleteSuccess(methodType);
    } catch (err) {
      Alert.alert('Error', 'Failed to remove payment method.');
      setIsDeleting(false);
    }
  }, [deletePaymentMethod, savedMethodId, methodType, onDeleteSuccess]);

  const confirmReplace = useCallback(() => {
    Alert.alert(
      'Replace Payment Method',
      `This will remove your current ${methodType === 'upi' ? 'UPI ID' : (methodType === 'card' || methodType === 'debit_card') ? 'card' : 'bank account'} and let you add a new one.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: handleReplace },
      ]
    );
  }, [handleReplace, methodType]);

  const getPaymentCardProps = () => {
    if (!methodData) return { type: methodType as any };

    if (methodData.type === 'card') {
      return {
        type: methodData.card_type === 'debit' ? 'debit' : 'credit',
        lastFourDigits: methodData.last_four,
        bankName: methodData.card_issuer,
      } as const;
    }

    if (methodData.type === 'upi') {
      return {
        type: 'upi',
        upiId: methodData.vpa ?? methodData.display_name,
      } as const;
    }

    return {
      type: 'netbanking',
      bankName: methodData.display_name,
    } as const;
  };

  const cardProps = getPaymentCardProps();

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.header}>
        <BackButton
          onPress={onBack}
          style={styles.backButton}
          color={FIGMA_COLORS.white}
        />
        <Text style={styles.title}>Edit Method</Text>
      </View>

      {/* Card UI — Figma 773:11937 */}
      <View style={styles.cardSection}>
        <View style={styles.cardContainer}>
          {methodData ? (
            <View pointerEvents="none" style={styles.cardVisualWrapper}>
              <PaymentCard 
                {...cardProps} 
                variant="profile" 
                selected={true}
              />
            </View>
          ) : (
            <View style={styles.emptyCardPlaceholder}>
              <Text style={styles.emptyCardText}>No method data</Text>
            </View>
          )}
        </View>
      </View>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <PrimaryButton
          title="Proceed to Payment"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onProceed(methodType);
          }}
          disabled={isInitiating || isDeleting || !methodData}
          loading={isInitiating}
          showDivider
        />

        <TouchableOpacity
          onPress={confirmReplace}
          disabled={isInitiating || isDeleting}
          style={styles.replaceButton}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={FIGMA_COLORS.muted} />
          ) : (
            <Text style={styles.replaceText}>
              {getReplaceCta(methodType)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 40,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 32,
    backgroundColor: '#1A1A1A',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 18,
    color: colors.white,
    marginLeft: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: 0,
  },
  cardSection: {
    alignItems: 'center',
    // Gap 32 is handled by parent container
  },
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cardVisualWrapper: {
    width: 270,
    height: 400,
  },
  emptyCardPlaceholder: {
    width: 270,
    height: 400,
    backgroundColor: '#202020',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCardText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: '#A9A9A9',
  },
  footer: {
    gap: 24,
    alignItems: 'center',
    width: '100%',
  },
  replaceButton: {
    paddingVertical: 8,
    width: '100%',
  },
  replaceText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#A9A9A9',
    textAlign: 'center',
  },
});
