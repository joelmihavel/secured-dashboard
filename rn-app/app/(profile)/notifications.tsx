/**
 * Notification Settings Screen
 * Manage push and SMS notification preferences
 * Figma Reference: Notification settings
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text } from '@/src/components';
import { colors, spacing, radius, semanticColors } from '@/src/theme';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'payment_reminders',
      title: 'Payment Reminders',
      description: 'Get reminded before rent is due',
      enabled: true,
    },
    {
      id: 'payment_success',
      title: 'Payment Confirmations',
      description: 'Notification when payment succeeds',
      enabled: true,
    },
    {
      id: 'cashback_earned',
      title: 'Cashback Alerts',
      description: 'When you earn or can redeem cashback',
      enabled: true,
    },
    {
      id: 'landlord_updates',
      title: 'Landlord Updates',
      description: 'When landlord verifies or updates details',
      enabled: true,
    },
    {
      id: 'promotional',
      title: 'Offers & Promotions',
      description: 'Special offers and new features',
      enabled: false,
    },
  ]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const toggleSetting = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    // TODO: Save to backend
  }, []);

  return (
    <Screen testID="notification-settings-screen">
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
            Notifications
          </Text>
          <View style={styles.backButton} />
        </View>

        {/* Description */}
        <Text variant="bodyMd2" color="muted" style={styles.description}>
          Choose which notifications you'd like to receive
        </Text>

        {/* Settings List */}
        <View style={styles.settingsList}>
          {settings.map((setting) => (
            <View key={setting.id} style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text variant="bodyMdMedium" color="primary">
                  {setting.title}
                </Text>
                <Text variant="bodySm" color="muted">
                  {setting.description}
                </Text>
              </View>
              <Switch
                value={setting.enabled}
                onValueChange={() => toggleSetting(setting.id)}
                trackColor={{ false: colors.black[400], true: `${colors.success.default}80` }}
                thumbColor={setting.enabled ? colors.success.default : colors.neutral[500]}
              />
            </View>
          ))}
        </View>

        {/* SMS Settings */}
        <View style={styles.section}>
          <Text variant="bodySm" color="muted" style={styles.sectionTitle}>
            SMS NOTIFICATIONS
          </Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text variant="bodyMdMedium" color="primary">
                SMS Alerts
              </Text>
              <Text variant="bodySm" color="muted">
                Receive important updates via SMS
              </Text>
            </View>
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: colors.black[400], true: `${colors.success.default}80` }}
              thumbColor={colors.success.default}
            />
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.neutral[500]} />
          <Text variant="bodySm" color="muted" style={styles.infoText}>
            Critical payment and security notifications cannot be disabled
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
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  description: {
    marginBottom: spacing.xl,
  },
  settingsList: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.black[600],
    borderRadius: radius.md,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
    gap: 2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.black[600],
    borderRadius: radius.md,
  },
  infoText: {
    flex: 1,
    lineHeight: 20,
  },
});
