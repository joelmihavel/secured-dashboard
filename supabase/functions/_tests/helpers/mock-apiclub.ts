/**
 * Flent Secured v2 - API Club Mock Utilities
 *
 * Provides mock API Club responses for electricity bill verification testing.
 * Reference: https://www.apiclub.in/product/electricity_fetch_bill_api
 */

// ==============================================
// CONFIGURATION
// ==============================================

export const API_CLUB_SANDBOX = {
  API_KEY: Deno.env.get("API_CLUB_KEY") || "test_api_key",
  BASE_URL: "https://api.apiclub.in/api/v1",
} as const;

// ==============================================
// TEST DATA
// ==============================================

export const API_CLUB_TEST_DATA = {
  VALID_CONSUMER: {
    consumer_number: "123456789012",
    operator_code: "TAPM", // Tata Power Mumbai - matches real API Club code
    consumer_name: "RAMESH SHARMA", // Should match landlord name
    address: "123 MG Road, Andheri East",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400069",
    bill_amount: 2500.50,
    due_date: "2024-02-15",
  },
  BESCOM_CONSUMER: {
    consumer_number: "987654321098",
    operator_code: "BESC", // BESCOM - matches real API Club code
    consumer_name: "SURESH KUMAR",
    address: "456 Indiranagar, 12th Main",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560038",
    bill_amount: 1800.00,
    due_date: "2024-02-20",
  },
  INVALID_CONSUMER: {
    consumer_number: "999999999999",
    operator_code: "INVALID_OP",
  },
} as const;

// ==============================================
// OPERATOR RESPONSES
// ==============================================

interface OperatorData {
  operator_code?: string;
  code?: string;
  operator_name?: string;
  name?: string;
  state?: string;
}

// API Club returns operators as object with numeric keys, not array
// Example: {"0": {...}, "1": {...}, "timestamp": "..."}
interface OperatorResponse {
  status?: string;
  timestamp?: string;
  [key: string]: OperatorData | string | undefined;
}

/**
 * Creates a mock successful electricity operator list response.
 * IMPORTANT: This matches the real API Club format - an object with numeric keys,
 * NOT an array. The parsing logic in verify-utility handles this format.
 *
 * Real API Club response format:
 * {
 *   "0": { "code": "TAPM", "name": "TATA POWER MUMBAI", "state": "Maharashtra" },
 *   "1": { "code": "BESC", "name": "BESCOM (BENGALURU)", "state": "Karnataka" },
 *   ...
 *   "timestamp": "2026-01-25T12:00:00Z"
 * }
 */
export function createMockOperatorListSuccess(): OperatorResponse {
  return {
    "0": { code: "TAPM", name: "TATA POWER MUMBAI", state: "Maharashtra" },
    "1": { code: "ADANI_MUM", name: "ADANI ELECTRICITY MUMBAI", state: "Maharashtra" },
    "2": { code: "MSEDCL", name: "MSEDCL (MAHARASHTRA)", state: "Maharashtra" },
    "3": { code: "BEST", name: "BEST UNDERTAKING MUMBAI", state: "Maharashtra" },
    "4": { code: "BESC", name: "BESCOM (BENGALURU)", state: "Karnataka" },
    "5": { code: "TNEB", name: "TNEB (TAMIL NADU)", state: "Tamil Nadu" },
    "6": { code: "TPDDL", name: "TATA POWER DDL (DELHI)", state: "Delhi" },
    "7": { code: "BSES_RAJ", name: "BSES RAJDHANI (DELHI)", state: "Delhi" },
    "8": { code: "BSES_YAM", name: "BSES YAMUNA (DELHI)", state: "Delhi" },
    "9": { code: "UPPCL", name: "UPPCL (UTTAR PRADESH)", state: "Uttar Pradesh" },
    "10": { code: "WBSEDCL", name: "WBSEDCL (WEST BENGAL)", state: "West Bengal" },
    "11": { code: "CESC", name: "CESC (KOLKATA)", state: "West Bengal" },
    "12": { code: "PGVCL", name: "PGVCL (GUJARAT)", state: "Gujarat" },
    "13": { code: "DGVCL", name: "DGVCL (GUJARAT)", state: "Gujarat" },
    "14": { code: "MGVCL", name: "MGVCL (GUJARAT)", state: "Gujarat" },
    "15": { code: "UGVCL", name: "UGVCL (GUJARAT)", state: "Gujarat" },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates an operator list in legacy array format for backward compatibility testing.
 */
export function createMockOperatorListSuccessArray(): { status: string; data: OperatorData[] } {
  return {
    status: "success",
    data: [
      { operator_code: "TAPM", operator_name: "TATA POWER MUMBAI", state: "Maharashtra" },
      { operator_code: "BESC", operator_name: "BESCOM (BENGALURU)", state: "Karnataka" },
      { operator_code: "TNEB", operator_name: "TNEB (TAMIL NADU)", state: "Tamil Nadu" },
      { operator_code: "TPDDL", operator_name: "TATA POWER DDL (DELHI)", state: "Delhi" },
    ],
  };
}

// ==============================================
// BILL FETCH RESPONSES
// ==============================================

interface BillFetchResponse {
  code?: number;
  status: string;
  response?: {
    consumer_name?: string;
    bill_amount?: number;
    due_date?: string;
    address?: string;
    state?: string;
    city?: string;
    bill_number?: string;
    bill_date?: string;
    connection_type?: string;
    meter_number?: string;
    total_units?: number;
  };
  request_id?: string;
  message?: string;
}

/**
 * Creates a mock successful bill fetch response.
 */
export function createMockBillFetchSuccess(
  overrides: Partial<NonNullable<BillFetchResponse["response"]>> = {}
): BillFetchResponse {
  return {
    code: 200,
    status: "success",
    response: {
      consumer_name: "RAMESH SHARMA",
      bill_amount: 2500.50,
      due_date: "2024-02-15",
      address: "123 MG Road, Andheri East",
      city: "Mumbai",
      state: "Maharashtra",
      bill_number: `BILL_${Date.now()}`,
      bill_date: "2024-01-15",
      connection_type: "Residential",
      meter_number: `MTR_${Date.now()}`,
      total_units: 150,
      ...overrides,
    },
    request_id: `REQ_${Date.now()}`,
  };
}

/**
 * Creates a mock bill fetch response with specific landlord name and address.
 * Use this to test matching scenarios.
 */
export function createMockBillFetchWithDetails(
  consumerName: string,
  address: string,
  city: string,
  state: string,
  pincode?: string
): BillFetchResponse {
  const fullAddress = pincode ? `${address}, ${pincode}` : address;
  return createMockBillFetchSuccess({
    consumer_name: consumerName,
    address: fullAddress,
    city,
    state,
  });
}

/**
 * Creates a mock failed bill fetch response.
 */
export function createMockBillFetchFailure(
  reason: string = "Consumer not found"
): BillFetchResponse {
  return {
    code: 404,
    status: "error",
    message: reason,
    request_id: `REQ_${Date.now()}`,
  };
}

/**
 * Creates a mock invalid consumer response.
 */
export function createMockBillFetchInvalidConsumer(): BillFetchResponse {
  return createMockBillFetchFailure("Invalid consumer number");
}

/**
 * Creates a mock invalid operator response.
 */
export function createMockBillFetchInvalidOperator(): BillFetchResponse {
  return createMockBillFetchFailure("Invalid operator code");
}

/**
 * Creates a mock service unavailable response.
 */
export function createMockBillFetchServiceUnavailable(): BillFetchResponse {
  return {
    code: 503,
    status: "error",
    message: "Service temporarily unavailable. Please try again later.",
    request_id: `REQ_${Date.now()}`,
  };
}

// ==============================================
// TEST SCENARIO GENERATORS
// ==============================================

export const ApiClubTestScenarios = {
  operators: {
    /** Successful electricity operator list */
    electricityOperators: () => createMockOperatorListSuccess(),
  },

  billFetch: {
    /** Valid bill with matching landlord name and address */
    matchingNameAndAddress: (landlordName: string, address: string, city: string, state: string, pincode?: string) =>
      createMockBillFetchWithDetails(landlordName, address, city, state, pincode),

    /** Valid bill with matching name but different address */
    matchingNameDifferentAddress: (landlordName: string) =>
      createMockBillFetchWithDetails(
        landlordName,
        "456 Different Road, Other Area",
        "Delhi",
        "Delhi"
      ),

    /** Valid bill with different name but matching address */
    differentNameMatchingAddress: (address: string, city: string, state: string, pincode?: string) =>
      createMockBillFetchWithDetails(
        "DIFFERENT PERSON NAME",
        address,
        city,
        state,
        pincode
      ),

    /** Valid bill with neither matching */
    neitherMatching: () =>
      createMockBillFetchSuccess({
        consumer_name: "COMPLETELY DIFFERENT NAME",
        address: "999 Unknown Street",
        city: "Unknown City",
        state: "Unknown State",
      }),

    /** Invalid consumer number */
    invalidConsumer: () => createMockBillFetchInvalidConsumer(),

    /** Invalid operator */
    invalidOperator: () => createMockBillFetchInvalidOperator(),

    /** Service unavailable */
    serviceUnavailable: () => createMockBillFetchServiceUnavailable(),
  },
};

// ==============================================
// HEADERS HELPER
// ==============================================

/**
 * Headers required for API Club API calls.
 */
export function getApiClubHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": API_CLUB_SANDBOX.API_KEY,
  };
}

// ==============================================
// TEST ADDRESS/NAME DATA
// ==============================================

export const TEST_VERIFICATION_DATA = {
  /** Full match scenario - landlord name and address both match */
  FULL_MATCH: {
    tenancy: {
      landlord_name: "RAMESH SHARMA",
      property_address: "123 MG Road, Andheri East",
      property_city: "Mumbai",
      property_state: "Maharashtra",
      property_pincode: "400069",
    },
    bill: {
      consumer_name: "RAMESH SHARMA",
      address: "123 MG Road, Andheri East, 400069",
      city: "Mumbai",
      state: "Maharashtra",
    },
  },

  /** Name matches but address doesn't */
  NAME_MATCH_ONLY: {
    tenancy: {
      landlord_name: "RAMESH SHARMA",
      property_address: "123 MG Road, Andheri East",
      property_city: "Mumbai",
      property_state: "Maharashtra",
      property_pincode: "400069",
    },
    bill: {
      consumer_name: "RAMESH SHARMA",
      address: "456 Different Road, Worli",
      city: "Mumbai",
      state: "Maharashtra",
    },
  },

  /** Address matches but name doesn't */
  ADDRESS_MATCH_ONLY: {
    tenancy: {
      landlord_name: "RAMESH SHARMA",
      property_address: "123 MG Road, Andheri East",
      property_city: "Mumbai",
      property_state: "Maharashtra",
      property_pincode: "400069",
    },
    bill: {
      consumer_name: "SURESH KUMAR",
      address: "123 MG Road, Andheri East, 400069",
      city: "Mumbai",
      state: "Maharashtra",
    },
  },

  /** Neither matches */
  NO_MATCH: {
    tenancy: {
      landlord_name: "RAMESH SHARMA",
      property_address: "123 MG Road, Andheri East",
      property_city: "Mumbai",
      property_state: "Maharashtra",
      property_pincode: "400069",
    },
    bill: {
      consumer_name: "UNKNOWN PERSON",
      address: "999 Different City Road",
      city: "Delhi",
      state: "Delhi",
    },
  },

  /** Name with initials - should still match */
  NAME_WITH_INITIALS: {
    tenancy: {
      landlord_name: "RAMESH KUMAR SHARMA",
      property_address: "123 MG Road, Andheri East",
      property_city: "Mumbai",
      property_state: "Maharashtra",
      property_pincode: "400069",
    },
    bill: {
      consumer_name: "R K SHARMA", // Initials format
      address: "123 MG Road, Andheri East, 400069",
      city: "Mumbai",
      state: "Maharashtra",
    },
  },
} as const;
