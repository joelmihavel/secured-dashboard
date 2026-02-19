/**
 * analyze-hierarchy.ts — Maestro Hierarchy vs Figma Blueprint Cross-Reference
 *
 * Takes a Maestro view hierarchy CSV and a Figma blueprint JSON, then
 * cross-references rendered bounds/text against Figma TEXT nodes to produce
 * a structured mismatch report.
 *
 * Usage:
 *   npx ts-node scripts/analyze-hierarchy.ts <figmaId> --hierarchy <csvPath>
 *   npx ts-node scripts/analyze-hierarchy.ts 1-29108 --hierarchy data/hierarchies/1-29108-hierarchy.csv
 *   npx ts-node scripts/analyze-hierarchy.ts 1-29108 --hierarchy data/hierarchies/1-29108-hierarchy.csv --viewport 402x874
 *
 * Output: reports/hierarchy/{figmaId}-hierarchy-analysis.json
 *
 * The hierarchy CSV is produced by Maestro MCP's inspect_view_hierarchy tool.
 * Format:
 *   element_num,depth,bounds,attributes,parent_num
 *   34,31,"[52,494][349,534]","accessibilityText=Let's verify your number; enabled=true",33
 *
 * The blueprint JSON is produced by extract-screen-blueprint.ts and contains
 * TEXT nodes with geometry and typography data from Figma.
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
  reports: path.join(BUILDBOT_ROOT, "reports", "hierarchy"),
} as const;

/** Default Figma canvas dimensions (iPhone 14 Pro artboard) */
const FIGMA_CANVAS = { width: 393, height: 852 } as const;

/** Mismatch thresholds in logical pixels (post-scaling) */
const THRESHOLDS = {
  /** Maximum acceptable position delta (px) before flagging as mismatch */
  position: 4,
  /** Maximum acceptable size delta (px) before flagging as mismatch */
  size: 3,
} as const;

// ---------------------------------------------------------------------------
// Types — Hierarchy (Maestro CSV)
// ---------------------------------------------------------------------------

/** A single element parsed from the Maestro view hierarchy CSV */
interface HierarchyElement {
  /** Sequential element number from the CSV */
  elementNum: number;
  /** Nesting depth in the view tree */
  depth: number;
  /** Rendered bounds: left, top, right, bottom in device pixels */
  bounds: Bounds;
  /** Key-value attributes parsed from the CSV attributes column */
  attributes: Record<string, string>;
  /** The text content extracted from accessibilityText or text attribute */
  text: string | null;
  /** Parent element number */
  parentNum: number;
}

/** Device-pixel bounds as reported by Maestro: [left,top][right,bottom] */
interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// ---------------------------------------------------------------------------
// Types — Blueprint (Figma)
// ---------------------------------------------------------------------------

/** Minimal representation of a Figma TEXT node from the blueprint */
interface BlueprintTextNode {
  id: string;
  name: string;
  type: "TEXT";
  depth: number;
  visible: boolean;
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  typography: {
    content: string;
    fontSize: number;
    lineHeight: number;
    fontWeight: number;
    fontFamily: string;
    textAlign: string;
    color: string;
  };
  parentId: string | null;
}

/** Blueprint root-level structure as produced by extract-screen-blueprint.ts */
interface Blueprint {
  meta: {
    screenId: string;
    screenName: string;
    route: string;
    dimensions: {
      width: number;
      height: number;
    };
  };
  background: {
    color: string;
    hasDottedPattern: boolean;
    backgroundShapeKey: string;
  };
  nodes: BlueprintNode[];
}

/**
 * Generic node from the blueprint. We only care about TEXT nodes for this
 * analysis, but need the full union to safely parse the JSON array.
 */
interface BlueprintNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  depth: number;
  visible: boolean;
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  opacity?: number;
  typography?: {
    content: string;
    fontSize: number;
    lineHeight: number;
    fontWeight: number;
    fontFamily: string;
    letterSpacing?: number;
    textAlign: string;
    textAlignVertical?: string;
    color: string;
    spans?: Array<{ start: number; end: number }>;
  };
}

// ---------------------------------------------------------------------------
// Types — Analysis Output
// ---------------------------------------------------------------------------

/** Coordinate rectangle in logical pixels (after scale-factor application) */
interface ScaledRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A successfully matched text element with delta measurements */
interface MatchEntry {
  /** Figma node ID */
  figmaNodeId: string;
  /** Figma node name (human-readable label) */
  figmaNodeName: string;
  /** Text content that matched */
  textContent: string;
  /** Match strategy: "exact", "normalized", or "substring" */
  matchStrategy: MatchStrategy;
  /** Figma geometry scaled to viewport coordinates */
  figmaRect: ScaledRect;
  /** Rendered bounds converted to x/y/width/height */
  renderedRect: ScaledRect;
  /** Position delta: rendered minus expected (positive = rendered is further right/down) */
  positionDelta: { dx: number; dy: number };
  /** Size delta: rendered minus expected (positive = rendered is larger) */
  sizeDelta: { dw: number; dh: number };
  /** Whether position is within threshold */
  positionOk: boolean;
  /** Whether size is within threshold */
  sizeOk: boolean;
}

type MatchStrategy = "exact" | "normalized" | "substring";

/** A text element present in Figma but not found in the rendered hierarchy */
interface MissingEntry {
  figmaNodeId: string;
  figmaNodeName: string;
  textContent: string;
  figmaRect: ScaledRect;
  /** Why the element is likely missing */
  reason: string;
}

/** A position or size mismatch that exceeds the threshold */
interface MismatchEntry extends MatchEntry {
  /** Which dimensions are out of tolerance */
  mismatchTypes: Array<"position-x" | "position-y" | "width" | "height">;
}

/** Summary statistics for the analysis */
interface AnalysisSummary {
  /** Total TEXT nodes in the Figma blueprint (excluding system UI) */
  totalFigmaTextNodes: number;
  /** Number of Figma text nodes matched to rendered elements */
  matchedCount: number;
  /** Number of matches with all measurements within threshold */
  withinThresholdCount: number;
  /** Number of matches with at least one measurement out of threshold */
  mismatchCount: number;
  /** Number of Figma text nodes not found in rendered hierarchy */
  missingCount: number;
  /** The scale factor used (viewport / Figma canvas) */
  scaleFactor: { x: number; y: number };
  /** Viewport dimensions used */
  viewport: { width: number; height: number };
  /** Figma canvas dimensions */
  figmaCanvas: { width: number; height: number };
  /** Thresholds applied */
  thresholds: { position: number; size: number };
}

/** The complete analysis report written to disk */
interface HierarchyAnalysisReport {
  screenId: string;
  generatedAt: string;
  summary: AnalysisSummary;
  matches: MatchEntry[];
  mismatches: MismatchEntry[];
  missing: MissingEntry[];
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(step: string, message: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${step}] ${message}`);
}

function logError(step: string, message: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] [${step}] ERROR: ${message}`);
}

function logWarn(step: string, message: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.warn(`[${ts}] [${step}] WARN: ${message}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Normalize a text string for fuzzy comparison:
 * - Normalize smart quotes/apostrophes to ASCII equivalents
 * - Collapse whitespace (including newlines, tabs, non-breaking spaces)
 * - Trim leading/trailing whitespace
 * - Lowercase
 */
function normalizeText(text: string): string {
  return text
    // Normalize smart quotes → ASCII (Figma uses U+2018/2019/201C/201D; Maestro uses U+0027/0022)
    .replace(/[\u2018\u2019\u02BC\u2032]/g, "'")  // Smart single quotes → apostrophe
    .replace(/[\u201C\u201D\u2033]/g, '"')          // Smart double quotes → straight quotes
    .replace(/[\u2013\u2014]/g, "-")                // En/em dashes → hyphen
    .replace(/[\u2026]/g, "...")                     // Ellipsis → three dots
    .replace(/[\u00A0\u200B\u202F\u2009]/g, " ")   // Non-breaking/thin/zero-width spaces → space
    .replace(/[\s]+/g, " ")                          // Collapse whitespace
    .trim()
    .toLowerCase();
}

/**
 * System UI node names / contents that should be excluded from analysis.
 * These are rendered by the OS, not the app, so they will never match
 * app-rendered text.
 */
const SYSTEM_UI_PATTERNS: RegExp[] = [
  /^status\s*bar/i,
  /^battery/i,
  /^wifi/i,
  /^signal/i,
  /^cellular/i,
  /^hw\s*cutout/i,
  /^safe\s*area/i,
  /^home\s*indicator/i,
  /^time$/i,
  /^\d{1,2}:\d{2}$/,         // Time display (e.g., "13:13", "9:41")
  /^navigation\s*bar/i,
];

function isSystemUiNode(node: BlueprintNode): boolean {
  const name = node.name || "";
  const content = node.typography?.content || "";
  return SYSTEM_UI_PATTERNS.some(
    (pattern) => pattern.test(name) || pattern.test(content)
  );
}

// ---------------------------------------------------------------------------
// CSV Parsing — Maestro Hierarchy
// ---------------------------------------------------------------------------

/**
 * Parse the Maestro view hierarchy CSV into structured elements.
 *
 * CSV format (from inspect_view_hierarchy):
 *   element_num,depth,bounds,attributes,parent_num
 *   34,31,"[52,494][349,534]","accessibilityText=Let's verify your number; enabled=true",33
 *
 * Bounds format: [left,top][right,bottom]
 *
 * Attributes are semicolon-separated key=value pairs. Common keys:
 *   - accessibilityText: The text displayed or announced
 *   - text: Raw text content
 *   - enabled: Whether the element is interactive
 *   - testId: React Native testID
 *   - hintText: Placeholder text
 */
function parseHierarchyCsv(csvContent: string): HierarchyElement[] {
  const lines = csvContent.split("\n").map((line) => line.trim());
  const elements: HierarchyElement[] = [];

  // Find the header line to determine column positions
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("element_num")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    logWarn("csv-parse", "No header row found in hierarchy CSV. Attempting headerless parse.");
    headerIndex = -1; // Will start from line 0
  }

  const dataStartIndex = headerIndex + 1;

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length === 0) continue;

    const parsed = parseCsvLine(line);
    if (parsed) {
      elements.push(parsed);
    }
  }

  return elements;
}

/**
 * Parse a single CSV line, handling quoted fields that may contain commas
 * and semicolons.
 *
 * Expected column order: element_num, depth, bounds, attributes, parent_num
 */
function parseCsvLine(line: string): HierarchyElement | null {
  // Strategy: Use a state machine to properly handle quoted fields.
  // Fields can be quoted with double quotes and may contain commas.
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Check for escaped quote ("") inside a quoted field
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the second quote
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
  // Push the last field
  fields.push(current);

  if (fields.length < 5) {
    return null; // Not enough columns
  }

  const elementNum = parseInt(fields[0], 10);
  const depth = parseInt(fields[1], 10);
  const boundsStr = fields[2];
  const attributesStr = fields[3];
  const parentNum = parseInt(fields[4], 10);

  if (isNaN(elementNum) || isNaN(depth)) {
    return null; // Invalid row
  }

  const bounds = parseBounds(boundsStr);
  if (!bounds) {
    return null;
  }

  const attributes = parseAttributes(attributesStr);
  const text = extractTextFromAttributes(attributes);

  return {
    elementNum,
    depth,
    bounds,
    attributes,
    text,
    parentNum: isNaN(parentNum) ? 0 : parentNum,
  };
}

/**
 * Parse Maestro bounds string: "[left,top][right,bottom]"
 * Example: "[52,494][349,534]"
 */
function parseBounds(boundsStr: string): Bounds | null {
  const match = boundsStr.match(
    /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/
  );
  if (!match) return null;

  return {
    left: parseInt(match[1], 10),
    top: parseInt(match[2], 10),
    right: parseInt(match[3], 10),
    bottom: parseInt(match[4], 10),
  };
}

/**
 * Parse the attributes column from the CSV.
 * Format: "key1=value1; key2=value2; ..."
 * Values may themselves contain semicolons inside nested structures,
 * but the Maestro format uses "; " (semicolon-space) as the delimiter.
 */
function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!attrStr || attrStr.length === 0) return attrs;

  // Split on "; " (semicolon followed by space) to avoid splitting on
  // semicolons that appear inside attribute values
  const parts = attrStr.split("; ");
  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;

    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (key.length > 0) {
      attrs[key] = value;
    }
  }

  return attrs;
}

/**
 * Extract the display text from a hierarchy element's attributes.
 * Maestro exposes text in several attribute keys depending on the platform
 * and element type. We check them in priority order.
 */
function extractTextFromAttributes(
  attrs: Record<string, string>
): string | null {
  // Priority order for text extraction:
  // 1. "text" — direct text content (Android)
  // 2. "accessibilityText" — accessibility label (both platforms)
  // 3. "label" — UIKit label (iOS)
  // 4. "value" — input field value
  // 5. "hintText" — placeholder text

  const candidates = [
    attrs["text"],
    attrs["accessibilityText"],
    attrs["label"],
    attrs["value"],
    attrs["hintText"],
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.length > 0 && candidate !== "null") {
      return candidate;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Blueprint Extraction
// ---------------------------------------------------------------------------

/**
 * Extract all visible TEXT nodes from the blueprint, excluding system UI
 * elements (status bar clock, signal indicators, etc.).
 */
function extractTextNodes(blueprint: Blueprint): BlueprintTextNode[] {
  const textNodes: BlueprintTextNode[] = [];

  for (const node of blueprint.nodes) {
    if (node.type !== "TEXT") continue;
    if (!node.visible) continue;
    if (isSystemUiNode(node)) continue;
    if (!node.typography || !node.typography.content) continue;

    // Skip nodes with empty or whitespace-only content
    const content = node.typography.content.trim();
    if (content.length === 0) continue;

    textNodes.push({
      id: node.id,
      name: node.name,
      type: "TEXT",
      depth: node.depth,
      visible: node.visible,
      geometry: node.geometry,
      typography: {
        content: node.typography.content,
        fontSize: node.typography.fontSize,
        lineHeight: node.typography.lineHeight,
        fontWeight: node.typography.fontWeight,
        fontFamily: node.typography.fontFamily,
        textAlign: node.typography.textAlign,
        color: node.typography.color,
      },
      parentId: node.parentId,
    });
  }

  return textNodes;
}

// ---------------------------------------------------------------------------
// Scale Factor Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the scale factor from Figma canvas coordinates to device
 * viewport coordinates.
 *
 * Figma designs are typically at 393x852 (iPhone 14 Pro logical resolution).
 * The simulator viewport may be different (e.g., 402x874 for iPhone 15 Pro,
 * or doubled for @2x/3x device pixels).
 *
 * The hierarchy CSV bounds are in device-independent (logical) pixels on iOS
 * when using Maestro, so we just need to account for the artboard-to-viewport
 * ratio.
 */
function calculateScaleFactor(
  figmaCanvas: { width: number; height: number },
  viewport: { width: number; height: number }
): { x: number; y: number } {
  return {
    x: viewport.width / figmaCanvas.width,
    y: viewport.height / figmaCanvas.height,
  };
}

/**
 * Compute ABSOLUTE Figma coordinates for a node by walking up the parent chain.
 * Blueprint geometry.x/y are relative to parent frame, so we must sum all
 * ancestor offsets to get canvas-absolute values.
 */
function computeAbsoluteGeometry(
  node: { geometry: { x: number; y: number; width: number; height: number }; parentId?: string },
  nodeIndex: Map<string, { geometry: { x: number; y: number; width: number; height: number }; parentId?: string }>
): { x: number; y: number; width: number; height: number } {
  let absX = node.geometry.x;
  let absY = node.geometry.y;
  let currentParentId = node.parentId;
  let depth = 0;

  while (currentParentId && depth < 50) {
    const parent = nodeIndex.get(currentParentId);
    if (!parent) break;
    absX += parent.geometry.x;
    absY += parent.geometry.y;
    currentParentId = parent.parentId;
    depth++;
  }

  return { x: absX, y: absY, width: node.geometry.width, height: node.geometry.height };
}

/**
 * Scale a Figma geometry rect to viewport coordinates using the provided
 * scale factor.
 */
function scaleFigmaRect(
  geometry: { x: number; y: number; width: number; height: number },
  scale: { x: number; y: number }
): ScaledRect {
  return {
    x: round2(geometry.x * scale.x),
    y: round2(geometry.y * scale.y),
    width: round2(geometry.width * scale.x),
    height: round2(geometry.height * scale.y),
  };
}

/**
 * Convert Maestro bounds (left/top/right/bottom) to an x/y/width/height rect.
 */
function boundsToRect(bounds: Bounds): ScaledRect {
  return {
    x: bounds.left,
    y: bounds.top,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Text Matching Engine
// ---------------------------------------------------------------------------

/**
 * Match Figma text nodes to rendered hierarchy elements by text content.
 *
 * Uses a three-pass strategy:
 *   1. Exact match: trimmed content strings are identical
 *   2. Normalized match: after collapsing whitespace and lowercasing
 *   3. Substring match: one string contains the other (for truncated text)
 *
 * Each Figma node is matched to at most one rendered element, and each
 * rendered element is matched to at most one Figma node (1:1 mapping).
 * Exact matches take priority.
 */
function matchTextElements(
  figmaNodes: BlueprintTextNode[],
  hierarchyElements: HierarchyElement[]
): {
  matched: Array<{
    figmaNode: BlueprintTextNode;
    rendered: HierarchyElement;
    strategy: MatchStrategy;
  }>;
  unmatched: BlueprintTextNode[];
} {
  // Filter hierarchy elements to only those with text
  const textElements = hierarchyElements.filter((el) => el.text !== null);

  // Track which elements have been claimed
  const claimedFigma = new Set<string>();
  const claimedRendered = new Set<number>();
  const matched: Array<{
    figmaNode: BlueprintTextNode;
    rendered: HierarchyElement;
    strategy: MatchStrategy;
  }> = [];

  // --- Pass 1: Exact match (trimmed) ---
  for (const figmaNode of figmaNodes) {
    if (claimedFigma.has(figmaNode.id)) continue;
    const figmaText = figmaNode.typography.content.trim();

    for (const rendered of textElements) {
      if (claimedRendered.has(rendered.elementNum)) continue;
      const renderedText = (rendered.text as string).trim();

      if (figmaText === renderedText) {
        matched.push({ figmaNode, rendered, strategy: "exact" });
        claimedFigma.add(figmaNode.id);
        claimedRendered.add(rendered.elementNum);
        break;
      }
    }
  }

  // --- Pass 2: Normalized match ---
  for (const figmaNode of figmaNodes) {
    if (claimedFigma.has(figmaNode.id)) continue;
    const figmaNorm = normalizeText(figmaNode.typography.content);

    for (const rendered of textElements) {
      if (claimedRendered.has(rendered.elementNum)) continue;
      const renderedNorm = normalizeText(rendered.text as string);

      if (figmaNorm === renderedNorm) {
        matched.push({ figmaNode, rendered, strategy: "normalized" });
        claimedFigma.add(figmaNode.id);
        claimedRendered.add(rendered.elementNum);
        break;
      }
    }
  }

  // --- Pass 3: Substring match (for truncated or multiline collapsed text) ---
  for (const figmaNode of figmaNodes) {
    if (claimedFigma.has(figmaNode.id)) continue;
    const figmaNorm = normalizeText(figmaNode.typography.content);

    // Only try substring matching for non-trivial text (>3 chars)
    if (figmaNorm.length <= 3) continue;

    for (const rendered of textElements) {
      if (claimedRendered.has(rendered.elementNum)) continue;
      const renderedNorm = normalizeText(rendered.text as string);

      if (renderedNorm.length <= 3) continue;

      // Check if either contains the other
      if (figmaNorm.includes(renderedNorm) || renderedNorm.includes(figmaNorm)) {
        matched.push({ figmaNode, rendered, strategy: "substring" });
        claimedFigma.add(figmaNode.id);
        claimedRendered.add(rendered.elementNum);
        break;
      }
    }
  }

  // Collect unmatched Figma nodes
  const unmatched = figmaNodes.filter((n) => !claimedFigma.has(n.id));

  return { matched, unmatched };
}

// ---------------------------------------------------------------------------
// Analysis Engine
// ---------------------------------------------------------------------------

/**
 * Run the full hierarchy-vs-blueprint analysis.
 */
function analyzeHierarchy(
  blueprint: Blueprint,
  hierarchyElements: HierarchyElement[],
  viewport: { width: number; height: number }
): HierarchyAnalysisReport {
  const figmaCanvas = blueprint.meta.dimensions || FIGMA_CANVAS;
  const scale = calculateScaleFactor(figmaCanvas, viewport);

  log(
    "analyze",
    `Scale factor: x=${scale.x.toFixed(4)}, y=${scale.y.toFixed(4)} ` +
      `(Figma ${figmaCanvas.width}x${figmaCanvas.height} -> viewport ${viewport.width}x${viewport.height})`
  );

  // Extract text nodes from blueprint
  const allFigmaTextNodes = extractTextNodes(blueprint);
  log("analyze", `Found ${allFigmaTextNodes.length} visible TEXT nodes in blueprint (excluding system UI)`);

  // Filter hierarchy to text-bearing elements
  const textBearingElements = hierarchyElements.filter((el) => el.text !== null);
  log("analyze", `Found ${textBearingElements.length} text-bearing elements in hierarchy`);

  // --- Smart compound-frame filter ---
  // For compound Figma frames (e.g., sign-up + OTP overlay), many blueprint nodes
  // belong to sections not visible on screen. We pre-filter by checking which
  // blueprint text nodes have ANY normalized text overlap with the hierarchy.
  const hierarchyTexts = new Set(
    textBearingElements.map((el) => normalizeText(el.text as string))
  );
  // Also collect individual words from hierarchy for partial matching
  const hierarchyWords = new Set<string>();
  for (const t of hierarchyTexts) {
    for (const word of t.split(" ")) {
      if (word.length > 2) hierarchyWords.add(word);
    }
  }

  const figmaTextNodes = allFigmaTextNodes.filter((node) => {
    const norm = normalizeText(node.typography.content);
    // Exact or normalized match in hierarchy
    if (hierarchyTexts.has(norm)) return true;
    // Check if the Figma text is contained in any hierarchy text (e.g., individual "0" digits, "Proceed")
    for (const ht of hierarchyTexts) {
      if (ht.includes(norm) || norm.includes(ht)) return true;
    }
    // Check if the Figma text shares significant words with hierarchy (>= 50% of Figma words)
    const figmaWords = norm.split(" ").filter((w) => w.length > 2);
    if (figmaWords.length > 0) {
      const overlapCount = figmaWords.filter((w) => hierarchyWords.has(w)).length;
      if (overlapCount >= Math.ceil(figmaWords.length * 0.5)) return true;
    }
    return false;
  });

  const filteredCount = allFigmaTextNodes.length - figmaTextNodes.length;
  if (filteredCount > 0) {
    log("analyze", `Filtered out ${filteredCount} blueprint nodes not visible on screen (compound frame)`);
  }
  log("analyze", `Using ${figmaTextNodes.length} relevant TEXT nodes for matching`);

  // Match text content
  const { matched, unmatched } = matchTextElements(figmaTextNodes, hierarchyElements);
  log("analyze", `Matched ${matched.length} text nodes, ${unmatched.length} unmatched`);

  // Build node index for absolute position computation
  const nodeIndex = new Map<string, { geometry: { x: number; y: number; width: number; height: number }; parentId?: string }>();
  for (const node of blueprint.nodes) {
    nodeIndex.set(node.id, { geometry: node.geometry, parentId: node.parentId });
  }

  // Build match entries with delta calculations (using absolute Figma coordinates)
  const matchEntries: MatchEntry[] = [];
  const mismatchEntries: MismatchEntry[] = [];

  for (const { figmaNode, rendered, strategy } of matched) {
    // Use absolute coordinates (walking parent chain) instead of relative geometry
    const absGeometry = computeAbsoluteGeometry(figmaNode, nodeIndex);
    const figmaRect = scaleFigmaRect(absGeometry, scale);
    const renderedRect = boundsToRect(rendered.bounds);

    const dx = round2(renderedRect.x - figmaRect.x);
    const dy = round2(renderedRect.y - figmaRect.y);
    const dw = round2(renderedRect.width - figmaRect.width);
    const dh = round2(renderedRect.height - figmaRect.height);

    const positionOk =
      Math.abs(dx) <= THRESHOLDS.position && Math.abs(dy) <= THRESHOLDS.position;
    const sizeOk =
      Math.abs(dw) <= THRESHOLDS.size && Math.abs(dh) <= THRESHOLDS.size;

    const entry: MatchEntry = {
      figmaNodeId: figmaNode.id,
      figmaNodeName: figmaNode.name,
      textContent: figmaNode.typography.content.trim(),
      matchStrategy: strategy,
      figmaRect,
      renderedRect,
      positionDelta: { dx, dy },
      sizeDelta: { dw, dh },
      positionOk,
      sizeOk,
    };

    matchEntries.push(entry);

    // If either position or size is out of tolerance, it is a mismatch
    if (!positionOk || !sizeOk) {
      const mismatchTypes: MismatchEntry["mismatchTypes"] = [];
      if (Math.abs(dx) > THRESHOLDS.position) mismatchTypes.push("position-x");
      if (Math.abs(dy) > THRESHOLDS.position) mismatchTypes.push("position-y");
      if (Math.abs(dw) > THRESHOLDS.size) mismatchTypes.push("width");
      if (Math.abs(dh) > THRESHOLDS.size) mismatchTypes.push("height");

      mismatchEntries.push({ ...entry, mismatchTypes });
    }
  }

  // Build missing entries with reason inference
  const missingEntries: MissingEntry[] = unmatched.map((node) => {
    const figmaRect = scaleFigmaRect(node.geometry, scale);
    const reason = inferMissingReason(node, figmaRect, viewport);

    return {
      figmaNodeId: node.id,
      figmaNodeName: node.name,
      textContent: node.typography.content.trim(),
      figmaRect,
      reason,
    };
  });

  // Sort mismatches by total delta magnitude (worst first)
  mismatchEntries.sort((a, b) => {
    const magA =
      Math.abs(a.positionDelta.dx) +
      Math.abs(a.positionDelta.dy) +
      Math.abs(a.sizeDelta.dw) +
      Math.abs(a.sizeDelta.dh);
    const magB =
      Math.abs(b.positionDelta.dx) +
      Math.abs(b.positionDelta.dy) +
      Math.abs(b.sizeDelta.dw) +
      Math.abs(b.sizeDelta.dh);
    return magB - magA;
  });

  const withinThresholdCount = matchEntries.filter(
    (e) => e.positionOk && e.sizeOk
  ).length;

  const summary: AnalysisSummary = {
    totalFigmaTextNodes: figmaTextNodes.length,
    matchedCount: matched.length,
    withinThresholdCount,
    mismatchCount: mismatchEntries.length,
    missingCount: missingEntries.length,
    scaleFactor: { x: round2(scale.x), y: round2(scale.y) },
    viewport,
    figmaCanvas,
    thresholds: { ...THRESHOLDS },
  };

  return {
    screenId: blueprint.meta.screenId,
    generatedAt: new Date().toISOString(),
    summary,
    matches: matchEntries,
    mismatches: mismatchEntries,
    missing: missingEntries,
  };
}

/**
 * Infer why a Figma text node was not found in the rendered hierarchy.
 */
function inferMissingReason(
  node: BlueprintTextNode,
  scaledRect: ScaledRect,
  viewport: { width: number; height: number }
): string {
  const content = node.typography.content.trim();

  // Below fold — the element might not be visible without scrolling
  if (scaledRect.y + scaledRect.height > viewport.height) {
    return "Below viewport fold (may require scroll to render)";
  }

  // Above viewport — negative y offset
  if (scaledRect.y < 0) {
    return "Above viewport (negative y position)";
  }

  // Off-screen left/right
  if (scaledRect.x + scaledRect.width < 0 || scaledRect.x > viewport.width) {
    return "Off-screen horizontally";
  }

  // Very small text (might be clipped or invisible)
  if (scaledRect.width < 5 || scaledRect.height < 5) {
    return "Extremely small element (may be invisible/clipped)";
  }

  // Placeholder / dynamic content that may differ at runtime
  if (/^\d+$/.test(content) || /^[A-Z]{2,}$/.test(content)) {
    return "Dynamic or placeholder content (may have different runtime value)";
  }

  // Low opacity parent might hide the text
  if (node.depth > 3) {
    return "Deeply nested node (may be hidden by parent opacity or clipping)";
  }

  return "Not rendered or text content differs at runtime";
}

// ---------------------------------------------------------------------------
// Viewport Detection
// ---------------------------------------------------------------------------

/**
 * Attempt to infer the viewport dimensions from the hierarchy data.
 *
 * Strategy: The root element (element_num=0 or depth=0) typically has bounds
 * spanning the full screen. If not found, fall back to the element with the
 * largest bounding area.
 */
function inferViewportFromHierarchy(
  elements: HierarchyElement[]
): { width: number; height: number } | null {
  // Try depth-0 element first
  const rootElement = elements.find((el) => el.depth === 0);
  if (rootElement) {
    const w = rootElement.bounds.right - rootElement.bounds.left;
    const h = rootElement.bounds.bottom - rootElement.bounds.top;
    if (w > 100 && h > 100) {
      return { width: w, height: h };
    }
  }

  // Fall back to largest area element
  let maxArea = 0;
  let maxElement: HierarchyElement | null = null;
  for (const el of elements) {
    const w = el.bounds.right - el.bounds.left;
    const h = el.bounds.bottom - el.bounds.top;
    const area = w * h;
    if (area > maxArea) {
      maxArea = area;
      maxElement = el;
    }
  }

  if (maxElement) {
    const w = maxElement.bounds.right - maxElement.bounds.left;
    const h = maxElement.bounds.bottom - maxElement.bounds.top;
    if (w > 100 && h > 100) {
      return { width: w, height: h };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CLIArgs {
  screenId: string;
  hierarchyPath: string;
  viewport: { width: number; height: number } | null;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage:\n" +
        "  npx ts-node scripts/analyze-hierarchy.ts <figmaId> --hierarchy <csvPath>\n" +
        "  npx ts-node scripts/analyze-hierarchy.ts <figmaId> --hierarchy <csvPath> --viewport 402x874\n" +
        "\n" +
        "Examples:\n" +
        '  npx ts-node scripts/analyze-hierarchy.ts 1-29108 --hierarchy data/hierarchies/1-29108-hierarchy.csv\n' +
        '  npx ts-node scripts/analyze-hierarchy.ts 1-29108 --hierarchy data/hierarchies/1-29108-hierarchy.csv --viewport 402x874\n' +
        "\n" +
        "If --viewport is omitted, the script infers it from the hierarchy root element.\n" +
        "If inference fails, it defaults to the Figma canvas dimensions (393x852)."
    );
    process.exit(1);
  }

  let screenId = "";
  let hierarchyPath = "";
  let viewport: { width: number; height: number } | null = null;

  // First non-flag arg is the screen ID
  let i = 0;
  if (args[0] && !args[0].startsWith("--")) {
    screenId = args[0].replace(":", "-");
    i = 1;
  }

  for (; i < args.length; i++) {
    switch (args[i]) {
      case "--hierarchy":
        hierarchyPath = args[++i] ?? "";
        break;
      case "--viewport": {
        const vp = args[++i] ?? "";
        const vpMatch = vp.match(/^(\d+)x(\d+)$/);
        if (vpMatch) {
          viewport = {
            width: parseInt(vpMatch[1], 10),
            height: parseInt(vpMatch[2], 10),
          };
        } else {
          logError("args", `Invalid viewport format: "${vp}". Expected WIDTHxHEIGHT, e.g., 402x874`);
          process.exit(1);
        }
        break;
      }
      default:
        logWarn("args", `Unknown argument: ${args[i]}`);
    }
  }

  if (!screenId) {
    logError("args", "Screen ID is required as the first argument.");
    process.exit(1);
  }

  if (!hierarchyPath) {
    logError("args", "--hierarchy <csvPath> is required.");
    process.exit(1);
  }

  // Resolve hierarchy path relative to buildbot root if not absolute
  if (!path.isAbsolute(hierarchyPath)) {
    hierarchyPath = path.join(BUILDBOT_ROOT, hierarchyPath);
  }

  return { screenId, hierarchyPath, viewport };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = parseArgs();

  log("main", `Analyzing hierarchy for screen: ${args.screenId}`);

  // --- Load blueprint ---
  const blueprintPath = path.join(
    PATHS.blueprints,
    `${args.screenId}-blueprint.json`
  );
  if (!fs.existsSync(blueprintPath)) {
    logError("main", `Blueprint not found: ${blueprintPath}`);
    logError(
      "main",
      `Run extraction first: npx ts-node scripts/extract-screen-blueprint.ts ${args.screenId}`
    );
    process.exit(1);
  }

  const blueprint = readJsonSafe<Blueprint>(blueprintPath);
  if (!blueprint) {
    logError("main", `Failed to parse blueprint: ${blueprintPath}`);
    process.exit(1);
  }
  log("main", `Blueprint loaded: ${blueprint.meta.screenName}`);

  // --- Load hierarchy CSV ---
  if (!fs.existsSync(args.hierarchyPath)) {
    logError("main", `Hierarchy CSV not found: ${args.hierarchyPath}`);
    logError(
      "main",
      "Use Maestro MCP inspect_view_hierarchy to capture the hierarchy, then save as CSV."
    );
    process.exit(1);
  }

  const csvContent = fs.readFileSync(args.hierarchyPath, "utf-8");
  const hierarchyElements = parseHierarchyCsv(csvContent);
  log("main", `Parsed ${hierarchyElements.length} elements from hierarchy CSV`);

  if (hierarchyElements.length === 0) {
    logError("main", "No elements parsed from hierarchy CSV. Check the file format.");
    process.exit(1);
  }

  // --- Determine viewport ---
  let viewport = args.viewport;
  if (!viewport) {
    const inferred = inferViewportFromHierarchy(hierarchyElements);
    if (inferred) {
      viewport = inferred;
      log("main", `Viewport inferred from hierarchy: ${viewport.width}x${viewport.height}`);
    } else {
      viewport = { ...FIGMA_CANVAS };
      logWarn(
        "main",
        `Could not infer viewport from hierarchy. Using Figma canvas default: ${viewport.width}x${viewport.height}`
      );
    }
  } else {
    log("main", `Viewport from CLI: ${viewport.width}x${viewport.height}`);
  }

  // --- Run analysis ---
  const report = analyzeHierarchy(blueprint, hierarchyElements, viewport);

  // --- Write report ---
  ensureDir(PATHS.reports);
  const reportPath = path.join(
    PATHS.reports,
    `${args.screenId}-hierarchy-analysis.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  log("main", `Report saved: ${reportPath}`);

  // --- Print summary ---
  printSummary(report);

  // Exit with non-zero if there are mismatches or missing elements
  const hasIssues = report.summary.mismatchCount > 0 || report.summary.missingCount > 0;
  process.exit(hasIssues ? 1 : 0);
}

function printSummary(report: HierarchyAnalysisReport): void {
  const s = report.summary;
  const bar = "=".repeat(60);

  console.log(`
${bar}
  Hierarchy Analysis: ${report.screenId}
${bar}
  Figma TEXT nodes:     ${s.totalFigmaTextNodes}
  Matched:              ${s.matchedCount}
  Within threshold:     ${s.withinThresholdCount}
  Mismatches:           ${s.mismatchCount}
  Missing:              ${s.missingCount}

  Scale:   ${s.scaleFactor.x}x / ${s.scaleFactor.y}y
  Viewport: ${s.viewport.width}x${s.viewport.height}
  Thresholds: position=${s.thresholds.position}px, size=${s.thresholds.size}px
${bar}`);

  if (report.mismatches.length > 0) {
    console.log("\n  MISMATCHES (sorted by severity):");
    for (const m of report.mismatches.slice(0, 10)) {
      const types = m.mismatchTypes.join(", ");
      const dx = m.positionDelta.dx >= 0 ? `+${m.positionDelta.dx}` : `${m.positionDelta.dx}`;
      const dy = m.positionDelta.dy >= 0 ? `+${m.positionDelta.dy}` : `${m.positionDelta.dy}`;
      const dw = m.sizeDelta.dw >= 0 ? `+${m.sizeDelta.dw}` : `${m.sizeDelta.dw}`;
      const dh = m.sizeDelta.dh >= 0 ? `+${m.sizeDelta.dh}` : `${m.sizeDelta.dh}`;
      const text =
        m.textContent.length > 40
          ? m.textContent.slice(0, 37) + "..."
          : m.textContent;
      console.log(`    "${text}"`);
      console.log(`      pos: (${dx}, ${dy})  size: (${dw}, ${dh})  [${types}]`);
    }
    if (report.mismatches.length > 10) {
      console.log(`    ... and ${report.mismatches.length - 10} more`);
    }
  }

  if (report.missing.length > 0) {
    console.log("\n  MISSING ELEMENTS:");
    for (const m of report.missing.slice(0, 10)) {
      const text =
        m.textContent.length > 40
          ? m.textContent.slice(0, 37) + "..."
          : m.textContent;
      console.log(`    "${text}" — ${m.reason}`);
    }
    if (report.missing.length > 10) {
      console.log(`    ... and ${report.missing.length - 10} more`);
    }
  }

  if (report.summary.mismatchCount === 0 && report.summary.missingCount === 0) {
    console.log("\n  All text elements matched and within threshold.");
  }

  console.log(`\n${bar}\n`);
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

main();
