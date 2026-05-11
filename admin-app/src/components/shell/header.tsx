"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentEnvironment } from "@/lib/supabase";
import { openCommandPalette } from "@/components/shell/command-palette";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview" },
  { href: "/triage", label: "Inbox" },
  { href: "/users", label: "Users" },
  { href: "/payments", label: "Payments" },
  { href: "/analytics", label: "Analytics" },
];

export interface KpiItem {
  label: string;
  value: string;
  color?: string;
}

const DEFAULT_KPIS: KpiItem[] = [
  { label: "SIGNUPS", value: "1,204" },
  { label: "REVENUE", value: "$48.2K" },
  { label: "CONVERSION", value: "3.8%" },
  { label: "TRIAGE", value: "27", color: "#F59E0B" },
  { label: "7D CHANGE", value: "+12.4%" },
];

interface HeaderProps {
  kpis?: KpiItem[];
}

export function Header({ kpis = DEFAULT_KPIS }: HeaderProps) {
  const env = getCurrentEnvironment();
  const pathname = usePathname();

  return (
    <header className="flex h-[52px] items-center gap-6 border-b border-[#1F1F1F] px-8">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[16px] font-bold text-foreground">
          {">_"}
        </span>
        <span className="text-[15px] font-normal tracking-[-0.3px] text-foreground">
          SECURED
        </span>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-[#1F1F1F]" />

      {/* KPI Strip */}
      <div className="flex items-center gap-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex flex-col items-start gap-[2px]">
            <span
              className="font-mono text-[9px] font-normal uppercase leading-none"
              style={{ letterSpacing: "1.5px", color: "rgba(163, 163, 163, 0.4)" }}
            >
              {kpi.label}
            </span>
            <span
              className="font-mono text-[13px] font-semibold leading-none"
              style={{ color: kpi.color ?? "#E8E8E8" }}
            >
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Nav tabs */}
      <nav className="flex items-center gap-px">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-[6px] px-[14px] py-[6px] text-[12px] transition-colors",
                isActive
                  ? "bg-[#FF9A6D] font-medium text-[#0A0A0A]"
                  : "text-[#A3A3A3] hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="h-6 w-px bg-[#1F1F1F]" />

      {/* Env indicator */}
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "size-[6px] rounded-full",
            env === "dev" ? "bg-warning" : "bg-green-500"
          )}
        />
        <span
          className={cn(
            "font-mono text-[11px] font-medium",
            env === "dev" ? "text-warning" : "text-muted-foreground"
          )}
        >
          {env === "dev" ? "DEV" : "MAIN"}
        </span>
      </div>

      {/* Avatar */}
      <Avatar className="size-8 bg-secondary">
        <AvatarFallback className="bg-secondary text-[11px] text-muted-foreground">
          RA
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
