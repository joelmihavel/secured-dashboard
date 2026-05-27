"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RiskRadarChart } from "./risk-radar-chart";
import type { RiskFactorEntry } from "@/types/user";

const FACTOR_LABELS: Record<string, string> = {
  pan_verification: "PAN Verification",
  bank_verification: "Bank Verification",
  name_consistency: "Name Consistency",
  agreement_completeness: "Agreement Quality",
  agreement_expiry: "Agreement Expiry",
  phone_duplicate: "Phone Duplicate",
  rent_reasonableness: "Rent Range",
  tenant_name_match: "Tenant Name Match",
  m360_risk_intel: "M360 Risk Intel",
  m360_data_available: "M360 Data",
  credit_score: "Credit Score",
  utility_verification: "Utility Verification",
  landlord_response: "Landlord Response",
  agreement_confidence: "Extraction Confidence",
  computation_error: "Computation Error",
};

function signalDot(signal: string) {
  switch (signal) {
    case "GREEN":
      return <span className="inline-block size-2.5 rounded-full bg-success" />;
    case "YELLOW":
      return <span className="inline-block size-2.5 rounded-full bg-warning" />;
    case "RED":
      return <span className="inline-block size-2.5 rounded-full bg-destructive" />;
    case "MISSING":
      return <span className="inline-block size-2.5 rounded-full bg-muted-foreground/50 ring-1 ring-muted-foreground/20" />;
    default:
      return <span className="inline-block size-2.5 rounded-full bg-muted-foreground/30" />;
  }
}

function riskLevelColor(level: string | null) {
  switch (level) {
    case "LOW": return "text-success border-success/40";
    case "MED": return "text-warning border-warning/40";
    case "HIGH": return "text-destructive border-destructive/40";
    default: return "text-muted-foreground border-border";
  }
}

interface Props {
  riskLevel: string | null;
  riskPhase: string | null;
  riskComputedAt: string | null;
  riskFactors: RiskFactorEntry[] | null;
}

export function RiskFactorBreakdown({ riskLevel, riskPhase, riskComputedAt, riskFactors }: Props) {
  if (!riskFactors || riskFactors.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            Risk Assessment
          </span>
          <p className="mt-2 text-xs text-muted-foreground">No risk data computed yet.</p>
        </CardContent>
      </Card>
    );
  }

  const preFactors = riskFactors.filter((f) => f.phase === "pre");
  const postFactors = riskFactors.filter((f) => f.phase === "post");

  const greenCount = riskFactors.filter((f) => f.signal === "GREEN").length;
  const yellowCount = riskFactors.filter((f) => f.signal === "YELLOW").length;
  const redCount = riskFactors.filter((f) => f.signal === "RED").length;
  const missingCount = riskFactors.filter((f) => f.signal === "MISSING").length;

  const computedLabel = riskComputedAt
    ? new Date(riskComputedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
    : "—";

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            Risk Assessment
          </span>
          <Badge variant="outline" className={`text-[11px] ${riskLevelColor(riskLevel)}`}>
            {riskLevel || "PENDING"}
          </Badge>
          {riskPhase && (
            <Badge variant="outline" className="text-[9px] text-muted-foreground">
              {riskPhase.toUpperCase()} phase
            </Badge>
          )}
          <div className="flex-1" />
          <span className="text-[9px] text-muted-foreground/40">
            {greenCount}G / {yellowCount}Y / {redCount}R{missingCount > 0 ? ` / ${missingCount}?` : ""}
          </span>
          <span className="text-[9px] text-muted-foreground/40">
            Computed {computedLabel}
          </span>
        </div>

        {/* Radar Chart + Factor Tables side by side */}
        <div className="mt-3 flex gap-4">
          {/* Radar Chart */}
          <div className="flex flex-col items-center gap-2">
            <RiskRadarChart factors={riskFactors} size={240} />
            <span className="text-[9px] text-muted-foreground/40">
              Green = pass, Yellow = warning, Red = fail, Grey = awaiting data
            </span>
          </div>

          {/* Factor Tables */}
          <div className="flex flex-1 flex-col gap-3">
            {/* Pre-Waitlist Factors */}
            {preFactors.length > 0 && (
              <div>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  Pre-Waitlist Checks
                </span>
                <div className="mt-1.5 flex flex-col gap-0">
                  {preFactors.map((f) => (
                    <div key={f.factor} className="flex items-center gap-2.5 border-b border-border/20 py-1.5">
                      {signalDot(f.signal)}
                      <span className="w-[140px] text-[11px] font-medium text-muted-foreground">
                        {FACTOR_LABELS[f.factor] || f.factor}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 flex-1 truncate" title={f.detail}>
                        {f.detail}
                      </span>
                      <Badge variant="outline" className="text-[8px] text-muted-foreground/40 min-w-[28px] justify-center">
                        w{f.weight}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Post-Waitlist Factors */}
            {postFactors.length > 0 && (
              <div>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  Post-Waitlist Checks
                </span>
                <div className="mt-1.5 flex flex-col gap-0">
                  {postFactors.map((f) => (
                    <div key={f.factor} className="flex items-center gap-2.5 border-b border-border/20 py-1.5">
                      {signalDot(f.signal)}
                      <span className="w-[140px] text-[11px] font-medium text-muted-foreground">
                        {FACTOR_LABELS[f.factor] || f.factor}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 flex-1 truncate" title={f.detail}>
                        {f.detail}
                      </span>
                      <Badge variant="outline" className="text-[8px] text-muted-foreground/40 min-w-[28px] justify-center">
                        w{f.weight}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {postFactors.length === 0 && riskPhase === "pre" && (
              <p className="text-[10px] text-muted-foreground/40 italic">
                Post-waitlist checks (M360, utility, landlord) not yet available.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
