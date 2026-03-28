/**
 * SetupChecklist Component
 * "Waiting for landlord's approval" checklist with indicator dots
 * Figma Reference: 243-4258, 243-4462, etc.
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/ui';

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
            { backgroundColor: isComplete ? '#FF9A6D' : '#1A1A1A' }, // Figma: #FF9A6D active, #1A1A1A inactive
          ]}
        />
        {!isLast && (
          <View
            style={[
              styles.connectingLine,
              { backgroundColor: isComplete ? 'rgba(255, 154, 109, 0.5)' : '#A6A6A6' }, // Figma: brand[500] 50% active, #A6A6A6 inactive
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
  headerText = "Waiting for landlord's approval",
}: SetupChecklistProps) {
  const items = [
    {
      title: "Add your landlord's bank details",
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
    backgroundColor: '#202020',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 24,
  },
  header: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    color: '#CBCBCB', // Figma: #CBCBCB (neutral[300])
  },
  checklistContainer: {
    gap: 24,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  indicatorColumn: {
    alignItems: 'center',
    width: 20,
  },
  indicator: {
    width: 12, // Figma: width 12
    height: 12, // Figma: height 12
    borderRadius: 6, // Figma: fully rounded
  },
  connectingLine: {
    width: 1, // Figma: borderWidth 1
    height: 47, // Figma: height 47
    marginTop: 4,
  },
  itemTextContainer: {
    flex: 1,
    gap: 4, // Figma: gap 4 between title and subtitle
  },
  itemTitle: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    color: '#CBCBCB', // Figma: #CBCBCB (neutral[300])
  },
  itemSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: fontSize 12
    lineHeight: 20, // Figma: lineHeight 20
    color: '#878787', // Figma: #878787 (neutral[600])
  },
});

export const SetupChecklist = memo(SetupChecklistComponent);
