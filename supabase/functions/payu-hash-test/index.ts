/**
 * PayU Hash Diagnostic — one-shot test function.
 * Tests credentials + hash against PayU's actual endpoints.
 * Call: curl https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/payu-hash-test
 */

import { corsHeaders } from "../_shared/cors.ts";

const PAYU_MERCHANT_KEY = (Deno.env.get("PAYU_MERCHANT_KEY") ?? "").trim();
const PAYU_MERCHANT_SALT = (Deno.env.get("PAYU_MERCHANT_SALT") ?? "").trim();
const PAYU_BASE_URL = (Deno.env.get("PAYU_BASE_URL") ?? "https://secure.payu.in").trim();
const PAYU_INFO_URL = Deno.env.get("PAYU_INFO_URL") ?? "https://info.payu.in/merchant/postservice";

async function sha512(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const results: Record<string, unknown> = {};

  // 1. Credential info (masked)
  results.credentials = {
    key_length: PAYU_MERCHANT_KEY.length,
    key_first4: PAYU_MERCHANT_KEY.slice(0, 4),
    key_last2: PAYU_MERCHANT_KEY.slice(-2),
    salt_length: PAYU_MERCHANT_SALT.length,
    salt_first4: PAYU_MERCHANT_SALT.slice(0, 4),
    salt_last2: PAYU_MERCHANT_SALT.slice(-2),
    base_url: PAYU_BASE_URL,
    info_url: PAYU_INFO_URL,
    key_hex: Array.from(new TextEncoder().encode(PAYU_MERCHANT_KEY)).map(b => b.toString(16)).join(" "),
    salt_hex: Array.from(new TextEncoder().encode(PAYU_MERCHANT_SALT)).map(b => b.toString(16)).join(" "),
  };

  // 2. Test hash computation (using PayU's well-known test values)
  const testHashInput = "gtKFFx|test123|10.00|iPhone|Ashish|test@gmail.com|||||||||||eCwWELxi";
  const testHash = await sha512(testHashInput);
  results.sha512_test = {
    input: testHashInput,
    output: testHash,
    expected_prefix: "b607e5344ca157d5",
    matches: testHash.startsWith("b607e5344ca157d5"),
  };

  // 3. Test verify_payment API with our credentials
  const testTxnId = "DIAG" + Date.now().toString(36).toUpperCase();
  try {
    const verifyHashStr = `${PAYU_MERCHANT_KEY}|verify_payment|${testTxnId}|${PAYU_MERCHANT_SALT}`;
    const verifyHash = await sha512(verifyHashStr);
    const verifyBody = new URLSearchParams({
      key: PAYU_MERCHANT_KEY,
      command: "verify_payment",
      var1: testTxnId,
      hash: verifyHash,
    });
    const resp = await fetch(PAYU_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody.toString(),
    });
    const text = await resp.text();
    results.verify_payment = {
      status: resp.status,
      response: text.slice(0, 800),
      hash_input: `${PAYU_MERCHANT_KEY.slice(0,4)}...|verify_payment|${testTxnId}|${PAYU_MERCHANT_SALT.slice(0,4)}...`,
      hash: verifyHash.slice(0, 32) + "...",
      interpretation: text.includes("Invalid") || text.includes("invalid")
        ? "CREDENTIALS_WRONG"
        : text.includes("not found") || text.includes("Transaction")
          ? "CREDENTIALS_OK_TXN_NOT_FOUND"
          : "UNKNOWN_CHECK_RESPONSE",
    };
  } catch (err) {
    results.verify_payment = { error: String(err) };
  }

  // 4. S2S UPI Collect test (txn_s2s_flow=4)
  const txnId2 = "DIAGS2S" + Date.now().toString(36).toUpperCase();
  const amount = "1.00";
  const productinfo = "S2S UPI Collect Test";
  const firstname = "TestUser";
  const email = "test@flent.app";
  const hashStr = `${PAYU_MERCHANT_KEY}|${txnId2}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${PAYU_MERCHANT_SALT}`;
  const paymentHash = await sha512(hashStr);

  try {
    const postBody = new URLSearchParams({
      key: PAYU_MERCHANT_KEY,
      txnid: txnId2,
      amount,
      productinfo,
      firstname,
      email,
      phone: "9999999999",
      surl: "https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/payment-webhook",
      furl: "https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/payment-webhook",
      hash: paymentHash,
      udf1: "",
      udf2: "",
      udf3: "",
      udf4: "",
      udf5: "",
      pg: "UPI",
      bankcode: "UPI",
      vpa: "test@payu",
      txn_s2s_flow: "4",
      store_card: "0",
      s2s_client_ip: "103.21.58.1",
      s2s_device_info: "FlentSecured/1.0 iOS",
    });

    const resp = await fetch(`${PAYU_BASE_URL}/_payment`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: postBody.toString(),
    });
    const rawText = await resp.text();

    let parsed: unknown = null;
    let isJson = false;
    try {
      parsed = JSON.parse(rawText);
      isJson = true;
    } catch { /* not JSON */ }

    const stripped = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    results.s2s_upi_collect = {
      http_status: resp.status,
      content_type: resp.headers.get("content-type"),
      is_json: isJson,
      response_length: rawText.length,
      parsed_json: isJson ? parsed : undefined,
      raw_snippet: stripped.slice(0, 800),
      hash_input: `${PAYU_MERCHANT_KEY.slice(0,4)}...|${txnId2}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${PAYU_MERCHANT_SALT.slice(0,4)}...`,
      hash: paymentHash.slice(0, 32) + "...",
      endpoint: `${PAYU_BASE_URL}/_payment`,
    };
  } catch (err) {
    results.s2s_upi_collect = { error: String(err) };
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
