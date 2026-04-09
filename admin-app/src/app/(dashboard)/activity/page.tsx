"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchView } from "@/lib/supabase";
import { formatRelativeTime } from "@/lib/utils";
import { Search } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  action_category: string;
  entity_type: string | null;
  entity_id: string | null;
  user_id: string | null;
  details: Record<string, unknown> | null;
  status: string | null;
  created_at: string;
  ip_address: string | null;
}

function actionDot(action: string) {
  if (action.includes("APPROVE")) return "bg-success";
  if (action.includes("REJECT")) return "bg-destructive";
  if (action.includes("OVERRIDE") || action.includes("BYPASS")) return "bg-warning";
  if (action.includes("IN_PROGRESS") || action.includes("STATUS")) return "bg-blue-400";
  return "bg-muted-foreground/30";
}

function actionLabel(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/WAITLIST BATCH /i, "")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

type ActionFilter = "all" | "approve" | "reject" | "override";

function matchesFilter(action: string, filter: ActionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "approve") return action.includes("APPROVE");
  if (filter === "reject") return action.includes("REJECT");
  if (filter === "override")
    return action.includes("OVERRIDE") || action.includes("BYPASS");
  return true;
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(30);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!matchesFilter(log.action, actionFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const label = actionLabel(log.action).toLowerCase();
        const entity = (log.entity_type || "").toLowerCase();
        const details = log.details
          ? JSON.stringify(log.details).toLowerCase()
          : "";
        if (!label.includes(q) && !entity.includes(q) && !details.includes(q))
          return false;
      }
      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchView<AuditLog>("audit_logs", {
          order: { column: "created_at", ascending: false },
          limit,
        });
        setLogs(data);
      } catch (err) {
        console.error("Failed to load audit logs:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [limit]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <Skeleton className="h-8 w-32 rounded" />
        {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Activity Log</h1>
        <span className="text-xs text-muted-foreground/40">
          {filteredLogs.length === logs.length
            ? `${logs.length} entries`
            : `${filteredLogs.length} / ${logs.length} entries`}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={actionFilter}
          onValueChange={(v) => setActionFilter(v as ActionFilter)}
        >
          <SelectTrigger size="sm" className="h-9 w-[160px] text-sm">
            <SelectValue placeholder="Action type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="approve">Approve</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
            <SelectItem value="override">Override</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="flex flex-col gap-0 p-0">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground/40">
              {logs.length === 0 ? "No activity recorded yet" : "No matching entries"}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex gap-3 border-b border-border/30 px-5 py-3.5 hover:bg-muted/10 transition-colors">
                <div className={`mt-2 size-2 flex-shrink-0 rounded-full ${actionDot(log.action)}`} />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">
                      {actionLabel(log.action)}
                    </span>
                    {log.entity_type && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground/60">
                        {log.entity_type}
                      </Badge>
                    )}
                    {log.status && log.status !== "success" && (
                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                        {log.status}
                      </Badge>
                    )}
                  </div>
                  {log.details && (
                    <span className="text-xs text-muted-foreground/60 truncate max-w-[600px]">
                      {typeof log.details === "object"
                        ? Object.entries(log.details)
                            .filter(([k]) => k !== "admin_key")
                            .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                            .join(" \u00b7 ")
                        : String(log.details)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="text-[11px] text-muted-foreground/40">
                    {formatRelativeTime(log.created_at)}
                  </span>
                  {log.ip_address && (
                    <span className="font-mono text-[10px] text-muted-foreground/30">
                      {log.ip_address}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {logs.length >= limit && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setLimit((l) => l + 30)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
