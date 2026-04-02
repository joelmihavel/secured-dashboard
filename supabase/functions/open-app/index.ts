/**
 * Flent Secured — Smart App Deep Link Redirect
 *
 * Serves a branded page matching the beta-splash design system that opens
 * the app via custom scheme and falls back to the App Store.
 *
 * Used as CTA URLs in WhatsApp notification templates.
 *
 * Usage: GET /functions/v1/open-app?path=/payment
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const APP_STORE_URL =
  "https://apps.apple.com/in/app/secured-by-flent/id6757275258";
const APP_SCHEME = "flentsecured://";

serve((req: Request) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }

  const path = url.searchParams.get("path") || "/";
  const safePath = path.replace(/[^a-zA-Z0-9/_-]/g, "");
  const appLink = `${APP_SCHEME}/${safePath}`;

  // Design system tokens (from rn-app/src/theme)
  // colors: black.700=#131313, black.500=#202020, brand.500=#FF9A6D
  // labels: #878787, #A9A9A9, values: #CBCBCB, #DDDDDD
  // font: PlusJakartaSans, spacing: xs=8 sm=12 md=16 lg=24 xl=32
  // radius: xs=4 sm=8 md=12 lg=16

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Secured by Flent</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #131313;
      color: #DDDDDD;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    /* Dotted grid pattern — matches DottedGridPattern component at 8% opacity */
    body::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
      background-size: 24px 24px;
      pointer-events: none;
      z-index: 0;
    }

    .content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }

    /* Logo — exact SVG from Figma, same as Logo.tsx */
    .logo-container {
      margin-bottom: 12px; /* logoToBadgeGap from beta-splash */
      animation: logoIn 0.6s ease-out both;
    }

    @keyframes logoIn {
      from { opacity: 0; transform: scale(0.8); }
      to   { opacity: 1; transform: scale(1); }
    }

    /* Badge — matches beta-splash badge style */
    .badge {
      background: #FF9A6D;
      border-radius: 4px;
      padding: 4px 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 48px;
      animation: badgeIn 0.4s ease-out 0.3s both;
    }

    @keyframes badgeIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .badge-text {
      font-size: 12px;
      line-height: 20px;
      font-weight: 500;
      letter-spacing: -0.2px;
      color: #000000;
      text-align: center;
    }

    /* State: Loading */
    #loading {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid #202020;
      border-top-color: #FF9A6D;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .message {
      font-size: 14px;
      line-height: 22px;
      color: #A9A9A9;
      font-weight: 400;
      margin-bottom: 32px;
      max-width: 280px;
    }

    /* State: Fallback — shown if app doesn't open */
    .fallback { display: none; flex-direction: column; align-items: center; }
    .fallback.visible { display: flex; }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #FF9A6D;
      color: #131313;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 600;
      font-size: 16px;
      line-height: 24px;
      padding: 14px 32px;
      border-radius: 12px;
      text-decoration: none;
      border: none;
      cursor: pointer;
      margin-bottom: 16px;
      transition: opacity 0.2s;
      min-width: 220px;
    }

    .btn-primary:active { opacity: 0.8; }

    /* Apple icon inline */
    .apple-icon { width: 18px; height: 18px; fill: #131313; }

    .btn-secondary {
      display: inline-block;
      color: #878787;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 8px;
      transition: color 0.2s;
    }

    .btn-secondary:active { color: #CBCBCB; }

    .fallback-message {
      font-size: 14px;
      line-height: 22px;
      color: #878787;
      font-weight: 400;
      margin-bottom: 24px;
      max-width: 260px;
    }
  </style>
</head>
<body>
  <div class="content">
    <!-- Logo — exact SVG from Logo.tsx (33.375x40 viewBox) scaled to 48px height -->
    <div class="logo-container">
      <svg width="40" height="48" viewBox="0 0 34 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.4751 40H3.72631V21.2062H0V16.0217H3.72631C1.65252 7.98576 7.50667 3.16855 10.693 1.76445C20.025 -3.16081 29.7028 3.38457 33.3751 7.27293V40H24.6263V11.6473C19.5714 3.35216 13.2312 5.27474 10.693 7.27293C7.45266 12.8463 12.0431 15.4277 14.7433 16.0217H19.2798V21.2062H12.4751V40Z" fill="white"/>
      </svg>
    </div>

    <!-- Badge -->
    <div class="badge">
      <span class="badge-text">SECURED BY FLENT</span>
    </div>

    <!-- Loading state -->
    <div id="loading">
      <div class="spinner"></div>
      <p class="message">Opening the app...</p>
    </div>

    <!-- Fallback state — shown if app doesn't open -->
    <div id="fallback" class="fallback">
      <p class="fallback-message">Looks like the app isn't installed yet.</p>
      <a class="btn-primary" href="${APP_STORE_URL}">
        <svg class="apple-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.56 2.93 11.3 4.7 7.72C5.57 5.94 7.36 4.86 9.28 4.84C10.56 4.81 11.78 5.72 12.57 5.72C13.36 5.72 14.82 4.62 16.39 4.8C17.07 4.83 18.89 5.09 20.07 6.81C19.96 6.88 17.62 8.24 17.64 11.09C17.67 14.51 20.58 15.62 20.61 15.63C20.58 15.72 20.15 17.28 19.07 18.88L18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/></svg>
        Download on App Store
      </a>
      <a class="btn-secondary" href="${appLink}">Try opening the app again</a>
    </div>
  </div>

  <script>
    var appLink = "${appLink}";
    var didLeave = false;

    document.addEventListener("visibilitychange", function() {
      if (document.hidden) didLeave = true;
    });
    window.addEventListener("blur", function() { didLeave = true; });

    // Try opening the app via custom scheme
    window.location.href = appLink;

    // After 1.5s, if still here, show fallback
    setTimeout(function() {
      if (!didLeave) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("fallback").classList.add("visible");
      }
    }, 1500);
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
});
