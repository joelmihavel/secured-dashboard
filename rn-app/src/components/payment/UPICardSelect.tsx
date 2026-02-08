/**
 * UPICardSelect Component
 * Figma IDs: 243-3923 (default), 243-3838 (selected)
 * UPI payment method card with selection state
 *
 * EXACT Figma Values:
 * - Container: 270x400, flexDirection column
 * - Card body: 270x336, backgroundColor #202020
 * - Card body padding: top 24, right 16, bottom 24, left 32
 * - Card footer: 270x64, backgroundColor #1A1A1A
 * - Selected badge: pill shape, backgroundColor #1A1A1A, borderRadius 200
 * - Bank account text: fontSize 16, lineHeight 24, color #4D4D4D
 * - UPI ID text: fontSize 16, lineHeight 24, color #4D4D4D
 * - Footer label: fontSize 14, lineHeight 20, color #CBCBCB
 */

import React, { memo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
  Image,
  ImageSourcePropType,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { Text } from '@/src/components/ui/Typography';
import { springConfig } from '@/src/theme';

// Exact Figma color values
const CARD_COLORS = {
  cardBody: '#202020',
  cardFooter: '#1A1A1A',
  textDefault: '#4D4D4D',
  textAccent: '#FF9A6D',
  footerText: '#CBCBCB',
  selectedBadgeBg: '#1A1A1A',
  chipBorder: '#4D4D4D',
  upiGreen: '#27803B',
  upiOrange: '#E9661C',
  white: '#FFFFFF',
} as const;

// UPI Logo SVG component (exact from Figma)
const UPILogo = ({ width = 45, height = 16 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 45 16" fill="none">
    {/* U letter */}
    <Path
      d="M0 0H3V10C3 12 4 13 6 13C8 13 9 12 9 10V0H12V10C12 14 9 16 6 16C3 16 0 14 0 10V0Z"
      fill={CARD_COLORS.white}
    />
    {/* P letter */}
    <Path
      d="M14 0H20C23 0 25 2 25 5C25 8 23 10 20 10H17V16H14V0ZM17 7H19C21 7 22 6 22 5C22 4 21 3 19 3H17V7Z"
      fill={CARD_COLORS.white}
    />
    {/* I letter */}
    <Rect x="27" y="0" width="3" height="16" fill={CARD_COLORS.white} />
    {/* Green part of logo */}
    <Path
      d="M38 0V12L44 0H41V12H38Z"
      fill={CARD_COLORS.upiGreen}
    />
    {/* Orange part of logo */}
    <Path
      d="M35 0V12L41 0H38V12H35Z"
      fill={CARD_COLORS.upiOrange}
    />
  </Svg>
);

// Search/Link icon for footer
const LinkIcon = ({ color = CARD_COLORS.footerText }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Circle cx="7" cy="7" r="5" stroke={color} strokeWidth="1.5" />
    <Path d="M11 11L14 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

export interface UPICardSelectProps {
  /** UPI ID (e.g., username@bankname) */
  upiId: string;
  /** Linked bank account info (e.g., "ICICI a/c - xxx23") */
  bankAccount?: string;
  /** Custom UPI logo image source */
  logo?: ImageSourcePropType;
  /** Whether this UPI method is currently selected */
  selected?: boolean;
  /** Callback when UPI method is selected */
  onSelect?: () => void;
  /** Optional style overrides */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

function UPICardSelectComponent({
  upiId,
  bankAccount,
  logo,
  selected = false,
  onSelect,
  style,
  testID,
}: UPICardSelectProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, springConfig.snappy);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig.snappy);
  };

  const handlePress = () => {
    onSelect?.();
  };

  // Mask UPI ID for display (show partial)
  const maskUpiId = (id: string): string => {
    const atIndex = id.indexOf('@');
    if (atIndex > 0) {
      const username = id.substring(0, atIndex);
      return `${username}@${'\u2022\u2022\u2022'}`;
    }
    return id;
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`UPI ID ${upiId}${selected ? ', selected' : ''}`}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[styles.container, animatedStyle, style]}>
        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Header Row - Logo and Selected Badge */}
          <View style={styles.headerRow}>
            {logo ? (
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            ) : (
              <UPILogo />
            )}
            {selected && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedText}>SELECTED</Text>
              </View>
            )}
          </View>

          {/* UPI Details Section */}
          <View style={styles.detailsSection}>
            {/* Bank Account */}
            {bankAccount && (
              <Text style={styles.bankAccountText}>{bankAccount}</Text>
            )}

            {/* UPI ID */}
            <Text style={styles.upiIdText}>{maskUpiId(upiId)}</Text>
          </View>

          {/* Chip Decoration (decorative squares in corner) */}
          <View style={styles.chipDecoration}>
            <View style={styles.chipSquareGroup}>
              <View style={styles.chipSquare} />
              <View style={styles.chipSquare} />
            </View>
          </View>

          {/* Bottom chip decoration */}
          <View style={styles.bottomChipDecoration}>
            <View style={styles.chipSquareGroup}>
              <View style={styles.chipSquare} />
              <View style={styles.chipSquare} />
            </View>
          </View>
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.footerContent}>
            <Text style={styles.footerLabel}>UPI</Text>
            <LinkIcon />
          </View>
          {/* Footer icon placeholder */}
          <View style={styles.flentLogoPlaceholder} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 270,
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardBody: {
    width: 270,
    height: 336,
    backgroundColor: CARD_COLORS.cardBody,
    paddingTop: 24,
    paddingRight: 16,
    paddingBottom: 24,
    paddingLeft: 32,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    width: 45,
    height: 16,
  },
  selectedBadge: {
    backgroundColor: CARD_COLORS.selectedBadgeBg,
    borderRadius: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: CARD_COLORS.textAccent,
    textAlign: 'center',
  },
  detailsSection: {
    gap: 8,
  },
  bankAccountText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: CARD_COLORS.textDefault,
  },
  upiIdText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: CARD_COLORS.textDefault,
  },
  chipDecoration: {
    position: 'absolute',
    right: 16,
    top: 125,
  },
  bottomChipDecoration: {
    position: 'absolute',
    right: 16,
    bottom: 85,
  },
  chipSquareGroup: {
    gap: 14.5,
  },
  chipSquare: {
    width: 20.5,
    height: 20.5,
    borderWidth: 0.3,
    borderColor: CARD_COLORS.chipBorder,
  },
  cardFooter: {
    width: 270,
    height: 64,
    backgroundColor: CARD_COLORS.cardFooter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingRight: 32,
    paddingBottom: 24,
    paddingLeft: 32,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: CARD_COLORS.footerText,
  },
  flentLogoPlaceholder: {
    width: 20,
    height: 24,
  },
});

export const UPICardSelect = memo(UPICardSelectComponent);
