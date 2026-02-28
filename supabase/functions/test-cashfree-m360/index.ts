import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { generateCfSignature } from "../_shared/cashfree-m360-otp.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const appId = Deno.env.get("CASHFREE_APP_ID");
  const secretKey = Deno.env.get("CASHFREE_SECRET_KEY");
  const baseUrl = Deno.env.get("CASHFREE_BASE_URL") ?? "https://sandbox.cashfree.com/verification";

  const results: Record<string, unknown> = {
    env: {
      app_id: appId ? `${appId.slice(0, 10)}...` : "NOT SET",
      base_url: baseUrl,
      public_key: Deno.env.get("CASHFREE_PUBLIC_KEY") ? "SET" : "NOT SET",
    },
  };

  if (!appId || !secretKey) return jsonResponse(results);

  // Build headers with x-cf-signature
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client-id": appId,
    "x-client-secret": secretKey,
  };
  try {
    const { signature } = await generateCfSignature(appId);
    headers["x-cf-signature"] = signature;
    results.signature = { generated: true };
  } catch (e) {
    results.signature = { generated: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Parse request body for custom test params
  let testType = "penny_drop";
  let params: Record<string, string> = {};
  try {
    const body = await req.json();
    if (body.test) testType = body.test;
    if (body.params) params = body.params;
  } catch (_) { /* default to penny_drop */ }

  if (testType === "penny_drop") {
    const account = params.account_number ?? "026291800001191";
    const ifsc = params.ifsc ?? "UTIB0002083";
    const name = params.name ?? "Test User";
    try {
      const res = await fetch(`${baseUrl}/bank-account/sync`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          bank_account: account,
          ifsc: ifsc,
          name: name,
        }),
      });
      const data = await res.json();
      results.penny_drop = { status: res.status, body: data };
    } catch (e) {
      results.penny_drop = { error: e instanceof Error ? e.message : String(e) };
    }
  } else if (testType === "m360") {
    const mobile = params.mobile_number ?? "9999999999";
    const name = params.name ?? "Test";
    const vid = `DIAG_${Date.now()}`;
    try {
      const res = await fetch(`${baseUrl}/mobile360/otp/send`, {
        method: "POST",
        headers: { ...headers, "x-api-version": "2024-12-01" },
        body: JSON.stringify({
          verification_id: vid,
          mobile_number: mobile,
          name: name,
          notification_modes: ["SMS"],
          user_consent: {
            obtained: true,
            type: "EXPLICIT",
            timestamp: new Date().toISOString(),
            purpose: "Identity verification for rental services",
            network_details: { ip: "49.205.128.174" },
          },
        }),
      });
      const data = await res.json();
      results.m360_send = { status: res.status, body: data, verification_id: vid };
    } catch (e) {
      results.m360_send = { error: e instanceof Error ? e.message : String(e) };
    }
  } else if (testType === "m360_verify") {
    const vid = params.verification_id ?? "";
    const otp = params.otp ?? "";
    if (!vid || !otp) {
      results.m360_verify = { error: "verification_id and otp are required in params" };
    } else {
      try {
        const res = await fetch(`${baseUrl}/mobile360/otp/verify`, {
          method: "POST",
          headers: { ...headers, "x-api-version": "2024-12-01" },
          body: JSON.stringify({ verification_id: vid, otp }),
        });
        const data = await res.json();
        results.m360_verify = { status: res.status, body: data };
      } catch (e) {
        results.m360_verify = { error: e instanceof Error ? e.message : String(e) };
      }
    }
  } else if (testType === "pan") {
    const pan = params.pan_number ?? "ABCDE1234F";
    try {
      const res = await fetch(`${baseUrl}/pan`, {
        method: "POST",
        headers,
        body: JSON.stringify({ pan }),
      });
      const data = await res.json();
      results.pan_verify = { status: res.status, body: data };
    } catch (e) {
      results.pan_verify = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return jsonResponse(results);
});
