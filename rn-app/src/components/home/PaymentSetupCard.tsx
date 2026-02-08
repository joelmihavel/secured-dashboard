/**
 * PaymentSetupCard Component
 * "Setup your payment method to start" card for zero/pending states - Figma pixel-perfect
 * Figma Reference: 243-4062
 *
 * Figma Pixel-Perfect Values:
 * - Card container: width 270, borderRadius 12
 * - Top section (frame_2095586440): width 270, backgroundColor #202020
 *   - paddingTop 24, paddingRight 32, paddingBottom 64, paddingLeft 32, gap 64
 * - Title: "Setup your payment method to start"
 *   - width 206, fontSize 20, lineHeight 32, fontWeight 400, color #CBCBCB
 * - Subtitle: "Add UPI, card, or bank to start earning rewards"
 *   - width 206, fontSize 14, lineHeight 20, fontWeight 400, color #878787
 * - Footer (frame_2095586341): width 270, height 64, backgroundColor #1A1A1A
 *   - paddingTop 16, paddingRight 32, paddingBottom 24, paddingLeft 32, gap 16
 * - Footer label: "NEW PAYMENT", fontSize 14, lineHeight 20, fontWeight 400, color #CBCBCB
 * - Button (frame_2095586312): borderColor #FF9A6D, borderWidth 1, borderRadius 8
 *   - paddingVertical 16, paddingHorizontal 16
 *   - shadow: #995C41, offset 0/6, blur 12
 * - Button text: "+ Add Payment", fontSize 14, fontWeight 500, color #FFFFFF
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Text, Logo } from '@/src/components/ui';
import { colors } from '@/src/theme';

export interface PaymentSetupCardProps {
  onAddPayment?: () => void;
}

function PaymentSetupCardComponent({ onAddPayment }: PaymentSetupCardProps) {
  return (
    <View style={styles.cardWrapper}>
      <View style={styles.card}>
        {/* Top content area */}
        <View style={styles.topSection}>
          {/* Background with pattern */}
          <View style={styles.patternOverlay} />

          <View style={styles.topContent}>
            {/* Title text */}
            <View style={styles.titleBlock}>
              <Text style={styles.titleLine}>
                <Text style={styles.accentText}>Setup</Text>
                <Text style={styles.grayText}> your payment method to start</Text>
              </Text>
              <Text style={styles.subtitle}>
                Add UPI, card, or bank to start earning rewards
              </Text>
            </View>

            {/* Add Payment button */}
            <GradientBorderButton
              title="+ Add Payment"
              onPress={onAddPayment}
            />
          </View>
        </View>

        {/* Footer section */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerLabel}>NEW PAYMENT</Text>
            <Ionicons name="information-circle-outline" size={14} color={colors.neutral[300]} />
          </View>
          <Logo size={24} />
        </View>
      </View>
    </View>
  );
}

interface GradientBorderButtonProps {
  title: string;
  onPress?: () => void;
}

function GradientBorderButton({ title, onPress }: GradientBorderButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.buttonContainer}>
      {/* Top bar indicator */}
      <View style={styles.topIndicator} />

      {/* Button content */}
      <LinearGradient
        colors={['#202020', '#0D0D0D']}
        style={styles.buttonGradient}
      >
        <Text style={styles.buttonText}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Figma pixel-perfect styles
const styles = StyleSheet.create({
  cardWrapper: {
    // No padding - let parent container handle positioning
    // Carousel handles paddingLeft: 64, standalone usage handles its own
  },
  card: {
    width: 270, // Figma: width 270
    borderRadius: 12, // Figma: borderRadius 12
    overflow: 'hidden',
  },
  topSection: {
    backgroundColor: '#202020', // Figma: #202020 (black[500])
    position: 'relative',
  },
  patternOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.64)',
  },
  topContent: {
    paddingTop: 24, // Figma: paddingTop 24
    paddingBottom: 24, // Figma: paddingBottom 64 (adjusted for button area)
    paddingLeft: 32, // Figma: paddingLeft 32
    paddingRight: 32, // Figma: paddingRight 32
    gap: 24, // Figma: gap 24
  },
  titleBlock: {
    gap: 8, // Figma: gap between title and subtitle
    width: 206, // Figma: width 206
  },
  titleLine: {
    fontSize: 20, // Figma: fontSize 20
    lineHeight: 32, // Figma: lineHeight 32
    fontWeight: '400', // Figma: fontWeight 400
  },
  accentText: {
    color: '#FF9A6D', // Figma: #FF9A6D (brand[500])
    fontSize: 20, // Figma: fontSize 20
    lineHeight: 32, // Figma: lineHeight 32
    fontWeight: '400', // Figma: fontWeight 400
  },
  grayText: {
    color: '#CBCBCB', // Figma: #CBCBCB (neutral[300])
    fontSize: 20, // Figma: fontSize 20
    lineHeight: 32, // Figma: lineHeight 32
    fontWeight: '400', // Figma: fontWeight 400
  },
  subtitle: {
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400', // Figma: fontWeight 400
    color: '#878787', // Figma: #878787 (neutral[600])
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64, // Figma: height 64
    paddingTop: 16, // Figma: paddingTop 16
    paddingBottom: 24, // Figma: paddingBottom 24
    paddingHorizontal: 32, // Figma: paddingHorizontal 32
    backgroundColor: '#1A1A1A', // Figma: #1A1A1A (black[600])
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // Figma: gap 16
  },
  footerLabel: {
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400', // Figma: fontWeight 400
    color: '#CBCBCB', // Figma: #CBCBCB (neutral[300])
  },
  // Button styles
  buttonContainer: {
    alignItems: 'center',
    gap: 8, // Figma: gap between indicator and button
  },
  topIndicator: {
    width: 24, // Figma: width 24
    height: 2, // Figma: height 2
    backgroundColor: '#4D4D4D', // Figma: #4D4D4D (black[400])
    borderRadius: 200, // Figma: borderRadius 200
  },
  buttonGradient: {
    width: 164.5, // Figma: width ~164.5
    height: 52, // Figma: height 52
    paddingVertical: 16, // Figma: paddingVertical 16
    paddingHorizontal: 16, // Figma: paddingHorizontal 16
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8, // Figma: borderRadius 8
    borderWidth: 1, // Figma: borderWidth 1
    borderColor: '#FF9A6D', // Figma: #FF9A6D (brand[500])
    // Shadow - Figma: #995C41, offset 0/6, blur 12
    shadowColor: '#995C41',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: {
    fontSize: 14, // Figma: fontSize 14
    fontWeight: '500', // Figma: fontWeight 500
    lineHeight: 20, // Figma: lineHeight 20
    color: colors.white, // Figma: #FFFFFF
    textAlign: 'center',
  },
});

export const PaymentSetupCard = memo(PaymentSetupCardComponent);
export { GradientBorderButton };
