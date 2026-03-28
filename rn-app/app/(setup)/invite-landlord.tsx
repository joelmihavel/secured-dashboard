/**
 * Invite Landlord Screen
 * Figma Reference: 1-34150
 *
 * Screen: "onboarding / Invite Landlord"
 * Blueprint: figma-1on1parity/data/1-34150-blueprint.json
 *
 * Figma structure (dark area, node 1:34220):
 * - Frame column, gap 64
 *   - Status Bar (53px) -- handled by safe area
 *   - Frame 1686557268 (1:34222) -- main content
 *     - column, center, gap 40, padding 0 48 0 48
 *     - Back arrow (1:34224)
 *     - Frame 2095586383 (1:34229) -- title section, column, gap 16
 *       - Title: "One last step we promise" -- 48/64, letterSpacing -2
 *         - chars 0-13 "One last step" = #A9A9A9
 *         - chars 14-24 "we promise" = #FF9A6D
 *       - Subtitle: "Invite your landlord to Secured to activate your cashback."
 *         - 12/20, #A9A9A9, PlusJakartaSans-Regular
 *     - Progress bar (clipped to 3px visible, track #4D4D4D, fill #CC7B57)
 *     - Phone input (label + +91 dropdown + "Enter Number")
 *       - Label: "Invite your landlord to Secured to finish setup."
 *         - 12/20, #A9A9A9, PlusJakartaSans-Medium
 *     - Button section (column, gap 16)
 *       - "Save and invite" button -- disabled state, 297x56, #202020
 *       - "Skip" text -- centered, 14/20, #FFFFFF, PlusJakartaSans-Medium, underline
 *
 * Backend: send-landlord-invite edge function (POST, auth required)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Screen, AlertBanner, Text, PhoneInput, PrimaryButton, ScreenTitle, BackButton } from '@/src/components';
import { DottedGridPattern, DottedGridPresets } from '@/src/components/patterns/DottedGridPattern';
import { useSendLandlordInvite, useDashboard } from '@/src/hooks';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { SetupError } from '@/src/types/setup';
import type { CountryData } from '@/src/components/ui/Input/PhoneInput';
import { colors } from '@/src/theme';

// Figma exact values from 1-34150 blueprint
const FIGMA_COLORS = {
  background: colors.black[700],
  title: colors.white,
  titleGray: colors.neutral[500],
  accent: colors.brand[500],
  subtitle: colors.neutral[500],
  progressTrack: colors.black[400],
  progressFill: colors.brand[600],
  label: colors.neutral[500],
  skipText: colors.white,
  buttonText: colors.neutral[800],
  buttonBg: colors.black[500],
} as const;

export default function InviteLandlordScreen() {
  const router = useRouter();
  const { reentry } = useLocalSearchParams<{ reentry?: string }>();
  const sendLandlordInvite = useSendLandlordInvite();
  const { tenancy } = useDashboard();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [maxDigits, setMaxDigits] = useState(10);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  // Pre-fill phone on return visits (phone saved on tenancy from previous invite)
  useEffect(() => {
    if (tenancy?.landlord_phone && !phoneNumber) {
      const raw = tenancy.landlord_phone.replace(/\D/g, '');
      const digits = raw.length > 10 ? raw.slice(-10) : raw;
      setPhoneNumber(digits);
    }
  }, [tenancy?.landlord_phone]);

  // Animated progress bar
  const progress = useSharedValue(66.67);
  React.useEffect(() => {
    progress.value = withTiming(100, { duration: 500 });
  }, []);
  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value}%`,
      height: '100%',
      backgroundColor: FIGMA_COLORS.progressFill,
    };
  });

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handlePhoneChange = useCallback((text: string) => {
    setPhoneNumber(text);
    setErrors((prev) => { const { phone: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handleCountryChange = useCallback((country: CountryData) => {
    setCountryCode(country.code);
    setMaxDigits(country.maxDigits);
  }, []);

  const handlePhoneBlur = useCallback(() => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length > 0 && cleaned.length < maxDigits) {
      setErrors((prev) => ({ ...prev, phone: `Enter ${maxDigits} digit number` }));
    } else if (countryCode === '+91' && cleaned.length === maxDigits && !/^[6-9]/.test(cleaned)) {
      setErrors((prev) => ({ ...prev, phone: 'Must start with 6-9' }));
    }
  }, [phoneNumber, maxDigits, countryCode]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (!cleaned) newErrors.phone = 'Required';
    else if (cleaned.length < maxDigits) newErrors.phone = `Enter ${maxDigits} digit number`;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [phoneNumber, maxDigits]);

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

    const cleaned = phoneNumber.replace(/\D/g, '');
    sendLandlordInvite.mutate(
      {
        tenancyId: tenancy.id,
        landlordPhone: cleaned,
        countryCode: countryCode,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setInviteSent(true);
          setTimeout(() => {
            if (reentry) {
              router.replace('/(main)' as never);
            } else {
              router.replace('/(main)' as never);
            }
          }, 1500);
        },
        onError: (error: SetupError) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setApiError(error.message || 'Failed to send invite. Please try again.');
        },
      }
    );
  }, [validateForm, sendLandlordInvite, phoneNumber, countryCode, tenancy?.id, router]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (reentry) {
      router.replace('/(main)' as never);
    } else {
      router.replace('/(main)' as never);
    }
  }, [router, reentry]);

  const handleLearnMore = useCallback(() => {
    Linking.openURL('https://flent.in/secured/how-it-works');
  }, []);

  const cleaned = phoneNumber.replace(/\D/g, '');
  const isFormValid = cleaned.length >= maxDigits;

  return (
    <Screen padded={false} testID="invite-landlord-screen">
      {/* Background pattern */}
      <DottedGridPattern fadeMask={false} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button -- Figma: back arrow at top of content area */}
          <View style={styles.backButtonContainer}>
            <BackButton
              onPress={handleBack}
              style={styles.backButton}
              color={FIGMA_COLORS.title}
            />
          </View>

          {/* Title section -- Figma 1:34229: column, gap 16 */}
          <View style={styles.titleSection}>
            {/* Title: "Confirm your tenancy" */}
            <ScreenTitle gray="Confirm " accent="your tenancy" />

            {/* Subtitle: 12/20, #A9A9A9, PlusJakartaSans-Regular */}
            <Text style={styles.subtitleText}>
              Invite your landlord to Secured to activate your cashback.
            </Text>
          </View>

          {/* Progress bar -- Figma 1:34226: container 393x3 (clipped), track 393x12 #4D4D4D, fill 393x12 #CC7B57 */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={animatedProgressStyle} />
            </View>
          </View>

          {/* API Error Banner */}
          {apiError && <AlertBanner type="error" message={apiError} />}

          {/* Invite Sent Success Banner */}
          {inviteSent && <AlertBanner type="success" message="Invite sent successfully" />}

          {/* Phone Input -- Figma: label + phone input with country dropdown */}
          <View style={styles.inputSection}>
            <PhoneInput
              label="Confirm your tenancy by inviting your landlord"
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              countryCode={countryCode}
              onCountryChange={handleCountryChange}
              onBlur={handlePhoneBlur}
              placeholder="Enter Number"
              error={errors.phone}
              disabled={sendLandlordInvite.isPending}
            />

            <TouchableOpacity style={styles.inviteBanner} onPress={handleLearnMore}>
              <Text style={styles.inviteBannerText}>What does my landlord get?</Text>
              <Text style={styles.inviteBannerLink}>Learn more</Text>
            </TouchableOpacity>
          </View>

          {/* Button section -- Figma 1:34233: column, gap 16 */}
          <View style={styles.buttonSection}>
            <PrimaryButton
              title="Save & invite"
              onPress={handleSubmit}
              disabled={!isFormValid}
              loading={sendLandlordInvite.isPending}
            />

            {/* Skip -- Figma 1:34235: centered, 14/20, #FFFFFF, Medium, underline */}
            <TouchableOpacity onPress={handleSkip} style={styles.skipContainer}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  // Figma 1:34222: column, center, gap 40, paddingHorizontal 48
  scrollContent: {
    paddingHorizontal: 48,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 40,
  },
  // Back button area
  backButtonContainer: {
    alignSelf: 'flex-start',
  },
  backButton: {
    // Figma: 32x32 back arrow icon area
  },
  // Title section -- Figma 1:34229: column, gap 16
  titleSection: {
    gap: 16,
    width: '100%',
  },
  // Subtitle -- Figma: 12/20, #A9A9A9, PlusJakartaSans-Regular
  subtitleText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[500],
  },
  // Progress bar -- Figma: Full width
  progressContainer: {
    marginHorizontal: -48,
    width: Dimensions.get('window').width,
    height: 3,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 12,
    backgroundColor: FIGMA_COLORS.progressTrack,
    width: '100%',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: FIGMA_COLORS.progressFill,
  },
  // Input section
  inputSection: {
    width: '100%',
    gap: 24,
  },
  // Invite banner -- Figma 1:34229
  inviteBanner: {
    backgroundColor: '#202020',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inviteBannerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#FF9A6D',
  },
  inviteBannerLink: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#FF9A6D',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  // Button section -- Figma 1:34233: column, gap 16
  buttonSection: {
    gap: 16,
    width: '100%',
  },
  // Skip text -- Figma 1:34235: centered, 14/20, #FFFFFF, Medium, underline
  skipContainer: {
    alignItems: 'center',
    width: '100%',
  },
  skipText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.skipText,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
