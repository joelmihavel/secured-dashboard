import { confidencePercent } from "@/lib/utils";
import type { UserFunnel } from "@/types/user";

export type DecisionState = "READY" | "NEEDS_REVIEW" | "BLOCKED";

export interface Issue {
  label: string;
  severity: "blocker" | "warning";
}

export interface DecisionResult {
  state: DecisionState;
  issues: Issue[];
}

export function computeDecision(user: UserFunnel): DecisionResult {
  const issues: Issue[] = [];

  // Blockers
  if (!user.landlord_bank_verified)
    issues.push({ label: "Landlord bank not verified", severity: "blocker" });

  if (!user.landlord_bank_pan_verified)
    issues.push({ label: "Landlord PAN not verified", severity: "blocker" });

  if (user.extraction_status !== "completed")
    issues.push({ label: "Agreement not extracted", severity: "blocker" });

  if (!user.monthly_rent_paise || user.monthly_rent_paise <= 0)
    issues.push({ label: "No rent amount", severity: "blocker" });

  if (!user.property_address)
    issues.push({ label: "No property address", severity: "blocker" });

  if (!user.landlord_name && !user.landlord_display_name)
    issues.push({ label: "No landlord info", severity: "blocker" });

  if (!user.lease_start_date)
    issues.push({ label: "No lease dates", severity: "blocker" });

  if (user.lease_end_date) {
    const leaseEnd = new Date(user.lease_end_date);
    if (leaseEnd < new Date())
      issues.push({ label: "Lease expired", severity: "blocker" });
  }

  if (user.user_status === "active")
    issues.push({ label: "Already active", severity: "blocker" });

  // Warnings
  if (user.risk_level === "HIGH")
    issues.push({ label: "High risk level", severity: "warning" });

  if (user.m360_status !== "SUCCESS")
    issues.push({ label: "M360 not verified", severity: "warning" });

  const decisionConfidencePct = confidencePercent(user.extraction_confidence);
  if (decisionConfidencePct != null && decisionConfidencePct < 70)
    issues.push({ label: `Low confidence (${decisionConfidencePct}%)`, severity: "warning" });

  if (user.bank_verified !== true)
    issues.push({ label: "Tenant bank not verified", severity: "warning" });

  if (user.utility_verified !== true)
    issues.push({ label: "Utility not verified", severity: "warning" });

  if (user.stamp_verification_status !== "verified")
    issues.push({ label: "Stamp not verified", severity: "warning" });

  if (user.landlord_approved !== true)
    issues.push({ label: "Landlord not confirmed", severity: "warning" });

  if (user.landlord_bank_pan_verified === true && user.landlord_bank_verified !== true)
    issues.push({ label: "PAN verified but bank failed", severity: "warning" });

  const blockers = issues.filter((i) => i.severity === "blocker");
  const warnings = issues.filter((i) => i.severity === "warning");

  let state: DecisionState;
  if (blockers.length > 0) state = "BLOCKED";
  else if (warnings.length > 0) state = "NEEDS_REVIEW";
  else state = "READY";

  return { state, issues };
}

export function decisionBadgeStyle(state: DecisionState): string {
  switch (state) {
    case "READY":
      return "bg-success/10 text-success border-success/30";
    case "NEEDS_REVIEW":
      return "bg-warning/10 text-warning border-warning/30";
    case "BLOCKED":
      return "bg-destructive/10 text-destructive border-destructive/30";
  }
}

export function sortByPriority(users: UserFunnel[]): UserFunnel[] {
  const stateOrder: Record<DecisionState, number> = {
    BLOCKED: 0,
    NEEDS_REVIEW: 1,
    READY: 2,
  };
  const riskOrder: Record<string, number> = {
    HIGH: 0,
    MED: 1,
    LOW: 2,
    PENDING: 3,
  };
  return [...users].sort((a, b) => {
    const da = computeDecision(a);
    const db = computeDecision(b);
    const stateComp = stateOrder[da.state] - stateOrder[db.state];
    if (stateComp !== 0) return stateComp;
    const riskComp =
      (riskOrder[a.risk_level || "PENDING"] ?? 3) -
      (riskOrder[b.risk_level || "PENDING"] ?? 3);
    if (riskComp !== 0) return riskComp;
    const ta = new Date(a.signed_up_at || 0).getTime();
    const tb = new Date(b.signed_up_at || 0).getTime();
    return tb - ta;
  });
}
