"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { useAuditLogs } from "@/hooks/useAuditLogs";

function actionDot(action: string) {
  if (action.includes("APPROVE")) return "bg-success";
  if (action.includes("REJECT")) return "bg-destructive";
  if (action.includes("OVERRIDE") || action.includes("BYPASS")) return "bg-warning";
  if (action.includes("SIGNUP") || action.includes("REGISTER")) return "bg-muted-foreground/30";
  return "bg-blue-400";
}

function actionLabel(action: string) {
  return action.replace(/_/g, " ").replace(/WAITLIST BATCH /i, "").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

type ActionFilter = "all" | "approve" | "reject" | "override";

export default function ActivityPage() {
  const [limit, setLimit] = useState(30);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const { logs, loading } = useAuditLogs({ limit });

  const filteredLogs = useMemo(() => {
    if (actionFilter === "all") return logs;
    return logs.filter((log) => {
      if (actionFilter === "approve") return log.action.includes("APPROVE");
      if (actionFilter === "reject") return log.action.includes("REJECT");
      if (actionFilter === "override") return log.action.includes("OVERRIDE") || log.action.includes("BYPASS");
      return true;
    });
  }, [logs, actionFilter]);

  const approveCount = useMemo(() => logs.filter((l) => l.action.includes("APPROVE")).length, [logs]);
  const rejectCount = useMemo(() => logs.filter((l) => l.action.includes("REJECT")).length, [logs]);
  const overrideCount = useMemo(() => logs.filter((l) => l.action.includes("OVERRIDE") || l.action.includes("BYPASS")).length, [logs]);
  const signupCount = useMemo(() => logs.filter((l) => l.action.includes("SIGNUP") || l.action.includes("REGISTER")).length, [logs]);

  if (loading) {
    return (
      <div className="flex gap-4 p-6 px-8 h-full">
        <Skeleton className="flex-1 rounded-xl" />
        <div className="w-[280px] flex flex-col gap-4"><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div>
      </div>
    );
  }

  const FILTERS: { key: ActionFilter; label: string }[] = [
    { key: "all", label: "ALL" },
    { key: "approve", label: "APPROVE" },
    { key: "reject", label: "REJECT" },
    { key: "override", label: "OVERRIDE" },
  ];

  return (
    <div className="flex gap-4 p-6 px-8 h-full overflow-hidden">
      {/* Main — Activity log */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[28px] font-normal tracking-[-0.5px] text-foreground leading-tight">Activity<br />Log</h1>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setActionFilter(f.key)}
                className={`rounded px-3 py-1 font-mono text-[10px] uppercase tracking-[1px] transition-colors ${
                  actionFilter === f.key ? "bg-[#1F1F1F] text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"
                }`}>{f.label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-xl border border-[#1F1F1F] bg-[#141414]">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[13px] text-muted-foreground/40">No entries</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex gap-3 px-5 py-4 border-b border-[#1F1F1F]/30 hover:bg-white/[0.02] transition-colors">
                <div className={`mt-1.5 size-[6px] flex-shrink-0 rounded-full ${actionDot(log.action)}`} />
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-foreground">{actionLabel(log.action)}</span>
                    {log.entity_type && (
                      <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground/50 border-[#1F1F1F] px-1.5 py-0">{log.entity_type}</Badge>
                    )}
                  </div>
                  {log.details && (
                    <span className="text-[12px] text-muted-foreground/50 truncate">
                      {Object.entries(log.details).filter(([k]) => k !== "admin_key").map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ")}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="font-mono text-[11px] text-muted-foreground/40">{formatRelativeTime(log.created_at)}</span>
                  {log.ip_address && <span className="font-mono text-[10px] text-muted-foreground/20">{log.ip_address}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {logs.length >= limit && (
          <div className="flex justify-center mt-3">
            <Button variant="outline" size="sm" className="rounded-xl font-mono text-[11px]" onClick={() => setLimit((l) => l + 30)}>Load more</Button>
          </div>
        )}
      </div>

      {/* Right sidebar — Stat cards */}
      <div className="flex w-[280px] flex-shrink-0 flex-col gap-4">
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Total Actions</span>
          <span className="font-mono text-[48px] font-bold leading-none tracking-[-1px] text-foreground mt-2">{logs.length}</span>
          <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-muted-foreground/40 mt-1">Last 7 Days</span>
        </div>
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Approvals</span>
          <span className="font-mono text-[36px] font-bold leading-none tracking-[-1px] text-success mt-2">{approveCount}</span>
        </div>
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Rejections</span>
          <span className="font-mono text-[36px] font-bold leading-none tracking-[-1px] text-destructive mt-2">{rejectCount}</span>
        </div>
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366]">Overrides</span>
          <span className="font-mono text-[36px] font-bold leading-none tracking-[-1px] text-foreground mt-2">{overrideCount}</span>
        </div>
        <div className="flex flex-1 flex-col justify-end rounded-xl bg-[#FF9A6D] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#0A0A0A]/50">Signups</span>
          <span className="font-mono text-[36px] font-bold leading-none tracking-[-1px] text-[#0A0A0A] mt-2">{signupCount}</span>
          <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-[#0A0A0A]/40 mt-1">This Week</span>
        </div>
      </div>
    </div>
  );
}
