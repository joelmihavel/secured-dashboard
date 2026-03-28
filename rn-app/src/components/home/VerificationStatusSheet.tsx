/**
 * VerificationStatusSheet Component
 * Bottom sheet showing verification status details (Pending vs Verified).
 * Figma Reference: 4131:4877
 *
 * Shown when user taps the pending/verified status indicator.
 * Both cards are fully visible (informational) — no opacity differentiation.
 *
 * Layout:
 * - Handle: 48x4, #4D4D4D, r=200
 * - Content bg: #1A1A1A, gap=40
 *   - Title section: pad=48, gap=4
 *     - "What is your Status?" — Regular/28px/400, lh=40, ls=-1, #FFFFFF
 *     - "How you save on rent depends on this." — Regular/12px/400, lh=20, #878787
 *   - Cards section: pad=48, gap=16
 *     - Each card: gap=16
 *       - Header row: avatar(24x24) + "IF YOUR STATUS IS" label + icon + badge
 *       - Divider: stroke #4D4D4D
 *       - Body: title (14px/#CBCBCB) + description (12px/#878787)
 *   - CTA: PrimaryButton "Start saving on rent →" 14px/500/#FFFFFF
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/src/components/ui/Typography/Text';
import { colors } from '@/src/theme';

// ── Types ───────────────────────────────────────────────────────────────────

export interface VerificationStatusSheetProps {
  visible: boolean;
  onClose: () => void;
}

// ── Status Icons ────────────────────────────────────────────────────────────

/** Figma: rounded square + clock hand + dot, stroke #FF9A6D (matches chip icon) */
function PendingIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 2H8C10.4 2 11.7 2.31 12.45 3.55C13.19 4.29 13.5 5.6 13.5 8C13.5 10.4 13.19 11.71 12.45 12.45C11.7 13.19 10.4 13.5 8 13.5C5.6 13.5 4.29 13.19 3.55 12.45C2.81 11.71 2.5 10.4 2.5 8C2.5 5.6 2.81 4.29 3.55 3.55C4.29 2.81 5.6 2.5 8 2.5"
        stroke="#FF9A6D"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8 5.33V8" stroke="#FF9A6D" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 10.67H8.007" stroke="#FF9A6D" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function VerifiedIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2C11.314 2 14 4.686 14 8Z"
        stroke="#4CAF50"
        strokeWidth={1}
      />
      <Path
        d="M5.5 8L7 9.5L10.5 6"
        stroke="#4CAF50"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export function VerificationStatusSheet({
  visible,
  onClose,
}: VerificationStatusSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useSharedValue(SCREEN_HEIGHT);
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => handler.remove();
  }, [visible, onClose]);

  useEffect(() => {
    if (visible) {
      slideAnim.value = withSpring(0, {
        damping: 20,
        mass: 1,
        stiffness: 100,
        overshootClamping: true,
      });
      fadeAnim.value = withTiming(1, { duration: 250 });
    } else {
      slideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
      fadeAnim.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <BlurView style={StyleSheet.absoluteFill} intensity={8} tint="dark" />
          <TouchableOpacity
            style={styles.overlayTouchable}
            onPress={onClose}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
          ]}
        >
          {/* Handle — Figma: 48x4, #4D4D4D */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Scrollable Content — Figma: gap=40, scrolls under fixed CTA */}
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentInner}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Title Section — Figma: pad=48, gap=4, "Status" in #FF9A6D */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {'What is your '}
                <Text style={styles.titleAccent}>Status</Text>
                {'?'}
              </Text>
              <Text style={styles.subtitle}>
                How you save on rent depends on this.
              </Text>
            </View>

            {/* Status Cards — Figma: pad=48, gap=16 */}
            <View style={styles.cardsContainer}>
              {/* Pending Card */}
              <View style={styles.statusCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.avatar} />
                    <Text style={styles.cardLabel}>IF YOUR STATUS IS</Text>
                  </View>
                  <View style={styles.badgeRow}>
                    <PendingIcon />
                    <Text style={[styles.badgeText, { color: colors.brand[500] }]}>
                      Pending →
                    </Text>
                  </View>
                </View>
                <View style={styles.cardDivider} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>You're almost there.</Text>
                  <Text style={styles.cardDescription}>
                    Your cashback keeps building in the background, but it isn't
                    applied to your rent yet. Every 1% you earn stays accumulated
                    until you finish setup.
                  </Text>
                </View>
              </View>

              {/* Divider between sections — Figma: #4D4D4D, 0.25px */}
              <View style={styles.sectionDivider} />

              {/* Verified Card */}
              <View style={styles.statusCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.avatar} />
                    <Text style={styles.cardLabel}>IF YOUR STATUS IS</Text>
                  </View>
                  <View style={styles.badgeRow}>
                    <VerifiedIcon />
                    <Text style={[styles.badgeText, { color: colors.success.material }]}>
                      Verified →
                    </Text>
                  </View>
                </View>
                <View style={styles.cardDivider} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>You're fully set up</Text>
                  <Text style={styles.cardDescription}>
                    Now your cashback starts working for you. 1% of your rent is
                    automatically adjusted every month — less out of your pocket,
                    every time you pay.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 10,
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.black[600], // Figma: #1A1A1A
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    paddingTop: 15, // Figma: gap=15 between handle row and content
    zIndex: 20,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  handle: {
    width: 48, // Figma: 48px
    height: 4, // Figma: 4px
    backgroundColor: colors.black[400], // Figma: #4D4D4D
    borderRadius: 200, // Figma: r=200
  },
  // ScrollView replaces the old `content` View — allows scrolling under fixed CTA
  scrollContent: {
    flex: 1,
    maxHeight: Dimensions.get('window').height * 0.6, // Cap at ~60% screen height
  },
  scrollContentInner: {
    gap: 40, // Figma: Frame 1686557301 gap=40
    paddingBottom: 32, // Bottom spacing
  },
  // Title Section — Figma: Frame 1686557311, pad=48, gap=4
  header: {
    paddingHorizontal: 48, // Figma: pad l=48, r=48
    gap: 4, // Figma: gap=4
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: PlusJakartaSans-Regular, 400
    fontSize: 28, // Figma: 28px
    lineHeight: 40, // Figma: lh=40
    letterSpacing: -1, // Figma: ls=-1
    color: colors.white, // Figma: #FFFFFF
  },
  // Figma: "Status" word uses character override to #FF9A6D
  titleAccent: {
    color: colors.brand[500], // Figma: #FF9A6D
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: 400
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: lh=20
    color: colors.neutral[600], // Figma: #878787
  },
  // Cards Section — Figma: Frame 2095586365, pad=48, gap=16
  cardsContainer: {
    paddingHorizontal: 48, // Figma: pad l=48, r=48
    gap: 16, // Figma: gap=16
  },
  sectionDivider: {
    height: 0.25, // Figma: strokeWeight 0.25
    backgroundColor: colors.black[400], // Figma: #4D4D4D
  },
  // Status Card — Figma: Frame 2095586772/773, gap=16
  statusCard: {
    gap: 16, // Figma: gap=16
  },
  // Card Header — Figma: Frame 2095586771, HORIZONTAL, gap=8, cross=CENTER
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Figma: Frame 2095586769, gap=8
  },
  // Avatar — Figma: Ellipse 8, fill=#ffcc8a, 24x24
  avatar: {
    width: 24, // Figma: 24px (NOT 32)
    height: 24, // Figma: 24px
    borderRadius: 12, // Fully circular
    backgroundColor: colors.brand[300], // Figma: #FFCC8A
  },
  // Label — Figma: "IF YOUR STATUS IS", Medium/12px/500, #A9A9A9
  cardLabel: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: lh=20
    color: colors.neutral[500], // Figma: #A9A9A9
  },
  // Badge Row — Figma: Frame 2095586770, gap=4, cross=CENTER
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Figma: gap=4
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: lh=20
  },
  // Card Divider — Figma: Vector 50, stroke=#4d4d4d
  cardDivider: {
    height: 1, // Figma: 1px stroke weight
    backgroundColor: colors.black[400], // Figma: stroke #4D4D4D
  },
  // Card Body — Figma: Frame 1686557332, gap=4
  cardBody: {
    gap: 4, // Figma: gap=4
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: 400
    fontSize: 14, // Figma: 14px
    lineHeight: 20, // Figma: lh=20
    color: colors.neutral[300], // Figma: #CBCBCB
  },
  cardDescription: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: 400
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: lh=20
    color: colors.neutral[600], // Figma: #878787
  },
});
