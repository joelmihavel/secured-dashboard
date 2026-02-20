/**
 * extract-screen.ts — Figma 1:1 Parity Screen Extractor (COMPLETE)
 *
 * Extracts EVERY property from the Figma REST API for a single screen.
 * Zero AI dependency — every value comes directly from the Figma node tree.
 *
 * Also generates a cross-check manifest for MCP validation.
 *
 * Usage:
 *   npx tsx figma-1on1parity/extract-screen.ts "https://www.figma.com/design/KEY/...?node-id=1-29108"
 *   npx tsx figma-1on1parity/extract-screen.ts 1-29108
 *   npx tsx figma-1on1parity/extract-screen.ts 1:29108
 *
 * Output:
 *   figma-1on1parity/data/{screenId}-blueprint.json
 *   figma-1on1parity/data/{screenId}-crosscheck.json   (for MCP validation)
 *   figma-1on1parity/baselines/{screenId}-baseline.png
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// ---------------------------------------------------------------------------
// Inline .env Loading
// ---------------------------------------------------------------------------
const dotenvPath = path.resolve(__dirname, '.env');
try {
  if (fs.existsSync(dotenvPath)) {
    const envContent = fs.readFileSync(dotenvPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch { /* .env is optional */ }

// ---------------------------------------------------------------------------
// Type Definitions (COMPLETE — every Figma REST API property)
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
  resolvedType: string;
  description?: string;
  collectionId: string;
  collectionName: string;
  valuesByMode: Record<string, unknown>;
}

interface VariablesResponse {
  variables: Record<string, ResolvedVariable>;
  collections: Record<string, { id: string; name: string; modes: Array<{ modeId: string; name: string }> }>;
}

interface BlueprintFill {
  type: string;
  color?: string;
  opacity?: number;
  visible: boolean;
  blendMode?: string;
  imageRef?: string;
  scaleMode?: string;
  imageTransform?: number[][];
  imageFilters?: { exposure?: number; contrast?: number; saturation?: number; temperature?: number; tint?: number; highlights?: number; shadows?: number };
  gradientStops?: Array<{ color: string; position: number; opacity?: number; boundVariables?: Record<string, unknown> }>;
  gradientHandlePositions?: Array<{ x: number; y: number }>;
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
  opacity?: number;
  blendMode?: string;
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
  sizingH: string;
  sizingV: string;
  counterAxisAlignContent?: string;
  counterAxisSpacing?: number;
  itemReverseZIndex?: boolean;
}

interface BlueprintTypographySpan {
  start: number;
  end: number;
  color?: string;
  fontWeight?: number;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
  textDecoration?: string;
  textCase?: string;
  hyperlink?: { type: string; url?: string; nodeID?: string };
  opentypeFlags?: Record<string, number>;
}

interface BlueprintTypography {
  content: string;
  fontSize: number;
  lineHeight: number;
  lineHeightUnit?: string;
  fontWeight: number;
  fontFamily: string;
  fontStyle: string;
  letterSpacing: number;
  textAlign: string;
  textAlignVertical: string;
  textDecoration: string;
  textTransform: string;
  paragraphSpacing: number;
  paragraphIndent?: number;
  textAutoResize: string;
  textTruncation?: string;
  maxLines?: number;
  color: string;
  fontPostScriptName?: string;
  openTypeFlags?: Record<string, number>;
  hyperlink?: { type: string; url?: string; nodeID?: string };
  lineHeightPercent?: number;
  inheritTextStyleId?: string;
  lineIndentations?: number[];
  lineTypes?: string[];
  textRangeFills?: Array<Record<string, unknown>>;
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
  type: string;
  destinationId?: string;
  url?: string;
  navigation?: string;
  transition?: {
    type: string;
    duration: number;
    easing: { type: string; easingFunctionCubicBezier?: { x1: number; y1: number; x2: number; y2: number } };
  };
  preserveScrollPosition?: boolean;
  overlayRelativePosition?: { x: number; y: number };
}

interface BlueprintInteraction {
  trigger: { type: string; delay?: number; timeout?: number };
  actions: BlueprintInteractionAction[];
}

interface BlueprintNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  depth: number;
  visible: boolean;
  geometry: { x: number; y: number; width: number; height: number; rotation: number };
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number } | null;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  opacity: number;
  fills: BlueprintFill[];
  strokes: BlueprintStroke[];
  effects: BlueprintEffect[];
  borderRadius: number | { tl: number; tr: number; br: number; bl: number };
  cornerSmoothing?: number;
  individualStrokeWeights?: { top: number; right: number; bottom: number; left: number };
  clipsContent: boolean;
  layout?: BlueprintLayout;
  layoutPositioning?: string;
  layoutAlign?: string;
  layoutGrow?: number;
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  typography?: BlueprintTypography;
  vectorPaths?: BlueprintVectorPath[];
  strokePaths?: BlueprintVectorPath[];
  arcData?: BlueprintArcData;
  componentId?: string;
  componentProperties?: Record<string, unknown>;
  componentPropertyReferences?: Record<string, string>;
  constraints?: { horizontal: string; vertical: string };
  blendMode?: string;
  interactions?: BlueprintInteraction[];
  transitionNodeID?: string;
  transitionDuration?: number;
  transitionEasing?: Record<string, unknown>;
  scrollBehavior?: string;
  preserveRatio?: boolean;
  targetAspectRatio?: number;
  size?: { x: number; y: number };
  relativeTransform?: number[][];
  isMask?: boolean;
  isMaskOutline?: boolean;
  maskType?: string;
  locked?: boolean;
  isFixed?: boolean;
  exportSettings?: Array<{ suffix: string; format: string; constraint: { type: string; value: number } }>;
  boundVariables?: Record<string, unknown>;
  styleReferences?: Record<string, string>;
  devStatus?: { type: string; description?: string };
  overflowDirection?: string;
  strokesIncludedInLayout?: boolean;
  strokeMiterAngle?: number;
  booleanOperation?: string;
  showShadowBehindNode?: boolean;
  overriddenFields?: string[];
  overrides?: Array<Record<string, unknown>>;
  isExposedInstance?: boolean;
  exposedInstances?: string[];
  componentPropertyDefinitions?: Record<string, unknown>;
  gridLayout?: {
    rowCount?: number;
    columnCount?: number;
    rowGap?: number;
    columnGap?: number;
    columnsSizing?: string;
    rowsSizing?: string;
  };
  gridChildAlign?: { horizontal?: string; vertical?: string };
  gridSpan?: { rows?: number; columns?: number };
  gridAnchor?: { row?: number; column?: number };
  fillOverrideTable?: Record<string, unknown>;
  variableWidthPoints?: Array<{ x: number; y: number }>;
  complexStrokeProperties?: Record<string, unknown>;
  textPathStartData?: Record<string, unknown>;
  transformModifiers?: Array<Record<string, unknown>>;
  layoutGrids?: Array<Record<string, unknown>>;
  rnComponent?: string;
  rnProps?: Record<string, unknown>;
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

interface BackgroundInfo {
  color: string;
  hasDottedPattern: boolean;
  backgroundShapeKey?: string;
  gradient?: { type: string; stops: Array<{ color: string; position: number }> };
}

interface TokensUsed {
  colors: Record<string, string>;
  typography: Record<string, string>;
  spacing: Record<string, string>;
  radius: Record<string, string>;
}

interface RnMapping {
  rnComponent: string;
  rnProps?: Record<string, unknown>;
}

interface ScreenBlueprint {
  meta: {
    screenId: string;
    screenName: string;
    figmaUrl: string;
    dimensions: { width: number; height: number };
    generatedAt: string;
    figmaFileKey: string;
  };
  background: BackgroundInfo;
  nodes: BlueprintNode[];
  assets: BlueprintAsset[];
  tokensUsed: TokensUsed;
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
  componentMeta?: Record<string, { key: string; name: string; description?: string; componentSetId?: string; documentationLinks?: Array<{ uri: string }> }>;
  componentSetMeta?: Record<string, { key: string; name: string; description?: string }>;
  styleMeta?: Record<string, { key: string; name: string; styleType: string; description?: string }>;
  variableMeta?: {
    variables: Record<string, { name: string; resolvedType: string; collectionName: string; valuesByMode: Record<string, unknown> }>;
    collections: Record<string, { name: string; modes: Array<{ modeId: string; name: string }> }>;
  };
}

interface DesignTokens {
  _colorByHex: Record<string, string>;
  _typographyByStyle: Record<string, string>;
  _spacingByValue: Record<string, string>;
  _radiusByValue: Record<string, string>;
}

/** Cross-check manifest for MCP validation */
interface CrossCheckManifest {
  screenId: string;
  screenName: string;
  figmaUrl: string;
  generatedAt: string;
  checks: {
    nodeCount: number;
    textNodeCount: number;
    componentInstanceCount: number;
    interactiveNodeCount: number;
    imageAssetCount: number;
    variableCount: number;
    rootDimensions: { width: number; height: number };
    backgroundColor: string;
    hasDottedPattern: boolean;
    topLevelChildNames: string[];
    textContents: Array<{ nodeId: string; name: string; content: string; fontSize: number; fontWeight: number; color: string }>;
    colorPalette: string[];
    spacingValues: number[];
    componentIds: string[];
    interactionSummary: Array<{ sourceNode: string; trigger: string; destination?: string }>;
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function figmaColorToHex(c: { r: number; g: number; b: number; a?: number }): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`.toUpperCase();
}

function figmaColorToHexAlpha(c: { r: number; g: number; b: number; a?: number }): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`.toUpperCase();
  if (c.a !== undefined && c.a < 1) return `${hex}${toHex(c.a).toUpperCase()}`;
  return hex;
}

function toApiId(id: string): string {
  const match = id.match(/^(\d+)-(\d+)$/);
  return match ? `${match[1]}:${match[2]}` : id;
}

function toFileId(id: string): string {
  const match = id.match(/^(\d+):(\d+)$/);
  return match ? `${match[1]}-${match[2]}` : id;
}

function parseInput(input: string): { nodeId: string; fileKey: string | null; figmaUrl: string } {
  if (input.startsWith('http')) {
    const url = new URL(input);
    const nodeIdParam = url.searchParams.get('node-id');
    if (!nodeIdParam) throw new Error(`No node-id found in URL: ${input}`);
    // node-id can be "1-29108" or "1%3A29108" (URL-encoded colon)
    const rawId = decodeURIComponent(nodeIdParam);
    const nodeId = rawId.includes(':') ? rawId : rawId.replace('-', ':');
    const pathParts = url.pathname.split('/');
    const keyIdx = pathParts.findIndex((p) => p === 'design' || p === 'file');
    const fileKey = keyIdx >= 0 && pathParts[keyIdx + 1] ? pathParts[keyIdx + 1] : null;
    return { nodeId: toFileId(nodeId), fileKey, figmaUrl: input };
  }
  const normalized = input.includes(':') ? toFileId(input) : input;
  return { nodeId: normalized, fileKey: null, figmaUrl: '' };
}

const SKIP_NAME_PATTERN = /StatusBar|HW Cutout|Safe ?Area|Home Indicator/i;

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
// HTTP Helpers
// ---------------------------------------------------------------------------

interface HttpResponse { status: number; headers: http.IncomingHttpHeaders; body: string }

function httpsGet(url: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
    }, (res) => {
      if (res.statusCode && [301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
        httpsGet(res.headers.location, {}).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf-8') }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('Request timed out')));
    req.end();
  });
}

function httpsGetBuffer(url: string, headers: Record<string, string> = {}): Promise<{ status: number; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const proto = parsed.protocol === 'http:' ? http : https;
    const req = proto.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
    }, (res) => {
      if (res.statusCode && [301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
        httpsGetBuffer(res.headers.location, {}).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, buffer: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('Request timed out')));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Retry & Logging
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>, maxRetries = 3, backoffMs = 5000): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const waitMs = lastError.message.includes('429') ? 60000 : backoffMs * attempt;
      log('warn', `${label} — attempt ${attempt}/${maxRetries}: ${lastError.message}`);
      if (attempt < maxRetries) {
        log('info', `  Retrying in ${(waitMs / 1000).toFixed(0)}s...`);
        await sleep(waitMs);
      }
    }
  }
  throw lastError || new Error(`${label} failed after ${maxRetries} retries`);
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
function log(level: LogLevel, ...args: unknown[]): void {
  const prefix: Record<LogLevel, string> = { info: '[INFO]', warn: '[WARN]', error: '[ERR]', debug: '[DBG]' };
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`${ts} ${prefix[level]}`, ...args);
}

// ---------------------------------------------------------------------------
// Config Loading
// ---------------------------------------------------------------------------

function loadFigmaConfig(overrideFileKey?: string): FigmaConfig {
  const configPath = path.resolve(__dirname, 'figma.config.json');
  if (!fs.existsSync(configPath)) throw new Error(`Config not found: ${configPath}`);
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const token = process.env.FIGMA_TOKEN || raw.figmaToken;
  if (!token) throw new Error('FIGMA_TOKEN not set. Provide via .env or figma.config.json');
  return {
    fileKey: overrideFileKey || raw.fileKey,
    figmaToken: token,
    restApiBaseUrl: raw.restApiBaseUrl || 'https://api.figma.com/v1',
    baseDesignWidth: raw.baseDesignWidth || 393,
    baseDesignHeight: raw.baseDesignHeight || 852,
    exportScale: raw.exportScale || 3,
  };
}

function loadDesignTokens(): DesignTokens {
  const p = path.resolve(__dirname, 'design-tokens.json');
  if (!fs.existsSync(p)) {
    log('warn', 'Design tokens not found — token mapping disabled');
    return { _colorByHex: {}, _typographyByStyle: {}, _spacingByValue: {}, _radiusByValue: {} };
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
  log('info', `Loaded design tokens (source: ${raw._meta?.source || 'unknown'}, generated: ${raw._meta?.generatedAt || 'unknown'})`);
  return {
    _colorByHex: raw._colorByHex || {},
    _typographyByStyle: raw._typographyByStyle || {},
    _spacingByValue: raw._spacingByValue || {},
    _radiusByValue: raw._radiusByValue || {},
  };
}

// ---------------------------------------------------------------------------
// Figma API Calls
// ---------------------------------------------------------------------------

interface FigmaNodeResponse {
  document: Record<string, unknown>;
  components: Record<string, Record<string, unknown>>;
  componentSets: Record<string, Record<string, unknown>>;
  styles: Record<string, Record<string, unknown>>;
}

async function fetchNodeTree(config: FigmaConfig, nodeId: string): Promise<FigmaNodeResponse> {
  const apiId = toApiId(nodeId);
  const url = `${config.restApiBaseUrl}/files/${config.fileKey}/nodes?ids=${encodeURIComponent(apiId)}&depth=999&geometry=paths`;
  log('info', `Fetching node tree: ${apiId}`);
  const response = await withRetry('fetchNodeTree', async () => {
    const res = await httpsGet(url, { 'X-Figma-Token': config.figmaToken });
    if (res.status === 429) throw new Error('429 Rate Limited');
    if (res.status !== 200) throw new Error(`Figma API ${res.status}: ${res.body.slice(0, 200)}`);
    return res;
  });
  const data = JSON.parse(response.body);
  const nodeData = data.nodes?.[apiId];
  const doc = nodeData?.document;
  if (!doc) throw new Error(`Node ${apiId} not found in response`);
  log('info', `Node received: "${doc.name}" (${doc.type})`);
  return {
    document: doc as Record<string, unknown>,
    components: (nodeData.components || {}) as Record<string, Record<string, unknown>>,
    componentSets: (nodeData.componentSets || {}) as Record<string, Record<string, unknown>>,
    styles: (nodeData.styles || {}) as Record<string, Record<string, unknown>>,
  };
}

async function fetchBaselineUrl(config: FigmaConfig, nodeId: string): Promise<string> {
  const apiId = toApiId(nodeId);
  const url = `${config.restApiBaseUrl}/images/${config.fileKey}?ids=${encodeURIComponent(apiId)}&scale=${config.exportScale}&format=png`;
  log('info', `Fetching baseline image URL: ${apiId}`);
  const response = await withRetry('fetchBaselineUrl', async () => {
    const res = await httpsGet(url, { 'X-Figma-Token': config.figmaToken });
    if (res.status === 429) throw new Error('429 Rate Limited');
    if (res.status !== 200) throw new Error(`Images API ${res.status}: ${res.body.slice(0, 200)}`);
    return res;
  });
  const data = JSON.parse(response.body);
  const imageUrl = data.images?.[apiId];
  if (!imageUrl) throw new Error(`No image URL for ${apiId}`);
  return imageUrl;
}

async function fetchAssetImageUrls(config: FigmaConfig, assetNodeIds: string[]): Promise<Record<string, string>> {
  if (assetNodeIds.length === 0) return {};
  const apiIds = assetNodeIds.map(toApiId);
  const url = `${config.restApiBaseUrl}/images/${config.fileKey}?ids=${encodeURIComponent(apiIds.join(','))}&scale=${config.exportScale}&format=png`;
  log('info', `Fetching asset URLs for ${apiIds.length} nodes`);
  const response = await withRetry('fetchAssetImageUrls', async () => {
    const res = await httpsGet(url, { 'X-Figma-Token': config.figmaToken });
    if (res.status === 429) throw new Error('429 Rate Limited');
    if (res.status !== 200) throw new Error(`Images API ${res.status}: ${res.body.slice(0, 200)}`);
    return res;
  });
  return JSON.parse(response.body).images || {};
}

// ---------------------------------------------------------------------------
// Figma Variables API
// ---------------------------------------------------------------------------

async function fetchVariables(config: FigmaConfig): Promise<VariablesResponse> {
  const empty: VariablesResponse = { variables: {}, collections: {} };
  const url = `${config.restApiBaseUrl}/files/${config.fileKey}/variables/local`;
  log('info', `Fetching variables: ${url}`);
  try {
    const response = await withRetry('fetchVariables', async () => {
      const res = await httpsGet(url, { 'X-Figma-Token': config.figmaToken });
      if (res.status === 403) { log('warn', 'Variables API 403 — requires Enterprise. Skipping.'); return null; }
      if (res.status === 429) throw new Error('429 Rate Limited');
      if (res.status !== 200) { log('warn', `Variables API ${res.status}. Skipping.`); return null; }
      return res;
    }, 2, 5000);
    if (!response) return empty;
    const data = JSON.parse(response.body);
    const meta = data.meta || data;
    const rawCollections = meta.variableCollections || {};
    const rawVariables = meta.variables || {};
    const collections: VariablesResponse['collections'] = {};
    for (const [colId, col] of Object.entries(rawCollections) as Array<[string, any]>) {
      collections[colId] = { id: colId, name: col.name || '', modes: Array.isArray(col.modes) ? col.modes : [] };
    }
    const variables: Record<string, ResolvedVariable> = {};
    for (const [varId, v] of Object.entries(rawVariables) as Array<[string, any]>) {
      const collectionId = v.variableCollectionId || '';
      variables[varId] = {
        id: varId, name: v.name || '', resolvedType: v.resolvedType || 'UNKNOWN',
        ...(v.description ? { description: v.description } : {}),
        collectionId, collectionName: collections[collectionId]?.name || '',
        valuesByMode: v.valuesByMode || {},
      };
    }
    log('info', `  Variables: ${Object.keys(variables).length} across ${Object.keys(collections).length} collections`);
    return { variables, collections };
  } catch (err) {
    log('warn', `Failed to fetch variables: ${err}. Continuing without.`);
    return empty;
  }
}

// ---------------------------------------------------------------------------
// PNG Validation
// ---------------------------------------------------------------------------

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function validatePngBuffer(buffer: Buffer, label: string): { valid: boolean; reason?: string } {
  if (buffer.length === 0) return { valid: false, reason: `${label}: empty buffer (0 bytes)` };
  if (buffer.length < 67) return { valid: false, reason: `${label}: too small (${buffer.length} bytes)` };
  if (!buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    if (buffer[0] === 0x7b) return { valid: false, reason: `${label}: JSON instead of PNG` };
    return { valid: false, reason: `${label}: invalid PNG header` };
  }
  return { valid: true };
}

function validateImageFile(filePath: string, label?: string): { valid: boolean; reason?: string } {
  const tag = label || path.basename(filePath);
  if (!fs.existsSync(filePath)) return { valid: false, reason: `${tag}: file not found` };
  let stat: fs.Stats;
  try { stat = fs.statSync(filePath); } catch { return { valid: false, reason: `${tag}: cannot stat` }; }
  if (stat.size === 0) return { valid: false, reason: `${tag}: empty (0 bytes)` };
  if (stat.size < 67) return { valid: false, reason: `${tag}: too small (${stat.size} bytes)` };
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(8);
    fs.readSync(fd, header, 0, 8, 0);
    fs.closeSync(fd);
    if (!header.subarray(0, 8).equals(PNG_MAGIC)) {
      if (header[0] === 0x7b) return { valid: false, reason: `${tag}: JSON, not PNG (API error)` };
      return { valid: false, reason: `${tag}: invalid PNG header` };
    }
  } catch { return { valid: false, reason: `${tag}: cannot read header` }; }
  return { valid: true };
}

async function downloadImage(imageUrl: string, destPath: string): Promise<void> {
  await withRetry(`download ${path.basename(destPath)}`, async () => {
    const res = await httpsGetBuffer(imageUrl);
    if (res.status !== 200) throw new Error(`Download returned ${res.status}`);
    const check = validatePngBuffer(res.buffer, path.basename(destPath));
    if (!check.valid) throw new Error(`Not valid PNG: ${check.reason}`);
    fs.writeFileSync(destPath, res.buffer);
    const diskCheck = validateImageFile(destPath, path.basename(destPath));
    if (!diskCheck.valid) throw new Error(`Written file invalid: ${diskCheck.reason}`);
  });
}

// ---------------------------------------------------------------------------
// Node Processing Functions
// ---------------------------------------------------------------------------

function shouldSkipNode(node: Record<string, unknown>, config: FigmaConfig, rootBboxY: number): boolean {
  if (node.visible === false) return true;
  const name = (node.name as string) || '';
  if (SKIP_NAME_PATTERN.test(name)) return true;
  const bbox = node.absoluteBoundingBox as { y: number } | undefined;
  if (bbox && (bbox.y - rootBboxY) > config.baseDesignHeight * 8) return true;
  return false;
}

function processFills(rawFills: unknown[]): BlueprintFill[] {
  if (!Array.isArray(rawFills)) return [];
  return rawFills.map((fill: any) => {
    const result: BlueprintFill = { type: fill.type || 'SOLID', visible: fill.visible !== false };
    const blendMode = fill.blendMode;
    if (blendMode && blendMode !== 'NORMAL' && blendMode !== 'PASS_THROUGH') result.blendMode = blendMode;
    if (fill.type === 'SOLID' && fill.color) {
      result.color = figmaColorToHex(fill.color);
      result.opacity = fill.opacity ?? 1;
    }
    if (fill.type === 'IMAGE') {
      result.imageRef = fill.imageRef || undefined;
      result.scaleMode = fill.scaleMode || undefined;
      result.opacity = fill.opacity ?? 1;
      if (fill.imageTransform && Array.isArray(fill.imageTransform)) result.imageTransform = fill.imageTransform;
      if (fill.filters) {
        const f = fill.filters;
        if (Object.values(f).some((v: any) => v !== 0)) {
          result.imageFilters = { exposure: f.exposure || undefined, contrast: f.contrast || undefined, saturation: f.saturation || undefined, temperature: f.temperature || undefined, tint: f.tint || undefined, highlights: f.highlights || undefined, shadows: f.shadows || undefined };
        }
      }
    }
    if (typeof fill.type === 'string' && fill.type.startsWith('GRADIENT_')) {
      if (Array.isArray(fill.gradientStops)) {
        result.gradientStops = fill.gradientStops.map((s: any) => ({
          color: figmaColorToHexAlpha(s.color), position: s.position, opacity: s.color.a,
          ...(s.boundVariables && Object.keys(s.boundVariables).length > 0 ? { boundVariables: s.boundVariables } : {}),
        }));
      }
      if (Array.isArray(fill.gradientHandlePositions)) result.gradientHandlePositions = fill.gradientHandlePositions;
      result.opacity = fill.opacity ?? 1;
    }
    if (fill.boundVariables && Object.keys(fill.boundVariables).length > 0) result.boundVariables = fill.boundVariables;
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
  return rawStrokes.filter((s: any) => s.visible !== false).map((s: any) => {
    const color = s.color ? figmaColorToHex(s.color) : '#000000';
    const strokeOpacity = s.opacity as number | undefined;
    const strokeBlendMode = s.blendMode as string | undefined;
    return {
      color, weight, visible: true, align, cap, join, dashPattern,
      ...(strokeOpacity !== undefined && strokeOpacity !== 1 ? { opacity: strokeOpacity } : {}),
      ...(strokeBlendMode && strokeBlendMode !== 'NORMAL' && strokeBlendMode !== 'PASS_THROUGH' ? { blendMode: strokeBlendMode } : {}),
    };
  });
}

function processEffects(rawEffects: unknown[]): BlueprintEffect[] {
  if (!Array.isArray(rawEffects)) return [];
  return rawEffects.filter((e: any) => e.visible !== false).map((e: any) => ({
    type: e.type || 'UNKNOWN', visible: true,
    color: e.color ? figmaColorToHexAlpha(e.color) : undefined,
    offset: e.offset ? { x: e.offset.x, y: e.offset.y } : undefined,
    blur: e.radius || undefined, spread: e.spread || undefined,
  }));
}

function processBorderRadius(node: Record<string, unknown>): number | { tl: number; tr: number; br: number; bl: number } {
  const individual = node.rectangleCornerRadii as number[] | undefined;
  if (Array.isArray(individual) && individual.length === 4) {
    if (individual[0] === individual[1] && individual[1] === individual[2] && individual[2] === individual[3]) return individual[0];
    return { tl: individual[0], tr: individual[1], br: individual[2], bl: individual[3] };
  }
  return (node.cornerRadius as number) ?? 0;
}

function processLayout(node: Record<string, unknown>): BlueprintLayout | undefined {
  const type = node.type as string;
  if (!['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET'].includes(type)) return undefined;
  const layoutMode = node.layoutMode as string | undefined;
  const direction: 'row' | 'column' | 'none' = layoutMode === 'HORIZONTAL' ? 'row' : layoutMode === 'VERTICAL' ? 'column' : 'none';
  const primaryMap: Record<string, string> = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between' };
  const counterMap: Record<string, string> = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end' };
  const primary = node.primaryAxisAlignItems as string | undefined;
  const counter = node.counterAxisAlignItems as string | undefined;
  const result: BlueprintLayout = {
    direction,
    justifyContent: primary ? (primaryMap[primary] || 'flex-start') : 'flex-start',
    alignItems: counter ? (counterMap[counter] || 'flex-start') : 'flex-start',
    gap: (node.itemSpacing as number) ?? 0,
    padding: { top: (node.paddingTop as number) ?? 0, right: (node.paddingRight as number) ?? 0, bottom: (node.paddingBottom as number) ?? 0, left: (node.paddingLeft as number) ?? 0 },
    wrap: (node.layoutWrap as string) || 'NO_WRAP',
    sizingH: (node.layoutSizingHorizontal as string) || 'FIXED',
    sizingV: (node.layoutSizingVertical as string) || 'FIXED',
  };
  if (result.wrap !== 'NO_WRAP') {
    const counterContent = node.counterAxisAlignContent as string | undefined;
    if (counterContent) result.counterAxisAlignContent = counterContent;
    const counterSpacing = node.counterAxisSpacing as number | undefined;
    if (counterSpacing !== undefined && counterSpacing !== 0) result.counterAxisSpacing = counterSpacing;
  }
  if (node.itemReverseZIndex === true) result.itemReverseZIndex = true;
  return result;
}

function processTypography(node: Record<string, unknown>): BlueprintTypography | undefined {
  if (node.type !== 'TEXT') return undefined;
  const style = (node.style as Record<string, unknown>) || {};
  const content = (node.characters as string) || '';
  const fontWeight = (style.fontWeight as number) ?? 400;
  const isItalic = (style.italic as boolean) === true || ((style.fontPostScriptName as string) || '').toLowerCase().includes('italic');
  const fontStyle = isItalic ? 'italic' : 'normal';
  const hAlignMap: Record<string, string> = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' };
  const decorationMap: Record<string, string> = { UNDERLINE: 'underline', STRIKETHROUGH: 'line-through' };
  const caseMap: Record<string, string> = { UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize' };
  const textAlignH = (style.textAlignHorizontal as string) || 'LEFT';
  const textAlignV = ((style.textAlignVertical as string) || 'TOP').toLowerCase();
  const rawDecoration = (style.textDecoration as string) || 'NONE';
  const rawCase = (style.textCase as string) || 'ORIGINAL';

  let textColor = '#FFFFFF';
  const fills = node.fills as Array<any> | undefined;
  if (Array.isArray(fills)) {
    const solidFill = fills.find((f) => f.type === 'SOLID' && f.visible !== false);
    if (solidFill?.color) textColor = figmaColorToHex(solidFill.color);
  }

  // Process character style overrides (spans) — COMPLETE with all overridable properties
  const spans: BlueprintTypographySpan[] = [];
  const overrides = node.characterStyleOverrides as number[] | undefined;
  const overrideTable = node.styleOverrideTable as Record<string, Record<string, unknown>> | undefined;
  if (Array.isArray(overrides) && overrideTable && overrides.length > 0) {
    let currentStyleId = overrides[0];
    let spanStart = 0;
    for (let i = 1; i <= overrides.length; i++) {
      const styleId = i < overrides.length ? overrides[i] : -1;
      if (styleId !== currentStyleId) {
        if (currentStyleId !== 0) {
          const os = overrideTable[String(currentStyleId)];
          if (os) {
            const span: BlueprintTypographySpan = { start: spanStart, end: i };
            // Color
            const sFills = os.fills as Array<any> | undefined;
            if (Array.isArray(sFills)) {
              const sf = sFills.find((f: any) => f.type === 'SOLID' && f.visible !== false);
              if (sf?.color) span.color = figmaColorToHex(sf.color);
            }
            // Font weight
            if (os.fontWeight !== undefined) span.fontWeight = os.fontWeight as number;
            // Font family (resolve from weight when fontPostScriptName or fontFamily present)
            if (os.fontPostScriptName || os.fontFamily) {
              const ow = (os.fontWeight as number) || fontWeight;
              span.fontFamily = resolveFontFamily(ow);
            }
            // Font size
            if (os.fontSize !== undefined) span.fontSize = os.fontSize as number;
            // Letter spacing
            if (os.letterSpacing !== undefined) span.letterSpacing = os.letterSpacing as number;
            // Line height
            if (os.lineHeightPx !== undefined) span.lineHeight = os.lineHeightPx as number;
            // Text decoration
            if (os.textDecoration) span.textDecoration = decorationMap[os.textDecoration as string] || undefined;
            // Font style (italic) per span
            const spanItalic = (os.italic as boolean) === true || ((os.fontPostScriptName as string) || '').toLowerCase().includes('italic');
            if (spanItalic) span.fontStyle = 'italic';
            // Text case per span
            if (os.textCase) {
              const spanCase = caseMap[os.textCase as string];
              if (spanCase) span.textCase = spanCase;
            }
            // Hyperlink per span
            if (os.hyperlink) span.hyperlink = os.hyperlink as any;
            // OpenType flags per span
            const spanOTFlags = os.opentypeFlags as Record<string, number> | undefined;
            if (spanOTFlags && Object.keys(spanOTFlags).length > 0) span.opentypeFlags = spanOTFlags;
            spans.push(span);
          }
        }
        spanStart = i;
        currentStyleId = styleId;
      }
    }
  }

  const result: BlueprintTypography = {
    content, fontSize: (style.fontSize as number) ?? 16, lineHeight: (style.lineHeightPx as number) ?? 24,
    fontWeight, fontFamily: resolveFontFamily(fontWeight), fontStyle,
    letterSpacing: (style.letterSpacing as number) ?? 0,
    textAlign: hAlignMap[textAlignH] || 'left', textAlignVertical: textAlignV,
    textDecoration: decorationMap[rawDecoration] || 'none',
    textTransform: caseMap[rawCase] || 'none',
    paragraphSpacing: (style.paragraphSpacing as number) ?? 0,
    textAutoResize: (style.textAutoResize as string) || 'NONE',
    color: textColor, spans,
  };

  // All optional typography properties
  const lineHeightUnit = style.lineHeightUnit as string | undefined;
  if (lineHeightUnit && lineHeightUnit !== 'INTRINSIC') result.lineHeightUnit = lineHeightUnit;
  const paragraphIndent = style.paragraphIndent as number | undefined;
  if (paragraphIndent && paragraphIndent > 0) result.paragraphIndent = paragraphIndent;
  if (node.textTruncation && node.textTruncation !== 'DISABLED') result.textTruncation = node.textTruncation as string;
  const maxLines = node.maxLines as number | undefined;
  if (maxLines !== undefined && maxLines > 0) result.maxLines = maxLines;
  const opentypeFlags = style.opentypeFlags as Record<string, number> | undefined;
  if (opentypeFlags && Object.keys(opentypeFlags).length > 0) result.openTypeFlags = opentypeFlags;
  if (style.fontPostScriptName) result.fontPostScriptName = style.fontPostScriptName as string;
  const hyperlink = style.hyperlink as { type: string; url?: string; nodeID?: string } | undefined;
  if (hyperlink) result.hyperlink = hyperlink;
  const lineHeightPercent = style.lineHeightPercentFontSize as number | undefined;
  if (lineHeightPercent !== undefined && lineHeightPercent > 0) result.lineHeightPercent = lineHeightPercent;
  const inheritTextStyleId = style.inheritTextStyleId as string | undefined;
  if (inheritTextStyleId) result.inheritTextStyleId = inheritTextStyleId;
  const lineIndentations = node.lineIndentations as number[] | undefined;
  if (Array.isArray(lineIndentations) && lineIndentations.some((v) => v > 0)) result.lineIndentations = lineIndentations;
  const lineTypes = node.lineTypes as string[] | undefined;
  if (Array.isArray(lineTypes) && lineTypes.some((v) => v !== 'NONE')) result.lineTypes = lineTypes;
  const textRangeFills = node.textRangeFills as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(textRangeFills) && textRangeFills.length > 0) result.textRangeFills = textRangeFills;

  return result;
}

function processVectorPaths(node: Record<string, unknown>): BlueprintVectorPath[] | undefined {
  const type = node.type as string;
  if (type !== 'VECTOR' && type !== 'BOOLEAN_OPERATION') return undefined;
  const fg = node.fillGeometry as Array<{ path: string; windingRule: string }> | undefined;
  if (!Array.isArray(fg) || fg.length === 0) return undefined;
  return fg.map((f) => ({ path: f.path || '', windingRule: f.windingRule || 'NONZERO' }));
}

function processStrokeGeometry(node: Record<string, unknown>): BlueprintVectorPath[] | undefined {
  const sg = node.strokeGeometry as Array<{ path: string; windingRule: string }> | undefined;
  if (!Array.isArray(sg) || sg.length === 0) return undefined;
  return sg.map((s) => ({ path: s.path || '', windingRule: s.windingRule || 'NONZERO' }));
}

function processArcData(node: Record<string, unknown>): BlueprintArcData | undefined {
  if (node.type !== 'ELLIPSE') return undefined;
  const arc = node.arcData as { startingAngle: number; endingAngle: number; innerRadius: number } | undefined;
  if (!arc) return undefined;
  const isFullCircle = arc.startingAngle === 0 && Math.abs(arc.endingAngle - 2 * Math.PI) < 0.001;
  if (isFullCircle && arc.innerRadius === 0) return undefined;
  return { startingAngle: arc.startingAngle, endingAngle: arc.endingAngle, innerRadius: arc.innerRadius };
}

function processInteractions(node: Record<string, unknown>): BlueprintInteraction[] | undefined {
  const raw = (node.interactions || node.reactions) as Array<any> | undefined;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const processed: BlueprintInteraction[] = [];
  for (const interaction of raw) {
    const trigger = interaction.trigger;
    if (!trigger) continue;
    let rawActions = interaction.actions as Array<any> | undefined;
    if (!Array.isArray(rawActions)) {
      const singleAction = interaction.action;
      rawActions = singleAction ? [singleAction] : [];
    }
    if (rawActions.length === 0) continue;
    const actions: BlueprintInteractionAction[] = rawActions.map((a: any) => {
      const transition = a.transition;
      const easing = transition?.easing;
      return {
        type: a.type || 'NODE',
        ...(a.destinationId ? { destinationId: a.destinationId } : {}),
        ...(a.url ? { url: a.url } : {}),
        ...(a.navigation ? { navigation: a.navigation } : {}),
        ...(a.preserveScrollPosition === true ? { preserveScrollPosition: true } : {}),
        ...(a.overlayRelativePosition ? { overlayRelativePosition: a.overlayRelativePosition } : {}),
        ...(transition ? {
          transition: {
            type: transition.type || 'DISSOLVE', duration: transition.duration || 0.3,
            easing: {
              type: easing?.type || 'EASE_IN_AND_OUT',
              ...(easing?.easingFunctionCubicBezier ? { easingFunctionCubicBezier: easing.easingFunctionCubicBezier } : {}),
            },
          },
        } : {}),
      };
    });
    processed.push({
      trigger: {
        type: trigger.type || 'ON_CLICK',
        ...(trigger.delay !== undefined ? { delay: trigger.delay } : {}),
        ...(trigger.timeout !== undefined ? { timeout: trigger.timeout } : {}),
      },
      actions,
    });
  }
  return processed.length > 0 ? processed : undefined;
}

// ---------------------------------------------------------------------------
// Component Auto-Mapping (COMPLETE — all patterns)
// ---------------------------------------------------------------------------

function autoMapComponent(node: Record<string, unknown>, children: Record<string, unknown>[]): RnMapping | null {
  const type = node.type as string;
  const name = ((node.name as string) || '').toLowerCase();

  if (type === 'TEXT') return { rnComponent: 'Text' };

  if (['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP'].includes(type) && children.length > 0) {
    const childNames = children.map((c) => ((c.name as string) || '').toLowerCase());
    const childTypes = children.map((c) => (c.type as string));

    // Phone input: "+91" text child
    const hasCountryCode = childNames.some((n) => n.includes('+91')) ||
      children.some((c) => ((c.characters as string) || '').includes('+91'));
    if (hasCountryCode) return { rnComponent: 'PhoneInput' };

    // OTP input: 4-6 equal-width child frames
    const frameChildren = children.filter((c) => ['FRAME', 'COMPONENT', 'INSTANCE'].includes(c.type as string));
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

    // TextInput: label + input/value/placeholder
    const hasLabel = childNames.some((n) => n.includes('label'));
    const hasInput = childNames.some((n) => n.includes('input') || n.includes('value') || n.includes('placeholder'));
    if (hasLabel && hasInput) return { rnComponent: 'TextInput' };

    // PrimaryButton: gradient fill + TEXT child
    const fills = node.fills as Array<any> | undefined;
    const hasGradient = Array.isArray(fills) && fills.some((f) => typeof f.type === 'string' && f.type.startsWith('GRADIENT_') && f.visible !== false);
    const hasTextChild = childTypes.some((t) => t === 'TEXT');
    if (hasGradient && hasTextChild) return { rnComponent: 'PrimaryButton' };
  }
  return null;
}

function isScreenWrapper(node: Record<string, unknown>, depth: number): boolean {
  if (depth !== 0) return false;
  return ['FRAME', 'COMPONENT'].includes(node.type as string);
}

// ---------------------------------------------------------------------------
// Tree Traversal (COMPLETE — every Figma property)
// ---------------------------------------------------------------------------

function traverseNodeTree(
  node: Record<string, unknown>, config: FigmaConfig, parentId: string | null,
  parentBbox: { x: number; y: number } | null, depth: number,
  allNodes: BlueprintNode[], assetNodeIds: Set<string>, rootBboxY: number,
): void {
  if (shouldSkipNode(node, config, rootBboxY)) return;

  const nodeId = node.id as string;
  const bbox = node.absoluteBoundingBox as { x: number; y: number; width: number; height: number } | undefined;
  const rotation = (node.rotation as number) ?? 0;
  let relX = 0, relY = 0, width = 0, height = 0;
  if (bbox) {
    if (parentBbox) { relX = Math.round((bbox.x - parentBbox.x) * 100) / 100; relY = Math.round((bbox.y - parentBbox.y) * 100) / 100; }
    width = bbox.width; height = bbox.height;
  }

  const fills = processFills(node.fills as unknown[] || []);
  for (const fill of fills) {
    if (fill.imageRef || (fill.type.startsWith('GRADIENT_') && fill.visible)) assetNodeIds.add(nodeId);
  }

  const rawChildren = (node.children as Record<string, unknown>[]) || [];
  const childIds = rawChildren.filter((c) => !shouldSkipNode(c, config, rootBboxY)).map((c) => c.id as string);

  // Auto-map
  const mapping = autoMapComponent(node, rawChildren);
  const isScreen = isScreenWrapper(node, depth);

  const bp: BlueprintNode = {
    id: nodeId, parentId, name: (node.name as string) || '', type: (node.type as string) || 'UNKNOWN',
    depth, visible: true,
    geometry: { x: relX, y: relY, width, height, rotation },
    opacity: (node.opacity as number) ?? 1,
    fills, strokes: processStrokes(node.strokes as unknown[] || [], node),
    effects: processEffects(node.effects as unknown[] || []),
    borderRadius: processBorderRadius(node),
    clipsContent: (node.clipsContent as boolean) ?? false,
  };

  // Individual stroke weights
  const isw = node.individualStrokeWeights as { top: number; right: number; bottom: number; left: number } | undefined;
  if (isw) bp.individualStrokeWeights = isw;

  // Layout
  const layout = processLayout(node);
  if (layout) bp.layout = layout;

  // Per-child auto-layout
  const layoutPositioning = node.layoutPositioning as string | undefined;
  if (layoutPositioning && layoutPositioning !== 'AUTO') bp.layoutPositioning = layoutPositioning;
  const layoutAlign = node.layoutAlign as string | undefined;
  if (layoutAlign && layoutAlign !== 'INHERIT') bp.layoutAlign = layoutAlign;
  const layoutGrow = node.layoutGrow as number | undefined;
  if (layoutGrow !== undefined && layoutGrow !== 0) bp.layoutGrow = layoutGrow;

  // Per-node sizing
  const sizingH = node.layoutSizingHorizontal as string | undefined;
  if (sizingH && sizingH !== 'FIXED') bp.layoutSizingHorizontal = sizingH;
  const sizingV = node.layoutSizingVertical as string | undefined;
  if (sizingV && sizingV !== 'FIXED') bp.layoutSizingVertical = sizingV;

  // Size constraints
  if (node.minWidth && (node.minWidth as number) > 0) bp.minWidth = node.minWidth as number;
  if (node.maxWidth && (node.maxWidth as number) > 0 && (node.maxWidth as number) < Infinity) bp.maxWidth = node.maxWidth as number;
  if (node.minHeight && (node.minHeight as number) > 0) bp.minHeight = node.minHeight as number;
  if (node.maxHeight && (node.maxHeight as number) > 0 && (node.maxHeight as number) < Infinity) bp.maxHeight = node.maxHeight as number;

  // Typography
  const typography = processTypography(node);
  if (typography) bp.typography = typography;

  // Vector paths
  const vectorPaths = processVectorPaths(node);
  if (vectorPaths) bp.vectorPaths = vectorPaths;
  const strokePaths = processStrokeGeometry(node);
  if (strokePaths) bp.strokePaths = strokePaths;

  // Arc data
  const arcData = processArcData(node);
  if (arcData) bp.arcData = arcData;

  // Component / Instance
  if (node.componentId) bp.componentId = node.componentId as string;
  if (node.componentProperties) bp.componentProperties = node.componentProperties as Record<string, unknown>;
  const compPropRefs = node.componentPropertyReferences as Record<string, string> | undefined;
  if (compPropRefs && Object.keys(compPropRefs).length > 0) bp.componentPropertyReferences = compPropRefs;

  // Constraints
  const constraints = node.constraints as { horizontal?: string; vertical?: string } | undefined;
  if (constraints && (constraints.horizontal || constraints.vertical)) {
    bp.constraints = { horizontal: constraints.horizontal || 'LEFT', vertical: constraints.vertical || 'TOP' };
  }

  // Blend mode
  const blendMode = node.blendMode as string | undefined;
  if (blendMode && blendMode !== 'NORMAL' && blendMode !== 'PASS_THROUGH') bp.blendMode = blendMode;

  // Interactions
  const interactions = processInteractions(node);
  if (interactions) bp.interactions = interactions;

  // Legacy prototyping
  if (node.transitionNodeID) bp.transitionNodeID = node.transitionNodeID as string;
  const transitionDuration = node.transitionDuration as number | undefined;
  if (transitionDuration !== undefined && transitionDuration > 0) bp.transitionDuration = transitionDuration;
  if (node.transitionEasing) bp.transitionEasing = node.transitionEasing as Record<string, unknown>;

  // Corner smoothing
  const cornerSmoothing = node.cornerSmoothing as number | undefined;
  if (cornerSmoothing !== undefined && cornerSmoothing > 0) bp.cornerSmoothing = cornerSmoothing;

  // Absolute bounds
  if (node.absoluteRenderBounds !== undefined) bp.absoluteRenderBounds = node.absoluteRenderBounds as any;
  if (bbox) bp.absoluteBoundingBox = bbox;

  // Scroll behavior
  if (node.scrollBehavior && node.scrollBehavior !== 'SCROLLS') bp.scrollBehavior = node.scrollBehavior as string;

  // Preserve aspect ratio
  if (node.preserveRatio === true) bp.preserveRatio = true;
  const targetAspectRatio = node.targetAspectRatio as number | undefined;
  if (targetAspectRatio !== undefined && targetAspectRatio > 0) bp.targetAspectRatio = targetAspectRatio;

  // Size & relative transform (geometry=paths)
  const sizeVec = node.size as { x: number; y: number } | undefined;
  if (sizeVec && (sizeVec.x > 0 || sizeVec.y > 0)) bp.size = sizeVec;
  const relTransform = node.relativeTransform as number[][] | undefined;
  if (relTransform && Array.isArray(relTransform) && relTransform.length === 2) bp.relativeTransform = relTransform;

  // Mask
  if (node.isMask === true) bp.isMask = true;
  if (node.isMaskOutline === true) bp.isMaskOutline = true;
  if (node.maskType) bp.maskType = node.maskType as string;

  // Lock / fixed
  if (node.locked === true) bp.locked = true;
  if (node.isFixed === true) bp.isFixed = true;

  // Export settings
  const exportSettings = node.exportSettings as Array<any> | undefined;
  if (Array.isArray(exportSettings) && exportSettings.length > 0) {
    bp.exportSettings = exportSettings.map((s) => ({
      suffix: (s.suffix as string) || '', format: (s.format as string) || 'PNG',
      constraint: (s.constraint as { type: string; value: number }) || { type: 'SCALE', value: 1 },
    }));
  }

  // Figma Variable bindings
  const boundVariables = node.boundVariables as Record<string, unknown> | undefined;
  if (boundVariables && Object.keys(boundVariables).length > 0) bp.boundVariables = boundVariables;

  // Style references
  const styles = node.styles as Record<string, string> | undefined;
  if (styles && Object.keys(styles).length > 0) bp.styleReferences = styles;

  // Dev status
  if (node.devStatus) bp.devStatus = node.devStatus as { type: string; description?: string };

  // Layout grids
  const layoutGrids = node.layoutGrids as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(layoutGrids) && layoutGrids.length > 0) bp.layoutGrids = layoutGrids;

  // Instance overrides
  const overriddenFields = node.overriddenFields as string[] | undefined;
  if (Array.isArray(overriddenFields) && overriddenFields.length > 0) bp.overriddenFields = overriddenFields;
  const overridesArr = node.overrides as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(overridesArr) && overridesArr.length > 0) bp.overrides = overridesArr;

  // Boolean operation
  if (node.booleanOperation) bp.booleanOperation = node.booleanOperation as string;

  // Shadow behind node
  if (node.showShadowBehindNode === true) bp.showShadowBehindNode = true;

  // Overflow direction
  if (node.overflowDirection && node.overflowDirection !== 'NONE') bp.overflowDirection = node.overflowDirection as string;

  // Strokes in layout
  if (node.strokesIncludedInLayout === true) bp.strokesIncludedInLayout = true;

  // Stroke miter angle (28.96 is default)
  const strokeMiterAngle = node.strokeMiterAngle as number | undefined;
  if (strokeMiterAngle !== undefined && strokeMiterAngle !== 28.96) bp.strokeMiterAngle = strokeMiterAngle;

  // Instance exposure
  if (node.isExposedInstance === true) bp.isExposedInstance = true;
  const exposedInstances = node.exposedInstances as string[] | undefined;
  if (Array.isArray(exposedInstances) && exposedInstances.length > 0) bp.exposedInstances = exposedInstances;

  // Component property definitions
  const compPropDefs = node.componentPropertyDefinitions as Record<string, unknown> | undefined;
  if (compPropDefs && Object.keys(compPropDefs).length > 0) bp.componentPropertyDefinitions = compPropDefs;

  // CSS Grid layout (layoutMode: GRID)
  const layoutMode = node.layoutMode as string | undefined;
  if (layoutMode === 'GRID') {
    const gl: Record<string, unknown> = {};
    if (node.gridRowCount) gl.rowCount = node.gridRowCount;
    if (node.gridColumnCount) gl.columnCount = node.gridColumnCount;
    if (node.gridRowGap) gl.rowGap = node.gridRowGap;
    if (node.gridColumnGap) gl.columnGap = node.gridColumnGap;
    if (node.gridColumnsSizing) gl.columnsSizing = node.gridColumnsSizing;
    if (node.gridRowsSizing) gl.rowsSizing = node.gridRowsSizing;
    if (Object.keys(gl).length > 0) bp.gridLayout = gl as BlueprintNode['gridLayout'];
  }

  // Per-child CSS Grid placement
  const gridChildHAlign = node.gridChildHorizontalAlign as string | undefined;
  const gridChildVAlign = node.gridChildVerticalAlign as string | undefined;
  if ((gridChildHAlign && gridChildHAlign !== 'AUTO') || (gridChildVAlign && gridChildVAlign !== 'AUTO')) {
    bp.gridChildAlign = {
      ...(gridChildHAlign && gridChildHAlign !== 'AUTO' ? { horizontal: gridChildHAlign } : {}),
      ...(gridChildVAlign && gridChildVAlign !== 'AUTO' ? { vertical: gridChildVAlign } : {}),
    };
  }
  const gridRowSpan = node.gridRowSpan as number | undefined;
  const gridColumnSpan = node.gridColumnSpan as number | undefined;
  if ((gridRowSpan && gridRowSpan > 1) || (gridColumnSpan && gridColumnSpan > 1)) {
    bp.gridSpan = {
      ...(gridRowSpan && gridRowSpan > 1 ? { rows: gridRowSpan } : {}),
      ...(gridColumnSpan && gridColumnSpan > 1 ? { columns: gridColumnSpan } : {}),
    };
  }
  const gridRowAnchor = node.gridRowAnchorIndex as number | undefined;
  const gridColAnchor = node.gridColumnAnchorIndex as number | undefined;
  if ((gridRowAnchor && gridRowAnchor > 0) || (gridColAnchor && gridColAnchor > 0)) {
    bp.gridAnchor = {
      ...(gridRowAnchor && gridRowAnchor > 0 ? { row: gridRowAnchor } : {}),
      ...(gridColAnchor && gridColAnchor > 0 ? { column: gridColAnchor } : {}),
    };
  }

  // Fill override table (VECTOR geometry=paths)
  const fillOverrideTable = node.fillOverrideTable as Record<string, unknown> | undefined;
  if (fillOverrideTable && Object.keys(fillOverrideTable).length > 0) bp.fillOverrideTable = fillOverrideTable;

  // Variable width stroke points
  const variableWidthPoints = node.variableWidthPoints as Array<{ x: number; y: number }> | undefined;
  if (Array.isArray(variableWidthPoints) && variableWidthPoints.length > 0) bp.variableWidthPoints = variableWidthPoints;

  // Complex stroke properties (Jan 2026 — skip default {"strokeType":"BASIC"})
  const complexStrokeProps = node.complexStrokeProperties as Record<string, unknown> | undefined;
  if (complexStrokeProps && Object.keys(complexStrokeProps).length > 0
    && !(Object.keys(complexStrokeProps).length === 1 && complexStrokeProps.strokeType === 'BASIC')) {
    bp.complexStrokeProperties = complexStrokeProps;
  }

  // Text path start data (Jan 2026)
  const textPathStart = node.textPathStartData as Record<string, unknown> | undefined;
  if (textPathStart && Object.keys(textPathStart).length > 0) bp.textPathStartData = textPathStart;

  // Transform modifiers (Jan 2026)
  const transformMods = node.transformModifiers as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(transformMods) && transformMods.length > 0) bp.transformModifiers = transformMods;

  // Auto-mapping
  if (isScreen) {
    bp.rnComponent = 'Screen';
  } else if (mapping) {
    bp.rnComponent = mapping.rnComponent;
    if (mapping.rnProps) bp.rnProps = mapping.rnProps;
  }

  // Child IDs
  if (childIds.length > 0) bp.childIds = childIds;

  allNodes.push(bp);

  // Recurse children
  const currentBbox = bbox ? { x: bbox.x, y: bbox.y } : parentBbox;
  for (const child of rawChildren) {
    traverseNodeTree(child, config, nodeId, currentBbox, depth + 1, allNodes, assetNodeIds, rootBboxY);
  }
}

// ---------------------------------------------------------------------------
// Background Detection
// ---------------------------------------------------------------------------

function detectBackground(rootNode: Record<string, unknown>, allNodes: BlueprintNode[]): BackgroundInfo {
  let bgColor = '#131313';
  let hasDottedPattern = false;
  let backgroundShapeKey: string | undefined;
  let gradient: BackgroundInfo['gradient'] | undefined;

  const rootFills = rootNode.fills as Array<any> | undefined;
  if (Array.isArray(rootFills)) {
    const solidFill = rootFills.find((f) => f.type === 'SOLID' && f.visible !== false);
    if (solidFill?.color) bgColor = figmaColorToHex(solidFill.color);
    const gradFill = rootFills.find((f) => typeof f.type === 'string' && f.type.startsWith('GRADIENT_') && f.visible !== false);
    if (gradFill?.gradientStops) {
      gradient = { type: gradFill.type, stops: gradFill.gradientStops.map((s: any) => ({ color: figmaColorToHex(s.color), position: s.position })) };
    }
  }

  const screenName = ((rootNode.name as string) || '').toLowerCase();
  const dottedPatternNames = ['dotted', 'pattern', 'noise', 'texture'];
  for (const node of allNodes) {
    const name = node.name.toLowerCase();
    if (dottedPatternNames.some((p) => name.includes(p))) hasDottedPattern = true;
    if (name.includes('background') && name.includes('shape')) {
      hasDottedPattern = true;
      if (screenName.includes('splash')) backgroundShapeKey = 'splash';
      else if (screenName.includes('carousel')) {
        const m = screenName.match(/carousel\s*(\d)/);
        backgroundShapeKey = m ? `carousel${m[1]}` : 'carousel1';
      } else if (screenName.includes('agreement')) backgroundShapeKey = 'agreement';
      else backgroundShapeKey = 'default';
    }
  }
  return { color: bgColor, hasDottedPattern, backgroundShapeKey, gradient };
}

// ---------------------------------------------------------------------------
// Token Mapping
// ---------------------------------------------------------------------------

function buildTokensUsed(nodes: BlueprintNode[], tokens: DesignTokens): TokensUsed {
  const colors: Record<string, string> = {};
  const typography: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const radius: Record<string, string> = {};

  const seenColors = new Set<string>();
  const seenTypo = new Set<string>();
  const seenSpacing = new Set<number>();
  const seenRadius = new Set<number>();

  for (const node of nodes) {
    for (const fill of node.fills) {
      if (fill.color) seenColors.add(fill.color);
      fill.gradientStops?.forEach((s) => seenColors.add(s.color));
    }
    for (const stroke of node.strokes) seenColors.add(stroke.color);
    for (const effect of node.effects) {
      if (effect.color) seenColors.add(effect.color.length > 7 ? effect.color.slice(0, 7) : effect.color);
    }
    if (node.typography) {
      seenColors.add(node.typography.color);
      node.typography.spans.forEach((s) => { if (s.color) seenColors.add(s.color); });
      const t = node.typography;
      seenTypo.add(`${Math.round(t.fontSize)}:${Math.round(t.lineHeight)}:${t.fontWeight}`);
    }
    if (node.layout) {
      const l = node.layout;
      if (l.gap > 0) seenSpacing.add(l.gap);
      if (l.padding.top > 0) seenSpacing.add(l.padding.top);
      if (l.padding.right > 0) seenSpacing.add(l.padding.right);
      if (l.padding.bottom > 0) seenSpacing.add(l.padding.bottom);
      if (l.padding.left > 0) seenSpacing.add(l.padding.left);
    }
    const br = node.borderRadius;
    if (typeof br === 'number' && br > 0) seenRadius.add(br);
    else if (typeof br === 'object') {
      if (br.tl > 0) seenRadius.add(br.tl);
      if (br.tr > 0) seenRadius.add(br.tr);
      if (br.br > 0) seenRadius.add(br.br);
      if (br.bl > 0) seenRadius.add(br.bl);
    }
  }

  seenColors.forEach((hex) => { const t = tokens._colorByHex[hex.toUpperCase()]; if (t) colors[hex] = t; });
  seenTypo.forEach((key) => { const t = tokens._typographyByStyle[key]; if (t) typography[key] = t; });
  seenSpacing.forEach((v) => { const t = tokens._spacingByValue[String(v)]; if (t) spacing[String(v)] = t; });
  seenRadius.forEach((v) => { const t = tokens._radiusByValue[String(v)]; if (t) radius[String(v)] = t; });

  return { colors, typography, spacing, radius };
}

// ---------------------------------------------------------------------------
// Asset Collection & Download (with post-validation + corrupt cleanup)
// ---------------------------------------------------------------------------

async function collectAndDownloadAssets(
  config: FigmaConfig, assetNodeIds: Set<string>, nodes: BlueprintNode[],
  assetsDir: string, screenFileId: string,
): Promise<BlueprintAsset[]> {
  if (assetNodeIds.size === 0) return [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const assetIds = [...assetNodeIds];
  log('info', `Fetching URLs for ${assetIds.length} assets`);
  const urlMap = await fetchAssetImageUrls(config, assetIds);
  const assets: BlueprintAsset[] = [];
  fs.mkdirSync(assetsDir, { recursive: true });

  for (const nodeId of assetIds) {
    const downloadUrl = urlMap[toApiId(nodeId)];
    if (!downloadUrl) continue;
    const nodeInfo = nodeMap.get(nodeId);
    const nodeName = nodeInfo?.name || nodeId;
    let usage = 'decoration';
    const ln = nodeName.toLowerCase();
    if (ln.includes('background') || ln.includes('bg')) usage = 'background';
    else if (ln.includes('pattern') || ln.includes('dotted') || ln.includes('texture')) usage = 'pattern';
    else if (ln.includes('icon')) usage = 'icon';
    else if (ln.includes('image') || ln.includes('photo')) usage = 'image';
    else if (ln.includes('gradient')) usage = 'gradient';
    else if (ln.includes('logo')) usage = 'logo';

    let imageRef = '';
    if (nodeInfo) { for (const fill of nodeInfo.fills) { if (fill.imageRef) { imageRef = fill.imageRef; break; } } }
    if (!imageRef) imageRef = toFileId(nodeId);

    const safeName = nodeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
    const localFilename = `${screenFileId}_${safeName}.png`;
    const localPath = path.join(assetsDir, localFilename);

    try {
      await downloadImage(downloadUrl, localPath);
      // Post-download re-validation
      const assetCheck = validateImageFile(localPath, `asset:${localFilename}`);
      if (!assetCheck.valid) {
        log('warn', `  Asset downloaded but corrupt: ${assetCheck.reason}`);
        try { fs.unlinkSync(localPath); } catch { /* ignore */ }
        continue;
      }
      log('info', `  Downloaded: ${localFilename}`);
    } catch (err) {
      log('warn', `  Failed: ${nodeName}: ${err}`);
      continue;
    }
    assets.push({ imageRef, nodeId, nodeName, usage, downloadUrl, localPath: `assets/${localFilename}` });
  }
  return assets;
}

// ---------------------------------------------------------------------------
// Cross-Check Manifest (for MCP validation)
// ---------------------------------------------------------------------------

function buildCrossCheckManifest(
  blueprint: ScreenBlueprint,
  allNodes: BlueprintNode[],
  figmaUrl: string,
): CrossCheckManifest {
  const textNodes = allNodes.filter((n) => n.typography);
  const componentInstances = allNodes.filter((n) => n.componentId);
  const interactiveNodes = allNodes.filter((n) => n.interactions && n.interactions.length > 0);

  // Collect all unique colors
  const allColors = new Set<string>();
  for (const node of allNodes) {
    for (const fill of node.fills) { if (fill.color) allColors.add(fill.color); }
    if (node.typography) allColors.add(node.typography.color);
  }

  // Collect all spacing values
  const allSpacing = new Set<number>();
  for (const node of allNodes) {
    if (node.layout) {
      const l = node.layout;
      if (l.gap > 0) allSpacing.add(l.gap);
      [l.padding.top, l.padding.right, l.padding.bottom, l.padding.left].forEach((v) => { if (v > 0) allSpacing.add(v); });
    }
  }

  // Top-level children names (depth 1)
  const topLevelChildren = allNodes.filter((n) => n.depth === 1).map((n) => n.name);

  // Text contents for validation
  const textContents = textNodes.slice(0, 50).map((n) => ({
    nodeId: n.id, name: n.name,
    content: n.typography!.content.slice(0, 100),
    fontSize: n.typography!.fontSize,
    fontWeight: n.typography!.fontWeight,
    color: n.typography!.color,
  }));

  // Interaction summary
  const interactionSummary = interactiveNodes.slice(0, 20).flatMap((n) =>
    (n.interactions || []).map((i) => ({
      sourceNode: n.name, trigger: i.trigger.type,
      destination: i.actions[0]?.destinationId || undefined,
    }))
  );

  return {
    screenId: blueprint.meta.screenId,
    screenName: blueprint.meta.screenName,
    figmaUrl,
    generatedAt: blueprint.meta.generatedAt,
    checks: {
      nodeCount: allNodes.length,
      textNodeCount: textNodes.length,
      componentInstanceCount: componentInstances.length,
      interactiveNodeCount: interactiveNodes.length,
      imageAssetCount: blueprint.assets.length,
      variableCount: blueprint.variableMeta ? Object.keys(blueprint.variableMeta.variables).length : 0,
      rootDimensions: blueprint.meta.dimensions,
      backgroundColor: blueprint.background.color,
      hasDottedPattern: blueprint.background.hasDottedPattern,
      topLevelChildNames: topLevelChildren,
      textContents,
      colorPalette: [...allColors].sort(),
      spacingValues: [...allSpacing].sort((a, b) => a - b),
      componentIds: [...new Set(componentInstances.map((n) => n.componentId!))],
      interactionSummary,
    },
  };
}

// ---------------------------------------------------------------------------
// Main Pipeline (4 steps — COMPLETE)
// ---------------------------------------------------------------------------

async function extractScreen(inputArg: string): Promise<void> {
  const startTime = Date.now();
  log('info', '=== Figma 1:1 Parity — Screen Extractor (COMPLETE) ===');
  log('info', `Input: ${inputArg}`);

  const parsed = parseInput(inputArg);
  const fileId = toFileId(parsed.nodeId);
  const apiId = toApiId(parsed.nodeId);
  log('info', `Node ID: ${apiId} (file: ${fileId})`);

  const config = loadFigmaConfig(parsed.fileKey || undefined);
  const tokens = loadDesignTokens();

  const dataDir = path.resolve(__dirname, 'data');
  const baselinesDir = path.resolve(__dirname, 'baselines');
  const assetsDir = path.resolve(__dirname, 'assets');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(baselinesDir, { recursive: true });

  // -----------------------------------------------------------------------
  // Step 1/4: Fetch node tree
  // -----------------------------------------------------------------------
  log('info', '\nSTEP 1/4: Fetching full node tree from Figma...');
  const figmaResponse = await fetchNodeTree(config, apiId);
  const nodeTree = figmaResponse.document;
  if (Object.keys(figmaResponse.components).length > 0) log('info', `  Components: ${Object.keys(figmaResponse.components).length}`);
  if (Object.keys(figmaResponse.componentSets).length > 0) log('info', `  Component Sets: ${Object.keys(figmaResponse.componentSets).length}`);
  if (Object.keys(figmaResponse.styles).length > 0) log('info', `  Styles: ${Object.keys(figmaResponse.styles).length}`);

  // -----------------------------------------------------------------------
  // Step 2/4: Fetch Figma Variables
  // -----------------------------------------------------------------------
  log('info', '\nSTEP 2/4: Fetching Figma variables...');
  const variablesData = await fetchVariables(config);

  // -----------------------------------------------------------------------
  // Step 3/4: Fetch baseline image
  // -----------------------------------------------------------------------
  log('info', '\nSTEP 3/4: Fetching baseline screenshot...');
  const baselinePath = path.join(baselinesDir, `${fileId}-baseline.png`);
  try {
    const imageUrl = await fetchBaselineUrl(config, apiId);
    await downloadImage(imageUrl, baselinePath);
    const baselineCheck = validateImageFile(baselinePath, 'baseline');
    if (baselineCheck.valid) {
      log('info', `Baseline saved and validated: ${baselinePath}`);
    } else {
      log('error', `Baseline saved but CORRUPT: ${baselineCheck.reason}`);
      log('error', 'Deleting corrupt baseline.');
      try { fs.unlinkSync(baselinePath); } catch { /* ignore */ }
    }
  } catch (err) {
    log('warn', `Failed to download baseline: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Step 4/4: Process node tree
  // -----------------------------------------------------------------------
  log('info', '\nSTEP 4/4: Processing node tree...');
  const allNodes: BlueprintNode[] = [];
  const assetNodeIds = new Set<string>();
  const rootBbox = nodeTree.absoluteBoundingBox as { x: number; y: number; width: number; height: number } | undefined;
  traverseNodeTree(nodeTree, config, null, null, 0, allNodes, assetNodeIds, rootBbox?.y ?? 0);
  log('info', `  Nodes: ${allNodes.length}`);
  log('info', `  Asset candidates: ${assetNodeIds.size}`);

  const background = detectBackground(nodeTree, allNodes);
  log('info', `  Background: ${background.color} | DottedPattern: ${background.hasDottedPattern}`);

  const tokensUsed = buildTokensUsed(allNodes, tokens);
  log('info', `  Tokens: ${Object.keys(tokensUsed.colors).length} colors, ${Object.keys(tokensUsed.typography).length} typo, ${Object.keys(tokensUsed.spacing).length} spacing, ${Object.keys(tokensUsed.radius).length} radius`);

  // Download assets
  let assets: BlueprintAsset[] = [];
  if (assetNodeIds.size > 0) {
    log('info', '\nDownloading image assets...');
    assets = await collectAndDownloadAssets(config, assetNodeIds, allNodes, assetsDir, fileId);
    log('info', `  Downloaded ${assets.length} assets`);
  }

  // Aggregate prototyping flows
  const flows: ScreenBlueprint['prototyping'] extends { flows: infer F } ? F extends Array<infer T> ? T[] : never : never = [];
  for (const bpNode of allNodes) {
    if (bpNode.interactions) {
      for (const interaction of bpNode.interactions) {
        for (const action of interaction.actions) {
          flows.push({
            sourceNodeId: bpNode.id, sourceNodeName: bpNode.name, trigger: interaction.trigger.type,
            ...(action.destinationId ? { destinationNodeId: action.destinationId } : {}),
            ...(action.transition ? { transitionType: action.transition.type, transitionDuration: action.transition.duration } : {}),
          });
        }
      }
    }
    if (bpNode.transitionNodeID) {
      flows.push({
        sourceNodeId: bpNode.id, sourceNodeName: bpNode.name, trigger: 'ON_CLICK',
        destinationNodeId: bpNode.transitionNodeID,
        ...(bpNode.transitionDuration ? { transitionDuration: bpNode.transitionDuration } : {}),
      });
    }
  }
  log('info', `  Prototyping flows: ${flows.length}`);

  // -----------------------------------------------------------------------
  // Assemble blueprint
  // -----------------------------------------------------------------------
  const screenName = (nodeTree.name as string) || `Screen ${fileId}`;
  const blueprint: ScreenBlueprint = {
    meta: {
      screenId: fileId, screenName, figmaUrl: parsed.figmaUrl,
      dimensions: { width: config.baseDesignWidth, height: config.baseDesignHeight },
      generatedAt: new Date().toISOString(), figmaFileKey: config.fileKey,
    },
    background, nodes: allNodes, assets, tokensUsed,
    prototyping: { hasInteractions: flows.length > 0, flowCount: flows.length, flows },
    // Component metadata
    ...(Object.keys(figmaResponse.components).length > 0 ? {
      componentMeta: Object.fromEntries(Object.entries(figmaResponse.components).map(([id, c]) => [id, {
        key: (c.key as string) || '', name: (c.name as string) || '',
        ...(c.description ? { description: c.description as string } : {}),
        ...(c.componentSetId ? { componentSetId: c.componentSetId as string } : {}),
        ...(c.documentationLinks ? { documentationLinks: c.documentationLinks as Array<{ uri: string }> } : {}),
      }])),
    } : {}),
    // Component SET metadata
    ...(Object.keys(figmaResponse.componentSets).length > 0 ? {
      componentSetMeta: Object.fromEntries(Object.entries(figmaResponse.componentSets).map(([id, cs]) => [id, {
        key: (cs.key as string) || '', name: (cs.name as string) || '',
        ...(cs.description ? { description: cs.description as string } : {}),
      }])),
    } : {}),
    // Style metadata
    ...(Object.keys(figmaResponse.styles).length > 0 ? {
      styleMeta: Object.fromEntries(Object.entries(figmaResponse.styles).map(([id, s]) => [id, {
        key: (s.key as string) || '', name: (s.name as string) || '',
        styleType: (s.styleType as string) || 'FILL',
        ...(s.description ? { description: s.description as string } : {}),
      }])),
    } : {}),
    // Variable metadata
    ...(variablesData.variables && Object.keys(variablesData.variables).length > 0 ? {
      variableMeta: {
        variables: Object.fromEntries(Object.entries(variablesData.variables).map(([id, v]) => [id, {
          name: v.name, resolvedType: v.resolvedType, collectionName: v.collectionName, valuesByMode: v.valuesByMode,
        }])),
        collections: variablesData.collections,
      },
    } : {}),
  };

  // Write blueprint JSON
  const blueprintPath = path.join(dataDir, `${fileId}-blueprint.json`);
  fs.writeFileSync(blueprintPath, JSON.stringify(blueprint, null, 2), 'utf-8');

  // -----------------------------------------------------------------------
  // Build & write cross-check manifest for MCP validation
  // -----------------------------------------------------------------------
  log('info', '\nBuilding MCP cross-check manifest...');
  const crossCheck = buildCrossCheckManifest(blueprint, allNodes, parsed.figmaUrl);
  const crossCheckPath = path.join(dataDir, `${fileId}-crosscheck.json`);
  fs.writeFileSync(crossCheckPath, JSON.stringify(crossCheck, null, 2), 'utf-8');
  log('info', `Cross-check manifest: ${crossCheckPath}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  log('info', '\n=== Extraction Complete ===');
  log('info', `Blueprint:   ${blueprintPath}`);
  log('info', `Cross-check: ${crossCheckPath}`);
  log('info', `Baseline:    ${baselinePath}`);
  log('info', `Screen:      ${screenName}`);
  log('info', `Nodes:       ${allNodes.length}`);
  log('info', `Assets:      ${assets.length}`);
  log('info', `Flows:       ${flows.length}`);
  log('info', `Variables:   ${Object.keys(variablesData?.variables || {}).length}`);
  log('info', `Time:        ${elapsed}s`);
  log('info', '');
  log('info', '>>> Next: Claude will cross-check via Figma MCP tools <<<');
  log('info', '    get_design_context  → validate node structure & styles');
  log('info', '    get_variable_defs   → validate design token bindings');
  log('info', '    get_metadata        → validate layer hierarchy');
  log('info', '    get_screenshot      → visual baseline comparison');
}

// ---------------------------------------------------------------------------
// CLI Entry
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg || arg === '--help' || arg === '-h') {
    console.log(`
Figma 1:1 Parity — Screen Extractor (COMPLETE)
-------------------------------------------------
Usage:
  npx tsx figma-1on1parity/extract-screen.ts <figma-dev-url-or-node-id>

Arguments:
  figma-dev-url   Full Figma DEV URL with ?node-id=X-Y parameter
  node-id         Raw Figma node ID (1-29108 or 1:29108)

Output:
  figma-1on1parity/data/{screenId}-blueprint.json      Full screen blueprint
  figma-1on1parity/data/{screenId}-crosscheck.json     MCP validation manifest
  figma-1on1parity/baselines/{screenId}-baseline.png   Figma baseline screenshot

Cross-Check (run by Claude after extraction):
  1. get_design_context  → validate node structure & computed styles
  2. get_variable_defs   → validate design token variable bindings
  3. get_metadata         → validate layer hierarchy completeness
  4. get_screenshot       → visual baseline for comparison

Examples:
  npx tsx figma-1on1parity/extract-screen.ts "https://www.figma.com/design/HZaVuwWn6B6jOjrmxZ7Kzv/Flent?node-id=1-29108"
  npx tsx figma-1on1parity/extract-screen.ts 1-29108
`);
    process.exit(arg ? 0 : 1);
  }

  try {
    await extractScreen(arg);
  } catch (err) {
    log('error', `Fatal: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) log('debug', err.stack);
    process.exit(1);
  }
}

main();
