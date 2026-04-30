/**
 * Centralized Test Data Factory
 *
 * Typed generator functions for every domain entity used in tests.
 * Each generator provides realistic Indian defaults and accepts
 * partial overrides for targeted test scenarios.
 *
 * Usage:
 *   import { createMockPaymentHistoryItem } from '@/src/__mocks__/testDataFactory';
 *   const item = createMockPaymentHistoryItem({ status: 'failed' });
 */

import type {
  PaymentHistoryItem,
  SavedPaymentMethod,
  InitiatePaymentData,
  ReceiptData,
  CashbackDiscount,
  CheckPaymentStatusResponse,
  PaymentStampEntry,
  PaymentStampSummary,
  PaymentStampsResponse,
} from '@/src/services/api/payments';

import type {
  PayUSessionParams,
  SelectedPaymentMethod,
  PaymentMethodType,
} from '@/src/stores/payment';

import type { UploadPhase } from '@/src/stores/upload';

import type {
  DashboardData,
  DashboardTenancy,
  DashboardUser,
  UpcomingPayment,
  CashbackBalance,
  RawRecentPayment,
  DashboardPaymentStamps,
} from '@/src/services/api/dashboard';

import type { WaitlistStatusData } from '@/src/services/api/waitlist';

import type { SetupProgress } from '@/src/types/setup';

import type {
  ExtractionStatusData,
  ExtractionStatus,
} from '@/src/services/api/agreement';

// ==============================================
// ID / TIMESTAMP HELPERS
// ==============================================

let _idCounter = 0;

function nextId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${String(_idCounter).padStart(5, '0')}`;
}

function isoNow(): string {
  return '2026-02-15T10:30:00.000Z';
}

// ==============================================
// USER & AUTH
// ==============================================

export interface MockUser {
  id: string;
  phone: string;
  email: string | null;
  first_name: string;
  last_name: string | null;
  created_at: string;
}

export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return {
    id: nextId('usr'),
    phone: '+919876543210',
    email: 'rishabh@flent.in',
    first_name: 'Rishabh',
    last_name: 'Sharma',
    created_at: isoNow(),
    ...overrides,
  };
}

export interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; phone: string };
}

export function createMockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    access_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.mock-jwt-token',
    refresh_token: 'mock-refresh-token-abc123',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: nextId('usr'), phone: '+919876543210' },
    ...overrides,
  };
}

// ==============================================
// PAYMENT — PayU Session Params
// ==============================================

export function createMockPayUSessionParams(
  overrides?: Partial<PayUSessionParams>
): PayUSessionParams {
  return {
    key: 'PLycrf',
    txnid: nextId('txn'),
    amount: '25000',
    productinfo: 'Rent February 2026',
    firstname: 'Rishabh',
    email: 'rishabh@flent.in',
    phone: '+919876543210',
    surl: 'https://api.flent.in/payment/success',
    furl: 'https://api.flent.in/payment/failure',
    hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    user_credential: 'PLycrf:rishabh@flent.in',
    ...overrides,
  };
}

// ==============================================
// PAYMENT — Initiate Payment Data
// ==============================================

export function createMockInitiatePaymentData(
  overrides?: Partial<InitiatePaymentData>
): InitiatePaymentData {
  return {
    payment_id: nextId('pay'),
    txn_id: nextId('txn'),
    amount_paise: 2500000,
    pg_fee_paise: 50000,
    cashback_applied_paise: 0,
    total_paise: 2550000,
    payment_method: 'upi',
    original_rent_paise: 2500000,
    net_rent_paise: 2500000,
    landlord_payout_paise: 2500000,
    convenience_fee_paise: 50000,
    verification_complete: true,
    cashback_discount: createMockCashbackDiscount(),
    ...overrides,
  };
}

// ==============================================
// PAYMENT — Payment History Item
// ==============================================

export function createMockPaymentHistoryItem(
  overrides?: Partial<PaymentHistoryItem>
): PaymentHistoryItem {
  return {
    id: nextId('pay'),
    amount: 25000,
    pg_fee: 500,
    cashback_applied: 200,
    cashback_earned: 200,
    net_amount: 24800,
    amount_paise: 2500000,
    pg_fee_paise: 50000,
    cashback_applied_paise: 20000,
    status: 'success',
    payment_method: 'upi',
    rent_month: '2026-02',
    created_at: '2026-02-05T10:00:00Z',
    paid_at: '2026-02-05T10:30:00Z',
    can_download_receipt: true,
    tenancy: {
      id: nextId('ten'),
      property_address: '42 MG Road, Indiranagar, Bangalore 560038',
      landlord_name: 'Priya Krishnamurthy',
    },
    ...overrides,
  };
}

// ==============================================
// PAYMENT — Saved Payment Method
// ==============================================

export function createMockSavedPaymentMethod(
  type: 'upi' | 'card' | 'netbanking',
  overrides?: Partial<SavedPaymentMethod>
): SavedPaymentMethod {
  const base: SavedPaymentMethod = {
    id: nextId('pm'),
    type,
    display_name: '',
    is_default: false,
    is_verified: true,
    nickname: null,
    created_at: isoNow(),
  };

  switch (type) {
    case 'upi':
      base.display_name = 'UPI - ICICI';
      base.vpa = 'rishabh@okicici';
      base.upi_provider = 'ICICI';
      break;
    case 'card':
      base.display_name = 'Visa ****4242';
      base.last_four = '4242';
      base.card_network = 'visa';
      base.card_type = 'credit';
      base.card_issuer = 'HDFC Bank';
      base.card_expiry_month = 12;
      base.card_expiry_year = 2028;
      base.is_expired = false;
      break;
    case 'netbanking':
      base.display_name = 'HDFC Bank';
      base.bank_code = 'HDFC';
      base.bank_name = 'HDFC Bank';
      break;
  }

  return { ...base, ...overrides };
}

// ==============================================
// PAYMENT — Receipt Data
// ==============================================

export function createMockReceiptData(
  overrides?: Partial<ReceiptData>
): ReceiptData {
  return {
    receiptNumber: 'FLENT-R-2026-00142',
    generatedAt: isoNow(),
    payment: {
      id: nextId('pay'),
      transactionId: nextId('txn'),
      gatewayId: nextId('pg'),
      amount: 25000,
      pgFee: 500,
      paymentMethod: 'upi',
      status: 'success',
      rentMonth: '2026-02',
      rentMonthDisplay: 'February 2026',
      paidAt: '2026-02-05T10:30:00Z',
      utr: 'UTR123456789012',
      timeliness: 'on_time',
    },
    tenant: {
      name: 'Rishabh Sharma',
      phone: '+919876543210',
      email: 'rishabh@flent.in',
      panMasked: 'ABCPS****A',
    },
    property: {
      address: '42 MG Road, Indiranagar, Bangalore 560038',
      city: 'Bangalore',
    },
    landlord: {
      name: 'Priya Krishnamurthy',
      bankAccountMasked: '****5678',
      panMasked: 'ABCPK****Z',
    },
    agreement: {
      certId: 'KA-BLR-2025-001234',
    },
    company: {
      name: 'Flent Secured',
      gstin: '29AABCT1332L1ZI',
    },
    ...overrides,
  };
}

// ==============================================
// PAYMENT — Selected Payment Method (Store)
// ==============================================

export function createMockSelectedPaymentMethod(
  type: 'upi' | 'card' | 'netbanking',
  overrides?: Partial<SelectedPaymentMethod>
): SelectedPaymentMethod {
  const defaults: Record<PaymentMethodType, SelectedPaymentMethod> = {
    upi: {
      id: nextId('pm'),
      type: 'upi',
      displayName: 'rishabh@okicici',
    },
    card: {
      id: nextId('pm'),
      type: 'card',
      displayName: 'Visa ending 4242',
      last4: '4242',
      isPrimary: true,
    },
    netbanking: {
      id: nextId('pm'),
      type: 'netbanking',
      displayName: 'HDFC Bank',
    },
  };

  return { ...defaults[type], ...overrides };
}

// ==============================================
// PAYMENT — Cashback Discount
// ==============================================

export function createMockCashbackDiscount(
  overrides?: Partial<CashbackDiscount>
): CashbackDiscount {
  return {
    discount_paise: 20000,
    discount_rupees: 200,
    verification_complete: true,
    past_cutoff: false,
    cutoff_day: 7,
    reason: null,
    ...overrides,
  };
}

// ==============================================
// PAYMENT — Check Payment Status
// ==============================================

export function createMockCheckPaymentStatus(
  overrides?: Partial<CheckPaymentStatusResponse>
): CheckPaymentStatusResponse {
  return {
    payment_id: nextId('pay'),
    status: 'success',
    gateway_verified: true,
    amount_paise: 2500000,
    cashback_earned_paise: 20000,
    paid_at: '2026-02-05T10:30:00Z',
    error_message: null,
    ...overrides,
  };
}

// ==============================================
// PAYMENT — Payment Stamps
// ==============================================

export function createMockPaymentStampEntry(
  overrides?: Partial<PaymentStampEntry>
): PaymentStampEntry {
  return {
    month: '2026-02',
    month_display: 'February 2026',
    status: 'on_time',
    payment_id: nextId('pay'),
    paid_at: '2026-02-05T10:30:00Z',
    due_date: '2026-02-10',
    days_late: null,
    amount_paise: 2500000,
    cashback_applied_paise: 20000,
    cashback_earned: 200,
    ...overrides,
  };
}

export function createMockPaymentStamps(
  overrides?: Partial<PaymentStampsResponse>
): PaymentStampsResponse {
  return {
    stamps: [
      createMockPaymentStampEntry({ month: '2026-01', month_display: 'January 2026' }),
      createMockPaymentStampEntry({ month: '2026-02', month_display: 'February 2026' }),
    ],
    summary: {
      total_months: 2,
      on_time: 2,
      late: 0,
      missed: 0,
      pending: 0,
    },
    ...overrides,
  };
}

// ==============================================
// AGREEMENT & UPLOAD
// ==============================================

export function createMockExtractionStatus(
  status: ExtractionStatus,
  overrides?: Partial<ExtractionStatusData>
): ExtractionStatusData {
  const defaults: Record<ExtractionStatus, ExtractionStatusData> = {
    pending: {
      extractionId: nextId('ext'),
      extractionStatus: 'pending',
      contractStatus: 'uploading',
      isCitySupported: true,
      extractionError: null,
      needsManualReview: false,
      updatedAt: isoNow(),
      userVerified: false,
    },
    processing: {
      extractionId: nextId('ext'),
      extractionStatus: 'processing',
      contractStatus: 'uploading',
      isCitySupported: true,
      extractionError: null,
      needsManualReview: false,
      updatedAt: isoNow(),
      userVerified: false,
    },
    completed: {
      extractionId: nextId('ext'),
      extractionStatus: 'completed',
      contractStatus: 'user_review',
      isCitySupported: true,
      extractionError: null,
      needsManualReview: false,
      updatedAt: isoNow(),
      userVerified: false,
    },
    failed: {
      extractionId: nextId('ext'),
      extractionStatus: 'failed',
      contractStatus: 'uploading',
      isCitySupported: true,
      extractionError: 'OCR extraction failed',
      needsManualReview: false,
      updatedAt: isoNow(),
      userVerified: false,
    },
    extraction_failed: {
      extractionId: nextId('ext'),
      extractionStatus: 'extraction_failed',
      contractStatus: 'uploading',
      isCitySupported: true,
      extractionError: 'Pipeline error',
      needsManualReview: false,
      updatedAt: isoNow(),
      userVerified: false,
    },
  };

  return { ...defaults[status], ...overrides };
}

export interface MockUploadState {
  extractionId: string | null;
  uploadPhase: UploadPhase;
  fileName: string | null;
  lastUpdatedAt: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export function createMockUploadState(
  phase: UploadPhase,
  overrides?: Partial<MockUploadState>
): MockUploadState {
  const defaults: Record<UploadPhase, MockUploadState> = {
    idle: {
      extractionId: null,
      uploadPhase: 'idle',
      fileName: null,
      lastUpdatedAt: 0,
      errorCode: null,
      errorMessage: null,
    },
    requesting_url: {
      extractionId: null,
      uploadPhase: 'requesting_url',
      fileName: 'RentalAgreement_Feb2026.pdf',
      lastUpdatedAt: Date.now(),
      errorCode: null,
      errorMessage: null,
    },
    uploading_file: {
      extractionId: nextId('ext'),
      uploadPhase: 'uploading_file',
      fileName: 'RentalAgreement_Feb2026.pdf',
      lastUpdatedAt: Date.now(),
      errorCode: null,
      errorMessage: null,
    },
    processing: {
      extractionId: nextId('ext'),
      uploadPhase: 'processing',
      fileName: 'RentalAgreement_Feb2026.pdf',
      lastUpdatedAt: Date.now(),
      errorCode: null,
      errorMessage: null,
    },
    server_processing: {
      extractionId: nextId('ext'),
      uploadPhase: 'server_processing',
      fileName: 'RentalAgreement_Feb2026.pdf',
      lastUpdatedAt: Date.now(),
      errorCode: null,
      errorMessage: null,
    },
    completed: {
      extractionId: nextId('ext'),
      uploadPhase: 'completed',
      fileName: 'RentalAgreement_Feb2026.pdf',
      lastUpdatedAt: Date.now(),
      errorCode: null,
      errorMessage: null,
    },
    failed: {
      extractionId: nextId('ext'),
      uploadPhase: 'failed',
      fileName: 'RentalAgreement_Feb2026.pdf',
      lastUpdatedAt: Date.now(),
      errorCode: 'UPLOAD_FAILED',
      errorMessage: 'Upload failed. Please try again.',
    },
  };

  return { ...defaults[phase], ...overrides };
}

// ==============================================
// DASHBOARD
// ==============================================

export function createMockDashboardUser(
  overrides?: Partial<DashboardUser>
): DashboardUser {
  return {
    id: nextId('usr'),
    first_name: 'Rishabh',
    last_name: 'Sharma',
    phone: '+919876543210',
    email: 'rishabh@flent.in',
    role: 'tenant',
    user_status: 'active',
    kyc_status: 'verified',
    cashback_balance_paise: 32500,
    ...overrides,
  };
}

export function createMockTenancy(
  overrides?: Partial<DashboardTenancy>
): DashboardTenancy {
  return {
    id: nextId('ten'),
    status: 'active',
    property_address: '42 MG Road, Indiranagar, Bangalore 560038',
    property_city: 'Bangalore',
    monthly_rent: 25000,
    rent_due_day: 5,
    cashback_cutoff_day: 7,
    lease_end_date: '2027-01-31',
    lease_start_date: '2026-02-01',
    agreement_cert_id: 'KA-BLR-2025-001234',
    landlord_name: 'Priya Krishnamurthy',
    verification_status: {
      bank_verified: true,
      utility_verified: true,
      landlord_approved: true,
    },
    ...overrides,
  };
}

export function createMockDashboardData(
  overrides?: Partial<DashboardData>
): DashboardData {
  return {
    user: createMockDashboardUser(),
    tenancy: createMockTenancy(),
    upcoming_payment: {
      due_date: '2026-03-05',
      amount: 25000,
      amount_paise: 2500000,
      days_until_due: 7,
      is_overdue: false,
      cashback_eligible: true,
      past_cutoff: false,
      cutoff_day: 7,
      rent_month: '2026-03-01',
    },
    cashback: {
      discount_rate: 0.008,
      max_discount_paise: 20000,
      max_discount: 200,
      verification_complete: true,
      total_savings_paise: 120000,
      total_savings: 1200,
      legacy_wallet_balance: 0,
    },
    recent_payments: [
      {
        id: nextId('pay'),
        amount: 25000,
        status: 'success',
        rent_month: '2026-02-01',
        paid_at: '2026-02-05T10:30:00Z',
        cashback_earned: 200,
        cashback_applied: 200,
      },
    ],
    landlord_bank: null,
    notifications: [],
    unread_notification_count: 0,
    payment_stamps: {
      summary: {
        on_time: 3,
        late: 0,
        missed: 0,
        pending: 1,
        total_months: 4,
      },
      current_month_status: 'pending',
    },
    ...overrides,
  };
}

// ==============================================
// WAITLIST
// ==============================================

export function createMockWaitlistStatus(
  state: 'pending' | 'pending_long' | 'approved' | 'rejected',
  overrides?: Partial<WaitlistStatusData>
): WaitlistStatusData {
  const defaults: Record<string, WaitlistStatusData> = {
    pending: {
      state: 'pending',
      userStatus: 'signed_up',
      contractStatus: 'uploading',
      position: 142,
      estimatedWaitDays: 3,
      submissionDate: '15 Feb 2026',
      currentOnboarded: 58,
      totalMemberSlots: 200,
      estimatedReviewTime: 'Approximately 24 hrs',
      rejectionReasons: [],
      nextApplicationCountdown: 0,
      hasInviteCode: false,
      batchNumber: null,
      currentBatch: 1,
      rejectionCooldownDays: 30,
      requiresManualReview: false,
      extractionStatus: null,
      extractionId: null,
      fileName: null,
      requiresReupload: false,
      reuploadMessage: null,
    },
    pending_long: {
      state: 'pending_long',
      userStatus: 'signed_up',
      contractStatus: 'manual_review',
      position: 142,
      estimatedWaitDays: 5,
      submissionDate: '15 Feb 2026',
      currentOnboarded: 58,
      totalMemberSlots: 200,
      estimatedReviewTime: 'Approximately 24-48 hrs',
      rejectionReasons: [],
      nextApplicationCountdown: 0,
      hasInviteCode: false,
      batchNumber: null,
      currentBatch: 1,
      rejectionCooldownDays: 30,
      requiresManualReview: false,
      extractionStatus: null,
      extractionId: null,
      fileName: null,
      requiresReupload: false,
      reuploadMessage: null,
    },
    approved: {
      state: 'approved',
      userStatus: 'approved',
      contractStatus: 'user_review',
      position: null,
      estimatedWaitDays: null,
      submissionDate: '15 Feb 2026',
      currentOnboarded: 59,
      totalMemberSlots: 200,
      estimatedReviewTime: 'Approximately 24 hrs',
      rejectionReasons: [],
      nextApplicationCountdown: 0,
      hasInviteCode: true,
      batchNumber: 1,
      currentBatch: 1,
      rejectionCooldownDays: 30,
      requiresManualReview: false,
      extractionStatus: null,
      extractionId: null,
      fileName: null,
      requiresReupload: false,
      reuploadMessage: null,
    },
    rejected: {
      state: 'rejected',
      userStatus: 'signed_up',
      contractStatus: 'invalid_document',
      position: null,
      estimatedWaitDays: null,
      submissionDate: '15 Feb 2026',
      currentOnboarded: 58,
      totalMemberSlots: 200,
      estimatedReviewTime: 'Approximately 24 hrs',
      rejectionReasons: ['Document verification failed. Please re-upload.'],
      nextApplicationCountdown: 2592000,
      hasInviteCode: false,
      batchNumber: null,
      currentBatch: 1,
      rejectionCooldownDays: 30,
      requiresManualReview: false,
      extractionStatus: null,
      extractionId: null,
      fileName: null,
      requiresReupload: true,
      reuploadMessage: 'Document verification failed. Please re-upload.',
    },
  };

  return { ...defaults[state], ...overrides };
}

// ==============================================
// SETUP
// ==============================================

export function createMockSetupProgress(
  overrides?: Partial<SetupProgress>
): SetupProgress {
  return {
    steps: [
      {
        id: 'bank',
        type: 'bank',
        title: 'Add bank details',
        subtitle: 'For rent payouts',
        icon: 'building-columns',
        isCompleted: true,
        route: '/(agreement)/add-bank-details',
      },
      {
        id: 'utility',
        type: 'utility',
        title: 'Verify address',
        subtitle: 'Via electricity bill',
        icon: 'bolt',
        isCompleted: false,
        route: '/(setup)/add-utility',
      },
      {
        id: 'landlord',
        type: 'landlord',
        title: 'Invite landlord',
        subtitle: 'To approve tenancy',
        icon: 'user-plus',
        isCompleted: false,
        route: '/(setup)/invite-landlord',
      },
    ],
    currentStepIndex: 1,
    landlordStatus: { type: 'none' },
    completedCount: 1,
    totalCount: 3,
    ...overrides,
  };
}

// ==============================================
// LIST / BATCH GENERATORS
// ==============================================

/**
 * Generate a list of payment history items with sequential months.
 */
export function createMockPaymentHistoryList(count: number): PaymentHistoryItem[] {
  return Array.from({ length: count }, (_, i) => {
    const month = String(12 - (i % 12)).padStart(2, '0');
    const year = 2026 - Math.floor(i / 12);
    return createMockPaymentHistoryItem({
      rent_month: `${year}-${month}`,
      created_at: `${year}-${month}-05T10:00:00Z`,
      paid_at: `${year}-${month}-05T10:30:00Z`,
    });
  });
}

/**
 * Generate a list of saved payment methods -- one of each type.
 */
export function createMockSavedMethodsList(): SavedPaymentMethod[] {
  return [
    createMockSavedPaymentMethod('upi', { is_default: true }),
    createMockSavedPaymentMethod('card'),
    createMockSavedPaymentMethod('netbanking'),
  ];
}
