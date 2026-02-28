import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui/Typography';
import { PrimaryButton, BackButton } from '@/src/components/ui/Button';
import { PaymentCard } from '@/src/components/payment/PaymentCard';
import { useSavedPaymentMethods, useDeletePaymentMethod } from '@/src/hooks';
import { colors } from '@/src/theme';

import type { EditMethodContentProps, SavedMethodDetails } from './types';
import type { SavedPaymentMethod } from '@/src/services/api/payments';

const FIGMA_COLORS = {
  white: colors.white,
  muted: colors.neutral[500],
  accent: colors.brand[500],
  background: colors.black[600],
  cardBg: colors.black[500],
  cardBorder: colors.black[400],
};

/** Get the delete CTA text */
function getDeleteCta(methodType: string): string {
  switch (methodType) {
    case 'upi': return 'Delete UPI';
    case 'card': return 'Delete Card';
    case 'debit_card': return 'Delete Card';
    case 'netbanking': return 'Delete Bank';
    default: return 'Delete Method';
  }
}

/** Get the replace CTA text for profile context */
function getReplaceCta(methodType: string): string {
  switch (methodType) {
    case 'upi': return 'Replace UPI';
    case 'card': return 'Replace Card';
    case 'debit_card': return 'Replace Card';
    case 'netbanking': return 'Replace Bank';
    default: return 'Replace Method';
  }
}

/** Get a human-readable method name */
function getMethodName(methodType: string): string {
  switch (methodType) {
    case 'upi': return 'UPI ID';
    case 'card':
    case 'debit_card': return 'card';
    case 'netbanking': return 'bank account';
    default: return 'payment method';
  }
}

export function EditMethodContent({
  onBack,
  methodType,
  savedMethodId,
  onProceed,
  onDeleteSuccess,
  isInitiating,
  context = 'payment',
}: EditMethodContentProps) {
  const isProfile = context === 'profile';
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

  const confirmDelete = useCallback(() => {
    const name = getMethodName(methodType);
    if (isProfile) {
      Alert.alert(
        `Replace ${name.charAt(0).toUpperCase() + name.slice(1)}`,
        `This will remove your current ${name} and let you set up a new one.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: handleReplace },
        ]
      );
    } else {
      Alert.alert(
        'Delete Payment Method',
        `This will remove your current ${name}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: handleReplace },
        ]
      );
    }
  }, [handleReplace, methodType, isProfile]);

  const getPaymentCardProps = () => {
    if (!methodData) return { type: methodType as any };

    if (methodData.type === 'card') {
      // Format expiry from month/year if available
      const expiry = methodData.card_expiry_month && methodData.card_expiry_year
        ? `${String(methodData.card_expiry_month).padStart(2, '0')}/${String(methodData.card_expiry_year).slice(-2)}`
        : undefined;
      return {
        type: methodData.card_type === 'debit' ? 'debit' : 'credit',
        lastFourDigits: methodData.last_four,
        bankName: methodData.card_issuer,
        expiryDate: expiry,
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
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {/* Card Visual Container — fades in on mount */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.cardContainer}>
          {methodData ? (
            <View pointerEvents="none" style={styles.cardVisualWrapper}>
              <PaymentCard {...cardProps} variant="profile" selected />
            </View>
          ) : (
            <View style={styles.emptyCardPlaceholder}>
              <Text style={styles.emptyCardText}>No method data</Text>
            </View>
          )}
        </Animated.View>

        {/* Footer Actions — staggers in */}
        <Animated.View entering={FadeInUp.delay(100).duration(250)} style={styles.footer}>
          {isProfile ? (
            <>
              {/* Profile context: Replace is the primary action */}
              <PrimaryButton
                title={getReplaceCta(methodType)}
                onPress={confirmDelete}
                disabled={isDeleting || !methodData}
                loading={isDeleting}
                showDivider
              />
            </>
          ) : (
            <>
              {/* Payment context: Proceed + Delete secondary */}
              <PrimaryButton
                title="Proceed to Payment"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const details: SavedMethodDetails | undefined = methodData ? {
                    savedMethodId: methodData.id,
                    vpa: methodData.vpa,
                    bankCode: methodData.bank_code,
                  } : undefined;
                  onProceed(methodType, details);
                }}
                disabled={isInitiating || isDeleting || !methodData}
                loading={isInitiating}
                showDivider
              />

              <TouchableOpacity
                onPress={confirmDelete}
                disabled={isInitiating || isDeleting}
                style={styles.deleteButton}
                hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={FIGMA_COLORS.muted} />
                ) : (
                  <Text style={styles.deleteText}>
                    {getDeleteCta(methodType)}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 48,
    paddingTop: 8,
  },
  scrollContent: {
    gap: 32,
    paddingBottom: 24,
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
    marginLeft: -12,
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
  emptyCardPlaceholder: {
    width: 270,
    height: 400,
    backgroundColor: colors.black[500],
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCardText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: colors.neutral[500],
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
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
