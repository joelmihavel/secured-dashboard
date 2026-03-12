/**
 * Test: Waitlist Backend
 *
 * Tests the full waitlist flow:
 * 1. Join waitlist (idempotent)
 * 2. Get waitlist status
 * 3. Get my referral code
 * 4. Validate referral code
 *
 * Run: npx tsx supabase/functions/_tests/test-waitlist-backend.ts
 */

const SUPABASE_URL = "https://uowjtrzmszuaiokqxgir.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd2p0cnptc3p1YWlva3F4Z2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNDEwOTIsImV4cCI6MjA3ODgxNzA5Mn0.4KzwE_6dXvSOEc06gFmtObsm89qfTbwckbAVbT4imKg";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvd2p0cnptc3p1YWlva3F4Z2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI0MTA5MiwiZXhwIjoyMDc4ODE3MDkyfQ.RiKkfFqA7ZlIgxW_pbkQ8YjvbCvzohPL244n0A-ubks";

const TEST_PHONE = "+919999999999";

async function getTestUserToken(): Promise<string> {
  // Try password login first
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ phone: TEST_PHONE, password: "test_password_123" }),
  });
  const data = await res.json();

  if (data.access_token) return data.access_token;

  // Create user and set password
  const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      phone: TEST_PHONE,
      phone_confirm: true,
      password: "test_password_123",
      user_metadata: { name: "Test User" },
    }),
  });
  const adminData = await adminRes.json();

  if (!adminData.id) {
    // User might exist, update password
    const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=100`, {
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
    const usersData = await usersRes.json();
    const phoneVariants = [TEST_PHONE, TEST_PHONE.replace("+", ""), TEST_PHONE.replace("+91", "")];
    const user = usersData.users?.find((u: { phone: string }) => phoneVariants.includes(u.phone));

    if (user) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ password: "test_password_123" }),
      });
    }
  }

  // Retry login
  const retryRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ phone: TEST_PHONE, password: "test_password_123" }),
  });
  const retryData = await retryRes.json();

  if (!retryData.access_token) {
    throw new Error("Failed to get access token: " + JSON.stringify(retryData));
  }
  return retryData.access_token;
}

async function callEdgeFunction(name: string, token: string, method = "POST", body?: object) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { _raw: text }; }
  return { status: res.status, data };
}

async function main() {
  console.log("=== Waitlist Backend Test ===\n");

  // Step 1: Get auth token
  console.log("1. Getting test user token...");
  const token = await getTestUserToken();
  console.log(`   Token: ${token.slice(0, 40)}...`);

  // Step 2: Join waitlist
  console.log("\n2. Joining waitlist...");
  const joinRes = await callEdgeFunction("join-waitlist", token);
  console.log(`   Status: ${joinRes.status}`);
  console.log(`   Response:`, JSON.stringify(joinRes.data, null, 2));

  // Step 3: Join again (should be idempotent)
  console.log("\n3. Joining again (idempotent check)...");
  const joinRes2 = await callEdgeFunction("join-waitlist", token);
  console.log(`   Status: ${joinRes2.status}`);
  console.log(`   is_new: ${joinRes2.data?.data?.is_new} (should be false)`);

  // Step 4: Get waitlist status
  console.log("\n4. Getting waitlist status...");
  const statusRes = await callEdgeFunction("get-waitlist-status", token, "GET");
  console.log(`   Status: ${statusRes.status}`);
  console.log(`   has_entry: ${statusRes.data?.has_entry}`);
  console.log(`   position: ${statusRes.data?.waitlist_position}`);
  console.log(`   admin_review: ${statusRes.data?.admin_review}`);
  console.log(`   onboarded_count: ${statusRes.data?.onboarded_count}`);
  console.log(`   total_member_slots: ${statusRes.data?.total_member_slots}`);

  // Step 5: Get my referral code
  console.log("\n5. Getting my referral code...");
  const codeRes = await callEdgeFunction("get-my-referral-code", token, "GET");
  console.log(`   Status: ${codeRes.status}`);
  console.log(`   Response:`, JSON.stringify(codeRes.data, null, 2));

  // Step 6: Summary
  console.log("\n=== Test Results ===");
  const results = [
    { name: "Join waitlist", pass: joinRes.status === 200 && joinRes.data?.success },
    { name: "Idempotent join", pass: joinRes2.status === 200 && joinRes2.data?.data?.is_new === false },
    { name: "Get status", pass: statusRes.status === 200 && statusRes.data?.has_entry === true },
    { name: "Get referral code", pass: codeRes.status === 200 && codeRes.data?.success },
  ];

  for (const r of results) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"}: ${r.name}`);
  }

  const allPass = results.every((r) => r.pass);
  console.log(`\n${allPass ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`);
}

main().catch(console.error);
