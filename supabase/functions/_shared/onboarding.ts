import { recomputeAndStoreRisk } from "./risk-utils.ts";
import { isTestUser } from "./demo-helpers.ts";
import { matchNameAgainstCandidates } from "./gemini.ts";
import { resolveAgreementNames, matchAgainstAgreementNames } from "./name-match-service.ts";

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

  // Compute risk if the entry is new, OR if risk has never been computed
  // successfully (PENDING / NULL). This retries transient risk failures
  // on subsequent onboarding runs instead of leaving users stuck on
  // "Risk Score" missing data forever.
  let shouldComputeRisk = result.is_new;
  if (!shouldComputeRisk) {
    const { data: existingEntry } = await supabase
      .from("waitlist_entries")
      .select("risk_level, risk_computed_at")
      .eq("id", result.entry_id)
      .maybeSingle();
    if (
      existingEntry &&
      (existingEntry.risk_computed_at == null ||
        existingEntry.risk_level == null ||
        existingEntry.risk_level === "PENDING")
    ) {
      shouldComputeRisk = true;
    }
  }
  if (shouldComputeRisk) {
    try {
      await recomputeAndStoreRisk(userId, supabase);
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

  // First: supersede any prior pending_verification tenancies this user
  // had that point to OTHER (older) extractions. A re-upload produces a
  // new extraction + a new tenancy; the old one was never activated and
  // never carried payments, so it's safe to remove. Done BEFORE the
  // existence check so re-runs also clean stale siblings. We deliberately
  // do NOT touch tenancies with any status other than pending_verification.
  // Two-step supersede (see tenancy.ts in cloud-run for explanation).
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
      "[onboarding] Failed to clean up prior pending_verification tenancies (non-fatal):",
      supersedeErrA?.message ?? supersedeErrB?.message,
    );
  } else if (totalSuperseded > 0) {
    console.log(
      `[onboarding] Superseded ${totalSuperseded} prior pending_verification tenanc${totalSuperseded === 1 ? "y" : "ies"} for user ${userId} (re-upload with new extraction)`,
    );
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
      // Clamp to [1, 28] — the tenancies_rent_due_day_check constraint rejects
      // anything outside this range, so an extraction that returned 29-31
      // (e.g. last day of month) would otherwise hard-fail the INSERT.
      rent_due_day: Math.min(Math.max(extraction.rent_due_day || 1, 1), 28),
      cashback_cutoff_day: extraction.rent_due_day
        ? Math.min(extraction.rent_due_day + (extraction.rent_grace_period_days ?? 0), 28)
        : null,
      lease_start_date: leaseStartDate,
      lease_end_date: extraction.lease_end_date ?? null,
      landlord_name: landlordName,
      landlord_names: extraction.landlord_names ?? (landlordName ? [landlordName] : null),
      // Landlord contact details intentionally omitted — must be provided by the
      // tenant user (invite-landlord flow), not pulled from the extracted agreement.
      // Extracted phone/email stays in extracted_rental_info for admin reference only.
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

/**
 * Deferred name matching for pre-waitlist bank verification.
 *
 * When a user adds bank details before waitlist (no tenancy yet), the penny drop
 * runs but name matching is skipped (agreement_name_match_details = { skipped: true }).
 * Once extraction completes and a tenancy is created, this function picks up those
 * pending accounts and runs Gemini name matching against the newly-available
 * landlord names from the agreement.
 *
 * Outcomes:
 * - Name matches:  bank stays verified, tenancy.bank_verified = true, attempt status advance
 * - Name mismatch: bank.verified = false, user must redo bank verification post-approval
 * - No pending banks or no landlord names: no-op (early return)
 *
 * This is intentionally non-fatal — callers wrap in try/catch.
 */
async function runDeferredBankNameMatching(
  supabase: SupabaseClientLike,
  userId: string,
  tenancyId: string,
): Promise<void> {
  // 1. Find pre-verified bank accounts (penny drop done, name match was skipped)
  //    The JSONB filter targets accounts created in the pre-waitlist flow where
  //    no tenancy existed yet, so name matching was deferred.
  const { data: pendingBanks, error: bankQueryError } = await supabase
    .from("bank_accounts")
    .select("id, verified_account_holder_name, pan_registered_name, pan_verified, pan_verification_details, penny_drop_status, agreement_name_match_details")
    .eq("user_id", userId)
    .eq("party_type", "landlord")
    .eq("is_primary", true)
    .eq("penny_drop_status", "SUCCESS")
    .not("agreement_name_match_details", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (bankQueryError) {
    console.error("[onboarding] Deferred bank name matching — query failed:", bankQueryError);
    return;
  }

  // Filter in code for skipped === true (more reliable than JSONB operator variations)
  const skippedBanks = (pendingBanks ?? []).filter(
    (b: any) => b.agreement_name_match_details?.skipped === true,
  );

  if (skippedBanks.length === 0) return; // nothing to match

  // Take the most recent primary landlord bank account
  const bank = skippedBanks[0];
  if (!bank.verified_account_holder_name) return;

  // 2. Resolve landlord names from the new tenancy/extraction
  const resolved = await resolveAgreementNames(supabase, tenancyId, "landlord");
  if (resolved.names.length === 0) {
    console.log("[onboarding] Deferred bank name matching — no landlord names available yet");
    return;
  }

  // 3. Run Gemini name matching (with Levenshtein fallback)
  const matchResult = await matchAgainstAgreementNames({
    verifiedName: bank.verified_account_holder_name,
    candidateNames: resolved.names,
    context: "agreement_bank_verification",
  });

  // 4. Update bank account with match result.
  //    Pre-fix: kept verified=true on no_match, treating it as informational
  //    for admin review. New product flow makes name match a hard gate, so
  //    we flip verified=false when match fails. The user will be re-routed
  //    to /(agreement)/add-bank-details on next launch (journey router checks
  //    bankDetailsAreSettled which requires verified=true).
  //
  //    Deferred path itself is being phased out — verify-bank/verify-upi-vpa
  //    now refuse with AGREEMENT_NOT_PROCESSED when landlord names aren't
  //    available yet, so this function should rarely fire. Kept as a
  //    self-correcting safety net for any legacy rows or unforeseen paths.
  const nameMatched = matchResult.matched;
  const bankUpdate: Record<string, unknown> = {
    agreement_name_matched: nameMatched,
    agreement_name_match_score: matchResult.score,
    agreement_name_match_details: {
      ...matchResult.details,
      deferred: true,
      matched_at: new Date().toISOString(),
    },
  };
  if (!nameMatched) {
    bankUpdate.verified = false;
    bankUpdate.verified_at = null;
  }
  const { error: updateError } = await supabase
    .from("bank_accounts")
    .update(bankUpdate)
    .eq("id", bank.id);

  if (updateError) {
    console.error(`[onboarding] Deferred bank name matching — update failed for bank ${bank.id}:`, updateError);
    return;
  }

  console.log(
    `[onboarding] Deferred name match for bank ${bank.id}: matched=${nameMatched}, score=${matchResult.score}`,
  );

  // 4b. Run PAN name matching if PAN was verified pre-waitlist
  let panNameMatched: boolean | null = null;
  let panMatchScore: number | null = null;
  if (bank.pan_registered_name && bank.pan_verified) {
    try {
      const panMatchResult = await matchAgainstAgreementNames({
        verifiedName: bank.pan_registered_name,
        candidateNames: resolved.names,
        context: "pan_verification",
      });
      panNameMatched = panMatchResult.matched;
      panMatchScore = panMatchResult.score;

      await supabase.from("bank_accounts").update({
        pan_name_matched: panMatchResult.matched,
        pan_name_match_score: panMatchResult.score,
        pan_verification_details: {
          ...(typeof bank.pan_verification_details === 'object' ? bank.pan_verification_details : {}),
          ...panMatchResult.details,
          deferred: true,
          matched_at: new Date().toISOString(),
        },
      }).eq("id", bank.id);

      console.log(
        `[onboarding] Deferred PAN name match for bank ${bank.id}: matched=${panNameMatched}, score=${panMatchScore}`,
      );
    } catch (panErr) {
      console.warn("[onboarding] Deferred PAN name matching failed (non-fatal):", panErr);
    }
  }

  // 5. Sync tenancies.bank_verified to the match outcome.
  //    Pre-fix: unconditionally set bank_verified=true (penny drop succeeded,
  //    let admin review name mismatch). New product flow says name match is
  //    a hard gate, so bank_verified mirrors the match result.
  const matchedLandlordName = nameMatched ? matchResult.matchedName : null;
  await supabase
    .from("tenancies")
    .update({
      bank_verified: nameMatched,
      ...(matchedLandlordName && { landlord_name: matchedLandlordName }),
    })
    .eq("id", tenancyId);

  // Recompute risk — the expanded risk engine reads bank_accounts columns directly
  // (pan_name_matched, agreement_name_matched, etc.) so we don't need to manually
  // append risk_factors. This ensures one source of truth for risk computation.
  try {
    await recomputeAndStoreRisk(userId, supabase);
  } catch (riskErr) {
    console.error("[onboarding] Risk recompute after deferred matching failed (non-fatal):", riskErr);
  }

  // Attempt user_status advancement (approved -> active) — no-ops if not yet approved
  await supabase
    .rpc("check_and_advance_to_active", { p_user_id: userId })
    .catch((err: any) =>
      console.warn("[onboarding] check_and_advance_to_active failed (non-fatal):", err),
    );
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

  // Deferred name matching for pre-waitlist bank verification.
  // If the user added bank details before extraction completed (no tenancy yet),
  // those accounts have agreement_name_match_details = { skipped: true }.
  // Now that the tenancy exists, run name matching against extracted landlord names.
  if (tenancyId) {
    try {
      await runDeferredBankNameMatching(supabase, userId, tenancyId);
    } catch (err) {
      console.error("[onboarding] Deferred bank name matching failed (non-fatal):", err);
    }
  }

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

  // Target specific waitlist entry (not all of user's entries) to prevent
  // overwriting data on older entries if user has multiple extractions
  await supabase
    .from("waitlist_entries")
    .update(waitlistPayload)
    .eq("id", waitlistState.entryId);

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
