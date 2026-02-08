/**
 * Agreement Upload Section Component
 * Figma: Complete agreement upload section with states
 *
 * States:
 * - Empty: Shows FileUploadZone
 * - Uploaded: Shows DocumentUploadCard with filename
 * - Uploading: Shows progress
 * - Error: Shows error state with retry
 */

import React, { memo, useState, useCallback } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { Text } from '@/src/components/ui/Typography';
import { FileUploadZone, DocumentUploadCard, UploadStatus } from '@/src/components/ui/FileUpload';
import { colors, spacing } from '@/src/theme';

// Exact Figma color values
const SECTION_COLORS = {
  title: '#FFFFFF',
  subtitle: '#797979',
} as const;

export interface AgreementUploadSectionProps {
  onFileUploaded?: (file: { uri: string; name: string; size: number }) => void;
  onUploadError?: (error: string) => void;
  initialFile?: { uri: string; name: string };
  style?: ViewStyle;
  testID?: string;
}

interface FileState {
  uri: string;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number;
  error?: string;
}

function AgreementUploadSectionComponent({
  onFileUploaded,
  onUploadError,
  initialFile,
  style,
  testID,
}: AgreementUploadSectionProps) {
  const [file, setFile] = useState<FileState | null>(
    initialFile
      ? { uri: initialFile.uri, name: initialFile.name, size: 0, status: 'success', progress: 100 }
      : null
  );

  const simulateUpload = useCallback(
    async (fileData: { uri: string; name: string; size: number }) => {
      setFile({
        ...fileData,
        status: 'uploading',
        progress: 0,
      });

      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setFile((prev) =>
          prev
            ? {
                ...prev,
                progress,
                status: progress < 100 ? 'uploading' : 'processing',
              }
            : null
        );
      }

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Success
      setFile((prev) =>
        prev
          ? {
              ...prev,
              status: 'success',
              progress: 100,
            }
          : null
      );

      onFileUploaded?.(fileData);
    },
    [onFileUploaded]
  );

  const handleFileSelected = useCallback(
    async (result: DocumentPicker.DocumentPickerResult) => {
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (asset.size && asset.size > maxSize) {
        setFile({
          uri: asset.uri,
          name: asset.name,
          size: asset.size || 0,
          status: 'error',
          progress: 0,
          error: 'File is too large. Maximum size is 10MB.',
        });
        onUploadError?.('File is too large. Maximum size is 10MB.');
        return;
      }

      // Start upload simulation
      await simulateUpload({
        uri: asset.uri,
        name: asset.name,
        size: asset.size || 0,
      });
    },
    [simulateUpload, onUploadError]
  );

  const handleRemove = useCallback(() => {
    setFile(null);
  }, []);

  const handleRetry = useCallback(() => {
    if (file) {
      simulateUpload({ uri: file.uri, name: file.name, size: file.size });
    }
  }, [file, simulateUpload]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>One More Step</Text>
        <Text style={styles.subtitle}>
          Your rental agreement helps us confirm your eligibility and unlock your Secured benefits.
        </Text>
      </View>

      {/* Upload Area */}
      <View style={styles.uploadArea}>
        {!file ? (
          <FileUploadZone
            onFileSelected={handleFileSelected}
            acceptedTypes={['application/pdf', 'image/jpeg', 'image/png']}
            maxSizeBytes={10 * 1024 * 1024}
            placeholder="Tap to upload your rental agreement"
            testID={`${testID}-upload-zone`}
          />
        ) : (
          <DocumentUploadCard
            filename={file.name}
            status={file.status}
            progress={file.progress}
            errorMessage={file.error}
            onRemove={file.status === 'success' || file.status === 'idle' ? handleRemove : undefined}
            onRetry={file.status === 'error' ? handleRetry : undefined}
            testID={`${testID}-upload-card`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    color: SECTION_COLORS.title,
    letterSpacing: -2,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: SECTION_COLORS.subtitle,
  },
  uploadArea: {
    width: '100%',
  },
});

export const AgreementUploadSection = memo(AgreementUploadSectionComponent);
