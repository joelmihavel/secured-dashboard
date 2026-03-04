/**
 * Agreement Review Screen
 *
 * Verify (1:30448): Read-only detail rows with "Proceed" button
 *
 * Flow: upload -> verify -> (Proceed) -> waitlist
 * Or: verify -> (Re-upload Agreement) -> upload
 *
 * All values sourced from Figma REST API -- no AI guesswork.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  AppState,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, withRepeat, withTiming, useSharedValue, useAnimatedStyle, Easing } from 'react-native-reanimated';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { DottedGridPattern } from '@/src/components/patterns';
import { useUploadStore } from '@/src/stores/upload';
import {
  FlentLogoIcon,
  AgreementIdIcon,
  PropertyIcon,
  TenantIcon,
  LandlordIcon,
} from '@/src/components/icons/AgreementIcons';
import { useAgreement, useNetworkStatus } from '@/src/hooks';
import { agreementKeys } from '@/src/hooks/useAgreement';
import {
  formatPaiseToRupees,
  formatDateDisplay,
  abandonExtraction,
  type ExtractedAgreementData,
} from '@/src/services/api/agreement';
import { colors } from '@/src/theme';

// ============================================
// FIGMA CONSTANTS -- Figma REST API (1:30448)
// ============================================

const F = {
  // Screen
  bg: colors.black[700],
  contentPadH: 48, // Frame 1686557268 paddingLeft/Right

  // Layout gaps (from Figma frame itemSpacing)
  outerGap: 64,      // Frame 2095586323 gap
  mainGap: 40,       // Frame 1686557268 gap
  titleGroupGap: 48, // Frame 1686557318 gap
  buttonGroupGap: 24, // Frame 2095586322 gap

  // Flent logo (Frame 1686557264: 32x38, Vector fill=#ffffff)
  logo: {
    w: 32,
    h: 38,
  },

  // Title (size=48, w=400, lineH=64, ls=-2)
  // Character style overrides from Figma REST API (charStyleOverrides):
  //   "Confirm" (chars 0-6) -> override 37 -> #A9A9A9 (grey)
  //   "your details" (chars 8-19) -> override 36 -> #FF9A6D (brand orange)
  title: {
    size: 48,
    lineH: 64,
    ls: -2,
    greyColor: colors.neutral[500],   // "Confirm" -- override 37 fill r=0.6627
    orangeColor: colors.brand[500],  // "your details" -- override 36 fill r=1.0,g=0.6039,b=0.4274
  },

  // Detail rows (verify mode -- 1:30448)
  // Frame 2095586321: column, gap=16
  // Horizontal row (Frame 1686557333): row, space-between, center, gap=4
  // Vertical row (Frame 1686557036): column, center, gap=4
  // Label group (Frame 1686557121/1686557120): row, flex-start, center, gap=4
  // Divider (Vector 50): stroke #4D4D4D, weight 0.25
  detail: {
    gap: 16,          // Frame 2095586321 itemSpacing
    rowGap: 4,        // within row frame gap
    labelSize: 12,    // TEXT size=12
    labelLineH: 20,
    labelColor: colors.neutral[600],
    labelIconGap: 4,  // Frame gap between icon and label text
    valueSize: 14,    // TEXT size=14
    valueLineH: 20,
    valueColor: colors.neutral[300],
    dividerColor: colors.black[400], // Vector stroke
    dividerWeight: 0.25,     // Figma stroke weight
  },

  // "Re-upload Agreement" link
  manual: {
    size: 14,
    lineH: 20,
    color: colors.neutral[500],
  },
} as const;

// ============================================
// FIELD DEFINITIONS
// ============================================

type FieldLayout = 'horizontal' | 'vertical';

interface FieldDef {
  key: string;
  label: string;
  layout: FieldLayout;
  icon: React.FC<{ size?: number; color?: string }>;
  getValue: (data: ExtractedAgreementData) => string;
}

const FIELDS: FieldDef[] = [
  {
    key: 'certificateNo',
    label: 'Agreement ID',
    layout: 'horizontal',
    icon: AgreementIdIcon,
    getValue: (d) => d.certificateNo ?? '',
  },
  {
    key: 'propertyName',
    label: 'Property Name',
    layout: 'vertical',
    icon: PropertyIcon,
    getValue: (d) => d.propertyName ?? '',
  },
  {
    key: 'tenants',
    label: 'Tenant(s)',
    layout: 'vertical',
    icon: TenantIcon,
    getValue: (d) => d.tenantNames?.join(', ') ?? '',
  },
  {
    key: 'landlords',
    label: 'Landlord(s)',
    layout: 'vertical',
    icon: LandlordIcon,
    getValue: (d) => d.landlordNames?.join(', ') ?? '',
  },
  {
    key: 'monthlyRent',
    label: 'Monthly Rent',
    layout: 'horizontal',
    icon: AgreementIdIcon,
    getValue: (d) => d.monthlyRentPaise ? `\u20B9 ${formatPaiseToRupees(d.monthlyRentPaise)}` : '',
  },
  {
    key: 'deposit',
    label: 'One-Time Deposit',
    layout: 'horizontal',
    icon: AgreementIdIcon,
    getValue: (d) => d.securityDepositPaise ? `\u20B9 ${formatPaiseToRupees(d.securityDepositPaise)}` : '',
  },
  {
    key: 'duration',
    label: 'Rent Duration',
    layout: 'horizontal',
    icon: AgreementIdIcon,
    getValue: (d) => d.rentDurationMonths ? `${d.rentDurationMonths} Months` : '',
  },
  {
    key: 'exitDate',
    label: 'Exit Date',
    layout: 'horizontal',
    icon: AgreementIdIcon,
    getValue: (d) => d.leaseEndDate ? formatDateDisplay(d.leaseEndDate) : '',
  },
];

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Detail row for verify mode -- matches Figma 1:30448 detail frames.
 */
const DetailRow = ({
  field,
  value,
}: {
  field: FieldDef;
  value: string;
}) => {
  const IconComponent = field.icon;
  const isVertical = field.layout === 'vertical';

  return (
    <View style={isVertical ? styles.detailRowVertical : styles.detailRowHorizontal}>
      <View style={styles.detailLabelGroup}>
        <IconComponent />
        <Text style={styles.detailLabel}>{field.label}</Text>
      </View>
      <Text style={isVertical ? styles.detailValueBelow : styles.detailValueRight}>
        {value}
      </Text>
    </View>
  );
};

const Divider = () => <View style={styles.divider} />;

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { extractionId: paramExtractionId } = useLocalSearchParams<{
    extractionId?: string;
  }>();

  // Fallback to persisted store when URL param is missing (e.g. app kill during review)
  const persistedExtractionId = useUploadStore((s) => s.extractionId);
  const extractionId = paramExtractionId ?? persistedExtractionId;

  const { isConnected } = useNetworkStatus();
  const queryClient = useQueryClient();

  const {
    extractedData,
    isLoadingExtraction,
    confirm,
    isConfirming,
  } = useAgreement({
    extractionId: extractionId ?? null,
  });

  // Detect stale cache: if extractedData exists but ALL fields are empty,
  // the data was cached during processing (when DB fields were still NULL).
  // Force a refetch to get the completed data.
  // Retries up to 5 times with 1.5s delays to handle DB replication lag.
  const refetchCountRef = React.useRef(0);
  const MAX_REFETCH_ATTEMPTS = 5;
  const [isRetryingStaleData, setIsRetryingStaleData] = React.useState(false);

  // Synchronous stale check — determines if data is all-empty WITHOUT waiting
  // for useEffect. Prevents the "Not Found" flash between query resolution and
  // the async retry effect setting isRetryingStaleData=true.
  const isDataAllEmpty = React.useMemo(() => {
    if (!extractedData || isLoadingExtraction) return false;
    return FIELDS.every((field) => !field.getValue(extractedData));
  }, [extractedData, isLoadingExtraction]);

  React.useEffect(() => {
    if (!extractedData || isLoadingExtraction) return;
    if (refetchCountRef.current >= MAX_REFETCH_ATTEMPTS) {
      setIsRetryingStaleData(false);
      return;
    }

    if (isDataAllEmpty && extractionId) {
      refetchCountRef.current++;
      setIsRetryingStaleData(true);
      // Delay before invalidating cache to allow DB write to propagate.
      // invalidateQueries marks data stale AND triggers refetch (more reliable than removeQueries).
      const delay = refetchCountRef.current * 1500; // 1.5s, 3s, 4.5s, 6s, 7.5s
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: agreementKeys.extraction(extractionId) });
      }, delay);
    } else {
      // Data loaded successfully — reset counter
      refetchCountRef.current = 0;
      setIsRetryingStaleData(false);
    }
  }, [extractedData, extractionId, isLoadingExtraction, isDataAllEmpty, queryClient]);

  // Refetch extraction data when app returns from background.
  // Covers the case where extraction completes while app is backgrounded —
  // without this, the review screen shows stale empty data until manual refresh.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const wasBg = appStateRef.current.match(/inactive|background/);
      appStateRef.current = next;
      if (wasBg && next === 'active' && extractionId) {
        // Reset retry counter so stale cache detection can re-run
        refetchCountRef.current = 0;
        queryClient.invalidateQueries({
          queryKey: agreementKeys.extraction(extractionId),
        });
      }
    });
    return () => sub.remove();
  }, [extractionId, queryClient]);

  // Get current value from extracted data
  const getFieldValue = useCallback(
    (key: string) => {
      const field = FIELDS.find(f => f.key === key);
      return field && extractedData ? field.getValue(extractedData) : '';
    },
    [extractedData]
  );

  // Return to upload screen for a fresh re-upload.
  //
  // CRITICAL: Set dismissedExtractionId in the upload store BEFORE navigation.
  // Without this, useMountDiscovery on the upload screen runs before the forceNew
  // cleanup effect → finds the still-active extraction → redirects back to review
  // → infinite loop. dismissCurrentExtraction() is a minimal store update (no reset)
  // so it won't trigger the "PropertyDOM doesn't exist" layout crash.
  //
  // Also fire-and-forget abandonExtraction() to soft-delete the DB record
  // (sets user_verified=true). This makes the record invisible to the journey router,
  // useMountDiscovery, and checkManualReviewExtraction.
  const handleReupload = useCallback(async () => {
    if (extractionId) {
      // 1. Mark as dismissed in store FIRST — blocks useMountDiscovery resurrection
      useUploadStore.getState().dismissCurrentExtraction();
      // 2. Soft-delete in DB — AWAIT to ensure the record is marked user_verified=true
      // before navigating. Without this, useMountDiscovery on the upload screen can
      // find the still-active extraction in DB and redirect back to review (loop).
      await abandonExtraction(extractionId);
    }
    router.replace({
      pathname: '/(agreement)/upload',
      params: { forceNew: 'true' }
    });
  }, [router, extractionId]);

  // Confirm extraction and navigate to waitlist
  const handleProceed = useCallback(async () => {
    if (!extractedData) return;

    // ENH 1: Offline guard — show alert instead of letting the mutation fail
    if (!isConnected) {
      Alert.alert(
        'No Internet',
        'Please check your connection and try again.'
      );
      return;
    }

    try {
      await confirm({ confirmedRole: 'tenant' });
      // Upload flow complete — clear persisted upload state
      useUploadStore.getState().reset();
      router.replace('/(waitlist)' as never);
    } catch (error) {
      const msg =
        (error as { message?: string })?.message ??
        'Something went wrong. Please try again.';
      Alert.alert('Confirmation Failed', msg);
    }
  }, [extractedData, confirm, router, isConnected]);

  // Scroll state to show/hide the "scroll down" indicator
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    setIsScrolledToBottom(isBottom);
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  // Bouncing animation for scroll indicator
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    translateY.value = withRepeat(
      withTiming(10, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Loading state — also show when retrying stale cache (all fields empty)
  // to avoid flashing "Not Found" values before real data arrives.
  // isDataAllEmpty is a synchronous check that catches the first render frame
  // where extractedData exists but all fields are NULL (before the retry useEffect fires).
  const shouldShowLoading = isLoadingExtraction || isRetryingStaleData ||
    (isDataAllEmpty && !!extractionId && refetchCountRef.current < MAX_REFETCH_ATTEMPTS);
  if (shouldShowLoading) {
    return (
      <Screen testID="review-screen">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff9a6d" />
          <Text style={styles.loadingText}>
            {isRetryingStaleData ? 'Fetching your agreement details...' : 'Loading your details...'}
          </Text>
        </View>
      </Screen>
    );
  }

  // Error state if extracted data couldn't be loaded and we aren't loading anymore
  if (!extractedData) {
    return (
      <Screen testID="review-screen">
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Failed to load agreement details.</Text>
          <PrimaryButton 
            title="Go Back" 
            onPress={() => router.back()} 
            style={{ marginTop: 24 }} 
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="review-screen" padded={false} safeAreaTop={false} style={{ backgroundColor: 'transparent' }}>
      <DottedGridPattern fadeMask={false} />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mainContent}>
          <View style={styles.titleGroup}>
            <FlentLogoIcon size={F.logo.h} color="#ffffff" />

            <Text style={styles.title}>
              <Text inherit style={styles.titleGrey}>Confirm</Text>
              {'\n'}
              <Text inherit style={styles.titleOrange}>your details</Text>
            </Text>

            <View style={styles.detailsContainer}>
              {FIELDS.map((field, index) => {
                const value = getFieldValue(field.key);

                return (
                  <React.Fragment key={field.key}>
                    <DetailRow field={field} value={value || 'Not Found'} />
                    {index < FIELDS.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </View>
          </View>

          <View style={styles.buttonSection}>
            <PrimaryButton
              title="Proceed"
              onPress={handleProceed}
              disabled={isConfirming || isLoadingExtraction}
              loading={isConfirming || isLoadingExtraction}
              showDivider
            />

            <TouchableOpacity
              style={styles.enterManuallyTouchable}
              onPress={handleReupload}
            >
              <Text style={styles.enterManuallyText}>Re-upload Agreement</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {!isScrolledToBottom && (
        <TouchableOpacity
          onPress={scrollToBottom}
          activeOpacity={0.7}
          style={styles.scrollIndicatorContainer}
        >
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            style={animatedStyle}
          >
            <Ionicons name="chevron-down" size={32} color="#FF9A6D" />
          </Animated.View>
        </TouchableOpacity>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollIndicatorContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    width: '100%',
    paddingHorizontal: F.contentPadH,
    gap: F.mainGap,
  },
  titleGroup: {
    gap: F.titleGroupGap,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.title.size,
    lineHeight: F.title.lineH,
    letterSpacing: F.title.ls,
  },
  titleGrey: {
    color: F.title.greyColor,
  },
  titleOrange: {
    color: F.title.orangeColor,
  },
  detailsContainer: {
    gap: F.detail.gap,
  },
  detailRowHorizontal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: F.detail.rowGap,
  },
  detailRowVertical: {
    justifyContent: 'center',
    gap: F.detail.rowGap,
  },
  detailLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: F.detail.labelIconGap,
  },
  detailLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.labelSize,
    lineHeight: F.detail.labelLineH,
    color: F.detail.labelColor,
  },
  detailValueRight: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.valueSize,
    lineHeight: F.detail.valueLineH,
    color: F.detail.valueColor,
  },
  detailValueBelow: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.detail.valueSize,
    lineHeight: F.detail.valueLineH,
    color: F.detail.valueColor,
  },
  divider: {
    height: F.detail.dividerWeight,
    backgroundColor: F.detail.dividerColor,
  },
  buttonSection: {
    gap: F.buttonGroupGap,
  },
  enterManuallyTouchable: {
    alignSelf: 'stretch',
  },
  enterManuallyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: F.manual.size,
    lineHeight: F.manual.lineH,
    color: F.manual.color,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },
});