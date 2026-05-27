"use client";

import { useState, useCallback, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { UserList } from "@/components/users/user-list";
import { UserDetail } from "@/components/users/user-detail";
import { LandlordDetail } from "@/components/users/landlord-detail";
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
  const urlUserId = searchParams.get("user") || null;
  const [selectedUserId, setSelectedUserId] = useState<string | null>(urlUserId);
  const [filter, setFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [batchLoading, setBatchLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [viewMode, setViewMode] = useState<"tenants" | "landlords">("tenants");

  useEffect(() => {
    if (urlUserId) {
      setSelectedUserId(urlUserId);
    }
    const search = searchParams.get("search") || searchParams.get("city") || "";
    if (search) setSearchQuery(search);
  }, [urlUserId, searchParams]);

  const { filters, filteredUsers: overviewFiltered, activeCount, clearAll, updateFilter, uniqueCities, uniqueBuildings, riskCounts } = useOverviewFilters(users);

  const landlordUsers = useMemo(() =>
    overviewFiltered.filter((u) => u.landlord_name || u.landlord_display_name || u.landlord_phone),
    [overviewFiltered],
  );

  const viewUsers = viewMode === "landlords" ? landlordUsers : overviewFiltered;

  if (!selectedUserId && viewUsers.length > 0) {
    setSelectedUserId(viewUsers[0].user_id);
  }

  const selectedUser = viewUsers.find((u) => u.user_id === selectedUserId) || users.find((u) => u.user_id === selectedUserId);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
  }, [queryClient]);

  async function handleBatchAction(action: "approve" | "reject", userIds: string[]) {
    if (userIds.length === 0) return;
    setBatchLoading(true);
    setFeedback(null);
    try {
      await callEdgeFunction("admin-waitlist", {
        action,
        user_ids: userIds,
        ...(action === "reject" ? { rejection_reasons: ["Batch rejection"] } : {}),
      });
      setFeedback({ type: "success", message: `${userIds.length} user${userIds.length > 1 ? "s" : ""} ${action}d` });
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
      <div className="flex items-center border-b border-[#1F1F1F] px-4 py-2.5 flex-shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center rounded-lg border border-[#1F1F1F] bg-[#141414] p-0.5 flex-shrink-0">
          <button
            onClick={() => { setViewMode("tenants"); clearAll(); }}
            className={`rounded-md px-3 py-1.5 font-mono text-[10px] transition-colors ${
              viewMode === "tenants" ? "bg-[#3D5A80]/30 text-[#7BA3C9]" : "text-muted-foreground/40 hover:text-muted-foreground/60"
            }`}
          >
            Tenants <span className="ml-1 opacity-60">{overviewFiltered.length}</span>
          </button>
          <button
            onClick={() => { setViewMode("landlords"); clearAll(); }}
            className={`rounded-md px-3 py-1.5 font-mono text-[10px] transition-colors ${
              viewMode === "landlords" ? "bg-[#FF9A6D]/20 text-[#FF9A6D]" : "text-muted-foreground/40 hover:text-muted-foreground/60"
            }`}
          >
            Landlords <span className="ml-1 opacity-60">{landlordUsers.length}</span>
          </button>
        </div>
        <div className="h-4 w-px bg-[#1F1F1F] flex-shrink-0" />
        <FilterBar
          filters={filters}
          activeCount={activeCount}
          clearAll={clearAll}
          updateFilter={updateFilter}
          uniqueCities={uniqueCities}
          uniqueBuildings={uniqueBuildings}
          riskCounts={riskCounts}
          totalUsers={users.length}
          filteredCount={viewUsers.length}
          viewMode={viewMode}
        />
      </div>
      <div className="flex flex-1 min-h-0">
        <UserList
          users={viewUsers}
          selectedUserId={selectedUserId}
          onSelectUser={setSelectedUserId}
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onBatchApprove={(ids) => handleBatchAction("approve", ids)}
          onBatchReject={(ids) => handleBatchAction("reject", ids)}
          batchLoading={batchLoading}
          viewMode={viewMode}
        />
        <div className="flex flex-1 flex-col min-w-0">
          {feedback && (
            <div className={`mx-6 mt-4 rounded-xl border px-4 py-2 font-mono text-[11px] ${
              feedback.type === "success" ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}>{feedback.message}</div>
          )}
          {selectedUser ? (
            viewMode === "landlords" ? <LandlordDetail user={selectedUser} /> : <UserDetail user={selectedUser} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground/40">
              Select a {viewMode === "landlords" ? "landlord" : "user"} to view details
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
