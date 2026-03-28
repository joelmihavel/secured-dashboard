/**
 * TabSwitcher Component
 * "Recent Payments" / "Cashbacks" toggle tabs - Figma pixel-perfect
 * Figma Reference: 243-5870 (node 243:6026 "Toggle")
 *
 * Figma Pixel-Perfect Values (from 243-5870 blueprint):
 * - Toggle outer: bg #1A1A1A (black[600]), border #202020 (black[500]) 1px, borderRadius 200px
 *   - padding: 4px
 * - Active tab: bg #1A1A1A, borderRadius 50px, padding: px 24, py 8
 *   - shadow: -3px top (#202020), 4px/10px bottom black shadows for neumorphic effect
 * - Inactive tab: no bg, padding: px 24, py 8
 * - Active text: fontSize 14, lineHeight 20, PlusJakartaSans-SemiBold, color #FFFFFF
 * - Inactive text: fontSize 14, lineHeight 20, PlusJakartaSans-Medium, color #FFFFFF
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '@/src/components/ui';

export type TabId = 'recent_payments' | 'cashbacks';

export interface TabSwitcherProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

function TabSwitcherComponent({ activeTab, onTabChange }: TabSwitcherProps) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {/* Cashbacks tab — shown first */}
      <TouchableOpacity
        onPress={() => onTabChange('cashbacks')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'cashbacks' }}
        accessibilityLabel="Cashbacks"
      >
        <View style={activeTab === 'cashbacks' ? styles.tabActive : styles.tabInactive}>
          <Text style={activeTab === 'cashbacks' ? styles.tabTextActive : styles.tabTextInactive}>
            Cashbacks
          </Text>
        </View>
      </TouchableOpacity>

      {/* Recent Payments tab */}
      <TouchableOpacity
        onPress={() => onTabChange('recent_payments')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'recent_payments' }}
        accessibilityLabel="Recent Payments"
      >
        <View style={activeTab === 'recent_payments' ? styles.tabActive : styles.tabInactive}>
          <Text style={activeTab === 'recent_payments' ? styles.tabTextActive : styles.tabTextInactive}>
            Recent Payments
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 200,
    borderWidth: 1,
    borderColor: '#202020',
    padding: 4,
  },
  tabActive: {
    backgroundColor: '#1A1A1A',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
    // RN doesn't support multiple box-shadows or negative spread directly on Android.
    // We'll mimic the neumorphic pop with elevation + borderTop.
    borderTopWidth: 1,
    borderTopColor: '#2B2B2B', // Mimics the 0px -3px 2px 0px #202020
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 4,
  },
  tabInactive: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  tabTextActive: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  tabTextInactive: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export const TabSwitcher = memo(TabSwitcherComponent);
