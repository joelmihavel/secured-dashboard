-- =============================================================================
-- Flent Secured v2 - Schema Integrity Tests (pgTAP)
-- =============================================================================
-- Validates that all tables, columns, constraints, indexes, triggers, and RLS
-- settings match the migration specifications. This is the structural contract
-- test -- if a migration is skipped or mangled, these tests catch it.
-- =============================================================================

BEGIN;

SELECT plan(229);

-- =============================================================================
-- 1. TABLE EXISTENCE (24 tables)
-- =============================================================================

SELECT has_table('users',                   'Table users exists');
SELECT has_table('tenancies',               'Table tenancies exists');
SELECT has_table('payments',                'Table payments exists');
SELECT has_table('bank_accounts',           'Table bank_accounts exists');
SELECT has_table('identity_verifications',  'Table identity_verifications exists');
SELECT has_table('cashback_ledger',         'Table cashback_ledger exists');
SELECT has_table('idempotency_keys',        'Table idempotency_keys exists');
SELECT has_table('audit_logs',              'Table audit_logs exists');
SELECT has_table('utility_verifications',   'Table utility_verifications exists');
SELECT has_table('extracted_rental_info',   'Table extracted_rental_info exists');
SELECT has_table('device_tokens',           'Table device_tokens exists');
SELECT has_table('notifications',           'Table notifications exists');
SELECT has_table('payment_methods',         'Table payment_methods exists');
SELECT has_table('refunds',                 'Table refunds exists');
SELECT has_table('referral_codes',          'Table referral_codes exists');
SELECT has_table('referral_redemptions',    'Table referral_redemptions exists');
SELECT has_table('notification_preferences','Table notification_preferences exists');
SELECT has_table('waitlist_entries',         'Table waitlist_entries exists');
SELECT has_table('deleted_users_archive',   'Table deleted_users_archive exists');
SELECT has_table('payment_schedules',       'Table payment_schedules exists');
SELECT has_table('supported_cities',        'Table supported_cities exists');
SELECT has_table('invite_codes',            'Table invite_codes exists');
SELECT has_table('invite_code_attempts',    'Table invite_code_attempts exists');
SELECT has_table('app_config',              'Table app_config exists');

-- =============================================================================
-- 2. USERS TABLE COLUMNS (V2 + V1 backward compatibility)
-- =============================================================================

-- V2 core columns
SELECT has_column('users', 'id',                    'users.id exists');
SELECT has_column('users', 'full_name',             'users.full_name exists');
SELECT has_column('users', 'first_name',            'users.first_name exists');
SELECT has_column('users', 'last_name',             'users.last_name exists');
SELECT has_column('users', 'phone',                 'users.phone exists');
SELECT has_column('users', 'email',                 'users.email exists');
SELECT has_column('users', 'pan_number',            'users.pan_number exists');
SELECT has_column('users', 'pan_verified',          'users.pan_verified exists');
SELECT has_column('users', 'aadhaar_last4',         'users.aadhaar_last4 exists');
SELECT has_column('users', 'aadhaar_verified',      'users.aadhaar_verified exists');
SELECT has_column('users', 'kyc_status',            'users.kyc_status exists');
SELECT has_column('users', 'onboarding_completed',  'users.onboarding_completed exists');
SELECT has_column('users', 'cashback_balance_paise', 'users.cashback_balance_paise exists');
SELECT has_column('users', 'referral_code',         'users.referral_code exists');
SELECT has_column('users', 'referred_by',           'users.referred_by exists');
SELECT has_column('users', 'created_at',            'users.created_at exists');
SELECT has_column('users', 'updated_at',            'users.updated_at exists');

-- V1 backward compatibility columns
SELECT has_column('users', 'phone_number',          'users.phone_number (V1 compat) exists');
SELECT has_column('users', 'role',                  'users.role (V1 compat) exists');
SELECT has_column('users', 'user_status',           'users.user_status (V1 compat) exists');
SELECT has_column('users', 'is_onboarded',          'users.is_onboarded (V1 compat) exists');
SELECT has_column('users', 'avatar_url',            'users.avatar_url (V1 compat) exists');
SELECT has_column('users', 'is_active',             'users.is_active (V1 compat) exists');
SELECT has_column('users', 'is_test_user',          'users.is_test_user (V1 compat) exists');
SELECT has_column('users', 'metadata',              'users.metadata (V1 compat) exists');
SELECT has_column('users', 'profile_image_url',     'users.profile_image_url (V1 compat) exists');

-- Name management columns
SELECT has_column('users', 'name_source',           'users.name_source exists');
SELECT has_column('users', 'matched_tenant_index',  'users.matched_tenant_index exists');
SELECT has_column('users', 'tenant_match_score',    'users.tenant_match_score exists');
SELECT has_column('users', 'tenant_match_type',     'users.tenant_match_type exists');

-- =============================================================================
-- 3. PAYMENTS TABLE COLUMNS (critical fintech columns)
-- =============================================================================

SELECT has_column('payments', 'id',                       'payments.id exists');
SELECT has_column('payments', 'tenancy_id',               'payments.tenancy_id exists');
SELECT has_column('payments', 'user_id',                  'payments.user_id exists (denormalized)');
SELECT has_column('payments', 'rent_amount_paise',        'payments.rent_amount_paise exists');
SELECT has_column('payments', 'pg_fee_paise',             'payments.pg_fee_paise exists');
SELECT has_column('payments', 'cashback_applied_paise',   'payments.cashback_applied_paise exists');
SELECT has_column('payments', 'cashback_earned_paise',    'payments.cashback_earned_paise exists');
SELECT has_column('payments', 'total_amount_paise',       'payments.total_amount_paise exists');
SELECT has_column('payments', 'status',                   'payments.status exists');
SELECT has_column('payments', 'payment_method',           'payments.payment_method exists');
SELECT has_column('payments', 'idempotency_key',          'payments.idempotency_key exists');
SELECT has_column('payments', 'due_date',                 'payments.due_date exists');
SELECT has_column('payments', 'payment_month',            'payments.payment_month exists');
SELECT has_column('payments', 'paid_at',                  'payments.paid_at exists');

-- PayU-specific columns
SELECT has_column('payments', 'payu_txn_id',              'payments.payu_txn_id exists');
SELECT has_column('payments', 'payu_mihpayid',            'payments.payu_mihpayid exists');

-- Two-tier settlement columns
SELECT has_column('payments', 'payu_settlement_status',   'payments.payu_settlement_status exists');
SELECT has_column('payments', 'landlord_payout_status',   'payments.landlord_payout_status exists');
SELECT has_column('payments', 'landlord_payout_paise',    'payments.landlord_payout_paise exists');

-- Cashfree gateway-agnostic columns
SELECT has_column('payments', 'payment_gateway',          'payments.payment_gateway exists');
SELECT has_column('payments', 'gateway_order_id',         'payments.gateway_order_id exists');
SELECT has_column('payments', 'gateway_payment_id',       'payments.gateway_payment_id exists');
SELECT has_column('payments', 'gateway_status',           'payments.gateway_status exists');
SELECT has_column('payments', 'gateway_metadata',         'payments.gateway_metadata exists');

-- Instant discount columns
SELECT has_column('payments', 'flent_subsidy_paise',      'payments.flent_subsidy_paise exists');
SELECT has_column('payments', 'net_rent_paise',           'payments.net_rent_paise exists');

-- =============================================================================
-- 4. TENANCIES TABLE COLUMNS
-- =============================================================================

SELECT has_column('tenancies', 'id',                      'tenancies.id exists');
SELECT has_column('tenancies', 'user_id',                 'tenancies.user_id exists');
SELECT has_column('tenancies', 'status',                  'tenancies.status exists');
SELECT has_column('tenancies', 'monthly_rent_paise',      'tenancies.monthly_rent_paise exists');
SELECT has_column('tenancies', 'rent_due_day',            'tenancies.rent_due_day exists');
SELECT has_column('tenancies', 'lease_start_date',        'tenancies.lease_start_date exists');
SELECT has_column('tenancies', 'property_address',        'tenancies.property_address exists');
SELECT has_column('tenancies', 'landlord_name',           'tenancies.landlord_name exists');
SELECT has_column('tenancies', 'bank_verified',           'tenancies.bank_verified exists');
SELECT has_column('tenancies', 'utility_verified',        'tenancies.utility_verified exists');
SELECT has_column('tenancies', 'landlord_approved',       'tenancies.landlord_approved exists');
SELECT has_column('tenancies', 'cashback_balance_paise',  'tenancies.cashback_balance_paise exists');
SELECT has_column('tenancies', 'extracted_rental_info_id','tenancies.extracted_rental_info_id exists');

-- Landlord invite/approval columns
SELECT has_column('tenancies', 'landlord_approval_token',   'tenancies.landlord_approval_token exists');
SELECT has_column('tenancies', 'landlord_otp_hash',         'tenancies.landlord_otp_hash exists');
SELECT has_column('tenancies', 'landlord_response',         'tenancies.landlord_response exists');

-- Rent receipt stamp columns
SELECT has_column('tenancies', 'landlord_pan_masked',       'tenancies.landlord_pan_masked exists');
SELECT has_column('tenancies', 'agreement_cert_id',         'tenancies.agreement_cert_id exists');

-- =============================================================================
-- 5. CASHBACK LEDGER COLUMNS
-- =============================================================================

SELECT has_column('cashback_ledger', 'id',                  'cashback_ledger.id exists');
SELECT has_column('cashback_ledger', 'user_id',             'cashback_ledger.user_id exists');
SELECT has_column('cashback_ledger', 'transaction_type',    'cashback_ledger.transaction_type exists');
SELECT has_column('cashback_ledger', 'amount_paise',        'cashback_ledger.amount_paise exists');
SELECT has_column('cashback_ledger', 'balance_after_paise', 'cashback_ledger.balance_after_paise exists');
SELECT has_column('cashback_ledger', 'payment_id',          'cashback_ledger.payment_id exists');
SELECT has_column('cashback_ledger', 'tenancy_id',          'cashback_ledger.tenancy_id exists');
SELECT has_column('cashback_ledger', 'description',         'cashback_ledger.description exists');
SELECT has_column('cashback_ledger', 'reference_id',        'cashback_ledger.reference_id exists');
SELECT has_column('cashback_ledger', 'reference_type',      'cashback_ledger.reference_type exists');

-- =============================================================================
-- 6. BANK ACCOUNTS COLUMNS
-- =============================================================================

SELECT has_column('bank_accounts', 'id',                        'bank_accounts.id exists');
SELECT has_column('bank_accounts', 'user_id',                   'bank_accounts.user_id exists');
SELECT has_column('bank_accounts', 'party_type',                'bank_accounts.party_type exists');
SELECT has_column('bank_accounts', 'account_holder_name',       'bank_accounts.account_holder_name exists');
SELECT has_column('bank_accounts', 'account_number_encrypted',  'bank_accounts.account_number_encrypted exists');
SELECT has_column('bank_accounts', 'account_number_masked',     'bank_accounts.account_number_masked exists');
SELECT has_column('bank_accounts', 'ifsc_code',                 'bank_accounts.ifsc_code exists');
SELECT has_column('bank_accounts', 'verified',                  'bank_accounts.verified exists');
SELECT has_column('bank_accounts', 'penny_drop_txn_id',         'bank_accounts.penny_drop_txn_id exists');
SELECT has_column('bank_accounts', 'is_primary',                'bank_accounts.is_primary exists');
SELECT has_column('bank_accounts', 'cf_beneficiary_id',         'bank_accounts.cf_beneficiary_id (Cashfree) exists');

-- =============================================================================
-- 7. WAITLIST ENTRIES COLUMNS
-- =============================================================================

SELECT has_column('waitlist_entries', 'id',                 'waitlist_entries.id exists');
SELECT has_column('waitlist_entries', 'user_id',            'waitlist_entries.user_id exists');
SELECT has_column('waitlist_entries', 'position',           'waitlist_entries.position exists');
SELECT has_column('waitlist_entries', 'admin_review',       'waitlist_entries.admin_review exists');
SELECT has_column('waitlist_entries', 'rejection_reasons',  'waitlist_entries.rejection_reasons exists');
SELECT has_column('waitlist_entries', 'priority_boost',     'waitlist_entries.priority_boost exists');
SELECT has_column('waitlist_entries', 'extraction_id',      'waitlist_entries.extraction_id exists');
SELECT has_column('waitlist_entries', 'invite_code_id',     'waitlist_entries.invite_code_id exists');
SELECT has_column('waitlist_entries', 'risk_level',         'waitlist_entries.risk_level exists');
SELECT has_column('waitlist_entries', 'risk_factors',       'waitlist_entries.risk_factors exists');

-- =============================================================================
-- 8. PAYMENT METHODS COLUMNS
-- =============================================================================

SELECT has_column('payment_methods', 'id',                  'payment_methods.id exists');
SELECT has_column('payment_methods', 'user_id',             'payment_methods.user_id exists');
SELECT has_column('payment_methods', 'type',                'payment_methods.type exists');
SELECT has_column('payment_methods', 'display_name',        'payment_methods.display_name exists');
SELECT has_column('payment_methods', 'upi_vpa',             'payment_methods.upi_vpa exists');
SELECT has_column('payment_methods', 'card_token',          'payment_methods.card_token exists');
SELECT has_column('payment_methods', 'card_last4',          'payment_methods.card_last4 exists');
SELECT has_column('payment_methods', 'card_network',        'payment_methods.card_network exists');
SELECT has_column('payment_methods', 'card_expiry_month',   'payment_methods.card_expiry_month exists');
SELECT has_column('payment_methods', 'card_expiry_year',    'payment_methods.card_expiry_year exists');
SELECT has_column('payment_methods', 'nickname',            'payment_methods.nickname exists');
SELECT has_column('payment_methods', 'is_default',          'payment_methods.is_default exists');
SELECT has_column('payment_methods', 'deleted_at',          'payment_methods.deleted_at (soft delete) exists');
SELECT has_column('payment_methods', 'payment_gateway',     'payment_methods.payment_gateway exists');

-- =============================================================================
-- 9. FOREIGN KEY CONSTRAINTS
-- =============================================================================

SELECT fk_ok('users', 'id', 'auth.users', 'id',
  'FK: users.id -> auth.users.id');

SELECT fk_ok('tenancies', 'user_id', 'users', 'id',
  'FK: tenancies.user_id -> users.id');

SELECT fk_ok('payments', 'tenancy_id', 'tenancies', 'id',
  'FK: payments.tenancy_id -> tenancies.id');

SELECT fk_ok('bank_accounts', 'user_id', 'users', 'id',
  'FK: bank_accounts.user_id -> users.id');

SELECT fk_ok('identity_verifications', 'user_id', 'users', 'id',
  'FK: identity_verifications.user_id -> users.id');

SELECT fk_ok('cashback_ledger', 'user_id', 'users', 'id',
  'FK: cashback_ledger.user_id -> users.id');

SELECT fk_ok('cashback_ledger', 'payment_id', 'payments', 'id',
  'FK: cashback_ledger.payment_id -> payments.id');

SELECT fk_ok('utility_verifications', 'user_id', 'users', 'id',
  'FK: utility_verifications.user_id -> users.id');

SELECT fk_ok('extracted_rental_info', 'user_id', 'users', 'id',
  'FK: extracted_rental_info.user_id -> users.id');

SELECT fk_ok('device_tokens', 'user_id', 'users', 'id',
  'FK: device_tokens.user_id -> users.id');

SELECT fk_ok('notifications', 'user_id', 'users', 'id',
  'FK: notifications.user_id -> users.id');

SELECT fk_ok('idempotency_keys', 'user_id', 'users', 'id',
  'FK: idempotency_keys.user_id -> users.id');

SELECT fk_ok('audit_logs', 'user_id', 'users', 'id',
  'FK: audit_logs.user_id -> users.id');

SELECT fk_ok('refunds', 'payment_id', 'payments', 'id',
  'FK: refunds.payment_id -> payments.id');

SELECT fk_ok('payment_schedules', 'tenancy_id', 'tenancies', 'id',
  'FK: payment_schedules.tenancy_id -> tenancies.id');

-- =============================================================================
-- 10. ROW LEVEL SECURITY ENABLED
-- =============================================================================

SELECT row_security_active('users',
  'RLS enabled on users');
SELECT row_security_active('tenancies',
  'RLS enabled on tenancies');
SELECT row_security_active('payments',
  'RLS enabled on payments');
SELECT row_security_active('bank_accounts',
  'RLS enabled on bank_accounts');
SELECT row_security_active('identity_verifications',
  'RLS enabled on identity_verifications');
SELECT row_security_active('cashback_ledger',
  'RLS enabled on cashback_ledger');
SELECT row_security_active('utility_verifications',
  'RLS enabled on utility_verifications');
SELECT row_security_active('extracted_rental_info',
  'RLS enabled on extracted_rental_info');
SELECT row_security_active('idempotency_keys',
  'RLS enabled on idempotency_keys');
SELECT row_security_active('audit_logs',
  'RLS enabled on audit_logs');
SELECT row_security_active('device_tokens',
  'RLS enabled on device_tokens');
SELECT row_security_active('notifications',
  'RLS enabled on notifications');
SELECT row_security_active('payment_methods',
  'RLS enabled on payment_methods');
SELECT row_security_active('refunds',
  'RLS enabled on refunds');
SELECT row_security_active('referral_codes',
  'RLS enabled on referral_codes');
SELECT row_security_active('referral_redemptions',
  'RLS enabled on referral_redemptions');
SELECT row_security_active('notification_preferences',
  'RLS enabled on notification_preferences');
SELECT row_security_active('waitlist_entries',
  'RLS enabled on waitlist_entries');
SELECT row_security_active('deleted_users_archive',
  'RLS enabled on deleted_users_archive');
SELECT row_security_active('payment_schedules',
  'RLS enabled on payment_schedules');
SELECT row_security_active('supported_cities',
  'RLS enabled on supported_cities');
SELECT row_security_active('invite_codes',
  'RLS enabled on invite_codes');
SELECT row_security_active('invite_code_attempts',
  'RLS enabled on invite_code_attempts');
SELECT row_security_active('app_config',
  'RLS enabled on app_config');

-- =============================================================================
-- 11. CRITICAL INDEXES
-- =============================================================================

SELECT has_index('users', 'idx_users_phone',
  'Index idx_users_phone exists');
SELECT has_index('users', 'idx_users_email',
  'Index idx_users_email exists');
SELECT has_index('users', 'idx_users_referral_code',
  'Index idx_users_referral_code exists');
SELECT has_index('users', 'idx_users_kyc_status',
  'Index idx_users_kyc_status exists');
SELECT has_index('users', 'idx_users_phone_number',
  'Index idx_users_phone_number (V1 compat) exists');

SELECT has_index('tenancies', 'idx_tenancies_user_id',
  'Index idx_tenancies_user_id exists');
SELECT has_index('tenancies', 'idx_tenancies_status',
  'Index idx_tenancies_status exists');

SELECT has_index('payments', 'idx_payments_tenancy_id',
  'Index idx_payments_tenancy_id exists');
SELECT has_index('payments', 'idx_payments_status',
  'Index idx_payments_status exists');
SELECT has_index('payments', 'idx_payments_idempotency_key',
  'Index idx_payments_idempotency_key exists');
SELECT has_index('payments', 'idx_payments_user_id',
  'Index idx_payments_user_id (denormalized) exists');
SELECT has_index('payments', 'idx_payments_gateway',
  'Index idx_payments_gateway exists');

SELECT has_index('bank_accounts', 'idx_bank_accounts_user_id',
  'Index idx_bank_accounts_user_id exists');

SELECT has_index('cashback_ledger', 'idx_cashback_ledger_user',
  'Index idx_cashback_ledger_user exists');

SELECT has_index('waitlist_entries', 'idx_waitlist_entries_position',
  'Index idx_waitlist_entries_position exists');

-- =============================================================================
-- 12. CRITICAL TRIGGERS
-- =============================================================================

SELECT trigger_is('users', 'users_updated_at', 'update_updated_at_column',
  'Trigger users_updated_at fires update_updated_at_column');

SELECT trigger_is('tenancies', 'trigger_tenancies_updated_at', 'update_tenancies_updated_at',
  'Trigger on tenancies fires update_tenancies_updated_at');

SELECT trigger_is('payments', 'trigger_payments_updated_at', 'update_payments_updated_at',
  'Trigger on payments fires update_payments_updated_at');

SELECT trigger_is('payments', 'trigger_audit_payment_status', 'audit_payment_status_change',
  'Trigger on payments fires audit_payment_status_change');

SELECT trigger_is('payments', 'trg_set_payment_user_id', 'set_payment_user_id',
  'Trigger on payments fires set_payment_user_id');

SELECT trigger_is('bank_accounts', 'trigger_bank_accounts_updated_at', 'update_bank_accounts_updated_at',
  'Trigger on bank_accounts fires update_bank_accounts_updated_at');

SELECT trigger_is('bank_accounts', 'trigger_ensure_single_primary_bank', 'ensure_single_primary_bank_account',
  'Trigger on bank_accounts fires ensure_single_primary_bank_account');

SELECT trigger_is('cashback_ledger', 'trg_sync_cashback_balance', 'sync_cashback_balance',
  'Trigger on cashback_ledger fires sync_cashback_balance');

SELECT trigger_is('tenancies', 'trigger_generate_agreement_cert_id', 'generate_agreement_cert_id',
  'Trigger on tenancies fires generate_agreement_cert_id');

-- =============================================================================
-- 13. CRITICAL FUNCTIONS EXIST
-- =============================================================================

SELECT has_function('handle_new_user',
  'Function handle_new_user exists');
SELECT has_function('sync_phone_columns',
  'Function sync_phone_columns exists');
SELECT has_function('sync_cashback_balance',
  'Function sync_cashback_balance exists');
SELECT has_function('get_available_cashback',
  'Function get_available_cashback exists');
SELECT has_function('get_cashback_balance',
  'Function get_cashback_balance exists');
SELECT has_function('debit_cashback',
  'Function debit_cashback exists');
SELECT has_function('join_waitlist',
  'Function join_waitlist exists');
SELECT has_function('claim_invite_code',
  'Function claim_invite_code exists');
SELECT has_function('generate_invite_codes',
  'Function generate_invite_codes exists');
SELECT has_function('validate_referral_code',
  'Function validate_referral_code exists');
SELECT has_function('apply_referral_code',
  'Function apply_referral_code exists');
SELECT has_function('check_and_advance_to_active',
  'Function check_and_advance_to_active exists');
SELECT has_function('auto_reverse_cashback_on_refund',
  'Function auto_reverse_cashback_on_refund exists');

-- =============================================================================
-- 14. ENUM TYPES EXIST
-- =============================================================================

SELECT has_type('user_role',
  'Enum type user_role exists');
SELECT has_type('user_status_enum',
  'Enum type user_status_enum exists');
SELECT has_type('extraction_status_enum',
  'Enum type extraction_status_enum exists');
SELECT has_type('contract_upload_status',
  'Enum type contract_upload_status exists');

-- =============================================================================
-- 15. VIEWS EXIST
-- =============================================================================

SELECT has_view('waitlist',
  'View waitlist (V1 compatibility) exists');
SELECT has_view('rental_parties',
  'View rental_parties (V1 compatibility) exists');
SELECT has_view('payment_methods_safe',
  'View payment_methods_safe (excludes card_token) exists');

-- =============================================================================
-- 16. PROCESSED WEBHOOKS TABLE (Cashfree dedup)
-- =============================================================================

SELECT has_table('processed_webhooks',
  'Table processed_webhooks exists');
SELECT has_column('processed_webhooks', 'event_id',
  'processed_webhooks.event_id exists');
SELECT has_column('processed_webhooks', 'payment_gateway',
  'processed_webhooks.payment_gateway exists');

SELECT * FROM finish();
ROLLBACK;
