/**
 * Screen Picker - Development Only
 *
 * Navigate to any screen in the app for testing and parity work.
 * Only available when __DEV__ is true.
 *
 * Disable during parity testing by setting DISABLE_SCREEN_PICKER=true
 * in the app's entry point or via env flag.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography } from '@/src/theme';

// Set to true to bypass screen picker and use the normal journey flow.
// The floating DevNavigator FAB (with Jump buttons) is always available.
export const DISABLE_SCREEN_PICKER = true;

// Set to a route path to jump directly to that screen on launch (e.g. '/(auth)/splash')
// The app will boot straight to this screen, bypassing the screen picker.
// Set to null to use the normal screen picker flow.
export const DEV_DIRECT_SCREEN: string | null = null;

interface ScreenRoute {
  name: string;
  path: string;
  params?: Record<string, string>;
  figmaNode?: string;
  description?: string;
}

interface Section {
  label: string;
  icon: string;
  screens: ScreenRoute[];
}

const SECTIONS: Section[] = [
  {
    label: 'Auth',
    icon: 'A',
    screens: [
      { name: 'Splash', path: '/(auth)/splash', figmaNode: '1:28055' },
      { name: 'Beta Splash', path: '/(auth)/beta-splash', figmaNode: '1:28071' },
      { name: 'Carousel', path: '/(auth)/carousel', figmaNode: '1:28985' },
      { name: 'Sign Up', path: '/(auth)/sign-up', figmaNode: '1:29108' },
      { name: 'OTP Verification', path: '/(auth)/otp', figmaNode: '1:31175', description: 'Modal overlay on sign-up' },
    ],
  },
  {
    label: 'Home',
    icon: 'H',
    screens: [
      { name: 'Home Dashboard', path: '/(main)', figmaNode: '243:2762' },
      { name: 'Setup to Earn Cashback', path: '/(main)', params: { showSheet: 'cashback-setup' }, description: 'Verification check sheet modal' },
    ],
  },
  {
    label: 'Payment',
    icon: 'P',
    screens: [
      { name: 'Enter Rent', path: '/(payment)/enter-rent', description: 'Enter amount → select method → pay' },
      { name: 'Payment Success', path: '/(payment)/status', params: { initialStatus: 'success' }, description: 'Receipt card with paid stamp' },
      { name: 'Payment Pending', path: '/(payment)/status', params: { initialStatus: 'pending' }, description: 'Processing state with polling' },
      { name: 'Payment Failed', path: '/(payment)/status', params: { initialStatus: 'failed' }, description: 'Failed state with retry' },
      { name: 'Payment Refunded', path: '/(payment)/status', params: { initialStatus: 'refunded' }, description: 'Refunded state' },
    ],
  },
  {
    label: 'Profile',
    icon: 'U',
    screens: [
      { name: 'Profile Home', path: '/(profile)', figmaNode: '41:8760' },
      { name: 'Edit Profile', path: '/(profile)/edit' },
      { name: 'Agreement', path: '/(profile)/agreement' },
    ],
  },
  {
    label: 'Setup',
    icon: 'S',
    screens: [
      { name: 'Setup Dashboard', path: '/(setup)', figmaNode: '41:10712' },
      { name: 'Add Bank', path: '/(setup)/add-bank' },
      { name: 'Add Utility Bill', path: '/(setup)/add-utility' },
      { name: 'Invite Landlord', path: '/(setup)/invite-landlord' },
      { name: 'Pending Steps', path: '/(setup)/pending-steps' },
    ],
  },
  {
    label: 'Waitlist',
    icon: 'W',
    screens: [
      { name: 'Waitlist', path: '/(waitlist)', figmaNode: '41:11206' },
      { name: 'Approved', path: '/(waitlist)/approved' },
    ],
  },
  {
    label: 'Agreement',
    icon: 'D',
    screens: [
      { name: 'Upload Agreement', path: '/(agreement)/upload' },
      { name: 'Review Agreement', path: '/(agreement)/review' },
    ],
  },
];

const TOTAL_SCREENS = SECTIONS.reduce((sum, s) => sum + s.screens.length, 0);

export default function ScreenPickerScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFigmaNodes, setShowFigmaNodes] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    // All sections expanded by default
    const initial: Record<string, boolean> = {};
    SECTIONS.forEach(s => { initial[s.label] = true; });
    return initial;
  });

  const toggleSection = (label: string) => {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const collapseAll = () => {
    const collapsed: Record<string, boolean> = {};
    SECTIONS.forEach(s => { collapsed[s.label] = false; });
    setExpandedSections(collapsed);
  };

  const expandAll = () => {
    const expanded: Record<string, boolean> = {};
    SECTIONS.forEach(s => { expanded[s.label] = true; });
    setExpandedSections(expanded);
  };

  const navigateToScreen = (screen: ScreenRoute) => {
    if (screen.params) {
      router.push({ pathname: screen.path as any, params: screen.params });
    } else {
      router.push(screen.path as any);
    }
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SECTIONS;
    const q = searchQuery.toLowerCase();
    return SECTIONS.map(section => ({
      ...section,
      screens: section.screens.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.path.toLowerCase().includes(q) ||
          (s.figmaNode && s.figmaNode.includes(q)) ||
          section.label.toLowerCase().includes(q)
      ),
    })).filter(s => s.screens.length > 0);
  }, [searchQuery]);

  const filteredCount = filteredSections.reduce((sum, s) => sum + s.screens.length, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Screen Picker</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>DEV</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {filteredCount} screen{filteredCount !== 1 ? 's' : ''} across {filteredSections.length} group{filteredSections.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>S</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search screens, routes, or Figma nodes..."
            placeholderTextColor={colors.black[300]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Text style={styles.clearText}>X</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Figma IDs</Text>
          <Switch
            value={showFigmaNodes}
            onValueChange={setShowFigmaNodes}
            trackColor={{ false: colors.black[500], true: colors.brand[500] }}
            thumbColor={colors.white}
            style={styles.switch}
          />
        </View>
        <View style={styles.expandControls}>
          <TouchableOpacity onPress={expandAll} style={styles.expandButton}>
            <Text style={styles.expandText}>Expand All</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={collapseAll} style={styles.expandButton}>
            <Text style={styles.expandText}>Collapse</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filteredSections.map(section => (
          <View key={section.label} style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.label)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionLeft}>
                <View style={styles.sectionIcon}>
                  <Text style={styles.sectionIconText}>{section.icon}</Text>
                </View>
                <Text style={styles.sectionTitle}>{section.label}</Text>
              </View>
              <View style={styles.sectionRight}>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{section.screens.length}</Text>
                </View>
                <Text style={styles.chevron}>
                  {expandedSections[section.label] ? '\u25B2' : '\u25BC'}
                </Text>
              </View>
            </TouchableOpacity>

            {expandedSections[section.label] && (
              <View style={styles.screenList}>
                {section.screens.map((screen, index) => (
                  <TouchableOpacity
                    key={`${screen.path}-${index}`}
                    style={[
                      styles.screenItem,
                      index === section.screens.length - 1 && styles.screenItemLast,
                    ]}
                    onPress={() => navigateToScreen(screen)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.screenInfo}>
                      <Text style={styles.screenName}>{screen.name}</Text>
                      <Text style={styles.screenPath}>{screen.path}</Text>
                      {showFigmaNodes && screen.figmaNode && (
                        <Text style={styles.figmaNode}>Figma: {screen.figmaNode}</Text>
                      )}
                      {screen.description && (
                        <Text style={styles.screenDescription}>{screen.description}</Text>
                      )}
                    </View>
                    <Text style={styles.arrow}>{'\u203A'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {TOTAL_SCREENS} total screens registered
          </Text>
          <Text style={styles.footerHint}>
            Tip: Deep link from terminal with{'\n'}
            xcrun simctl openurl booted flentsecured:///(dev)/screen-picker
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black[700],
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  title: {
    ...typography.h2,
    color: colors.white,
  },
  badge: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    ...typography.bodySmMedium,
    color: colors.black[700],
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    letterSpacing: 1,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.black[300],
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.black[500],
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchIcon: {
    color: colors.black[300],
    fontSize: 14,
    marginRight: 8,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
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
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    ...typography.bodySm,
    color: colors.black[300],
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  expandControls: {
    flexDirection: 'row',
    gap: 8,
  },
  expandButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.black[500],
  },
  expandText: {
    ...typography.bodySm,
    color: colors.black[200],
    fontSize: 11,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginBottom: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.black[600],
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.black[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionIconText: {
    color: colors.brand[500],
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
  },
  sectionTitle: {
    ...typography.bodyMdMedium,
    color: colors.white,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: colors.black[500],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    ...typography.bodySm,
    color: colors.black[300],
    fontSize: 11,
  },
  chevron: {
    color: colors.black[300],
    fontSize: 10,
  },
  screenList: {
    paddingHorizontal: 20,
    backgroundColor: colors.black[700],
  },
  screenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingLeft: 38,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.black[500],
  },
  screenItemLast: {
    borderBottomWidth: 0,
  },
  screenInfo: {
    flex: 1,
  },
  screenName: {
    ...typography.bodyMdMedium,
    color: colors.white,
    marginBottom: 2,
  },
  screenPath: {
    ...typography.bodySm,
    color: colors.black[300],
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
  },
  figmaNode: {
    ...typography.bodySm,
    color: colors.brand[500],
    fontSize: 11,
    marginTop: 2,
  },
  screenDescription: {
    ...typography.bodySm,
    color: colors.black[300],
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  arrow: {
    color: colors.black[300],
    fontSize: 22,
    fontFamily: 'PlusJakartaSans-Light',
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    ...typography.bodySm,
    color: colors.black[400],
    marginBottom: 8,
  },
  footerHint: {
    ...typography.bodySm,
    color: colors.black[400],
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans-Regular',
  },
});
