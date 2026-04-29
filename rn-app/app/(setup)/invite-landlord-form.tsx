/**
 * Invite Landlord — Form Screen
 * Figma Node: 4679:151846 ("Onboarding / address proof --1")
 *
 * Reached from `/invite-landlord` (intro) via the "Invite Landlord" header
 * pill, or as a deep-link target. Same backend behaviour as the previous
 * single-screen invite-landlord (send/resend WhatsApp invite via the
 * `useSendLandlordInvite` mutation), just with the new layout:
 *  - Marquee bands at top
 *  - Back button only (no progress bar, no logo+pill header)
 *  - "Invite\nyour landlord" title (white + brand)
 *  - "Phone" labelled PhoneInput
 *  - Consent toggle row
 *  - Proceed PrimaryButton (with drag-handle pill via showDivider)
 *  - "I'll do it later" underlined skip
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Screen,
  AlertBanner,
  Text,
  PhoneInput,
  PrimaryButton,
  BackButton,
  DottedGridPattern,
} from '@/src/components';
import { ConsentToggle } from '@/src/components/composed/auth/ConsentToggle';
import { Marquee, TOP_MARQUEE_ITEMS, BOTTOM_MARQUEE_ITEMS } from '@/src/components/auth/landing-decor';
import { useSendLandlordInvite, useDashboard } from '@/src/hooks';
import type { SetupError } from '@/src/types/setup';
import type { CountryData } from '@/src/components/ui/Input/PhoneInput';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const BG_SHAPE = require('../../assets/images/background_shape.png');

export default function InviteLandlordFormScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const sendLandlordInvite = useSendLandlordInvite();
  const { tenancy } = useDashboard();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [maxDigits, setMaxDigits] = useState(10);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [consent, setConsent] = useState(true);

  // Pre-fill phone on return visits (phone saved on tenancy from previous invite)
  useEffect(() => {
    if (tenancy?.landlord_phone && !phoneNumber) {
      const raw = tenancy.landlord_phone.replace(/\D/g, '');
      const digits = raw.length > 10 ? raw.slice(-10) : raw;
      setPhoneNumber(digits);
      setOriginalPhone(digits);
    }
  }, [tenancy?.landlord_phone]);

  // Reminder vs new invite — preserved from prior implementation
  const hasInviteBeenSent = tenancy?.verification_status?.landlord_status === 'invited'
    || tenancy?.verification_status?.landlord_status === 'otp_confirmed'
    || tenancy?.verification_status?.landlord_status === 'verified';
  const cleaned = phoneNumber.replace(/\D/g, '');
  const isNumberChanged = originalPhone.length > 0 && cleaned !== originalPhone;
  const isReminder = hasInviteBeenSent && !isNumberChanged;

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (routerRef.current.canGoBack()) routerRef.current.back();
    else routerRef.current.replace('/(setup)/invite-landlord' as never);
  }, []);

  const handlePhoneChange = useCallback((text: string) => {
    setPhoneNumber(text);
    setErrors((prev) => { const { phone: _phone, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handleCountryChange = useCallback((country: CountryData) => {
    setCountryCode(country.code);
    setMaxDigits(country.maxDigits);
  }, []);

  const handlePhoneBlur = useCallback(() => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < maxDigits) {
      setErrors((prev) => ({ ...prev, phone: `Enter ${maxDigits} digit number` }));
    } else if (countryCode === '+91' && digits.length === maxDigits && !/^[6-9]/.test(digits)) {
      setErrors((prev) => ({ ...prev, phone: 'Must start with 6-9' }));
    }
  }, [phoneNumber, maxDigits, countryCode]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const digits = phoneNumber.replace(/\D/g, '');
    if (!digits) newErrors.phone = 'Required';
    else if (digits.length < maxDigits) newErrors.phone = `Enter ${maxDigits} digit number`;
    if (!consent) newErrors.consent = 'Please consent to continue';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [phoneNumber, maxDigits, consent]);

  const handleSubmit = useCallback(() => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!tenancy?.id) {
      setApiError('No active tenancy found. Please complete onboarding first.');
      return;
    }
    setApiError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const params = isReminder
      ? { tenancyId: tenancy.id }
      : { tenancyId: tenancy.id, landlordPhone: cleaned, countryCode };

    sendLandlordInvite.mutate(params, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setInviteSent(true);
        if (!isReminder) setOriginalPhone(cleaned);
        setTimeout(() => routerRef.current.replace('/(main)' as never), 1500);
      },
      onError: (error: SetupError) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setApiError(error.message || (isReminder ? 'Failed to send reminder. Please try again.' : 'Failed to send invite. Please try again.'));
      },
    });
  }, [validateForm, sendLandlordInvite, cleaned, countryCode, tenancy?.id, isReminder]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.replace('/(main)' as never);
  }, []);

  const isFormValid = cleaned.length >= maxDigits && consent;

  return (
    <Screen padded={false} testID="invite-landlord-form-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      <Image
        source={BG_SHAPE}
        style={styles.bgShape}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <DottedGridPattern dotOpacity={0.08} animated={false} fadeMask={false} />
      </View>

      <KeyboardAvoidingView style={styles.kbView} behavior="padding">
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + sv(36) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Marquee bands — Figma 4679:151852 */}
          <View style={styles.marqueeStack} pointerEvents="none">
            <View style={[styles.marqueeRow, { transform: [{ rotate: '0.22deg' }] }]}>
              <Marquee items={TOP_MARQUEE_ITEMS} backgroundColor={colors.black[600]} />
            </View>
            <View style={[styles.marqueeRow, { transform: [{ rotate: '-0.48deg' }] }]}>
              <Marquee items={BOTTOM_MARQUEE_ITEMS} backgroundColor={colors.brand[600]} reverse />
            </View>
          </View>

          {/* Back-only header */}
          <View style={[styles.headerRow, { marginTop: sv(40) }]}>
            <BackButton onPress={handleBack} style={styles.backButton} color={colors.white} />
          </View>

          {/* Title — Figma 4679:151878: 28/40/-1, "Invite" white + "your landlord" brand */}
          <View style={styles.titleBlock}>
            <Text style={styles.heading}>
              <Text inherit style={styles.headingWhite}>Invite</Text>
              {'\n'}
              <Text inherit style={styles.headingAccent}>your landlord</Text>
            </Text>
            <Text style={styles.subtitle}>
              To enable rent payments and cashback, we&apos;ll need to verify your landlord.
            </Text>
          </View>

          <View style={styles.divider} />

          {apiError && (
            <View style={styles.bannerWrap}><AlertBanner type="error" message={apiError} /></View>
          )}
          {inviteSent && (
            <View style={styles.bannerWrap}>
              <AlertBanner type="success" message={isReminder ? 'Reminder sent successfully' : 'Invite sent successfully'} />
            </View>
          )}

          {/* Phone input — Figma 4679:152035 */}
          <View style={styles.inputBlock}>
            <PhoneInput
              label="Phone"
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              countryCode={countryCode}
              onCountryChange={handleCountryChange}
              onBlur={handlePhoneBlur}
              placeholder="Enter Number"
              error={errors.phone}
              disabled={sendLandlordInvite.isPending}
            />

            {/* Consent toggle — Figma 4679:152037 */}
            <View style={styles.consentRow}>
              <ConsentToggle
                value={consent}
                onValueChange={setConsent}
                disabled={sendLandlordInvite.isPending}
                testID="invite-consent-toggle"
              />
              <Text style={styles.consentText}>
                I&apos;m okay with Flent contacting my landlord
              </Text>
            </View>
          </View>

          {/* Proceed + skip — Figma 4679:152063, gap 32 */}
          <View style={styles.actionsBlock}>
            <PrimaryButton
              title={isReminder ? 'Send reminder' : 'Proceed'}
              onPress={handleSubmit}
              disabled={!isFormValid}
              loading={sendLandlordInvite.isPending}
              showDivider
            />
            <Pressable onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} testID="do-it-later">
              <Text style={styles.skipText}>I&apos;ll do it later</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.black[700], flex: 1 },
  kbView: { flex: 1 },
  bgShape: {
    position: 'absolute',
    top: sv(-100),
    left: '50%',
    width: s(481),
    height: sv(405),
    marginLeft: -s(481) / 2,
    opacity: 0.48,
  },
  scrollContent: { paddingHorizontal: s(36), paddingBottom: sv(48) },

  marqueeStack: { marginHorizontal: -s(227) },
  marqueeRow: { width: s(847), alignSelf: 'center' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backButton: { width: 32, height: 32, justifyContent: 'center' },

  titleBlock: {
    marginTop: sv(40),
    gap: sv(10),
  },
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(28),
    lineHeight: sf(40),
    letterSpacing: -1,
  },
  headingWhite: { color: colors.white },
  headingAccent: { color: colors.brand[500] },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: colors.neutral[500],
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.black[400],
    marginTop: sv(32),
  },

  bannerWrap: { marginTop: sv(16) },

  inputBlock: { marginTop: sv(32), gap: sv(16) },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(16),
  },
  consentText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: colors.neutral[500],
  },

  actionsBlock: { marginTop: sv(32), gap: sv(16), alignItems: 'center' },
  skipText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: colors.white,
    textDecorationLine: 'underline',
  },
});
