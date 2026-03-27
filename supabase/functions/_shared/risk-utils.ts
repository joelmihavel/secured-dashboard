/**
 * Flent Secured v2 - Risk Assessment Utility
 *
 * Computes a multi-signal risk score for waitlist entries.
 * Used by join-waitlist (initial computation) and verify-identity (recomputation).
 *
 * 6 weighted signals:
 * 1. tenant_name_match (weight 5) — from users.tenant_match_score/type
 * 2. m360_risk_intel (weight 4) — from identity_verifications.m360_risk_intelligence
 * 3. m360_data_available (weight 3) — from identity_verifications.status
 * 4. credit_score (weight 3) — from identity_verifications.m360_credit_score
 * 5. agreement_confidence (weight 2) — from extracted_rental_info.extraction_confidence
 * 6. agreement_expiry (weight 4) — from extracted_rental_info.lease_end_date (RED if past, YELLOW if missing)
 */

// ==============================================
// TYPES
// ==============================================

export interface RiskFactor {
  factor: string;
  signal: "GREEN" | "YELLOW" | "RED";
  weight: number;
  detail: string;
}

export interface RiskResult {
  risk_level: "LOW" | "MED" | "HIGH" | "PENDING";
  risk_factors: RiskFactor[];
}

type Signal = "GREEN" | "YELLOW" | "RED";

// ==============================================
// SIGNAL SCORING
// ==============================================

const SIGNAL_SCORE: Record<Signal, number> = {
  GREEN: 1,
  YELLOW: 2,
  RED: 3,
};

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
    // Fetch all data in parallel
    const [userResult, ivResult, extractionResult] = await Promise.all([
      supabase
        .from("users")
        .select("tenant_match_score, tenant_match_type")
        .eq("id", userId)
        .single(),
      supabase
        .from("identity_verifications")
        .select("status, m360_risk_intelligence, m360_credit_score")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("extracted_rental_info")
        .select("extraction_confidence, lease_end_date")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const user = userResult.data;
    const iv = ivResult.data;
    const extraction = extractionResult.data;

    const factors: RiskFactor[] = [];

    // --- Signal 1: tenant_name_match (weight 5) ---
    const tenantScore = user?.tenant_match_score as number | null;
    const tenantType = user?.tenant_match_type as string | null;
    let tenantSignal: Signal;
    let tenantDetail: string;

    if (tenantType === "no_match") {
      tenantSignal = "RED";
      tenantDetail = `No tenant match (type=${tenantType})`;
    } else if (tenantScore !== null && tenantScore < 40) {
      tenantSignal = "RED";
      tenantDetail = `Low match score (${tenantScore})`;
    } else if (
      tenantScore !== null &&
      tenantScore >= 70 &&
      (tenantType === "exact" || tenantType === "strong")
    ) {
      tenantSignal = "GREEN";
      tenantDetail = `Strong tenant match (score=${tenantScore}, type=${tenantType})`;
    } else if (tenantScore === null && tenantType === null) {
      tenantSignal = "YELLOW";
      tenantDetail = "Tenant matching not yet performed";
    } else {
      tenantSignal = "YELLOW";
      tenantDetail = `Partial match (score=${tenantScore ?? "N/A"}, type=${tenantType ?? "N/A"})`;
    }
    factors.push({ factor: "tenant_name_match", signal: tenantSignal, weight: 5, detail: tenantDetail });

    // --- Signal 2: m360_risk_intel (weight 4) ---
    // Cashfree uses is_safe, fallback to safe for backward compat
    const riskIntel = iv?.m360_risk_intelligence as { is_safe?: boolean; safe?: boolean; risk_level?: string } | null;
    const isSafe = riskIntel?.is_safe ?? riskIntel?.safe;
    let riskIntelSignal: Signal;
    let riskIntelDetail: string;

    if (!riskIntel) {
      riskIntelSignal = "YELLOW";
      riskIntelDetail = "M360 risk intelligence not yet available";
    } else if (isSafe === false || riskIntel.risk_level === "HIGH") {
      riskIntelSignal = "RED";
      riskIntelDetail = `Unsafe (is_safe=${isSafe}, risk_level=${riskIntel.risk_level})`;
    } else if (isSafe === true && riskIntel.risk_level === "LOW") {
      riskIntelSignal = "GREEN";
      riskIntelDetail = `Safe (risk_level=${riskIntel.risk_level})`;
    } else {
      riskIntelSignal = "YELLOW";
      riskIntelDetail = `Moderate (is_safe=${isSafe}, risk_level=${riskIntel.risk_level})`;
    }
    factors.push({ factor: "m360_risk_intel", signal: riskIntelSignal, weight: 4, detail: riskIntelDetail });

    // --- Signal 3: m360_data_available (weight 3) ---
    const ivStatus = iv?.status as string | null;
    let m360Signal: Signal;
    let m360Detail: string;

    if (ivStatus === "SUCCESS") {
      m360Signal = "GREEN";
      m360Detail = "M360 verification successful";
    } else if (
      ivStatus === "CONSENT_GIVEN" ||
      ivStatus === "OTP_SENT" ||
      ivStatus === "DETAILS_NOT_FOUND"
    ) {
      m360Signal = "YELLOW";
      m360Detail = `M360 status: ${ivStatus}`;
    } else if (!ivStatus || ivStatus === "FAILED") {
      m360Signal = "RED";
      m360Detail = ivStatus ? `M360 failed (status=${ivStatus})` : "No M360 record found";
    } else {
      m360Signal = "YELLOW";
      m360Detail = `M360 status: ${ivStatus}`;
    }
    factors.push({ factor: "m360_data_available", signal: m360Signal, weight: 3, detail: m360Detail });

    // --- Signal 4: credit_score (weight 3) ---
    const creditScore = iv?.m360_credit_score as number | null;
    let creditSignal: Signal;
    let creditDetail: string;

    if (creditScore === null || creditScore === undefined) {
      creditSignal = "YELLOW";
      creditDetail = "Credit score not yet available";
    } else if (creditScore >= 700) {
      creditSignal = "GREEN";
      creditDetail = `Good credit score (${creditScore})`;
    } else if (creditScore >= 500) {
      creditSignal = "YELLOW";
      creditDetail = `Moderate credit score (${creditScore})`;
    } else {
      creditSignal = "RED";
      creditDetail = `Low credit score (${creditScore})`;
    }
    factors.push({ factor: "credit_score", signal: creditSignal, weight: 3, detail: creditDetail });

    // --- Signal 5: agreement_confidence (weight 2) ---
    const confidence = extraction?.extraction_confidence as number | null;
    let confSignal: Signal;
    let confDetail: string;

    if (confidence === null || confidence === undefined) {
      confSignal = "YELLOW";
      confDetail = "No extraction data available";
    } else {
      // extraction_confidence is stored as 0-1 float, convert to percentage
      const pct = confidence > 1 ? confidence : Math.round(confidence * 100);
      if (pct >= 80) {
        confSignal = "GREEN";
        confDetail = `High extraction confidence (${pct}%)`;
      } else if (pct >= 50) {
        confSignal = "YELLOW";
        confDetail = `Moderate extraction confidence (${pct}%)`;
      } else {
        confSignal = "RED";
        confDetail = `Low extraction confidence (${pct}%)`;
      }
    }
    factors.push({ factor: "agreement_confidence", signal: confSignal, weight: 2, detail: confDetail });

    // --- Signal 6: agreement_expiry (weight 4) ---
    // Expired agreements are allowed through but flagged as high risk
    const leaseEndDate = extraction?.lease_end_date as string | null;
    if (leaseEndDate) {
      const endDate = new Date(leaseEndDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!isNaN(endDate.getTime()) && endDate < today) {
        factors.push({
          factor: "agreement_expiry",
          signal: "RED",
          weight: 4,
          detail: `Agreement expired on ${leaseEndDate}`,
        });
      }
    } else {
      factors.push({
        factor: "agreement_expiry",
        signal: "YELLOW",
        weight: 4,
        detail: "Lease end date not extracted — cannot verify agreement validity",
      });
    }

    // --- Compute overall risk level ---
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const totalScore = factors.reduce((sum, f) => sum + SIGNAL_SCORE[f.signal] * f.weight, 0);
    const maxPossible = totalWeight * 3; // All RED
    const ratio = totalScore / maxPossible;

    // Rule: Any single RED with weight >= 4 -> HIGH
    const hasHighWeightRed = factors.some((f) => f.signal === "RED" && f.weight >= 4);

    let risk_level: RiskResult["risk_level"];
    if (hasHighWeightRed || ratio >= 0.6) {
      risk_level = "HIGH";
    } else if (ratio >= 0.35) {
      risk_level = "MED";
    } else {
      risk_level = "LOW";
    }

    return { risk_level, risk_factors: factors };
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
        },
      ],
    };
  }
}
