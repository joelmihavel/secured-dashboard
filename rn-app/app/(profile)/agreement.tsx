/**
 * Profile Agreement Screen - View Agreement Details
 * Figma Reference: 41-9811 (My Profile / Agreement)
 *
 * Simple read-only info display with 8 label/value rows.
 * Title: "View your agreement" with accent color on "agreement".
 *
 * Figma-verified values:
 * - Root: 393x1096, bg #131313
 * - Content padding: horizontal 48, gap 48
 * - Back arrow: 32x32, white
 * - Title: 48/400 letterSpacing -2, "View your " #A9A9A9 + "agreement" #FF9A6D
 * - Label: 12/400 #878787
 * - Value: 14/400 #CBCBCB
 * - Row gap: 16, label-to-value gap: ~4
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text } from '@/src/components';
import { useDashboard } from '@/src/hooks';
import { colors } from '@/src/theme';

// Figma blueprint colors (41-9811)
const COLORS = {
  background: colors.black[700],    // #131313
  titleGray: colors.neutral[500],   // #A9A9A9
  accent: colors.brand[500],        // #FF9A6D
  label: colors.neutral[600],       // #878787
  value: colors.neutral[300],       // #CBCBCB
  white: colors.white,              // #FFFFFF
} as const;

// Figma layout constants (41-9811)
const LAYOUT = {
  horizontalPadding: 48,
  contentGap: 48,
  rowGap: 16,
  labelValueGap: 4,
  backButtonSize: 32,
} as const;

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.labelText}>{label}</Text>
      <Text style={styles.valueText}>{value}</Text>
    </View>
  );
}

export default function ProfileAgreementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

    // Use tenancy data when available, otherwise Figma demo values
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
          'Prestige Pinestripe, Bommanahalli, Bengaluru 560036',
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 48,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>

        {/* Title: "View your agreement" */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleBase}>
            <Text style={styles.titleGray}>View your </Text>
            <Text style={styles.titleAccent}>agreement</Text>
          </Text>
        </View>

        {/* Detail Rows */}
        <View style={styles.detailsContainer}>
          {details.map((row) => (
            <DetailRow key={row.label} label={row.label} value={row.value} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.horizontalPadding,
  },

  // Back Button: 32x32 icon container
  backButton: {
    width: LAYOUT.backButtonSize,
    height: LAYOUT.backButtonSize,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  // Title: gap of 48 from back button, width 297 (393 - 48*2)
  titleContainer: {
    marginTop: LAYOUT.contentGap,
    width: 297,
  },
  titleBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
  },
  titleGray: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    color: COLORS.titleGray,
  },
  titleAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    color: COLORS.accent,
  },

  // Detail rows container: gap of 48 from title, rows spaced 16 apart
  detailsContainer: {
    marginTop: LAYOUT.contentGap,
    gap: LAYOUT.rowGap,
  },

  // Each row: vertical stack, label then value
  detailRow: {
    gap: LAYOUT.labelValueGap,
  },

  // Label: 12/400 #878787
  labelText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.label,
  },

  // Value: 14/400 #CBCBCB
  valueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.value,
  },
});
