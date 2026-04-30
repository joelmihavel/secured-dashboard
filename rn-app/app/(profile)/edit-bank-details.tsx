/**
 * View Bank Details Screen
 *
 * Displays the landlord's bank details (read-only).
 * Original layout from onboarding edit screen, but all fields disabled.
 * Users must contact support to make changes.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Screen, Text, TextInput, PrimaryButton, ScreenTitle, BackButton } from '@/src/components';
import { DottedGridPattern } from '@/src/components/patterns';
import { useDashboard } from '@/src/hooks';
import { colors } from '@/src/theme';

const FIGMA_COLORS = {
  background: colors.black[700],
  white: colors.white,
  footer: colors.neutral[500],
} as const;

export default function EditBankDetailsScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const { landlordBank } = useDashboard();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.back();
  }, []);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('mailto:secured@flent.in?subject=Edit%20Bank%20Details%20Request');
  }, []);

  return (
    <Screen testID="edit-bank-details-screen" padded={false}>
      <DottedGridPattern />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{
            paddingHorizontal: 48,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back arrow */}
          <BackButton
            onPress={handleBack}
            style={styles.backButton}
            color={FIGMA_COLORS.white}
          />

          <View style={styles.titleContainer}>
            <ScreenTitle gray="Your landlord's " accent="bank details" />
          </View>

          {/* Only show the form when the landlord's bank/UPI is actually
              verified. Failed-validation attempts can leave stale rows in
              the table (sometimes with the VPA written into the
              account_number column), and showing those reads as "the wrong
              account is on file". Empty state below is the safer default. */}
          {landlordBank?.verified ? (
            <>
              {/* Form — all fields read-only, adapts to bank vs UPI.
                  Use the presence of upi_vpa as the source of truth for
                  which fields to render — the verification_method column
                  is sometimes inconsistent with the data actually stored. */}
              <View style={styles.formContainer}>
                <TextInput
                  label="Account holder name"
                  value={landlordBank.account_holder_name ?? ''}
                  onChangeText={() => {}}
                  disabled
                />

                {landlordBank.upi_vpa ? (
                  <TextInput
                    label="UPI ID"
                    value={landlordBank.upi_vpa}
                    onChangeText={() => {}}
                    disabled
                  />
                ) : (
                  <>
                    <TextInput
                      label="Account number"
                      value={landlordBank.account_number_masked ?? ''}
                      onChangeText={() => {}}
                      disabled
                    />

                    <TextInput
                      label="IFSC code"
                      value={landlordBank.ifsc_code ?? ''}
                      onChangeText={() => {}}
                      disabled
                    />
                  </>
                )}

                <TextInput
                  label="PAN card"
                  value={landlordBank.pan_number_masked ?? ''}
                  onChangeText={() => {}}
                  disabled
                />
              </View>

              {/* Contact Support */}
              <View style={styles.buttonSection}>
                <PrimaryButton
                  title="Contact support"
                  onPress={handleContactSupport}
                />

                <Text style={styles.footerText}>
                  To update your landlord's bank details, please contact support.
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                No verified bank details yet
              </Text>
              <Text style={styles.emptyBody}>
                Your landlord's bank details haven't been verified. Complete
                the bank-verification step from the setup flow to add them,
                or contact support if you've already tried and need help.
              </Text>
              <View style={styles.emptyButton}>
                <PrimaryButton
                  title="Contact support"
                  onPress={handleContactSupport}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 48,
  },
  titleContainer: {
    marginBottom: 48,
  },
  formContainer: {
    gap: 16,
  },
  buttonSection: {
    gap: 16,
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footer,
    textAlign: 'center',
  },
  // Empty state — shown when no verified bank details exist (failed-
  // validation rows are filtered out by the verified flag).
  emptyState: {
    gap: 16,
    paddingVertical: 24,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 18,
    lineHeight: 24,
    color: FIGMA_COLORS.white,
  },
  emptyBody: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: FIGMA_COLORS.footer,
  },
  emptyButton: {
    marginTop: 16,
    alignItems: 'center',
  },
});
