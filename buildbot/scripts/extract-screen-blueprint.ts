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
  type: string;
  color?: string;
  opacity?: number;
  visible: boolean;
  imageRef?: string;
  scaleMode?: string;
  gradientStops?: Array<{ color: string; position: number; opacity?: number }>;
  gradientHandlePositions?: Array<{ x: number; y: number }>;
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
}

interface BlueprintLayout {
  direction: 'row' | 'column' | 'none';
  justifyContent: string;
  alignItems: string;
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  wrap: string;
  grow: number;
  sizingH: string;
  sizingV: string;
}

interface BlueprintTypographySpan {
  start: number;
  end: number;
  color?: string;
  fontWeight?: number;
  fontFamily?: string;
  fontSize?: number;
  letterSpacing?: number;
  textDecoration?: string;
}

interface BlueprintTypography {
  content: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  fontFamily: string;
  letterSpacing: number;
  textAlign: string;
  textAlignVertical: string;
  textDecoration: string;
  textTransform: string;
  paragraphSpacing: number;
  textAutoResize: string;
  color: string;
  spans: BlueprintTypographySpan[];
}

interface BlueprintVectorPath {
  path: string;
  windingRule: string;
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
  opacity: number;
  fills: BlueprintFill[];
  strokes: BlueprintStroke[];
  effects: BlueprintEffect[];
  borderRadius: number | { tl: number; tr: number; br: number; bl: number };
  individualStrokeWeights?: { top: number; right: number; bottom: number; left: number };
  clipsContent: boolean;
  // FRAME / GROUP / COMPONENT / INSTANCE
  layout?: BlueprintLayout;
  // TEXT
  typography?: BlueprintTypography;
  // VECTOR / BOOLEAN_OPERATION
  vectorPaths?: BlueprintVectorPath[];
  // INSTANCE / COMPONENT
  componentId?: string;
  componentProperties?: Record<string, unknown>;
  // Constraints (responsive sizing)
  constraints?: { horizontal: string; vertical: string };
  // Blend mode
  blendMode?: string;
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

/** Convert screen ID between hyphen and colon formats. */
function toApiId(id: string): string {
  return id.includes('-') ? id.replace(/-/g, ':') : id;
}

function toFileId(id: string): string {
  return id.includes(':') ? id.replace(/:/g, '-') : id;
}

/** Node name patterns to skip. */
const SKIP_NAME_PATTERN = /StatusBar|HW Cutout|Safe ?Area|Home Indicator/i;

/** Font weight to PostScript name suffix resolution. */
function resolveFontFamily(fontWeight: number): string {
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
  const configPath = path.resolve(__dirname, '..', 'config', 'figma.json');
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
  const tokensPath = path.resolve(__dirname, '..', 'config', 'design-tokens.json');
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
  const routesPath = path.resolve(__dirname, '..', 'config', 'screen-routes.json');
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

async function fetchNodeTree(
  config: FigmaConfig,
  nodeId: string,
): Promise<Record<string, unknown>> {
  const apiId = toApiId(nodeId);
  const url = `${config.restApiBaseUrl}/files/${config.fileKey}/nodes?ids=${encodeURIComponent(apiId)}&depth=999`;
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
  const doc = data.nodes?.[apiId]?.document;
  if (!doc) {
    throw new Error(`Node ${apiId} not found in Figma response`);
  }
  log('info', `Node tree received: "${doc.name}" (${doc.type})`);
  return doc;
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
  // Skip invisible nodes
  if (node.visible === false) return true;

  // Skip known system nodes
  const name = (node.name as string) || '';
  if (SKIP_NAME_PATTERN.test(name)) return true;

  // Skip nodes far below the fold (relative to root node's canvas position)
  // Use 4x design height to include all scrollable content while filtering
  // truly off-screen elements (e.g., hidden layers far below the artboard).
  const bbox = node.absoluteBoundingBox as { x: number; y: number; width: number; height: number } | undefined;
  if (bbox && (bbox.y - rootBboxY) > config.baseDesignHeight * 4) return true;

  return false;
}

function processFills(rawFills: unknown[]): BlueprintFill[] {
  if (!Array.isArray(rawFills)) return [];
  return rawFills.map((fill: Record<string, unknown>) => {
    const result: BlueprintFill = {
      type: (fill.type as string) || 'SOLID',
      visible: fill.visible !== false,
    };

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
    }

    // GRADIENT fills
    if (typeof fill.type === 'string' && fill.type.startsWith('GRADIENT_')) {
      const rawStops = fill.gradientStops as Array<{ position: number; color: { r: number; g: number; b: number; a?: number } }>;
      if (Array.isArray(rawStops)) {
        result.gradientStops = rawStops.map((stop) => ({
          color: figmaColorToHex(stop.color),
          position: stop.position,
          opacity: stop.color.a,
        }));
      }
      const rawHandles = fill.gradientHandlePositions as Array<{ x: number; y: number }>;
      if (Array.isArray(rawHandles)) {
        result.gradientHandlePositions = rawHandles;
      }
      result.opacity = (fill.opacity as number) ?? 1;
    }

    return result;
  });
}

function processStrokes(rawStrokes: unknown[], node: Record<string, unknown>): BlueprintStroke[] {
  if (!Array.isArray(rawStrokes)) return [];
  const weight = (node.strokeWeight as number) || 0;
  const align = (node.strokeAlign as string) || 'INSIDE';
  const cap = (node.strokeCap as string) || undefined;
  const join = (node.strokeJoin as string) || undefined;
  const dashPattern = node.strokeDashes as number[] | undefined;

  return rawStrokes
    .filter((s: Record<string, unknown>) => s.visible !== false)
    .map((s: Record<string, unknown>) => {
      const color = s.color as { r: number; g: number; b: number; a?: number };
      return {
        color: color ? figmaColorToHex(color) : '#000000',
        weight,
        visible: true,
        align: align || undefined,
        cap: cap || undefined,
        join: join || undefined,
        dashPattern: dashPattern || undefined,
      };
    });
}

function processEffects(rawEffects: unknown[]): BlueprintEffect[] {
  if (!Array.isArray(rawEffects)) return [];
  return rawEffects
    .filter((e: Record<string, unknown>) => e.visible !== false)
    .map((e: Record<string, unknown>) => {
      const color = e.color as { r: number; g: number; b: number; a?: number } | undefined;
      const offset = e.offset as { x: number; y: number } | undefined;
      return {
        type: (e.type as string) || 'UNKNOWN',
        visible: true,
        color: color ? figmaColorToHexAlpha(color) : undefined,
        offset: offset ? { x: offset.x, y: offset.y } : undefined,
        blur: (e.radius as number) || undefined,
        spread: (e.spread as number) || undefined,
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
  return (node.cornerRadius as number) || 0;
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

  return {
    direction,
    justifyContent: primary ? (primaryMap[primary] || 'flex-start') : 'flex-start',
    alignItems: counter ? (counterMap[counter] || 'flex-start') : 'flex-start',
    gap: (node.itemSpacing as number) || 0,
    padding: {
      top: (node.paddingTop as number) || 0,
      right: (node.paddingRight as number) || 0,
      bottom: (node.paddingBottom as number) || 0,
      left: (node.paddingLeft as number) || 0,
    },
    wrap: (node.layoutWrap as string) || 'NO_WRAP',
    grow: (node.layoutGrow as number) || 0,
    sizingH: (node.layoutSizingHorizontal as string) || 'FIXED',
    sizingV: (node.layoutSizingVertical as string) || 'FIXED',
  };
}

function processTypography(node: Record<string, unknown>): BlueprintTypography | undefined {
  if (node.type !== 'TEXT') return undefined;

  const style = (node.style as Record<string, unknown>) || {};
  const content = (node.characters as string) || '';
  const fontWeight = (style.fontWeight as number) || 400;

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
              span.fontFamily = resolveFontFamily(ow);
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

            spans.push(span);
          }
        }
        spanStart = i;
        currentStyleId = styleId;
      }
    }
  }

  return {
    content,
    fontSize: (style.fontSize as number) || 16,
    lineHeight: (style.lineHeightPx as number) || 24,
    fontWeight,
    fontFamily: resolveFontFamily(fontWeight),
    letterSpacing: (style.letterSpacing as number) || 0,
    textAlign: hAlignMap[textAlignH] || 'left',
    textAlignVertical: textAlignV,
    textDecoration: decorationMap[rawDecoration] || 'none',
    textTransform: caseMap[rawCase] || 'none',
    paragraphSpacing: (style.paragraphSpacing as number) || 0,
    textAutoResize: (style.textAutoResize as string) || 'NONE',
    color: textColor,
    spans,
  };
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
  const rotation = (node.rotation as number) || 0;

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
  const childIds = rawChildren
    .filter((c) => !shouldSkipNode(c, config, rootBboxY))
    .map((c) => c.id as string);

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
    visible: true,
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

  // Layout
  const layout = processLayout(node);
  if (layout) {
    blueprintNode.layout = layout;
  }

  // Typography
  const typography = processTypography(node);
  if (typography) {
    blueprintNode.typography = typography;
  }

  // Vector paths
  const vectorPaths = processVectorPaths(node);
  if (vectorPaths) {
    blueprintNode.vectorPaths = vectorPaths;
  }

  // Component / Instance
  if (node.componentId) {
    blueprintNode.componentId = node.componentId as string;
  }
  if (node.componentProperties) {
    blueprintNode.componentProperties = node.componentProperties as Record<string, unknown>;
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
  const blueprintsDir = path.resolve(__dirname, '..', 'data', 'blueprints');
  const baselinesDir = path.resolve(__dirname, '..', 'data', 'baselines');
  fs.mkdirSync(blueprintsDir, { recursive: true });
  fs.mkdirSync(baselinesDir, { recursive: true });

  // -----------------------------------------------------------------------
  // Step 1: Fetch the full node tree
  // -----------------------------------------------------------------------
  log('info', '');
  log('info', 'STEP 1/3: Fetching full node tree from Figma...');
  const nodeTree = await fetchNodeTree(config, apiId) as Record<string, unknown>;

  // -----------------------------------------------------------------------
  // Step 2: Fetch baseline image
  // -----------------------------------------------------------------------
  log('info', '');
  log('info', 'STEP 2/3: Fetching baseline screenshot...');
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
  // Step 3: Process the node tree
  // -----------------------------------------------------------------------
  log('info', '');
  log('info', 'STEP 3/3: Processing node tree...');

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
