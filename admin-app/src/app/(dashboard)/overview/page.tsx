"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrencyShort, formatRelativeTime } from "@/lib/utils";
import { useUsers } from "@/hooks/useUsers";
import { usePayments } from "@/hooks/usePayments";
import { callEdgeFunction } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { FilterBar, useOverviewFilters, type OverviewFilters } from "@/components/overview/filter-bar";
import { PaymentsFeed } from "@/components/overview/activity-feed";

const FUNNEL_ROUTES: Record<string, string> = {
  SIGNUP: "/users",
  AGREE: "/users",
  APPROV: "/users?filter=pending",
  ACTIVE: "/users",
  PAID: "/payments",
};

type AnalyticsCardId = "city" | "risk" | "verification_pipeline" | "rent_dist" | "credit_dist";

const CARD_RELEVANCE: Record<string, AnalyticsCardId[]> = {
  cities: ["city", "risk", "verification_pipeline"],
  buildings: ["city", "risk", "rent_dist"],
  riskLevels: ["risk", "verification_pipeline", "credit_dist"],
  creditScore: ["credit_dist", "verification_pipeline", "risk"],
  rentRange: ["rent_dist", "city", "risk"],
  statuses: ["city", "risk", "verification_pipeline"],
  dateRange: ["city", "risk", "verification_pipeline"],
};

function getVisibleCards(filters: OverviewFilters): Set<AnalyticsCardId> {
  const hasActive =
    filters.dateRange !== "all" ||
    filters.statuses.length > 0 ||
    filters.cities.length > 0 ||
    filters.buildings.length > 0 ||
    filters.creditScore !== "all" ||
    filters.riskLevels.length > 0 ||
    filters.rentRange !== "all";

  if (!hasActive) return new Set(["city", "risk", "verification_pipeline"]);

  const visible = new Set<AnalyticsCardId>();
  if (filters.dateRange !== "all") CARD_RELEVANCE.dateRange.forEach((c) => visible.add(c));
  if (filters.statuses.length > 0) CARD_RELEVANCE.statuses.forEach((c) => visible.add(c));
  if (filters.cities.length > 0) CARD_RELEVANCE.cities.forEach((c) => visible.add(c));
  if (filters.buildings.length > 0) CARD_RELEVANCE.buildings.forEach((c) => visible.add(c));
  if (filters.creditScore !== "all") CARD_RELEVANCE.creditScore.forEach((c) => visible.add(c));
  if (filters.riskLevels.length > 0) CARD_RELEVANCE.riskLevels.forEach((c) => visible.add(c));
  if (filters.rentRange !== "all") CARD_RELEVANCE.rentRange.forEach((c) => visible.add(c));
  return visible;
}

function getHighlightedCards(filters: OverviewFilters): Set<AnalyticsCardId> {
  const highlighted = new Set<AnalyticsCardId>();
  if (filters.cities.length > 0 || filters.buildings.length > 0) highlighted.add("city");
  if (filters.riskLevels.length > 0) highlighted.add("risk");
  if (filters.creditScore !== "all") highlighted.add("credit_dist");
  if (filters.creditScore !== "all" || filters.riskLevels.length > 0) highlighted.add("verification_pipeline");
  if (filters.rentRange !== "all") highlighted.add("rent_dist");
  return highlighted;
}

function buildFilterSubtitle(filters: OverviewFilters): string | null {
  const parts: string[] = [];
  if (filters.dateRange !== "all") {
    const labels: Record<string, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days", "1y": "1 year" };
    parts.push(labels[filters.dateRange] || filters.dateRange);
  }
  if (filters.cities.length > 0) {
    parts.push(filters.cities.length <= 2 ? filters.cities.join(", ") : `${filters.cities.length} cities`);
  }
  if (filters.riskLevels.length > 0) {
    parts.push(filters.riskLevels.join("/") + " risk");
  }
  if (filters.creditScore !== "all") {
    parts.push(filters.creditScore + " credit");
  }
  if (filters.rentRange !== "all") {
    const labels: Record<string, string> = { "<10k": "<₹10K rent", "10k-25k": "₹10-25K rent", "25k-50k": "₹25-50K rent", "50k+": "₹50K+ rent" };
    parts.push(labels[filters.rentRange] || filters.rentRange);
  }
  if (filters.statuses.length > 0) {
    parts.push(filters.statuses.length <= 2 ? filters.statuses.join(", ") : `${filters.statuses.length} statuses`);
  }
  if (filters.buildings.length > 0) {
    parts.push(filters.buildings.length === 1 ? filters.buildings[0] : `${filters.buildings.length} buildings`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ComparisonBadge({ filtered, total }: { filtered: number; total: number }) {
  if (filtered === total) return null;
  const pct = total > 0 ? Math.round((filtered / total) * 100) : 0;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#3D5A80]/15 px-1.5 py-0.5 font-mono text-[9px] text-[#7BA3C9]">
      {pct}% of {total}
    </span>
  );
}

const RENT_BUCKETS = [
  { key: "<10k", label: "<10K", min: 0, max: 1000000 },
  { key: "10k-25k", label: "10-25K", min: 1000000, max: 2500000 },
  { key: "25k-50k", label: "25-50K", min: 2500000, max: 5000000 },
  { key: "50k+", label: "50K+", min: 5000000, max: Infinity },
] as const;

const CREDIT_BUCKETS = [
  { key: "<600", label: "<600", min: 0, max: 600 },
  { key: "600-700", label: "600-700", min: 600, max: 700 },
  { key: "700-750", label: "700-750", min: 700, max: 750 },
  { key: "750+", label: "750+", min: 750, max: Infinity },
] as const;

export default function OverviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { users, loading: usersLoading } = useUsers();
  const { payments } = usePayments(30);
  const loading = usersLoading;
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { filters, filteredUsers: fUsers, activeCount, clearAll, updateFilter, uniqueCities, uniqueBuildings } = useOverviewFilters(users);

  const isFiltered = activeCount > 0;
  const filterSubtitle = useMemo(() => buildFilterSubtitle(filters), [filters]);
  const visibleCards = useMemo(() => getVisibleCards(filters), [filters]);
  const highlightedCards = useMemo(() => getHighlightedCards(filters), [filters]);

  const filteredUserIds = useMemo(() => new Set(fUsers.map((u) => u.user_id)), [fUsers]);

  const stats = useMemo(() => {
    const total = fUsers.length;
    const withAgreement = fUsers.filter((u) => u.extraction_status === "completed").length;
    const approved = fUsers.filter((u) => ["approved", "active", "agreement_confirmed"].includes(u.user_status)).length;
    const active = fUsers.filter((u) => u.user_status === "active").length;
    const paid = fUsers.filter((u) => (u.successful_payments || 0) > 0).length;
    const totalRevenue = fUsers.reduce((s, u) => s + (u.total_paid_paise || 0), 0);
    const verified = fUsers.filter((u) => u.m360_status === "SUCCESS").length;
    const bankVerified = fUsers.filter((u) => u.bank_verified).length;
    const utilityVerified = fUsers.filter((u) => u.utility_verified).length;
    const triage = fUsers.filter((u) => u.user_status === "waitlisted" || u.user_status === "agreement_confirmed");
    const paidPayments = fUsers.reduce((s, u) => s + (u.successful_payments || 0), 0);
    const totalPayments = fUsers.filter((u) => u.monthly_rent_paise && u.monthly_rent_paise > 0).length;

    const m360Rate = total > 0 ? Math.round((verified / total) * 100) : 0;
    const bankRate = total > 0 ? Math.round((bankVerified / total) * 100) : 0;
    const utilityRate = total > 0 ? Math.round((utilityVerified / total) * 100) : 0;

    const riskCounts = { LOW: 0, MED: 0, HIGH: 0 };
    fUsers.forEach((u) => { const r = u.risk_level as keyof typeof riskCounts; if (r in riskCounts) riskCounts[r]++; });

    const CITY_ALIASES: Record<string, string> = { "Bengaluru": "Bangalore", "bengaluru": "Bangalore" };
    const cities = new Map<string, number>();
    fUsers.forEach((u) => {
      const raw = u.property_city || "";
      const c = raw ? (CITY_ALIASES[raw] || raw) : "Not set";
      cities.set(c, (cities.get(c) || 0) + 1);
    });
    const cityEntries = Array.from(cities.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const rentDist = RENT_BUCKETS.map((b) => ({
      ...b,
      count: fUsers.filter((u) => {
        const r = u.monthly_rent_paise || 0;
        return r >= b.min && r < b.max;
      }).length,
    }));

    const creditDist = CREDIT_BUCKETS.map((b) => ({
      ...b,
      count: fUsers.filter((u) => {
        const s = u.m360_credit_score;
        if (s === null) return false;
        return s >= b.min && (b.max === Infinity ? true : s < b.max);
      }).length,
    }));

    const avgRentPaise = totalPayments > 0 ? Math.round(fUsers.reduce((s, u) => s + (u.monthly_rent_paise || 0), 0) / totalPayments) : 0;

    return { total, withAgreement, approved, active, paid, totalRevenue, verified, bankVerified, utilityVerified, triage, paidPayments, totalPayments, bankRate, utilityRate, m360Rate, riskCounts, cityEntries, citiesTotal: cities.size, rentDist, creditDist, avgRentPaise };
  }, [fUsers]);

  const globalStats = useMemo(() => ({
    total: users.length,
    verified: users.filter((u) => u.m360_status === "SUCCESS").length,
    paidPayments: users.reduce((s, u) => s + (u.successful_payments || 0), 0),
    paid: users.filter((u) => (u.successful_payments || 0) > 0).length,
  }), [users]);

  const conversionPct = stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0;

  function usersLinkWithFilter(extra?: string): string {
    const parts: string[] = [];
    if (filters.cities.length === 1) parts.push(`search=${encodeURIComponent(filters.cities[0])}`);
    if (filters.buildings.length === 1) parts.push(`search=${encodeURIComponent(filters.buildings[0])}`);
    if (extra) parts.push(extra);
    return `/users${parts.length > 0 ? "?" + parts.join("&") : ""}`;
  }

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
      <div className="flex flex-col gap-4 p-6 px-8 h-full overflow-y-auto">
        <Skeleton className="h-9 w-full rounded-xl" />
        <div className="flex gap-4 min-h-[460px]">
          <div className="flex w-[240px] flex-col gap-4"><Skeleton className="flex-1 rounded-xl" /><Skeleton className="flex-1 rounded-xl" /></div>
          <div className="flex w-[280px] flex-col gap-4"><Skeleton className="h-[180px] rounded-xl" /><Skeleton className="flex-1 rounded-xl" /></div>
          <Skeleton className="flex-1 rounded-xl" />
          <div className="flex w-[260px] flex-col gap-4"><Skeleton className="flex-1 rounded-xl" /></div>
        </div>
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-[200px] rounded-xl" /><Skeleton className="h-[200px] rounded-xl" /><Skeleton className="h-[200px] rounded-xl" /></div>
      </div>
    );
  }

  function cardBorder(id: AnalyticsCardId) {
    return highlightedCards.has(id) ? "border-[#3D5A80]/40" : "border-[#1F1F1F]";
  }

  function cardGlow(id: AnalyticsCardId) {
    return highlightedCards.has(id) ? "shadow-[0_0_12px_rgba(61,90,128,0.15)]" : "";
  }

  const maxRent = Math.max(...stats.rentDist.map((b) => b.count), 1);
  const maxCredit = Math.max(...stats.creditDist.map((b) => b.count), 1);
  const maxCity = stats.cityEntries.length > 0 ? stats.cityEntries[0][1] : 1;

  const visibleCardCount = visibleCards.size;
  const gridCols = visibleCardCount <= 2 ? "grid-cols-2" : visibleCardCount === 3 ? "grid-cols-3" : "grid-cols-4";

  const verificationSteps = [
    { label: "M360 Identity", sublabel: "Phone OTP check", count: stats.verified, rate: stats.m360Rate, color: "bg-[#FF9A6D]" },
    { label: "Bank Verified", sublabel: "Post-approval", count: stats.bankVerified, rate: stats.bankRate, color: "bg-[#3D5A80]" },
    { label: "Utility Verified", sublabel: "Post-approval", count: stats.utilityVerified, rate: stats.utilityRate, color: "bg-[#3D5A80]/60" },
  ];

  return (
    <div className="flex flex-col gap-4 p-6 px-8 h-full overflow-y-auto">
      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        activeCount={activeCount}
        clearAll={clearAll}
        updateFilter={updateFilter}
        uniqueCities={uniqueCities}
        uniqueBuildings={uniqueBuildings}
        totalUsers={users.length}
        filteredCount={fUsers.length}
      />

      {/* Row 1 — Main bento grid */}
      <div className="flex gap-4 h-[460px] flex-shrink-0">
        {/* Column 1 — Tall stat cards */}
        <div className="flex w-[240px] flex-shrink-0 flex-col gap-4">
          <Link href={usersLinkWithFilter()} className="flex flex-1 flex-col justify-between rounded-xl bg-[#3D5A80] p-5 hover:bg-[#4A6B91] transition-colors cursor-pointer group">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-white/60">Total Users</span>
              <span className="font-mono text-[10px] text-white/0 group-hover:text-white/60 transition-colors">&rarr;</span>
            </div>
            <div>
              <span className="font-mono text-[72px] font-bold leading-none tracking-[-2px] text-white">
                {stats.total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-[12px] text-white/40">
                  {filterSubtitle || "All time"}
                </span>
                {isFiltered && <ComparisonBadge filtered={stats.total} total={globalStats.total} />}
              </div>
            </div>
          </Link>

          <div className="flex flex-1 flex-col justify-between rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Verified Users</span>
            <div>
              <span className="font-mono text-[72px] font-bold leading-none tracking-[-2px] text-foreground">{stats.verified}</span>
              <span className="font-mono text-[20px] text-muted-foreground/40 ml-2">/ {stats.total}</span>
              <div className="font-mono text-[11px] text-muted-foreground/30 mt-1">M360 identity check</div>
              {isFiltered && (
                <div className="mt-1">
                  <ComparisonBadge filtered={stats.verified} total={globalStats.verified} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 2 — Paid payments + Triage queue */}
        <div className="flex w-[280px] flex-shrink-0 flex-col gap-4">
          <Link href="/payments" className="flex flex-col gap-3 rounded-xl border border-[#1F1F1F] bg-[#141414] p-5 hover:border-[#2a2a2a] hover:bg-[#181818] transition-colors cursor-pointer group">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Paid Payments</span>
              <span className="font-mono text-[10px] text-transparent group-hover:text-muted-foreground/40 transition-colors">&rarr;</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[48px] font-bold leading-none tracking-[-1px] text-foreground">{stats.paidPayments}</span>
              <span className="font-mono text-[20px] text-muted-foreground/40">/ {stats.totalPayments}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Revenue</span>
                <span className="font-mono text-[13px] text-muted-foreground">{formatCurrencyShort(stats.totalRevenue)}</span>
              </div>
              {isFiltered && <ComparisonBadge filtered={stats.paidPayments} total={globalStats.paidPayments} />}
            </div>
            {stats.avgRentPaise > 0 && (
              <div className="flex items-center gap-3 border-t border-[#1F1F1F] pt-2">
                <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Avg rent</span>
                <span className="font-mono text-[13px] text-muted-foreground">{formatCurrencyShort(stats.avgRentPaise)}</span>
              </div>
            )}
          </Link>

          <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
            <Link href="/users?filter=pending" className="flex items-center justify-between mb-3 group cursor-pointer">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] group-hover:text-muted-foreground/60 transition-colors">Pending Review</span>
              <span className="flex size-6 items-center justify-center rounded-full bg-success/20 font-mono text-[11px] font-semibold text-success">{stats.triage.length}</span>
            </Link>
            <div className="flex flex-col gap-1.5 flex-1">
              {stats.triage.slice(0, 5).map((u) => {
                const waitTime = u.waitlist_joined_at ? formatRelativeTime(u.waitlist_joined_at) : null;
                return (
                  <button key={u.user_id} onClick={() => router.push(`/users?filter=pending`)}
                    className="flex items-center gap-2 group/row rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/[0.03] transition-colors">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[12px] text-foreground truncate">{u.name || "—"}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/30 truncate">
                        {u.property_city || "No city"}{waitTime ? ` · ${waitTime}` : ""}
                      </span>
                    </div>
                    <span className={`font-mono text-[10px] font-semibold flex-shrink-0 ${
                      u.risk_level === "HIGH" ? "text-destructive" :
                      u.risk_level === "MED" ? "text-warning" : "text-success"
                    }`}>{u.risk_level || "—"}</span>
                    <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); handleTriageAction(u.user_id, "approve"); }} disabled={actionLoading === u.user_id}
                        className="rounded border border-success/30 bg-success/5 px-1.5 py-0.5 font-mono text-[9px] text-success hover:bg-success/10 transition-colors disabled:opacity-50">&#10003;</button>
                      <button onClick={(e) => { e.stopPropagation(); handleTriageAction(u.user_id, "reject"); }} disabled={actionLoading === u.user_id}
                        className="rounded border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 font-mono text-[9px] text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">&#10007;</button>
                    </div>
                  </button>
                );
              })}
            </div>
            {stats.triage.length > 5 && (
              <Link href="/users?filter=pending" className="font-mono text-[11px] text-muted-foreground/40 mt-2 hover:text-muted-foreground transition-colors">
                +{stats.triage.length - 5} more &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Column 3 — User Funnel */}
        <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">User Funnel</span>
            {isFiltered && (
              <span className="font-mono text-[9px] text-[#7BA3C9] bg-[#3D5A80]/10 rounded px-1.5 py-0.5">
                Filtered
              </span>
            )}
          </div>

          <div className="flex flex-1 items-end gap-3">
            {funnelSteps.map((step, i) => {
              const heightPct = Math.max(15, (step.count / maxFunnel) * 100);
              const isLast = i === funnelSteps.length - 1;
              const prevCount = i > 0 ? funnelSteps[i - 1].count : step.count;
              const dropoff = prevCount > 0 ? Math.round(((prevCount - step.count) / prevCount) * 100) : 0;
              return (
                <div key={step.label} className="flex flex-1 flex-col items-center gap-1.5 cursor-pointer group/bar"
                  onClick={() => router.push(step.label === "PAID" ? "/payments" : usersLinkWithFilter())}>
                  {i > 0 && dropoff > 0 && (
                    <span className="font-mono text-[9px] text-destructive/60">-{dropoff}%</span>
                  )}
                  <div className={`w-full rounded-t-lg flex items-center justify-center transition-all group-hover/bar:opacity-80 group-hover/bar:scale-[1.02] ${isLast ? "bg-[#FF9A6D]" : "bg-[#3D5A80]"}`}
                    style={{ height: `${heightPct}%`, minHeight: 40 }}>
                    <span className={`font-mono text-[15px] font-bold ${isLast ? "text-[#0A0A0A]" : "text-white"}`}>{step.count}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mt-3">
            {funnelSteps.map((step) => (
              <span key={step.label}
                className={`flex-1 text-center font-mono text-[9px] uppercase tracking-[1px] cursor-pointer hover:opacity-80 transition-opacity ${step.label === "PAID" ? "text-[#FF9A6D]" : "text-muted-foreground/40"}`}
                onClick={() => router.push(step.label === "PAID" ? "/payments" : usersLinkWithFilter())}>
                {step.label}
              </span>
            ))}
          </div>

          <div className="flex items-baseline gap-2 mt-4 border-t border-[#1F1F1F] pt-4">
            <span className="font-mono text-[36px] font-bold tracking-[-1px] text-foreground">{conversionPct}%</span>
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/40">Signup &rarr; Paid</span>
          </div>
        </div>

        {/* Column 4 — Payments feed */}
        <div className="flex w-[280px] flex-shrink-0 flex-col min-h-0">
          <PaymentsFeed
            payments={payments}
            filteredUserIds={filteredUserIds}
            isFiltered={isFiltered}
          />
        </div>
      </div>

      {/* Row 2 — Dynamic analytics cards */}
      <div className={cn("grid gap-4 flex-shrink-0 auto-rows-[280px]", gridCols)}>
        {/* City Breakdown — with proportional bars */}
        {visibleCards.has("city") && (
          <div className={cn("flex flex-col rounded-xl border bg-[#141414] p-5 transition-all overflow-hidden", cardBorder("city"), cardGlow("city"))}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">By City</span>
              {highlightedCards.has("city") && <span className="size-1.5 rounded-full bg-[#3D5A80]" />}
            </div>
            <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
              {stats.cityEntries.map(([city, count]) => {
                const barPct = maxCity > 0 ? Math.round((count / maxCity) * 100) : 0;
                return (
                  <button key={city} onClick={() => router.push(`/users?search=${encodeURIComponent(city)}`)}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/[0.04] transition-colors group/city flex-shrink-0">
                    <span className="text-[12px] text-muted-foreground group-hover/city:text-foreground transition-colors w-[80px] truncate text-left">{city}</span>
                    <div className="flex-1 h-[6px] rounded-full bg-[#1F1F1F] overflow-hidden">
                      <div className="h-full rounded-full bg-[#3D5A80]/50 group-hover/city:bg-[#3D5A80]/70 transition-colors" style={{ width: `${barPct}%` }} />
                    </div>
                    <span className="font-mono text-[12px] font-medium text-foreground w-[32px] text-right">{count}</span>
                  </button>
                );
              })}
            </div>
            {stats.citiesTotal > 5 && (
              <Link href="/users" className="font-mono text-[10px] text-muted-foreground/30 mt-2 hover:text-muted-foreground/50 transition-colors flex-shrink-0">
                +{stats.citiesTotal - 5} more cities &rarr;
              </Link>
            )}
          </div>
        )}

        {/* Risk Breakdown — clickable rows to filter */}
        {visibleCards.has("risk") && (
          <div className={cn("flex flex-col rounded-xl border bg-[#141414] p-5 transition-all overflow-hidden", cardBorder("risk"), cardGlow("risk"))}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Risk Breakdown</span>
              {highlightedCards.has("risk") && <span className="size-1.5 rounded-full bg-[#3D5A80]" />}
            </div>
            <div className="flex flex-col gap-3">
              {(["LOW", "MED", "HIGH"] as const).map((l) => {
                const count = stats.riskCounts[l];
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const isActive = filters.riskLevels.includes(l);
                return (
                  <button key={l}
                    onClick={() => updateFilter("riskLevels", isActive ? filters.riskLevels.filter((r) => r !== l) : [...filters.riskLevels, l])}
                    className={cn(
                      "rounded-lg px-2 py-1.5 -mx-2 transition-colors text-left",
                      isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    )}>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-muted-foreground">{l === "LOW" ? "Low" : l === "MED" ? "Medium" : "High"}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground/30">{pct}%</span>
                        <span className={`font-mono text-[15px] font-bold ${l === "LOW" ? "text-success" : l === "MED" ? "text-warning" : "text-destructive"}`}>{count}</span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-[#1F1F1F] overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${l === "LOW" ? "bg-success/60" : l === "MED" ? "bg-warning/60" : "bg-destructive/60"}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
            <span className="font-mono text-[9px] text-muted-foreground/20 mt-3">Click to filter</span>
          </div>
        )}

        {/* Verification Pipeline — merged M360 + Bank + Utility */}
        {visibleCards.has("verification_pipeline") && (
          <div className={cn("flex flex-col rounded-xl border bg-[#141414] p-5 transition-all overflow-hidden", cardBorder("verification_pipeline"), cardGlow("verification_pipeline"))}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Verification Pipeline</span>
              {highlightedCards.has("verification_pipeline") && <span className="size-1.5 rounded-full bg-[#3D5A80]" />}
            </div>
            <div className="flex flex-col gap-3">
              {verificationSteps.map((step, i) => (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex flex-col">
                      <span className="text-[12px] text-foreground">{step.label}</span>
                      <span className="font-mono text-[9px] text-muted-foreground/30">{step.sublabel}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[18px] font-bold tracking-[-0.5px] text-foreground">{step.rate}%</span>
                      <span className="font-mono text-[10px] text-muted-foreground/30">{step.count}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-[#1F1F1F] overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${step.color}`} style={{ width: `${step.rate}%` }} />
                  </div>
                  {i < verificationSteps.length - 1 && (
                    <div className="flex justify-center my-1">
                      <span className="font-mono text-[8px] text-muted-foreground/20">&darr;</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#1F1F1F]">
              <span className="font-mono text-[9px] text-muted-foreground/25">Sequential checks · each step requires the previous</span>
            </div>
          </div>
        )}

        {/* Rent Distribution */}
        {visibleCards.has("rent_dist") && (
          <div className={cn("flex flex-col rounded-xl border bg-[#141414] p-5 transition-all overflow-hidden", cardBorder("rent_dist"), cardGlow("rent_dist"))}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Rent Distribution</span>
              {highlightedCards.has("rent_dist") && <span className="size-1.5 rounded-full bg-[#3D5A80]" />}
            </div>
            <div className="flex items-end gap-2 flex-1 min-h-[80px]">
              {stats.rentDist.map((b) => {
                const hPct = Math.max(10, (b.count / maxRent) * 100);
                return (
                  <div key={b.key} className="flex flex-1 flex-col items-center gap-1">
                    <span className="font-mono text-[10px] font-semibold text-foreground">{b.count}</span>
                    <div className="w-full rounded-t bg-[#3D5A80]/60 transition-all hover:bg-[#3D5A80]/80" style={{ height: `${hPct}%`, minHeight: 8 }} />
                    <span className="font-mono text-[8px] text-muted-foreground/40">{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Credit Score Distribution */}
        {visibleCards.has("credit_dist") && (
          <div className={cn("flex flex-col rounded-xl border bg-[#141414] p-5 transition-all overflow-hidden", cardBorder("credit_dist"), cardGlow("credit_dist"))}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Credit Scores</span>
              {highlightedCards.has("credit_dist") && <span className="size-1.5 rounded-full bg-[#3D5A80]" />}
            </div>
            <div className="flex items-end gap-2 flex-1 min-h-[80px]">
              {stats.creditDist.map((b) => {
                const hPct = Math.max(10, (b.count / maxCredit) * 100);
                return (
                  <div key={b.key} className="flex flex-1 flex-col items-center gap-1">
                    <span className="font-mono text-[10px] font-semibold text-foreground">{b.count}</span>
                    <div className="w-full rounded-t bg-[#FF9A6D]/60 transition-all hover:bg-[#FF9A6D]/80" style={{ height: `${hPct}%`, minHeight: 8 }} />
                    <span className="font-mono text-[8px] text-muted-foreground/40">{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
