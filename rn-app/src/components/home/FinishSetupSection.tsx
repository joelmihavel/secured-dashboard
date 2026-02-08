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
    paddingHorizontal: 32, // Figma: paddingHorizontal 32
    gap: 16, // Figma: gap 16
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12, // Figma: fontSize 12
    fontWeight: '500', // Figma: fontWeight 500
    lineHeight: 20, // Figma: lineHeight 20
    color: '#A9A9A9', // Figma: #A9A9A9 (neutral[500])
    letterSpacing: 0.5, // Figma: letterSpacing 0.5
    marginBottom: 4, // Figma: small gap before card
  },
});

export const FinishSetupSection = memo(FinishSetupSectionComponent);
