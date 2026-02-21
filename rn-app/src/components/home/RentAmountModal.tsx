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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/src/components/ui/Typography/Text';
import { TextInput } from '@/src/components/ui/Input/TextInput';
import { PrimaryButton } from '@/src/components/ui/Button/PrimaryButton';
import { colors } from '@/src/theme';

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
  titleWhite: '#FFFFFF',
  titleAccent: '#FF9A6D',
  border: '#4D4D4D',
  background: colors.black[700],
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

  const [amount, setAmount] = useState(initialAmount > 0 ? String(initialAmount) : '');

  // Reset amount when modal opens
  useEffect(() => {
    if (visible && initialAmount > 0) {
      setAmount(String(initialAmount));
    }
  }, [visible, initialAmount]);

  // Handle back button on Android
  useEffect(() => {
    if (!visible) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => backHandler.remove();
  }, [visible, onClose]);

  // Animate sheet in/out
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
    if (amount && parseFloat(amount) > 0) {
      onPay(amount);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: fadeAnim },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          >
            <BlurView
              intensity={40}
              tint="dark"
              style={StyleSheet.absoluteFill}
              experimentalBlurMethod="dimezisBlurView"
            />
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
              <Text style={styles.title}>
                <Text style={{ color: FIGMA_COLORS.titleWhite }}>Enter rent payment </Text>
                <Text style={{ color: FIGMA_COLORS.titleAccent }}>amount</Text>
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  label="Rent Amount"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="e.g. 25000"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.buttonContainer}>
                <PrimaryButton
                  title="Pay Rent"
                  onPress={handlePayPress}
                  disabled={!amount || parseFloat(amount) <= 0}
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    // Modal dropshadow
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
    borderRadius: 2,
    backgroundColor: FIGMA_COLORS.handle,
  },
  content: {
    paddingHorizontal: 48,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
    textAlign: 'center',
    color: FIGMA_COLORS.titleWhite,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 8,
  },
  buttonContainer: {
    width: '100%',
  },
});