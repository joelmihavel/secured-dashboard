"use client";

import { useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatCurrencyShort, formatDate, maskPhone, formatRelativeTime } from "@/lib/utils";
import { computeDecision, decisionBadgeStyle } from "@/lib/decision";
import { callEdgeFunction } from "@/lib/supabase";
import type { UserFunnel } from "@/types/user";
import { RiskFactorBreakdown } from "./risk-factor-breakdown";
import { ApprovalPreflight } from "./approval-preflight";
import { RejectDialog } from "@/components/dialogs/reject-dialog";
import { Tip } from "@/components/ui/tip";

const DASH = "—";

function statusBadgeColor(status: string) {
  switch (status) {
    case "active": return "border-success text-success";
    case "approved":
    case "agreement_confirmed": return "border-success/60 text-success";
    case "waitlisted": return "border-warning text-warning";
    default: return "border-muted-foreground/30 text-muted-foreground";
  }
}

export function UserDetail({ user }: { user: UserFunnel }) {
  const [showPreflight, setShowPreflight] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showRawData, setShowRawData] = useState(false);

  const decision = computeDecision(user);
  const initials = (user.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const blockers = decision.issues.filter((i) => i.severity === "blocker");
  const warnings = decision.issues.filter((i) => i.severity === "warning");

  async function handleApprove() {
    setApproving(true);
    setApprovalResult(null);
    try {
      await callEdgeFunction("admin-waitlist", { action: "approve", user_ids: [user.user_id] });
      setApprovalResult({ success: true, message: "User approved successfully" });
      setShowPreflight(false);
    } catch (err) {
      setApprovalResult({ success: false, message: err instanceof Error ? err.message : "Approval failed" });
    } finally {
      setApproving(false);
    }
  }

  const bankVerified = user.bank_verified === true;
  const utilityVerified = user.utility_verified === true;
  const landlordApproved = user.landlord_approved === true;
  const m360Status = user.m360_status || "PENDING";
  const riskLevel = user.risk_level || "PENDING";
  const identityVerified = user.m360_status === "SUCCESS";
  const nameMismatch = identityVerified && user.m360_full_name && user.name &&
    user.m360_full_name.toLowerCase() !== user.name.toLowerCase();

  return (
    <div className="flex flex-1 gap-4 overflow-auto p-6">
      {/* Main content — left/center */}
      <div className="flex flex-1 flex-col gap-4 min-w-0">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <UserAvatar name={user.name || user.phone} size={56} />
          <div className="flex flex-col gap-0.5 flex-1">
            <span className="text-[24px] font-medium tracking-[-0.5px] text-foreground">{user.name || "Unknown"}</span>
            <span className="font-mono text-[12px] text-muted-foreground/50">
              {maskPhone(user.phone)} · {user.user_status?.toUpperCase()} · {user.property_city || "—"}
            </span>
          </div>
          <Badge variant="outline" className={`rounded-xl px-4 py-1.5 font-mono text-[12px] font-semibold ${statusBadgeColor(user.user_status)}`}>
            {user.user_status?.toUpperCase() || DASH}
          </Badge>
        </div>

        {/* Decision summary + Actions */}
        <div className={`flex flex-col rounded-xl border p-4 ${
          decision.state === "READY" ? "border-success/30 bg-success/5" :
          decision.state === "NEEDS_REVIEW" ? "border-warning/30 bg-warning/5" :
          "border-destructive/30 bg-destructive/5"
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold border ${decisionBadgeStyle(decision.state)}`}>
              {decision.state.replace("_", " ")}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground/50">
              {blockers.length} blocker{blockers.length !== 1 ? "s" : ""} · {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
            </span>
            <div className="flex-1" />
            <Button size="sm" className="h-8 rounded-xl bg-success/10 border border-success/30 text-success font-mono text-[11px] font-semibold hover:bg-success/20"
              onClick={() => setShowPreflight(true)} disabled={user.admin_review === "approved"}>
              {user.admin_review === "approved" ? "Approved" : "Approve"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 rounded-xl border-destructive/30 text-destructive font-mono text-[11px] hover:bg-destructive/10"
              onClick={() => setShowRejectDialog(true)} disabled={user.admin_review === "rejected"}>
              {user.admin_review === "rejected" ? "Rejected" : "Reject"}
            </Button>
          </div>
          {blockers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {blockers.map((b, i) => (
                <span key={i} className="rounded-lg px-2.5 py-0.5 font-mono text-[10px] font-medium bg-destructive/10 text-destructive">{b.label}</span>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {warnings.map((w, i) => (
                <span key={i} className="rounded-lg px-2.5 py-0.5 font-mono text-[10px] font-medium bg-warning/10 text-warning">{w.label}</span>
              ))}
            </div>
          )}
        </div>

        {approvalResult && (
          <div className={`rounded-xl border px-4 py-2 font-mono text-[11px] ${approvalResult.success ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
            {approvalResult.message}
          </div>
        )}

        {showPreflight && (
          <ApprovalPreflight user={user} onConfirmApprove={handleApprove} onCancel={() => setShowPreflight(false)} loading={approving} />
        )}

        {/* Agreement card */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <div className="flex items-center justify-between mb-4">
            <Tip text="Rental agreement uploaded by tenant — extracted data used for verification and risk assessment"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Agreement</span></Tip>
            {user.extraction_confidence != null && (
              <div className="flex items-center gap-2">
                <Progress value={user.extraction_confidence} className="h-1.5 w-[100px]" />
                <span className={`font-mono text-[11px] font-bold ${
                  user.extraction_confidence >= 70 ? "text-success" : user.extraction_confidence >= 40 ? "text-warning" : "text-destructive"
                }`}>{user.extraction_confidence}%</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {([
              ["Status", user.extraction_status, user.extraction_status === "completed"],
              ["Rent", formatCurrency(user.monthly_rent_paise) + "/mo", false],
              ["Maintenance", formatCurrency(user.maintenance_paise), false],
              ["Security Deposit", formatCurrency(user.security_deposit_paise), false],
              ["Address", user.property_address, false],
              ["City / State", user.property_city ? `${user.property_city}, ${user.property_state || ""}` : null, false],
              ["Pincode", user.property_pincode, false],
              ["BHK", user.property_bhk_type, false],
              ["Landlord", user.landlord_display_name || user.landlord_name, false],
              ["Landlord Phone", maskPhone(user.landlord_phone, user.landlord_country_code), false],
              ["Lease", user.lease_start_date ? `${formatDate(user.lease_start_date)} – ${formatDate(user.lease_end_date)}` : null, false],
              ["Due Day", user.rent_due_day ? `${user.rent_due_day}th of month` : null, false],
            ] as [string, string | null | undefined, boolean][]).map(([label, value, highlight]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">{label}</span>
                <span className={`text-[13px] text-right max-w-[60%] truncate ${highlight ? "text-success font-mono font-medium" : value ? "text-foreground font-mono" : "text-muted-foreground/30"}`}>
                  {value || DASH}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* M360 Identity card */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <div className="flex items-center justify-between mb-4">
            <Tip text="Identity verification via M360 — checks phone OTP, credit score, age, income, and occupation"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">M360 Identity</span></Tip>
            <span className={`font-mono text-[11px] font-semibold ${identityVerified ? "text-success" : "text-warning"}`}>
              {m360Status}
            </span>
          </div>
          {nameMismatch && (
            <div className="mb-3 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 font-mono text-[11px] text-warning">
              ⚠ Name mismatch: M360 &quot;{user.m360_full_name}&quot; vs profile &quot;{user.name}&quot;
            </div>
          )}
          <div className="flex gap-8 mb-4">
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Age</span>
              <span className="font-mono text-[20px] font-bold text-foreground">{user.m360_age || DASH}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Occupation</span>
              <span className="text-[14px] font-medium text-foreground">{user.m360_occupation || DASH}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Income</span>
              <span className="font-mono text-[14px] font-bold text-foreground">{user.m360_total_income || DASH}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Credit</span>
              <span className="font-mono text-[20px] font-bold text-foreground">{user.m360_credit_score || DASH}</span>
            </div>
          </div>
          <div className="border-t border-[#1F1F1F] pt-3 flex flex-col gap-2">
            {([
              ["Full Name", user.m360_full_name],
              ["Gender", user.m360_gender],
              ["Date of Birth", user.m360_date_of_birth ? formatDate(user.m360_date_of_birth) : null],
              ["Aadhaar", user.m360_aadhaar_masked],
              ["Mobile Provider", user.m360_mobile_provider],
              ["Connection", user.m360_connection_type],
              ["M360 Risk Level", user.m360_risk_level],
              ["Verified At", user.m360_verified_at ? formatDate(user.m360_verified_at) : null],
            ] as [string, string | null | undefined][]).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground/50">{label}</span>
                <span className={`font-mono text-[12px] ${value ? "text-muted-foreground" : "text-muted-foreground/30"}`}>{value || DASH}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stamp Verification */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <div className="flex items-center justify-between mb-3">
            <Tip text="E-stamp verification of the rental agreement — confirms the agreement is legally valid"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Stamp Verification</span></Tip>
            <span className={`font-mono text-[11px] font-semibold ${
              user.stamp_verification_status === "verified" ? "text-success" :
              user.stamp_verification_status ? "text-warning" : "text-muted-foreground/40"
            }`}>{user.stamp_verification_status?.toUpperCase() || "NOT ATTEMPTED"}</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Status</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.stamp_verification_status || DASH}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Verified At</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.stamp_verified_at ? formatDate(user.stamp_verified_at) : DASH}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Attempt</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.stamp_verification_attempt?.toString() || DASH}</span>
            </div>
          </div>
        </div>

        {/* Risk Analysis — full breakdown with radar chart */}
        <RiskFactorBreakdown
          riskLevel={user.risk_level}
          riskPhase={user.risk_phase ?? null}
          riskComputedAt={user.risk_computed_at ?? null}
          riskFactors={user.risk_factors ?? null}
        />

        {/* Waitlist & Admin */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <Tip text="Admin review status, risk scoring, and waitlist position details"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-3">Waitlist & Admin</span></Tip>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {([
              ["Position", user.waitlist_position ? `#${user.waitlist_position}` : null],
              ["Admin Review", user.admin_review],
              ["Risk Level", user.risk_level],
              ["Risk Phase", user.risk_phase],
              ["Referral Code", user.referral_code],
              ["KYC Status", user.kyc_status],
              ["Name Source", user.name_source],
              ["Joined Waitlist", user.waitlist_joined_at ? formatDate(user.waitlist_joined_at) : null],
            ] as [string, string | null | undefined][]).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground/50">{label}</span>
                <span className={`font-mono text-[12px] ${value ? "text-muted-foreground" : "text-muted-foreground/30"}`}>{value || DASH}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Raw Data toggle */}
        <button onClick={() => setShowRawData(!showRawData)}
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1.5px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          {showRawData ? "▼" : "▶"} Raw data
        </button>
        {showRawData && (
          <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
            <pre className="overflow-auto rounded-lg bg-[#0A0A0A] p-3 text-[11px] font-mono text-muted-foreground/60 max-h-[400px]">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Right column — Verification + Payments + Bank details */}
      <div className="flex w-[280px] flex-shrink-0 flex-col gap-4">
        {/* Verification checklist */}
        <div className="flex flex-col rounded-xl bg-success/10 border border-success/20 p-5">
          <Tip text="Checklist of all verification gates — all must pass for the user to become fully active"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-success/60 mb-4">Verification</span></Tip>
          <div className="flex flex-col gap-3">
            {([
              ["Bank", bankVerified, null],
              ["Utility", utilityVerified, null],
              ["Landlord", landlordApproved, null],
              ["M360", identityVerified, m360Status],
              ["Risk", riskLevel === "LOW", riskLevel],
            ] as [string, boolean, string | null][]).map(([label, verified, display]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[13px] text-foreground">{label}</span>
                <span className={`font-mono text-[12px] font-semibold ${verified ? "text-success" : "text-muted-foreground/40"}`}>
                  {display || (verified ? "✓" : "—")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payments card */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <Tip text="This tenant's payment history — successful payments, total collected, and cashback balance"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-3">Payments</span></Tip>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="font-mono text-[36px] font-bold leading-none tracking-[-1px] text-foreground">{user.successful_payments || 0}</span>
            <span className="font-mono text-[14px] text-muted-foreground/40">/ paid</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Total</span>
              <span className="font-mono text-[13px] font-medium text-foreground">{formatCurrency(user.total_paid_paise)}</span>
            </div>
            <div className="flex items-center justify-between">
              <Tip text="Total cashback given to this tenant across all payments"><span className="text-[12px] text-muted-foreground/50">Cashback Earned</span></Tip>
              <span className="font-mono text-[13px] font-medium text-success">{formatCurrency(user.total_cashback_earned_paise)}</span>
            </div>
            <div className="flex items-center justify-between">
              <Tip text="Unredeemed cashback available for this tenant to use on future payments"><span className="text-[12px] text-muted-foreground/50">CB Balance</span></Tip>
              <span className="font-mono text-[13px] font-medium text-foreground">{formatCurrency(user.cashback_balance_paise)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Last</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.last_payment_at ? formatRelativeTime(user.last_payment_at) : DASH}</span>
            </div>
          </div>
        </div>

        {/* Bank & Landlord verification details */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <Tip text="Bank account and landlord verification status — required before rent can be settled"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-3">Bank & Landlord</span></Tip>
          <div className="flex flex-col gap-2.5">
            {([
              ["Tenant Bank", bankVerified ? "Verified" : "Not verified", bankVerified],
              ["Landlord Bank", user.landlord_bank_verified ? "Verified" : "Not verified", !!user.landlord_bank_verified],
              ["Landlord PAN", user.landlord_bank_pan_verified ? "Verified" : "Not verified", !!user.landlord_bank_pan_verified],
              ["Utility", utilityVerified ? "Verified" : "Not verified", utilityVerified],
              ["Landlord Approved", landlordApproved ? "Yes" : "No", landlordApproved],
            ] as [string, string, boolean][]).map(([label, value, ok]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground/50">{label}</span>
                <span className={`font-mono text-[12px] font-medium ${ok ? "text-success" : "text-muted-foreground/40"}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key dates */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <Tip text="Key dates in this user's journey through the platform"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-3">Timeline</span></Tip>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Signed Up</span>
              <span className="font-mono text-[12px] text-muted-foreground">{formatDate(user.signed_up_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Agreement</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.agreement_uploaded_at ? formatDate(user.agreement_uploaded_at) : DASH}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">M360 Verified</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.m360_verified_at ? formatDate(user.m360_verified_at) : DASH}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Status Updated</span>
              <span className="font-mono text-[12px] text-muted-foreground">{user.status_updated_at ? formatDate(user.status_updated_at) : DASH}</span>
            </div>
          </div>
        </div>
      </div>

      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        userIds={[user.user_id]}
        userName={user.name || undefined}
        onSuccess={() => setApprovalResult({ success: true, message: "User rejected successfully" })}
        onError={(error) => setApprovalResult({ success: false, message: error })}
      />
    </div>
  );
}
