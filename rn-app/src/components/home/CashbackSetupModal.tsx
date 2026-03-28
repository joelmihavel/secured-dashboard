/**
 * Verification Check Sheet (CashbackSetupModal)
 * Figma Reference: 4109-3704
 *
 * Bottom sheet shown when user presses "Pay Rent" without completing verification.
 * Shows title + 3 horizontal setup step cards + CTA + skip link.
 *
 * - Primary Action: Dynamic — next incomplete step (e.g., "Upload address proof →")
 * - Secondary Action: "I'll do it later" → skip to payment flow
 * - Disappears when all verifications are complete (caller never opens it)
 *
 * Figma Pixel-Perfect Values:
 * - Sheet: bg #1A1A1A, borderTopRadius ~23
 * - Handle: 48x4, #4D4D4D, radius 200
 * - Title: 28/40, Medium (500), letterSpacing -1, #A9A9A9, px-48
 *   "Complete setup to get cashback from your rent payments"
 * - Setup cards: 3 horizontal, gap=4, same as CashbackSetupSteps
 * - CTA button: 297px, r=8, bg implied, "Upload address proof →" 14/20 Medium #FFFFFF
 * - Skip: "I'll do it later" 12/20 Regular #FFFFFF, px-48
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/src/components/ui/Typography/Text';
import { PrimaryButton } from '@/src/components/ui/Button/PrimaryButton';
import { CashbackSetupSteps } from './CashbackSetupSteps';
import type { SetupStep } from './CashbackSetupSteps';

// ── Public API ──────────────────────────────────────────────────────────────

export interface VerificationCheckSheetProps {
  visible: boolean;
  onClose: () => void;
  onFinishSetup: () => void;
  onSkipToPayment: () => void;
  utilityVerified: boolean;
  landlordApproved: boolean;
}

/**
 * VerificationCheckSheet — shown before payment when setup is incomplete.
 * Bank details are always treated as complete (prerequisite to reach home).
 */
export function VerificationCheckSheet({
  visible,
  onClose,
  onFinishSetup,
  onSkipToPayment,
  utilityVerified,
  landlordApproved,
}: VerificationCheckSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useSharedValue(SCREEN_HEIGHT);
  const fadeAnim = useSharedValue(0);

  // Android back button
  useEffect(() => {
    if (!visible) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => handler.remove();
  }, [visible, onClose]);

  // Slide + fade animation
  useEffect(() => {
    if (visible) {
      slideAnim.value = withSpring(0, {
        damping: 20,
        mass: 1,
        stiffness: 100,
        overshootClamping: true,
      });
      fadeAnim.value = withTiming(1, { duration: 250 });
    } else {
      slideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
      fadeAnim.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

  // Setup steps for the horizontal cards
  const steps: SetupStep[] = useMemo(() => [
    { id: 'bank', label: "Add your landlord's bank details", completed: true },
    { id: 'utility', label: 'Upload address proof', completed: utilityVerified },
    { id: 'landlord', label: 'Awaiting Landlord Approval', completed: landlordApproved },
  ], [utilityVerified, landlordApproved]);

  // Dynamic CTA label — points to next incomplete step
  const ctaLabel = useMemo(() => {
    if (!utilityVerified) return 'Upload address proof →';
    if (!landlordApproved) return 'Invite your landlord →';
    return 'Finish Setup →';
  }, [utilityVerified, landlordApproved]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Blur overlay */}
        <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
          <BlurView style={StyleSheet.absoluteFill} intensity={8} tint="dark" />
          <TouchableOpacity
            style={styles.overlayTouchable}
            onPress={onClose}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Close setup sheet"
          />
        </Animated.View>

        {/* Bottom sheet */}
        <Animated.View
          style={[
            styles.sheet,
            sheetAnimatedStyle,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          {/* Handle — Figma: 48x4, #4D4D4D */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Title — Figma: 28px/500, #A9A9A9, px-48 */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>
                Complete setup to get cashback from your rent payments
              </Text>
            </View>

            {/* Setup Steps — 3 horizontal cards */}
            <CashbackSetupSteps
              steps={steps}
              layout="horizontal"
            />

            {/* Actions — Figma: px-48, gap-32 */}
            <View style={styles.actions}>
              <PrimaryButton
                title={ctaLabel}
                onPress={onFinishSetup}
                showDivider
              />
              <TouchableOpacity
                onPress={onSkipToPayment}
                style={styles.skipButton}
                activeOpacity={0.7}
              >
                <Text style={styles.skipText}>I'll do it later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** @deprecated Use VerificationCheckSheet instead */
export const CashbackSetupModal = VerificationCheckSheet;

// ── Constants & Styles ──────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 10,
  },
  overlayTouchable: {
    flex: 1,
  },
  // Sheet — Figma: bg #1A1A1A, borderTopRadius ~23
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    paddingTop: 15,
    zIndex: 20,
    gap: 24,
  },
  // Handle — Figma: 48x4, #4D4D4D, centered
  handleContainer: {
    alignItems: 'center',
  },
  handle: {
    width: 48, // Figma: 48px (updated from 24)
    height: 4, // Figma: 4px
    backgroundColor: '#4D4D4D',
    borderRadius: 200,
  },
  // Content wrapper
  content: {
    gap: 30, // Figma: ~30px gap between major sections
  },
  // Title — Figma: 28px Medium, #A9A9A9, px-48
  titleContainer: {
    paddingHorizontal: 48,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 28, // Figma: 28px
    lineHeight: 40, // Figma: 40
    letterSpacing: -1, // Figma: -1
    color: '#A9A9A9', // Figma: #A9A9A9
  },
  // Actions — Figma: px-48, gap-32
  actions: {
    paddingHorizontal: 48,
    gap: 32, // Figma: 32px between button and skip
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20
    color: '#FFFFFF', // Figma: white
  },
});
