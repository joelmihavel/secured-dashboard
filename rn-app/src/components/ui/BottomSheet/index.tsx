import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  Dimensions,
  Pressable,
  BackHandler,
  InteractionManager,
  Keyboard,
  Platform,
  AppState,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
  FadeIn,
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
}

export function BottomSheet({
  visible,
  onClose,
  children,
  containerStyle,
  paddingHorizontal = 24,
  useSafeArea = true,
}: CustomBottomSheetProps) {
  const insets = useSafeAreaInsets();

  const [mounted, setMounted] = useState(false);
  const isMountedRef = useRef(true);
  const isDismissingRef = useRef(false);
  const [blurKey, setBlurKey] = useState(0);

  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const dragY = useSharedValue(0);

  // Track component lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // JS-thread dismiss — NO 'worklet' directive.
  // withSpring/withTiming schedule on UI thread automatically.
  const dismiss = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;

    translateY.value = withSpring(SCREEN_HEIGHT, { ...SPRING_CONFIG, damping: 20 });
    backdropOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(setMounted)(false);
        runOnJS(onClose)();
      }
    });
  }, [translateY, backdropOpacity, onClose]);

  const present = useCallback(() => {
    isDismissingRef.current = false;
    translateY.value = SCREEN_HEIGHT;
    backdropOpacity.value = 0;
    setMounted(true);
    InteractionManager.runAfterInteractions(() => {
      if (!isMountedRef.current || isDismissingRef.current) return;
      translateY.value = withSpring(0, SPRING_CONFIG);
      backdropOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    });
  }, [translateY, backdropOpacity]);

  useEffect(() => {
    if (visible && !mounted) {
      present();
    } else if (!visible && mounted) {
      dismiss();
    }
  }, [visible, present, dismiss, mounted]);

  // Handle Android back button
  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [mounted, dismiss]);

  // Dismiss keyboard when app backgrounds to prevent stale keyboardHeight
  // shared value from useReanimatedKeyboardAnimation. Without this, returning
  // from background with a focused TextInput leaves the keyboard animation
  // mid-flight (Reanimated suspends animations in background), causing the
  // sheet maxHeight to be permanently reduced and the layout to freeze.
  // Also force BlurView re-render on resume (expo-blur UIVisualEffectView
  // can freeze after backgrounding).
  useEffect(() => {
    if (!mounted) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setBlurKey((k) => k + 1);
      } else {
        Keyboard.dismiss();
      }
    });
    return () => subscription.remove();
  }, [mounted]);

  // Pan gesture — onUpdate/onEnd run on UI thread (worklet context).
  // dismiss is a JS function, so call it via runOnJS from the gesture handler.
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
        // Delegate to JS-thread dismiss for single code path + isDismissingRef guard
        runOnJS(dismiss)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
        backdropOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    maxHeight: SCREEN_HEIGHT * 0.9 - Math.abs(keyboardHeight.value),
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleBackdropPress = useCallback(() => {
    Keyboard.dismiss();
    dismiss();
  }, [dismiss]);

  if (!mounted && !visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.container} pointerEvents="box-none">
        {/* Backdrop — BlurView at full opacity, parent opacity not animated */}
        <Animated.View style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress}>
            <BlurView key={blurKey} intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.backdropOverlay]} />
          </Pressable>
        </Animated.View>

        {/* KeyboardAvoidingView wraps the entire sheet so it moves upward when
            the keyboard opens, rather than just adding internal padding. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidOuter}
          pointerEvents="box-none"
        >
          {/* Sheet */}
          <Animated.View style={[styles.sheetContainer, sheetAnimatedStyle]}>
            {/* Drag handle */}
            <GestureDetector gesture={panGesture}>
              <Animated.View style={styles.handleArea}>
                <View style={styles.handleIndicator} />
              </Animated.View>
            </GestureDetector>

            {/* Content — fades in after sheet lands to prevent flash during slide-up */}
            <Animated.View
              style={[
                styles.contentContainer,
                {
                  paddingHorizontal,
                  paddingBottom: useSafeArea ? Math.max(insets.bottom, 24) : 24,
                },
                containerStyle,
              ]}
              entering={FadeIn.delay(200).duration(200)}
            >
              {children}
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
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
  keyboardAvoidOuter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  contentContainer: {
    width: '100%',
  },
});
