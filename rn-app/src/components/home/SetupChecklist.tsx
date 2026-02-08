/**
 * SetupChecklist Component
 * "Waiting for Landlord's approval" checklist with indicator dots
 * Figma Reference: 243-4258, 243-4462, etc.
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/ui';
import { colors, spacing, radius, typography } from '@/src/theme';

export interface SetupChecklistProps {
  bankDetailsComplete?: boolean;
  addressProofComplete?: boolean;
  landlordInvited?: boolean;
  showHeader?: boolean;
  headerText?: string;
}

interface ChecklistItemProps {
  title: string;
  subtitle: string;
  isComplete: boolean;
  isLast?: boolean;
}

function ChecklistItem({ title, subtitle, isComplete, isLast = false }: ChecklistItemProps) {
  return (
    <View style={styles.itemRow}>
      {/* Indicator + connecting line */}
      <View style={styles.indicatorColumn}>
        <View
          style={[
            styles.indicator,
            { backgroundColor: isComplete ? colors.brand[500] : colors.black[400] },
          ]}
        />
        {!isLast && (
          <View
            style={[
              styles.connectingLine,
              { backgroundColor: isComplete ? `${colors.brand[500]}80` : colors.black[400] },
            ]}
          />
        )}
      </View>

      {/* Text content */}
      <View style={styles.itemTextContainer}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function SetupChecklistComponent({
  bankDetailsComplete = false,
  addressProofComplete = false,
  landlordInvited = false,
  showHeader = true,
  headerText = "Waiting for Landlord's approval",
}: SetupChecklistProps) {
  const items = [
    {
      title: "Add landlord's bank details",
      subtitle: 'enables secure payouts',
      isComplete: bankDetailsComplete,
    },
    {
      title: 'Upload address proof',
      subtitle: 'for verification',
      isComplete: addressProofComplete,
    },
    {
      title: 'Invite your landlord',
      subtitle: 'needed for cashback eligibility',
      isComplete: landlordInvited,
    },
  ];

  return (
    <View style={styles.container}>
      {showHeader && (
        <Text style={styles.header}>{headerText}</Text>
      )}
      <View style={styles.checklistContainer}>
        {items.map((item, index) => (
          <ChecklistItem
            key={index}
            title={item.title}
            subtitle={item.subtitle}
            isComplete={item.isComplete}
            isLast={index === items.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black[600],
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    fontSize: 14,
    color: colors.neutral[300],
    fontFamily: typography.bodyMd2.fontFamily,
  },
  checklistContainer: {
    gap: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  indicatorColumn: {
    alignItems: 'center',
    width: 20,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  connectingLine: {
    width: 2,
    height: 32,
    marginTop: 4,
  },
  itemTextContainer: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 14,
    color: colors.neutral[300],
    fontFamily: typography.bodyMd2.fontFamily,
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.neutral[600],
    fontFamily: typography.bodySm.fontFamily,
  },
});

export const SetupChecklist = memo(SetupChecklistComponent);
