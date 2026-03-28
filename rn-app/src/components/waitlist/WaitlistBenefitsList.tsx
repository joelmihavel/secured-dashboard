import React, { memo } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';
import { s, sv } from '@/src/theme/scale';

const BENEFITS = [
  { text: '1% cashback on timely rental payment', badge: 'Live Now' },
  { text: 'Zero Security Deposits', badge: 'Coming Soon' },
  { text: 'First dibs on upcoming flent homes', badge: 'Coming Soon' },
  { text: 'Home design @zero service fee', badge: 'Coming Soon' },
];

function WaitlistBenefitsListComponent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Your benefits{'\n'}with secured
      </Text>
      
      <View style={styles.list}>
        {BENEFITS.map((benefit, index) => (
          <View key={index} style={styles.item}>
            <Image
              source={require('@/assets/images/icons/benefit_card_icon.png')}
              style={styles.icon}
              resizeMode="contain"
            />
            <Text style={styles.itemText}>{benefit.text}</Text>
            <View style={styles.badge}>
              <Text style={[styles.badgeText, benefit.badge === 'Live Now' && styles.badgeLive]}>
                {benefit.badge}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: s(24),
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(28),
    lineHeight: sv(40),
    letterSpacing: -1,
    color: colors.white,
    textAlign: 'center',
  },
  list: {
    width: '100%',
    gap: s(16),
  },
  item: {
    width: '100%',
    alignItems: 'center',
    gap: s(16),
  },
  icon: {
    width: s(53),
    height: s(40),
  },
  itemText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sv(16),
    lineHeight: sv(24),
    color: colors.neutral[500], // #A9A9A9
    textAlign: 'center',
  },
  badge: {
    backgroundColor: colors.black[700], // #131313
    borderRadius: 200,
    paddingVertical: s(4),
    paddingHorizontal: s(16),
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(12),
    lineHeight: sv(20),
    color: colors.neutral[500], // #A9A9A9
  },
  badgeLive: {
    color: colors.success.material, // #4CAF50
  },
});

export const WaitlistBenefitsList = memo(WaitlistBenefitsListComponent);
