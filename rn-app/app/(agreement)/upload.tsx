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

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  interpolateColor,
  FadeIn,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton, Logo } from '@/src/components';
import { DottedGridPattern } from '@/src/components/patterns';
import { useAgreement, useNetworkStatus } from '@/src/hooks';
import { useExtractionStatus } from '@/src/hooks/useExtractionStatus';
import {
  getMimeType,
  validateFileSize,
  validateAgreementType,
} from '@/src/services/payment';
import { navigateToError } from '@/src/utils';
import { useUploadStore } from '@/src/stores/upload';
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
    titleGray: colors.neutral[500], // #A9A9A9
    titleAccent: colors.brand[500], // #FF9A6D - VariableID:0fd77850f1e95a3b4b9c0b7b04fa3f11a2f4a424
    subtitle: colors.black[300],          // #797979
    hintText: colors.neutral[500],        // #A9A9A9
    fileName: '#D2D2D2',                  // Figma exact: neutral file name
    progressText: colors.neutral[800],    // #444444

    // Status colors (from Figma variable references)
    iconError: colors.error.radix,                 // var(--colour/icons/error/default)
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

// State configuration from Figma blueprint-verified values for each screen
// Verified against: 1-30090 (success), 1-30001 (uploading), 1-30178 (expired),
// 1-30268 (file too large), 1-30358 (manual review)
const STATE_CONFIG = {
  idle: {
    borderColor: FIGMA.colors.cardBorder, // #202020
    borderWidth: 0, // Figma: no strokes on idle card
    foldCornerFill: FIGMA.colors.foldCornerFill, // #1A1A1A
    foldCornerStroke: FIGMA.colors.foldCornerStroke, // #202020

    buttonTitle: 'Proceed',
    buttonEnabled: false,
    errorMessage: null as string | null,
    showDivider: true,
    fileNameColor: FIGMA.colors.fileName, // #D2D2D2
    showTrashIcon: true,
  },
  uploading: {
    borderColor: FIGMA.colors.cardBorder,
    borderWidth: 0, // Figma: no strokes on uploading card
    foldCornerFill: FIGMA.colors.foldCornerFill, // #1A1A1A
    foldCornerStroke: FIGMA.colors.foldCornerStroke,

    buttonTitle: 'Proceed',
    buttonEnabled: false,
    errorMessage: null as string | null,
    showDivider: true,
    fileNameColor: FIGMA.colors.fileName,
    showTrashIcon: false,
  },
  success: {
    // From Figma 1:30090 - no border stroke, card has empty strokes array
    borderColor: FIGMA.colors.cardBorder,
    borderWidth: 0, // Figma 1:30090: strokes: [] (no border)
    foldCornerFill: FIGMA.colors.foldCornerFill, // #1A1A1A (Figma 1:30090 Vector 44)
    foldCornerStroke: FIGMA.colors.foldCornerStroke, // #202020

    buttonTitle: 'Proceed',
    buttonEnabled: true,
    errorMessage: null as string | null,
    showDivider: true, // Figma: divider pill above active button
    fileNameColor: colors.black[400], // Figma 1:30090: dimmer filename color
    showTrashIcon: true,
  },
  error_expired: {
    borderColor: FIGMA.colors.iconError, // #E5484D
    borderWidth: 1, // Figma 1:30178: stroke weight 1, align INSIDE
    foldCornerFill: FIGMA.colors.foldCornerFill, // #1A1A1A
    foldCornerStroke: FIGMA.colors.iconError, // #E5484D - matches card border

    buttonTitle: 'Upload again',
    buttonEnabled: true,
    // From 1-30178 - message appears OUTSIDE the card
    errorMessage: 'The agreement is invalid or expired. Please upload a valid one.',
    showDivider: true, // Figma: divider pill above active button
    fileNameColor: FIGMA.colors.iconError, // Figma 1:30178: red filename
    showTrashIcon: true,
  },
  error_size: {
    borderColor: FIGMA.colors.iconError,
    borderWidth: 1,
    foldCornerFill: FIGMA.colors.foldCornerFill, // #1A1A1A
    foldCornerStroke: FIGMA.colors.iconError,

    buttonTitle: 'Upload again',
    buttonEnabled: true,
    // From 1-30268 - message appears OUTSIDE the card
    errorMessage: 'This file is too large. Maximum size is 10MB.',
    showDivider: true, // Figma: divider pill above active button
    fileNameColor: FIGMA.colors.iconError, // red filename
    showTrashIcon: true,
  },
  manual_review: {
    borderColor: FIGMA.colors.iconWarning, // #FFB020
    borderWidth: 1,
    foldCornerFill: FIGMA.colors.foldCornerFill, // #1A1A1A
    foldCornerStroke: FIGMA.colors.iconWarning, // #FFB020 - matches card border

    buttonTitle: 'Join Waitlist',
    buttonEnabled: true,
    // From 1-30358 - message appears OUTSIDE the card
    errorMessage: 'Our team will review it manually and get back to you within 24 hours.',
    showDivider: true, // Figma: divider pill above active button
    fileNameColor: '#D2D2D2', // Figma 1:30358: lighter filename
    showTrashIcon: true,
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
// From Figma Outline Icon Library (component 1:1804, variant "trash")
// Figma 1-30090/30178/30268/30358: all use #E5484D stroke (icons/error/default variable)
// 16x16 icon with 1.33px stroke weight at that size
function TrashIcon({ size = 20, color = FIGMA.colors.iconError }: { size?: number; color?: string }) {
  // Scales stroke weight proportionally from 2px at 24px size
  const strokeW = (size / 24) * 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lid */}
      <Path
        d="M4 7H20"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Handle */}
      <Path
        d="M10 3H14"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bin body */}
      <Path
        d="M6 7V19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19V7"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Lines inside */}
      <Path
        d="M10 11V17"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      <Path
        d="M14 11V17"
        stroke={color}
        strokeWidth={strokeW}
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

// Card Background with precise diagonal fold cut - replaces hacky Rect 120 cutout
function CardBackground({ fill, stroke, borderWidth = 0 }: { fill: string; stroke: string; borderWidth?: number }) {
  const w = FIGMA.card.width;
  const h = FIGMA.card.height;
  const r = FIGMA.card.borderRadius;
  const cutSize = 54;
  
  // Calculate inset to prevent SVG stroke clipping
  const inset = borderWidth / 2;
  const iW = w - inset;
  const iH = h - inset;

  // Path starts top-left (inset), goes to start of diagonal cut, cuts diagonally, goes down right side, curves bottom-right, goes bottom-left, curves, and closes up left side
  const d = `
    M ${inset} ${r + inset}
    C ${inset} ${5.37258 + inset} ${5.37258 + inset} ${inset} ${r + inset} ${inset}
    L ${w - cutSize - inset} ${inset}
    L ${iW} ${cutSize + inset}
    L ${iW} ${iH - r}
    C ${iW} ${h - 5.37258 - inset} ${w - 5.37258 - inset} ${iH} ${iW - r} ${iH}
    L ${r + inset} ${iH}
    C ${5.37258 + inset} ${iH} ${inset} ${h - 5.37258 - inset} ${inset} ${iH - r}
    Z
  `;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} fill="none">
        <Path d={d} fill={fill} stroke={borderWidth > 0 ? stroke : 'none'} strokeWidth={borderWidth} />
      </Svg>
    </View>
  );
}

function FoldCorner({ fill, stroke }: { fill: string; stroke: string }) {
  // SVG Flap path (Vector 44)
  const svgPath = 'M67 60L0 0L0 48C0 54.6274 5.37258 60 12 60L67 60Z';

  return (
    <View style={styles.foldCornerContainer}>
      {/* Vector 44 (node 1:29998) - fold shape overlaps the diagonal cut exactly */}
      <View style={styles.foldCornerShape}>
        <Svg width={FIGMA.foldCorner.shape.width} height={FIGMA.foldCorner.shape.height} viewBox="0 0 67 60" fill="none">
          <Path
            d={svgPath}
            fill={fill}
            stroke={stroke}
            strokeWidth={1}
            strokeLinejoin="round"
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
  // BUG 1 FIX: Init with current progress so remounts after backgrounding
  // don't animate from 0% — the bar stays at its current position.
  const animatedWidth = useSharedValue(progress);

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
// ANIMATED SWEEPING TEXT COMPONENT
// ============================================

function SweepingChar({
  char,
  index,
  charPos,
  sweep,
  style,
}: {
  char: string;
  index: number;
  charPos: number;
  sweep: SharedValue<number>;
  style: any;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const dist = Math.abs(sweep.value - charPos);
    // If the wave is close, color becomes bright orange, else fallback to dark grey
    return {
      color: interpolateColor(
        dist,
        [0, 0.15, 0.3],
        ['#FF9A6D', FIGMA.colors.progressText, FIGMA.colors.progressText]
      ),
    };
  });

  return (
    <Animated.Text style={[style, animatedStyle]}>
      {char === ' ' ? '\u00A0' : char}
    </Animated.Text>
  );
}

function SweepingText({ text, style }: { text: string; style: any }) {
  const chars = text.split('');
  const sweep = useSharedValue(-0.2); // Start wave off-screen left

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1.2, { duration: 1800, easing: Easing.linear }), // Move to off-screen right
      -1, // Infinite
      false // No reverse
    );
  }, [sweep]);

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
      {chars.map((char, index) => {
        // Position of character as a percentage from 0 to 1
        const charPos = chars.length > 1 ? index / (chars.length - 1) : 0;
        
        return (
          <SweepingChar
            key={index}
            char={char}
            index={index}
            charPos={charPos}
            sweep={sweep}
            style={style}
          />
        );
      })}
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { forceNew } = useLocalSearchParams<{
    forceNew?: string;
  }>();

  // Persisted upload store — survives app kills
  const hasHydrated = useUploadStore((s) => s._hasHydrated);

  // Use real API via useAgreement hook
  const agreement = useAgreement();
  const { isConnected } = useNetworkStatus();

  // Extraction status tracking — polling + Realtime + AppState recovery
  const extractionStatus = useExtractionStatus({ enabled: hasHydrated });

  // Derive initial upload state from persisted store or URL params
  const getInitialUploadState = (): UploadState => {
    // forceNew = re-upload from review screen, always start fresh
    if (forceNew === 'true') return 'idle';

    // Derive from persisted store (prevents flash on resume)
    const store = useUploadStore.getState();
    if (store.isStale()) { store.reset(); return 'idle'; }

    switch (store.uploadPhase) {
      case 'requesting_url':
      case 'uploading_file':
      case 'processing':
      case 'server_processing':
        return 'uploading';
      case 'completed':
        // useExtractionStatus will detect and redirect to review
        return 'uploading';
      case 'failed':
        return 'error_expired';
      default:
        return 'idle';
    }
  };

  // Restore document from persisted store on resume
  const getInitialDocument = (): SelectedDocument | null => {
    // Restore document placeholder from persisted store
    if (forceNew !== 'true') {
      const store = useUploadStore.getState();
      if (store.fileName && store.uploadPhase !== 'idle') {
        return {
          uri: 'resumed://processing',
          name: store.fileName,
          type: 'pdf',
        };
      }
    }
    return null;
  };

  const [document, setDocument] = useState<SelectedDocument | null>(getInitialDocument);
  const [uploadState, setUploadState] = useState<UploadState>(getInitialUploadState);
  const [uploadProgress, setUploadProgress] = useState(() => {
    // Restore progress approximation from persisted phase
    const store = useUploadStore.getState();
    if (forceNew !== 'true' && !store.isStale()) {
      switch (store.uploadPhase) {
        case 'uploading_file': return 40;
        case 'processing':
        case 'server_processing': return 75;
        case 'completed': return 100;
        default: return 0;
      }
    }
    return 0;
  });
  // Overrides config.errorMessage for dynamic backend errors (OCR failed, network, etc.)
  const [errorOverrideMessage, setErrorOverrideMessage] = useState<string | null>(() => {
    // Restore error message from persisted store
    if (forceNew !== 'true') {
      const store = useUploadStore.getState();
      if (store.uploadPhase === 'failed' && store.errorMessage) {
        return store.errorMessage;
      }
    }
    return null;
  });

  // Loading gate: wait for persisted store to hydrate before rendering
  // This prevents the idle → uploading flash on app restart
  if (!hasHydrated) {
    return (
      <Screen testID="upload-screen">
        <View style={{ flex: 1, backgroundColor: colors.black[700], justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: 24, height: 24 }} />
        </View>
      </Screen>
    );
  }

  // Sync real upload progress from hook — update whenever progress changes,
  // including reset to 0 on error (not just when isUploading)
  useEffect(() => {
    if (agreement.uploadProgress > 0) {
      setUploadProgress(agreement.uploadProgress);
    } else if (!agreement.isUploading && agreement.uploadProgress === 0) {
      // Reset local progress when hook resets (error or explicit reset)
      setUploadProgress(0);
    }
  }, [agreement.isUploading, agreement.uploadProgress]);

  // ============================================
  // STORE RESET SYNC
  // If mount discovery finds the persisted extractionId no longer exists
  // in the DB (user deleted, record cleaned up, etc.), it resets the store
  // to idle. Sync that reset to local screen state.
  // ============================================

  const storePhase = useUploadStore((s) => s.uploadPhase);
  const storeErrorMessage = useUploadStore((s) => s.errorMessage);
  useEffect(() => {
    if (storePhase === 'idle' && uploadState === 'uploading' && !agreement.isUploading) {
      // Mount discovery found extractionId no longer exists — reset to idle
      setUploadState('idle');
      setUploadProgress(0);
      setDocument(null);
      setErrorOverrideMessage(null);
    } else if (storePhase === 'failed' && uploadState === 'uploading') {
      // processDocument fire-and-forget failed, or other async error —
      // store.setError() was called outside the mutation lifecycle.
      // Surface the error immediately instead of waiting for staleness timeout.
      setUploadState('error_expired');
      setUploadProgress(0);
      setErrorOverrideMessage(
        storeErrorMessage ?? 'Document processing failed. Please try uploading again.'
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [storePhase, storeErrorMessage, uploadState, agreement.isUploading]);

  // ============================================
  // EXTRACTION STATUS → UI STATE (single navigation authority)
  // React to query data from useExtractionStatus to drive all
  // status transitions and navigation. This is the ONLY place
  // that navigates to the review screen.
  // ============================================

  useEffect(() => {
    const status = extractionStatus.data;
    if (!status) return;

    switch (status.extractionStatus) {
      case 'completed': {
        const eid = status.extractionId;
        setUploadProgress(100);
        agreement.setExtractionId(eid);

        // Check for manual review conditions
        if (status.needsManualReview || !status.isCitySupported) {
          setUploadState('manual_review');
          setErrorOverrideMessage(
            status.extractionError ??
            "Our team will review it manually and get back to you within 24 hours."
          );
          return;
        }

        // Check for expired/invalid contract status
        if (status.contractStatus === 'expired' || status.contractStatus === 'invalid_document') {
          setUploadState('error_expired');
          setErrorOverrideMessage(
            status.extractionError ??
            'The agreement is invalid or expired. Please upload a valid one.'
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }

        // Happy path: completed and valid
        setUploadState('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          router.replace({
            pathname: '/(agreement)/review',
            params: { extractionId: eid },
          } as never);
        }, FIGMA.animation.duration);
        break;
      }
      case 'failed': {
        // Map extraction_error to user-friendly messages
        const errorMsg = status.extractionError;
        if (errorMsg?.includes('OCR') || errorMsg?.includes('read')) {
          setErrorOverrideMessage('We couldn\'t read the document. Please upload a clearer PDF.');
        } else if (errorMsg?.includes('invalid') || errorMsg?.includes('not a rental')) {
          setErrorOverrideMessage('This doesn\'t appear to be a rental agreement. Please upload your rental agreement.');
        } else {
          setErrorOverrideMessage(errorMsg ?? 'Document processing failed. Please try uploading again.');
        }
        setUploadState('error_expired');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      }
      case 'processing': {
        // Resume: show scanning state at 75% (but never go backwards)
        if (uploadState !== 'uploading') {
          setUploadState('uploading');
          setUploadProgress((prev) => Math.max(prev, 75));
          setDocument({
            uri: 'resumed://processing',
            name: useUploadStore.getState().fileName ?? 'Processing your document...',
            type: 'pdf',
          });
        }
        break;
      }
      // 'pending' is never tracked by useExtractionStatus — pending means
      // the file was never uploaded, so mount discovery skips it and the
      // store resets to idle (user sees fresh upload screen).
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractionStatus.data]);

  const handlePickDocument = useCallback(async () => {
    // Block file picker while an extraction is actively processing
    if (extractionStatus.hasActiveExtraction) {
      Alert.alert(
        'Processing In Progress',
        'Your document is still being processed. Please wait for it to complete.'
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
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
  }, [extractionStatus.hasActiveExtraction]);

  const handleRemoveDocument = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    extractionStatus.reset();
    setDocument(null);
    setUploadState('idle');
    setUploadProgress(0);
    setErrorOverrideMessage(null);
    agreement.resetUpload();
  }, [agreement, extractionStatus]);

  const handleUpload = useCallback(async () => {
    if (!document) return;

    // Deduplication: block new upload while an extraction is actively processing
    if (extractionStatus.hasActiveExtraction) {
      Alert.alert(
        'Upload In Progress',
        'A document is already being processed. Please wait for it to complete.'
      );
      return;
    }

    // Check network connectivity before starting upload
    if (!isConnected) {
      Alert.alert('No Internet', 'Please check your network connection and try again.');
      return;
    }

    // Guard against unreadable files (size=0 or undefined from DocumentPicker)
    if (!document.size || document.size <= 0) {
      Alert.alert('Cannot Read File', 'Could not read the file. Please try selecting it again.');
      return;
    }

    const mimeType = getMimeType(document.name);
    if (!validateAgreementType(mimeType)) {
      Alert.alert('Invalid File', 'Please upload a PDF file.');
      return;
    }

    if (!validateFileSize(document.size, 50)) {
      setUploadState('error_size');
      return;
    }

    setUploadState('uploading');
    setUploadProgress(0);
    setErrorOverrideMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await agreement.upload(
        document.uri,
        document.name,
        document.size ?? 0
      );

      // Upload completed + processDocument fired in background.
      // The useExtractionStatus polling + Realtime now drives all transitions:
      // completed → review screen, failed → error state, manual_review → waitlist.
      // No synchronous result to check here — the useEffect on extractionStatus.data
      // (above) handles everything.
    } catch (error) {
      console.error('Upload error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Map backend error codes to UI states with appropriate messages
      const agreementError = error as { code?: string; message?: string };
      const code = agreementError.code ?? '';

      const errorMsg = agreementError.message ?? '';

      switch (code) {
        case 'FILE_TOO_LARGE':
          setUploadState('error_size');
          // Show actual file size vs limit if available
          if (document.size) {
            const fileMB = (document.size / (1024 * 1024)).toFixed(1);
            setErrorOverrideMessage(`Your file is ${fileMB}MB. Maximum allowed is 50MB.`);
          }
          break;

        case 'INVALID_FILE_TYPE':
          setUploadState('error_expired');
          // Distinguish between unreadable file and wrong type
          if (errorMsg.includes('Could not read')) {
            setErrorOverrideMessage('Could not read the file. Please try selecting it again.');
          } else {
            setErrorOverrideMessage('This file type is not supported. Please upload a PDF.');
          }
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
          // Show timeout-specific message if applicable
          if (errorMsg.includes('timed out')) {
            setErrorOverrideMessage('Upload timed out. Please try with a smaller file or better connection.');
          } else if (errorMsg.includes('expired')) {
            setErrorOverrideMessage('Upload session expired. Please try again.');
          } else {
            setErrorOverrideMessage('Upload failed. Please check your connection and try again.');
          }
          break;

        case 'PROCESSING_IN_PROGRESS':
          setUploadState('error_expired');
          setErrorOverrideMessage('A document is already being processed. Please wait a moment.');
          break;

        case 'NOT_AUTHENTICATED':
          // Session is genuinely lost (callEdgeFunction already retried refresh).
          // Navigate to error screen — user needs to re-authenticate.
          navigateToError(router, {
            title: 'Session Expired',
            message: 'Your session has expired. Please sign in again to continue.',
            actionLabel: 'Sign In',
            action: '/(auth)/beta-splash',
          });
          return;

        default:
          // Generic server error — show a helpful retry message
          setUploadState('error_expired');
          setErrorOverrideMessage('Something went wrong. Please try uploading again.');
          break;
      }
    }
  }, [document, agreement, router, isConnected, extractionStatus.hasActiveExtraction]);

  const handleRetry = useCallback(() => {
    extractionStatus.reset();
    setUploadState('idle');
    setUploadProgress(0);
    setDocument(null);
    setErrorOverrideMessage(null);
    agreement.resetUpload();
  }, [agreement, extractionStatus]);

  const handleGetNotified = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(waitlist)' as never);
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
    <Screen testID="upload-screen" padded={false} safeAreaTop={false} style={{ backgroundColor: 'transparent' }}>
      {/* Background Pattern - DottedPattern component with agreement-specific shape */}
      <DottedGridPattern fadeMask={false} />

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
          <View style={{ position: 'relative', zIndex: 0 }}>
            {/* Wireframe Grid Image (Vector 45) - positioned absolutely behind card/button gap */}
            {/* Coordinates based strictly on Figma offsets from the card */}
            <Image
              source={{ uri: 'https://www.figma.com/api/mcp/asset/32a7fbdf-a485-4e7b-8e3d-5d19744bbb1f' }}
              style={styles.gridLineImage}
              resizeMode="contain"
            />
          {document ? (
            <View style={uploadState !== 'uploading' ? styles.cardWithMessageWrapper : undefined}>
              <Animated.View
                entering={FadeIn.duration(FIGMA.animation.duration)}
                style={[
                  styles.uploadCard,
                  { alignItems: 'center' }, // Document selected/uploading: Center aligned
                ]}
              >
                {/* SVG Background for the card (handles diagonal cut) */}
                <CardBackground 
                  fill={FIGMA.colors.cardBackground} 
                  stroke={config.borderColor} 
                  borderWidth={config.borderWidth} 
                />

                {/* Fold Corner Flap - positions exactly over the diagonal cut */}
                <FoldCorner fill={config.foldCornerFill} stroke={config.foldCornerStroke} />

                {/* Paperclip - positioned at top-left of card */}
                <PaperclipIcon />

                {/* Content container - differs by state */}
                {uploadState === 'uploading' ? (
                  /* Uploading: Figma 1:30001 - centered % + progress bar */
                  <View style={styles.cardContentUploading}>
                    {uploadProgress >= 75 ? (
                      <SweepingText text="scanning your agreement" style={styles.progressPercent} />
                    ) : (
                      <Text style={styles.progressPercent}>{uploadProgress}%</Text>
                    )}
                    <ProgressBar progress={uploadProgress} />
                  </View>
                ) : (
                  /* File selected: Figma Frame 130 (1:30173) - 167x68, gap 12 */
                  /* Trash icon 16x16 (#E5484D) + filename text 167x40 */
                  <View style={styles.cardContentFile}>
                    {config.showTrashIcon && (
                      <TouchableOpacity
                        onPress={handleRemoveDocument}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <TrashIcon size={20} />
                      </TouchableOpacity>
                    )}
                    <Text
                      style={[styles.fileName, { color: config.fileNameColor }]}
                      numberOfLines={2}
                    >
                      {document.name}
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* Error/Warning message - OUTSIDE the card per Figma */}
              {/* Figma: Frame 2095586377 wraps card + error text, gap: 32, width: 297 (FILL) */}
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
              style={[styles.uploadCard, { alignItems: 'flex-start' }]} // Empty state: Left aligned
            >
              {/* SVG Background for the card */}
              <CardBackground 
                fill={FIGMA.colors.cardBackground} 
                stroke={FIGMA.colors.cardBorder} 
                borderWidth={0} 
              />

              {/* Fold Corner Flap - positions exactly over the diagonal cut */}
              <FoldCorner fill={FIGMA.colors.foldCornerFill} stroke={FIGMA.colors.foldCornerStroke} />

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
                  <Text style={styles.hintText}>Upload Rental Agreement{'\n'}File type: PDF and Max size: 10MB</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          </View>
        </View>

        {/* Button Section */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title={config.buttonTitle}
            onPress={handleButtonPress}
            disabled={!isButtonEnabled}
            loading={uploadState === 'uploading'}
            showDivider={config.showDivider}
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
    justifyContent: 'center', // Fix vertical centering of the entire 618px block
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
  // Figma: 297x160, cornerRadius 12, padding 24/16/24/16
  // Layout: VERTICAL, justifyContent CENTER, alignItems CENTER, gap 16
  // CRITICAL: overflow visible for paperclip and fold corner to extend outside card
  uploadCard: {
    width: FIGMA.card.width,                      // 297 (explicit width)
    height: FIGMA.card.height,                    // 160 (FIXED, not min - Figma sizingV: FIXED)
    paddingTop: FIGMA.card.paddingTop,            // 24
    paddingBottom: FIGMA.card.paddingBottom,      // 24
    paddingHorizontal: FIGMA.card.paddingHorizontal, // 16
    justifyContent: 'center',                     // Figma: justifyContent center
    position: 'relative',
    overflow: 'visible', // CRITICAL for paperclip and fold corner
  },

  // Card content - idle state: upload icon + hint text
  // Figma: VERTICAL, START items, gap 16
  cardContent: {
    alignItems: 'flex-start',
    gap: FIGMA.card.gap, // 16
  },

  // Card content - file selected state: Figma Frame 130 (node 1:30173)
  // 167x68, VERTICAL, CENTER items/justify, gap 12
  cardContentFile: {
    maxWidth: 167,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12, // Figma Frame 130: itemSpacing 12
  },

  // Card content - uploading state: centered % + progress bar
  // Figma: card justifyContent CENTER handles vertical centering
  cardContentUploading: {
    alignItems: 'center',
    gap: 12, // Figma 1:30079: gap 12 between text and bar
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
    alignItems: 'flex-start',
  },

  // Hint text - node 1:29995, using bodySm design token
  hintText: {
    ...FIGMA.typography.hint,
    color: FIGMA.colors.hintText, // #A9A9A9
    textAlign: 'left',
  },

  // Card + message wrapper - for error/warning states
  // Figma: gap 32 between card and error text (node 1:30346)
  cardWithMessageWrapper: {
    gap: 32,
    alignItems: 'center',
  },

  // File name - Figma node 1:30176: 167x40, bodySmMedium (12/20, Medium)
  // Color varies by state (set inline)
  // Parent Frame 130 constrains width to 167px via cardContentFile style
  fileName: {
    ...FIGMA.typography.fileName, // bodySmMedium design token
    color: FIGMA.colors.fileName,
    textAlign: 'center' as const,
    alignSelf: 'stretch',
    flexShrink: 1,
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

  // Error text OUTSIDE card - Figma node 1:30266 (expired): 297x40, FILL width
  // Typography: 14/20 Regular (bodyMd2), #E5484D, centered
  // layoutSizingHorizontal: FILL (stretches to parent 297px width)
  errorTextOutside: {
    ...typography.bodyMd2,
    color: FIGMA.colors.iconError,
    textAlign: 'center' as const,
    width: FIGMA.layout.contentWidth, // 297 - Figma: FILL parent width
  },

  warningTextOutside: {
    color: FIGMA.colors.iconWarning,
  },

  // Wireframe grid lines positioned absolutely behind the card
  // Grid x=43.5, y=448. Card x=48, y=452.4. So Grid is offset left -4.5px, top -4.4px
  gridLineImage: {
    position: 'absolute',
    left: -4.5,
    top: -4.4,
    width: 306,
    height: 194.5,
    zIndex: -1, // Keep it behind the card
  },

  // Button container - button (node 1:30000)
  // Extraction: width 297, height 56
  buttonContainer: {
    width: FIGMA.layout.contentWidth, // 297
    marginTop: FIGMA.layout.buttonGap, // 40px itemSpacing from Frame 1686557268
  },
});
