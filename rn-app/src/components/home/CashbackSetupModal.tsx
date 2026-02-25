/**
 * Verification Check Sheet (formerly CashbackSetupModal)
 * Figma Reference: 684-11916 (Verification check bottom sheet)
 *
 * Bottom sheet shown when user presses "Review & Pay" without completing verification.
 * Shows pending verification steps (utility address, landlord approval).
 * - Primary Action: "Finish Setup" -> Go to /(setup)/pending-steps
 * - Secondary Action: "I will do it later" -> Skip to payment flow
 *
 * @deprecated CashbackSetupModal — use VerificationCheckSheet instead
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  BackHandler,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/src/components/ui/Typography/Text';
import { PrimaryButton } from '@/src/components/ui/Button/PrimaryButton';
import { colors } from '@/src/theme';
import { scaledSpacing } from '@/src/theme/scale';

export interface VerificationCheckSheetProps {
  visible: boolean;
  onClose: () => void;
  onFinishSetup: () => void;
  onSkipToPayment: () => void;
  utilityVerified: boolean;
  landlordApproved: boolean;
}

/** @deprecated Use VerificationCheckSheetProps */
interface CashbackSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSetup: () => void;
  onSkip: () => void;
  bankDetailsComplete?: boolean;
  addressProofComplete?: boolean;
  landlordInvited?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Exact Figma colors from 243-6731
const FIGMA_COLORS = {
  sheetBg: '#1A1A1A',
  handle: '#4D4D4D',
  titleWhite: '#FFFFFF',
  itemTitle: '#CBCBCB',
  itemSubtitle: '#878787',
  indicatorActive: '#FF9A6D',
  indicatorInactive: '#1A1A1A',
  lineActive: '#FFAE8A',
  lineInactive: '#A6A6A6',
};

export function CashbackSetupModal({
  visible,
  onClose,
  onSetup,
  onSkip,
  bankDetailsComplete = false,
  addressProofComplete = false,
  landlordInvited = false,
}: CashbackSetupModalProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  if (!visible) return null;

  const setupItems = [
    {
      title: "Add landlord's bank details",
      subtitle: 'enables secure payouts',
      isComplete: bankDetailsComplete,
    },
    {
      title: 'Upload address proof',
      subtitle: 'for verification',
      isComplete: addressProofComplete,
    },
    {
      title: 'Invite your landlord',
      subtitle: 'needed for cashback eligibility',
      isComplete: landlordInvited,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Blur Overlay - Figma: radius 8, opacity 0.6 */}
        <Animated.View style={[styles.overlayContainer, { opacity: fadeAnim }]}>
          <BlurView style={StyleSheet.absoluteFill} intensity={8} tint="dark" />
          <TouchableOpacity
            style={styles.overlayTouchable}
            onPress={onClose}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Close cashback setup"
          />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: Math.max(insets.bottom, 24),
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <View style={styles.content}>
            {/* Title */}
            <Text style={styles.title}>
              Set up to earn cashback{'\n'}on this payment.
            </Text>

            {/* Checklist */}
            <View style={styles.checklist}>
              {setupItems.map((item, index) => {
                const isLast = index === setupItems.length - 1;
                return (
                  <View key={index} style={styles.itemRow}>
                    <View style={styles.indicatorColumn}>
                      <View
                        style={[
                          styles.indicator,
                          {
                            backgroundColor: item.isComplete
                              ? FIGMA_COLORS.indicatorActive
                              : FIGMA_COLORS.indicatorInactive,
                          },
                        ]}
                      />
                      {!isLast && (
                        <View
                          style={[
                            styles.connectingLine,
                            {
                              backgroundColor: item.isComplete
                                ? FIGMA_COLORS.lineActive
                                : FIGMA_COLORS.lineInactive,
                            },
                          ]}
                        />
                      )}
                    </View>

                    <View style={styles.itemTextContainer}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <PrimaryButton
                title="Finish Setup"
                onPress={onSetup}
                showDivider
              />
              <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>I'll do it later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 10,
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: FIGMA_COLORS.sheetBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 15,
    zIndex: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingBottom: 30, // Matches spacing to content
  },
  handle: {
    width: 48,
    height: 4,
    backgroundColor: FIGMA_COLORS.handle,
    borderRadius: 200,
  },
  content: {
    paddingHorizontal: 48,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
    color: FIGMA_COLORS.titleWhite,
    marginBottom: 24,
  },
  checklist: {
    gap: 24,
    marginBottom: 32,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  indicatorColumn: {
    alignItems: 'center',
    width: 20,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  connectingLine: {
    width: 1,
    height: 52,
    marginTop: 4,
  },
  itemTextContainer: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.itemTitle,
  },
  itemSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.itemSubtitle,
  },
  actions: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.titleWhite,
  },
});

/**
 * VerificationCheckSheet — New API wrapping CashbackSetupModal
 * Shows only pending verification steps (utility, landlord).
 */
export function VerificationCheckSheet({
  visible,
  onClose,
  onFinishSetup,
  onSkipToPayment,
  utilityVerified,
  landlordApproved,
}: VerificationCheckSheetProps) {
  return (
    <CashbackSetupModal
      visible={visible}
      onClose={onClose}
      onSetup={onFinishSetup}
      onSkip={onSkipToPayment}
      bankDetailsComplete={true}
      addressProofComplete={utilityVerified}
      landlordInvited={landlordApproved}
    />
  );
}

