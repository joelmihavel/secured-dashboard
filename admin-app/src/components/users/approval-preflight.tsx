"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  FileWarning,
} from "lucide-react";
import { confidencePercent } from "@/lib/utils";
import type { UserFunnel } from "@/types/user";

interface PreflightCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  blocking: boolean;
}

function runPreflightChecks(user: UserFunnel): PreflightCheck[] {
  const checks: PreflightCheck[] = [];

  // 1. Extraction completed
  function extractionDetail(): string {
    if (user.extraction_status === "completed") {
      const pct = confidencePercent(user.extraction_confidence);
      return pct == null
        ? "Completed (confidence not recorded)"
        : `Completed with ${pct}% confidence`;
    }
    if (user.extraction_status === "extraction_failed") {
      return "Extraction failed — parser returned no fields. User must re-upload the agreement before approval.";
    }
    return `Status: ${user.extraction_status || "not started"}`;
  }
  checks.push({
    id: "extraction",
    label: "Agreement extraction",
    status: user.extraction_status === "completed" ? "pass" : "fail",
    detail: extractionDetail(),
    blocking: true,
  });

  // 2. Agreement verified by user
  checks.push({
    id: "user_verified",
    label: "User verified extraction",
    status: user.agreement_verified ? "pass" : "fail",
    detail: user.agreement_verified
      ? "User confirmed extracted data is correct"
      : "User has NOT verified — tenancy will use unverified data",
    blocking: false,
  });

  // 2b. Stamp verification (warning, non-blocking)
  function stampDetail(): string {
    const status = user.stamp_verification_status;
    if (!status) return "Not yet attempted";
    if (status === "verified") {
      return user.stamp_verified_at
        ? `Stamp verified on ${user.stamp_verified_at.slice(0, 10)}`
        : "Stamp paper verified";
    }
    const attempt = user.stamp_verification_attempt
      ? ` (attempt ${user.stamp_verification_attempt})`
      : "";
    const friendly: Record<string, string> = {
      mismatch: "Stamp value or date does not match the agreement",
      not_found: "Stamp paper not found in the state registry",
      captcha_failed: "Verification site captcha failed",
      site_error: "State stamp registry returned an error",
      unsupported_state: "State does not support stamp verification",
      missing_article: "Article number missing from agreement",
      missing_fields: "Required fields missing from extraction",
    };
    return `${friendly[status] ?? status}${attempt}`;
  }
  checks.push({
    id: "stamp_verification",
    label: "Stamp verification",
    status:
      user.stamp_verification_status === "verified"
        ? "pass"
        : user.stamp_verification_status
          ? "warn"
          : "warn",
    detail: stampDetail(),
    blocking: false,
  });

  // 3. Property address exists
  checks.push({
    id: "property_address",
    label: "Property address",
    status: user.property_address ? "pass" : "fail",
    detail: user.property_address || "MISSING — tenancy creation will fail",
    blocking: true,
  });

  // 4. Landlord name exists
  const hasLandlord = !!(user.landlord_name || user.landlord_display_name);
  checks.push({
    id: "landlord_name",
    label: "Landlord name",
    status: hasLandlord ? "pass" : "fail",
    detail: hasLandlord
      ? user.landlord_display_name || user.landlord_name || ""
      : "MISSING — tenancy creation will fail",
    blocking: true,
  });

  // 5. Rent > 0
  const rentOk = (user.monthly_rent_paise ?? 0) > 0;
  checks.push({
    id: "rent",
    label: "Monthly rent",
    status: rentOk ? "pass" : "fail",
    detail: rentOk
      ? `₹${((user.monthly_rent_paise ?? 0) / 100).toLocaleString("en-IN")}/mo`
      : "MISSING or zero — tenancy creation will fail",
    blocking: true,
  });

  // 6. Lease start date
  checks.push({
    id: "lease_start",
    label: "Lease start date",
    status: user.lease_start_date ? "pass" : "fail",
    detail: user.lease_start_date || "MISSING — tenancy creation will fail",
    blocking: true,
  });

  // 7. Lease not expired
  if (user.lease_end_date) {
    const expired = new Date(user.lease_end_date) < new Date();
    checks.push({
      id: "lease_expiry",
      label: "Lease expiry",
      status: expired ? "fail" : "pass",
      detail: expired
        ? `Expired on ${user.lease_end_date} — reject instead`
        : `Valid until ${user.lease_end_date}`,
      blocking: true,
    });
  }

  // 8. Block re-approval of already approved/active users
  if (user.user_status === "active") {
    checks.push({
      id: "already_active",
      label: "User already active",
      status: "fail",
      detail: "Re-approving an active user resets them to 'approved' status, temporarily breaking their dashboard access",
      blocking: true,
    });
  } else if (user.admin_review === "approved" && user.user_status === "approved") {
    checks.push({
      id: "already_approved",
      label: "User already approved",
      status: "warn",
      detail: "User was already approved — re-approval may reset tenancy activation progress",
      blocking: false,
    });
  }

  // 8b. Rent due day validity
  checks.push({
    id: "rent_due_day",
    label: "Rent due day",
    status: user.rent_due_day && user.rent_due_day >= 1 && user.rent_due_day <= 28 ? "pass" : "warn",
    detail: user.rent_due_day
      ? `Due on ${user.rent_due_day}th of month`
      : "Missing — will default to 1st. Verify this matches the lease agreement.",
    blocking: false,
  });

  // 8c. Extraction freshness (warn if >6 months old)
  if (user.agreement_uploaded_at) {
    const uploadDate = new Date(user.agreement_uploaded_at);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (uploadDate < sixMonthsAgo) {
      checks.push({
        id: "extraction_stale",
        label: "Agreement data may be stale",
        status: "warn",
        detail: `Agreement uploaded ${user.agreement_uploaded_at.slice(0, 10)} — over 6 months ago. Lease data may have changed.`,
        blocking: false,
      });
    }
  }

  // 9. Risk level
  checks.push({
    id: "risk_level",
    label: "Risk assessment",
    status:
      user.risk_level === "LOW"
        ? "pass"
        : user.risk_level === "MED"
          ? "warn"
          : user.risk_level === "HIGH"
            ? "fail"
            : "warn",
    detail: user.risk_level
      ? `Level: ${user.risk_level}`
      : "Risk not computed — approval proceeds without risk score",
    blocking: false,
  });

  // 9. M360 identity available
  checks.push({
    id: "m360",
    label: "M360 identity data",
    status: user.m360_status === "SUCCESS" ? "pass" : "warn",
    detail:
      user.m360_status === "SUCCESS"
        ? `Verified: ${user.m360_full_name} · Credit: ${user.m360_credit_score}`
        : `M360 status: ${user.m360_status || "not initiated"} — identity not verified`,
    blocking: false,
  });

  // 9b. Landlord bank verified — informational, not blocking.
  // Landlord verification is a separate flow that happens independently
  // of waitlist approval. Settlement requires it, but approval doesn't.
  checks.push({
    id: "landlord_bank",
    label: "Landlord bank verified",
    status: user.landlord_bank_verified === true ? "pass" : "warn",
    detail:
      user.landlord_bank_verified === true
        ? "Landlord bank account verified via penny-drop"
        : user.landlord_bank_verified === false
          ? "Bank row exists but penny-drop never succeeded"
          : "Landlord bank verification not started yet",
    blocking: false,
  });

  // 9c. Landlord PAN verified — informational, not blocking.
  checks.push({
    id: "landlord_pan",
    label: "Landlord PAN verified",
    status: user.landlord_bank_pan_verified === true ? "pass" : "warn",
    detail:
      user.landlord_bank_pan_verified === true
        ? "Landlord PAN matched + verified"
        : "Landlord PAN not yet verified",
    blocking: false,
  });

  // 9d. Tenancy bank verified — BLOCKING.
  // Mirrors the hard gate in supabase/functions/admin-waitlist/index.ts (the
  // "no force override" bank prerequisite). Without this check the panel shows
  // all-clear and the approve call then fails with a 422 the admin can't act
  // on. Note this is tenancies.bank_verified — distinct from the landlord bank
  // penny-drop above, which really is informational.
  const tenancyBankOk = !!user.tenancy_id && user.bank_verified === true;
  checks.push({
    id: "tenancy_bank",
    label: "Tenancy bank verified",
    status: tenancyBankOk ? "pass" : "fail",
    detail: tenancyBankOk
      ? "Tenancy exists with verified bank"
      : !user.tenancy_id
        ? "No tenancy yet — user hasn't completed bank verification"
        : "Tenancy exists but bank is not verified",
    blocking: true,
  });

  // 10. Existing tenancy check
  if (user.tenancy_id) {
    checks.push({
      id: "tenancy_exists",
      label: "Tenancy already exists",
      status: "warn",
      detail: `Tenancy ${user.tenancy_id} (${user.tenancy_status}) — approval will activate it, not create new`,
      blocking: false,
    });
  }

  // 11. City supported
  const supportedCities = ["mumbai", "bangalore", "bengaluru"];
  const city = (user.property_city || "").toLowerCase();
  if (city) {
    checks.push({
      id: "city",
      label: "City supported",
      status: supportedCities.some((c) => city.includes(c)) ? "pass" : "warn",
      detail: user.property_city || "Unknown",
      blocking: false,
    });
  }

  // 12. Confidence score threshold
  const confidencePct = confidencePercent(user.extraction_confidence);
  if (confidencePct != null) {
    checks.push({
      id: "confidence",
      label: "Extraction confidence",
      status: confidencePct >= 70 ? "pass" : confidencePct >= 50 ? "warn" : "fail",
      detail: `${confidencePct}% — ${confidencePct >= 70 ? "above" : "below"} threshold (70%)`,
      blocking: false,
    });
  }

  return checks;
}

function StatusIcon({ status }: { status: "pass" | "warn" | "fail" }) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="size-4 text-success" />;
    case "warn":
      return <AlertTriangle className="size-4 text-warning" />;
    case "fail":
      return <XCircle className="size-4 text-destructive" />;
  }
}

interface Props {
  user: UserFunnel;
  onConfirmApprove: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ApprovalPreflight({ user, onConfirmApprove, onCancel, loading }: Props) {
  const checks = runPreflightChecks(user);
  const blockingFailures = checks.filter((c) => c.blocking && c.status === "fail");
  const warnings = checks.filter((c) => c.status === "warn");
  const passes = checks.filter((c) => c.status === "pass");
  const canApprove = blockingFailures.length === 0;

  return (
    <Card className="border-border bg-card">
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          {canApprove ? (
            <CheckCircle2 className="size-5 text-success" />
          ) : (
            <ShieldAlert className="size-5 text-destructive" />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              {canApprove ? "Ready to approve" : "Cannot approve — blocking issues found"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {passes.length} passed · {warnings.length} warnings · {blockingFailures.length} blocking
            </span>
          </div>
          <div className="flex-1" />
          <Badge
            variant="outline"
            className={canApprove ? "text-success border-success/30" : "text-destructive border-destructive/30"}
          >
            {canApprove ? "CLEAR" : `${blockingFailures.length} BLOCKERS`}
          </Badge>
        </div>

        <Separator />

        {/* Blocking failures first */}
        {blockingFailures.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
              <FileWarning className="size-3" />
              Blocking Issues — Must fix before approval
            </span>
            {blockingFailures.map((check) => (
              <div key={check.id} className="flex items-start gap-2.5 rounded-md bg-destructive/5 px-3 py-2">
                <StatusIcon status={check.status} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">{check.label}</span>
                  <span className="text-[11px] text-destructive">{check.detail}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">
              Warnings — Review before proceeding
            </span>
            {warnings.map((check) => (
              <div key={check.id} className="flex items-start gap-2.5 px-3 py-1.5">
                <StatusIcon status={check.status} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">{check.label}</span>
                  <span className="text-[11px] text-muted-foreground">{check.detail}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Passes (collapsed) */}
        {passes.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              Passed ({passes.length})
            </span>
            {passes.map((check) => (
              <div key={check.id} className="flex items-center gap-2.5 px-3 py-1">
                <StatusIcon status={check.status} />
                <span className="text-[11px] text-muted-foreground">{check.label}</span>
                <span className="text-[10px] text-muted-foreground/40">{check.detail}</span>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={onConfirmApprove}
            disabled={!canApprove || loading}
            className="bg-success text-success-foreground font-semibold hover:bg-success/90 disabled:opacity-40"
          >
            {loading
              ? "Approving..."
              : canApprove
                ? "Confirm Approval"
                : "Cannot Approve"}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          {!canApprove && (
            <span className="text-[11px] text-destructive">
              Fix {blockingFailures.length} blocking issue{blockingFailures.length > 1 ? "s" : ""} to enable approval
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
