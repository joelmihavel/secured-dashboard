/**
 * Agreement Success Screen
 * Shows success state after agreement upload
 */

import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Text, PrimaryButton, Logo } from '@/src/components';
import { colors, spacing } from '@/src/theme';

export default function AgreementSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleContinue = useCallback(() => {
    router.replace('/(main)' as never);
  }, [router]);

  return (
    <Screen testID="agreement-success-screen">
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Logo size={32} />
        </View>

        {/* Success Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark" size={48} color={colors.success.default} />
            </View>
          </View>

          <Text variant="h4" color="primary" align="center">
            Agreement Submitted!
          </Text>

          <Text variant="bodyMd2" color="muted" align="center" style={styles.message}>
            Your rental agreement has been submitted for verification. We'll notify you once it's approved.
          </Text>

          {/* Timeline */}
          <View style={styles.timeline}>
            <TimelineStep
              icon="document-text"
              title="Agreement Uploaded"
              subtitle="Just now"
              isComplete
            />
            <TimelineStep
              icon="search"
              title="Under Review"
              subtitle="Usually takes 24-48 hours"
              isActive
            />
            <TimelineStep
              icon="checkmark-circle"
              title="Verified"
              subtitle="You'll be notified"
            />
          </View>
        </View>

        {/* Continue Button */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Continue to Dashboard"
            onPress={handleContinue}
            testID="continue-button"
          />
        </View>
      </View>
    </Screen>
  );
}

interface TimelineStepProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  isComplete?: boolean;
  isActive?: boolean;
}

function TimelineStep({ icon, title, subtitle, isComplete, isActive }: TimelineStepProps) {
  const iconColor = isComplete
    ? colors.success.default
    : isActive
    ? colors.brand[500]
    : colors.neutral[500];

  return (
    <View style={styles.timelineStep}>
      <View
        style={[
          styles.timelineIcon,
          isComplete && styles.timelineIconComplete,
          isActive && styles.timelineIconActive,
        ]}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.timelineContent}>
        <Text
          variant="bodyMdMedium"
          color={isComplete || isActive ? 'primary' : 'muted'}
        >
          {title}
        </Text>
        <Text variant="bodySm" color="muted">
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  logoContainer: {
    marginTop: spacing.md,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success.default + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  timeline: {
    marginTop: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    paddingHorizontal: spacing.lg,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.black[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconComplete: {
    backgroundColor: colors.success.default + '20',
  },
  timelineIconActive: {
    backgroundColor: colors.brand[500] + '20',
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  buttonContainer: {
    paddingBottom: spacing.xl,
  },
});
