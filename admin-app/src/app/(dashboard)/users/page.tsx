"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { UserList } from "@/components/users/user-list";
import { UserDetail } from "@/components/users/user-detail";
import { useUsers } from "@/hooks/useUsers";
import { callEdgeFunction } from "@/lib/supabase";
import { FilterBar, useOverviewFilters } from "@/components/overview/filter-bar";

function UsersPageInner() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { users, loading } = useUsers();

  const statusParam = searchParams.get("status") || searchParams.get("filter") || "";
  const STATUS_MAP: Record<string, string> = {
    pending: "Pending", active: "Active", waitlisted: "Waitlisted", approved: "Approved",
    agreement_confirmed: "Approved",
  };
  const initialFilter = STATUS_MAP[statusParam.toLowerCase()] || "All";
  const initialSearch = searchParams.get("search") || searchParams.get("city") || "";
  const initialUserId = searchParams.get("user") || null;
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId);
  const [filter, setFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [batchLoading, setBatchLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { filters, filteredUsers: overviewFiltered, activeCount, clearAll, updateFilter, uniqueCities, uniqueBuildings } = useOverviewFilters(users);

  if (!selectedUserId && overviewFiltered.length > 0) {
    setSelectedUserId(overviewFiltered[0].user_id);
  }

  const selectedUser = overviewFiltered.find((u) => u.user_id === selectedUserId) || users.find((u) => u.user_id === selectedUserId);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
  }, [queryClient]);

  async function handleBatchAction(action: "approve" | "reject") {
    const pending = overviewFiltered.filter((u) =>
      u.user_status === "waitlisted" || u.user_status === "agreement_confirmed" ||
      u.admin_review === "due" || u.admin_review === "in_progress"
    );
    if (pending.length === 0) return;
    setBatchLoading(true);
    setFeedback(null);
    try {
      await callEdgeFunction("admin-waitlist", {
        action,
        user_ids: pending.map((u) => u.user_id),
        ...(action === "reject" ? { rejection_reasons: ["Batch rejection"] } : {}),
      });
      setFeedback({ type: "success", message: `${pending.length} users ${action}d` });
      invalidate();
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Batch failed" });
    } finally {
      setBatchLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full">
        <div className="flex w-[320px] flex-col gap-2 border-r border-[#1F1F1F] p-3">
          <Skeleton className="h-9 rounded-xl" />
          <Skeleton className="h-6 w-3/4 rounded" />
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#1F1F1F] px-4 py-2.5 flex-shrink-0 overflow-x-auto">
        <FilterBar
          filters={filters}
          activeCount={activeCount}
          clearAll={clearAll}
          updateFilter={updateFilter}
          uniqueCities={uniqueCities}
          uniqueBuildings={uniqueBuildings}
          totalUsers={users.length}
          filteredCount={overviewFiltered.length}
        />
      </div>
      <div className="flex flex-1 min-h-0">
        <UserList
          users={overviewFiltered}
          selectedUserId={selectedUserId}
          onSelectUser={setSelectedUserId}
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onBatchApprove={() => handleBatchAction("approve")}
          onBatchReject={() => handleBatchAction("reject")}
          batchLoading={batchLoading}
        />
        <div className="flex flex-1 flex-col min-w-0">
          {feedback && (
            <div className={`mx-6 mt-4 rounded-xl border px-4 py-2 font-mono text-[11px] ${
              feedback.type === "success" ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}>{feedback.message}</div>
          )}
          {selectedUser ? (
            <UserDetail user={selectedUser} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground/40">
              Select a user to view their profile
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full">
        <div className="flex w-[320px] flex-col gap-2 border-r border-[#1F1F1F] p-3">
          <Skeleton className="h-9 rounded-xl" />
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
        <Skeleton className="flex-1 m-6 rounded-xl" />
      </div>
    }>
      <UsersPageInner />
    </Suspense>
  );
}
