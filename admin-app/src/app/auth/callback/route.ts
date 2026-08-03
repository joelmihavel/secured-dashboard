/**
 * /auth/callback — OAuth (Google) redirect handler.
 *
 * The @supabase/ssr browser client kicks off the OAuth flow with PKCE and
 * stores the code verifier in a cookie. Google redirects back here with a
 * `code`; we exchange it for a session using the cookie-aware route client,
 * which writes the session cookies onto the response. From there the normal
 * middleware gate takes over on the next request.
 *
 * Admin allow-list is NOT enforced here — we just establish the session and
 * redirect to /overview. src/middleware.ts revalidates via getUser() and
 * bounces non-allow-listed emails to /login?error=not_admin (clearing the
 * session cookies), exactly like the password flow.
 *
 * NOTE: this path is exempted from the middleware gate (see src/middleware.ts)
 * so the code exchange can run before a session exists.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase-ssr";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/overview";

  // Provider-side error (user denied consent, etc.) — surface it on /login.
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?error=${encodeURIComponent(oauthError)}`;
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=missing_code";
    return NextResponse.redirect(url);
  }

  const supabase = await createRouteClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[/auth/callback] exchangeCodeForSession failed:", error.message);
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=oauth_exchange_failed";
    return NextResponse.redirect(url);
  }

  // Session cookies are now set on the response the route client mutated via
  // next/headers. Redirect into the app; middleware enforces the allow-list.
  return NextResponse.redirect(new URL(next, origin));
}
