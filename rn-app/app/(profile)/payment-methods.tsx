/**
 * Payment Methods Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-9681 (UPI), 41-9746 (Credit Card), 41-9811 (Bank Account)
 *
 * Features:
 * - List of saved payment methods (UPI, Credit Card, Bank Account)
 * - Set default method option
 * - Add new method option
 * - Delete/edit existing methods
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text } from '@/src/components';
import { useProfilePaymentMethods, useDeletePaymentMethod } from '@/src/hooks';
import { colors, spacing, radius, gradients } from '@/src/theme';
import type { SavedPaymentMethod as ProfilePaymentMethod } from '@/src/services/api/profile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design System Colors - mapped from Figma specs
const PAYMENT_COLORS = {
  background: '#131313',                 // Figma: black.700
  cardBackground: '#1A1A1A',             // Figma: black.600 (cards/surfaces)
  cardBodyDark: '#202020',               // Figma: black.500 (card bg)
  accentOrange: '#FF9A6D',              // Figma: brand.500 (accent)
  textPrimary: '#FFFFFF',               // Figma: white
  textSecondary: '#878787',             // Figma: neutral.600 (labels)
  textValues: '#CBCBCB',               // Figma: neutral.300 (values)
  textMuted: '#A9A9A9',                // Figma: neutral.500 (hint text)
  textHighEmphasis: '#DDDDDD',         // Figma: neutral.200 (payable rent value)
  divider: '#4D4D4D',                  // Figma: black.400 (dividers)
  upiGreen: colors.success.dark,         // #27803B
  upiOrange: '#E9661C',                // Figma: brand.800
  checkGreen: '#70BF73',               // Figma: success.default
  radioSelected: '#FF9A6D',            // Figma: brand.500
  radioUnselected: '#4D4D4D',          // Figma: black.400
  cashbackRed: '#EF9194',              // Figma: cashback locked color
  visaBlue: '#1A1F71',                   // Visa brand color (external)
} as const;

// UPI Logo component
const UPILogo = ({ size = 45 }: { size?: number }) => (
  <Svg width={size} height={size * 0.35} viewBox="0 0 45 16" fill="none">
    <Path d="M0 0H3V10C3 12 4 13 6 13C8 13 9 12 9 10V0H12V10C12 14 9 16 6 16C3 16 0 14 0 10V0Z" fill={PAYMENT_COLORS.textPrimary} />
    <Path d="M14 0H20C23 0 25 2 25 5C25 8 23 10 20 10H17V16H14V0ZM17 7H19C21 7 22 6 22 5C22 4 21 3 19 3H17V7Z" fill={PAYMENT_COLORS.textPrimary} />
    <Rect x="27" y="0" width="3" height="16" fill={PAYMENT_COLORS.textPrimary} />
    <Path d="M35 0L41 16H38L35 8V0Z" fill={PAYMENT_COLORS.upiOrange} />
    <Path d="M38 0L44 16H41L38 8V0Z" fill={PAYMENT_COLORS.upiGreen} />
  </Svg>
);

// Visa Logo component
const VisaLogo = ({ size = 45 }: { size?: number }) => (
  <Svg width={size} height={size * 0.35} viewBox="0 0 45 16" fill="none">
    <Path d="M16.5 0.5L13 15.5H10L13.5 0.5H16.5Z" fill={PAYMENT_COLORS.visaBlue} />
    <Path d="M27.5 0.5L22 10.5L21 0.5H17.5L19.5 15.5H23L30.5 0.5H27.5Z" fill={PAYMENT_COLORS.visaBlue} />
    <Path d="M39.5 0.5C38 0.5 37 1.5 36.5 2.5L30.5 15.5H34.5L35 13.5H40L40.5 15.5H44L41 0.5H39.5ZM36 10.5L38 4L39 10.5H36Z" fill={PAYMENT_COLORS.visaBlue} />
    <Path d="M9 0.5L5 10.5L4 2C4 1 3 0.5 2 0.5H0V1.5C1.5 2 3 2.5 4 3.5L6.5 15.5H10.5L14 0.5H9Z" fill={PAYMENT_COLORS.visaBlue} />
  </Svg>
);

// Radio button component
interface RadioButtonProps {
  selected: boolean;
  onPress: () => void;
}

function RadioButton({ selected, onPress }: RadioButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.radioButton}>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </TouchableOpacity>
  );
}

// Payment method row item
interface PaymentMethodItemProps {
  type: 'upi' | 'card' | 'bank';
  label: string;
  details: string;
  isDefault: boolean;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function PaymentMethodItem({
  type,
  label,
  details,
  isDefault,
  onSetDefault,
  onEdit,
  onDelete,
}: PaymentMethodItemProps) {
  const renderLogo = () => {
    switch (type) {
      case 'upi':
        return <UPILogo size={40} />;
      case 'card':
        return <VisaLogo size={40} />;
      case 'bank':
        return (
          <View style={styles.bankIcon}>
            <Ionicons name="business-outline" size={24} color={PAYMENT_COLORS.textPrimary} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.methodItem}>
      <View style={styles.methodContent}>
        <View style={styles.methodLeft}>
          <RadioButton selected={isDefault} onPress={onSetDefault} />
          <View style={styles.methodInfo}>
            {renderLogo()}
            <View style={styles.methodDetails}>
              <Text style={styles.methodLabel}>{label}</Text>
              <Text style={styles.methodDetailText}>{details}</Text>
            </View>
          </View>
        </View>
        <View style={styles.methodActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
            <Ionicons name="create-outline" size={20} color={PAYMENT_COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={20} color={PAYMENT_COLORS.accentOrange} />
          </TouchableOpacity>
        </View>
      </View>
      {isDefault && (
        <View style={styles.defaultBadge}>
          <Ionicons name="checkmark-circle" size={14} color={PAYMENT_COLORS.checkGreen} />
          <Text style={styles.defaultText}>Default</Text>
        </View>
      )}
    </View>
  );
}

// Section component
interface MethodSectionProps {
  title: string;
  children: React.ReactNode;
}

function MethodSection({ title, children }: MethodSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  );
}

/**
 * Derive display details from a saved payment method for the UI.
 */
function getMethodDisplayDetails(method: ProfilePaymentMethod): string {
  if (method.type === 'upi' && method.upiVpa) {
    // Mask part of the VPA: "rishabh@icici" -> "rish***@icici"
    const [local, domain] = method.upiVpa.split('@');
    const masked = local.length > 4 ? local.slice(0, 4) + '***' : local;
    return domain ? `${masked}@${domain}` : masked;
  }
  if (method.type === 'card') {
    const expiry = method.cardExpiryMonth && method.cardExpiryYear
      ? `Expires ${String(method.cardExpiryMonth).padStart(2, '0')}/${String(method.cardExpiryYear).slice(-2)}`
      : '';
    return expiry;
  }
  if (method.type === 'netbanking' && method.bankName) {
    return method.bankName;
  }
  return '';
}

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: methodsData, isLoading } = useProfilePaymentMethods();
  const deleteMethod = useDeletePaymentMethod();

  // Track which method is default per type (initialized from API data)
  const primaryId = methodsData?.primaryMethodId ?? null;
  const [defaultUpi, setDefaultUpi] = useState<string | null>(null);
  const [defaultCard, setDefaultCard] = useState<string | null>(null);
  const [defaultBank, setDefaultBank] = useState<string | null>(null);

  // Initialize default selections from API data
  React.useEffect(() => {
    if (methodsData?.groupedMethods) {
      const primaryUpi = methodsData.groupedMethods.upi.find(m => m.isPrimary);
      const primaryCard = methodsData.groupedMethods.cards.find(m => m.isPrimary);
      const primaryNb = methodsData.groupedMethods.netbanking.find(m => m.isPrimary);
      if (primaryUpi) setDefaultUpi(primaryUpi.id);
      else if (methodsData.groupedMethods.upi.length > 0) setDefaultUpi(methodsData.groupedMethods.upi[0].id);
      if (primaryCard) setDefaultCard(primaryCard.id);
      else if (methodsData.groupedMethods.cards.length > 0) setDefaultCard(methodsData.groupedMethods.cards[0].id);
      if (primaryNb) setDefaultBank(primaryNb.id);
      else if (methodsData.groupedMethods.netbanking.length > 0) setDefaultBank(methodsData.groupedMethods.netbanking[0].id);
    }
  }, [methodsData]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleAddMethod = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(payment)/select-method' as never);
  }, [router]);

  const handleDeleteMethod = useCallback(
    (methodId: string, methodName: string) => {
      Alert.alert(
        'Remove Payment Method',
        `Are you sure you want to remove ${methodName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              deleteMethod.mutate(methodId);
            },
          },
        ]
      );
    },
    [deleteMethod]
  );

  const handleEditMethod = useCallback((methodId: string, type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // No dedicated edit screen; re-use the add screen for the method type
    const addRoute = type === 'upi' ? '/(payment)/add-upi'
      : type === 'card' ? '/(payment)/add-card'
      : '/(payment)/add-netbanking';
    router.push({ pathname: addRoute as never, params: { editId: methodId } });
  }, [router]);

  // Map real data from the profile service (grouped by type)
  const upiMethods = (methodsData?.groupedMethods.upi ?? []).map(m => ({
    id: m.id,
    label: m.displayName,
    details: getMethodDisplayDetails(m),
  }));

  const cardMethods = (methodsData?.groupedMethods.cards ?? []).map(m => ({
    id: m.id,
    label: m.displayName,
    details: getMethodDisplayDetails(m),
  }));

  const bankMethods = (methodsData?.groupedMethods.netbanking ?? []).map(m => ({
    id: m.id,
    label: m.displayName,
    details: getMethodDisplayDetails(m),
  }));

  return (
    <Screen testID="payment-methods-screen">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={PAYMENT_COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleMain}>Payment</Text>
          <Text style={styles.titleAccent}>Methods</Text>
        </View>

        {/* UPI Methods Section */}
        <MethodSection title="UPI">
          {upiMethods.map((method, index) => (
            <React.Fragment key={method.id}>
              {index > 0 && <View style={styles.methodDivider} />}
              <PaymentMethodItem
                type="upi"
                label={method.label}
                details={method.details}
                isDefault={defaultUpi === method.id}
                onSetDefault={() => setDefaultUpi(method.id)}
                onEdit={() => handleEditMethod(method.id, 'upi')}
                onDelete={() => handleDeleteMethod(method.id, 'UPI Method')}
              />
            </React.Fragment>
          ))}
        </MethodSection>

        {/* Credit Card Section */}
        <MethodSection title="CREDIT CARD">
          {cardMethods.map((method, index) => (
            <React.Fragment key={method.id}>
              {index > 0 && <View style={styles.methodDivider} />}
              <PaymentMethodItem
                type="card"
                label={method.label}
                details={method.details}
                isDefault={defaultCard === method.id}
                onSetDefault={() => setDefaultCard(method.id)}
                onEdit={() => handleEditMethod(method.id, 'card')}
                onDelete={() => handleDeleteMethod(method.id, 'Credit Card')}
              />
            </React.Fragment>
          ))}
        </MethodSection>

        {/* Bank Account Section */}
        <MethodSection title="BANK ACCOUNT">
          {bankMethods.map((method, index) => (
            <React.Fragment key={method.id}>
              {index > 0 && <View style={styles.methodDivider} />}
              <PaymentMethodItem
                type="bank"
                label={method.label}
                details={method.details}
                isDefault={defaultBank === method.id}
                onSetDefault={() => setDefaultBank(method.id)}
                onEdit={() => handleEditMethod(method.id, 'bank')}
                onDelete={() => handleDeleteMethod(method.id, 'Bank Account')}
              />
            </React.Fragment>
          ))}
        </MethodSection>

        {/* Add Payment Method Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddMethod}
          accessibilityRole="button"
          accessibilityLabel="Add payment method"
        >
          <LinearGradient
            colors={gradients.button.colors as unknown as readonly [string, string, ...string[]]}
            locations={gradients.button.locations as unknown as readonly [number, number, ...number[]]}
            style={styles.addButtonGradient}
          >
            <Ionicons name="add" size={24} color={PAYMENT_COLORS.accentOrange} />
            <Text style={styles.addButtonText}>Add Payment Method</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Security Info */}
        <View style={styles.securityInfo}>
          <Ionicons name="shield-checkmark-outline" size={20} color={PAYMENT_COLORS.checkGreen} />
          <Text style={styles.securityText}>
            Your payment information is encrypted and securely stored
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: PAYMENT_COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  titleContainer: {
    marginBottom: spacing.xxl,
  },
  titleMain: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 40,
    lineHeight: 52,
    color: PAYMENT_COLORS.textPrimary,
    letterSpacing: -1,
    textAlign: 'center' as const,
  },
  titleAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 40,
    lineHeight: 52,
    color: PAYMENT_COLORS.accentOrange,
    letterSpacing: -1,
    textAlign: 'center' as const,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
    color: PAYMENT_COLORS.textSecondary,
    textTransform: 'uppercase',
    textAlign: 'left' as const,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: PAYMENT_COLORS.cardBodyDark,
    borderRadius: 12,
    overflow: 'hidden',
  },
  methodItem: {
    padding: spacing.md,
  },
  methodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  radioButton: {
    padding: spacing.xxs,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: PAYMENT_COLORS.radioUnselected,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: PAYMENT_COLORS.radioSelected,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PAYMENT_COLORS.radioSelected,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  bankIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: PAYMENT_COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodDetails: {
    flex: 1,
  },
  methodLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: PAYMENT_COLORS.textValues,
    textAlign: 'left' as const,
  },
  methodDetailText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: PAYMENT_COLORS.textSecondary,
    textAlign: 'left' as const,
  },
  methodActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.xs,
    marginLeft: 36,
  },
  defaultText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: PAYMENT_COLORS.checkGreen,
    textAlign: 'left' as const,
  },
  methodDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PAYMENT_COLORS.divider,
    marginHorizontal: spacing.md,
  },
  addButton: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAYMENT_COLORS.accentOrange,
    marginTop: spacing.lg,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  addButtonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: PAYMENT_COLORS.textPrimary,
    textAlign: 'center' as const,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: PAYMENT_COLORS.cardBodyDark,
    borderRadius: 12,
  },
  securityText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: PAYMENT_COLORS.textSecondary,
    textAlign: 'center' as const,
    flex: 1,
  },
});
