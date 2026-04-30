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
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';

import {
  Screen,
  Text,
  Avatar,
  BackButton,
  PrimaryButton,
  BottomSheet,
} from '@/src/components';
import { BenefitsCarousel } from '@/src/components/waitlist/BenefitsCarousel';
import { useDashboard, useAuth, useDeleteAccount } from '@/src/hooks';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

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

/** "Secured Benefits" bottom sheet — uses the waitlist BenefitsCarousel. */
function SecuredBenefitsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} paddingHorizontal={0}>
      <View style={styles.sheetContent}>
        <View style={styles.benefitsCarouselWrap}>
          <BenefitsCarousel />
        </View>

        <View style={styles.sheetFooter}>
          <PrimaryButton title="Close" onPress={onClose} showDivider testID="close-benefits" />
        </View>
      </View>
    </BottomSheet>
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
  benefitsCarouselWrap: {
    paddingLeft: s(48),
  },
  sheetFooter: {
    paddingHorizontal: s(48),
  },
});
