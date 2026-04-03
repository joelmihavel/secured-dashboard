"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserList } from "@/components/users/user-list";
import { UserDetail } from "@/components/users/user-detail";
import { fetchView } from "@/lib/supabase";
import type { UserFunnel } from "@/types/user";

export default function UsersPage() {
  const [users, setUsers] = useState<UserFunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await fetchView<UserFunnel>("v_user_funnel", {
          order: { column: "signed_up_at", ascending: false },
        });
        setUsers(data);
        if (data.length > 0 && !selectedUserId) {
          setSelectedUserId(data[0].user_id);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const selectedUser = users.find((u) => u.user_id === selectedUserId);

  if (loading) {
    return (
      <div className="flex h-full">
        <div className="flex w-[380px] flex-col gap-2 border-r border-border p-3">
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-6 w-3/4 rounded" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <UserList
        users={users}
        selectedUserId={selectedUserId}
        onSelectUser={setSelectedUserId}
        filter={filter}
        onFilterChange={setFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      {selectedUser ? (
        <UserDetail user={selectedUser} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground/40">
          Select a user to view their profile
        </div>
      )}
    </div>
  );
}
