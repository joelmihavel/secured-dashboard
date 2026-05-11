"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  Users,
  CreditCard,
  BarChart3,
  Activity,
  Settings,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { href: "/triage", label: "Inbox", icon: Inbox },
  { href: "/users", label: "All Users", icon: Users },
  { href: "/landlord-review", label: "Landlord Pipeline", icon: ShieldCheck },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/analytics", label: "Insights", icon: BarChart3 },
  { href: "/activity", label: "Activity", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[224px] flex-col border-r border-border bg-sidebar">
      <nav className="flex flex-col gap-0.5 p-3 pt-5">
        <span className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
          Operations
        </span>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] transition-colors",
                isActive
                  ? "bg-card text-foreground font-medium shadow-[0_1px_0_rgba(44,43,40,0.04)]"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <item.icon className={cn("size-[17px]", isActive ? "text-primary" : "opacity-70")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] transition-colors",
            pathname === "/settings"
              ? "bg-card text-foreground font-medium"
              : "text-muted-foreground/70 hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <Settings className="size-[17px] opacity-70" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
