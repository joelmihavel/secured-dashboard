/**
 * DevNavigator — Enhanced Floating Dev Navigation Overlay
 *
 * DEV mode only. Provides a draggable FAB + bottom sheet with:
 * - Quick Login (test phone buttons with auto-OTP)
 * - All-Mocks toggle with cache isolation
 * - Per-service mock toggles (collapsible)
 * - Font scale override (preset buttons)
 * - Screen navigator with search + scenario long-press
 *
 * Rendered in _layout.tsx OUTSIDE the Stack as a sibling overlay.
 * Set HIDE_DEV_NAV = true to hide for parity screenshots.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  ScrollView,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography } from '@/src/theme';
import {
  devMockConfig,
  setMockToggle,
  setAllMocks,
  TEST_PHONES,
  type ServiceName,
} from '@/src/__dev__/devConfig';
import { useDevStore as _useDevStore } from '@/src/__dev__/devStore';
import { SCENARIOS, type ScenarioKey } from '@/src/__dev__/scenarios';
import { clearAllStores } from '@/src/stores/resetAll';
import { queryClient } from '@/src/providers/QueryProvider';
import { sendOtp, verifyOtp } from '@/src/services/api/auth';
import { jumpToScreen, getSeedConfig } from '@/src/__dev__/jumpToScreen';
import { paymentKeys } from '@/src/hooks/usePayments';
import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * Type assertion for useDevStore — the globalThis ??= pattern in devStore.ts
 * causes the export type to collapse to `unknown`. This re-types it as the
 * Zustand UseBoundStore hook it actually is at runtime.
 */
interface DevState {
  activeScenario: ScenarioKey | null;
  fontScaleOverride: number | null;
  devAuthBypass: boolean;
  setScenario: (key: ScenarioKey | null) => void;
  setFontScale: (scale: number | null) => void;
  setDevAuthBypass: (enabled: boolean) => void;
  reset: () => void;
}

const useDevStore = _useDevStore as unknown as UseBoundStore<StoreApi<DevState>>;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Set to true to hide the FAB (e.g. for parity screenshots) */
export const HIDE_DEV_NAV = false;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const FONT_SCALE_PRESETS = [1.0, 1.15, 1.3, 1.5, 2.0] as const;

const SERVICE_NAMES: ServiceName[] = [
  'dashboard',
  'payments',
  'waitlist',
  'agreement',
  'setup',
  'profile',
];

// ---------------------------------------------------------------------------
// Types & Data
// ---------------------------------------------------------------------------

interface ScreenScenario {
  label: string;
  key: ScenarioKey;
}

interface ScreenRoute {
  name: string;
  path: string;
  params?: Record<string, string>;
  section: string;
  scenarios?: ScreenScenario[];
}

interface Section {
  label: string;
  screens: { name: string; path: string; params?: Record<string, string>; scenarios?: ScreenScenario[] }[];
}

const SECTIONS: Section[] = [
  {
    label: 'Auth',
    screens: [
      { name: 'Splash', path: '/(auth)/splash' },
      { name: 'Beta Splash', path: '/(auth)/beta-splash' },
      { name: 'Carousel', path: '/(auth)/carousel' },
      { name: 'Sign Up', path: '/(auth)/sign-up' },
      { name: 'OTP Verification', path: '/(auth)/otp' },
    ],
  },
  {
    label: 'Home',
    screens: [
      {
        name: 'Home Dashboard',
        path: '/(main)',
        scenarios: [
          { label: 'Payment Due', key: 'home:payment_due' },
          { label: 'Payment Overdue', key: 'home:payment_overdue' },
          { label: 'Late Payment', key: 'home:late_payment' },
          { label: 'Missed Payment', key: 'home:missed_payment' },
          { label: 'No Tenancy', key: 'home:no_tenancy' },
          { label: 'Pending Verification', key: 'home:pending_verification' },
        ],
      },
      {
        name: 'Setup to Earn Cashback',
        path: '/(main)',
        params: { showSheet: 'cashback-setup' },
      },
    ],
  },
  {
    label: 'Payment',
    screens: [
      { name: 'Confirm Payment', path: '/(payment)/confirm' },
      { name: 'Choose Method', path: '/(payment)/confirm', params: { modalView: 'selector' } },
      { name: 'Add UPI', path: '/(payment)/confirm', params: { modalView: 'add-upi' } },
      { name: 'Add Credit Card', path: '/(payment)/confirm', params: { modalView: 'add-card' } },
      { name: 'Add Debit Card', path: '/(payment)/confirm', params: { modalView: 'add-debit-card' } },
      { name: 'Add Netbanking', path: '/(payment)/confirm', params: { modalView: 'add-netbanking' } },
      { name: 'Edit Method', path: '/(payment)/confirm', params: { modalView: 'edit-method' } },
      { name: 'Enter Rent', path: '/(payment)/enter-rent' },
      { name: 'Payment Success', path: '/(payment)/status', params: { initialStatus: 'success' } },
      { name: 'Payment Pending', path: '/(payment)/status', params: { initialStatus: 'pending' } },
      { name: 'Payment Failed', path: '/(payment)/status', params: { initialStatus: 'failed' } },
      { name: 'Payment Refunded', path: '/(payment)/status', params: { initialStatus: 'refunded' } },
    ],
  },
  {
    label: 'Profile',
    screens: [
      { name: 'Profile Home', path: '/(profile)' },
      { name: 'Edit Profile', path: '/(profile)/edit' },
      { name: 'Agreement', path: '/(profile)/agreement' },
    ],
  },
  {
    label: 'Setup',
    screens: [
      { name: 'Setup Dashboard', path: '/(setup)' },
      { name: 'Add Bank', path: '/(setup)/add-bank' },
      { name: 'Add Utility Bill', path: '/(setup)/add-utility' },
      { name: 'Invite Landlord', path: '/(setup)/invite-landlord' },
      { name: 'Pending Steps', path: '/(setup)/pending-steps' },
    ],
  },
  {
    label: 'Waitlist',
    screens: [
      {
        name: 'Waitlist',
        path: '/(waitlist)',
        scenarios: [
          { label: 'Pending', key: 'waitlist:pending' },
          { label: 'Approved', key: 'waitlist:approved' },
          { label: 'Rejected', key: 'waitlist:rejected' },
        ],
      },
      { name: 'Approved', path: '/(waitlist)/approved' },
    ],
  },
  {
    label: 'Agreement',
    screens: [
      { name: 'Upload Agreement', path: '/(agreement)/upload' },
      { name: 'Review Agreement', path: '/(agreement)/review' },
    ],
  },
];

/** Flatten sections into a searchable list */
const ALL_ROUTES: ScreenRoute[] = SECTIONS.flatMap((section) =>
  section.screens.map((screen) => ({
    ...screen,
    section: section.label,
  })),
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DevNavigator() {
  const router = useRouter();
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Sheet state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Login state
  const [loginLoading, setLoginLoading] = useState<string | null>(null);

  // Jump-to-Screen state
  const [jumpingPath, setJumpingPath] = useState<string | null>(null);

  // Mock toggles state — force re-render on toggle
  const [mockRevision, setMockRevision] = useState(0);
  const [mocksExpanded, setMocksExpanded] = useState(false);

  // Font scale
  const fontScale = useDevStore((s) => s.fontScaleOverride);
  const setFontScale = useDevStore((s) => s.setFontScale);

  // Scenario picker
  const [scenarioTarget, setScenarioTarget] = useState<{
    path: string;
    scenarios: ScreenScenario[];
  } | null>(null);

  // Active scenario display
  const activeScenario = useDevStore((s) => s.activeScenario);

  // -------------------------------------------------------------------------
  // PanResponder (draggable FAB)
  // -------------------------------------------------------------------------

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.extractOffset();
      },
    }),
  ).current;

  // -------------------------------------------------------------------------
  // Filtered routes
  // -------------------------------------------------------------------------

  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return ALL_ROUTES;
    const q = searchQuery.toLowerCase();
    return ALL_ROUTES.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // -------------------------------------------------------------------------
  // Quick Login
  // -------------------------------------------------------------------------

  const handleQuickLogin = useCallback(
    async (phone: string, otp: string) => {
      if (loginLoading) return;
      setLoginLoading(phone);

      try {
        // Step 1: Send OTP (Supabase Auth recognizes test phone numbers)
        const { data: sendData, error: sendError } = await sendOtp({
          phone_number: phone,
        });
        if (sendError) {
          Alert.alert('Quick Login Error', sendError.message);
          setLoginLoading(null);
          return;
        }

        // Step 2: Auto-verify with known OTP (Supabase test phones auto-verify)
        const { error: verifyError } = await verifyOtp({
          phone_number: phone,
          otp,
          method: sendData?.method ?? 'supabase',
          otp_request_id: sendData?.otp_request_id,
        });
        if (verifyError) {
          Alert.alert('Quick Login Error', verifyError.message);
          setLoginLoading(null);
          return;
        }

        // Session is set automatically by verifyOtp (via supabase.auth.verifyOtp)
        // AuthProvider will handle navigation based on session state
        setLoginLoading(null);
        setIsOpen(false);
      } catch (e) {
        setLoginLoading(null);
        Alert.alert(
          'Quick Login Error',
          e instanceof Error ? e.message : 'Unknown error',
        );
      }
    },
    [loginLoading],
  );

  // -------------------------------------------------------------------------
  // Mock management
  // -------------------------------------------------------------------------

  const allMocksEnabled = useMemo(() => {
    // Read mockRevision to trigger re-computation
    void mockRevision;
    return SERVICE_NAMES.every((s) => devMockConfig[s]);
  }, [mockRevision]);

  const handleSwitchAllMocks = useCallback(
    async (enabled: boolean) => {
      await queryClient.cancelQueries();
      queryClient.clear();
      clearAllStores();
      setAllMocks(enabled);
      setMockRevision((r) => r + 1);
    },
    [],
  );

  const handleToggleService = useCallback(
    (service: ServiceName, enabled: boolean) => {
      setMockToggle(service, enabled);
      setMockRevision((r) => r + 1);
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Scenario activation
  // -------------------------------------------------------------------------

  const activateScenario = useCallback(
    async (scenarioKey: ScenarioKey, path: string) => {
      const scenario = SCENARIOS[scenarioKey];

      // 1. Cancel in-flight queries
      await queryClient.cancelQueries();
      // 2. Nuclear cache clear
      queryClient.clear();
      // 3. Reset Zustand stores
      clearAllStores();
      // 4. Set active scenario
      useDevStore.getState().setScenario(scenarioKey);
      // 5. Seed React Query cache with scenario data
      if ('dashboard' in scenario) {
        queryClient.setQueryData(['dashboard'], {
          data: scenario.dashboard,
          error: null,
        });
      }
      if ('waitlist' in scenario) {
        queryClient.setQueryData(['waitlist-status'], {
          data: scenario.waitlist,
          error: null,
        });
      }
      if ('paymentHistory' in scenario) {
        queryClient.setQueryData(['payment-history'], {
          data: (scenario as Record<string, unknown>).paymentHistory,
          error: null,
        });
      }
      if ('paymentStamps' in scenario) {
        // Seed stamps with the mock tenancy ID from dashboard data
        const dashboardData = 'dashboard' in scenario ? (scenario as Record<string, any>).dashboard : null;
        const tenancyId = dashboardData?.tenancy?.id ?? 'mock-tenancy';
        queryClient.setQueryData(paymentKeys.stamps(tenancyId), (scenario as Record<string, unknown>).paymentStamps);
      }
      // 6. Navigate
      setScenarioTarget(null);
      setIsOpen(false);
      setSearchQuery('');
      router.push(path as never);
    },
    [router],
  );

  // -------------------------------------------------------------------------
  // Jump-to-Screen
  // -------------------------------------------------------------------------

  const handleJump = useCallback(
    async (path: string) => {
      if (jumpingPath) return;
      setJumpingPath(path);

      try {
        const config = getSeedConfig(path);

        // Show runtime note warning if present
        if (config?.runtimeNote) {
          Alert.alert('Note', config.runtimeNote);
        }

        // Try the full jump flow (seeds backend + auth)
        const result = await jumpToScreen(path);

        if (!result.success) {
          // Jump failed — fall back to dev auth bypass + navigate anyway
          console.warn(`[DevNavigator] Jump failed, using dev bypass: ${result.error}`);
          useDevStore.getState().setDevAuthBypass(true);
        }

        // Navigate regardless — dev bypass ensures layout renders
        setJumpingPath(null);
        setIsOpen(false);
        setSearchQuery('');
        setScenarioTarget(null);
        router.push(path as never);
      } catch (e) {
        // Even on error, navigate with bypass
        console.warn(`[DevNavigator] Jump error, using dev bypass`);
        useDevStore.getState().setDevAuthBypass(true);
        setJumpingPath(null);
        setIsOpen(false);
        router.push(path as never);
      }
    },
    [jumpingPath, router],
  );

  // -------------------------------------------------------------------------
  // Navigation — enables dev auth bypass and navigates directly.
  // Mock data handles the data side; no real backend auth needed.
  // -------------------------------------------------------------------------

  const navigateTo = useCallback(
    (path: string, params?: Record<string, string>) => {
      const config = getSeedConfig(path);

      // For protected screens, enable dev auth bypass so layouts render
      // without a real Supabase session. Enable mocks so data is available.
      if (config && !config.noSeedNeeded) {
        setAllMocks(true);
        useDevStore.getState().setDevAuthBypass(true);
      }

      setIsOpen(false);
      setSearchQuery('');
      setScenarioTarget(null);
      if (params) {
        router.push({ pathname: path as any, params });
      } else {
        router.push(path as never);
      }
    },
    [router],
  );

  // -------------------------------------------------------------------------
  // Font scale
  // -------------------------------------------------------------------------

  const handleFontScale = useCallback(
    (scale: number) => {
      setFontScale(scale === 1.0 ? null : scale);
    },
    [setFontScale],
  );

  // -------------------------------------------------------------------------
  // Bail early
  // -------------------------------------------------------------------------

  if (HIDE_DEV_NAV) return null;

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderDivider = () => <View style={styles.divider} />;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      {/* ============================================================== */}
      {/* Draggable FAB                                                  */}
      {/* ============================================================== */}
      <Animated.View
        style={[styles.fab, { transform: pan.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => setIsOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>D</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ============================================================== */}
      {/* Bottom Sheet Modal                                             */}
      {/* ============================================================== */}
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setScenarioTarget(null);
          setIsOpen(false);
        }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            setScenarioTarget(null);
            setIsOpen(false);
          }}
        />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Dev Navigator</Text>
            <View style={styles.headerRight}>
              {activeScenario && (
                <View style={styles.activeScenarioBadge}>
                  <Text style={styles.activeScenarioText}>
                    {activeScenario}
                  </Text>
                  <TouchableOpacity
                    onPress={() => useDevStore.getState().setScenario(null)}
                    hitSlop={8}
                  >
                    <Text style={styles.clearScenarioText}>X</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.sheetCount}>
                {filteredRoutes.length} screens
              </Text>
            </View>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ========================================================== */}
            {/* Section: Quick Login                                       */}
            {/* ========================================================== */}
            {renderSectionHeader('Quick Login')}
            <View style={styles.quickLoginContainer}>
              {TEST_PHONES.map((tp) => (
                <TouchableOpacity
                  key={tp.phone}
                  style={[
                    styles.quickLoginButton,
                    loginLoading === tp.phone && styles.quickLoginButtonActive,
                  ]}
                  onPress={() => handleQuickLogin(tp.phone, tp.otp)}
                  disabled={loginLoading !== null}
                  activeOpacity={0.7}
                >
                  {loginLoading === tp.phone ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.brand[500]}
                    />
                  ) : (
                    <>
                      <Text style={styles.quickLoginLabel}>{tp.label}</Text>
                      <Text style={styles.quickLoginPhone}>{tp.phone}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {renderDivider()}

            {/* ========================================================== */}
            {/* Section: All Mocks Toggle                                  */}
            {/* ========================================================== */}
            <View style={styles.mockMasterRow}>
              <View style={styles.mockMasterLabel}>
                <Text style={styles.sectionTitle}>All Mocks</Text>
                <Text style={styles.mockHint}>
                  {allMocksEnabled ? 'ON' : 'OFF'} — clears cache on toggle
                </Text>
              </View>
              <Switch
                value={allMocksEnabled}
                onValueChange={handleSwitchAllMocks}
                trackColor={{
                  false: colors.black[500],
                  true: colors.brand[600],
                }}
                thumbColor={allMocksEnabled ? colors.brand[500] : colors.black[300]}
              />
            </View>

            {renderDivider()}

            {/* ========================================================== */}
            {/* Section: Mock Services (collapsible)                       */}
            {/* ========================================================== */}
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => setMocksExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Mock Services</Text>
              <Text style={styles.chevron}>
                {mocksExpanded ? '\u25B2' : '\u25BC'}
              </Text>
            </TouchableOpacity>
            {mocksExpanded && (
              <View style={styles.mockServicesContainer}>
                {SERVICE_NAMES.map((service) => (
                  <View key={service} style={styles.mockServiceRow}>
                    <Text style={styles.mockServiceName}>{service}</Text>
                    <Switch
                      value={devMockConfig[service]}
                      onValueChange={(val) => handleToggleService(service, val)}
                      trackColor={{
                        false: colors.black[500],
                        true: colors.brand[600],
                      }}
                      thumbColor={
                        devMockConfig[service]
                          ? colors.brand[500]
                          : colors.black[300]
                      }
                    />
                  </View>
                ))}
              </View>
            )}

            {renderDivider()}

            {/* ========================================================== */}
            {/* Section: Font Scale Override                                */}
            {/* ========================================================== */}
            {renderSectionHeader('Font Scale')}
            <View style={styles.fontScaleRow}>
              {FONT_SCALE_PRESETS.map((scale) => {
                const isActive =
                  (fontScale === null && scale === 1.0) ||
                  fontScale === scale;
                return (
                  <TouchableOpacity
                    key={scale}
                    style={[
                      styles.fontScaleButton,
                      isActive && styles.fontScaleButtonActive,
                    ]}
                    onPress={() => handleFontScale(scale)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.fontScaleLabel,
                        isActive && styles.fontScaleLabelActive,
                      ]}
                    >
                      {scale}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {renderDivider()}

            {/* ========================================================== */}
            {/* Section: Screen Navigator                                  */}
            {/* ========================================================== */}
            {renderSectionHeader('Screens')}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search screens..."
                placeholderTextColor={colors.black[300]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                >
                  <Text style={styles.clearText}>X</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Route list */}
            {filteredRoutes.map((item, index) => {
              const seedConfig = getSeedConfig(item.path);
              const hasRuntimeNote = !!seedConfig?.runtimeNote;
              const isJumping = jumpingPath === item.path;

              return (
                <View key={`${item.path}-${item.name}-${index}`} style={styles.routeItem}>
                  <TouchableOpacity
                    style={styles.routeTouchable}
                    onPress={() => navigateTo(item.path, item.params)}
                    onLongPress={() => {
                      if (item.scenarios && item.scenarios.length > 0) {
                        setScenarioTarget({
                          path: item.path,
                          scenarios: item.scenarios,
                        });
                      }
                    }}
                    activeOpacity={0.6}
                  >
                    <View style={styles.routeInfo}>
                      <View style={styles.routeNameRow}>
                        <Text style={styles.routeName}>{item.name}</Text>
                        {item.scenarios && item.scenarios.length > 0 && (
                          <View style={styles.scenarioDot} />
                        )}
                      </View>
                      <Text style={styles.routePath}>{item.path}</Text>
                    </View>
                    <Text style={styles.routeSection}>{item.section}</Text>
                  </TouchableOpacity>

                  {/* Jump button */}
                  <View style={styles.jumpContainer}>
                    {hasRuntimeNote && (
                      <View style={styles.warningDot} />
                    )}
                    {isJumping ? (
                      <View style={styles.jumpButton}>
                        <ActivityIndicator
                          size="small"
                          color={colors.brand[500]}
                        />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.jumpButton}
                        onPress={() => handleJump(item.path)}
                        disabled={jumpingPath !== null}
                        activeOpacity={0.6}
                        hitSlop={4}
                      >
                        <Text
                          style={[
                            styles.jumpIcon,
                            jumpingPath !== null &&
                              !isJumping &&
                              styles.jumpIconDisabled,
                          ]}
                        >
                          {'\u26A1'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* ============================================================== */}
        {/* Scenario Picker Overlay                                       */}
        {/* ============================================================== */}
        {scenarioTarget && (
          <View style={styles.scenarioOverlay}>
            <Pressable
              style={styles.scenarioBackdrop}
              onPress={() => setScenarioTarget(null)}
            />
            <View style={styles.scenarioPicker}>
              <Text style={styles.scenarioPickerTitle}>Select Scenario</Text>
              {scenarioTarget.scenarios.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={styles.scenarioOption}
                  onPress={() =>
                    activateScenario(s.key, scenarioTarget.path)
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.scenarioOptionLabel}>{s.label}</Text>
                  <Text style={styles.scenarioOptionKey}>{s.key}</Text>
                </TouchableOpacity>
              ))}
              {/* Default (no scenario) option */}
              <TouchableOpacity
                style={[styles.scenarioOption, styles.scenarioOptionDefault]}
                onPress={() => {
                  useDevStore.getState().setScenario(null);
                  navigateTo(scenarioTarget.path);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.scenarioOptionLabel}>
                  Default (no scenario)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // FAB -----------------------------------------------------------------------
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    zIndex: 9999,
  },
  fabButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: colors.black[700],
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
  },

  // Sheet ---------------------------------------------------------------------
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.8,
    backgroundColor: colors.black[600],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.black[400],
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    ...typography.bodyMdMedium,
    color: colors.white,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetCount: {
    ...typography.bodySm,
    color: colors.black[300],
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Active scenario badge
  activeScenarioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand[500] + '22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 6,
  },
  activeScenarioText: {
    ...typography.captionSm,
    color: colors.brand[500],
  },
  clearScenarioText: {
    color: colors.brand[500],
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
  },

  // Section headers -----------------------------------------------------------
  sectionHeader: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionTitle: {
    ...typography.bodySmSemiBold,
    color: colors.black[200],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.black[400],
    marginVertical: 8,
  },

  // Quick Login ---------------------------------------------------------------
  quickLoginContainer: {
    gap: 8,
  },
  quickLoginButton: {
    backgroundColor: colors.black[500],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  quickLoginButtonActive: {
    borderColor: colors.brand[500],
    borderWidth: 1,
  },
  quickLoginLabel: {
    ...typography.bodyMd2Medium,
    color: colors.white,
  },
  quickLoginPhone: {
    ...typography.bodySm,
    color: colors.black[300],
  },

  // Mock toggles --------------------------------------------------------------
  mockMasterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  mockMasterLabel: {
    flex: 1,
    gap: 2,
  },
  mockHint: {
    ...typography.captionSm,
    color: colors.black[300],
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  chevron: {
    color: colors.black[300],
    fontSize: 10,
  },
  mockServicesContainer: {
    gap: 2,
    paddingLeft: 4,
  },
  mockServiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  mockServiceName: {
    ...typography.bodyMd2,
    color: colors.neutral[300],
    textTransform: 'capitalize',
  },

  // Font Scale ----------------------------------------------------------------
  fontScaleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fontScaleButton: {
    flex: 1,
    backgroundColor: colors.black[500],
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  fontScaleButtonActive: {
    backgroundColor: colors.brand[500],
  },
  fontScaleLabel: {
    ...typography.bodySmMedium,
    color: colors.neutral[300],
  },
  fontScaleLabelActive: {
    color: colors.black[700],
  },

  // Search --------------------------------------------------------------------
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: colors.black[500],
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: colors.white,
    ...typography.bodyMd2,
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

  // Route list ----------------------------------------------------------------
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.black[500],
  },
  routeTouchable: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeInfo: {
    flex: 1,
    marginRight: 12,
  },
  routeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeName: {
    ...typography.bodyMd2Medium,
    color: colors.white,
  },
  scenarioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand[500],
  },
  routePath: {
    ...typography.captionSm,
    color: colors.black[300],
    marginTop: 2,
  },
  routeSection: {
    ...typography.captionSm,
    color: colors.brand[500],
  },

  // Jump button ---------------------------------------------------------------
  jumpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
  },
  jumpButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.black[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  jumpIcon: {
    fontSize: 14,
  },
  jumpIconDisabled: {
    opacity: 0.3,
  },
  warningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F5A623',
  },

  // Scenario picker -----------------------------------------------------------
  scenarioOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scenarioBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scenarioPicker: {
    backgroundColor: colors.black[600],
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  scenarioPickerTitle: {
    ...typography.bodyMdMedium,
    color: colors.white,
    marginBottom: 16,
    textAlign: 'center',
  },
  scenarioOption: {
    backgroundColor: colors.black[500],
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  scenarioOptionDefault: {
    borderWidth: 1,
    borderColor: colors.black[400],
    backgroundColor: 'transparent',
  },
  scenarioOptionLabel: {
    ...typography.bodyMd2Medium,
    color: colors.white,
  },
  scenarioOptionKey: {
    ...typography.captionSm,
    color: colors.black[300],
    marginTop: 2,
  },
});
