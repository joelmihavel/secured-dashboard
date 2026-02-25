/**
 * extract-screen-blueprint.ts
 *
 * CORE BuildBot script. Extracts deterministic data from the Figma REST API
 * and produces a "Screen Blueprint" JSON file. Zero AI dependency -- every
 * value in the output is derived directly from the Figma node tree.
 *
 * Usage:
 *   npx tsx scripts/extract-screen-blueprint.ts 41-8760
 *   npx tsx scripts/extract-screen-blueprint.ts 1:29914
 *
 * Both hyphen and colon ID formats are accepted.
 *   - Internally: colon for API calls, hyphen for filenames.
 *
 * Outputs:
 *   ../data/blueprints/{screenId}-blueprint.json
 *   ../data/baselines/{screenId}-baseline.png
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Load environment variables from ../.env
const dotenvPath = path.resolve(__dirname, '..', '.env');
try {
  // Inline dotenv loading -- keeps the dependency light
  if (fs.existsSync(dotenvPath)) {
    const envContent = fs.readFileSync(dotenvPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch {
  // .env is optional -- continue without it
}

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

interface FigmaConfig {
  fileKey: string;
  figmaToken: string;
  restApiBaseUrl: string;
  baseDesignWidth: number;
  baseDesignHeight: number;
  exportScale: number;
}

interface ResolvedVariable {
  id: string;
  name: string;
  resolvedType: string; // COLOR | FLOAT | STRING | BOOLEAN
  description?: string;
  collectionId: string;
  collectionName: string;
  valuesByMode: Record<string, unknown>;
}

interface VariablesResponse {
  variables: Record<string, ResolvedVariable>;
  collections: Record<string, {
    id: string;
    name: string;
    modes: Array<{ modeId: string; name: string }>;
  }>;
}

interface DesignTokens {
  _colorByHex: Record<string, string>;
  _typographyByStyle: Record<string, string>;
  _spacingByValue: Record<string, string>;
  _radiusByValue: Record<string, string>;
}

interface ScreenRouteEntry {
  figmaId: string;
  name: string;
  state: string;
  routeWithState?: string;
}

interface ScreenRouteGroup {
  route: string;
  figmaPatterns?: string[];
  screens: ScreenRouteEntry[];
}

interface ScreenRoutes {
  routes: Record<string, ScreenRouteGroup>;
}

// -- Blueprint node types ---------------------------------------------------

interface BlueprintFill {
  type: string; // SOLID | IMAGE | GRADIENT_LINEAR | GRADIENT_RADIAL | GRADIENT_ANGULAR | GRADIENT_DIAMOND
  color?: string;
  opacity?: number;
  visible: boolean;
  blendMode?: string; // Per-fill blend mode (NORMAL, MULTIPLY, SCREEN, OVERLAY, etc.)
  // IMAGE fills
  imageRef?: string;
  scaleMode?: string; // FILL | FIT | CROP | TILE
  imageTransform?: number[][]; // 2x3 affine transform matrix [[a,b,c],[d,e,f]]
  imageFilters?: {
    exposure?: number;
    contrast?: number;
    saturation?: number;
    temperature?: number;
    tint?: number;
    highlights?: number;
    shadows?: number;
  };
  // GRADIENT fills
  gradientStops?: Array<{ color: string; position: number; opacity?: number; boundVariables?: Record<string, unknown> }>;
  gradientHandlePositions?: Array<{ x: number; y: number }>;
  // Figma Variable bindings on this fill (authoritative design token reference)
  boundVariables?: Record<string, unknown>;
}

interface BlueprintStroke {
  color: string;
  weight: number;
  visible: boolean;
  align?: string;
  cap?: string;
  join?: string;
  dashPattern?: number[];
}

interface BlueprintEffect {
  type: string;
  visible: boolean;
  color?: string;
  offset?: { x: number; y: number };
  blur?: number;
  spread?: number;
  blendMode?: string;
  showShadowBehindNode?: boolean;
}

interface BlueprintLayout {
  direction: 'row' | 'column' | 'none';
  justifyContent: string;
  alignItems: string;
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  wrap: string;
  sizingH: string;
  sizingV: string;
  // Wrapped layout cross-axis alignment (only when wrap !== NO_WRAP)
  counterAxisAlignContent?: string;
  // Cross-axis gap for wrapped layouts
  counterAxisSpacing?: number;
  // Z-ordering of auto-layout children (true = first child on top)
  itemReverseZIndex?: boolean;
}

interface BlueprintTypographySpan {
  start: number;
  end: number;
  color?: string;
  fontWeight?: number;
  fontFamily?: string;
  fontStyle?: string; // normal | italic
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
  textDecoration?: string;
  textCase?: string; // uppercase | lowercase | capitalize
  hyperlink?: { type: string; url?: string; nodeID?: string }; // URL or node link
  opentypeFlags?: Record<string, number>; // OpenType features (ligatures, stylistic sets)
}

interface BlueprintTypography {
  content: string;
  fontSize: number;
  lineHeight: number;
  lineHeightUnit?: string; // PIXELS | FONT_SIZE_% | INTRINSIC (informational)
  fontWeight: number;
  fontFamily: string;
  fontStyle: string; // normal | italic
  letterSpacing: number;
  textAlign: string;
  textAlignVertical: string;
  textDecoration: string;
  textTransform: string;
  paragraphSpacing: number;
  paragraphIndent?: number; // First-line indent in px
  textAutoResize: string;
  textTruncation?: string; // DISABLED | ENDING — maps to RN ellipsizeMode
  maxLines?: number; // Max lines before truncation — maps to RN numberOfLines
  color: string;
  fontPostScriptName?: string; // Raw PostScript font name from Figma (e.g., "PlusJakartaSans-SemiBoldItalic")
  openTypeFlags?: Record<string, number>; // OpenType features (ligatures, etc.)
  hyperlink?: { type: string; url?: string; nodeID?: string }; // Whole-text hyperlink
  lineHeightPercent?: number; // Line height as % of font size (informational)
  inheritTextStyleId?: string; // Inherited text style reference
  lineIndentations?: number[]; // Per-line indentation values
  lineTypes?: string[]; // Per-line type: NONE, ORDERED, UNORDERED (list bullets/numbers)
  textRangeFills?: Array<Record<string, unknown>>; // Per-character-range fills (gradient text, multi-color)
  spans: BlueprintTypographySpan[];
}

interface BlueprintVectorPath {
  path: string;
  windingRule: string;
}

interface BlueprintArcData {
  startingAngle: number;
  endingAngle: number;
  innerRadius: number;
}

interface BlueprintInteractionAction {
  type: string; // NODE, BACK, CLOSE, URL, SCROLL_TO, SWAP, etc.
  destinationId?: string;
  url?: string;
  navigation?: string; // NAVIGATE, SWAP, OVERLAY, SCROLL_TO, CHANGE_TO
  transition?: {
    type: string; // DISSOLVE, SMART_ANIMATE, MOVE_IN, MOVE_OUT, PUSH, SLIDE_IN, SLIDE_OUT
    duration: number;
    easing: {
      type: string; // EASE_IN, EASE_OUT, EASE_IN_AND_OUT, LINEAR, CUSTOM_CUBIC_BEZIER
      easingFunctionCubicBezier?: { x1: number; y1: number; x2: number; y2: number };
    };
  };
  preserveScrollPosition?: boolean;
  overlayRelativePosition?: { x: number; y: number };
}

interface BlueprintInteraction {
  trigger: {
    type: string; // ON_CLICK, ON_HOVER, ON_PRESS, ON_DRAG, MOUSE_ENTER, MOUSE_LEAVE, AFTER_TIMEOUT, etc.
    delay?: number;
    timeout?: number;
  };
  actions: BlueprintInteractionAction[]; // Figma returns actions[] array, not singular action
}


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
  // Absolute render bounds (actual visible area after clips/rotations; null = fully clipped)
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number } | null;
  // Absolute bounding box (pre-clip axis-aligned bounding box)
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  opacity: number;
  fills: BlueprintFill[];
  strokes: BlueprintStroke[];
  effects: BlueprintEffect[];
  borderRadius: number | { tl: number; tr: number; br: number; bl: number };
  // iOS-style superellipse corner smoothing (0.0 to 1.0; ~0.6 = iOS native)
  cornerSmoothing?: number;
  individualStrokeWeights?: { top: number; right: number; bottom: number; left: number };
  strokeWeight?: number;
  strokeAlign?: string;
  strokeCap?: string;
  strokeJoin?: string;
  strokeDashes?: number[];
  clipsContent: boolean;
  // FRAME / GROUP / COMPONENT / INSTANCE
  layout?: BlueprintLayout;
  // Per-child auto-layout properties (set on the child, not the parent)
  layoutPositioning?: string; // AUTO | ABSOLUTE — absolute-positioned children in auto-layout
  layoutAlign?: string; // STRETCH | INHERIT | MIN | CENTER | MAX — per-child cross-axis override
  layoutGrow?: number; // How much this child grows within parent auto-layout (0 = don't grow)
  // Per-node sizing mode (FIXED | FILL | HUG) — how this node sizes itself within parent auto-layout
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  // Size constraints (auto-layout children)
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  // TEXT
  typography?: BlueprintTypography;
  // VECTOR / BOOLEAN_OPERATION
  vectorPaths?: BlueprintVectorPath[];
  // Stroke geometry paths (complex stroked shapes)
  strokePaths?: BlueprintVectorPath[];
  // ELLIPSE-specific arc geometry
  arcData?: BlueprintArcData;
  // INSTANCE / COMPONENT
  componentId?: string;
  componentProperties?: Record<string, unknown>;
  // Component property references (links sublayer props to parent component properties)
  componentPropertyReferences?: Record<string, string>;
  // Constraints (responsive sizing)
  constraints?: { horizontal: string; vertical: string };
  // Blend mode
  blendMode?: string;
  // Prototyping interactions (from Figma API `interactions` field)
  interactions?: BlueprintInteraction[];
  // Legacy prototyping properties (node-level)
  transitionNodeID?: string;
  transitionDuration?: number;
  transitionEasing?: Record<string, unknown>;
  // Scroll behavior (SCROLLS | FIXED | STICKY | FIXED_WHEN_CHILD_OF_SCROLLING_FRAME)
  scrollBehavior?: string;
  // Preserve aspect ratio
  preserveRatio?: boolean;
  targetAspectRatio?: number;
  // Size before rotation/scale (only with geometry=paths)
  size?: { x: number; y: number };
  // 2x3 affine transform matrix relative to parent (only with geometry=paths)
  relativeTransform?: number[][];
  // Mask properties
  isMask?: boolean;
  isMaskOutline?: boolean;
  maskType?: string;
  // Lock / fixed state
  locked?: boolean;
  isFixed?: boolean;
  // Export settings configured in Figma
  exportSettings?: Array<{ suffix: string; format: string; constraint: { type: string; value: number } }>;
  // Figma Variable bindings (design tokens)
  boundVariables?: Record<string, unknown>;
  // Style references (named styles: fill, text, effect, grid)
  styleReferences?: Record<string, string>;
  // Dev status (READY_FOR_DEV, etc.)
  devStatus?: { type: string; description?: string };
  // Jan 2026 API additions
  complexStrokeProperties?: Record<string, unknown>;
  textPathStartData?: Record<string, unknown>;
  transformModifiers?: Array<Record<string, unknown>>;
  // Layout grids
  layoutGrids?: Array<Record<string, unknown>>;
  // Instance overrides (which fields differ from main component)
  overriddenFields?: string[];
  overrides?: Array<Record<string, unknown>>;
  // Instance exposure
  isExposedInstance?: boolean;
  exposedInstances?: string[];
  // Component property definitions (on COMPONENT / COMPONENT_SET nodes)
  componentPropertyDefinitions?: Record<string, unknown>;
  // Boolean operation type (for BOOLEAN_OPERATION nodes)
  booleanOperation?: string; // UNION | INTERSECT | SUBTRACT | EXCLUDE
  // Show shadow behind node content
  showShadowBehindNode?: boolean;
  // Overflow / scroll direction (HORIZONTAL_SCROLLING | VERTICAL_SCROLLING | HORIZONTAL_AND_VERTICAL_SCROLLING | NONE)
  overflowDirection?: string;
  // Whether strokes are included in layout calculations (box-sizing: border-box)
  strokesIncludedInLayout?: boolean;
  // Stroke miter angle (corner angle for MITER joins, in degrees)
  strokeMiterAngle?: number;
  // CSS Grid layout properties (when layoutMode is GRID)
  gridLayout?: {
    rowCount?: number;
    columnCount?: number;
    rowGap?: number;
    columnGap?: number;
    columnsSizing?: string; // CSS grid-template-columns
    rowsSizing?: string; // CSS grid-template-rows
  };
  // Per-child CSS Grid placement
  gridChildAlign?: { horizontal?: string; vertical?: string }; // AUTO | MIN | CENTER | MAX
  gridSpan?: { rows?: number; columns?: number };
  gridAnchor?: { row?: number; column?: number };
  // Vector network (vertex/edge/region data for VECTOR nodes — editable vector structure)
  vectorNetwork?: Record<string, unknown>;
  // Fill override table (for VECTOR nodes with geometry=paths)
  fillOverrideTable?: Record<string, unknown>;
  // Variable width stroke points
  variableWidthPoints?: Array<{ x: number; y: number }>;
  // Uniform scale factor (for INSTANCE nodes)
  uniformScaleFactor?: number;
  // Parent-level axis sizing modes (how parent sizes along main/cross axis)
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  // Auto-mapping
  rnComponent?: string;
  rnProps?: Record<string, unknown>;
  // Children IDs for reference
  childIds?: string[];
}

interface BlueprintAsset {
  imageRef: string;
  nodeId: string;
  nodeName: string;
  usage: string;
  downloadUrl: string;
  localPath: string;
}

interface ScreenBlueprint {
  meta: {
    screenId: string;
    screenName: string;
    route: string;
    stateName: string;
    dimensions: { width: number; height: number };
    generatedAt: string;
    figmaFileKey: string;
  };
  background: {
    color: string;
    hasDottedPattern: boolean;
    backgroundShapeKey?: string;
    gradient?: {
      type: string;
      stops: Array<{ color: string; position: number }>;
    };
  };
  nodes: BlueprintNode[];
  assets: BlueprintAsset[];
  tokensUsed: {
    colors: Record<string, string>;
    typography: Record<string, string>;
    spacing: Record<string, string>;
    radius: Record<string, string>;
  };
  // Prototyping flow summary (aggregated from node interactions)
  prototyping?: {
    hasInteractions: boolean;
    flowCount: number;
    flows: Array<{
      sourceNodeId: string;
      sourceNodeName: string;
      trigger: string;
      destinationNodeId?: string;
      transitionType?: string;
      transitionDuration?: number;
    }>;
  };
  // Top-level component metadata (from file-level `components` object)
  componentMeta?: Record<string, {
    key: string;
    name: string;
    description?: string;
    componentSetId?: string;
    documentationLinks?: Array<{ uri: string }>;
  }>;
  // Top-level component set metadata
  componentSetMeta?: Record<string, {
    key: string;
    name: string;
    description?: string;
  }>;
  // Top-level style definitions (named styles)
  styleMeta?: Record<string, {
    key: string;
    name: string;
    styleType: string; // FILL | TEXT | EFFECT | GRID
    description?: string;
  }>;
  // Resolved Figma Variables (from /v1/files/{fileKey}/variables/local)
  variableMeta?: {
    variables: Record<string, {
      name: string;
      resolvedType: string;
      collectionName: string;
      valuesByMode: Record<string, unknown>;
    }>;
    collections: Record<string, {
      name: string;
      modes: Array<{ modeId: string; name: string }>;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Convert Figma RGBA (0-1 range) to uppercase hex string. */
function figmaColorToHex(c: { r: number; g: number; b: number; a?: number }): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`.toUpperCase();
}

/** Convert Figma RGBA to hex+alpha string for effects (includes alpha). */
function figmaColorToHexAlpha(c: { r: number; g: number; b: number; a?: number }): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`.toUpperCase();
  if (c.a !== undefined && c.a < 1) {
    return `${hex}${toHex(c.a).toUpperCase()}`;
  }
  return hex;
}

/** Convert screen ID between hyphen and colon formats.
 * Figma IDs are always `{number}:{number}` (e.g., `1:29108`, `243:2762`).
 * File-safe format uses hyphen: `1-29108`, `243-2762`.
 */
function toApiId(id: string): string {
  // Only convert if it matches the expected pattern: digits-digits
  const match = id.match(/^(\d+)-(\d+)$/);
  if (match) return `${match[1]}:${match[2]}`;
  // Already in colon format or unexpected format — return as-is
  return id;
}

function toFileId(id: string): string {
  const match = id.match(/^(\d+):(\d+)$/);
  if (match) return `${match[1]}-${match[2]}`;
  return id;
}

/** Node name patterns to skip. */
const SKIP_NAME_PATTERN = /StatusBar|HW Cutout|Safe ?Area|Home Indicator/i;

/** Font weight to PostScript name suffix resolution.
 *  Only applies PlusJakartaSans mapping when the raw font IS PlusJakartaSans.
 *  Non-PlusJakartaSans fonts (SF Pro, Inter, etc.) are returned as-is. */
function resolveFontFamily(fontWeight: number, rawFontFamily?: string, rawPostScriptName?: string): string {
  // If the raw font is not Plus Jakarta Sans, preserve it verbatim
  if (rawFontFamily && rawFontFamily !== 'Plus Jakarta Sans' && !rawFontFamily.startsWith('PlusJakartaSans')) {
    // Use PostScript name if available (e.g. "SFPro-Semibold"), otherwise raw family
    return rawPostScriptName || rawFontFamily;
  }
  switch (fontWeight) {
    case 400: return 'PlusJakartaSans-Regular';
    case 500: return 'PlusJakartaSans-Medium';
    case 600: return 'PlusJakartaSans-SemiBold';
    case 700: return 'PlusJakartaSans-Bold';
    default:  return 'PlusJakartaSans-Regular';
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers (Node.js built-in https)
// ---------------------------------------------------------------------------

interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function httpsGet(url: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
    };

    const req = https.request(options, (res) => {
      // Follow redirects (Figma image URLs redirect to S3)
      if (res.statusCode && (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307) && res.headers.location) {
        httpsGet(res.headers.location, {}).then(resolve).catch(reject);
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.end();
  });
}

function httpsGetBuffer(url: string, headers: Record<string, string> = {}): Promise<{ status: number; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const proto = parsed.protocol === 'http:' ? http : https;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
    };

    const req = proto.request(options, (res) => {
      // Follow redirects
      if (res.statusCode && (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307) && res.headers.location) {
        httpsGetBuffer(res.headers.location, {}).then(resolve).catch(reject);
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          buffer: Buffer.concat(chunks),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 5000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const is429 = lastError.message.includes('429');
      const waitMs = is429 ? 60000 : backoffMs * attempt;
      log('warn', `${label} -- attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);
      if (attempt < maxRetries) {
        log('info', `  Retrying in ${(waitMs / 1000).toFixed(0)}s...`);
        await sleep(waitMs);
      }
    }
  }
  throw lastError || new Error(`${label} failed after ${maxRetries} retries`);
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function log(level: LogLevel, ...args: unknown[]): void {
  const prefix: Record<LogLevel, string> = {
    info:  '[INFO]',
    warn:  '[WARN]',
    error: '[ERROR]',
    debug: '[DEBUG]',
  };
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`${ts} ${prefix[level]}`, ...args);
}

// ---------------------------------------------------------------------------
// Configuration Loading
// ---------------------------------------------------------------------------

function loadFigmaConfig(): FigmaConfig {
  const configPath = path.resolve(__dirname, 'config', 'figma.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Figma config not found at ${configPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const token = process.env.FIGMA_TOKEN || raw.figmaToken;
  if (!token) {
    throw new Error('FIGMA_TOKEN not set. Provide via .env or config/figma.json');
  }
  return {
    fileKey: raw.fileKey,
    figmaToken: token,
    restApiBaseUrl: raw.restApiBaseUrl || 'https://api.figma.com/v1',
    baseDesignWidth: raw.baseDesignWidth || 393,
    baseDesignHeight: raw.baseDesignHeight || 852,
    exportScale: raw.exportScale || 3,
  };
}

function loadDesignTokens(): DesignTokens {
  const tokensPath = path.resolve(__dirname, 'config', 'design-tokens.json');
  if (!fs.existsSync(tokensPath)) {
    log('warn', `Design tokens not found at ${tokensPath} -- token mapping disabled`);
    return {
      _colorByHex: {},
      _typographyByStyle: {},
      _spacingByValue: {},
      _radiusByValue: {},
    };
  }
  const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
  log('info', `Loaded design tokens (source: ${raw._meta?.source || 'unknown'}, generated: ${raw._meta?.generatedAt || 'unknown'})`);
  return {
    _colorByHex: raw._colorByHex || {},
    _typographyByStyle: raw._typographyByStyle || {},
    _spacingByValue: raw._spacingByValue || {},
    _radiusByValue: raw._radiusByValue || {},
  };
}

function loadScreenRoutes(): ScreenRoutes {
  const routesPath = path.resolve(__dirname, 'config', 'screen-routes.json');
  if (!fs.existsSync(routesPath)) {
    log('warn', `Screen routes not found at ${routesPath}`);
    return { routes: {} };
  }
  return JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
}

// ---------------------------------------------------------------------------
// Route Resolution
// ---------------------------------------------------------------------------

interface ResolvedRoute {
  routeKey: string;
  route: string;
  screenName: string;
  stateName: string;
}

function resolveRoute(screenId: string, routes: ScreenRoutes): ResolvedRoute {
  const fileId = toFileId(screenId);
  for (const [routeKey, group] of Object.entries(routes.routes)) {
    for (const screen of group.screens) {
      if (toFileId(screen.figmaId) === fileId) {
        return {
          routeKey,
          route: group.route,
          screenName: screen.name,
          stateName: screen.state,
        };
      }
    }
  }
  return {
    routeKey: 'unknown',
    route: '/unknown',
    screenName: `Screen ${screenId}`,
    stateName: 'default',
  };
}

// ---------------------------------------------------------------------------
// Figma API Calls
// ---------------------------------------------------------------------------

interface FigmaNodeResponse {
  document: Record<string, unknown>;
  components?: Record<string, Record<string, unknown>>;
  componentSets?: Record<string, Record<string, unknown>>;
  styles?: Record<string, Record<string, unknown>>;
}

async function fetchNodeTree(
  config: FigmaConfig,
  nodeId: string,
): Promise<FigmaNodeResponse> {
  const apiId = toApiId(nodeId);
  const url = `${config.restApiBaseUrl}/files/${config.fileKey}/nodes?ids=${encodeURIComponent(apiId)}&depth=999&geometry=paths`;
  log('info', `Fetching node tree: ${apiId}`);

  const response = await withRetry('fetchNodeTree', async () => {
    const res = await httpsGet(url, { 'X-Figma-Token': config.figmaToken });
    if (res.status === 429) {
      throw new Error('429 Rate Limited');
    }
    if (res.status !== 200) {
      throw new Error(`Figma API returned ${res.status}: ${res.body.slice(0, 200)}`);
    }
    return res;
  });

  const data = JSON.parse(response.body);
  const nodeData = data.nodes?.[apiId];
  const doc = nodeData?.document;
  if (!doc) {
    throw new Error(`Node ${apiId} not found in Figma response`);
  }
  log('info', `Node tree received: "${doc.name}" (${doc.type})`);

  return {
    document: doc,
    components: nodeData.components as Record<string, Record<string, unknown>> | undefined,
    componentSets: nodeData.componentSets as Record<string, Record<string, unknown>> | undefined,
    styles: nodeData.styles as Record<string, Record<string, unknown>> | undefined,
  };
}

async function fetchScreenBaselineUrl(
  config: FigmaConfig,
  nodeId: string,
): Promise<string> {
  const apiId = toApiId(nodeId);
  const url = `${config.restApiBaseUrl}/images/${config.fileKey}?ids=${encodeURIComponent(apiId)}&scale=${config.exportScale}&format=png`;
  log('info', `Fetching baseline image URL for: ${apiId}`);

  const response = await withRetry('fetchScreenBaselineUrl', async () => {
    const res = await httpsGet(url, { 'X-Figma-Token': config.figmaToken });
    if (res.status === 429) {
      throw new Error('429 Rate Limited');
    }
    if (res.status !== 200) {
      throw new Error(`Figma Images API returned ${res.status}: ${res.body.slice(0, 200)}`);
    }
    return res;
  });

  const data = JSON.parse(response.body);
  const imageUrl = data.images?.[apiId];
  if (!imageUrl) {
    throw new Error(`No image URL returned for ${apiId}`);
  }
  return imageUrl;
}

async function fetchAssetImageUrls(
  config: FigmaConfig,
  assetNodeIds: string[],
): Promise<Record<string, string>> {
  if (assetNodeIds.length === 0) return {};

  const apiIds = assetNodeIds.map(toApiId);
  const idsParam = apiIds.join(',');
  const url = `${config.restApiBaseUrl}/images/${config.fileKey}?ids=${encodeURIComponent(idsParam)}&scale=${config.exportScale}&format=png`;
  log('info', `Fetching asset image URLs for ${apiIds.length} nodes`);

  const response = await withRetry('fetchAssetImageUrls', async () => {
    const res = await httpsGet(url, { 'X-Figma-Token': config.figmaToken });
    if (res.status === 429) {
      throw new Error('429 Rate Limited');
    }
    if (res.status !== 200) {
      throw new Error(`Figma Images API returned ${res.status}: ${res.body.slice(0, 200)}`);
    }
    return res;
  });

  const data = JSON.parse(response.body);
  return data.images || {};
}

// ---------------------------------------------------------------------------
// Figma Variables API
// ---------------------------------------------------------------------------

/**
 * Fetch local variables from the Figma Variables API.
 * Resolves variable IDs to names, types, and mode values.
 * Gracefully degrades: returns empty response if endpoint fails (e.g., non-Enterprise plan).
 */
async function fetchVariables(config: FigmaConfig): Promise<VariablesResponse> {
  const emptyResponse: VariablesResponse = { variables: {}, collections: {} };
  const url = `${config.restApiBaseUrl}/files/${config.fileKey}/variables/local`;
  log('info', `Fetching variables from: ${url}`);

  try {
    const response = await withRetry('fetchVariables', async () => {
      const res = await httpsGet(url, { 'X-Figma-Token': config.figmaToken });
      if (res.status === 403) {
        log('warn', 'Variables API returned 403 — likely requires Enterprise plan. Skipping variable resolution.');
        return null;
      }
      if (res.status === 429) {
        throw new Error('429 Rate Limited');
      }
      if (res.status !== 200) {
        log('warn', `Variables API returned ${res.status}: ${res.body.slice(0, 200)}. Skipping variable resolution.`);
        return null;
      }
      return res;
    }, 2, 5000); // fewer retries for optional endpoint

    if (!response) return emptyResponse;

    const data = JSON.parse(response.body);
    const meta = data.meta || data;
    const rawCollections = meta.variableCollections || {};
    const rawVariables = meta.variables || {};

    // Build collection lookup: id → { name, modes }
    const collections: VariablesResponse['collections'] = {};
    for (const [colId, col] of Object.entries(rawCollections) as Array<[string, Record<string, unknown>]>) {
      collections[colId] = {
        id: colId,
        name: (col.name as string) || '',
        modes: Array.isArray(col.modes) ? (col.modes as Array<{ modeId: string; name: string }>) : [],
      };
    }

    // Build resolved variables: id → { name, resolvedType, collectionName, valuesByMode }
    const variables: Record<string, ResolvedVariable> = {};
    for (const [varId, v] of Object.entries(rawVariables) as Array<[string, Record<string, unknown>]>) {
      const collectionId = (v.variableCollectionId as string) || '';
      const collectionName = collections[collectionId]?.name || '';
      variables[varId] = {
        id: varId,
        name: (v.name as string) || '',
        resolvedType: (v.resolvedType as string) || 'UNKNOWN',
        ...(v.description ? { description: v.description as string } : {}),
        collectionId,
        collectionName,
        valuesByMode: (v.valuesByMode as Record<string, unknown>) || {},
      };
    }

    log('info', `  Variables: ${Object.keys(variables).length} across ${Object.keys(collections).length} collections`);
    return { variables, collections };
  } catch (err) {
    log('warn', `Failed to fetch Figma variables: ${err}. Continuing without variable resolution.`);
    return emptyResponse;
  }
}

/** PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Validate that a buffer contains valid PNG data.
 * Checks: non-empty, has valid PNG header.
 */
function validatePngBuffer(buffer: Buffer, label: string): { valid: boolean; reason?: string } {
  if (buffer.length === 0) {
    return { valid: false, reason: `${label}: downloaded buffer is empty (0 bytes)` };
  }

  if (buffer.length < 67) {
    return { valid: false, reason: `${label}: buffer too small to be valid PNG (${buffer.length} bytes)` };
  }

  if (!buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    // Check if Figma returned a JSON error response instead of an image
    if (buffer[0] === 0x7b) { // '{' character
      const text = buffer.toString('utf-8', 0, Math.min(200, buffer.length));
      return { valid: false, reason: `${label}: received JSON instead of PNG — ${text.slice(0, 100)}` };
    }
    return { valid: false, reason: `${label}: invalid PNG header (not a PNG file)` };
  }

  return { valid: true };
}

/**
 * Validate that an on-disk image file is a real, non-corrupt PNG.
 */
function validateImageFile(filePath: string, label?: string): { valid: boolean; reason?: string } {
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

  if (stat.size < 67) {
    return { valid: false, reason: `${tag}: file too small to be valid PNG (${stat.size} bytes)` };
  }

  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(8);
    fs.readSync(fd, header, 0, 8, 0);
    fs.closeSync(fd);

    if (!header.subarray(0, 8).equals(PNG_MAGIC)) {
      if (header[0] === 0x7b) {
        return { valid: false, reason: `${tag}: file contains JSON, not PNG (likely API error)` };
      }
      return { valid: false, reason: `${tag}: invalid PNG header` };
    }
  } catch {
    return { valid: false, reason: `${tag}: cannot read file header` };
  }

  return { valid: true };
}

async function downloadImage(imageUrl: string, destPath: string): Promise<void> {
  await withRetry(`download ${path.basename(destPath)}`, async () => {
    const res = await httpsGetBuffer(imageUrl);
    if (res.status !== 200) {
      throw new Error(`Image download returned ${res.status}`);
    }

    // Validate the buffer is a real PNG before writing to disk
    const check = validatePngBuffer(res.buffer, path.basename(destPath));
    if (!check.valid) {
      throw new Error(`Downloaded image is not valid PNG: ${check.reason}`);
    }

    fs.writeFileSync(destPath, res.buffer);

    // Post-write verification: confirm the file was written correctly
    const diskCheck = validateImageFile(destPath, path.basename(destPath));
    if (!diskCheck.valid) {
      throw new Error(`Written file failed validation: ${diskCheck.reason}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Node Processing
// ---------------------------------------------------------------------------

function shouldSkipNode(
  node: Record<string, unknown>,
  config: FigmaConfig,
  rootBboxY: number,
): boolean {
  // Skip known system nodes
  const name = (node.name as string) || '';
  if (SKIP_NAME_PATTERN.test(name)) return true;

  // Skip nodes far below the fold (relative to root node's canvas position)
  // Use 8x design height to include all scrollable content (terms, privacy, long forms)
  // while filtering truly off-screen elements (e.g., hidden layers far below the artboard).
  const bbox = node.absoluteBoundingBox as { x: number; y: number; width: number; height: number } | undefined;
  if (bbox && (bbox.y - rootBboxY) > config.baseDesignHeight * 8) return true;

  return false;
}

function processFills(rawFills: unknown[]): BlueprintFill[] {
  if (!Array.isArray(rawFills)) return [];
  return rawFills.map((fill: any) => {
    const result: BlueprintFill = {
      type: (fill.type as string) || 'SOLID',
      visible: fill.visible !== false,
    };

    // Per-fill blend mode (skip NORMAL — it's the default)
    const blendMode = fill.blendMode as string | undefined;
    if (blendMode && blendMode !== 'NORMAL' && blendMode !== 'PASS_THROUGH') {
      result.blendMode = blendMode;
    }

    // SOLID fill
    if (fill.type === 'SOLID' && fill.color) {
      const color = fill.color as { r: number; g: number; b: number; a?: number };
      result.color = figmaColorToHex(color);
      result.opacity = (fill.opacity as number) ?? 1;
    }

    // IMAGE fill
    if (fill.type === 'IMAGE') {
      result.imageRef = (fill.imageRef as string) || undefined;
      result.scaleMode = (fill.scaleMode as string) || undefined;
      result.opacity = (fill.opacity as number) ?? 1;

      // Image transform matrix (rotation, scale, position within node)
      const imageTransform = fill.imageTransform as number[][] | undefined;
      if (imageTransform && Array.isArray(imageTransform)) {
        result.imageTransform = imageTransform;
      }

      // Image filters (exposure, contrast, saturation, etc.)
      const filters = fill.filters as Record<string, number> | undefined;
      if (filters) {
        const hasNonDefault = Object.values(filters).some((v) => v !== 0);
        if (hasNonDefault) {
          result.imageFilters = {
            exposure: filters.exposure || undefined,
            contrast: filters.contrast || undefined,
            saturation: filters.saturation || undefined,
            temperature: filters.temperature || undefined,
            tint: filters.tint || undefined,
            highlights: filters.highlights || undefined,
            shadows: filters.shadows || undefined,
          };
        }
      }
    }

    // GRADIENT fills (LINEAR, RADIAL, ANGULAR, DIAMOND)
    if (typeof fill.type === 'string' && fill.type.startsWith('GRADIENT_')) {
      const rawStops = fill.gradientStops as Array<{ position: number; color: { r: number; g: number; b: number; a?: number } }>;
      if (Array.isArray(rawStops)) {
        result.gradientStops = rawStops.map((stop: any) => ({
          color: figmaColorToHexAlpha(stop.color),
          position: stop.position,
          opacity: stop.color.a,
          ...(stop.boundVariables && Object.keys(stop.boundVariables).length > 0
            ? { boundVariables: stop.boundVariables }
            : {}),
        }));
      }
      const rawHandles = fill.gradientHandlePositions as Array<{ x: number; y: number }>;
      if (Array.isArray(rawHandles)) {
        result.gradientHandlePositions = rawHandles;
      }
      result.opacity = (fill.opacity as number) ?? 1;
    }

    // Figma Variable bindings on this fill (authoritative design token reference)
    const fillBoundVars = fill.boundVariables as Record<string, unknown> | undefined;
    if (fillBoundVars && Object.keys(fillBoundVars).length > 0) {
      result.boundVariables = fillBoundVars;
    }

    return result;
  });
}

function processStrokes(rawStrokes: unknown[], node: Record<string, unknown>): BlueprintStroke[] {
  if (!Array.isArray(rawStrokes)) return [];
  const weight = (node.strokeWeight as number) ?? 0;
  const align = (node.strokeAlign as string) || 'INSIDE';
  const cap = (node.strokeCap as string) || undefined;
  const join = (node.strokeJoin as string) || undefined;
  const dashPattern = node.strokeDashes as number[] | undefined;

  return rawStrokes
    .map((s: any) => {
      const color = s.color as { r: number; g: number; b: number; a?: number };
      const strokeOpacity = s.opacity as number | undefined;
      const strokeBlendMode = s.blendMode as string | undefined;
      return {
        color: color ? figmaColorToHex(color) : '#000000',
        weight,
        visible: s.visible !== false,
        align: align || undefined,
        cap: cap || undefined,
        join: join || undefined,
        dashPattern: dashPattern || undefined,
        ...(strokeOpacity !== undefined && strokeOpacity !== 1 ? { opacity: strokeOpacity } : {}),
        ...(strokeBlendMode && strokeBlendMode !== 'NORMAL' && strokeBlendMode !== 'PASS_THROUGH'
          ? { blendMode: strokeBlendMode } : {}),
      };
    });
}

function processEffects(rawEffects: unknown[]): BlueprintEffect[] {
  if (!Array.isArray(rawEffects)) return [];
  return rawEffects
    .map((e: any) => {
      const color = e.color as { r: number; g: number; b: number; a?: number } | undefined;
      const offset = e.offset as { x: number; y: number } | undefined;
      const effectBlendMode = e.blendMode as string | undefined;
      const showShadowBehindNode = e.showShadowBehindNode as boolean | undefined;
      return {
        type: (e.type as string) || 'UNKNOWN',
        visible: e.visible !== false,
        color: color ? figmaColorToHexAlpha(color) : undefined,
        offset: offset ? { x: offset.x, y: offset.y } : undefined,
        blur: (e.radius as number) || undefined,
        spread: (e.spread as number) || undefined,
        ...(effectBlendMode && effectBlendMode !== 'NORMAL' && effectBlendMode !== 'PASS_THROUGH'
          ? { blendMode: effectBlendMode } : {}),
        ...(showShadowBehindNode === true ? { showShadowBehindNode: true } : {}),
      };
    });
}

function processBorderRadius(
  node: Record<string, unknown>,
): number | { tl: number; tr: number; br: number; bl: number } {
  const individual = node.rectangleCornerRadii as number[] | undefined;
  if (Array.isArray(individual) && individual.length === 4) {
    // Check if all corners are the same
    if (individual[0] === individual[1] && individual[1] === individual[2] && individual[2] === individual[3]) {
      return individual[0];
    }
    return {
      tl: individual[0],
      tr: individual[1],
      br: individual[2],
      bl: individual[3],
    };
  }
  return (node.cornerRadius as number) ?? 0;
}

function processLayout(node: Record<string, unknown>): BlueprintLayout | undefined {
  const type = node.type as string;
  if (!['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET'].includes(type)) {
    return undefined;
  }

  const layoutMode = node.layoutMode as string | undefined;
  const direction: 'row' | 'column' | 'none' =
    layoutMode === 'HORIZONTAL' ? 'row' :
    layoutMode === 'VERTICAL' ? 'column' :
    'none';

  const primaryMap: Record<string, string> = {
    MIN: 'flex-start',
    CENTER: 'center',
    MAX: 'flex-end',
    SPACE_BETWEEN: 'space-between',
  };
  const counterMap: Record<string, string> = {
    MIN: 'flex-start',
    CENTER: 'center',
    MAX: 'flex-end',
  };

  const primary = node.primaryAxisAlignItems as string | undefined;
  const counter = node.counterAxisAlignItems as string | undefined;

  const layoutObj: BlueprintLayout = {
    direction,
    justifyContent: primary ? (primaryMap[primary] || 'flex-start') : 'flex-start',
    alignItems: counter ? (counterMap[counter] || 'flex-start') : 'flex-start',
    gap: (node.itemSpacing as number) ?? 0,
    padding: {
      top: (node.paddingTop as number) ?? 0,
      right: (node.paddingRight as number) ?? 0,
      bottom: (node.paddingBottom as number) ?? 0,
      left: (node.paddingLeft as number) ?? 0,
    },
    wrap: (node.layoutWrap as string) || 'NO_WRAP',
    sizingH: (node.layoutSizingHorizontal as string) || 'FIXED',
    sizingV: (node.layoutSizingVertical as string) || 'FIXED',
  };

  // Wrapped layout properties (only relevant when wrap !== NO_WRAP)
  const wrap = layoutObj.wrap;
  if (wrap && wrap !== 'NO_WRAP') {
    const counterContent = node.counterAxisAlignContent as string | undefined;
    if (counterContent) {
      layoutObj.counterAxisAlignContent = counterContent;
    }
    const counterSpacing = node.counterAxisSpacing as number | undefined;
    if (counterSpacing !== undefined && counterSpacing !== 0) {
      layoutObj.counterAxisSpacing = counterSpacing;
    }
  }

  // Z-ordering of auto-layout children
  const reverseZIndex = node.itemReverseZIndex as boolean | undefined;
  if (reverseZIndex === true) {
    layoutObj.itemReverseZIndex = true;
  }

  return layoutObj;
}

// Capture parent-level axis sizing modes (separate from processLayout to keep it on BlueprintNode)
function extractAxisSizingModes(node: Record<string, unknown>, blueprintNode: BlueprintNode): void {
  const primaryAxisSizingMode = node.primaryAxisSizingMode as string | undefined;
  if (primaryAxisSizingMode && primaryAxisSizingMode !== 'AUTO') {
    blueprintNode.primaryAxisSizingMode = primaryAxisSizingMode;
  }
  const counterAxisSizingMode = node.counterAxisSizingMode as string | undefined;
  if (counterAxisSizingMode && counterAxisSizingMode !== 'AUTO') {
    blueprintNode.counterAxisSizingMode = counterAxisSizingMode;
  }
}

function processTypography(node: Record<string, unknown>): BlueprintTypography | undefined {
  if (node.type !== 'TEXT') return undefined;

  const style = (node.style as Record<string, unknown>) || {};
  const content = (node.characters as string) || '';
  const fontWeight = (style.fontWeight as number) ?? 400;

  // Resolve font style (italic detection)
  const isItalic = (style.italic as boolean) === true ||
    ((style.fontPostScriptName as string) || '').toLowerCase().includes('italic');
  const fontStyle = isItalic ? 'italic' : 'normal';

  // Resolve text alignment
  const hAlignMap: Record<string, string> = {
    LEFT: 'left',
    CENTER: 'center',
    RIGHT: 'right',
    JUSTIFIED: 'justify',
  };
  const textAlignH = (style.textAlignHorizontal as string) || 'LEFT';
  const textAlignV = ((style.textAlignVertical as string) || 'TOP').toLowerCase();

  // Resolve text decoration
  const decorationMap: Record<string, string> = {
    UNDERLINE: 'underline',
    STRIKETHROUGH: 'line-through',
  };
  const rawDecoration = (style.textDecoration as string) || 'NONE';

  // Resolve text transform / case
  const caseMap: Record<string, string> = {
    UPPER: 'uppercase',
    LOWER: 'lowercase',
    TITLE: 'capitalize',
  };
  const rawCase = (style.textCase as string) || 'ORIGINAL';

  // Resolve text color from fills
  let textColor = '#FFFFFF';
  const fills = node.fills as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(fills)) {
    const solidFill = fills.find((f) => f.type === 'SOLID' && f.visible !== false);
    if (solidFill && solidFill.color) {
      textColor = figmaColorToHex(solidFill.color as { r: number; g: number; b: number; a?: number });
    }
  }

  // Process character style overrides (spans)
  const spans: BlueprintTypographySpan[] = [];
  const overrides = node.characterStyleOverrides as number[] | undefined;
  const overrideTable = node.styleOverrideTable as Record<string, Record<string, unknown>> | undefined;

  if (Array.isArray(overrides) && overrideTable && overrides.length > 0) {
    let currentStyleId = overrides[0];
    let spanStart = 0;

    for (let i = 1; i <= overrides.length; i++) {
      const styleId = i < overrides.length ? overrides[i] : -1;
      if (styleId !== currentStyleId) {
        // End of a span
        if (currentStyleId !== 0) {
          const overrideStyle = overrideTable[String(currentStyleId)];
          if (overrideStyle) {
            const span: BlueprintTypographySpan = {
              start: spanStart,
              end: i,
            };

            // Extract overridden properties
            const sFills = overrideStyle.fills as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(sFills)) {
              const sFill = sFills.find((f) => f.type === 'SOLID' && f.visible !== false);
              if (sFill && sFill.color) {
                span.color = figmaColorToHex(sFill.color as { r: number; g: number; b: number; a?: number });
              }
            }
            if (overrideStyle.fontWeight !== undefined) {
              span.fontWeight = overrideStyle.fontWeight as number;
            }
            if (overrideStyle.fontPostScriptName || overrideStyle.fontFamily) {
              const ow = (overrideStyle.fontWeight as number) || fontWeight;
              span.fontFamily = resolveFontFamily(ow, overrideStyle.fontFamily as string | undefined, overrideStyle.fontPostScriptName as string | undefined);
            }
            if (overrideStyle.fontSize !== undefined) {
              span.fontSize = overrideStyle.fontSize as number;
            }
            if (overrideStyle.letterSpacing !== undefined) {
              span.letterSpacing = overrideStyle.letterSpacing as number;
            }
            if (overrideStyle.textDecoration) {
              span.textDecoration = decorationMap[overrideStyle.textDecoration as string] || undefined;
            }
            if (overrideStyle.lineHeightPx !== undefined) {
              span.lineHeight = overrideStyle.lineHeightPx as number;
            }
            // Font style (italic) in span overrides
            const spanItalic = (overrideStyle.italic as boolean) === true ||
              ((overrideStyle.fontPostScriptName as string) || '').toLowerCase().includes('italic');
            if (spanItalic) {
              span.fontStyle = 'italic';
            }
            // Text case in span overrides
            if (overrideStyle.textCase) {
              const spanCase = caseMap[overrideStyle.textCase as string];
              if (spanCase) {
                span.textCase = spanCase;
              }
            }
            // Hyperlink in span overrides
            const hyperlink = overrideStyle.hyperlink as { type: string; url?: string; nodeID?: string } | undefined;
            if (hyperlink) {
              span.hyperlink = hyperlink;
            }
            // OpenType flags in span overrides
            const spanOTFlags = overrideStyle.opentypeFlags as Record<string, number> | undefined;
            if (spanOTFlags && Object.keys(spanOTFlags).length > 0) {
              span.opentypeFlags = spanOTFlags;
            }

            spans.push(span);
          }
        }
        spanStart = i;
        currentStyleId = styleId;
      }
    }
  }

  const result: BlueprintTypography = {
    content,
    fontSize: (style.fontSize as number) ?? 16,
    lineHeight: (style.lineHeightPx as number) ?? 24,
    fontWeight,
    fontFamily: resolveFontFamily(fontWeight, style.fontFamily as string | undefined, style.fontPostScriptName as string | undefined),
    fontStyle,
    letterSpacing: (style.letterSpacing as number) ?? 0,
    textAlign: hAlignMap[textAlignH] || 'left',
    textAlignVertical: textAlignV,
    textDecoration: decorationMap[rawDecoration] || 'none',
    textTransform: caseMap[rawCase] || 'none',
    paragraphSpacing: (style.paragraphSpacing as number) ?? 0,
    textAutoResize: (style.textAutoResize as string) || 'NONE',
    color: textColor,
    spans,
  };

  // Line height unit (informational — helps understand if lineHeight is px or %)
  const lineHeightUnit = style.lineHeightUnit as string | undefined;
  if (lineHeightUnit && lineHeightUnit !== 'INTRINSIC') {
    result.lineHeightUnit = lineHeightUnit;
  }

  // Paragraph indent (first-line indent)
  const paragraphIndent = style.paragraphIndent as number | undefined;
  if (paragraphIndent && paragraphIndent > 0) {
    result.paragraphIndent = paragraphIndent;
  }

  // Text truncation (DISABLED | ENDING)
  const textTruncation = node.textTruncation as string | undefined;
  if (textTruncation && textTruncation !== 'DISABLED') {
    result.textTruncation = textTruncation; // ENDING → ellipsizeMode: 'tail'
  }

  // Max lines (used with truncation for numberOfLines)
  const maxLines = node.maxLines as number | undefined;
  if (maxLines !== undefined && maxLines > 0) {
    result.maxLines = maxLines;
  }

  // OpenType flags (ligatures, stylistic sets, etc.)
  const opentypeFlags = style.opentypeFlags as Record<string, number> | undefined;
  if (opentypeFlags && Object.keys(opentypeFlags).length > 0) {
    result.openTypeFlags = opentypeFlags;
  }

  // Raw PostScript font name (for debugging font resolution)
  const fontPSName = style.fontPostScriptName as string | undefined;
  if (fontPSName) {
    result.fontPostScriptName = fontPSName;
  }

  // Whole-text hyperlink (when entire text node is a link)
  const hyperlink = style.hyperlink as { type: string; url?: string; nodeID?: string } | undefined;
  if (hyperlink) {
    result.hyperlink = hyperlink;
  }

  // Line height as percentage (informational, alongside resolved px value)
  const lineHeightPercent = style.lineHeightPercentFontSize as number | undefined;
  if (lineHeightPercent !== undefined && lineHeightPercent > 0) {
    result.lineHeightPercent = lineHeightPercent;
  }

  // Inherited text style reference
  const inheritTextStyleId = style.inheritTextStyleId as string | undefined;
  if (inheritTextStyleId) {
    result.inheritTextStyleId = inheritTextStyleId;
  }

  // Per-line indentation values (for indented text/lists)
  const lineIndentations = node.lineIndentations as number[] | undefined;
  if (Array.isArray(lineIndentations) && lineIndentations.some((v) => v > 0)) {
    result.lineIndentations = lineIndentations;
  }

  // Per-line types (NONE, ORDERED, UNORDERED — list bullets/numbers)
  const lineTypes = node.lineTypes as string[] | undefined;
  if (Array.isArray(lineTypes) && lineTypes.some((v) => v !== 'NONE')) {
    result.lineTypes = lineTypes;
  }

  // Per-character-range fills (gradient text, multi-color text — different from character fills via styleOverrideTable)
  const textRangeFills = node.textRangeFills as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(textRangeFills) && textRangeFills.length > 0) {
    result.textRangeFills = textRangeFills;
  }

  return result;
}

function processVectorPaths(node: Record<string, unknown>): BlueprintVectorPath[] | undefined {
  const type = node.type as string;
  if (type !== 'VECTOR' && type !== 'BOOLEAN_OPERATION') return undefined;

  const fillGeometry = node.fillGeometry as Array<{ path: string; windingRule: string }> | undefined;
  if (!Array.isArray(fillGeometry) || fillGeometry.length === 0) return undefined;

  return fillGeometry.map((fg) => ({
    path: fg.path || '',
    windingRule: fg.windingRule || 'NONZERO',
  }));
}

function processStrokeGeometry(node: Record<string, unknown>): BlueprintVectorPath[] | undefined {
  const strokeGeometry = node.strokeGeometry as Array<{ path: string; windingRule: string }> | undefined;
  if (!Array.isArray(strokeGeometry) || strokeGeometry.length === 0) return undefined;

  return strokeGeometry.map((sg) => ({
    path: sg.path || '',
    windingRule: sg.windingRule || 'NONZERO',
  }));
}

function processArcData(node: Record<string, unknown>): BlueprintArcData | undefined {
  if (node.type !== 'ELLIPSE') return undefined;

  const arcData = node.arcData as { startingAngle: number; endingAngle: number; innerRadius: number } | undefined;
  if (!arcData) return undefined;

  // Skip if it's a full circle with no inner radius (the default — nothing special to capture)
  const isFullCircle = arcData.startingAngle === 0 && Math.abs(arcData.endingAngle - 2 * Math.PI) < 0.001;
  const hasInnerRadius = arcData.innerRadius > 0;
  if (isFullCircle && !hasInnerRadius) return undefined;

  return {
    startingAngle: arcData.startingAngle,
    endingAngle: arcData.endingAngle,
    innerRadius: arcData.innerRadius,
  };
}

function processInteractions(node: Record<string, unknown>): BlueprintInteraction[] | undefined {
  // Figma REST API uses `interactions` (not `reactions`). Fall back to `reactions` for compatibility.
  const rawInteractions = (node.interactions || node.reactions) as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(rawInteractions) || rawInteractions.length === 0) return undefined;

  const processed: BlueprintInteraction[] = [];
  for (const interaction of rawInteractions) {
    const trigger = interaction.trigger as Record<string, unknown> | undefined;
    if (!trigger) continue;

    // Figma REST API uses `actions` (array), not `action` (singular)
    let rawActions = interaction.actions as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(rawActions)) {
      // Fall back to singular `action` for compatibility
      const singleAction = interaction.action as Record<string, unknown> | undefined;
      rawActions = singleAction ? [singleAction] : [];
    }
    if (rawActions.length === 0) continue;

    const actions: BlueprintInteractionAction[] = [];
    for (const action of rawActions) {
      const transition = action.transition as Record<string, unknown> | undefined;
      const easing = transition?.easing as Record<string, unknown> | undefined;

      actions.push({
        type: (action.type as string) || 'NODE',
        ...(action.destinationId ? { destinationId: action.destinationId as string } : {}),
        ...(action.url ? { url: action.url as string } : {}),
        ...(action.navigation ? { navigation: action.navigation as string } : {}),
        ...(action.preserveScrollPosition === true ? { preserveScrollPosition: true } : {}),
        ...(action.overlayRelativePosition ? {
          overlayRelativePosition: action.overlayRelativePosition as { x: number; y: number },
        } : {}),
        ...(transition ? {
          transition: {
            type: (transition.type as string) || 'DISSOLVE',
            duration: (transition.duration as number) || 0.3,
            easing: {
              type: (easing?.type as string) || 'EASE_IN_AND_OUT',
              ...(easing?.easingFunctionCubicBezier ? {
                easingFunctionCubicBezier: easing.easingFunctionCubicBezier as { x1: number; y1: number; x2: number; y2: number },
              } : {}),
            },
          },
        } : {}),
      });
    }

    processed.push({
      trigger: {
        type: (trigger.type as string) || 'ON_CLICK',
        ...(trigger.delay !== undefined ? { delay: trigger.delay as number } : {}),
        ...(trigger.timeout !== undefined ? { timeout: trigger.timeout as number } : {}),
      },
      actions,
    });
  }

  return processed.length > 0 ? processed : undefined;
}

// ---------------------------------------------------------------------------
// Component Auto-Mapping
// ---------------------------------------------------------------------------

interface RnMapping {
  rnComponent: string;
  rnProps?: Record<string, unknown>;
}

function autoMapComponent(
  node: Record<string, unknown>,
  children: Record<string, unknown>[],
): RnMapping | null {
  const type = node.type as string;
  const name = ((node.name as string) || '').toLowerCase();

  // TEXT node -> Text component
  if (type === 'TEXT') {
    return { rnComponent: 'Text' };
  }

  // Check children for pattern matching
  if (['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP'].includes(type) && children.length > 0) {
    const childNames = children.map((c) => ((c.name as string) || '').toLowerCase());
    const childTypes = children.map((c) => (c.type as string));

    // Phone input: frame with "+91" text child
    const hasCountryCode = childNames.some((n) => n.includes('+91')) ||
      children.some((c) => ((c.characters as string) || '').includes('+91'));
    if (hasCountryCode) {
      return { rnComponent: 'PhoneInput' };
    }

    // OTP input: frame with 4-6 equal-width child frames
    const frameChildren = children.filter((c) =>
      ['FRAME', 'COMPONENT', 'INSTANCE'].includes(c.type as string)
    );
    if (frameChildren.length >= 4 && frameChildren.length <= 6) {
      const widths = frameChildren.map((c) => {
        const bbox = c.absoluteBoundingBox as { width: number } | undefined;
        return bbox ? bbox.width : 0;
      });
      const allSameWidth = widths.every((w) => Math.abs(w - widths[0]) < 2);
      if (allSameWidth && widths[0] > 0) {
        return { rnComponent: 'OTPInput', rnProps: { length: frameChildren.length } };
      }
    }

    // TextInput: frame with label text + input/value text
    const hasLabel = childNames.some((n) => n.includes('label'));
    const hasInput = childNames.some((n) => n.includes('input') || n.includes('value') || n.includes('placeholder'));
    if (hasLabel && hasInput) {
      return { rnComponent: 'TextInput' };
    }

    // PrimaryButton: frame with gradient fill + TEXT child
    const fills = node.fills as Array<Record<string, unknown>> | undefined;
    const hasGradient = Array.isArray(fills) && fills.some(
      (f) => typeof f.type === 'string' && f.type.startsWith('GRADIENT_') && f.visible !== false,
    );
    const hasTextChild = childTypes.some((t) => t === 'TEXT');
    if (hasGradient && hasTextChild) {
      return { rnComponent: 'PrimaryButton' };
    }
  }

  return null;
}

/** Check if this is the top-level content wrapper. */
function isScreenWrapper(node: Record<string, unknown>, depth: number): boolean {
  if (depth !== 0) return false;
  const type = node.type as string;
  return ['FRAME', 'COMPONENT'].includes(type);
}

// ---------------------------------------------------------------------------
// Tree Traversal & Node Extraction
// ---------------------------------------------------------------------------

function traverseNodeTree(
  node: Record<string, unknown>,
  config: FigmaConfig,
  parentId: string | null,
  parentBbox: { x: number; y: number } | null,
  depth: number,
  allNodes: BlueprintNode[],
  assetNodeIds: Set<string>,
  rootBboxY: number,
): void {
  if (shouldSkipNode(node, config, rootBboxY)) return;

  const nodeId = node.id as string;
  const bbox = node.absoluteBoundingBox as { x: number; y: number; width: number; height: number } | undefined;
  const rotation = (node.rotation as number) ?? 0;

  // Compute geometry relative to parent (or absolute for root)
  let relX = 0;
  let relY = 0;
  let width = 0;
  let height = 0;

  if (bbox) {
    if (parentBbox) {
      relX = Math.round((bbox.x - parentBbox.x) * 100) / 100;
      relY = Math.round((bbox.y - parentBbox.y) * 100) / 100;
    } else {
      // Root node — use 0,0 as origin (absolute canvas coords are irrelevant)
      relX = 0;
      relY = 0;
    }
    width = bbox.width;
    height = bbox.height;
  }

  // Process fills and detect image assets
  const fills = processFills(node.fills as unknown[] || []);
  for (const fill of fills) {
    if (fill.imageRef || (fill.type.startsWith('GRADIENT_') && fill.visible)) {
      assetNodeIds.add(nodeId);
    }
  }

  // Process children first to enable auto-mapping
  const rawChildren = (node.children as Record<string, unknown>[]) || [];
  const childIds = rawChildren.map((c) => c.id as string);

  // Auto-map component
  const mapping = autoMapComponent(node, rawChildren);
  const isScreen = isScreenWrapper(node, depth);

  // Build the blueprint node
  const blueprintNode: BlueprintNode = {
    id: nodeId,
    parentId,
    name: (node.name as string) || '',
    type: (node.type as string) || 'UNKNOWN',
    depth,
    visible: node.visible !== false,
    geometry: {
      x: relX,
      y: relY,
      width,
      height,
      rotation,
    },
    opacity: (node.opacity as number) ?? 1,
    fills,
    strokes: processStrokes(node.strokes as unknown[] || [], node),
    effects: processEffects(node.effects as unknown[] || []),
    borderRadius: processBorderRadius(node),
    clipsContent: (node.clipsContent as boolean) ?? false,
  };

  // Individual stroke weights
  const isw = node.individualStrokeWeights as { top: number; right: number; bottom: number; left: number } | undefined;
  if (isw) {
    blueprintNode.individualStrokeWeights = isw;
  }

  // Top-level stroke properties
  const nodeStrokeWeight = node.strokeWeight as number | undefined;
  if (nodeStrokeWeight !== undefined && nodeStrokeWeight > 0) {
    blueprintNode.strokeWeight = nodeStrokeWeight;
  }
  const nodeStrokeAlign = node.strokeAlign as string | undefined;
  if (nodeStrokeAlign && nodeStrokeAlign !== 'INSIDE') {
    blueprintNode.strokeAlign = nodeStrokeAlign;
  }
  const nodeStrokeCap = node.strokeCap as string | undefined;
  if (nodeStrokeCap && nodeStrokeCap !== 'NONE') {
    blueprintNode.strokeCap = nodeStrokeCap;
  }
  const nodeStrokeJoin = node.strokeJoin as string | undefined;
  if (nodeStrokeJoin && nodeStrokeJoin !== 'MITER') {
    blueprintNode.strokeJoin = nodeStrokeJoin;
  }
  const nodeStrokeDashes = node.strokeDashes as number[] | undefined;
  if (Array.isArray(nodeStrokeDashes) && nodeStrokeDashes.length > 0) {
    blueprintNode.strokeDashes = nodeStrokeDashes;
  }

  // Layout (parent-level auto-layout properties)
  const layout = processLayout(node);
  if (layout) {
    blueprintNode.layout = layout;
  }

  // Parent-level axis sizing modes
  extractAxisSizingModes(node, blueprintNode);

  // Per-child auto-layout properties
  const layoutPositioning = node.layoutPositioning as string | undefined;
  if (layoutPositioning && layoutPositioning !== 'AUTO') {
    blueprintNode.layoutPositioning = layoutPositioning; // ABSOLUTE
  }
  const layoutAlign = node.layoutAlign as string | undefined;
  if (layoutAlign && layoutAlign !== 'INHERIT') {
    blueprintNode.layoutAlign = layoutAlign; // STRETCH, MIN, CENTER, MAX
  }
  const layoutGrow = node.layoutGrow as number | undefined;
  if (layoutGrow !== undefined && layoutGrow !== 0) {
    blueprintNode.layoutGrow = layoutGrow;
  }

  // Per-node sizing mode (how this node sizes itself within parent auto-layout)
  const sizingH = node.layoutSizingHorizontal as string | undefined;
  if (sizingH && sizingH !== 'FIXED') {
    blueprintNode.layoutSizingHorizontal = sizingH; // FILL | HUG
  }
  const sizingV = node.layoutSizingVertical as string | undefined;
  if (sizingV && sizingV !== 'FIXED') {
    blueprintNode.layoutSizingVertical = sizingV; // FILL | HUG
  }

  // Size constraints
  const minWidth = node.minWidth as number | undefined;
  if (minWidth !== undefined && minWidth > 0) {
    blueprintNode.minWidth = minWidth;
  }
  const maxWidth = node.maxWidth as number | undefined;
  if (maxWidth !== undefined && maxWidth < Infinity && maxWidth > 0) {
    blueprintNode.maxWidth = maxWidth;
  }
  const minHeight = node.minHeight as number | undefined;
  if (minHeight !== undefined && minHeight > 0) {
    blueprintNode.minHeight = minHeight;
  }
  const maxHeight = node.maxHeight as number | undefined;
  if (maxHeight !== undefined && maxHeight < Infinity && maxHeight > 0) {
    blueprintNode.maxHeight = maxHeight;
  }

  // Typography
  const typography = processTypography(node);
  if (typography) {
    blueprintNode.typography = typography;
  }

  // Vector paths (fill geometry)
  const vectorPaths = processVectorPaths(node);
  if (vectorPaths) {
    blueprintNode.vectorPaths = vectorPaths;
  }

  // Stroke geometry paths (complex stroked shapes)
  const strokePaths = processStrokeGeometry(node);
  if (strokePaths) {
    blueprintNode.strokePaths = strokePaths;
  }

  // Vector network (editable vertex/edge/region structure for VECTOR nodes)
  const vectorNetwork = node.vectorNetwork as Record<string, unknown> | undefined;
  if (vectorNetwork && Object.keys(vectorNetwork).length > 0) {
    blueprintNode.vectorNetwork = vectorNetwork;
  }

  // Ellipse-specific arc data
  const arcData = processArcData(node);
  if (arcData) {
    blueprintNode.arcData = arcData;
  }

  // Component / Instance
  if (node.componentId) {
    blueprintNode.componentId = node.componentId as string;
  }
  if (node.componentProperties) {
    blueprintNode.componentProperties = node.componentProperties as Record<string, unknown>;
  }
  // Uniform scale factor (INSTANCE nodes)
  const uniformScaleFactor = node.uniformScaleFactor as number | undefined;
  if (uniformScaleFactor !== undefined && uniformScaleFactor !== 1) {
    blueprintNode.uniformScaleFactor = uniformScaleFactor;
  }

  // Prototyping interactions (Figma REST API field: `interactions`, not `reactions`)
  const interactions = processInteractions(node);
  if (interactions) {
    blueprintNode.interactions = interactions;
  }

  // Legacy prototyping properties (node-level)
  const transitionNodeID = node.transitionNodeID as string | undefined;
  if (transitionNodeID) {
    blueprintNode.transitionNodeID = transitionNodeID;
  }
  const transitionDuration = node.transitionDuration as number | undefined;
  if (transitionDuration !== undefined && transitionDuration > 0) {
    blueprintNode.transitionDuration = transitionDuration;
  }
  const transitionEasing = node.transitionEasing as Record<string, unknown> | undefined;
  if (transitionEasing) {
    blueprintNode.transitionEasing = transitionEasing;
  }

  // Component property references (wiring sublayer props to parent component properties)
  const compPropRefs = node.componentPropertyReferences as Record<string, string> | undefined;
  if (compPropRefs && Object.keys(compPropRefs).length > 0) {
    blueprintNode.componentPropertyReferences = compPropRefs;
  }

  // Constraints (responsive sizing)
  const constraints = node.constraints as { horizontal?: string; vertical?: string } | undefined;
  if (constraints && (constraints.horizontal || constraints.vertical)) {
    blueprintNode.constraints = {
      horizontal: constraints.horizontal || 'LEFT',
      vertical: constraints.vertical || 'TOP',
    };
  }

  // Blend mode (skip NORMAL — it's the default)
  const blendMode = node.blendMode as string | undefined;
  if (blendMode && blendMode !== 'NORMAL' && blendMode !== 'PASS_THROUGH') {
    blueprintNode.blendMode = blendMode;
  }

  // Corner smoothing (iOS superellipse, 0.0–1.0, ~0.6 = iOS native)
  const cornerSmoothing = node.cornerSmoothing as number | undefined;
  if (cornerSmoothing !== undefined && cornerSmoothing > 0) {
    blueprintNode.cornerSmoothing = cornerSmoothing;
  }

  // Absolute render bounds (actual visible area after clips/rotations; null = fully clipped)
  const absoluteRenderBounds = node.absoluteRenderBounds as { x: number; y: number; width: number; height: number } | null | undefined;
  if (absoluteRenderBounds !== undefined) {
    blueprintNode.absoluteRenderBounds = absoluteRenderBounds;
  }

  // Absolute bounding box
  const absoluteBoundingBox = node.absoluteBoundingBox as { x: number; y: number; width: number; height: number } | undefined;
  if (absoluteBoundingBox) {
    blueprintNode.absoluteBoundingBox = absoluteBoundingBox;
  }

  // Scroll behavior (SCROLLS | FIXED | STICKY | FIXED_WHEN_CHILD_OF_SCROLLING_FRAME)
  const scrollBehavior = node.scrollBehavior as string | undefined;
  if (scrollBehavior) {
    blueprintNode.scrollBehavior = scrollBehavior;
  }

  // Preserve aspect ratio
  const preserveRatio = node.preserveRatio as boolean | undefined;
  if (preserveRatio === true) {
    blueprintNode.preserveRatio = true;
  }
  const targetAspectRatio = node.targetAspectRatio as number | undefined;
  if (targetAspectRatio !== undefined && targetAspectRatio > 0) {
    blueprintNode.targetAspectRatio = targetAspectRatio;
  }

  // Size before rotation/scale (only available with geometry=paths parameter)
  const sizeVec = node.size as { x: number; y: number } | undefined;
  if (sizeVec && (sizeVec.x > 0 || sizeVec.y > 0)) {
    blueprintNode.size = sizeVec;
  }

  // Relative transform matrix (only available with geometry=paths parameter)
  const relTransform = node.relativeTransform as number[][] | undefined;
  if (relTransform && Array.isArray(relTransform) && relTransform.length === 2) {
    blueprintNode.relativeTransform = relTransform;
  }

  // Mask properties
  const isMask = node.isMask as boolean | undefined;
  if (isMask === true) {
    blueprintNode.isMask = true;
  }
  const isMaskOutline = node.isMaskOutline as boolean | undefined;
  if (isMaskOutline === true) {
    blueprintNode.isMaskOutline = true;
  }
  const maskType = node.maskType as string | undefined;
  if (maskType) {
    blueprintNode.maskType = maskType;
  }

  // Lock / fixed state
  const locked = node.locked as boolean | undefined;
  if (locked === true) {
    blueprintNode.locked = true;
  }
  const isFixed = node.isFixed as boolean | undefined;
  if (isFixed === true) {
    blueprintNode.isFixed = true;
  }

  // Export settings
  const exportSettings = node.exportSettings as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(exportSettings) && exportSettings.length > 0) {
    blueprintNode.exportSettings = exportSettings.map((s) => ({
      suffix: (s.suffix as string) || '',
      format: (s.format as string) || 'PNG',
      constraint: (s.constraint as { type: string; value: number }) || { type: 'SCALE', value: 1 },
    }));
  }

  // Figma Variable bindings (design tokens — authoritative source)
  const boundVariables = node.boundVariables as Record<string, unknown> | undefined;
  if (boundVariables && Object.keys(boundVariables).length > 0) {
    blueprintNode.boundVariables = boundVariables;
  }

  // Style references (named Figma styles: fill, text, effect, grid)
  const styles = node.styles as Record<string, string> | undefined;
  if (styles && Object.keys(styles).length > 0) {
    blueprintNode.styleReferences = styles;
  }

  // Dev status
  const devStatus = node.devStatus as { type: string; description?: string } | undefined;
  if (devStatus) {
    blueprintNode.devStatus = devStatus;
  }

  // Layout grids (design overlay guides)
  const layoutGrids = node.layoutGrids as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(layoutGrids) && layoutGrids.length > 0) {
    blueprintNode.layoutGrids = layoutGrids;
  }

  // Instance overrides (which fields differ from main component)
  const overriddenFields = node.overriddenFields as string[] | undefined;
  if (Array.isArray(overriddenFields) && overriddenFields.length > 0) {
    blueprintNode.overriddenFields = overriddenFields;
  }
  const overridesArr = node.overrides as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(overridesArr) && overridesArr.length > 0) {
    blueprintNode.overrides = overridesArr;
  }

  // Boolean operation type (UNION, INTERSECT, SUBTRACT, EXCLUDE)
  const booleanOp = node.booleanOperation as string | undefined;
  if (booleanOp) {
    blueprintNode.booleanOperation = booleanOp;
  }

  // Show shadow behind node content
  const showShadowBehindNode = node.showShadowBehindNode as boolean | undefined;
  if (showShadowBehindNode === true) {
    blueprintNode.showShadowBehindNode = true;
  }

  // Instance exposure (INSTANCE nodes)
  const isExposedInstance = node.isExposedInstance as boolean | undefined;
  if (isExposedInstance === true) {
    blueprintNode.isExposedInstance = true;
  }
  const exposedInstances = node.exposedInstances as string[] | undefined;
  if (Array.isArray(exposedInstances) && exposedInstances.length > 0) {
    blueprintNode.exposedInstances = exposedInstances;
  }

  // Component property definitions (COMPONENT / COMPONENT_SET nodes)
  const compPropDefs = node.componentPropertyDefinitions as Record<string, unknown> | undefined;
  if (compPropDefs && Object.keys(compPropDefs).length > 0) {
    blueprintNode.componentPropertyDefinitions = compPropDefs;
  }

  // Overflow / scroll direction
  const overflowDirection = node.overflowDirection as string | undefined;
  if (overflowDirection && overflowDirection !== 'NONE') {
    blueprintNode.overflowDirection = overflowDirection;
  }

  // Strokes included in layout (box-sizing: border-box)
  const strokesIncludedInLayout = node.strokesIncludedInLayout as boolean | undefined;
  if (strokesIncludedInLayout === true) {
    blueprintNode.strokesIncludedInLayout = true;
  }

  // Stroke miter angle
  const strokeMiterAngle = node.strokeMiterAngle as number | undefined;
  if (strokeMiterAngle !== undefined && strokeMiterAngle !== 28.96) { // 28.96 is default
    blueprintNode.strokeMiterAngle = strokeMiterAngle;
  }

  // CSS Grid layout properties (layoutMode: GRID)
  const layoutMode = node.layoutMode as string | undefined;
  if (layoutMode === 'GRID') {
    const gridLayout: Record<string, unknown> = {};
    const gridRowCount = node.gridRowCount as number | undefined;
    if (gridRowCount) gridLayout.rowCount = gridRowCount;
    const gridColumnCount = node.gridColumnCount as number | undefined;
    if (gridColumnCount) gridLayout.columnCount = gridColumnCount;
    const gridRowGap = node.gridRowGap as number | undefined;
    if (gridRowGap) gridLayout.rowGap = gridRowGap;
    const gridColumnGap = node.gridColumnGap as number | undefined;
    if (gridColumnGap) gridLayout.columnGap = gridColumnGap;
    const gridColumnsSizing = node.gridColumnsSizing as string | undefined;
    if (gridColumnsSizing) gridLayout.columnsSizing = gridColumnsSizing;
    const gridRowsSizing = node.gridRowsSizing as string | undefined;
    if (gridRowsSizing) gridLayout.rowsSizing = gridRowsSizing;
    if (Object.keys(gridLayout).length > 0) {
      blueprintNode.gridLayout = gridLayout as BlueprintNode['gridLayout'];
    }
  }

  // Per-child CSS Grid placement
  const gridChildHAlign = node.gridChildHorizontalAlign as string | undefined;
  const gridChildVAlign = node.gridChildVerticalAlign as string | undefined;
  if ((gridChildHAlign && gridChildHAlign !== 'AUTO') || (gridChildVAlign && gridChildVAlign !== 'AUTO')) {
    blueprintNode.gridChildAlign = {
      ...(gridChildHAlign && gridChildHAlign !== 'AUTO' ? { horizontal: gridChildHAlign } : {}),
      ...(gridChildVAlign && gridChildVAlign !== 'AUTO' ? { vertical: gridChildVAlign } : {}),
    };
  }
  const gridRowSpan = node.gridRowSpan as number | undefined;
  const gridColumnSpan = node.gridColumnSpan as number | undefined;
  if ((gridRowSpan && gridRowSpan > 1) || (gridColumnSpan && gridColumnSpan > 1)) {
    blueprintNode.gridSpan = {
      ...(gridRowSpan && gridRowSpan > 1 ? { rows: gridRowSpan } : {}),
      ...(gridColumnSpan && gridColumnSpan > 1 ? { columns: gridColumnSpan } : {}),
    };
  }
  const gridRowAnchor = node.gridRowAnchorIndex as number | undefined;
  const gridColAnchor = node.gridColumnAnchorIndex as number | undefined;
  if ((gridRowAnchor && gridRowAnchor > 0) || (gridColAnchor && gridColAnchor > 0)) {
    blueprintNode.gridAnchor = {
      ...(gridRowAnchor && gridRowAnchor > 0 ? { row: gridRowAnchor } : {}),
      ...(gridColAnchor && gridColAnchor > 0 ? { column: gridColAnchor } : {}),
    };
  }

  // Fill override table (VECTOR nodes, only with geometry=paths)
  const fillOverrideTable = node.fillOverrideTable as Record<string, unknown> | undefined;
  if (fillOverrideTable && Object.keys(fillOverrideTable).length > 0) {
    blueprintNode.fillOverrideTable = fillOverrideTable;
  }

  // Variable width stroke points
  const variableWidthPoints = node.variableWidthPoints as Array<{ x: number; y: number }> | undefined;
  if (Array.isArray(variableWidthPoints) && variableWidthPoints.length > 0) {
    blueprintNode.variableWidthPoints = variableWidthPoints;
  }

  // Complex stroke properties (Jan 2026 — brush/dynamic strokes)
  // Skip default {"strokeType": "BASIC"} — only capture brush/dynamic strokes
  const complexStrokeProps = node.complexStrokeProperties as Record<string, unknown> | undefined;
  if (complexStrokeProps && Object.keys(complexStrokeProps).length > 0
    && !(Object.keys(complexStrokeProps).length === 1 && complexStrokeProps.strokeType === 'BASIC')) {
    blueprintNode.complexStrokeProperties = complexStrokeProps;
  }

  // Text path start data (Jan 2026 — TEXT_PATH nodes)
  const textPathStart = node.textPathStartData as Record<string, unknown> | undefined;
  if (textPathStart && Object.keys(textPathStart).length > 0) {
    blueprintNode.textPathStartData = textPathStart;
  }

  // Transform modifiers (Jan 2026 — TRANSFORM_GROUP nodes)
  const transformMods = node.transformModifiers as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(transformMods) && transformMods.length > 0) {
    blueprintNode.transformModifiers = transformMods;
  }

  // Auto-mapping
  if (isScreen) {
    blueprintNode.rnComponent = 'Screen';
  } else if (mapping) {
    blueprintNode.rnComponent = mapping.rnComponent;
    if (mapping.rnProps) {
      blueprintNode.rnProps = mapping.rnProps;
    }
  }

  // Child IDs
  if (childIds.length > 0) {
    blueprintNode.childIds = childIds;
  }

  allNodes.push(blueprintNode);

  // Recurse into children
  const currentBbox = bbox ? { x: bbox.x, y: bbox.y } : parentBbox;
  for (const child of rawChildren) {
    traverseNodeTree(child, config, nodeId, currentBbox, depth + 1, allNodes, assetNodeIds, rootBboxY);
  }
}

// ---------------------------------------------------------------------------
// Background Detection
// ---------------------------------------------------------------------------

interface BackgroundInfo {
  color: string;
  hasDottedPattern: boolean;
  backgroundShapeKey?: string;
  gradient?: {
    type: string;
    stops: Array<{ color: string; position: number }>;
  };
}

function detectBackground(
  rootNode: Record<string, unknown>,
  allNodes: BlueprintNode[],
): BackgroundInfo {
  let bgColor = '#131313'; // Default app background
  let hasDottedPattern = false;
  let backgroundShapeKey: string | undefined;
  let gradient: BackgroundInfo['gradient'] | undefined;

  // Check root node fills
  const rootFills = rootNode.fills as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(rootFills)) {
    const solidFill = rootFills.find((f) => f.type === 'SOLID' && f.visible !== false);
    if (solidFill && solidFill.color) {
      bgColor = figmaColorToHex(solidFill.color as { r: number; g: number; b: number });
    }

    const gradFill = rootFills.find(
      (f) => typeof f.type === 'string' && f.type.startsWith('GRADIENT_') && f.visible !== false,
    );
    if (gradFill) {
      const stops = gradFill.gradientStops as Array<{ position: number; color: { r: number; g: number; b: number } }>;
      if (Array.isArray(stops)) {
        gradient = {
          type: gradFill.type as string,
          stops: stops.map((s) => ({
            color: figmaColorToHex(s.color),
            position: s.position,
          })),
        };
      }
    }
  }

  // Check for dotted pattern in descendant names
  const screenName = ((rootNode.name as string) || '').toLowerCase();
  const dottedPatternNames = ['dotted', 'pattern', 'noise', 'texture'];
  for (const node of allNodes) {
    const name = node.name.toLowerCase();
    if (dottedPatternNames.some((p) => name.includes(p))) {
      hasDottedPattern = true;
    }
    // Background shape detection — screens with a "Background Shape" node
    // always use the DottedPattern overlay in the React Native implementation
    if (name.includes('background') && name.includes('shape')) {
      hasDottedPattern = true;
      if (screenName.includes('splash')) backgroundShapeKey = 'splash';
      else if (screenName.includes('carousel')) {
        // Try to detect carousel page from name
        const pageMatch = screenName.match(/carousel\s*(\d)/);
        backgroundShapeKey = pageMatch ? `carousel${pageMatch[1]}` : 'carousel1';
      }
      else if (screenName.includes('agreement')) backgroundShapeKey = 'agreement';
      else backgroundShapeKey = 'default';
    }
  }

  return { color: bgColor, hasDottedPattern, backgroundShapeKey, gradient };
}

// ---------------------------------------------------------------------------
// Design Token Mapping (post-processing)
// ---------------------------------------------------------------------------

interface TokensUsed {
  colors: Record<string, string>;
  typography: Record<string, string>;
  spacing: Record<string, string>;
  radius: Record<string, string>;
}

function buildTokensUsed(
  nodes: BlueprintNode[],
  tokens: DesignTokens,
): TokensUsed {
  const colors: Record<string, string> = {};
  const typography: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const radius: Record<string, string> = {};

  const seenColors = new Set<string>();
  const seenTypo = new Set<string>();
  const seenSpacing = new Set<number>();
  const seenRadius = new Set<number>();

  for (const node of nodes) {
    // Collect colors from fills, strokes, effects, and text
    for (const fill of node.fills) {
      if (fill.color) seenColors.add(fill.color);
      if (fill.gradientStops) {
        for (const stop of fill.gradientStops) {
          seenColors.add(stop.color);
        }
      }
    }
    for (const stroke of node.strokes) {
      seenColors.add(stroke.color);
    }
    for (const effect of node.effects) {
      if (effect.color) {
        // Strip alpha suffix for token lookup (only first 7 chars)
        const hex6 = effect.color.length > 7 ? effect.color.slice(0, 7) : effect.color;
        seenColors.add(hex6);
      }
    }
    if (node.typography) {
      seenColors.add(node.typography.color);
      for (const span of node.typography.spans) {
        if (span.color) seenColors.add(span.color);
      }
    }

    // Collect typography combos
    if (node.typography) {
      const t = node.typography;
      const key = `${Math.round(t.fontSize)}:${Math.round(t.lineHeight)}:${t.fontWeight}`;
      seenTypo.add(key);
    }

    // Collect spacing values from layout
    if (node.layout) {
      const l = node.layout;
      if (l.gap > 0) seenSpacing.add(l.gap);
      if (l.padding.top > 0) seenSpacing.add(l.padding.top);
      if (l.padding.right > 0) seenSpacing.add(l.padding.right);
      if (l.padding.bottom > 0) seenSpacing.add(l.padding.bottom);
      if (l.padding.left > 0) seenSpacing.add(l.padding.left);
    }

    // Collect radius values
    const br = node.borderRadius;
    if (typeof br === 'number' && br > 0) {
      seenRadius.add(br);
    } else if (typeof br === 'object') {
      if (br.tl > 0) seenRadius.add(br.tl);
      if (br.tr > 0) seenRadius.add(br.tr);
      if (br.br > 0) seenRadius.add(br.br);
      if (br.bl > 0) seenRadius.add(br.bl);
    }
  }

  // Map to tokens
  for (const hex of seenColors) {
    const token = tokens._colorByHex[hex.toUpperCase()];
    if (token) {
      colors[hex] = token;
    }
  }

  for (const key of seenTypo) {
    const token = tokens._typographyByStyle[key];
    if (token) {
      typography[key] = token;
    }
  }

  for (const val of seenSpacing) {
    const token = tokens._spacingByValue[String(val)];
    if (token) {
      spacing[String(val)] = token;
    }
  }

  for (const val of seenRadius) {
    const token = tokens._radiusByValue[String(val)];
    if (token) {
      radius[String(val)] = token;
    }
  }

  return { colors, typography, spacing, radius };
}

// ---------------------------------------------------------------------------
// Asset Collection & Download
// ---------------------------------------------------------------------------

async function collectAndDownloadAssets(
  config: FigmaConfig,
  assetNodeIds: Set<string>,
  nodes: BlueprintNode[],
  baselinesDir: string,
  screenFileId: string,
): Promise<BlueprintAsset[]> {
  if (assetNodeIds.size === 0) return [];

  // Build a quick lookup for node info
  const nodeMap = new Map<string, BlueprintNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  // Fetch download URLs for all asset nodes
  const assetIds = [...assetNodeIds];
  log('info', `Fetching download URLs for ${assetIds.length} asset nodes`);
  const urlMap = await fetchAssetImageUrls(config, assetIds);

  const assets: BlueprintAsset[] = [];
  const assetsDir = path.resolve(baselinesDir, '..', 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  for (const nodeId of assetIds) {
    const downloadUrl = urlMap[toApiId(nodeId)];
    if (!downloadUrl) continue;

    const nodeInfo = nodeMap.get(nodeId);
    const nodeName = nodeInfo?.name || nodeId;

    // Infer usage from node info
    let usage = 'decoration';
    const lowerName = nodeName.toLowerCase();
    if (lowerName.includes('background') || lowerName.includes('bg')) usage = 'background';
    else if (lowerName.includes('pattern') || lowerName.includes('dotted') || lowerName.includes('texture')) usage = 'pattern';
    else if (lowerName.includes('icon')) usage = 'icon';
    else if (lowerName.includes('image') || lowerName.includes('photo')) usage = 'image';
    else if (lowerName.includes('gradient')) usage = 'gradient';
    else if (lowerName.includes('logo')) usage = 'logo';

    // Determine imageRef
    let imageRef = '';
    if (nodeInfo) {
      for (const fill of nodeInfo.fills) {
        if (fill.imageRef) {
          imageRef = fill.imageRef;
          break;
        }
      }
    }
    if (!imageRef) {
      imageRef = toFileId(nodeId);
    }

    // Build local path
    const safeName = nodeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    const localFilename = `${screenFileId}_${safeName}.png`;
    const localPath = path.join(assetsDir, localFilename);

    // Download the asset
    try {
      await downloadImage(downloadUrl, localPath);
      // downloadImage already validates PNG — but double-check for assets
      const assetCheck = validateImageFile(localPath, `asset:${localFilename}`);
      if (!assetCheck.valid) {
        log('warn', `  Asset downloaded but corrupt: ${assetCheck.reason}`);
        try { fs.unlinkSync(localPath); } catch { /* ignore */ }
        continue;
      }
      log('info', `  Downloaded asset: ${localFilename}`);
    } catch (err) {
      log('warn', `  Failed to download asset ${nodeName}: ${err}`);
      continue;
    }

    assets.push({
      imageRef,
      nodeId,
      nodeName,
      usage,
      downloadUrl,
      localPath: `../assets/${localFilename}`,
    });
  }

  return assets;
}

// ---------------------------------------------------------------------------
// Main Extraction Pipeline
// ---------------------------------------------------------------------------

async function extractScreenBlueprint(screenIdArg: string): Promise<void> {
  const startTime = Date.now();

  log('info', '=== BuildBot Screen Blueprint Extractor ===');
  log('info', `Input: ${screenIdArg}`);

  // Normalize IDs
  const apiId = toApiId(screenIdArg);
  const fileId = toFileId(screenIdArg);

  log('info', `API ID: ${apiId} | File ID: ${fileId}`);

  // Load configuration
  const config = loadFigmaConfig();
  const tokens = loadDesignTokens();
  const routes = loadScreenRoutes();
  const resolvedRoute = resolveRoute(screenIdArg, routes);

  log('info', `Route: ${resolvedRoute.route} | State: ${resolvedRoute.stateName}`);
  log('info', `Screen: ${resolvedRoute.screenName}`);

  // Ensure output directories exist
  const blueprintsDir = path.resolve(__dirname, 'data', 'blueprints');
  const baselinesDir = path.resolve(__dirname, 'data', 'baselines');
  fs.mkdirSync(blueprintsDir, { recursive: true });
  fs.mkdirSync(baselinesDir, { recursive: true });

  // -----------------------------------------------------------------------
  // Step 1: Fetch the full node tree
  // -----------------------------------------------------------------------
  log('info', '');
  log('info', 'STEP 1/4: Fetching full node tree from Figma...');
  const figmaResponse = await fetchNodeTree(config, apiId);
  const nodeTree = figmaResponse.document;
  const figmaComponents = figmaResponse.components;
  const figmaComponentSets = figmaResponse.componentSets;
  const figmaStyles = figmaResponse.styles;
  if (figmaComponents) log('info', `  Component metadata: ${Object.keys(figmaComponents).length} entries`);
  if (figmaStyles) log('info', `  Style metadata: ${Object.keys(figmaStyles).length} entries`);

  // -----------------------------------------------------------------------
  // Step 2: Fetch Figma Variables (resolve boundVariable IDs to names/values)
  // -----------------------------------------------------------------------
  log('info', '');
  log('info', 'STEP 2/4: Fetching Figma variables...');
  const variablesData = await fetchVariables(config);

  // -----------------------------------------------------------------------
  // Step 3: Fetch baseline image
  // -----------------------------------------------------------------------
  log('info', '');
  log('info', 'STEP 3/4: Fetching baseline screenshot...');
  const baselinePath = path.join(baselinesDir, `${fileId}-baseline.png`);
  try {
    const imageUrl = await fetchScreenBaselineUrl(config, apiId);
    await downloadImage(imageUrl, baselinePath);
    // Final validation of saved baseline
    const baselineCheck = validateImageFile(baselinePath, 'baseline');
    if (baselineCheck.valid) {
      log('info', `Baseline saved and validated: ${baselinePath}`);
    } else {
      log('error', `Baseline saved but CORRUPT: ${baselineCheck.reason}`);
      log('error', 'Deleting corrupt baseline to prevent downstream pipeline errors.');
      try { fs.unlinkSync(baselinePath); } catch { /* ignore */ }
    }
  } catch (err) {
    log('warn', `Failed to download baseline image: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Step 4: Process the node tree
  // -----------------------------------------------------------------------
  log('info', '');
  log('info', 'STEP 4/4: Processing node tree...');

  const allNodes: BlueprintNode[] = [];
  const assetNodeIds = new Set<string>();

  // Get root node's absolute Y position on the Figma canvas
  const rootBbox = nodeTree.absoluteBoundingBox as { x: number; y: number; width: number; height: number } | undefined;
  const rootBboxY = rootBbox?.y ?? 0;

  traverseNodeTree(
    nodeTree,
    config,
    null,      // parentId
    null,      // parentBbox
    0,         // depth
    allNodes,
    assetNodeIds,
    rootBboxY,
  );

  log('info', `  Processed ${allNodes.length} nodes`);
  log('info', `  Found ${assetNodeIds.size} nodes with image/gradient fills`);

  // Detect background
  const background = detectBackground(nodeTree, allNodes);
  log('info', `  Background: ${background.color} | DottedPattern: ${background.hasDottedPattern}`);

  // Build token map
  const tokensUsed = buildTokensUsed(allNodes, tokens);
  log('info', `  Tokens: ${Object.keys(tokensUsed.colors).length} colors, ${Object.keys(tokensUsed.typography).length} typography, ${Object.keys(tokensUsed.spacing).length} spacing, ${Object.keys(tokensUsed.radius).length} radius`);

  // Download image assets (nodes with IMAGE fills)
  let assets: BlueprintAsset[] = [];
  if (assetNodeIds.size > 0) {
    log('info', '');
    log('info', 'Downloading image assets...');
    assets = await collectAndDownloadAssets(
      config,
      assetNodeIds,
      allNodes,
      baselinesDir,
      fileId,
    );
    log('info', `  Downloaded ${assets.length} assets`);
  }

  // -----------------------------------------------------------------------
  // Step 4: Build prototyping flow summary from node interactions
  // -----------------------------------------------------------------------
  log('info', '');
  log('info', 'STEP 4: Aggregating prototyping flows...');
  const flows: Array<{
    sourceNodeId: string;
    sourceNodeName: string;
    trigger: string;
    destinationNodeId?: string;
    transitionType?: string;
    transitionDuration?: number;
  }> = [];
  for (const bpNode of allNodes) {
    if (bpNode.interactions && bpNode.interactions.length > 0) {
      for (const interaction of bpNode.interactions) {
        for (const action of interaction.actions) {
          flows.push({
            sourceNodeId: bpNode.id,
            sourceNodeName: bpNode.name,
            trigger: interaction.trigger.type,
            ...(action.destinationId ? { destinationNodeId: action.destinationId } : {}),
            ...(action.transition ? {
              transitionType: action.transition.type,
              transitionDuration: action.transition.duration,
            } : {}),
          });
        }
      }
    }
    // Also capture legacy prototyping properties
    if (bpNode.transitionNodeID) {
      flows.push({
        sourceNodeId: bpNode.id,
        sourceNodeName: bpNode.name,
        trigger: 'ON_CLICK',
        destinationNodeId: bpNode.transitionNodeID,
        ...(bpNode.transitionDuration ? { transitionDuration: bpNode.transitionDuration } : {}),
      });
    }
  }
  const hasInteractions = flows.length > 0;
  log('info', `  Found ${flows.length} prototyping flow(s)`);

  // -----------------------------------------------------------------------
  // Assemble the blueprint
  // -----------------------------------------------------------------------
  const blueprint: ScreenBlueprint = {
    meta: {
      screenId: fileId,
      screenName: resolvedRoute.screenName,
      route: resolvedRoute.route,
      stateName: resolvedRoute.stateName,
      dimensions: {
        width: config.baseDesignWidth,
        height: config.baseDesignHeight,
      },
      generatedAt: new Date().toISOString(),
      figmaFileKey: config.fileKey,
    },
    background,
    nodes: allNodes,
    assets,
    tokensUsed,
    prototyping: {
      hasInteractions,
      flowCount: flows.length,
      flows,
    },
    // Top-level metadata from Figma file response
    ...(figmaComponents && Object.keys(figmaComponents).length > 0 ? {
      componentMeta: Object.fromEntries(
        Object.entries(figmaComponents).map(([id, comp]) => [id, {
          key: (comp.key as string) || '',
          name: (comp.name as string) || '',
          ...(comp.description ? { description: comp.description as string } : {}),
          ...(comp.componentSetId ? { componentSetId: comp.componentSetId as string } : {}),
          ...(comp.documentationLinks ? { documentationLinks: comp.documentationLinks as Array<{ uri: string }> } : {}),
        }])
      ),
    } : {}),
    ...(figmaComponentSets && Object.keys(figmaComponentSets).length > 0 ? {
      componentSetMeta: Object.fromEntries(
        Object.entries(figmaComponentSets).map(([id, cs]) => [id, {
          key: (cs.key as string) || '',
          name: (cs.name as string) || '',
          ...(cs.description ? { description: cs.description as string } : {}),
        }])
      ),
    } : {}),
    ...(figmaStyles && Object.keys(figmaStyles).length > 0 ? {
      styleMeta: Object.fromEntries(
        Object.entries(figmaStyles).map(([id, s]) => [id, {
          key: (s.key as string) || '',
          name: (s.name as string) || '',
          styleType: (s.styleType as string) || 'FILL',
          ...(s.description ? { description: s.description as string } : {}),
        }])
      ),
    } : {}),
    ...(variablesData && variablesData.variables && Object.keys(variablesData.variables).length > 0 ? {
      variableMeta: {
        variables: Object.fromEntries(
          Object.entries(variablesData.variables).map(([id, v]) => [id, {
            name: v.name,
            resolvedType: v.resolvedType,
            collectionName: v.collectionName,
            valuesByMode: v.valuesByMode,
          }])
        ),
        collections: variablesData.collections,
      },
    } : {}),
  };

  // Write blueprint JSON
  const blueprintPath = path.join(blueprintsDir, `${fileId}-blueprint.json`);
  fs.writeFileSync(blueprintPath, JSON.stringify(blueprint, null, 2), 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  log('info', '');
  log('info', '=== Extraction Complete ===');
  log('info', `Blueprint: ${blueprintPath}`);
  log('info', `Baseline:  ${baselinePath}`);
  log('info', `Nodes:     ${allNodes.length}`);
  log('info', `Assets:    ${assets.length}`);
  log('info', `Flows:     ${flows.length}`);
  log('info', `Variables: ${Object.keys(variablesData?.variables || {}).length}`);
  log('info', `Time:      ${elapsed}s`);
}

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
BuildBot - Screen Blueprint Extractor
--------------------------------------
Usage:
  npx tsx scripts/extract-screen-blueprint.ts <screenId>

Arguments:
  screenId   Figma node ID (accepts both formats):
             41-8760   (hyphen format, used for filenames)
             1:29914   (colon format, used for Figma API)

Output:
  data/blueprints/{screenId}-blueprint.json
  data/baselines/{screenId}-baseline.png

Examples:
  npx tsx scripts/extract-screen-blueprint.ts 41-8760
  npx tsx scripts/extract-screen-blueprint.ts 1:29914
  npx tsx scripts/extract-screen-blueprint.ts 1-29914
`);
}

async function main(): Promise<void> {
  const screenIdArg = process.argv[2];

  if (!screenIdArg || screenIdArg === '--help' || screenIdArg === '-h') {
    printUsage();
    process.exit(screenIdArg ? 0 : 1);
  }

  try {
    await extractScreenBlueprint(screenIdArg);
  } catch (err) {
    log('error', `Fatal: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) {
      log('debug', err.stack);
    }
    process.exit(1);
  }
}

main();
