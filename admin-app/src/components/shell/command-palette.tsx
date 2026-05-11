"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  Inbox,
  CreditCard,
  Settings,
  UserCheck,
  ArrowLeftRight,
} from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { maskPhone } from "@/lib/utils";

const navigationItems = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Users", href: "/users", icon: Users },
  { label: "Pending Review", href: "/users?filter=pending", icon: Inbox },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { users } = useUsers();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const userItems = useMemo(() =>
    users.map((u) => ({
      id: u.user_id,
      name: u.name || maskPhone(u.phone),
      phone: u.phone,
      city: u.property_city || null,
      status: u.user_status,
      risk: u.risk_level,
    })),
    [users]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search commands, navigate pages, or find users."
      showCloseButton={false}
    >
      <CommandInput placeholder="Search users, commands..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {userItems.length > 0 && (
          <CommandGroup heading="Users">
            {userItems.map((user) => (
              <CommandItem
                key={user.id}
                value={`${user.name} ${user.phone} ${user.city || ""}`}
                onSelect={() => navigate(`/users`)}
              >
                <Users className="size-4 opacity-60" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="truncate">{user.name}</span>
                  <span className="text-xs text-muted-foreground/50 truncate">
                    {maskPhone(user.phone)}{user.city ? ` · ${user.city}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                  <span className={`font-mono text-[10px] font-semibold ${
                    user.risk === "HIGH" ? "text-destructive" :
                    user.risk === "MED" ? "text-warning" :
                    user.risk === "LOW" ? "text-success" : "text-muted-foreground/30"
                  }`}>{user.risk || ""}</span>
                  <span className="text-[10px] text-muted-foreground/40 font-mono">{user.status}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {userItems.length > 0 && <CommandSeparator />}

        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => navigate(item.href)}
            >
              <item.icon className="size-4 opacity-60" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => navigate("/users?filter=pending")}>
            <UserCheck className="size-4 opacity-60" />
            <span>Approve user</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
            }}
          >
            <ArrowLeftRight className="size-4 opacity-60" />
            <span>Switch environment</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function openCommandPalette() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    })
  );
}
