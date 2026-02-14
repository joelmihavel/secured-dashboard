/**
 * Agreement Upload Screen - Pixel Perfect Figma Implementation
 *
 * Source: figma-parity/data/ai-enhanced/1-29914/enhanced-extraction.json
 * Extracted: 2026-02-01 via extract-figma-ai-enhanced.ts v3.0
 *
 * Figma Node References:
 * - 1:29914: Onboarding / Agreement --upload (idle state)
 * - 1:29985: Frame 1686557268 (main content container)
 * - 1:29986: Frame 1686557318 (wraps logo, text, card)
 * - 1:29989: Frame 2095586319 (text block)
 * - 1:29992: Frame 1686557325 (upload card)
 * - 1:29993: Frame 1686557324 (icon square)
 * - 1:29998: Vector 44 (fold corner)
 * - 1:29999: Vector (paperclip)
 * - 1:30000: button instance
 *
 * Design Specs:
 * - Screen: 393x852 (iPhone 14/15 base)
 * - Content width: 297px (48px padding each side)
 * - All values are exact Figma pixels, no scaling
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton, Logo } from '@/src/components';
import { DottedPattern } from '@/src/components/patterns';
import { useAgreement } from '@/src/hooks';
import {
  getMimeType,
  validateFileSize,
  validateAgreementType,
} from '@/src/services/payment';
import { supabase } from '@/src/services/supabase/client';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';

// ============================================
// FIGMA EXTRACTED CONSTANTS
// Source: figma-parity/data/ai-enhanced/1-29914/enhanced-extraction.json
// Extracted: 2026-02-01T21:07:45.370Z
// ============================================

const FIGMA = {
  // Base design dimensions (node 1:29914)
  screen: {
    width: 393,
    height: 852,
  },

  // Colors using Design Tokens
  // Mapped from Figma Variable IDs in extraction
  colors: {
    background: colors.black[700],        // #131313 - VariableID:b68dbac75b766af96ea05be0f99c98d5ce07c915
    backgroundPattern: 0.08,              // image 149 opacity

    // Card colors
    cardBackground: colors.black[500],    // #202020 - VariableID:e3cb66c05a62a8680357c6bba79620d8a57e6f10
    cardBorder: colors.black[500],        // #202020 - Default border
    iconSquareBg: colors.black[600],      // #1A1A1A - VariableID:4f11c79ac277ba1a87ffd57b8f7ce7e8003ac8f6
    foldCornerFill: colors.black[600],    // #1A1A1A - Same as iconSquareBg
    foldCornerStroke: colors.black[500],  // #202020 - VariableID:e3cb66c05a62a8680357c6bba79620d8a57e6f10
    paperclip: colors.black[400],         // #4D4D4D - VariableID:d0771a90f71f9f9162cc0656f42874451acc6ae7

    // Text colors (from styleOverrideTable)
    titleGray: colors.neutral[500],       // #A9A9A9 - VariableID:a30255c279da5be0e3281358b6555fa3fed99370
    titleAccent: colors.brand[500],       // #FF9A6D - VariableID:0fd77850f1e95a3b4b9c0b7b04fa3f11a2f4a424
    subtitle: colors.black[300],          // #797979
    hintText: colors.neutral[500],        // #A9A9A9
    fileName: '#D2D2D2',                  // Figma exact: neutral file name
    progressText: colors.neutral[800],    // #444444

    // Status colors (from Figma variable references)
    iconError: '#E5484D',                 // var(--colour/icons/error/default)
    iconSuccess: colors.success.default,  // #70BF73
    iconWarning: '#FFB020',               // var(--colour/icons/warning/default) - NOT brand[500]
    progressBar: colors.brand[500],       // #FF9A6D
    progressTrack: colors.black[600],     // #1A1A1A (from 1:30087)

    // Upload icon (from VariableID:cbe469ebb2e729109112be6aa79671eb488a7147)
    uploadIcon: colors.neutral[200],      // #DDDDDD

    // Button states
    buttonDisabledBg: colors.black[500],
    buttonDisabledBorder: colors.black[500],
    buttonDisabledText: colors.neutral[800],
  },

  // Typography - using design tokens from @/src/theme/typography
  // Mapped from Figma text styles to theme tokens
  typography: {
    // Title: Figma "h1" style (48/64/-2)
    title: typography.h1,
    // Subtitle: Figma "Body/sm" style (12/20/0)
    subtitle: typography.bodySm,
    // Hint: Figma "Body/sm" style (12/20/0)
    hint: typography.bodySm,
    // File name: Figma "Body/sm Medium" style (12/20/0, medium weight)
    fileName: typography.bodySmMedium,
  },

  // Layout from Frame 1686557268 (node 1:29985)
  layout: {
    containerPadding: 48,            // paddingLeft/paddingRight from extraction
    contentWidth: 297,               // 393 - 48 - 48 = 297

    // From Frame 1686557318 (node 1:29986)
    sectionGap: 48,                  // itemSpacing between logo/textblock and card

    // From Frame 2095586319 (node 1:29989)
    textBlockGap: 16,                // itemSpacing between title and subtitle

    // From Frame 1686557268 (node 1:29985)
    buttonGap: 40,                   // itemSpacing between content block and button
  },

  // Logo from Frame 1686557264 (node 1:29987)
  logo: {
    width: 32.04,
    height: 38.4,
  },

  // Card from Frame 1686557325 (node 1:29992)
  card: {
    width: 297,
    height: 160,
    borderRadius: 12,                // cornerRadius
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 16,           // paddingLeft/paddingRight
    gap: 16,                         // itemSpacing
  },

  // Icon square from Frame 1686557324 (node 1:29993)
  iconSquare: {
    size: 56,
    borderRadius: 12,
    padding: 16,
  },

  // Fold corner effect from Frame 2095586320 (node 1:29996)
  // Composed of Rectangle 120 (cutout) + Vector 44 (fold shape)
  // Card: x=5684, y=785.4, 297x160
  // Rectangle 120: x=5927, y=785, 54x54 - right edge aligns with card (5927+54=5981=5684+297)
  // Vector 44: x=5927, y=779, 67x60 - extends 13px past card right edge (5927+67=5994)
  foldCorner: {
    // Rectangle 120 (node 1:29997) - cutout (background color to "cut" the card corner)
    cutout: {
      width: 54,
      height: 54,
      borderRadius: 12,
      // Right edge of cutout aligns with right edge of card
      rightOffset: 0,
      topOffset: 0,      // At card top (785 - 785.4 ≈ 0)
    },
    // Vector 44 (node 1:29998) - fold shape (the actual fold visual)
    shape: {
      width: 67,
      height: 60,
      // Same left position as cutout, but wider so extends 13px past card
      rightOffset: -13,  // 67 - 54 = 13px extension past card edge
      topOffset: -6.4,   // Extends 6.4px above card
    },
  },

  // Paperclip from Vector (node 1:29999)
  // Card position: x=5684, y=785.4
  // Paperclip position: x=5692, y=779.69
  // leftOffset = 5692 - 5684 = 8
  // topOffset = 779.69 - 785.4 = -5.71
  paperclip: {
    width: 22.77,
    height: 41.4,
    rotation: 163.65,                // degrees
    leftOffset: 8,
    topOffset: -5.7,
  },

  // Upload icon from Outline Icon Library (node 1:29994)
  uploadIcon: {
    size: 24,
  },

  // Button from button instance (node 1:30000)
  button: {
    width: 297,
    height: 56,
    borderRadius: 12,
  },

  // Progress bar - from Figma node 1:30087 (uploading state)
  // 6px height, 80px width (track dimensions)
  progressBar: {
    height: 6,
    width: 80,
    borderRadius: 3, // Half of height for pill shape
  },

  // Animation
  animation: {
    duration: 300,
    easing: Easing.out(Easing.ease),
  },
} as const;

// ============================================
// TYPES
// ============================================

type UploadState = 'idle' | 'uploading' | 'success' | 'error_expired' | 'error_size' | 'manual_review';
interface SelectedDocument {
  uri: string;
  name: string;
  type: 'pdf' | 'image';
  size?: number;
}

// State configuration from Figma text-content.json for each screen
// 1-30358 (manual_review): borderColor #FFB020, hint text outside card
const STATE_CONFIG = {
  idle: {
    borderColor: FIGMA.colors.cardBorder,
    foldCornerStroke: FIGMA.colors.foldCornerStroke, // #202020

    buttonTitle: 'Proceed',
    buttonEnabled: false,
    errorMessage: null as string | null,
    showDivider: false,
    fileNameColor: FIGMA.colors.fileName, // #D2D2D2
  },
  uploading: {
    borderColor: FIGMA.colors.cardBorder,
    foldCornerStroke: FIGMA.colors.foldCornerStroke,

    buttonTitle: 'Proceed',
    buttonEnabled: false,
    errorMessage: null as string | null,
    showDivider: false,
    fileNameColor: FIGMA.colors.fileName,
  },
  success: {
    // From Figma 1:30090 - no colored border, just default card
    borderColor: FIGMA.colors.cardBorder,
    foldCornerStroke: FIGMA.colors.foldCornerStroke,

    buttonTitle: 'Proceed',
    buttonEnabled: true,
    errorMessage: null as string | null,
    showDivider: true, // Figma: divider pill above active button
    fileNameColor: '#4D4D4D', // Figma 1:30090: dimmer filename color
  },
  error_expired: {
    borderColor: FIGMA.colors.iconError,
    foldCornerStroke: FIGMA.colors.iconError, // #E5484D - matches card border

    buttonTitle: 'Upload Again',
    buttonEnabled: true,
    // From 1-30178 - message appears OUTSIDE the card
    errorMessage: 'The agreement is invalid or expired. Please upload a valid one.',
    showDivider: true, // Figma: divider pill above active button
    fileNameColor: '#D2D2D2', // Figma 1:30178: lighter filename
  },
  error_size: {
    borderColor: FIGMA.colors.iconError,
    foldCornerStroke: FIGMA.colors.iconError,

    buttonTitle: 'Upload Again',
    buttonEnabled: true,
    // From 1-30268 - message appears OUTSIDE the card
    errorMessage: 'This file is too large. Please upload a file under 10MB',
    showDivider: true, // Figma: divider pill above active button
    fileNameColor: '#D2D2D2', // Figma 1:30268: lighter filename
  },
  manual_review: {
    borderColor: FIGMA.colors.iconWarning, // #FFB020
    foldCornerStroke: FIGMA.colors.iconWarning, // #FFB020 - matches card border

    buttonTitle: 'Get Notified',
    buttonEnabled: true,
    // From 1-30358 - message appears OUTSIDE the card
    errorMessage: 'Our team will review it manually and get back to you within 24 hours.',
    showDivider: true, // Figma: divider pill above active button
    fileNameColor: '#D2D2D2', // Figma 1:30358: lighter filename
  },
} as const;

// ============================================
// SVG ICON COMPONENTS (from exported assets)
// ============================================

// Upload Icon - from Outline Icon Library (1:29994)
function UploadIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Bottom line */}
      <Path
        d="M4 17L4 21L20 21L20 17"
        stroke={FIGMA.colors.uploadIcon}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow shaft */}
      <Path
        d="M12 16L12 4"
        stroke={FIGMA.colors.uploadIcon}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow head */}
      <Path
        d="M7 9L12 4L17 9"
        stroke={FIGMA.colors.uploadIcon}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Trash Icon - for file selected states (delete action)
// From Figma Outline Icon Library - standard 24x24 trash icon
function TrashIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lid */}
      <Path
        d="M4 7H20"
        stroke={FIGMA.colors.uploadIcon}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Handle */}
      <Path
        d="M10 3H14"
        stroke={FIGMA.colors.uploadIcon}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bin body */}
      <Path
        d="M6 7V19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19V7"
        stroke={FIGMA.colors.uploadIcon}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Lines inside */}
      <Path
        d="M10 11V17"
        stroke={FIGMA.colors.uploadIcon}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M14 11V17"
        stroke={FIGMA.colors.uploadIcon}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Paperclip - from Vector (1:29999), exact Figma path
function PaperclipIcon() {
  return (
    <View
      style={[
        styles.paperclip,
        {
          width: FIGMA.paperclip.width,
          height: FIGMA.paperclip.height,
          transform: [{ rotate: `${FIGMA.paperclip.rotation}deg` }],
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 20 39" fill="none">
        <Path
          d="M4.66458 21.8168C3.1606 16.6896 1.46928 11.5794 0.143226 6.40293C-0.891824 2.36233 3.90456 -1.71545 7.68493 0.746955C8.80415 1.47607 9.29368 2.60981 9.66665 3.82293C10.3374 6.00486 10.9522 8.20559 11.5947 10.3959C13.0789 15.4557 14.7334 20.4968 16.055 25.6017C17.3306 30.5292 10.028 32.3305 8.30122 27.7186C6.4971 22.9002 9.23364 31.0748 7.78481 26.1355C7.56364 25.3815 8.735 25.0366 8.95654 25.7918C10.1365 29.8146 7.45232 20.4863 8.63228 24.5089C8.95551 25.6108 9.14134 27.0199 9.76614 28.0165C11.3772 30.5864 15.6007 28.8771 14.8833 25.9455C13.9129 21.9803 12.5734 18.0707 11.4246 14.1543C10.4065 10.6835 9.6051 7.04117 8.34311 3.64909C7.16808 0.490827 2.44517 0.706117 1.32234 3.90774C0.965432 4.92559 1.16032 5.53208 1.43589 6.47152C2.69759 10.7728 3.95931 15.0742 5.22104 19.3756C6.48274 23.6769 7.7445 27.9784 9.0062 32.2797C9.54013 34.1 10.1637 36.0987 12.0234 36.9648C14.1369 37.9492 17.0761 36.8916 18.2224 34.9309C19.8486 32.149 17.4791 27.2655 16.683 24.5514C15.3957 20.163 14.1086 15.7748 12.8214 11.3866C12.6002 10.6326 13.7716 10.2877 13.9931 11.0429C15.403 15.8494 16.8129 20.656 18.2228 25.4626C19.086 28.4053 20.9607 32.3364 19.3988 35.3342C18.4004 37.2503 16.1233 38.491 13.9831 38.5574C11.223 38.6429 9.26729 36.7391 8.34149 34.2687C6.83303 30.2441 5.8732 25.9372 4.66458 21.8168Z"
          fill={FIGMA.colors.paperclip}
        />
      </Svg>
    </View>
  );
}

// Fold Corner Effect - composed of Rectangle 120 + Vector 44
// The card is a COMPLETE rectangle - fold effect is created by:
// 1. Rectangle 120 (#131313, same as background) covers the card corner
// 2. Vector 44 (#1A1A1A fold shape) creates the visual fold
function FoldCorner() {
  return (
    <View style={styles.foldCornerContainer}>
      {/* Rectangle 120 (node 1:29997) - background-colored cutout */}
      {/* Position: right edge of card, at top */}
      <View style={styles.foldCornerCutout} />

      {/* Vector 44 (node 1:29998) - fold shape */}
      {/* Position: same x as cutout, but extends 6px above card */}
      <View style={styles.foldCornerShape}>
        <Svg width={FIGMA.foldCorner.shape.width} height={FIGMA.foldCorner.shape.height} viewBox="0 0 67 60" fill="none">
          <Path
            d="M65.6924 59.5H12C5.64873 59.5 0.5 54.3513 0.5 48V1.11816L65.6924 59.5Z"
            fill={FIGMA.colors.foldCornerFill}
            stroke={FIGMA.colors.foldCornerStroke}
          />
        </Svg>
      </View>
    </View>
  );
}

// ============================================
// PROGRESS BAR COMPONENT
// ============================================

function ProgressBar({ progress }: { progress: number }) {
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withTiming(progress, {
      duration: FIGMA.animation.duration,
      easing: FIGMA.animation.easing,
    });
  }, [progress, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, animatedStyle]} />
    </View>
  );
}


// ============================================
// MAIN COMPONENT
// ============================================

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state: stateParam } = useLocalSearchParams<{
    state?: 'idle' | 'uploading' | 'success' | 'expired' | 'too-large' | 'manual-review';
  }>();

  // Use real API via useAgreement hook
  // Set useMock to true for visual testing / development only
  const useMock = stateParam != null && stateParam !== 'idle';
  const agreement = useAgreement({ useMock });

  // Map URL state parameter to internal upload state
  const getInitialUploadState = (): UploadState => {
    switch (stateParam) {
      case 'uploading': return 'uploading';
      case 'success': return 'success';
      case 'expired': return 'error_expired';
      case 'too-large': return 'error_size';
      case 'manual-review': return 'manual_review';
      default: return 'idle';
    }
  };

  // Mock document for non-idle states (for visual testing)
  const getInitialDocument = (): SelectedDocument | null => {
    if (stateParam && stateParam !== 'idle') {
      return {
        uri: 'mock://document.pdf',
        name: 'Joel_Ramesh-Agreement_Dec 2025.pdf', // Exact Figma text
        type: 'pdf',
        size: stateParam === 'too-large' ? 15 * 1024 * 1024 : 2 * 1024 * 1024,
      };
    }
    return null;
  };

  const [document, setDocument] = useState<SelectedDocument | null>(getInitialDocument);
  const [uploadState, setUploadState] = useState<UploadState>(getInitialUploadState);
  const [uploadProgress, setUploadProgress] = useState(stateParam === 'uploading' ? 30 : 0);
  // Overrides config.errorMessage for dynamic backend errors (OCR failed, network, etc.)
  const [errorOverrideMessage, setErrorOverrideMessage] = useState<string | null>(null);

  // Simulate upload progress for visual testing state demo
  useEffect(() => {
    if (stateParam === 'uploading') {
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 30;
          }
          return prev + 5;
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [stateParam]);

  // Sync real upload progress from hook
  useEffect(() => {
    if (agreement.isUploading && agreement.uploadProgress > 0) {
      setUploadProgress(agreement.uploadProgress);
    }
  }, [agreement.isUploading, agreement.uploadProgress]);

  // ============================================
  // APP LIFECYCLE HANDLING
  // Handles: app minimize during upload, app kill during upload,
  // and app reopen after processing completed in background.
  //
  // SAFETY:
  // - mountedRef prevents state updates after unmount
  // - uploadStateRef avoids stale closures in async callbacks
  // - Direct Supabase queries (not React Query) to avoid cache pollution
  // - agreement.setExtractionId() only called for completed extractions
  //   so useExtractedData never caches incomplete data
  // - supabase.auth.getSession() is read-only; does not affect auth state
  // ============================================

  const mountedRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadStateRef = useRef<UploadState>(uploadState);

  // Track mounted state for async safety
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Keep ref in sync so async callbacks see current value
  useEffect(() => {
    uploadStateRef.current = uploadState;
  }, [uploadState]);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Cleanup poll on unmount
  useEffect(() => clearPollTimer, [clearPollTimer]);

  // Check extraction status on backend; poll if still processing.
  // Uses direct Supabase query (NOT React Query) to avoid polluting the
  // useExtractedData cache with incomplete data.
  const checkAndPollStatus = useCallback(
    async (extractionId: string, attemptsLeft = 24) => {
      clearPollTimer();

      // Stop if state already moved past uploading (user tapped retry, or promise settled)
      if (!mountedRef.current || uploadStateRef.current !== 'uploading') return;

      try {
        const { data } = await supabase
          .from('extracted_rental_info')
          .select('id, extraction_status, is_city_supported')
          .eq('id', extractionId)
          .single();

        // Re-check after async gap
        if (!mountedRef.current || uploadStateRef.current !== 'uploading') return;

        if (!data || data.extraction_status === 'failed') {
          setUploadState('error_expired');
          setErrorOverrideMessage('Document processing failed. Please try uploading again.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }

        if (data.extraction_status === 'completed') {
          setUploadProgress(100);
          // Only set extraction ID when data is complete — this triggers
          // useExtractedData, which will now fetch fully populated data
          agreement.setExtractionId(extractionId);
          if (data.is_city_supported === false) {
            setUploadState('manual_review');
            setErrorOverrideMessage(
              "We're not in your city yet. Our team will review your document manually."
            );
          } else {
            setUploadState('success');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => {
              if (mountedRef.current) {
                router.replace({
                  pathname: '/(agreement)/review',
                  params: { extractionId },
                } as never);
              }
            }, FIGMA.animation.duration);
          }
          return;
        }

        // Still processing — schedule next check
        if (attemptsLeft <= 0) {
          setUploadState('error_expired');
          setErrorOverrideMessage(
            'Processing is taking longer than expected. Please try again later.'
          );
          return;
        }

        pollTimerRef.current = setTimeout(() => {
          checkAndPollStatus(extractionId, attemptsLeft - 1);
        }, 5000);
      } catch {
        if (mountedRef.current && uploadStateRef.current === 'uploading') {
          setUploadState('error_expired');
          setErrorOverrideMessage('Connection lost. Please try again.');
        }
      }
    },
    [clearPollTimer, agreement, router]
  );

  // Query the DB for the user's latest processing/completed extraction.
  // Used by both the mount check and the foreground handler.
  // Returns the extraction ID if a resumable record was found, or null.
  const findResumableExtraction = useCallback(async (): Promise<string | null> => {
    try {
      // Read-only — does not modify auth state or trigger token refresh
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return null;

      const { data } = await supabase
        .from('extracted_rental_info')
        .select('id, extraction_status, is_city_supported, updated_at')
        .eq('user_id', session.user.id)
        .in('extraction_status', ['processing', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data || !mountedRef.current) return null;

      if (data.extraction_status === 'completed') {
        // Set extraction ID only now (data is complete → safe for React Query cache)
        agreement.setExtractionId(data.id);
        router.replace({
          pathname: '/(agreement)/review',
          params: { extractionId: data.id },
        } as never);
        return data.id;
      }

      if (data.extraction_status === 'processing') {
        // Skip stale records — backend resets them after 5 min
        const ageMs = Date.now() - new Date(data.updated_at).getTime();
        if (ageMs > 5 * 60 * 1000) return null;

        // DO NOT call agreement.setExtractionId() here — extraction data is
        // incomplete, and setting it would trigger useExtractedData to cache
        // partial results with a 5-min staleTime.
        setDocument({
          uri: 'resumed://processing',
          name: 'Processing your document...',
          type: 'pdf',
        });
        setUploadState('uploading');
        setUploadProgress(75);
        checkAndPollStatus(data.id);
        return data.id;
      }

      return null;
    } catch {
      return null; // Silent fail — user can upload normally
    }
  }, [agreement, router, checkAndPollStatus]);

  // On mount: check for existing in-progress extraction (handles app kill + reopen)
  useEffect(() => {
    if (stateParam) return; // Skip for visual testing states
    findResumableExtraction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle app foreground/background transitions
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const wasBg = appStateRef.current.match(/inactive|background/);
        appStateRef.current = nextAppState;

        if (wasBg && nextAppState === 'active' && uploadStateRef.current === 'uploading') {
          // App returned to foreground during upload — verify backend status.
          // If extractionId is available, poll by ID (fast path).
          // If not (promise died before mutateAsync resolved), check DB (slow path).
          const eid = agreement.extractionId;
          if (eid) {
            checkAndPollStatus(eid);
          } else {
            findResumableExtraction();
          }
        }
      }
    );

    return () => subscription.remove();
  }, [agreement.extractionId, checkAndPollStatus, findResumableExtraction]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setDocument({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType?.includes('pdf') ? 'pdf' : 'image',
          size: asset.size,
        });
        setUploadState('idle');
      }
    } catch (error) {
      console.error('Document picker error:', error);
    }
  }, []);

  const handleRemoveDocument = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearPollTimer();
    setDocument(null);
    setUploadState('idle');
    setUploadProgress(0);
    setErrorOverrideMessage(null);
    agreement.resetUpload();
  }, [agreement, clearPollTimer]);

  const handleUpload = useCallback(async () => {
    if (!document) return;

    const mimeType = getMimeType(document.name);
    if (!validateAgreementType(mimeType)) {
      Alert.alert('Invalid File', 'Please upload a PDF or image file (JPG, PNG)');
      return;
    }

    if (document.size && !validateFileSize(document.size)) {
      setUploadState('error_size');
      return;
    }

    setUploadState('uploading');
    setUploadProgress(0);
    setErrorOverrideMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await agreement.upload(
        document.uri,
        document.name,
        document.size ?? 0
      );

      setUploadProgress(100);

      // Check processing result for manual review
      if (result.processResult.needsManualReview) {
        setUploadState('manual_review');
        // Use backend review reason if available
        if (result.processResult.reviewReason) {
          setErrorOverrideMessage(result.processResult.reviewReason);
        }
        return;
      }

      if (!result.processResult.isCitySupported) {
        setUploadState('manual_review');
        setErrorOverrideMessage("We're not in your city yet. Our team will review your document manually.");
        return;
      }

      setUploadState('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to review with extraction ID
      setTimeout(() => {
        router.replace({
          pathname: '/(agreement)/review',
          params: { extractionId: result.extractionId },
        } as never);
      }, FIGMA.animation.duration);
    } catch (error) {
      console.error('Upload error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Map backend error codes to UI states with appropriate messages
      const agreementError = error as { code?: string; message?: string };
      const code = agreementError.code ?? '';

      switch (code) {
        case 'FILE_TOO_LARGE':
          setUploadState('error_size');
          break;

        case 'INVALID_FILE_TYPE':
          setUploadState('error_expired');
          setErrorOverrideMessage('This file type is not supported. Please upload a PDF.');
          break;

        case 'OCR_FAILED':
          setUploadState('error_expired');
          setErrorOverrideMessage('We couldn\u2019t read the document. Please upload a clearer PDF.');
          break;

        case 'NETWORK_ERROR':
          setUploadState('error_expired');
          setErrorOverrideMessage('Network error. Please check your connection and try again.');
          break;

        case 'UPLOAD_FAILED':
          setUploadState('error_expired');
          setErrorOverrideMessage('Upload failed. Please check your connection and try again.');
          break;

        case 'PROCESSING_IN_PROGRESS':
          setUploadState('error_expired');
          setErrorOverrideMessage('A document is already being processed. Please wait a moment.');
          break;

        case 'NOT_AUTHENTICATED':
          // Redirect to sign-in
          router.replace('/(auth)/sign-up' as never);
          return;

        default:
          // Generic server error — show a helpful retry message
          setUploadState('error_expired');
          setErrorOverrideMessage('Something went wrong. Please try uploading again.');
          break;
      }
    }
  }, [document, agreement, router]);

  const handleRetry = useCallback(() => {
    clearPollTimer();
    setUploadState('idle');
    setUploadProgress(0);
    setDocument(null);
    setErrorOverrideMessage(null);
    agreement.resetUpload();
  }, [agreement, clearPollTimer]);

  const handleGetNotified = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(main)' as never);
  }, [router]);

  // Get current state config
  const config = STATE_CONFIG[uploadState];
  const isButtonEnabled = uploadState === 'idle' ? !!document : config.buttonEnabled;

  const handleButtonPress = () => {
    switch (uploadState) {
      case 'error_expired':
      case 'error_size':
        handleRetry();
        break;
      case 'manual_review':
        handleGetNotified();
        break;
      case 'success':
        // Navigate to review (same as auto-navigate after upload)
        if (agreement.extractionId) {
          router.replace({
            pathname: '/(agreement)/review',
            params: { extractionId: agreement.extractionId },
          } as never);
        }
        break;
      case 'uploading':
        // No action while uploading
        break;
      default:
        handleUpload();
    }
  };

  return (
    <Screen testID="upload-screen" style={styles.screen}>
      {/* Background Pattern - DottedPattern component with agreement-specific shape */}
      <DottedPattern showShape={true} backgroundShape="agreement" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            // Use exact Figma values for pixel-perfect on target device (393pt width)
            // From Figma: Frame 1686557268 has paddingLeft: 48, paddingRight: 48
            paddingHorizontal: FIGMA.layout.containerPadding, // 48px exact
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section - Frame 1686557318 (node 1:29986) */}
        <View style={styles.headerSection}>
          {/* Logo - Frame 1686557264 (node 1:29987) */}
          {/* Extraction shows: width: 32.04, height: 38.4 */}
          <View>
            <Logo size={38} />
          </View>

          {/* Text Block - Frame 2095586319 */}
          <View style={styles.textBlock}>
            {/* Title - "One\nMore Step" with mixed styles */}
            <View>
              <Text style={styles.titleGray}>
                One
              </Text>
              <Text style={styles.titleAccent}>
                More Step
              </Text>
            </View>

            {/* Subtitle - exact Figma text from 1:29991 */}
            <Text style={styles.subtitle}>
              Your rental agreement helps us confirm your eligibility and unlock your Secured benefits.
            </Text>
          </View>

          {/* Upload Card - Frame 1686557325 (node 1:29992) */}
          {/* Figma states: idle (upload box), uploading (% + bar), success/error/warning (file + icon) */}
          {/* Error/warning messages appear OUTSIDE the card per Figma */}
          {document ? (
            <View style={uploadState !== 'uploading' ? styles.cardWithMessageWrapper : undefined}>
              <Animated.View
                entering={FadeIn.duration(FIGMA.animation.duration)}
                style={[
                  styles.uploadCard,
                  {
                    borderWidth: 1,
                    borderColor: config.borderColor,
                  },
                ]}
              >
                {/* Fold Corner - positioned at top-right of card */}
                <FoldCorner />

                {/* Paperclip - positioned at top-left of card */}
                <PaperclipIcon />

                {/* Content container - differs by state */}
                <View style={styles.cardContent}>
                  {uploadState === 'uploading' ? (
                    /* Uploading: Figma 1:30001 - only centered % + progress bar */
                    <>
                      <Text style={styles.progressPercent}>{uploadProgress}%</Text>
                      <ProgressBar progress={uploadProgress} />
                    </>
                  ) : (
                    /* File selected: Figma 1:30090/30268/30178/30358 - small trash icon + filename */
                    <>
                      <TouchableOpacity
                        onPress={handleRemoveDocument}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <TrashIcon size={16} />
                      </TouchableOpacity>
                      <Text
                        style={[styles.fileName, { color: config.fileNameColor }]}
                        numberOfLines={2}
                      >
                        {document.name}
                      </Text>
                    </>
                  )}
                </View>
              </Animated.View>

              {/* Error/Warning message - OUTSIDE the card per Figma */}
              {/* errorOverrideMessage takes priority (dynamic backend errors) */}
              {(errorOverrideMessage || config.errorMessage) && (
                <Text
                  style={[
                    styles.errorTextOutside,
                    uploadState === 'manual_review' && styles.warningTextOutside,
                  ]}
                >
                  {errorOverrideMessage ?? config.errorMessage}
                </Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={handlePickDocument}
              activeOpacity={0.7}
              style={styles.uploadCard}
            >
              {/* Fold Corner - positioned at top-right of card */}
              <FoldCorner />

              {/* Paperclip - positioned at top-left of card */}
              <PaperclipIcon />

              {/* Content container */}
              <View style={styles.cardContent}>
                {/* Icon Square - Figma 1:29993: 56px bg square */}
                <View style={styles.iconSquare}>
                  <UploadIcon size={FIGMA.uploadIcon.size} />
                </View>

                {/* Upload hints - exact Figma text from 1:29995 */}
                <View style={styles.hintContainer}>
                  <Text style={styles.hintText}>Upload Rental Agreement</Text>
                  <Text style={styles.hintText}>File types: PDF, DOCX, Max size: 10MB</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Button Section */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title={config.buttonTitle}
            onPress={handleButtonPress}
            disabled={!isButtonEnabled}
            loading={uploadState === 'uploading'}
            showDivider={config.showDivider && isButtonEnabled}
            testID="proceed-button"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

// ============================================
// STYLES - Exact Figma values
// ============================================

const styles = StyleSheet.create({
  screen: {
    backgroundColor: FIGMA.colors.background,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  // Frame 1686557268 (node 1:29985)
  // Extraction: layoutMode VERTICAL, counterAxisAlignItems CENTER, padding 48/48, itemSpacing 40
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center', // counterAxisAlignItems: CENTER (children horizontally centered)
  },

  // Header section - Frame 1686557318 (node 1:29986)
  // Extraction: width 297, layoutMode VERTICAL, itemSpacing 48
  headerSection: {
    width: FIGMA.layout.contentWidth, // 297
    gap: FIGMA.layout.sectionGap,     // 48px itemSpacing from extraction
  },

  // Text block - Frame 2095586319 (node 1:29989)
  // Extraction: width 297, layoutMode VERTICAL, itemSpacing 16
  textBlock: {
    width: FIGMA.layout.contentWidth, // 297
    gap: FIGMA.layout.textBlockGap,   // 16px itemSpacing from extraction
  },

  // Title styles - using h1 design token, only color differs
  // Figma: LEFT aligned (not centered)
  titleGray: {
    ...FIGMA.typography.title,
    color: FIGMA.colors.titleGray,
  },
  titleAccent: {
    ...FIGMA.typography.title,
    color: FIGMA.colors.titleAccent,
  },

  // Subtitle - node 1:29991, using bodySm design token
  // Figma token: Font Size/Body/sm = 12px, Line Height/Body/sm = 20px
  // Figma: LEFT aligned
  subtitle: {
    ...FIGMA.typography.subtitle,
    color: FIGMA.colors.subtitle, // #797979
  },

  // Upload card - Frame 1686557325 (node 1:29992)
  // Extraction: 297x160, cornerRadius 12, padding 24/16/24/16
  // AI Analysis: "CRITICAL: Must have overflow='visible' for paperclip and fold corner"
  uploadCard: {
    backgroundColor: FIGMA.colors.cardBackground, // #202020
    borderRadius: FIGMA.card.borderRadius,        // 12
    width: FIGMA.card.width,                      // 297 (explicit width)
    minHeight: FIGMA.card.height,                 // 160 (min to allow content expansion)
    paddingTop: FIGMA.card.paddingTop,            // 24
    paddingBottom: FIGMA.card.paddingBottom,      // 24
    paddingHorizontal: FIGMA.card.paddingHorizontal, // 16
    position: 'relative',
    overflow: 'visible', // CRITICAL for paperclip and fold corner
  },

  // Card content - vertical layout with centered items
  cardContent: {
    alignItems: 'center',
    gap: FIGMA.card.gap,
  },

  // Fold corner container - positioned at top-right of card
  // Must allow overflow for shape to extend past card edge
  foldCornerContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
    overflow: 'visible',
  },
  // Rectangle 120 (node 1:29997) - background-colored cutout
  // This "cuts out" the card corner by covering it with background color
  foldCornerCutout: {
    position: 'absolute',
    width: FIGMA.foldCorner.cutout.width,             // 54
    height: FIGMA.foldCorner.cutout.height,           // 54
    borderRadius: FIGMA.foldCorner.cutout.borderRadius, // 12
    backgroundColor: FIGMA.colors.background,         // #131313 (same as screen)
    top: FIGMA.foldCorner.cutout.topOffset,           // 0
    right: FIGMA.foldCorner.cutout.rightOffset,       // 0
  },
  // Vector 44 (node 1:29998) - fold shape
  // Extends 13px past card edge, 6.4px above card top
  foldCornerShape: {
    position: 'absolute',
    top: FIGMA.foldCorner.shape.topOffset,            // -6.4
    right: FIGMA.foldCorner.shape.rightOffset,        // -13
  },

  // Paperclip positioning - absolute, extends outside card (Vector, node 1:29999)
  // AI Note: "CRITICAL: Must have overflow='visible' to allow paperclip to extend outside bounds"
  paperclip: {
    position: 'absolute',
    zIndex: 10,
    left: FIGMA.paperclip.leftOffset, // 8px from card left
    top: FIGMA.paperclip.topOffset,   // -5.7px (extends above card)
  },

  // Icon square - Frame 1686557324 (node 1:29993)
  iconSquare: {
    backgroundColor: FIGMA.colors.iconSquareBg, // #1A1A1A
    width: FIGMA.iconSquare.size,               // 56
    height: FIGMA.iconSquare.size,              // 56
    borderRadius: FIGMA.iconSquare.borderRadius, // 12
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hint container
  hintContainer: {
    alignItems: 'center',
  },

  // Hint text - node 1:29995, using bodySm design token
  hintText: {
    ...FIGMA.typography.hint,
    color: FIGMA.colors.hintText, // #A9A9A9
    textAlign: 'center',
  },

  // Card + message wrapper - for error/warning states
  // Figma: gap 32 between card and error text (node 1:30346)
  cardWithMessageWrapper: {
    gap: 32,
    alignItems: 'center',
  },

  // File name - Figma: centered, bodySmMedium
  // Color varies by state (set inline)
  fileName: {
    ...FIGMA.typography.fileName, // bodySmMedium design token
    color: FIGMA.colors.fileName,
    textAlign: 'center' as const,
    maxWidth: 167, // Figma: 167px width for filename text
  },

  // Progress percent - Figma 1:30001: centered "30%" text
  // bodyMd2 Regular 14/20 in #444 color
  progressPercent: {
    ...typography.bodyMd2,
    color: FIGMA.colors.progressText, // #444444
    textAlign: 'center' as const,
  },

  progressTrack: {
    backgroundColor: FIGMA.colors.progressTrack,
    height: FIGMA.progressBar.height,
    width: FIGMA.progressBar.width,
    borderRadius: FIGMA.progressBar.borderRadius,
    overflow: 'hidden' as const,
  },

  progressFill: {
    height: '100%',
    backgroundColor: FIGMA.colors.progressBar,
    borderRadius: FIGMA.progressBar.borderRadius,
  },

  // Error text OUTSIDE card - Figma: centered, bodyMd2 (14/20), #E5484D
  // Node 1:30356 (error_size) / 1:30266 (expired) / 1:30446 (manual_review)
  errorTextOutside: {
    ...typography.bodyMd2,
    color: FIGMA.colors.iconError,
    textAlign: 'center' as const,
    maxWidth: 255, // Figma: 255px width constraint
  },

  warningTextOutside: {
    color: FIGMA.colors.iconWarning,
  },

  // Layout
  spacer: {
    flex: 1,
  },

  // Button container - button (node 1:30000)
  // Extraction: width 297, height 56
  buttonContainer: {
    width: FIGMA.layout.contentWidth, // 297
    marginTop: FIGMA.layout.buttonGap, // 40px itemSpacing from Frame 1686557268
  },
});
