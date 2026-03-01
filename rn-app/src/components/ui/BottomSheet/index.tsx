import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  Dimensions,
  Pressable,
  BackHandler,
  Keyboard,
  AppState,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors } from '@/src/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPRING_CONFIG = {
  damping: 28,
  stiffness: 300,
  mass: 0.8,
};

const DISMISS_THRESHOLD = 100;

export interface CustomBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  enableDynamicSizing?: boolean;
  snapPoints?: (string | number)[];
  containerStyle?: StyleProp<ViewStyle>;
  paddingHorizontal?: number;
  useSafeArea?: boolean;
  /** Called on Android hardware back press instead of dismissing. If not provided, sheet dismisses. */
  onBackPress?: () => void;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  containerStyle,
  paddingHorizontal = 24,
  useSafeArea = true,
  onBackPress,
}: CustomBottomSheetProps) {
  const insets = useSafeAreaInsets();

  const [mounted, setMounted] = useState(false);
  const isMountedRef = useRef(true);
  const isDismissingRef = useRef(false);
  const isKeyboardVisibleRef = useRef(false);
  const [blurIntensity, setBlurIntensity] = useState(20);

  // Single keyboard tracking — replaces both KeyboardAvoidingView and
  // useReanimatedKeyboardAnimation to eliminate the double-avoidance problem.
  // onMove gives frame-by-frame keyboard height on both platforms.
  const keyboardOffset = useSharedValue(0);

  const setKeyboardVisible = useCallback((v: boolean) => {
    isKeyboardVisibleRef.current = v;
  }, []);

  useKeyboardHandler({
    onMove: (e) => {
      'worklet';
      keyboardOffset.value = e.height;
    },
    onEnd: (e) => {
      'worklet';
      keyboardOffset.value = e.height;
      runOnJS(setKeyboardVisible)(e.height > 0);
    },
  }, [setKeyboardVisible]);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const dragY = useSharedValue(0);
  const hasPresented = useSharedValue(0);

  // Track component lifecycle + cancel in-flight animations on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cancelAnimation(translateY);
      cancelAnimation(backdropOpacity);
      cancelAnimation(dragY);
    };
  }, [translateY, backdropOpacity, dragY]);

  // Dismiss — completion fires after the spring finishes (not the backdrop
  // timing), so the sheet fully exits before unmounting. Fixes the visual cut
  // where the old timing callback fired at 200ms but the spring took ~350ms.
  const dismiss = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;

    backdropOpacity.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.ease) });
    translateY.value = withSpring(SCREEN_HEIGHT, { ...SPRING_CONFIG, damping: 20 }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(setMounted)(false);
        runOnJS(onClose)();
      }
    });
  }, [translateY, backdropOpacity, onClose]);

  // Present — single rAF delay for layout to settle, then animate.
  // Replaces InteractionManager.runAfterInteractions which added 300-500ms.
  const present = useCallback(() => {
    isDismissingRef.current = false;
    cancelAnimation(translateY);
    cancelAnimation(backdropOpacity);
    translateY.value = SCREEN_HEIGHT;
    backdropOpacity.value = 0;
    hasPresented.value = 0;
    setMounted(true);
    requestAnimationFrame(() => {
      if (!isMountedRef.current || isDismissingRef.current) return;
      translateY.value = withSpring(0, SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    });
  }, [translateY, backdropOpacity, hasPresented]);

  useEffect(() => {
    if (visible && !mounted) {
      present();
    } else if (!visible && mounted) {
      dismiss();
    }
  }, [visible, present, dismiss, mounted]);

  // Android back: dismiss keyboard first if open, then sheet on next press
  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isKeyboardVisibleRef.current) {
        Keyboard.dismiss();
        return true;
      }
      if (onBackPress) {
        onBackPress();
        return true;
      }
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [mounted, dismiss]);

  // Dismiss keyboard on background to prevent stale keyboardOffset shared
  // value (Reanimated suspends worklet animations in background). Fix BlurView
  // freeze by toggling intensity instead of remounting (avoids visible flash).
  useEffect(() => {
    if (!mounted) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setBlurIntensity(0);
        requestAnimationFrame(() => setBlurIntensity(20));
      } else {
        Keyboard.dismiss();
      }
    });
    return () => subscription.remove();
  }, [mounted]);

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      dragY.value = 0;
    })
    .onUpdate((event) => {
      'worklet';
      dragY.value = Math.max(0, event.translationY);
      translateY.value = Math.max(0, event.translationY);
      const progress = Math.max(0, 1 - event.translationY / (SCREEN_HEIGHT * 0.4));
      backdropOpacity.value = progress;
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
        runOnJS(Keyboard.dismiss)();
        runOnJS(dismiss)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
        backdropOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  // Sheet position: translateY for slide/drag, marginBottom pushes sheet
  // above keyboard in the flex-end container, maxHeight caps sheet size
  // to prevent overflow. Single source of truth — no KeyboardAvoidingView.
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    maxHeight: SCREEN_HEIGHT * 0.9 - keyboardOffset.value,
    marginBottom: keyboardOffset.value,
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Content opacity derived from spring progress — replaces FadeIn.delay(200).
  // Fades in as sheet slides up (30-70% progress), then stays at 1 after
  // presentation completes (so drag/keyboard changes don't re-fade).
  const contentOpacity = useDerivedValue(() => {
    if (hasPresented.value === 1) return 1;
    const progress = 1 - (translateY.value / SCREEN_HEIGHT);
    if (progress >= 0.7) {
      hasPresented.value = 1;
      return 1;
    }
    return interpolate(progress, [0.3, 0.7], [0, 1], Extrapolation.CLAMP);
  });

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const handleBackdropPress = useCallback(() => {
    Keyboard.dismiss();
    dismiss();
  }, [dismiss]);

  if (!mounted && !visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.container} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress}>
            <BlurView intensity={blurIntensity} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.backdropOverlay]} />
          </Pressable>
        </Animated.View>

        {/* Sheet — keyboard offset via marginBottom, no KeyboardAvoidingView */}
        <View style={styles.sheetOuter} pointerEvents="box-none">
          <Animated.View style={[styles.sheetContainer, sheetAnimatedStyle]}>
            {/* Drag handle */}
            <GestureDetector gesture={panGesture}>
              <Animated.View style={styles.handleArea}>
                <View style={styles.handleIndicator} />
              </Animated.View>
            </GestureDetector>

            {/* Content — opacity synced with spring progress */}
            <Animated.View
              style={[
                styles.contentContainer,
                {
                  paddingHorizontal,
                  paddingBottom: useSafeArea ? Math.max(insets.bottom, 24) : 24,
                },
                containerStyle,
                contentAnimatedStyle,
              ]}
            >
              {children}
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  container: {
    flex: 1,
  },
  backdropOverlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetOuter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.black[600], // #1A1A1A
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleIndicator: {
    width: 48,
    height: 4,
    backgroundColor: colors.black[400], // #4D4D4D
    borderRadius: 200,
  },
  contentContainer: {
    width: '100%',
    flexShrink: 1,
  },
});
