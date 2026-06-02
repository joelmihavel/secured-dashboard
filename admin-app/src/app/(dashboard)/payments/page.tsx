"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatDate, maskPhone } from "@/lib/utils";
import { usePayments } from "@/hooks/usePayments";
import { updatePayment } from "@/lib/supabase";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { DateRangeCalendar } from "@/components/ui/date-range-calendar";
import { Search, ChevronDown, Calendar, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { PaymentDetail } from "@/types/user";
import { Tip } from "@/components/ui/tip";

function statusDot(status: string) {
  if (status === "success") return "bg-success";
  if (status === "pending") return "bg-warning";
  if (status === "failed") return "bg-destructive";
  return "bg-muted-foreground/30";
}

function statusLabel(status: string) {
  if (status === "success") return "text-success";
  if (status === "pending") return "text-warning";
  if (status === "failed") return "text-destructive";
  return "text-muted-foreground/30";
}

function settlementBadge(status: string | null) {
  if (status === "settled") return { text: "Settled", cls: "bg-success/10 text-success border-success/20" };
  if (status === "pending") return { text: "Pending", cls: "bg-warning/10 text-warning border-warning/20" };
  return { text: status || "—", cls: "bg-muted-foreground/5 text-muted-foreground/30 border-[#1F1F1F]" };
}

type SortKey = "initiated_at" | "total_amount_paise" | "user_name";
type SortDir = "asc" | "desc";

interface Filters {
  status: string[];
  method: string[];
  settlement: string[];
  cashback: "all" | "earned" | "applied" | "none";
  search: string;
  dateFrom: string | null;
  dateTo: string | null;
  month: string | null;
}

const STATUS_OPTIONS = ["success", "failed", "expired"];
const METHOD_OPTIONS = ["upi", "card", "netbanking"];
const SETTLEMENT_OPTIONS = ["settled", "pending"];
const CASHBACK_OPTIONS = [
  { value: "all", label: "All" },
  { value: "earned", label: "Earned cashback" },
  { value: "applied", label: "Used cashback" },
  { value: "none", label: "No cashback" },
] as const;

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
            : "border-[#1F1F1F] bg-[#0A0A0A] text-muted-foreground/50 hover:text-muted-foreground/70 hover:border-[#2a2a2a]"
        )}>
          {label}
          {count !== undefined && count > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-[#3D5A80]/30 text-[9px] font-semibold text-[#7BA3C9]">{count}</span>
          )}
          <ChevronDown className="size-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-[160px] border-[#1F1F1F] bg-[#141414] p-2">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function CheckOption({ checked, onClick, label, count, dotClass }: {
  checked: boolean; onClick: () => void; label: string; count?: number; dotClass?: string;
}) {
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
      {dotClass && <div className={cn("size-[6px] rounded-full", dotClass)} />}
      <span className="flex-1 capitalize">{label}</span>
      {count !== undefined && <span className="text-muted-foreground/30">{count}</span>}
    </button>
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

function toggle(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function EditableStatus({ value, options, paymentId, field, dotClass, labelClass, onUpdated }: {
  value: string;
  options: string[];
  paymentId: string;
  field: "status" | "settlement_status";
  dotClass?: (v: string) => string;
  labelClass?: (v: string) => string;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleChange(newVal: string) {
    if (newVal === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await updatePayment(paymentId, { [field]: newVal });
      onUpdated();
    } catch { /* toast could go here */ }
    finally { setSaving(false); setEditing(false); }
  }

  if (editing) {
    return (
      <select
        autoFocus
        disabled={saving}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="h-6 rounded-md border border-[#3D5A80]/50 bg-[#0A0A0A] px-1 font-mono text-[10px] text-foreground outline-none"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-left cursor-pointer hover:opacity-80 transition-opacity" title="Click to edit">
      {dotClass && <span className={cn("inline-block size-[6px] rounded-full mr-1 align-middle", dotClass(value))} />}
      <span className={cn("font-mono text-[10px] uppercase font-semibold", labelClass?.(value))}>{value}</span>
    </button>
  );
}

function formatCurrencyShort(paise: number | null | undefined): string {
  if (paise == null) return "—";
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${Math.round(rupees / 1000)}K`;
  return `₹${rupees}`;
}

export default function PaymentsPage() {
  const { payments, loading, refetch } = usePayments();
  const [filters, setFilters] = useState<Filters>({
    status: [], method: [], settlement: [], cashback: "all",
    search: "", dateFrom: null, dateTo: null, month: null,
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "initiated_at", dir: "desc" });

  const months = useMemo(() => {
    const set = new Set(payments.map((p) => p.payment_month));
    return Array.from(set).sort().reverse();
  }, [payments]);

  const filtered = useMemo(() => {
    let result = payments;

    if (filters.status.length > 0)
      result = result.filter((p) => filters.status.includes(p.payment_status));
    if (filters.method.length > 0)
      result = result.filter((p) => p.payment_method && filters.method.includes(p.payment_method));
    if (filters.settlement.length > 0)
      result = result.filter((p) => p.settlement_status && filters.settlement.includes(p.settlement_status));
    if (filters.cashback === "earned")
      result = result.filter((p) => (p.cashback_earned_paise || 0) > 0);
    else if (filters.cashback === "applied")
      result = result.filter((p) => (p.cashback_applied_paise || 0) > 0);
    else if (filters.cashback === "none")
      result = result.filter((p) => (p.cashback_earned_paise || 0) === 0 && (p.cashback_applied_paise || 0) === 0);
    if (filters.month)
      result = result.filter((p) => p.payment_month === filters.month);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((p) =>
        (p.user_name || "").toLowerCase().includes(q) ||
        (p.user_phone || "").includes(q) ||
        (p.landlord_name || "").toLowerCase().includes(q) ||
        (p.property_city || "").toLowerCase().includes(q)
      );
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom + "T00:00:00");
      result = result.filter((p) => new Date(p.initiated_at) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo + "T23:59:59.999");
      result = result.filter((p) => new Date(p.initiated_at) <= to);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "initiated_at") cmp = a.initiated_at.localeCompare(b.initiated_at);
      else if (sort.key === "total_amount_paise") cmp = (a.total_amount_paise || 0) - (b.total_amount_paise || 0);
      else if (sort.key === "user_name") cmp = (a.user_name || "").localeCompare(b.user_name || "");
      return sort.dir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [payments, filters, sort]);

  const stats = useMemo(() => {
    const success = filtered.filter((p) => p.payment_status === "success");
    const failed = filtered.filter((p) => p.payment_status === "failed");
    const totalCollected = success.reduce((s, p) => s + (p.total_amount_paise || 0), 0);
    const totalCashbackEarned = success.reduce((s, p) => s + (p.cashback_earned_paise || 0), 0);
    const totalCashbackApplied = success.reduce((s, p) => s + (p.cashback_applied_paise || 0), 0);
    const avgRent = success.length > 0
      ? Math.round(success.reduce((s, p) => s + (p.rent_amount_paise || 0), 0) / success.length)
      : 0;
    const methodCounts = { upi: 0, card: 0, netbanking: 0 } as Record<string, number>;
    filtered.forEach((p) => { if (p.payment_method) methodCounts[p.payment_method] = (methodCounts[p.payment_method] || 0) + 1; });
    const settlementCounts = { settled: 0, pending: 0 } as Record<string, number>;
    filtered.forEach((p) => { if (p.settlement_status) settlementCounts[p.settlement_status] = (settlementCounts[p.settlement_status] || 0) + 1; });
    const successRate = filtered.length > 0 ? Math.round((success.length / filtered.length) * 100) : 0;

    return { success: success.length, failed: failed.length, total: filtered.length, totalCollected, totalCashbackEarned, totalCashbackApplied, avgRent, methodCounts, settlementCounts, successRate };
  }, [filtered]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.status.length > 0) c++;
    if (filters.method.length > 0) c++;
    if (filters.settlement.length > 0) c++;
    if (filters.cashback !== "all") c++;
    if (filters.month) c++;
    if (filters.dateFrom || filters.dateTo) c++;
    return c;
  }, [filters]);

  function toggleSort(key: SortKey) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <ArrowUpDown className="size-3 opacity-30" />;
    return sort.dir === "asc" ? <ArrowUp className="size-3 text-[#7BA3C9]" /> : <ArrowDown className="size-3 text-[#7BA3C9]" />;
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6 px-8 h-full">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="flex gap-4 flex-1">
          <Skeleton className="w-[340px] rounded-xl" />
          <Skeleton className="flex-1 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 px-8 h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30 mr-1">Filters</span>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/30" />
          <input
            type="text"
            placeholder="Search tenant, landlord, city…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="h-[30px] w-[200px] rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] pl-7 pr-3 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-[#3D5A80]/50"
          />
        </div>

        {/* Date range */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
              filters.dateFrom || filters.dateTo
                ? "border-[#3D5A80]/50 bg-[#3D5A80]/10 text-[#7BA3C9]"
                : "border-[#1F1F1F] bg-[#0A0A0A] text-muted-foreground/50 hover:text-muted-foreground/70 hover:border-[#2a2a2a]"
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
              onChange={(from, to) => setFilters((f) => ({ ...f, dateFrom: from, dateTo: to }))}
            />
          </PopoverContent>
        </Popover>

        {/* Month */}
        <FilterChip label={filters.month ? filters.month.slice(0, 7) : "Month"} active={!!filters.month}>
          <OptionButton selected={!filters.month} onClick={() => setFilters((f) => ({ ...f, month: null }))}>
            All months
          </OptionButton>
          {months.map((m) => (
            <OptionButton key={m} selected={filters.month === m} onClick={() => setFilters((f) => ({ ...f, month: m }))}>
              {m.slice(0, 7)}
            </OptionButton>
          ))}
        </FilterChip>

        {/* Status */}
        <FilterChip label="Status" active={filters.status.length > 0} count={filters.status.length}>
          {STATUS_OPTIONS.map((s) => (
            <CheckOption key={s} checked={filters.status.includes(s)} label={s}
              dotClass={statusDot(s)}
              count={payments.filter((p) => p.payment_status === s).length}
              onClick={() => setFilters((f) => ({ ...f, status: toggle(f.status, s) }))} />
          ))}
        </FilterChip>

        {/* Method */}
        <FilterChip label="Method" active={filters.method.length > 0} count={filters.method.length}>
          {METHOD_OPTIONS.map((m) => (
            <CheckOption key={m} checked={filters.method.includes(m)} label={m}
              count={payments.filter((p) => p.payment_method === m).length}
              onClick={() => setFilters((f) => ({ ...f, method: toggle(f.method, m) }))} />
          ))}
        </FilterChip>

        {/* Settlement */}
        <FilterChip label="Settlement" active={filters.settlement.length > 0} count={filters.settlement.length}>
          {SETTLEMENT_OPTIONS.map((s) => (
            <CheckOption key={s} checked={filters.settlement.includes(s)} label={s}
              count={payments.filter((p) => p.settlement_status === s).length}
              onClick={() => setFilters((f) => ({ ...f, settlement: toggle(f.settlement, s) }))} />
          ))}
        </FilterChip>

        {/* Cashback */}
        <FilterChip label={CASHBACK_OPTIONS.find((c) => c.value === filters.cashback)?.label === "All" ? "Cashback" : CASHBACK_OPTIONS.find((c) => c.value === filters.cashback)?.label || "Cashback"} active={filters.cashback !== "all"}>
          {CASHBACK_OPTIONS.map((opt) => (
            <OptionButton key={opt.value} selected={filters.cashback === opt.value} onClick={() => setFilters((f) => ({ ...f, cashback: opt.value }))}>
              {opt.label}
            </OptionButton>
          ))}
        </FilterChip>

        {activeFilterCount > 0 && (
          <>
            <div className="h-4 w-px bg-[#1F1F1F] mx-1" />
            <span className="font-mono text-[10px] text-muted-foreground/40">{filtered.length} of {payments.length}</span>
            <button onClick={() => setFilters({ status: [], method: [], settlement: [], cashback: "all", search: "", dateFrom: null, dateTo: null, month: null })}
              className="flex items-center gap-1 rounded-lg border border-destructive/20 bg-destructive/5 px-2 py-1 font-mono text-[10px] text-destructive hover:bg-destructive/10 transition-colors">
              <X className="size-3" /> Clear
            </button>
          </>
        )}
      </div>

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left — Stats */}
        <div className="flex w-[300px] flex-shrink-0 flex-col gap-3">
          {/* Hero */}
          <div className="flex flex-col justify-between rounded-xl bg-[#3D5A80] p-5 gap-4">
            <Tip text="Sum of all successful payment amounts processed through the app"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-white/60">Total Collected</span></Tip>
            <div>
              <span className="font-mono text-[40px] font-bold leading-none tracking-[-2px] text-white">{formatCurrency(stats.totalCollected)}</span>
              <div className="font-mono text-[11px] text-white/40 mt-2 uppercase tracking-[1px]">
                {stats.success} success / {stats.total} total
              </div>
            </div>
          </div>

          {/* Success rate */}
          <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
            <div className="flex items-center justify-between mb-2">
              <Tip text="Percentage of payment attempts that completed successfully"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Success Rate</span></Tip>
              <span className="font-mono text-[20px] font-bold tracking-[-0.5px] text-foreground">{stats.successRate}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#1F1F1F] overflow-hidden">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${stats.successRate}%` }} />
            </div>
            <div className="flex justify-between mt-2">
              <span className="font-mono text-[10px] text-success">{stats.success} success</span>
              <span className="font-mono text-[10px] text-destructive">{stats.failed} failed</span>
            </div>
          </div>

          {/* Payment methods */}
          <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
            <Tip text="Breakdown of payment methods used — UPI, card, or netbanking"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30 mb-3 block">Methods</span></Tip>
            {METHOD_OPTIONS.map((m) => {
              const count = stats.methodCounts[m] || 0;
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={m} className="flex items-center gap-2 py-1">
                  <span className="font-mono text-[11px] text-muted-foreground/60 w-[80px] uppercase">{m}</span>
                  <div className="flex-1 h-1 rounded-full bg-[#1F1F1F] overflow-hidden">
                    <div className="h-full rounded-full bg-[#3D5A80]/60 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground/40 w-[40px] text-right">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Cashback & Settlement */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#FF9A6D]/10 border border-[#FF9A6D]/20 p-3">
              <Tip text="Cashback already applied as discounts on tenant rent payments — the actual cost to Secured"><span className="font-mono text-[8px] uppercase tracking-[1px] text-[#FF9A6D]/60 block">CB Disbursed</span></Tip>
              <span className="font-mono text-[16px] font-bold text-[#FF9A6D] mt-1 block">{formatCurrencyShort(stats.totalCashbackApplied)}</span>
            </div>
            <div className="rounded-xl bg-[#FF9A6D]/10 border border-[#FF9A6D]/20 p-3">
              <Tip text="Cashback earned by tenants on recent payments, not yet redeemed — future liability"><span className="font-mono text-[8px] uppercase tracking-[1px] text-[#FF9A6D]/60 block">CB Accrued</span></Tip>
              <span className="font-mono text-[16px] font-bold text-[#FF9A6D] mt-1 block">{formatCurrencyShort(stats.totalCashbackEarned)}</span>
            </div>
          </div>

          {/* Settlement */}
          <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
            <Tip text="Whether collected rent has been transferred to the landlord's bank account"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30 mb-2 block">Settlement</span></Tip>
            <div className="flex gap-3">
              <div className="flex-1">
                <span className="font-mono text-[18px] font-bold text-success block">{stats.settlementCounts["settled"] || 0}</span>
                <span className="font-mono text-[9px] text-muted-foreground/30 uppercase">Settled</span>
              </div>
              <div className="w-px bg-[#1F1F1F]" />
              <div className="flex-1">
                <span className="font-mono text-[18px] font-bold text-warning block">{stats.settlementCounts["pending"] || 0}</span>
                <span className="font-mono text-[9px] text-muted-foreground/30 uppercase">Pending</span>
              </div>
            </div>
          </div>

          {/* Avg rent */}
          <div className="rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
            <Tip text="Average rent amount across successful payments"><span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Avg Rent</span></Tip>
            <span className="font-mono text-[20px] font-bold tracking-[-0.5px] text-foreground mt-1 block">{formatCurrency(stats.avgRent)}</span>
          </div>
        </div>

        {/* Right — Transaction table */}
        <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] overflow-hidden">
          {/* Table header */}
          <div className="flex items-center px-5 py-2.5 border-b border-[#1F1F1F] bg-[#0A0A0A]/50 gap-3">
            <div className="w-[6px]" />
            <button onClick={() => toggleSort("user_name")} className="flex items-center gap-1 w-[150px] font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              Tenant <SortIcon col="user_name" />
            </button>
            <Tip text="Landlord receiving this rent payment"><span className="w-[110px] font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground/40">Landlord</span></Tip>
            <Tip text="The rent month this payment covers"><span className="w-[70px] font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground/40">Month</span></Tip>
            <Tip text="UPI, card, or netbanking"><span className="w-[50px] font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground/40">Method</span></Tip>
            <Tip text="Payment gateway result — success, failed, or expired"><span className="w-[60px] font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground/40">Status</span></Tip>
            <Tip text="Whether funds have been settled to landlord's account"><span className="w-[65px] font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground/40">Settle</span></Tip>
            <div className="flex-1" />
            <Tip text="+ = cashback earned on this payment, − = cashback redeemed as discount"><span className="w-[60px] font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground/40 text-right">Cashback</span></Tip>
            <button onClick={() => toggleSort("total_amount_paise")} className="flex items-center justify-end gap-1 w-[90px] font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              Amount <SortIcon col="total_amount_paise" />
            </button>
            <button onClick={() => toggleSort("initiated_at")} className="flex items-center justify-end gap-1 w-[70px] font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              Date <SortIcon col="initiated_at" />
            </button>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[13px] text-muted-foreground/40">No payments found</div>
            ) : (
              filtered.map((p) => {
                const settle = settlementBadge(p.settlement_status);
                const cbEarned = p.cashback_earned_paise || 0;
                const cbApplied = p.cashback_applied_paise || 0;
                return (
                  <div key={p.payment_id} className="flex items-center gap-3 px-5 py-3 border-b border-[#1F1F1F]/30 hover:bg-white/[0.02] transition-colors">
                    <div className={cn("size-[6px] flex-shrink-0 rounded-full", statusDot(p.payment_status))} />
                    <div className="w-[150px] flex items-center gap-2 min-w-0">
                      <UserAvatar name={p.user_name || p.user_phone} size={24} />
                      <span className="text-[12px] font-medium text-foreground truncate">{p.user_name || maskPhone(p.user_phone)}</span>
                    </div>
                    <span className="w-[110px] text-[11px] text-muted-foreground/40 truncate">{p.landlord_name || "—"}</span>
                    <span className="w-[70px] font-mono text-[11px] text-muted-foreground/50">{p.payment_month?.slice(0, 7)}</span>
                    <span className="w-[50px] font-mono text-[10px] uppercase text-muted-foreground/40">{p.payment_method || "—"}</span>
                    <span className="w-[60px]">
                      <EditableStatus value={p.payment_status} options={["initiated", "processing", "success", "failed", "refunded"]}
                        paymentId={p.payment_id} field="status" labelClass={statusLabel} onUpdated={refetch} />
                    </span>
                    <span className="w-[65px]">
                      <EditableStatus value={p.settlement_status || "pending"} options={["pending", "processing", "settled", "failed"]}
                        paymentId={p.payment_id} field="settlement_status"
                        labelClass={(s) => s === "settled" ? "text-success" : s === "pending" ? "text-warning" : "text-muted-foreground/40"}
                        onUpdated={refetch} />
                    </span>
                    <div className="flex-1" />
                    <div className="w-[60px] text-right">
                      {cbEarned > 0 ? (
                        <span className="font-mono text-[10px] text-[#FF9A6D]">+{formatCurrency(cbEarned)}</span>
                      ) : cbApplied > 0 ? (
                        <span className="font-mono text-[10px] text-[#FF9A6D]/60">-{formatCurrency(cbApplied)}</span>
                      ) : (
                        <span className="font-mono text-[10px] text-muted-foreground/20">—</span>
                      )}
                    </div>
                    <span className="w-[90px] font-mono text-[12px] font-semibold text-foreground text-right">{formatCurrency(p.total_amount_paise)}</span>
                    <span className="w-[70px] text-right font-mono text-[10px] text-muted-foreground/40">{formatDate(p.initiated_at)}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#1F1F1F] px-5 py-2 bg-[#0A0A0A]/50">
            <span className="font-mono text-[10px] text-muted-foreground/40">{filtered.length} payments</span>
            <span className="font-mono text-[10px] text-muted-foreground/40">
              Collected: {formatCurrency(stats.totalCollected)} · CB Disbursed: {formatCurrency(stats.totalCashbackApplied)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
