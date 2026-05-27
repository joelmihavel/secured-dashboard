"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RiskRadarChart } from "./risk-radar-chart";
import { DecisionRadar } from "./decision-radar";
import { decisionBadgeStyle } from "@/lib/decision";
import { formatCurrency, formatDate, formatTAT, tatColor } from "@/lib/utils";
import type { DecisionResult, Issue } from "@/lib/decision";
import type { UserFunnel } from "@/types/user";

type Signal = "pass" | "warn" | "fail" | "missing";

interface SignalTile {
  label: string;
  value: string;
  signal: Signal;
}

function tileBg(s: Signal) {
  if (s === "pass") return "bg-success/8 border-success/20";
  if (s === "warn") return "bg-warning/8 border-warning/20";
  if (s === "missing") return "bg-muted-foreground/5 border-[#1F1F1F]";
  return "bg-destructive/8 border-destructive/20";
}

function tileDotClass(s: Signal) {
  if (s === "pass") return "bg-success";
  if (s === "warn") return "bg-warning";
  if (s === "missing") return "bg-muted-foreground/40";
  return "bg-destructive";
}

function tileValueClass(s: Signal) {
  if (s === "pass") return "text-success";
  if (s === "warn") return "text-warning";
  if (s === "missing") return "text-muted-foreground/30";
  return "text-destructive";
}

function buildTiles(user: UserFunnel): SignalTile[] {
  const leaseEnd = user.lease_end_date ? new Date(user.lease_end_date) : null;
  const leaseExpired = leaseEnd ? leaseEnd < new Date() : false;

  return [
    {
      label: "Rent",
      value: user.monthly_rent_paise
        ? `${formatCurrency(user.monthly_rent_paise)}/mo`
        : "—",
      signal: user.monthly_rent_paise ? "pass" : "missing",
    },
    {
      label: "City",
      value: user.property_city || "—",
      signal: user.property_city ? "pass" : "missing",
    },
    {
      label: "Agreement",
      value: user.extraction_status === "completed"
        ? `${user.extraction_confidence != null ? `${user.extraction_confidence}%` : "Done"}`
        : user.extraction_status || "—",
      signal: user.extraction_status === "completed"
        ? (user.extraction_confidence != null && user.extraction_confidence < 70 ? "warn" : "pass")
        : user.extraction_status ? "fail" : "missing",
    },
    {
      label: "Lease",
      value: user.lease_start_date
        ? `${formatDate(user.lease_start_date)} – ${formatDate(user.lease_end_date)}`
        : "—",
      signal: !user.lease_start_date ? "missing" : leaseExpired ? "fail" : "pass",
    },
    {
      label: "Credit",
      value: user.m360_credit_score != null ? String(user.m360_credit_score) : "—",
      signal: user.m360_credit_score != null
        ? (user.m360_credit_score >= 650 ? "pass" : "warn")
        : "missing",
    },
    {
      label: "M360",
      value: user.m360_status || "—",
      signal: user.m360_status === "SUCCESS" ? "pass" : user.m360_status ? "warn" : "missing",
    },
    {
      label: "LL Bank",
      value: user.landlord_bank_verified ? "Verified" : "—",
      signal: user.landlord_bank_verified ? "pass" : "fail",
    },
    {
      label: "LL PAN",
      value: user.landlord_bank_pan_verified ? "Verified" : "—",
      signal: user.landlord_bank_pan_verified ? "pass" : "fail",
    },
  ];
}

interface Props {
  user: UserFunnel;
  decision: DecisionResult;
  blockers: Issue[];
  warnings: Issue[];
  onApprove: () => void;
  onReject: () => void;
}

export function VerdictCard({ user, decision, blockers, warnings, onApprove, onReject }: Props) {
  const [expanded, setExpanded] = useState(false);
  const tiles = buildTiles(user);
  const passCount = tiles.filter((t) => t.signal === "pass").length;
  const failCount = tiles.filter((t) => t.signal === "fail").length;

  return (
    <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Verdict</span>
        <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold border ${decisionBadgeStyle(decision.state)}`}>
          {decision.state.replace("_", " ")}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/30">
          {passCount}/{tiles.length} clear
        </span>
        {user.waitlist_joined_at && (
          <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold bg-[#1F1F1F] ${tatColor(user.waitlist_joined_at)}`}
            title={`Waitlisted since ${formatDate(user.waitlist_joined_at)}`}>
            Waiting {formatTAT(user.waitlist_joined_at)}
          </span>
        )}
        {user.admin_review === "approved" && user.status_updated_at && (
          <span className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold bg-[#1F1F1F] text-muted-foreground/60"
            title={`Approved on ${formatDate(user.status_updated_at)}`}>
            TAT {formatTAT(user.status_updated_at)}
          </span>
        )}
        <div className="flex-1" />
        <Button size="sm" className="h-8 rounded-xl bg-success/10 border border-success/30 text-success font-mono text-[11px] font-semibold hover:bg-success/20"
          onClick={onApprove} disabled={user.admin_review === "approved"}>
          {user.admin_review === "approved" ? "Approved" : "Approve"}
        </Button>
        <Button size="sm" variant="outline" className="h-8 rounded-xl border-destructive/30 text-destructive font-mono text-[11px] hover:bg-destructive/10"
          onClick={onReject} disabled={user.admin_review === "rejected"}>
          {user.admin_review === "rejected" ? "Rejected" : "Reject"}
        </Button>
      </div>

      {/* Radar + Heatmap grid side by side */}
      <div className="flex gap-10">
        {/* Radar chart */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
          {user.risk_factors && user.risk_factors.length > 0 ? (
            <>
              <RiskRadarChart factors={user.risk_factors} size={150} />
              <span className={`font-mono text-[10px] font-bold ${
                user.risk_level === "LOW" ? "text-success" :
                user.risk_level === "HIGH" ? "text-destructive" : "text-warning"
              }`}>{user.risk_level || "PENDING"} RISK</span>
            </>
          ) : (
            <DecisionRadar issues={decision.issues} size={150} />
          )}
        </div>

        {/* Heatmap grid — 4×2 tiles */}
        <div className="flex-1 grid grid-cols-4 gap-2 min-w-0">
          {tiles.map((t) => (
            <div key={t.label} className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 ${tileBg(t.signal)}`}>
              <div className="flex items-center gap-1.5">
                <div className={`size-1.5 flex-shrink-0 rounded-full ${tileDotClass(t.signal)}`} />
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50">{t.label}</span>
              </div>
              <span className={`font-mono text-[12px] font-semibold truncate ${tileValueClass(t.signal)}`}>
                {t.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Compact blocker/warning summary */}
      {(blockers.length > 0 || warnings.length > 0) && (
        <div className="mt-3 pt-3 border-t border-[#1F1F1F]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 w-full text-left"
          >
            <div className="flex items-center gap-2">
              {blockers.length > 0 && (
                <span className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold bg-destructive/10 text-destructive">
                  {blockers.length} blocker{blockers.length !== 1 ? "s" : ""}
                </span>
              )}
              {warnings.length > 0 && (
                <span className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold bg-warning/10 text-warning">
                  {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex-1" />
            <span className="font-mono text-[9px] text-muted-foreground/30">
              {expanded ? "▲ collapse" : "▼ details"}
            </span>
          </button>

          {expanded && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {blockers.map((b, i) => (
                <span key={`b${i}`} className="rounded-lg px-2.5 py-0.5 font-mono text-[10px] font-medium bg-destructive/10 text-destructive">{b.label}</span>
              ))}
              {warnings.map((w, i) => (
                <span key={`w${i}`} className="rounded-lg px-2.5 py-0.5 font-mono text-[10px] font-medium bg-warning/10 text-warning">{w.label}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
