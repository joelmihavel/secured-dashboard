"use client";

import { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ChevronDown, X, Calendar } from "lucide-react";
import { DateRangeCalendar } from "@/components/ui/date-range-calendar";
import type { UserFunnel } from "@/types/user";

export interface OverviewFilters {
  dateFrom: string | null;
  dateTo: string | null;
  statuses: string[];
  cities: string[];
  buildings: string[];
  creditScore: "all" | "<600" | "600-700" | "700-750" | "750+";
  riskLevels: string[];
  rentRange: "all" | "<10k" | "10k-25k" | "25k-50k" | "50k+";
}

const DEFAULT_FILTERS: OverviewFilters = {
  dateFrom: null,
  dateTo: null,
  statuses: [],
  cities: [],
  buildings: [],
  creditScore: "all",
  riskLevels: [],
  rentRange: "all",
};

const STATUS_OPTIONS = ["waitlisted", "agreement_confirmed", "approved", "active", "rejected", "churned"];

const CREDIT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "<600", label: "< 600" },
  { value: "600-700", label: "600–700" },
  { value: "700-750", label: "700–750" },
  { value: "750+", label: "750+" },
] as const;

const RENT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "<10k", label: "< ₹10K" },
  { value: "10k-25k", label: "₹10K–25K" },
  { value: "25k-50k", label: "₹25K–50K" },
  { value: "50k+", label: "₹50K+" },
] as const;

const RISK_OPTIONS = ["LOW", "MED", "HIGH"];

const CITY_ALIASES: Record<string, string> = { Bengaluru: "Bangalore", bengaluru: "Bangalore" };

function extractBuilding(address: string | null): string | null {
  if (!address) return null;
  const first = address.split(",")[0]?.trim();
  if (!first || first.length < 3) return null;
  return first;
}

function parseDateBound(val: string | null, end?: boolean): Date | null {
  if (!val) return null;
  const d = new Date(val + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  if (end) d.setHours(23, 59, 59, 999);
  return d;
}

function matchesCreditScore(score: number | null, filter: OverviewFilters["creditScore"]): boolean {
  if (filter === "all") return true;
  if (score === null) return false;
  if (filter === "<600") return score < 600;
  if (filter === "600-700") return score >= 600 && score <= 700;
  if (filter === "700-750") return score > 700 && score <= 750;
  return score > 750;
}

function matchesRentRange(rentPaise: number | null, filter: OverviewFilters["rentRange"]): boolean {
  if (filter === "all") return true;
  if (rentPaise === null) return false;
  const rent = rentPaise / 100;
  if (filter === "<10k") return rent < 10000;
  if (filter === "10k-25k") return rent >= 10000 && rent <= 25000;
  if (filter === "25k-50k") return rent > 25000 && rent <= 50000;
  return rent > 50000;
}

export function useOverviewFilters(users: UserFunnel[]) {
  const [filters, setFilters] = useState<OverviewFilters>(DEFAULT_FILTERS);

  const { uniqueCities, uniqueBuildings } = useMemo(() => {
    const citySet = new Map<string, number>();
    const buildingSet = new Map<string, number>();
    users.forEach((u) => {
      const raw = u.property_city || "";
      const city = raw ? (CITY_ALIASES[raw] || raw) : "Not set";
      citySet.set(city, (citySet.get(city) || 0) + 1);

      const building = extractBuilding(u.property_address);
      if (building) buildingSet.set(building, (buildingSet.get(building) || 0) + 1);
    });
    return {
      uniqueCities: Array.from(citySet.entries()).sort((a, b) => b[1] - a[1]),
      uniqueBuildings: Array.from(buildingSet.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30),
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const from = parseDateBound(filters.dateFrom);
    const to = parseDateBound(filters.dateTo, true);
    return users.filter((u) => {
      const signedUp = new Date(u.signed_up_at);
      if (from && signedUp < from) return false;
      if (to && signedUp > to) return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes(u.user_status)) return false;
      if (filters.cities.length > 0) {
        const raw = u.property_city || "";
        const city = raw ? (CITY_ALIASES[raw] || raw) : "Not set";
        if (!filters.cities.includes(city)) return false;
      }
      if (filters.buildings.length > 0) {
        const building = extractBuilding(u.property_address);
        if (!building || !filters.buildings.includes(building)) return false;
      }
      if (!matchesCreditScore(u.m360_credit_score, filters.creditScore)) return false;
      if (filters.riskLevels.length > 0 && (!u.risk_level || !filters.riskLevels.includes(u.risk_level))) return false;
      if (!matchesRentRange(u.monthly_rent_paise, filters.rentRange)) return false;
      return true;
    });
  }, [users, filters]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.cities.length > 0) count++;
    if (filters.buildings.length > 0) count++;
    if (filters.creditScore !== "all") count++;
    if (filters.riskLevels.length > 0) count++;
    if (filters.rentRange !== "all") count++;
    return count;
  }, [filters]);

  const clearAll = useCallback(() => setFilters(DEFAULT_FILTERS), []);
  const updateFilter = useCallback(<K extends keyof OverviewFilters>(key: K, value: OverviewFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { filters, filteredUsers, activeCount, clearAll, updateFilter, uniqueCities, uniqueBuildings };
}

function FilterChip({ label, active, count, children }: {
  label: string;
  active: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
          active
            ? "border-[#3D5A80]/50 bg-[#3D5A80]/10 text-[#7BA3C9]"
            : "border-[#1F1F1F] bg-[#141414] text-muted-foreground/50 hover:text-muted-foreground/70 hover:border-[#2a2a2a]"
        )}>
          {label}
          {count !== undefined && count > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-[#3D5A80]/30 text-[9px] font-semibold text-[#7BA3C9]">{count}</span>
          )}
          <ChevronDown className="size-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-[180px] border-[#1F1F1F] bg-[#141414] p-2">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn(
      "w-full rounded-md px-3 py-1.5 text-left font-mono text-[11px] transition-colors",
      selected ? "bg-[#3D5A80]/20 text-[#7BA3C9]" : "text-muted-foreground/60 hover:bg-white/[0.04] hover:text-muted-foreground"
    )}>
      {children}
    </button>
  );
}

function CheckOption({ checked, onClick, label, count }: { checked: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button onClick={onClick} className={cn(
      "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left font-mono text-[11px] transition-colors",
      checked ? "text-foreground" : "text-muted-foreground/60 hover:bg-white/[0.04] hover:text-muted-foreground"
    )}>
      <div className={cn(
        "flex size-3.5 items-center justify-center rounded border transition-colors",
        checked ? "border-[#3D5A80] bg-[#3D5A80]" : "border-[#333]"
      )}>
        {checked && <span className="text-[8px] text-white">&#10003;</span>}
      </div>
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-muted-foreground/30">{count}</span>}
    </button>
  );
}

function SearchableCheckList({ items, selected, placeholder, onToggle }: {
  items: [string, number][];
  selected: string[];
  placeholder: string;
  onToggle: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = query
    ? items.filter(([label]) => label.toLowerCase().includes(query.toLowerCase()))
    : items;

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[#1F1F1F] bg-[#0A0A0A] px-3 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-[#3D5A80]/50"
      />
      <div className="max-h-[200px] overflow-y-auto">
        {filtered.map(([label, count]) => (
          <CheckOption key={label} checked={selected.includes(label)} label={label} count={count} onClick={() => onToggle(label)} />
        ))}
        {filtered.length === 0 && (
          <span className="block px-3 py-2 text-[11px] text-muted-foreground/30">No matches</span>
        )}
      </div>
    </div>
  );
}

function toggleInArray(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

export function FilterBar({
  filters,
  activeCount,
  clearAll,
  updateFilter,
  uniqueCities,
  uniqueBuildings,
  totalUsers,
  filteredCount,
  viewMode,
}: {
  filters: OverviewFilters;
  activeCount: number;
  clearAll: () => void;
  updateFilter: <K extends keyof OverviewFilters>(key: K, value: OverviewFilters[K]) => void;
  uniqueCities: [string, number][];
  uniqueBuildings: [string, number][];
  totalUsers: number;
  filteredCount: number;
  viewMode?: "tenants" | "landlords";
}) {
  const mode = viewMode || "tenants";
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30 mr-1">Filters</span>

      {/* Date Range */}
      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
            filters.dateFrom || filters.dateTo
              ? "border-[#3D5A80]/50 bg-[#3D5A80]/10 text-[#7BA3C9]"
              : "border-[#1F1F1F] bg-[#141414] text-muted-foreground/50 hover:text-muted-foreground/70 hover:border-[#2a2a2a]"
          )}>
            <Calendar className="size-3 opacity-60" />
            {filters.dateFrom || filters.dateTo
              ? `${filters.dateFrom || "…"} → ${filters.dateTo || "…"}`
              : "Date range"}
            <ChevronDown className="size-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto border-[#1F1F1F] bg-[#141414] p-4">
          <DateRangeCalendar
            from={filters.dateFrom}
            to={filters.dateTo}
            onChange={(from, to) => {
              updateFilter("dateFrom", from);
              updateFilter("dateTo", to);
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Status — tenants only */}
      {mode === "tenants" && (
        <FilterChip label="Status" active={filters.statuses.length > 0} count={filters.statuses.length}>
          {STATUS_OPTIONS.map((s) => (
            <CheckOption key={s} checked={filters.statuses.includes(s)} label={s.replace(/_/g, " ")}
              onClick={() => updateFilter("statuses", toggleInArray(filters.statuses, s))} />
          ))}
        </FilterChip>
      )}

      {/* Region / City */}
      <FilterChip label="Region" active={filters.cities.length > 0} count={filters.cities.length}>
        <SearchableCheckList
          items={uniqueCities}
          selected={filters.cities}
          placeholder="Search cities…"
          onToggle={(city) => updateFilter("cities", toggleInArray(filters.cities, city))}
        />
      </FilterChip>

      {/* Building */}
      <FilterChip label="Building" active={filters.buildings.length > 0} count={filters.buildings.length}>
        {uniqueBuildings.length === 0 ? (
          <span className="block px-3 py-2 text-[11px] text-muted-foreground/40">No building data</span>
        ) : (
          <SearchableCheckList
            items={uniqueBuildings}
            selected={filters.buildings}
            placeholder="Search buildings…"
            onToggle={(b) => updateFilter("buildings", toggleInArray(filters.buildings, b))}
          />
        )}
      </FilterChip>

      {/* Tenant-specific filters */}
      {mode === "tenants" && (
        <>
          <FilterChip label={CREDIT_OPTIONS.find((c) => c.value === filters.creditScore)?.label === "All" ? "Credit" : CREDIT_OPTIONS.find((c) => c.value === filters.creditScore)?.label || "Credit"} active={filters.creditScore !== "all"}>
            {CREDIT_OPTIONS.map((opt) => (
              <OptionButton key={opt.value} selected={filters.creditScore === opt.value} onClick={() => updateFilter("creditScore", opt.value)}>
                {opt.label}
              </OptionButton>
            ))}
          </FilterChip>

          <FilterChip label="Risk" active={filters.riskLevels.length > 0} count={filters.riskLevels.length}>
            {RISK_OPTIONS.map((r) => (
              <CheckOption key={r} checked={filters.riskLevels.includes(r)} label={r === "LOW" ? "Low" : r === "MED" ? "Medium" : "High"}
                onClick={() => updateFilter("riskLevels", toggleInArray(filters.riskLevels, r))} />
            ))}
          </FilterChip>

          <FilterChip label={RENT_OPTIONS.find((r) => r.value === filters.rentRange)?.label === "All" ? "Rent" : RENT_OPTIONS.find((r) => r.value === filters.rentRange)?.label || "Rent"} active={filters.rentRange !== "all"}>
            {RENT_OPTIONS.map((opt) => (
              <OptionButton key={opt.value} selected={filters.rentRange === opt.value} onClick={() => updateFilter("rentRange", opt.value)}>
                {opt.label}
              </OptionButton>
            ))}
          </FilterChip>
        </>
      )}

      {/* Clear + count */}
      {activeCount > 0 && (
        <>
          <div className="h-4 w-px bg-[#1F1F1F] mx-1" />
          <span className="font-mono text-[10px] text-muted-foreground/40">
            {filteredCount} of {totalUsers}
          </span>
          <button onClick={clearAll} className="flex items-center gap-1 rounded-lg border border-destructive/20 bg-destructive/5 px-2 py-1 font-mono text-[10px] text-destructive hover:bg-destructive/10 transition-colors">
            <X className="size-3" />
            Clear
          </button>
        </>
      )}
    </div>
  );
}
