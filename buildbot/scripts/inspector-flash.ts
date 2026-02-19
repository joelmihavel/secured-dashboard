/**
 * Gemini 3 Flash Deep Visual Inspector
 *
 * 5-pass forensic pixel-level inspection tool for comparing app screenshots
 * against Figma baselines using Gemini 3 Flash vision capabilities.
 *
 * Passes:
 *   1. Full Screen Overview       — holistic visual diff
 *   2. Component Crop Inspection  — per-component property audit
 *   3. Spacing Ruler Check        — spacing measurement verification
 *   4. Icon & Asset Verification  — icon/image correctness
 *   5. State Check (conditional)  — multi-state verification notes
 *
 * Usage:
 *   npx tsx scripts/inspector-flash.ts \
 *     --screenshot data/screenshots/41-8760.png \
 *     --baseline data/baselines/41-8760-baseline.png \
 *     --blueprint data/blueprints/41-8760-blueprint.json \
 *     --output reports/audits/41-8760-inspection.json
 *
 * All paths relative to buildbot/ directory.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const BUILDBOT_ROOT = path.join(__dirname, '..');

// Load .env from buildbot root
const envPath = path.join(BUILDBOT_ROOT, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Difference {
  element: string;
  issue: string;
  severity: 'critical' | 'major' | 'minor';
}

interface ComponentProperty {
  name: string;
  status: 'match' | 'mismatch';
  expected?: string;
  actual?: string;
}

interface ComponentInspection {
  name: string;
  properties: ComponentProperty[];
}

interface SpacingMismatch {
  measurement: string;
  expected: number;
  actual: number;
  diffPx: number;
}

interface IconResult {
  name: string;
  status: 'match' | 'mismatch' | 'missing';
  details?: string;
}

interface StateCheckResult {
  applicable: boolean;
  states?: string[];
  notes?: string;
}

interface PassResults {
  fullScreen: {
    score: number;
    differences: Difference[];
  };
  components: ComponentInspection[];
  spacing: {
    mismatches: SpacingMismatch[];
  };
  icons: IconResult[];
  stateCheck?: StateCheckResult;
}

interface InspectorReport {
  screenId: string;
  timestamp: string;
  model: string;
  overallScore: number;
  passes: PassResults;
  criticalIssues: string[];
  suggestions: string[];
}

interface BlueprintNode {
  nodeId: string;
  nodeName?: string;
  name?: string;
  nodeType?: string;
  type?: string;
  geometry?: { x: number; y: number; width: number; height: number };
  figmaData?: {
    type?: string;
    geometry?: { x: number; y: number; width: number; height: number };
    fills?: Array<{ type: string; visible?: boolean }>;
    characters?: string;
  };
  computedStyles?: Record<string, unknown>;
  children?: BlueprintNode[];
  rnStyles?: Record<string, unknown>;
}

interface BlueprintMeta {
  stateName?: string;
  screenId?: string;
  figmaId?: string;
  [key: string]: unknown;
}

interface Blueprint {
  meta?: BlueprintMeta;
  componentTree?: BlueprintNode;
  nodes?: BlueprintNode[];
  children?: BlueprintNode[];
  [key: string]: unknown;
}

interface CliArgs {
  screenshot: string;
  baseline: string;
  blueprint: string;
  output: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${message}`);
}

function logError(message: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] ERROR: ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Validate that an image file is a real, non-corrupt PNG.
 * Checks: exists, non-empty, has valid PNG header.
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

function loadImageAsBase64(filePath: string): string | null {
  try {
    const check = validateImageFile(filePath, path.basename(filePath));
    if (!check.valid) {
      logError(`Image validation failed: ${check.reason}`);
      return null;
    }
    return fs.readFileSync(filePath).toString('base64');
  } catch (err) {
    logError(`Failed to read image: ${filePath} - ${err}`);
    return null;
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

/**
 * Derive screen ID from screenshot filename.
 * e.g. "41-8760.png" => "41-8760"
 */
function deriveScreenId(screenshotPath: string): string {
  return path.basename(screenshotPath, path.extname(screenshotPath));
}

// ---------------------------------------------------------------------------
// Gemini API Client (raw HTTPS, no npm deps)
// ---------------------------------------------------------------------------

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiRequestBody {
  contents: Array<{ parts: GeminiPart[] }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType?: string;
    mediaResolution: string;
  };
}

/**
 * Call Gemini API via HTTPS POST.
 * Returns parsed JSON from the model response.
 * Retries up to `maxRetries` times with exponential backoff on failure.
 */
async function callGemini(
  prompt: string,
  images: Array<{ base64: string; mimeType: string }>,
  maxRetries: number = 3,
  retryJsonStrict: boolean = false
): Promise<unknown> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Check buildbot/.env');
  }

  const parts: GeminiPart[] = [
    { text: retryJsonStrict ? `${prompt}\n\nIMPORTANT: respond ONLY in valid JSON.` : prompt },
  ];

  for (const img of images) {
    parts.push({
      inlineData: { mimeType: img.mimeType, data: img.base64 },
    });
  }

  const body: GeminiRequestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 16384, // Increased from 8192 — Pass 2 with 3+ components can exceed 8K
      responseMimeType: 'application/json', // Force JSON output — no markdown wrapping
      mediaResolution: 'MEDIA_RESOLUTION_HIGH',
    },
  };

  const payload = JSON.stringify(body);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const raw = await httpsPost(GEMINI_URL, payload);
      const response = JSON.parse(raw);

      // Check for API-level error
      if (response.error) {
        throw new Error(`Gemini API error: ${response.error.message || JSON.stringify(response.error)}`);
      }

      const textContent =
        response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!textContent) {
        throw new Error('Empty response from Gemini');
      }

      // Parse JSON from the response
      return parseJsonFromText(textContent);
    } catch (err) {
      const isLast = attempt === maxRetries;
      const errStr = String(err);
      const is429 = errStr.includes('HTTP_429');

      if (isLast) {
        // On final retry, if JSON parsing failed, try again with strict JSON instruction
        if (!retryJsonStrict && errStr.includes('JSON')) {
          log('JSON parse failed, retrying with strict JSON instruction...');
          return callGemini(prompt, images, 1, true);
        }
        throw err;
      }

      // 429 rate limit: wait much longer (30s, 60s) before retrying
      const backoff = is429 ? attempt * 30_000 : attempt * 10_000;
      const reason = is429 ? 'rate limited (429)' : 'error';
      logError(`Attempt ${attempt}/${maxRetries} ${reason}: ${errStr.slice(0, 120)}. Retrying in ${backoff / 1000}s...`);
      await sleep(backoff);
    }
  }

  throw new Error('callGemini: unreachable');
}

/**
 * Raw HTTPS POST request. Returns response body as string.
 */
function httpsPost(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: 443,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode && res.statusCode >= 400) {
          // Embed status code in a detectable format for callers (e.g. 429 rate limit)
          reject(new Error(`HTTP_${res.statusCode}: ${data.slice(0, 500)}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120_000, () => {
      req.destroy(new Error('Request timeout (120s)'));
    });
    req.write(body);
    req.end();
  });
}

/**
 * Extract and parse JSON from model text output.
 * Handles markdown fences, leading text, etc.
 */
function parseJsonFromText(text: string): unknown {
  // Strip markdown code fences
  const stripped = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Try parsing the whole thing
  try {
    return JSON.parse(stripped);
  } catch {
    // Fall through
  }

  // Try extracting the first JSON object
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // Fall through
    }
  }

  // Try extracting a JSON array
  const arrMatch = stripped.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {
      // Fall through
    }
  }

  throw new Error(`Failed to parse JSON from Gemini response. First 300 chars: ${stripped.slice(0, 300)}`);
}

// ---------------------------------------------------------------------------
// Blueprint Helpers
// ---------------------------------------------------------------------------

function getNodeGeometry(node: BlueprintNode): { x: number; y: number; width: number; height: number } | null {
  return node.geometry || node.figmaData?.geometry || null;
}

function getNodeName(node: BlueprintNode): string {
  return node.nodeName || node.name || node.nodeId || 'unnamed';
}

function getNodeType(node: BlueprintNode): string {
  return node.nodeType || node.figmaData?.type || node.type || 'UNKNOWN';
}

/**
 * Flatten blueprint into an array of all nodes.
 */
function flattenNodes(root: BlueprintNode | Blueprint): BlueprintNode[] {
  const result: BlueprintNode[] = [];

  function traverse(node: BlueprintNode, depth: number): void {
    (node as BlueprintNode & { _depth: number })._depth = depth;
    result.push(node);
    const children = node.children || [];
    for (const child of children) {
      traverse(child, depth + 1);
    }
  }

  // Handle different blueprint structures
  if ('componentTree' in root && root.componentTree) {
    traverse(root.componentTree, 0);
  } else if ('children' in root && Array.isArray(root.children)) {
    for (const child of root.children) {
      traverse(child, 0);
    }
  } else if ('nodes' in root && Array.isArray(root.nodes)) {
    // Blueprint format: flat nodes array with `depth` field and `id`/`name`/`type` keys
    for (const n of root.nodes) {
      // Use the node's own depth field from the blueprint (set by extractor)
      const nodeDepth = (n as any).depth ?? 0;
      (n as BlueprintNode & { _depth: number })._depth = nodeDepth;
      // Normalize field names for inspector compatibility
      if ((n as any).id && !n.nodeId) n.nodeId = (n as any).id;
      if ((n as any).name && !n.nodeName) n.nodeName = (n as any).name;
      if ((n as any).type && !n.nodeType) n.nodeType = (n as any).type;
      result.push(n);
    }
  } else {
    // Treat root itself as a node
    traverse(root as BlueprintNode, 0);
  }

  return result;
}

/**
 * Get major component nodes: depth 1-2, width > 50, height > 30.
 */
function getMajorComponents(blueprint: Blueprint): BlueprintNode[] {
  const all = flattenNodes(blueprint);
  return all.filter((node) => {
    const d = (node as BlueprintNode & { _depth: number })._depth;
    if (d < 1 || d > 2) return false;
    const geo = getNodeGeometry(node);
    if (!geo) return false;
    return geo.width > 50 && geo.height > 30;
  });
}

/**
 * Extract spacing values from blueprint for Pass 3.
 * Analyzes gaps between sibling nodes and padding within containers.
 */
function extractSpacingChecklist(blueprint: Blueprint): string[] {
  const checks: string[] = [];
  const all = flattenNodes(blueprint);

  // Find root geometry for safe-area offset
  const rootGeo = all.length > 0 ? getNodeGeometry(all[0]) : null;

  // Find first non-root node for safe area spacing
  const topLevelChildren = all.filter(
    (n) => (n as BlueprintNode & { _depth: number })._depth === 1
  );

  if (topLevelChildren.length > 0 && rootGeo) {
    const firstChild = topLevelChildren[0];
    const firstGeo = getNodeGeometry(firstChild);
    if (firstGeo) {
      const topOffset = firstGeo.y - (rootGeo.y || 0);
      if (topOffset > 0) {
        checks.push(
          `Top safe area to first element ("${getNodeName(firstChild)}"): expected ${Math.round(topOffset)}px`
        );
      }
    }
  }

  // Sibling gaps at depth 1
  const sorted = topLevelChildren
    .map((n) => ({ node: n, geo: getNodeGeometry(n) }))
    .filter((item): item is { node: BlueprintNode; geo: NonNullable<ReturnType<typeof getNodeGeometry>> } =>
      item.geo !== null
    )
    .sort((a, b) => a.geo.y - b.geo.y);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const gap = next.geo.y - (current.geo.y + current.geo.height);
    if (gap > 0) {
      checks.push(
        `"${getNodeName(current.node)}" to "${getNodeName(next.node)}" gap: expected ${Math.round(gap)}px`
      );
    }
  }

  // Container padding for depth-1 nodes that have children
  for (const node of topLevelChildren) {
    const parentGeo = getNodeGeometry(node);
    if (!parentGeo) continue;
    const children = node.children || [];
    if (children.length === 0) continue;

    const childGeos = children
      .map((c) => getNodeGeometry(c))
      .filter((g): g is NonNullable<typeof g> => g !== null);

    if (childGeos.length === 0) continue;

    const minX = Math.min(...childGeos.map((g) => g.x));
    const minY = Math.min(...childGeos.map((g) => g.y));
    const maxRight = Math.max(...childGeos.map((g) => g.x + g.width));
    const maxBottom = Math.max(...childGeos.map((g) => g.y + g.height));

    const paddingLeft = Math.round(minX - parentGeo.x);
    const paddingTop = Math.round(minY - parentGeo.y);
    const paddingRight = Math.round(parentGeo.x + parentGeo.width - maxRight);
    const paddingBottom = Math.round(parentGeo.y + parentGeo.height - maxBottom);

    if (paddingLeft > 0 || paddingRight > 0 || paddingTop > 0 || paddingBottom > 0) {
      checks.push(
        `"${getNodeName(node)}" padding: expected top=${paddingTop}px right=${paddingRight}px bottom=${paddingBottom}px left=${paddingLeft}px`
      );
    }
  }

  // Gaps between children within depth-1 containers
  for (const node of topLevelChildren) {
    const children = node.children || [];
    if (children.length < 2) continue;

    const childSorted = children
      .map((c) => ({ node: c, geo: getNodeGeometry(c) }))
      .filter(
        (item): item is { node: BlueprintNode; geo: NonNullable<ReturnType<typeof getNodeGeometry>> } =>
          item.geo !== null
      )
      .sort((a, b) => a.geo.y - b.geo.y);

    for (let i = 0; i < childSorted.length - 1; i++) {
      const curr = childSorted[i];
      const nxt = childSorted[i + 1];
      const gap = nxt.geo.y - (curr.geo.y + curr.geo.height);
      if (gap > 0) {
        checks.push(
          `Inside "${getNodeName(node)}": "${getNodeName(curr.node)}" to "${getNodeName(nxt.node)}" gap: expected ${Math.round(gap)}px`
        );
      }
    }
  }

  return checks;
}

/**
 * Get vector/image nodes from blueprint for Pass 4.
 */
function getIconNodes(blueprint: Blueprint): BlueprintNode[] {
  const all = flattenNodes(blueprint);
  return all.filter((node) => {
    const t = getNodeType(node).toUpperCase();
    return t === 'VECTOR' || t === 'BOOLEAN_OPERATION' || t === 'INSTANCE' || t === 'COMPONENT' || t === 'SVG';
  });
}

// ---------------------------------------------------------------------------
// ImageMagick crop helper
// ---------------------------------------------------------------------------

function cropImage(
  sourcePath: string,
  geo: { x: number; y: number; width: number; height: number },
  outputPath: string
): boolean {
  const w = Math.round(geo.width);
  const h = Math.round(geo.height);
  const x = Math.round(geo.x);
  const y = Math.round(geo.y);

  if (w <= 0 || h <= 0) return false;

  const cmd = `magick "${sourcePath}" -crop ${w}x${h}+${x}+${y} +repage "${outputPath}"`;
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 15_000 });
    // Validate the cropped output is a valid PNG
    const check = validateImageFile(outputPath, `crop-${path.basename(outputPath)}`);
    if (!check.valid) {
      logError(`Cropped image is corrupt: ${check.reason}`);
      return false;
    }
    return true;
  } catch (err) {
    logError(`ImageMagick crop failed: ${cmd} - ${err}`);
    return false;
  }
}

/**
 * Clean up temporary crop files.
 */
function cleanupTempFiles(): void {
  try {
    const tmpDir = '/tmp';
    const files = fs.readdirSync(tmpDir);
    let cleaned = 0;
    for (const f of files) {
      if (f.startsWith('buildbot-crop-')) {
        fs.unlinkSync(path.join(tmpDir, f));
        cleaned++;
      }
    }
    if (cleaned > 0) {
      log(`Cleaned up ${cleaned} temporary crop files.`);
    }
  } catch {
    // Non-critical
  }
}

// ---------------------------------------------------------------------------
// Screen Routes helper (for Pass 5)
// ---------------------------------------------------------------------------

interface ScreenRouteEntry {
  figmaId: string;
  name: string;
  state: string;
}

interface RouteConfig {
  route: string;
  screens: ScreenRouteEntry[];
}

function loadScreenRoutes(): Record<string, RouteConfig> | null {
  const routesPath = path.join(BUILDBOT_ROOT, 'config', 'screen-routes.json');
  try {
    const data = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
    return data.routes || null;
  } catch {
    return null;
  }
}

/**
 * Find if the given screen has sibling states in screen-routes.json.
 */
function findScreenStates(screenId: string): { routeName: string; states: string[] } | null {
  const routes = loadScreenRoutes();
  if (!routes) return null;

  for (const [routeName, config] of Object.entries(routes)) {
    const match = config.screens.find(
      (s: ScreenRouteEntry) => s.figmaId === screenId || s.figmaId === screenId.replace('-', ':')
    );
    if (match && config.screens.length > 1) {
      return {
        routeName,
        states: config.screens.map((s: ScreenRouteEntry) => `${s.state} (${s.figmaId})`),
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pass 1: Full Screen Overview
// ---------------------------------------------------------------------------

async function pass1FullScreen(
  screenshotB64: string,
  screenshotMime: string,
  baselineB64: string,
  baselineMime: string
): Promise<{ score: number; differences: Difference[] }> {
  log('Pass 1/5: Full Screen Overview...');

  const prompt = `You are a pixel-perfect UI inspector comparing a Figma design against its React Native implementation.
Image 1 is the Figma design (ground truth). Image 2 is the app implementation.

List EVERY visible difference, no matter how small. For each difference, be specific about:
- Which element is affected (use descriptive name like "title text", "submit button", "header section")
- What the difference is (use exact values where possible: "fontSize appears 24px instead of 28px")
- Whether it's critical (breaks UX), major (noticeable), or minor (subtle)

Focus on these areas in order of priority:
1. Text content — any missing, wrong, or truncated text
2. Text styling — font size, weight, color, alignment differences
3. Spacing — gaps between elements, padding, margins
4. Colors — background, text, border, icon colors
5. Layout — element positioning, sizing, alignment
6. Borders — radius, width, color, visibility
7. Icons/assets — size, color, presence
8. Shadows — drop shadows, inner shadows
9. Corner smoothing — iOS-style rounded corners vs angular

IMPORTANT: Only flag differences you can actually SEE in the screenshots. Do not guess or infer issues that aren't visually apparent.

Rate overall visual similarity from 0-100 (100 = pixel-perfect match).

Respond in JSON:
{
  "overallScore": 85,
  "differences": [
    { "element": "title text", "issue": "Font appears to be Regular weight in app but SemiBold in Figma", "severity": "major" }
  ]
}`;

  const result = (await callGemini(prompt, [
    { base64: baselineB64, mimeType: baselineMime },
    { base64: screenshotB64, mimeType: screenshotMime },
  ])) as { overallScore?: number; differences?: Difference[] };

  const score = typeof result.overallScore === 'number' ? result.overallScore : 0;
  const differences: Difference[] = Array.isArray(result.differences) ? result.differences : [];

  log(`  Score: ${score}/100 | Differences found: ${differences.length}`);
  return { score, differences };
}

// ---------------------------------------------------------------------------
// Pass 2: Component Crop Inspection
// ---------------------------------------------------------------------------

async function pass2Components(
  screenshotPath: string,
  baselinePath: string,
  blueprint: Blueprint
): Promise<ComponentInspection[]> {
  log('Pass 2/5: Component Crop Inspection...');

  const components = getMajorComponents(blueprint);
  if (components.length === 0) {
    log('  No major components found in blueprint. Skipping Pass 2.');
    return [];
  }

  log(`  Found ${components.length} major components to inspect.`);

  const results: ComponentInspection[] = [];
  const batches: BlueprintNode[][] = [];

  // Batch components in groups of 3
  for (let i = 0; i < components.length; i += 3) {
    batches.push(components.slice(i, i + 3));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    log(`  Batch ${batchIdx + 1}/${batches.length} (${batch.length} components)...`);

    const images: Array<{ base64: string; mimeType: string }> = [];
    const componentNames: string[] = [];

    for (let i = 0; i < batch.length; i++) {
      const node = batch[i];
      const geo = getNodeGeometry(node);
      if (!geo) continue;

      const globalIdx = batchIdx * 3 + i;
      const appCropPath = `/tmp/buildbot-crop-app-${globalIdx}.png`;
      const figmaCropPath = `/tmp/buildbot-crop-figma-${globalIdx}.png`;

      const appCropped = cropImage(screenshotPath, geo, appCropPath);
      const figmaCropped = cropImage(baselinePath, geo, figmaCropPath);

      if (!appCropped || !figmaCropped) {
        logError(`  Crop failed for "${getNodeName(node)}". Skipping.`);
        continue;
      }

      const figmaB64 = loadImageAsBase64(figmaCropPath);
      const appB64 = loadImageAsBase64(appCropPath);

      if (!figmaB64 || !appB64) continue;

      images.push({ base64: figmaB64, mimeType: 'image/png' });
      images.push({ base64: appB64, mimeType: 'image/png' });
      componentNames.push(getNodeName(node));
    }

    if (images.length === 0 || componentNames.length === 0) continue;

    const componentList = componentNames
      .map((name, idx) => `Component ${idx + 1}: "${name}" (images ${idx * 2 + 1} and ${idx * 2 + 2})`)
      .join('\n');

    const prompt = `Inspect these UI components in extreme detail.
For each component, the first image is the Figma design (ground truth) and the second is the app implementation.

${componentList}

Check these properties for EACH component:
1. Font size (estimate px)
2. Font weight (Regular/Medium/SemiBold/Bold)
3. Text color (estimate hex)
4. Text alignment (left/center/right)
5. Line height (tight/normal/loose)
6. Letter spacing (tight/normal/wide)
7. Padding (top/right/bottom/left in px)
8. Border radius (px)
9. Border color and width
10. Background color
11. Icon size (px)
12. Spacing between sub-elements (px)
13. Overall vertical/horizontal alignment

For each property, state: MATCH or MISMATCH with expected vs actual values.

Respond in JSON as an array:
[
  {
    "component": "string",
    "properties": [
      { "name": "string", "status": "match|mismatch", "expected": "string", "actual": "string" }
    ]
  }
]`;

    try {
      const result = await callGemini(prompt, images);
      const items = Array.isArray(result) ? result : [result];

      for (const item of items) {
        if (item && typeof item === 'object') {
          const ci = item as { component?: string; properties?: ComponentProperty[] };
          results.push({
            name: ci.component || 'unknown',
            properties: Array.isArray(ci.properties) ? ci.properties : [],
          });
        }
      }

      log(`  Batch ${batchIdx + 1} complete. ${items.length} component(s) analyzed.`);
    } catch (err) {
      logError(`  Batch ${batchIdx + 1} failed: ${err}`);
    }
  }

  const totalMismatches = results.reduce(
    (sum, c) => sum + c.properties.filter((p) => p.status === 'mismatch').length,
    0
  );
  log(`  Pass 2 complete. ${results.length} components inspected, ${totalMismatches} property mismatches.`);

  return results;
}

// ---------------------------------------------------------------------------
// Pass 3: Spacing Ruler Check
// ---------------------------------------------------------------------------

async function pass3Spacing(
  screenshotB64: string,
  screenshotMime: string,
  blueprint: Blueprint
): Promise<{ mismatches: SpacingMismatch[] }> {
  log('Pass 3/5: Spacing Ruler Check...');

  const checklist = extractSpacingChecklist(blueprint);
  if (checklist.length === 0) {
    log('  No spacing measurements derived from blueprint. Skipping Pass 3.');
    return { mismatches: [] };
  }

  log(`  ${checklist.length} spacing measurements to verify.`);

  const checklistFormatted = checklist.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const prompt = `Measure the following spacing distances in this mobile app screenshot and compare with the expected Figma values:

${checklistFormatted}

List any mismatches greater than 2px.

Respond in JSON:
{
  "mismatches": [
    { "measurement": "string", "expected": number, "actual": number, "diffPx": number }
  ]
}`;

  try {
    const result = (await callGemini(prompt, [
      { base64: screenshotB64, mimeType: screenshotMime },
    ])) as { mismatches?: SpacingMismatch[] };

    const mismatches = Array.isArray(result.mismatches) ? result.mismatches : [];
    log(`  ${mismatches.length} spacing mismatches found (> 2px threshold).`);
    return { mismatches };
  } catch (err) {
    logError(`  Pass 3 failed: ${err}`);
    return { mismatches: [] };
  }
}

// ---------------------------------------------------------------------------
// Pass 4: Icon & Asset Verification
// ---------------------------------------------------------------------------

async function pass4Icons(
  screenshotPath: string,
  baselinePath: string,
  blueprint: Blueprint
): Promise<IconResult[]> {
  log('Pass 4/5: Icon & Asset Verification...');

  const iconNodes = getIconNodes(blueprint);
  if (iconNodes.length === 0) {
    log('  No vector/image nodes found in blueprint. Skipping Pass 4.');
    return [];
  }

  log(`  Found ${iconNodes.length} icon/asset nodes to verify.`);

  const results: IconResult[] = [];

  for (let i = 0; i < iconNodes.length; i++) {
    const node = iconNodes[i];
    const geo = getNodeGeometry(node);
    if (!geo) continue;

    // Skip very small nodes (likely decorative dots or invisible)
    if (geo.width < 8 || geo.height < 8) continue;

    const appCropPath = `/tmp/buildbot-crop-icon-app-${i}.png`;
    const figmaCropPath = `/tmp/buildbot-crop-icon-figma-${i}.png`;

    const appCropped = cropImage(screenshotPath, geo, appCropPath);
    const figmaCropped = cropImage(baselinePath, geo, figmaCropPath);

    if (!appCropped || !figmaCropped) {
      logError(`  Crop failed for icon "${getNodeName(node)}". Skipping.`);
      continue;
    }

    const figmaB64 = loadImageAsBase64(figmaCropPath);
    const appB64 = loadImageAsBase64(appCropPath);

    if (!figmaB64 || !appB64) continue;

    const name = getNodeName(node);

    const prompt = `Compare these two icons/assets. The first image is the Figma design (ground truth), the second is the app implementation.
Icon name: "${name}"

Check:
1. Correct shape
2. Correct color
3. Correct size (estimate px)
4. Correct stroke width
5. Centered in container
6. No clipping or overflow

Respond in JSON:
{ "name": "${name}", "status": "match|mismatch|missing", "details": "string" }`;

    try {
      const result = (await callGemini(prompt, [
        { base64: figmaB64, mimeType: 'image/png' },
        { base64: appB64, mimeType: 'image/png' },
      ])) as IconResult;

      results.push({
        name: result.name || name,
        status: result.status || 'match',
        details: result.details,
      });
    } catch (err) {
      logError(`  Icon "${name}" verification failed: ${err}`);
      results.push({ name, status: 'mismatch', details: `Verification error: ${err}` });
    }
  }

  const mismatched = results.filter((r) => r.status !== 'match').length;
  log(`  Pass 4 complete. ${results.length} icons checked, ${mismatched} issues.`);

  return results;
}

// ---------------------------------------------------------------------------
// Pass 5: State Check
// ---------------------------------------------------------------------------

function pass5StateCheck(
  screenId: string,
  blueprint: Blueprint
): StateCheckResult {
  log('Pass 5/5: State Check...');

  const hasStateName =
    blueprint.meta?.stateName !== undefined && blueprint.meta.stateName !== null;

  if (!hasStateName) {
    log('  Skipping Pass 5 -- single state screen (no meta.stateName in blueprint).');
    return { applicable: false, notes: 'No stateName in blueprint meta. Single state screen.' };
  }

  const stateInfo = findScreenStates(screenId);

  if (!stateInfo) {
    log('  Skipping Pass 5 -- no sibling states found in screen-routes.json.');
    return {
      applicable: false,
      notes: `Blueprint has stateName "${blueprint.meta!.stateName}" but no sibling states found in screen-routes.json.`,
    };
  }

  log(`  Screen belongs to route "${stateInfo.routeName}" with ${stateInfo.states.length} states.`);
  log(`  States: ${stateInfo.states.join(', ')}`);

  return {
    applicable: true,
    states: stateInfo.states,
    notes: `Route "${stateInfo.routeName}" has ${stateInfo.states.length} states. Manually verify each state renders correctly.`,
  };
}

// ---------------------------------------------------------------------------
// Report Assembly
// ---------------------------------------------------------------------------

function assembleCriticalIssues(passes: PassResults): string[] {
  const issues: string[] = [];

  // From Pass 1
  for (const diff of passes.fullScreen.differences) {
    if (diff.severity === 'critical') {
      issues.push(`[Full Screen] ${diff.element}: ${diff.issue}`);
    }
  }

  // From Pass 2
  for (const comp of passes.components) {
    for (const prop of comp.properties) {
      if (prop.status === 'mismatch') {
        // Treat font size, background color, and layout mismatches as critical
        const name = prop.name.toLowerCase();
        if (
          name.includes('font size') ||
          name.includes('background') ||
          name.includes('layout') ||
          name.includes('alignment')
        ) {
          issues.push(
            `[Component "${comp.name}"] ${prop.name}: expected ${prop.expected}, got ${prop.actual}`
          );
        }
      }
    }
  }

  // From Pass 3 -- spacing mismatches > 8px are critical
  for (const m of passes.spacing.mismatches) {
    if (Math.abs(m.diffPx) > 8) {
      issues.push(
        `[Spacing] ${m.measurement}: expected ${m.expected}px, got ${m.actual}px (diff: ${m.diffPx}px)`
      );
    }
  }

  // From Pass 4
  for (const icon of passes.icons) {
    if (icon.status === 'missing') {
      issues.push(`[Icon] ${icon.name}: MISSING in implementation`);
    }
  }

  return issues;
}

function assembleSuggestions(passes: PassResults): string[] {
  const suggestions: string[] = [];

  // Component property mismatches as suggestions
  for (const comp of passes.components) {
    const mismatches = comp.properties.filter((p) => p.status === 'mismatch');
    if (mismatches.length > 0) {
      suggestions.push(
        `Fix ${mismatches.length} property mismatches in "${comp.name}": ${mismatches.map((m) => m.name).join(', ')}`
      );
    }
  }

  // Spacing suggestions
  if (passes.spacing.mismatches.length > 0) {
    suggestions.push(
      `Correct ${passes.spacing.mismatches.length} spacing measurements: ${passes.spacing.mismatches.map((m) => m.measurement).join('; ')}`
    );
  }

  // Icon suggestions
  const iconIssues = passes.icons.filter((i) => i.status !== 'match');
  if (iconIssues.length > 0) {
    suggestions.push(
      `Review ${iconIssues.length} icon/asset issues: ${iconIssues.map((i) => `${i.name} (${i.status})`).join(', ')}`
    );
  }

  // State check suggestion
  if (passes.stateCheck?.applicable && passes.stateCheck.states) {
    suggestions.push(
      `Verify all ${passes.stateCheck.states.length} screen states: ${passes.stateCheck.states.join(', ')}`
    );
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  const parsed: Partial<CliArgs> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--screenshot':
        parsed.screenshot = args[++i];
        break;
      case '--baseline':
        parsed.baseline = args[++i];
        break;
      case '--blueprint':
        parsed.blueprint = args[++i];
        break;
      case '--output':
        parsed.output = args[++i];
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }

  // Validate required args
  const missing: string[] = [];
  if (!parsed.screenshot) missing.push('--screenshot');
  if (!parsed.baseline) missing.push('--baseline');
  if (!parsed.blueprint) missing.push('--blueprint');
  if (!parsed.output) missing.push('--output');

  if (missing.length > 0) {
    console.error(`Missing required arguments: ${missing.join(', ')}`);
    console.error('');
    printUsage();
    process.exit(1);
  }

  // Resolve paths relative to buildbot/
  return {
    screenshot: path.resolve(BUILDBOT_ROOT, parsed.screenshot!),
    baseline: path.resolve(BUILDBOT_ROOT, parsed.baseline!),
    blueprint: path.resolve(BUILDBOT_ROOT, parsed.blueprint!),
    output: path.resolve(BUILDBOT_ROOT, parsed.output!),
  };
}

function printUsage(): void {
  console.log(`
Gemini 3 Flash Deep Visual Inspector
=====================================

Usage:
  npx tsx scripts/inspector-flash.ts \\
    --screenshot data/screenshots/41-8760.png \\
    --baseline data/baselines/41-8760-baseline.png \\
    --blueprint data/blueprints/41-8760-blueprint.json \\
    --output reports/audits/41-8760-inspection.json

Arguments:
  --screenshot  Path to app screenshot (PNG/JPG)
  --baseline    Path to Figma baseline image (PNG/JPG)
  --blueprint   Path to blueprint JSON (node geometry + metadata)
  --output      Path to write the inspection report JSON

All paths are relative to the buildbot/ directory.

Environment:
  GEMINI_API_KEY  Required. Loaded from buildbot/.env or environment.
`);
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('');
  console.log('========================================================');
  console.log('  GEMINI 3 FLASH -- DEEP VISUAL INSPECTOR');
  console.log('  5-Pass Forensic Pixel-Level Inspection');
  console.log('========================================================');
  console.log('');

  const args = parseArgs();

  // Validate API key
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set.');
    console.error('Set it in buildbot/.env or export it as an environment variable.');
    process.exit(1);
  }

  // Validate inputs exist and are valid
  const filesToCheck = [
    { label: 'Screenshot', path: args.screenshot },
    { label: 'Baseline', path: args.baseline },
    { label: 'Blueprint', path: args.blueprint },
  ];

  for (const f of filesToCheck) {
    if (!fs.existsSync(f.path)) {
      console.error(`${f.label} not found: ${f.path}`);
      process.exit(1);
    }
  }

  // Validate image files are valid PNGs (prevents Gemini API errors from corrupt images)
  for (const f of [filesToCheck[0], filesToCheck[1]]) {
    const check = validateImageFile(f.path, f.label);
    if (!check.valid) {
      console.error(`${f.label} image is corrupt: ${check.reason}`);
      console.error('This would cause API errors downstream. Fix the image and retry.');
      process.exit(1);
    }
  }

  const screenId = deriveScreenId(args.screenshot);
  log(`Screen ID: ${screenId}`);
  log(`Model: ${GEMINI_MODEL}`);
  log(`Screenshot: ${args.screenshot}`);
  log(`Baseline: ${args.baseline}`);
  log(`Blueprint: ${args.blueprint}`);
  log(`Output: ${args.output}`);
  console.log('');

  // Load inputs
  const screenshotB64 = loadImageAsBase64(args.screenshot);
  const baselineB64 = loadImageAsBase64(args.baseline);

  if (!screenshotB64 || !baselineB64) {
    console.error('Failed to load screenshot or baseline image.');
    process.exit(1);
  }

  const screenshotMime = getMimeType(args.screenshot);
  const baselineMime = getMimeType(args.baseline);

  let blueprint: Blueprint;
  try {
    blueprint = JSON.parse(fs.readFileSync(args.blueprint, 'utf-8')) as Blueprint;
  } catch (err) {
    console.error(`Failed to parse blueprint JSON: ${err}`);
    process.exit(1);
  }

  const startTime = Date.now();

  // -----------------------------------------------------------------------
  // Pass 1: Full Screen Overview
  // -----------------------------------------------------------------------
  let fullScreenResult: PassResults['fullScreen'] = { score: 0, differences: [] };
  try {
    fullScreenResult = await pass1FullScreen(
      screenshotB64,
      screenshotMime,
      baselineB64,
      baselineMime
    );
  } catch (err) {
    logError(`Pass 1 failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Pass 2: Component Crop Inspection
  // -----------------------------------------------------------------------
  await sleep(3000); // Rate limit buffer between passes
  let componentsResult: ComponentInspection[] = [];
  try {
    componentsResult = await pass2Components(
      args.screenshot,
      args.baseline,
      blueprint
    );
  } catch (err) {
    logError(`Pass 2 failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Pass 3: Spacing Ruler Check
  // -----------------------------------------------------------------------
  await sleep(3000); // Rate limit buffer between passes
  let spacingResult: PassResults['spacing'] = { mismatches: [] };
  try {
    spacingResult = await pass3Spacing(screenshotB64, screenshotMime, blueprint);
  } catch (err) {
    logError(`Pass 3 failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Pass 4: Icon & Asset Verification
  // -----------------------------------------------------------------------
  await sleep(3000); // Rate limit buffer between passes
  let iconsResult: IconResult[] = [];
  try {
    iconsResult = await pass4Icons(args.screenshot, args.baseline, blueprint);
  } catch (err) {
    logError(`Pass 4 failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Pass 5: State Check
  // -----------------------------------------------------------------------
  let stateCheckResult: StateCheckResult | undefined;
  try {
    stateCheckResult = pass5StateCheck(screenId, blueprint);
  } catch (err) {
    logError(`Pass 5 failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Assemble Report
  // -----------------------------------------------------------------------
  const passes: PassResults = {
    fullScreen: fullScreenResult,
    components: componentsResult,
    spacing: spacingResult,
    icons: iconsResult,
    stateCheck: stateCheckResult,
  };

  const report: InspectorReport = {
    screenId,
    timestamp: new Date().toISOString(),
    model: GEMINI_MODEL,
    overallScore: fullScreenResult.score,
    passes,
    criticalIssues: assembleCriticalIssues(passes),
    suggestions: assembleSuggestions(passes),
  };

  // Write output
  const outputDir = path.dirname(args.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(args.output, JSON.stringify(report, null, 2));

  // Cleanup temp files
  cleanupTempFiles();

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('========================================================');
  console.log('  INSPECTION COMPLETE');
  console.log('========================================================');
  console.log(`  Overall Score:    ${report.overallScore}/100`);
  console.log(`  Differences:      ${report.passes.fullScreen.differences.length}`);
  console.log(`  Components:       ${report.passes.components.length} inspected`);
  console.log(`  Spacing Issues:   ${report.passes.spacing.mismatches.length}`);
  console.log(`  Icon Issues:      ${report.passes.icons.filter((i) => i.status !== 'match').length}`);
  console.log(`  Critical Issues:  ${report.criticalIssues.length}`);
  console.log(`  Suggestions:      ${report.suggestions.length}`);
  console.log(`  Duration:         ${elapsed}s`);
  console.log(`  Report:           ${args.output}`);
  console.log('========================================================');
  console.log('');

  // Exit with non-zero if critical issues found
  if (report.criticalIssues.length > 0) {
    console.log('Critical issues detected:');
    for (const issue of report.criticalIssues) {
      console.log(`  - ${issue}`);
    }
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('Inspector failed:', err);
  cleanupTempFiles();
  process.exit(1);
});
