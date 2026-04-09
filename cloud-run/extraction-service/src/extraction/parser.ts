// ============================================
// DOCUMENT AI RESPONSE PARSER — ported verbatim from process-document/index.ts
// ============================================

import type { ExtractedData } from '../types.js';
import { TOTAL_EXTRACTION_FIELDS } from './schema.js';
import { parseAmount, parseDate, parseDuration } from './utils.js';

/**
 * Count extracted fields for quality metrics.
 *
 * Ported from: process-document/index.ts countExtractedFields()
 */
export function countExtractedFields(data: Partial<ExtractedData>): number {
  let count = 0;
  // Property details
  if (data.property_name) count++;
  if (data.property_address) count++;
  if (data.property_city) count++;
  if (data.property_state) count++;
  if (data.property_pincode) count++;
  if (data.micromarket || data.area_name) count++;
  // Financial
  if (data.monthly_rent_paise) count++;
  if (data.security_deposit_paise) count++;
  if (data.rent_escalation_percent) count++;
  // Contract
  if (data.lease_start_date) count++;
  if (data.contract_length_months || data.lease_end_date) count++;
  if (data.rent_due_day) count++;
  // Parties
  if (data.tenant_names && data.tenant_names.length > 0) count++;
  if (data.landlord_names && data.landlord_names.length > 0) count++;
  // E-stamp fields
  if (data.certificate_no) count++;
  if (data.certificate_issued_date) count++;
  if (data.account_reference) count++;
  if (data.purchased_by) count++;
  if (data.description_of_document) count++;
  if (data.first_party) count++;
  if (data.second_party) count++;
  if (data.stamp_duty_paid_by) count++;
  if (data.consideration_price_paise) count++;
  if (data.stamp_duty_amount_paise) count++;
  return count;
}

/**
 * Parse Document AI response into ExtractedData.
 *
 * Ported from: process-document/index.ts parseDocumentAIResponse()
 */
export function parseDocumentAIResponse(response: any): ExtractedData {
  const entities = response.document?.entities || [];
  const text = response.document?.text || "";

  const extracted: ExtractedData = {
    tenant_names: [],
    landlord_names: [],
    tenants: [],
    landlords: [],
    confidence_score: 0,
    fields_extracted: 0,
    total_fields: TOTAL_EXTRACTION_FIELDS,
    extraction_method: 'gcp_doc_ai',
    raw_doc_ai_data: response,
  };

  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const entity of entities) {
    const type = (entity.type || "").toLowerCase();
    const value = entity.mentionText || "";
    const confidence = entity.confidence || 0;

    if (value) {
      totalConfidence += confidence;
      confidenceCount++;

      // Property details
      if (type.includes("property") || type.includes("premises") || type.includes("apartment")) {
        extracted.property_name = value;
      } else if (type.includes("address") && !type.includes("email")) {
        extracted.property_address = value;
      } else if (type.includes("city")) {
        extracted.property_city = value;
      } else if (type.includes("pin") || type.includes("postal")) {
        extracted.property_pincode = value.replace(/\D/g, '').substring(0, 6);
      } else if (type.includes("area") || type.includes("locality") || type.includes("neighborhood")) {
        extracted.micromarket = value;
      }

      // Financial
      else if ((type.includes("rent") && type.includes("amount")) || type.includes("monthly_rent")) {
        extracted.monthly_rent_paise = parseAmount(value);
      } else if (type.includes("deposit") || type.includes("security")) {
        extracted.security_deposit_paise = parseAmount(value);
      } else if (type.includes("maintenance")) {
        extracted.maintenance_paise = parseAmount(value);
      } else if (type.includes("escalation") || type.includes("increment")) {
        extracted.rent_escalation_percent = parseFloat(value.replace(/[^0-9.]/g, '')) || undefined;
      }

      // Contract details
      else if (type.includes("start") && type.includes("date")) {
        extracted.lease_start_date = parseDate(value);
      } else if (type.includes("end") && type.includes("date")) {
        extracted.lease_end_date = parseDate(value);
      } else if (type.includes("duration") || type.includes("period") || type.includes("term")) {
        extracted.contract_length_months = parseDuration(value);
      }

      // Parties
      else if (type.includes("tenant") || type.includes("lessee")) {
        if (!extracted.tenant_names.includes(value)) {
          extracted.tenant_names.push(value);
          extracted.tenants.push({ name: value });
        }
      } else if (type.includes("landlord") || type.includes("lessor") || type.includes("owner")) {
        if (!extracted.landlord_names.includes(value)) {
          extracted.landlord_names.push(value);
          extracted.landlords.push({ name: value });
        }
      }
    }
  }

  extracted.confidence_score = confidenceCount > 0
    ? Math.round((totalConfidence / confidenceCount) * 100)
    : 0;

  extracted.fields_extracted = countExtractedFields(extracted);

  return extracted;
}
