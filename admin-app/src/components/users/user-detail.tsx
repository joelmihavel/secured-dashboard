"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatCurrencyShort, formatDate, maskPhone } from "@/lib/utils";
import { callEdgeFunction } from "@/lib/supabase";
import type { UserFunnel } from "@/types/user";
import { RiskFactorBreakdown } from "./risk-factor-breakdown";
import { ApprovalPreflight } from "./approval-preflight";
import { RejectDialog } from "@/components/dialogs/reject-dialog";

const DASH = "—";
const CHECK = "✓";
const CROSS = "✗";

function riskColor(level: string | null) {
  switch (level) {
    case "LOW": return "text-success border-success/40";
    case "MED": return "text-warning border-warning/40";
    case "HIGH": return "text-destructive border-destructive/40";
    default: return "text-muted-foreground border-border";
  }
}

interface VerificationChipDef {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

function buildVerificationChips(user: UserFunnel): VerificationChipDef[] {
  return [
    {
      id: "bank",
      label: "Bank",
      passed: user.bank_verified === true,
      detail: user.bank_verified
        ? "Penny-drop succeeded; agreement-name match passed."
        : "Bank not verified — penny-drop failed or name mismatch with agreement.",
    },
    {
      id: "utility",
      label: "Utility",
      passed: user.utility_verified === true,
      detail: user.utility_verified
        ? "Utility bill matched property address."
        : "Utility not verified — no bill on file or address mismatch.",
    },
    {
      id: "landlord",
      label: "Landlord",
      passed: user.landlord_approved === true,
      detail: user.landlord_approved
        ? "Landlord confirmed via OTP."
        : "Landlord has not yet confirmed.",
    },
    {
      id: "m360",
      label: "Identity",
      passed: user.m360_status === "SUCCESS",
      detail:
        user.m360_status === "SUCCESS"
          ? `M360 verified · ${user.m360_full_name ?? ""} · credit ${user.m360_credit_score ?? "n/a"}`
          : `M360 status: ${user.m360_status ?? "not started"}`,
    },
    {
      id: "agreement",
      label: "Agreement",
      passed: user.extraction_status === "completed",
      detail:
        user.extraction_status === "completed"
          ? `Extracted with ${user.extraction_confidence ?? 0}% confidence${user.agreement_verified ? " · user-verified" : ""}.`
          : `Extraction status: ${user.extraction_status ?? "not started"}`,
    },
    {
      id: "stamp",
      label: "Stamp",
      passed: user.stamp_verification_status === "verified",
      detail:
        user.stamp_verification_status === "verified"
          ? `Stamp paper verified${user.stamp_verified_at ? ` on ${user.stamp_verified_at.slice(0, 10)}` : ""}.`
          : `Stamp status: ${user.stamp_verification_status ?? "not attempted"}${user.stamp_verification_attempt ? ` · attempt ${user.stamp_verification_attempt}` : ""}`,
    },
  ];
}

function verifiedColorClass(score: number, total: number) {
  if (score === total) return "text-success";
  if (score >= total - 2) return "text-warning";
  return "text-destructive";
}

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 py-1.5">
      <span className="text-xs text-muted-foreground/60">{label}</span>
      <span className={`text-[13px] font-medium text-muted-foreground ${mono ? "font-mono" : ""}`}>
        {value || DASH}
      </span>
    </div>
  );
}

export function UserDetail({ user }: { user: UserFunnel }) {
  const [showPreflight, setShowPreflight] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{ success: boolean; message: string } | null>(null);
  const [expandedChip, setExpandedChip] = useState<string | null>(null);

  const initials = (user.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleApprove() {
    setApproving(true);
    setApprovalResult(null);
    try {
      await callEdgeFunction("admin-waitlist", {
        action: "approve",
        user_ids: [user.user_id],
      });
      setApprovalResult({ success: true, message: "User approved successfully" });
      setShowPreflight(false);
    } catch (err) {
      setApprovalResult({
        success: false,
        message: err instanceof Error ? err.message : "Approval failed",
      });
    } finally {
      setApproving(false);
    }
  }

  const chips = buildVerificationChips(user);
  const verificationScore = chips.filter((c) => c.passed).length;
  const verificationTotal = chips.length;
  const verifiedClass = verifiedColorClass(verificationScore, verificationTotal);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-5">
      {/* Header */}
      <Card className="border-border bg-card">
        <CardContent className="flex items-center gap-4 p-5">
          <Avatar className="size-12 bg-primary">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-foreground">{user.name || "Unknown"}</span>
              <Badge variant="outline" className="text-[11px]">{user.user_status}</Badge>
              {user.tenancy_status && (
                <Badge variant="outline" className="text-[11px]">{user.tenancy_status}</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
              <span>{maskPhone(user.phone)}</span>
              <span className="text-muted-foreground/30">Signed up {formatDate(user.signed_up_at)}</span>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className={`text-2xl font-bold ${verifiedClass}`}>
                {verificationScore}<span className="text-base text-muted-foreground/50">/{verificationTotal}</span>
              </span>
              <span className="text-[11px] text-muted-foreground/40">Verified</span>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex flex-col items-center gap-1">
              <Badge variant="outline" className={`text-xs ${riskColor(user.risk_level)}`}>
                {user.risk_level || DASH}
              </Badge>
              <span className="text-[11px] text-muted-foreground/40">Risk</span>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg font-bold text-foreground">{user.m360_credit_score || DASH}</span>
              <span className="text-[11px] text-muted-foreground/40">Credit</span>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg font-bold text-primary">{formatCurrencyShort(user.monthly_rent_paise)}</span>
              <span className="text-[11px] text-muted-foreground/40">Rent</span>
            </div>
          </div>
          <Separator orientation="vertical" className="h-10" />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-9 text-sm bg-success text-success-foreground font-semibold hover:bg-success/90"
              onClick={() => setShowPreflight(true)}
              disabled={user.admin_review === "approved"}
            >
              {user.admin_review === "approved" ? "Approved" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-sm border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setShowRejectDialog(true)}
              disabled={user.admin_review === "rejected"}
            >
              {user.admin_review === "rejected" ? "Rejected" : "Reject"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approval result banner */}
      {approvalResult && (
        <div className={`rounded-md border px-4 py-2.5 text-sm ${
          approvalResult.success
            ? "border-success/30 bg-success/5 text-success"
            : "border-destructive/30 bg-destructive/5 text-destructive"
        }`}>
          {approvalResult.message}
        </div>
      )}

      {/* Pre-flight approval checks */}
      {showPreflight && (
        <ApprovalPreflight
          user={user}
          onConfirmApprove={handleApprove}
          onCancel={() => setShowPreflight(false)}
          loading={approving}
        />
      )}

      {/* Verification chips — single-glance status */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              Verifications
            </span>
            <span className={`text-xs font-semibold ${verifiedClass}`}>
              {verificationScore} of {verificationTotal} verified
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip) => {
              const isOpen = expandedChip === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setExpandedChip(isOpen ? null : chip.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    chip.passed
                      ? "border-success/40 bg-success/10 text-success hover:bg-success/15"
                      : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
                  } ${isOpen ? "ring-1 ring-current/40" : ""}`}
                >
                  <span className="text-sm">{chip.passed ? CHECK : CROSS}</span>
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
          {expandedChip && (
            <div className="mt-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
              {chips.find((c) => c.id === expandedChip)?.detail}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Factor Breakdown */}
      <RiskFactorBreakdown
        riskLevel={user.risk_level}
        riskPhase={user.risk_phase ?? null}
        riskComputedAt={user.risk_computed_at ?? null}
        riskFactors={user.risk_factors ?? null}
      />

      {/* M360 Identity */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            M360 Identity
          </span>
          <div className="mt-3 flex gap-6">
            <div className="flex flex-col gap-1 flex-1">
              <InfoRow label="Full Name" value={user.m360_full_name} />
              <InfoRow label="Gender" value={user.m360_gender} />
              <InfoRow label="DOB / Age" value={user.m360_date_of_birth ? `${formatDate(user.m360_date_of_birth)} (${user.m360_age})` : null} />
              <InfoRow label="Occupation" value={user.m360_occupation} />
              <InfoRow label="Income" value={user.m360_total_income} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <InfoRow label="Aadhaar" value={user.m360_aadhaar_masked} mono />
              <InfoRow label="Credit Score" value={user.m360_credit_score?.toString()} />
              <InfoRow label="Risk Level" value={user.m360_risk_level} />
              <InfoRow label="Provider" value={user.m360_mobile_provider ? `${user.m360_mobile_provider} · ${user.m360_connection_type}` : null} />
              <InfoRow label="M360 Status" value={user.m360_status} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreement & Property */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              Agreement & Property
            </span>
            {user.extraction_status && (
              <Badge variant="outline" className="text-[11px]">{user.extraction_status}</Badge>
            )}
            {user.extraction_confidence != null && (
              <div className="flex items-center gap-2">
                <Progress value={user.extraction_confidence} className="h-1.5 w-20" />
                <span className="text-xs font-medium text-primary">{user.extraction_confidence}%</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-6">
            <div className="flex flex-col gap-1 flex-1">
              <InfoRow label="Address" value={user.property_address} />
              <InfoRow label="City / State" value={user.property_city ? `${user.property_city}, ${user.property_state} ${user.property_pincode}` : null} />
              <InfoRow label="Landlord" value={user.landlord_display_name || user.landlord_name} />
              <InfoRow label="Landlord Phone" value={maskPhone(user.landlord_phone)} />
              <InfoRow label="BHK" value={user.property_bhk_type} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <InfoRow label="Monthly Rent" value={formatCurrency(user.monthly_rent_paise)} />
              <InfoRow label="Maintenance" value={formatCurrency(user.maintenance_paise)} />
              <InfoRow label="Lease" value={user.lease_start_date ? `${formatDate(user.lease_start_date)} → ${formatDate(user.lease_end_date)}` : null} />
              <InfoRow label="Due Day" value={user.rent_due_day ? `${user.rent_due_day}th of month` : null} />
              <InfoRow label="Stamp Status" value={user.stamp_verification_status} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            Payment History
          </span>
          <div className="mt-3 flex gap-3">
            <div className="flex flex-1 flex-col gap-1 rounded-md bg-muted p-4">
              <span className="text-xl font-bold text-foreground">{user.successful_payments || 0}</span>
              <span className="text-xs text-muted-foreground/60">Payments</span>
            </div>
            <div className="flex flex-1 flex-col gap-1 rounded-md bg-muted p-4">
              <span className="text-xl font-bold text-foreground">{formatCurrency(user.total_paid_paise)}</span>
              <span className="text-xs text-muted-foreground/60">Total Paid</span>
            </div>
            <div className="flex flex-1 flex-col gap-1 rounded-md bg-muted p-4">
              <span className="text-xl font-bold text-success">{formatCurrency(user.total_cashback_earned_paise)}</span>
              <span className="text-xs text-muted-foreground/60">CB Earned</span>
            </div>
            <div className="flex flex-1 flex-col gap-1 rounded-md bg-muted p-4">
              <span className="text-xl font-bold text-primary">{formatCurrency(user.cashback_balance_paise)}</span>
              <span className="text-xs text-muted-foreground/60">CB Balance</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Waitlist Info */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            Waitlist & Admin
          </span>
          <div className="mt-3 flex flex-col gap-1">
            <InfoRow label="Position" value={user.waitlist_position?.toString() ? `#${user.waitlist_position}` : null} />
            <InfoRow label="Admin Review" value={user.admin_review} />
            <InfoRow label="Risk Level" value={user.risk_level} />
            <InfoRow label="Referral Code" value={user.referral_code} mono />
            <InfoRow label="KYC Status" value={user.kyc_status} />
            <InfoRow label="Name Source" value={user.name_source} />
          </div>
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        userIds={[user.user_id]}
        userName={user.name || undefined}
        onSuccess={() => {
          setApprovalResult({ success: true, message: "User rejected successfully" });
        }}
        onError={(error) => {
          setApprovalResult({ success: false, message: error });
        }}
      />
    </div>
  );
}
