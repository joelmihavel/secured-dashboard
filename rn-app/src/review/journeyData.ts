/**
 * Journey Demo Mode — Stage-Aware Mock Responses
 *
 * Returns mock data based on the current journey stage.
 * For the 'active' stage, falls through to existing review mode responses.
 */

import { getJourneyStage, advanceJourneyStage } from './journeyMode';
import { getReviewResponse } from './reviewData';

// ── Journey User ──

const journeyUser = {
  id: 'journey-user-id',
  first_name: 'Sam',
  last_name: 'Demo',
  phone: '+919999900002',
  email: 'sam.demo@flent.in',
  role: 'tenant',
  user_status: 'active',
  kyc_status: 'verified',
  cashback_balance_paise: 0,
  avatar_url: null,
  is_role_locked: false,
  created_at: '2026-01-15T00:00:00Z',
};

const JOURNEY_TENANCY_ID = 'journey-tenancy-001';
const JOURNEY_EXTRACTION_ID = 'journey-ext-001';

// ── Extracted Agreement Data (for PostgREST bypass) ──

export function getJourneyExtractedData() {
  return {
    id: JOURNEY_EXTRACTION_ID,
    user_id: 'journey-user-id',
    property_address: '42 MG Road, Indiranagar, Bangalore 560038',
    property_city: 'Bangalore',
    property_state: 'Karnataka',
    property_pincode: '560038',
    tenant_names: ['Sam Demo'],
    landlord_names: ['Priya Krishnamurthy'],
    monthly_rent: 25000,
    monthly_rent_paise: 2500000,
    lease_start_date: '2026-02-01',
    lease_end_date: '2027-01-31',
    rent_due_day: 5,
    security_deposit: 50000,
    security_deposit_paise: 5000000,
    agreement_type: 'rent',
    stamp_duty_paid: true,
    is_notarized: true,
    confidence_score: 0.95,
    extraction_status: 'completed',
    needs_manual_review: false,
    is_city_supported: true,
    user_verified: false,
    contract_status: 'completed',
    created_at: '2026-01-15T10:00:00Z',
  };
}

// ── Stage-Aware Responses ──

/**
 * Returns mock response for the given edge function, based on current journey stage.
 * Returns null if no journey-specific override exists (caller should fall through).
 */
export function getJourneyResponse(
  functionName: string,
  _body?: Record<string, unknown> | object
): unknown {
  const stage = getJourneyStage();
  const baseName = functionName.split('?')[0];

  // ── Stage: agreement_upload ──
  if (stage === 'agreement_upload') {
    if (baseName === 'upload-document') {
      return {
        upload_url: 'https://example.com/journey-upload',
        extracted_rental_info_id: JOURNEY_EXTRACTION_ID,
        document_path: 'documents/journey-doc.pdf',
        download_url: 'https://example.com/journey-download',
      };
    }
    if (baseName === 'process-document') {
      return {
        extracted_rental_info_id: JOURNEY_EXTRACTION_ID,
        confidence_score: 0.95,
        needs_manual_review: false,
        contract_status: 'completed',
        is_city_supported: true,
        extraction_status: 'completed',
        fields_extracted: 10,
        total_fields: 10,
      };
    }
  }

  // ── Stage: setup ──
  if (stage === 'setup') {
    if (baseName === 'get-waitlist-status') {
      return {
        has_entry: true,
        user_status: 'approved',
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
          created_at: '2026-01-15T10:00:00Z',
          has_invite_code: true,
          batch_number: 1,
        },
        batch_config: {
          current_batch: 1,
          rejection_cooldown_days: 30,
        },
        extraction_status: 'completed',
        requires_manual_review: false,
      };
    }
    // Setup verification responses — reuse review data patterns
    if (baseName === 'dashboard-data') {
      return {
        user: { ...journeyUser, user_status: 'approved' },
        tenancy: {
          id: JOURNEY_TENANCY_ID,
          status: 'active',
          property_address: '42 MG Road, Indiranagar, Bangalore 560038',
          property_city: 'Bangalore',
          monthly_rent: 25000,
          rent_due_day: 5,
          cashback_cutoff_day: 5,
          lease_end_date: '2027-01-31',
          lease_start_date: '2026-02-01',
          agreement_cert_id: 'KA-BLR-2025-005678',
          landlord_name: 'Priya Krishnamurthy',
          verification_status: {
            bank_verified: false,
            utility_verified: false,
            landlord_approved: false,
          },
        },
        upcoming_payment: null,
        cashback: {
          discount_rate: 0.008,
          max_discount_paise: 20000,
          max_discount: 200,
          verification_complete: false,
          total_savings_paise: 0,
          total_savings: 0,
          legacy_wallet_balance: 0,
        },
        recent_payments: [],
        landlord_bank: null,
        notifications: [],
        unread_notification_count: 0,
        payment_stamps: {
          summary: { on_time: 0, late: 0, missed: 0, pending: 0, total_months: 0 },
          current_month_status: 'pending',
        },
      };
    }
  }

  // ── Stage: active — fall through to review mode responses ──
  if (stage === 'active') {
    // Override identity fields in dashboard-data
    if (baseName === 'dashboard-data') {
      const reviewDashboard = getReviewResponse('dashboard-data') as Record<string, any>;
      return {
        ...reviewDashboard,
        user: {
          ...reviewDashboard.user,
          ...journeyUser,
          user_status: 'active',
        },
      };
    }
    // All other active-stage calls use review mode responses
    return getReviewResponse(functionName);
  }

  // ── Fallback: common responses needed across multiple stages ──
  if (baseName === 'register-device-token') return { registered: true };
  if (baseName === 'broadcast-app-update') return {};
  if (baseName === 'verify-bank') return getReviewResponse('verify-bank');
  if (baseName === 'verify-pan') return getReviewResponse('verify-pan');
  if (baseName === 'verify-utility') return getReviewResponse(functionName);
  if (baseName === 'send-landlord-invite') return getReviewResponse('send-landlord-invite');

  // Default empty response for unmatched functions
  return {};
}
