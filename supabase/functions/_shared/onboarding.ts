import { computeRisk } from "./risk-utils.ts";
import { isTestUser } from "./demo-helpers.ts";
import { matchNameAgainstCandidates } from "./gemini.ts";

type SupabaseClientLike = any;
type ExtractionRow = Record<string, any>;

interface EnsureWaitlistStateOptions {
  supabase: SupabaseClientLike;
  userId: string;
  currentUserStatus?: string | null;
}

interface EnsureWaitlistStateResult {
  entryId?: string;
  position?: number;
  isNew: boolean;
  finalUserStatus: string;
}

interface EnsureTenancyForExtractionOptions {
  supabase: SupabaseClientLike;
  userId: string;
  extraction: ExtractionRow;
  confirmedRole?: "tenant" | "landlord";
}

interface EnsureTenancyForExtractionResult {
  tenancyId?: string;
  /** When tenancyId is undefined due to incomplete extraction data, lists the missing fields. */
  missingFields?: string[];
}

interface FinalizeExtractionOptions {
  supabase: SupabaseClientLike;
  userId: string;
  extractionId: string;
  confirmedRole?: "tenant" | "landlord";
  extractionUpdates?: Record<string, any>;
  syncWaitlistFields?: Record<string, any>;
  autoApproveDemo?: boolean;
}

interface FinalizeExtractionResult {
  extraction: ExtractionRow;
  tenancyId?: string;
  waitlistEntryId?: string;
  finalUserStatus: string;
  autoApprovedDemo: boolean;
}

export async function ensureWaitlistState(
  options: EnsureWaitlistStateOptions,
): Promise<EnsureWaitlistStateResult> {
  const { supabase, userId } = options;
  let currentUserStatus = options.currentUserStatus;

  if (!currentUserStatus) {
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("user_status")
      .eq("id", userId)
      .single();

    if (userError || !userRow) {
      throw new Error(`Failed to verify user status: ${userError?.message ?? "missing user"}`);
    }

    currentUserStatus = userRow.user_status;
  }

  const { data: rpcResult, error: rpcError } = await supabase
    .rpc("join_waitlist", { p_user_id: userId })
    .single();

  if (rpcError) {
    throw new Error(`Failed to join waitlist: ${rpcError.message}`);
  }

  const result = rpcResult as {
    entry_id: string;
    entry_position: number;
    is_new: boolean;
  };

  let finalUserStatus = currentUserStatus ?? "signed_up";

  if (["signed_up", "agreement_confirmed"].includes(finalUserStatus)) {
    const { error: statusError } = await supabase
      .from("users")
      .update({
        user_status: "waitlisted",
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .in("user_status", ["signed_up", "agreement_confirmed"]);

    if (statusError) {
      console.error("[onboarding] Failed to advance user_status to waitlisted:", statusError);
    } else {
      finalUserStatus = "waitlisted";
    }
  }

  if (result.is_new) {
    try {
      const riskResult = await computeRisk(userId, supabase);
      await supabase
        .from("waitlist_entries")
        .update({
          risk_level: riskResult.risk_level,
          risk_factors: riskResult.risk_factors,
          risk_computed_at: new Date().toISOString(),
        })
        .eq("id", result.entry_id);
    } catch (riskError) {
      console.error("[onboarding] Risk computation failed (non-fatal):", riskError);
    }
  }

  return {
    entryId: result.entry_id,
    position: result.entry_position,
    isNew: result.is_new,
    finalUserStatus,
  };
}

export async function ensureTenancyForExtraction(
  options: EnsureTenancyForExtractionOptions,
): Promise<EnsureTenancyForExtractionResult> {
  const { supabase, userId, extraction, confirmedRole = "tenant" } = options;

  if (confirmedRole !== "tenant") {
    return { tenancyId: undefined };
  }

  if (extraction.tenancy_id) {
    return { tenancyId: extraction.tenancy_id as string };
  }

  const { data: existingTenancy } = await supabase
    .from("tenancies")
    .select("id")
    .eq("user_id", userId)
    .eq("extracted_rental_info_id", extraction.id)
    .maybeSingle();

  if (existingTenancy?.id) {
    await supabase
      .from("extracted_rental_info")
      .update({ tenancy_id: existingTenancy.id })
      .eq("id", extraction.id);

    return { tenancyId: existingTenancy.id as string };
  }

  const landlordName = extraction.landlord_name
    ?? (Array.isArray(extraction.landlord_names) && extraction.landlord_names.length > 0
      ? extraction.landlord_names.join(" & ")
      : null);
  const propertyAddress = extraction.property_address
    ?? (
      [
        extraction.property_name,
        extraction.micromarket,
        extraction.property_city,
        extraction.property_state,
        extraction.property_pincode,
      ].filter(Boolean).join(", ")
      || null
    );
  const monthlyRentPaise = Number(extraction.monthly_rent_paise ?? 0);
  const leaseStartDate = extraction.lease_start_date ?? null;

  if (!propertyAddress || !landlordName || monthlyRentPaise <= 0 || !leaseStartDate) {
    const missing: string[] = [];
    if (!propertyAddress) missing.push("property_address");
    if (!landlordName) missing.push("landlord_name");
    if (monthlyRentPaise <= 0) missing.push("monthly_rent_paise");
    if (!leaseStartDate) missing.push("lease_start_date");
    return { tenancyId: undefined, missingFields: missing };
  }

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
      rent_due_day: extraction.rent_due_day || 1,
      cashback_cutoff_day: extraction.rent_due_day || null,
      lease_start_date: leaseStartDate,
      lease_end_date: extraction.lease_end_date ?? null,
      landlord_name: landlordName,
      landlord_names: extraction.landlord_names ?? (landlordName ? [landlordName] : null),
      landlord_phone: extraction.landlord_phone ?? null,
      landlord_email: extraction.landlord_email ?? null,
    })
    .select("id")
    .single();

  let tenancyId = tenancy?.id as string | undefined;

  if (tenancyError?.code === "23505") {
    const { data: raceTenancy } = await supabase
      .from("tenancies")
      .select("id")
      .eq("user_id", userId)
      .eq("extracted_rental_info_id", extraction.id)
      .single();
    tenancyId = raceTenancy?.id as string | undefined;
  } else if (tenancyError) {
    throw new Error(`Failed to create tenancy: ${tenancyError.message}`);
  }

  if (tenancyId) {
    await supabase
      .from("extracted_rental_info")
      .update({ tenancy_id: tenancyId })
      .eq("id", extraction.id);
  }

  return { tenancyId };
}

async function matchTenantName(
  supabase: SupabaseClientLike,
  userId: string,
  extraction: ExtractionRow,
): Promise<void> {
  const { data: userRow } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", userId)
    .single();

  const tenantNames = Array.isArray(extraction.tenant_names) ? extraction.tenant_names : [];

  if (userRow?.full_name && tenantNames.length > 0) {
    const matchResult = await matchNameAgainstCandidates(
      userRow.full_name,
      tenantNames,
      "tenant_verification",
    );

    const bestMatchIndex = matchResult.matched_name
      ? tenantNames.indexOf(matchResult.matched_name)
      : -1;

    await supabase
      .from("users")
      .update({
        matched_tenant_index: bestMatchIndex >= 0 ? bestMatchIndex : null,
        tenant_match_score: matchResult.confidence,
        tenant_match_type: matchResult.match_type,
      })
      .eq("id", userId);
    return;
  }

  await supabase
    .from("users")
    .update({
      tenant_match_type: "no_match",
      tenant_match_score: 0,
    })
    .eq("id", userId);
}

export async function maybeAutoApproveDemoUser(options: {
  supabase: SupabaseClientLike;
  userId: string;
  waitlistEntryId?: string;
}): Promise<{ autoApproved: boolean; finalUserStatus: string }> {
  const { supabase, userId, waitlistEntryId } = options;

  if (!waitlistEntryId || !(await isTestUser(userId, supabase))) {
    return { autoApproved: false, finalUserStatus: "waitlisted" };
  }

  const { data: tenancy } = await supabase
    .from("tenancies")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["pending", "pending_verification", "active"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tenancy?.id) {
    return { autoApproved: false, finalUserStatus: "waitlisted" };
  }

  await supabase
    .from("waitlist_entries")
    .update({ admin_review: "approved" })
    .eq("id", waitlistEntryId);

  await supabase
    .from("users")
    .update({
      user_status: "approved",
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  await supabase
    .from("tenancies")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenancy.id)
    .in("status", ["pending", "pending_verification"]);

  return { autoApproved: true, finalUserStatus: "approved" };
}

export async function finalizeExtractionForOnboarding(
  options: FinalizeExtractionOptions,
): Promise<FinalizeExtractionResult> {
  const {
    supabase,
    userId,
    extractionId,
    confirmedRole = "tenant",
    extractionUpdates = {},
    syncWaitlistFields = {},
    autoApproveDemo = false,
  } = options;

  const { data: existingExtraction, error: fetchError } = await supabase
    .from("extracted_rental_info")
    .select("*")
    .eq("id", extractionId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !existingExtraction) {
    throw new Error(`Extraction record not found: ${fetchError?.message ?? extractionId}`);
  }

  if (existingExtraction.extraction_status !== "completed") {
    throw new Error(`Extraction not complete: ${existingExtraction.extraction_status}`);
  }

  const nextExtractionUpdates: Record<string, any> = { ...extractionUpdates };
  if (!existingExtraction.user_verified) {
    nextExtractionUpdates.user_verified = true;
    nextExtractionUpdates.verified_at = new Date().toISOString();
  }

  if (Object.keys(nextExtractionUpdates).length > 0) {
    const { error: updateError } = await supabase
      .from("extracted_rental_info")
      .update(nextExtractionUpdates)
      .eq("id", extractionId);

    if (updateError) {
      throw new Error(`Failed to finalize extraction: ${updateError.message}`);
    }
  }

  const { data: extraction, error: refreshError } = await supabase
    .from("extracted_rental_info")
    .select("*")
    .eq("id", extractionId)
    .single();

  if (refreshError || !extraction) {
    throw new Error(`Failed to refresh extraction: ${refreshError?.message ?? extractionId}`);
  }

  const { error: roleError } = await supabase
    .from("users")
    .update({
      role: confirmedRole,
      is_role_locked: true,
      role_locked_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .eq("is_role_locked", false);

  if (roleError) {
    console.error("[onboarding] Failed to lock user role:", roleError);
  }

  try {
    await matchTenantName(supabase, userId, extraction);
  } catch (matchError) {
    console.error("[onboarding] Tenant matching failed (non-fatal):", matchError);
  }

  const { tenancyId } = await ensureTenancyForExtraction({
    supabase,
    userId,
    extraction,
    confirmedRole,
  });

  // If admin already approved this user (race: approval arrived before
  // process-document completed), the tenancy was just created as
  // "pending_verification" but admin-waitlist's activation step already ran.
  // Auto-activate the tenancy so it doesn't stay pending forever.
  if (tenancyId) {
    const { data: waitlistRow } = await supabase
      .from("waitlist_entries")
      .select("admin_review")
      .eq("user_id", userId)
      .maybeSingle();

    if (waitlistRow?.admin_review === "approved") {
      console.log(`[onboarding] User ${userId} already approved — auto-activating tenancy ${tenancyId}`);
      await supabase
        .from("tenancies")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenancyId)
        .eq("status", "pending_verification");
    }
  }

  const waitlistState = await ensureWaitlistState({
    supabase,
    userId,
  });

  const waitlistPayload: Record<string, any> = {
    extraction_id: extraction.id,
    extraction_status: extraction.extraction_status,
    contract_status: extraction.contract_status,
    ...syncWaitlistFields,
  };

  await supabase
    .from("waitlist_entries")
    .update(waitlistPayload)
    .eq("user_id", userId);

  let finalUserStatus = waitlistState.finalUserStatus;
  let autoApproved = false;

  if (autoApproveDemo) {
    const demoResult = await maybeAutoApproveDemoUser({
      supabase,
      userId,
      waitlistEntryId: waitlistState.entryId,
    });
    autoApproved = demoResult.autoApproved;
    finalUserStatus = demoResult.finalUserStatus;
  }

  return {
    extraction,
    tenancyId,
    waitlistEntryId: waitlistState.entryId,
    finalUserStatus,
    autoApprovedDemo: autoApproved,
  };
}
