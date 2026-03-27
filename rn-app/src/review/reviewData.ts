/**
 * Apple Review Mode — Hardcoded Mock Responses
 *
 * Every edge function response the reviewer might trigger, keyed by base function name.
 * Shapes match the RAW edge function responses (snake_case, before client-side mapping).
 */

// ── Review User ──

export const reviewUser = {
  id: 'review-user-id',
  first_name: 'Alex',
  last_name: 'Reviewer',
  phone: '+919999900001',
  email: 'reviewer@flent.in',
  role: 'tenant',
  user_status: 'active',
  kyc_status: 'verified',
  cashback_balance_paise: 32500,
  avatar_url: null,
  is_role_locked: false,
  created_at: '2026-01-01T00:00:00Z',
};

const REVIEW_TENANCY_ID = 'review-tenancy-001';
const REVIEW_PAYMENT_ID = 'review-pay-001';

// ── Mock Responses (raw edge function shapes) ──

const reviewResponses: Record<string, unknown> = {
  // ─── Dashboard ───
  'dashboard-data': {
    user: reviewUser,
    tenancy: {
      id: REVIEW_TENANCY_ID,
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
    },
    upcoming_payment: {
      due_date: '2026-03-05',
      amount: 25000,
      amount_paise: 2500000,
      days_until_due: 4,
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
        id: REVIEW_PAYMENT_ID,
        amount: 25000,
        status: 'success',
        rent_month: '2026-02-01',
        paid_at: '2026-02-05T10:30:00Z',
        cashback_earned: 200,
      },
      {
        id: 'review-pay-002',
        amount: 25000,
        status: 'success',
        rent_month: '2026-01-01',
        paid_at: '2026-01-04T09:15:00Z',
        cashback_earned: 200,
      },
    ],
    landlord_bank: null,
    notifications: [],
    unread_notification_count: 0,
    payment_stamps: {
      summary: {
        on_time: 2,
        late: 0,
        missed: 0,
        pending: 1,
        total_months: 3,
      },
      current_month_status: 'pending',
    },
  },

  // ─── Payment: Initiate ───
  'initiate-payment': {
    payment_id: 'review-pay-new',
    txn_id: 'review-txn-001',
    total_amount_paise: 2500000,
    cashback_applied_paise: 20000,
    demo_mode: true,
  },

  // ─── Payment: Check Status ───
  'check-payment-status': {
    payment_id: 'review-pay-new',
    status: 'success',
    gateway_verified: true,
    amount_paise: 2500000,
    cashback_earned_paise: 20000,
    paid_at: new Date().toISOString(),
    error_message: null,
  },

  // ─── Payment: Fee Config ───
  'get-fee-config': {
    fee_rates: {
      upi: { rate: 0, fee_type: 'percentage' },
      credit_card: { rate: 0.0185, fee_type: 'percentage' },
      debit_card: { rate: 0.009, fee_type: 'percentage' },
      netbanking: { rate: 1500, fee_type: 'flat_paise' },
    },
  },

  // ─── Payment: History ───
  'get-payment-history': {
    payments: [
      {
        id: REVIEW_PAYMENT_ID,
        amount: 25000,
        pg_fee: 0,
        cashback_applied: 200,
        cashback_earned: 200,
        net_amount: 24800,
        amount_paise: 2500000,
        pg_fee_paise: 0,
        cashback_applied_paise: 20000,
        status: 'success',
        payment_method: 'upi',
        rent_month: '2026-02',
        created_at: '2026-02-05T10:00:00Z',
        paid_at: '2026-02-05T10:30:00Z',
        can_download_receipt: true,
        tenancy: {
          id: REVIEW_TENANCY_ID,
          property_address: '42 MG Road, Indiranagar, Bangalore 560038',
          landlord_name: 'Priya Krishnamurthy',
        },
      },
      {
        id: 'review-pay-002',
        amount: 25000,
        pg_fee: 0,
        cashback_applied: 200,
        cashback_earned: 200,
        net_amount: 24800,
        amount_paise: 2500000,
        pg_fee_paise: 0,
        cashback_applied_paise: 20000,
        status: 'success',
        payment_method: 'upi',
        rent_month: '2026-01',
        created_at: '2026-01-04T09:00:00Z',
        paid_at: '2026-01-04T09:15:00Z',
        can_download_receipt: true,
        tenancy: {
          id: REVIEW_TENANCY_ID,
          property_address: '42 MG Road, Indiranagar, Bangalore 560038',
          landlord_name: 'Priya Krishnamurthy',
        },
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      total_pages: 1,
      has_next: false,
      has_previous: false,
    },
    summary: {
      total_paid: 50000,
      total_cashback_earned: 400,
      successful_payments: 2,
      failed_payments: 0,
    },
  },

  // ─── Payment: Receipt (raw snake_case — mapRawReceiptData converts) ───
  'generate-receipt': {
    receipt_number: 'FLENT-R-2026-00142',
    generated_at: '2026-02-05T10:30:00Z',
    payment: {
      id: REVIEW_PAYMENT_ID,
      transaction_id: 'review-txn-001',
      gateway_id: 'review-pg-001',
      amount: 25000,
      pg_fee: 0,
      cashback_applied: 200,
      cashback_earned: 200,
      net_amount_paid: 24800,
      payment_method: 'upi',
      status: 'success',
      rent_month: '2026-02',
      rent_month_display: 'February 2026',
      paid_at: '2026-02-05T10:30:00Z',
      utr: 'UTR202602051030REVIEW',
      timeliness: 'on_time',
    },
    tenant: {
      name: 'Alex Reviewer',
      phone: '+919999900001',
      email: 'reviewer@flent.in',
      pan_masked: 'ABCPA****R',
    },
    property: {
      address: '42 MG Road, Indiranagar, Bangalore 560038',
      city: 'Bangalore',
    },
    landlord: {
      name: 'Priya Krishnamurthy',
      bank_account_masked: '****5678',
      pan_masked: 'ABCPK****Z',
    },
    agreement: {
      cert_id: 'KA-BLR-2025-001234',
    },
    company: {
      name: 'Flent Secured',
      gstin: '29AABCT1332L1ZI',
    },
  },

  // ─── Payment: Saved Methods ───
  'get-saved-payment-methods': {
    payment_methods: [
      {
        id: 'review-pm-upi',
        type: 'upi',
        display_name: 'UPI - ICICI',
        is_primary: true,
        is_verified: true,
        nickname: 'UPI - ICICI',
        created_at: '2026-01-15T10:00:00Z',
        upi_vpa: 'reviewer@okicici',
        upi_provider: 'ICICI',
      },
      {
        id: 'review-pm-card',
        type: 'card',
        display_name: 'Visa ****4242',
        is_primary: false,
        is_verified: true,
        nickname: 'Visa ****4242',
        created_at: '2026-01-15T10:00:00Z',
        card_last4: '4242',
        card_network: 'visa',
        card_type: 'credit',
        card_issuer: 'HDFC Bank',
        card_expiry_month: 12,
        card_expiry_year: 2028,
        is_expired: false,
      },
    ],
    primary_method_id: 'review-pm-upi',
    grouped_methods: {
      upi: [
        {
          id: 'review-pm-upi',
          type: 'upi',
          display_name: 'UPI - ICICI',
          is_primary: true,
          is_verified: true,
          nickname: 'UPI - ICICI',
          created_at: '2026-01-15T10:00:00Z',
          upi_vpa: 'reviewer@okicici',
          upi_provider: 'ICICI',
        },
      ],
      cards: [
        {
          id: 'review-pm-card',
          type: 'card',
          display_name: 'Visa ****4242',
          is_primary: false,
          is_verified: true,
          nickname: 'Visa ****4242',
          created_at: '2026-01-15T10:00:00Z',
          card_last4: '4242',
          card_network: 'visa',
          card_type: 'credit',
          card_issuer: 'HDFC Bank',
          card_expiry_month: 12,
          card_expiry_year: 2028,
          is_expired: false,
        },
      ],
      netbanking: [],
    },
    total_count: 2,
  },

  // ─── Payment: Stamps ───
  'get-payment-stamps': {
    stamps: [
      {
        month: '2026-01',
        month_display: 'January 2026',
        status: 'on_time',
        payment_id: 'review-pay-002',
        paid_at: '2026-01-04T09:15:00Z',
        due_date: '2026-01-05',
        days_late: null,
        amount_paise: 2500000,
        cashback_earned: 200,
      },
      {
        month: '2026-02',
        month_display: 'February 2026',
        status: 'on_time',
        payment_id: REVIEW_PAYMENT_ID,
        paid_at: '2026-02-05T10:30:00Z',
        due_date: '2026-02-05',
        days_late: null,
        amount_paise: 2500000,
        cashback_earned: 200,
      },
      {
        month: '2026-03',
        month_display: 'March 2026',
        status: 'pending',
        payment_id: null,
        paid_at: null,
        due_date: '2026-03-05',
        days_late: null,
        amount_paise: null,
        cashback_earned: 0,
      },
    ],
    summary: {
      total_months: 3,
      on_time: 2,
      late: 0,
      missed: 0,
      pending: 1,
    },
  },

  // ─── Payment: PayU Stored Cards ───
  'get-payu-stored-cards': {
    cards: [],
  },

  // ─── Payment: Netbanking Banks ───
  'get-netbanking-banks': {
    banks: [
      { bank_code: 'HDFCB', bank_name: 'HDFC Bank', short_name: 'HDFC', is_popular: true },
      { bank_code: 'ICICI', bank_name: 'ICICI Bank', short_name: 'ICICI', is_popular: true },
      { bank_code: 'SBIN', bank_name: 'State Bank of India', short_name: 'SBI', is_popular: true },
      { bank_code: 'AXIB', bank_name: 'Axis Bank', short_name: 'Axis', is_popular: true },
      { bank_code: 'KOTMB', bank_name: 'Kotak Mahindra Bank', short_name: 'Kotak', is_popular: false },
    ],
    total_count: 5,
  },

  // ─── Payment: Cashback / Savings ───
  'calculate-cashback': {
    discount_rate: 0.008,
    total_savings_paise: 40000,
    total_savings: 400,
    discount_count: 2,
    legacy_wallet_balance_paise: 0,
    legacy_wallet_balance: 0,
    history: [
      {
        id: 'review-cb-001',
        type: 'discount',
        amount_paise: 20000,
        amount: 200,
        payment_id: REVIEW_PAYMENT_ID,
        description: 'Early payment discount - February 2026',
        created_at: '2026-02-05T10:30:00Z',
      },
      {
        id: 'review-cb-002',
        type: 'discount',
        amount_paise: 20000,
        amount: 200,
        payment_id: 'review-pay-002',
        description: 'Early payment discount - January 2026',
        created_at: '2026-01-04T09:15:00Z',
      },
    ],
  },

  // ─── Payment: Add UPI ───
  'add-upi-vpa': {
    payment_method_id: 'review-pm-upi-new',
    upi_vpa: 'reviewer@okicici',
    upi_provider: 'ICICI',
    is_verified: true,
    is_primary: false,
    nickname: 'UPI - ICICI',
    is_valid: true,
    account_holder_name: 'Alex Reviewer',
  },

  // ─── Payment: Add Card ───
  'add-card-token': {
    payment_method_id: 'review-pm-card-new',
    card_last4: '4242',
    card_network: 'visa',
    card_type: 'credit',
    card_issuer: 'HDFC Bank',
    card_expiry_month: 12,
    card_expiry_year: 2028,
    is_primary: false,
    nickname: 'Visa ****4242',
  },

  // ─── Payment: Delete Method ───
  'delete-payment-method': {
    deleted_id: 'review-pm-deleted',
    was_primary: false,
    new_primary_id: 'review-pm-upi',
    hard_deleted: true,
  },

  // ─── Payment: Set Default ───
  'set-default-payment-method': {},

  // ─── Payment: Save Bank Preference ───
  'save-bank-preference': {
    payment_method_id: 'review-pm-nb-new',
    bank_code: 'HDFCB',
    bank_name: 'HDFC Bank',
  },

  // ─── Payment: BIN Info ───
  'get-bin-info': {
    bin: '424242',
    is_domestic: true,
    issuing_bank: 'HDFC Bank',
    card_type: 'credit',
    card_brand: 'visa',
  },

  // ─── Payment: Verify Card ───
  'verify-card': {
    payment_id: 'review-verify-001',
    txn_id: 'review-verify-txn',
    payu: {},
  },

  // ─── Payment: Schedule ───
  'schedule-payment': {
    schedule_id: 'review-sched-001',
    new_status: 'active',
  },

  'get-payment-schedule': {
    schedules: [],
  },

  // ─── Profile ───
  'update-profile': {
    user_id: 'review-user-id',
    full_name: 'Alex Reviewer',
    first_name: 'Alex',
    last_name: 'Reviewer',
    email: 'reviewer@flent.in',
    avatar_url: null,
    updated_at: new Date().toISOString(),
  },

  // ─── Profile: Delete Account ───
  'delete-account': {
    message: 'Your account has been deleted successfully.',
    archived_at: new Date().toISOString(),
  },

  // ─── Waitlist (shouldn't be hit, but safe) ───
  'get-waitlist-status': {
    has_entry: true,
    user_status: 'active',
    waitlist_entry: {
      status: 'approved',
      extraction_status: 'completed',
      contract_status: 'confirmed',
      requires_manual_review: false,
      manual_review_reason: null,
      waitlist_position: null,
      document_uploaded: true,
      admin_review: true,
      rejection_reasons: [],
      created_at: '2026-01-01T00:00:00Z',
      has_invite_code: true,
      batch_number: 1,
    },
    batch_config: {
      current_batch: 1,
      rejection_cooldown_days: 30,
    },
    extraction_status: 'completed',
    requires_manual_review: false,
  },

  // ─── Identity (shouldn't be hit, but safe) ───
  'verify-identity': {
    consent_id: 'review-consent-001',
    status: 'completed',
    message: 'Identity verified',
    already_exists: true,
    verification_id: 'review-verify-001',
    name: 'Alex Reviewer',
    has_pan: true,
    has_aadhaar: true,
    credit_score: null,
    risk_safe: true,
  },

  // ─── Setup (shouldn't be hit, but safe) ───
  'verify-bank': {
    bank_account_id: 'review-bank-001',
    verified: true,
    account_number_masked: '****5678',
    ifsc_code: 'HDFC0001234',
    verified_name: 'Priya Krishnamurthy',
    name_match_score: 100,
    verification_status: 'verified',
    bank_name: 'HDFC Bank',
    branch: 'Indiranagar Branch',
    message: 'Bank account verified',
    agreement_name_matched: true,
    matched_landlord_name: 'Priya Krishnamurthy',
  },

  'verify-pan': {
    pan_verified: true,
    pan_valid: true,
    pan_type: 'individual',
    registered_name: 'Priya Krishnamurthy',
    name_matched: true,
    name_match_score: 100,
    matched_landlord_name: 'Priya Krishnamurthy',
    message: 'PAN verified',
  },

  'verify-utility': {
    verification_id: 'review-util-001',
    verified: true,
    name_verified: true,
    address_verified: true,
    bank_name_verified: true,
    consumer_name: 'Alex Reviewer',
    landlord_name: 'Priya Krishnamurthy',
    name_match_score: 95,
    address_match_score: 90,
    bank_name_match_score: 100,
    bank_account_holder_name: 'Priya Krishnamurthy',
    match_threshold: 80,
    bill_amount: 2500,
    bill_due_date: '2026-03-15',
    message: 'Utility verified',
    matching_method: 'fuzzy',
  },

  'send-landlord-invite': {
    already_approved: true,
    status: 'approved',
    message: 'Landlord already approved',
  },

  // ─── Agreement: Update Extraction ───
  'update-extraction': {
    extraction_id: 'review-ext-001',
    modified_fields: ['monthly_rent', 'rent_due_day'],
    success: true,
  },

  // ─── Agreement (shouldn't be hit, but safe) ───
  'upload-document': {
    upload_url: 'https://example.com/review-upload',
    extracted_rental_info_id: 'review-ext-001',
    document_path: 'documents/review-doc.pdf',
    download_url: 'https://example.com/review-download',
  },

  'process-document': {
    extracted_rental_info_id: 'review-ext-001',
    confidence_score: 0.95,
    needs_manual_review: false,
    contract_status: 'completed',
    is_city_supported: true,
    extraction_status: 'completed',
    fields_extracted: 10,
    total_fields: 10,
  },

  'confirm-extraction': {
    extraction_id: 'review-ext-001',
    confirmed_role: 'tenant',
    contract_status: 'confirmed',
    tenancy_id: REVIEW_TENANCY_ID,
    user_status: 'active',
  },

  // ─── Referral (shouldn't be hit, but safe) ───
  'get-my-referral-code': {
    code: 'REVIEW2026',
    usage_count: 0,
    max_uses: 5,
    reward_amount_paise: 10000,
  },

  'apply-referral-code': {
    code: 'REVIEW2026',
    reward_type: 'cashback',
    rewards: { cashback_paise: 10000, cashback_rupees: 100, priority_boost: false },
    message: 'Referral code applied',
  },

  'validate-referral-code': {
    is_valid: true,
    code: 'REVIEW2026',
    reward_type: 'cashback',
    message: 'Valid referral code',
  },

  'join-waitlist': {
    entry_id: 'review-wl-001',
    position: 1,
    is_new: false,
  },

  'claim-invite-code': {
    code: 'REVIEW-INVITE',
    message: 'Invite code claimed',
  },

  // ─── Auth OTP (intercepted directly in auth.ts, but safe fallback) ───
  'auth-otp': {
    method: 'supabase',
  },

  // ─── Notifications ───
  'broadcast-app-update': {},

  // ─── Device Token Registration (fired on SIGNED_IN) ───
  'register-device-token': {
    registered: true,
  },

  // ─── Utility Operators (verify-utility?action=operators) ───
  'verify-utility?action=operators': {
    operators: [
      { operator_code: 'BESCOM', operator_name: 'BESCOM - Bangalore', state: 'Karnataka', params: ['consumer_number'] },
      { operator_code: 'MSEDCL', operator_name: 'MSEDCL - Maharashtra', state: 'Maharashtra', params: ['consumer_number'] },
      { operator_code: 'TPDDL', operator_name: 'Tata Power DDL - Delhi', state: 'Delhi', params: ['ca_number'] },
    ],
    count: 3,
  },
};

export function getReviewResponse(functionName: string): unknown {
  // Check full name first (e.g. 'verify-utility?action=operators' has its own mock)
  if (reviewResponses[functionName] !== undefined) {
    return reviewResponses[functionName];
  }
  // Then strip query params (e.g. 'generate-receipt?payment_id=xxx' → 'generate-receipt')
  const baseName = functionName.split('?')[0];
  return reviewResponses[baseName] ?? {};
}
