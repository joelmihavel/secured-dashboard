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
      description: "Day of month when rent is due (1-28). Look for 'rent payable on Nth of every month'.",
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
      description: "E-stamp certificate number. MUMBAI/MAHARASHTRA: use GRN or Transaction ID as certificate_no.",
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
      description: "EXACT verbatim text from the 'Description of Document' field on the e-stamp paper. MUST include the article number when present (e.g., 'Article 30(1)(i) Lease of Immovable Property - Not exceeding 1 year in case of Residential property'). Do NOT abbreviate, summarize, paraphrase, or reduce to a category label like 'Rental Agreement'. Copy the text as-is, preserving the article number, spelling, and punctuation.",
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
