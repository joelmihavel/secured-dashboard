/**
 * Verification Check Sheet (CashbackSetupModal)
 * Figma Reference: 791:6679
 *
 * Bottom sheet shown when user presses "Pay Rent" without completing verification.
 * Shows the same verification progress timeline as SetupProgressCard.
 *
 * - Primary Action: "Finish Setup" → navigate to /(setup)/pending-steps
 * - Secondary Action: "I'll do it later" → skip to payment flow
 * - Disappears when all verifications are complete (caller never opens it)
 *
 * Figma Pixel-Perfect Values:
 * - Sheet: bg #1A1A1A, borderTopRadius 22.788
 * - Handle: 24x2, #4D4D4D, radius 200
 * - Title (791:6690): 28/40, Regular, letterSpacing -1, px-48
 *   "Set up to " (white) + "earn cashback " (#FF9A6D) + "on this payment." (white)
 * - Sub-header (791:10135): 14/20, Regular, #CBCBCB — "Waiting for Landlord's approval"
 * - Timeline: same 3 steps as SetupProgressCard, px-48, gap-16
 * - Actions (791:6713): px-48, gap-32
 *   - "Finish Setup" button (PrimaryButton with showDivider)
 *   - "I'll do it later": 12/20, white, underlined
 */

import React, { useEffect } from 'react';
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

import { Text } from '@/src/components/ui/Typography/Text';
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

  // Slide + fade animation (UI thread via Reanimated)
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

  if (!visible) return null;

  // Same progress logic as SetupProgressCard
  const steps = [
    {
      title: "Add landlord's bank details",
      subtitle: 'enables secure payouts',
      isComplete: true, // bank is always done (prerequisite)
    },
    {
      title: 'Upload address proof',
      subtitle: 'for verification',
      isComplete: utilityVerified,
    },
    {
      title: 'Confirm your tenancy',
      subtitle: landlordApproved
        ? 'Landlord is invited'
        : 'waiting for landlord approval',
      isComplete: landlordApproved,
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
          {/* Handle — Figma I791:6714;137:37: 24x2, #4D4D4D */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Title — Figma 791:6690 */}
          <View style={styles.titleContainer}>
            <RNText style={styles.title}>
              <RNText style={styles.titleWhite}>{'Set up to '}</RNText>
              <RNText style={styles.titleAccent}>{'earn cashback '}</RNText>
              <RNText style={styles.titleWhite}>on this payment.</RNText>
            </RNText>
          </View>

          {/* Progress section — Figma 791:6691 */}
          <View style={styles.progressSection}>
            {/* Sub-header — Figma 791:10135 */}
            <Text style={styles.subHeader}>
              {!utilityVerified 
                ? 'Address proof pending' 
                : 'Waiting for Landlord\'s approval'}
            </Text>

            {/* Timeline — same visual as SetupProgressCard */}
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              const nextStep = !isLast ? steps[index + 1] : null;
              const isConnectorActive = step.isComplete && nextStep?.isComplete;
              return (
                <View key={index} style={styles.timelineRow}>
                  <View style={styles.indicatorColumn}>
                    <View style={styles.indicatorContainer}>
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor: step.isComplete
                              ? colors.brand[500]
                              : colors.black[600],
                          },
                        ]}
                      />
                    </View>
                    {!isLast && (
                      <View
                        style={[
                          styles.connectorLine,
                          {
                            backgroundColor: isConnectorActive
                              ? 'rgba(255, 154, 109, 0.5)'
                              : colors.black[400],
                          },
                        ]}
                      />
                    )}
                  </View>
                  <View style={[styles.textColumn, isLast && styles.textColumnLast]}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Actions — Figma 791:6713 */}
          <View style={styles.actions}>
            <PrimaryButton
              title="Finish Setup"
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
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Deprecated export — kept for backwards compat ───────────────────────────

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
  // Sheet — Figma 791:6679: bg #1A1A1A, borderTopRadius ~23
  sheet: {
    backgroundColor: colors.black[600], // #1A1A1A
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    paddingTop: 15,
    zIndex: 20,
    gap: 24,
  },
  // Handle — Figma: 24x2, #4D4D4D, centered
  handleContainer: {
    alignItems: 'center',
  },
  handle: {
    width: 24,
    height: 2,
    backgroundColor: colors.black[400], // #4D4D4D
    borderRadius: 200,
  },
  // Title — Figma 791:6690: px-48, 28/40, letterSpacing -1
  titleContainer: {
    paddingHorizontal: 48,
    paddingTop: 16,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
  },
  titleWhite: {
    color: colors.white,
  },
  titleAccent: {
    color: colors.brand[500], // #FF9A6D
  },
  // Progress section — Figma 791:6691: px-48, gap-16
  progressSection: {
    paddingHorizontal: 48,
    gap: 16,
  },
  // Sub-header — Figma 791:10135
  subHeader: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[300], // #CBCBCB
  },
  // Timeline — matches SetupProgressCard exactly
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  indicatorColumn: {
    width: 20,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  indicatorContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  connectorLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.black[400], // #4D4D4D
  },
  textColumn: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    paddingBottom: 16, // Figma gap between timeline rows (within 16-gap section)
  },
  textColumnLast: {
    paddingBottom: 0,
  },
  stepTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[300], // #CBCBCB
  },
  stepSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[600], // #878787
  },
  // Actions — Figma 791:6713: px-48, gap-32
  actions: {
    paddingHorizontal: 48,
    gap: 16,
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.white,
    textDecorationLine: 'underline',
  },
});
