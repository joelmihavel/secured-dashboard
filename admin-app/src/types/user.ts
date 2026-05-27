export interface RiskFactorEntry {
  factor: string;
  signal: "GREEN" | "YELLOW" | "RED" | "MISSING";
  weight: number;
  detail: string;
  phase: "pre" | "post";
  continuous_score?: number;
  data_state?: "present" | "missing";
  scored_at?: string;
  freshness_decay?: number;
}

export interface UserFunnel {
  user_id: string;
  phone: string;
  name: string | null;
  user_status: string;
  role: string;
  kyc_status: string | null;
  signed_up_at: string;
  status_updated_at: string | null;
  cashback_balance_paise: number | null;
  referral_code: string | null;
  name_source: string | null;
  // Waitlist
  waitlist_position: number | null;
  admin_review: string | null;
  risk_level: string | null;
  risk_factors: RiskFactorEntry[] | null;
  risk_computed_at: string | null;
  risk_phase: string | null;
  waitlist_joined_at: string | null;
  // Agreement
  extraction_id: string | null;
  extraction_status: string | null;
  agreement_verified: boolean | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_pincode: string | null;
  monthly_rent_paise: number | null;
  maintenance_paise: number | null;
  security_deposit_paise: number | null;
  landlord_name: string | null;
  landlord_display_name: string | null;
  landlord_phone: string | null;
  landlord_country_code: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  rent_due_day: number | null;
  rooms_in_agreement: number | null;
  property_bhk_type: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_formatted_address: string | null;
  extraction_confidence: number | null;
  agreement_uploaded_at: string | null;
  // Stamp verification (denormalized from stamp_verifications)
  stamp_verification_status: string | null;
  stamp_verified_at: string | null;
  stamp_verification_attempt: number | null;
  // Tenancy
  tenancy_id: string | null;
  tenancy_status: string | null;
  bank_verified: boolean | null;
  utility_verified: boolean | null;
  landlord_approved: boolean | null;
  // Extraction (latest)
  contract_status: string | null;
  manual_review_reason: string | null;
  // Landlord bank — authoritative readiness gate for admin approval.
  // Approval is safe iff both flags are true. tenancy.bank_verified above is
  // a denormalised mirror; bank_accounts is the source of truth.
  landlord_bank_verified: boolean | null;
  landlord_bank_pan_verified: boolean | null;
  landlord_bank_agreement_name_matched: boolean | null;
  landlord_bank_agreement_match_score: number | null;
  landlord_m360_full_name: string | null;
  shcil_landlord_name: string | null;
  shcil_landlord_name_matched: boolean | null;
  // M360
  m360_status: string | null;
  m360_full_name: string | null;
  m360_gender: string | null;
  m360_date_of_birth: string | null;
  m360_age: number | null;
  m360_occupation: string | null;
  m360_total_income: string | null;
  m360_aadhaar_masked: string | null;
  m360_credit_score: number | null;
  m360_risk_level: string | null;
  m360_risk_safe: boolean | null;
  m360_mobile_provider: string | null;
  m360_connection_type: string | null;
  m360_verified_at: string | null;
  // Payment aggregates
  successful_payments: number | null;
  total_paid_paise: number | null;
  total_cashback_earned_paise: number | null;
  last_payment_at: string | null;
}

export interface PaymentDetail {
  payment_id: string;
  user_phone: string;
  user_name: string | null;
  user_status: string;
  payment_month: string;
  due_date: string | null;
  payment_status: string;
  payment_method: string | null;
  rent_amount_paise: number | null;
  total_amount_paise: number | null;
  cashback_applied_paise: number | null;
  cashback_earned_paise: number | null;
  pg_fee_paise: number | null;
  payu_txn_id: string | null;
  payu_mihpayid: string | null;
  initiated_at: string;
  paid_at: string | null;
  settlement_status: string | null;
  settled_at: string | null;
  property_address: string | null;
  property_city: string | null;
  landlord_name: string | null;
  tenancy_rent_paise: number | null;
}

export interface RiskDetail {
  phone: string;
  name: string | null;
  user_status: string;
  risk_level: string | null;
  risk_phase: string | null;
  risk_computed_at: string | null;
  admin_review: string | null;
  tenant_match_score: number | null;
  m360_full_name: string | null;
  agreement_tenant_name: string | null;
  bank_holder_name: string | null;
  bank_name_match_score: number | null;
  penny_drop_status: string | null;
  // PAN verification
  pan_verified: boolean | null;
  pan_name_matched: boolean | null;
  pan_status: string | null;
  pan_type: string | null;
  pan_registered_name: string | null;
  pan_match_score: number | null;
  // Bank agreement match
  bank_agreement_name_matched: boolean | null;
  bank_agreement_match_score: number | null;
  // Utility
  utility_consumer_name: string | null;
  utility_address_score: number | null;
  utility_address_verified: boolean | null;
  utility_name_score: number | null;
  utility_name_verified: boolean | null;
  agreement_landlord_name: string | null;
  agreement_verdict: string | null;
  extraction_confidence: number | null;
  confidence_score: number | null;
  monthly_rent_paise: number | null;
  needs_manual_review: boolean | null;
  landlord_status: string | null;
  landlord_approved: boolean | null;
  risk_factors: RiskFactorEntry[] | null;
  lease_end_date: string | null;
}

export interface M360Detail {
  verification_id: string;
  m360_status: string;
  consent_phone: string | null;
  consent_ip: string | null;
  cashfree_verification_id: string | null;
  cashfree_reference_id: string | null;
  user_id: string;
  user_phone: string;
  user_name: string | null;
  user_status: string;
  m360_full_name: string | null;
  m360_gender: string | null;
  m360_date_of_birth: string | null;
  m360_age: number | null;
  m360_occupation: string | null;
  m360_total_income: string | null;
  m360_aadhaar_masked: string | null;
  m360_credit_score: number | null;
  risk_level: string | null;
  risk_safe: boolean | null;
  risk_reason: string | null;
  mobile_provider: string | null;
  connection_type: string | null;
  phone_type: string | null;
  otp_sent_at: string | null;
  otp_attempts: number | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string | null;
}
