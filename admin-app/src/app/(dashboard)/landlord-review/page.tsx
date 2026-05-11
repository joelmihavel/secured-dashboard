"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchLandlordReviewQueue,
  updateTenancyLandlord,
  type LandlordReviewQueueItem,
} from "@/lib/supabase";
import { maskPhone } from "@/lib/utils";

function GatePill({
  label,
  passed,
  value,
}: {
  label: string;
  passed: boolean;
  value: string | null;
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2 ${
        passed
          ? "border-success/30 bg-success/5"
          : "border-destructive/30 bg-destructive/5"
      }`}
    >
      <span
        className={`font-mono text-[9px] uppercase tracking-[1.5px] ${
          passed ? "text-success" : "text-destructive"
        }`}
      >
        {label} {passed ? "✓" : "✗"}
      </span>
      <span className="text-[12px] text-foreground/80 truncate max-w-[14rem]">
        {value || "—"}
      </span>
    </div>
  );
}

export default function LandlordReviewPage() {
  const [queue, setQueue] = useState<LandlordReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchLandlordReviewQueue();
      setQueue(data);
    } catch (err) {
      console.error("Failed to load landlord review queue:", err);
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to load queue",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handle(
    item: LandlordReviewQueueItem,
    action: "promote" | "decline",
  ) {
    if (action === "decline" && !confirm(`Decline ${item.tenant_name ?? "this user"}'s landlord verification?`)) {
      return;
    }
    setActionId(item.tenancy_id);
    setFeedback(null);
    try {
      await updateTenancyLandlord(item.tenancy_id, action);
      setFeedback({
        type: "success",
        message: `${item.tenant_name ?? "Tenancy"} ${action === "promote" ? "promoted to verified" : "declined"}`,
      });
      setQueue((prev) => prev.filter((q) => q.tenancy_id !== item.tenancy_id));
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : `Failed to ${action}`,
      });
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 px-8 py-6">
        <Skeleton className="h-8 w-72 rounded-lg" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-8 py-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/50">
          Operations
        </span>
        <div className="flex items-baseline gap-3">
          <h1 className="text-[28px] font-normal tracking-[-0.5px] text-foreground">
            Landlord Pipeline
          </h1>
          <span className="font-mono text-[13px] text-muted-foreground">
            {queue.length} pending
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground/80 max-w-3xl">
          Tenancies where 2 of 3 verification gates passed (M360, bank
          name-match, SHCIL e-stamp) but the third is missing or ambiguous.
          Review the gate breakdown, then promote to verified or decline.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-2 text-[13px] ${
            feedback.type === "success"
              ? "border-success/30 bg-success/5 text-success"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {queue.length === 0 ? (
        <Card className="rounded-xl border-border bg-card">
          <CardContent className="flex items-center justify-center py-16 text-[13px] text-muted-foreground/60">
            No tenancies pending landlord review
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {queue.map((item) => {
            const isActing = actionId === item.tenancy_id;
            return (
              <Card key={item.tenancy_id} className="rounded-xl border-border bg-card">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-medium text-foreground">
                        {item.tenant_name || maskPhone(item.tenant_phone)}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        Landlord:{" "}
                        <span className="text-foreground/80">
                          {item.landlord_name || "—"}
                        </span>
                        {item.landlord_phone && (
                          <span className="text-muted-foreground/60">
                            {" · "}
                            {maskPhone(item.landlord_phone, item.landlord_country_code)}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/40">
                        {item.tenancy_id}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-9 rounded-lg bg-success text-success-foreground font-mono text-[11px] font-semibold"
                        onClick={() => handle(item, "promote")}
                        disabled={isActing}
                      >
                        {isActing ? "..." : "Promote to verified"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-lg border-destructive/40 text-destructive font-mono text-[11px]"
                        onClick={() => handle(item, "decline")}
                        disabled={isActing}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <GatePill
                      label="M360"
                      passed={item.gates.m360.passed}
                      value={item.gates.m360.value}
                    />
                    <GatePill
                      label="Bank (penny drop)"
                      passed={item.gates.bank.passed}
                      value={
                        item.gates.bank.value
                          ? `${item.gates.bank.value}${
                              item.gates.bank.verified ? "" : " (unverified)"
                            }${
                              item.gates.bank.name_matched
                                ? ""
                                : " (name mismatch)"
                            }`
                          : null
                      }
                    />
                    <GatePill
                      label="SHCIL stamp"
                      passed={item.gates.stamp.passed}
                      value={item.gates.stamp.value}
                    />
                  </div>

                  {item.landlord_names && item.landlord_names.length > 0 && (
                    <div className="text-[11px] text-muted-foreground/70">
                      Agreement landlord names:{" "}
                      <span className="text-foreground/80 font-mono text-[10px]">
                        {item.landlord_names.join(", ")}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
