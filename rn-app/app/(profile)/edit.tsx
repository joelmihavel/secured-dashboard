/**
 * Edit Profile Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-8880
 *
 * Features:
 * - "My Profile" headline with accent color
 * - Avatar with "Edit Picture" button
 * - Editable fields: User name, Email, City, Phone Number
 * - Save Changes button at bottom
 *
 * Figma Layout Structure (from extracted-values.json):
 * - Screen: 393x1069, background #131313
 * - Main content frame: gap 40px, paddingBottom 48px
 * - Header section: paddingHorizontal 40px, gap 24px
 * - Form section: paddingHorizontal 40px, gap 16px
 * - Input fields: gap 6px between label row and input box
 * - Input boxes: 313x64, borderRadius 12, borderColor #4D4D4D
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text, TextInput, PhoneInput } from '@/src/components';
import { useDashboard, useUpdateProfile, useUploadAvatar } from '@/src/hooks';
import { colors, radius } from '@/src/theme';

// Design System Colors - mapped from theme (EXACT Figma values)
const EDIT_COLORS = {
  background: colors.black[700],         // #131313
  cardBackground: colors.black[600],     // #1A1A1A
  accentOrange: colors.brand[500],       // #FF9A6D
  accentOrangeDark: colors.brand[600],   // #CC7B57
  textPrimary: colors.white,             // #FFFFFF
  textSecondary: colors.neutral[600],    // #878787 - Hint text color (Figma)
  textMuted: colors.neutral[900],        // #222222 - Muted input text (Figma)
  inputBorder: colors.black[400],        // #4D4D4D - Input border (Figma)
  editButtonBg: colors.brand[600],       // #CC7B57 - Button background (Figma)
  editButtonText: colors.white,          // #FFFFFF - Button text (Figma)
  labelColor: colors.neutral[500],       // #A9A9A9 - Label color (Figma)
  inputText: colors.neutral[200],        // #DDDDDD - Input value text (Figma)
} as const;

// Figma exact spacing values
const FIGMA_SPACING = {
  screenPaddingHorizontal: 40,  // paddingRight/paddingLeft from Figma
  mainContentGap: 40,           // gap between major sections
  sectionGap: 24,               // gap within header section
  formFieldGap: 16,             // gap between form fields
  labelInputGap: 6,             // gap between label row and input box
  topOffset: 111,               // top offset for scroll content (77 status bar + 34)
  bottomPadding: 48,            // paddingBottom from Figma
} as const;

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useDashboard();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const fullName = user ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : '';
  const [name, setName] = useState(fullName || 'John Smith');
  const [email, setEmail] = useState(user?.email ?? 'john@email.com');
  const [city, setCity] = useState('Bangalore');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Extract phone parts
  const phone = user?.phone ?? '+91 98765 43210';
  const countryCode = '+91';
  const phoneNumber = phone.replace('+91', '').trim() || '98765 43210';

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleEditPicture = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // Set local preview immediately
      setAvatarUri(asset.uri);

      // Upload to Supabase Storage via presigned URL flow
      const contentType = asset.mimeType ?? 'image/jpeg';
      uploadAvatar.mutate(
        { fileUri: asset.uri, contentType },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
          onError: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            // Revert local preview on failure
            setAvatarUri(null);
          },
        }
      );
    }
  }, [uploadAvatar]);

  const handleSave = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    updateProfile.mutate(
      {
        // Use fullName - edge function auto-splits into first_name/last_name
        fullName: name.trim(),
        email: email.trim() || undefined,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  }, [updateProfile, name, email, router]);

  const hasChanges = name !== fullName || email !== (user?.email ?? '');

  /**
   * Page Layout matching Figma exactly
   * - Screen component wraps SafeAreaView with bg: colors.black[700]
   * - ScrollView with paddingBottom: 48, gap: 40
   * - Content sections with paddingHorizontal: 40
   */
  return (
    <Screen testID="edit-profile-screen" padded={false}>
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
          {/* Header Section - Figma: Frame 2095586345 with gap 24, paddingHorizontal 40 */}
          <View style={styles.headerSection}>
            {/* Back Button - Figma: 40x40 container, 24px icon */}
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={EDIT_COLORS.textPrimary} />
            </TouchableOpacity>

            {/* Title (41:8882): "My  Profile" single text with spans */}
            {/* Blueprint: width=313, height=128 (2 lines x 64px lineHeight) */}
            <Text style={styles.titleBase}>
              <Text inherit style={styles.titleGray}>{'My '}</Text>
              <Text inherit style={styles.titleSpace}>{' '}</Text>
              <Text inherit style={styles.titleAccent}>{'Profile'}</Text>
            </Text>
          </View>

          {/* Avatar Section - Figma: Frame 2095586371 with space-between, paddingHorizontal 40 */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  {/* Default avatar illustration */}
                  <View style={styles.avatarFace}>
                    <View style={styles.avatarHair} />
                    <View style={styles.avatarHead} />
                  </View>
                </View>
              )}
            </View>

            {/* Edit Picture Button - Figma: 107x36, borderRadius 12, bg #CC7B57 */}
            <TouchableOpacity
              style={styles.editPictureButton}
              onPress={handleEditPicture}
              accessibilityRole="button"
              accessibilityLabel="Edit picture"
            >
              <LinearGradient
                colors={[colors.brand[500], colors.brand[600]]}
                style={styles.editPictureGradient}
              >
                <Text style={styles.editPictureText}>Edit Picture</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Form Fields - Figma: Frame 2095586311 with gap 16, paddingHorizontal 40 */}
          <View style={styles.formContainer}>
            <TextInput
              label="User name"
              value={name}
              onChangeText={setName}
              hintText="edit"
              onHintPress={() => {/* Focus input */}}
            />

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              hintText="edit"
              onHintPress={() => {/* Focus input */}}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              label="City"
              value={city}
              onChangeText={setCity}
              disabled
              hintText="This is a hint text to help user."
            />

            <PhoneInput
              label="Phone Number"
              value={phoneNumber}
              onChangeText={() => {}}
              countryCode={countryCode}
              disabled
            />
          </View>

          {/* Button Section - Figma: Frame 2095586363 with paddingHorizontal 40 */}
          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={updateProfile.isPending}
              accessibilityRole="button"
              accessibilityLabel="Save changes"
            >
              <View style={styles.saveButtonInner}>
                <Text style={styles.saveButtonText}>
                  {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
                </Text>
              </View>
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
  scrollContent: {
    paddingHorizontal: FIGMA_SPACING.screenPaddingHorizontal, // 40 - Figma exact
    gap: FIGMA_SPACING.mainContentGap,                        // 40 - gap between major sections
    paddingBottom: FIGMA_SPACING.bottomPadding,                // 48 - Figma bottom padding
    flexGrow: 1,
  },
  headerSection: {
    gap: FIGMA_SPACING.sectionGap, // 24 - gap within header section (no extra paddingHorizontal; scrollContent provides it)
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  // Title base: 48px/64 Regular, letterSpacing -2
  // Blueprint (41:8882): width=313, height=128 (2 lines x 64px lineHeight)
  titleBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    color: colors.white,
    maxWidth: 313,    // Blueprint: text node width=313, forces 2-line wrap
  },
  // "My " span: #A9A9A9
  titleGray: {
    color: '#A9A9A9',
  },
  // " " span: inherits default #FFFFFF
  titleSpace: {
    color: colors.white,
  },
  // "Profile" span: #FF9A6D
  titleAccent: {
    color: '#FF9A6D',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Figma: Frame 2095586371 uses space-between
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: colors.brand[300],  // Light avatar background (#FFCC8A)
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarFace: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHair: {
    position: 'absolute',
    top: 0,
    width: 50,
    height: 35,
    backgroundColor: colors.neutral[800],  // Hair color
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  avatarHead: {
    width: 40,
    height: 40,
    backgroundColor: colors.brand[400],  // Skin tone
    borderRadius: 20,
    marginTop: 15,
  },
  editPictureButton: {
    borderRadius: radius.md, // 12
    overflow: 'hidden',
  },
  editPictureGradient: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 10,                           // Figma: button (41:8887) gap=10
    borderRadius: radius.md,         // 12 - Figma borderRadius
    alignItems: 'center' as const,   // Center the text inside gradient
    justifyContent: 'center' as const,
  },
  editPictureText: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: 12-500 = Medium weight
    fontSize: 12,                          // Figma: 12px (was 14)
    lineHeight: 20,
    color: EDIT_COLORS.editButtonText,
    textAlign: 'center' as const,
  },
  formContainer: {
    gap: FIGMA_SPACING.formFieldGap, // 16 - Figma exact (was spacing.lg = 24)
  },
  buttonSection: {
    // No extra paddingHorizontal; scrollContent provides it
    // Gap from scrollContent (40) handles spacing from form section
  },
  saveButton: {
    borderRadius: radius.md,  // 12
    overflow: 'hidden',
  },
  saveButtonInner: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EDIT_COLORS.accentOrange, // #FF9A6D - Figma: active button is solid orange fill
    borderRadius: radius.md,                    // 12 - match parent borderRadius
  },
  saveButtonText: {
    fontFamily: 'PlusJakartaSans-Medium',      // Figma: 14-500 = Medium (was SemiBold)
    fontSize: 14,                               // Figma: 14px (was 16)
    lineHeight: 20,
    color: EDIT_COLORS.textPrimary,            // #FFFFFF - Figma: white text on orange button
    textAlign: 'center' as const,
  },
});
