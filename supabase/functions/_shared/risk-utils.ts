/**
 * Flent Secured v2 - Risk Assessment Utility
 *
 * Computes a multi-signal risk score for waitlist entries.
 * Called from: join-waitlist, verify-identity, verify-pan, verify-bank,
 *              verify-upi-vpa, verify-utility, admin-waitlist, compute-risk.
 *
 * 14 weighted signals across two phases:
 *
 * PRE-WAITLIST (phase: "pre") — available before admin reviews:
 *  1. pan_verification       (wt 3) — PAN valid + name matched to agreement landlord
 *  2. bank_verification      (wt 3) — Penny drop SUCCESS + name matched to agreement landlord
 *  3. name_consistency       (wt 3) — Cross-source: PAN name ≈ bank name ≈ agreement landlord
 *  4. agreement_completeness (wt 2) — Extraction quality, key fields, manual review flag
 *  5. agreement_expiry       (wt 4) — Lease end date relative to today
 *  6. phone_duplicate        (wt 5) — Duplicate phone on another approved/active user
 *  7. rent_reasonableness    (wt 2) — Monthly rent in expected range (₹5K–₹5L)
 *  8. tenant_name_match      (wt 4) — User full_name matched against agreement tenant names
 *
 * POST-WAITLIST (phase: "post") — SKIPPED if no data:
 *  9. m360_risk_intel        (wt 4) — Cashfree Mobile 360 risk intelligence
 * 10. m360_data_available    (wt 3) — Whether M360 verification succeeded
 * 11. credit_score           (wt 3) — M360 credit score
 * 12. utility_verification   (wt 2) — Utility bill name + address match
 * 13. landlord_response      (wt 3) — Landlord approval/decline status
 * 14. agreement_confidence   (wt 2) — Extraction confidence score (0-100)
 */

// ==============================================
// TYPES
// ==============================================

export interface RiskFactor {
  factor: string;
  signal: "GREEN" | "YELLOW" | "RED" | "MISSING";
  weight: number;
  detail: string;
  phase: "pre" | "post";
  continuous_score?: number;
  data_state?: "present" | "missing";
  scored_at?: string;
  freshness_decay?: number;
}

export interface RiskResult {
  risk_level: "LOW" | "MED" | "HIGH" | "PENDING";
  risk_factors: RiskFactor[];
  risk_ratio?: number;
  total_score?: number;
  max_possible?: number;
}

type Signal = "GREEN" | "YELLOW" | "RED" | "MISSING";

// ==============================================
// SIGNAL SCORING
// ==============================================

const SIGNAL_SCORE: Record<Signal, number> = {
  GREEN: 1,
  YELLOW: 2,
  RED: 3,
  MISSING: 1.5,
};

// Interpolate a value within a range to a continuous score (0 = safest, 1 = riskiest)
function continuousScore(
  value: number,
  greenMin: number,
  yellowMin: number,
  redBelow: number
): number {
  if (value >= greenMin) return 0;
  if (value >= yellowMin) return 0.5 * (1 - (value - yellowMin) / (greenMin - yellowMin));
  if (value >= redBelow) return 0.5 + 0.5 * (1 - (value - redBelow) / (yellowMin - redBelow));
  return 1;
}

// Freshness decay: signals older than 90 days get a bump toward riskier scores
function freshnessMultiplier(scoredAt: string | null): number {
  if (!scoredAt) return 1;
  const ageMs = Date.now() - new Date(scoredAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 90) return 1;
  if (ageDays <= 180) return 1.1;
  return 1.2;
}

// ==============================================
// NAME SIMILARITY (lightweight, no Gemini)
// ==============================================

function normalizeNameForComparison(name: string): string {
  return name
    .toUpperCase()
    .replace(/\(HUF\)/gi, "")
    .replace(/\b(MR|MRS|MS|DR|SHRI|SMT|KUMARI|LATE|PROF|S\/O|W\/O|D\/O)\b/gi, "")
    .replace(/[^A-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesAreSimilar(a: string, b: string): boolean {
  const na = normalizeNameForComparison(a);
  const nb = normalizeNameForComparison(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Check if one contains the other (subset match)
  if (na.includes(nb) || nb.includes(na)) return true;
  // Simple word overlap — if ≥50% of shorter name's words appear in longer
  const wordsA = na.split(" ");
  const wordsB = nb.split(" ");
  const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const longer = wordsA.length > wordsB.length ? wordsA : wordsB;
  const overlap = shorter.filter((w) => longer.includes(w)).length;
  return shorter.length > 0 && overlap / shorter.length >= 0.5;
}

// ==============================================
// MAIN EXPORT
// ==============================================

/**
 * Computes risk level and factors for a user's waitlist entry.
 * Non-fatal: returns PENDING if computation fails.
 *
 * @param userId - The user's UUID
 * @param supabase - Service-role Supabase client
 */
export async function computeRisk(
  userId: string,
  supabase: {
    from: (table: string) => any;
  }
): Promise<RiskResult> {
  try {
    // ── Fetch all data in parallel ──────────────────────────
    const [
      userResult,
      ivResult,
      extractionResult,
      bankResult,
      utilityResult,
      tenancyResult,
      extractionCountResult,
    ] = await Promise.all([
      // users — tenant match + phone
      supabase
        .from("users")
        .select("tenant_match_score, tenant_match_type, phone")
        .eq("id", userId)
        .single(),
      // identity_verifications — latest M360 data
      supabase
        .from("identity_verifications")
        .select("status, m360_risk_intelligence, m360_credit_score, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // extracted_rental_info — latest completed extraction
      supabase
        .from("extracted_rental_info")
        .select(
          "confidence_score, lease_end_date, extraction_status, needs_manual_review, " +
            "contract_status, tenant_names, landlord_names, monthly_rent_paise, " +
            "property_address, lease_start_date, rent_due_day, fields_extracted, total_fields"
        )
        .eq("user_id", userId)
        .eq("extraction_status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // bank_accounts — primary landlord account
      supabase
        .from("bank_accounts")
        .select(
          "verified, penny_drop_status, agreement_name_matched, agreement_name_match_score, " +
            "pan_verified, pan_name_matched, pan_status, pan_type, pan_registered_name, " +
            "verified_account_holder_name, created_at"
        )
        .eq("user_id", userId)
        .eq("party_type", "landlord")
        .eq("is_primary", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // utility_verifications — latest
      supabase
        .from("utility_verifications")
        .select("name_verified, address_verified, name_match_score, address_match_score, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // tenancies — latest
      supabase
        .from("tenancies")
        .select("landlord_status, landlord_approved, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // extraction count — how many completed extractions
      supabase
        .from("extracted_rental_info")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    const user = userResult.data;
    const iv = ivResult.data;
    const extraction = extractionResult.data;
    const bank = bankResult.data;
    const utility = utilityResult.data;
    const tenancy = tenancyResult.data;
    const extractionCount = extractionCountResult.count ?? 0;

    // Phone duplicate check with time-window (needs user.phone first)
    let phoneDupState: "none" | "recent" | "stale" = "none";
    if (user?.phone) {
      const { data: dupResult } = await supabase
        .from("users")
        .select("id, updated_at")
        .eq("phone", user.phone)
        .neq("id", userId)
        .in("user_status", ["approved", "active"])
        .limit(1)
        .maybeSingle();
      if (dupResult) {
        const updatedAt = dupResult.updated_at ? new Date(dupResult.updated_at) : null;
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        phoneDupState = updatedAt && updatedAt > sixMonthsAgo ? "recent" : "stale";
      }
    }

    const factors: RiskFactor[] = [];

    // ════════════════════════════════════════════
    // PRE-WAITLIST SIGNALS (phase: "pre")
    // ════════════════════════════════════════════

    // --- Signal 1: pan_verification (weight 3) ---
    {
      const bankCreatedAt = bank?.created_at as string | null;
      if (bank) {
        const panStatus = bank.pan_status as string | null;
        const panVerified = bank.pan_verified as boolean | null;
        const panNameMatched = bank.pan_name_matched as boolean | null;
        let panSignal: Signal;
        let panDetail: string;

        if (panVerified === true && panNameMatched === true) {
          panSignal = "GREEN";
          panDetail = `PAN verified and name matched (type=${bank.pan_type ?? "N/A"})`;
        } else if (panStatus && panStatus !== "VALID") {
          panSignal = "RED";
          panDetail = `PAN invalid (status=${panStatus})`;
        } else if (panVerified === false && panNameMatched === false) {
          panSignal = "YELLOW";
          panDetail = `PAN valid but name not matched to agreement landlord`;
        } else if (panStatus === null) {
          panSignal = "MISSING";
          panDetail = "PAN not yet verified — awaiting data";
        } else {
          panSignal = "YELLOW";
          panDetail = `PAN partial (verified=${panVerified}, name_matched=${panNameMatched})`;
        }
        factors.push({ factor: "pan_verification", signal: panSignal, weight: 3, detail: panDetail, phase: "pre", data_state: panSignal === "MISSING" ? "missing" : "present", scored_at: bankCreatedAt ?? undefined, freshness_decay: freshnessMultiplier(bankCreatedAt) });
      } else {
        factors.push({ factor: "pan_verification", signal: "MISSING", weight: 3, detail: "No bank account record — PAN verification pending", phase: "pre", data_state: "missing" });
      }
    }

    // --- Signal 2: bank_verification (weight 3) ---
    {
      const bankCreatedAt = bank?.created_at as string | null;
      if (bank) {
        const bankVerified = bank.verified as boolean | null;
        const pennyDropStatus = bank.penny_drop_status as string | null;
        const agreementNameMatched = bank.agreement_name_matched as boolean | null;
        const nameMatchScore = bank.agreement_name_match_score as number | null;
        let bankSignal: Signal;
        let bankDetail: string;
        let contScore: number | undefined;

        if (bankVerified === true && agreementNameMatched === true) {
          bankSignal = "GREEN";
          bankDetail = `Bank verified, name matched to agreement landlord`;
          contScore = nameMatchScore != null ? continuousScore(nameMatchScore, 80, 50, 30) : 0;
        } else if (pennyDropStatus === "FAILURE") {
          bankSignal = "RED";
          bankDetail = "Penny drop failed — bank account could not be verified";
          contScore = 1;
        } else if (bankVerified === true && agreementNameMatched === false) {
          bankSignal = "YELLOW";
          bankDetail = `Bank verified but holder name does not match agreement landlord (score=${nameMatchScore ?? "N/A"})`;
          contScore = nameMatchScore != null ? continuousScore(nameMatchScore, 80, 50, 30) : 0.5;
        } else if (pennyDropStatus === null || pennyDropStatus === undefined) {
          bankSignal = "MISSING";
          bankDetail = "Bank verification not yet initiated — awaiting data";
        } else if (pennyDropStatus === "SUCCESS" && bankVerified === false) {
          bankSignal = "YELLOW";
          bankDetail = "Penny drop succeeded but account not marked verified";
          contScore = 0.4;
        } else {
          bankSignal = "MISSING";
          bankDetail = `Bank verification pending (status=${pennyDropStatus})`;
        }
        factors.push({ factor: "bank_verification", signal: bankSignal, weight: 3, detail: bankDetail, phase: "pre", continuous_score: contScore, data_state: bankSignal === "MISSING" ? "missing" : "present", scored_at: bankCreatedAt ?? undefined, freshness_decay: freshnessMultiplier(bankCreatedAt) });
      } else {
        factors.push({ factor: "bank_verification", signal: "MISSING", weight: 3, detail: "No bank account record — verification pending", phase: "pre", data_state: "missing" });
      }
    }

    // --- Signal 3: name_consistency (weight 3) ---
    // Cross-check PAN registered name, bank verified name, agreement landlord names
    if (bank) {
      const panName = bank.pan_registered_name as string | null;
      const bankName = bank.verified_account_holder_name as string | null;
      const landlordNames = (extraction?.landlord_names as string[] | null) ?? [];

      const sources: { label: string; name: string }[] = [];
      if (panName) sources.push({ label: "PAN", name: panName });
      if (bankName) sources.push({ label: "Bank", name: bankName });
      if (landlordNames.length > 0) sources.push({ label: "Agreement", name: landlordNames[0] });

      if (sources.length >= 2) {
        // Check pairwise similarity
        let matchCount = 0;
        let totalPairs = 0;
        for (let i = 0; i < sources.length; i++) {
          for (let j = i + 1; j < sources.length; j++) {
            totalPairs++;
            if (namesAreSimilar(sources[i].name, sources[j].name)) matchCount++;
          }
        }

        let ncSignal: Signal;
        let ncDetail: string;
        if (matchCount === totalPairs) {
          ncSignal = "GREEN";
          ncDetail = `All ${sources.length} name sources consistent (${sources.map((s) => s.label).join(", ")})`;
        } else if (matchCount > 0) {
          ncSignal = "YELLOW";
          ncDetail = `Partial name consistency: ${matchCount}/${totalPairs} pairs match (${sources.map((s) => `${s.label}: "${s.name}"`).join(", ")})`;
        } else {
          ncSignal = "RED";
          ncDetail = `Name conflict across sources: ${sources.map((s) => `${s.label}: "${s.name}"`).join(", ")}`;
        }
        factors.push({ factor: "name_consistency", signal: ncSignal, weight: 3, detail: ncDetail, phase: "pre" });
      }
      // If < 2 sources, skip this signal (can't cross-check)
    }

    // --- Signal 4: agreement_completeness (weight 2) ---
    {
      let acSignal: Signal;
      let acDetail: string;

      if (!extraction) {
        acSignal = "MISSING";
        acDetail = "No completed extraction found — awaiting document upload";
      } else {
        const status = extraction.extraction_status as string;
        const needsReview = extraction.needs_manual_review as boolean | null;
        const confScore = extraction.confidence_score as number | null;
        const hasAddress = !!(extraction.property_address);
        const hasRent = (extraction.monthly_rent_paise as number | null) != null && (extraction.monthly_rent_paise as number) > 0;
        const hasNames = !!(extraction.landlord_names as string[] | null)?.length && !!(extraction.tenant_names as string[] | null)?.length;
        const hasDates = !!(extraction.lease_start_date);
        const keyFieldsPresent = hasAddress && hasRent && hasNames && hasDates;

        if (status === "completed" && keyFieldsPresent && (confScore ?? 0) >= 80 && !needsReview) {
          acSignal = "GREEN";
          acDetail = `Extraction complete: ${extraction.fields_extracted ?? "?"}/${extraction.total_fields ?? "?"} fields, confidence=${confScore}%`;
        } else if (status === "completed" && ((confScore ?? 0) >= 50 || needsReview || !keyFieldsPresent)) {
          const issues: string[] = [];
          if ((confScore ?? 0) < 80) issues.push(`confidence=${confScore}%`);
          if (needsReview) issues.push("needs manual review");
          if (!keyFieldsPresent) {
            const missing: string[] = [];
            if (!hasAddress) missing.push("address");
            if (!hasRent) missing.push("rent");
            if (!hasNames) missing.push("names");
            if (!hasDates) missing.push("dates");
            issues.push(`missing: ${missing.join(", ")}`);
          }
          acSignal = "YELLOW";
          acDetail = `Extraction completed with issues: ${issues.join("; ")}`;
        } else {
          acSignal = "RED";
          acDetail = `Extraction incomplete (status=${status}, confidence=${confScore ?? "N/A"}%)`;
        }
      }
      factors.push({ factor: "agreement_completeness", signal: acSignal, weight: 2, detail: acDetail, phase: "pre", data_state: !extraction ? "missing" : "present" });
    }

    // --- Signal 5: agreement_expiry (weight 4) ---
    {
      const leaseEndDate = extraction?.lease_end_date as string | null;
      let aeSignal: Signal;
      let aeDetail: string;

      if (leaseEndDate) {
        const endDate = new Date(leaseEndDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sixtyDaysOut = new Date(today);
        sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);

        if (!isNaN(endDate.getTime()) && endDate < today) {
          aeSignal = "RED";
          aeDetail = `Agreement expired on ${leaseEndDate}`;
        } else if (!isNaN(endDate.getTime()) && endDate < sixtyDaysOut) {
          aeSignal = "YELLOW";
          aeDetail = `Agreement expiring soon (${leaseEndDate})`;
        } else {
          aeSignal = "GREEN";
          aeDetail = `Agreement valid until ${leaseEndDate}`;
        }
      } else {
        aeSignal = "MISSING";
        aeDetail = "Lease end date not extracted — cannot verify agreement validity";
      }
      factors.push({ factor: "agreement_expiry", signal: aeSignal, weight: 4, detail: aeDetail, phase: "pre", data_state: leaseEndDate ? "present" : "missing" });
    }

    // --- Signal 6: phone_duplicate (weight 5) ---
    {
      let pdSignal: Signal;
      let pdDetail: string;
      if (phoneDupState === "recent") {
        pdSignal = "RED";
        pdDetail = "Duplicate phone on another approved/active account (active within 6 months)";
      } else if (phoneDupState === "stale") {
        pdSignal = "YELLOW";
        pdDetail = "Duplicate phone found but other account inactive for 6+ months (possible phone recycling)";
      } else {
        pdSignal = "GREEN";
        pdDetail = "No duplicate phone detected";
      }
      factors.push({ factor: "phone_duplicate", signal: pdSignal, weight: 5, detail: pdDetail, phase: "pre", data_state: "present" });
    }

    // --- Signal 7: rent_reasonableness (weight 2) ---
    {
      const rentPaise = extraction?.monthly_rent_paise as number | null;
      let rrSignal: Signal;
      let rrDetail: string;

      if (rentPaise == null || rentPaise <= 0) {
        rrSignal = "MISSING";
        rrDetail = "No rent amount available — awaiting extraction";
      } else {
        const rentRupees = rentPaise / 100;
        if (rentRupees >= 5000 && rentRupees <= 500000) {
          rrSignal = "GREEN";
          rrDetail = `Rent ₹${rentRupees.toLocaleString("en-IN")}/month — within expected range`;
        } else {
          rrSignal = "RED";
          rrDetail = `Rent ₹${rentRupees.toLocaleString("en-IN")}/month — outside expected range (₹5K–₹5L)`;
        }
      }
      factors.push({ factor: "rent_reasonableness", signal: rrSignal, weight: 2, detail: rrDetail, phase: "pre", data_state: rentPaise == null || rentPaise <= 0 ? "missing" : "present" });
    }

    // --- Signal 8: tenant_name_match (weight 4) ---
    {
      const tenantScore = user?.tenant_match_score as number | null;
      const tenantType = user?.tenant_match_type as string | null;
      let tnSignal: Signal;
      let tnDetail: string;

      if (tenantType === "no_match") {
        tnSignal = "RED";
        tnDetail = `No tenant name match (type=${tenantType})`;
      } else if (tenantScore !== null && tenantScore < 40) {
        tnSignal = "RED";
        tnDetail = `Low tenant match score (${tenantScore})`;
      } else if (
        tenantScore !== null &&
        tenantScore >= 70 &&
        (tenantType === "exact" || tenantType === "strong")
      ) {
        tnSignal = "GREEN";
        tnDetail = `Strong tenant match (score=${tenantScore}, type=${tenantType})`;
      } else if (tenantScore === null && tenantType === null) {
        tnSignal = "MISSING";
        tnDetail = "Tenant name matching not yet performed — awaiting data";
      } else {
        tnSignal = "YELLOW";
        tnDetail = `Partial tenant match (score=${tenantScore ?? "N/A"}, type=${tenantType ?? "N/A"})`;
      }
      const tnContScore = tenantScore != null ? continuousScore(tenantScore, 70, 40, 20) : undefined;
      factors.push({ factor: "tenant_name_match", signal: tnSignal, weight: 4, detail: tnDetail, phase: "pre", continuous_score: tnContScore, data_state: tenantScore === null && tenantType === null ? "missing" : "present" });
    }

    // ════════════════════════════════════════════
    // POST-WAITLIST SIGNALS (phase: "post")
    // These are SKIPPED entirely if no data exists.
    // ════════════════════════════════════════════

    // --- Signal 9: m360_risk_intel (weight 4) --- SKIP if no iv record
    if (iv) {
      const ivCreatedAt = iv.created_at as string | null;
      const riskIntel = iv.m360_risk_intelligence as
        | { is_safe?: boolean; safe?: boolean; risk_level?: string }
        | null;
      const isSafe = riskIntel?.is_safe ?? riskIntel?.safe;
      let riSignal: Signal;
      let riDetail: string;

      if (!riskIntel) {
        riSignal = "MISSING";
        riDetail = "M360 risk intelligence not yet available — awaiting verification";
      } else if (isSafe === false || riskIntel.risk_level === "HIGH") {
        riSignal = "RED";
        riDetail = `Unsafe (is_safe=${isSafe}, risk_level=${riskIntel.risk_level})`;
      } else if (isSafe === true && riskIntel.risk_level === "LOW") {
        riSignal = "GREEN";
        riDetail = `Safe (risk_level=${riskIntel.risk_level})`;
      } else {
        riSignal = "YELLOW";
        riDetail = `Moderate (is_safe=${isSafe}, risk_level=${riskIntel.risk_level})`;
      }
      factors.push({ factor: "m360_risk_intel", signal: riSignal, weight: 4, detail: riDetail, phase: "post", data_state: !riskIntel ? "missing" : "present", scored_at: ivCreatedAt ?? undefined, freshness_decay: freshnessMultiplier(ivCreatedAt) });
    }

    // --- Signal 10: m360_data_available (weight 3) --- SKIP if no iv record
    if (iv) {
      const ivCreatedAt = iv.created_at as string | null;
      const ivStatus = iv.status as string | null;
      let mdSignal: Signal;
      let mdDetail: string;

      if (ivStatus === "SUCCESS") {
        mdSignal = "GREEN";
        mdDetail = "M360 verification successful";
      } else if (
        ivStatus === "CONSENT_GIVEN" ||
        ivStatus === "OTP_SENT" ||
        ivStatus === "DETAILS_NOT_FOUND"
      ) {
        mdSignal = "MISSING";
        mdDetail = `M360 in progress (status=${ivStatus}) — awaiting completion`;
      } else if (ivStatus === "FAILED") {
        mdSignal = "RED";
        mdDetail = `M360 failed (status=${ivStatus})`;
      } else {
        mdSignal = "MISSING";
        mdDetail = `M360 status: ${ivStatus ?? "unknown"} — awaiting data`;
      }
      factors.push({ factor: "m360_data_available", signal: mdSignal, weight: 3, detail: mdDetail, phase: "post", data_state: mdSignal === "MISSING" ? "missing" : "present", scored_at: ivCreatedAt ?? undefined, freshness_decay: freshnessMultiplier(ivCreatedAt) });
    }

    // --- Signal 11: credit_score (weight 3) --- SKIP if no iv record
    if (iv) {
      const ivCreatedAt = iv.created_at as string | null;
      const creditScore = iv.m360_credit_score as number | null;
      let csSignal: Signal;
      let csDetail: string;
      let csContScore: number | undefined;

      if (creditScore === null || creditScore === undefined) {
        csSignal = "MISSING";
        csDetail = "Credit score not available from M360 — awaiting data";
      } else {
        csContScore = continuousScore(creditScore, 700, 500, 350);
        if (creditScore >= 700) {
          csSignal = "GREEN";
          csDetail = `Good credit score (${creditScore})`;
        } else if (creditScore >= 500) {
          csSignal = "YELLOW";
          csDetail = `Moderate credit score (${creditScore})`;
        } else {
          csSignal = "RED";
          csDetail = `Low credit score (${creditScore})`;
        }
      }
      factors.push({ factor: "credit_score", signal: csSignal, weight: 3, detail: csDetail, phase: "post", continuous_score: csContScore, data_state: creditScore == null ? "missing" : "present", scored_at: ivCreatedAt ?? undefined, freshness_decay: freshnessMultiplier(ivCreatedAt) });
    }

    // --- Signal 12: utility_verification (weight 2) --- SKIP if no utility record
    if (utility) {
      const utilCreatedAt = utility.created_at as string | null;
      if (utility.status === "pending") {
        factors.push({ factor: "utility_verification", signal: "MISSING", weight: 2, detail: "Utility verification pending — awaiting result", phase: "post", data_state: "missing" });
      } else {
        const nameVerified = utility.name_verified as boolean | null;
        const addressVerified = utility.address_verified as boolean | null;
        let uvSignal: Signal;
        let uvDetail: string;

        if (nameVerified === true && addressVerified === true) {
          uvSignal = "GREEN";
          uvDetail = `Utility bill: name verified (score=${utility.name_match_score}), address verified (score=${utility.address_match_score})`;
        } else if (nameVerified === false && addressVerified === false) {
          uvSignal = "RED";
          uvDetail = `Utility bill: name mismatch (score=${utility.name_match_score}), address mismatch (score=${utility.address_match_score})`;
        } else {
          uvSignal = "YELLOW";
          uvDetail = `Utility bill: name=${nameVerified ? "pass" : "fail"} (${utility.name_match_score}), address=${addressVerified ? "pass" : "fail"} (${utility.address_match_score})`;
        }
        factors.push({ factor: "utility_verification", signal: uvSignal, weight: 2, detail: uvDetail, phase: "post", data_state: "present", scored_at: utilCreatedAt ?? undefined, freshness_decay: freshnessMultiplier(utilCreatedAt) });
      }
    }

    // --- Signal 13: landlord_response (weight 3) --- SKIP if no tenancy or landlord not contacted
    if (tenancy) {
      const tenancyCreatedAt = tenancy.created_at as string | null;
      const landlordStatus = tenancy.landlord_status as string | null;
      const landlordApproved = tenancy.landlord_approved as boolean | null;

      if (landlordApproved === true || landlordStatus === "verified") {
        factors.push({ factor: "landlord_response", signal: "GREEN", weight: 3, detail: `Landlord approved (status=${landlordStatus})`, phase: "post", data_state: "present", scored_at: tenancyCreatedAt ?? undefined, freshness_decay: freshnessMultiplier(tenancyCreatedAt) });
      } else if (landlordStatus === "declined") {
        factors.push({ factor: "landlord_response", signal: "RED", weight: 3, detail: "Landlord DECLINED — disputed the agreement", phase: "post", data_state: "present", scored_at: tenancyCreatedAt ?? undefined });
      } else if (landlordStatus === "invited") {
        factors.push({ factor: "landlord_response", signal: "MISSING", weight: 3, detail: "Landlord invited, awaiting response", phase: "post", data_state: "missing" });
      }
      // If landlord_status is "none" or null, skip — not yet in the flow
    }

    // --- Signal 14: agreement_confidence (weight 2) ---
    {
      const confidence = extraction?.confidence_score as number | null;
      let cfSignal: Signal;
      let cfDetail: string;
      let cfContScore: number | undefined;

      if (confidence === null || confidence === undefined) {
        cfSignal = "MISSING";
        cfDetail = "No extraction confidence data available — awaiting extraction";
      } else {
        cfContScore = continuousScore(confidence, 80, 50, 30);
        const pct = confidence;
        if (pct >= 80) {
          cfSignal = "GREEN";
          cfDetail = `High extraction confidence (${pct}%)`;
        } else if (pct >= 50) {
          cfSignal = "YELLOW";
          cfDetail = `Moderate extraction confidence (${pct}%)`;
        } else {
          cfSignal = "RED";
          cfDetail = `Low extraction confidence (${pct}%)`;
        }
      }
      factors.push({ factor: "agreement_confidence", signal: cfSignal, weight: 2, detail: cfDetail, phase: "pre", continuous_score: cfContScore, data_state: confidence == null ? "missing" : "present" });
    }

    // ── Compute overall risk level ──────────────────────────
    // Use continuous scores where available, fall back to discrete SIGNAL_SCORE
    // Apply freshness decay multiplier to stale signals
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const totalScore = factors.reduce((sum, f) => {
      const baseScore = f.continuous_score != null
        ? 1 + f.continuous_score * 2  // Map 0-1 continuous to 1-3 scale
        : SIGNAL_SCORE[f.signal];
      const decay = f.freshness_decay ?? 1;
      return sum + Math.min(baseScore * decay, 3) * f.weight;
    }, 0);
    const maxPossible = totalWeight * 3; // All RED
    const ratio = totalWeight > 0 ? totalScore / maxPossible : 0;

    // Rule: Any single RED (not MISSING) with weight >= 4 -> HIGH
    const hasHighWeightRed = factors.some((f) => f.signal === "RED" && f.weight >= 4);

    let risk_level: RiskResult["risk_level"];
    if (hasHighWeightRed || ratio >= 0.6) {
      risk_level = "HIGH";
    } else if (ratio >= 0.35) {
      risk_level = "MED";
    } else {
      risk_level = "LOW";
    }

    return { risk_level, risk_factors: factors, risk_ratio: Math.round(ratio * 1000) / 1000, total_score: Math.round(totalScore * 100) / 100, max_possible: maxPossible };
  } catch (error) {
    console.error("[risk-utils] Failed to compute risk:", error);
    return {
      risk_level: "PENDING",
      risk_factors: [
        {
          factor: "computation_error",
          signal: "YELLOW",
          weight: 0,
          detail: error instanceof Error ? error.message : "Unknown error",
          phase: "pre",
        },
      ],
    };
  }
}

// ==============================================
// CONVENIENCE: COMPUTE + STORE
// ==============================================

/**
 * Computes risk and persists the result to waitlist_entries.
 * Use this from edge functions instead of calling computeRisk + manual update.
 */
export async function recomputeAndStoreRisk(
  userId: string,
  supabase: { from: (table: string) => any }
): Promise<RiskResult> {
  const result = await computeRisk(userId, supabase);

  // Determine phase: "post" if any M360/utility/landlord signals were scored
  const postOnlyFactors = ["m360_risk_intel", "m360_data_available", "credit_score", "utility_verification", "landlord_response"];
  const hasPostSignals = result.risk_factors.some((f) => postOnlyFactors.includes(f.factor));

  await supabase
    .from("waitlist_entries")
    .update({
      risk_level: result.risk_level,
      risk_factors: result.risk_factors,
      risk_computed_at: new Date().toISOString(),
      risk_phase: hasPostSignals ? "post" : "pre",
      risk_ratio: result.risk_ratio,
    })
    .eq("user_id", userId);

  return result;
}
