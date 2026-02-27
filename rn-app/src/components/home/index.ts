/**
 * Home Components barrel export
 * All components for the Home Dashboard screen
 */

// Core components
export { HomeHeader } from './HomeHeader';
export type { HomeHeaderProps } from './HomeHeader';

export { HeadlineSection } from './HeadlineSection';
export type { HeadlineSectionProps, HeadlineVariant } from './HeadlineSection';

export { WarningBanner } from './WarningBanner';
export type { WarningBannerProps, WarningType } from './WarningBanner';

// Payment method components
export * from './CashbackSetupModal';
export type { VerificationCheckSheetProps } from './CashbackSetupModal';
export * from './PaymentMethodCard';
export type { PaymentMethodCardProps, PaymentMethod, HomePaymentMethodType } from './PaymentMethodCard';

export { PaymentMethodCarousel } from './PaymentMethodCarousel';
export type { PaymentMethodCarouselProps } from './PaymentMethodCarousel';

export { RentStatusCarousel } from './RentStatusCarousel';
export type { RentStatusCarouselProps, CarouselCardItem } from './RentStatusCarousel';

// Tab and list components
export { TabSwitcher } from './TabSwitcher';
export type { TabSwitcherProps, TabId } from './TabSwitcher';

export { RecentPaymentsList } from './RecentPaymentsList';
export type { RecentPaymentsListProps, RecentPayment, PaymentStatus } from './RecentPaymentsList';

export { CashbacksList } from './CashbacksList';
export type { CashbacksListProps, CashbackEntry, CashbackStatus } from './CashbacksList';

// Status notification
export { StatusNotificationBanner } from './StatusNotificationBanner';
export type { StatusNotificationBannerProps, NotificationType } from './StatusNotificationBanner';

// Footer
export { BottomFooter } from './BottomFooter';
export type { BottomFooterProps } from './BottomFooter';

// Setup components
export { SetupProgressCard } from './SetupProgressCard';

export { SetupChecklist } from './SetupChecklist';
export type { SetupChecklistProps } from './SetupChecklist';

export { FinishSetupSection } from './FinishSetupSection';
export type { FinishSetupSectionProps } from './FinishSetupSection';

// Badge / stamp
export { PaymentBadge } from './PaymentBadge';
export type { PaymentBadgeProps, BadgeVariant } from './PaymentBadge';

// Status components
export { LandlordStatusCard } from './LandlordStatusCard';
export type { LandlordStatusCardProps, LandlordStatus } from './LandlordStatusCard';

// Empty state components
export { EmptyPaymentsState } from './EmptyPaymentsState';
export type { EmptyPaymentsStateProps } from './EmptyPaymentsState';

export { CashbackEmptyState } from './CashbackEmptyState';
export type { CashbackEmptyStateProps } from './CashbackEmptyState';

export { HomeEmptyState } from './HomeEmptyState';
export type { HomeEmptyStateProps, EmptyStateVariant } from './HomeEmptyState';

// Payment Method Selection Sheet (243-6490)
export { PaymentMethodSelectionSheet } from './PaymentMethodSelectionSheet';
export type {
  PaymentMethodSelectionSheetProps,
  PaymentMethodOption,
} from './PaymentMethodSelectionSheet';
