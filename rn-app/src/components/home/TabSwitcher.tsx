/**
 * TabSwitcher Component
 * "Recent Payments" / "Cashbacks" toggle tabs - Figma pixel-perfect
 * Figma Reference: 243-3378 (Frame 243:3328 "Toggle")
 *
 * Figma Pixel-Perfect Values (toggle container):
 * - Container (Toggle): width 297, height 44, backgroundColor #131313 (darker)
 *   - borderColor #202020, borderWidth 1, borderRadius 200
 *   - padding 4 all sides
 * - Active tab: width ~145, height 36, backgroundColor #1A1A1A (lighter - visible)
 *   - borderRadius 50, paddingVertical 8, paddingHorizontal 24
 *   - shadow: multiple drop shadows for depth
 * - Inactive tab: height 36, no background (transparent)
 *   - borderRadius 50, paddingVertical 8, paddingHorizontal 24
 * - Active text: fontSize 14, lineHeight 20, fontWeight 600, color #FFFFFF
 * - Inactive text: fontSize 14, lineHeight 20, fontWeight 500, color #878787 (muted)
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

export type TabId = 'recent_payments' | 'cashbacks';

export interface TabSwitcherProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

function TabSwitcherComponent({ activeTab, onTabChange }: TabSwitcherProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'recent_payments' && styles.tabActive,
        ]}
        onPress={() => onTabChange('recent_payments')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'recent_payments' ? styles.tabTextActive : styles.tabTextInactive,
          ]}
        >
          Recent Payments
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'cashbacks' && styles.tabActive,
        ]}
        onPress={() => onTabChange('cashbacks')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'cashbacks' ? styles.tabTextActive : styles.tabTextInactive,
          ]}
        >
          Cashbacks
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Figma 243-3378: Toggle container
    // Container is darker (#131313) so active tab (#1A1A1A) stands out
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    width: 297, // Figma: width 297
    height: 44, // Figma: height 44
    backgroundColor: '#131313', // Darker background for contrast
    borderRadius: 200, // Figma: borderRadius 200 (pill shape)
    borderWidth: 1, // Figma: borderWidth 1
    borderColor: '#202020', // Figma: borderColor #202020
    padding: 4, // Figma: padding 4 all sides
  },
  tab: {
    flex: 1,
    height: 36, // Figma: height 36
    borderRadius: 50, // Figma: borderRadius 50 (fully rounded)
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8, // Figma: paddingVertical 8
    paddingHorizontal: 24, // Figma: paddingHorizontal 24
  },
  tabActive: {
    // Active tab is visibly lighter than container
    backgroundColor: '#1A1A1A', // Figma: #1A1A1A (visible against #131313)
    // Multiple drop shadows from Figma for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    // Figma nodes: tab labels use textAlignHorizontal CENTER across all variants
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
  tabTextActive: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontWeight: '600', // Figma: fontWeight 600 for active
    color: colors.white, // Figma: #FFFFFF for active
  },
  tabTextInactive: {
    fontWeight: '500', // Figma: fontWeight 500 for inactive
    color: '#656565', // Figma: #656565 for inactive tab text per home-active JSON
  },
});

export const TabSwitcher = memo(TabSwitcherComponent);
