/**
 * Flent Secured v2 - Get Landlord Tenancy Edge Function
 *
 * Returns the most recent tenancy where the authenticated user is the landlord.
 *
 * Endpoint: GET /functions/v1/get-landlord-tenancy
 * Auth: Required (User JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // Fetch the user's phone number from the users table
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("phone")
      .eq("id", userId)
      .single();

    if (userError || !userRow?.phone) {
      return errorResponse("User phone number not found", 404, "USER_NOT_FOUND");
    }

    const phone: string = userRow.phone;

    // Build both +91 and bare variants so we match regardless of how the phone
    // was stored on the tenancy record.
    const phoneWithPrefix = phone.startsWith("+91") ? phone : `+91${phone}`;
    const phoneWithout = phone.startsWith("+91") ? phone.slice(3) : phone;

    // Query tenancy where landlord_phone matches either variant
    const { data: tenancy, error: tenancyError } = await supabase
      .from("tenancies")
      .select(`
        id,
        agreement_cert_id,
        property_address,
        landlord_name,
        monthly_rent_paise,
        maintenance_paise,
        lease_start_date,
        lease_end_date,
        rent_due_day,
        status,
        landlord_approved,
        extracted_rental_info:extracted_rental_info_id (
          security_deposit_paise,
          tenant_name,
          tenant_names,
          property_name,
          rent_duration_months,
          landlord_names
        )
      `)
      .in('landlord_phone', [phoneWithPrefix, phoneWithout])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tenancyError) {
      console.error("Failed to fetch landlord tenancy:", tenancyError);
      throw new Error("Failed to fetch tenancy");
    }

    if (!tenancy) {
      return jsonResponse({ success: true, data: null });
    }

    const info = (tenancy as any).extracted_rental_info;

    return jsonResponse({
      success: true,
      data: {
        id: tenancy.id,
        agreement_cert_id: tenancy.agreement_cert_id ?? null,
        property_address: tenancy.property_address,
        property_name: info?.property_name ?? null,
        tenant_name: info?.tenant_name ?? null,
        tenant_names: info?.tenant_names ?? [],
        landlord_name: tenancy.landlord_name,
        landlord_names: info?.landlord_names ?? [],
        monthly_rent_paise: tenancy.monthly_rent_paise,
        security_deposit_paise: info?.security_deposit_paise ?? null,
        maintenance_paise: tenancy.maintenance_paise ?? null,
        lease_start_date: tenancy.lease_start_date ?? null,
        lease_end_date: tenancy.lease_end_date ?? null,
        rent_due_day: tenancy.rent_due_day,
        rent_duration_months: info?.rent_duration_months ?? null,
        status: tenancy.status,
        landlord_approved: tenancy.landlord_approved,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
