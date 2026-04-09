"use client";

/**
 * AuthGuard — currently bypassed because email auth is disabled on main Supabase.
 * The admin panel uses service_role key for data access instead.
 * Re-enable auth checks when email provider is enabled on the Supabase dashboard.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  // Auth bypassed — service key handles access
  return <>{children}</>;
}
