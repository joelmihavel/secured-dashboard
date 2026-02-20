/**
 * capture-all-hierarchies.ts — Batch hierarchy capture via Maestro CLI
 *
 * Navigates to each screen defined in screen-routes.json,
 * captures the view hierarchy via `maestro hierarchy` CLI,
 * converts the JSON output to CSV format expected by maestro-structural-verify.ts,
 * and captures a fresh screenshot.
 *
 * Usage:
 *   npx tsx scripts/capture-all-hierarchies.ts
 *   npx tsx scripts/capture-all-hierarchies.ts --flow splash
 *   npx tsx scripts/capture-all-hierarchies.ts --flow auth    (splash + beta-splash + carousel + sign-up + otp)
 *   npx tsx scripts/capture-all-hierarchies.ts --screen 1-28055
 *   npx tsx scripts/capture-all-hierarchies.ts --skip-screenshot
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const BUILDBOT_ROOT = path.join(__dirname, "..");
const HIERARCHIES_DIR = path.join(BUILDBOT_ROOT, "data", "hierarchies");
const SCREENSHOTS_DIR = path.join(BUILDBOT_ROOT, "data", "screenshots");
const ROUTES_PATH = path.join(BUILDBOT_ROOT, "config", "screen-routes.json");

const URL_SCHEME = "flentsecured";
const SETTLE_MS = 4000;

// Flow groupings for --flow flag
const FLOW_GROUPS: Record<string, string[]> = {
  auth: ["splash", "beta-splash", "carousel", "sign-up", "otp"],
  onboarding: ["waitlist", "agreement-upload", "agreement-review", "setup", "add-bank", "invite-landlord"],
  home: ["home-empty", "home-active"],
  payment: ["payment-select", "payment-add-upi", "payment-add-card", "payment-add-netbanking", "payment-processing", "payment-success", "payment-failed"],
  profile: ["profile"],
  transactions: ["transactions"],
  "payment-cards": ["payment-cards"],
};

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

interface MaestroNode {
  attributes: Record<string, string>;
  children?: MaestroNode[];
}

interface ScreenEntry {
  figmaId: string;
  name: string;
  state: string;
  routeWithState?: string;
}

interface RouteEntry {
  figmaPatterns: string[];
  route: string;
  screens: ScreenEntry[];
}

interface ScreenRoutes {
  routes: Record<string, RouteEntry>;
}

interface CsvRow {
  element_num: number;
  depth: number;
  bounds: string;
  attributes: string;
  parent_num: number | "";
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms: number): void {
  try { execSync(`sleep ${ms / 1000}`, { stdio: "pipe" }); } catch { /* ok */ }
}

// ──────────────────────────────────────────────────────────────────────
// JSON → CSV Converter
// ──────────────────────────────────────────────────────────────────────

function flattenHierarchy(node: MaestroNode, depth: number, parentNum: number | "", rows: CsvRow[]): void {
  const elementNum = rows.length;
  const bounds = node.attributes?.bounds || "[0,0][0,0]";

  // Build attributes string: key=value; key2=value2
  const attrParts: string[] = [];
  for (const [key, value] of Object.entries(node.attributes || {})) {
    if (key === "bounds") continue;
    if (value === "" || value === "false") continue;
    attrParts.push(`${key}=${value}`);
  }

  rows.push({
    element_num: elementNum,
    depth,
    bounds: `"${bounds}"`,
    attributes: `"${attrParts.join("; ").replace(/"/g, '""')}"`,
    parent_num: parentNum,
  });

  if (node.children) {
    for (const child of node.children) {
      flattenHierarchy(child, depth + 1, elementNum, rows);
    }
  }
}

function jsonToCsv(jsonStr: string): string {
  const root: MaestroNode = JSON.parse(jsonStr);
  const rows: CsvRow[] = [];
  flattenHierarchy(root, 0, "", rows);

  const header = "element_num,depth,bounds,attributes,parent_num";
  const lines = rows.map(r =>
    `${r.element_num},${r.depth},${r.bounds},${r.attributes},${r.parent_num}`
  );
  return [header, ...lines].join("\n") + "\n";
}

// ──────────────────────────────────────────────────────────────────────
// Capture functions
// ──────────────────────────────────────────────────────────────────────

let appWarmedUp = false;

function warmUpApp(): void {
  if (appWarmedUp) return;
  log("Warming up app via Maestro openLink (bypasses Expo Dev Client launcher)...");
  const tmpFlow = `/tmp/buildbot-warmup-${process.pid}.yaml`;
  fs.writeFileSync(tmpFlow, `appId: com.flent.secured\n---\n- openLink: "flentsecured:///(auth)/splash"\n`);
  try {
    execSync(`maestro test "${tmpFlow}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60_000,
    });
    log("App warmed up successfully.");
    appWarmedUp = true;
    sleep(3000);
  } catch (e) {
    log(`WARN: Warmup failed - ${(e as Error).message}. Will try xcrun simctl openurl directly.`);
  }
  try { fs.unlinkSync(tmpFlow); } catch { /* ok */ }
}

function navigateToScreen(route: string): boolean {
  // Screens with auto-transition need preview=true
  const previewRoutes = ["/(auth)/beta-splash"];
  const finalRoute = previewRoutes.includes(route) ? `${route}?preview=true` : route;
  const deepLink = `${URL_SCHEME}://${finalRoute}`;

  log(`  Navigating: ${deepLink}`);
  try {
    // Fast path: xcrun simctl openurl (works after Maestro warmup loads app past Dev Client launcher)
    execSync(`xcrun simctl openurl booted "${deepLink}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15_000,
    });
    return true;
  } catch (e) {
    log(`  ERROR: Navigation failed - ${(e as Error).message}`);
    return false;
  }
}

function captureHierarchyJson(): string | null {
  try {
    const output = execSync("maestro hierarchy 2>/dev/null", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
    });
    // maestro hierarchy prints the device line first, then JSON
    // Find the start of JSON
    const jsonStart = output.indexOf("{");
    if (jsonStart === -1) {
      log("  ERROR: No JSON found in maestro hierarchy output");
      return null;
    }
    return output.slice(jsonStart);
  } catch (e) {
    log(`  ERROR: maestro hierarchy failed - ${(e as Error).message}`);
    return null;
  }
}

function captureScreenshot(screenId: string): boolean {
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${screenId}.png`);
  try {
    execSync(`xcrun simctl io booted screenshot "${screenshotPath}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15_000,
    });
    log(`  Screenshot: ${screenId}.png`);
    return true;
  } catch {
    log(`  WARN: Screenshot capture failed for ${screenId}`);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  let flowFilter: string | null = null;
  let screenFilter: string | null = null;
  let skipScreenshot = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--flow") flowFilter = args[++i];
    if (args[i] === "--screen") screenFilter = args[++i];
    if (args[i] === "--skip-screenshot") skipScreenshot = true;
  }

  ensureDir(HIERARCHIES_DIR);
  ensureDir(SCREENSHOTS_DIR);

  // Load routes
  const routesData: ScreenRoutes = JSON.parse(fs.readFileSync(ROUTES_PATH, "utf-8"));

  // Determine which route keys to process
  let routeKeys: string[];
  if (screenFilter) {
    // Find the route key containing this screen ID
    routeKeys = [];
    for (const [key, entry] of Object.entries(routesData.routes)) {
      if (entry.screens.some(s => s.figmaId === screenFilter)) {
        routeKeys.push(key);
        break;
      }
    }
    if (routeKeys.length === 0) {
      log(`ERROR: Screen ${screenFilter} not found in screen-routes.json`);
      process.exit(1);
    }
  } else if (flowFilter) {
    if (flowFilter === "all") {
      routeKeys = Object.keys(routesData.routes);
    } else if (FLOW_GROUPS[flowFilter]) {
      routeKeys = FLOW_GROUPS[flowFilter];
    } else if (routesData.routes[flowFilter]) {
      routeKeys = [flowFilter];
    } else {
      log(`ERROR: Unknown flow "${flowFilter}". Available: ${Object.keys(FLOW_GROUPS).join(", ")}, all, or a route key`);
      process.exit(1);
    }
  } else {
    routeKeys = Object.keys(routesData.routes);
  }

  // Pre-flight: check simulator
  try {
    const simOut = execSync("xcrun simctl list devices booted", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    if (!simOut.includes("(Booted)")) {
      log("ERROR: No booted iOS simulator found");
      process.exit(1);
    }
  } catch {
    log("ERROR: Cannot check simulator status");
    process.exit(1);
  }

  // Warm up app via Maestro to bypass Expo Dev Client launcher
  warmUpApp();

  // Process screens
  let totalScreens = 0;
  let captured = 0;
  let failed = 0;

  for (const routeKey of routeKeys) {
    const entry = routesData.routes[routeKey];
    if (!entry) {
      log(`WARN: Route key "${routeKey}" not in screen-routes.json. Skipping.`);
      continue;
    }

    log(`\n═══ Flow: ${routeKey} (${entry.screens.length} screens) ═══`);

    for (const screen of entry.screens) {
      totalScreens++;
      const screenId = screen.figmaId;
      const route = screen.routeWithState || entry.route;

      // Skip if specific screen filter doesn't match
      if (screenFilter && screenId !== screenFilter) continue;

      log(`\n  Screen: ${screen.name} (${screenId})`);

      // Navigate
      if (!navigateToScreen(route)) {
        failed++;
        continue;
      }

      // Wait for render
      sleep(SETTLE_MS);

      // Capture hierarchy
      const hierarchyJson = captureHierarchyJson();
      if (hierarchyJson) {
        try {
          const csv = jsonToCsv(hierarchyJson);
          const csvPath = path.join(HIERARCHIES_DIR, `${screenId}-hierarchy.csv`);
          fs.writeFileSync(csvPath, csv, "utf-8");
          log(`  Hierarchy: ${screenId}-hierarchy.csv (${csv.split("\n").length - 1} elements)`);
          captured++;
        } catch (e) {
          log(`  ERROR: JSON→CSV conversion failed - ${(e as Error).message}`);
          failed++;
        }
      } else {
        failed++;
      }

      // Capture screenshot
      if (!skipScreenshot) {
        captureScreenshot(screenId);
      }
    }
  }

  log(`\n═══ DONE ═══`);
  log(`Total: ${totalScreens} | Captured: ${captured} | Failed: ${failed}`);
}

main();
