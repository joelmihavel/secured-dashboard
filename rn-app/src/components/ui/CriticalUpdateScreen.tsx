/**
 * CriticalUpdateScreen
 *
 * Full-screen blocking UI for critical updates. Two modes:
 *
 * 1. **Native** (`type === 'native'`): Directs the user to the App Store / Play Store.
 *    No dismiss, no back — dead end until the user updates the binary.
 *
 * 2. **OTA** (`type === 'ota'`): Runs an automatic expo-updates flow
 *    (check -> download -> apply -> reload). Shows progress states
 *    with retry logic (max 3). Falls back to "Contact support" on
 *    exhausted retries.
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { Screen } from '@/src/components/ui/Layout/Screen';
import { Logo } from '@/src/components/ui/Layout/Logo';
import { PrimaryButton } from '@/src/components/ui/Button/PrimaryButton';
import { DottedGridPattern } from '@/src/components/patterns/DottedGridPattern';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';
import { reloadApp } from '@/src/config/updates';

// ==============================================
// TYPES
// ==============================================

interface CriticalUpdateScreenProps {
  policy: {
    type: 'native' | 'ota';
    title: string | null;
    message: string | null;
    minAppVersion: string | null;
  };
  onDismiss?: () => void;
}

type OTAState = 'checking' | 'downloading' | 'applying' | 'error' | 'not_needed';

// ==============================================
// CONSTANTS
// ==============================================

const STORE_URLS = {
  ios: 'https://apps.apple.com/app/id6757275258',
  android: 'https://play.google.com/store/apps/details?id=in.flent.secured',
} as const;

const MAX_RETRIES = 3;
const SUPPORT_EMAIL = 'secured@flent.in';

// ==============================================
// SUB-COMPONENTS
// ==============================================

/** Indeterminate progress bar with a shimmer animation */
const IndeterminateProgressBar = memo(function IndeterminateProgressBar() {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(translateX);
    };
  }, [translateX]);

  const fillStyle = useAnimatedStyle(() => {
    // Translate -1..1 maps to 0%..60% left offset, with a 40% wide bar
    const left = ((translateX.value + 1) / 2) * 60;
    return {
      position: 'absolute' as const,
      left: `${left}%`,
      width: '40%',
      height: '100%',
      backgroundColor: colors.brand[500],
      borderRadius: 2,
    };
  });

  return (
    <View style={progressStyles.track}>
      <Animated.View style={fillStyle} />
    </View>
  );
});

const progressStyles = StyleSheet.create({
  track: {
    width: '100%',
    height: 4,
    backgroundColor: '#4D4D4D',
    borderRadius: 2,
    overflow: 'hidden',
  },
});

// ==============================================
// UPDATE ILLUSTRATION — Shield with arrow
// ==============================================

const UpdateIllustration = memo(function UpdateIllustration() {
  return (
    <View style={illustrationStyles.container}>
      {/* Outer glow circle */}
      <View style={illustrationStyles.glowOuter}>
        <View style={illustrationStyles.glowInner}>
          <Svg width={s(64)} height={sv(72)} viewBox="0 0 64 72" fill="none">
            <Defs>
              <LinearGradient id="shieldGrad" x1="32" y1="0" x2="32" y2="72" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#FF9A6D" stopOpacity="0.9" />
                <Stop offset="1" stopColor="#CC7B57" stopOpacity="0.7" />
              </LinearGradient>
            </Defs>
            {/* Shield body */}
            <Path
              d="M32 2L4 14V33C4 50.7 16.1 67.1 32 72C47.9 67.1 60 50.7 60 33V14L32 2Z"
              fill="url(#shieldGrad)"
              opacity={0.15}
            />
            <Path
              d="M32 2L4 14V33C4 50.7 16.1 67.1 32 72C47.9 67.1 60 50.7 60 33V14L32 2Z"
              stroke="#FF9A6D"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            {/* Arrow pointing up (update symbol) */}
            <Path
              d="M32 50V26"
              stroke="#FF9A6D"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <Path
              d="M24 34L32 26L40 34"
              stroke="#FF9A6D"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </View>
    </View>
  );
});

const illustrationStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: sv(40),
    marginBottom: sv(8),
  },
  glowOuter: {
    width: s(120),
    height: s(120),
    borderRadius: s(60),
    backgroundColor: 'rgba(255, 154, 109, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowInner: {
    width: s(96),
    height: s(96),
    borderRadius: s(48),
    backgroundColor: 'rgba(255, 154, 109, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ==============================================
// NATIVE UPDATE MODE
// ==============================================

interface NativeModeProps {
  title: string;
  message: string;
  minAppVersion: string | null;
}

const NativeMode = memo(function NativeMode({ title, message, minAppVersion }: NativeModeProps) {
  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';

  const handleUpdate = useCallback(() => {
    const url = Platform.select(STORE_URLS);
    if (url) {
      Linking.openURL(url);
    }
  }, []);

  return (
    <>
      <View style={styles.textContainer}>
        <Animated.Text style={styles.title}>{title}</Animated.Text>
        <Animated.Text style={styles.message}>{message}</Animated.Text>
      </View>

      <View style={styles.ctaContainer}>
        <PrimaryButton
          title="Update now"
          onPress={handleUpdate}
          testID="critical-update-native-button"
        />
        {minAppVersion && (
          <Animated.Text style={styles.versionFooter}>
            v{currentVersion} {'→'} v{minAppVersion}
          </Animated.Text>
        )}
      </View>
    </>
  );
});

// ==============================================
// OTA UPDATE MODE
// ==============================================

interface OTAModeProps {
  title: string;
  message: string;
  onDismiss?: () => void;
}

const OTAMode = memo(function OTAMode({ title, message, onDismiss }: OTAModeProps) {
  const [otaState, setOtaState] = useState<OTAState>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const retryCountRef = useRef(0);

  const runOtaFlow = useCallback(async () => {
    setOtaState('checking');
    setErrorMessage(null);

    try {
      // Step 1: Check for updates
      const checkResult = await Updates.checkForUpdateAsync();

      if (!checkResult.isAvailable) {
        setOtaState('not_needed');
        onDismiss?.();
        return;
      }

      // Step 2: Download update
      setOtaState('downloading');
      await Updates.fetchUpdateAsync();

      // Step 3: Apply update
      setOtaState('applying');
      await reloadApp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMessage(msg);
      setOtaState('error');
    }
  }, [onDismiss]);

  // Auto-start OTA flow on mount
  useEffect(() => {
    runOtaFlow();
  }, [runOtaFlow]);

  const handleRetry = useCallback(() => {
    retryCountRef.current += 1;
    runOtaFlow();
  }, [runOtaFlow]);

  const handleContactSupport = useCallback(() => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=App%20Update%20Issue`);
  }, []);

  // Derive display text based on OTA state
  const stateTitle = otaState === 'error' ? 'Update failed' : title;

  const stateMessage = (() => {
    switch (otaState) {
      case 'checking':
        return 'Checking for updates...';
      case 'downloading':
        return 'Downloading update...';
      case 'applying':
        return 'Applying update...';
      case 'error':
        return errorMessage ?? 'Something went wrong. Please try again.';
      case 'not_needed':
        return message;
      default:
        return message;
    }
  })();

  const showSpinner = otaState === 'checking' || otaState === 'applying';
  const showProgress = otaState === 'downloading';
  const showRetry = otaState === 'error' && retryCountRef.current < MAX_RETRIES;
  const showContactSupport = otaState === 'error' && retryCountRef.current >= MAX_RETRIES;

  return (
    <>
      <View style={styles.textContainer}>
        <Animated.Text style={styles.title}>{stateTitle}</Animated.Text>
        <Animated.Text style={styles.message}>{stateMessage}</Animated.Text>
      </View>

      <View style={styles.ctaContainer}>
        {showSpinner && (
          <ActivityIndicator
            color={colors.brand[500]}
            size="small"
            style={styles.spinner}
          />
        )}

        {showProgress && (
          <View style={styles.progressContainer}>
            <IndeterminateProgressBar />
          </View>
        )}

        {showRetry && (
          <PrimaryButton
            title="Try again"
            onPress={handleRetry}
            testID="critical-update-retry-button"
          />
        )}

        {showContactSupport && (
          <PrimaryButton
            title="Contact support"
            onPress={handleContactSupport}
            testID="critical-update-support-button"
          />
        )}
      </View>
    </>
  );
});

// ==============================================
// MAIN COMPONENT
// ==============================================

function CriticalUpdateScreenComponent({ policy, onDismiss }: CriticalUpdateScreenProps) {
  const { type, title, message, minAppVersion } = policy;

  // Block Android back button — this screen is a dead end
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => handler.remove();
  }, []);

  // Derive display title and message with defaults
  const displayTitle = title ?? (type === 'native' ? 'Update required' : 'Updating...');
  const displayMessage =
    message ??
    (type === 'native'
      ? 'A new version of Flent Secured is available. Please update to continue using the app.'
      : 'Please wait while we update the app.');

  return (
    <Screen testID="critical-update-screen" padded={false}>
      <DottedGridPattern />

      <View style={styles.container}>
        <View style={styles.content}>
          <Logo size={64} />

          <UpdateIllustration />

          {type === 'native' ? (
            <NativeMode
              title={displayTitle}
              message={displayMessage}
              minAppVersion={minAppVersion}
            />
          ) : (
            <OTAMode
              title={displayTitle}
              message={displayMessage}
              onDismiss={onDismiss}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(32),
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: sv(16),
    maxWidth: s(280),
  },
  title: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: sf(20),
    lineHeight: sf(28),
    color: colors.white,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: colors.neutral[500], // #A9A9A9
    textAlign: 'center',
    marginTop: sv(8),
  },
  ctaContainer: {
    width: '100%',
    marginTop: sv(32),
    alignItems: 'center',
  },
  versionFooter: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(16),
    color: colors.neutral[600], // #878787
    textAlign: 'center',
    marginTop: sv(12),
  },
  spinner: {
    marginBottom: sv(8),
  },
  progressContainer: {
    width: '100%',
    paddingHorizontal: s(24),
  },
});

export const CriticalUpdateScreen = memo(CriticalUpdateScreenComponent);
