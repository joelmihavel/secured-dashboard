/**
 * Flent Secured v2 - Cashfree Payout Operations
 *
 * Beneficiary management and fund transfers using Cashfree Payouts API.
 * Uses SEPARATE credentials from PG (Payment Gateway).
 */

import {
  cashfreeRequest,
  CF_PAYOUT_API_VERSION,
  getPayoutConfig,
} from "./cashfree-shared.ts";

// ==============================================
// TYPES
// ==============================================

export interface CreateBeneficiaryParams {
  beneficiaryId: string;
  name: string;
  email: string;
  phone: string;
  bankAccount: string;
  ifsc: string;
  vpa?: string;
}

export interface BeneficiaryResponse {
  beneficiary_id: string;
  beneficiary_name?: string;
  beneficiary_email?: string;
  beneficiary_phone?: string;
  bank_account?: string;
  ifsc?: string;
  vpa?: string;
  status: string;
  added_on?: string;
}

/**
 * Transfer modes supported by Cashfree Payouts:
 * - IMPS: Available 24x7, up to 5 lakh per transaction
 * - NEFT: Available during banking hours, batch processing
 * - RTGS: Available during banking hours, for amounts >= 2 lakh
 * - UPI: Available 24x7, via VPA
 */
export type TransferMode = "IMPS" | "NEFT" | "RTGS" | "UPI";

export interface CreateTransferParams {
  transferId: string;
  amount: number;
  transferMode: TransferMode;
  beneficiaryId: string;
  remarks?: string;
}

export interface TransferResponse {
  transfer_id: string;
  cf_transfer_id?: string;
  status: string;
  status_code?: string;
  status_description?: string;
  beneficiary_id?: string;
  amount?: number;
  transfer_mode?: string;
  utr?: string;
  bank_reference_no?: string;
  added_on?: string;
  processed_on?: string;
  remarks?: string;
}

// ==============================================
// BENEFICIARY OPERATIONS
// ==============================================

/**
 * Creates a beneficiary for payouts.
 *
 * Beneficiaries must be created before initiating transfers.
 * The beneficiary ID should be unique and can be reused for future transfers.
 *
 * @param params - Beneficiary details
 * @returns Beneficiary creation response with status
 * @throws CashfreeError on API failure
 */
export async function createBeneficiary(
  params: CreateBeneficiaryParams
): Promise<BeneficiaryResponse> {
  const { clientId, clientSecret, baseUrl } = getPayoutConfig();

  const body: Record<string, string> = {
    beneficiary_id: params.beneficiaryId,
    beneficiary_name: params.name,
    beneficiary_email: params.email,
    beneficiary_phone: params.phone,
    bank_account: params.bankAccount,
    ifsc: params.ifsc,
  };

  if (params.vpa) {
    body.vpa = params.vpa;
  }

  const response = await cashfreeRequest<BeneficiaryResponse>(
    baseUrl,
    "/payout/beneficiary",
    "POST",
    body,
    clientId,
    clientSecret,
    CF_PAYOUT_API_VERSION
  );

  return response.data;
}

// ==============================================
// TRANSFER OPERATIONS
// ==============================================

/**
 * Creates a payout transfer to a registered beneficiary.
 *
 * Transfer mode guidance:
 * - IMPS: 24x7 availability, up to INR 5,00,000 per txn, near-instant
 * - NEFT: Banking hours, batch processing (30-min cycles), no upper limit
 * - RTGS: Banking hours, for amounts >= INR 2,00,000, near-instant
 * - UPI: 24x7 availability, requires beneficiary VPA, up to INR 1,00,000
 *
 * @param params - Transfer details
 * @returns Transfer response with status and UTR (when available)
 * @throws CashfreeError on API failure
 */
export async function createTransfer(
  params: CreateTransferParams
): Promise<TransferResponse> {
  const { clientId, clientSecret, baseUrl } = getPayoutConfig();

  const body = {
    transfer_id: params.transferId,
    transfer_amount: parseFloat(params.amount.toFixed(2)),
    transfer_mode: params.transferMode,
    beneficiary_id: params.beneficiaryId,
    remarks: params.remarks,
  };

  const response = await cashfreeRequest<TransferResponse>(
    baseUrl,
    "/payout/v2/transfers",
    "POST",
    body,
    clientId,
    clientSecret,
    CF_PAYOUT_API_VERSION
  );

  return response.data;
}

// ==============================================
// SETTLEMENT ADJUSTMENT (Flent Subsidy)
// ==============================================

export interface AdjustmentResponse {
  adjustment_id: string;
  order_id: string;
  amount: number;
  type: string;
  status: string;
  remarks?: string;
}

/**
 * Creates a settlement adjustment to cover the instant discount gap.
 *
 * In the instant discount model, the user pays (rent - 1%) but the landlord
 * must receive the full rent. Flent covers the 1% gap from merchant balance
 * via the Cashfree Adjustment API.
 *
 * @param orderId - The Cashfree order ID for the payment
 * @param adjustmentPaise - The subsidy amount in paise (e.g., 30000 for Rs.300)
 * @param remarks - Optional description
 * @returns Adjustment creation response
 * @throws CashfreeError on API failure
 */
export async function createSettlementAdjustment(
  orderId: string,
  adjustmentPaise: number,
  remarks?: string
): Promise<AdjustmentResponse> {
  const { clientId, clientSecret, baseUrl } = getPayoutConfig();

  const body = {
    order_id: orderId,
    amount: parseFloat((adjustmentPaise / 100).toFixed(2)),
    type: "CREDIT",
    remarks: remarks ?? `Flent 1% instant discount subsidy for order ${orderId}`,
  };

  const response = await cashfreeRequest<AdjustmentResponse>(
    baseUrl,
    "/splits/adjustments",
    "POST",
    body,
    clientId,
    clientSecret,
    CF_PAYOUT_API_VERSION
  );

  return response.data;
}

/**
 * Retrieves the current status of a payout transfer.
 *
 * Use this to poll for transfer completion or check UTR availability.
 *
 * @param transferId - The merchant transfer ID
 * @returns Transfer status with UTR (when settled)
 * @throws CashfreeError on API failure
 */
export async function getTransferStatus(
  transferId: string
): Promise<TransferResponse> {
  const { clientId, clientSecret, baseUrl } = getPayoutConfig();

  const response = await cashfreeRequest<TransferResponse>(
    baseUrl,
    `/payout/v2/transfers/${encodeURIComponent(transferId)}`,
    "GET",
    undefined,
    clientId,
    clientSecret,
    CF_PAYOUT_API_VERSION
  );

  return response.data;
}
