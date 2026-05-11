"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn, maskPhone } from "@/lib/utils";
import { Search } from "lucide-react";
import type { UserFunnel } from "@/types/user";

const STATUS_FILTERS = ["All", "Active", "Waitlisted", "Approved"] as const;

function riskColor(level: string | null) {
  if (level === "LOW") return "text-success";
  if (level === "MED") return "text-warning";
  if (level === "HIGH") return "text-destructive";
  return "text-muted-foreground/30";
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
        (u.phone || "").includes(q) ||
        (u.property_city || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

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
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => onFilterChange(f)}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1px] transition-colors",
                filter === f ? "bg-[#1F1F1F] text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"
              )}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredUsers.map((user) => {
          const initials = (user.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
          return (
            <button key={user.user_id} onClick={() => onSelectUser(user.user_id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-[#1F1F1F]/50 px-4 py-3.5 text-left transition-colors",
                selectedUserId === user.user_id
                  ? "bg-primary/5 border-l-[3px] border-l-[#3D5A80]"
                  : "hover:bg-white/[0.02]"
              )}>
              <Avatar className="size-8 bg-[#3D5A80]/30 flex-shrink-0">
                <AvatarFallback className="bg-[#3D5A80]/30 text-[10px] text-muted-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                <span className="truncate text-[13px] font-medium text-foreground">{user.name || maskPhone(user.phone)}</span>
                <span className="font-mono text-[11px] text-muted-foreground/40 truncate uppercase">
                  {user.user_status} · {user.property_city || "—"}
                </span>
              </div>
              <span className={cn("font-mono text-[11px] font-semibold flex-shrink-0", riskColor(user.risk_level))}>
                {user.risk_level || "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
