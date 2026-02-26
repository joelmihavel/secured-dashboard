/**
 * PaymentMethodModal — Shared types
 *
 * Types for the inline payment method overlay used in initiate.tsx.
 * This is NOT a React Native Modal — it renders as an absolutely-positioned
 * bottom sheet within the parent screen.
 */

import type { PaymentFlowOutcome } from '@/src/hooks/usePaymentFlow';

/** Which view is displayed inside the payment method modal */
export type ModalView = 'selector' | 'add-upi' | 'add-card' | 'add-debit-card' | 'add-netbanking' | 'edit-method';

/** Method type passed from selector to orchestrator */
export type PaymentMethodType = 'upi' | 'card' | 'debit_card' | 'netbanking';

/** Props shared by all add-method content components */
export interface AddMethodContentProps {
  paymentId: string;
  onBack: () => void;
  cardType?: 'credit' | 'debit';
}

/** Props for the method selector content */
export interface MethodSelectorContentProps {
  onProceed: (methodType: PaymentMethodType) => void;
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
}

/** Props for the edit method view */
export interface EditMethodContentProps {
  onBack: () => void;
  methodType: PaymentMethodType;
  savedMethodId: string;
  onProceed: (methodType: PaymentMethodType) => void;
  onDeleteSuccess: (methodType: PaymentMethodType) => void;
  isInitiating: boolean;
}
