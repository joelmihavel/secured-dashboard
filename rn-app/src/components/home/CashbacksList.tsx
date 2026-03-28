/**
 * CashbacksList Component (Redesigned)
 * Cashback module with stats, chart, setup steps, member status, and earnings cards.
 * Figma Reference: 4109:66469 (setup pending), 4109:66768 (invite sent), 4109:67067 (active)
 *
 * Module States:
 * - setup_pending: Shows setup steps + invite status
 * - active: Shows member status + earnings cards
 *
 * Layout: Stats section (gap=24) → Member status / Setup steps → Divider → Earnings list
 * Container: VERTICAL, gap=32, padding top=8 h=32
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';
import { CashbackStatsSection } from './CashbackStatsSection';
import { CashbackProgressChart } from './CashbackProgressChart';
import { CashbackSetupSteps } from './CashbackSetupSteps';
import { CashbackInviteStatus } from './CashbackInviteStatus';
import { CashbackMemberStatus } from './CashbackMemberStatus';
import { CashbackEarningsCard } from './CashbackEarningsCard';
import type { BarStatus, SetupStep, InviteState, CashbackEarningsEntry, CashbackModuleState } from '@/src/services/api/dashboard';

// Re-exported for barrel consumers
export type { CashbackModuleState };

// Legacy type kept for backward compat
export type CashbackStatus = 'paid' | 'delayed' | 'missed' | 'pending';

export interface CashbacksListProps {
  moduleState: CashbackModuleState;
  earned: number;
  potential: number;
  remainingCashback?: number;
  chartBars?: BarStatus[];
  announcementText?: string;
  infoText?: string;
  setupSteps: SetupStep[];
  inviteState?: InviteState;
  entries: CashbackEarningsEntry[];
  onEntryPress?: (entry: CashbackEarningsEntry) => void;
  onCopyInviteLink?: () => void;
  onNeedHelp?: () => void;
  onStepPress?: (step: SetupStep) => void;
  onLearnMore?: () => void;
  onStatusPress?: () => void;
}

function CashbacksListComponent({
  moduleState,
  earned,
  potential,
  remainingCashback,
  chartBars,
  announcementText,
  infoText,
  setupSteps,
  inviteState,
  entries,
  onEntryPress,
  onCopyInviteLink,
  onNeedHelp,
  onStepPress,
  onLearnMore,
  onStatusPress,
}: CashbacksListProps) {
  const isActive = moduleState === 'active';

  return (
    <View style={styles.container}>
      {/* === STATS SECTION (gap=24) === */}
      <View style={styles.statsBlock}>
        {/* Announcement Banner */}
        {announcementText ? (
          <View style={styles.announcementBanner}>
            <Text style={styles.announcementText}>{announcementText}</Text>
          </View>
        ) : null}

        {/* Stats + Chart (gap=20) */}
        <View style={styles.statsChartBlock}>
          <CashbackStatsSection earned={earned} potential={potential} />
          <CashbackProgressChart bars={chartBars} />
        </View>

        {/* Info text below chart */}
        {infoText ? <Text style={styles.infoText}>{infoText}</Text> : null}
      </View>

      {/* === MEMBER STATUS (active) or SETUP STEPS (pending) === */}
      {isActive ? (
        <CashbackMemberStatus
          status="verified"
          onPress={onStatusPress}
        />
      ) : (
        <View style={styles.setupSection}>
          <Text style={styles.sectionLabel}>COMPLETE SETUP TO ACCESS YOUR CASHBACK</Text>
          <CashbackSetupSteps steps={setupSteps} onStepPress={onStepPress} />
          {inviteState ? (
            <CashbackInviteStatus
              state={inviteState}
              onCopyInviteLink={onCopyInviteLink}
              onNeedHelp={onNeedHelp}
            />
          ) : null}
          {onLearnMore ? (
            <View style={styles.helpBanner}>
              <Text style={styles.helpText}>How to invite your landlord?</Text>
              <Text style={styles.helpLink} onPress={onLearnMore}>Learn More</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* === DIVIDER === */}
      <View style={styles.divider} />

      {/* === EARNINGS SECTION === */}
      <View style={styles.earningsSection}>
        <Text style={styles.sectionLabel}>
          {isActive ? 'YOUR CASHBACK' : 'YOUR CASHBACK'}
        </Text>
        <View style={styles.earningsCards}>
          {entries.map((entry) => (
            <CashbackEarningsCard
              key={entry.id}
              entry={entry}
              onPress={onEntryPress}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32, // Figma: match screen padding
    paddingTop: 8,
    gap: 32, // Figma: 32px between major sections
    alignSelf: 'stretch',
  },

  // Stats section
  statsBlock: {
    gap: 24, // Figma: Frame 2095586466 gap=24
  },
  statsChartBlock: {
    gap: 20, // Figma: Frame 2095586756 gap=20
  },

  // Announcement banner
  announcementBanner: {
    backgroundColor: colors.black[600], // #1A1A1A
    borderRadius: 200, // pill
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  announcementText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[600], // #878787
    textAlign: 'center',
  },

  // Info text below chart
  infoText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[600], // #878787
  },

  // Setup section
  setupSection: {
    gap: 16, // Figma: Frame 2095586752 gap=16
  },

  // Section labels
  sectionLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    color: colors.neutral[500], // #A9A9A9
  },

  // Help banner
  helpBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.black[600], // #1A1A1A
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  helpText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.brand[500], // #FF9A6D
    flex: 1,
  },
  helpLink: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.brand[500], // #FF9A6D
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.black[400], // #4D4D4D
  },

  // Earnings section
  earningsSection: {
    gap: 16, // Figma: Frame 2095586753 gap=16
  },
  earningsCards: {
    gap: 4, // Figma: Frame 2095586644 gap=4
  },
});

export const CashbacksList = memo(CashbacksListComponent);
