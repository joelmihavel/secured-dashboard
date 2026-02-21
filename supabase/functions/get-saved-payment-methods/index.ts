/**
 * Flent Secured v2 - Get Saved Payment Methods Edge Function
 *
 * Retrieves user's saved payment methods (UPI, cards, netbanking).
 * Returns formatted response with sensitive data masked.
 *
 * Endpoint: GET /functions/v1/get-saved-payment-methods
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";

// ==============================================
// TYPES
// ==============================================

interface PaymentMethod {
  id: string;
  type: "upi" | "card" | "netbanking";
  display_name: string;
  is_default: boolean;
  is_verified: boolean;
  nickname: string | null;
  created_at: string;

  // UPI fields
  upi_vpa?: string;
  upi_provider?: string;

  // Card fields (masked)
  card_last4?: string;
  card_network?: string;
  card_type?: string;
  card_issuer?: string;
  card_expiry_month?: number;
  card_expiry_year?: number;
  is_expired?: boolean;

  // Netbanking fields
  bank_code?: string;
  bank_name?: string;
}

interface GetPaymentMethodsResponse {
  success: boolean;
  data: {
    payment_methods: PaymentMethod[];
    primary_method_id: string | null;
    grouped_methods: {
      upi: PaymentMethod[];
      cards: PaymentMethod[];
      netbanking: PaymentMethod[];
    };
    total_count: number;
  };
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // Fetch payment methods ordered by default first, then by creation date
    // Filter out soft-deleted records
    // Fetch payment methods ordered by default first, then by creation date
    const { data: paymentMethods, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch payment methods: ${error.message}`);
    }

    // Find primary/default method
    const primaryMethod = paymentMethods?.find((m) => m.is_default);

    // Helper to check if card is expired
    const isCardExpired = (month: number, year: number): boolean => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      if (year < currentYear) return true;
      if (year === currentYear && month < currentMonth) return true;
      return false;
    };

    // Format response - hide sensitive data, include type-specific fields
    const formattedMethods: PaymentMethod[] = (paymentMethods || []).map((m) => {
      // Generate display name based on type
      let displayName = m.nickname || "";
      if (m.type === "upi" && !displayName) {
        displayName = `UPI - ${m.upi_vpa}`;
      } else if (m.type === "card" && !displayName) {
        const network = m.card_network?.charAt(0).toUpperCase() + m.card_network?.slice(1) || "Card";
        displayName = `${network} ****${m.card_last4}`;
      } else if (m.type === "netbanking" && !displayName) {
        displayName = m.bank_name || "Net Banking";
      }

      const base: PaymentMethod = {
        id: m.id,
        type: m.type as "upi" | "card" | "netbanking",
        display_name: displayName,
        is_default: m.is_default,
        is_verified: m.is_verified,
        nickname: m.nickname,
        created_at: m.created_at,
      };

      // Add type-specific fields
      if (m.type === "upi") {
        base.upi_vpa = m.upi_vpa;
        base.upi_provider = m.upi_provider;
      } else if (m.type === "card") {
        base.card_last4 = m.card_last4;
        base.card_network = m.card_network;
        base.card_type = m.card_type;
        base.card_issuer = m.card_issuer;
        base.card_expiry_month = m.card_expiry_month;
        base.card_expiry_year = m.card_expiry_year;
        base.is_expired = isCardExpired(m.card_expiry_month, m.card_expiry_year);
      } else if (m.type === "netbanking") {
        base.bank_code = m.bank_code;
        base.bank_name = m.bank_name;
      }

      return base;
    });

    // Group by type for easy client access
    const groupedMethods = {
      upi: formattedMethods.filter((m) => m.type === "upi"),
      cards: formattedMethods.filter((m) => m.type === "card"),
      netbanking: formattedMethods.filter((m) => m.type === "netbanking"),
    };

    // Build response
    const response: GetPaymentMethodsResponse = {
      success: true,
      data: {
        payment_methods: formattedMethods,
        primary_method_id: primaryMethod?.id ?? null,
        grouped_methods: groupedMethods,
        total_count: formattedMethods.length,
      },
    };

    return jsonResponse(response);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
