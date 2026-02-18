/**
 * Flent Secured v2 - Test Mode Support (MD-131)
 *
 * Provides test mode detection and mock data generation for CI testing.
 * When X-Test-Mode: true header is present, functions return seeded mock
 * data instead of hitting the real database.
 *
 * Usage:
 *   import { isTestMode, getTestUserId, mockData } from "../_shared/test-mode.ts";
 *
 *   if (isTestMode(req)) {
 *     return jsonResponse({ success: true, data: mockData.dashboard });
 *   }
 */

// ==============================================
// TEST MODE DETECTION
// ==============================================

/**
 * Checks if the request is in test mode.
 * Only enabled when X-Test-Mode header is "true".
 * In production, test mode is always disabled for safety.
 */
export function isTestMode(request: Request): boolean {
  const isProduction = Deno.env.get("ENVIRONMENT") === "production";
  if (isProduction) return false;

  return request.headers.get("X-Test-Mode")?.toLowerCase() === "true";
}

/**
 * Returns a deterministic test user ID for consistent mock data.
 */
export function getTestUserId(): string {
  return "00000000-0000-0000-0000-000000000001";
}

/**
 * Returns a deterministic test tenancy ID.
 */
export function getTestTenancyId(): string {
  return "00000000-0000-0000-0000-000000000010";
}

/**
 * Returns a deterministic test payment ID.
 */
export function getTestPaymentId(): string {
  return "00000000-0000-0000-0000-000000000020";
}

// ==============================================
// MOCK DATA GENERATORS
// ==============================================

const TEST_NOW = "2026-02-17T10:00:00.000Z";

export const mockData = {
  /**
   * Mock user profile.
   */
  user: {
    id: getTestUserId(),
    first_name: "Test",
    last_name: "Tenant",
    phone: "+919876543210",
    email: "test@flentsecured.com",
    role: "tenant",
    is_role_locked: false,
    user_status: "active",
    kyc_status: "verified",
    cashback_balance_paise: 150000,
    created_at: "2026-01-01T00:00:00.000Z",
  },

  /**
   * Mock tenancy.
   */
  tenancy: {
    id: getTestTenancyId(),
    user_id: getTestUserId(),
    status: "active",
    property_address: "Flat 302, Sunrise Apartments, HSR Layout",
    property_city: "Bangalore",
    monthly_rent_paise: 2500000,
    rent_due_day: 5,
    lease_start_date: "2026-01-01",
    lease_end_date: "2027-01-01",
    landlord_name: "Test Landlord",
    landlord_phone: "+919876543211",
    landlord_email: "landlord@test.com",
    bank_verified: true,
    utility_verified: true,
    landlord_approved: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: TEST_NOW,
  },

  /**
   * Mock landlord details.
   */
  landlord: {
    name: "Test Landlord",
    phone: "+919876543211",
    email: "landlord@test.com",
    bank_account_masked: "XXXXXXXXXX1234",
    tenancy_id: getTestTenancyId(),
  },

  /**
   * Mock payment.
   */
  payment: {
    id: getTestPaymentId(),
    tenancy_id: getTestTenancyId(),
    user_id: getTestUserId(),
    amount_paise: 2500000,
    pg_fee_paise: 5000,
    cashback_applied_paise: 0,
    cashback_earned_paise: 25000,
    status: "success",
    payu_txn_id: "TEST-TXN-001",
    payu_mihpayid: "TEST-MIH-001",
    payment_method: "upi",
    rent_month: "2026-02-01",
    paid_at: TEST_NOW,
    created_at: TEST_NOW,
  },

  /**
   * Mock cashback summary.
   */
  cashback: {
    total_earned_paise: 200000,
    available_balance_paise: 150000,
    total_redeemed_paise: 50000,
    entries: [
      {
        id: "00000000-0000-0000-0000-000000000030",
        transaction_type: "earned",
        amount_paise: 25000,
        balance_after_paise: 150000,
        description: "1% cashback earned on rent payment for February 2026",
        payment_id: getTestPaymentId(),
        tenancy_id: getTestTenancyId(),
        created_at: TEST_NOW,
        expires_at: "2026-05-18T10:00:00.000Z",
      },
      {
        id: "00000000-0000-0000-0000-000000000031",
        transaction_type: "redeemed",
        amount_paise: 50000,
        balance_after_paise: 125000,
        description: "Cashback applied to January 2026 rent",
        payment_id: null,
        tenancy_id: getTestTenancyId(),
        created_at: "2026-01-05T10:00:00.000Z",
        expires_at: null,
      },
    ],
  },

  /**
   * Mock agreement.
   */
  agreement: {
    id: "00000000-0000-0000-0000-000000000040",
    tenancy_id: getTestTenancyId(),
    status: "active",
    version: 1,
    transitions: [
      { from: "draft", to: "pending_review", at: "2026-01-01T00:00:00.000Z" },
      { from: "pending_review", to: "active", at: "2026-01-02T00:00:00.000Z" },
    ],
  },

  /**
   * Mock receipt data.
   */
  receipt: {
    receipt_number: "FS-202602-TEST0020",
    generated_at: TEST_NOW,
    payment: {
      id: getTestPaymentId(),
      transaction_id: "TEST-TXN-001",
      payment_gateway_id: "TEST-MIH-001",
      amount: 25000,
      pg_fee: 50,
      cashback_applied: 0,
      cashback_earned: 250,
      net_amount_paid: 25000,
      payment_method: "UPI",
      status: "success",
      rent_month: "2026-02-01",
      rent_month_display: "February 2026",
      paid_at: TEST_NOW,
    },
    tenant: {
      name: "Test Tenant",
      phone: "+919876543210",
      email: "test@flentsecured.com",
    },
    property: {
      address: "Flat 302, Sunrise Apartments, HSR Layout",
      city: "Bangalore",
    },
    landlord: {
      name: "Test Landlord",
      bank_account_masked: "XXXXXXXXXX1234",
    },
    tax: {
      subtotal: 25000,
      gst_rate: 0.18,
      gst_amount: 4500,
      total_with_tax: 29500,
      hsn_sac_code: "997212",
    },
    company: {
      name: "Flent Technologies Private Limited",
      address: "Bangalore, Karnataka, India",
      gstin: "29TESTGSTIN1Z5",
      support_email: "support@flentsecured.com",
      support_phone: "+918001234567",
    },
  },

  /**
   * Mock dashboard aggregate.
   */
  dashboard: {
    user: {
      id: getTestUserId(),
      first_name: "Test",
      last_name: "Tenant",
      phone: "+919876543210",
      email: "test@flentsecured.com",
      role: "tenant",
      is_role_locked: false,
      user_status: "active",
      kyc_status: "verified",
      cashback_balance_paise: 150000,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    tenancy: {
      id: getTestTenancyId(),
      status: "active",
      property_address: "Flat 302, Sunrise Apartments, HSR Layout",
      property_city: "Bangalore",
      monthly_rent: 25000,
      rent_due_day: 5,
      lease_end_date: "2027-01-01",
      landlord_name: "Test Landlord",
      verification_status: {
        bank_verified: true,
        utility_verified: true,
        landlord_approved: true,
      },
    },
    upcoming_payment: {
      due_date: "2026-03-05",
      amount: 25000,
      amount_paise: 2500000,
      days_until_due: 16,
      is_overdue: false,
      cashback_eligible: true,
      rent_month: "2026-03-01",
    },
    cashback: {
      available_balance: 1500,
      pending_balance: 0,
      total_earned: 2000,
      total_used: 500,
    },
    recent_payments: [
      {
        id: getTestPaymentId(),
        amount: 25000,
        status: "success",
        rent_month: "2026-02-01",
        paid_at: TEST_NOW,
        cashback_earned: 250,
      },
    ],
    notifications: [],
    unread_notification_count: 0,
  },

  /**
   * Mock notifications list.
   */
  notifications: [
    {
      id: "00000000-0000-0000-0000-000000000050",
      type: "payment_success",
      title: "Payment Successful",
      message: "Your rent of Rs 25,000 was paid successfully.",
      action_type: "navigate",
      action_data: { screen: "payment_receipt", payment_id: getTestPaymentId() },
      created_at: TEST_NOW,
      read: false,
    },
  ],

  /**
   * Mock payment schedule.
   */
  paymentSchedule: {
    id: "00000000-0000-0000-0000-000000000060",
    tenancy_id: getTestTenancyId(),
    payment_method: "upi",
    scheduled_day: 5,
    auto_apply_cashback: true,
    status: "active",
    next_execution_date: "2026-03-05",
    retry_count: 0,
    max_retries: 3,
    monthly_rent_paise: 2500000,
    property_address: "Flat 302, Sunrise Apartments, HSR Layout",
    landlord_name: "Test Landlord",
  },
} as const;
