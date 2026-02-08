/**
 * FinishSetupSection Component
 * Section header "FINISH SETUP" with landlord status and setup checklist
 * Figma Reference: 243-4258, 243-4462, 243-4666, 243-4870, 243-5074
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/ui';
import { LandlordStatusCard, LandlordStatus } from './LandlordStatusCard';
import { SetupChecklist } from './SetupChecklist';
import { colors, spacing } from '@/src/theme';

export interface FinishSetupSectionProps {
  landlordStatus: LandlordStatus;
  bankDetailsComplete?: boolean;
  addressProofComplete?: boolean;
  landlordInvited?: boolean;
  onSendReminder?: () => void;
  onContactSupport?: () => void;
}

function FinishSetupSectionComponent({
  landlordStatus,
  bankDetailsComplete = false,
  addressProofComplete = false,
  landlordInvited = false,
  onSendReminder,
  onContactSupport,
}: FinishSetupSectionProps) {
  return (
    <View style={styles.container}>
      {/* Section Label */}
      <Text style={styles.sectionLabel}>FINISH SETUP</Text>

      {/* Landlord Status Card */}
      <LandlordStatusCard
        status={landlordStatus}
        onSendReminder={onSendReminder}
        onContactSupport={onContactSupport}
      />

      {/* Setup Checklist */}
      <SetupChecklist
        bankDetailsComplete={bankDetailsComplete}
        addressProofComplete={addressProofComplete}
        landlordInvited={landlordInvited}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    letterSpacing: 0.5,
    marginBottom: spacing.xxs,
  },
});

export const FinishSetupSection = memo(FinishSetupSectionComponent);
