"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getSupabaseClient, getCurrentEnvironment, switchEnvironment, type Environment } from "@/lib/supabase";

export default function SettingsPage() {
  const [env, setEnv] = useState<Environment>(getCurrentEnvironment());
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      setUserEmail(session?.user?.email || null);
    }
    loadUser();
  }, []);

  function handleEnvSwitch(newEnv: Environment) {
    switchEnvironment(newEnv);
    setEnv(newEnv);
  }

  async function handleLogout() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const initials = (userEmail || "RA").slice(0, 2).toUpperCase();

  return (
    <div className="flex gap-4 p-6 px-8 h-full overflow-hidden">
      {/* Left — Settings cards */}
      <div className="flex w-[460px] flex-shrink-0 flex-col gap-4">
        <h1 className="text-[28px] font-normal tracking-[-0.5px] text-foreground">Settings</h1>

        {/* Account */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-4">Account</span>
          <div className="flex items-center gap-3">
            <Avatar className="size-10 bg-[#3D5A80] flex-shrink-0">
              <AvatarFallback className="bg-[#3D5A80] text-white text-[12px] font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5 flex-1">
              <span className="text-[14px] font-medium text-foreground">{userEmail || "—"}</span>
              <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-muted-foreground/40">Super Admin</span>
            </div>
            <button onClick={handleLogout}
              className="rounded-xl border border-destructive/30 px-4 py-2 font-mono text-[11px] text-destructive hover:bg-destructive/10 transition-colors">
              Sign out
            </button>
          </div>
        </div>

        {/* Environment */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-4">Environment</span>
          <div className="flex gap-3">
            <button onClick={() => handleEnvSwitch("dev")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 font-mono text-[12px] transition-colors ${
                env === "dev" ? "border-[#1F1F1F] bg-[#1F1F1F] text-foreground" : "border-[#1F1F1F] text-muted-foreground/40 hover:text-muted-foreground"
              }`}>
              <div className={`size-2 rounded-full ${env === "dev" ? "bg-foreground" : "bg-muted-foreground/30"}`} />
              DEV
            </button>
            <button onClick={() => handleEnvSwitch("main")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-mono text-[12px] font-semibold transition-colors ${
                env === "main" ? "bg-success/20 text-success border border-success/30" : "border border-[#1F1F1F] text-muted-foreground/40 hover:text-muted-foreground"
              }`}>
              <div className={`size-2 rounded-full ${env === "main" ? "bg-success" : "bg-muted-foreground/30"}`} />
              MAIN (PRODUCTION)
            </button>
          </div>
          {env === "main" && (
            <div className="mt-3 rounded-xl bg-destructive/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[1px] text-destructive">
              Connected to production. All actions affect real users.
            </div>
          )}
          {env === "dev" && (
            <div className="mt-3 rounded-xl bg-warning/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[1px] text-warning">
              Connected to Dev database. Changes do not affect production.
            </div>
          )}
        </div>

        {/* About */}
        <div className="flex flex-col rounded-xl border border-[#1F1F1F] bg-[#141414] p-5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#A3A3A366] mb-4">About</span>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">App</span>
              <span className="font-mono text-[12px] text-muted-foreground">Secured Terminal v0.1.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Framework</span>
              <span className="font-mono text-[12px] text-muted-foreground">Next.js 15 + shadcn/ui</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Backend</span>
              <span className="font-mono text-[12px] text-muted-foreground">Supabase</span>
            </div>
            <div className="border-t border-[#1F1F1F] my-1" />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground/50">Current env</span>
              <Badge variant="outline" className={`font-mono text-[9px] px-2 py-0.5 ${env === "dev" ? "text-warning border-warning/30" : "text-success border-success/30"}`}>
                {env.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Custom Dashboard hero + Keyboard shortcut */}
      <div className="flex flex-1 flex-col gap-4">
        {/* Large steel blue Custom Dashboard card */}
        <div className="flex flex-1 flex-col justify-end rounded-xl bg-[#3D5A80] p-8">
          <h2 className="font-mono text-[42px] font-bold leading-[1.1] tracking-[-1px] text-white uppercase">
            Custom<br />Dashboard
          </h2>
          <p className="text-[14px] text-white/60 mt-3 max-w-[480px]">
            Configure widgets, set alert thresholds, and customize your admin view.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <span className="font-mono text-[12px] uppercase tracking-[1.5px] text-white/40">10 / 20 Templates</span>
            <div className="flex size-7 items-center justify-center rounded-full border border-white/20 text-white/60">
              <span className="text-[12px]">↗</span>
            </div>
          </div>
        </div>

        {/* Salmon keyboard shortcut card */}
        <div className="flex flex-col rounded-xl bg-[#FF9A6D] p-6">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#0A0A0A]/50">Keyboard Shortcut</span>
          <span className="font-mono text-[28px] font-bold tracking-[-1px] text-[#0A0A0A] mt-2">⌘K</span>
          <span className="text-[13px] text-[#0A0A0A]/60 mt-1">Open command palette from anywhere</span>
        </div>
      </div>
    </div>
  );
}
