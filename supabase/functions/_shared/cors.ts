/**
 * Flent Secured v2 - CORS Configuration
 *
 * Standard CORS headers for Edge Functions.
 */

// ==============================================
// CORS HEADERS
// ==============================================

// ==============================================
// ALLOWED ORIGINS
// ==============================================

/**
 * Allowed origins for CORS.
 * Environment-dependent: production restricts to known domains only.
 */
const IS_PRODUCTION = Deno.env.get("ENVIRONMENT") === "production";

const PRODUCTION_ORIGINS = [
  "https://flentsecured.com",
  "https://www.flentsecured.com",
  "https://app.flentsecured.com",
  "https://landlord.flentsecured.com",
  "https://uowjtrzmszuaiokqxgir.supabase.co",
  "https://zqlowjveyqiagnbmfwsb.supabase.co",
];

const DEVELOPMENT_ORIGINS = [
  ...PRODUCTION_ORIGINS,
  "https://uowjtrzmszuaiokqxgir.supabase.co",
  "http://localhost:3000",
  "http://localhost:8081",
  "capacitor://localhost",
  "http://localhost",
];

const ALLOWED_ORIGINS = IS_PRODUCTION ? PRODUCTION_ORIGINS : DEVELOPMENT_ORIGINS;

/**
 * Check if origin is allowed.
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Get CORS headers for a specific request.
 * Returns origin-specific headers for security.
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-idempotency-key, x-request-id, x-admin-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * Standard CORS headers for API responses.
 * @deprecated Use getCorsHeaders(request) for origin-specific headers
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key, x-request-id, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/**
 * Creates a CORS preflight response.
 * Use this to handle OPTIONS requests.
 */
export function handleCors(request: Request): Response | null {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  return null;
}

/**
 * Adds CORS headers to an existing Response.
 */
export function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// ==============================================
// RESPONSE HELPERS
// ==============================================

/**
 * Creates a JSON response with CORS headers.
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

/**
 * Creates an error response with CORS headers.
 */
export function errorResponse(
  message: string,
  status = 400,
  code?: string,
  details?: unknown
): Response {
  return jsonResponse(
    {
      error: true,
      message,
      code: code ?? `ERR_${status}`,
      details,
    },
    status
  );
}

/**
 * Creates a success response with CORS headers.
 */
export function successResponse<T>(data: T, message?: string): Response {
  return jsonResponse({
    success: true,
    message,
    data,
  });
}
