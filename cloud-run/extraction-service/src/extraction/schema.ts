// ============================================
// RESPONSE SCHEMA — enforces structured Gemini output
// ============================================
// Using responseSchema guarantees the model returns exactly this structure.
// Eliminates JSON parsing failures and missing-field issues.
//
// Ported verbatim from supabase/functions/process-document/index.ts

export const EXTRACTION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    is_rental_agreement: {
      type: "boolean",
      description: "true ONLY for rental/lease/tenancy/leave-and-license agreements. false for sale deeds, bank statements, invoices, etc.",
    },
    document_type_detected: {
      type: "string",
      description: "What type of document this is (e.g., Rental Agreement, Leave and License, Sale Deed, Bank Statement, Invoice, Unknown)",
      nullable: true,
    },
    rejection_reason: {
      type: "string",
      description: "If is_rental_agreement is false, explain why. null if is_rental_agreement is true",
      nullable: true,
    },
    property_name: {
      type: "string",
      description: "SHORT display name: Flat/House#, Society/Complex, Locality, Pincode, City. Example: Flat 301, Panchavati Apts, Indiranagar, 560008, Bangalore. MUST NOT repeat segments.",
      nullable: true,
    },
    property_address: {
      type: "string",
      description: "FULL verbose legal address as written in the agreement — all lines, landmarks, etc.",
      nullable: true,
    },
    property_city: {
      type: "string",
      description: "City name (e.g., Bangalore, Bengaluru, Mumbai, Delhi)",
      nullable: true,
    },
    property_state: {
      type: "string",
      description: "State name — infer from city if not explicit (Bangalore→Karnataka, Mumbai→Maharashtra, Delhi→Delhi NCR)",
      nullable: true,
    },
    property_pincode: {
      type: "string",
      description: "6-digit Indian pincode",
      nullable: true,
    },
    micromarket: {
      type: "string",
      description: "Locality/area name (e.g., Whitefield, Koramangala, HSR Layout, Richmond Town)",
      nullable: true,
    },
    monthly_rent: {
      type: "number",
      description: "Monthly rent in rupees — numeric value only (e.g., 60000 not Rs. 60,000)",
      nullable: true,
    },
    security_deposit: {
      type: "number",
      description: "Security deposit in rupees — numeric value only",
      nullable: true,
    },
    rent_escalation_percent: {
      type: "number",
      description: "Annual rent escalation percentage as number (e.g., 5 for 5%)",
      nullable: true,
    },
    contract_start_date: {
      type: "string",
      description: "Lease/contract start date in YYYY-MM-DD format",
      nullable: true,
    },
    contract_end_date: {
      type: "string",
      description: "Lease/contract end date in YYYY-MM-DD format",
      nullable: true,
    },
    contract_length_months: {
      type: "integer",
      description: "Contract duration in months as integer",
      nullable: true,
    },
    rent_due_day: {
      type: "integer",
      description: "Day of month when rent is due (1-28). Look for 'rent payable on Nth of every month'. This is the original due date BEFORE any grace period.",
      nullable: true,
    },
    // Canonical grace-period extraction rule. If you change this, update all 7 sites: cloud-run/extraction-service/src/extraction/schema.ts (rent_grace_period_days), cloud-run/extraction-service/src/extraction/prompts.ts (buildVertexAIExtractionPrompt, buildGeminiAPIKeyPrompt), supabase/functions/process-document/index.ts (EXTRACTION_RESPONSE_SCHEMA, extractWithVertexAIGemini inline), supabase/functions/process-document-fallback/index.ts, supabase/functions/reprocess-extractions/index.ts.
    rent_grace_period_days: {
      type: "integer",
      description: "Number of days AFTER rent_due_day during which rent can still be paid without penalty / late fee — i.e., the LENGTH of the grace window, NOT a date. CRITICAL: drives cashback_cutoff_day = rent_due_day + this value. Math examples: due on 1st with grace until 5th → 4; due on 1st with grace until 3rd → 2; due on 5th with grace until 10th → 5; due on 10th with 'penalty beyond 15th' → 5. PHRASINGS to recognize (both directions matter — Gemini has missed clauses where the number comes BEFORE the words 'grace period'): 'grace period of N days', 'N days of grace period' (e.g., '10 days of grace period'), 'beyond N days of grace period' (e.g., 'penalty for delay beyond 10 days of grace period'), 'N-day grace' / 'N-day grace period' (e.g., '10-day grace'), 'grace of N days', 'within a grace of N days', 'without penalty until the Nth', 'no late fee before Nth', 'allowed/permitted until Nth', 'within N days of due date', 'buffer of N days', 'late payment charges shall apply only after the Nth', 'penalty after Nth' / 'penalty beyond Nth' (then grace = N - rent_due_day), 'rent payable by Nth' (only when an explicit earlier rent_due_day is also stated, then grace = N - rent_due_day), 'rent payable from Xth to Yth of every month' → rent_due_day=X, grace=Y-X. Return 0 ONLY if no grace period, buffer, or late-fee threshold is mentioned ANYWHERE in the agreement. DO NOT default to 0 if any penalty/grace/buffer clause is present — extract the implied grace days even if the wording is indirect.",
      nullable: true,
    },
    tenant_names: {
      type: "array",
      items: { type: "string" },
      description: "Array of tenant/lessee names. Each person MUST be a SEPARATE element — split joint names: 'RAMESH AND SEEMA JOSHI' → ['RAMESH JOSHI', 'SEEMA JOSHI']",
    },
    landlord_names: {
      type: "array",
      items: { type: "string" },
      description: "Array of landlord/lessor/owner names. Each person MUST be a SEPARATE element.",
    },
    certificate_no: {
      type: "string",
      description: "E-stamp certificate number, captured EXACTLY including any 'IN-' prefix and trailing check character. SHCIL format is 'IN-XXNNNNNNNNNNX' (e.g. 'IN-KA53026964726796Y'). Preserve 'IN-' verbatim, do NOT strip. MUMBAI/MAHARASHTRA EXCEPTION: GRN or Transaction ID is the certificate_no (no 'IN-' prefix on those).",
      nullable: true,
    },
    certificate_issued_date: {
      type: "string",
      description: "E-stamp certificate issue date in YYYY-MM-DD format",
      nullable: true,
    },
    account_reference: {
      type: "string",
      description: "Account reference number from e-stamp",
      nullable: true,
    },
    purchased_by: {
      type: "string",
      description: "Person who purchased the stamp paper",
      nullable: true,
    },
    description_of_document: {
      type: "string",
      description: "Description of Document from the e-stamp paper, with article number normalised for SHCIL lookup. MUST include the article number (e.g., 'Article 30(1)(i) Lease of Immovable Property - Not exceeding 1 year in case of Residential property', 'Article 5(j) Agreement (in any other cases)'). RESCUE RULE: if the description body is short like 'Lease of Immovable Property', search the e-stamp ANYWHERE (header, top-right cell, alongside the description, fine print, or separate 'Article' field) for 'Article XX' or 'Article XX(Y)' and PREPEND it. NORMALISATION RULE — CRITICAL: lowercase any letter sub-clause — '5(J)' → '5(j)', '30(1)(I)' → '30(1)(i)'. SHCIL's article-code lookup is case-sensitive on letters; capitals cause failures. Numeric sub-clauses stay as written. Karnataka Article 5(j) = 'Agreement (in any other cases)'. Do NOT abbreviate or reduce to a category label.",
      nullable: true,
    },
    first_party: {
      type: "string",
      description: "First party on stamp paper (usually lessor/landlord)",
      nullable: true,
    },
    second_party: {
      type: "string",
      description: "Second party on stamp paper (usually lessee/tenant)",
      nullable: true,
    },
    stamp_duty_paid_by: {
      type: "string",
      description: "Who paid stamp duty (tenant/landlord/both)",
      nullable: true,
    },
    consideration_price: {
      type: "number",
      description: "Consideration amount in rupees — numeric value only",
      nullable: true,
    },
    stamp_duty_amount: {
      type: "number",
      description: "Stamp duty amount in rupees — numeric value only",
      nullable: true,
    },
    rooms_in_agreement: {
      type: "integer",
      description: "Number of rooms/bedrooms covered by this agreement. For partial rent (one room in 3BHK), count only rented rooms. null if not determinable.",
      nullable: true,
    },
    property_bhk_type: {
      type: "string",
      description: "BHK type of the FULL property (e.g., 1BHK, 2BHK, 3BHK, Studio, Independent House). null if not mentioned.",
      nullable: true,
    },
    confidence: {
      type: "integer",
      description: "Extraction confidence score 0-100",
    },
  },
  required: ["is_rental_agreement", "tenant_names", "landlord_names", "confidence"],
};

/** Safety settings to disable all Gemini content filters */
export const GEMINI_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
] as const;

// Total expected fields for extraction (including e-stamp fields + rent_due_day)
export const TOTAL_EXTRACTION_FIELDS = 25;

// Minimum required fields for successful extraction (user_review status)
// These are critical fields without which extraction is considered incomplete
export const MINIMUM_REQUIRED_FIELDS = [
  'property_name',      // Property Name
  'property_state',     // State (or inferrable from city)
  'property_city',      // City
  'property_pincode',   // Pincode
  'tenant_names',       // Tenant(s) Name
  'landlord_names',     // Landlord(s) Name
  'monthly_rent_paise', // Monthly Rent
  'security_deposit_paise', // Security Deposit
  'lease_start_date',   // Rent Start Date
  'certificate_no',     // Certificate No.
] as const;
