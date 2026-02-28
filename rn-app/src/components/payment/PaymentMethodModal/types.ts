/**
 * PaymentMethodModal — Shared types
 *
 * Types for the inline payment method overlay used in initiate.tsx.
 * This is NOT a React Native Modal — it renders as an absolutely-positioned
 * bottom sheet within the parent screen.
 */

import type { PaymentFlowOutcome } from '@/src/hooks/usePaymentFlow';

/** Which view is displayed inside the payment method modal */
export type ModalView =
  | 'enter-amount'
  | 'selector'
  | 'add-upi'
  | 'add-card'
  | 'add-debit-card'
  | 'add-netbanking'
  | 'edit-method';

/** Method type passed from selector to orchestrator */
export type PaymentMethodType = 'upi' | 'card' | 'debit_card' | 'netbanking';

/** Saved method details passed when proceeding with an already-saved payment method */
export interface SavedMethodDetails {
  savedMethodId: string;
  /** UPI VPA for direct UPI execution */
  vpa?: string;
  /** Bank code for direct netbanking execution */
  bankCode?: string;
}

/** Props shared by all add-method content components */
export interface AddMethodContentProps {
  paymentId: string;
  onBack: () => void;
  cardType?: 'credit' | 'debit';
  /** Called when child needs to initiate payment (setup flow without pre-existing paymentId) */
  onInitiatePayment?: (methodType: PaymentMethodType) => Promise<{ paymentId: string } | null>;
}

/** Props for the method selector content */
export interface MethodSelectorContentProps {
  onProceed: (methodType: PaymentMethodType, savedDetails?: SavedMethodDetails) => void;
  onSetup: (methodType: PaymentMethodType) => void;
  onEdit: (methodType: PaymentMethodType, savedMethodId: string) => void;
  isInitiating: boolean;
}

/** Props for the modal shell / orchestrator */
export interface PaymentMethodModalProps {
  visible: boolean;
  onClose: () => void;
  tenancyId: string;
  rentMonth: string;
  onProceed?: (method: PaymentMethodType) => void;
  /** Which view to show initially. Defaults to 'enter-amount'. */
  initialView?: ModalView;
  /** Pre-seeded payment ID for opening directly at add-method views. */
  initialPaymentId?: string;
  /** Method type to pre-populate when opening at edit-method view (from profile). */
  initialMethodType?: string;
  /** Saved method ID to pre-populate when opening at edit-method view (from profile). */
  initialSavedMethodId?: string;
}

/** Props for the edit method view */
export interface EditMethodContentProps {
  onBack: () => void;
  methodType: PaymentMethodType;
  savedMethodId: string;
  onProceed: (methodType: PaymentMethodType, savedDetails?: SavedMethodDetails) => void;
  onDeleteSuccess: (methodType: PaymentMethodType) => void;
  isInitiating: boolean;
}
