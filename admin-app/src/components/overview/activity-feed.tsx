"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatRelativeTime, maskPhone } from "@/lib/utils";
import type { PaymentDetail } from "@/types/user";

export function PaymentsFeed({
  payments,
  filteredUserIds,
  isFiltered,
}: {
  payments: PaymentDetail[];
  filteredUserIds: Set<string>;
  isFiltered: boolean;
}) {
  const paidPayments = useMemo(() =>
    payments.filter((p) => p.paid_at).slice(0, 30),
    [payments]
  );

  return (
    <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5 min-h-0 overflow-hidden">
      <Link href="/payments" className="flex items-center justify-between mb-3 group">
        <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] group-hover:text-muted-foreground/60 transition-colors">Payments</span>
        <span className="font-mono text-[10px] text-transparent group-hover:text-muted-foreground/40 transition-colors">&rarr;</span>
      </Link>

      <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0">
        {paidPayments.map((p) => {
          const name = p.user_name || maskPhone(p.user_phone);
          const amount = p.total_amount_paise ? `₹${Math.round(p.total_amount_paise / 100).toLocaleString()}` : null;
          const dimmed = isFiltered && !filteredUserIds.has(p.user_phone);
          return (
            <div key={p.payment_id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-2 -mx-2 transition-all hover:bg-white/[0.03]",
                dimmed && "opacity-25"
              )}>
              <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-md border border-[#FF9A6D]/30 bg-[#FF9A6D]/10 text-[11px] font-medium text-[#FF9A6D]">
                ₹
              </div>
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-[12px] text-foreground leading-tight truncate">{name}</span>
                <span className="font-mono text-[10px] text-muted-foreground/30 truncate">
                  {p.property_city || p.payment_method || "Rent"}{p.paid_at ? ` · ${formatRelativeTime(p.paid_at)}` : ""}
                </span>
              </div>
              {amount && (
                <span className="font-mono text-[12px] font-semibold text-[#FF9A6D] flex-shrink-0">{amount}</span>
              )}
            </div>
          );
        })}
        {paidPayments.length === 0 && (
          <span className="text-[12px] text-muted-foreground/30 px-2 py-4">No payments yet</span>
        )}
      </div>
    </div>
  );
}
