/**
 * Profile Agreement Screen - View Agreement Details
 * Figma Reference: 41-9811 (My Profile / Agreement)
 *
 * Read-only view of agreement details. Contact support to make changes.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text, BackButton, PrimaryButton } from '@/src/components';
import { DottedGridPattern } from '@/src/components/patterns';
import { useDashboard } from '@/src/hooks';
import { colors } from '@/src/theme';

const FIGMA_COLORS = {
  background: colors.black[700],
  titleGray: colors.neutral[500],
  accent: colors.brand[500],
  label: colors.neutral[600],
  value: colors.neutral[300],
  icon: colors.black[200],
  divider: colors.black[400],
  white: colors.white,
  footer: colors.neutral[500],
} as const;

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

function DetailDivider() {
  return <View style={styles.divider} />;
}

const STACKED_LABELS = new Set(['Property Name', 'Tenant(s)', 'Landlord(s)']);

export default function ProfileAgreementScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { tenancy } = useDashboard();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.back();
  }, []);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('mailto:secured@flent.in?subject=Edit%20Agreement%20Request');
  }, []);

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
      { label: 'Agreement ID', value: (t?.agreement_id as string) ?? 'N/A' },
      { label: 'Property Name', value: (t?.property_address as string) ?? 'Not available' },
      { label: 'Tenant(s)', value: Array.isArray(t?.tenant_names) && (t.tenant_names as string[]).length > 0 ? (t.tenant_names as string[]).join(', ') : 'Not available' },
      { label: 'Landlord(s)', value: (t?.landlord_name as string) ?? 'Not available' },
      { label: 'Monthly Rent', value: t?.monthly_rent ? formatCurrency(t.monthly_rent as number) : '\u20B9 40,000' },
      { label: 'One-Time Deposit', value: (t?.security_deposit as number) ? formatCurrency(t.security_deposit as number) : 'N/A' },
      { label: 'Rent Duration', value: formatDuration(t?.lease_duration_months as number | null) },
      { label: 'Exit Date', value: formatDate(t?.lease_end_date as string | null) },
    ];
  }, [tenancy]);

  return (
    <Screen testID="profile-agreement-screen" padded={false}>
      <DottedGridPattern />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          <BackButton
            onPress={handleBack}
            style={styles.backButton}
            color={FIGMA_COLORS.white}
          />

          <Text style={styles.titleBase}>
            <Text inherit style={styles.titleGray}>{'View your '}</Text>
            <Text inherit style={styles.titleAccent}>{'agreement'}</Text>
          </Text>

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

          <View style={styles.buttonSection}>
            <PrimaryButton
              title="Contact support"
              onPress={handleContactSupport}
            />
            <Text style={styles.footerText}>
              To update your agreement details, please contact support.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  contentWrapper: { paddingHorizontal: 48, gap: 48 },
  backButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'flex-start' },
  titleBase: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 48, lineHeight: 64, letterSpacing: -2, maxWidth: 297 },
  titleGray: { color: FIGMA_COLORS.titleGray },
  titleAccent: { color: FIGMA_COLORS.accent },
  detailsContainer: { gap: 16 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  stackedRow: { flexDirection: 'column', gap: 4 },
  labelFrame: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconFrame: { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  labelText: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, lineHeight: 20, color: FIGMA_COLORS.label },
  inlineValueText: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, lineHeight: 20, color: FIGMA_COLORS.value },
  stackedValueText: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, lineHeight: 20, color: FIGMA_COLORS.value },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: FIGMA_COLORS.divider },
  buttonSection: { gap: 16, alignItems: 'center' },
  footerText: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, lineHeight: 20, color: FIGMA_COLORS.footer, textAlign: 'center' },
});
