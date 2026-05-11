"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, maskPhone } from "@/lib/utils";
import { usePayments } from "@/hooks/usePayments";

function statusDot(status: string) {
  if (status === "success") return "bg-success";
  if (status === "pending") return "bg-warning";
  if (status === "failed") return "bg-destructive";
  return "bg-muted-foreground/30";
}

export default function PaymentsPage() {
  const { payments, loading } = usePayments();

  const successPayments = payments.filter((p) => p.payment_status === "success");
  const totalCollected = successPayments.reduce((s, p) => s + (p.total_amount_paise || 0), 0);
  const failedCount = payments.filter((p) => p.payment_status === "failed").length;
  const avgPgFee = successPayments.length > 0
    ? Math.round(successPayments.reduce((s, p) => s + (p.pg_fee_paise || 0), 0) / successPayments.length)
    : 0;
  const totalCashback = payments.reduce((s, p) => s + ((p as unknown as Record<string, unknown>).cashback_paise as number || 0), 0);

  if (loading) {
    return (
      <div className="flex gap-4 p-6 px-8 h-full">
        <Skeleton className="w-[340px] rounded-xl" />
        <Skeleton className="flex-1 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 p-6 px-8 h-full overflow-hidden">
      {/* Left — Total Collected hero card */}
      <div className="flex w-[340px] flex-shrink-0 flex-col gap-4">
        <div className="flex flex-1 flex-col justify-between rounded-xl bg-[#3D5A80] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-white/60">Total Collected</span>
          <div>
            <span className="font-mono text-[56px] font-bold leading-none tracking-[-2px] text-white">{formatCurrency(totalCollected)}</span>
            <div className="font-mono text-[12px] text-white/40 mt-2 uppercase tracking-[1.5px]">
              {successPayments.length} Success / {payments.length} Total
            </div>
          </div>
        </div>

        {/* Bottom stat cards */}
        <div className="flex gap-4">
          <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-4">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Avg PG Fee</span>
            <span className="font-mono text-[24px] font-bold tracking-[-1px] text-foreground mt-1">{formatCurrency(avgPgFee)}</span>
          </div>
          <div className="flex flex-1 flex-col rounded-xl bg-[#FF9A6D] p-4">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#0A0A0A]/50">Cashback</span>
            <span className="font-mono text-[24px] font-bold tracking-[-1px] text-[#0A0A0A] mt-1">{formatCurrency(totalCashback) || "₹0"}</span>
          </div>
        </div>
      </div>

      {/* Right — Transaction list */}
      <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1F1F1F]">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Recent Transactions</span>
          <span className="font-mono text-[11px] text-muted-foreground/40">{payments.length} total</span>
        </div>
        <div className="flex-1 overflow-auto">
          {payments.map((p) => (
            <div key={p.payment_id} className="flex items-center gap-3 px-5 py-3.5 border-b border-[#1F1F1F]/30 hover:bg-white/[0.02] transition-colors">
              <div className={`size-[6px] flex-shrink-0 rounded-full ${statusDot(p.payment_status)}`} />
              <span className="w-[140px] text-[13px] font-medium text-foreground truncate">{p.user_name || "—"}</span>
              <span className="w-[80px] font-mono text-[12px] text-muted-foreground/50">{p.payment_month}</span>
              <span className="w-[40px] font-mono text-[11px] uppercase text-muted-foreground/30">{p.payment_method || "—"}</span>
              <div className="flex-1" />
              <span className="font-mono text-[13px] font-semibold text-foreground">{formatCurrency(p.total_amount_paise)}</span>
              <span className="w-[60px] text-right text-[11px] text-muted-foreground/40">{formatDate(p.paid_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
