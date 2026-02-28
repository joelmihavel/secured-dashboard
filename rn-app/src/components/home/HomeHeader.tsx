/**
 * HomeHeader Component
 * "Hi, [Name]" greeting with Flent logo and user avatar
 * Figma Reference: 243-2762, 243-2967, 243-3170, 243-3378, 243-4062
 *
 * Figma Pixel-Perfect Values (684:9047):
 * - Container: paddingHorizontal 32px, paddingVertical 24px
 * - Logo: 32x32 (via Logo component)
 * - Greeting: "Hi, Rishabh", fontSize 14, lineHeight 20, color #CBCBCB
 * - Gap between logo and greeting: 16px (Figma 684:9049)
 * - Avatar: 32x32, borderRadius 16, backgroundColor #FFCC8A (brand[300])
 * - Avatar initial: fontSize 14, fontWeight 600, color white
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { Text, Logo, Avatar } from '@/src/components/ui';
import { colors } from '@/src/theme';
import { s } from '@/src/theme/scale';

export interface HomeHeaderProps {
  userName: string;
  avatarUrl?: string | null;
  userId?: string | null;
  onAvatarPress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
}

function HomeHeaderComponent({
  userName,
  avatarUrl,
  userId,
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
        <Avatar uri={avatarUrl} userId={userId} name={userName} size="sm" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(32), // Figma 684:9047: paddingHorizontal 32
    paddingTop: 24, // Figma 684:9047: paddingVertical 24
    paddingBottom: 24, // Figma 684:9047: paddingVertical 24
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // Figma 684:9049: gap 16 between logo and greeting
  },
  greeting: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    color: '#CBCBCB', // Figma: #CBCBCB (neutral[300])
  },
  avatarContainer: {
    position: 'relative',
  },
});

export const HomeHeader = memo(HomeHeaderComponent);
