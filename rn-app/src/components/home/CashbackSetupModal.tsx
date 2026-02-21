/**
 * Cashback Setup Modal
 * Figma Reference: 243-6731 (Setup to earn cashback bottom sheet)
 *
 * Modal that appears when user tries to pay without completing setup.
 * - Bottom sheet design with blur overlay
 * - Title: "Set up to earn cashback on this payment."
 * - Setup Checklist
 * - Primary Action: "Finish Setup" -> Go to pending-steps
 * - Secondary Action: "I'll do it later" -> Continue to payment
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

interface CashbackSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSetup: () => void;
  onSkip: () => void;
  // Optional props to show actual progress
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
  titleAccent: '#FF9A6D',
  itemTitle: '#CBCBCB',
  itemSubtitle: '#878787',
  indicatorActive: '#FF9A6D',
  indicatorInactive: '#1A1A1A',
  lineActive: 'rgba(255, 154, 109, 0.5)',
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
              Set up to <Text inherit style={styles.titleAccent}>earn cashback{'\n'}</Text>
              on this payment.
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
  titleAccent: {
    color: FIGMA_COLORS.titleAccent,
  },
  checklist: {
    gap: 16,
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
    height: 35,
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
    textDecorationLine: 'underline',
  },
});

