"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentEnvironment } from "@/lib/supabase";
import { openCommandPalette } from "@/components/shell/command-palette";
import { Search } from "lucide-react";

export function Header() {
  const env = getCurrentEnvironment();

  return (
    <header className="flex h-12 items-center gap-4 border-b border-border px-5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[15px] font-bold text-foreground">{">_"}</span>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Secured Terminal
        </span>
      </div>

      <div className="h-5 w-px bg-border" />

      <nav className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <span>Dashboard</span>
        <span className="text-muted-foreground/30">/</span>
        <span className="text-foreground">Overview</span>
      </nav>

      <div className="flex-1" />

      <button
        onClick={openCommandPalette}
        className="flex h-9 w-[240px] items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] text-muted-foreground/60 hover:border-muted-foreground/30 transition-colors"
      >
        <Search className="size-4" />
        <span>Search...</span>
        <span className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/30">
          ⌘K
        </span>
      </button>

      <div className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3">
        <div
          className={`size-2 rounded-full ${
            env === "dev" ? "bg-warning" : "bg-success"
          }`}
        />
        <span
          className={`text-xs font-medium ${
            env === "dev" ? "text-warning" : "text-muted-foreground"
          }`}
        >
          {env === "dev" ? "Dev" : "Main"}
        </span>
      </div>

      <Avatar className="size-8 border border-border">
        <AvatarFallback className="bg-secondary text-[11px] font-semibold text-muted-foreground">
          RA
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
