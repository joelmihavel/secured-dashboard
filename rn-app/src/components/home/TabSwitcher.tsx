/**
 * TabSwitcher Component
 * Generic tab toggle - Figma pixel-perfect
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

import React, { memo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui';

export interface Tab {
  id: string;
  label: string;
}

export interface TabSwitcherProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  disabled?: boolean;
  /** Smaller padding and font for inline use */
  compact?: boolean;
  /** Override container background (default #1A1A1A) */
  bgColor?: string;
  /** Override active tab background (default same as container) */
  activeBgColor?: string;
}

function TabSwitcherComponent({ tabs, activeTabId, onTabChange, disabled = false, compact = false, bgColor, activeBgColor }: TabSwitcherProps) {
  const handlePress = useCallback(
    (tabId: string) => {
      if (disabled) return;
      if (tabId === activeTabId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onTabChange(tabId);
    },
    [disabled, activeTabId, onTabChange]
  );

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        bgColor && { backgroundColor: bgColor, borderColor: bgColor },
        disabled && styles.containerDisabled,
      ]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => handlePress(tab.id)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            disabled={disabled}
          >
            <View style={[
              isActive ? styles.tabActive : styles.tabInactive,
              compact && (isActive ? styles.tabActiveCompact : styles.tabInactiveCompact),
              isActive && (activeBgColor || bgColor) && { backgroundColor: activeBgColor || bgColor },
            ]}>
              <Text style={[
                isActive ? styles.tabTextActive : styles.tabTextInactive,
                compact && styles.tabTextCompact,
              ]}>
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'center', // Default: centered. Parent can override via wrapping View
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 200,
    borderWidth: 1,
    borderColor: '#202020',
    padding: 4,
  },
  containerCompact: {
    padding: 3,
  },
  containerDisabled: {
    opacity: 0.5,
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
  // Compact variants
  tabActiveCompact: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  tabInactiveCompact: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  tabTextCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
});

export const TabSwitcher = memo(TabSwitcherComponent);
