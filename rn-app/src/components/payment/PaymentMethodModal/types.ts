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
  | 'edit-method'
  | 'enter-cvv';

/** Method type passed from selector to orchestrator */
export type PaymentMethodType = 'upi' | 'card' | 'debit_card' | 'netbanking';

/** Saved method details passed when proceeding with an already-saved payment method */
export interface SavedMethodDetails {
  savedMethodId: string;
  /** UPI VPA for direct UPI execution */
  vpa?: string;
  /** Bank code for direct netbanking execution */
  bankCode?: string;
  /** PayU stored card token for CVV-only flow */
  cardToken?: string;
  /** Card type for stored card payment (CC or DC) */
  cardType?: 'CC' | 'DC';
  /** Last 4 digits of card (for CVV view display) */
  lastFour?: string;
  /** Card network e.g. "VISA" (for CVV view display) */
  cardNetwork?: string;
}

/** Props shared by all add-method content components */
export interface AddMethodContentProps {
  paymentId: string;
  onBack: () => void;
  cardType?: 'credit' | 'debit';
  /** Called when child needs to initiate payment (setup flow without pre-existing paymentId).
   *  instrumentDetails allows the child to pass method-specific data (e.g. VPA) for demo mode saving. */
  onInitiatePayment?: (methodType: PaymentMethodType, instrumentDetails?: { vpa?: string }) => Promise<{ paymentId: string } | null>;
  /** Context: 'payment' for rent flow (default), 'profile' for method management */
  context?: 'payment' | 'profile';
  /** Called when method is saved successfully in profile context (close modal) */
  onSaveComplete?: () => void;
}

/** Props for the method selector content */
export interface MethodSelectorContentProps {
  onBack: () => void;
  onProceed: (methodType: PaymentMethodType, savedDetails?: SavedMethodDetails) => void;
  onSetup: (methodType: PaymentMethodType) => void;
  onEdit: (methodType: PaymentMethodType, savedMethodId: string) => void;
  isInitiating: boolean;
  /** Show edit pencil icons on saved methods (default false — only true from profile) */
  showEdit?: boolean;
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
  /** Context: 'payment' for rent flow (default), 'profile' for profile management */
  context?: 'payment' | 'profile';
}

/** Props for the edit method view */
export interface EditMethodContentProps {
  onBack: () => void;
  methodType: PaymentMethodType;
  savedMethodId: string;
  onProceed: (methodType: PaymentMethodType, savedDetails?: SavedMethodDetails) => void;
  onDeleteSuccess: (methodType: PaymentMethodType) => void;
  isInitiating: boolean;
  /** Context: 'payment' for rent flow (default), 'profile' for profile management */
  context?: 'payment' | 'profile';
}

/** Props for the CVV-only entry view */
export interface EnterCvvContentProps {
  paymentId: string;
  onBack: () => void;
  cardToken: string;
  cardType: 'CC' | 'DC';
  lastFour: string;
  cardNetwork: string;
}
