"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn, maskPhone } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { computeDecision, sortByPriority } from "@/lib/decision";
import { Search } from "lucide-react";
import type { UserFunnel } from "@/types/user";

const STATUS_FILTERS = ["All", "Pending", "Active", "Waitlisted", "Approved"] as const;

function riskColor(level: string | null) {
  if (level === "LOW") return "text-success";
  if (level === "MED") return "text-warning";
  if (level === "HIGH") return "text-destructive";
  return "text-muted-foreground/30";
}

function decisionDot(user: UserFunnel) {
  const d = computeDecision(user);
  return d.state === "READY" ? "bg-success" : d.state === "NEEDS_REVIEW" ? "bg-warning" : "bg-destructive";
}

function isPending(u: UserFunnel) {
  return u.user_status === "waitlisted" || u.user_status === "agreement_confirmed" ||
    u.admin_review === "due" || u.admin_review === "in_progress";
}

export function UserList({
  users,
  selectedUserId,
  onSelectUser,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onBatchApprove,
  onBatchReject,
  batchLoading,
  viewMode = "tenants",
}: {
  users: UserFunnel[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onBatchApprove?: () => void;
  onBatchReject?: () => void;
  batchLoading?: boolean;
  viewMode?: "tenants" | "landlords";
}) {
  const filteredUsers = useMemo(() => {
    let result = users;

    if (filter === "Pending") {
      result = sortByPriority(result.filter(isPending));
    } else if (filter !== "All") {
      const filterStatus = filter.toLowerCase().replace(" ", "_");
      result = result.filter((u) => u.user_status === filterStatus);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((u) => {
        if (viewMode === "landlords") {
          return (u.landlord_display_name || u.landlord_name || "").toLowerCase().includes(q) ||
            (u.landlord_phone || "").includes(q) ||
            (u.name || "").toLowerCase().includes(q);
        }
        return (u.name || "").toLowerCase().includes(q) ||
          (u.phone || "").includes(q) ||
          (u.property_city || "").toLowerCase().includes(q);
      });
    }

    return result;
  }, [users, filter, searchQuery, viewMode]);

  const pendingCount = useMemo(() => users.filter(isPending).length, [users]);
  const showBatch = filter === "Pending" && filteredUsers.length > 0;

  return (
    <div className="flex w-[320px] flex-shrink-0 flex-col border-r border-[#1F1F1F] bg-background">
      <div className="flex flex-col gap-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 rounded-xl bg-[#141414] border-[#1F1F1F] pl-9 text-[12px]"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => onFilterChange(f)}
              className={cn(
                "rounded px-2 py-1 font-mono text-[9px] uppercase tracking-[0.5px] transition-colors whitespace-nowrap flex-shrink-0",
                filter === f ? "bg-[#1F1F1F] text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"
              )}>
              {f}{f === "Pending" && pendingCount > 0 ? ` ${pendingCount}` : ""}
            </button>
          ))}
        </div>

        {showBatch && onBatchApprove && onBatchReject && (
          <div className="flex gap-2">
            <button onClick={onBatchApprove} disabled={batchLoading}
              className="flex-1 h-8 rounded-xl bg-success/10 border border-success/30 text-success font-mono text-[11px] font-semibold hover:bg-success/20 transition-colors disabled:opacity-50">
              Approve all ({filteredUsers.length})
            </button>
            <button onClick={onBatchReject} disabled={batchLoading}
              className="flex-1 h-8 rounded-xl border border-destructive/30 text-destructive font-mono text-[11px] hover:bg-destructive/10 transition-colors disabled:opacity-50">
              Reject all
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[13px] text-muted-foreground/40">No users found</div>
        ) : (
          filteredUsers.map((user) => {
            const isLandlord = viewMode === "landlords";
            const displayName = isLandlord
              ? (user.landlord_display_name || user.landlord_name || "Unknown Landlord")
              : (user.name || maskPhone(user.phone));
            const initials = displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            const showDecisionDot = filter === "Pending" && !isLandlord;
            return (
              <button key={user.user_id} onClick={() => onSelectUser(user.user_id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-[#1F1F1F]/50 px-4 py-3.5 text-left transition-colors",
                  selectedUserId === user.user_id
                    ? "bg-primary/5 border-l-[3px] border-l-[#3D5A80]"
                    : "hover:bg-white/[0.02]"
                )}>
                {showDecisionDot ? (
                  <div className={cn("size-2 flex-shrink-0 rounded-full", decisionDot(user))} />
                ) : (
                  <UserAvatar name={displayName} size={32} />
                )}
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  <span className="truncate text-[13px] font-medium text-foreground">{displayName}</span>
                  {isLandlord ? (
                    <span className="font-mono text-[11px] text-muted-foreground/40 truncate">
                      {user.landlord_phone ? maskPhone(user.landlord_phone, user.landlord_country_code) : "—"} · Tenant: {user.name || maskPhone(user.phone)}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-muted-foreground/40 truncate uppercase">
                      {filter === "Pending" ? (user.admin_review || "due") : user.user_status} · {user.property_city || "—"}
                    </span>
                  )}
                </div>
                {isLandlord ? (
                  <div className={cn(
                    "size-2 flex-shrink-0 rounded-full",
                    user.landlord_bank_verified && user.landlord_bank_pan_verified ? "bg-success" :
                    user.landlord_bank_verified || user.landlord_bank_pan_verified ? "bg-warning" : "bg-muted-foreground/20"
                  )} title={`Bank: ${user.landlord_bank_verified ? "✓" : "✗"} · PAN: ${user.landlord_bank_pan_verified ? "✓" : "✗"}`} />
                ) : (
                  <span className={cn("font-mono text-[11px] font-semibold flex-shrink-0", riskColor(user.risk_level))}>
                    {user.risk_level || "—"}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-[#1F1F1F] px-4 py-2 font-mono text-[10px] text-muted-foreground/40">
        {filteredUsers.length} of {users.length}
      </div>
    </div>
  );
}
