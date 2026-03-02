/**
 * PaymentMethodModal — Shared types
 *
 * Types for the inline payment method overlay used in initiate.tsx.
 * This is NOT a React Native Modal — it renders as an absolutely-positioned
 * bottom sheet within the parent screen.
 */

import type { PaymentFlowOutcome } from '@/src/hooks/usePaymentFlow';

/** Which view is displayed inside the rent payment modal */
export type ModalView =
  | 'enter-amount'
  | 'selector'
  | 'add-card'
  | 'add-debit-card'
  | 'add-netbanking'
  | 'confirm-payment';

/** Method type passed from selector to orchestrator */
export type PaymentMethodType = 'upi' | 'card' | 'debit_card' | 'netbanking';

/** Props shared by all add-method content components */
export interface AddMethodContentProps {
  paymentId: string;
  onBack: () => void;
  cardType?: 'credit' | 'debit';
  /** Called when child needs to initiate payment (setup flow without pre-existing paymentId).
   *  instrumentDetails allows the child to pass method-specific data (e.g. VPA) for demo mode saving. */
  onInitiatePayment?: (methodType: PaymentMethodType, instrumentDetails?: { vpa?: string }) => Promise<{ paymentId: string } | null>;
  /** Called when instrument is ready for confirm step (payment context only).
   *  Transitions to confirm-payment view instead of executing payment directly. */
  onReadyForConfirm?: (
    methodType: PaymentMethodType,
    corePaymentMode: string,
    instrumentParams: Record<string, string>,
    methodLabel: string,
    clearSensitiveData?: () => void,
  ) => void;
}

/** Props for the method selector content */
export interface MethodSelectorContentProps {
  onBack: () => void;
  onProceed: (methodType: PaymentMethodType) => void;
  isInitiating: boolean;
}

/** Props for the rent payment modal shell / orchestrator */
export interface PaymentMethodModalProps {
  visible: boolean;
  onClose: () => void;
  tenancyId: string;
  rentMonth: string;
  /** Which view to show initially. Defaults to 'enter-amount'. */
  initialView?: ModalView;
  /** Pre-seeded payment ID for opening directly at add-method views. */
  initialPaymentId?: string;
}

/** Props for the confirm-payment view */
export interface ConfirmPaymentContentProps {
  onBack: () => void;
  onPay: () => void;
  isPaying: boolean;
  methodType: PaymentMethodType;
  methodLabel: string;
}
