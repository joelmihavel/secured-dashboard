"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useUsers } from "@/hooks/useUsers";

export default function AnalyticsPage() {
  const { users, loading } = useUsers();

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6 px-8 h-full">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="flex gap-4 flex-1">
          <Skeleton className="flex-[2] rounded-xl" />
          <Skeleton className="flex-1 rounded-xl" />
          <div className="flex w-[280px] flex-col gap-4"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="flex-1 rounded-xl" /></div>
        </div>
      </div>
    );
  }

  const total = users.length;
  const paid = users.filter((u) => (u.successful_payments || 0) > 0).length;
  const totalRevenue = users.reduce((s, u) => s + (u.total_paid_paise || 0), 0);
  const avgRent = users.filter((u) => (u.monthly_rent_paise || 0) > 0);
  const avgRentVal = avgRent.length > 0 ? avgRent.reduce((s, u) => s + (u.monthly_rent_paise || 0), 0) / avgRent.length : 0;
  const conversionPct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const bankRate = total > 0 ? Math.round((users.filter((u) => u.bank_verified).length / total) * 100) : 0;
  const utilityRate = total > 0 ? Math.round((users.filter((u) => u.utility_verified).length / total) * 100) : 0;
  const m360Rate = total > 0 ? Math.round((users.filter((u) => u.m360_status === "SUCCESS").length / total) * 100) : 0;
  const landlordRate = total > 0 ? Math.round((users.filter((u) => u.landlord_approved).length / total) * 100) : 0;

  const cities = new Map<string, number>();
  users.forEach((u) => { const c = u.property_city || "Unknown"; cities.set(c, (cities.get(c) || 0) + 1); });
  const cityEntries = Array.from(cities.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const riskCounts = { LOW: 0, MED: 0, HIGH: 0 };
  users.forEach((u) => { const r = u.risk_level as keyof typeof riskCounts; if (r in riskCounts) riskCounts[r]++; });

  return (
    <div className="flex flex-col gap-4 p-6 px-8 h-full overflow-hidden">
      <h1 className="text-[28px] font-normal tracking-[-0.5px] text-foreground">General statistics</h1>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left — Large traffic/signup card */}
        <div className="flex flex-[2] flex-col gap-4">
          <div className="flex flex-1 flex-col justify-between rounded-xl bg-[#3D5A80] p-6">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-white/60">Traffic Source</span>
            <div>
              <span className="font-mono text-[72px] font-bold leading-none tracking-[-2px] text-white">{total.toLocaleString()}</span>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex gap-4">
            <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-4 w-[180px]">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Risk Breakdown</span>
              <div className="flex flex-col gap-1.5 mt-3">
                {(["LOW", "MED", "HIGH"] as const).map((l) => (
                  <div key={l} className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">{l === "LOW" ? "Low" : l === "MED" ? "Medium" : "High"}</span>
                    <span className={`font-mono text-[13px] font-bold ${l === "LOW" ? "text-success" : l === "MED" ? "text-warning" : "text-destructive"}`}>{riskCounts[l]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Bank Verified</span>
              <span className="font-mono text-[36px] font-bold tracking-[-1px] text-success mt-2">+{bankRate}%</span>
            </div>
            <div className="flex flex-1 flex-col rounded-xl bg-[#FF9A6D] p-4">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#0A0A0A]/50">Landlord Approved</span>
              <span className="font-mono text-[36px] font-bold tracking-[-1px] text-[#0A0A0A] mt-2">+{landlordRate}%</span>
            </div>
          </div>
        </div>

        {/* Middle — By City + M360 */}
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-4">By City</span>
            <div className="flex flex-col gap-3 flex-1">
              {cityEntries.map(([city, count]) => (
                <div key={city} className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">{city}</span>
                  <span className="font-mono text-[13px] font-medium text-foreground">{count}</span>
                </div>
              ))}
            </div>
            {cities.size > 4 && <span className="font-mono text-[11px] text-muted-foreground/40 mt-3">+{cities.size - 4} more | View all</span>}
          </div>
          <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">M360 Verification Rate</span>
            <span className="font-mono text-[36px] font-bold tracking-[-1px] text-success mt-2">+{m360Rate}%</span>
          </div>
        </div>

        {/* Right — Stat cards + conversion donut */}
        <div className="flex w-[280px] flex-shrink-0 flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Avg Rent</span>
              <span className="font-mono text-[20px] font-bold tracking-[-0.5px] text-foreground mt-1">{formatCurrency(Math.round(avgRentVal))}</span>
            </div>
            <div className="flex flex-1 flex-col rounded-xl bg-[#FF9A6D] p-4">
              <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#0A0A0A]/50">Revenue</span>
              <span className="font-mono text-[20px] font-bold tracking-[-0.5px] text-[#0A0A0A] mt-1">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Verification Rates</span>
            <div className="flex gap-6 mt-3">
              <div className="flex flex-col">
                <span className="font-mono text-[36px] font-bold tracking-[-1px] text-foreground">{bankRate}%</span>
                <span className="font-mono text-[10px] text-muted-foreground/40">bank</span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[36px] font-bold tracking-[-1px] text-foreground">{utilityRate}%</span>
                <span className="font-mono text-[10px] text-muted-foreground/40">utility</span>
              </div>
            </div>
          </div>

          {/* Conversion donut */}
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
            <div className="relative flex items-center justify-center">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="58" fill="none" stroke="#1F1F1F" strokeWidth="10" />
                <circle cx="70" cy="70" r="58" fill="none" stroke="#3D5A80" strokeWidth="10"
                  strokeDasharray={`${(conversionPct / 100) * 364} 364`}
                  strokeLinecap="round" transform="rotate(-90 70 70)" />
              </svg>
              <span className="absolute font-mono text-[32px] font-bold tracking-[-1px] text-foreground">{conversionPct}%</span>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/40 mt-3">Signup → Paid</span>
          </div>
        </div>
      </div>
    </div>
  );
}
