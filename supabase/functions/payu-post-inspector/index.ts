/**
 * PayU POST Inspector — captures exactly what the SDK sends.
 *
 * Temporarily replace the PayU _payment URL with this endpoint.
 * Logs every field the SDK sends, compares with expected hash input,
 * and returns a JSON diagnostic showing any mismatches.
 */

import { corsHeaders } from "../_shared/cors.ts";
import { sha512 } from "../_shared/crypto.ts";

const PAYU_MERCHANT_KEY = (Deno.env.get("PAYU_MERCHANT_KEY") ?? "").trim();
const PAYU_MERCHANT_SALT = (Deno.env.get("PAYU_MERCHANT_SALT") ?? "").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const results: Record<string, unknown> = {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
    timestamp: new Date().toISOString(),
  };

  // Read raw body
  const rawBody = await req.text();
  results.raw_body_length = rawBody.length;
  results.raw_body_first_500 = rawBody.slice(0, 500);

  // Parse as URL-encoded form data
  const params = new URLSearchParams(rawBody);
  const fields: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    fields[key] = value;
  }
  results.parsed_fields = fields;
  results.field_count = Object.keys(fields).length;

  // List all field names received
  results.field_names = Object.keys(fields).sort();

  // Hash verification — recompute hash from received fields
  const key = fields.key ?? "";
  const txnid = fields.txnid ?? "";
  const amount = fields.amount ?? "";
  const productinfo = fields.productinfo ?? "";
  const firstname = fields.firstname ?? "";
  const email = fields.email ?? "";
  const udf1 = fields.udf1 ?? "";
  const udf2 = fields.udf2 ?? "";
  const udf3 = fields.udf3 ?? "";
  const udf4 = fields.udf4 ?? "";
  const udf5 = fields.udf5 ?? "";

  const hashInput = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${PAYU_MERCHANT_SALT}`;
  const recomputedHash = await sha512(hashInput);
  const receivedHash = fields.hash ?? "";

  results.hash_verification = {
    hash_input: hashInput.replace(PAYU_MERCHANT_SALT, "****"),
    recomputed_hash_first32: recomputedHash.slice(0, 32),
    received_hash_first32: receivedHash.slice(0, 32),
    match: recomputedHash === receivedHash,
  };

  // Field-by-field comparison: what the hash expects vs what was received
  // Check for subtle differences (extra spaces, encoding issues, etc.)
  results.field_details = {
    key: { value: key, length: key.length, hex: toHex(key.slice(0, 20)) },
    txnid: { value: txnid, length: txnid.length },
    amount: { value: amount, length: amount.length },
    productinfo: { value: productinfo, length: productinfo.length, hex: toHex(productinfo) },
    firstname: { value: firstname, length: firstname.length, hex: toHex(firstname) },
    email: { value: email, length: email.length },
    udf1: { value: udf1, length: udf1.length },
    udf2: { value: udf2, length: udf2.length },
    udf3: { value: udf3, length: udf3.length },
    udf4: { value: udf4, length: udf4.length },
    udf5: { value: udf5, length: udf5.length },
    hash: { length: receivedHash.length },
  };

  // Check for fields that are MISSING (in hash but not in POST)
  const expectedFields = ["key", "txnid", "amount", "productinfo", "firstname", "email", "hash", "surl", "furl"];
  const missingFields = expectedFields.filter(f => !(f in fields));
  results.missing_expected_fields = missingFields;

  // Check for EXTRA fields (in POST but not expected)
  results.extra_fields = Object.keys(fields).filter(f => !expectedFields.includes(f));

  console.log("[payu-post-inspector] Received POST:", JSON.stringify(results, null, 2));

  // Return as HTML page (in case SDK expects HTML response)
  const html = `<!DOCTYPE html>
<html><head><title>POST Inspector</title></head>
<body>
<h1>POST Inspector Results</h1>
<h2>Hash Match: ${recomputedHash === receivedHash ? "YES ✅" : "NO ❌"}</h2>
<pre>${JSON.stringify(results, null, 2)}</pre>
</body></html>`;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html" },
  });
});

function toHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, "0"))
    .join(" ");
}
