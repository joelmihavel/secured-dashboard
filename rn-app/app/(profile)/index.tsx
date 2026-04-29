/**
 * Profile Screen
 * Figma Nodes: 4651:143792 (Profile main), 4651:143883 (Secured Benefits sheet)
 *
 * Personal account hub: avatar + agreement date, three pill menu items (View Agreement,
 * Landlord Bank Details, Secured Benefits), Support section, Sign Out pill,
 * Delete Account link. The "Secured Benefits" pill opens a bottom sheet with a
 * horizontal carousel of notepad-style benefit cards.
 *
 * "Landlord Bank Details" routes to a READ-ONLY screen — changing the
 * landlord's payout account is intentionally support-gated (fraud vector:
 * a tenant could redirect rent to their own account). Don't relabel this
 * pill "Edit ..." until there's a real edit flow with re-verification.
 *
 * The "Finances → Payment Methods" row was removed (the underlying screen is
 * unbuilt; the row was wired to /edit-bank-details, duplicating the landlord
 * pill above). Bring it back when there's a real payment-methods management
 * surface to point it at.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  FlatList,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import Svg, { Path } from 'react-native-svg';

import {
  Screen,
  Text,
  Avatar,
  BackButton,
  PrimaryButton,
  BottomSheet,
} from '@/src/components';
import { useDashboard, useAuth, useDeleteAccount } from '@/src/hooks';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const SECURED_BENEFITS = [
  '1% cashback on timely rental payment',
  'Zero Security Deposits',
  'First dibs on upcoming flent homes (coming soon)',
  'Home design @zero service fee (coming soon)',
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { user, tenancy } = useDashboard();
  const { signOut } = useAuth();
  const deleteAccount = useDeleteAccount();
  const [benefitsOpen, setBenefitsOpen] = useState(false);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.back();
  }, []);

  const handleViewAgreement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push('/(profile)/agreement' as never);
  }, []);

  const handleLandlordPaymentDetails = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push('/(profile)/edit-bank-details' as never);
  }, []);

  const handleOpenBenefits = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBenefitsOpen(true);
  }, []);

  const handleCloseBenefits = useCallback(() => {
    setBenefitsOpen(false);
  }, []);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:secured@flent.in?subject=Help%20Request');
  }, []);

  const handleRateApp = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
    } else {
      Linking.openURL('https://apps.apple.com/in/app/secured-by-flent/id6757275258');
    }
  }, []);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }, [signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteAccount.mutate({ reason: 'user_requested' }),
        },
      ],
    );
  }, [deleteAccount]);

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'User';
  const agreementDate = formatAgreementDate(
    (tenancy as { created_at?: string } | null)?.created_at ?? user?.created_at,
  );
  const agreementSubtitle = agreementDate
    ? `Agreement active since ${agreementDate}`
    : 'Agreement details';

  return (
    <Screen testID="profile-screen" padded={false}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back arrow + "My / Profile" title */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.headerSection}>
          <BackButton onPress={handleBack} style={styles.backButton} color={colors.white} />
          <Text style={styles.titleBase}>
            <Text inherit style={styles.titleMy}>My</Text>
            {'\n'}
            <Text inherit style={styles.titleProfile}>Profile</Text>
          </Text>
        </Animated.View>

        {/* Identity card + three menu pills */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.identitySection}>
          <View style={styles.identityCard}>
            <Avatar userId={user?.id} name={fullName} size="lg" />
            <View style={styles.identityText}>
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.agreementSubtitle}>{agreementSubtitle}</Text>
            </View>
          </View>

          <View style={styles.menuStack}>
            <MenuPill label="View Agreement" onPress={handleViewAgreement} testID="view-agreement" />
            <MenuPill label="Landlord Bank Details" onPress={handleLandlordPaymentDetails} testID="landlord-payment-details" />
            <MenuPill
              label="Secured Benefits →"
              onPress={handleOpenBenefits}
              accent
              testID="secured-benefits"
            />
          </View>
        </Animated.View>

        {/* Support section */}
        <Animated.View entering={FadeInDown.delay(160).duration(350)} style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.menuStack}>
            <MenuPill label="Contact Support" onPress={handleContactSupport} testID="contact-support" />
            <MenuPill label="Rate the App" onPress={handleRateApp} testID="rate-app" />
          </View>
        </Animated.View>

        {/* Sign Out + Delete */}
        <Animated.View entering={FadeInDown.delay(240).duration(350)} style={styles.bottomSection}>
          <MenuPill label="Sign Out" onPress={handleSignOut} testID="sign-out" />
          <Pressable
            onPress={handleDeleteAccount}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="delete-account"
          >
            <Text style={styles.deleteAccount}>Delete Account</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <SecuredBenefitsSheet visible={benefitsOpen} onClose={handleCloseBenefits} />
    </Screen>
  );
}

/** Centered pill menu item — bg #202020, radius 12, 14px Regular text. */
function MenuPill({
  label,
  onPress,
  accent = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  accent?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text style={[styles.pillText, accent && styles.pillTextAccent]}>{label}</Text>
    </Pressable>
  );
}

/** "What are my Secured Benefits?" bottom sheet with notepad-style benefit cards. */
function SecuredBenefitsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const renderItem = useCallback(({ item }: { item: string }) => (
    <BenefitCard label={item} />
  ), []);

  return (
    <BottomSheet visible={visible} onClose={onClose} paddingHorizontal={0}>
      <View style={styles.sheetContent}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>
            What are my{'\n'}
            <Text inherit style={styles.sheetTitleAccent}>Secured Benefits?</Text>
          </Text>
        </View>

        <FlatList
          data={SECURED_BENEFITS as unknown as string[]}
          renderItem={renderItem}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.benefitsTrack}
          ItemSeparatorComponent={() => <View style={{ width: s(16) }} />}
          decelerationRate="fast"
          snapToInterval={s(244 + 16)}
          snapToAlignment="start"
        />

        <View style={styles.sheetFooter}>
          <PrimaryButton title="Close" onPress={onClose} showDivider testID="close-benefits" />
        </View>
      </View>
    </BottomSheet>
  );
}

/** Notepad-style benefit card — spiral binding dots, paperclip, + marker, label. */
function BenefitCard({ label }: { label: string }) {
  return (
    <View style={styles.benefitCard}>
      {/* Spiral binding dots across the top */}
      <View style={styles.spiralRow} pointerEvents="none">
        {Array.from({ length: 11 }).map((_, i) => (
          <View key={i} style={styles.spiralDot} />
        ))}
      </View>

      {/* Paperclip top-left */}
      <View style={styles.paperclipSlot} pointerEvents="none">
        <Paperclip />
      </View>

      {/* Center content: + marker + label */}
      <View style={styles.benefitCenter}>
        <View style={styles.benefitPlus}>
          <PlusMark />
        </View>
        <Text style={styles.benefitLabel}>{label}</Text>
      </View>
    </View>
  );
}

/** Slim metallic paperclip — same SVG path as welcome screen. */
function Paperclip() {
  return (
    <Svg width={s(20)} height={s(36)} viewBox="0 0 12.1221 39.5877" fill="none">
      <Path
        d="M12.0001 20.8239C12.0001 15.5157 12.1835 10.1714 12.0001 4.86609C11.857 0.724895 6.1445 -1.82115 3.22934 1.58326C2.3663 2.59126 2.21666 3.8089 2.20034 5.06962C2.17106 7.33714 2.20034 9.60693 2.20034 11.8746C2.20034 17.1129 2.0327 22.3811 2.20034 27.6169C2.36222 32.6708 9.82718 32.346 10.1837 27.4668C10.5562 22.3691 10.2333 30.9269 10.2333 25.8133C10.2333 25.0327 9.02024 25.0314 9.02024 25.8133C9.02024 29.978 8.97062 20.3351 8.97062 24.4997C8.97062 25.6405 9.18746 27.0356 8.87054 28.1604C8.05334 31.0607 3.54926 30.6122 3.41342 27.617C3.2297 23.5658 3.41342 19.4643 3.41342 15.4098C3.41342 11.8165 3.1589 8.12025 3.41342 4.53381C3.65042 1.19457 8.21282 0.0791738 10.1784 2.81721C10.8033 3.68769 10.7871 4.32034 10.7871 5.29294C10.7871 9.74602 10.7871 14.1992 10.7871 18.6524C10.7871 23.1055 10.7871 27.5588 10.7871 32.0119C10.7871 33.8964 10.7515 35.9761 9.22094 37.3217C7.48142 38.8511 4.38386 38.6648 2.74286 37.1162C0.414742 34.919 1.30802 29.6012 1.30802 26.7913C1.30802 22.2481 1.30802 17.705 1.30802 13.1619C1.30802 12.3813 0.0949403 12.3801 0.0949403 13.1619C0.0949403 18.1381 0.0949403 23.1143 0.0949403 28.0905C0.0949403 31.1371 -0.592898 35.4086 1.73426 37.8296C3.22178 39.377 5.73938 39.923 7.7981 39.3878C10.4531 38.6976 11.7851 36.3359 11.9769 33.722C12.2895 29.4637 12.0001 25.0897 12.0001 20.8239Z"
        fill={colors.black[400]}
      />
    </Svg>
  );
}

/** Decorative "+" cross used as benefit-card glyph (orange sparkle). */
function PlusMark() {
  const size = s(28);
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path
        d="M14 4 L15 13 L24 14 L15 15 L14 24 L13 15 L4 14 L13 13 Z"
        fill={colors.brand[500]}
      />
    </Svg>
  );
}

/** "15th September, 2025" formatter from an ISO date. */
function formatAgreementDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const day = d.getDate();
    const ord = ordinalSuffix(day);
    const month = d.toLocaleString('en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${day}${ord} ${month}, ${year}`;
  } catch {
    return '';
  }
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: sv(48),
    gap: sv(40),
  },

  // Header
  headerSection: {
    paddingHorizontal: s(40),
    paddingTop: sv(16),
    gap: sv(24),
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  titleBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(48),
    lineHeight: sf(64),
    letterSpacing: -2,
  },
  titleMy: {
    color: colors.neutral[500],
  },
  titleProfile: {
    color: colors.brand[500],
  },

  // Identity card + menu stack
  identitySection: {
    paddingHorizontal: s(40),
    gap: sv(4),
  },
  identityCard: {
    paddingVertical: sv(16),
    paddingBottom: sv(24),
    gap: sv(16),
    alignItems: 'flex-start',
  },
  identityText: {
    width: '100%',
    gap: sv(4),
  },
  userName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sf(20),
    lineHeight: sf(28),
    letterSpacing: -0.6,
    color: colors.white,
  },
  agreementSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    letterSpacing: -0.28,
    color: colors.neutral[600],
  },

  menuStack: {
    gap: sv(4),
  },

  // Section
  section: {
    paddingHorizontal: s(40),
    gap: sv(16),
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: sf(12),
    lineHeight: sf(17),
    letterSpacing: 0,
    color: colors.neutral[600],
    textTransform: 'uppercase',
  },

  // Pill menu items
  pill: {
    backgroundColor: colors.black[500],
    borderRadius: 12,
    paddingHorizontal: s(24),
    paddingVertical: sv(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPressed: {
    opacity: 0.7,
  },
  pillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: colors.neutral[300],
    textAlign: 'center',
  },
  pillTextAccent: {
    color: colors.brand[500],
  },

  // Bottom section (sign out + delete)
  bottomSection: {
    paddingHorizontal: s(40),
    gap: sv(24),
  },
  deleteAccount: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: colors.error.radix,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },

  // Bottom sheet
  sheetContent: {
    paddingTop: sv(16),
    paddingBottom: sv(24),
    gap: sv(30),
  },
  sheetHeader: {
    paddingHorizontal: s(48),
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(28),
    lineHeight: sf(40),
    letterSpacing: -1,
    color: colors.white,
  },
  sheetTitleAccent: {
    color: colors.brand[500],
  },
  benefitsTrack: {
    paddingHorizontal: s(48),
  },
  sheetFooter: {
    paddingHorizontal: s(48),
  },

  // Benefit card (notepad)
  benefitCard: {
    width: s(244),
    height: sv(321),
    backgroundColor: colors.black[500],
    overflow: 'hidden',
    position: 'relative',
  },
  spiralRow: {
    position: 'absolute',
    top: -s(4),
    left: s(4),
    right: s(4),
    height: s(14),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spiralDot: {
    width: s(14),
    height: s(14),
    borderRadius: s(7),
    backgroundColor: colors.black[700],
  },
  paperclipSlot: {
    position: 'absolute',
    top: -s(4),
    left: s(8),
    transform: [{ rotate: '163.65deg' }, { scaleY: -1 }],
  },
  benefitCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sv(16),
    transform: [{ translateY: -s(36) }],
    paddingHorizontal: s(22),
  },
  benefitPlus: {
    width: s(28),
    height: s(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(16),
    lineHeight: sf(24),
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
