"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { fetchView, callEdgeFunction } from "@/lib/supabase";
import { formatRelativeTime, maskPhone } from "@/lib/utils";
import type { UserFunnel } from "@/types/user";

type NotificationType =
  | "onboarding_dropoff"
  | "setup_incomplete"
  | "reminder_agreement"
  | "under_review"
  | "landlord_pending"
  | "rent_due"
  | "rent_overdue"
  | "payment_failed";

interface QuickAction {
  type: NotificationType;
  label: string;
  description: string;
}

interface NotificationRow {
  id: string;
  notification_type: string;
  status: string;
  payload: Record<string, unknown>;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
}

const ALL_QUICK_ACTIONS: QuickAction[] = [
  { type: "onboarding_dropoff", label: "Complete Signup", description: "Nudge to finish onboarding" },
  { type: "setup_incomplete", label: "Setup Incomplete", description: "Complete remaining setup steps" },
  { type: "reminder_agreement", label: "Upload Agreement", description: "Remind to upload rent agreement" },
  { type: "under_review", label: "Under Review", description: "Notify agreement is being reviewed" },
  { type: "landlord_pending", label: "Landlord Pending", description: "Waiting on landlord confirmation" },
  { type: "rent_due", label: "Rent Due", description: "Upcoming rent payment reminder" },
  { type: "rent_overdue", label: "Rent Overdue", description: "Overdue rent payment nudge" },
  { type: "payment_failed", label: "Payment Failed", description: "Retry failed payment" },
];

function suggestActions(user: UserFunnel): QuickAction[] {
  const suggestions: QuickAction[] = [];

  if (!user.extraction_status || user.extraction_status === "pending") {
    suggestions.push(ALL_QUICK_ACTIONS.find((a) => a.type === "onboarding_dropoff")!);
    suggestions.push(ALL_QUICK_ACTIONS.find((a) => a.type === "reminder_agreement")!);
  }
  if (user.extraction_status === "completed" && user.user_status === "waitlisted") {
    suggestions.push(ALL_QUICK_ACTIONS.find((a) => a.type === "under_review")!);
  }
  if (user.user_status === "waitlisted" && !user.landlord_approved) {
    suggestions.push(ALL_QUICK_ACTIONS.find((a) => a.type === "landlord_pending")!);
  }
  if (user.user_status === "active" || user.user_status === "agreement_confirmed") {
    suggestions.push(ALL_QUICK_ACTIONS.find((a) => a.type === "rent_due")!);
    suggestions.push(ALL_QUICK_ACTIONS.find((a) => a.type === "rent_overdue")!);
  }
  if (!user.bank_verified || !user.utility_verified) {
    suggestions.push(ALL_QUICK_ACTIONS.find((a) => a.type === "setup_incomplete")!);
  }

  if (suggestions.length === 0) {
    return ALL_QUICK_ACTIONS.slice(0, 4);
  }

  return suggestions.slice(0, 4);
}

function statusBadge(status: string) {
  switch (status) {
    case "sent":
      return "bg-success/10 text-success border-success/30";
    case "failed":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "pending":
    case "processing":
      return "bg-warning/10 text-warning border-warning/30";
    default:
      return "bg-[#1F1F1F] text-muted-foreground/40 border-[#252525]";
  }
}

function templateLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  user: UserFunnel;
}

export function CommunicationsBlock({ user }: Props) {
  const [history, setHistory] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const rows = await fetchView<NotificationRow>("notification_queue", {
        filters: [
          { column: "user_id", operator: "eq", value: user.user_id },
        ],
        order: { column: "created_at", ascending: false },
        limit: 8,
      });
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [user.user_id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleSend(action: QuickAction) {
    if (sending) return;

    setSending(action.type);
    setSendResult(null);
    try {
      await callEdgeFunction("notify-user", {
        user_id: user.user_id,
        notification_type: action.type,
        template_vars: { name: user.name || "there" },
        priority: "high",
      });
      setSendResult({ ok: true, msg: `"${action.label}" sent to ${maskPhone(user.phone)}` });
      loadHistory();
    } catch (err) {
      setSendResult({ ok: false, msg: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setSending(null);
    }
  }

  const suggested = suggestActions(user);
  const actions = showAllTemplates ? ALL_QUICK_ACTIONS : suggested;
  const lastSent = history.find((h) => h.status === "sent");

  return (
    <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">
          Communications
        </span>
        {lastSent && (
          <span className="font-mono text-[10px] text-muted-foreground/40">
            Last contacted {formatRelativeTime(lastSent.sent_at)}
          </span>
        )}
        <div className="flex-1" />
        <span className="font-mono text-[10px] text-muted-foreground/30">
          WhatsApp
        </span>
      </div>

      {/* Quick action chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {actions.map((action) => (
          <button
            key={action.type}
            onClick={() => handleSend(action)}
            disabled={!!sending}
            className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
              sending === action.type
                ? "border-[#3D5A80]/50 bg-[#3D5A80]/10"
                : "border-[#1F1F1F] bg-[#0A0A0A] hover:border-[#3D5A80]/30 hover:bg-[#3D5A80]/5"
            } disabled:opacity-50`}
            title={action.description}
          >
            <span className="font-mono text-[10px] font-semibold text-foreground/80 group-hover:text-foreground">
              {action.label}
            </span>
            <svg className="size-3 text-muted-foreground/30 group-hover:text-[#3D5A80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        ))}
      </div>

      {/* Show more / fewer */}
      <button
        onClick={() => setShowAllTemplates(!showAllTemplates)}
        className="self-start font-mono text-[9px] text-muted-foreground/30 hover:text-muted-foreground mb-3 transition-colors"
      >
        {showAllTemplates ? "▲ Show suggested" : `▼ All templates (${ALL_QUICK_ACTIONS.length})`}
      </button>

      {/* Send result toast */}
      {sendResult && (
        <div className={`rounded-lg border px-3 py-2 mb-3 font-mono text-[10px] ${
          sendResult.ok
            ? "border-success/30 bg-success/5 text-success"
            : "border-destructive/30 bg-destructive/5 text-destructive"
        }`}>
          {sendResult.msg}
        </div>
      )}

      {/* Message history */}
      {!loading && history.length > 0 && (
        <div className="border-t border-[#1F1F1F] pt-3">
          <span className="font-mono text-[8px] uppercase tracking-[1.5px] text-muted-foreground/30 mb-2 block">
            Recent Messages
          </span>
          <div className="flex flex-col gap-1.5">
            {history.map((row) => {
              const payload = row.payload || {};
              const type = (payload.notification_subtype as string) || (payload.template as string) || (payload.notification_type as string) || "message";
              const channel = row.notification_type;
              return (
                <div key={row.id} className="flex items-center gap-2.5 py-1.5">
                  <Badge variant="outline" className={`rounded-md px-2 py-0.5 font-mono text-[9px] font-medium border ${statusBadge(row.status)}`}>
                    {row.status}
                  </Badge>
                  <span className={`font-mono text-[8px] uppercase px-1.5 py-0.5 rounded ${
                    channel === "whatsapp" ? "bg-success/10 text-success/60" : "bg-[#1F1F1F] text-muted-foreground/40"
                  }`}>
                    {channel === "whatsapp" ? "WA" : channel === "push" ? "Push" : channel}
                  </span>
                  <span className="font-mono text-[10px] text-foreground/60 truncate flex-1">
                    {templateLabel(type)}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground/30 flex-shrink-0">
                    {formatRelativeTime(row.sent_at || row.created_at)}
                  </span>
                  {row.error_message && (
                    <span className="font-mono text-[9px] text-destructive/60 truncate max-w-[120px]" title={row.error_message}>
                      {row.error_message}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && history.length === 0 && (
        <div className="border-t border-[#1F1F1F] pt-3">
          <span className="font-mono text-[10px] text-muted-foreground/20 italic">
            No messages sent to this user yet
          </span>
        </div>
      )}
    </div>
  );
}
