"use client";

import { useCallback, useEffect, useState } from "react";
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
  BarChart3,
  Activity,
  Settings,
  UserCheck,
  ArrowLeftRight,
} from "lucide-react";

interface User {
  id: string;
  name: string;
  email?: string;
}

interface CommandPaletteProps {
  users?: User[];
}

const navigationItems = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Users", href: "/users", icon: Users },
  { label: "Triage", href: "/triage", icon: Inbox },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function CommandPalette({ users = [] }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search commands, navigate pages, or find users."
      showCloseButton={false}
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {users.length > 0 && (
          <CommandGroup heading="Users">
            {users.map((user) => (
              <CommandItem
                key={user.id}
                onSelect={() => navigate(`/users/${user.id}`)}
              >
                <Users className="size-4 opacity-60" />
                <span>{user.name}</span>
                {user.email && (
                  <span className="ml-auto text-xs text-muted-foreground/50">
                    {user.email}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {users.length > 0 && <CommandSeparator />}

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
          <CommandItem onSelect={() => navigate("/triage")}>
            <UserCheck className="size-4 opacity-60" />
            <span>Approve user</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              /* Environment switch handled externally */
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

/** Opens the command palette programmatically by dispatching Cmd+K */
export function openCommandPalette() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    })
  );
}
