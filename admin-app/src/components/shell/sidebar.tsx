"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Inbox,
  Users,
  CreditCard,
  BarChart3,
  Activity,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/triage", label: "Triage", icon: Inbox, badge: 8 },
  { href: "/users", label: "Users", icon: Users, count: 47 },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/activity", label: "Activity", icon: Activity },
];

const savedViews = [
  { label: "Active users", count: 12 },
  { label: "High risk", count: 5, color: "text-destructive" },
  { label: "Stuck in setup", count: 6, color: "text-warning" },
  { label: "No payment 30d", count: 3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[220px] flex-col border-r border-border bg-background">
      <nav className="flex flex-col gap-0.5 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-foreground font-medium border border-primary/20"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <item.icon className="size-[18px] opacity-70" />
              <span>{item.label}</span>
              {item.badge != null && (
                <span className="ml-auto rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                  {item.badge}
                </span>
              )}
              {item.count != null && !item.badge && (
                <span className="ml-auto text-[11px] text-muted-foreground/50">
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 h-px bg-border" />

      <div className="flex flex-col gap-0.5 p-3">
        <span className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/40">
          Saved views
        </span>
        {savedViews.map((view) => (
          <button
            key={view.label}
            className="flex items-center justify-between rounded-md px-3 py-1.5 text-[13px] text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <span>{view.label}</span>
            <span className={cn("text-[11px]", view.color || "text-muted-foreground/40")}>
              {view.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-auto p-3">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/40 hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <Settings className="size-[18px]" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
