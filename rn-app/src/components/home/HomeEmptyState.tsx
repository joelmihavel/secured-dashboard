/**
 * HomeEmptyState Component
 * State machine-driven empty state renderer for Home Dashboard - Figma pixel-perfect
 *
 * Figma References (10 variants):
 * 1. 243-4062 - Base empty state (Setup payment + Setup progress)
 * 2. 243-4258 - Invitation sent to landlord
 * 3. 243-4462 - Waiting for response (<24hrs), Send Reminder
 * 4. 243-4666 - Still pending (>24hrs), Send Reminder
 * 5. 243-4870 - Invite pending/failed, Contact Support
 * 6. 243-5074 - Landlord declined, Contact Support
 * 7. 243-5689 - Empty with UPI, Recent Payments tab
 * 8. 243-5870 - With UPI, Cashbacks tab with entries
 * 9. 243-6296 - Empty with UPI, No cashbacks
 * 10. 243-6490 - Payment method selection bottom sheet
 *
 * Figma Key Values:
 * - Container gap: 24px between sections
 * - Section margins: 12-16px
 */

import React, { memo, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { HeadlineSection } from './HeadlineSection';
import { SetupProgressCard } from './SetupProgressCard';
import { RentStatusCarousel, CarouselCardItem } from './RentStatusCarousel';
import { FinishSetupSection } from './FinishSetupSection';
import { TabSwitcher, TabId } from './TabSwitcher';
import { EmptyPaymentsState } from './EmptyPaymentsState';
import { CashbackEmptyState } from './CashbackEmptyState';
import { LandlordStatus } from './LandlordStatusCard';
import { PaymentMethod } from './PaymentMethodCard';

/**
 * Empty State Variants
 * Maps to Figma screen IDs for reference
 */
export type EmptyStateVariant =
  | 'empty_base' // 243-4062
  | 'empty_with_upi' // 243-6296
  | 'empty_with_upi_payments' // 243-5689
  | 'setup_payment' // 243-6490
  | 'setup_cashback' // 243-6731
  | 'invitation_sent' // 243-4258
  | 'invitation_resent_recent' // 243-4462
  | 'invitation_resent_old' // 243-4666
  | 'invitation_failed' // 243-4870
  | 'invitation_declined'; // 243-5074

export interface HomeEmptyStateProps {
  variant: EmptyStateVariant;
  daysUntilDue?: number;
  userName?: string;

  // Setup progress
  bankDetailsComplete?: boolean;
  addressProofComplete?: boolean;
  landlordInvited?: boolean;

  // Payment methods (for UPI variants)
  paymentMethods?: PaymentMethod[];
  carouselItems?: CarouselCardItem[];

  // Cashback stats
  cashbackAccrued?: number;
  cashbackAllTime?: number;
  cashbackRate?: number;

  // Callbacks
  onAddPayment?: () => void;
  onFinishSetup?: () => void;
  onCtaPress?: () => void;
  onSendReminder?: () => void;
  onContactSupport?: () => void;
  onPaymentMethodPress?: (method: PaymentMethod) => void;
  onPaymentMethodEdit?: (method: PaymentMethod) => void;
}

function HomeEmptyStateComponent({
  variant,
  daysUntilDue = 10,
  userName = 'User',
  bankDetailsComplete = false,
  addressProofComplete = false,
  landlordInvited = false,
  paymentMethods = [],
  carouselItems = [],
  cashbackAccrued = 0,
  cashbackAllTime = 0,
  cashbackRate = 0.8,
  onAddPayment,
  onFinishSetup,
  onCtaPress,
  onSendReminder,
  onContactSupport,
  onPaymentMethodPress,
  onPaymentMethodEdit,
}: HomeEmptyStateProps) {
  const [activeTab, setActiveTab] = useState<TabId>('recent_payments');

  // Map variant to LandlordStatus for FinishSetupSection
  const getLandlordStatus = (): LandlordStatus | null => {
    switch (variant) {
      case 'invitation_sent':
        return 'invitation_sent';
      case 'invitation_resent_recent':
        return 'waiting_response_recent';
      case 'invitation_resent_old':
        return 'waiting_response_old';
      case 'invitation_failed':
        return 'invite_pending';
      case 'invitation_declined':
        return 'declined';
      default:
        return null;
    }
  };

  const landlordStatus = getLandlordStatus();
  const hasUPI = paymentMethods.length > 0;
  const showPaymentCarousel =
    (carouselItems && carouselItems.length > 0) ||
    variant === 'empty_with_upi' ||
    variant === 'empty_with_upi_payments' ||
    (landlordStatus !== null && hasUPI);
  const showTabSwitcher =
    variant === 'empty_with_upi' || variant === 'empty_with_upi_payments';
  const showFinishSetup = landlordStatus !== null;
  const showSetupProgress =
    variant === 'empty_base' || (showFinishSetup && !hasUPI);

  return (
    <View style={styles.container}>
      {/* Headline: "Your rent is due in X days"
          Figma 243-4062: Empty state headline does NOT show "Paying with:" label
          Only show "Paying with:" when payment carousel is visible */}
      <HeadlineSection
        variant={daysUntilDue !== undefined && daysUntilDue < 0 ? 'overdue' : 'due'}
        daysUntilDue={daysUntilDue !== undefined && daysUntilDue >= 0 ? daysUntilDue : undefined}
        daysOverdue={daysUntilDue !== undefined && daysUntilDue < 0 ? Math.abs(daysUntilDue) : undefined}
      />

      {/* Rent Status Carousel (for UPI variants) */}
      {showPaymentCarousel ? (
        <View style={styles.section}>
          <RentStatusCarousel
            items={carouselItems}
          />
        </View>
      ) : null}

      {/* Divider above Finish Setup if needed */}
      {showFinishSetup && showPaymentCarousel ? (
        <View style={styles.fullWidthDivider} />
      ) : null}

      {/* Tab Section: Toggle + content wrapped together
          Figma 243-5689: same structure as active state Frame 1686557297
          gap 48, paddingTop 8, alignItems center */}
      {showTabSwitcher ? (
        <View style={styles.tabSection}>
          <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === 'recent_payments' ? (
            <EmptyPaymentsState />
          ) : (
            <View style={styles.cashbackTabContent}>
              <CashbackEmptyState
                accruedAmount={cashbackAccrued}
                allTimeTotal={cashbackAllTime}
                cashbackRate={cashbackRate}
              />
              {/* Setup Progress Card inside Cashbacks tab if setup incomplete */}
              {showSetupProgress ? (
                <SetupProgressCard
                  bankDetailsComplete={bankDetailsComplete}
                  addressProofComplete={addressProofComplete}
                  landlordInvited={landlordInvited}
                  onPress={onFinishSetup}
                  onCtaPress={onFinishSetup}
                />
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {/* Finish Setup Section (for landlord invitation variants) */}
      {showFinishSetup ? (
        <View style={styles.section}>
          <FinishSetupSection
            landlordStatus={landlordStatus!}
            bankDetailsComplete={bankDetailsComplete}
            addressProofComplete={addressProofComplete}
            landlordInvited={landlordInvited}
            onSendReminder={onSendReminder}
            onContactSupport={onContactSupport}
          />
        </View>
      ) : null}

      {/* Setup Progress Card (for base empty state) */}
      {showSetupProgress && !showFinishSetup && !showTabSwitcher ? (
        <View style={styles.section}>
          {/* Divider — Figma 684:9207 */}
          <View style={styles.sectionDivider} />
          <SetupProgressCard
            bankDetailsComplete={bankDetailsComplete}
            addressProofComplete={addressProofComplete}
            landlordInvited={landlordInvited}
            onPress={onFinishSetup}
            onFinishSetup={onFinishSetup}
            onCtaPress={onCtaPress}
          />
        </View>
      ) : null}
    </View>
  );
}

// Figma pixel-perfect styles
// Reference: 243-5689 (Home Empty State with UPI / Recent Payments)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 24, // Figma 243-5689: 24px gap between sections
  },
  section: {
    // Figma 243-5689: sections aligned to container gap
  },
  standalonePaymentCardWrapper: {
    paddingLeft: 64, // Figma: paddingLeft 64 matches Headline
    paddingRight: 32, // Figma: paddingRight 32
  },
  sectionDivider: {
    height: 1, // Figma 684:9207: thin divider
    backgroundColor: '#2A2A2A',
    marginHorizontal: 32,
    marginBottom: 16,
  },
  fullWidthDivider: {
    height: 1, // Figma 684:9607 Vector 21: thin divider
    backgroundColor: '#4D4D4D', // Figma stroke color
    width: '100%',
  },
  // Figma: Tab section wraps toggle + content together
  // Same structure as active state Frame 1686557297
  // gap 48, paddingTop 8, alignItems center
  tabSection: {
    gap: 48, // Figma: itemSpacing 48 between toggle and content
    paddingTop: 8, // Figma: paddingTop 8
    alignItems: 'center', // Figma: counterAxisAlignItems CENTER
    // NOTE: overflow hidden removed — was clipping cashback accrued amount
  },
  cashbackTabContent: {
    width: '100%',
    alignItems: 'center',
    gap: 48, // Figma 243-5870: space between Accrued state and Progress Card
  },
});

export const HomeEmptyState = memo(HomeEmptyStateComponent);
