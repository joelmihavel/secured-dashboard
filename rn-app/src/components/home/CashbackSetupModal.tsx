/**
 * Cashback Setup Modal
 * Figma Reference: 243-7185 (Setup to earn cashback)
 *
 * Modal that appears when user tries to pay without completing setup.
 * - Title: "Set up to earn cashback"
 * - Subtitle: "Complete your account setup..."
 * - Primary Action: "Set up now" -> Go to pending-steps
 * - Secondary Action: "I'll do this later" -> Continue to payment
 */

import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

import { Text, PrimaryButton } from '@/src/components';
import { colors, radius, spacing, typography } from '@/src/theme';
import { scaled, scaledFont, scaledSpacing } from '@/src/theme/scale';

interface CashbackSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSetup: () => void;
  onSkip: () => void;
}

// Custom Coin Icon from Figma (vector_57 / vector_58 style)
const CoinIcon = () => (
  <Svg width={scaled(64)} height={scaled(64)} viewBox="0 0 64 64" fill="none">
    <Path
      d="M32 60C47.464 60 60 47.464 60 32C60 16.536 47.464 4 32 4C16.536 4 4 16.536 4 32C4 47.464 16.536 60 32 60Z"
      fill={colors.black[500]} // Figma: #202020 -> colors.black[500]
      stroke={colors.brand[500]} // Figma: #FF9A6D -> colors.brand[500]
      strokeWidth={2}
    />
    <Path
      d="M32 42V22M22 32H42"
      stroke={colors.brand[500]} // Figma: #FF9A6D -> colors.brand[500]
      strokeWidth={3}
      strokeLinecap="round"
    />
  </Svg>
);

export function CashbackSetupModal({ visible, onClose, onSetup, onSkip }: CashbackSetupModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Figma: Rectangle 54 - BACKGROUND_BLUR radius: 8, opacity: 0.6 */}
        <BlurView intensity={8} style={StyleSheet.absoluteFill} tint="dark" />
        
        <View style={styles.modalContent}>
          {/* Close Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral[500]} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <CoinIcon />
          </View>

          {/* Text Content */}
          <Text style={styles.title}>Set up to earn cashback</Text>
          <Text style={styles.subtitle}>
            Complete your account setup to unlock cashback on every rent payment.
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            <PrimaryButton
              title="Set up now"
              onPress={onSetup}
              style={styles.primaryButton}
            />
            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>I'll do this later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    // Figma: Rectangle 54 - backgroundColor #000000 opacity 0.6
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaledSpacing(24),
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.black[500], // Figma: cardBackground -> colors.black[500]
    borderRadius: scaled(24),
    padding: scaledSpacing(32),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.black[400], // Figma: border -> colors.black[400]
  },
  closeButton: {
    position: 'absolute',
    top: scaledSpacing(16),
    right: scaledSpacing(16),
    padding: 8,
  },
  iconContainer: {
    marginBottom: scaledSpacing(24),
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: scaledFont(24),
    lineHeight: scaledFont(32),
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: scaledSpacing(12),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(16),
    lineHeight: scaledFont(24),
    color: colors.neutral[500], // Figma: #A9A9A9 -> colors.neutral[500]
    textAlign: 'center',
    marginBottom: scaledSpacing(32),
  },
  actions: {
    width: '100%',
    gap: scaledSpacing(16),
  },
  primaryButton: {
    width: '100%',
  },
  skipButton: {
    paddingVertical: scaledSpacing(12),
    alignItems: 'center',
  },
  skipText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: scaledFont(14),
    color: colors.neutral[600], // Figma: #878787 -> colors.neutral[600]
  },
});
