/**
 * Help & Support Screen
 * FAQ and contact support options
 * Figma Reference: Help/Support screens
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text } from '@/src/components';
import { colors, spacing, radius, semanticColors } from '@/src/theme';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: '1',
    question: 'How do I pay rent using Flent?',
    answer:
      'Upload your rental agreement, add a payment method (UPI, Card, or Net Banking), and pay your rent. The amount will be deposited directly to your landlord\'s verified bank account.',
  },
  {
    id: '2',
    question: 'Is my payment information secure?',
    answer:
      'Yes, we use bank-grade encryption and are PCI-DSS compliant. Your card details are never stored on our servers - they are securely processed by PayU.',
  },
  {
    id: '3',
    question: 'How does cashback work?',
    answer:
      'You earn cashback on every rent payment. The cashback is credited to your Flent wallet and can be applied to future payments to reduce your payable amount.',
  },
  {
    id: '4',
    question: 'What if my payment fails?',
    answer:
      'If a payment fails, no money is deducted. You can retry immediately. If money was deducted but payment shows failed, it will be automatically refunded within 5-7 business days.',
  },
  {
    id: '5',
    question: 'How do I add my landlord?',
    answer:
      'Go to Setup > Invite Landlord. Enter their phone number and we\'ll send them a link to verify their bank account for receiving rent payments.',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const toggleFAQ = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('mailto:support@flent.in?subject=Help%20Request');
  }, []);

  const handleCallSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('tel:+919876543210');
  }, []);

  const handleWhatsApp = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('https://wa.me/919876543210?text=Hi,%20I%20need%20help%20with%20Flent');
  }, []);

  return (
    <Screen testID="help-screen">
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
            Help & Support
          </Text>
          <View style={styles.backButton} />
        </View>

        {/* Contact Options */}
        <View style={styles.contactSection}>
          <Text variant="bodySm" color="muted" style={styles.sectionTitle}>
            CONTACT US
          </Text>
          <View style={styles.contactOptions}>
            <TouchableOpacity style={styles.contactOption} onPress={handleWhatsApp}>
              <View style={[styles.contactIcon, { backgroundColor: '#25D366' + '20' }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              </View>
              <Text variant="bodySm" color="primary">
                WhatsApp
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactOption} onPress={handleContactSupport}>
              <View style={styles.contactIcon}>
                <Ionicons name="mail-outline" size={24} color={colors.brand[500]} />
              </View>
              <Text variant="bodySm" color="primary">
                Email
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactOption} onPress={handleCallSupport}>
              <View style={styles.contactIcon}>
                <Ionicons name="call-outline" size={24} color={colors.brand[500]} />
              </View>
              <Text variant="bodySm" color="primary">
                Call
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text variant="bodySm" color="muted" style={styles.sectionTitle}>
            FREQUENTLY ASKED QUESTIONS
          </Text>

          <View style={styles.faqList}>
            {FAQ_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.faqItem}
                onPress={() => toggleFAQ(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.faqHeader}>
                  <Text
                    variant="bodyMdMedium"
                    color="primary"
                    style={styles.faqQuestion}
                  >
                    {item.question}
                  </Text>
                  <Ionicons
                    name={expandedId === item.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.neutral[500]}
                  />
                </View>
                {expandedId === item.id && (
                  <Text variant="bodySm" color="muted" style={styles.faqAnswer}>
                    {item.answer}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Support Hours */}
        <View style={styles.supportHours}>
          <Ionicons name="time-outline" size={20} color={colors.neutral[500]} />
          <Text variant="bodySm" color="muted">
            Support available Mon-Sat, 9 AM - 6 PM IST
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
  contactSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  contactOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  contactOption: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.black[600],
    borderRadius: radius.md,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.brand[500]}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faqSection: {
    marginBottom: spacing.xl,
  },
  faqList: {
    gap: spacing.sm,
  },
  faqItem: {
    padding: spacing.md,
    backgroundColor: colors.black[600],
    borderRadius: radius.md,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    marginRight: spacing.sm,
  },
  faqAnswer: {
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  supportHours: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
});
