/**
 * Edit Profile Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-8880
 *
 * Blueprint: buildbot/data/blueprints/41-8880-blueprint.json
 *
 * Layout hierarchy:
 * - Root (41:8880): 393x1069, bg #131313
 *   - Status bar (41:8899): handled by SafeArea
 *   - Main content (41:8881): column, gap=40, paddingBottom=48
 *     - Header (41:8882): column, gap=24, paddingH=40
 *       - Back arrow (41:8883): 32x32, rotated (left arrow)
 *       - Title (41:8884): "My  Profile" 48px/64 Regular, width=313
 *     - Avatar section (41:8885): row, gap=10, paddingH=40, alignItems=center
 *       - Avatar ellipse (41:8886): 80x80 circle with image
 *       - Edit Picture button (41:8887): 107x36, bg #CC7B57, pad=4, radius=12
 *         - Inner gradient frame (41:8888): 99x28, pad=4/16, gradient fill
 *           - Label (41:8889): "Edit Picture" 12px/20 Medium #FFFFFF
 *     - Form (41:8890): column, gap=16, paddingH=40
 *       - 4 input fields (41:8891-8894): 313x90 each
 *     - Button area (41:8895): column, gap=16, paddingH=40
 *       - Save button (41:8896): 313x52, gap=8
 *         - Inner (I41:8896;100:1564): row, pad=16, "Save Changes" 14px/20 Medium #FFFFFF
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

import { Screen, Text, TextInput, PhoneInput } from '@/src/components';
import { useDashboard, useUpdateProfile, useUploadAvatar } from '@/src/hooks';
import { colors } from '@/src/theme';

// Figma blueprint colors (41-8880)
const FIGMA_COLORS = {
  background: colors.black[700],         // colors.black[700]
  editButtonBg: colors.brand[600],       // colors.brand[600] - outer button bg
  editButtonText: colors.white,     // button text
  titleGray: colors.neutral[500],          // colors.neutral[500]
  accentOrange: colors.brand[500],       // colors.brand[500]
  saveButtonBg: colors.brand[500],       // Save button fill (solid, not gradient)
  saveButtonText: colors.white,     // Save button text
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
      setAvatarUri(asset.uri);

      const contentType = asset.mimeType ?? 'image/jpeg';
      uploadAvatar.mutate(
        { fileUri: asset.uri, contentType },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
          onError: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          {/* Main content (41:8881): column, gap=40, paddingBottom=48 */}
          <View style={styles.mainContent}>
            {/* Header (41:8882): column, gap=24, paddingH=40 */}
            <View style={styles.headerSection}>
              {/* Back button (41:8883): 32x32 */}
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={24} color={FIGMA_COLORS.editButtonText} />
              </TouchableOpacity>

              {/* Title (41:8884): "My  Profile" width=313, height=128 */}
              <Text style={styles.titleBase}>
                <Text inherit style={styles.titleGray}>{'My '}</Text>
                <Text inherit style={styles.titleSpace}>{' '}</Text>
                <Text inherit style={styles.titleAccent}>{'Profile'}</Text>
              </Text>
            </View>

            {/* Avatar section (41:8885): row, gap=10, paddingH=40 */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <View style={styles.avatarFace}>
                      <View style={styles.avatarHair} />
                      <View style={styles.avatarHead} />
                    </View>
                  </View>
                )}
              </View>

              {/* Edit Picture button (41:8887): 107x36, bg #CC7B57, pad=4, radius=12 */}
              <TouchableOpacity
                style={styles.editPictureButton}
                onPress={handleEditPicture}
                accessibilityRole="button"
                accessibilityLabel="Edit picture"
              >
                {/* Inner frame (41:8888): 99x28, pad=4/16 */}
                <View style={styles.editPictureInner}>
                  <Text style={styles.editPictureText}>Edit Picture</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Form (41:8890): column, gap=16, paddingH=40 */}
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

            {/* Button area (41:8895): column, gap=16, paddingH=40 */}
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
    flexGrow: 1,
  },
  // Main content (41:8881): column, gap=40, paddingBottom=48
  mainContent: {
    flexDirection: 'column',
    gap: 40,
    paddingBottom: 48,
  },
  // Header (41:8882): column, gap=24, paddingH=40
  headerSection: {
    flexDirection: 'column',
    gap: 24,
    paddingHorizontal: 40,
  },
  // Back button (41:8883): 32x32
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  // Title base: 48px/64 Regular, letterSpacing -2
  // Blueprint (41:8884): width=313, height=128 (2 lines x 64px lineHeight)
  titleBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    color: colors.white,
    maxWidth: 313,
  },
  // "My " span: #A9A9A9
  titleGray: {
    color: colors.neutral[500],
  },
  // " " span: inherits default #FFFFFF
  titleSpace: {
    color: colors.white,
  },
  // "Profile" span: #FF9A6D
  titleAccent: {
    color: colors.brand[500],
  },
  // Avatar section (41:8885): row, gap=10, paddingH=40, alignItems=center
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 40,
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
    backgroundColor: colors.brand[300],  // colors.brand[300]
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
    backgroundColor: colors.neutral[800],  // colors.neutral[800]
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  avatarHead: {
    width: 40,
    height: 40,
    backgroundColor: colors.brand[400],  // colors.brand[400]
    borderRadius: 20,
    marginTop: 15,
  },
  // Edit Picture outer button (41:8887): 107x36, bg #CC7B57, pad=4, radius=12
  editPictureButton: {
    width: 107,
    height: 36,
    backgroundColor: FIGMA_COLORS.editButtonBg,
    borderRadius: 12,
    padding: 4,
  },
  // Inner frame (41:8888): 99x28, pad 4/16, row, center, gap=10
  editPictureInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
    gap: 10,
    borderRadius: 8,
  },
  // Label (41:8889): "Edit Picture" 12px/20 Medium #FFFFFF
  editPictureText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.editButtonText,
    textAlign: 'center',
  },
  // Form (41:8890): column, gap=16, paddingH=40
  formContainer: {
    paddingHorizontal: 40,
    gap: 16,
  },
  // Button area (41:8895): column, gap=16, paddingH=40
  buttonSection: {
    paddingHorizontal: 40,
  },
  // Save button outer (41:8896): 313x52
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Save button inner (I41:8896;100:1564): row, pad=16, center
  saveButtonInner: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FIGMA_COLORS.saveButtonBg,
    borderRadius: 12,
  },
  // Save button text: "Save Changes" 14px/20 Medium #FFFFFF
  saveButtonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.saveButtonText,
    textAlign: 'center',
  },
});
