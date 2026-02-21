/**
 * Invite Landlord Screen
 * Figma Reference: 1-34150
 *
 * Screen: "onboarding / Invite Landlord"
 * Blueprint: /buildbot/data/blueprints/1-34150-blueprint.json
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
 *       - "Save & Invite" button -- disabled state, 297x56, #202020
 *       - "Skip" text -- centered, 14/20, #FFFFFF, PlusJakartaSans-Medium, underline
 *
 * Backend: send-landlord-invite edge function (POST, auth required)
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, AlertBanner, Text, PhoneInput, PrimaryButton, ScreenTitle } from '@/src/components';
import { DottedPattern } from '@/src/components/patterns/DottedPattern';
import { useSendLandlordInvite, useDashboard } from '@/src/hooks';
import type { SetupError } from '@/src/types/setup';
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handlePhoneChange = useCallback((text: string) => {
    setPhoneNumber(text);
    setErrors((prev) => { const { phone: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (!cleaned) newErrors.phone = 'Required';
    else if (cleaned.length < 10) newErrors.phone = 'Enter 10 digit number';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [phoneNumber]);

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
        landlordName: 'Landlord',
        landlordEmail: `${cleaned}@phone.invite`,
      },
      {
        onSuccess: (data) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (data.alreadyApproved) {
            if (reentry) {
              router.replace('/(main)' as never);
            } else {
              router.push('/(setup)/pending-steps' as never);
            }
          } else {
            setInviteSent(true);
            setTimeout(() => {
              if (reentry) {
                router.replace('/(main)' as never);
              } else {
                router.push('/(setup)/pending-steps' as never);
              }
            }, 1500);
          }
        },
        onError: (error: SetupError) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setApiError(error.message || 'Failed to send invite. Please try again.');
        },
      }
    );
  }, [validateForm, sendLandlordInvite, phoneNumber, tenancy?.id, router]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (reentry) {
      router.replace('/(main)' as never);
    } else {
      router.push('/(setup)/pending-steps' as never);
    }
  }, [router, reentry]);

  const cleaned = phoneNumber.replace(/\D/g, '');
  const isFormValid = cleaned.length >= 10;

  return (
    <Screen padded={false} testID="invite-landlord-screen">
      {/* Background pattern */}
      <DottedPattern backgroundShape="default" />

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
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color={FIGMA_COLORS.title} />
            </TouchableOpacity>
          </View>

          {/* Title section -- Figma 1:34229: column, gap 16 */}
          <View style={styles.titleSection}>
            {/* Title: "One last step we promise"
                Figma spans: 0-13 "One last step" = #A9A9A9, 14-24 "we promise" = #FF9A6D
                48/64, letterSpacing -2, PlusJakartaSans-Regular */}
            <ScreenTitle gray="One last step" accent="we promise" />

            {/* Subtitle: 12/20, #A9A9A9, PlusJakartaSans-Regular */}
            <Text style={styles.subtitleText}>
              Invite your landlord to Secured to activate your cashback.
            </Text>
          </View>

          {/* Progress bar -- Figma 1:34226: container 393x3 (clipped), track 393x12 #4D4D4D, fill 393x12 #CC7B57 */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>

          {/* API Error Banner */}
          {apiError && <AlertBanner type="error" message={apiError} />}

          {/* Invite Sent Success Banner */}
          {inviteSent && <AlertBanner type="success" message="Invite sent successfully" />}

          {/* Phone Input -- Figma: label + phone input with +91 dropdown */}
          <View style={styles.inputSection}>
            <PhoneInput
              label="Invite your landlord to Secured to finish setup."
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              placeholder="Enter Number"
              error={errors.phone}
              disabled={sendLandlordInvite.isPending}
            />
          </View>

          {/* Button section -- Figma 1:34233: column, gap 16 */}
          <View style={styles.buttonSection}>
            <PrimaryButton
              title="Save & Invite"
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
