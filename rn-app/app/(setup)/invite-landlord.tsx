/**
 * Invite Landlord Screen
 * Figma Reference: 1-31671
 *
 * Screen: "auth / sign up --error 2" (mapped to Invite Landlord flow)
 * Extraction: /autonomous-parity-fixer/data/combined/1-31671/extraction.json
 *
 * Captures landlord details for invitation
 * - Name, Phone Number inputs with error states
 * - "Get Started" / "Proceed" button
 * - Dark theme (#131313 background)
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components';
import { useSendLandlordInvite } from '@/src/hooks';
import { scaled, scaledFont, scaledSpacing } from '@/src/theme/scale';

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

  const [landlordName, setLandlordName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!landlordName.trim()) newErrors.landlordName = 'Required';
    if (!phoneNumber.trim()) newErrors.phoneNumber = 'Required';
    else if (phoneNumber.length < 10) newErrors.phoneNumber = 'Invalid phone number';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [landlordName, phoneNumber]);

  const handleSubmit = useCallback(() => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    sendLandlordInvite.mutate(
      {
        tenancyId: 'current-tenancy', // TODO: Get from context/state
        landlordName: landlordName.trim(),
        landlordPhone: phoneNumber.replace(/\D/g, ''),
        channel: 'sms',
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Navigate to Add Bank (next step)
          router.push('/(setup)/add-bank' as never);
        },
        onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      }
    );
  }, [validateForm, sendLandlordInvite, landlordName, phoneNumber, router]);

  const isFormValid = landlordName.length > 0 && phoneNumber.length >= 10;

  return (
    <View style={[styles.container, { backgroundColor: FIGMA.colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: scaledSpacing(FIGMA.dimensions.containerPadding), // 48px from Figma
            paddingTop: insets.top + scaledSpacing(16),
            paddingBottom: insets.bottom + scaledSpacing(32),
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button - Figma: 32x38.4 back arrow */}
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={scaled(24)} color={FIGMA.colors.title} />
          </TouchableOpacity>

          {/* Title - Figma: fontSize 48, lineHeight 64, letterSpacing -2 */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>
              Invite your{'\n'}
              <Text style={styles.titleAccent}>Landlord</Text>
            </Text>
          </View>

          {/* Progress Bar - visual indicator for step 1 of 3 */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>

          {/* Form - Figma gap: 16px from extraction */}
          <View style={styles.formContainer}>
            {/* Landlord Name Input */}
            <View style={styles.inputGroup}>
              {/* Label row with space-between - Figma: justifyContent: space-between */}
              <View style={styles.labelRow}>
                <Text style={styles.label}>Name</Text>
                {errors.landlordName && (
                  <Text style={styles.errorHint}>{errors.landlordName}</Text>
                )}
              </View>
              <View style={[styles.inputContainer, errors.landlordName && styles.inputError]}>
                <RNTextInput
                  style={[styles.input, errors.landlordName && styles.inputTextError]}
                  value={landlordName}
                  onChangeText={setLandlordName}
                  placeholder="e.g. John Smith"
                  placeholderTextColor={FIGMA.colors.placeholder}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Phone Number Input */}
            <View style={styles.inputGroup}>
              {/* Label row with space-between */}
              <View style={styles.labelRow}>
                <Text style={styles.label}>Phone</Text>
                {errors.phoneNumber && (
                  <Text style={styles.errorHint}>{errors.phoneNumber}</Text>
                )}
              </View>
              <View style={[styles.inputContainer, errors.phoneNumber && styles.inputError]}>
                <RNTextInput
                  style={[styles.input, errors.phoneNumber && styles.inputTextError]}
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, ''))}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor={FIGMA.colors.placeholder}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
            </View>
          </View>

          {/* Button and Footer Container - Figma: gap 16 */}
          <View style={styles.buttonSection}>
            {/* Submit Button - Figma: 297x56, borderRadius 12 */}
            <TouchableOpacity
              style={[styles.button, isFormValid && styles.buttonActive]}
              onPress={handleSubmit}
              disabled={!isFormValid || sendLandlordInvite.isPending}
            >
              <Text style={[styles.buttonText, isFormValid && styles.buttonTextActive]}>
                Get Started
              </Text>
            </TouchableOpacity>

            {/* Footer - Figma: fontSize 12, lineHeight 20, color #A9A9A9 */}
            <Text style={styles.footerText}>
              We will send an invite link to your landlord to verify their bank details.
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
    marginBottom: scaledSpacing(40),
  },
  // Title container - Figma: marginBottom 48 (sectionGap)
  titleContainer: {
    marginBottom: scaledSpacing(FIGMA.dimensions.sectionGap), // 48px from extraction
  },
  // Title text - Figma: fontSize 48, lineHeight 64, letterSpacing -2, fontWeight 400
  title: {
    fontFamily: FIGMA.typography.title.fontFamily,
    fontSize: scaledFont(FIGMA.typography.title.fontSize), // 48
    lineHeight: scaledFont(FIGMA.typography.title.lineHeight), // 64
    letterSpacing: FIGMA.typography.title.letterSpacing, // -2
    color: FIGMA.colors.title, // #FFFFFF
  },
  // Title accent - Figma: highlighted word in accent color
  titleAccent: {
    color: FIGMA.colors.accent, // #FF9A6D
  },
  // Progress bar container - Figma: marginBottom 48
  progressContainer: {
    marginBottom: scaledSpacing(FIGMA.dimensions.sectionGap), // 48px
    width: '100%',
  },
  // Progress track - Figma: height 12, backgroundColor #4D4D4D
  progressTrack: {
    height: scaled(12),
    backgroundColor: FIGMA.colors.progressTrack, // #4D4D4D
    width: '100%',
  },
  // Progress fill - Figma: ~1/3 width for step 1
  progressFill: {
    width: scaled(131), // 1/3 fill for Step 1 of 3
    height: '100%',
    backgroundColor: FIGMA.colors.progressFill, // #CC7B57
  },
  // Form container - Figma: gap 16
  formContainer: {
    gap: scaledSpacing(FIGMA.dimensions.formGap), // 16px from extraction
  },
  // Input group wrapper
  inputGroup: {
    // Each input field with label
  },
  // Label row - Figma: flexDirection row, justifyContent space-between, alignItems center
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaledSpacing(FIGMA.dimensions.labelInputGap), // 6px from extraction
  },
  // Label text - Figma: fontSize 12, lineHeight 20, fontWeight 400, color #A9A9A9
  label: {
    fontFamily: FIGMA.typography.label.fontFamily,
    fontSize: scaledFont(FIGMA.typography.label.fontSize), // 12
    lineHeight: scaledFont(FIGMA.typography.label.lineHeight), // 20
    color: FIGMA.colors.label, // #A9A9A9
  },
  // Error hint text - Figma: fontSize 14, lineHeight 20, fontWeight 400, color #E5484D, textAlign right
  errorHint: {
    fontFamily: FIGMA.typography.errorHint.fontFamily,
    fontSize: scaledFont(FIGMA.typography.errorHint.fontSize), // 14
    lineHeight: scaledFont(FIGMA.typography.errorHint.lineHeight), // 20
    color: FIGMA.colors.errorText, // #E5484D
    textAlign: 'right' as const,
  },
  // Input container - Figma: width 297, height 64, border 1px #4D4D4D, borderRadius 12
  inputContainer: {
    width: scaled(FIGMA.dimensions.inputWidth), // 297px
    height: scaled(FIGMA.dimensions.inputHeight), // 64px
    borderWidth: 1,
    borderColor: FIGMA.colors.inputBorder, // #4D4D4D
    borderRadius: scaled(FIGMA.dimensions.inputRadius), // 12px
    paddingVertical: scaledSpacing(16),
    paddingHorizontal: scaledSpacing(16),
    gap: scaledSpacing(16),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  // Input error state - Figma: borderColor #E5484D
  inputError: {
    borderColor: FIGMA.colors.inputBorderError, // #E5484D
  },
  // Input text - Figma: fontSize 20, lineHeight 32, fontWeight 400, color #DDDDDD
  input: {
    flex: 1,
    fontFamily: FIGMA.typography.inputText.fontFamily,
    fontSize: scaledFont(FIGMA.typography.inputText.fontSize), // 20
    lineHeight: scaledFont(FIGMA.typography.inputText.lineHeight), // 32
    color: FIGMA.colors.inputText, // #DDDDDD
  },
  // Input text error state - Figma: color #E5484D
  inputTextError: {
    color: FIGMA.colors.errorText, // #E5484D
  },
  // Button section - Figma: gap 16, marginTop 16
  buttonSection: {
    gap: scaledSpacing(FIGMA.dimensions.formGap), // 16px
    marginTop: scaledSpacing(FIGMA.dimensions.formGap), // 16px
  },
  // Button - Figma: width 297, height 56, backgroundColor #202020, borderRadius 12
  button: {
    width: scaled(FIGMA.dimensions.buttonWidth), // 297px
    height: scaled(FIGMA.dimensions.buttonHeight), // 56px
    backgroundColor: FIGMA.colors.buttonBg, // #202020
    borderColor: FIGMA.colors.buttonBorder, // #202020
    borderWidth: 1,
    borderRadius: scaled(FIGMA.dimensions.buttonRadius), // 12px
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaledSpacing(16),
    paddingVertical: scaledSpacing(16),
  },
  // Button active state - Figma: backgroundColor accent
  buttonActive: {
    backgroundColor: FIGMA.colors.buttonBgActive, // #FF9A6D
    borderColor: FIGMA.colors.buttonBgActive,
  },
  // Button text - Figma: fontSize 16, lineHeight 24, fontWeight 500, color #444444
  buttonText: {
    fontFamily: FIGMA.typography.buttonText.fontFamily,
    fontSize: scaledFont(FIGMA.typography.buttonText.fontSize), // 16
    lineHeight: scaledFont(FIGMA.typography.buttonText.lineHeight), // 24
    color: FIGMA.colors.buttonText, // #444444
    textAlign: 'center' as const,
  },
  // Button text active state
  buttonTextActive: {
    color: FIGMA.colors.buttonTextActive, // #000000
  },
  // Footer text - Figma: fontSize 12, lineHeight 20, fontWeight 400, color #A9A9A9
  footerText: {
    fontFamily: FIGMA.typography.footer.fontFamily,
    fontSize: scaledFont(FIGMA.typography.footer.fontSize), // 12
    lineHeight: scaledFont(FIGMA.typography.footer.lineHeight), // 20
    color: FIGMA.colors.footer, // #A9A9A9
    textAlign: 'left' as const,
  },
});
