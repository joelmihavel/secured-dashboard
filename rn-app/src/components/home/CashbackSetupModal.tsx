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
 *   "Complete setup to become a verified member"
 * - Setup cards: 3 horizontal, gap=4, same as CashbackSetupSteps
 * - CTA button: 297px, r=8, bg implied, "Upload address proof →" 14/20 Medium #FFFFFF
 * - Skip: "I'll do it later" 12/20 Regular #FFFFFF, px-48
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text as RNText,
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

import { PrimaryButton } from '@/src/components/ui/Button/PrimaryButton';
import { colors } from '@/src/theme';

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

  // Setup steps for progress bar
  const steps = useMemo(() => [
    { label: "Add landlord's\nbank details", completed: true },
    { label: 'Verify your\naddress', completed: utilityVerified },
    { label: 'Invite your\nlandlord', completed: landlordApproved },
  ], [utilityVerified, landlordApproved]);

  // Dynamic CTA label — points to next incomplete step
  const ctaLabel = useMemo(() => {
    if (!utilityVerified) return 'Verify address →';
    if (!landlordApproved) return 'Invite landlord →';
    return 'Finish setup →';
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
            {/* Title — Figma: 28px/500, mixed colors, px-48 */}
            <View style={styles.titleContainer}>
              <RNText style={styles.title}>
                {'Complete setup to become a '}
                <RNText style={styles.titleAccent}>verified member</RNText>
              </RNText>
            </View>

            {/* Progress Bar — same dot+line pattern as TransactionProgressBar */}
            <View style={styles.progressBar}>
              <View style={styles.trackRow}>
                <View style={[styles.dot, steps[0].completed && styles.dotCompleted]} />
                <View style={[styles.progressLine, steps[0].completed && styles.lineCompleted]} />
                <View style={[styles.dot, steps[1].completed && styles.dotCompleted]} />
                <View style={[styles.progressLine, steps[1].completed && styles.lineCompleted]} />
                <View style={[styles.dot, steps[2].completed && styles.dotCompleted]} />
              </View>
              <View style={styles.labelRow}>
                <RNText style={[styles.stepLabel, styles.labelLeft]}>{steps[0].label}</RNText>
                <RNText style={[styles.stepLabel, styles.labelCenter]}>{steps[1].label}</RNText>
                <RNText style={[styles.stepLabel, styles.labelRight]}>{steps[2].label}</RNText>
              </View>
            </View>

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
                <RNText style={styles.skipText}>I'll do it later</RNText>
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
    gap: 24, // Figma: gap between sections
  },
  // Title — Figma: 28px Medium, mixed colors, px-48
  titleContainer: {
    paddingHorizontal: 48,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
    color: '#A9A9A9', // Figma: gray for first part
  },
  titleAccent: {
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
    color: colors.brand[500], // Figma: #FF9A6D for second part
  },
  // Progress bar — same dot+line pattern as TransactionProgressBar
  progressBar: {
    paddingHorizontal: 48,
    gap: 8,
  },
  trackRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 4, // Figma: r=4 (rounded square)
    backgroundColor: colors.black[500], // #202020 — pending
    borderWidth: 1,
    borderColor: colors.brand[500], // #FF9A6D outline
  },
  dotCompleted: {
    backgroundColor: colors.brand[500], // #FF9A6D — filled
    borderColor: colors.brand[500],
  },
  progressLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.black[400], // #4D4D4D
  },
  lineCompleted: {
    backgroundColor: colors.brand[500], // #FF9A6D
  },
  labelRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  stepLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: colors.neutral[600], // #878787
    width: 97, // Figma: ~97px per label column
  },
  labelLeft: { textAlign: 'left' as const },
  labelCenter: { textAlign: 'center' as const },
  labelRight: { textAlign: 'right' as const },
  // Actions — Figma: px-48, centered
  actions: {
    paddingHorizontal: 48,
    gap: 12,
    alignItems: 'center' as const,
  },
  skipButton: {
    paddingVertical: 4,
  },
  skipText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    textDecorationLine: 'underline',
    textDecorationColor: '#FFFFFF',
    textDecorationStyle: 'solid',
  } as const,
});
