/**
 * SetupProgressCard Component
 * Countdown timer + 3 setup items + "Finish Setup" button - Figma pixel-perfect
 * Figma Reference: 243-4062
 *
 * Figma Pixel-Perfect Values:
 * - Container (frame_2095586388): width 329, backgroundColor #202020, borderRadius 12
 *   - paddingVertical 24, paddingHorizontal 16, gap 24
 * - Title text: "Complete setup in 28:12:12 to unlock Cashbacks"
 *   - fontSize 14, lineHeight 20, fontWeight 400, color #CBCBCB
 * - Countdown highlight: underlined, could be accent color
 * - Indicator dot (ellipse_21906): width 12, height 12, backgroundColor #1A1A1A
 * - Connecting line (vector_59): width 1, height 47, borderColor #A6A6A6
 * - Item title: fontSize 14, lineHeight 20, fontWeight 400, color #CBCBCB
 * - Item subtitle: fontSize 12, lineHeight 20, fontWeight 400, color #878787
 * - Button indicator (rectangle_140): width 24, height 2, backgroundColor #4D4D4D, borderRadius 200
 * - Button (frame_2095586312): borderColor #FF9A6D, borderWidth 1, borderRadius 8
 *   - paddingVertical 16, paddingHorizontal 16
 *   - shadow: #995C41, offset 0/6, blur 12
 * - Button text: fontSize 14, fontWeight 500, lineHeight 20, color #FFFFFF
 */

import React, { memo, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

export interface SetupItem {
  title: string;
  subtitle: string;
  isComplete: boolean;
}

export interface SetupProgressCardProps {
  bankDetailsComplete?: boolean;
  addressProofComplete?: boolean;
  landlordInvited?: boolean;
  countdownSeconds?: number;
  onFinishSetup?: () => void;
}

function SetupProgressCardComponent({
  bankDetailsComplete = false,
  addressProofComplete = false,
  landlordInvited = false,
  countdownSeconds = 28 * 3600 + 12 * 60 + 12, // Default: 28:12:12
  onFinishSetup,
}: SetupProgressCardProps) {
  const [seconds, setSeconds] = useState(countdownSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const setupItems: SetupItem[] = [
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
      {/* Countdown title */}
      <View style={styles.titleRow}>
        <Text style={styles.titleText}>Complete setup in </Text>
        <Text style={styles.countdownText}>{formatCountdown(seconds)}</Text>
        <Text style={styles.titleText}> to</Text>
      </View>
      <Text style={styles.titleText}>unlock Cashbacks</Text>

      {/* Setup checklist */}
      <View style={styles.checklistContainer}>
        {setupItems.map((item, index) => (
          <SetupItemRow
            key={index}
            title={item.title}
            subtitle={item.subtitle}
            isActive={item.isComplete}
            isLast={index === setupItems.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

interface SetupItemRowProps {
  title: string;
  subtitle: string;
  isActive: boolean;
  isLast: boolean;
}

function SetupItemRow({ title, subtitle, isActive, isLast }: SetupItemRowProps) {
  return (
    <View style={styles.itemRow}>
      {/* Indicator + vertical line */}
      <View style={styles.indicatorColumn}>
        <View
          style={[
            styles.indicator,
            { backgroundColor: isActive ? '#FF9A6D' : '#1A1A1A' }, // Figma: #FF9A6D active, #1A1A1A inactive
          ]}
        />
        {!isLast && (
          <View
            style={[
              styles.connectingLine,
              { backgroundColor: isActive ? 'rgba(255, 154, 109, 0.5)' : '#A6A6A6' }, // Figma: #A6A6A6
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

// Figma pixel-perfect styles
const styles = StyleSheet.create({
  container: {
    marginHorizontal: 32, // Figma: centered with 32px margins
    width: 329, // Figma: width 329
    backgroundColor: '#202020', // Figma: #202020 (black[500])
    borderRadius: 12, // Figma: borderRadius 12
    paddingVertical: 24, // Figma: paddingVertical 24
    paddingHorizontal: 16, // Figma: paddingHorizontal 16
    gap: 24, // Figma: gap 24
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  titleText: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    color: '#CBCBCB', // Figma: #CBCBCB (neutral[300])
  },
  countdownText: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    color: '#FF9A6D', // Figma: #FF9A6D (brand[500]) for emphasis
    textDecorationLine: 'underline',
  },
  checklistContainer: {
    gap: 16, // Figma: gap between checklist items
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12, // Figma: gap between indicator and text
  },
  indicatorColumn: {
    alignItems: 'center',
  },
  indicator: {
    width: 12, // Figma: width 12
    height: 12, // Figma: height 12
    borderRadius: 6, // Figma: fully rounded
  },
  connectingLine: {
    width: 1, // Figma: borderWidth 1 (using width for solid line)
    height: 47, // Figma: height 47
  },
  itemTextContainer: {
    flex: 1,
    gap: 4, // Figma: gap between title and subtitle
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
    // Note: textAlign LEFT (default) per Figma -- subtitle text is left-aligned within the list item
  },
});

export const SetupProgressCard = memo(SetupProgressCardComponent);
