/**
 * Add UPI Screen
 * Figma Reference: 41-8369 (Pay Rent / Add UPI Payment)
 *
 * PIXEL-PERFECT implementation from Figma blueprint:
 *
 * Screen Layout:
 * - Background: #131313 (black.700)
 * - Content paddingHorizontal: 48px
 * - Content y offset: 117px (from top of screen to content frame)
 * - Content gap: 40px between major sections
 * - Inner content gap: 48px between title/form/button groups
 *
 * Title: "Add your  UPI Method"
 * - "Add your " (chars 0-9): #A9A9A9 (gray), NOT white
 * - "UPI Method" (chars 10-20): #FF9A6D (accent)
 * - Font: PlusJakartaSans-Regular, 48px/64px, letterSpacing -2
 *
 * Labels: PlusJakartaSans-Medium, 12px/20px, #A9A9A9
 * Hint "edit": PlusJakartaSans-Regular, 14px/20px, #878787, textAlign RIGHT
 * Input placeholder: PlusJakartaSans-Regular, 20px/32px, #444444
 * Input value: PlusJakartaSans-Regular, 20px/32px, #DDDDDD
 * Button text: PlusJakartaSans-Medium, 16px/24px, #444444 (disabled), textAlign CENTER
 * Footer: PlusJakartaSans-Regular, 12px/20px, #A9A9A9, textAlign LEFT
 */

import React, { useState, useCallback } from 'react';
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
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton, TextInput, ScreenTitle } from '@/src/components';
import { useAddUpiVpa, useVerifyUpi } from '@/src/hooks';

// Figma-exact color constants from blueprint 41-8369
const FIGMA_COLORS = {
  background: '#131313',
  titleGray: '#A9A9A9',
  titleAccent: '#FF9A6D',
  labelText: '#A9A9A9',
  editLinkText: '#878787',
  inputPlaceholder: '#444444',
  inputValue: '#DDDDDD',
  footerText: '#A9A9A9',
  errorText: '#FF8080',
  buttonDisabledBg: '#202020',
  buttonDisabledText: '#444444',
  white: '#FFFFFF',
} as const;

// Back Arrow Icon
const BackArrow = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={FIGMA_COLORS.white}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default function AddUpiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addUpi = useAddUpiVpa();
  const verifyUpi = useVerifyUpi();

  const [accountName, setAccountName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const validateUpiId = (id: string): boolean => {
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    return upiRegex.test(id);
  };

  const handleVerify = useCallback(async () => {
    if (!validateUpiId(upiId)) {
      setError('Please enter a valid UPI ID (e.g., name@upi)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError('');
    verifyUpi.mutate(
      { upiId: upiId.trim() },
      {
        onSuccess: (data) => {
          if (data.verified) {
            setIsVerified(true);
            if (!accountName && data.name) {
              setAccountName(data.name);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            setError('UPI ID could not be verified');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Verification failed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  }, [verifyUpi, upiId, accountName]);

  const handleProceed = useCallback(async () => {
    if (!upiId || !accountName) {
      setError('Please fill in all fields');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!validateUpiId(upiId)) {
      setError('Please enter a valid UPI ID (e.g., name@upi)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    addUpi.mutate(
      {
        vpa: upiId.trim(),
        nickname: accountName.trim(),
        setPrimary: false,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to add UPI');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  }, [addUpi, upiId, accountName, router]);

  const isFormValid = accountName.length > 0 && upiId.includes('@');
  const isLoading = addUpi.isPending || verifyUpi.isPending;

  return (
    <Screen testID="add-upi-screen" padded={false} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 117,
              paddingBottom: insets.bottom + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <BackArrow />
          </TouchableOpacity>

          {/* Title Section - Figma: "Add your " is #A9A9A9 (gray), NOT white */}
          <ScreenTitle gray="Add your " accent="UPI Method" />

          {/* Form Section - Figma: 16px gap between fields */}
          <View style={styles.formSection}>
            <TextInput
              label="Account holder name"
              value={accountName}
              onChangeText={setAccountName}
              placeholder="e.g. John Smith"
              hintText="edit"
              autoCapitalize="words"
              testID="account-name-input"
            />

            <TextInput
              label="UPI ID"
              value={upiId}
              onChangeText={(text) => {
                setUpiId(text.toLowerCase());
                setError('');
              }}
              placeholder="e.g. john@oksbi"
              hintText="edit"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="upi-id-input"
            />

            {/* Error Message */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </View>

          {/* Spacer pushes button to bottom */}
          <View style={styles.spacer} />

          {/* Verify + Proceed Buttons */}
          {!isVerified && isFormValid ? (
            <PrimaryButton
              title={verifyUpi.isPending ? 'Verifying...' : 'Verify UPI'}
              onPress={handleVerify}
              disabled={!isFormValid || verifyUpi.isPending}
              loading={verifyUpi.isPending}
              testID="verify-upi-button"
            />
          ) : (
            <PrimaryButton
              title="Proceed"
              onPress={handleProceed}
              disabled={!isFormValid}
              loading={addUpi.isPending}
              testID="proceed-button"
            />
          )}

          {/* Footer Text - Figma: 12px/20px, Regular, #A9A9A9, textAlign LEFT */}
          <Text style={styles.footerText}>
            This will be used to make rent payments and earn cashback.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: FIGMA_COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  // Figma: paddingHorizontal 48px, gap 40px between major sections
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 48,
    gap: 40,
  },

  // Back button
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  // Form section: Figma gap 16px between fields (from Frame 1686557311 layout.gap)
  formSection: {
    gap: 16,
  },

  // Error text: 12px/20px, Regular, #FF8080
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.errorText,
    textAlign: 'left',
  },

  // Spacer pushes button to bottom
  spacer: {
    flex: 1,
    minHeight: 40,
  },

  // Footer text: Figma 12px/20px, Regular, #A9A9A9, textAlign LEFT
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footerText,
    marginTop: 16,
    textAlign: 'left',
  },
});
