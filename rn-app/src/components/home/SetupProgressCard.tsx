/**
 * SetupProgressCard Component
 * Header text + 3-step setup timeline + info bar CTA
 * Uses ApplicationTimeline (same component as waitlist progress) for the checklist.
 *
 * Figma Reference: 769:309134 (node 769:309136 = card)
 *
 * Figma Pixel-Perfect Values:
 * - Container: backgroundColor #202020, borderRadius 12, paddingV 24, paddingH 16, gap 24
 * - Title (769:309137): fontSize 14, lineHeight 20, fontWeight 400, color #CBCBCB
 * - Timeline items: uses ApplicationTimeline (20x20 indicator, 12x12 dot, 8px gap, connector lines)
 * - Info bar (769:309160): bg #1A1A1A, borderRadius 12, paddingV 8, paddingH 12, gap 10
 *   - Text: fontSize 12, lineHeight 20, color #FF9A6D
 *   - "Learn More": fontSize 12, underlined, color #FF9A6D
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '@/src/components/ui';
import {
  ApplicationTimeline,
  TimelineItemData,
} from '@/src/components/waitlist/ApplicationTimeline';

export interface SetupProgressCardProps {
  bankDetailsComplete?: boolean;
  addressProofComplete?: boolean;
  landlordInvited?: boolean;
  onCtaPress?: () => void;
  ctaLabel?: string;
}

function SetupProgressCardComponent({
  bankDetailsComplete = false,
  addressProofComplete = false,
  landlordInvited = false,
  onCtaPress,
  ctaLabel,
}: SetupProgressCardProps) {
  // Map setup items to ApplicationTimeline format
  // value = primary title (14px, #CBCBCB), label = subtitle (12px, #878787)
  const timelineItems: TimelineItemData[] = [
    {
      value: "Add landlord's bank details",
      label: 'enables secure payouts',
      status: bankDetailsComplete ? 'complete' : 'pending',
    },
    {
      value: 'Upload address proof',
      label: 'for verification',
      status: addressProofComplete ? 'complete' : 'pending',
    },
    {
      value: 'Invite your landlord',
      label: 'needed for cashback eligibility',
      status: landlordInvited ? 'complete' : 'pending',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Title — Figma 769:309137 */}
      <Text style={styles.titleText}>
        Cashback will be accumulated until verification
      </Text>

      {/* Setup timeline — reuses waitlist ApplicationTimeline */}
      <ApplicationTimeline
        items={timelineItems}
        textOrder="value-first"
        testID="setup-progress-timeline"
      />

      {/* Info bar CTA — Figma 769:309160 */}
      {onCtaPress && (
        <TouchableOpacity
          style={styles.infoBar}
          onPress={onCtaPress}
          activeOpacity={0.7}
          testID="setup-progress-cta"
        >
          <Text style={styles.infoBarText}>
            {ctaLabel ?? 'How to Invite your Landlord?'}
          </Text>
          <Text style={styles.infoBarLink}>Learn More</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 32,
    backgroundColor: '#202020', // Figma 769:309136: #202020 (black[500])
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 24,
  },
  titleText: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 14,
    lineHeight: 20,
    color: '#CBCBCB', // Figma: #CBCBCB (neutral[300])
  },
  // Info bar — Figma 769:309160
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A', // Figma: #1A1A1A (black[600])
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
  },
  infoBarText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#FF9A6D', // Figma: #FF9A6D (brand[500])
  },
  infoBarLink: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#FF9A6D', // Figma: #FF9A6D (brand[500])
    textDecorationLine: 'underline',
  },
});

export const SetupProgressCard = memo(SetupProgressCardComponent);
