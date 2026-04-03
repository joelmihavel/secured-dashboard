"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchView } from "@/lib/supabase";
import { formatCurrencyShort, formatRelativeTime, maskPhone } from "@/lib/utils";
import type { UserFunnel } from "@/types/user";

type Period = "7d" | "30d" | "90d";

const PERIOD_DAYS: Record<Period, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

interface AuditLog {
  id: string;
  action: string;
  action_category: string;
  entity_type: string | null;
  entity_id: string | null;
  user_id: string | null;
  details: Record<string, unknown> | null;
  status: string | null;
  created_at: string;
  ip_address: string | null;
}

function activityDot(action: string) {
  if (action.includes("APPROVE")) return "bg-success";
  if (action.includes("REJECT")) return "bg-destructive";
  if (action.includes("OVERRIDE") || action.includes("BYPASS")) return "bg-warning";
  if (action.includes("SIGNUP") || action.includes("REGISTER")) return "bg-muted-foreground/30";
  return "bg-blue-400";
}

function activitySummary(log: AuditLog): { text: string; detail?: string } {
  const action = log.action
    .replace(/_/g, " ")
    .replace(/WAITLIST BATCH /i, "")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

  const target =
    (log.details?.user_name as string) ||
    (log.details?.name as string) ||
    (log.details?.phone as string) ||
    log.entity_id?.slice(0, 8) ||
    "";

  const reasons = log.details?.rejection_reasons;
  const detail = Array.isArray(reasons)
    ? (reasons as string[]).join(", ")
    : (log.details?.reason as string) || undefined;

  return {
    text: target ? `${action} ${target}` : action,
    detail,
  };
}

function KPICard({
  label,
  value,
  delta,
  deltaType,
  highlight,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaType?: "up" | "down";
  highlight?: boolean;
}) {
  return (
    <Card className={`border ${highlight ? "border-warning/20" : "border-border"} bg-card`}>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground/60">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className={`text-[28px] font-bold tracking-tight ${highlight ? "text-warning" : "text-foreground"}`}>
            {value}
          </span>
          {delta && (
            <span className={`text-xs ${deltaType === "up" ? "text-success" : "text-destructive"}`}>
              {delta}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStep({
  count,
  total,
  label,
  dropOff,
  isLast,
}: {
  count: number;
  total: number;
  label: string;
  dropOff?: number;
  isLast?: boolean;
}) {
  const height = Math.max(28, Math.round((count / Math.max(total, 1)) * 120));
  return (
    <>
      <div className="flex flex-1 flex-col items-center gap-1">
        <div
          className={`flex w-full items-center justify-center rounded-t ${isLast ? "bg-primary" : "bg-secondary"}`}
          style={{ height: `${height}px`, alignSelf: "flex-end" }}
        >
          <span className={`text-sm font-bold ${isLast ? "text-primary-foreground" : "text-foreground"}`}>
            {count}
          </span>
        </div>
      </div>
      {dropOff != null && (
        <div className="flex w-8 items-center justify-center" style={{ paddingBottom: `${height / 3}px` }}>
          <span className="text-[11px] text-destructive">-{dropOff}%</span>
        </div>
      )}
    </>
  );
}

function filterUsersByPeriod(users: UserFunnel[], period: Period): UserFunnel[] {
  const days = PERIOD_DAYS[period];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffTime = cutoff.getTime();
  return users.filter((u) => {
    if (!u.signed_up_at) return false;
    return new Date(u.signed_up_at).getTime() >= cutoffTime;
  });
}

function computeKPIs(filtered: UserFunnel[], allUsers: UserFunnel[]) {
  const totalUsers = filtered.length;
  const withAgreement = filtered.filter((u) => u.extraction_status === "completed").length;
  const approved = filtered.filter((u) => ["approved", "active", "agreement_confirmed"].includes(u.user_status)).length;
  const active = filtered.filter((u) => u.user_status === "active").length;
  const paid = filtered.filter((u) => (u.successful_payments || 0) > 0).length;
  const totalRevenue = filtered.reduce((sum, u) => sum + (u.total_paid_paise || 0), 0);
  const conversionRate = totalUsers > 0 ? Math.round((paid / totalUsers) * 100) : 0;
  const triageQueue = filtered.filter((u) => u.user_status === "waitlisted" || u.user_status === "agreement_confirmed");

  return { totalUsers, withAgreement, approved, active, paid, totalRevenue, conversionRate, triageQueue };
}

export default function OverviewPage() {
  const [users, setUsers] = useState<UserFunnel[]>([]);
  const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("7d");

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchView<UserFunnel>("v_user_funnel", {
          order: { column: "signed_up_at", ascending: false },
        });
        setUsers(data);
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    async function loadActivity() {
      try {
        const data = await fetchView<AuditLog>("audit_logs", {
          order: { column: "created_at", ascending: false },
          limit: 5,
        });
        setActivityLogs(data);
      } catch (err) {
        console.error("Failed to load activity logs:", err);
      } finally {
        setActivityLoading(false);
      }
    }
    loadActivity();
  }, []);

  const filtered = useMemo(() => filterUsersByPeriod(users, period), [users, period]);
  const kpis = useMemo(() => computeKPIs(filtered, users), [filtered, users]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <div className="flex gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[72px] flex-1 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[200px] rounded-lg" />
        <div className="flex gap-2.5">
          <Skeleton className="h-[200px] flex-[3] rounded-lg" />
          <Skeleton className="h-[200px] flex-[2] rounded-lg" />
        </div>
      </div>
    );
  }

  const { totalUsers, withAgreement, approved, active, paid, totalRevenue, conversionRate, triageQueue } = kpis;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Overview</h1>
        <div className="flex gap-px rounded-md bg-border p-0.5">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <KPICard label="Signups" value={String(totalUsers)} />
        <KPICard label="Revenue" value={formatCurrencyShort(totalRevenue)} />
        <KPICard label="Conversion" value={`${conversionRate}%`} />
        <KPICard label="Triage" value={String(triageQueue.length)} highlight={triageQueue.length > 0} />
      </div>

      <Card className="border-border bg-card">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-foreground">User funnel</span>
            <span className="text-xs text-muted-foreground/60">
              Overall: <span className="font-medium text-foreground">{conversionRate}%</span>
            </span>
          </div>
          <div className="flex items-end gap-1" style={{ height: 130 }}>
            <FunnelStep count={totalUsers} total={totalUsers} label="Signed up" dropOff={totalUsers > 0 ? Math.round(((totalUsers - withAgreement) / totalUsers) * 100) : 0} />
            <FunnelStep count={withAgreement} total={totalUsers} label="Agreement" dropOff={withAgreement > 0 ? Math.round(((withAgreement - approved) / withAgreement) * 100) : 0} />
            <FunnelStep count={approved} total={totalUsers} label="Approved" dropOff={approved > 0 ? Math.round(((approved - active) / approved) * 100) : 0} />
            <FunnelStep count={active} total={totalUsers} label="Active" dropOff={active > 0 ? Math.round(((active - paid) / active) * 100) : 0} />
            <FunnelStep count={paid} total={totalUsers} label="Paid" isLast />
          </div>
          <div className="flex gap-1">
            <span className="flex-1 text-center text-xs text-muted-foreground/60">Signed up</span>
            <div className="w-8" />
            <span className="flex-1 text-center text-xs text-muted-foreground/60">Agreement</span>
            <div className="w-8" />
            <span className="flex-1 text-center text-xs text-muted-foreground/60">Approved</span>
            <div className="w-8" />
            <span className="flex-1 text-center text-xs text-muted-foreground/60">Active</span>
            <div className="w-8" />
            <span className="flex-1 text-center text-xs font-medium text-primary">Paid</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Card className="flex-[3] border-border bg-card">
          <CardContent className="flex flex-col gap-0 p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-foreground">Triage</span>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[11px]">
                  {triageQueue.length}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 bg-success text-success-foreground text-xs font-semibold hover:bg-success/90">
                  Batch approve
                </Button>
                <Button size="sm" variant="outline" className="h-8 border-destructive/40 text-destructive text-xs hover:bg-destructive/10">
                  Batch reject
                </Button>
              </div>
            </div>
            {triageQueue.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground/40">
                No users in triage for this period
              </div>
            ) : (
              triageQueue.slice(0, 4).map((user) => (
                <div key={user.user_id} className="flex items-center gap-3 border-b border-border/50 px-5 py-3 text-[13px] hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="flex flex-1 items-center gap-2">
                    <span className="font-medium text-foreground">{user.name || "\u2014"}</span>
                    <span className="text-muted-foreground/40">{user.property_city || ""}</span>
                  </div>
                  <span className="w-16 text-right text-muted-foreground">{formatCurrencyShort(user.monthly_rent_paise)}</span>
                  <span className={`w-12 text-center text-xs ${
                    user.risk_level === "HIGH" ? "text-destructive" :
                    user.risk_level === "MED" ? "text-warning" : "text-success"
                  }`}>
                    {user.risk_level || "\u2014"}
                  </span>
                  <span className={`w-10 text-center text-xs font-medium ${
                    (user.bank_verified ? 1 : 0) + (user.utility_verified ? 1 : 0) + (user.landlord_approved ? 1 : 0) >= 3
                      ? "text-success" : "text-warning"
                  }`}>
                    {(user.bank_verified ? 1 : 0) + (user.utility_verified ? 1 : 0) + (user.landlord_approved ? 1 : 0)}/3
                  </span>
                </div>
              ))
            )}
            {triageQueue.length > 4 && (
              <div className="px-5 py-3 text-xs">
                <span className="text-muted-foreground/40">+{triageQueue.length - 4} more · </span>
                <span className="text-muted-foreground cursor-pointer hover:text-foreground">View all →</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex-[2] border-border bg-card">
          <CardContent className="flex flex-col gap-0 p-0">
            <div className="border-b border-border px-5 py-3">
              <span className="text-[15px] font-semibold text-foreground">Activity</span>
            </div>
            <div className="flex flex-col">
              {activityLoading ? (
                <div className="flex flex-col gap-2 p-5">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 rounded" />
                  ))}
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground/40">
                  No activity recorded yet
                </div>
              ) : (
                activityLogs.map((log) => {
                  const summary = activitySummary(log);
                  return (
                    <div key={log.id} className="flex gap-3 border-b border-border/30 px-5 py-3">
                      <div className={`mt-1.5 size-2 flex-shrink-0 rounded-full ${activityDot(log.action)}`} />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] text-muted-foreground">
                          {summary.text}
                          {summary.detail && <span> · {summary.detail}</span>}
                        </span>
                        <span className="text-[11px] text-muted-foreground/40">
                          {formatRelativeTime(log.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
