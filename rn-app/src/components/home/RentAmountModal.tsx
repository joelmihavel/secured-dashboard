import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/src/components/ui/Typography/Text';
import { PrimaryButton } from '@/src/components/ui/Button/PrimaryButton';
import { colors } from '@/src/theme';
import { useDashboard } from '@/src/hooks';

interface RentAmountModalProps {
  visible: boolean;
  onClose: () => void;
  onPay: (amount: string) => void;
  initialAmount?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const FIGMA_COLORS = {
  sheetBg: '#1A1A1A',
  handle: '#4D4D4D',
  titleAccent: '#A9A9A9',
  amountText: '#BABABA',
  warningBg: '#131313',
  warningText: '#FF9A6D',
};

export function RentAmountModal({
  visible,
  onClose,
  onPay,
  initialAmount = 0,
}: RentAmountModalProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const [amount, setAmount] = useState(initialAmount > 0 ? String(initialAmount) : '');

  const { tenancy, upcomingPayment } = useDashboard();
  
  // Base details for validation
  const baseRent = tenancy?.monthly_rent || 30000;
  const daysUntilDue = upcomingPayment?.days_until_due ?? 10;
  const maxRent = baseRent + 500; // rough estimate for contract max
  
  const date = new Date();
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const rentMonthText = upcomingPayment?.rent_month 
    ? upcomingPayment.rent_month.toUpperCase() 
    : `${monthNames[date.getMonth()]} ${date.getFullYear()} RENT`;

  useEffect(() => {
    if (visible && initialAmount > 0) {
      setAmount(String(initialAmount));
    }
  }, [visible, initialAmount]);

  useEffect(() => {
    if (visible) {
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => backHandler.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          mass: 1,
          stiffness: 100,
          overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 2,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handlePayPress = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > maxRent) {
      // Prevent proceeding if greater than contract value
      return;
    }
    if (amount && numAmount > 0) {
      onPay(amount);
    }
  };

  const numAmount = parseFloat(amount) || 0;
  const isReducedRent = numAmount > 0 && numAmount < baseRent;
  const isExceededRent = numAmount > maxRent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
            <View style={styles.overlay} />
          </TouchableOpacity>
        </Animated.View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [{ translateY: slideAnim }],
                paddingBottom: Math.max(insets.bottom, 24),
              },
            ]}
          >
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            <View style={styles.content}>
              {/* Header row */}
              <View style={styles.headerRow}>
                <Text style={styles.title}>{rentMonthText}</Text>
                <Text style={styles.title}>DUE IN {Math.max(0, daysUntilDue)} DAYS</Text>
              </View>

              {/* Amount Input */}
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>₹  </Text>
                <TextInput
                  ref={inputRef}
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#4D4D4D"
                  maxLength={9}
                />
              </View>

              {/* Warning Messages */}
              {isExceededRent ? (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningText}>⚠️ Rent cannot exceed contract value.</Text>
                </View>
              ) : isReducedRent ? (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningText}>⚠️ Cashback will apply on reduced rent</Text>
                </View>
              ) : (
                <View style={styles.warningPlaceholder} />
              )}

              {/* Button */}
              <View style={styles.buttonContainer}>
                <PrimaryButton
                  title="Proceed to Pay"
                  onPress={handlePayPress}
                  disabled={!amount || numAmount <= 0 || isExceededRent}
                />
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardView: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: FIGMA_COLORS.sheetBg,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 200,
    backgroundColor: FIGMA_COLORS.handle,
  },
  content: {
    paddingHorizontal: 48,
    paddingTop: 4, // Header was shifted down due to the 15.19 padding, handleContainer gives 12+4=16
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 48,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.titleAccent,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 52, // spacing adjusted for fidelity
  },
  currencySymbol: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,
    color: FIGMA_COLORS.amountText,
  },
  amountInput: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,
    color: FIGMA_COLORS.amountText,
    minWidth: 120,
    textAlign: 'left', // Ensure it flows naturally after the currency symbol
    padding: 0,
    margin: 0,
  },
  warningContainer: {
    backgroundColor: FIGMA_COLORS.warningBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 24,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  warningPlaceholder: {
    height: 36,
    marginBottom: 24,
  },
  warningText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.warningText,
  },
  buttonContainer: {
    width: '100%',
  },
});
