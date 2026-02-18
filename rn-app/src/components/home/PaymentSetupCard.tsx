/**
 * PaymentSetupCard Component
 * Two variants based on Figma:
 *
 * Variant "standalone" (Figma 243-4062): Empty state card shown outside carousel
 * - Title: "Setup your payment method to start" (Setup in orange, rest in #CBCBCB)
 * - Subtitle: "Add UPI, card, or bank to start earning rewards" (#878787)
 * - Footer: "NEW PAYMENT" in #CBCBCB + info icon + Flent logo
 * - Top section: 270x(auto), bg #202020, padding [24,32,64,32], gap 64
 *
 * Variant "add-more" (Figma 243-4052): Carousel card alongside existing payment methods
 * - Text: "+  Setup your payment method to start" (+ in orange #FF9A6D, rest in #CBCBCB)
 * - Content centered vertically (primary=CENTER, counter=CENTER)
 * - Top section: 270x344, bg #202020, padding [24,32,24,32], gap 120
 * - Footer: "+ NEW PAYMENT" in #FF9A6D + info icon + Flent logo
 *
 * Common:
 * - Card: width 270, borderRadius 12
 * - Footer: height 64, bg #1A1A1A, padding [16,32,24,32]
 * - Entire card is tappable (no embedded button — Figma has no button in either variant)
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Logo } from '@/src/components/ui';

export type PaymentSetupVariant = 'standalone' | 'add-more';

export interface PaymentSetupCardProps {
  variant?: PaymentSetupVariant;
  onAddPayment?: () => void;
}

function PaymentSetupCardComponent({
  variant = 'add-more',
  onAddPayment,
}: PaymentSetupCardProps) {
  const isAddMore = variant === 'add-more';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onAddPayment}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel="Setup your payment method"
    >
      {/* Top content area */}
      <View style={[styles.topSection, isAddMore ? styles.topSectionAddMore : styles.topSectionStandalone]}>
        <View style={[styles.topContent, isAddMore ? styles.topContentAddMore : styles.topContentStandalone]}>
          {/* Title text */}
          <View style={isAddMore ? styles.titleBlockAddMore : styles.titleBlock}>
            {isAddMore ? (
              // Figma 243-4052: "+  Setup your payment method to start"
              // override[1]: "+" is orange, rest is #CBCBCB
              <Text style={styles.titleLine}>
                <Text inherit style={styles.accentText}>+  Setup</Text>
                <Text inherit style={styles.grayText}> your payment method to start</Text>
              </Text>
            ) : (
              // Figma 243-4062: "Setup your payment method to start"
              // "Setup" in orange, rest in #CBCBCB
              <>
                <Text style={styles.titleLine}>
                  <Text inherit style={styles.accentText}>Setup</Text>
                  <Text inherit style={styles.grayText}> your payment method to start</Text>
                </Text>
                <Text style={styles.subtitle}>
                  Add UPI, card, or bank to start earning rewards
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Footer section */}
      <View style={styles.footer}>
        <Text style={isAddMore ? styles.footerLabelAddMore : styles.footerLabel}>
          {isAddMore ? '+ NEW PAYMENT' : 'NEW PAYMENT'}
        </Text>
        <Logo size={24} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 270, // Figma: width 270
    borderRadius: 12, // Figma: borderRadius 12
    overflow: 'hidden',
  },
  // Figma: top section base
  topSection: {
    backgroundColor: '#202020', // Figma: fill #202020
  },
  // Figma 243-4052: top section 270x344
  topSectionAddMore: {
    height: 344,
  },
  // Figma 243-4062: top section auto-height with paddingBottom 64
  topSectionStandalone: {
    // height auto
  },
  // Figma 243-4052: content centered, gap=120
  topContentAddMore: {
    flex: 1,
    paddingTop: 24, // Figma: paddingTop 24
    paddingBottom: 24, // Figma: paddingBottom 24
    paddingLeft: 32, // Figma: paddingLeft 32
    paddingRight: 32, // Figma: paddingRight 32
    justifyContent: 'center', // Figma: primaryAxisAlignItems CENTER
    alignItems: 'center', // Figma: counterAxisAlignItems CENTER
  },
  // Figma 243-4062: top-aligned, gap=64
  topContentStandalone: {
    paddingTop: 24, // Figma: paddingTop 24
    paddingBottom: 64, // Figma: paddingBottom 64
    paddingLeft: 32, // Figma: paddingLeft 32
    paddingRight: 32, // Figma: paddingRight 32
    gap: 64, // Figma: gap 64
  },
  topContent: {},
  // Figma 243-4062: title block width 206, gap 8
  titleBlock: {
    gap: 8, // Figma: gap between title and subtitle
    width: 206, // Figma: width 206
  },
  // Figma 243-4052: title block centered, width 206
  titleBlockAddMore: {
    width: 206, // Figma: width 206
    alignItems: 'center',
  },
  // Figma: fontSize 20, lineHeight 32, fontWeight 400
  titleLine: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20, // Figma: fontSize 20
    lineHeight: 32, // Figma: lineHeight 32
    fontWeight: '400', // Figma: fontWeight 400
  },
  accentText: {
    color: '#FF9A6D', // Figma: #FF9A6D (brand[500])
    fontSize: 20,
    lineHeight: 32,
    fontWeight: '400',
  },
  grayText: {
    color: '#CBCBCB', // Figma: #CBCBCB (neutral[300])
    fontSize: 20,
    lineHeight: 32,
    fontWeight: '400',
  },
  // Figma 243-4062: subtitle
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400', // Figma: fontWeight 400
    color: '#878787', // Figma: #878787 (neutral[600])
  },
  // Figma: footer section — common to both variants
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
  // Figma 243-4062: "NEW PAYMENT" in #CBCBCB
  footerLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400', // Figma: fontWeight 400
    color: '#CBCBCB', // Figma: #CBCBCB (neutral[300])
  },
  // Figma 243-4052: "+ NEW PAYMENT" in #FF9A6D
  footerLabelAddMore: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400', // Figma: fontWeight 400
    color: '#FF9A6D', // Figma: #FF9A6D (brand[500])
  },
});

export const PaymentSetupCard = memo(PaymentSetupCardComponent);
