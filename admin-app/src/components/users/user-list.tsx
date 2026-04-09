"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatCurrencyShort, maskPhone } from "@/lib/utils";
import { Search } from "lucide-react";
import type { UserFunnel } from "@/types/user";

const STATUS_FILTERS = ["All", "Active", "Waitlisted", "Approved", "Signed Up"] as const;

function statusColor(status: string) {
  switch (status) {
    case "active": return "bg-success/15 text-success border-success/30";
    case "approved":
    case "agreement_confirmed": return "bg-success/8 text-emerald-400 border-success/20";
    case "waitlisted": return "bg-warning/15 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function statusDot(status: string) {
  switch (status) {
    case "active": return "bg-success";
    case "approved":
    case "agreement_confirmed": return "bg-emerald-400";
    case "waitlisted": return "bg-warning";
    default: return "bg-muted-foreground/40";
  }
}

export function UserList({
  users,
  selectedUserId,
  onSelectUser,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: {
  users: UserFunnel[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  const filteredUsers = users.filter((u) => {
    if (filter !== "All") {
      const filterStatus = filter.toLowerCase().replace(" ", "_");
      if (u.user_status !== filterStatus) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (u.name || "").toLowerCase().includes(q) ||
        (u.phone || "").includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex w-[380px] flex-col border-r border-border bg-background">
      <div className="flex flex-col gap-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 bg-muted border-border pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const count =
              f === "All"
                ? users.length
                : users.filter((u) => u.user_status === f.toLowerCase().replace(" ", "_")).length;
            return (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  filter === f
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground/60 border border-border hover:bg-muted/50"
                )}
              >
                {f} {count}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredUsers.map((user) => (
          <button
            key={user.user_id}
            onClick={() => onSelectUser(user.user_id)}
            className={cn(
              "flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors",
              selectedUserId === user.user_id
                ? "bg-primary/5 border-l-2 border-l-primary"
                : "hover:bg-muted/30"
            )}
          >
            <div className={cn("size-2.5 flex-shrink-0 rounded-full", statusDot(user.user_status))} />
            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <span className="truncate text-sm font-medium text-foreground">
                {user.name || maskPhone(user.phone)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground/60">
              {formatCurrencyShort(user.monthly_rent_paise)}
            </span>
            <Badge variant="outline" className={cn("text-[11px] px-2 py-0.5", statusColor(user.user_status))}>
              {user.user_status}
            </Badge>
          </button>
        ))}
      </div>

      <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground/40">
        Showing {filteredUsers.length} of {users.length}
      </div>
    </div>
  );
}
