/**
 * Consent Toggle Component
 * Toggle switch with consent text matching Figma design
 *
 * Figma Node: 1:29188 (Switch Toggle)
 * From get_design_context:
 * - Background: #131313 (black/700)
 * - Track: gradient from #171717 to #2b2b2d with shadows
 * - Thumb: #141618 with multiple shadow layers for 3D effect
 * - Size: ~46x24px (track), smaller pill-shaped thumb
 * - OFF state: thumb on left side
 * - Text: Plus Jakarta Sans Regular, 12px, line-height 20px, #a9a9a9
 * - "Cashfree" link: Plus Jakarta Sans Medium, underline, #eeeeee
 */

import React, { memo, useCallback } from 'react';
import { View, StyleSheet, Pressable, Linking } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '../../ui/Typography';

// Figma exact color values from get_design_context
const TOGGLE_COLORS = {
  background: '#131313',
  trackGradientStart: '#171717',
  trackGradientEnd: '#2b2b2d',
  thumbOff: '#141618',
  thumbOn: '#ff9a6d', // Brand color when active
  text: '#a9a9a9',
  link: '#eeeeee',
} as const;

// EXACT Figma dimensions from extracted-values.json
const TOGGLE_DIMENSIONS = {
  // Container (1:29188): 46.49x24
  width: 46.49,
  height: 24,
  // Track (I1:29188;124:6250): 38.7x10.15
  trackWidth: 38.7,
  trackHeight: 10.15,
  // Thumb (I1:29188;124:6257): 20.8x9.17, #141618
  thumbWidth: 20.8,
  thumbHeight: 9.17,
  thumbTravel: 16, // Distance thumb moves when toggled
};

export interface ConsentToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

function ConsentToggleComponent({
  value,
  onValueChange,
  disabled,
  testID,
}: ConsentToggleProps) {
  const handlePress = useCallback(() => {
    if (disabled) return;

    onValueChange(!value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [value, onValueChange, disabled]);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={[styles.toggle, disabled && styles.disabled]}
        testID={testID}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: !!disabled }}
        accessibilityLabel="Consent to verification"
      >
        {/* Base background */}
        <View style={styles.background} />

        {/* Track with gradient - Figma shows 3D recessed track */}
        <LinearGradient
          colors={[TOGGLE_COLORS.trackGradientStart, TOGGLE_COLORS.trackGradientEnd]}
          style={styles.track}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Inner track shadow for depth */}
        <View style={styles.trackInnerShadow} />

        {/* Thumb with 3D effect */}
        <Animated.View style={[styles.thumbContainer, {
          transitionProperty: 'transform',
          transitionDuration: '150ms',
          transform: [{ translateX: value ? TOGGLE_DIMENSIONS.thumbTravel : 0 }],
        }]}>
          <View style={[
            styles.thumb,
            value && styles.thumbActive
          ]}>
            {/* Inner highlight for 3D effect */}
            <View style={styles.thumbHighlight} />
          </View>
        </Animated.View>
      </Pressable>

      {/* Consent text with hyperlinked Terms & Privacy Policy */}
      <View style={styles.textContainer}>
        <Text style={styles.consentText}>
          {'By continuing, you agree to the Flent Secured '}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL('https://www.flent.in/secured-tnc')}
          >
            Terms &amp; Conditions
          </Text>
          {' and acknowledge the '}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL('https://www.flent.in/secured-privacy-policy')}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16, // Figma gap
  },
  toggle: {
    width: TOGGLE_DIMENSIONS.width,
    height: TOGGLE_DIMENSIONS.height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: TOGGLE_COLORS.background,
  },
  track: {
    position: 'absolute',
    width: TOGGLE_DIMENSIONS.trackWidth,
    height: TOGGLE_DIMENSIONS.trackHeight,
    borderRadius: TOGGLE_DIMENSIONS.trackHeight / 2,
    // Figma shadows for depth
    shadowColor: '#0f0f0f',
    shadowOffset: { width: 0, height: -0.23 },
    shadowOpacity: 1,
    shadowRadius: 0.586,
  },
  trackInnerShadow: {
    position: 'absolute',
    width: TOGGLE_DIMENSIONS.trackWidth - 4,
    height: TOGGLE_DIMENSIONS.trackHeight - 2,
    borderRadius: (TOGGLE_DIMENSIONS.trackHeight - 2) / 2,
    backgroundColor: 'transparent',
    // Inner shadow effect
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  thumbContainer: {
    position: 'absolute',
    left: 5,
  },
  thumb: {
    width: TOGGLE_DIMENSIONS.thumbWidth,
    height: TOGGLE_DIMENSIONS.thumbHeight,
    borderRadius: TOGGLE_DIMENSIONS.thumbHeight / 2,
    backgroundColor: TOGGLE_COLORS.thumbOff,
    // Figma 3D shadow stack
    shadowColor: '#000',
    shadowOffset: { width: 0.04, height: 0.52 },
    shadowOpacity: 0.68,
    shadowRadius: 0.25,
    // Inner shadows via border
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  thumbActive: {
    backgroundColor: TOGGLE_COLORS.thumbOn,
  },
  thumbHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  textContainer: {
    flex: 1,
  },
  consentText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: TOGGLE_COLORS.text,
  },
  link: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: TOGGLE_COLORS.link,
    textDecorationLine: 'underline',
  },
});

export const ConsentToggle = memo(ConsentToggleComponent);
