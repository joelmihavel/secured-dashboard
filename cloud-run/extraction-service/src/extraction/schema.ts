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
    // Phase 2 (single-field semantic, 2026-05-04): rent_due_day = grace-inclusive
    // deadline. rent_grace_period_days is deprecated (always null). If you change
    // either description, update all 7 sites: cloud-run/extraction-service/src/extraction/schema.ts (rent_grace_period_days), cloud-run/extraction-service/src/extraction/prompts.ts (buildVertexAIExtractionPrompt, buildGeminiAPIKeyPrompt), supabase/functions/process-document/index.ts (EXTRACTION_RESPONSE_SCHEMA, extractWithVertexAIGemini inline), supabase/functions/process-document-fallback/index.ts, supabase/functions/reprocess-extractions/index.ts.
    rent_due_day: {
      type: "integer",
      description: "Day of month (1-28) representing the LAST day rent can be paid without penalty / late fee — i.e., the grace-inclusive payment deadline. If the agreement says 'rent due on 1st' with no grace, return 1. If it says 'rent due on 1st with grace period of 4 days', return 5 (1+4=5). If it says 'rent payable within 5th day in advance', return 5. If it says 'penalty 1% per day after the 5th', return 5. If it says 'rent payable from 1st to 5th of every month', return 5. ALWAYS return the END date of any grace window — never the original due day when grace is mentioned. The field rent_grace_period_days is deprecated and should always be null in your response (grace is folded into rent_due_day).",
      nullable: true,
    },
    rent_grace_period_days: {
      type: "integer",
      description: "DEPRECATED in Phase 2 (single-field semantic). Always return null. Grace days are now folded into rent_due_day directly — see the rent_due_day description for the math. This field is kept in the schema only so legacy extractions in the database remain readable; AI must NOT populate it.",
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
