/**
 * Test: Mobile 360 Consent-Based Identity Fetch
 *
 * Tests the auto-create consent flow in verify-identity edge function.
 * Uses Cashfree sandbox test phone 9999999999 (returns SUCCESS).
 *
 * Run: npx tsx supabase/functions/_tests/test-mobile360-consent.ts
 */

const SUPABASE_URL = "https://uowjtrzmszuaiokqxgir.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd2p0cnptc3p1YWlva3F4Z2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNDEwOTIsImV4cCI6MjA3ODgxNzA5Mn0.4KzwE_6dXvSOEc06gFmtObsm89qfTbwckbAVbT4imKg";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd2p0cnptc3p1YWlva3F4Z2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI0MTA5MiwiZXhwIjoyMDc4ODE3MDkyfQ.RiKkfFqA7ZlIgxW_pbkQ8YjvbCvzohPL244n0A-ubks";

// Cashfree sandbox test phone that returns SUCCESS
const TEST_PHONE = "+919999999999";
const TEST_NAME = "Test User";

async function supabaseAdmin(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : { _status: res.status };
  } catch {
    return { _status: res.status, _body: text };
  }
}

async function main() {
  console.log("=== Mobile 360 Consent Flow Test ===\n");

  // Step 1: Find or create test user with the Cashfree test phone
  console.log(`1. Finding/creating test user with phone ${TEST_PHONE}...`);

  // List existing users to find one with the test phone
  // Supabase stores phone without '+' prefix
  const phoneVariants = [TEST_PHONE, TEST_PHONE.replace("+", ""), TEST_PHONE.replace("+91", "")];
  const usersRes = await supabaseAdmin("/auth/v1/admin/users?per_page=100");
  let testUser = usersRes.users?.find(
    (u: { phone: string }) => phoneVariants.includes(u.phone)
  );

  if (!testUser) {
    console.log("   No existing user found. Creating test user...");
    const createRes = await supabaseAdmin("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        phone: TEST_PHONE,
        phone_confirm: true,
        user_metadata: { name: TEST_NAME },
      }),
    });

    if (createRes.id) {
      testUser = createRes;
      console.log(`   Created user: ${testUser.id}`);
    } else {
      console.error("   Failed to create user:", createRes);
      process.exit(1);
    }
  } else {
    console.log(`   Found existing user: ${testUser.id}`);
  }

  // Step 2: Ensure user exists in public.users table with phone
  console.log("\n2. Ensuring user record in public.users table...");
  const upsertRes = await supabaseAdmin("/rest/v1/users", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates",
    } as Record<string, string>,
    body: JSON.stringify({
      id: testUser.id,
      phone: TEST_PHONE,
      full_name: TEST_NAME,
    }),
  });
  // POST with Prefer: resolution=merge-duplicates is an upsert
  console.log(
    `   Upserted user in public.users (status: ${Array.isArray(upsertRes) ? "ok" : JSON.stringify(upsertRes).slice(0, 100)})`
  );

  // Step 3: Generate a JWT for the test user
  console.log("\n3. Generating session for test user...");
  const sessionRes = await supabaseAdmin(
    `/auth/v1/admin/users/${testUser.id}/factors`,
    { method: "GET" }
  );

  // Use admin generateLink to get a magic link, then exchange it
  const linkRes = await supabaseAdmin("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({
      type: "magiclink",
      phone: TEST_PHONE,
    }),
  });

  // The admin generate_link returns the user with a session-like token
  // But for phone users we need a different approach
  // Let's just use the admin token to sign in directly
  console.log("   Using admin OTP-less sign-in...");

  // Create a session by calling signInWithOtp and auto-confirming
  // Actually, for testing we can use the service role key to call the edge function
  // since the edge function's createAuthenticatedClient will extract the userId from JWT
  // But with service_role JWT, there's no user context.

  // Best approach: use admin to generate a proper user JWT
  // Supabase Admin API: POST /auth/v1/token?grant_type=password doesn't work for phone-only users
  // Instead, let's use the admin API to create a session directly

  // Alternative: Call signInWithOtp to send an OTP, then use admin to get the OTP
  // Actually the simplest: just verify OTP with a fake one using admin override

  // Let's try signing in with phone OTP (it will send an OTP via Twilio)
  // But we can't receive it. Instead, use the service role to get the user's OTP from the DB

  // Actually, the simplest approach for testing: use the Supabase token endpoint
  // with phone + a known OTP. But we need to first request the OTP.

  // Even simpler: use createClient with service role, then auth.admin.getUserById
  // to verify the user exists, then call the edge function with a manually-crafted token

  // SIMPLEST: Sign in via Supabase Auth with phone, but bypass OTP
  const otpSignInRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
      },
      body: JSON.stringify({
        phone: TEST_PHONE,
        password: "test_password_123",
      }),
    }
  );
  const otpSignInData = await otpSignInRes.json();

  let accessToken: string;

  if (otpSignInData.access_token) {
    accessToken = otpSignInData.access_token;
    console.log("   Got access token via password sign-in");
    console.log(`   Token preview: ${accessToken.slice(0, 50)}...`);
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    console.log(`   JWT sub: ${payload.sub}, role: ${payload.role}, aud: ${payload.aud}, exp: ${new Date(payload.exp * 1000).toISOString()}`);
  } else {
    // Set a password for the user and retry
    console.log("   Setting password for test user...");
    await supabaseAdmin(`/auth/v1/admin/users/${testUser.id}`, {
      method: "PUT",
      body: JSON.stringify({
        password: "test_password_123",
      }),
    });

    const retryRes = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
        },
        body: JSON.stringify({
          phone: TEST_PHONE,
          password: "test_password_123",
        }),
      }
    );
    const retryData = await retryRes.json();

    if (!retryData.access_token) {
      console.error("   Failed to get access token:", retryData);
      process.exit(1);
    }
    accessToken = retryData.access_token;
    console.log("   Got access token via password sign-in (after setting password)");
    console.log(`   Token preview: ${accessToken.slice(0, 50)}...`);
    // Decode JWT payload to check
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    console.log(`   JWT sub: ${payload.sub}, role: ${payload.role}, exp: ${new Date(payload.exp * 1000).toISOString()}`);
  }

  // Step 4: Call verify-identity with fetch_with_consent
  console.log("\n4. Calling verify-identity (fetch_with_consent)...");
  const consentTimestamp = new Date().toISOString();

  const verifyRes = await fetch(
    `${SUPABASE_URL}/functions/v1/verify-identity`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "fetch_with_consent",
        consent_timestamp: consentTimestamp,
        name: TEST_NAME,
      }),
    }
  );

  const verifyData = await verifyRes.json();
  console.log(`   Status: ${verifyRes.status}`);
  console.log(`   Response:`, JSON.stringify(verifyData, null, 2));

  // Step 5: Check identity_verifications table
  console.log("\n5. Checking identity_verifications table...");
  const verificationsRes = await supabaseAdmin(
    `/rest/v1/identity_verifications?user_id=eq.${testUser.id}&order=created_at.desc&limit=1`
  );
  if (Array.isArray(verificationsRes) && verificationsRes.length > 0) {
    const v = verificationsRes[0];
    console.log(`   Record found:`);
    console.log(`     - ID: ${v.id}`);
    console.log(`     - Status: ${v.status}`);
    console.log(`     - Verification ID: ${v.verification_id}`);
    console.log(`     - Consent Phone: ${v.consent_phone}`);
    console.log(`     - Consent IP: ${v.consent_ip}`);
    console.log(`     - Name: ${v.m360_full_name}`);
    console.log(
      `     - Has M360 data: ${!!(v.m360_gender || v.m360_date_of_birth || v.m360_pan_details)}`
    );
  } else {
    console.log("   No verification record found:", verificationsRes);
  }

  // Summary
  console.log("\n=== Test Results ===");
  if (verifyRes.status === 200 && verifyData.success) {
    console.log("PASS: Mobile 360 consent flow worked end-to-end");
    console.log(`  - Identity status: ${verifyData.data?.status}`);
    console.log(`  - Name: ${verifyData.data?.name}`);
    console.log(`  - Has PAN: ${verifyData.data?.has_pan}`);
    console.log(`  - Credit Score: ${verifyData.data?.credit_score}`);
  } else if (verifyRes.status === 200 && !verifyData.success) {
    console.log(
      "PARTIAL: Edge function responded but Cashfree returned non-success"
    );
    console.log(`  - Status: ${verifyData.data?.status}`);
    console.log(`  - Message: ${verifyData.data?.message}`);
    console.log(
      "  (This is expected if Cashfree sandbox returns DETAILS_NOT_FOUND for consent flow)"
    );
  } else {
    console.log(`FAIL: HTTP ${verifyRes.status}`);
    console.log(`  Response: ${JSON.stringify(verifyData)}`);
  }
}

main().catch(console.error);
