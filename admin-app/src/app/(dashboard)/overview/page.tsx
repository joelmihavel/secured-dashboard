"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyShort, formatRelativeTime } from "@/lib/utils";
import { useUsers } from "@/hooks/useUsers";
import { useAuditLogs, type AuditLog } from "@/hooks/useAuditLogs";
import { callEdgeFunction } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

function activityDot(action: string) {
  if (action.includes("APPROVE")) return "bg-success";
  if (action.includes("REJECT")) return "bg-destructive";
  if (action.includes("OVERRIDE") || action.includes("BYPASS")) return "bg-warning";
  return "bg-muted-foreground/30";
}

function activityLabel(log: AuditLog) {
  const action = log.action.replace(/_/g, " ").replace(/WAITLIST BATCH /i, "").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  const target = (log.details?.user_name as string) || (log.details?.name as string) || log.entity_id?.slice(0, 8) || "";
  return target ? `${action} ${target}` : action;
}

const FUNNEL_ROUTES: Record<string, string> = {
  SIGNUP: "/users",
  AGREE: "/users",
  APPROV: "/triage",
  ACTIVE: "/users",
  PAID: "/payments",
};

export default function OverviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { users, loading: usersLoading } = useUsers();
  const { logs, loading: logsLoading } = useAuditLogs({ limit: 5 });
  const loading = usersLoading || logsLoading;
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = users.length;
    const withAgreement = users.filter((u) => u.extraction_status === "completed").length;
    const approved = users.filter((u) => ["approved", "active", "agreement_confirmed"].includes(u.user_status)).length;
    const active = users.filter((u) => u.user_status === "active").length;
    const paid = users.filter((u) => (u.successful_payments || 0) > 0).length;
    const totalRevenue = users.reduce((s, u) => s + (u.total_paid_paise || 0), 0);
    const verified = users.filter((u) => u.m360_status === "SUCCESS").length;
    const triage = users.filter((u) => u.user_status === "waitlisted" || u.user_status === "agreement_confirmed");
    const paidPayments = users.reduce((s, u) => s + (u.successful_payments || 0), 0);
    const totalPayments = users.filter((u) => u.monthly_rent_paise && u.monthly_rent_paise > 0).length;
    return { total, withAgreement, approved, active, paid, totalRevenue, verified, triage, paidPayments, totalPayments };
  }, [users]);

  const conversionPct = stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0;

  const funnelSteps = [
    { label: "SIGNUP", count: stats.total },
    { label: "AGREE", count: stats.withAgreement },
    { label: "APPROV", count: stats.approved },
    { label: "ACTIVE", count: stats.active },
    { label: "PAID", count: stats.paid },
  ];
  const maxFunnel = Math.max(...funnelSteps.map((s) => s.count), 1);

  async function handleTriageAction(userId: string, action: "approve" | "reject") {
    setActionLoading(userId);
    try {
      await callEdgeFunction("admin-waitlist", {
        action,
        user_ids: [userId],
        ...(action === "reject" ? { rejection_reasons: ["Admin rejection"] } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex gap-4 p-6 px-8 h-full">
        <div className="flex w-[240px] flex-col gap-4"><Skeleton className="flex-1 rounded-xl" /><Skeleton className="flex-1 rounded-xl" /></div>
        <div className="flex w-[280px] flex-col gap-4"><Skeleton className="h-[180px] rounded-xl" /><Skeleton className="flex-1 rounded-xl" /></div>
        <Skeleton className="flex-1 rounded-xl" />
        <div className="flex w-[240px] flex-col gap-4"><Skeleton className="flex-1 rounded-xl" /><Skeleton className="h-[186px] rounded-xl" /></div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 p-6 px-8 h-full overflow-hidden">
      {/* Column 1 — Tall stat cards */}
      <div className="flex w-[240px] flex-shrink-0 flex-col gap-4">
        {/* Today's Signups → Users */}
        <Link href="/users" className="flex flex-1 flex-col justify-between rounded-xl bg-[#3D5A80] p-5 hover:bg-[#4A6B91] transition-colors cursor-pointer group">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-white/60">Today&apos;s Signups</span>
            <span className="font-mono text-[10px] text-white/0 group-hover:text-white/40 transition-colors">→</span>
          </div>
          <div>
            <span className="font-mono text-[72px] font-bold leading-none tracking-[-2px] text-white">
              {stats.total > 100 ? (stats.total / 100).toFixed(1) : stats.total}
            </span>
            {stats.total > 100 && <span className="font-mono text-[16px] text-white/40 ml-1">K</span>}
            <div className="font-mono text-[13px] text-white/40 mt-1">/ 6H</div>
          </div>
        </Link>

        {/* Verified Users → Analytics */}
        <Link href="/analytics" className="flex flex-1 flex-col justify-between rounded-xl border border-[#1F1F1F] bg-[#141414] p-5 hover:border-[#2a2a2a] hover:bg-[#181818] transition-colors cursor-pointer group">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Verified Users</span>
            <span className="font-mono text-[10px] text-transparent group-hover:text-muted-foreground/40 transition-colors">→</span>
          </div>
          <div>
            <span className="font-mono text-[72px] font-bold leading-none tracking-[-2px] text-foreground">{stats.verified}</span>
            <span className="font-mono text-[20px] text-muted-foreground/40 ml-2">/ {stats.total}</span>
          </div>
        </Link>
      </div>

      {/* Column 2 — Paid payments + Triage queue */}
      <div className="flex w-[280px] flex-shrink-0 flex-col gap-4">
        {/* Paid Payments → Payments */}
        <Link href="/payments" className="flex flex-col gap-4 rounded-xl border border-[#1F1F1F] bg-[#141414] p-5 hover:border-[#2a2a2a] hover:bg-[#181818] transition-colors cursor-pointer group">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Paid Payments</span>
            <span className="font-mono text-[10px] text-transparent group-hover:text-muted-foreground/40 transition-colors">→</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[48px] font-bold leading-none tracking-[-1px] text-foreground">{stats.paidPayments}</span>
            <span className="font-mono text-[20px] text-muted-foreground/40">/ {stats.totalPayments}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Total</span>
            <span className="font-mono text-[13px] text-muted-foreground">{formatCurrencyShort(stats.totalRevenue)} / {formatCurrencyShort(stats.totalRevenue * 1.5)}</span>
          </div>
        </Link>

        {/* Triage Queue → Triage (with inline actions) */}
        <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <Link href="/triage" className="flex items-center justify-between mb-4 group">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Triage Queue</span>
            <span className="flex size-6 items-center justify-center rounded-full bg-success/20 font-mono text-[11px] font-semibold text-success">{stats.triage.length}</span>
          </Link>
          <div className="flex flex-col gap-2 flex-1">
            {stats.triage.slice(0, 4).map((u) => (
              <div key={u.user_id} className="flex items-center gap-2 group/row">
                <span className="text-[13px] text-foreground flex-1 truncate">{u.name || "—"}</span>
                <span className={`font-mono text-[11px] font-semibold flex-shrink-0 ${
                  u.risk_level === "HIGH" ? "text-destructive" :
                  u.risk_level === "MED" ? "text-warning" : "text-success"
                }`}>{u.risk_level || "—"}</span>
                <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => handleTriageAction(u.user_id, "approve")}
                    disabled={actionLoading === u.user_id}
                    className="rounded-lg border border-success/30 bg-success/5 px-2 py-0.5 font-mono text-[10px] text-success hover:bg-success/10 transition-colors disabled:opacity-50"
                  >✓</button>
                  <button
                    onClick={() => handleTriageAction(u.user_id, "reject")}
                    disabled={actionLoading === u.user_id}
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-0.5 font-mono text-[10px] text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >✗</button>
                </div>
              </div>
            ))}
          </div>
          {stats.triage.length > 4 && (
            <Link href="/triage" className="font-mono text-[11px] text-muted-foreground/40 mt-3 hover:text-muted-foreground transition-colors">
              +{stats.triage.length - 4} more →
            </Link>
          )}
        </div>
      </div>

      {/* Column 3 — User Funnel (large, clickable bars) */}
      <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">User Funnel</span>
          <div className="flex gap-1">
            {["7D", "30D", "5M", "12M"].map((p, i) => (
              <button key={p} className={`rounded px-2 py-0.5 font-mono text-[10px] ${i === 2 ? "bg-[#1F1F1F] text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"}`}>{p}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-end gap-3">
          {funnelSteps.map((step, i) => {
            const heightPct = Math.max(15, (step.count / maxFunnel) * 100);
            const isLast = i === funnelSteps.length - 1;
            return (
              <div key={step.label} className="flex flex-1 flex-col items-center gap-2 cursor-pointer group/bar"
                onClick={() => router.push(FUNNEL_ROUTES[step.label] || "/users")}>
                <div
                  className={`w-full rounded-t-lg flex items-center justify-center transition-opacity group-hover/bar:opacity-80 ${isLast ? "bg-[#FF9A6D]" : "bg-[#3D5A80]"}`}
                  style={{ height: `${heightPct}%`, minHeight: 40 }}
                >
                  <span className={`font-mono text-[15px] font-bold ${isLast ? "text-[#0A0A0A]" : "text-white"}`}>{step.count}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-3">
          {funnelSteps.map((step) => (
            <span key={step.label}
              className={`flex-1 text-center font-mono text-[9px] uppercase tracking-[1px] cursor-pointer hover:opacity-80 ${step.label === "PAID" ? "text-[#FF9A6D]" : "text-muted-foreground/40"}`}
              onClick={() => router.push(FUNNEL_ROUTES[step.label] || "/users")}>
              {step.label}
            </span>
          ))}
        </div>

        <Link href="/analytics" className="flex items-baseline gap-2 mt-4 group">
          <span className="font-mono text-[36px] font-bold tracking-[-1px] text-foreground">{conversionPct}%</span>
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">Overall Conversion →</span>
        </Link>
      </div>

      {/* Column 4 — Activity + Health score */}
      <div className="flex w-[240px] flex-shrink-0 flex-col gap-4">
        {/* Recent Activity → Activity */}
        <Link href="/activity" className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5 hover:border-[#2a2a2a] hover:bg-[#181818] transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Recent Activity</span>
            <span className="font-mono text-[10px] text-transparent group-hover:text-muted-foreground/40 transition-colors">→</span>
          </div>
          <div className="flex flex-col gap-3.5 flex-1">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-2.5">
                <div className={`mt-1.5 size-[6px] flex-shrink-0 rounded-full ${activityDot(log.action)}`} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[12px] text-foreground leading-tight">{activityLabel(log)}</span>
                  <span className="font-mono text-[10px] text-muted-foreground/30">{formatRelativeTime(log.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </Link>

        {/* Health Score → Analytics */}
        <Link href="/analytics" className="flex flex-col items-center justify-center rounded-xl border border-[#1F1F1F] bg-[#141414] p-5 h-[186px] hover:border-[#2a2a2a] hover:bg-[#181818] transition-colors group">
          <div className="relative flex items-center justify-center">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#1F1F1F" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#FF9A6D" strokeWidth="8"
                strokeDasharray={`${(conversionPct / 100) * 327} 327`}
                strokeLinecap="round" transform="rotate(-90 60 60)" />
            </svg>
            <span className="absolute font-mono text-[28px] font-bold tracking-[-1px] text-foreground">
              {(conversionPct / 10).toFixed(1)}
            </span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/40 mt-2 group-hover:text-muted-foreground transition-colors">Signup &rarr; Paid &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
