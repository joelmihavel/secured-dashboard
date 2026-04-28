/**
 * Review row — used by both the manual-review (Figma 4651:77691) and
 * upload-review (Figma 4651:76829) screens. Each row has a left icon + label;
 * a single-line value sits to the right, multiline value drops below.
 *
 * Pass `missing={true}` to render the empty/missing variant — the value is
 * replaced with red "- (missing)" per Figma 4651:76829.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';

import { Text } from '@/src/components';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

export type ReviewIconKey = 'hash' | 'building' | 'person' | 'people';

interface BaseRowProps {
  icon: ReviewIconKey;
  label: string;
  value: string;
  /** When true, render the red "- (missing)" placeholder instead of the value. */
  missing?: boolean;
  /** Tap → navigate to edit. Required for tap-to-edit UX. */
  onPress?: () => void;
}

export function ReviewRowSingle({ icon, label, value, missing = false, onPress }: BaseRowProps) {
  const Container = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Edit ${label}` : undefined}
    >
      <View style={styles.singleRow}>
        <View style={styles.rowLeft}>
          <RowIcon name={icon} />
          <Text style={styles.rowLabel}>{label}</Text>
        </View>
        {missing ? (
          <Text style={styles.rowMissing} numberOfLines={1}>
            <Text inherit style={styles.rowMissingDash}>- </Text>(missing)
          </Text>
        ) : (
          <Text style={styles.rowValueRight} numberOfLines={1}>{value || '—'}</Text>
        )}
      </View>
      <View style={styles.rowDivider} />
    </Container>
  );
}

export function ReviewRowMultiline({ icon, label, value, missing = false, onPress }: BaseRowProps) {
  const Container = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Edit ${label}` : undefined}
    >
      <View style={styles.multilineRow}>
        <View style={styles.rowLeft}>
          <RowIcon name={icon} />
          <Text style={styles.rowLabel}>{label}</Text>
        </View>
        {missing ? (
          <Text style={styles.rowMissingBelow}>
            <Text inherit style={styles.rowMissingDash}>- </Text>(missing)
          </Text>
        ) : (
          <Text style={styles.rowValueBelow}>{value || '—'}</Text>
        )}
      </View>
      <View style={styles.rowDivider} />
    </Container>
  );
}

function RowIcon({ name }: { name: ReviewIconKey }) {
  const size = s(16);
  switch (name) {
    case 'hash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M9 4 L7 20 M17 4 L15 20 M4 9 H20 M3 15 H19" stroke={colors.neutral[600]} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    case 'building':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 21 V7 H14 V21 M14 21 V11 H20 V21 M4 21 H20 M7 11 H11 M7 15 H11 M7 19 H11 M16 15 H18 M16 19 H18"
            stroke={colors.neutral[600]}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'person':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <SvgCircle cx={12} cy={8} r={4} stroke={colors.neutral[600]} strokeWidth={1.5} />
          <Path d="M4 21 C4 17 7 14 12 14 C17 14 20 17 20 21" stroke={colors.neutral[600]} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    case 'people':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <SvgCircle cx={9} cy={8} r={3.5} stroke={colors.neutral[600]} strokeWidth={1.5} />
          <SvgCircle cx={17} cy={9} r={3} stroke={colors.neutral[600]} strokeWidth={1.5} />
          <Path d="M3 20 C3 16.5 5.5 14 9 14 C12.5 14 15 16.5 15 20" stroke={colors.neutral[600]} strokeWidth={1.5} strokeLinecap="round" />
          <Path d="M14 20 C14 17 16 15 17 15 C18.5 15 21 17 21 20" stroke={colors.neutral[600]} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
  }
}

const styles = StyleSheet.create({
  singleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(12),
  },
  multilineRow: { gap: sv(4) },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  rowLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: colors.neutral[600],
  },
  rowValueRight: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: colors.neutral[300],
    textAlign: 'right',
    flexShrink: 1,
  },
  rowValueBelow: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: colors.neutral[300],
  },
  rowMissing: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: colors.error.radix,
    textAlign: 'right',
    flexShrink: 1,
  },
  rowMissingBelow: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: colors.error.radix,
  },
  rowMissingDash: { color: colors.neutral[600] },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.black[400],
    marginTop: sv(16),
  },
});
