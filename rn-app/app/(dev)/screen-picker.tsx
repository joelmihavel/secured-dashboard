/**
 * Screen Picker - Development Only
 * Navigate to any screen for visual parity testing
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography } from '@/src/theme';

interface ScreenRoute {
  name: string;
  path: string;
  state?: string;
}

const SCREEN_ROUTES: Record<string, ScreenRoute[]> = {
  'Auth': [
    { name: 'Beta Splash', path: '/(auth)/beta-splash' },
    { name: 'Splash (Get Started)', path: '/(auth)/splash' },
    { name: 'Carousel Page 1', path: '/(auth)/carousel', state: 'page=1' },
    { name: 'Carousel Page 2', path: '/(auth)/carousel', state: 'page=2' },
    { name: 'Carousel Page 3', path: '/(auth)/carousel', state: 'page=3' },
    { name: 'Sign Up (Empty)', path: '/(auth)/sign-up', state: 'state=empty' },
    { name: 'Sign Up (Filled)', path: '/(auth)/sign-up', state: 'state=filled' },
    { name: 'OTP (Empty)', path: '/(auth)/otp', state: 'state=empty' },
    { name: 'OTP (Filled)', path: '/(auth)/otp', state: 'state=filled' },
    { name: 'OTP (Error 1)', path: '/(auth)/otp', state: 'state=error1' },
    { name: 'OTP (Error 2)', path: '/(auth)/otp', state: 'state=error2' },
  ],
  'Waitlist': [
    { name: 'Pending', path: '/(waitlist)/index', state: 'state=pending' },
    { name: 'Accepted', path: '/(waitlist)/index', state: 'state=accepted' },
    { name: 'Rejected', path: '/(waitlist)/index', state: 'state=rejected' },
    { name: '24hrs+', path: '/(waitlist)/index', state: 'state=pending_long' },
    { name: 'Referral', path: '/(waitlist)/index', state: 'state=referral' },
    { name: 'Referral Invalid', path: '/(waitlist)/index', state: 'state=referral_invalid' },
  ],
  'Agreement': [
    { name: 'Upload (Idle)', path: '/(agreement)/upload', state: 'state=idle' },
    { name: 'Upload (Uploading)', path: '/(agreement)/upload', state: 'state=uploading' },
    { name: 'Upload (Expired)', path: '/(agreement)/upload', state: 'state=expired' },
    { name: 'Upload (Too Large)', path: '/(agreement)/upload', state: 'state=too-large' },
    { name: 'Upload (Manual Review)', path: '/(agreement)/upload', state: 'state=manual-review' },
    { name: 'Review (Verify)', path: '/(agreement)/review', state: 'state=verify' },
    { name: 'Review (Modify)', path: '/(agreement)/review', state: 'state=modify' },
  ],
  'Setup': [
    { name: 'Post Approval Step 1', path: '/(setup)/index', state: 'step=1' },
    { name: 'Post Approval Step 2', path: '/(setup)/index', state: 'step=2' },
    { name: 'Post Approval Step 3', path: '/(setup)/index', state: 'step=3' },
    { name: 'Add Bank', path: '/(setup)/add-bank' },
    { name: 'Add Utility (Empty)', path: '/(setup)/add-utility', state: 'state=empty' },
    { name: 'Add Utility (Filled)', path: '/(setup)/add-utility', state: 'state=filled' },
    { name: 'Invite Landlord', path: '/(setup)/invite-landlord' },
  ],
  'Home': [
    { name: 'Home (Empty State)', path: '/(main)/index', state: 'state=empty' },
    { name: 'Home (Setup Payment)', path: '/(main)/index', state: 'state=setup-payment' },
    { name: 'Home (Active)', path: '/(main)/index', state: 'state=active' },
    { name: 'Home (Late Payment)', path: '/(main)/index', state: 'state=late' },
    { name: 'Home (Missed Payment)', path: '/(main)/index', state: 'state=missed' },
  ],
  'Payment': [
    { name: 'Payment Methods', path: '/(payment)/methods' },
    { name: 'Payment Initiate', path: '/(payment)/initiate' },
    { name: 'Payment Processing', path: '/(payment)/processing' },
    { name: 'Payment Success', path: '/(payment)/success' },
    { name: 'Payment Failed', path: '/(payment)/failed' },
  ],
  'Profile': [
    { name: 'Profile', path: '/(profile)/index' },
    { name: 'Personal Details', path: '/(profile)/personal-details' },
    { name: 'Tenancy Details', path: '/(profile)/tenancy-details' },
    { name: 'Settings', path: '/(profile)/settings' },
    { name: 'Help', path: '/(profile)/help' },
    { name: 'About', path: '/(profile)/about' },
  ],
  'Transactions': [
    { name: 'Transaction History', path: '/(transactions)/index' },
    { name: 'Transaction Detail', path: '/(transactions)/[id]' },
  ],
};

export default function ScreenPickerScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Auth: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const navigateToScreen = (screen: ScreenRoute) => {
    const fullPath = screen.state ? `${screen.path}?${screen.state}` : screen.path;
    router.push(fullPath as any);
  };

  const filteredRoutes = Object.entries(SCREEN_ROUTES).reduce(
    (acc, [section, screens]) => {
      if (!searchQuery) {
        acc[section] = screens;
        return acc;
      }
      const filtered = screens.filter(
        s =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.path.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[section] = filtered;
      }
      return acc;
    },
    {} as Record<string, ScreenRoute[]>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Screen Picker</Text>
        <Text style={styles.subtitle}>Navigate to any screen for testing</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search screens..."
          placeholderTextColor={colors.black[300]}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {Object.entries(filteredRoutes).map(([section, screens]) => (
          <View key={section} style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section)}
            >
              <Text style={styles.sectionTitle}>{section}</Text>
              <Text style={styles.sectionCount}>{screens.length}</Text>
            </TouchableOpacity>

            {expandedSections[section] && (
              <View style={styles.screenList}>
                {screens.map((screen, index) => (
                  <TouchableOpacity
                    key={`${screen.path}-${index}`}
                    style={styles.screenItem}
                    onPress={() => navigateToScreen(screen)}
                  >
                    <Text style={styles.screenName}>{screen.name}</Text>
                    <Text style={styles.screenPath}>
                      {screen.path}
                      {screen.state ? `?${screen.state}` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
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
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.bodyMdMedium,
    color: colors.black[300],
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: colors.black[500],
    borderRadius: 12,
    padding: 14,
    color: colors.white,
    ...typography.bodyMdMedium,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.black[600],
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.white,
  },
  sectionCount: {
    ...typography.bodySm,
    color: colors.black[300],
    backgroundColor: colors.black[500],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  screenList: {
    paddingHorizontal: 20,
  },
  screenItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.black[500],
  },
  screenName: {
    ...typography.bodyMdMedium,
    color: colors.white,
    marginBottom: 4,
  },
  screenPath: {
    ...typography.bodySm,
    color: colors.black[300],
    fontFamily: 'monospace',
  },
});
