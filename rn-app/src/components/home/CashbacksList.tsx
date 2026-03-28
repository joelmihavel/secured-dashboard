/**
 * CashbacksList Component — Full Module Rewrite
 * Renders the complete Cashbacks tab content with stats, chart, setup steps,
 * invite status, and cashback earnings list.
 * Figma Reference: 4109:66469, 4109:66768, 4109:67067
 *
 * Module States (driven by landlord verification):
 * - setup_pending: landlordApproved is null → horizontal setup cards, "Invite Sent" bar
 * - landlord_rejected: landlordApproved is false → same + red rejection text
 * - active: landlordApproved is true → vertical list, "Verified" badge
 *
 * Layout: Content Frame (329px, VERTICAL, gap=32)
 *   ├── Stats Section (announcement + earned/potential + subtitle + chart + info)
 *   ├── Remaining Cashback / Member Status
 *   ├── Divider
 *   ├── Setup Steps Section
 *   └── Cashback Earnings (section header + transaction cards)
 */

import React, { memo, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '@/src/components/ui';
import { CashbackStatsSection } from './CashbackStatsSection';
import { CashbackProgressChart } from './CashbackProgressChart';
import { CashbackSetupSteps } from './CashbackSetupSteps';
import { CashbackInviteStatus } from './CashbackInviteStatus';
import { CashbackMemberStatus } from './CashbackMemberStatus';
import { CashbackEarningsCard } from './CashbackEarningsCard';
import type { BarStatus, SetupStep, InviteState, CashbackEarningsEntry, CashbackModuleState } from '@/src/services/api/dashboard';

// ==============================================
// Types
// ==============================================

// Re-exported from dashboard service (canonical source)
export type { CashbackModuleState };

export interface CashbacksListProps {
  // Module state
  moduleState: CashbackModuleState;

  // Stats
  earned: number;
  potential: number;
  remainingCashback?: number;

  // Chart bars (12 months)
  chartBars?: BarStatus[];

  // Announcement banner text
  announcementText?: string;

  // Info text below chart
  infoText?: string;

  // Setup steps
  setupSteps: SetupStep[];

  // Invite state (only for setup_pending / landlord_rejected)
  inviteState?: InviteState;

  // Cashback earnings
  entries: CashbackEarningsEntry[];

  // Callbacks
  onEntryPress?: (entry: CashbackEarningsEntry) => void;
  onCopyInviteLink?: () => void;
  onNeedHelp?: () => void;
  onStepPress?: (step: SetupStep) => void;
  onLearnMore?: () => void;
}

// ==============================================
// Component
// ==============================================

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
}: CashbacksListProps) {
  const isActive = moduleState === 'active';
  const setupLayout = isActive ? 'vertical' : 'horizontal';
  const resolvedInviteState = moduleState === 'landlord_rejected' ? 'rejected' : 'sent';

  return (
    <View style={styles.container}>
      {/* 1. Stats Section (announcement + earned/potential + subtitle + chart) */}
      <View style={styles.statsBlock}>
        {/* Announcement Banner — inside statsBlock per Figma gap=20 */}
        {announcementText != null && (
          <View style={styles.announcementBanner}>
            <Text style={styles.announcementText}>{announcementText}</Text>
          </View>
        )}

        <CashbackStatsSection
          earned={earned}
          potential={potential}
          subtitle="savings on rent so far"
        >
          <CashbackProgressChart bars={chartBars} />
        </CashbackStatsSection>
      </View>

      {/* 3. Info Row below chart */}
      {infoText != null && (
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>{infoText}</Text>
          <View style={styles.divider} />
        </View>
      )}

      {/* 4. Remaining Cashback (State 1/2) or Member Status (State 3) */}
      {isActive ? (
        <CashbackMemberStatus />
      ) : (
        remainingCashback != null && (
          <View style={styles.remainingRow}>
            <Text style={styles.remainingLabel}>REMAINING CASHBACK</Text>
            <Text style={styles.remainingValue}>
              ₹ {remainingCashback.toLocaleString('en-IN')}
            </Text>
          </View>
        )
      )}

      {/* 5. Divider */}
      <View style={styles.divider} />

      {/* 6. Setup Steps Section — Figma: all inside Frame 2095586752 gap=16 */}
      <View style={styles.setupSection}>
        <Text style={styles.sectionHeader}>
          {'COMPLETE SETUP TO ACCESS YOUR CASHBACK'}
        </Text>
        <CashbackSetupSteps
          steps={setupSteps}
          layout={setupLayout}
          onStepPress={onStepPress}
        />

        {/* 7. Invite Status (only for setup_pending / landlord_rejected) */}
        {!isActive && inviteState != null && (
          <CashbackInviteStatus
            state={resolvedInviteState}
            onCopyInviteLink={onCopyInviteLink}
            onNeedHelp={onNeedHelp}
          />
        )}

        {/* 8. Help Banner — Figma: inside setup section, gap=16 */}
        <View style={styles.helpBanner}>
          <Text style={styles.helpText}>How to invite your landlord?</Text>
          <TouchableOpacity
            onPress={onLearnMore}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.helpLink}>Learn More</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 9. Cashback Earnings Section */}
      {entries.length > 0 && (
        <View style={styles.earningsSection}>
          <Text style={styles.sectionHeader}>YOUR CASHBACK EARNINGS</Text>
          <View style={styles.earningsList}>
            {entries.map((entry) => (
              <CashbackEarningsCard
                key={entry.id}
                entry={entry}
                onPress={onEntryPress}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ==============================================
// Styles
// ==============================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32, // Figma: screen padding
    gap: 32, // Figma: content frame gap=32 between major sections
    alignSelf: 'stretch',
  },

  // Announcement Banner
  announcementBanner: {
    backgroundColor: '#1A1A1A', // Figma: dark bg
    borderRadius: 200, // Figma: pill
    paddingHorizontal: 12, // Figma: 12px
    paddingVertical: 8, // Figma: 8px
    alignSelf: 'stretch',
  },
  announcementText: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: '#FF9A6D', // Figma: brand accent
    textAlign: 'center', // Figma: center
  },

  // Stats Block
  statsBlock: {
    gap: 20, // Figma: Frame 2095586756 gap=20 (inner stats+chart container)
  },

  // Info Row
  infoRow: {
    gap: 16, // Figma: 16px between info text and divider
  },
  infoText: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: '#A9A9A9', // Figma: label gray
  },

  // Remaining Cashback Row (State 1/2)
  remainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainingLabel: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: '#A9A9A9', // Figma: label gray
    flex: 1,
  },
  remainingValue: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: '#FF9A6D', // Figma: brand accent
  },

  // Divider
  divider: {
    height: 0.25, // Figma: strokeWeight 0.25
    backgroundColor: '#4D4D4D', // Figma: #4D4D4D
  },

  // Setup Section
  setupSection: {
    gap: 16, // Figma: 16px between header and steps
  },
  sectionHeader: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: '#A9A9A9', // Figma: label gray
  },

  // Help Banner
  helpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A', // Figma: dark bg
    borderRadius: 8, // Figma: 8px (not pill!)
    paddingHorizontal: 12, // Figma: 12px
    paddingVertical: 8, // Figma: 8px
    gap: 10, // Figma: 10px
  },
  helpText: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: '#FF9A6D', // Figma: brand accent
    flex: 1, // Figma: FILL
  },
  helpLink: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    color: '#FF9A6D', // Figma: brand accent
  },

  // Earnings Section
  earningsSection: {
    gap: 16, // Figma: 16px between header and list
  },
  earningsList: {
    gap: 4, // Figma: 4px between transaction cards
  },
});

export const CashbacksList = memo(CashbacksListComponent);
