"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchView, callEdgeFunction } from "@/lib/supabase";
import { formatCurrencyShort, maskPhone } from "@/lib/utils";
import type { UserFunnel } from "@/types/user";
import { ApprovalPreflight } from "@/components/users/approval-preflight";

function riskBadge(level: string | null) {
  switch (level) {
    case "LOW": return <span className="text-xs text-success">LOW</span>;
    case "MED": return <span className="text-xs text-warning">MED</span>;
    case "HIGH": return <span className="text-xs text-destructive">HIGH</span>;
    default: return <span className="text-xs text-muted-foreground/40">{"\u2014"}</span>;
  }
}

function verificationScore(user: UserFunnel) {
  return (
    (user.bank_verified ? 1 : 0) +
    (user.utility_verified ? 1 : 0) +
    (user.landlord_approved ? 1 : 0) +
    (user.m360_status === "SUCCESS" ? 1 : 0) +
    (user.extraction_status === "completed" ? 1 : 0)
  );
}

function auditStatus(user: UserFunnel): { label: string; color: string } {
  const missing: string[] = [];
  if (user.extraction_status !== "completed") missing.push("Agreement");
  if (!user.property_address) missing.push("Address");
  if (!user.landlord_name && !user.landlord_display_name) missing.push("Landlord");
  if (!user.monthly_rent_paise || user.monthly_rent_paise <= 0) missing.push("Rent");
  if (!user.lease_start_date) missing.push("Lease");
  return missing.length === 0
    ? { label: "READY", color: "text-success bg-success/10" }
    : { label: "BLOCKED", color: "text-destructive bg-destructive/10" };
}

export default function TriagePage() {
  const [users, setUsers] = useState<UserFunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preflightUser, setPreflightUser] = useState<UserFunnel | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    try {
      const data = await fetchView<UserFunnel>("v_user_funnel", {
        order: { column: "signed_up_at", ascending: false },
      });
      const filtered = data.filter(
        (u) =>
          u.user_status === "waitlisted" ||
          u.user_status === "agreement_confirmed" ||
          u.admin_review === "due" ||
          u.admin_review === "in_progress"
      );
      setUsers(filtered.length > 0 ? filtered : data);
    } catch (err) {
      console.error("Failed to load triage queue:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.user_id)));
  }

  async function batchAction(action: "approve" | "reject", userIds?: string[]) {
    const ids = userIds || Array.from(selected);
    if (ids.length === 0) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await callEdgeFunction("admin-waitlist", {
        action,
        user_ids: ids,
        admin_key: process.env.NEXT_PUBLIC_ADMIN_KEY || "",
        ...(action === "reject" ? { rejection_reasons: ["Admin rejection"] } : {}),
      });
      setFeedback({
        type: "success",
        message: `${ids.length} user${ids.length > 1 ? "s" : ""} ${action === "approve" ? "approved" : "rejected"}`,
      });
      setSelected(new Set());
      loadQueue();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : `Batch ${action} failed`,
      });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <Skeleton className="h-8 w-48 rounded" />
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">Triage Queue</h1>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
            {users.length} pending
          </Badge>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button size="sm" className="h-9 bg-success text-success-foreground text-xs font-semibold" onClick={() => batchAction("approve")} disabled={actionLoading}>
              Batch approve
            </Button>
            <Button size="sm" variant="outline" className="h-9 border-destructive/40 text-destructive text-xs" onClick={() => batchAction("reject")} disabled={actionLoading}>
              Batch reject
            </Button>
            <Button size="sm" variant="ghost" className="h-9 text-xs text-muted-foreground" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {feedback && (
        <div className={`rounded-md border px-4 py-2 text-sm ${feedback.type === "success" ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
          {feedback.message}
        </div>
      )}

      {preflightUser && (
        <ApprovalPreflight
          user={preflightUser}
          onConfirmApprove={async () => {
            await batchAction("approve", [preflightUser.user_id]);
            setPreflightUser(null);
          }}
          onCancel={() => setPreflightUser(null)}
          loading={actionLoading}
        />
      )}

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <div className="flex items-center border-b border-border bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            <div className="w-8">
              <button onClick={toggleAll} className="flex size-4.5 items-center justify-center rounded border border-border text-[10px] hover:bg-muted">
                {selected.size === users.length && users.length > 0 ? "\u2713" : ""}
              </button>
            </div>
            <span className="flex-1">User</span>
            <span className="w-20 text-right">Rent</span>
            <span className="w-14 text-center">Risk</span>
            <span className="w-12 text-center">Score</span>
            <span className="w-20 text-center">Audit</span>
            <span className="w-24 text-center">Review</span>
            <span className="w-24 text-right">Actions</span>
          </div>

          {users.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground/40">
              No users pending triage
            </div>
          ) : (
            users.map((user) => {
              const vs = verificationScore(user);
              const audit = auditStatus(user);
              const isSelected = selected.has(user.user_id);
              return (
                <div key={user.user_id} className={`flex items-center border-b border-border/30 px-5 py-3 text-[13px] transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                  <div className="w-8">
                    <button onClick={() => toggleSelect(user.user_id)} className={`flex size-4.5 items-center justify-center rounded border text-[10px] ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
                      {isSelected ? "\u2713" : ""}
                    </button>
                  </div>
                  <div className="flex flex-1 items-center gap-2 overflow-hidden">
                    <span className="truncate text-sm font-medium text-foreground">{user.name || maskPhone(user.phone)}</span>
                    <span className="text-muted-foreground/40 truncate text-[13px]">{user.property_city || ""}</span>
                  </div>
                  <span className="w-20 text-right text-[13px] text-muted-foreground">{formatCurrencyShort(user.monthly_rent_paise)}</span>
                  <div className="w-14 text-center">{riskBadge(user.risk_level)}</div>
                  <span className={`w-12 text-center text-xs font-medium ${vs >= 4 ? "text-success" : vs >= 2 ? "text-warning" : "text-destructive"}`}>{vs}/5</span>
                  <div className="w-20 flex justify-center">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${audit.color}`}>{audit.label}</span>
                  </div>
                  <div className="w-24 flex justify-center">
                    <Badge variant="outline" className="text-[11px]">{user.admin_review || "due"}</Badge>
                  </div>
                  <div className="w-24 flex justify-end gap-1.5">
                    <button onClick={() => setPreflightUser(user)} className="rounded bg-success/10 px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success/20 transition-colors">{"\u2713"}</button>
                    <button onClick={() => batchAction("reject", [user.user_id])} className="rounded bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors">{"\u2717"}</button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
