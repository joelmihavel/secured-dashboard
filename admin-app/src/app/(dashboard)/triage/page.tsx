"use client";

import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { callEdgeFunction } from "@/lib/supabase";
import { formatCurrencyShort, maskPhone } from "@/lib/utils";
import { computeDecision, sortByPriority } from "@/lib/decision";
import { useUsers } from "@/hooks/useUsers";
import type { UserFunnel } from "@/types/user";
import { UserDetail } from "@/components/users/user-detail";

function riskBadge(level: string | null) {
  const color = level === "HIGH" ? "text-destructive" : level === "MED" ? "text-warning" : level === "LOW" ? "text-success" : "text-muted-foreground/30";
  return <span className={`font-mono text-[11px] font-semibold ${color}`}>{level || "—"}</span>;
}

export default function TriagePage() {
  const queryClient = useQueryClient();
  const { users: rawUsers, loading } = useUsers();
  const [detailUser, setDetailUser] = useState<UserFunnel | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const allUsers = useMemo(() => {
    const queue = rawUsers.filter((u) =>
      u.user_status === "waitlisted" || u.user_status === "agreement_confirmed" ||
      u.admin_review === "due" || u.admin_review === "in_progress"
    );
    return queue.length > 0 ? queue : rawUsers;
  }, [rawUsers]);

  const invalidateUsers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }, [queryClient]);

  const users = useMemo(() => sortByPriority(allUsers), [allUsers]);

  const counts = useMemo(() => {
    const c = { BLOCKED: 0, NEEDS_REVIEW: 0, READY: 0, LOW: 0, MED: 0, HIGH: 0 };
    for (const u of allUsers) {
      c[computeDecision(u).state]++;
      const r = (u.risk_level || "PENDING") as keyof typeof c;
      if (r in c) c[r]++;
    }
    return c;
  }, [allUsers]);

  async function handleAction(userId: string, action: "approve" | "reject") {
    setActionLoading(true);
    setFeedback(null);
    try {
      await callEdgeFunction("admin-waitlist", { action, user_ids: [userId], ...(action === "reject" ? { rejection_reasons: ["Admin rejection"] } : {}) });
      setFeedback({ type: "success", message: `User ${action === "approve" ? "approved" : "rejected"}` });
      invalidateUsers();
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : `Action failed` });
    } finally {
      setActionLoading(false);
    }
  }

  async function batchAction(action: "approve" | "reject") {
    const ids = users.map((u) => u.user_id);
    if (ids.length === 0) return;
    setActionLoading(true);
    try {
      await callEdgeFunction("admin-waitlist", { action, user_ids: ids, ...(action === "reject" ? { rejection_reasons: ["Batch rejection"] } : {}) });
      setFeedback({ type: "success", message: `${ids.length} users ${action}d` });
      invalidateUsers();
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Batch failed" });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex gap-4 p-6 px-8 h-full">
        <div className="w-[280px] flex flex-col gap-4"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-10 rounded-xl" /><Skeleton className="flex-1 rounded-xl" /></div>
        <div className="flex-1 grid grid-cols-2 gap-4"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
      </div>
    );
  }

  if (detailUser) {
    return (
      <div className="flex h-full">
        <div className="flex w-[280px] flex-col border-r border-[#1F1F1F] bg-background">
          <div className="flex items-center gap-2 border-b border-[#1F1F1F] px-5 py-3">
            <button onClick={() => setDetailUser(null)} className="font-mono text-[11px] text-muted-foreground hover:text-foreground">← INBOX</button>
            <span className="font-mono text-[10px] text-muted-foreground/30 tracking-[1.5px]">{users.length} QUEUED</span>
          </div>
          <div className="flex-1 overflow-auto">
            {users.map((u) => {
              const d = computeDecision(u);
              return (
                <button key={u.user_id} onClick={() => setDetailUser(u)}
                  className={`flex w-full items-center gap-3 border-b border-[#1F1F1F]/50 px-5 py-3.5 text-left transition-colors ${u.user_id === detailUser.user_id ? "bg-primary/5 border-l-[3px] border-l-primary" : "hover:bg-muted/30"}`}>
                  <div className={`size-[6px] rounded-full ${d.state === "READY" ? "bg-success" : d.state === "NEEDS_REVIEW" ? "bg-warning" : "bg-destructive"}`} />
                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    <span className="truncate text-[13px] font-medium text-foreground">{u.name || maskPhone(u.phone)}</span>
                    <span className="font-mono text-[11px] text-muted-foreground/40">{u.property_city || "—"} · {formatCurrencyShort(u.monthly_rent_paise)}</span>
                  </div>
                  {riskBadge(u.risk_level)}
                </button>
              );
            })}
          </div>
        </div>
        <UserDetail user={detailUser} />
      </div>
    );
  }

  return (
    <div className="flex gap-4 p-6 px-8 h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="flex w-[280px] flex-shrink-0 flex-col gap-4">
        {/* Triage Queue count */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Triage Queue</span>
          <div className="mt-3">
            <span className="font-mono text-[72px] font-bold leading-none tracking-[-2px] text-foreground">{allUsers.length}</span>
          </div>
          <span className="font-mono text-[13px] uppercase tracking-[1.5px] text-muted-foreground/40 mt-1">Pending</span>
        </div>

        {/* Batch actions */}
        <div className="flex gap-2">
          <Button onClick={() => batchAction("approve")} disabled={actionLoading}
            className="flex-1 h-10 rounded-xl bg-success/10 border border-success/30 text-success font-mono text-[12px] font-semibold hover:bg-success/20">
            Batch approve
          </Button>
          <Button onClick={() => batchAction("reject")} disabled={actionLoading} variant="outline"
            className="flex-1 h-10 rounded-xl border-destructive/30 text-destructive font-mono text-[12px] hover:bg-destructive/10">
            Batch reject
          </Button>
        </div>

        {feedback && (
          <div className={`rounded-xl border px-4 py-2 font-mono text-[11px] ${feedback.type === "success" ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
            {feedback.message}
          </div>
        )}

        {/* Risk Summary */}
        <div className="flex flex-1 flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-4">Risk Summary</span>
          <div className="flex flex-col gap-2.5">
            {[
              { label: "Low risk", count: counts.LOW, color: "text-success" },
              { label: "Med risk", count: counts.MED, color: "text-warning" },
              { label: "High risk", count: counts.HIGH, color: "text-destructive" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">{r.label}</span>
                <span className={`font-mono text-[13px] font-bold ${r.color}`}>{r.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-[#1F1F1F] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Ready</span>
              <span className="font-mono text-[13px] font-bold text-success">{counts.READY}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Blocked</span>
              <span className="font-mono text-[13px] font-bold text-destructive">{counts.BLOCKED}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main area — 2-column card grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 gap-4">
          {users.map((user) => {
            const decision = computeDecision(user);
            const initials = (user.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            const score = [user.bank_verified, user.utility_verified, user.landlord_approved, user.m360_status === "SUCCESS", user.stamp_verification_status === "verified"].filter(Boolean).length;
            return (
              <div key={user.user_id}
                className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5 cursor-pointer hover:border-[#2a2a2a] transition-colors"
                onClick={() => setDetailUser(user)}>
                {/* User header */}
                <div className="flex items-start gap-3 mb-4">
                  <Avatar className="size-9 bg-secondary flex-shrink-0">
                    <AvatarFallback className="bg-secondary text-[10px] text-muted-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-foreground truncate">{user.name || maskPhone(user.phone)}</div>
                    <div className="text-[12px] text-muted-foreground/50">{user.property_city || "—"} · {formatCurrencyShort(user.monthly_rent_paise)}/mo</div>
                  </div>
                  {riskBadge(user.risk_level)}
                </div>

                {/* Score / Audit / Review row */}
                <div className="flex gap-6 mb-4">
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Score</span>
                    <span className="font-mono text-[15px] font-bold text-foreground">{score}/5</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Audit</span>
                    <span className={`font-mono text-[13px] font-semibold ${decision.state === "READY" ? "text-success" : decision.state === "BLOCKED" ? "text-destructive" : "text-warning"}`}>
                      {decision.state === "READY" ? "READY" : decision.state === "BLOCKED" ? "BLOCKED" : "REVIEW"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground/30">Review</span>
                    <span className="text-[13px] text-muted-foreground">{user.admin_review || "due"}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleAction(user.user_id, "approve")} disabled={actionLoading}
                    className="flex-1 h-9 rounded-xl border border-success/30 bg-success/5 font-mono text-[12px] text-success hover:bg-success/10 transition-colors">
                    Approve
                  </button>
                  <button onClick={() => handleAction(user.user_id, "reject")} disabled={actionLoading}
                    className="flex-1 h-9 rounded-xl border border-destructive/30 bg-destructive/5 font-mono text-[12px] text-destructive hover:bg-destructive/10 transition-colors">
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
