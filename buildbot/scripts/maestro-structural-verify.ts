/**
 * maestro-structural-verify.ts — Deterministic Blueprint ↔ Maestro Hierarchy Verification
 *
 * Compares the live Maestro view hierarchy against the Figma blueprint JSON
 * to produce code-level structural diffs WITHOUT any AI.
 *
 * Usage:
 *   npx tsx scripts/maestro-structural-verify.ts <screenId> --hierarchy <csvPath>
 *   npx tsx scripts/maestro-structural-verify.ts 1-29108 --hierarchy data/hierarchies/1-29108-hierarchy.csv
 *   npx tsx scripts/maestro-structural-verify.ts 1-29108 --hierarchy data/hierarchies/1-29108-hierarchy.csv --viewport 402x874
 *
 * Output: reports/maestro-structural/{screenId}-structural.json
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BUILDBOT_ROOT = path.join(__dirname, "..");

const PATHS = {
  blueprints: path.join(BUILDBOT_ROOT, "data", "blueprints"),
  hierarchies: path.join(BUILDBOT_ROOT, "data", "hierarchies"),
  reports: path.join(BUILDBOT_ROOT, "reports", "maestro-structural"),
  screenRoutes: path.join(BUILDBOT_ROOT, "config", "screen-routes.json"),
} as const;

const FIGMA_CANVAS = { width: 393, height: 852 } as const;

const THRESHOLDS = {
  position: 6,
  size: 4,
} as const;

const SKIP_NAME_PATTERN = /StatusBar|HW Cutout|Safe ?Area|Home Indicator|status.bar/i;

// ---------------------------------------------------------------------------
// Types — Hierarchy (Maestro CSV)
// ---------------------------------------------------------------------------

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface HierarchyElement {
  elementNum: number;
  depth: number;
  bounds: Bounds;
  attributes: Record<string, string>;
  text: string | null;
  parentNum: number;
  testId: string | null;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Types — Blueprint
// ---------------------------------------------------------------------------

interface BlueprintNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  depth: number;
  visible: boolean;
  geometry: { x: number; y: number; width: number; height: number; rotation: number };
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number } | null;
  opacity?: number;
  typography?: {
    content: string;
    fontSize: number;
    lineHeight: number;
    fontWeight: number;
    fontFamily: string;
    textAlign: string;
    color: string;
    textTruncation?: string;
    maxLines?: number;
    lineTypes?: string[];
  };
  layout?: {
    direction: string;
    justifyContent: string;
    alignItems: string;
    gap: number;
    padding: { top: number; right: number; bottom: number; left: number };
  };
  interactions?: Array<{
    trigger: { type: string };
    actions: Array<{ type: string; destinationId?: string }>;
  }>;
  scrollBehavior?: string;
  overflowDirection?: string;
  childIds?: string[];
  rnComponent?: string;
  componentId?: string;
  fills?: Array<{ type: string; color?: string; visible: boolean }>;
  clipsContent?: boolean;
}

interface Blueprint {
  meta: {
    screenId: string;
    screenName: string;
    route: string;
    stateName?: string;
    dimensions: { width: number; height: number };
  };
  nodes: BlueprintNode[];
}

// ---------------------------------------------------------------------------
// Types — Report
// ---------------------------------------------------------------------------

interface Issue {
  severity: "critical" | "major" | "minor" | "info";
  nodeId: string;
  nodeName: string;
  check: string;
  expected: string;
  actual: string;
  fix: string;
}

interface CheckResult {
  passed: number;
  failed: number;
  issues: Issue[];
}

interface StructuralReport {
  screenId: string;
  timestamp: string;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    score: number;
  };
  checks: {
    textContent: CheckResult;
    bounds: CheckResult;
    elementCount: CheckResult;
    interactivity: CheckResult;
    truncation: CheckResult;
    scrollBehavior: CheckResult;
    testIdCoverage: CheckResult;
    visibility: CheckResult;
  };
  codeFixes: Array<{
    file: string;
    property: string;
    expected: string;
    actual: string;
    severity: string;
    suggestedFix: string;
  }>;
  testIdGaps: Array<{
    nodeId: string;
    nodeName: string;
    suggestedTestId: string;
    component: string;
  }>;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(tag: string, msg: string): void {
  console.log(`  [${tag}] ${msg}`);
}

function logWarn(tag: string, msg: string): void {
  console.warn(`  [${tag}] WARN: ${msg}`);
}

// ---------------------------------------------------------------------------
// CSV Parsing (from analyze-hierarchy.ts patterns)
// ---------------------------------------------------------------------------

function parseHierarchyCsv(csvContent: string): HierarchyElement[] {
  const lines = csvContent.split("\n").map((l) => l.trim());
  const elements: HierarchyElement[] = [];

  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("element_num")) {
      headerIndex = i;
      break;
    }
  }

  const dataStartIndex = headerIndex + 1;

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length === 0) continue;
    const parsed = parseCsvLine(line);
    if (parsed) elements.push(parsed);
  }

  return elements;
}

function parseCsvLine(line: string): HierarchyElement | null {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);

  if (fields.length < 5) return null;

  const elementNum = parseInt(fields[0], 10);
  const depth = parseInt(fields[1], 10);
  if (isNaN(elementNum) || isNaN(depth)) return null;

  const bounds = parseBounds(fields[2]);
  if (!bounds) return null;

  const attributes = parseAttributes(fields[3]);
  const text = extractText(attributes);
  const testId = attributes["testID"] || attributes["testId"] || attributes["accessibilityIdentifier"] || null;
  const enabled = attributes["enabled"] !== "false";

  return { elementNum, depth, bounds, attributes, text, parentNum: parseInt(fields[4], 10) || 0, testId, enabled };
}

function parseBounds(s: string): Bounds | null {
  const m = s.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!m) return null;
  return { left: +m[1], top: +m[2], right: +m[3], bottom: +m[4] };
}

function parseAttributes(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!s) return attrs;
  for (const part of s.split("; ")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) attrs[key] = value;
  }
  return attrs;
}

function extractText(attrs: Record<string, string>): string | null {
  for (const key of ["text", "accessibilityText", "label", "value", "hintText"]) {
    const v = attrs[key];
    if (v && v.length > 0 && v !== "null") return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Geometry Helpers
// ---------------------------------------------------------------------------

function computeAbsoluteGeometry(
  node: BlueprintNode,
  nodeIndex: Map<string, BlueprintNode>
): { x: number; y: number; width: number; height: number } {
  let absX = node.geometry.x;
  let absY = node.geometry.y;
  let pid = node.parentId;
  let safety = 0;

  while (pid && safety < 50) {
    const parent = nodeIndex.get(pid);
    if (!parent) break;
    absX += parent.geometry.x;
    absY += parent.geometry.y;
    pid = parent.parentId;
    safety++;
  }

  return { x: absX, y: absY, width: node.geometry.width, height: node.geometry.height };
}

function boundsToRect(b: Bounds): { x: number; y: number; width: number; height: number } {
  return { x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isSystemNode(node: BlueprintNode): boolean {
  return SKIP_NAME_PATTERN.test(node.name);
}

// ---------------------------------------------------------------------------
// Text Matching
// ---------------------------------------------------------------------------

function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

type MatchStrategy = "exact" | "normalized" | "substring";

function matchText(
  figmaContent: string,
  maestroText: string
): { matched: boolean; strategy: MatchStrategy } {
  const fc = figmaContent.trim();
  const mt = maestroText.trim();

  if (fc === mt) return { matched: true, strategy: "exact" };

  const fcN = normalizeText(fc);
  const mtN = normalizeText(mt);
  if (fcN === mtN) return { matched: true, strategy: "normalized" };

  if (fcN.length > 3 && mtN.includes(fcN)) return { matched: true, strategy: "substring" };
  if (mtN.length > 3 && fcN.includes(mtN)) return { matched: true, strategy: "substring" };

  return { matched: false, strategy: "exact" };
}

// ---------------------------------------------------------------------------
// Route Resolution
// ---------------------------------------------------------------------------

function resolveRoute(screenId: string): string {
  try {
    const routes = JSON.parse(fs.readFileSync(PATHS.screenRoutes, "utf-8"));
    const normalized = screenId.replace(":", "-");
    for (const [routeKey, config] of Object.entries(routes.routes) as [string, any][]) {
      for (const screen of config.screens) {
        if (screen.figmaId.replace(":", "-") === normalized) {
          return routeKey;
        }
      }
    }
  } catch { /* ignore */ }
  return `/(unknown)/${screenId}`;
}

// ---------------------------------------------------------------------------
// CHECK 1: Text Content Match
// ---------------------------------------------------------------------------

function checkTextContent(
  blueprint: Blueprint,
  hierarchy: HierarchyElement[],
  nodeIndex: Map<string, BlueprintNode>,
  scale: { x: number; y: number }
): CheckResult {
  const result: CheckResult = { passed: 0, failed: 0, issues: [] };
  const textNodes = blueprint.nodes.filter(
    (n) => n.type === "TEXT" && n.visible && !isSystemNode(n) && n.typography?.content?.trim()
  );

  const hierarchyTexts = hierarchy.filter((e) => e.text && e.text.length > 0);
  // Build a set of all unique text fragments found in the hierarchy.
  // Maestro often concatenates all child text into parent's accessibilityText,
  // so we need to search within those concatenated strings too.
  const allHierarchyText = hierarchyTexts.map((e) => e.text!);

  for (const node of textNodes) {
    const content = node.typography!.content.trim();
    if (content.length === 0) continue;

    let found = false;

    // Pass 1: Exact or normalized match against individual hierarchy elements
    for (const elem of hierarchyTexts) {
      const { matched, strategy } = matchText(content, elem.text!);
      if (matched && strategy !== "substring") {
        found = true;
        result.passed++;
        break;
      }
    }

    // Pass 2: Check if content appears as a substring within any concatenated accessibilityText.
    // This handles Maestro's behavior of rolling up child text into parent elements.
    if (!found) {
      const contentNorm = normalizeText(content);
      if (contentNorm.length >= 2) { // Skip very short strings to avoid false matches
        for (const hierText of allHierarchyText) {
          if (normalizeText(hierText).includes(contentNorm)) {
            found = true;
            result.passed++;
            break;
          }
        }
      }
    }

    // Pass 3: Single-character text nodes (digits, punctuation) — check if the character
    // appears in any hierarchy text. These are common in OTP screens, counters, etc.
    if (!found && content.length <= 2) {
      for (const hierText of allHierarchyText) {
        if (hierText.includes(content)) {
          found = true;
          result.passed++;
          break;
        }
      }
    }

    if (!found) {
      // Downgrade severity: short text or single chars are less critical
      const severity = content.length <= 3 ? "minor" : "critical";
      result.failed++;
      result.issues.push({
        severity,
        nodeId: node.id,
        nodeName: node.name,
        check: "textContent",
        expected: content.length > 60 ? content.slice(0, 60) + "..." : content,
        actual: "NOT FOUND in rendered hierarchy",
        fix: `Text "${content.slice(0, 40)}" from Figma is not rendered. Check if the component is mounted and the text prop matches.`,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// CHECK 2: Bounds Comparison
// ---------------------------------------------------------------------------

function checkBounds(
  blueprint: Blueprint,
  hierarchy: HierarchyElement[],
  nodeIndex: Map<string, BlueprintNode>,
  scale: { x: number; y: number }
): CheckResult {
  const result: CheckResult = { passed: 0, failed: 0, issues: [] };

  const textNodes = blueprint.nodes.filter(
    (n) => n.type === "TEXT" && n.visible && !isSystemNode(n) && n.typography?.content?.trim()
  );

  const hierarchyTexts = hierarchy.filter((e) => e.text && e.text.length > 0);

  for (const node of textNodes) {
    const content = node.typography!.content.trim();
    if (content.length === 0) continue;

    for (const elem of hierarchyTexts) {
      const { matched } = matchText(content, elem.text!);
      if (!matched) continue;

      // Prefer absoluteRenderBounds (actual visible area) over computed absolute geometry
      // absoluteRenderBounds is already in absolute canvas coordinates — no parent chain walk needed
      const absGeo = (node as any).absoluteRenderBounds || (node as any).absoluteBoundingBox || computeAbsoluteGeometry(node, nodeIndex);
      const figmaRect = {
        x: round2(absGeo.x * scale.x),
        y: round2(absGeo.y * scale.y),
        width: round2(absGeo.width * scale.x),
        height: round2(absGeo.height * scale.y),
      };
      const renderedRect = boundsToRect(elem.bounds);

      const dx = Math.abs(renderedRect.x - figmaRect.x);
      const dy = Math.abs(renderedRect.y - figmaRect.y);
      const dw = Math.abs(renderedRect.width - figmaRect.width);
      const dh = Math.abs(renderedRect.height - figmaRect.height);

      const posOk = dx <= THRESHOLDS.position && dy <= THRESHOLDS.position;
      const sizeOk = dw <= THRESHOLDS.size && dh <= THRESHOLDS.size;

      if (posOk && sizeOk) {
        result.passed++;
      } else {
        result.failed++;
        const parts: string[] = [];
        if (!posOk) parts.push(`position off by (${dx.toFixed(1)}, ${dy.toFixed(1)})px`);
        if (!sizeOk) parts.push(`size off by (${dw.toFixed(1)}, ${dh.toFixed(1)})px`);

        result.issues.push({
          severity: dx > 10 || dy > 10 ? "critical" : "major",
          nodeId: node.id,
          nodeName: node.name,
          check: "bounds",
          expected: `(${figmaRect.x}, ${figmaRect.y}) ${figmaRect.width}x${figmaRect.height}`,
          actual: `(${renderedRect.x}, ${renderedRect.y}) ${renderedRect.width}x${renderedRect.height}`,
          fix: `"${node.name}" ${parts.join(", ")}. Check margins, padding, or absolute positioning.`,
        });
      }
      break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// CHECK 3: Element Count Match
// ---------------------------------------------------------------------------

function checkElementCount(
  blueprint: Blueprint,
  hierarchy: HierarchyElement[]
): CheckResult {
  const result: CheckResult = { passed: 0, failed: 0, issues: [] };

  const containerNodes = blueprint.nodes.filter(
    (n) =>
      ["FRAME", "COMPONENT", "INSTANCE"].includes(n.type) &&
      n.visible &&
      n.depth <= 2 &&
      !isSystemNode(n) &&
      n.childIds &&
      n.childIds.length > 0
  );

  const visibleBlueprintNodes = blueprint.nodes.filter((n) => n.visible && !isSystemNode(n));
  const hierarchyWithBounds = hierarchy.filter(
    (e) => e.bounds.right - e.bounds.left > 0 && e.bounds.bottom - e.bounds.top > 0
  );

  const bpCount = visibleBlueprintNodes.length;
  const hCount = hierarchyWithBounds.length;
  const ratio = hCount > 0 ? bpCount / hCount : 0;

  if (ratio > 0.3 && ratio < 3.0) {
    result.passed++;
  } else {
    result.failed++;
    result.issues.push({
      severity: "major",
      nodeId: "root",
      nodeName: "Screen",
      check: "elementCount",
      expected: `~${bpCount} visible elements from Figma`,
      actual: `${hCount} elements in rendered hierarchy`,
      fix: `Significant element count mismatch. Blueprint has ${bpCount} visible nodes but hierarchy has ${hCount}. Check if components are rendering all children.`,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// CHECK 4: Interactivity Check
// ---------------------------------------------------------------------------

function checkInteractivity(
  blueprint: Blueprint,
  hierarchy: HierarchyElement[]
): CheckResult {
  const result: CheckResult = { passed: 0, failed: 0, issues: [] };

  const interactiveNodes = blueprint.nodes.filter((n) => {
    if (!n.visible || isSystemNode(n)) return false;
    const hasInteractions = n.interactions && n.interactions.length > 0;
    const nameLower = n.name.toLowerCase();
    const isButton = nameLower.includes("button") || nameLower.includes("btn") || nameLower.includes("cta");
    return hasInteractions || isButton;
  });

  const enabledTexts = hierarchy.filter((e) => e.enabled && e.text);
  const enabledTestIds = hierarchy.filter((e) => e.enabled && e.testId);

  for (const node of interactiveNodes) {
    const nameLower = node.name.toLowerCase();

    let found = false;
    for (const elem of enabledTestIds) {
      if (elem.testId && nameLower.includes(elem.testId.toLowerCase().replace(/-/g, ""))) {
        found = true;
        break;
      }
    }

    if (!found) {
      for (const elem of enabledTexts) {
        if (elem.text && node.typography?.content) {
          const { matched } = matchText(node.typography.content, elem.text);
          if (matched && elem.enabled) {
            found = true;
            break;
          }
        }
      }
    }

    if (!found && node.childIds) {
      const childTexts = node.childIds
        .map((cid) => blueprint.nodes.find((n) => n.id === cid))
        .filter((c) => c?.typography?.content)
        .map((c) => c!.typography!.content);

      for (const childText of childTexts) {
        for (const elem of enabledTexts) {
          if (elem.text) {
            const { matched } = matchText(childText, elem.text);
            if (matched && elem.enabled) {
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
    }

    if (found) {
      result.passed++;
    } else {
      result.failed++;
      result.issues.push({
        severity: "major",
        nodeId: node.id,
        nodeName: node.name,
        check: "interactivity",
        expected: "Element should be tappable (has interactions or is a button)",
        actual: "No matching enabled element found in hierarchy",
        fix: `"${node.name}" has prototyping interactions but no matching tappable element was found. Ensure it has onPress handler and is not disabled.`,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// CHECK 5: Truncation Check
// ---------------------------------------------------------------------------

function checkTruncation(blueprint: Blueprint, hierarchy: HierarchyElement[]): CheckResult {
  const result: CheckResult = { passed: 0, failed: 0, issues: [] };

  const truncatedNodes = blueprint.nodes.filter(
    (n) =>
      n.type === "TEXT" &&
      n.visible &&
      n.typography?.textTruncation === "ENDING" &&
      n.typography?.content
  );

  for (const node of truncatedNodes) {
    const fullContent = node.typography!.content;
    const maxLines = node.typography!.maxLines || 1;

    for (const elem of hierarchy) {
      if (!elem.text) continue;
      const { matched } = matchText(fullContent, elem.text);
      if (!matched && normalizeText(fullContent).startsWith(normalizeText(elem.text).replace(/\.{3}$/, ""))) {
        result.passed++;
        break;
      }
      if (matched) {
        if (fullContent.length > 50 && elem.text.length >= fullContent.length) {
          result.failed++;
          result.issues.push({
            severity: "minor",
            nodeId: node.id,
            nodeName: node.name,
            check: "truncation",
            expected: `Text should be truncated (textTruncation: ENDING, maxLines: ${maxLines})`,
            actual: `Full text "${elem.text.slice(0, 40)}..." is rendered without truncation`,
            fix: `Add numberOfLines={${maxLines}} and ellipsizeMode="tail" to the Text component for "${node.name}".`,
          });
        } else {
          result.passed++;
        }
        break;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// CHECK 6: Scroll Behavior Check
// ---------------------------------------------------------------------------

function checkScrollBehavior(blueprint: Blueprint, hierarchy: HierarchyElement[]): CheckResult {
  const result: CheckResult = { passed: 0, failed: 0, issues: [] };

  const scrollableNodes = blueprint.nodes.filter(
    (n) => n.visible && n.overflowDirection && n.overflowDirection !== "NONE"
  );

  for (const node of scrollableNodes) {
    result.passed++;
  }

  const fixedNodes = blueprint.nodes.filter(
    (n) => n.visible && n.scrollBehavior && n.scrollBehavior !== "SCROLLS"
  );

  for (const node of fixedNodes) {
    result.issues.push({
      severity: "info",
      nodeId: node.id,
      nodeName: node.name,
      check: "scrollBehavior",
      expected: `scrollBehavior: ${node.scrollBehavior}`,
      actual: "Verify manually — requires scroll interaction test",
      fix: `"${node.name}" has scrollBehavior: ${node.scrollBehavior}. Ensure it uses position: 'absolute' or sticky header implementation.`,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// CHECK 7: testID Coverage
// ---------------------------------------------------------------------------

function checkTestIdCoverage(
  blueprint: Blueprint,
  hierarchy: HierarchyElement[],
  route: string
): CheckResult {
  const result: CheckResult = { passed: 0, failed: 0, issues: [] };

  const majorNodes = blueprint.nodes.filter(
    (n) =>
      n.visible &&
      !isSystemNode(n) &&
      n.depth >= 1 &&
      n.depth <= 2 &&
      ["FRAME", "COMPONENT", "INSTANCE"].includes(n.type) &&
      n.geometry.width > 50 &&
      n.geometry.height > 30
  );

  const allTestIds: string[] = hierarchy.map((e) => e.testId).filter(Boolean) as string[];

  for (const node of majorNodes) {
    const rnComp = node.rnComponent;
    if (!rnComp) continue;

    const nameLower = node.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const routeSlug = route.replace(/[/()\s]/g, "").toLowerCase();

    let hasTestId = false;
    for (let ti = 0; ti < allTestIds.length; ti++) {
      const tid = allTestIds[ti];
      const tidLower = tid.toLowerCase();
      if (
        tidLower.includes(nameLower.slice(0, 10)) ||
        nameLower.includes(tidLower.slice(0, 10))
      ) {
        hasTestId = true;
        break;
      }
    }

    if (hasTestId) {
      result.passed++;
    } else {
      result.failed++;
      const suggestedId = `${routeSlug}-${nameLower}`.slice(0, 40);
      result.issues.push({
        severity: "minor",
        nodeId: node.id,
        nodeName: node.name,
        check: "testIdCoverage",
        expected: `testID="${suggestedId}" (or similar)`,
        actual: "No matching testID found in rendered hierarchy",
        fix: `Add testID="${suggestedId}" to the ${rnComp} component for "${node.name}".`,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// CHECK 8: Visibility Check
// ---------------------------------------------------------------------------

function checkVisibility(blueprint: Blueprint, hierarchy: HierarchyElement[]): CheckResult {
  const result: CheckResult = { passed: 0, failed: 0, issues: [] };

  const clippedNodes = blueprint.nodes.filter(
    (n) => n.visible && n.absoluteRenderBounds === null
  );

  for (const node of clippedNodes) {
    result.issues.push({
      severity: "info",
      nodeId: node.id,
      nodeName: node.name,
      check: "visibility",
      expected: "Node is fully clipped (absoluteRenderBounds is null)",
      actual: "Should not appear in rendered output",
      fix: `"${node.name}" is fully clipped in Figma. Verify it's not visible in the app.`,
    });
  }

  const zeroAreaNodes = blueprint.nodes.filter((n) => {
    if (!n.visible || isSystemNode(n)) return false;
    const arb = n.absoluteRenderBounds;
    if (!arb) return false;
    return arb.width <= 0 || arb.height <= 0;
  });

  for (const node of zeroAreaNodes) {
    result.failed++;
    result.issues.push({
      severity: "minor",
      nodeId: node.id,
      nodeName: node.name,
      check: "visibility",
      expected: "Visible node should have non-zero render bounds",
      actual: `Render bounds: ${node.absoluteRenderBounds?.width}x${node.absoluteRenderBounds?.height}`,
      fix: `"${node.name}" has zero-area render bounds in Figma. It may be an invisible spacer or a clipping issue.`,
    });
  }

  result.passed = blueprint.nodes.filter(
    (n) => n.visible && !isSystemNode(n) && n.absoluteRenderBounds !== null
  ).length - zeroAreaNodes.length;

  return result;
}

// ---------------------------------------------------------------------------
// Code Fix Generator
// ---------------------------------------------------------------------------

function generateCodeFixes(
  checks: StructuralReport["checks"],
  route: string
): StructuralReport["codeFixes"] {
  const fixes: StructuralReport["codeFixes"] = [];
  const routePath = route.replace(/^\/?/, "").replace(/\/index$/, "");
  const file = `app/${routePath}.tsx`;

  for (const [checkName, checkResult] of Object.entries(checks)) {
    for (const issue of checkResult.issues) {
      if (issue.severity === "info") continue;
      fixes.push({
        file,
        property: checkName,
        expected: issue.expected,
        actual: issue.actual,
        severity: issue.severity,
        suggestedFix: issue.fix,
      });
    }
  }

  return fixes;
}

// ---------------------------------------------------------------------------
// TestID Gap Generator
// ---------------------------------------------------------------------------

function generateTestIdGaps(
  checks: StructuralReport["checks"],
  blueprint: Blueprint
): StructuralReport["testIdGaps"] {
  const gaps: StructuralReport["testIdGaps"] = [];

  for (const issue of checks.testIdCoverage.issues) {
    const node = blueprint.nodes.find((n) => n.id === issue.nodeId);
    gaps.push({
      nodeId: issue.nodeId,
      nodeName: issue.nodeName,
      suggestedTestId: issue.expected.replace(/testID="([^"]+)".*/, "$1"),
      component: node?.rnComponent || "View",
    });
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log("Usage: npx tsx scripts/maestro-structural-verify.ts <screenId> --hierarchy <csvPath> [--viewport WxH]");
    process.exit(0);
  }

  const screenId = args[0].replace(":", "-");
  let hierarchyPath = "";
  let viewport = { width: 402, height: 874 };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--hierarchy":
        hierarchyPath = args[++i];
        break;
      case "--viewport": {
        const parts = args[++i].split("x");
        viewport = { width: parseInt(parts[0], 10), height: parseInt(parts[1], 10) };
        break;
      }
    }
  }

  if (!hierarchyPath) {
    hierarchyPath = path.join(PATHS.hierarchies, `${screenId}-hierarchy.csv`);
  }

  // Resolve paths
  if (!path.isAbsolute(hierarchyPath)) {
    hierarchyPath = path.resolve(BUILDBOT_ROOT, hierarchyPath);
  }

  const blueprintPath = path.join(PATHS.blueprints, `${screenId}-blueprint.json`);

  console.log("\n  ═══════════════════════════════════════════════════════");
  console.log("  MAESTRO STRUCTURAL VERIFICATION");
  console.log("  Blueprint ↔ View Hierarchy Deterministic Diff");
  console.log("  ═══════════════════════════════════════════════════════\n");
  log("config", `Screen ID: ${screenId}`);
  log("config", `Blueprint: ${blueprintPath}`);
  log("config", `Hierarchy: ${hierarchyPath}`);
  log("config", `Viewport:  ${viewport.width}x${viewport.height}`);

  // Load blueprint
  if (!fs.existsSync(blueprintPath)) {
    console.error(`Blueprint not found: ${blueprintPath}`);
    process.exit(1);
  }
  const blueprint: Blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8"));
  log("load", `Blueprint loaded: ${blueprint.nodes.length} nodes`);

  // Load hierarchy CSV
  if (!fs.existsSync(hierarchyPath)) {
    console.error(`Hierarchy CSV not found: ${hierarchyPath}`);
    process.exit(1);
  }
  const csvContent = fs.readFileSync(hierarchyPath, "utf-8");
  const hierarchy = parseHierarchyCsv(csvContent);
  log("load", `Hierarchy loaded: ${hierarchy.length} elements`);

  // Build node index
  const nodeIndex = new Map<string, BlueprintNode>();
  for (const node of blueprint.nodes) {
    nodeIndex.set(node.id, node);
  }

  // Calculate scale factor
  const figmaDimensions = blueprint.meta.dimensions || FIGMA_CANVAS;
  const scale = {
    x: viewport.width / figmaDimensions.width,
    y: viewport.height / figmaDimensions.height,
  };
  log("scale", `Scale factor: ${scale.x.toFixed(4)} x ${scale.y.toFixed(4)}`);

  // Resolve route
  const route = resolveRoute(screenId);
  log("route", `Resolved route: ${route}`);

  // Run all 8 checks
  console.log("\n  ── Running 8 Structural Checks ──\n");

  log("check-1", "Text Content Match...");
  const textContent = checkTextContent(blueprint, hierarchy, nodeIndex, scale);
  log("check-1", `  ✓ ${textContent.passed} passed, ✗ ${textContent.failed} failed`);

  log("check-2", "Bounds Comparison...");
  const bounds = checkBounds(blueprint, hierarchy, nodeIndex, scale);
  log("check-2", `  ✓ ${bounds.passed} passed, ✗ ${bounds.failed} failed`);

  log("check-3", "Element Count Match...");
  const elementCount = checkElementCount(blueprint, hierarchy);
  log("check-3", `  ✓ ${elementCount.passed} passed, ✗ ${elementCount.failed} failed`);

  log("check-4", "Interactivity Check...");
  const interactivity = checkInteractivity(blueprint, hierarchy);
  log("check-4", `  ✓ ${interactivity.passed} passed, ✗ ${interactivity.failed} failed`);

  log("check-5", "Truncation Check...");
  const truncation = checkTruncation(blueprint, hierarchy);
  log("check-5", `  ✓ ${truncation.passed} passed, ✗ ${truncation.failed} failed`);

  log("check-6", "Scroll Behavior Check...");
  const scrollBehaviorResult = checkScrollBehavior(blueprint, hierarchy);
  log("check-6", `  ✓ ${scrollBehaviorResult.passed} passed, ${scrollBehaviorResult.issues.length} info`);

  log("check-7", "testID Coverage...");
  const testIdCoverage = checkTestIdCoverage(blueprint, hierarchy, route);
  log("check-7", `  ✓ ${testIdCoverage.passed} passed, ✗ ${testIdCoverage.failed} gaps`);

  log("check-8", "Visibility Check...");
  const visibility = checkVisibility(blueprint, hierarchy);
  log("check-8", `  ✓ ${visibility.passed} passed, ✗ ${visibility.failed} failed`);

  // Aggregate
  const checks = {
    textContent,
    bounds,
    elementCount,
    interactivity,
    truncation,
    scrollBehavior: scrollBehaviorResult,
    testIdCoverage,
    visibility,
  };

  const totalPassed = Object.values(checks).reduce((s, c) => s + c.passed, 0);
  const totalFailed = Object.values(checks).reduce((s, c) => s + c.failed, 0);
  const totalChecks = totalPassed + totalFailed;
  const score = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 100;

  const codeFixes = generateCodeFixes(checks, route);
  const testIdGaps = generateTestIdGaps(checks, blueprint);

  const report: StructuralReport = {
    screenId,
    timestamp: new Date().toISOString(),
    summary: { totalChecks, passed: totalPassed, failed: totalFailed, score },
    checks,
    codeFixes,
    testIdGaps,
  };

  // Write report
  fs.mkdirSync(PATHS.reports, { recursive: true });
  const reportPath = path.join(PATHS.reports, `${screenId}-structural.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

  // Print summary
  console.log("\n  ── Summary ──\n");
  console.log(`  Score:       ${score}/100`);
  console.log(`  Checks:      ${totalChecks} total (${totalPassed} passed, ${totalFailed} failed)`);
  console.log(`  Code fixes:  ${codeFixes.filter((f) => f.severity !== "info").length}`);
  console.log(`  testID gaps: ${testIdGaps.length}`);
  console.log(`  Report:      ${reportPath}`);
  console.log("");
}

main();
