/**
 * gemini-ui-audit.ts — Gemini 3 Pro UI Parity Auditor
 *
 * Assembles all context (baseline, screenshot, blueprint, crosscheck, implementation)
 * and sends it to Gemini 3 Pro for pixel-perfect UI comparison.
 *
 * Usage:
 *   npx tsx figma-1on1parity/gemini-ui-audit.ts --screen 1-29108
 *   npx tsx figma-1on1parity/gemini-ui-audit.ts --screen 1-29108 --screenshot path/to/app-screenshot.png
 *   npx tsx figma-1on1parity/gemini-ui-audit.ts --all
 *   npx tsx figma-1on1parity/gemini-ui-audit.ts --route auth/sign-up
 *
 * Required:
 *   GEMINI_API_KEY env var or in figma-1on1parity/.env
 *
 * Output:
 *   reports/{screenId}-gemini-audit.json
 *   reports/{screenId}-gemini-audit.md   (human-readable)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// ---------------------------------------------------------------------------
// .env loader
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
// Config
// ---------------------------------------------------------------------------
const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const BASELINES_DIR = path.join(BASE_DIR, 'baselines');
const SUMMARIES_DIR = path.join(BASE_DIR, 'summaries');
const IMPL_DIR = path.join(BASE_DIR, 'implementation');
const REPORTS_DIR = path.join(BASE_DIR, 'reports');
const MAPPING_PATH = path.join(BASE_DIR, 'screen-mapping.json');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro-preview-06-05';
const GEMINI_BASE_URL = 'generativelanguage.googleapis.com';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ScreenMapping {
  figmaNodeId: string;
  screenName: string;
  route: string;
  state: string;
  category: string;
  tier: number;
}

interface MappingFile {
  meta: { totalScreens: number };
  screens: ScreenMapping[];
}

interface GeminiAuditResult {
  screenId: string;
  screenName: string;
  route: string;
  state: string;
  auditedAt: string;
  model: string;
  findings: Array<{
    pass: number;
    severity: 'critical' | 'error' | 'warning';
    description: string;
    figmaValue: string;
    appValue: string;
    fix: string;
  }>;
  summary: {
    critical: number;
    error: number;
    warning: number;
    total: number;
  };
  rawResponse: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function log(level: string, ...args: unknown[]): void {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`${ts} [${level}]`, ...args);
}

function toFileId(id: string): string {
  return id.replace(':', '-');
}

function fileToApiId(fileId: string): string {
  return fileId.replace('-', ':');
}

function loadMapping(): MappingFile | null {
  if (!fs.existsSync(MAPPING_PATH)) {
    log('WARN', 'screen-mapping.json not found');
    return null;
  }
  return JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf-8'));
}

function findScreenByRoute(mapping: MappingFile, routeQuery: string): ScreenMapping[] {
  const normalized = routeQuery.replace(/^[\/(]/, '').replace(/\)\//, '/');
  return mapping.screens.filter(s => {
    const sRoute = s.route.replace(/^\(/, '').replace(/\)\//, '/');
    return sRoute.includes(normalized);
  });
}

function imageToBase64(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath).toString('base64');
}

function loadJsonFile(filePath: string): any | null {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
}

// Find the route file path for a given route
function findRouteFile(route: string): string | null {
  const appDir = path.resolve(__dirname, '..', 'app');
  // (auth)/sign-up → app/(auth)/sign-up.tsx
  const candidates = [
    path.join(appDir, `${route}.tsx`),
    path.join(appDir, route, 'index.tsx'),
    path.join(appDir, `${route}.ts`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------
function buildSystemPrompt(): string {
  return `You are a pixel-perfect UI auditor for a React Native (Expo) fintech app called Flent Secured.

## Your Task
You will receive for ONE screen at a time:
1. **Figma baseline image** — the design source of truth
2. **App screenshot** — current implementation (if provided)
3. **Blueprint JSON** — extracted Figma node tree with exact values (dimensions, colors, fonts, spacing)
4. **Crosscheck JSON** — validation manifest with text contents, color palette, spacing values
5. **Implementation JSON** — static analysis of the React Native route file (components, colors, typography, scaling usage)
6. **Route file source** — the actual .tsx code implementing this screen

## Design System Reference
- Background: #131313 (colors.black[700])
- Cards/Elevated: #202020 (colors.black[500])
- Brand accent: #FF9A6D (colors.brand[500])
- Labels: #878787 / #A9A9A9
- Values/Body: #CBCBCB / #DDDDDD
- Font: PlusJakartaSans (Regular=400, Medium=500, SemiBold=600, Bold=700)
- Spacing: xs=8, sm=12, md=16, lg=24, xl=32, xxl=40, xxxl=48, huge=64
- Scaling wrappers: s() horizontal, sv() vertical, sf() font sizes

## Analysis Protocol — 5 Passes (MANDATORY, do all 5 in order)

**Pass 1 — Structure & Layout**
- Count major sections/cards/rows in Figma blueprint vs implementation
- Check scroll container type (ScrollView vs View vs FlatList)
- Verify safe area handling
- Flag missing or extra elements
- Use blueprint JSON layoutMode (HORIZONTAL/VERTICAL) to verify flex direction

**Pass 2 — Typography**
- Compare EVERY text node from blueprint JSON against implementation
- Check: fontSize (exact), fontFamily/fontWeight mapping, color (exact hex), textAlign
- Tolerances: lineHeight ±2px, letterSpacing ±0.5px
- Font weight mapping: 400→Regular, 500→Medium, 600→SemiBold, 700→Bold
- Use crosscheck textContents[] as the authoritative text list

**Pass 3 — Colors & Fills**
- Compare ALL colors from crosscheck colorPalette[] against implementation colorLiterals[]
- Flag raw hex values that should use design system tokens
- Check gradient directions and stops against blueprint GRADIENT_LINEAR fills
- Compare opacity values

**Pass 4 — Spacing & Alignment**
- Compare padding/gap from blueprint layout nodes against implementation
- Implementation uses scaling wrappers — unwrap: s(16)→16, sv(24)→24
- Tolerance: ±2px
- WHITELIST (do not flag): extra paddingBottom for keyboard avoidance, BottomFooter 118px absolute

**Pass 5 — Components & Details**
- Button styles: gradient, border radius, height, disabled state
- Input fields: border, placeholder color, height
- Icons: size, color, position
- Card border radius (flag cornerSmoothing>0 → needs borderCurve:'continuous' on iOS)
- Shadows: compare DROP_SHADOW from blueprint against RN shadow props
- Dividers, badges, status indicators

## Output Format

For EACH finding:

### [Pass N] [SEVERITY] — Brief description

**Figma**: [exact value from blueprint/crosscheck JSON]
**App**: [value from implementation JSON or code]
**Node**: [Figma node ID and name if available]

**Fix**:
\`\`\`tsx
// File: [route file path]
// Line/Property: [what to change]
[old value] → [new value]
\`\`\`

## Severity Guide
- **critical**: Missing element, wrong screen structure, broken layout, missing screen state
- **error**: Wrong color, font size off by 2+px, missing component, spacing off by 4+px
- **warning**: Spacing off 1-2px, minor shade difference, lineHeight mismatch, token convention

## Hard Rules
1. NEVER say "looks good" — only report mismatches
2. NEVER guess values — use blueprint/crosscheck JSON as source of truth
3. ALWAYS reference design system tokens, not raw hex
4. ALWAYS specify scaling wrapper: s(16) not 16 for horizontal, sv(16) for vertical, sf(16) for fonts
5. IGNORE: StatusBar, Home Indicator, DottedPattern background rendering differences
6. IGNORE: Bottom padding for keyboard avoidance (intentional)
7. Blueprint JSON values are AUTHORITATIVE over visual estimation
8. Go pass by pass, in order. Do not skip passes.
9. End with a summary table: | # | Severity | Pass | Description | File |
10. If no app screenshot is provided, audit the implementation JSON + route code against the blueprint data and flag discrepancies you can detect statically.`;
}

function buildScreenPrompt(
  screen: ScreenMapping,
  fileId: string,
  blueprintData: any | null,
  crosscheckData: any | null,
  summaryData: any | null,
  implData: any | null,
  routeSource: string | null,
  routeFilePath: string | null,
): string {
  const parts: string[] = [];

  parts.push(`## Screen: ${screen.screenName}`);
  parts.push(`- **Route**: \`${screen.route}\``);
  parts.push(`- **State**: \`${screen.state}\``);
  parts.push(`- **Category**: ${screen.category}`);
  parts.push(`- **Tier**: ${screen.tier} (${screen.tier === 1 ? 'Trust-critical' : screen.tier === 2 ? 'Conversion' : screen.tier === 3 ? 'Retention' : 'Polish'})`);
  parts.push(`- **Figma Node**: ${screen.figmaNodeId}`);
  parts.push('');

  if (routeFilePath) {
    parts.push(`- **Route File**: \`${routeFilePath}\``);
    parts.push('');
  }

  // Crosscheck (compact, always include)
  if (crosscheckData) {
    parts.push('## Crosscheck Data (validation manifest)');
    parts.push('```json');
    parts.push(JSON.stringify(crosscheckData, null, 2));
    parts.push('```');
    parts.push('');
  }

  // Summary (compact overview)
  if (summaryData) {
    parts.push('## Summary Data');
    parts.push('```json');
    parts.push(JSON.stringify(summaryData, null, 2));
    parts.push('```');
    parts.push('');
  }

  // Implementation extraction
  if (implData) {
    parts.push('## Implementation Extraction (static analysis of route file)');
    parts.push('```json');
    parts.push(JSON.stringify(implData, null, 2));
    parts.push('```');
    parts.push('');
  }

  // Route source code (truncated if huge)
  if (routeSource) {
    const maxLines = 300;
    const lines = routeSource.split('\n');
    const truncated = lines.length > maxLines;
    const source = truncated ? lines.slice(0, maxLines).join('\n') + `\n// ... truncated (${lines.length - maxLines} more lines)` : routeSource;
    parts.push('## Route File Source Code');
    parts.push('```tsx');
    parts.push(source);
    parts.push('```');
    parts.push('');
  }

  // Blueprint (large — include only top-level structure + first 50 nodes)
  if (blueprintData) {
    const compact: any = {
      meta: blueprintData.meta,
      background: blueprintData.background,
      nodeCount: blueprintData.nodes?.length || 0,
      assetCount: blueprintData.assets?.length || 0,
      prototyping: blueprintData.prototyping ? {
        hasInteractions: blueprintData.prototyping.hasInteractions,
        flowCount: blueprintData.prototyping.flowCount,
      } : undefined,
    };

    // Include first 80 nodes (covers most screens)
    if (blueprintData.nodes) {
      compact.nodes = blueprintData.nodes.slice(0, 80).map((n: any) => {
        const slim: any = {
          id: n.id, name: n.name, type: n.type, depth: n.depth,
          geometry: n.geometry,
        };
        if (n.layout) slim.layout = n.layout;
        if (n.typography) slim.typography = {
          content: n.typography.content?.slice(0, 80),
          fontSize: n.typography.fontSize,
          fontWeight: n.typography.fontWeight,
          fontFamily: n.typography.fontFamily,
          color: n.typography.color,
          lineHeight: n.typography.lineHeight,
          letterSpacing: n.typography.letterSpacing,
          textAlign: n.typography.textAlign,
        };
        if (n.fills?.length) slim.fills = n.fills.filter((f: any) => f.visible);
        if (n.effects?.length) slim.effects = n.effects;
        if (n.borderRadius) slim.borderRadius = n.borderRadius;
        if (n.cornerSmoothing) slim.cornerSmoothing = n.cornerSmoothing;
        if (n.opacity !== 1) slim.opacity = n.opacity;
        if (n.isSafeAreaNode) slim.isSafeAreaNode = true;
        if (n.scrollBehavior) slim.scrollBehavior = n.scrollBehavior;
        if (n.overflowDirection) slim.overflowDirection = n.overflowDirection;
        if (n.rnComponent) slim.rnComponent = n.rnComponent;
        return slim;
      });
      if (blueprintData.nodes.length > 80) {
        compact.nodesNote = `Showing 80 of ${blueprintData.nodes.length} nodes. Remaining nodes are deeper children.`;
      }
    }

    parts.push('## Blueprint Data (Figma node tree — authoritative source of truth)');
    parts.push('```json');
    parts.push(JSON.stringify(compact, null, 2));
    parts.push('```');
    parts.push('');
  }

  parts.push('Now perform all 5 passes on this screen. Use the blueprint JSON values as authoritative. Report every mismatch with an actionable fix.');

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Gemini API Call
// ---------------------------------------------------------------------------
interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function callGemini(systemPrompt: string, parts: GeminiPart[]): Promise<string> {
  const requestBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 16384,
      topP: 0.95,
    },
  };

  const body = JSON.stringify(requestBody);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: GEMINI_BASE_URL,
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode !== 200) {
          reject(new Error(`Gemini API ${res.statusCode}: ${responseBody.slice(0, 500)}`));
          return;
        }
        try {
          const data = JSON.parse(responseBody);
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text);
        } catch (e) {
          reject(new Error(`Failed to parse Gemini response: ${e}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('Gemini request timed out (120s)')));
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Parse Gemini Response into Structured Findings
// ---------------------------------------------------------------------------
function parseFindings(raw: string): GeminiAuditResult['findings'] {
  const findings: GeminiAuditResult['findings'] = [];
  // Match ### [Pass N] [SEVERITY] — description
  const regex = /###\s*\[Pass\s*(\d+)\]\s*\[(critical|error|warning)\]\s*[—–-]\s*(.+)/gi;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    findings.push({
      pass: parseInt(match[1]),
      severity: match[2].toLowerCase() as 'critical' | 'error' | 'warning',
      description: match[3].trim(),
      figmaValue: '',
      appValue: '',
      fix: '',
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Audit One Screen
// ---------------------------------------------------------------------------
async function auditScreen(
  screen: ScreenMapping,
  screenshotPath?: string,
): Promise<GeminiAuditResult> {
  const fileId = toFileId(screen.figmaNodeId);

  log('INFO', `Auditing: ${screen.screenName} (${screen.figmaNodeId}) → ${screen.route} [${screen.state}]`);

  // Load all context files
  const blueprintPath = path.join(DATA_DIR, `${fileId}-blueprint.json`);
  const crosscheckPath = path.join(DATA_DIR, `${fileId}-crosscheck.json`);
  const summaryPath = path.join(SUMMARIES_DIR, `${fileId}-summary.json`);
  const baselinePath = path.join(BASELINES_DIR, `${fileId}-baseline.png`);

  // Find implementation JSON by route key
  const routeKey = screen.route.replace(/[()\/]/g, '-').replace(/^-|-$/g, '');
  const implPath = path.join(IMPL_DIR, `${routeKey}-impl.json`);

  const blueprintData = loadJsonFile(blueprintPath);
  const crosscheckData = loadJsonFile(crosscheckPath);
  const summaryData = loadJsonFile(summaryPath);
  const implData = loadJsonFile(implPath);

  // Find and read route file
  const routeFilePath = findRouteFile(screen.route);
  let routeSource: string | null = null;
  if (routeFilePath) {
    try { routeSource = fs.readFileSync(routeFilePath, 'utf-8'); } catch { /* skip */ }
  }

  // Log what we have
  log('INFO', `  Blueprint: ${blueprintData ? 'YES' : 'NO'} | Crosscheck: ${crosscheckData ? 'YES' : 'NO'} | Summary: ${summaryData ? 'YES' : 'NO'}`);
  log('INFO', `  Implementation: ${implData ? 'YES' : 'NO'} | Route file: ${routeFilePath || 'NOT FOUND'}`);
  log('INFO', `  Baseline image: ${fs.existsSync(baselinePath) ? 'YES' : 'NO'} | App screenshot: ${screenshotPath && fs.existsSync(screenshotPath) ? 'YES' : 'NO'}`);

  if (!blueprintData && !crosscheckData) {
    log('WARN', `  Skipping — no blueprint or crosscheck data. Run extract-screen.ts first.`);
    return {
      screenId: fileId, screenName: screen.screenName, route: screen.route, state: screen.state,
      auditedAt: new Date().toISOString(), model: GEMINI_MODEL,
      findings: [], summary: { critical: 0, error: 0, warning: 0, total: 0 },
      rawResponse: 'SKIPPED: No extraction data available',
    };
  }

  // Build prompt parts
  const systemPrompt = buildSystemPrompt();
  const screenPrompt = buildScreenPrompt(
    screen, fileId, blueprintData, crosscheckData, summaryData, implData, routeSource,
    routeFilePath ? path.relative(path.resolve(__dirname, '..'), routeFilePath) : null,
  );

  const parts: GeminiPart[] = [];

  // Add baseline image
  const baselineB64 = imageToBase64(baselinePath);
  if (baselineB64) {
    parts.push({ text: '## Figma Baseline Image (source of truth):' });
    parts.push({ inline_data: { mime_type: 'image/png', data: baselineB64 } });
  }

  // Add app screenshot if provided
  if (screenshotPath && fs.existsSync(screenshotPath)) {
    const screenshotB64 = imageToBase64(screenshotPath);
    if (screenshotB64) {
      parts.push({ text: '## App Screenshot (current implementation):' });
      parts.push({ inline_data: { mime_type: 'image/png', data: screenshotB64 } });
    }
  }

  // Add text context
  parts.push({ text: screenPrompt });

  // Call Gemini
  log('INFO', `  Calling Gemini ${GEMINI_MODEL}...`);
  const startTime = Date.now();
  const rawResponse = await callGemini(systemPrompt, parts);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('INFO', `  Response received (${elapsed}s, ${rawResponse.length} chars)`);

  // Parse findings
  const findings = parseFindings(rawResponse);
  const summary = {
    critical: findings.filter(f => f.severity === 'critical').length,
    error: findings.filter(f => f.severity === 'error').length,
    warning: findings.filter(f => f.severity === 'warning').length,
    total: findings.length,
  };

  log('INFO', `  Findings: ${summary.critical} critical, ${summary.error} errors, ${summary.warning} warnings`);

  const result: GeminiAuditResult = {
    screenId: fileId, screenName: screen.screenName, route: screen.route, state: screen.state,
    auditedAt: new Date().toISOString(), model: GEMINI_MODEL,
    findings, summary, rawResponse,
  };

  // Write reports
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(REPORTS_DIR, `${fileId}-gemini-audit.json`);
  const mdPath = path.join(REPORTS_DIR, `${fileId}-gemini-audit.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
  fs.writeFileSync(mdPath, `# Gemini UI Audit: ${screen.screenName}\n\n` +
    `**Route**: \`${screen.route}\` | **State**: \`${screen.state}\` | **Tier**: ${screen.tier}\n` +
    `**Audited**: ${result.auditedAt} | **Model**: ${GEMINI_MODEL}\n\n` +
    `---\n\n${rawResponse}\n`, 'utf-8');

  log('INFO', `  Written: ${jsonPath}`);
  log('INFO', `  Written: ${mdPath}`);

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Gemini 3 Pro UI Parity Auditor
================================
Assembles Figma blueprint + crosscheck + implementation data, sends to Gemini
for pixel-perfect comparison. Works screen by screen.

Usage:
  npx tsx figma-1on1parity/gemini-ui-audit.ts --screen 1-29108
  npx tsx figma-1on1parity/gemini-ui-audit.ts --screen 1-29108 --screenshot screenshots/sign-up.png
  npx tsx figma-1on1parity/gemini-ui-audit.ts --route auth/sign-up
  npx tsx figma-1on1parity/gemini-ui-audit.ts --all
  npx tsx figma-1on1parity/gemini-ui-audit.ts --tier 1          # Only trust-critical screens

Flags:
  --screen ID      Audit a single screen by Figma node ID (e.g. 1-29108 or 1:29108)
  --route ROUTE    Audit all states for a route (e.g. auth/sign-up)
  --all            Audit all screens (with 30s pause between API calls)
  --tier N         Only audit screens at this priority tier (1-4)
  --screenshot P   Path to app screenshot for visual comparison
  --dry-run        Show what would be audited, don't call Gemini

Environment:
  GEMINI_API_KEY   Google AI API key (or set in figma-1on1parity/.env)
  GEMINI_MODEL     Model to use (default: gemini-2.5-pro-preview-06-05)

Prerequisites:
  1. Run batch-extract.sh to extract all screens
  2. Run generate-summaries.ts to create summaries
  3. Run extract-implementation.ts to analyze route files
`);
    process.exit(0);
  }

  if (!GEMINI_API_KEY) {
    log('ERROR', 'GEMINI_API_KEY not set. Set it in environment or figma-1on1parity/.env');
    log('ERROR', 'Get a key at: https://aistudio.google.com/apikey');
    process.exit(1);
  }

  const mapping = loadMapping();
  if (!mapping) {
    log('ERROR', 'screen-mapping.json not found. Run the setup first.');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const screenshotIdx = args.indexOf('--screenshot');
  const screenshotPath = screenshotIdx >= 0 ? args[screenshotIdx + 1] : undefined;

  // Determine which screens to audit
  let screensToAudit: ScreenMapping[] = [];

  const screenIdx = args.indexOf('--screen');
  const routeIdx = args.indexOf('--route');
  const tierIdx = args.indexOf('--tier');

  if (screenIdx >= 0) {
    const screenId = args[screenIdx + 1];
    const normalized = screenId.includes(':') ? screenId : screenId.replace('-', ':');
    const found = mapping.screens.find(s => s.figmaNodeId === normalized);
    if (!found) {
      log('ERROR', `Screen ${screenId} not found in mapping`);
      process.exit(1);
    }
    screensToAudit = [found];
  } else if (routeIdx >= 0) {
    const routeQuery = args[routeIdx + 1];
    screensToAudit = findScreenByRoute(mapping, routeQuery);
    if (screensToAudit.length === 0) {
      log('ERROR', `No screens found for route "${routeQuery}"`);
      process.exit(1);
    }
    log('INFO', `Found ${screensToAudit.length} states for route "${routeQuery}"`);
  } else if (tierIdx >= 0) {
    const tier = parseInt(args[tierIdx + 1]);
    screensToAudit = mapping.screens.filter(s => s.tier === tier);
    log('INFO', `Found ${screensToAudit.length} screens at tier ${tier}`);
  } else if (args.includes('--all')) {
    screensToAudit = [...mapping.screens].sort((a, b) => a.tier - b.tier);
    log('INFO', `Auditing all ${screensToAudit.length} screens`);
  } else {
    log('ERROR', 'Specify --screen, --route, --tier, or --all. Use --help for usage.');
    process.exit(1);
  }

  if (dryRun) {
    log('INFO', '\n=== DRY RUN — would audit these screens ===\n');
    for (const s of screensToAudit) {
      const fileId = toFileId(s.figmaNodeId);
      const hasBP = fs.existsSync(path.join(DATA_DIR, `${fileId}-blueprint.json`));
      const hasCC = fs.existsSync(path.join(DATA_DIR, `${fileId}-crosscheck.json`));
      const hasBL = fs.existsSync(path.join(BASELINES_DIR, `${fileId}-baseline.png`));
      const routeKey = s.route.replace(/[()\/]/g, '-').replace(/^-|-$/g, '');
      const hasImpl = fs.existsSync(path.join(IMPL_DIR, `${routeKey}-impl.json`));
      console.log(`  [T${s.tier}] ${s.figmaNodeId.padEnd(12)} ${s.screenName.padEnd(45)} BP:${hasBP ? 'Y' : 'N'} CC:${hasCC ? 'Y' : 'N'} BL:${hasBL ? 'Y' : 'N'} IM:${hasImpl ? 'Y' : 'N'}`);
    }
    process.exit(0);
  }

  // Audit screen by screen
  const results: GeminiAuditResult[] = [];
  for (let i = 0; i < screensToAudit.length; i++) {
    const screen = screensToAudit[i];
    log('INFO', `\n[${ i + 1}/${screensToAudit.length}] ════════════════════════════════════════`);

    try {
      const result = await auditScreen(screen, screenshotPath);
      results.push(result);
    } catch (err) {
      log('ERROR', `  Failed: ${err instanceof Error ? err.message : String(err)}`);
      results.push({
        screenId: toFileId(screen.figmaNodeId), screenName: screen.screenName,
        route: screen.route, state: screen.state,
        auditedAt: new Date().toISOString(), model: GEMINI_MODEL,
        findings: [], summary: { critical: 0, error: 0, warning: 0, total: 0 },
        rawResponse: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // Rate limit pause between screens (skip for last)
    if (i < screensToAudit.length - 1) {
      log('INFO', '  Waiting 15s (rate limit)...');
      await new Promise(r => setTimeout(r, 15000));
    }
  }

  // Write aggregate summary
  const aggregate = {
    generatedAt: new Date().toISOString(),
    model: GEMINI_MODEL,
    totalScreensAudited: results.length,
    totalFindings: results.reduce((s, r) => s + r.summary.total, 0),
    totalCritical: results.reduce((s, r) => s + r.summary.critical, 0),
    totalErrors: results.reduce((s, r) => s + r.summary.error, 0),
    totalWarnings: results.reduce((s, r) => s + r.summary.warning, 0),
    screenResults: results.map(r => ({
      screenId: r.screenId, screenName: r.screenName, route: r.route, state: r.state,
      ...r.summary,
    })),
  };

  const aggPath = path.join(REPORTS_DIR, 'gemini-audit-summary.json');
  fs.writeFileSync(aggPath, JSON.stringify(aggregate, null, 2), 'utf-8');

  log('INFO', '\n=== Gemini UI Audit Complete ===');
  log('INFO', `Screens audited: ${results.length}`);
  log('INFO', `Total findings: ${aggregate.totalFindings} (${aggregate.totalCritical} critical, ${aggregate.totalErrors} errors, ${aggregate.totalWarnings} warnings)`);
  log('INFO', `Summary: ${aggPath}`);
}

main().catch(err => {
  log('ERROR', `Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
