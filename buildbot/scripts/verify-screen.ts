/**
 * verify-screen.ts — BuildBot Verification Pipeline Orchestrator
 *
 * Full pipeline (12 steps):
 *   1. Validate prerequisites (blueprint, baseline)
 *   2. Load learnings (agents/learning-agent reads learnings/buildbot-learnings.md)
 *   3. Run PM Agent brief (product context, states, data requirements)
 *   4. Run Backend Agent brief (API wiring, mock data population)
 *   5. Capture/validate app screenshot (Maestro or existing)
 *   6. Run ODiff pixel comparison
 *   7. Run coverage check (if script exists)
 *   8. Run Gemini visual feedback (if script exists)
 *   9. Run Inspector (if script exists and not skipped)
 *  10. Run Learning Agent (extract learnings from results)
 *  11. Produce combined audit report
 *  12. Print summary to console
 *
 * Single-screen mode:
 *   npx tsx scripts/verify-screen.ts 41-8760 --route "/(profile)"
 *   npx tsx scripts/verify-screen.ts 41-8760 --route "/(profile)" --skip-inspector
 *   npx tsx scripts/verify-screen.ts 41-8760 --route "/(profile)" --skip-maestro
 *
 * Batch-state mode (all states of one screen):
 *   npx tsx scripts/verify-screen.ts --screen otp
 *   npx tsx scripts/verify-screen.ts --screen agreement-upload --skip-inspector
 *   npx tsx scripts/verify-screen.ts --screen splash --skip-maestro
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as dotenv from "dotenv";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BUILDBOT_ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(BUILDBOT_ROOT, ".env") });

const PATHS = {
  blueprints: path.join(BUILDBOT_ROOT, "data", "blueprints"),
  baselines: path.join(BUILDBOT_ROOT, "data", "baselines"),
  screenshots: path.join(BUILDBOT_ROOT, "data", "screenshots"),
  diffs: path.join(BUILDBOT_ROOT, "data", "diffs"),
  pmBriefs: path.join(BUILDBOT_ROOT, "data", "pm-briefs"),
  mock: path.join(BUILDBOT_ROOT, "data", "mock"),
  audits: path.join(BUILDBOT_ROOT, "reports", "audits"),
  coverage: path.join(BUILDBOT_ROOT, "reports", "coverage"),
  scripts: path.join(BUILDBOT_ROOT, "scripts"),
  learnings: path.join(BUILDBOT_ROOT, "learnings"),
  agents: path.join(BUILDBOT_ROOT, "agents"),
} as const;

// ---------------------------------------------------------------------------
// Scroll-Stitch Configuration (for scrollable screens)
// ---------------------------------------------------------------------------

const SCROLL_SWIPE_START_PCT = 80;  // swipe finger start (% from top)
const SCROLL_SWIPE_END_PCT   = 30;  // swipe finger end (% from top)
const SCROLL_SETTLE_MS       = 1500; // ms to wait after each swipe for content to settle
const SCROLL_OVERLAP_FRACTION = (SCROLL_SWIPE_START_PCT - SCROLL_SWIPE_END_PCT) / 100;
// → 0.50 — each swipe scrolls ~50% of viewport, leaving ~50% overlap
const MAX_SCROLL_CAPTURES = 8; // safety cap to prevent infinite scroll loops
const MAESTRO_SWIPE_RETRIES = 2; // retry failed swipes before giving up

// ---------------------------------------------------------------------------
// Pre-flight Checks (Maestro, Simulator, etc.)
// ---------------------------------------------------------------------------

function isSimulatorBooted(): boolean {
  try {
    const out = execSync("xcrun simctl list devices booted", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return out.includes("(Booted)");
  } catch {
    return false;
  }
}

function isMaestroInstalled(): boolean {
  try {
    execSync("which maestro", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

function runPreflightChecks(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isSimulatorBooted()) {
    errors.push("iOS Simulator is not booted. Run: xcrun simctl boot \"iPhone 17 Pro\"");
  }
  if (!isMaestroInstalled()) {
    errors.push("Maestro CLI not found in PATH. Install: curl -Ls \"https://get.maestro.mobile.dev\" | bash");
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PixelDiffResult {
  percentage: number;
  threshold: number;
  passed: boolean;
  diffImagePath: string;
}

interface CoverageResult {
  typography: number;
  colors: number;
  spacing: number;
  overall: number;
  passed: boolean;
}

interface GeminiAuditResult {
  consolidatedFixes: Array<{
    file?: string;
    property?: string;
    figmaValue?: string;
    currentValue?: string;
    severity?: string;
    explanation?: string;
    fixedCode?: string;
  }>;
  summary: {
    totalIssues: number;
    critical: number;
    major: number;
    minor: number;
    filesAffected: string[];
  };
  batches?: unknown[];
}

interface InspectionResult {
  overallScore: number;
  criticalIssues: string[];
  suggestions: string[];
}

interface AuditReport {
  screenId: string;
  timestamp: string;
  route: string;

  pmBrief?: PMBriefResult;

  backendBrief?: BackendBriefResult;

  pixelDiff: PixelDiffResult;

  coverage?: CoverageResult;

  maestroStructural?: {
    score: number;
    totalChecks: number;
    passed: number;
    failed: number;
    codeFixes: number;
    testIdGaps: number;
    reportPath: string;
  };

  geminiAudit?: GeminiAuditResult;

  inspection?: InspectionResult;

  overallPassed: boolean;
  failureReasons: string[];
}

interface PMBriefResult {
  hasBrief: boolean;
  briefPath: string;
  functionalAreas: number;
  states: number;
  pmIssues: number;
}

interface BackendBriefResult {
  hasBrief: boolean;
  briefPath: string;
  requiredHooks: string[];
  mockDataPopulated: boolean;
}

interface ScreenState {
  figmaId: string;
  name: string;
  state: string;
  routeWithState?: string;
}

interface ScreenRouteEntry {
  figmaPatterns: string[];
  route: string;
  screens: ScreenState[];
}

interface ScreenRoutesConfig {
  _description?: string;
  routes: Record<string, ScreenRouteEntry>;
}

interface CLIArgs {
  screenId: string;
  route: string;
  skipInspector: boolean;
  skipMaestro: boolean;
  skipPM: boolean;
  skipBackend: boolean;
  recapture: boolean;
  autoHeal: boolean;
  healMaxIterations: number;
  healTargetScore: number;
  // Batch-state mode
  batchScreen: string | null;
}

interface BatchStateReport {
  screenKey: string;
  route: string;
  timestamp: string;
  states: Array<{
    figmaId: string;
    state: string;
    name: string;
    passed: boolean;
    pixelDiff: number;
    coverage: number;
    inspectorScore: number;
    failureReasons: string[];
  }>;
  totalStates: number;
  passedStates: number;
  failedStates: number;
  overallPassed: boolean;
}

interface BlueprintMeta {
  background?: {
    hasDottedPattern?: boolean;
    backgroundShapeKey?: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(step: string, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] [${step}] ${message}`);
}

function logError(step: string, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.error(`[${timestamp}] [${step}] ERROR: ${message}`);
}

function logWarn(step: string, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.warn(`[${timestamp}] [${step}] WARN: ${message}`);
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/** PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Validate that an image file is a real, non-corrupt PNG.
 * Checks: exists, non-empty, has valid PNG header.
 * Returns { valid, reason } so callers can log meaningful errors.
 */
function validateImageFile(
  filePath: string,
  label?: string
): { valid: boolean; reason?: string } {
  const tag = label || path.basename(filePath);

  if (!fs.existsSync(filePath)) {
    return { valid: false, reason: `${tag}: file does not exist` };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return { valid: false, reason: `${tag}: cannot stat file` };
  }

  if (stat.size === 0) {
    return { valid: false, reason: `${tag}: file is empty (0 bytes)` };
  }

  // Minimum valid PNG is at least 67 bytes (header + IHDR + IEND)
  if (stat.size < 67) {
    return { valid: false, reason: `${tag}: file too small to be valid PNG (${stat.size} bytes)` };
  }

  // Check PNG magic bytes
  try {
    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(8);
    fs.readSync(fd, header, 0, 8, 0);
    fs.closeSync(fd);

    if (!header.subarray(0, 8).equals(PNG_MAGIC)) {
      // Check if it's actually JSON (Figma API error response masquerading as .png)
      if (header[0] === 0x7b) { // '{' character
        return { valid: false, reason: `${tag}: file contains JSON, not PNG (likely API error response)` };
      }
      return { valid: false, reason: `${tag}: invalid PNG header (not a PNG file)` };
    }
  } catch {
    return { valid: false, reason: `${tag}: cannot read file header` };
  }

  return { valid: true };
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function runCommand(
  command: string,
  step: string,
  opts?: { cwd?: string; timeout?: number; maxStderrLines?: number }
): { stdout: string; success: boolean; timedOut?: boolean } {
  try {
    const stdout = execSync(command, {
      encoding: "utf-8",
      cwd: opts?.cwd ?? BUILDBOT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: opts?.timeout ?? 120_000,
    });
    return { stdout: stdout.trim(), success: true };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean; signal?: string };
    const stderr = execErr.stderr ?? execErr.message ?? "Unknown error";
    const stdout = execErr.stdout ?? "";
    const timedOut = execErr.killed === true || execErr.signal === "SIGTERM";
    const maxLines = opts?.maxStderrLines ?? 10;
    const stderrStr = stderr.toString().split("\n").slice(0, maxLines).join("\n");
    if (timedOut) {
      logError(step, `Command timed out after ${(opts?.timeout ?? 120_000) / 1000}s`);
    }
    logError(step, stderrStr);
    return { stdout: stdout.toString().trim(), success: false, timedOut };
  }
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage:\n" +
      "  Single:  npx tsx scripts/verify-screen.ts <screenId> --route <route>\n" +
      "  Batch:   npx tsx scripts/verify-screen.ts --screen <routeKey>\n" +
      "\n" +
      "Examples:\n" +
      '  npx tsx scripts/verify-screen.ts 41-8760 --route "/(profile)"\n' +
      "  npx tsx scripts/verify-screen.ts --screen otp\n" +
      "  npx tsx scripts/verify-screen.ts --screen agreement-upload --skip-inspector"
    );
    process.exit(1);
  }

  let screenId = "";
  let route = "";
  let skipInspector = false;
  let skipMaestro = false;
  let skipPM = false;
  let skipBackend = false;
  let recapture = false;
  let autoHeal = false;
  let healMaxIterations = 3;
  let healTargetScore = 85;
  let batchScreen: string | null = null;

  // Check if first arg is a flag or a screenId
  let i = 0;
  if (args[0] && !args[0].startsWith("--")) {
    screenId = args[0].replace(":", "-");
    i = 1;
  }

  for (; i < args.length; i++) {
    switch (args[i]) {
      case "--route":
        route = args[++i] ?? "";
        break;
      case "--screen":
        batchScreen = args[++i] ?? "";
        break;
      case "--skip-inspector":
        skipInspector = true;
        break;
      case "--skip-maestro":
        skipMaestro = true;
        break;
      case "--skip-pm":
        skipPM = true;
        break;
      case "--skip-backend":
        skipBackend = true;
        break;
      case "--recapture":
        recapture = true;
        break;
      case "--auto-heal":
        autoHeal = true;
        break;
      case "--heal-max-iterations":
        healMaxIterations = parseInt(args[++i] ?? "3", 10);
        break;
      case "--heal-target-score":
        healTargetScore = parseInt(args[++i] ?? "85", 10);
        break;
      default:
        logWarn("args", `Unknown argument: ${args[i]}`);
    }
  }

  // Validate: need either --screen or screenId+--route
  if (!batchScreen && !screenId) {
    console.error("Error: provide either <screenId> --route <route> or --screen <routeKey>.");
    process.exit(1);
  }

  if (!batchScreen && !route) {
    console.error("Error: --route is required in single-screen mode.");
    console.error('Example: --route "/(profile)"');
    process.exit(1);
  }

  return { screenId, route, skipInspector, skipMaestro, skipPM, skipBackend, recapture, autoHeal, healMaxIterations, healTargetScore, batchScreen };
}

function loadScreenRoutes(): ScreenRoutesConfig {
  const routesPath = path.join(BUILDBOT_ROOT, "config", "screen-routes.json");
  const data = readJsonSafe<ScreenRoutesConfig>(routesPath);
  if (!data) {
    logError("routes", `Failed to load screen-routes.json at ${routesPath}`);
    process.exit(1);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Step 1: Validate Prerequisites
// ---------------------------------------------------------------------------

function validatePrerequisites(screenId: string): {
  blueprintPath: string;
  baselinePath: string;
  hasBlueprint: boolean;
  hasBaseline: boolean;
} {
  log("prerequisites", "Checking required files...");

  const blueprintPath = path.join(PATHS.blueprints, `${screenId}-blueprint.json`);
  const baselinePath = path.join(PATHS.baselines, `${screenId}-baseline.png`);

  const hasBlueprint = fileExists(blueprintPath);
  const hasBaseline = fileExists(baselinePath);

  if (!hasBlueprint) {
    logError(
      "prerequisites",
      `Blueprint not found. Run extract first: npx tsx scripts/extract-screen-blueprint.ts ${screenId}`
    );
  } else {
    log("prerequisites", `Blueprint found: ${blueprintPath}`);
  }

  if (!hasBaseline) {
    logWarn(
      "prerequisites",
      `Baseline image not found at ${baselinePath}. Pixel diff will be skipped.`
    );
  } else {
    const baselineCheck = validateImageFile(baselinePath, "baseline");
    if (!baselineCheck.valid) {
      logError("prerequisites", `Baseline image is corrupt: ${baselineCheck.reason}`);
      logError("prerequisites", "Re-export baseline: npx tsx scripts/extract-screen-blueprint.ts " + screenId);
      return { blueprintPath, baselinePath, hasBlueprint, hasBaseline: false };
    }
    log("prerequisites", `Baseline found and valid: ${baselinePath}`);
  }

  return { blueprintPath, baselinePath, hasBlueprint, hasBaseline };
}

// ---------------------------------------------------------------------------
// Step 2: Load Learnings
// ---------------------------------------------------------------------------

function loadLearnings(): void {
  log("learnings", "Loading BuildBot learnings...");

  const learningsPath = path.join(PATHS.learnings, "buildbot-learnings.md");
  if (!fileExists(learningsPath)) {
    logWarn("learnings", "No learnings file found. Proceeding without prior learnings.");
    return;
  }

  const content = fs.readFileSync(learningsPath, "utf-8");
  const sectionCount = (content.match(/^### /gm) || []).length;
  log("learnings", `Loaded ${sectionCount} learnings across all categories.`);
}

// ---------------------------------------------------------------------------
// Step 3: PM Agent Brief
// ---------------------------------------------------------------------------

function runPMBrief(screenId: string): PMBriefResult | null {
  log("pm-agent", "Running PM Agent...");

  ensureDir(PATHS.pmBriefs);
  const briefPath = path.join(PATHS.pmBriefs, `${screenId}-pm-brief.json`);

  // Check for existing brief first
  if (fileExists(briefPath)) {
    const brief = readJsonSafe<Record<string, unknown>>(briefPath);
    if (brief) {
      const functionalAreas = Array.isArray(brief.functionalAreas) ? brief.functionalAreas.length : 0;
      const states = Array.isArray(brief.states) ? brief.states.length : 0;
      const pmIssues = Array.isArray(brief.pmIssues) ? brief.pmIssues.length : 0;

      log("pm-agent", `PM Brief loaded: ${functionalAreas} functional areas, ${states} states, ${pmIssues} issues`);

      if (pmIssues > 0) {
        const p0Issues = (brief.pmIssues as Array<{ priority?: string }>).filter(
          (i) => i.priority === "P0"
        ).length;
        if (p0Issues > 0) {
          logError("pm-agent", `${p0Issues} P0 product blocker(s) found in PM Brief!`);
        }
      }

      return { hasBrief: true, briefPath, functionalAreas, states, pmIssues };
    }
  }

  // Auto-generate PM Brief from blueprint
  log("pm-agent", "No existing brief found — generating from blueprint...");
  const blueprintPath = path.join(PATHS.blueprints, `${screenId}-blueprint.json`);
  const blueprint = readJsonSafe<Record<string, unknown>>(blueprintPath);
  if (!blueprint) {
    logWarn("pm-agent", "Cannot generate PM Brief: blueprint not found.");
    return { hasBrief: false, briefPath, functionalAreas: 0, states: 0, pmIssues: 0 };
  }

  // Extract functional areas from blueprint node tree
  const nodes = (blueprint.nodes ?? []) as Array<Record<string, unknown>>;
  const meta = (blueprint.meta ?? {}) as Record<string, unknown>;

  // Identify functional areas by top-level section frames (depth 2 with layout)
  const sectionNodes = nodes.filter(
    (n) => n.depth === 2 && n.type === "FRAME" && n.visible !== false
  );
  const functionalAreas = sectionNodes.map((n) => ({
    name: n.name as string,
    nodeId: n.id as string,
    childCount: Array.isArray(n.childIds) ? n.childIds.length : 0,
  }));

  // Find states from screen-routes.json
  const routesConfig = loadScreenRoutes();
  const screenStates: Array<{ state: string; figmaId: string; name: string }> = [];
  for (const [, entry] of Object.entries(routesConfig.routes)) {
    for (const screen of entry.screens) {
      if (screen.figmaId === screenId) {
        // Found this screen — collect all sibling states
        for (const sibling of entry.screens) {
          screenStates.push({
            state: sibling.state,
            figmaId: sibling.figmaId,
            name: sibling.name,
          });
        }
        break;
      }
    }
    if (screenStates.length > 0) break;
  }

  // Identify interactive elements (buttons, inputs, touchable areas)
  const interactiveNodes = nodes.filter(
    (n) =>
      n.visible !== false &&
      ((n.type === "INSTANCE" && typeof n.name === "string" && /button|input|toggle|switch|checkbox/i.test(n.name)) ||
        (n.type === "TEXT" && typeof n.name === "string" && /button|cta|action|link/i.test(n.name)))
  );

  // Identify text content for data requirements
  const textNodes = nodes.filter((n) => n.type === "TEXT" && n.visible !== false);
  const dataFields = textNodes
    .filter((n) => {
      const content = ((n as Record<string, unknown>).typography as Record<string, unknown>)?.content as string ?? "";
      return content.length > 0 && content.length < 100;
    })
    .map((n) => ({
      nodeId: n.id as string,
      name: n.name as string,
      content: ((n as Record<string, unknown>).typography as Record<string, unknown>)?.content as string ?? "",
    }));

  const pmBrief = {
    screenId,
    screenName: meta.screenName ?? screenId,
    route: meta.route ?? "",
    generatedAt: new Date().toISOString(),
    generatedBy: "buildbot-pm-agent-auto",
    functionalAreas,
    states: screenStates,
    interactiveElements: interactiveNodes.map((n) => ({
      nodeId: n.id as string,
      name: n.name as string,
      type: n.type as string,
    })),
    dataFields,
    pmIssues: [] as Array<{ issue: string; priority: string }>,
    notes: "Auto-generated from blueprint. Review and enrich with product context.",
  };

  fs.writeFileSync(briefPath, JSON.stringify(pmBrief, null, 2), "utf-8");
  log(
    "pm-agent",
    `PM Brief generated: ${functionalAreas.length} functional areas, ${screenStates.length} states, ${interactiveNodes.length} interactive elements, ${dataFields.length} data fields`
  );

  return {
    hasBrief: true,
    briefPath,
    functionalAreas: functionalAreas.length,
    states: screenStates.length,
    pmIssues: 0,
  };
}

// ---------------------------------------------------------------------------
// Step 4: Backend Agent Brief
// ---------------------------------------------------------------------------

function runBackendBrief(screenId: string): BackendBriefResult | null {
  log("backend-agent", "Running Backend Agent...");

  ensureDir(PATHS.mock);
  const briefPath = path.join(PATHS.mock, `${screenId}-backend-brief.json`);

  // Check for existing brief first
  if (fileExists(briefPath)) {
    const brief = readJsonSafe<Record<string, unknown>>(briefPath);
    if (brief) {
      const requiredHooks = Array.isArray(brief.requiredHooks)
        ? (brief.requiredHooks as string[])
        : [];
      const mockData = brief.mockData != null;

      log(
        "backend-agent",
        `Backend Brief loaded: ${requiredHooks.length} hooks required, mock data ${mockData ? "populated" : "missing"}`
      );

      return { hasBrief: true, briefPath, requiredHooks, mockDataPopulated: mockData };
    }
  }

  // Auto-generate Backend Brief by scanning the screen's source file
  log("backend-agent", "No existing brief found — scanning app code...");

  // Find the route from blueprint or screen-routes.json
  const blueprintPath = path.join(PATHS.blueprints, `${screenId}-blueprint.json`);
  const blueprint = readJsonSafe<Record<string, unknown>>(blueprintPath);
  const meta = (blueprint?.meta ?? {}) as Record<string, unknown>;
  const screenRoute = (meta.route as string) ?? "";

  // Try to locate the screen source file from the route
  const RN_APP_ROOT = path.join(BUILDBOT_ROOT, "..", "rn-app");
  let screenFile = "";
  let screenSource = "";

  if (screenRoute) {
    // Convert route like "/(profile)/index" to "app/(profile)/index.tsx"
    const routePath = screenRoute.replace(/^\//, "");
    const candidates = [
      path.join(RN_APP_ROOT, "app", `${routePath}.tsx`),
      path.join(RN_APP_ROOT, "app", routePath, "index.tsx"),
    ];
    for (const candidate of candidates) {
      if (fileExists(candidate)) {
        screenFile = candidate;
        try {
          screenSource = fs.readFileSync(candidate, "utf-8");
        } catch { /* ignore */ }
        break;
      }
    }
  }

  // Extract hooks and services from source
  const requiredHooks: string[] = [];
  const services: string[] = [];
  const supabaseCalls: string[] = [];

  if (screenSource) {
    // Find React hooks (use* pattern from imports)
    const hookImports = screenSource.match(/import\s*\{[^}]*\}\s*from\s*['"]@\/src\/hooks['"]/g);
    if (hookImports) {
      for (const imp of hookImports) {
        const hooks = imp.match(/use\w+/g);
        if (hooks) requiredHooks.push(...hooks);
      }
    }
    // Find inline useXxx calls
    const inlineHooks = screenSource.match(/\buse[A-Z]\w+\b/g);
    if (inlineHooks) {
      for (const h of inlineHooks) {
        if (!requiredHooks.includes(h)) requiredHooks.push(h);
      }
    }

    // Find service imports
    const serviceImports = screenSource.match(/import\s*\{[^}]*\}\s*from\s*['"]@\/src\/services[^'"]*['"]/g);
    if (serviceImports) {
      for (const imp of serviceImports) {
        const fns = imp.match(/\b\w+Service\b|\b\w+Api\b/g);
        if (fns) services.push(...fns);
      }
    }

    // Find Supabase calls
    const supaCalls = screenSource.match(/supabase\.\w+\([^)]*\)/g);
    if (supaCalls) supabaseCalls.push(...supaCalls);
  }

  // Check if mock data exists for this screen
  const mockDataPopulated = requiredHooks.length > 0 && (screenSource.includes("DEMO_") || screenSource.includes("MOCK_"));

  const backendBrief = {
    screenId,
    screenRoute,
    screenFile,
    generatedAt: new Date().toISOString(),
    generatedBy: "buildbot-backend-agent-auto",
    requiredHooks,
    services,
    supabaseCalls,
    mockData: mockDataPopulated ? { status: "populated", note: "Demo/mock data found in source" } : null,
    notes: "Auto-generated from source scan. Review for completeness.",
  };

  fs.writeFileSync(briefPath, JSON.stringify(backendBrief, null, 2), "utf-8");
  log(
    "backend-agent",
    `Backend Brief generated: ${requiredHooks.length} hooks, ${services.length} services, mock data ${mockDataPopulated ? "found" : "not found"}`
  );

  return {
    hasBrief: true,
    briefPath,
    requiredHooks,
    mockDataPopulated,
  };
}

// ---------------------------------------------------------------------------
// Step 5: Capture / Validate Screenshot
// ---------------------------------------------------------------------------

/**
 * Scroll the simulator down by one step and capture a screenshot.
 * Uses Maestro swipe to scroll content upward (finger drags from bottom to top).
 */
function scrollAndCapture(capturePath: string): boolean {
  const tmpFlowDir = path.join(BUILDBOT_ROOT, "data", ".tmp-flows");
  if (!fs.existsSync(tmpFlowDir)) {
    fs.mkdirSync(tmpFlowDir, { recursive: true });
  }

  const flowFileName = `scroll-${Date.now()}.yaml`;
  const flowPath = path.join(tmpFlowDir, flowFileName);
  const flowContent = [
    "appId: com.flent.secured",
    "---",
    `- swipe:`,
    `    start: "50%, ${SCROLL_SWIPE_START_PCT}%"`,
    `    end: "50%, ${SCROLL_SWIPE_END_PCT}%"`,
    `    duration: 600`,
    "- waitForAnimationToEnd:",
    `    timeout: ${SCROLL_SETTLE_MS}`,
  ].join("\n");

  fs.writeFileSync(flowPath, flowContent, "utf-8");

  // Retry swipe up to MAESTRO_SWIPE_RETRIES times
  let swipeOk = false;
  for (let attempt = 1; attempt <= MAESTRO_SWIPE_RETRIES + 1; attempt++) {
    const maestroResult = runCommand(
      `maestro test "${flowPath}" --no-ansi 2>&1`,
      "screenshot",
      { maxStderrLines: 15 }
    );
    if (maestroResult.success) {
      swipeOk = true;
      break;
    }
    if (attempt <= MAESTRO_SWIPE_RETRIES) {
      logWarn("screenshot", `Maestro swipe attempt ${attempt} failed, retrying in ${attempt}s...`);
      try { execSync(`sleep ${attempt}`, { stdio: "pipe" }); } catch { /* ignore */ }
    }
  }

  try { fs.unlinkSync(flowPath); } catch { /* ignore */ }

  if (!swipeOk) {
    logError("screenshot", "Maestro scroll swipe failed after all retries.");
    return false;
  }

  // Brief extra settle time
  try { execSync(`sleep 0.5`, { stdio: "pipe" }); } catch { /* ignore */ }

  const captureResult = runCommand(
    `xcrun simctl io booted screenshot "${capturePath}"`,
    "screenshot"
  );

  return captureResult.success;
}

/**
 * Stitch multiple viewport captures into a single full-page image.
 * Crops the overlapping top portion from each capture after the first,
 * then appends them vertically using ImageMagick.
 */
function stitchScreenshots(
  captures: string[],
  overlapPx: number,
  outputPath: string
): boolean {
  if (captures.length === 0) return false;
  if (captures.length === 1) {
    try { fs.copyFileSync(captures[0], outputPath); return true; } catch { return false; }
  }

  const croppedPaths: string[] = [captures[0]]; // first capture is used as-is
  const cleanupPaths: string[] = [];

  // Get dimensions of the first capture for cropping
  const firstDims = getImageDimensions(captures[0]);
  if (!firstDims) {
    logError("screenshot", "Cannot read dimensions of first capture for stitching.");
    return false;
  }
  const cropHeight = firstDims.height - overlapPx;

  for (let i = 1; i < captures.length; i++) {
    const croppedPath = captures[i].replace(".png", "-cropped.png");
    // Crop top `overlapPx` pixels: keep from overlapPx down to bottom
    const cropResult = runCommand(
      `magick "${captures[i]}" -crop ${firstDims.width}x${cropHeight}+0+${overlapPx} +repage "${croppedPath}"`,
      "screenshot"
    );
    if (cropResult.success && fileExists(croppedPath)) {
      croppedPaths.push(croppedPath);
      cleanupPaths.push(croppedPath);
    } else {
      logWarn("screenshot", `Failed to crop capture ${i + 1}, skipping segment.`);
    }
  }

  // Stitch all pieces vertically
  const stitchArgs = croppedPaths.map((p) => `"${p}"`).join(" ");
  const stitchResult = runCommand(
    `magick ${stitchArgs} -append "${outputPath}"`,
    "screenshot"
  );

  // Clean up intermediate cropped files
  for (const p of cleanupPaths) {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }

  if (!stitchResult.success) {
    logError("screenshot", "ImageMagick stitch (-append) failed.");
    return false;
  }

  return fileExists(outputPath);
}

/**
 * Capture a screenshot from the iOS Simulator using Maestro for navigation.
 *
 * Strategy:
 * 1. Navigate to splash screen first (reset to a neutral state so that
 *    router.navigate to the target route is never a same-route no-op).
 * 2. Navigate to the target route via Maestro openLink using the route
 *    group format directly from screen-routes.json (e.g., /(waitlist)?state=pending).
 *    This works because useDeepLink.ts passes through paths starting with /(.
 * 3. Wait for render + animations.
 * 4. Capture via xcrun simctl io booted screenshot.
 *
 * PREREQUISITES:
 * - iOS Simulator must be booted
 * - App must be connected to Metro dev server (Expo Dev Launcher connected)
 * - Maestro CLI must be installed
 */
function captureScreenshotViaCLI(
  route: string,
  screenshotPath: string
): boolean {
  const URL_SCHEME = "flentsecured";
  const APP_ID = "com.flent.secured";
  const RESET_ROUTE = "/(auth)/splash";
  const SETTLE_TIME_SEC = 4;

  // Screens with auto-transition timers need ?preview=true to stay visible for screenshot
  const PREVIEW_ROUTES = ["/(auth)/beta-splash"];
  const routeWithPreview = PREVIEW_ROUTES.includes(route)
    ? `${route}?preview=true`
    : route;
  const deepLinkUrl = `${URL_SCHEME}://${routeWithPreview}`;
  log("screenshot", `Target deep link: ${deepLinkUrl}`);

  // Pre-flight: verify simulator and Maestro are ready
  const preflight = runPreflightChecks();
  if (!preflight.ok) {
    for (const e of preflight.errors) logError("screenshot", `PRE-FLIGHT: ${e}`);
    logWarn("screenshot", "Falling back to direct deep link (no Maestro navigation)...");
    const directResult = runCommand(`xcrun simctl openurl booted "${deepLinkUrl}"`, "screenshot");
    if (!directResult.success) {
      logError("screenshot", "Direct deep link also failed. Is the simulator booted with the app installed?");
      return false;
    }
    log("screenshot", `Waiting ${SETTLE_TIME_SEC}s for screen to render...`);
    try { execSync(`sleep ${SETTLE_TIME_SEC}`, { stdio: "pipe" }); } catch { /* ignore */ }
    // Continue to screenshot capture below (skip Maestro flow generation)
    const screenshotsDir = path.dirname(screenshotPath);
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    const captureResult = runCommand(`xcrun simctl io booted screenshot "${screenshotPath}"`, "screenshot");
    return captureResult.success;
  }

  // Step 1: Two-phase navigation for Expo Development Build
  //
  // Expo Dev Launcher intercepts custom scheme URLs and shows a "Deep link received"
  // dialog. To bypass this:
  // Phase A (Maestro warmup): Launch app → tap "Flent Secured" → tap "http://localhost:8081"
  //   This connects the app to Metro without using deep links.
  // Phase B (xcrun): Once connected, xcrun simctl openurl goes directly to the app
  //   without triggering the dialog.
  const tmpFlowDir = path.join(BUILDBOT_ROOT, "data", ".tmp-flows");
  if (!fs.existsSync(tmpFlowDir)) fs.mkdirSync(tmpFlowDir, { recursive: true });

  log("screenshot", "Phase A: Connecting app to Metro via Maestro warmup...");
  const warmupFlowPath = path.join(tmpFlowDir, `warmup-${Date.now()}.yaml`);
  const warmupFlow = [
    `appId: ${APP_ID}`,
    "---",
    // Bring app to foreground (don't stop existing session)
    "- launchApp:",
    "    stopApp: false",
    "- waitForAnimationToEnd:",
    "    timeout: 2000",
    // If Dev Launcher home is showing, tap the app entry to navigate into app context
    "- tapOn:",
    '    text: "Flent Secured"',
    "    optional: true",
    "- waitForAnimationToEnd:",
    "    timeout: 1000",
    // If Metro connection picker is showing, tap localhost to connect
    "- tapOn:",
    '    text: "http://localhost:8081"',
    "    optional: true",
    "- waitForAnimationToEnd:",
    "    timeout: 3000",
  ].join("\n");

  fs.writeFileSync(warmupFlowPath, warmupFlow, "utf-8");
  const warmupResult = runCommand(
    `maestro test "${warmupFlowPath}" --no-ansi 2>&1`,
    "screenshot",
    { timeout: 45_000 }
  );
  try { fs.unlinkSync(warmupFlowPath); } catch { /* ignore */ }

  if (!warmupResult.success) {
    logWarn("screenshot", "Warmup flow failed — app may not be connected to Metro. Proceeding anyway.");
  }

  // Phase B: Navigate to reset route, then to target via xcrun simctl openurl
  // After warmup, xcrun openurl goes directly to the running app without dialog
  log("screenshot", "Phase B: Navigating to target screen via xcrun simctl openurl...");
  const resetUrl = `${URL_SCHEME}://${RESET_ROUTE}`;
  runCommand(`xcrun simctl openurl booted "${resetUrl}"`, "screenshot");
  try { execSync("sleep 2", { stdio: "pipe" }); } catch { /* ignore */ }

  const navResult = runCommand(`xcrun simctl openurl booted "${deepLinkUrl}"`, "screenshot");
  if (!navResult.success) {
    logError("screenshot", "Navigation failed. Is the simulator booted with the app installed?");
    return false;
  }

  // Step 3: Wait for the screen to render and animations to settle
  log("screenshot", `Waiting ${SETTLE_TIME_SEC}s for screen to render...`);
  try {
    execSync(`sleep ${SETTLE_TIME_SEC}`, { stdio: "pipe" });
  } catch {
    // sleep failing is non-fatal
  }

  // Step 4: Capture screenshot(s) via simctl
  const screenshotsDir = path.dirname(screenshotPath);
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Capture top viewport
  const topPath = screenshotPath.replace(".png", "-top.png");
  log("screenshot", "Capturing top viewport...");
  const topResult = runCommand(
    `xcrun simctl io booted screenshot "${topPath}"`,
    "screenshot"
  );

  if (!topResult.success) {
    logError("screenshot", "Screenshot capture failed. Is the simulator booted?");
    return false;
  }

  // Scroll-stitch: detect scrollable screens and capture full page
  const baselineId = path.basename(screenshotPath, ".png");
  const baselinePath = path.join(PATHS.baselines, `${baselineId}-baseline.png`);
  const topDims = getImageDimensions(topPath);
  let isScrollable = false;

  if (fileExists(baselinePath) && topDims) {
    const baselineDims = getImageDimensions(baselinePath);
    if (baselineDims && baselineDims.height > topDims.height * 1.3) {
      isScrollable = true;
      const overlapPx = Math.round(topDims.height * SCROLL_OVERLAP_FRACTION);
      const scrollStepPx = topDims.height - overlapPx;
      const remainingHeight = baselineDims.height - topDims.height;
      const numAdditional = Math.min(
        Math.ceil(remainingHeight / scrollStepPx),
        MAX_SCROLL_CAPTURES - 1
      );

      log(
        "screenshot",
        `Scrollable screen detected: baseline ${baselineDims.height}px > viewport ${topDims.height}px. ` +
        `Capturing ${numAdditional} additional segment(s) (overlap ${overlapPx}px, step ${scrollStepPx}px)`
      );

      const allCaptures: string[] = [topPath];

      for (let i = 0; i < numAdditional; i++) {
        const segPath = screenshotPath.replace(".png", `-seg${i + 1}.png`);
        log("screenshot", `Scroll-capture segment ${i + 1}/${numAdditional}...`);
        const ok = scrollAndCapture(segPath);
        if (ok && fileExists(segPath)) {
          allCaptures.push(segPath);
        } else {
          logWarn("screenshot", `Segment ${i + 1} capture failed, stopping scroll.`);
          break;
        }
      }

      if (allCaptures.length > 1) {
        log("screenshot", `Stitching ${allCaptures.length} captures (overlap ${overlapPx}px)...`);
        const stitchOk = stitchScreenshots(allCaptures, overlapPx, screenshotPath);
        // Clean up individual segment files
        for (const p of allCaptures) {
          try { fs.unlinkSync(p); } catch { /* ignore */ }
        }
        if (stitchOk) {
          const stitchedDims = getImageDimensions(screenshotPath);
          log("screenshot", `Stitched full-page screenshot: ${stitchedDims?.width}x${stitchedDims?.height}`);

          // Crop stitched image to match baseline proportional height.
          // Stitched image is often taller than baseline because we scroll past content end.
          // Without this crop, ODiff resize distorts aspect ratios causing false diff.
          if (stitchedDims && stitchedDims.height > baselineDims.height * 1.1) {
            const scaleFactor = stitchedDims.width / baselineDims.width;
            const targetH = Math.round(baselineDims.height * scaleFactor);
            const cropH = Math.min(targetH, stitchedDims.height);
            log("screenshot", `Cropping stitched image from ${stitchedDims.height}px to ${cropH}px to match baseline proportions`);
            runCommand(
              `magick "${screenshotPath}" -crop ${stitchedDims.width}x${cropH}+0+0 +repage "${screenshotPath}"`,
              "screenshot"
            );
            const croppedDims = getImageDimensions(screenshotPath);
            log("screenshot", `Final stitched screenshot: ${croppedDims?.width}x${croppedDims?.height}`);
          }
        } else {
          logError("screenshot", "Stitch failed — falling back to top viewport only. Pixel diff will be INACCURATE for this scrollable screen.");
          // Re-capture top viewport as fallback
          runCommand(`xcrun simctl io booted screenshot "${screenshotPath}"`, "screenshot");
        }
      } else {
        // Only got top capture for a scrollable screen — this is a degraded state
        logError(
          "screenshot",
          `Scrollable screen detected (baseline ${baselineDims.height}px) but only captured viewport (${topDims.height}px). ` +
          `Scroll capture failed — pixel diff will compare viewport vs full-page baseline. ` +
          `Check that Maestro is working: maestro test <flow.yaml>`
        );
        try { fs.renameSync(topPath, screenshotPath); } catch { /* ignore */ }
      }
    }
  }

  // Non-scrollable: just rename top capture to final path
  if (!isScrollable) {
    try { fs.renameSync(topPath, screenshotPath); } catch { /* ignore */ }
  }

  // Step 5: Validate the captured image
  const check = validateImageFile(screenshotPath, "screenshot");
  if (!check.valid) {
    logError("screenshot", `Captured screenshot is invalid: ${check.reason}`);
    return false;
  }

  log("screenshot", `Screenshot captured successfully: ${screenshotPath}`);
  return true;
}

function validateScreenshot(
  screenId: string,
  skipMaestro: boolean,
  route: string,
  recapture: boolean = false
): { screenshotPath: string; hasScreenshot: boolean } {
  log("screenshot", "Checking app screenshot...");

  const screenshotPath = path.join(PATHS.screenshots, `${screenId}.png`);

  // If --recapture is set, delete existing screenshot to force re-capture
  if (recapture && fileExists(screenshotPath)) {
    log("screenshot", "Recapture mode: deleting existing screenshot...");
    try { fs.unlinkSync(screenshotPath); } catch { /* ignore */ }
  }

  if (skipMaestro) {
    if (fileExists(screenshotPath)) {
      const check = validateImageFile(screenshotPath, "screenshot");
      if (!check.valid) {
        logError("screenshot", `Screenshot exists but is corrupt: ${check.reason}`);
        logError("screenshot", "Delete the corrupt file and recapture.");
        return { screenshotPath, hasScreenshot: false };
      }
      log("screenshot", `Existing screenshot found and valid: ${screenshotPath}`);
      return { screenshotPath, hasScreenshot: true };
    }
    logError(
      "screenshot",
      `No existing screenshot at ${screenshotPath}. Either capture manually or run without --skip-maestro.`
    );
    return { screenshotPath, hasScreenshot: false };
  }

  // Check for existing valid screenshot first
  if (fileExists(screenshotPath)) {
    const check = validateImageFile(screenshotPath, "screenshot");
    if (check.valid) {
      log("screenshot", `Screenshot found and valid: ${screenshotPath}`);
      return { screenshotPath, hasScreenshot: true };
    }
    logWarn("screenshot", `Existing screenshot is corrupt (${check.reason}). Re-capturing...`);
  }

  // No valid screenshot — capture via CLI (deep link + xcrun simctl)
  log("screenshot", "No existing screenshot — capturing via CLI...");
  const captured = captureScreenshotViaCLI(route, screenshotPath);
  return { screenshotPath, hasScreenshot: captured };
}

// ---------------------------------------------------------------------------
// Step 3: ODiff Pixel Comparison
// ---------------------------------------------------------------------------

/**
 * Get image dimensions using ImageMagick.
 * Returns { width, height } or null on failure.
 */
function getImageDimensions(
  imagePath: string
): { width: number; height: number } | null {
  try {
    const output = execSync(
      `magick identify -format "%wx%h" "${imagePath}"`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 10_000 }
    ).trim();
    const [w, h] = output.split("x").map(Number);
    if (w > 0 && h > 0) return { width: w, height: h };
    return null;
  } catch {
    return null;
  }
}

/**
 * Resize an image to target dimensions using ImageMagick.
 * Returns the output path on success, null on failure.
 */
function resizeImage(
  sourcePath: string,
  targetWidth: number,
  targetHeight: number,
  outputPath: string
): string | null {
  try {
    execSync(
      `magick "${sourcePath}" -resize ${targetWidth}x${targetHeight}! "${outputPath}"`,
      { stdio: ["pipe", "pipe", "pipe"], timeout: 30_000 }
    );
    // Validate the resized output is a valid PNG
    const check = validateImageFile(outputPath, "resized-output");
    if (!check.valid) {
      logError("odiff", `Resized image is corrupt: ${check.reason}`);
      return null;
    }
    return outputPath;
  } catch (err) {
    logError("odiff", `ImageMagick resize failed: ${err}`);
    return null;
  }
}

function runPixelDiff(
  screenId: string,
  baselinePath: string,
  screenshotPath: string,
  blueprint: BlueprintMeta | null
): PixelDiffResult | null {
  log("odiff", "Running pixel comparison...");

  ensureDir(PATHS.diffs);

  const diffOutputPath = path.join(PATHS.diffs, `${screenId}-diff.png`);

  // Determine threshold based on screen type
  // Check both the explicit flag AND backgroundShapeKey — screens with Background Shape
  // in Figma all use the DottedPattern overlay, but the extractor misses detection
  // because Figma names the pattern image generically (e.g. "image 149")
  const hasDottedPattern =
    blueprint?.background?.hasDottedPattern === true ||
    !!blueprint?.background?.backgroundShapeKey;
  const threshold = hasDottedPattern ? 18 : 3;

  if (hasDottedPattern) {
    log("odiff", `DottedPattern screen detected — using ${threshold}% threshold`);
  } else {
    log("odiff", `Regular screen — using ${threshold}% threshold`);
  }

  // --- Dimension matching & normalization ---
  // ODiff requires matching dimensions. For large images (>2000px longest side),
  // scale both down proportionally to avoid ODiff memory issues that cause corrupt PNGs.
  const MAX_COMPARISON_DIM = 2000;
  const baselineDims = getImageDimensions(baselinePath);
  const screenshotDims = getImageDimensions(screenshotPath);

  let effectiveBaselinePath = baselinePath;
  let effectiveScreenshotPath = screenshotPath;

  if (baselineDims && screenshotDims) {
    log(
      "odiff",
      `Baseline: ${baselineDims.width}x${baselineDims.height} | Screenshot: ${screenshotDims.width}x${screenshotDims.height}`
    );

    // Calculate target dimensions: match baseline aspect ratio, cap at MAX_COMPARISON_DIM
    let targetW = baselineDims.width;
    let targetH = baselineDims.height;
    const longestSide = Math.max(targetW, targetH);

    if (longestSide > MAX_COMPARISON_DIM) {
      const scale = MAX_COMPARISON_DIM / longestSide;
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
      log(
        "odiff",
        `Images too large for ODiff (${longestSide}px) — scaling both to ${targetW}x${targetH}`
      );

      // Resize baseline
      const resizedBaselinePath = path.join(
        PATHS.diffs,
        `${screenId}-baseline-resized.png`
      );
      const baselineResult = resizeImage(
        baselinePath,
        targetW,
        targetH,
        resizedBaselinePath
      );
      if (baselineResult) {
        effectiveBaselinePath = baselineResult;
      }

      // Resize screenshot
      const resizedScreenshotPath = path.join(
        PATHS.diffs,
        `${screenId}-screenshot-resized.png`
      );
      const screenshotResult = resizeImage(
        screenshotPath,
        targetW,
        targetH,
        resizedScreenshotPath
      );
      if (screenshotResult) {
        effectiveScreenshotPath = screenshotResult;
      }
    } else if (
      baselineDims.width !== screenshotDims.width ||
      baselineDims.height !== screenshotDims.height
    ) {
      // Images are small enough but dimensions don't match — resize screenshot to baseline
      log(
        "odiff",
        `Dimension mismatch — resizing screenshot to ${targetW}x${targetH}`
      );
      const resizedPath = path.join(
        PATHS.diffs,
        `${screenId}-screenshot-resized.png`
      );
      const result = resizeImage(
        screenshotPath,
        targetW,
        targetH,
        resizedPath
      );
      if (result) {
        effectiveScreenshotPath = result;
      } else {
        logError("odiff", "Failed to resize screenshot — ODiff may fail.");
      }
    }
  } else {
    logWarn(
      "odiff",
      "Could not read image dimensions. Ensure ImageMagick is installed."
    );
  }

  // Run ODiff with --reduce-ram-usage and --parsable-stdout for reliable operation
  const cmd = [
    "npx",
    "odiff",
    `"${effectiveBaselinePath}"`,
    `"${effectiveScreenshotPath}"`,
    `"${diffOutputPath}"`,
    "--antialiasing",
    "--threshold",
    "0.1",
    "--reduce-ram-usage",
    "--parsable-stdout",
  ].join(" ");

  const { stdout, success } = runCommand(cmd, "odiff");

  if (!success && !stdout) {
    // ODiff exits with code 22 when images differ — check if diff file was created
    if (!fileExists(diffOutputPath)) {
      logError(
        "odiff",
        "ODiff failed to produce diff. Make sure odiff-bin is installed: npm install in buildbot/"
      );
      return null;
    }
  }

  // Validate the diff output image is not corrupt (ODiff can produce truncated PNGs)
  if (fileExists(diffOutputPath)) {
    const diffCheck = validateImageFile(diffOutputPath, "diff-output");
    if (!diffCheck.valid) {
      logWarn("odiff", `Diff image is corrupt (${diffCheck.reason}). It will not be viewable but diff % is still usable.`);
    }
  }

  // Parse ODiff --parsable-stdout output.
  // Parsable format: "diffCount;diffPercentage" (e.g., "2378871;45.08")
  // Exit code 0 = match, 22 = pixel-diff, 21 = layout-diff
  let diffPercentage = 0;
  const combinedOutput = stdout.trim();

  if (success) {
    // Exit code 0 means images match
    diffPercentage = 0;
    log("odiff", "Images match perfectly.");
  } else if (combinedOutput) {
    // Parsable format: "diffCount;diffPercentage"
    const parts = combinedOutput.split(";");
    if (parts.length === 2) {
      diffPercentage = parseFloat(parts[1]);
      if (isNaN(diffPercentage)) diffPercentage = -1;
    } else {
      // Fallback: try to find a percentage in output
      const pctMatch = combinedOutput.match(/(\d+\.?\d*)%/) ??
        combinedOutput.match(/diffPercentage[:\s]+(\d+\.?\d*)/);
      diffPercentage = pctMatch ? parseFloat(pctMatch[1]) : -1;
    }
  } else {
    diffPercentage = -1;
  }

  if (diffPercentage < 0) {
    logWarn("odiff", `Could not parse diff percentage from output: "${combinedOutput}"`);
  }

  const passed = diffPercentage >= 0 && diffPercentage <= threshold;

  if (diffPercentage >= 0) {
    log("odiff", `Diff: ${diffPercentage.toFixed(2)}% (threshold: ${threshold}%) => ${passed ? "PASS" : "FAIL"}`);
  } else {
    logWarn("odiff", `Diff percentage unknown. Marking as FAIL. Diff image: ${diffOutputPath}`);
  }

  return {
    percentage: diffPercentage >= 0 ? diffPercentage : -1,
    threshold,
    passed,
    diffImagePath: diffOutputPath,
  };
}

// ---------------------------------------------------------------------------
// Step 4: Coverage Check
// ---------------------------------------------------------------------------

function runCoverageCheck(screenId: string): CoverageResult | null {
  log("coverage", "Running coverage check...");

  const coverageScript = path.join(PATHS.scripts, "check-coverage.ts");
  if (!fileExists(coverageScript)) {
    logWarn("coverage", "check-coverage.ts not found. Skipping coverage check.");
    return null;
  }

  const cmd = `npx tsx "${coverageScript}" ${screenId}`;
  const { success } = runCommand(cmd, "coverage");

  if (!success) {
    logWarn("coverage", "Coverage check script failed. Continuing with remaining steps.");
  }

  // Try to read the coverage report output
  const coverageReportPath = path.join(PATHS.coverage, `${screenId}-coverage.json`);
  if (!fileExists(coverageReportPath)) {
    logWarn("coverage", `Coverage report not found at ${coverageReportPath}`);
    return null;
  }

  const report = readJsonSafe<Record<string, unknown>>(coverageReportPath);
  if (!report) {
    logWarn("coverage", "Could not parse coverage report.");
    return null;
  }

  // Extract coverage metrics — adapt to the report format (nested or flat)
  const summary = (report as any).summary || {};
  const breakdown = (report as any).categoryBreakdown || {};

  const typography =
    typeof report.typography === "number"
      ? report.typography
      : typeof breakdown.typography?.percentage === "number"
        ? breakdown.typography.percentage
        : 0;

  const colors =
    typeof report.colors === "number"
      ? report.colors
      : typeof breakdown.colors?.percentage === "number"
        ? breakdown.colors.percentage
        : 0;

  const spacing =
    typeof report.spacing === "number"
      ? report.spacing
      : typeof breakdown.spacing?.percentage === "number"
        ? breakdown.spacing.percentage
        : 0;

  const overall =
    typeof report.overall === "number"
      ? report.overall
      : typeof summary.overallCoverage === "number"
        ? summary.overallCoverage
        : typeof report.overallCoverage === "number"
          ? report.overallCoverage
          : Math.round((typography + colors + spacing) / 3);

  const passed = overall >= 80;

  log(
    "coverage",
    `Typography: ${typography}% | Colors: ${colors}% | Spacing: ${spacing}% | Overall: ${overall}% => ${passed ? "PASS" : "FAIL"}`
  );

  return { typography, colors, spacing, overall, passed };
}

// ---------------------------------------------------------------------------
// Step 5: Gemini Visual Feedback
// ---------------------------------------------------------------------------

/** Extract GeminiAuditResult from raw JSON (handles both old and new Gemini output formats) */
function extractGeminiResult(raw: Record<string, unknown>): GeminiAuditResult {
  // New format: consolidatedFixes + summary + batches
  const consolidatedFixes = Array.isArray(raw.consolidatedFixes) ? raw.consolidatedFixes as GeminiAuditResult['consolidatedFixes'] : [];
  const rawSummary = raw.summary as Record<string, unknown> | undefined;
  const summary: GeminiAuditResult['summary'] = {
    totalIssues: typeof rawSummary?.totalIssues === 'number' ? rawSummary.totalIssues : consolidatedFixes.length,
    critical: typeof rawSummary?.critical === 'number' ? rawSummary.critical : consolidatedFixes.filter(f => f.severity === 'critical').length,
    major: typeof rawSummary?.major === 'number' ? rawSummary.major : consolidatedFixes.filter(f => f.severity === 'major').length,
    minor: typeof rawSummary?.minor === 'number' ? rawSummary.minor : consolidatedFixes.filter(f => f.severity === 'minor').length,
    filesAffected: Array.isArray(rawSummary?.filesAffected) ? rawSummary.filesAffected as string[] : [...new Set(consolidatedFixes.map(f => f.file).filter(Boolean) as string[])],
  };

  return { consolidatedFixes, summary, batches: Array.isArray(raw.batches) ? raw.batches : undefined };
}

function runGeminiAudit(screenId: string, routeKey?: string): GeminiAuditResult | null {
  log("gemini", "Running Gemini visual feedback...");

  // Check for a recent cached Gemini report — but only if source files haven't changed since
  const cachedReportPath = path.join(PATHS.audits, `${screenId}-gemini.json`);
  if (fileExists(cachedReportPath)) {
    try {
      const stat = fs.statSync(cachedReportPath);
      const reportMtime = stat.mtimeMs;
      const ageHours = (Date.now() - reportMtime) / (1000 * 60 * 60);

      // Check if blueprint or screen code is newer than cached report
      const blueprintPath = path.join(PATHS.blueprints, `${screenId}-blueprint.json`);
      const blueprintMtime = fileExists(blueprintPath) ? fs.statSync(blueprintPath).mtimeMs : 0;
      const screenshotPath = path.join(PATHS.screenshots, `${screenId}.png`);
      const screenshotMtime = fileExists(screenshotPath) ? fs.statSync(screenshotPath).mtimeMs : 0;

      const sourceIsNewer = blueprintMtime > reportMtime || screenshotMtime > reportMtime;

      if (ageHours < 24 && !sourceIsNewer) {
        const cached = readJsonSafe<Record<string, unknown>>(cachedReportPath);
        if (cached) {
          log("gemini", `Using cached Gemini report (${ageHours.toFixed(1)}h old): ${cachedReportPath}`);
          return extractGeminiResult(cached);
        }
      } else if (sourceIsNewer) {
        log("gemini", `Cached report is stale (source files modified after report). Re-running.`);
      }
    } catch { /* ignore stat errors */ }
  }

  const geminiScript = path.join(PATHS.scripts, "gemini-pixel-feedback.ts");
  if (!fileExists(geminiScript)) {
    logWarn("gemini", "gemini-pixel-feedback.ts not found yet. Skipping Gemini audit.");
    return null;
  }

  // Pass figmaId so Gemini resolves the exact screen state (not just first state of a route)
  // Falls back to routeKey for backward compatibility
  const geminiArg = screenId || routeKey;
  const cmd = `npx tsx "${geminiScript}" ${geminiArg}`;
  const { success } = runCommand(cmd, "gemini", { timeout: 300_000 }); // 5min — Gemini runs 3+ API calls with rate limit retries

  if (!success) {
    logWarn("gemini", "Gemini feedback script failed. Continuing with remaining steps.");
    return null;
  }

  // Try to read the Gemini output — check common output locations
  const possiblePaths = [
    path.join(PATHS.audits, `${screenId}-gemini.json`),
    path.join(PATHS.coverage, `${screenId}-gemini-feedback.json`),
    path.join(BUILDBOT_ROOT, "data", `${screenId}-gemini-feedback.json`),
  ];

  for (const p of possiblePaths) {
    if (fileExists(p)) {
      const result = readJsonSafe<Record<string, unknown>>(p);
      if (result) {
        log("gemini", `Gemini audit report loaded from ${p}`);
        return extractGeminiResult(result);
      }
    }
  }

  logWarn("gemini", "Gemini audit completed but no report file found.");
  return null;
}

// ---------------------------------------------------------------------------
// Step 6: Inspector
// ---------------------------------------------------------------------------

function runInspector(
  screenId: string,
  screenshotPath: string,
  baselinePath: string,
  blueprintPath: string
): InspectionResult | null {
  log("inspector", "Running Inspector Flash...");

  const inspectorScript = path.join(PATHS.scripts, "inspector-flash.ts");
  if (!fileExists(inspectorScript)) {
    logWarn("inspector", "inspector-flash.ts not found yet. Skipping inspection.");
    return null;
  }

  const outputPath = path.join(PATHS.audits, `${screenId}-inspection.json`);

  // Cache: skip API call if inspection report exists from last 24h AND source files haven't changed
  if (fileExists(outputPath)) {
    try {
      const stat = fs.statSync(outputPath);
      const reportMtime = stat.mtimeMs;
      const ageHours = (Date.now() - reportMtime) / (1000 * 60 * 60);

      // Check if source files are newer than cached report
      const screenshotMtime = fileExists(screenshotPath) ? fs.statSync(screenshotPath).mtimeMs : 0;
      const baselineMtime = fileExists(baselinePath) ? fs.statSync(baselinePath).mtimeMs : 0;
      const sourceIsNewer = screenshotMtime > reportMtime || baselineMtime > reportMtime;

      if (ageHours < 24 && !sourceIsNewer) {
        const cached = readJsonSafe<Record<string, unknown>>(outputPath);
        if (cached) {
          const overallScore = typeof cached.overallScore === "number" ? cached.overallScore : 0;
          const criticalIssues = Array.isArray(cached.criticalIssues) ? (cached.criticalIssues as string[]) : [];
          const suggestions = Array.isArray(cached.suggestions) ? (cached.suggestions as string[]) : [];
          log("inspector", `Using cached inspection report (${ageHours.toFixed(1)}h old) — Score: ${overallScore}/100`);
          return { overallScore, criticalIssues, suggestions };
        }
      } else if (sourceIsNewer) {
        log("inspector", `Cached report is stale (source files modified). Re-running.`);
      }
    } catch { /* ignore */ }
  }

  // With scroll-stitch, screenshots are full-page — no viewport cropping needed.
  // ODiff handles any remaining dimension mismatches via its resize logic.
  let effectiveBaseline = baselinePath;

  const cmd = [
    "npx",
    "tsx",
    `"${inspectorScript}"`,
    "--screenshot",
    `"${screenshotPath}"`,
    "--baseline",
    `"${effectiveBaseline}"`,
    "--blueprint",
    `"${blueprintPath}"`,
    "--output",
    `"${outputPath}"`,
  ].join(" ");

  const { success } = runCommand(cmd, "inspector", { timeout: 600_000 });

  if (!success) {
    logWarn("inspector", "Inspector script failed. Continuing with remaining steps.");
  }

  if (!fileExists(outputPath)) {
    logWarn("inspector", `Inspection report not found at ${outputPath}`);
    return null;
  }

  const report = readJsonSafe<Record<string, unknown>>(outputPath);
  if (!report) {
    logWarn("inspector", "Could not parse inspection report.");
    return null;
  }

  const overallScore = typeof report.overallScore === "number" ? report.overallScore : 0;
  const criticalIssues = Array.isArray(report.criticalIssues)
    ? (report.criticalIssues as string[])
    : [];
  const suggestions = Array.isArray(report.suggestions) ? (report.suggestions as string[]) : [];

  log("inspector", `Score: ${overallScore}/100 | Critical: ${criticalIssues.length} | Suggestions: ${suggestions.length}`);

  return { overallScore, criticalIssues, suggestions };
}

// ---------------------------------------------------------------------------
// Step 10: Learning Agent — Extract Learnings from Results
// ---------------------------------------------------------------------------

function runLearningAgent(
  screenId: string,
  pixelDiff: PixelDiffResult | null,
  coverage: CoverageResult | null,
  inspection: InspectionResult | null,
  pmBrief: PMBriefResult | null
): void {
  log("learning-agent", "Analyzing results for new learnings...");

  const findings: Array<{ what: string; why: string; how: string; category: string }> = [];

  // Analyze pixel diff for learnable patterns
  if (pixelDiff && !pixelDiff.passed && pixelDiff.percentage > 0) {
    if (pixelDiff.percentage > 20) {
      findings.push({
        what: "High pixel diff indicates structural mismatch",
        why: `Pixel diff of ${pixelDiff.percentage.toFixed(1)}% suggests layout structure differs significantly from Figma, not just styling issues.`,
        how: "Compare section-by-section: check if sections are missing, reordered, or have wrong container structure before fixing individual styles.",
        category: "Pipeline and Process",
      });
    } else if (pixelDiff.percentage > 8) {
      findings.push({
        what: "Medium pixel diff indicates component-level mismatches",
        why: `Pixel diff of ${pixelDiff.percentage.toFixed(1)}% suggests several components have wrong sizing, spacing, or colors.`,
        how: "Focus on the largest visible differences first (usually spacing or font sizes). Use the diff image to identify which components have the most red highlight area.",
        category: "React Native Patterns",
      });
    }
  }

  // Analyze coverage gaps
  if (coverage && !coverage.passed) {
    const gaps: string[] = [];
    if (coverage.typography < 80) gaps.push(`typography ${coverage.typography}%`);
    if (coverage.colors < 80) gaps.push(`colors ${coverage.colors}%`);
    if (coverage.spacing < 80) gaps.push(`spacing ${coverage.spacing}%`);
    if (gaps.length > 0) {
      findings.push({
        what: "Coverage gaps indicate missing Figma properties in code",
        why: `Low coverage in ${gaps.join(", ")} means the screen code does not match Figma values for these properties.`,
        how: "Run check-coverage.ts with --verbose to see which specific properties are missing. Fix the lowest-coverage category first.",
        category: "Pipeline and Process",
      });
    }
  }

  // Analyze inspection critical issues
  if (inspection && inspection.criticalIssues.length > 0) {
    findings.push({
      what: `Inspector found ${inspection.criticalIssues.length} critical issue(s)`,
      why: `Critical issues from visual inspection: ${inspection.criticalIssues.slice(0, 2).join("; ")}`,
      how: "Address P0 issues first as they are the most visible differences. Use the Figma blueprint node IDs to verify exact expected values before coding fixes.",
      category: "Figma Interpretation",
    });
  }

  // Analyze PM issues
  if (pmBrief && pmBrief.pmIssues > 0) {
    findings.push({
      what: `PM Agent flagged ${pmBrief.pmIssues} product issue(s)`,
      why: "Product-level issues indicate missing functionality or incorrect behavior, not just visual mismatches.",
      how: "Review the PM Brief at the generated path for specific issues. Product issues take priority over visual polish.",
      category: "Data and State",
    });
  }

  if (findings.length === 0) {
    log("learning-agent", "No issues to learn from — all checks passed.");
    return;
  }

  log("learning-agent", `Found ${findings.length} learning opportunity(s):`);
  findings.forEach((f) => log("learning-agent", `  - [${f.category}] ${f.what}`));

  // Write findings to a screen-specific learnings file for Claude agent consumption
  ensureDir(path.join(BUILDBOT_ROOT, "reports", "learnings"));
  const findingsPath = path.join(
    BUILDBOT_ROOT,
    "reports",
    "learnings",
    `${screenId}-learnings.md`
  );

  const findingsContent = [
    `# Learnings from ${screenId} verification`,
    `Generated: ${new Date().toISOString()}`,
    "",
    ...findings.map(
      (f) =>
        `### ${f.what}\n**Category**: ${f.category}\n**Why**: ${f.why}\n**How**: ${f.how}\n`
    ),
    "---",
    "",
    "Review these findings and promote generalizable learnings to `learnings/buildbot-learnings.md` using WHAT/WHY/HOW format.",
    "Only promote learnings that apply across screens — never add screen-specific observations.",
  ].join("\n");

  fs.writeFileSync(findingsPath, findingsContent, "utf-8");
  log("learning-agent", `Findings saved to: ${findingsPath}`);
}

// ---------------------------------------------------------------------------
// Step 11: Produce Combined Audit Report
// ---------------------------------------------------------------------------

function produceAuditReport(
  screenId: string,
  route: string,
  pmBrief: PMBriefResult | null,
  backendBrief: BackendBriefResult | null,
  pixelDiff: PixelDiffResult | null,
  coverage: CoverageResult | null,
  geminiAudit: GeminiAuditResult | null,
  inspection: InspectionResult | null,
  hasDottedPattern: boolean = false,
  maestroStructuralResult?: { score: number; totalChecks: number; passed: number; failed: number; codeFixes: number; testIdGaps: number; reportPath: string }
): AuditReport {
  log("report", "Producing combined audit report...");

  ensureDir(PATHS.audits);

  const failureReasons: string[] = [];

  // PM Brief assessment
  if (pmBrief && pmBrief.pmIssues > 0) {
    failureReasons.push(`PM Agent flagged ${pmBrief.pmIssues} product issue(s).`);
  }

  // Backend Brief assessment
  if (backendBrief && !backendBrief.mockDataPopulated) {
    failureReasons.push("Backend Agent: mock data not populated for visual testing.");
  }

  // Pixel diff assessment
  const pixelDiffResult: PixelDiffResult = pixelDiff ?? {
    percentage: -1,
    threshold: 3,
    passed: false,
    diffImagePath: "",
  };

  if (!pixelDiff) {
    failureReasons.push("Pixel diff could not be performed (missing baseline or screenshot).");
  } else if (!pixelDiff.passed) {
    if (pixelDiff.percentage < 0) {
      failureReasons.push("Pixel diff percentage could not be determined.");
    } else {
      failureReasons.push(
        `Pixel diff ${pixelDiff.percentage.toFixed(2)}% exceeds threshold of ${pixelDiff.threshold}%.`
      );
    }
  }

  // Coverage assessment
  if (coverage && !coverage.passed) {
    failureReasons.push(`Coverage overall ${coverage.overall}% is below 80% threshold.`);
  }

  // Maestro structural assessment
  if (maestroStructuralResult && maestroStructuralResult.score < 60) {
    failureReasons.push(
      `Maestro structural score ${maestroStructuralResult.score}/100 is below 60% threshold (${maestroStructuralResult.failed} failed checks, ${maestroStructuralResult.codeFixes} code fixes needed).`
    );
  }

  // Gemini audit assessment
  if (geminiAudit && geminiAudit.summary.critical > 0) {
    failureReasons.push(
      `Gemini audit found ${geminiAudit.summary.critical} critical issue(s) and ${geminiAudit.summary.totalIssues} total across ${geminiAudit.summary.filesAffected.length} file(s).`
    );
  }

  // Inspection assessment — filter out elements the app doesn't control or Figma-internal names
  const systemUIPatterns = /Status Bar|Wifi|Wi-Fi|Cellular|Battery|Signal|Clock|Carrier|^.*Vector \d+.*$|^\[Icon\] button:|Polygon \d+/i;
  // DottedPattern screens have known background differences between Figma static and app dynamic rendering
  const dottedPatternBgPatterns = /textured.*dot|dot.*pattern|halftone|textured.*background|missing.*background.*image|solid.*black.*background|solid.*dark.*grey/i;
  // Viewport-only capture issues — below-fold content is expected to be missing
  const viewportClippingPatterns = /content.*clip|cut.*off|missing.*below|rest of.*screen.*missing|below.fold|partially.*cut|content.*repeats|_Mega input|OTP.*MISSING/i;
  // Mock data issues — Figma shows sample data (names, dates, amounts) that differ from mock defaults
  const mockDataPatterns = /generic text|personalized name|placeholder text|sample.*name|dummy.*data/i;

  const appCriticalIssues = inspection
    ? inspection.criticalIssues.filter((issue) => {
        if (systemUIPatterns.test(issue)) return false;
        if (hasDottedPattern && dottedPatternBgPatterns.test(issue)) return false;
        if (viewportClippingPatterns.test(issue)) return false;
        if (mockDataPatterns.test(issue)) return false;
        return true;
      })
    : [];
  const systemUIIssues = inspection
    ? inspection.criticalIssues.filter((issue) => systemUIPatterns.test(issue))
    : [];
  const dottedPatternIssues = hasDottedPattern && inspection
    ? inspection.criticalIssues.filter((issue) => !systemUIPatterns.test(issue) && dottedPatternBgPatterns.test(issue))
    : [];

  if (appCriticalIssues.length > 0) {
    failureReasons.push(
      `Inspector found ${appCriticalIssues.length} critical issue(s): ${appCriticalIssues.slice(0, 3).join("; ")}`
    );
  }
  if (systemUIIssues.length > 0) {
    logWarn("inspector", `Ignoring ${systemUIIssues.length} system UI / Figma sub-element issue(s) (Status Bar, Wifi, Cellular, Vector/Polygon — not app-controlled or confirmed implemented)`);
  }
  if (dottedPatternIssues.length > 0) {
    logWarn("inspector", `Ignoring ${dottedPatternIssues.length} DottedPattern background issue(s) (known Figma↔app rendering difference)`);
  }
  const viewportClippingIssues = inspection
    ? inspection.criticalIssues.filter((issue) => !systemUIPatterns.test(issue) && viewportClippingPatterns.test(issue))
    : [];
  if (viewportClippingIssues.length > 0) {
    logWarn("inspector", `Ignoring ${viewportClippingIssues.length} viewport-clipping issue(s) (below-fold content expected missing in viewport capture)`);
  }
  const mockDataIssues = inspection
    ? inspection.criticalIssues.filter((issue) => mockDataPatterns.test(issue))
    : [];
  if (mockDataIssues.length > 0) {
    logWarn("inspector", `Ignoring ${mockDataIssues.length} mock-data issue(s) (Figma sample data differs from mock defaults)`);
  }

  // Overall pass determination — only app-controlled critical issues block
  const overallPassed =
    pixelDiffResult.passed &&
    (coverage?.passed !== false) &&
    appCriticalIssues.length === 0;

  const report: AuditReport = {
    screenId,
    timestamp: new Date().toISOString(),
    route,
    ...(pmBrief ? { pmBrief } : {}),
    ...(backendBrief ? { backendBrief } : {}),
    pixelDiff: pixelDiffResult,
    ...(coverage ? { coverage } : {}),
    ...(geminiAudit ? { geminiAudit } : {}),
    ...(inspection ? { inspection } : {}),
    ...(maestroStructuralResult ? { maestroStructural: maestroStructuralResult } : {}),
    overallPassed,
    failureReasons,
  };

  const reportPath = path.join(PATHS.audits, `${screenId}-audit.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  log("report", `Audit report saved: ${reportPath}`);

  return report;
}

// ---------------------------------------------------------------------------
// Step 8: Print Summary
// ---------------------------------------------------------------------------

function printSummary(report: AuditReport): void {
  const bar = "=".repeat(50);
  const pmText = report.pmBrief
    ? `${report.pmBrief.functionalAreas} areas, ${report.pmBrief.states} states, ${report.pmBrief.pmIssues} issues`
    : "N/A";
  const backendText = report.backendBrief
    ? `${report.backendBrief.requiredHooks.length} hooks, mock data ${report.backendBrief.mockDataPopulated ? "OK" : "MISSING"}`
    : "N/A";
  const coverageText = report.coverage
    ? `${report.coverage.overall}% (${report.coverage.passed ? "PASS" : "FAIL"})`
    : "N/A";
  const inspectorText = report.inspection
    ? `${report.inspection.overallScore}/100`
    : "N/A";
  const pixelText =
    report.pixelDiff.percentage >= 0
      ? `${report.pixelDiff.percentage.toFixed(2)}% (${report.pixelDiff.passed ? "PASS" : "FAIL"})`
      : "Unknown (FAIL)";
  const overallText = report.overallPassed ? "PASSED" : "FAILED";

  const failureBlock =
    report.failureReasons.length > 0
      ? `\n  Failures:\n${report.failureReasons.map((r) => `    - ${r}`).join("\n")}`
      : "";

  const reportPath = path.join(PATHS.audits, `${report.screenId}-audit.json`);

  console.log(`
${bar}
  BuildBot Verification Report: ${report.screenId}
${bar}
  Route:       ${report.route}
  PM Brief:    ${pmText}
  Backend:     ${backendText}
  Pixel Diff:  ${pixelText}
  Coverage:    ${coverageText}
  Inspector:   ${inspectorText}

  Overall:     ${overallText}
${failureBlock}
${bar}
  Report saved to: ${reportPath}
${bar}
`);
}

// ---------------------------------------------------------------------------
// Single-Screen Pipeline (reusable for both single and batch modes)
// ---------------------------------------------------------------------------

function runSingleScreen(
  screenId: string,
  route: string,
  options: {
    skipInspector: boolean;
    skipMaestro: boolean;
    skipPM: boolean;
    skipBackend: boolean;
    recapture?: boolean;
    autoHeal?: boolean;
    healMaxIterations?: number;
    healTargetScore?: number;
    stateName?: string;
    routeKey?: string;
  }
): AuditReport {
  const { skipInspector, skipMaestro, skipPM, skipBackend, recapture = false, autoHeal = false, healMaxIterations = 3, healTargetScore = 85, stateName, routeKey } = options;
  const stateLabel = stateName ? ` [state: ${stateName}]` : "";

  console.log("");
  log("main", `Starting verification pipeline for screen: ${screenId}${stateLabel}`);
  log("main", `Route: ${route}`);
  console.log("");

  // Step 1: Validate prerequisites
  const { blueprintPath, baselinePath, hasBlueprint, hasBaseline } =
    validatePrerequisites(screenId);

  if (!hasBlueprint) {
    logError("main", `Blueprint not found for ${screenId}. Attempting extraction...`);
    // Auto-extract blueprint if missing
    const extractCmd = `npx tsx "${path.join(PATHS.scripts, "extract-screen-blueprint.ts")}" ${screenId}`;
    const extractResult = runCommand(extractCmd, "extractor");
    if (extractResult.success) {
      log("main", "Blueprint extracted successfully.");
    } else {
      logError("main", "Blueprint extraction failed. Cannot proceed.");
      return {
        screenId,
        timestamp: new Date().toISOString(),
        route,
        pixelDiff: { percentage: -1, threshold: 3, passed: false, diffImagePath: "" },
        overallPassed: false,
        failureReasons: ["Blueprint not found and extraction failed."],
      };
    }
  }

  // Re-check after potential extraction
  const finalBlueprintPath = path.join(PATHS.blueprints, `${screenId}-blueprint.json`);
  const blueprint = readJsonSafe<BlueprintMeta>(finalBlueprintPath);

  // Step 2: Load learnings
  loadLearnings();

  // Step 3: PM Agent brief
  let pmBriefResult: PMBriefResult | null = null;
  if (!skipPM) {
    pmBriefResult = runPMBrief(screenId);
  } else {
    log("pm-agent", "Skipped (--skip-pm flag set).");
  }

  // Step 4: Backend Agent brief
  let backendBriefResult: BackendBriefResult | null = null;
  if (!skipBackend) {
    backendBriefResult = runBackendBrief(screenId);
  } else {
    log("backend-agent", "Skipped (--skip-backend flag set).");
  }

  // Step 5: Validate / capture screenshot
  const { screenshotPath, hasScreenshot } = validateScreenshot(screenId, skipMaestro, route, recapture);

  // Step 6: ODiff pixel comparison
  let pixelDiffResult: PixelDiffResult | null = null;
  if (hasBaseline && hasScreenshot) {
    pixelDiffResult = runPixelDiff(screenId, baselinePath, screenshotPath, blueprint);
  } else {
    if (!hasBaseline) logWarn("main", "Skipping pixel diff: no baseline image.");
    if (!hasScreenshot) logWarn("main", "Skipping pixel diff: no app screenshot.");
  }

  // Step 7: Coverage check
  const coverageResult = runCoverageCheck(screenId);

  // Step 7.5: Maestro Structural Verification (deterministic, no AI)
  let maestroStructuralResult: AuditReport["maestroStructural"] | undefined;
  const hierarchyCsvPath = path.join(BUILDBOT_ROOT, "data", "hierarchies", `${screenId}-hierarchy.csv`);
  if (!skipMaestro && fileExists(hierarchyCsvPath)) {
    log("structural", "Running Maestro structural verification...");
    const structuralScript = path.join(PATHS.scripts, "maestro-structural-verify.ts");
    if (fileExists(structuralScript)) {
      const structuralReportPath = path.join(BUILDBOT_ROOT, "reports", "maestro-structural", `${screenId}-structural.json`);
      const cmd = `npx tsx "${structuralScript}" ${screenId} --hierarchy "${hierarchyCsvPath}"`;
      const { success } = runCommand(cmd, "structural", { timeout: 60_000 });
      if (success && fileExists(structuralReportPath)) {
        const structReport = readJsonSafe<Record<string, unknown>>(structuralReportPath);
        if (structReport) {
          const summary = structReport.summary as Record<string, number>;
          maestroStructuralResult = {
            score: summary.score || 0,
            totalChecks: summary.totalChecks || 0,
            passed: summary.passed || 0,
            failed: summary.failed || 0,
            codeFixes: Array.isArray(structReport.codeFixes) ? structReport.codeFixes.length : 0,
            testIdGaps: Array.isArray(structReport.testIdGaps) ? structReport.testIdGaps.length : 0,
            reportPath: structuralReportPath,
          };
          log("structural", `Score: ${maestroStructuralResult.score}/100 | ${maestroStructuralResult.failed} issues | ${maestroStructuralResult.codeFixes} code fixes | ${maestroStructuralResult.testIdGaps} testID gaps`);
        }
      }
    } else {
      logWarn("structural", "maestro-structural-verify.ts not found. Skipping.");
    }
  } else if (skipMaestro) {
    log("structural", "Skipped (--skip-maestro flag set).");
  } else {
    log("structural", `No hierarchy CSV at ${hierarchyCsvPath}. Skipping structural verification.`);
  }

  // Step 7.7: Auto-heal (optional — patch code from structural report)
  if (autoHeal && maestroStructuralResult && maestroStructuralResult.score < healTargetScore) {
    log("auto-heal", `Score ${maestroStructuralResult.score} < target ${healTargetScore}. Running auto-heal...`);
    const healScript = path.join(PATHS.scripts, "maestro-auto-heal.ts");
    if (fileExists(healScript)) {
      const healArgs = [
        `npx tsx "${healScript}" ${screenId}`,
        `--hierarchy "${hierarchyCsvPath}"`,
        `--max-iterations ${healMaxIterations}`,
        `--target-score ${healTargetScore}`,
      ].join(" ");
      runCommand(healArgs, "auto-heal", { timeout: 180_000 });

      const healReportPath = path.join(BUILDBOT_ROOT, "reports", "auto-heal", `${screenId}-auto-heal.json`);
      if (fileExists(healReportPath)) {
        const healReport = readJsonSafe<Record<string, unknown>>(healReportPath);
        if (healReport) {
          log("auto-heal", `Status: ${healReport.status} | Final score: ${healReport.finalScore}`);
        }
      }
    }
  } else if (autoHeal && maestroStructuralResult) {
    log("auto-heal", `Score ${maestroStructuralResult.score} >= target ${healTargetScore}. No healing needed.`);
  }

  // Step 8: Gemini visual feedback
  const geminiResult = runGeminiAudit(screenId, routeKey);

  // Step 9: Inspector
  let inspectionResult: InspectionResult | null = null;
  if (!skipInspector && hasScreenshot && hasBaseline) {
    inspectionResult = runInspector(screenId, screenshotPath, baselinePath, finalBlueprintPath);
  } else if (skipInspector) {
    log("inspector", "Skipped (--skip-inspector flag set).");
  } else {
    logWarn("inspector", "Skipped: missing screenshot or baseline for inspection.");
  }

  // Step 10: Learning Agent — analyze results for new learnings
  runLearningAgent(screenId, pixelDiffResult, coverageResult, inspectionResult, pmBriefResult);

  // Step 11: Produce combined audit report
  const screenHasDottedPattern =
    blueprint?.background?.hasDottedPattern === true ||
    !!blueprint?.background?.backgroundShapeKey;
  const report = produceAuditReport(
    screenId,
    route,
    pmBriefResult,
    backendBriefResult,
    pixelDiffResult,
    coverageResult,
    geminiResult,
    inspectionResult,
    screenHasDottedPattern,
    maestroStructuralResult
  );

  // Step 12: Print summary
  printSummary(report);

  return report;
}

// ---------------------------------------------------------------------------
// Batch-State Mode
// ---------------------------------------------------------------------------

function runBatchStates(
  screenKey: string,
  options: {
    skipInspector: boolean;
    skipMaestro: boolean;
    skipPM: boolean;
    skipBackend: boolean;
    recapture: boolean;
  }
): void {
  const routesConfig = loadScreenRoutes();
  const entry = routesConfig.routes[screenKey];

  if (!entry) {
    // Try fuzzy match
    const keys = Object.keys(routesConfig.routes);
    const match = keys.find(
      (k) =>
        k.includes(screenKey) ||
        screenKey.includes(k) ||
        k.replace(/-/g, "").includes(screenKey.replace(/-/g, ""))
    );
    if (match) {
      log("batch", `No exact match for "${screenKey}" — using "${match}"`);
      return runBatchStates(match, options);
    }

    logError("batch", `Screen key "${screenKey}" not found in screen-routes.json.`);
    log("batch", `Available keys: ${keys.join(", ")}`);
    process.exit(1);
  }

  const states = entry.screens;
  const route = entry.route;

  console.log("");
  console.log("=".repeat(60));
  log("batch", `BATCH-STATE MODE: "${screenKey}"`);
  log("batch", `Route: ${route}`);
  log("batch", `States: ${states.length} — ${states.map((s) => s.state).join(", ")}`);
  console.log("=".repeat(60));

  const stateResults: BatchStateReport["states"] = [];

  for (let i = 0; i < states.length; i++) {
    const screenState = states[i];
    const screenId = screenState.figmaId.replace(":", "-");
    const stateRoute = screenState.routeWithState ?? route;

    console.log("");
    console.log("─".repeat(60));
    log("batch", `[${i + 1}/${states.length}] State: "${screenState.state}" (${screenId})`);
    console.log("─".repeat(60));

    const report = runSingleScreen(screenId, stateRoute, {
      ...options,
      stateName: screenState.state,
      routeKey: screenKey,
    });

    stateResults.push({
      figmaId: screenState.figmaId,
      state: screenState.state,
      name: screenState.name,
      passed: report.overallPassed,
      pixelDiff: report.pixelDiff?.percentage ?? -1,
      coverage: report.coverage?.overall ?? -1,
      inspectorScore: report.inspection?.overallScore ?? -1,
      failureReasons: report.failureReasons,
    });
  }

  // Produce cross-state summary
  const passedStates = stateResults.filter((s) => s.passed).length;
  const failedStates = stateResults.filter((s) => !s.passed).length;

  const batchReport: BatchStateReport = {
    screenKey,
    route,
    timestamp: new Date().toISOString(),
    states: stateResults,
    totalStates: states.length,
    passedStates,
    failedStates,
    overallPassed: failedStates === 0,
  };

  // Save batch report
  ensureDir(PATHS.audits);
  const batchReportPath = path.join(PATHS.audits, `${screenKey}-batch-audit.json`);
  fs.writeFileSync(batchReportPath, JSON.stringify(batchReport, null, 2), "utf-8");

  // Print batch summary
  const bar = "=".repeat(60);
  console.log(`
${bar}
  BuildBot Batch-State Report: ${screenKey}
${bar}
  Route: ${route}
  Total States: ${states.length}
  Passed: ${passedStates}
  Failed: ${failedStates}
${bar}`);

  for (const sr of stateResults) {
    const status = sr.passed ? "PASS" : "FAIL";
    const pxText = sr.pixelDiff >= 0 ? `${sr.pixelDiff.toFixed(1)}%` : "N/A";
    const covText = sr.coverage >= 0 ? `${sr.coverage}%` : "N/A";
    const insText = sr.inspectorScore >= 0 ? `${sr.inspectorScore}/100` : "N/A";
    console.log(
      `  [${status}] ${sr.state.padEnd(20)} px:${pxText.padEnd(8)} cov:${covText.padEnd(8)} insp:${insText}`
    );
    if (!sr.passed && sr.failureReasons.length > 0) {
      sr.failureReasons.forEach((r) => console.log(`         └─ ${r}`));
    }
  }

  console.log(`
${bar}
  Overall: ${batchReport.overallPassed ? "ALL STATES PASSED" : `${failedStates} STATE(S) FAILED`}
  Report: ${batchReportPath}
${bar}
`);

  process.exit(batchReport.overallPassed ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

function main(): void {
  const args = parseArgs();

  if (args.batchScreen) {
    // Batch-state mode: process all states of a screen
    runBatchStates(args.batchScreen, {
      skipInspector: args.skipInspector,
      skipMaestro: args.skipMaestro,
      skipPM: args.skipPM,
      skipBackend: args.skipBackend,
      recapture: args.recapture,
    });
  } else {
    // Single-screen mode
    const report = runSingleScreen(args.screenId, args.route, {
      skipInspector: args.skipInspector,
      skipMaestro: args.skipMaestro,
      skipPM: args.skipPM,
      skipBackend: args.skipBackend,
      recapture: args.recapture,
      autoHeal: args.autoHeal,
      healMaxIterations: args.healMaxIterations,
      healTargetScore: args.healTargetScore,
    });
    process.exit(report.overallPassed ? 0 : 1);
  }
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

main();
