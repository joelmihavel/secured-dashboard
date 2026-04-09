"use client";

import { Header } from "@/components/shell/header";
import { Sidebar } from "@/components/shell/sidebar";
import { AuthGuard } from "@/components/shell/auth-guard";
import { CommandPalette } from "@/components/shell/command-palette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen flex-col bg-background">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        <CommandPalette users={[]} />
      </div>
    </AuthGuard>
  );
}
