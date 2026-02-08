/**
 * HomeHeader Component
 * "Hi, [Name]" greeting with Flent logo and user avatar
 * Figma Reference: 243-2762, 243-2967, 243-3170, 243-3378, 243-4062
 *
 * Figma Pixel-Perfect Values:
 * - Container: paddingHorizontal 32px, paddingTop 24px, paddingBottom 24px
 * - Logo: 32x32 (via Logo component)
 * - Greeting: "Hi, Rishabh", fontSize 14, lineHeight 20, color #CBCBCB
 * - Gap between logo and greeting: 12px
 * - Avatar: 32x32, borderRadius 16, backgroundColor #FFCC8A (brand[300])
 * - Avatar initial: fontSize 14, fontWeight 600, color white
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

import { Text, Logo } from '@/src/components/ui';
import { colors, spacing } from '@/src/theme';

export interface HomeHeaderProps {
  userName: string;
  avatarUrl?: string | null;
  onAvatarPress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
}

function HomeHeaderComponent({
  userName,
  avatarUrl,
  onAvatarPress,
  onNotificationPress,
  unreadCount = 0,
}: HomeHeaderProps) {
  const router = useRouter();

  const handleAvatarPress = () => {
    if (onAvatarPress) {
      onAvatarPress();
    } else {
      router.push('/(profile)' as never);
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo + Greeting */}
      <View style={styles.leftContent}>
        <Logo size={32} />
        <Text style={styles.greeting}>Hi, {userName}</Text>
      </View>

      {/* Avatar */}
      <TouchableOpacity
        onPress={handleAvatarPress}
        style={styles.avatarContainer}
        testID="home-avatar"
        activeOpacity={0.8}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32, // Figma: 32px exact
    paddingTop: 24, // Figma: paddingTop 24px
    paddingBottom: 24, // Figma: paddingBottom 24px
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // Figma: gap 12px
  },
  greeting: {
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400', // Figma: fontWeight 400
    color: '#CBCBCB', // Figma: #CBCBCB (neutral[300])
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 32, // Figma: 32px
    height: 32, // Figma: 32px
    borderRadius: 16, // Figma: fully rounded
  },
  avatarPlaceholder: {
    width: 32, // Figma: 32px
    height: 32, // Figma: 32px
    borderRadius: 16, // Figma: fully rounded
    backgroundColor: '#FFCC8A', // Figma: #FFCC8A (brand[300])
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14, // Figma: fontSize 14
    fontWeight: '600', // Figma: fontWeight 600
    color: colors.white,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5484D', // Figma: error.radix #E5484D
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '600',
  },
});

export const HomeHeader = memo(HomeHeaderComponent);
