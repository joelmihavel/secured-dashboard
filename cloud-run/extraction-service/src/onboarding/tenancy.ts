/**
 * Flent Secured v2 - Tenancy Creation (Cloud Run Port)
 *
 * Ported from: supabase/functions/_shared/onboarding.ts -> ensureTenancyForExtraction
 *
 * Creates a tenancy record from extraction data.
 * Includes race condition handling (duplicate key catch -> query existing)
 * and critical field validation before insert.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ==============================================
// TYPES
// ==============================================

type ExtractionRow = Record<string, any>;

export interface EnsureTenancyForExtractionOptions {
  supabase: SupabaseClient;
  userId: string;
  extraction: ExtractionRow;
  confirmedRole?: "tenant" | "landlord";
}

export interface EnsureTenancyForExtractionResult {
  tenancyId?: string;
  /** When tenancyId is undefined due to incomplete extraction data, lists the missing fields. */
  missingFields?: string[];
}

// ==============================================
// MAIN EXPORT
// ==============================================

export async function ensureTenancyForExtraction(
  options: EnsureTenancyForExtractionOptions
): Promise<EnsureTenancyForExtractionResult> {
  const { supabase, userId, extraction, confirmedRole = "tenant" } = options;

  // Only create tenancy for tenant role
  if (confirmedRole !== "tenant") {
    return { tenancyId: undefined };
  }

  // Already linked
  if (extraction.tenancy_id) {
    return { tenancyId: extraction.tenancy_id as string };
  }

  // First: supersede any prior pending_verification tenancies this user
  // had that point to OTHER (older) extractions. A re-upload produces a
  // new extraction + a new tenancy; the old one was never activated and
  // never carried payments (payments only flow post-approval), so it's
  // safe to remove. Tenancies with status other than pending_verification
  // (active / superseded / etc.) are left untouched — they carry business
  // state.
  //
  // Done BEFORE the existence check so that re-runs for an already-
  // processed extraction also get the chance to clean up stale siblings.
  // Two-step supersede:
  //   (a) delete pending_verification tenancies for this user where
  //       extracted_rental_info_id != current extraction (re-upload case).
  //   (b) delete pending_verification tenancies whose
  //       extracted_rental_info_id IS NULL (FK ON DELETE SET NULL cascade
  //       leftovers).
  // Two separate calls because `.neq()` in PostgREST treats NULL as
  // unknown (skips it), and `.or(... .is.null, ... .neq.X)` had a quoting
  // bug that produced invalid SQL.
  const { data: supersededByExtraction, error: supersedeErrA } = await supabase
    .from("tenancies")
    .delete()
    .eq("user_id", userId)
    .eq("status", "pending_verification")
    .neq("extracted_rental_info_id", extraction.id)
    .select("id");

  const { data: supersededOrphans, error: supersedeErrB } = await supabase
    .from("tenancies")
    .delete()
    .eq("user_id", userId)
    .eq("status", "pending_verification")
    .is("extracted_rental_info_id", null)
    .select("id");

  const totalSuperseded =
    (supersededByExtraction?.length ?? 0) + (supersededOrphans?.length ?? 0);

  if (supersedeErrA || supersedeErrB) {
    console.warn(
      "[tenancy] Failed to supersede prior pending_verification tenancies (non-fatal):",
      supersedeErrA?.message ?? supersedeErrB?.message
    );
  } else if (totalSuperseded > 0) {
    console.log(
      `[tenancy] Superseded ${totalSuperseded} prior pending_verification tenanc${totalSuperseded === 1 ? "y" : "ies"} for user ${userId} (re-upload with new extraction)`
    );
  }

  // Check if tenancy already exists for this extraction (idempotency)
  const { data: existingTenancy } = await supabase
    .from("tenancies")
    .select("id")
    .eq("user_id", userId)
    .eq("extracted_rental_info_id", extraction.id)
    .maybeSingle();

  if ((existingTenancy as Record<string, any>)?.id) {
    // Link extraction to existing tenancy
    await supabase
      .from("extracted_rental_info")
      .update({ tenancy_id: (existingTenancy as Record<string, any>).id })
      .eq("id", extraction.id);

    return { tenancyId: (existingTenancy as Record<string, any>).id as string };
  }

  // Build derived fields
  const landlordName =
    extraction.landlord_name ??
    (Array.isArray(extraction.landlord_names) &&
    extraction.landlord_names.length > 0
      ? extraction.landlord_names.join(" & ")
      : null);

  const propertyAddress =
    extraction.property_address ??
    ([
      extraction.property_name,
      extraction.micromarket,
      extraction.property_city,
      extraction.property_state,
      extraction.property_pincode,
    ]
      .filter(Boolean)
      .join(", ") || null);

  const monthlyRentPaise = Number(extraction.monthly_rent_paise ?? 0);
  const leaseStartDate = extraction.lease_start_date ?? null;

  // Validate critical fields
  if (
    !propertyAddress ||
    !landlordName ||
    monthlyRentPaise <= 0 ||
    !leaseStartDate
  ) {
    const missing: string[] = [];
    if (!propertyAddress) missing.push("property_address");
    if (!landlordName) missing.push("landlord_name");
    if (monthlyRentPaise <= 0) missing.push("monthly_rent_paise");
    if (!leaseStartDate) missing.push("lease_start_date");
    console.warn(`[tenancy] Cannot create tenancy for user ${userId}: missing fields: ${missing.join(", ")}`, {
      propertyAddress: !!propertyAddress,
      landlordName,
      monthlyRentPaise,
      leaseStartDate,
      extractionLandlordName: extraction.landlord_name,
      extractionLandlordNames: extraction.landlord_names,
    });
    return { tenancyId: undefined, missingFields: missing };
  }

  // B7/C7: when extraction.rent_due_day is null/0, the `|| 1` fallback below
  // fabricates day-1 silently. Capture this so we can leave a breadcrumb in
  // audit_logs after the tenancy is created.
  const rentDueDayInferred = !extraction.rent_due_day;

  // Insert tenancy
  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .insert({
      user_id: userId,
      extracted_rental_info_id: extraction.id,
      status: "pending_verification",
      property_address: propertyAddress,
      property_city: extraction.property_city ?? null,
      property_state: extraction.property_state ?? null,
      property_pincode: extraction.property_pincode ?? null,
      monthly_rent_paise: monthlyRentPaise,
      maintenance_paise: extraction.maintenance_paise ?? 0,
      // Clamp to [1, 28] — the tenancies_rent_due_day_check constraint rejects
      // anything outside this range, so an extraction returning 29-31 (e.g.
      // last day of month) would otherwise hard-fail the INSERT.
      rent_due_day: Math.min(Math.max(extraction.rent_due_day || 1, 1), 28),
      cashback_cutoff_day: extraction.rent_due_day
        ? Math.min(extraction.rent_due_day + (extraction.rent_grace_period_days ?? 0), 28)
        : null,
      lease_start_date: leaseStartDate,
      lease_end_date: extraction.lease_end_date ?? null,
      landlord_name: landlordName,
      landlord_names:
        extraction.landlord_names ??
        (landlordName ? [landlordName] : null),
      // Landlord contact details intentionally omitted -- must be provided by the
      // tenant user (invite-landlord flow), not pulled from the extracted agreement.
      // Extracted phone/email stays in extracted_rental_info for admin reference only.
    })
    .select("id")
    .single();

  let tenancyId = (tenancy as Record<string, any>)?.id as string | undefined;

  // Handle race condition: duplicate key (another request created it concurrently)
  if ((tenancyError as any)?.code === "23505") {
    const { data: raceTenancy } = await supabase
      .from("tenancies")
      .select("id")
      .eq("user_id", userId)
      .eq("extracted_rental_info_id", extraction.id)
      .single();
    tenancyId = (raceTenancy as Record<string, any>)?.id as string | undefined;
  } else if (tenancyError) {
    throw new Error(
      `Failed to create tenancy: ${tenancyError.message}`
    );
  }

  // Link extraction to tenancy
  if (tenancyId) {
    await supabase
      .from("extracted_rental_info")
      .update({ tenancy_id: tenancyId })
      .eq("id", extraction.id);

    // B7/C7: breadcrumb when rent_due_day was fabricated by the fallback. Only
    // emit on the create-branch (not the race-branch) — the racing writer
    // owns its own breadcrumb. Non-fatal: never block tenancy creation on
    // audit failure.
    if (rentDueDayInferred && (tenancyError as any)?.code !== "23505") {
      try {
        await supabase.from("audit_logs").insert({
          user_id: userId,
          actor_type: "system",
          action: "TENANCY_RENT_DUE_DAY_INFERRED",
          action_category: "verification",
          entity_type: "tenancy",
          entity_id: tenancyId,
          status: "success",
          details: {
            reason: "extraction.rent_due_day was null; inferred to 1 by fallback. Manual review recommended.",
            extraction_id: extraction.id,
            fabricated_value: 1,
          },
        });
      } catch (auditErr) {
        console.error("[tenancy] TENANCY_RENT_DUE_DAY_INFERRED audit log failed:", auditErr);
      }
    }
  }

  return { tenancyId };
}
