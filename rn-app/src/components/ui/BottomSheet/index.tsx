import React, { useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { colors } from '@/src/theme';

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

const CustomBackdrop = ({ animatedIndex, style }: BottomSheetBackdropProps) => {
  // Use reanimated to animate blur intensity and overlay opacity based on sheet index
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [-1, 0],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const containerStyle = useMemo(
    () => [
      style,
      styles.backdropContainer,
      containerAnimatedStyle,
    ],
    [style, containerAnimatedStyle]
  );

  return (
    <Animated.View style={containerStyle} pointerEvents="auto">
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
    </Animated.View>
  );
};

export const BottomSheet = forwardRef<BottomSheetModal, CustomBottomSheetProps>(
  (
    {
      visible,
      onClose,
      children,
      enableDynamicSizing = true,
      snapPoints: providedSnapPoints,
      containerStyle,
      paddingHorizontal = 24,
      useSafeArea = true,
    },
    ref
  ) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();

    // Forward the ref so parent can control if needed, but primarily controlled by `visible`
    useImperativeHandle(ref, () => bottomSheetRef.current as BottomSheetModal);

    useEffect(() => {
      if (visible) {
        bottomSheetRef.current?.present();
      } else {
        bottomSheetRef.current?.dismiss();
      }
    }, [visible]);

    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index === -1) {
          onClose();
        }
      },
      [onClose]
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => <CustomBackdrop {...props} />,
      []
    );

    const defaultSnapPoints = useMemo(() => providedSnapPoints || ['25%', '50%'], [providedSnapPoints]);

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        index={0}
        snapPoints={enableDynamicSizing ? undefined : defaultSnapPoints}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        enableDynamicSizing={enableDynamicSizing}
        enableContentPanningGesture={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.backgroundStyle}
      >
        <BottomSheetView
          style={[
            styles.contentContainer,
            {
              paddingHorizontal,
              paddingBottom: useSafeArea ? Math.max(insets.bottom, 24) : 24,
            },
            containerStyle,
          ]}
        >
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  contentContainer: {
    width: '100%',
  },
  handleIndicator: {
    width: 48,
    height: 4,
    backgroundColor: colors.black[400], // #4D4D4D
    borderRadius: 200,
  },
  backgroundStyle: {
    backgroundColor: colors.black[600], // #1A1A1A
    borderRadius: 24,
  },
  backdropContainer: {
    ...StyleSheet.absoluteFillObject,
  },
});
