/**
 * About Screen
 * App info, version, terms, and privacy policy
 * Figma Reference: About/Legal screens
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

import { Screen, Text, Logo } from '@/src/components';
import { colors, spacing, radius, semanticColors } from '@/src/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber ?? '1';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const openLink = useCallback((url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url);
  }, []);

  const links = [
    {
      title: 'Terms of Service',
      icon: 'document-text-outline',
      url: 'https://flent.in/terms',
    },
    {
      title: 'Privacy Policy',
      icon: 'shield-outline',
      url: 'https://flent.in/privacy',
    },
    {
      title: 'Refund Policy',
      icon: 'refresh-outline',
      url: 'https://flent.in/refund',
    },
    {
      title: 'Visit Website',
      icon: 'globe-outline',
      url: 'https://flent.in',
    },
  ];

  return (
    <Screen testID="about-screen">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text variant="bodyMdMedium" color="primary">
            About
          </Text>
          <View style={styles.backButton} />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <View style={styles.logoContainer}>
            <Logo size={48} />
          </View>
          <Text variant="h5" color="primary">
            Flent Secured
          </Text>
          <Text variant="bodySm" color="muted">
            Version {APP_VERSION} ({BUILD_NUMBER})
          </Text>
        </View>

        {/* Tagline */}
        <View style={styles.taglineContainer}>
          <Text variant="bodyMd2" color="muted" align="center" style={styles.tagline}>
            Pay rent with credit card, earn rewards, and get your payments secured.
          </Text>
        </View>

        {/* Links */}
        <View style={styles.linksList}>
          {links.map((link) => (
            <TouchableOpacity
              key={link.title}
              style={styles.linkItem}
              onPress={() => openLink(link.url)}
            >
              <View style={styles.linkIcon}>
                <Ionicons
                  name={link.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={colors.brand[500]}
                />
              </View>
              <Text variant="bodyMdMedium" color="primary" style={styles.linkText}>
                {link.title}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Social Links */}
        <View style={styles.socialSection}>
          <Text variant="bodySm" color="muted" style={styles.socialTitle}>
            FOLLOW US
          </Text>
          <View style={styles.socialLinks}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => openLink('https://twitter.com/flent_in')}
            >
              <Ionicons name="logo-twitter" size={24} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => openLink('https://instagram.com/flent.in')}
            >
              <Ionicons name="logo-instagram" size={24} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => openLink('https://linkedin.com/company/flent')}
            >
              <Ionicons name="logo-linkedin" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Copyright */}
        <View style={styles.copyright}>
          <Text variant="bodySm" color="muted" align="center">
            © {new Date().getFullYear()} Flent Technologies Pvt. Ltd.
          </Text>
          <Text variant="bodySm" color="muted" align="center">
            Made with ❤️ in India
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  appInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.black[600],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  taglineContainer: {
    marginBottom: spacing.xl,
  },
  tagline: {
    lineHeight: 22,
  },
  linksList: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.black[600],
    borderRadius: radius.md,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.brand[500]}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  linkText: {
    flex: 1,
  },
  socialSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  socialTitle: {
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.black[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyright: {
    marginTop: 'auto',
    gap: spacing.xxs,
  },
});
