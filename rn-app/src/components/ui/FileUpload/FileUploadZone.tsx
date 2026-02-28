/**
 * File Upload Zone Component
 * Figma: Dashed border upload area for agreement documents
 *
 * EXACT Figma Values:
 * - Background: #202020
 * - Border: 1px dashed #4D4D4D
 * - Border radius: 12px
 * - Padding: 24px horizontal, 24px vertical
 * - Icon container: 54x54, #131313, radius 12px
 * - Text: Plus Jakarta Sans, 12px, #4D4D4D
 */

import React, { memo, useCallback, useState } from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';

import { Text } from '../Typography';
import { colors, spacing } from '@/src/theme';

// Exact Figma color values
const UPLOAD_COLORS = {
  background: '#202020',
  border: '#4D4D4D',
  borderActive: '#FF9A6D',
  iconBackground: '#131313',
  text: '#4D4D4D',
  textActive: '#A9A9A9',
} as const;

export interface FileUploadZoneProps {
  onFileSelected: (file: DocumentPicker.DocumentPickerResult) => void;
  acceptedTypes?: string[];
  maxSizeBytes?: number;
  disabled?: boolean;
  placeholder?: string;
  style?: ViewStyle;
  testID?: string;
}

function FileUploadZoneComponent({
  onFileSelected,
  acceptedTypes = ['application/pdf'],
  maxSizeBytes = 10 * 1024 * 1024, // 10MB default
  disabled = false,
  placeholder = 'Tap to upload your rental agreement',
  style,
  testID,
}: FileUploadZoneProps) {
  const [pressed, setPressed] = useState(false);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    setPressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [disabled]);

  const handlePressOut = useCallback(() => {
    setPressed(false);
  }, []);

  const handlePress = useCallback(async () => {
    if (disabled) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: acceptedTypes,
        copyToCacheDirectory: true,
      });

      onFileSelected(result);
    } catch (error) {
      console.error('Document picker error:', error);
    }
  }, [disabled, acceptedTypes, onFileSelected]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={placeholder}
      accessibilityState={{ disabled }}
    >
      <Animated.View style={[styles.container, {
        transitionProperty: ['transform', 'borderColor'],
        transitionDuration: '150ms',
        transform: [{ scale: pressed ? 0.98 : 1 }],
        borderColor: pressed ? UPLOAD_COLORS.borderActive : UPLOAD_COLORS.border,
      }, style]}>
        {/* Document Icon Container */}
        <View style={styles.iconContainer}>
          {/* Document icon placeholder - replace with SVG */}
          <View style={styles.documentIcon}>
            <View style={styles.documentPage} />
            <View style={styles.documentFold} />
          </View>
        </View>

        {/* Upload Text */}
        <Text style={styles.placeholderText}>{placeholder}</Text>

        {/* Divider */}
        <View style={styles.divider} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: UPLOAD_COLORS.background,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: UPLOAD_COLORS.border,
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 54,
    height: 54,
    backgroundColor: UPLOAD_COLORS.iconBackground,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentIcon: {
    width: 24,
    height: 32,
    position: 'relative',
  },
  documentPage: {
    position: 'absolute',
    width: 20,
    height: 28,
    backgroundColor: '#4D4D4D',
    borderRadius: 2,
    left: 2,
    top: 2,
  },
  documentFold: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#202020',
    right: 0,
    top: 0,
    borderBottomLeftRadius: 4,
  },
  placeholderText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: UPLOAD_COLORS.text,
    textAlign: 'center',
  },
  divider: {
    width: 24,
    height: 2,
    backgroundColor: UPLOAD_COLORS.border,
    borderRadius: 200,
  },
});

export const FileUploadZone = memo(FileUploadZoneComponent);
