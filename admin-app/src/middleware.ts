/**
 * middleware.ts — gate every dashboard route, /api/admin, and /login.
 *
 * Auth model:
 *   - Session lives in HTTP-only cookies (set by createBrowserClient).
 *   - This middleware reads + validates the cookie via supabase.auth.getUser()
 *     on every request (don't use getSession() — it doesn't revalidate).
 *   - Email is checked against ADMIN_EMAILS (server-only env var).
 *
 * Outcomes per path:
 *   /login                  if signed-in admin → redirect /overview; else allow.
 *   /api/admin              admin → allow; else 403 JSON.
 *   anything else (matched) admin → allow; non-admin signed-in → /login?error=not_admin
 *                           + clear session cookies; signed-out → /login.
 */

import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_PREFIX = "sb-";

function clearSupabaseCookies(req: NextRequest, res: NextResponse) {
  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith(SESSION_COOKIE_PREFIX)) {
      res.cookies.set({
        name: cookie.name,
        value: "",
        path: "/",
        maxAge: 0,
      });
    }
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // OAuth callback runs BEFORE a session exists — it exchanges the code for
  // one. Gating it would bounce the user to /login and break the flow. Let it
  // through; the callback redirects to /overview, where the gate revalidates.
  if (pathname === "/auth/callback") {
    return NextResponse.next({ request: req });
  }

  if (process.env.BYPASS_AUTH === "true") {
    if (pathname === "/login") {
      const url = req.nextUrl.clone();
      url.pathname = "/overview";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request: req });
  }

  const { createMiddlewareClient } = await import("@/lib/supabase-ssr");
  const { isAdminEmail } = await import("@/lib/env-server");

  const response = NextResponse.next({ request: req });
  const supabase = createMiddlewareClient(req, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowed = isAdminEmail(user?.email);

  if (pathname === "/login") {
    if (allowed) {
      const url = req.nextUrl.clone();
      url.pathname = "/overview";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (allowed) {
    return response;
  }

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json(
      { error: user ? "Forbidden — email not in admin allow-list" : "Unauthorized" },
      { status: user ? 403 : 401 },
    );
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = user ? "?error=not_admin" : "";
  const redirectResponse = NextResponse.redirect(redirectUrl);
  if (user) {
    clearSupabaseCookies(req, redirectResponse);
  }
  return redirectResponse;
}

export const config = {
  matcher: [
    /*
     * Run on every request EXCEPT:
     *   - _next/static, _next/image (build assets)
     *   - favicon, public images
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
