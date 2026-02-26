/**
 * NetbankingCardSelect Component
 * Figma IDs: 243-4030 (default), 243-4008 (selected)
 * Netbanking payment method card with selection state
 *
 * EXACT Figma Values:
 * - Container: 270x400, flexDirection column
 * - Card body: 270x336, backgroundColor #202020
 * - Card body padding: top 24, right 16, bottom 24, left 32
 * - Card footer: 270x64, backgroundColor #1A1A1A
 * - Selected badge: pill shape, backgroundColor #1A1A1A, borderRadius 200
 * - Bank logo: 24x24
 * - Bank account text: fontSize 16, lineHeight 24, color #4D4D4D
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
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';

import { Text } from '@/src/components/ui/Typography';
import { springConfig } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

// Exact Figma color values
const CARD_COLORS = {
  cardBody: '#202020',
  cardFooter: '#1A1A1A',
  textDefault: '#4D4D4D',
  textAccent: '#FF9A6D',
  footerText: '#CBCBCB',
  selectedBadgeBg: '#1A1A1A',
  chipBorder: '#4D4D4D',
  // ICICI Bank logo colors
  iciciOrange: '#F06321',
  iciciRed: '#AE282E',
  white: '#FFFFFF',
} as const;

// ICICI Bank Logo SVG component (from Figma)
const ICICIBankLogo = ({ width = 24, height = 24 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    {/* Outer orange shape */}
    <Path
      d="M0.919 0L22.161 0C22.161 0 22.161 24 0.919 24V0Z"
      fill={CARD_COLORS.iciciOrange}
    />
    {/* Inner red shape */}
    <Path
      d="M3.573 0.01L22.161 0.01C22.161 0.01 22.161 20.22 3.573 20.22V0.01Z"
      fill={CARD_COLORS.iciciRed}
    />
    {/* White I letter */}
    <Path
      d="M5.741 2.831H17.749V24H5.741V2.831Z"
      fill={CARD_COLORS.white}
    />
  </Svg>
);

// Generic Bank Logo placeholder
const GenericBankLogo = ({ width = 24, height = 24 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" fill={CARD_COLORS.textDefault} />
    <Path
      d="M12 6L18 10V18H6V10L12 6Z"
      fill={CARD_COLORS.white}
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

export type BankType = 'icici' | 'hdfc' | 'sbi' | 'axis' | 'kotak' | 'other';

export interface NetbankingCardSelectProps {
  /** Bank name to display */
  bankName: string;
  /** Bank account info (e.g., "ICICI a/c - xxx23") */
  bankAccount?: string;
  /** Bank type for logo selection */
  bankType?: BankType;
  /** Custom bank logo image source */
  bankLogo?: ImageSourcePropType;
  /** Whether this netbanking method is currently selected */
  selected?: boolean;
  /** Callback when netbanking method is selected */
  onSelect?: () => void;
  /** Optional style overrides */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

function NetbankingCardSelectComponent({
  bankName,
  bankAccount,
  bankType = 'icici',
  bankLogo,
  selected = false,
  onSelect,
  style,
  testID,
}: NetbankingCardSelectProps) {
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

  const renderBankLogo = () => {
    if (bankLogo) {
      return <Image source={bankLogo} style={styles.bankLogo} resizeMode="contain" />;
    }

    switch (bankType) {
      case 'icici':
        return <ICICIBankLogo />;
      default:
        return <GenericBankLogo />;
    }
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${bankName} netbanking${selected ? ', selected' : ''}`}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[styles.container, animatedStyle, style]}>
        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Header Row - Bank Logo and Selected Badge */}
          <View style={styles.headerRow}>
            {renderBankLogo()}
            {selected && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedText}>SELECTED</Text>
              </View>
            )}
          </View>

          {/* Bank Details Section */}
          <View style={styles.detailsSection}>
            {/* Bank Name - displayed above account number */}
            <Text style={styles.bankNameText}>{bankName}</Text>
            {/* Bank Account Info */}
            {bankAccount && (
              <Text style={styles.bankAccountText}>{bankAccount}</Text>
            )}
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
            <Text style={styles.footerLabel}>NET BANKING</Text>
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
    width: s(270),
    height: sv(400),
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardBody: {
    width: s(270),
    height: sv(336),
    backgroundColor: CARD_COLORS.cardBody,
    paddingTop: sv(24),
    paddingRight: s(16),
    paddingBottom: sv(24),
    paddingLeft: s(32),
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankLogo: {
    width: s(24),
    height: s(24),
  },
  selectedBadge: {
    backgroundColor: CARD_COLORS.selectedBadgeBg,
    borderRadius: 200,
    paddingHorizontal: s(12),
    paddingVertical: sv(8),
  },
  selectedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: CARD_COLORS.textAccent,
    textAlign: 'center',
  },
  detailsSection: {
    gap: sv(8),
  },
  bankNameText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: sf(20),
    lineHeight: sf(28),
    color: CARD_COLORS.white,
  },
  bankAccountText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(16),
    lineHeight: sf(24),
    color: CARD_COLORS.textDefault,
  },
  chipDecoration: {
    position: 'absolute',
    right: s(16),
    top: sv(125),
  },
  bottomChipDecoration: {
    position: 'absolute',
    right: s(16),
    bottom: sv(85),
  },
  chipSquareGroup: {
    gap: sv(14.5),
  },
  chipSquare: {
    width: s(20.5),
    height: s(20.5),
    borderWidth: 0.3,
    borderColor: CARD_COLORS.chipBorder,
  },
  cardFooter: {
    width: s(270),
    height: sv(64),
    backgroundColor: CARD_COLORS.cardFooter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: sv(16),
    paddingRight: s(32),
    paddingBottom: sv(24),
    paddingLeft: s(32),
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  footerLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: CARD_COLORS.footerText,
  },
  flentLogoPlaceholder: {
    width: s(20),
    height: sv(24),
  },
});

export const NetbankingCardSelect = memo(NetbankingCardSelectComponent);
