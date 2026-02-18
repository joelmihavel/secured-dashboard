/**
 * Invite Landlord Screen
 * Figma Reference: 1-31671
 *
 * Screen: "auth / sign up --error 2" (mapped to Invite Landlord flow)
 * Extraction: /autonomous-parity-fixer/data/combined/1-31671/extraction.json
 *
 * Captures landlord details for invitation
 * - Name, Email inputs with error states
 * - "Get Started" / "Proceed" button
 * - Dark theme (#131313 background)
 *
 * Backend: send-landlord-invite edge function (POST, auth required)
 * Sends email invitation (not SMS) to landlord for tenancy approval.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text, TextInput, PrimaryButton, ScreenTitle } from '@/src/components';
import { useSendLandlordInvite, useDashboard, validateEmail } from '@/src/hooks';
import type { SetupError } from '@/src/types/setup';
// Scaling removed — use raw Figma pixel values for consistency

// Figma exact values from 1-31671 (extraction.json)
// Screen: "auth / sign up --error 2" - mapped to invite landlord form
const FIGMA = {
  colors: {
    background: '#131313', // from extraction: backgroundColor
    title: '#FFFFFF', // from extraction: text color for title
    accent: '#FF9A6D', // brand accent for highlighted text
    progressTrack: '#4D4D4D', // from extraction: input border default
    progressFill: '#CC7B57', // progress fill color
    label: '#A9A9A9', // from extraction: Label text color (style-map line 1891)
    errorText: '#E5484D', // from extraction: Hint text error color (style-map line 1908)
    inputBorder: '#4D4D4D', // from extraction: Input borderColor (style-map line 2241)
    inputBorderError: '#E5484D', // from extraction: Input error borderColor (style-map line 1931)
    inputText: '#DDDDDD', // from extraction: Text input color (style-map line 2320)
    placeholder: '#DDDDDD', // from extraction: dropdown/placeholder text color (style-map line 1973)
    buttonBg: '#202020', // from extraction: button backgroundColor (style-map line 2393)
    buttonBorder: '#202020', // from extraction: button borderColor (style-map line 2394)
    buttonText: '#444444', // from extraction: button Text color (style-map line 2422)
    buttonTextActive: '#000000', // button text when active
    buttonBgActive: '#FF9A6D', // button background when active (accent)
    footer: '#A9A9A9', // from extraction: consent text color (style-map line 2654)
  },
  // Dimensions from Figma extraction
  dimensions: {
    inputWidth: 297, // from extraction: Input width (style-map line 1927)
    inputHeight: 64, // from extraction: Input height (style-map line 1928)
    buttonWidth: 297, // from extraction: button width (style-map line 2391)
    buttonHeight: 56, // from extraction: button height (style-map line 2392)
    buttonRadius: 12, // from extraction: button borderRadius (style-map line 2396)
    inputRadius: 12, // from extraction: Input borderRadius (style-map line 2243)
    formGap: 16, // from extraction: form gap (style-map line 1794)
    labelInputGap: 6, // from extraction: Input with label gap (style-map line 1829)
    sectionGap: 48, // from extraction: Frame gap (style-map line 1719)
    containerPadding: 48, // from extraction: Frame paddingRight/Left (style-map line 1700-1701)
  },
  typography: {
    title: {
      fontSize: 48, // from extraction: title fontSize (style-map line 1769)
      lineHeight: 64, // from extraction: title lineHeight (style-map line 1771)
      letterSpacing: -2, // from extraction: title letterSpacing (style-map line 1772)
      fontWeight: '400', // from extraction: title fontWeight (style-map line 1770)
      fontFamily: 'PlusJakartaSans-Regular',
    },
    label: {
      fontSize: 12, // from extraction: Label fontSize (style-map line 1886)
      lineHeight: 20, // from extraction: Label lineHeight (style-map line 1888)
      fontWeight: '400', // from extraction: Label fontWeight (style-map line 1887)
      fontFamily: 'PlusJakartaSans-Regular',
    },
    errorHint: {
      fontSize: 14, // from extraction: Hint text fontSize (style-map line 1905)
      lineHeight: 20, // from extraction: Hint text lineHeight (style-map line 1907)
      fontWeight: '400', // from extraction: Hint text fontWeight (style-map line 1906)
      fontFamily: 'PlusJakartaSans-Regular',
    },
    inputText: {
      fontSize: 20, // from extraction: Text fontSize (style-map line 2315)
      lineHeight: 32, // from extraction: Text lineHeight (style-map line 2317)
      fontWeight: '400', // from extraction: Text fontWeight (style-map line 2316)
      fontFamily: 'PlusJakartaSans-Regular',
    },
    buttonText: {
      fontSize: 16, // from extraction: button Text fontSize (style-map line 2419)
      lineHeight: 24, // from extraction: button Text lineHeight (style-map line 2421)
      fontWeight: '500', // from extraction: button Text fontWeight (style-map line 2420)
      fontFamily: 'PlusJakartaSans-Medium',
    },
    footer: {
      fontSize: 12, // from extraction: consent text fontSize (style-map line 2655)
      lineHeight: 20, // from extraction: consent text lineHeight (style-map line 2657)
      fontWeight: '400', // from extraction: consent text fontWeight (style-map line 2656)
      fontFamily: 'PlusJakartaSans-Regular',
    },
  },
} as const;

export default function InviteLandlordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sendLandlordInvite = useSendLandlordInvite();
  const { tenancy } = useDashboard();

  const [landlordName, setLandlordName] = useState('');
  const [landlordEmail, setLandlordEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Clear field errors on typing
  const handleLandlordNameChange = useCallback((text: string) => {
    setLandlordName(text);
    setErrors((prev) => { const { landlordName: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handleLandlordEmailChange = useCallback((text: string) => {
    setLandlordEmail(text);
    setErrors((prev) => { const { landlordEmail: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!landlordName.trim()) newErrors.landlordName = 'Required';
    if (!landlordEmail.trim()) newErrors.landlordEmail = 'Required';
    else if (!validateEmail(landlordEmail)) newErrors.landlordEmail = 'Invalid email address';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [landlordName, landlordEmail]);

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

    sendLandlordInvite.mutate(
      {
        tenancyId: tenancy.id,
        landlordName: landlordName.trim(),
        landlordEmail: landlordEmail.trim().toLowerCase(),
      },
      {
        onSuccess: (data) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (data.alreadyApproved) {
            // Landlord already approved - skip ahead
            router.push('/(setup)/add-bank' as never);
          } else {
            setInviteSent(true);
            // Navigate to next setup step after brief success display
            setTimeout(() => router.push('/(setup)/add-bank' as never), 1500);
          }
        },
        onError: (error: SetupError) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setApiError(error.message || 'Failed to send invite. Please try again.');
        },
      }
    );
  }, [validateForm, sendLandlordInvite, landlordName, landlordEmail, tenancy?.id, router]);

  const isFormValid = landlordName.length > 0 && landlordEmail.length > 0 && validateEmail(landlordEmail);

  return (
    <View style={[styles.container, { backgroundColor: FIGMA.colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 48,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button - Figma: 32x38.4 back arrow */}
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={FIGMA.colors.title} />
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.titleContainer}>
            <ScreenTitle white="Invite your" accent="Landlord" />
          </View>

          {/* Progress Bar - visual indicator for step 1 of 3 */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>

          {/* API Error Banner */}
          {apiError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{apiError}</Text>
            </View>
          )}

          {/* Invite Sent Success Banner */}
          {inviteSent && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>
                Invite sent to {landlordEmail.trim().toLowerCase()}
              </Text>
            </View>
          )}

          {/* Form - Figma gap: 16px from extraction */}
          <View style={styles.formContainer}>
            <TextInput
              label="Name"
              value={landlordName}
              onChangeText={handleLandlordNameChange}
              placeholder="e.g. John Smith"
              error={errors.landlordName}
              disabled={sendLandlordInvite.isPending}
              autoCapitalize="words"
            />

            <TextInput
              label="Email"
              value={landlordEmail}
              onChangeText={handleLandlordEmailChange}
              placeholder="e.g. landlord@email.com"
              error={errors.landlordEmail}
              disabled={sendLandlordInvite.isPending}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          {/* Button and Footer Container - Figma: gap 16 */}
          <View style={styles.buttonSection}>
            <PrimaryButton
              title="Get Started"
              onPress={handleSubmit}
              disabled={!isFormValid}
              loading={sendLandlordInvite.isPending}
            />

            <Text style={styles.footerText}>
              We will send an invite email to your landlord to approve the tenancy.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Back button - positioned at top
  backButton: {
    marginBottom: 40,
  },
  // Title container - Figma: marginBottom 48 (sectionGap)
  titleContainer: {
    marginBottom: 48,
  },
  // Title uses shared ScreenTitle component
  // Progress bar container - Figma: marginBottom 48
  progressContainer: {
    marginBottom: 48,
    width: '100%',
  },
  progressTrack: {
    height: 12,
    backgroundColor: FIGMA.colors.progressTrack,
    width: '100%',
  },
  progressFill: {
    width: 131,
    height: '100%',
    backgroundColor: FIGMA.colors.progressFill,
  },
  // Form container - Figma: gap 16
  formContainer: {
    gap: 16,
  },
  // Form fields and button use shared TextInput/PrimaryButton — styles handled internally
  buttonSection: {
    gap: 16,
    marginTop: 16,
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA.colors.footer,
    textAlign: 'left' as const,
  },
  // Error banner
  errorBanner: {
    backgroundColor: 'rgba(229, 72, 77, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 72, 77, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#E5484D',
    textAlign: 'left' as const,
  },
  // Success banner
  successBanner: {
    backgroundColor: 'rgba(70, 167, 88, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(70, 167, 88, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successBannerText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#46A758',
    textAlign: 'left' as const,
  },
});
