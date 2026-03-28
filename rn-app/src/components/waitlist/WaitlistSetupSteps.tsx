import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';
import { s, sv } from '@/src/theme/scale';

const STEPS = [
  'Add landlord’s bank details',
  'Verify your address',
  'Send invite to your landlord',
];

function WaitlistSetupStepsComponent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Once you're in{'\n'}get started in 3 steps
      </Text>
      
      <View style={styles.stepsContainer}>
        {/* Connecting Line behind the icons */}
        <View style={styles.lineOverlay}>
          <Svg width="100%" height="2" viewBox="0 0 100 2" preserveAspectRatio="none">
            <Path d="M0 1L100 1" stroke={colors.black[400]} strokeWidth="2" />
          </Svg>
        </View>

        {STEPS.map((step, index) => (
          <View key={index} style={styles.stepItem}>
            {/* Box Icon placeholder */}
            <View style={styles.iconBox} />
            
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: s(24),
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(28),
    lineHeight: sv(40),
    letterSpacing: -1,
    color: colors.white,
  },
  stepsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: s(4),
    position: 'relative',
  },
  lineOverlay: {
    position: 'absolute',
    top: s(21), // Roughly center of the icon boxes (16 padding + 5.5 icon center)
    left: '16%',
    right: '16%',
    height: 2,
    zIndex: 0,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: s(16),
    paddingVertical: s(16),
    paddingHorizontal: s(8),
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  iconBox: {
    width: s(11),
    height: s(11),
    borderRadius: 4,
    backgroundColor: colors.black[500], // #202020
  },
  stepText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(12),
    lineHeight: sv(16.92),
    letterSpacing: -0.24,
    color: colors.neutral[500], // #A9A9A9
    textAlign: 'center',
  },
});

export const WaitlistSetupSteps = memo(WaitlistSetupStepsComponent);
