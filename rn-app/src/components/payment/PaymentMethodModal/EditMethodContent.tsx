import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text as RNText,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { PrimaryButton } from '@/src/components';
import { PaymentCard } from '@/src/components/payment/PaymentCard';
import { useSavedPaymentMethods, useDeletePaymentMethod } from '@/src/hooks';
import { colors } from '@/src/theme';

import type { EditMethodContentProps } from './types';
import type { SavedPaymentMethod } from '@/src/services/api/payments';

const FIGMA_COLORS = {
  white: colors.white,
  deleteText: colors.neutral[500],
  cardBorder: '#4D4D4D',
};

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

  const handleDelete = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsDeleting(true);
    try {
      await deletePaymentMethod(savedMethodId);
      onDeleteSuccess(methodType);
    } catch (err) {
      Alert.alert('Error', 'Failed to delete payment method.');
      setIsDeleting(false);
    }
  }, [deletePaymentMethod, savedMethodId, methodType, onDeleteSuccess]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Delete Method',
      'Are you sure you want to delete this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDelete },
      ]
    );
  }, [handleDelete]);

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
      </View>

      {/* Card Visual Container */}
      <View style={styles.cardContainer}>
        {methodData && (
          <View pointerEvents="none" style={styles.cardVisualWrapper}>
            <PaymentCard {...cardProps} selected={false} />
          </View>
        )}
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
          onPress={confirmDelete}
          disabled={isInitiating || isDeleting}
          style={styles.deleteButton}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#A9A9A9" />
          ) : (
            <RNText style={styles.deleteText}>
              Delete {methodType === 'upi' ? 'UPI' : 'Card'}
            </RNText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 48,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 32,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -12, // Offset the padding of the back arrow for alignment
  },
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    width: '100%',
  },
  cardVisualWrapper: {
    width: 270,
    height: 400,
  },
  footer: {
    gap: 24,
    alignItems: 'center',
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  deleteText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#A9A9A9',
    textAlign: 'center',
  },
});
