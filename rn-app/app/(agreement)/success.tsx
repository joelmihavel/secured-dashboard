/**
 * Agreement Success Screen
 * Shows success state after agreement confirmation.
 *
 * Receives extractionId from the review screen and fetches
 * the confirmed extraction data to display a summary.
 */

import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Text, PrimaryButton, Logo } from '@/src/components';
import { useExtractedData } from '@/src/hooks';
import { formatPaiseToRupees } from '@/src/services/api/agreement';
import { colors, spacing } from '@/src/theme';

export default function AgreementSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { extractionId } = useLocalSearchParams<{ extractionId?: string }>();

  // Fetch confirmed extraction data for the summary display.
  // Falls back gracefully when no extractionId is provided (e.g. deep-link / dev).
  const { data: extractedData } = useExtractedData(extractionId ?? null, {
    enabled: !!extractionId,
  });

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleContinue = useCallback(() => {
    router.replace('/(setup)' as never);
  }, [router]);

  // Derive summary values from the confirmed extraction data
  const propertyName = extractedData?.propertyName ?? undefined;
  const monthlyRent = extractedData?.monthlyRentPaise
    ? `\u20B9 ${formatPaiseToRupees(extractedData.monthlyRentPaise)}`
    : undefined;
  const landlordName = extractedData?.landlordNames?.[0] ?? undefined;

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

          {/* Confirmed Details Summary (only shown when data is available) */}
          {extractedData && (
            <View style={styles.summaryContainer}>
              {propertyName && (
                <View style={styles.summaryRow}>
                  <Text variant="bodySm" color="muted">Property</Text>
                  <Text variant="bodySmMedium" color="primary">{propertyName}</Text>
                </View>
              )}
              {monthlyRent && (
                <View style={styles.summaryRow}>
                  <Text variant="bodySm" color="muted">Monthly Rent</Text>
                  <Text variant="bodySmMedium" color="primary">{monthlyRent}</Text>
                </View>
              )}
              {landlordName && (
                <View style={styles.summaryRow}>
                  <Text variant="bodySm" color="muted">Landlord</Text>
                  <Text variant="bodySmMedium" color="primary">{landlordName}</Text>
                </View>
              )}
            </View>
          )}

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
  summaryContainer: {
    width: '100%',
    backgroundColor: colors.black[500],
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
