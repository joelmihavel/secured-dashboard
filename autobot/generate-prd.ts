#!/usr/bin/env npx tsx
/**
 * generate-prd.ts — Decomposes the 42-story prd.json into ~130 Ralph micro-stories.
 *
 * Reads: autobot/prd.json (current backlog), buildbot/config/screen-routes.json
 * Writes: autobot/prd.json (new decomposed format)
 *
 * Usage: npx tsx autobot/generate-prd.ts [--dry-run]
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OLD_PRD_PATH = path.join(__dirname, "prd.json");
const SCREEN_ROUTES_PATH = path.join(
  PROJECT_ROOT,
  "buildbot/config/screen-routes.json"
);

const DRY_RUN = process.argv.includes("--dry-run");

interface OldStory {
  id: string;
  title: string;
  routeKey?: string;
  route?: string;
  appFile?: string;
  appFiles?: string[];
  figmaStates?: Array<{ figmaId: string; state: string }>;
  hasDottedPattern?: boolean;
  priority?: number;
  status?: string;
  passes?: boolean;
  notes?: string;
  description?: string;
  dependsOn?: string[];
  existingFunctions?: string[];
  existingTests?: string[];
  tables?: string[];
}

interface MicroStory {
  id: string;
  track: string;
  title: string;
  verify: string;
  dependsOn: string[];
  acceptanceCriteria: string[];
  passes: boolean;
  status: string;
  failCount: number;
  failNotes: string;
  estimatedTokens: number;
  contextDocs: string[];
  originalStoryId?: string;
}

interface NewPrd {
  project: string;
  description: string;
  lastUpdated: string;
  stories: MicroStory[];
  meta: {
    totalStories: number;
    completed: number;
    failed: number;
    lastIteration: number;
    generatedFrom: string;
  };
}

// Load existing PRD
const oldPrd = JSON.parse(fs.readFileSync(OLD_PRD_PATH, "utf8"));

// Load screen routes
let screenRoutes: any = { routes: {} };
if (fs.existsSync(SCREEN_ROUTES_PATH)) {
  screenRoutes = JSON.parse(fs.readFileSync(SCREEN_ROUTES_PATH, "utf8"));
}

// Track which old stories are completed
const completedOldIds = new Set<string>();
const inProgressOldIds = new Set<string>();

function collectOldStoryStatuses(workStream: any) {
  if (!workStream?.stories) return;
  for (const s of workStream.stories) {
    if (s.passes === true || s.status === "completed") {
      completedOldIds.add(s.id);
    } else if (s.status === "in-progress") {
      inProgressOldIds.add(s.id);
    }
  }
}

for (const ws of Object.values(oldPrd.workStreams || {})) {
  collectOldStoryStatuses(ws);
}

const stories: MicroStory[] = [];
let storyCounter = 0;

function nextId(prefix: string): string {
  storyCounter++;
  return `${prefix}-${String(storyCounter).padStart(3, "0")}`;
}

// ============================================================================
// UI Stories — 4 phases per screen: extract, build, verify, test
// ============================================================================

const uiStories: OldStory[] = oldPrd.workStreams?.ui?.stories || [];

for (const ui of uiStories) {
  const routeKey = ui.routeKey || ui.id.toLowerCase();
  const figmaIds = (ui.figmaStates || []).map((s) => s.figmaId);
  const isCompleted = completedOldIds.has(ui.id);

  // Phase 1: Extract blueprints
  const extractId = nextId("UI");
  stories.push({
    id: extractId,
    track: "ui",
    title: `Extract blueprints for ${routeKey} (${figmaIds.join(", ")})`,
    verify: `bash autobot/verify/ui-extract.sh ${routeKey}`,
    dependsOn: [],
    acceptanceCriteria: [
      `Blueprint JSON exists for each figmaId: ${figmaIds.join(", ")}`,
      "All baseline PNGs pass validate-assets.sh",
      "Blueprint has >10 nodes or valid componentTree",
    ],
    passes: isCompleted,
    status: isCompleted ? "completed" : "pending",
    failCount: 0,
    failNotes: "",
    estimatedTokens: 15000,
    contextDocs: ["autobot/context/ui.md"],
    originalStoryId: ui.id,
  });

  // Phase 2: Build screen
  const buildId = nextId("UI");
  stories.push({
    id: buildId,
    track: "ui",
    title: `Build ${routeKey} screen from blueprint`,
    verify: `bash autobot/verify/ui-build.sh ${routeKey}`,
    dependsOn: [extractId],
    acceptanceCriteria: [
      `Screen file exists at ${ui.appFile || ui.appFiles?.[0] || "rn-app/app/..."}`,
      "TypeScript compiles with zero errors",
      "Uses shared components only (no inline rebuilds)",
      "Font weights use fontFamily mapping",
      ui.hasDottedPattern
        ? "DottedPattern uses correct backgroundShape key"
        : "No DottedPattern needed",
    ],
    passes: isCompleted,
    status: isCompleted ? "completed" : "pending",
    failCount: 0,
    failNotes: "",
    estimatedTokens: 40000,
    contextDocs: ["autobot/context/ui.md"],
    originalStoryId: ui.id,
  });

  // Phase 3: Verify with BuildBot
  const verifyId = nextId("UI");
  stories.push({
    id: verifyId,
    track: "ui",
    title: `Verify ${routeKey} passes BuildBot pipeline`,
    verify: `bash autobot/verify/ui-verify.sh ${routeKey}`,
    dependsOn: [buildId],
    acceptanceCriteria: [
      `verify-screen.ts --screen ${routeKey} --skip-maestro exits 0`,
      ui.hasDottedPattern
        ? "ODiff < 18% (DottedPattern threshold)"
        : "ODiff < 3%",
      "Coverage >= 80%",
      "No P0 inspector issues",
    ],
    passes: isCompleted,
    status: isCompleted ? "completed" : "pending",
    failCount: 0,
    failNotes: "",
    estimatedTokens: 30000,
    contextDocs: ["autobot/context/ui.md"],
    originalStoryId: ui.id,
  });

  // Phase 4: Write tests
  const testId = nextId("UI");
  stories.push({
    id: testId,
    track: "ui",
    title: `Write tests for ${routeKey} screen`,
    verify: `bash autobot/verify/ui-test.sh ${routeKey}`,
    dependsOn: [verifyId],
    acceptanceCriteria: [
      "Jest snapshot test exists and passes",
      "Key interactions tested (button presses, navigation)",
      "All screen states covered",
    ],
    passes: isCompleted,
    status: isCompleted ? "completed" : "pending",
    failCount: 0,
    failNotes: "",
    estimatedTokens: 15000,
    contextDocs: ["autobot/context/ui.md", "autobot/context/testing.md"],
    originalStoryId: ui.id,
  });
}

// ============================================================================
// Backend Stories — 2 phases per story: implement, test
// ============================================================================

const backendStories: OldStory[] = oldPrd.workStreams?.backend?.stories || [];

for (const be of backendStories) {
  const isCompleted = completedOldIds.has(be.id);
  const fnName = be.existingFunctions?.[0] || be.id.toLowerCase();

  // Phase 1: Implement
  const implId = nextId("BE");
  stories.push({
    id: implId,
    track: "backend",
    title: `Implement: ${be.title}`,
    verify: `bash autobot/verify/backend-impl.sh ${fnName}`,
    dependsOn: (be.dependsOn || []).filter((d) => !completedOldIds.has(d)),
    acceptanceCriteria: [
      be.description || be.title,
      "Edge function compiles with deno check",
      "Follows existing patterns in supabase/functions/_shared/",
    ],
    passes: isCompleted,
    status: isCompleted ? "completed" : be.status === "in-progress" ? "in-progress" : "pending",
    failCount: 0,
    failNotes: isCompleted ? "" : be.notes || "",
    estimatedTokens: 30000,
    contextDocs: ["autobot/context/backend.md"],
    originalStoryId: be.id,
  });

  // Phase 2: Test
  const testId = nextId("BE");
  stories.push({
    id: testId,
    track: "test",
    title: `Test: ${be.title}`,
    verify: `bash autobot/verify/backend-test.sh ${fnName}`,
    dependsOn: [implId],
    acceptanceCriteria: [
      "Deno test file exists and passes",
      "Uses existing mock helpers where applicable",
      "Covers happy path and error cases",
    ],
    passes: isCompleted,
    status: isCompleted ? "completed" : "pending",
    failCount: 0,
    failNotes: "",
    estimatedTokens: 20000,
    contextDocs: ["autobot/context/backend.md", "autobot/context/testing.md"],
    originalStoryId: be.id,
  });
}

// ============================================================================
// State Stories — 2 phases per story: implement, test
// ============================================================================

const stateStories: OldStory[] = oldPrd.workStreams?.state?.stories || [];

for (const st of stateStories) {
  const isCompleted = completedOldIds.has(st.id);
  const name = st.id.toLowerCase();

  // Phase 1: Implement
  const implId = nextId("ST");
  stories.push({
    id: implId,
    track: "state",
    title: `Implement: ${st.title}`,
    verify: `bash autobot/verify/state-impl.sh ${name}`,
    dependsOn: (st.dependsOn || [])
      .map((d) => {
        // Map old dependency IDs to new ones
        const depStory = stories.find(
          (s) => s.originalStoryId === d && s.verify.includes("impl")
        );
        return depStory?.id || d;
      })
      .filter((d) => !completedOldIds.has(d)),
    acceptanceCriteria: [
      st.description || st.title,
      "TypeScript compiles with zero errors",
    ],
    passes: isCompleted,
    status: isCompleted ? "completed" : "pending",
    failCount: 0,
    failNotes: "",
    estimatedTokens: 25000,
    contextDocs: ["autobot/context/state.md"],
    originalStoryId: st.id,
  });

  // Phase 2: Test
  const testId = nextId("ST");
  stories.push({
    id: testId,
    track: "test",
    title: `Test: ${st.title}`,
    verify: `bash autobot/verify/state-test.sh ${name}`,
    dependsOn: [implId],
    acceptanceCriteria: [
      "Jest tests exist and pass",
      "State transitions covered",
      "Edge cases tested",
    ],
    passes: isCompleted,
    status: isCompleted ? "completed" : "pending",
    failCount: 0,
    failNotes: "",
    estimatedTokens: 15000,
    contextDocs: ["autobot/context/state.md", "autobot/context/testing.md"],
    originalStoryId: st.id,
  });
}

// ============================================================================
// Production Stories — single phase each
// ============================================================================

const prodStories: OldStory[] = oldPrd.workStreams?.production?.stories || [];

for (const pr of prodStories) {
  const isCompleted = completedOldIds.has(pr.id);
  const name = pr.id.toLowerCase();

  const implId = nextId("PR");
  stories.push({
    id: implId,
    track: "state", // Production stories don't need simulator
    title: `${pr.title}`,
    verify: `bash autobot/verify/state-impl.sh ${name}`,
    dependsOn: [],
    acceptanceCriteria: [
      pr.description || pr.title,
      "TypeScript compiles with zero errors",
      "No regressions in existing tests",
    ],
    passes: isCompleted,
    status: isCompleted ? "completed" : "pending",
    failCount: 0,
    failNotes: "",
    estimatedTokens: 20000,
    contextDocs: ["autobot/context/production.md"],
    originalStoryId: pr.id,
  });
}

// ============================================================================
// Testing Stories — single phase each
// ============================================================================

const testStories: OldStory[] = oldPrd.workStreams?.testing?.stories || [];

for (const te of testStories) {
  const isCompleted = completedOldIds.has(te.id);

  const implId = nextId("TE");
  stories.push({
    id: implId,
    track: "test",
    title: `${te.title}`,
    verify: `cd rn-app && npx jest --passWithNoTests`,
    dependsOn: (te.dependsOn || [])
      .map((d) => {
        const depStory = stories.find(
          (s) => s.originalStoryId === d && s.verify.includes("impl")
        );
        return depStory?.id || d;
      })
      .filter((d) => !completedOldIds.has(d)),
    acceptanceCriteria: [te.description || te.title],
    passes: isCompleted,
    status: isCompleted ? "completed" : "pending",
    failCount: 0,
    failNotes: "",
    estimatedTokens: 25000,
    contextDocs: ["autobot/context/testing.md"],
    originalStoryId: te.id,
  });
}

// ============================================================================
// New stories: Routing, Session, Mock Data
// ============================================================================

// RT-01: Deep link routing
stories.push({
  id: nextId("RT"),
  track: "state",
  title: "Configure deep link routing with flentsecured:// prefix",
  verify: "bash autobot/verify/state-impl.sh deep-links",
  dependsOn: [], // D02 already completed
  acceptanceCriteria: [
    "Linking config added to expo-router",
    "flentsecured://payment/{id}, flentsecured://waitlist, flentsecured://agreement/upload mapped",
    "notifications.ts handleNotificationResponse uses typed deep links",
    "TypeScript compiles",
  ],
  passes: false,
  status: "pending",
  failCount: 0,
  failNotes: "",
  estimatedTokens: 20000,
  contextDocs: ["autobot/context/state.md", "autobot/context/expo.md"],
});

// RT-02: Setup flow state machine
stories.push({
  id: nextId("RT"),
  track: "state",
  title: "Add useSetupGuard hook for sequential setup flow enforcement",
  verify: "bash autobot/verify/state-test.sh useSetupGuard",
  dependsOn: [], // C02 already completed
  acceptanceCriteria: [
    "useSetupGuard.ts hook created",
    "Checks completed steps before allowing navigation",
    "Wired to setupStore",
    "Jest test passes",
  ],
  passes: false,
  status: "pending",
  failCount: 0,
  failNotes: "",
  estimatedTokens: 15000,
  contextDocs: ["autobot/context/state.md"],
});

// RT-03: Clean up unused routes
stories.push({
  id: nextId("RT"),
  track: "state",
  title: "Clean up unused routes (profile-payment, waitlist/approved)",
  verify: "cd rn-app && npx tsc --noEmit",
  dependsOn: [],
  acceptanceCriteria: [
    "Empty (profile-payment)/_layout.tsx removed or justified",
    "(waitlist)/approved.tsx audited",
    "TypeScript compiles",
  ],
  passes: false,
  status: "pending",
  failCount: 0,
  failNotes: "",
  estimatedTokens: 10000,
  contextDocs: ["autobot/context/state.md"],
});

// SM-01: Session resume
stories.push({
  id: nextId("SM"),
  track: "state",
  title: "Add useSessionMonitor for session resume on app foreground",
  verify: "bash autobot/verify/state-test.sh useSessionMonitor",
  dependsOn: [],
  acceptanceCriteria: [
    "useSessionMonitor.ts hook created",
    "Uses AppState listener to detect foreground",
    "Calls supabase.auth.getSession() on foreground",
    "Redirects to auth if session expired",
    "Wired in app/_layout.tsx",
  ],
  passes: false,
  status: "pending",
  failCount: 0,
  failNotes: "",
  estimatedTokens: 20000,
  contextDocs: ["autobot/context/state.md"],
});

// SM-02: Verification timeout
stories.push({
  id: nextId("SM"),
  track: "state",
  title: "Add verification timeout recovery to auth flow",
  verify: "bash autobot/verify/state-test.sh auth-timeout",
  dependsOn: [],
  acceptanceCriteria: [
    "30s timeout on verifying state",
    "Resets to otp_sent with error message on timeout",
    "Jest test covers timeout scenario",
  ],
  passes: false,
  status: "pending",
  failCount: 0,
  failNotes: "",
  estimatedTokens: 15000,
  contextDocs: ["autobot/context/state.md"],
});

// MD-01: Expand mock data
stories.push({
  id: nextId("MD"),
  track: "test",
  title: "Expand uiTestData.ts with error and edge-case states",
  verify: "cd rn-app && npx jest --passWithNoTests",
  dependsOn: [],
  acceptanceCriteria: [
    "Network timeout states added",
    "API error responses (400/500/429) added",
    "Expired OTP, passed deadline, refund states added",
    "Existing tests still pass",
  ],
  passes: false,
  status: "pending",
  failCount: 0,
  failNotes: "",
  estimatedTokens: 15000,
  contextDocs: ["autobot/context/testing.md"],
});

// MD-02: Backend seed data
stories.push({
  id: nextId("MD"),
  track: "backend",
  title: "Expand backend seed data for comprehensive E2E testing",
  verify: "bash autobot/verify/backend-impl.sh seed-e2e",
  dependsOn: [],
  acceptanceCriteria: [
    "seed-e2e.sql created with diverse test scenarios",
    "Users in every KYC state",
    "Payments with various outcomes",
    "Documents in every processing state",
  ],
  passes: false,
  status: "pending",
  failCount: 0,
  failNotes: "",
  estimatedTokens: 20000,
  contextDocs: ["autobot/context/backend.md", "autobot/context/testing.md"],
});

// MD-03: Backend test mode
const md02Id = stories[stories.length - 1].id;
stories.push({
  id: nextId("MD"),
  track: "backend",
  title: "Create backend test mode with X-Test-Mode header",
  verify: "bash autobot/verify/backend-test.sh test-mode",
  dependsOn: [md02Id],
  acceptanceCriteria: [
    "test-mode.ts shared utility created",
    "Critical edge functions check X-Test-Mode header",
    "When test mode: use mock helpers instead of real external APIs",
    "Test passes with mock responses",
  ],
  passes: false,
  status: "pending",
  failCount: 0,
  failNotes: "",
  estimatedTokens: 25000,
  contextDocs: ["autobot/context/backend.md"],
});

// ============================================================================
// Build final PRD
// ============================================================================

const completedCount = stories.filter((s) => s.passes === true).length;

const newPrd: NewPrd = {
  project: "Flent Secured v2",
  description:
    "Ralph-compatible micro-story backlog. Each story fits one context window with an explicit verify command.",
  lastUpdated: new Date().toISOString(),
  stories,
  meta: {
    totalStories: stories.length,
    completed: completedCount,
    failed: 0,
    lastIteration: 0,
    generatedFrom: "autobot/generate-prd.ts",
  },
};

// Output
const output = JSON.stringify(newPrd, null, 2) + "\n";

if (DRY_RUN) {
  console.log("=== DRY RUN ===");
  console.log(`Total stories: ${stories.length}`);
  console.log(`Completed: ${completedCount}`);
  console.log(`Pending: ${stories.length - completedCount}`);
  console.log("");
  console.log("Story breakdown:");
  const tracks = new Map<string, number>();
  for (const s of stories) {
    tracks.set(s.track, (tracks.get(s.track) || 0) + 1);
  }
  for (const [track, count] of tracks) {
    console.log(`  ${track}: ${count}`);
  }
  console.log("");
  console.log("First 5 stories:");
  for (const s of stories.slice(0, 5)) {
    console.log(`  ${s.id}: ${s.title} [${s.status}]`);
  }
  console.log("");
  console.log("New stories (routing/session/mock):");
  for (const s of stories.filter(
    (s) =>
      s.id.startsWith("RT-") ||
      s.id.startsWith("SM-") ||
      s.id.startsWith("MD-")
  )) {
    console.log(`  ${s.id}: ${s.title}`);
  }
} else {
  // Backup old PRD
  const backupPath = path.join(__dirname, "prd.json.bak");
  fs.writeFileSync(backupPath, fs.readFileSync(OLD_PRD_PATH));
  console.log(`Backed up old PRD to ${backupPath}`);

  // Write new PRD
  fs.writeFileSync(OLD_PRD_PATH, output);
  console.log(`Wrote new PRD with ${stories.length} stories to ${OLD_PRD_PATH}`);
  console.log(`  Completed: ${completedCount}`);
  console.log(`  Pending: ${stories.length - completedCount}`);
}
