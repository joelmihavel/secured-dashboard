// ============================================
// EVALUATION & VALIDATION — ported verbatim from process-document/index.ts
// ============================================

import type { ExtractedData } from '../types.js';

export interface EvaluationResult {
  needs_manual_review: boolean;
  review_reason?: string;
  contract_status: string;
  missing_fields?: string[];
}

/**
 * Check if all minimum required fields are present in extracted data.
 * Returns { isComplete: boolean, missingFields: string[] }
 *
 * Ported from: process-document/index.ts validateMinimumRequiredFields()
 */
export function validateMinimumRequiredFields(data: Partial<ExtractedData>): {
  isComplete: boolean;
  missingFields: string[];
  extractedCount: number;
} {
  const missingFields: string[] = [];
  let extractedCount = 0;

  // Property Name
  if (data.property_name && data.property_name.trim()) {
    extractedCount++;
  } else {
    missingFields.push('Property Name');
  }

  // State (can be inferred from city)
  if (data.property_state && data.property_state.trim()) {
    extractedCount++;
  } else {
    missingFields.push('State');
  }

  // City
  if (data.property_city && data.property_city.trim()) {
    extractedCount++;
  } else {
    missingFields.push('City');
  }

  // Pincode
  if (data.property_pincode && data.property_pincode.trim()) {
    extractedCount++;
  } else {
    missingFields.push('Pincode');
  }

  // Tenant Names
  if (data.tenant_names && data.tenant_names.length > 0 && data.tenant_names[0]) {
    extractedCount++;
  } else {
    missingFields.push('Tenant Name(s)');
  }

  // Landlord Names
  if (data.landlord_names && data.landlord_names.length > 0 && data.landlord_names[0]) {
    extractedCount++;
  } else {
    missingFields.push('Landlord Name(s)');
  }

  // Monthly Rent
  if (data.monthly_rent_paise && data.monthly_rent_paise > 0) {
    extractedCount++;
  } else {
    missingFields.push('Monthly Rent');
  }

  // Security Deposit
  if (data.security_deposit_paise && data.security_deposit_paise > 0) {
    extractedCount++;
  } else {
    missingFields.push('Security Deposit');
  }

  // Lease Start Date
  if (data.lease_start_date && data.lease_start_date.trim()) {
    extractedCount++;
  } else {
    missingFields.push('Rent Start Date');
  }

  // Certificate No.
  if (data.certificate_no && data.certificate_no.trim()) {
    extractedCount++;
  } else {
    missingFields.push('Certificate No.');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    extractedCount
  };
}

/**
 * Check if a city is in the supported cities list.
 *
 * Ported from: process-document/index.ts checkCitySupported()
 */
export function checkCitySupported(city: string | undefined, supportedCities: string[]): boolean {
  if (!city) return false;
  const normalizedCity = city.toLowerCase().trim();
  return supportedCities.some(sc =>
    normalizedCity.includes(sc.toLowerCase()) ||
    sc.toLowerCase().includes(normalizedCity)
  );
}

/**
 * Evaluate extraction quality and determine contract status.
 *
 * Ported from: process-document/index.ts evaluateExtraction()
 */
export function evaluateExtraction(
  fieldsExtracted: number,
  totalFields: number,
  confidenceScore: number,
  isCitySupported: boolean,
  extractedData?: Partial<ExtractedData>
): EvaluationResult {
  // City support check: Record the flag but do NOT block extraction
  // Unsupported cities proceed normally — the is_city_supported flag is stored separately

  // First check: Document classification — is this actually a rental agreement?
  if (extractedData && (extractedData as any).is_rental_agreement === false) {
    const reason = (extractedData as any).rejection_reason || 'This document does not appear to be a rental agreement.';
    const detectedType = (extractedData as any).document_type_detected || 'unknown';
    console.log(`[extraction] Rejected: not a rental agreement (${detectedType})`);
    return {
      needs_manual_review: true,
      review_reason: reason,
      contract_status: 'invalid_document',
    };
  }

  // Agreement expiry is NOT a blocker — expired leases are common (renewed
  // verbally, extension pending, etc.). The risk engine (computeRisk signal 6)
  // adds a RED "agreement_expiry" factor with weight 4, which auto-escalates
  // risk_level to HIGH. Admin sees this and can reject if warranted.

  // Second check: Critical fields that make the agreement invalid if missing
  // Without these, the agreement is unusable — no point in manual review
  if (extractedData) {
    const criticalMissing: string[] = [];
    if (!extractedData.monthly_rent_paise || extractedData.monthly_rent_paise <= 0) {
      criticalMissing.push('Monthly Rent');
    }
    if (!extractedData.security_deposit_paise || extractedData.security_deposit_paise <= 0) {
      criticalMissing.push('Security Deposit');
    }
    if (!extractedData.lease_end_date || !extractedData.lease_end_date.trim()) {
      criticalMissing.push('Lease End Date');
    }
    if (!extractedData.landlord_names || extractedData.landlord_names.length === 0 || !extractedData.landlord_names[0]) {
      criticalMissing.push('Landlord Name');
    }

    if (criticalMissing.length > 0) {
      console.log(`[extraction] Agreement invalid — missing critical fields: ${criticalMissing.join(', ')}`);
      return {
        needs_manual_review: true,
        review_reason: `This agreement is missing critical information: ${criticalMissing.join(', ')}. Please upload a complete rental agreement.`,
        contract_status: 'invalid_document',
        missing_fields: criticalMissing,
      };
    }
  }

  // Third check: Validate minimum required fields if data is available
  if (extractedData) {
    const validation = validateMinimumRequiredFields(extractedData);

    if (!validation.isComplete) {
      // Missing non-critical fields - needs manual review
      return {
        needs_manual_review: true,
        review_reason: `Missing required fields: ${validation.missingFields.join(', ')}. Our team will review your document manually.`,
        contract_status: 'manual_review',
        missing_fields: validation.missingFields,
      };
    }

    // All minimum fields present = user review (success)
    return {
      needs_manual_review: false,
      contract_status: 'user_review',
    };
  }

  // Fallback: Use old percentage-based logic if extractedData not provided
  // 80% extraction + high confidence + supported city = user review
  if (fieldsExtracted >= totalFields * 0.8 && confidenceScore >= 80) {
    return {
      needs_manual_review: false,
      contract_status: 'user_review',
    };
  }

  // Partial extraction or low confidence
  if (fieldsExtracted < totalFields * 0.5 || confidenceScore < 50) {
    return {
      needs_manual_review: true,
      review_reason: `Extraction incomplete: ${fieldsExtracted}/${totalFields} fields extracted with ${confidenceScore}% confidence. Document may need re-upload or manual review.`,
      contract_status: 'manual_review',
    };
  }

  // Medium confidence - manual review
  return {
    needs_manual_review: true,
    review_reason: `Some information couldn't be extracted clearly (${fieldsExtracted}/${totalFields} fields, ${confidenceScore}% confidence).`,
    contract_status: 'manual_review',
  };
}
