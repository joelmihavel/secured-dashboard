/**
 * Profile Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-8760
 *
 * Blueprint: figma-1on1parity/data/41-8760-blueprint.json
 *
 * Layout hierarchy (from blueprint):
 * - Root frame (41:8760): Screen, bg #131313
 *   - Status bar frame (41:8878): handled by SafeArea
 *   - Main content frame (41:8761): column, gap=40, paddingBottom=48
 *     - Header frame (41:8762): column, gap=24, paddingH=40
 *       - Back arrow icon (41:8763): 32x32, rotated (left arrow), stroke #FFFFFF
 *       - Title text (41:8764): "My  Profile" 48px Regular, width=313 (forces 2-line wrap)
 *     - Secured Account section (41:8828): column, gap=24, paddingH=40
 *       - Menu stack (41:8830): column, gap=4
 *         - User info row (41:8831): row, gap=16, padding 16/24, bg #202020, radius=12
 *         - View Agreement row (41:8839): row, gap=16, padding 16/24, bg #202020, radius=12
 *     - Payment Information section (41:8842): column, gap=24, paddingH=40
 *       - Card (41:8844): bg #202020, radius=12, gap=8, shadow
 *         - Edit UPI Method, divider, Edit Credit Card, divider, Edit Bank Account
 *     - Support section (41:8856): column, gap=24, paddingH=40
 *       - Card (41:8858): bg #202020, radius=12, gap=8, shadow
 *         - Contact Support, divider, Rate the App
 *     - App section (41:8866): column, gap=24, paddingH=40
 *       - Card (41:8868): bg #202020, radius=12, gap=8, shadow
 *         - Sign Out, divider, Delete Account
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';

import { Screen, Text, Avatar, TextInput, PhoneInput, BackButton } from '@/src/components';
import { DottedGridPattern } from '@/src/components/patterns';
import { PaymentMethodModal } from '@/src/components/payment/PaymentMethodModal';
import type { ModalView } from '@/src/components/payment/PaymentMethodModal/types';
import { useDashboard, useAuth, useDeleteAccount, useSavedPaymentMethods } from '@/src/hooks';
import { colors } from '@/src/theme';
import { s } from '@/src/theme/scale';

// Blueprint colors (verified against 41-8760-blueprint.json)
const FIGMA_COLORS = {
  background: colors.black[700],       // colors.black[700]
  cardBackground: colors.black[500],   // colors.black[500]
  sectionTitle: colors.neutral[600],     // colors.neutral[600]
  accentOrange: colors.brand[500],     // colors.brand[500]
  titleGray: colors.neutral[500],        // colors.neutral[500]
  textPrimary: colors.white,      // colors.white
  menuItemText: colors.neutral[300],     // colors.neutral[300]
  divider: colors.black[400],          // colors.black[400]
} as const;

interface MenuItemProps {
  title: string;
  onPress: () => void;
  testID?: string;
}

/**
 * MenuItem - Blueprint node pattern: row, gap=16, padding 16/24, bg #202020, radius=12
 * Text: 14px/20 Regular #CBCBCB, flex:1 (sizingH FILL via textAutoResize HEIGHT)
 * Arrow: 16x16 #FF9A6D
 */
function MenuItem({ title, onPress, testID }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text
        style={styles.menuItemText}
      >
        {title}
      </Text>
      <Ionicons name="arrow-forward" size={16} color={FIGMA_COLORS.accentOrange} />
    </TouchableOpacity>
  );
}

/**
 * CardMenuItem - For items inside a single card (Payment Info, Support, App sections)
 * Blueprint: row, justifyContent space-between, gap=16, padding 16/24
 * Text: 14px/20 Regular #CBCBCB
 * Arrow: 16x16 #FF9A6D
 */
function CardMenuItem({ title, onPress, testID }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.cardMenuRow}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={styles.menuItemText}>{title}</Text>
      <Ionicons name="arrow-forward" size={16} color={FIGMA_COLORS.accentOrange} />
    </TouchableOpacity>
  );
}

/** Thin divider inside card sections - Blueprint: #4D4D4D, 0.25 weight */
function CardDivider() {
  return <View style={styles.cardDivider} />;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, tenancy } = useDashboard();
  const { signOut } = useAuth();
  const deleteAccount = useDeleteAccount();
  const { data: savedMethods } = useSavedPaymentMethods();

  // Payment method edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editModalMethodType, setEditModalMethodType] = useState<string>('upi');
  const [editModalMethodId, setEditModalMethodId] = useState<string>('');

  // Build payment menu items dynamically from user's saved methods
  const paymentMenuItems = useMemo(() => {
    if (!savedMethods?.length) return [];

    const items: { title: string; type: string; cardType?: string; testID: string }[] = [];

    if (savedMethods.some((m: any) => m.type === 'upi')) {
      items.push({ title: 'Edit UPI Method', type: 'upi', testID: 'edit-upi-button' });
    }
    if (savedMethods.some((m: any) => m.type === 'card' && m.card_type === 'credit')) {
      items.push({ title: 'Edit Credit Card', type: 'card', cardType: 'credit', testID: 'edit-credit-card-button' });
    }
    if (savedMethods.some((m: any) => m.type === 'card' && m.card_type === 'debit')) {
      items.push({ title: 'Edit Debit Card', type: 'card', cardType: 'debit', testID: 'edit-debit-card-button' });
    }
    if (savedMethods.some((m: any) => m.type === 'netbanking')) {
      items.push({ title: 'Edit Bank Account', type: 'netbanking', testID: 'edit-bank-account-button' });
    }

    return items;
  }, [savedMethods]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleViewAgreement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/agreement' as never);
  }, [router]);

  const handleUserProfile = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/edit' as never);
  }, [router]);

  const handleEditBankDetails = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/edit-bank-details' as never);
  }, [router]);

  const handleEditPaymentMethod = useCallback((type: string, cardType?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Find the saved method ID for this type
    const method = savedMethods?.find((m) => {
      if (type === 'card' && cardType) return m.type === 'card' && m.card_type === cardType;
      return m.type === type;
    });
    if (method) {
      setEditModalMethodType(type === 'card' && cardType === 'debit' ? 'debit_card' : type);
      setEditModalMethodId(method.id);
      setEditModalVisible(true);
    } else {
      // Fallback to full screen if no saved method found
      const params: Record<string, string> = { type };
      if (cardType) params.card_type = cardType;
      router.push({ pathname: '/(profile)/edit-payment-method', params } as never);
    }
  }, [router, savedMethods]);

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
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => signOut(),
      },
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
          onPress: () => {
            deleteAccount.mutate({ reason: 'user_requested' });
          },
        },
      ],
    );
  }, [deleteAccount]);

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'User';
  const joinDate = (() => {
    if (!user?.created_at) return '';
    try {
      const d = new Date(user.created_at);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  })();
  const userEmail = user?.email ?? '';
  const userPhone = user?.phone ?? '';
  const phoneCountryCode = '+91';
  const phoneDigits = userPhone.replace('+91', '').trim();

  return (
    <Screen testID="profile-screen" padded={false}>
      <DottedGridPattern />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main content frame (41:8761): column, gap=40, paddingBottom=48 */}
        <View style={styles.mainContent}>
          {/* Header frame (41:8762): column, gap=24, paddingH=40 */}
          <View style={styles.headerSection}>
            <BackButton
              onPress={handleBack}
              style={styles.backButton}
              color={FIGMA_COLORS.textPrimary}
            />

            {/* Title (41:8764): "My  Profile" single text with spans */}
            {/* Blueprint: width=313, height=128 (2 lines x 64px lineHeight) */}
            <Text style={styles.titleBase}>
              <Text inherit style={styles.titleMy}>{'My '}</Text>
              <Text inherit style={styles.titleSpace}>{' '}</Text>
              <Text inherit style={styles.titleProfile}>{'Profile'}</Text>
            </Text>
          </View>

          {/* Secured Account section (41:8828): column, gap=24, paddingH=40 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Secured Account
            </Text>
            {/* Menu stack (41:8830): column, gap=4 */}
            <View style={styles.menuStack}>
              {/* User Info Row (41:8831): row, gap=16, padding 16/24, bg #202020, radius=12 */}
              <TouchableOpacity
                style={styles.userInfoRow}
                onPress={handleUserProfile}
                accessibilityRole="button"
                accessibilityLabel={`View profile for ${fullName}`}
              >
                <Avatar uri={user?.avatar_url} name={fullName} size="md" />
                {/* User details (41:8833): column, gap=4, flex=1 */}
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{fullName}</Text>
                  <Text style={styles.userJoinDate}>{joinDate}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={FIGMA_COLORS.accentOrange} />
              </TouchableOpacity>

              {/* User details - read-only input fields */}
              <View style={styles.userFieldsContainer}>
                <TextInput
                  label="Name"
                  value={fullName}
                  onChangeText={() => {}}
                  disabled
                />
                {userEmail ? (
                  <TextInput
                    label="Email"
                    value={userEmail}
                    onChangeText={() => {}}
                    disabled
                  />
                ) : null}
                {phoneDigits ? (
                  <PhoneInput
                    label="Phone Number"
                    value={phoneDigits}
                    onChangeText={() => {}}
                    countryCode={phoneCountryCode}
                    disabled
                  />
                ) : null}
              </View>

              {/* View Agreement (41:8839) */}
              <MenuItem
                title="View Agreement"
                onPress={handleViewAgreement}
                testID="view-agreement-button"
              />
            </View>
          </View>

          {/* Payment Information section (41:8842): column, gap=24, paddingH=40 */}
          {/* Card (41:8844): single card bg #202020, radius=12, gap=8, with dividers */}
          {/* Shows edit bank details when bank is verified, plus saved payment method edits */}
          {(tenancy?.verification_status?.bank_verified || paymentMenuItems.length > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Payment Information
              </Text>
              <View style={styles.cardContainer}>
                {tenancy?.verification_status?.bank_verified && (
                  <>
                    <CardMenuItem
                      title="Edit Bank Details"
                      onPress={handleEditBankDetails}
                      testID="edit-bank-details-button"
                    />
                    {paymentMenuItems.length > 0 && <CardDivider />}
                  </>
                )}
                {paymentMenuItems.map((item, index) => (
                  <React.Fragment key={item.testID}>
                    {index > 0 && <CardDivider />}
                    <CardMenuItem
                      title={item.title}
                      onPress={() => handleEditPaymentMethod(item.type, item.cardType)}
                      testID={item.testID}
                    />
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}

          {/* Support section (41:8856): column, gap=24, paddingH=40 */}
          {/* Card (41:8858): single card bg #202020, radius=12, gap=8, with dividers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              support
            </Text>
            <View style={styles.cardContainer}>
              <CardMenuItem
                title="Contact Support"
                onPress={handleContactSupport}
                testID="contact-support-button"
              />
              <CardDivider />
              <CardMenuItem
                title="Rate the App"
                onPress={handleRateApp}
                testID="rate-app-button"
              />
            </View>
          </View>

          {/* App section (41:8866): column, gap=24, paddingH=40 */}
          {/* Card (41:8868): single card bg #202020, radius=12, gap=8, with dividers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              App
            </Text>
            <View style={styles.cardContainer}>
              <CardMenuItem
                title="Terms & Conditions"
                onPress={() => Linking.openURL('https://www.flent.in/secured-tnc')}
                testID="terms-conditions-button"
              />
              <CardDivider />
              <CardMenuItem
                title="Privacy Policy"
                onPress={() => Linking.openURL('https://www.flent.in/secured-privacy-policy')}
                testID="privacy-policy-button"
              />
              <CardDivider />
              <CardMenuItem
                title="Sign Out"
                onPress={handleSignOut}
                testID="sign-out-button"
              />
              <CardDivider />
              <CardMenuItem
                title="Delete Account"
                onPress={handleDeleteAccount}
                testID="delete-account-button"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Payment Method Edit Modal — opens Card UI bottom sheet */}
      <PaymentMethodModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        tenancyId={tenancy?.id ?? ''}
        rentMonth={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
        initialView={'edit-method' as ModalView}
        initialMethodType={editModalMethodType}
        initialSavedMethodId={editModalMethodId}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // No paddingHorizontal - each section has its own paddingH=40 per blueprint
  },
  // Main content frame (41:8761): column, gap=40, paddingBottom=48
  mainContent: {
    flexDirection: 'column',
    gap: s(40),           // Blueprint: itemSpacing 40
    paddingBottom: s(48),  // Blueprint: padding.bottom 48
  },
  // Header frame (41:8762): column, gap=24, paddingH=40
  headerSection: {
    flexDirection: 'column',
    gap: s(24),                  // Blueprint: itemSpacing 24
    paddingHorizontal: s(40),    // Blueprint: padding left=40, right=40
  },
  // Back button (41:8763): 32x32
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  // Title base: 48px/64 Regular, letterSpacing -2
  // Blueprint (41:8764): width=313, height=128 -> forces 2-line wrap on "My  Profile"
  titleBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    color: colors.white,
    maxWidth: s(313),    // Blueprint: text node width=313, forces 2-line wrap
  },
  // "My " span (chars 0-3): #A9A9A9
  titleMy: {
    color: colors.neutral[500],
  },
  // " " span (chars 3-4): inherits default #FFFFFF
  titleSpace: {
    color: colors.white,
  },
  // "Profile" span (chars 4-11): #FF9A6D
  titleProfile: {
    color: colors.brand[500],
  },
  // Section container: column, gap=24, paddingH=40
  section: {
    flexDirection: 'column',
    gap: s(24),
    paddingHorizontal: s(40),
  },
  // Section title: 12px/16.92 SemiBold #878787, letterSpacing 0, uppercase
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: 0,
    color: colors.neutral[600],
    textTransform: 'uppercase',
    textAlign: 'left',
  },
  // Menu stack (41:8830): column, gap=4
  menuStack: {
    gap: 4,
  },
  // User details fields: read-only inputs for name, email, phone
  userFieldsContainer: {
    gap: 16,
    paddingVertical: 8,
  },
  // Card container for Payment Info / Support / App sections
  // Blueprint (41:8844, 41:8858, 41:8868): bg #202020, radius=12, gap=8, drop shadows
  cardContainer: {
    backgroundColor: colors.black[500],
    borderRadius: 12,
    gap: 8,
    // Blueprint: 3 drop shadows (largest shadow)
    shadowColor: colors.black[900],
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.1,
    shadowRadius: 9.5,  // blur 19 / 2
    elevation: 4,
  },
  // Row inside card: justifyContent space-between, gap=16, padding 16/24
  cardMenuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  // Divider inside card: #4D4D4D, 0.25 weight
  cardDivider: {
    height: 0.25,
    backgroundColor: colors.black[400],
  },
  // User info row (41:8831): row, gap=16, padding 16/24, bg #202020, radius=12
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: colors.black[500],
    borderRadius: 12,
  },
  // User details (41:8833): column, gap=4, grow=1 (flex=1)
  userDetails: {
    flex: 1,
    gap: 4,
  },
  // User name (41:8834): 14px/19.74 Medium #FFFFFF, letterSpacing -0.56
  userName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 19.74,
    letterSpacing: -0.56,
    color: colors.white,
  },
  // Join date (41:8836): 12px/16.92 Regular #878787, letterSpacing -0.24
  userJoinDate: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: colors.neutral[600],
  },
  // Menu item row (41:8839 pattern): row, gap=16, padding 16/24, bg #202020, radius=12
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: colors.black[500],
    borderRadius: 12,
  },
  // Menu item text (41:8840): 14px/20 Regular #CBCBCB, letterSpacing 0
  menuItemText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    color: colors.neutral[300],
    textAlign: 'left',
  },
});
