"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchView } from "@/lib/supabase";
import { formatCurrency, formatDate, maskPhone } from "@/lib/utils";
import type { PaymentDetail } from "@/types/user";

function statusBadge(status: string) {
  switch (status) {
    case "success": return <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[11px]">success</Badge>;
    case "pending": return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[11px]">pending</Badge>;
    case "failed": return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[11px]">failed</Badge>;
    case "refunded": return <Badge variant="outline" className="bg-muted text-muted-foreground text-[11px]">refunded</Badge>;
    default: return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
  }
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchView<PaymentDetail>("v_payment_detail", {
          order: { column: "initiated_at", ascending: false },
          limit: 50,
        });
        setPayments(data);
      } catch (err) {
        console.error("Failed to load payments:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalCollected = payments.filter(p => p.payment_status === "success").reduce((s, p) => s + (p.total_amount_paise || 0), 0);
  const failedCount = payments.filter(p => p.payment_status === "failed").length;

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <div className="flex gap-2.5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 flex-1 rounded-lg" />)}</div>
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <h1 className="text-lg font-semibold text-foreground">Payments</h1>

      <div className="flex gap-3">
        <Card className="flex-1 border-border bg-card">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground/60">Total Collected</span>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalCollected)}</div>
          </CardContent>
        </Card>
        <Card className="flex-1 border-border bg-card">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground/60">Transactions</span>
            <div className="text-2xl font-bold text-foreground">{payments.length}</div>
          </CardContent>
        </Card>
        <Card className={`flex-1 border-border bg-card ${failedCount > 0 ? "border-destructive/20" : ""}`}>
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground/60">Failed</span>
            <div className={`text-2xl font-bold ${failedCount > 0 ? "text-destructive" : "text-foreground"}`}>{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <div className="flex items-center border-b border-border bg-muted/50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            <span className="w-[110px]">Phone</span>
            <span className="w-[120px]">Name</span>
            <span className="w-[80px]">Month</span>
            <span className="w-[80px]">Status</span>
            <span className="w-[70px]">Method</span>
            <span className="w-[90px] text-right">Rent</span>
            <span className="w-[90px] text-right">Total</span>
            <span className="w-[80px] text-right">PG Fee</span>
            <span className="flex-1 text-right">Paid At</span>
          </div>
          {payments.map((p) => (
            <div key={p.payment_id} className="flex items-center border-b border-border/30 px-5 py-3 text-[13px] hover:bg-muted/20 transition-colors cursor-pointer">
              <span className="w-[110px] text-muted-foreground">{maskPhone(p.user_phone)}</span>
              <span className="w-[120px] font-medium text-foreground truncate">{p.user_name || "\u2014"}</span>
              <span className="w-[80px] text-muted-foreground">{p.payment_month}</span>
              <span className="w-[80px]">{statusBadge(p.payment_status)}</span>
              <span className="w-[70px] text-muted-foreground">{p.payment_method || "\u2014"}</span>
              <span className="w-[90px] text-right font-mono text-muted-foreground">{formatCurrency(p.rent_amount_paise)}</span>
              <span className="w-[90px] text-right font-mono font-medium text-foreground">{formatCurrency(p.total_amount_paise)}</span>
              <span className="w-[80px] text-right font-mono text-muted-foreground/60">{formatCurrency(p.pg_fee_paise)}</span>
              <span className="flex-1 text-right text-muted-foreground/60">{formatDate(p.paid_at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
