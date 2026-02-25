/**
 * Profile Agreement Screen - View Agreement Details
 * Figma Reference: 41-9811 (My Profile / Agreement)
 *
 * Blueprint: buildbot/data/blueprints/41-9811-blueprint.json
 *
 * Layout hierarchy (agreement dark section):
 * - Content area (41:9880): column, gap=64
 *   - Status bar (41:9881): handled by SafeArea
 *   - Form wrapper (41:9882): column, gap=40, paddingH=48
 *     - Inner frame (41:9883): 297px wide, column, gap=48
 *       - Back arrow (41:9884): 32x32
 *       - Title (41:9885): "View your agreement" 297x128, 48px/64 Regular
 *       - Detail rows (41:9886): 297px wide, column, gap=16
 *         - Row types:
 *           A. Inline row (297x20, dir:row, gap:4, justify:space-between):
 *              [icon+label left] [value right]
 *              Used for: Agreement ID, Monthly Rent, One-Time Deposit,
 *                        Rent Duration, Exit Date
 *           B. Stacked row (297x44/64, dir:column, gap:4):
 *              [icon+label top] [value below, full width]
 *              Used for: Property Name, Tenant(s), Landlord(s)
 *         - Dividers between rows: Vector 297x0, stroke #4D4D4D, weight 0.25
 *
 * Label frames contain: 16x16 icon (fill #A6A6A6) + label text
 * Label text: 12px Regular #878787 (implied from fill color)
 * Value text: 14px Regular #CBCBCB (implied from fill color)
 * Icon frames: 16x16 with vector child, fill #A6A6A6
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text } from '@/src/components';
import { DottedGridPattern } from '@/src/components/patterns';
import { useDashboard } from '@/src/hooks';
import { colors } from '@/src/theme';

// Figma blueprint colors (41-9811)
const FIGMA_COLORS = {
  background: colors.black[700],    // colors.black[700]
  titleGray: colors.neutral[500],     // colors.neutral[500]
  accent: colors.brand[500],        // colors.brand[500]
  label: colors.neutral[600],          // colors.neutral[600]
  value: colors.neutral[300],          // colors.neutral[300]
  icon: colors.black[200],           // Icon fill color from blueprint
  divider: colors.black[400],        // Divider stroke
  white: colors.white,          // colors.white
} as const;

// Icon mapping for agreement detail labels
const LABEL_ICONS: Record<string, string> = {
  'Agreement ID': 'document-text-outline',
  'Property Name': 'location-outline',
  'Tenant(s)': 'people-outline',
  'Landlord(s)': 'person-outline',
  'Monthly Rent': 'cash-outline',
  'One-Time Deposit': 'wallet-outline',
  'Rent Duration': 'calendar-outline',
  'Exit Date': 'time-outline',
};

/**
 * Inline detail row: label+icon on left, value on right (single line)
 * Blueprint: 297x20, dir:row, gap:4, justify:space-between, align:center
 * Used for: Agreement ID, Monthly Rent, One-Time Deposit, Rent Duration, Exit Date
 */
function InlineDetailRow({ label, value }: { label: string; value: string }) {
  const iconName = LABEL_ICONS[label] ?? 'document-text-outline';
  return (
    <View style={styles.inlineRow}>
      <View style={styles.labelFrame}>
        <View style={styles.iconFrame}>
          <Ionicons name={iconName as keyof typeof Ionicons.glyphMap} size={12} color={FIGMA_COLORS.icon} />
        </View>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <Text style={styles.inlineValueText}>{value}</Text>
    </View>
  );
}

/**
 * Stacked detail row: label+icon on top, value below (multi-line value)
 * Blueprint: 297x44/64, dir:column, gap:4, align:flex-start, justify:center
 * Used for: Property Name, Tenant(s), Landlord(s)
 */
function StackedDetailRow({ label, value }: { label: string; value: string }) {
  const iconName = LABEL_ICONS[label] ?? 'document-text-outline';
  return (
    <View style={styles.stackedRow}>
      <View style={styles.labelFrame}>
        <View style={styles.iconFrame}>
          <Ionicons name={iconName as keyof typeof Ionicons.glyphMap} size={12} color={FIGMA_COLORS.icon} />
        </View>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <Text style={styles.stackedValueText}>{value}</Text>
    </View>
  );
}

/** Thin divider between detail rows - Blueprint: Vector 297x0, stroke #4D4D4D, weight 0.25 */
function DetailDivider() {
  return <View style={styles.divider} />;
}

// Define which labels use stacked (column) layout vs inline (row) layout
const STACKED_LABELS = new Set(['Property Name', 'Tenant(s)', 'Landlord(s)']);

export default function ProfileAgreementScreen() {
  const router = useRouter();
  const { tenancy } = useDashboard();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  // Derive agreement detail rows from tenancy data with Figma demo fallbacks
  const details = useMemo(() => {
    const formatCurrency = (amount: number) =>
      `\u20B9 ${amount.toLocaleString('en-IN')}`;

    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return '31 Dec, 2027';
      try {
        const d = new Date(dateStr);
        const day = d.getDate();
        const month = d.toLocaleDateString('en-IN', { month: 'short' });
        const year = d.getFullYear();
        return `${day} ${month}, ${year}`;
      } catch {
        return '31 Dec, 2027';
      }
    };

    const formatDuration = (months: number | null | undefined) => {
      if (!months) return '11 Months';
      return `${months} Month${months !== 1 ? 's' : ''}`;
    };

    const t = tenancy as Record<string, unknown> | null;

    return [
      {
        label: 'Agreement ID',
        value: (t?.agreement_id as string) ?? 'KIA 123456789',
      },
      {
        label: 'Property Name',
        value:
          (t?.property_address as string) ??
          'Prestige Pinestripe, Bommanahalli, Bengaluru 560037',
      },
      {
        label: 'Tenant(s)',
        value:
          (t?.tenant_names as string) ??
          'Rahul Joshi, Ashish Shakya,  Gursimran Khamba',
      },
      {
        label: 'Landlord(s)',
        value:
          (t?.landlord_name as string) ??
          'Tanmay Bhatt, Kaneez Surkha',
      },
      {
        label: 'Monthly Rent',
        value: t?.monthly_rent
          ? formatCurrency(t.monthly_rent as number)
          : '\u20B9 40,000',
      },
      {
        label: 'One-Time Deposit',
        value: t?.security_deposit
          ? formatCurrency(t.security_deposit as number)
          : '\u20B9 130,000',
      },
      {
        label: 'Rent Duration',
        value: formatDuration(t?.lease_duration_months as number | null),
      },
      {
        label: 'Exit Date',
        value: formatDate(t?.lease_end_date as string | null),
      },
    ];
  }, [tenancy]);

  return (
    <Screen testID="profile-agreement-screen" padded={false}>
      <DottedGridPattern animated={true} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Content wrapper (41:9882): paddingH=48 */}
        {/* Inner frame (41:9883): 297px wide, gap=48 */}
        <View style={styles.contentWrapper}>
          {/* Back arrow (41:9884): 32x32 */}
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={FIGMA_COLORS.white} />
          </TouchableOpacity>

          {/* Title (41:9885): "View your agreement" 297x128 */}
          <Text style={styles.titleBase}>
            <Text inherit style={styles.titleGray}>{'View your '}</Text>
            <Text inherit style={styles.titleAccent}>{'agreement'}</Text>
          </Text>

          {/* Detail rows (41:9886): 297px wide, column, gap=16 */}
          <View style={styles.detailsContainer}>
            {details.map((row, index) => {
              const isStacked = STACKED_LABELS.has(row.label);
              return (
                <React.Fragment key={row.label}>
                  {isStacked ? (
                    <StackedDetailRow label={row.label} value={row.value} />
                  ) : (
                    <InlineDetailRow label={row.label} value={row.value} />
                  )}
                  {index < details.length - 1 && <DetailDivider />}
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  // Content wrapper (41:9882): paddingH=48
  // Inner frame (41:9883): 297px wide, gap=48
  contentWrapper: {
    paddingHorizontal: 48,
    gap: 48,
  },

  // Back button (41:9884): 32x32 icon container
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  // Title (41:9885): 48px/64 Regular, letterSpacing -2, width 297
  titleBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    maxWidth: 297,
  },
  titleGray: {
    color: FIGMA_COLORS.titleGray,
  },
  titleAccent: {
    color: FIGMA_COLORS.accent,
  },

  // Detail rows container (41:9886): gap=16
  detailsContainer: {
    gap: 16,
  },

  // Inline row (A pattern): 297x20, row, gap:4, justify:space-between, align:center
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },

  // Stacked row (B pattern): 297x44/64, column, gap:4
  stackedRow: {
    flexDirection: 'column',
    gap: 4,
  },

  // Label frame: row, gap:4, contains icon + label text
  labelFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Icon frame: 16x16 container for the icon
  iconFrame: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Label text: implied 12px/20 Regular #878787 from blueprint
  labelText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.label,
  },

  // Value text for inline rows: 14px/20 Regular #CBCBCB
  inlineValueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.value,
  },

  // Value text for stacked rows: 14px/20 Regular #CBCBCB, full width
  stackedValueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.value,
  },

  // Divider: Vector 297x0, stroke #4D4D4D, 0.25 weight
  divider: {
    height: 0.25,
    backgroundColor: FIGMA_COLORS.divider,
  },
});
