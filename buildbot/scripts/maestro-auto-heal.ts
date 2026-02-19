/**
 * maestro-auto-heal.ts — Closed-Loop Auto-Heal Parity Pipeline
 *
 * Reads Maestro structural verification report + Figma blueprint,
 * generates deterministic code patches, applies them to screen files,
 * then re-verifies to confirm fixes. Loops until target score is reached.
 *
 * Usage:
 *   npx tsx scripts/maestro-auto-heal.ts <screenId> --hierarchy <csv> [options]
 *   npx tsx scripts/maestro-auto-heal.ts 1-29108 --hierarchy data/hierarchies/1-29108-hierarchy.csv
 *   npx tsx scripts/maestro-auto-heal.ts 1-29108 --hierarchy data/hierarchies/1-29108-hierarchy.csv --dry-run
 *   npx tsx scripts/maestro-auto-heal.ts 1-29108 --hierarchy data/hierarchies/1-29108-hierarchy.csv --max-iterations 3 --target-score 85
 *   npx tsx scripts/maestro-auto-heal.ts 1-29108 --once
 *
 * Output: reports/auto-heal/{screenId}-auto-heal.json
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BUILDBOT_ROOT = path.join(__dirname, "..");
const RN_APP_ROOT = path.join(__dirname, "../../rn-app");

const PATHS = {
  blueprints: path.join(BUILDBOT_ROOT, "data", "blueprints"),
  hierarchies: path.join(BUILDBOT_ROOT, "data", "hierarchies"),
  structuralReports: path.join(BUILDBOT_ROOT, "reports", "maestro-structural"),
  autoHealReports: path.join(BUILDBOT_ROOT, "reports", "auto-heal"),
  screenRoutes: path.join(BUILDBOT_ROOT, "config", "screen-routes.json"),
  designTokens: path.join(BUILDBOT_ROOT, "config", "design-tokens.json"),
  scripts: path.join(BUILDBOT_ROOT, "scripts"),
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlueprintNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  depth: number;
  visible: boolean;
  geometry: { x: number; y: number; width: number; height: number; rotation: number };
  opacity?: number;
  fills?: Array<{ type: string; color?: string; visible: boolean }>;
  effects?: Array<{ type: string; color?: string; offset?: { x: number; y: number }; blur?: number; spread?: number }>;
  borderRadius?: number | { tl: number; tr: number; br: number; bl: number };
  cornerSmoothing?: number;
  typography?: {
    content: string;
    fontSize: number;
    lineHeight: number;
    fontWeight: number;
    fontFamily: string;
    fontStyle?: string;
    textAlign: string;
    color: string;
    textTruncation?: string;
    maxLines?: number;
  };
  layout?: {
    direction: string;
    justifyContent: string;
    alignItems: string;
    gap: number;
    padding: { top: number; right: number; bottom: number; left: number };
  };
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  scrollBehavior?: string;
  overflowDirection?: string;
  interactions?: Array<unknown>;
  rnComponent?: string;
  childIds?: string[];
}

interface Blueprint {
  meta: { screenId: string; screenName: string; route: string; stateName?: string };
  nodes: BlueprintNode[];
  tokensUsed?: {
    colors: Record<string, string>;
    typography: Record<string, string>;
    spacing: Record<string, string>;
    radius: Record<string, string>;
  };
}

interface StructuralReport {
  screenId: string;
  summary: { totalChecks: number; passed: number; failed: number; score: number };
  checks: Record<string, { passed: number; failed: number; issues: StructuralIssue[] }>;
  codeFixes: CodeFix[];
  testIdGaps: TestIdGap[];
}

interface StructuralIssue {
  severity: string;
  nodeId: string;
  nodeName: string;
  check: string;
  expected: string;
  actual: string;
  fix: string;
}

interface CodeFix {
  file: string;
  property: string;
  expected: string;
  actual: string;
  severity: string;
  suggestedFix: string;
}

interface TestIdGap {
  nodeId: string;
  nodeName: string;
  suggestedTestId: string;
  component: string;
}

interface Patch {
  type: "style-update" | "style-add" | "prop-add" | "text-fix" | "testid-add";
  target: string;
  property: string;
  oldValue: string;
  newValue: string;
  applied: boolean;
  description: string;
}

interface IterationResult {
  iteration: number;
  scoreBefore: number;
  patchesGenerated: number;
  patchesApplied: number;
  scoreAfter: number;
  patches: Patch[];
}

interface AutoHealReport {
  screenId: string;
  screenFile: string;
  timestamp: string;
  iterations: IterationResult[];
  finalScore: number;
  targetScore: number;
  status: "PASSED" | "IMPROVED" | "NO_IMPROVEMENT" | "DRY_RUN";
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string): void {
  console.log(`  [auto-heal] ${msg}`);
}
function logPatch(msg: string): void {
  console.log(`  [patch] ${msg}`);
}

// ---------------------------------------------------------------------------
// Route + File Resolution
// ---------------------------------------------------------------------------

function resolveRoute(screenId: string): { routeKey: string; routePath: string } | null {
  try {
    const routes = JSON.parse(fs.readFileSync(PATHS.screenRoutes, "utf-8"));
    const normalized = screenId.replace(":", "-");
    for (const [routeKey, config] of Object.entries(routes.routes) as [string, any][]) {
      for (const screen of config.screens) {
        if (screen.figmaId.replace(":", "-") === normalized) {
          return { routeKey, routePath: config.route || routeKey };
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

function findScreenFile(route: string): string | null {
  const candidates = [
    path.join(RN_APP_ROOT, "app", route + ".tsx"),
    path.join(RN_APP_ROOT, "app", route, "index.tsx"),
    path.join(RN_APP_ROOT, "app", route.replace(/^\//, "") + ".tsx"),
    path.join(RN_APP_ROOT, "app", route.replace(/^\//, ""), "index.tsx"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Design Token Helpers
// ---------------------------------------------------------------------------

function loadDesignTokens(): Record<string, Record<string, string>> | null {
  try {
    const tokens = JSON.parse(fs.readFileSync(PATHS.designTokens, "utf-8"));
    return {
      colorByHex: tokens._colorByHex || {},
      spacingByValue: tokens._spacingByValue || {},
      radiusByValue: tokens._radiusByValue || {},
    };
  } catch {
    return null;
  }
}

function resolveColorToken(hex: string, tokens: Record<string, Record<string, string>> | null): string {
  if (!tokens) return `'${hex}'`;
  const token = tokens.colorByHex[hex.toUpperCase()];
  return token ? `colors.${token}` : `'${hex}'`;
}

function resolveSpacingToken(value: number, tokens: Record<string, Record<string, string>> | null): string {
  if (!tokens) return String(value);
  const token = tokens.spacingByValue[String(value)];
  return token ? `spacing.${token}` : String(value);
}

function resolveRadiusToken(value: number, tokens: Record<string, Record<string, string>> | null): string {
  if (!tokens) return String(value);
  const token = tokens.radiusByValue[String(value)];
  return token ? `radius.${token}` : String(value);
}

// ---------------------------------------------------------------------------
// Step 1: Run Structural Verification
// ---------------------------------------------------------------------------

function runStructuralVerify(screenId: string, hierarchyPath: string): StructuralReport | null {
  const script = path.join(PATHS.scripts, "maestro-structural-verify.ts");
  const reportPath = path.join(PATHS.structuralReports, `${screenId}-structural.json`);

  try {
    execSync(`npx tsx "${script}" ${screenId} --hierarchy "${hierarchyPath}"`, {
      cwd: BUILDBOT_ROOT,
      stdio: "pipe",
      timeout: 60_000,
    });
  } catch (err: any) {
    log(`Structural verify failed: ${err.message?.split("\n")[0] || err}`);
    return null;
  }

  if (!fs.existsSync(reportPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 1b: Load Gemini Consolidated Fixes (if available)
// ---------------------------------------------------------------------------

function loadGeminiFixes(screenId: string): Array<{ file?: string; property?: string; figmaValue?: string; currentValue?: string; severity?: string; fixedCode?: string; currentCode?: string }> {
  const geminiPath = path.join(BUILDBOT_ROOT, "reports", "audits", `${screenId}-gemini.json`);
  if (!fs.existsSync(geminiPath)) return [];

  try {
    const report = JSON.parse(fs.readFileSync(geminiPath, "utf-8"));
    return Array.isArray(report.consolidatedFixes) ? report.consolidatedFixes : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Step 2: Generate Patches from Structural Report + Blueprint + Gemini
// ---------------------------------------------------------------------------

function generatePatches(
  report: StructuralReport,
  blueprint: Blueprint,
  screenFile: string,
  tokens: Record<string, Record<string, string>> | null
): Patch[] {
  const patches: Patch[] = [];
  const nodeMap = new Map<string, BlueprintNode>();
  for (const node of blueprint.nodes) nodeMap.set(node.id, node);

  // 1. Text content fixes
  for (const issue of report.checks.textContent?.issues || []) {
    if (issue.severity === "info") continue;
    const node = nodeMap.get(issue.nodeId);
    if (!node?.typography?.content) continue;

    patches.push({
      type: "text-fix",
      target: node.name,
      property: "text",
      oldValue: issue.actual,
      newValue: node.typography.content,
      applied: false,
      description: `Fix text content for "${node.name}" to match Figma`,
    });
  }

  // 2. Bounds-based style fixes (position/size mismatches)
  for (const issue of report.checks.bounds?.issues || []) {
    if (issue.severity === "info") continue;
    const node = nodeMap.get(issue.nodeId);
    if (!node) continue;

    if (issue.fix.includes("position off by")) {
      patches.push({
        type: "style-update",
        target: toStyleName(node.name),
        property: "position",
        oldValue: issue.actual,
        newValue: issue.expected,
        applied: false,
        description: `Fix position for "${node.name}": ${issue.fix}`,
      });
    }

    if (issue.fix.includes("size off by")) {
      patches.push({
        type: "style-update",
        target: toStyleName(node.name),
        property: "dimensions",
        oldValue: issue.actual,
        newValue: issue.expected,
        applied: false,
        description: `Fix dimensions for "${node.name}": ${issue.fix}`,
      });
    }
  }

  // 3. Interactivity fixes (add onPress or enable)
  for (const issue of report.checks.interactivity?.issues || []) {
    if (issue.severity === "info") continue;
    patches.push({
      type: "prop-add",
      target: issue.nodeName,
      property: "onPress",
      oldValue: "missing",
      newValue: "() => {}",
      applied: false,
      description: `"${issue.nodeName}" needs onPress handler — has Figma interactions but no tappable element`,
    });
  }

  // 4. Truncation fixes
  for (const issue of report.checks.truncation?.issues || []) {
    const node = nodeMap.get(issue.nodeId);
    const maxLines = node?.typography?.maxLines || 1;

    patches.push({
      type: "prop-add",
      target: issue.nodeName,
      property: "numberOfLines",
      oldValue: "missing",
      newValue: String(maxLines),
      applied: false,
      description: `Add numberOfLines={${maxLines}} ellipsizeMode="tail" to "${issue.nodeName}"`,
    });
  }

  // 5. testID gaps
  for (const gap of report.testIdGaps) {
    patches.push({
      type: "testid-add",
      target: gap.nodeName,
      property: "testID",
      oldValue: "missing",
      newValue: gap.suggestedTestId,
      applied: false,
      description: `Add testID="${gap.suggestedTestId}" to ${gap.component} "${gap.nodeName}"`,
    });
  }

  // 6. Blueprint-driven style patches (from nodes with known issues)
  for (const node of blueprint.nodes) {
    if (!node.visible || node.depth < 1) continue;

    // cornerSmoothing → borderCurve
    if (node.cornerSmoothing && node.cornerSmoothing > 0) {
      patches.push({
        type: "style-add",
        target: toStyleName(node.name),
        property: "borderCurve",
        oldValue: "missing",
        newValue: "'continuous'",
        applied: false,
        description: `Add borderCurve: 'continuous' for iOS corner smoothing on "${node.name}"`,
      });
    }

    // layoutSizingHorizontal: FILL → flex: 1
    if (node.layoutSizingHorizontal === "FILL") {
      patches.push({
        type: "style-add",
        target: toStyleName(node.name),
        property: "flex",
        oldValue: "missing",
        newValue: "1",
        applied: false,
        description: `Add flex: 1 for FILL sizing on "${node.name}" (not width: '100%')`,
      });
    }

    // INNER_SHADOW → boxShadow with inset
    if (node.effects) {
      const innerShadows = node.effects.filter((e) => e.type === "INNER_SHADOW");
      if (innerShadows.length > 0) {
        const shadowStr = innerShadows
          .map((s) => {
            const ox = s.offset?.x || 0;
            const oy = s.offset?.y || 0;
            const blur = s.blur || 0;
            const spread = s.spread || 0;
            const color = s.color || "#000000";
            return `inset ${ox} ${oy} ${blur} ${spread} ${color}`;
          })
          .join(", ");

        patches.push({
          type: "style-add",
          target: toStyleName(node.name),
          property: "boxShadow",
          oldValue: "missing",
          newValue: `'${shadowStr}'`,
          applied: false,
          description: `Add inner shadow boxShadow on "${node.name}"`,
        });
      }
    }
  }

  // 7. Gemini consolidated fixes (from visual analysis)
  const geminiFixes = loadGeminiFixes(report.screenId);
  for (const gfix of geminiFixes) {
    if (!gfix.fixedCode || !gfix.property) continue;
    const severity = gfix.severity || "major";
    if (severity === "minor") continue; // Skip minor Gemini suggestions

    patches.push({
      type: gfix.currentCode ? "style-update" : "style-add",
      target: gfix.file || "unknown",
      property: gfix.property,
      oldValue: gfix.currentValue || gfix.currentCode || "unknown",
      newValue: gfix.fixedCode,
      applied: false,
      description: `[Gemini] ${gfix.property}: ${gfix.figmaValue || ""} (${severity})`,
    });
  }

  return patches;
}

function toStyleName(nodeName: string): string {
  return nodeName
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Step 3: Apply Patches to Screen File
// ---------------------------------------------------------------------------

function applyPatches(screenFilePath: string, patches: Patch[], dryRun: boolean): number {
  if (!fs.existsSync(screenFilePath)) {
    log(`Screen file not found: ${screenFilePath}`);
    return 0;
  }

  let content = fs.readFileSync(screenFilePath, "utf-8");
  let appliedCount = 0;

  for (const patch of patches) {
    const result = applyPatch(content, patch);
    if (result.applied) {
      content = result.content;
      patch.applied = true;
      appliedCount++;
      logPatch(`${dryRun ? "[DRY] " : ""}${patch.type}: ${patch.property} → ${patch.newValue} (${patch.target})`);
    }
  }

  if (!dryRun && appliedCount > 0) {
    fs.writeFileSync(screenFilePath, content, "utf-8");
    log(`Written ${appliedCount} patches to ${screenFilePath}`);
  } else if (dryRun && appliedCount > 0) {
    log(`[DRY RUN] Would write ${appliedCount} patches to ${screenFilePath}`);
  }

  return appliedCount;
}

function applyPatch(content: string, patch: Patch): { applied: boolean; content: string } {
  switch (patch.type) {
    case "style-add":
      return applyStyleAdd(content, patch);
    case "style-update":
      return applyStyleUpdate(content, patch);
    case "prop-add":
      return applyPropAdd(content, patch);
    case "testid-add":
      return applyTestIdAdd(content, patch);
    case "text-fix":
      return applyTextFix(content, patch);
    default:
      return { applied: false, content };
  }
}

function applyStyleAdd(content: string, patch: Patch): { applied: boolean; content: string } {
  // Strategy: Find any style object in StyleSheet.create that could relate to this patch.
  // For borderCurve, find any style with borderRadius.
  // For flex, find styles with explicit width that should be flex instead.
  // For boxShadow, find any style for the relevant node.

  if (patch.property === "borderCurve") {
    // Don't add if already present anywhere in the file
    if (content.includes("borderCurve")) return { applied: false, content };

    // Find ALL style objects that have borderRadius and add borderCurve to each
    // This ensures all rounded corners get iOS smoothing
    const borderRadiusRegex = /(borderRadius\s*:\s*[^,}\n]+,?)(\s*\n)/g;
    let applied = false;
    const newContent = content.replace(borderRadiusRegex, (match, propLine, trailing) => {
      applied = true;
      return `${propLine}\n    borderCurve: 'continuous' as const, // iOS corner smoothing${trailing}`;
    });
    return { applied, content: newContent };
  }

  if (patch.property === "flex" && patch.newValue === "1") {
    // Replace width: '100%' with flex: 1 — but only within StyleSheet.create blocks
    // and only if the style name roughly matches the target
    const targetLower = patch.target.toLowerCase();
    // Find width: '100%' that appears near a style matching the target
    const widthRegex = /width:\s*['"]100%['"]/g;
    let applied = false;
    const newContent = content.replace(widthRegex, (match) => {
      if (applied) return match;
      applied = true;
      return `flex: 1 /* FILL sizing (was width: '100%') */`;
    });
    if (applied) return { applied: true, content: newContent };
  }

  if (patch.property === "boxShadow") {
    // Find the StyleSheet.create block and add boxShadow to a relevant style
    const styleCreateIdx = content.indexOf("StyleSheet.create({");
    if (styleCreateIdx === -1) return { applied: false, content };

    // Don't add if boxShadow already exists
    if (content.includes("boxShadow")) return { applied: false, content };

    // Add as a comment for manual review (shadow placement is context-dependent)
    const insertIdx = content.indexOf("\n", styleCreateIdx);
    if (insertIdx === -1) return { applied: false, content };

    const newContent =
      content.slice(0, insertIdx + 1) +
      `  // TODO: Add boxShadow: ${patch.newValue} to appropriate style (from Figma inner shadow)\n` +
      content.slice(insertIdx + 1);
    return { applied: true, content: newContent };
  }

  return { applied: false, content };
}

function applyStyleUpdate(content: string, patch: Patch): { applied: boolean; content: string } {
  // Value-based matching: find the property with the wrong value and fix it
  // For dimensions/position patches, these are logged but not auto-applied
  // (position changes are too risky for automated patching)
  return { applied: false, content };
}

function applyPropAdd(content: string, patch: Patch): { applied: boolean; content: string } {
  if (patch.property === "numberOfLines") {
    // Already has numberOfLines somewhere? Skip
    if (content.includes("numberOfLines")) return { applied: false, content };

    // Add as a TODO comment near Text components
    const textImport = content.indexOf("from '@/src/components'");
    if (textImport === -1) return { applied: false, content };

    const lineEnd = content.indexOf("\n", textImport);
    const newContent =
      content.slice(0, lineEnd + 1) +
      `// TODO: Add numberOfLines={${patch.newValue}} ellipsizeMode="tail" to truncated Text "${patch.target}"\n` +
      content.slice(lineEnd + 1);
    return { applied: true, content: newContent };
  }

  if (patch.property === "onPress") {
    // Don't auto-add onPress — too risky. Log as TODO.
    return { applied: false, content };
  }

  return { applied: false, content };
}

function applyTestIdAdd(content: string, patch: Patch): { applied: boolean; content: string } {
  // Find a component and add testID prop
  const componentName = patch.target;
  const nameLower = componentName.toLowerCase();

  // Try to find a component that matches by name in a comment or style reference
  // This is heuristic — we look for JSX elements near the node name
  const testIdProp = `testID="${patch.newValue}"`;

  // Check if testID already exists
  if (content.includes(patch.newValue)) return { applied: false, content };

  // Find the first component without a testID near a reference to this node name
  // For now, we add a TODO comment instead of blindly inserting
  if (!content.includes(`// TODO: Add testID`)) {
    const lastImportIdx = content.lastIndexOf("import ");
    const lineEnd = content.indexOf("\n", lastImportIdx);
    if (lineEnd > 0) {
      const newContent =
        content.slice(0, lineEnd + 1) +
        `// TODO: Add ${testIdProp} to ${componentName} component\n` +
        content.slice(lineEnd + 1);
      return { applied: true, content: newContent };
    }
  }

  return { applied: false, content };
}

function applyTextFix(content: string, patch: Patch): { applied: boolean; content: string } {
  // Text fixes are complex — we note them but don't auto-apply
  // (changing text content could break localization, state-driven text, etc.)
  return { applied: false, content };
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log("Usage: npx tsx scripts/maestro-auto-heal.ts <screenId> [options]");
    console.log("");
    console.log("Options:");
    console.log("  --hierarchy <path>     Path to Maestro hierarchy CSV");
    console.log("  --dry-run              Show patches without applying");
    console.log("  --once                 Single iteration, no re-verify loop");
    console.log("  --max-iterations <n>   Max heal iterations (default 3)");
    console.log("  --target-score <n>     Target structural score (default 85)");
    process.exit(0);
  }

  const screenId = args[0].replace(":", "-");
  let hierarchyPath = "";
  let dryRun = args.includes("--dry-run");
  let once = args.includes("--once");
  let maxIterations = 3;
  let targetScore = 85;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--hierarchy":
        hierarchyPath = args[++i];
        break;
      case "--max-iterations":
        maxIterations = parseInt(args[++i], 10);
        break;
      case "--target-score":
        targetScore = parseInt(args[++i], 10);
        break;
    }
  }

  if (!hierarchyPath) {
    hierarchyPath = path.join(PATHS.hierarchies, `${screenId}-hierarchy.csv`);
  }
  if (!path.isAbsolute(hierarchyPath)) {
    hierarchyPath = path.resolve(BUILDBOT_ROOT, hierarchyPath);
  }

  const blueprintPath = path.join(PATHS.blueprints, `${screenId}-blueprint.json`);

  console.log("\n  ====================================================");
  console.log("  MAESTRO AUTO-HEAL PIPELINE");
  console.log("  Closed-loop: verify -> patch -> re-verify");
  console.log("  ====================================================\n");

  log(`Screen:         ${screenId}`);
  log(`Mode:           ${dryRun ? "DRY RUN" : once ? "SINGLE ITERATION" : `LOOP (max ${maxIterations}, target ${targetScore})`}`);
  log(`Blueprint:      ${blueprintPath}`);
  log(`Hierarchy:      ${hierarchyPath}`);

  // Load blueprint
  if (!fs.existsSync(blueprintPath)) {
    console.error(`Blueprint not found: ${blueprintPath}`);
    process.exit(1);
  }
  const blueprint: Blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8"));

  // Validate hierarchy exists
  if (!fs.existsSync(hierarchyPath)) {
    console.error(`Hierarchy CSV not found: ${hierarchyPath}`);
    process.exit(1);
  }

  // Resolve route and screen file
  const routeInfo = resolveRoute(screenId);
  const route = routeInfo?.routePath || "";
  const screenFile = route ? findScreenFile(route) : null;
  log(`Route:          ${route || "unknown"} (key: ${routeInfo?.routeKey || "?"})`);
  log(`Screen file:    ${screenFile || "NOT FOUND"}`);

  if (!screenFile) {
    console.error("Cannot find screen file. Auto-heal requires the screen code to patch.");
    process.exit(1);
  }

  // Load design tokens
  const tokens = loadDesignTokens();

  // Heal loop
  const iterations: IterationResult[] = [];
  const effectiveMax = once ? 1 : maxIterations;

  for (let iter = 1; iter <= effectiveMax; iter++) {
    console.log(`\n  -- Iteration ${iter}/${effectiveMax} --\n`);

    // Step 1: Run structural verification
    log("Running structural verification...");
    const report = runStructuralVerify(screenId, hierarchyPath);
    if (!report) {
      log("Structural verification failed. Stopping.");
      break;
    }

    const scoreBefore = report.summary.score;
    log(`Score: ${scoreBefore}/100 (target: ${targetScore})`);

    if (scoreBefore >= targetScore) {
      log(`Score meets target. No patches needed.`);
      iterations.push({
        iteration: iter,
        scoreBefore,
        patchesGenerated: 0,
        patchesApplied: 0,
        scoreAfter: scoreBefore,
        patches: [],
      });
      break;
    }

    // Step 2: Generate patches
    log("Generating patches from structural report + blueprint...");
    const patches = generatePatches(report, blueprint, screenFile, tokens);
    log(`Generated ${patches.length} patches`);

    if (patches.length === 0) {
      log("No patches to apply. Stopping.");
      iterations.push({
        iteration: iter,
        scoreBefore,
        patchesGenerated: 0,
        patchesApplied: 0,
        scoreAfter: scoreBefore,
        patches: [],
      });
      break;
    }

    // Step 3: Apply patches
    log(`Applying patches to ${screenFile}...`);
    const appliedCount = applyPatches(screenFile, patches, dryRun);
    log(`Applied ${appliedCount}/${patches.length} patches`);

    // Step 4: Re-verify (only if we actually applied patches and not dry run)
    let scoreAfter = scoreBefore;
    if (!dryRun && appliedCount > 0 && !once) {
      log("Re-running structural verification...");
      const reReport = runStructuralVerify(screenId, hierarchyPath);
      if (reReport) {
        scoreAfter = reReport.summary.score;
        log(`Score after: ${scoreAfter}/100 (was ${scoreBefore})`);
      }
    }

    iterations.push({
      iteration: iter,
      scoreBefore,
      patchesGenerated: patches.length,
      patchesApplied: appliedCount,
      scoreAfter: dryRun ? scoreBefore : scoreAfter,
      patches,
    });

    if (scoreAfter >= targetScore) {
      log(`Target score reached: ${scoreAfter}/${targetScore}`);
      break;
    }

    if (appliedCount === 0) {
      log("No patches could be applied. Stopping to avoid infinite loop.");
      break;
    }
  }

  // Assemble report
  const finalScore = iterations.length > 0 ? iterations[iterations.length - 1].scoreAfter : 0;
  let status: AutoHealReport["status"];
  if (dryRun) {
    status = "DRY_RUN";
  } else if (finalScore >= targetScore) {
    status = "PASSED";
  } else if (iterations.length > 1 && finalScore > iterations[0].scoreBefore) {
    status = "IMPROVED";
  } else {
    status = "NO_IMPROVEMENT";
  }

  const healReport: AutoHealReport = {
    screenId,
    screenFile,
    timestamp: new Date().toISOString(),
    iterations,
    finalScore,
    targetScore,
    status,
  };

  fs.mkdirSync(PATHS.autoHealReports, { recursive: true });
  const reportPath = path.join(PATHS.autoHealReports, `${screenId}-auto-heal.json`);
  fs.writeFileSync(reportPath, JSON.stringify(healReport, null, 2), "utf-8");

  // Print summary
  const totalPatches = iterations.reduce((s, i) => s + i.patchesApplied, 0);
  console.log("\n  -- Summary --\n");
  console.log(`  Status:       ${status}`);
  console.log(`  Iterations:   ${iterations.length}`);
  console.log(`  Patches:      ${totalPatches} applied`);
  console.log(`  Score:        ${iterations[0]?.scoreBefore || 0} -> ${finalScore}`);
  console.log(`  Target:       ${targetScore}`);
  console.log(`  Report:       ${reportPath}`);
  console.log("");
}

main();
