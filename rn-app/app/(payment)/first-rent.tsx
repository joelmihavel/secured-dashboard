/**
 * First Rent Payment Screen (Post Approval)
 *
 * Figma References:
 * - 41-10712: Pay Rent (Initial State)
 * - 41-10859: Pay Rent (Error/Different State?)
 * - 41-11006: Pay Rent (Success/Transition?)
 *
 * This screen matches the layout of the 'Review' screen but is specific to the
 * post-approval flow where the user pays their first rent.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { Screen, Text, Logo } from '@/src/components';
import { DottedPattern } from '@/src/components/patterns';
import { scaled, scaledFont, scaledSpacing } from '@/src/theme/scale';

// ============================================
// CONSTANTS - EXACT FIGMA VALUES
// ============================================

const FIGMA = {
  colors: {
    screenBackground: '#131313',    // black.700
    cardBackground: '#FFFFFF',      // white
    primaryText: '#000000',         // black
    secondaryText: '#A9A9A9',       // neutral.500
    divider: '#D9D9D9',             // neutral.200
    successText: '#70BF73',         // success.default
    buttonBackground: '#000000',    // black
    buttonText: '#FFFFFF',          // white
    footerText: '#878787',          // neutral.600
    iconBg: '#EEEEEE',              // neutral.100
  },
} as const;

// ============================================
// SVGs
// ============================================

const VerticalDashedLine = () => (
  <Svg width={scaled(1)} height={scaled(33)} viewBox="0 0 1 33" fill="none">
    <Path
      d="M0.253846 0V33"
      stroke="#1A1A1A"
      strokeWidth={0.5}
      strokeDasharray="8 8"
    />
  </Svg>
);

const HorizontalLine = () => (
  <Svg width="100%" height={scaled(1)} viewBox="0 0 393 1" fill="none">
    <Path d="M0 0.25H393" stroke="#EEEEEE" strokeWidth={0.5} />
  </Svg>
);

const WalletIcon = () => (
  <Svg width={scaled(24)} height={scaled(24)} viewBox="0 0 24 24" fill="none">
    <Path d="M4.77419 4.77419V12C4.77419 12.5475 4.9917 13.0727 5.37888 13.4598C5.76605 13.847 6.29117 14.0645 6.83871 14.0645H17.1613C17.7088 14.0645 18.234 13.847 18.6211 13.4598C19.0083 13.0727 19.2258 12.5475 19.2258 12V4.77419" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M8.78947 8.21053V1.89474C8.78947 1.33639 9.01128 0.8009 9.40609 0.40609C9.8009 0.01128 10.3364 -0.210526 10.8947 -0.210526H13C13.5583 -0.210526 14.0938 0.01128 14.4886 0.40609C14.8835 0.8009 15.1053 1.33639 15.1053 1.89474V8.21053" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 2)"/>
  </Svg>
);

const DiscountIcon = () => (
  <Svg width={scaled(16)} height={scaled(20)} viewBox="0 0 17 20" fill="none">
    <Path d="M6.23758 20.0001H1.86316V10.6031H0V8.0109H1.86316C0.82626 3.99289 3.75334 1.58428 5.3465 0.882227C10.0125 -1.58041 14.8514 1.69229 16.6876 3.63647V20.0001H12.3132V5.82368C9.78572 1.67608 6.61562 2.63738 5.3465 3.63647C3.72634 6.42314 6.02156 7.71387 7.37169 8.0109H9.63991V10.6031H6.23758V20.0001Z" fill="black"/>
  </Svg>
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function FirstRentPaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handlePay = () => {
    router.push('/(agreement)/success' as never);
  };

  return (
    <Screen testID="first-rent-payment-screen">
      {/* Background Pattern */}
      <View className="absolute top-0 left-0 right-0 overflow-hidden" style={{ height: scaled(405) }}>
        <DottedPattern />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + scaledSpacing(16),
          paddingBottom: insets.bottom + scaledSpacing(32),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Content */}
        <View style={{ paddingHorizontal: scaledSpacing(24), marginBottom: scaledSpacing(24) }}>
           <Logo size={scaled(40)} />
        </View>

        <View style={{ paddingHorizontal: scaledSpacing(24) }}>
          <Text 
            className="text-white font-jakarta-regular text-left mb-8"
            style={{ fontSize: scaledFont(28), lineHeight: scaledFont(40) }}
          >
            Pay Rent
          </Text>
        </View>

        {/* White Card Section */}
        <View 
          className="bg-white rounded-t-3xl items-center w-full flex-1"
          style={{ 
            marginTop: scaledSpacing(24),
            paddingTop: scaledSpacing(16),
            paddingBottom: scaledSpacing(48),
            borderTopLeftRadius: scaled(24),
            borderTopRightRadius: scaled(24),
          }}
        >
          {/* Handle Bar */}
          <View 
            className="bg-neutral-200 rounded-full mb-8"
            style={{ width: scaled(28), height: scaled(4) }}
          />

          {/* Amount Section */}
          <View className="flex-row items-center justify-center w-full px-6 mb-8 gap-4">
            
            {/* Left: Total Rent */}
            <View className="flex-row items-center gap-4">
              <View 
                className="bg-neutral-100 items-center justify-center rounded-full"
                style={{ width: scaled(40), height: scaled(40) }}
              >
                <WalletIcon />
              </View>
              <View>
                <Text 
                  className="text-neutral-500 font-jakarta-medium uppercase text-center"
                  style={{ fontSize: scaledFont(12), lineHeight: scaledFont(22) }}
                >
                  Total payable rent
                </Text>
                <Text 
                  className="text-black font-jakarta-semibold"
                  style={{ fontSize: scaledFont(16), lineHeight: scaledFont(17) }}
                >
                  ₹ 32,175
                </Text>
              </View>
            </View>

            {/* Vertical Divider */}
            <View style={{ height: scaled(33), width: scaled(1) }}>
              <VerticalDashedLine />
            </View>

            {/* Right: Savings */}
            <View className="flex-row items-center gap-4">
              <View 
                className="bg-neutral-100 items-center justify-center rounded-full"
                style={{ width: scaled(40), height: scaled(40) }}
              >
                <DiscountIcon />
              </View>
              <View>
                <Text 
                  className="text-success font-jakarta-medium"
                  style={{ fontSize: scaledFont(12), lineHeight: scaledFont(17) }}
                >
                  saved ₹ 325 →
                </Text>
                <Text 
                  className="text-neutral-500 font-jakarta-medium text-center"
                  style={{ fontSize: scaledFont(12), lineHeight: scaledFont(22) }}
                >
                  using flent cashback
                </Text>
              </View>
            </View>
          </View>

          {/* Payment Details */}
          <View className="w-full px-6 gap-2 mb-8">
            <View className="flex-col gap-2">
              <View className="flex-row justify-between items-center w-full">
                <Text className="text-black font-jakarta-medium text-xs">Paying to</Text>
                <Text className="text-black font-jakarta-medium text-xs">[Landlord Name]</Text>
              </View>
              
              <View className="flex-row gap-4 items-center">
                {/* Bank Icon Placeholder */}
                <View 
                  className="bg-gray-200 rounded-md"
                  style={{ width: scaled(48), height: scaled(48) }} 
                />
                <View>
                  <Text className="text-black font-jakarta-medium text-base">ICICI</Text>
                  <Text className="text-black font-jakarta-medium text-xs">XXXX XXXX XXXX 2003</Text>
                </View>
              </View>
            </View>

            {/* Pay Now Button */}
            <TouchableOpacity
              onPress={handlePay}
              className="bg-black rounded-full flex-row items-center justify-center border-l-2 border-r-2 border-t-2 border-neutral-600 mt-4"
              style={{
                height: scaled(41),
                width: scaled(345),
                paddingHorizontal: scaledSpacing(32),
                borderColor: '#878787',
                borderWidth: 2,
                borderRadius: scaled(200),
                shadowColor: '#995C41',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.24,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Text className="text-white font-jakarta-semibold text-sm">Pay Now</Text>
            </TouchableOpacity>

            <Text className="text-black font-jakarta-medium text-center text-xs mt-2">
              All payments are 100% secure
            </Text>
          </View>

          {/* Horizontal Divider */}
          <View className="w-full mb-6">
            <HorizontalLine />
          </View>

          {/* Footer - App Icons */}
          <View className="items-center gap-4 px-6 w-full">
            <View className="flex-row items-center gap-2">
              <View className="bg-gray-300 w-10 h-8 rounded" /> 
              <Text className="text-neutral-600 font-jakarta-semibold text-xs uppercase">
                PAY BY ANY APP INSTEAD
              </Text>
            </View>

            <View className="flex-row gap-8 w-full justify-center">
              {/* Google Pay */}
              <View className="items-center gap-2">
                <View className="bg-gray-200 rounded-full" style={{ width: scaled(40), height: scaled(40) }} />
                <Text className="text-black font-jakarta-regular text-xs">Google Pay</Text>
              </View>
              
              {/* Paytm */}
              <View className="items-center gap-2">
                <View className="bg-gray-200 rounded-full" style={{ width: scaled(40), height: scaled(40) }} />
                <Text className="text-black font-jakarta-regular text-xs">PayTM</Text>
              </View>

              {/* PhonePe */}
              <View className="items-center gap-2">
                <View className="bg-gray-200 rounded-full" style={{ width: scaled(40), height: scaled(40) }} />
                <Text className="text-black font-jakarta-regular text-xs">PhonePe</Text>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    </Screen>
  );
}
