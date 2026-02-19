/**
 * TabSwitcher Component
 * "Recent Payments" / "Cashbacks" toggle tabs - Figma pixel-perfect
 * Figma Reference: 243-2967 (node 243:3120 "Toggle")
 *
 * Figma Pixel-Perfect Values (from 243-2967 blueprint):
 * - Toggle outer (243:3120): width 264, height 52, borderRadius 4
 *   - gradient fill: #1A1A1A -> #0D0D0D (top to bottom)
 *   - stroke: #FFFFFF weight 1, INSIDE
 *   - inner shadow: #06060699 offset 0/2 blur 6
 *   - padding: 4 all sides, gap: 0
 * - Active tab (Component 6 - 243:3121): width 149, height 44, borderRadius 8
 *   - gradient fill: #202020 -> #1A1A1A
 *   - inner shadow: #0606068C offset 0/2 blur 6
 *   - drop shadow: #06060699 offset 0/1 blur 4
 *   - padding: top 12, right 16, bottom 12, left 16
 * - Inactive tab: no fill, same padding structure
 * - Active text: fontSize 14, lineHeight 20, fontWeight 500, PlusJakartaSans-Medium, color #FFFFFF
 * - Inactive text: fontSize 14, lineHeight 20, fontWeight 500, PlusJakartaSans-Medium, color #656565
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/src/components/ui';

export type TabId = 'recent_payments' | 'cashbacks';

export interface TabSwitcherProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

function TabSwitcherComponent({ activeTab, onTabChange }: TabSwitcherProps) {
  return (
    <LinearGradient
      colors={['#1A1A1A', '#0D0D0D']}
      style={styles.container}
      accessibilityRole="tablist"
    >
      {/* Recent Payments tab */}
      <TouchableOpacity
        onPress={() => onTabChange('recent_payments')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'recent_payments' }}
        accessibilityLabel="Recent Payments"
        style={styles.tabTouchable}
      >
        {activeTab === 'recent_payments' ? (
          <LinearGradient
            colors={['#202020', '#1A1A1A']}
            style={styles.tabActive}
          >
            <Text style={styles.tabTextActive}>Recent Payments</Text>
          </LinearGradient>
        ) : (
          <View style={styles.tabInactive}>
            <Text style={styles.tabTextInactive}>Recent Payments</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Cashbacks tab */}
      <TouchableOpacity
        onPress={() => onTabChange('cashbacks')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'cashbacks' }}
        accessibilityLabel="Cashbacks"
        style={styles.tabTouchable}
      >
        {activeTab === 'cashbacks' ? (
          <LinearGradient
            colors={['#202020', '#1A1A1A']}
            style={styles.tabActive}
          >
            <Text style={styles.tabTextActive}>Cashbacks</Text>
          </LinearGradient>
        ) : (
          <View style={styles.tabInactive}>
            <Text style={styles.tabTextInactive}>Cashbacks</Text>
          </View>
        )}
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Figma 243:3120: Toggle outer container
  // width 264, height 52, borderRadius 4, gradient #1A1A1A->#0D0D0D
  // stroke #FFFFFF weight 1 INSIDE, padding 4
  container: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    width: 264, // Figma: width 264
    height: 52, // Figma: height 52
    borderRadius: 4, // Figma: borderRadius 4
    borderWidth: 1, // Figma: stroke weight 1 INSIDE
    borderColor: '#FFFFFF', // Figma: stroke #FFFFFF
    padding: 4, // Figma: padding 4 all sides
    gap: 0, // Figma: gap 0
  },
  tabTouchable: {
    flex: 1,
  },
  // Figma 243:3121 (Component 6 active): borderRadius 8, gradient #202020->#1A1A1A
  // padding: top 12, right 16, bottom 12, left 16
  // drop shadow + inner shadow for depth
  tabActive: {
    flex: 1,
    height: 44, // Figma: height 44
    borderRadius: 8, // Figma: borderRadius 8
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12, // Figma: paddingTop/Bottom 12
    paddingHorizontal: 16, // Figma: paddingLeft/Right 16
    // Drop shadow from Figma
    shadowColor: '#060606',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  // Figma: inactive tab - no fill, same dimensions
  tabInactive: {
    flex: 1,
    height: 44, // Figma: height 44
    borderRadius: 8, // Figma: match active tab radius
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12, // Figma: paddingTop/Bottom 12
    paddingHorizontal: 16, // Figma: paddingLeft/Right 16
  },
  // Figma: Active text - fontSize 14, lineHeight 20, fontWeight 500, color #FFFFFF
  tabTextActive: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    color: '#FFFFFF', // Figma: #FFFFFF
    textAlign: 'center',
  },
  // Figma: Inactive text - fontSize 14, lineHeight 20, fontWeight 500, color #656565
  tabTextInactive: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    color: '#656565', // Figma: #656565 (NOT #A9A9A9)
    textAlign: 'center',
  },
});

export const TabSwitcher = memo(TabSwitcherComponent);
