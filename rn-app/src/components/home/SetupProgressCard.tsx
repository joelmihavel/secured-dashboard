/**
 * SetupProgressCard Component
 * Verification progress timeline with 3 steps + info bar CTA.
 * Returns null when all verifications are complete.
 *
 * Figma Reference: 769:309136
 *
 * Figma Pixel-Perfect Values:
 * - Card: bg #202020, borderRadius 12, py 24, px 16, gap 24
 * - Title (769:309137): 14/20, Regular, #CBCBCB
 * - Timeline row: gap 8, indicator 20x20 (12x12 dot centered)
 * - Step title: 14/20, Regular, #CBCBCB
 * - Step subtitle: 12/20, Regular, #878787
 * - Connector: 1px wide, fills gap between dots
 * - Dot active: #FF9A6D (brand[500]), inactive: #1A1A1A (black[600])
 * - Info bar (769:309160): bg #1A1A1A, borderRadius 12, py 8, px 12, gap 10
 *   - Text + link: 12/20, #FF9A6D, link underlined
 *
 * Progress logic:
 * - Step 1 (bank details): always complete (prerequisite to reach this screen)
 * - Step 2 (address proof): orange when utility_verified = true
 * - Step 3 (confirm tenancy): orange when landlord invited;
 *   subtitle flips to "Landlord is invited" when complete
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

export interface SetupProgressCardProps {
  /** Always true — user can't land here without bank verification. */
  bankDetailsComplete?: boolean;
  addressProofComplete?: boolean;
  landlordInvited?: boolean;
  onCtaPress?: () => void;
  ctaLabel?: string;
}

function SetupProgressCardComponent({
  bankDetailsComplete = true,
  addressProofComplete = false,
  landlordInvited = false,
  onCtaPress,
  ctaLabel,
}: SetupProgressCardProps) {
  // Disappear when all verifications are complete
  if (bankDetailsComplete && addressProofComplete && landlordInvited) {
    return null;
  }

  const steps = [
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
      title: 'Confirm your Tenancy',
      subtitle: landlordInvited
        ? 'Landlord is invited'
        : 'complete landlord verification',
      isComplete: landlordInvited,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Title — Figma 769:309137 */}
      <Text style={styles.titleText}>
        Cashback will be accumulated until verification
      </Text>

      {/* Progress timeline — inline, no shared component dependency */}
      <View>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <View key={index} style={styles.timelineRow}>
              {/* Left: dot + connector line */}
              <View style={styles.indicatorColumn}>
                <View style={styles.indicatorContainer}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: step.isComplete ? DOT_ACTIVE : DOT_INACTIVE },
                    ]}
                  />
                </View>
                {!isLast && <View style={styles.connectorLine} />}
              </View>

              {/* Right: title + subtitle */}
              <View style={[styles.textColumn, isLast && styles.textColumnLast]}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
              </View>
            </View>
          );
        })}
      </View>

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

// Dot colors — Figma indicators
const DOT_ACTIVE = colors.brand[500]; // #FF9A6D
const DOT_INACTIVE = colors.black[600]; // #1A1A1A

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 32,
    backgroundColor: colors.black[500], // #202020
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 24,
  },
  titleText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[300], // #CBCBCB
  },
  // Timeline row — Figma 769:309138
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  // Indicator column stretches to fill row height so connector connects dots
  indicatorColumn: {
    width: 20,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  // 20x20 container centering a 12x12 dot
  indicatorContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // 1px connector fills from bottom of dot to bottom of row
  connectorLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.black[400], // #4D4D4D — subtle on #202020
  },
  // Text column — gap 4 between title and subtitle, paddingBottom spaces rows
  textColumn: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    paddingBottom: 24, // Figma gap between timeline rows
  },
  textColumnLast: {
    paddingBottom: 0,
  },
  stepTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[300], // #CBCBCB
  },
  stepSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[600], // #878787
  },
  // Info bar — Figma 769:309160
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.black[600], // #1A1A1A
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
    color: colors.brand[500], // #FF9A6D
  },
  infoBarLink: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.brand[500], // #FF9A6D
    textDecorationLine: 'underline',
  },
});

export const SetupProgressCard = memo(SetupProgressCardComponent);
