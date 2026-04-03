"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

  return (
    <div className="flex flex-col gap-5 p-5 max-w-2xl">
      <h1 className="text-base font-semibold text-foreground">Settings</h1>

      {/* Profile */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex flex-col gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            Account
          </span>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{userEmail || "—"}</span>
              <span className="text-xs text-muted-foreground/40">Super Admin</span>
            </div>
            <Button variant="outline" size="sm" className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Environment */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex flex-col gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            Environment
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleEnvSwitch("dev")}
              className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors ${
                env === "dev"
                  ? "border-warning/30 bg-warning/5 text-warning"
                  : "border-border text-muted-foreground hover:bg-muted/30"
              }`}
            >
              <div className={`size-2 rounded-full ${env === "dev" ? "bg-warning" : "bg-muted-foreground/30"}`} />
              Dev
            </button>
            <button
              onClick={() => handleEnvSwitch("main")}
              className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors ${
                env === "main"
                  ? "border-success/30 bg-success/5 text-success"
                  : "border-border text-muted-foreground hover:bg-muted/30"
              }`}
            >
              <div className={`size-2 rounded-full ${env === "main" ? "bg-success" : "bg-muted-foreground/30"}`} />
              Main (Production)
            </button>
          </div>
          {env === "dev" && (
            <div className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-[11px] text-warning">
              Connected to Dev database. Changes do not affect production.
            </div>
          )}
          {env === "main" && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
              ⚠ Connected to PRODUCTION. All actions affect real users.
            </div>
          )}
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex flex-col gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            About
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground/60">App</span>
              <span className="text-muted-foreground">Secured Terminal v0.1.0</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground/60">Framework</span>
              <span className="text-muted-foreground">Next.js 15 + shadcn/ui</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground/60">Backend</span>
              <span className="text-muted-foreground">Supabase (dev branch: v2-backend-dev)</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground/60">Current env</span>
              <Badge variant="outline" className={`text-[9px] ${env === "dev" ? "text-warning border-warning/30" : "text-success border-success/30"}`}>
                {env}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
