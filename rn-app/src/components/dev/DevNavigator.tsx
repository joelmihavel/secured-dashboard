/**
 * DevNavigator — Floating Dev Navigation Overlay
 *
 * DEV mode only. Provides a draggable FAB + bottom sheet for quick
 * navigation to any screen in the app without leaving the current context.
 *
 * Rendered in _layout.tsx OUTSIDE the Stack as a sibling overlay.
 * Set HIDE_DEV_NAV = true to hide for parity screenshots.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography } from '@/src/theme';

// Set to true to hide the FAB (e.g. for parity screenshots)
export const HIDE_DEV_NAV = false;

interface ScreenRoute {
  name: string;
  path: string;
  section: string;
}

interface Section {
  label: string;
  screens: { name: string; path: string }[];
}

const SECTIONS: Section[] = [
  {
    label: 'Auth',
    screens: [
      { name: 'Splash', path: '/(auth)/splash' },
      { name: 'Beta Splash', path: '/(auth)/beta-splash' },
      { name: 'Carousel', path: '/(auth)/carousel' },
      { name: 'Sign Up', path: '/(auth)/sign-up' },
      { name: 'OTP Verification', path: '/(auth)/otp' },
    ],
  },
  {
    label: 'Home',
    screens: [{ name: 'Home Dashboard', path: '/(main)' }],
  },
  {
    label: 'Payment',
    screens: [
      { name: 'First Rent', path: '/(payment)/first-rent' },
      { name: 'Confirm Payment', path: '/(payment)/confirm' },
      { name: 'Payment Status', path: '/(payment)/status' },
    ],
  },
  {
    label: 'Profile',
    screens: [
      { name: 'Profile Home', path: '/(profile)' },
      { name: 'Edit Profile', path: '/(profile)/edit' },
      { name: 'Payment Methods', path: '/(profile)/payment-methods' },
      { name: 'Agreement', path: '/(profile)/agreement' },
    ],
  },
  {
    label: 'Setup',
    screens: [
      { name: 'Setup Dashboard', path: '/(setup)' },
      { name: 'Add Bank', path: '/(setup)/add-bank' },
      { name: 'Add Utility Bill', path: '/(setup)/add-utility' },
      { name: 'Invite Landlord', path: '/(setup)/invite-landlord' },
      { name: 'Pending Steps', path: '/(setup)/pending-steps' },
    ],
  },
  {
    label: 'Waitlist',
    screens: [
      { name: 'Waitlist', path: '/(waitlist)' },
      { name: 'Approved', path: '/(waitlist)/approved' },
    ],
  },
  {
    label: 'Agreement',
    screens: [
      { name: 'Upload Agreement', path: '/(agreement)/upload' },
      { name: 'Review Agreement', path: '/(agreement)/review' },
      { name: 'Agreement Success', path: '/(agreement)/success' },
    ],
  },
];

// Flatten sections into a searchable list
const ALL_ROUTES: ScreenRoute[] = SECTIONS.flatMap(section =>
  section.screens.map(screen => ({
    ...screen,
    section: section.label,
  }))
);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function DevNavigator() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  if (HIDE_DEV_NAV) return null;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.extractOffset();
      },
    })
  ).current;

  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return ALL_ROUTES;
    const q = searchQuery.toLowerCase();
    return ALL_ROUTES.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const navigateTo = (path: string) => {
    setIsOpen(false);
    setSearchQuery('');
    router.push(path as never);
  };

  const renderItem = ({ item }: { item: ScreenRoute }) => (
    <TouchableOpacity
      style={styles.routeItem}
      onPress={() => navigateTo(item.path)}
      activeOpacity={0.6}
    >
      <View style={styles.routeInfo}>
        <Text style={styles.routeName}>{item.name}</Text>
        <Text style={styles.routePath}>{item.path}</Text>
      </View>
      <Text style={styles.routeSection}>{item.section}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Draggable FAB */}
      <Animated.View
        style={[
          styles.fab,
          { transform: pan.getTranslateTransform() },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => setIsOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>D</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom Sheet Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Dev Navigator</Text>
            <Text style={styles.sheetCount}>{filteredRoutes.length} screens</Text>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search screens..."
              placeholderTextColor={colors.black[300]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Text style={styles.clearText}>X</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Route List */}
          <FlatList
            data={filteredRoutes}
            keyExtractor={item => item.path}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />

        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    zIndex: 9999,
  },
  fabButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: colors.black[700],
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: colors.black[600],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.black[400],
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.white,
  },
  sheetCount: {
    ...typography.bodySm,
    color: colors.black[300],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.black[500],
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: colors.white,
    ...typography.bodyMdMedium,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  clearText: {
    color: colors.black[300],
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  routeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.black[500],
  },
  routeInfo: {
    flex: 1,
    marginRight: 12,
  },
  routeName: {
    ...typography.bodyMdMedium,
    color: colors.white,
    marginBottom: 2,
  },
  routePath: {
    ...typography.bodySm,
    color: colors.black[300],
    fontSize: 12,
  },
  routeSection: {
    ...typography.bodySm,
    color: colors.brand[500],
    fontSize: 11,
  },
});
