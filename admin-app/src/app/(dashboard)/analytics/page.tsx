"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchView } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import type { UserFunnel } from "@/types/user";

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card className="border-border bg-card flex-1">
      <CardContent className="p-4 flex flex-col gap-1">
        <span className="text-xs text-muted-foreground/60">{label}</span>
        <span className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</span>
        {sub && <span className="text-xs text-muted-foreground/40">{sub}</span>}
      </CardContent>
    </Card>
  );
}

function FunnelBar({ label, count, total, color }: { label: string; count: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const width = total > 0 ? Math.max(5, (count / total) * 100) : 5;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-[13px] text-muted-foreground/60 text-right">{label}</span>
      <div className="flex-1 flex items-center gap-2">
        <div
          className={`h-8 rounded ${color || "bg-secondary"} flex items-center px-3`}
          style={{ width: `${width}%` }}
        >
          <span className="text-[15px] font-semibold text-foreground">{count}</span>
        </div>
        <span className="text-xs text-muted-foreground/40">{pct}%</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [users, setUsers] = useState<UserFunnel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchView<UserFunnel>("v_user_funnel");
        setUsers(data);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <Skeleton className="h-8 w-32 rounded" />
        <div className="flex gap-2.5">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 flex-1 rounded-lg" />)}</div>
        <Skeleton className="h-[200px] rounded-lg" />
        <div className="flex gap-2.5">{[1, 2].map((i) => <Skeleton key={i} className="h-[180px] flex-1 rounded-lg" />)}</div>
      </div>
    );
  }

  const total = users.length;
  const withAgreement = users.filter((u) => u.extraction_status === "completed").length;
  const waitlisted = users.filter((u) => u.user_status === "waitlisted").length;
  const approved = users.filter((u) => ["approved", "active", "agreement_confirmed"].includes(u.user_status)).length;
  const active = users.filter((u) => u.user_status === "active").length;
  const paid = users.filter((u) => (u.successful_payments || 0) > 0).length;
  const totalRevenue = users.reduce((s, u) => s + (u.total_paid_paise || 0), 0);
  const avgRent = users.filter((u) => (u.monthly_rent_paise || 0) > 0);
  const avgRentVal = avgRent.length > 0 ? avgRent.reduce((s, u) => s + (u.monthly_rent_paise || 0), 0) / avgRent.length : 0;

  // City breakdown
  const cities = new Map<string, { count: number; revenue: number }>();
  users.forEach((u) => {
    const city = u.property_city || "Unknown";
    const existing = cities.get(city) || { count: 0, revenue: 0 };
    cities.set(city, { count: existing.count + 1, revenue: existing.revenue + (u.total_paid_paise || 0) });
  });
  const cityEntries = Array.from(cities.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 5);

  // Risk distribution
  const riskCounts = { LOW: 0, MED: 0, HIGH: 0, PENDING: 0 };
  users.forEach((u) => {
    const r = u.risk_level as keyof typeof riskCounts;
    if (r && r in riskCounts) riskCounts[r]++;
    else riskCounts.PENDING++;
  });

  // Verification rates
  const bankRate = total > 0 ? Math.round((users.filter((u) => u.bank_verified).length / total) * 100) : 0;
  const utilityRate = total > 0 ? Math.round((users.filter((u) => u.utility_verified).length / total) * 100) : 0;
  const landlordRate = total > 0 ? Math.round((users.filter((u) => u.landlord_approved).length / total) * 100) : 0;
  const m360Rate = total > 0 ? Math.round((users.filter((u) => u.m360_status === "SUCCESS").length / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 p-5 overflow-auto">
      <h1 className="text-lg font-semibold text-foreground">Analytics</h1>

      {/* KPIs */}
      <div className="flex gap-3">
        <StatCard label="Total Users" value={String(total)} />
        <StatCard label="Revenue" value={formatCurrency(totalRevenue)} color="text-success" />
        <StatCard label="Conversion" value={`${total > 0 ? Math.round((paid / total) * 100) : 0}%`} sub="signup → paid" />
        <StatCard label="Avg Rent" value={formatCurrency(Math.round(avgRentVal))} />
      </div>

      {/* Funnel */}
      <Card className="border-border bg-card">
        <CardContent className="p-5 flex flex-col gap-3">
          <span className="text-[15px] font-semibold text-foreground">User Funnel</span>
          <div className="flex flex-col gap-2">
            <FunnelBar label="Signed up" count={total} total={total} />
            <FunnelBar label="Agreement" count={withAgreement} total={total} />
            <FunnelBar label="Waitlisted" count={waitlisted} total={total} />
            <FunnelBar label="Approved" count={approved} total={total} />
            <FunnelBar label="Active" count={active} total={total} />
            <FunnelBar label="Paid" count={paid} total={total} color="bg-primary/30" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {/* City Breakdown */}
        <Card className="flex-1 border-border bg-card">
          <CardContent className="p-5 flex flex-col gap-3">
            <span className="text-[15px] font-semibold text-foreground">By City</span>
            {cityEntries.map(([city, data]) => (
              <div key={city} className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">{city}</span>
                <div className="flex items-center gap-3">
                  <span className="text-foreground font-medium">{data.count} users</span>
                  <span className="text-muted-foreground/40">{formatCurrency(data.revenue)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card className="flex-1 border-border bg-card">
          <CardContent className="p-5 flex flex-col gap-3">
            <span className="text-[15px] font-semibold text-foreground">Risk Distribution</span>
            <div className="flex flex-col gap-2.5">
              {(["LOW", "MED", "HIGH", "PENDING"] as const).map((level) => {
                const count = riskCounts[level];
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const color = level === "LOW" ? "text-success" : level === "MED" ? "text-warning" : level === "HIGH" ? "text-destructive" : "text-muted-foreground/40";
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span className={`w-16 text-[13px] font-medium ${color}`}>{level}</span>
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${level === "LOW" ? "bg-success" : level === "MED" ? "bg-warning" : level === "HIGH" ? "bg-destructive" : "bg-muted-foreground/20"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground/40 w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Verification Rates */}
        <Card className="flex-1 border-border bg-card">
          <CardContent className="p-5 flex flex-col gap-3">
            <span className="text-[15px] font-semibold text-foreground">Verification Rates</span>
            {[
              { label: "Bank", pct: bankRate },
              { label: "Utility", pct: utilityRate },
              { label: "Landlord", pct: landlordRate },
              { label: "M360", pct: m360Rate },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="w-16 text-[13px] text-muted-foreground">{item.label}</span>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.pct >= 70 ? "bg-success" : item.pct >= 40 ? "bg-warning" : "bg-destructive"}`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground/40 w-12 text-right">{item.pct}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
