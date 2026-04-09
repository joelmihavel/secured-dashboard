// ============================================
// MERGE — ported verbatim from process-document/index.ts
// ============================================

import type { ExtractedData } from '../types.js';
import { splitJointNames, inferStateFromCity } from './utils.js';
import { countExtractedFields } from './parser.js';

/**
 * Split joint names like "RAMESH AND SEEMA JOSHI" into individual names.
 * Re-exported from utils for backward compatibility.
 *
 * Ported from: process-document/index.ts splitJointNames()
 */
export { splitJointNames } from './utils.js';

/**
 * Merge Gemini results into existing Document AI extraction.
 * Prefers Gemini values over Document AI for missing/corrected fields.
 *
 * Ported from: process-document/index.ts mergeGeminiResults()
 */
export function mergeGeminiResults(docAI: ExtractedData, gemini: any): ExtractedData {
  // Merge results, preferring Gemini for missing fields or corrections
  const merged: ExtractedData = {
    ...docAI,
    property_name: gemini.property_name || docAI.property_name,
    property_address: gemini.property_address || docAI.property_address,
    property_city: gemini.property_city || docAI.property_city,
    property_state: gemini.property_state || docAI.property_state || inferStateFromCity(gemini.property_city || docAI.property_city),
    // Sanitize pincode to 6 digits max (VARCHAR(6) column)
    property_pincode: (gemini.property_pincode || docAI.property_pincode || "")
      .toString().replace(/\D/g, '').substring(0, 6) || undefined,
    micromarket: gemini.micromarket || docAI.micromarket,
    area_name: gemini.micromarket || docAI.area_name,
    // Convert Gemini rupees to paise (x100). Use parseFloat + Math.round to preserve
    // fractional rupee amounts (parseInt truncates decimals).
    monthly_rent_paise: gemini.monthly_rent
      ? (isNaN(parseFloat(String(gemini.monthly_rent).replace(/,/g, ''))) ? docAI.monthly_rent_paise : Math.round(parseFloat(String(gemini.monthly_rent).replace(/,/g, '')) * 100))
      : docAI.monthly_rent_paise,
    security_deposit_paise: gemini.security_deposit
      ? (isNaN(parseFloat(String(gemini.security_deposit).replace(/,/g, ''))) ? docAI.security_deposit_paise : Math.round(parseFloat(String(gemini.security_deposit).replace(/,/g, '')) * 100))
      : docAI.security_deposit_paise,
    rent_escalation_percent: gemini.rent_escalation_percent != null
      ? Number(gemini.rent_escalation_percent)
      : docAI.rent_escalation_percent,
    lease_start_date: gemini.contract_start_date || docAI.lease_start_date,
    lease_end_date: gemini.contract_end_date || docAI.lease_end_date,
    contract_length_months: gemini.contract_length_months != null
      ? Number(gemini.contract_length_months)
      : docAI.contract_length_months,
    rent_due_day: gemini.rent_due_day != null
      ? Number(gemini.rent_due_day)
      : docAI.rent_due_day,
    tenant_names: gemini.tenant_names?.length > 0
      ? splitJointNames(gemini.tenant_names) : docAI.tenant_names,
    landlord_names: gemini.landlord_names?.length > 0
      ? splitJointNames(gemini.landlord_names) : docAI.landlord_names,
    tenants: gemini.tenant_names?.length > 0
      ? splitJointNames(gemini.tenant_names).map((name: string) => ({ name }))
      : docAI.tenants,
    landlords: gemini.landlord_names?.length > 0
      ? splitJointNames(gemini.landlord_names).map((name: string) => ({ name }))
      : docAI.landlords,
    // E-stamp fields
    certificate_no: gemini.certificate_no || docAI.certificate_no,
    certificate_issued_date: gemini.certificate_issued_date || docAI.certificate_issued_date,
    account_reference: gemini.account_reference || docAI.account_reference,
    purchased_by: gemini.purchased_by || docAI.purchased_by,
    description_of_document: gemini.description_of_document || docAI.description_of_document,
    first_party: gemini.first_party || docAI.first_party,
    second_party: gemini.second_party || docAI.second_party,
    stamp_duty_paid_by: gemini.stamp_duty_paid_by || docAI.stamp_duty_paid_by,
    consideration_price_paise: gemini.consideration_price
      ? (isNaN(parseFloat(String(gemini.consideration_price).replace(/,/g, ''))) ? docAI.consideration_price_paise : Math.round(parseFloat(String(gemini.consideration_price).replace(/,/g, '')) * 100))
      : docAI.consideration_price_paise,
    stamp_duty_amount_paise: gemini.stamp_duty_amount
      ? (isNaN(parseFloat(String(gemini.stamp_duty_amount).replace(/,/g, ''))) ? docAI.stamp_duty_amount_paise : Math.round(parseFloat(String(gemini.stamp_duty_amount).replace(/,/g, '')) * 100))
      : docAI.stamp_duty_amount_paise,
    // Room/BHK fields
    rooms_in_agreement: gemini.rooms_in_agreement != null ? Number(gemini.rooms_in_agreement) : (docAI as any).rooms_in_agreement || null,
    property_bhk_type: gemini.property_bhk_type || (docAI as any).property_bhk_type || null,
    gemini_verification_score: gemini.confidence || null,
    // Use Gemini's confidence if it's meaningful (>0), otherwise keep Document AI's score.
    // Gemini sometimes returns 0 confidence due to safety filters or empty responses.
    confidence_score: gemini.confidence != null && Number(gemini.confidence) > 0
      ? Number(gemini.confidence)
      : docAI.confidence_score,
    raw_gemini_data: gemini,
    fields_extracted: 0, // Will be recalculated below
  };

  // Sanity-check financial amounts — Gemini can hallucinate negative values or astronomical amounts
  const MAX_RENT_PAISE = 50_00_000_00; // Rs. 50 lakh max rent (covers luxury properties)
  const MAX_DEPOSIT_PAISE = 500_00_000_00; // Rs. 5 crore max deposit
  if (merged.monthly_rent_paise != null && (merged.monthly_rent_paise <= 0 || merged.monthly_rent_paise > MAX_RENT_PAISE)) {
    console.warn(`[extraction] Invalid monthly_rent_paise=${merged.monthly_rent_paise}, clearing`);
    merged.monthly_rent_paise = undefined;
  }
  if (merged.security_deposit_paise != null && (merged.security_deposit_paise < 0 || merged.security_deposit_paise > MAX_DEPOSIT_PAISE)) {
    console.warn(`[extraction] Invalid security_deposit_paise=${merged.security_deposit_paise}, clearing`);
    merged.security_deposit_paise = undefined;
  }
  // Sanity-check rooms/BHK
  if (merged.rooms_in_agreement != null && (merged.rooms_in_agreement < 1 || merged.rooms_in_agreement > 20)) {
    merged.rooms_in_agreement = null;
  }
  // Sanity-check rent_due_day (1-28)
  if (merged.rent_due_day != null && (merged.rent_due_day < 1 || merged.rent_due_day > 28)) {
    merged.rent_due_day = undefined;
  }

  // Recalculate fields extracted
  merged.fields_extracted = countExtractedFields(merged);

  return merged;
}
