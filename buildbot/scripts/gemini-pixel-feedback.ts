/**
 * Gemini 3 Pro Pixel-Perfect Feedback System
 *
 * 4-Batch Analysis Pipeline:
 * - Batch 0: STRUCTURAL ANALYSIS (text content, alignment, positions - NO AI needed)
 * - Batch 1: Component-level visual analysis (detailed per-component)
 * - Batch 2: Full screen visual analysis (holistic view)
 * - Batch 3: Synthesize deterministic code fixes
 *
 * Key Enhancement (v2.0):
 * Batch 0 performs deterministic checks that visual comparison CANNOT catch:
 * - Text content verification: Figma `characters` vs RN text props
 * - Text alignment: `textAlignHorizontal/Vertical` vs RN `textAlign` styles
 * - Position deltas: Figma absolute coordinates vs RN positioning styles
 * - Button fills: detecting fill colors that should match RN backgroundColor
 * - Text line structure: single vs multi-line text from characterStyleOverrides
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx tsx scripts/gemini-pixel-feedback.ts waitlist
 *   GEMINI_API_KEY=xxx npx tsx scripts/gemini-pixel-feedback.ts --screen 41-11206
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDdiHYz0g2P1cVd5HrU5Dwh7ALKPNLVqOM';
const GEMINI_MODEL = 'gemini-3-pro-preview'; // Gemini 3 Pro for visual analysis
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const BASE_DIR = path.join(__dirname, '..');
const CONFIG_DIR = path.join(BASE_DIR, 'config');
const DATA_DIR = path.join(BASE_DIR, 'data');
const OUTPUT_DIR = path.join(BASE_DIR, 'analysis', 'pixel-feedback');

// Types
interface ScreenConfig {
  figmaId: string;
  name: string;
  state: string;
  routeWithState?: string;
}

interface RouteConfig {
  figmaPatterns: string[];
  route: string;
  screens: ScreenConfig[];
}

interface ComponentFeedback {
  componentName: string;
  nodeId: string;
  issues: CodeFix[];
  confidence: number;
}

interface CodeFix {
  file: string;
  lineRange?: string;
  currentCode?: string;
  fixedCode: string;
  property: string;
  figmaValue: string;
  currentValue: string;
  severity: 'critical' | 'major' | 'minor';
  explanation: string;
}

interface BatchResult {
  batch: number;
  type: 'structural' | 'component' | 'fullscreen' | 'synthesis';
  timestamp: string;
  feedback: ComponentFeedback[] | CodeFix[] | StructuralAnalysisResult;
  rawResponse?: any;
}

interface FinalReport {
  screenId: string;
  screenName: string;
  route: string;
  generatedAt: string;
  batches: BatchResult[];
  consolidatedFixes: CodeFix[];
  summary: {
    totalIssues: number;
    critical: number;
    major: number;
    minor: number;
    filesAffected: string[];
  };
}

// ============================================
// BATCH 0: STRUCTURAL ANALYSIS TYPES
// ============================================

interface FigmaTextNode {
  nodeId: string;
  nodeName: string;
  characters: string;
  textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED' | null;
  textAlignVertical: 'TOP' | 'CENTER' | 'BOTTOM' | null;
  fontSize: number;
  lineHeight: number | { value: number; unit: string };
  fontWeight: number | string;
  fontFamily: string;
  fills: any[];
  characterStyleOverrides?: number[];
  styleOverrideTable?: Record<string, any>;
  geometry: { x: number; y: number; width: number; height: number };
  parentNodeId?: string;
}

interface FigmaPositionedNode {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  geometry: { x: number; y: number; width: number; height: number };
  parentNodeId?: string;
  relativePosition?: { left: number; top: number };
}

interface StructuralIssue {
  type: 'text-content' | 'text-alignment' | 'position-delta' | 'component-variant' | 'text-structure';
  severity: 'critical' | 'major' | 'minor';
  nodeId: string;
  nodeName: string;
  figmaValue: any;
  expectedRNValue: any;
  actualRNValue?: any;
  file: string;
  explanation: string;
  suggestedFix: string;
}

interface StructuralAnalysisResult {
  textContentIssues: StructuralIssue[];
  alignmentIssues: StructuralIssue[];
  positionIssues: StructuralIssue[];
  componentVariantIssues: StructuralIssue[];
  textStructureIssues: StructuralIssue[];
  totalIssues: number;
}

// Prompts for each batch
const BATCH_PROMPTS = {
  /**
   * Batch 1: Component-level analysis
   * Uses Figma screenshots as visual truth + extracted data for precise measurements
   */
  component: (componentName: string, extractionData: any, rnCode: string, designTokensSummary?: string) => `
You are a pixel-perfect React Native implementation expert. Analyze the Figma screenshot and extracted data to provide DETERMINISTIC code fixes.

## YOUR INPUTS
1. **IMAGE 1: Figma Screenshot** - The VISUAL SOURCE OF TRUTH. This is what the component MUST look like.
2. **IMAGE 2: Simulator Screenshot** (if provided) - Current app rendering from iOS simulator. Compare with IMAGE 1 to spot visual differences.
3. **Blueprint Data** - Deterministic measurements extracted from Figma REST API (geometry, fills, typography, layout, boundVariables)
4. **React Native Code** - The current implementation to fix

If IMAGE 2 (Simulator) is provided, compare it side-by-side with IMAGE 1 (Figma) to identify visual differences before diving into code.

## CRITICAL CONSTRAINTS
- DO NOT imagine new UI. Only fix code to match the Figma screenshot EXACTLY.
- Use design token references from the DESIGN TOKEN REFERENCE section below
- Every fix must be a specific code change with exact values from the blueprint
- If the current code already matches Figma, report no issues

## COMPONENT: ${componentName}

## FIGMA EXTRACTED DATA (from extract-figma-ai-enhanced pipeline)
Key fields:
- \`figmaData.geometry\`: x, y, width, height (relative to parent)
- \`figmaData.absoluteRenderBounds\`: actual visible bounds after clips (null = invisible)
- \`figmaData.fills\`: colors with hex values, blendMode, boundVariables (design token references)
- \`figmaData.strokes\`: border colors, weights, alignment
- \`figmaData.effects\`: shadows (DROP_SHADOW, INNER_SHADOW), blurs
- \`figmaData.borderRadius\`: corner radius (number or per-corner object)
- \`figmaData.cornerSmoothing\`: iOS superellipse (0.6 = iOS native) → borderCurve: 'continuous'
- \`figmaData.typography\`: font properties, textTruncation, maxLines, lineTypes (lists)
- \`figmaData.layout\`: auto-layout direction, justify, align, gap, padding, sizing
- \`figmaData.layoutSizingHorizontal/Vertical\`: FILL (flex:1) / HUG (auto) / FIXED
- \`figmaData.scrollBehavior\`: SCROLLS / FIXED / STICKY
- \`figmaData.overflowDirection\`: scroll direction (HORIZONTAL_SCROLLING, etc.)
- \`figmaData.boundVariables\`: Figma Variable bindings (authoritative design tokens)
- \`figmaData.styleReferences\`: named Figma styles (text, fill, effect)
- \`figmaData.interactions\`: prototyping triggers and transitions
- \`figmaData.componentPropertyReferences\`: sublayer → component property wiring
- \`computedStyles\`: RN-mapped values (if available)
- \`_designTokens\`: mapped theme tokens (colors.X, spacing.X, typography.X)

\`\`\`json
${JSON.stringify(extractionData, null, 2)}
\`\`\`

## REACT NATIVE CODE TO FIX
\`\`\`typescript
${rnCode}
\`\`\`

## DESIGN TOKEN REFERENCE
${designTokensSummary || 'Design tokens not available — use raw Figma values from extraction data.'}

## ANALYSIS PROCESS
1. Look at the Figma screenshot - this is your visual reference
2. Cross-reference with blueprint data (geometry, fills, typography, layout properties)
3. Compare against React Native code
4. For each mismatch, provide the EXACT code fix using design tokens from the reference above

## CRITICAL STRUCTURAL CHECKS (often missed by visual comparison)
1. **Text alignment**: Check \`textAlignHorizontal\` in extraction vs \`textAlign\` in RN code
2. **Text structure**: If \`characterStyleOverrides\` exists, text has MIXED COLORS on ONE LINE
   - Should be rendered as nested Text spans, not separate lines
3. **Button fills**: Check if Figma button has solid orange fill (#FF9A6D) - verify RN uses matching background
4. **Positions**: Use \`geometry.x, geometry.y\` to calculate exact offsets for absolute positioning
5. **Corner smoothing**: If \`cornerSmoothing\` > 0, verify \`borderCurve: 'continuous'\` is set in RN (iOS only)
6. **Sizing mode**: If \`layoutSizingHorizontal: FILL\`, ensure \`flex: 1\` or \`alignSelf: 'stretch'\` (NOT width: '100%')
7. **Inner shadows**: \`INNER_SHADOW\` effects must use \`boxShadow\` with \`inset\` keyword (RN 0.76+)
8. **Text truncation**: If \`textTruncation: ENDING\` + \`maxLines\`, verify \`numberOfLines\` and \`ellipsizeMode\` in RN
9. **Scroll behavior**: If \`scrollBehavior: FIXED\` or \`STICKY\`, verify fixed/sticky positioning in RN

## OUTPUT (JSON only)
{
  "componentName": "${componentName}",
  "issues": [
    {
      "file": "src/components/waitlist/ComponentName.tsx",
      "lineRange": "45-48",
      "property": "fontSize",
      "figmaValue": "28 (typography.h4)",
      "currentValue": "24",
      "severity": "critical|major|minor",
      "explanation": "Brief description of the mismatch",
      "currentCode": "fontSize: 24,",
      "fixedCode": "fontSize: FIGMA.titleText.fontSize, // 28"
    }
  ],
  "confidence": 0-100
}
`,

  /**
   * Batch 2: Full screen analysis
   * Uses full Figma screenshot + extracted component tree for screen-level issues
   */
  fullScreen: (screenName: string, extractionData: any, rnCode: string, componentFeedback: ComponentFeedback[]) => `
You are a pixel-perfect React Native implementation expert. Analyze the FULL SCREEN against Figma.

## YOUR INPUTS
1. **IMAGE 1: Full Figma Screenshot** - The complete screen as it should appear. This is VISUAL TRUTH.
2. **IMAGE 2: Simulator Screenshot** (if provided) - Current app rendering from iOS simulator. Compare with IMAGE 1 to spot screen-level differences.
3. **Extracted Component Tree** - Hierarchical data from extract-figma-ai-enhanced with all children, their positions, sizes, and design token mappings
4. **React Native Screen Code** - The current implementation
5. **Component Issues** - Already identified per-component issues (don't duplicate these)

If IMAGE 2 (Simulator) is provided, compare it side-by-side with IMAGE 1 (Figma) to identify screen-level visual differences.

## CRITICAL CONSTRAINTS
- DO NOT imagine new UI. Only fix to match the Figma screenshot.
- Focus on SCREEN-LEVEL issues not caught in component analysis:
  - Overall screen padding/margins
  - Spacing BETWEEN components/sections
  - ScrollView behavior and content insets
  - SafeArea handling
  - Animation stagger timings
  - Z-ordering and layering
- Use \`_designTokens\` from extraction data for all values

## SCREEN: ${screenName}

## FIGMA COMPONENT TREE (from Blueprint extraction)
Contains:
- Root screen: geometry, backgroundColor, baseDesign dimensions
- All children with nodeId, nodeName, geometry, fills, strokes, effects, typography
- Layout properties: auto-layout direction, gap, padding, sizing modes (FILL/HUG/FIXED)
- cornerSmoothing (iOS superellipse), absoluteRenderBounds (actual visible area)
- boundVariables (Figma Variable/token bindings), styleReferences (named styles)
- interactions (prototyping triggers/transitions), scrollBehavior, overflowDirection
- \`_designTokens\` mapping for each element (if available)

\`\`\`json
${JSON.stringify(extractionData, null, 2)}
\`\`\`

## REACT NATIVE SCREEN CODE
\`\`\`typescript
${rnCode}
\`\`\`

## ALREADY IDENTIFIED COMPONENT ISSUES (don't duplicate)
${JSON.stringify(componentFeedback, null, 2)}

## ANALYSIS FOCUS
Looking at the Figma screenshot (IMAGE 1):
1. **Screen edges**: What are the horizontal margins? Match to extraction's root padding
2. **Section gaps**: Measure vertical spacing between major content blocks
3. **Scroll content**: Does content extend below fold? Check extraction's height vs baseDesign.height
4. **SafeArea**: Is top content properly offset from status bar?
5. **Background**: Are all layered backgrounds (gradients, images, overlays) correct?

## STRUCTURAL CHECKS (visual comparison misses these)
6. **Text alignment**: Check ALL text nodes' \`textAlignHorizontal\` property - compare with RN \`textAlign\`
7. **Single-line text with colors**: Text with \`characterStyleOverrides\` = ONE LINE with multiple colors
   - If you see text like "18 / 150 members onboarded" - verify if Figma shows it as one line
   - Should be nested Text components, not separate lines or components
8. **Button backgrounds**: Compare Figma button fill colors with RN component backgroundColor
9. **Element positions**: Compare absolute Figma coordinates with RN positioning styles
10. **Corner smoothing**: \`cornerSmoothing > 0\` → \`borderCurve: 'continuous'\` must be set
11. **Sizing modes**: \`layoutSizingHorizontal: FILL\` → flex:1, NOT width: '100%'
12. **Inner shadows**: \`INNER_SHADOW\` must use \`boxShadow\` with \`inset\` keyword
13. **Fixed/sticky elements**: \`scrollBehavior: FIXED\` or \`STICKY\` → proper fixed positioning
14. **Overflow scrolling**: \`overflowDirection\` → correct ScrollView horizontal/vertical setup

## OUTPUT (JSON only)
{
  "screenLevelIssues": [
    {
      "file": "app/(waitlist)/index.tsx",
      "lineRange": "120-125",
      "property": "paddingHorizontal",
      "figmaValue": "40 (spacing.xxl)",
      "currentValue": "24",
      "severity": "major",
      "explanation": "Screen horizontal padding from Figma screenshot shows 40px margins",
      "currentCode": "paddingHorizontal: spacing.lg,",
      "fixedCode": "paddingHorizontal: spacing.xxl, // 40"
    }
  ],
  "layoutIssues": [],
  "scrollIssues": [],
  "confidence": 0-100
}
`,

  /**
   * Batch 3: Synthesis
   * Consolidate all feedback into prioritized, deduplicated, actionable fixes
   */
  synthesis: (screenName: string, componentFeedback: ComponentFeedback[], screenFeedback: any, designTokens: any, structuralFeedback?: StructuralAnalysisResult) => `
You are a code fix synthesizer. Consolidate all feedback into a FINAL, ACTIONABLE fix list.

## YOUR INPUTS
1. **Structural Feedback (Batch 0)** - Deterministic issues found by analyzing Figma data directly (text alignment, text structure, component variants, positions)
2. **Component Feedback (Batch 1)** - Per-component visual issues
3. **Screen Feedback (Batch 2)** - Screen-level visual issues
4. **Design Tokens** - The available theme tokens to use

## CRITICAL: STRUCTURAL ISSUES TAKE PRIORITY
The Structural Feedback from Batch 0 contains issues that VISUAL comparison CANNOT detect:
- Text alignment mismatches (Figma textAlignHorizontal vs RN textAlign)
- Text structure issues (single line text in Figma rendered as multiple lines in RN)
- Button fill mismatches (Figma fill color vs RN backgroundColor)
- Position deltas (elements with specific offsets from parent)

These are VERIFIED programmatically from Figma data and MUST be included in fixes.

## YOUR TASK
1. **Include ALL structural issues** - These are critical, don't skip them
2. **Deduplicate**: Remove redundant visual issues that structural analysis already caught
3. **Prioritize**: Order by severity (critical → major → minor)
4. **Group by file**: Organize fixes for easier application
5. **Resolve conflicts**: If two fixes touch same code, merge them
6. **Validate tokens**: Ensure all fixes use valid design tokens
7. **Make copy-paste ready**: Each fix should be directly applicable

## SCREEN: ${screenName}

## STRUCTURAL FEEDBACK (Batch 0) - HIGHEST PRIORITY
${structuralFeedback ? JSON.stringify(structuralFeedback, null, 2) : 'No structural issues found'}

## COMPONENT FEEDBACK (Batch 1)
${JSON.stringify(componentFeedback, null, 2)}

## SCREEN FEEDBACK (Batch 2)
${JSON.stringify(screenFeedback, null, 2)}

## AVAILABLE DESIGN TOKENS
${JSON.stringify(designTokens, null, 2)}

## SEVERITY GUIDE
- **critical**: Button fill mismatch, text on wrong lines, visual breakage
- **major**: Alignment mismatches, position offsets (>2px), spacing issues
- **minor**: Subtle differences (<2px), optimization suggestions

## OUTPUT (JSON only)
{
  "consolidatedFixes": [
    {
      "file": "src/components/waitlist/BenefitsCard.tsx",
      "lineRange": "45-48",
      "property": "fontSize",
      "figmaValue": "28 (typography.h4.fontSize)",
      "currentValue": "24",
      "severity": "critical",
      "explanation": "Title font size is 28px in Figma, code has 24px",
      "currentCode": "fontSize: 24,\\nlineHeight: 32,",
      "fixedCode": "fontSize: 28, // typography.h4\\nlineHeight: 40,"
    }
  ],
  "fixesByFile": {
    "src/components/waitlist/BenefitsCard.tsx": ["fix1", "fix2"],
    "app/(waitlist)/index.tsx": ["fix3"]
  },
  "summary": {
    "totalIssues": 5,
    "critical": 2,
    "major": 2,
    "minor": 1,
    "filesAffected": ["file1.tsx", "file2.tsx"]
  }
}
`
};

// Helper: Sleep for rate limiting
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Read file safely
function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Helper: Validate PNG file integrity
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
        return { valid: false, reason: `${tag}: file contains JSON, not PNG` };
      }
      return { valid: false, reason: `${tag}: invalid PNG header` };
    }
  } catch {
    return { valid: false, reason: `${tag}: cannot read file header` };
  }

  return { valid: true };
}

// Helper: Load image as base64 (with PNG validation)
function loadImageBase64(imagePath: string): string | null {
  try {
    const check = validateImageFile(imagePath, path.basename(imagePath));
    if (!check.valid) {
      console.warn(`  WARN: Image validation failed: ${check.reason}`);
      return null;
    }
    return fs.readFileSync(imagePath).toString('base64');
  } catch {
    return null;
  }
}

// Capture simulator screenshot via simctl (graceful — skips if no simulator running)
async function captureSimulatorScreenshot(route: string, outputPath: string): Promise<boolean> {
  const { execSync } = require('child_process');
  try {
    // Navigate to screen using deep link
    execSync(`xcrun simctl openurl booted "flentsecured://${route}"`, { timeout: 10000, stdio: 'pipe' });
    // Wait for screen to render
    await new Promise(r => setTimeout(r, 2000));
    // Capture screenshot via simctl
    execSync(`xcrun simctl io booted screenshot "${outputPath}"`, { timeout: 10000, stdio: 'pipe' });
    return fs.existsSync(outputPath);
  } catch (e: any) {
    console.warn(`  Simulator capture skipped for ${route}: ${e.message?.split('\n')[0] || e}`);
    return false;
  }
}

// Call Gemini API
async function callGemini(
  prompt: string,
  images: string[] = [],
  maxRetries: number = 3
): Promise<any> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const parts: any[] = [{ text: prompt }];

  // Add images if provided
  for (const imageBase64 of images) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: imageBase64,
      },
    });
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`  API call attempt ${attempt + 1}/${maxRetries}...`);

      const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1, // Low for deterministic output
            maxOutputTokens: 16384,
            topP: 0.8,
            responseMimeType: "application/json", // Force JSON output — no markdown wrapping
            mediaResolution: "MEDIA_RESOLUTION_HIGH",
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`  API error: ${response.status} - ${error}`);

        if (response.status === 429) {
          // Rate limited — exponential backoff: 30s, 60s, 120s
          const waitTime = Math.pow(2, attempt) * 30_000;
          console.log(`  Rate limited (429). Waiting ${waitTime / 1000}s before retry...`);
          await sleep(waitTime);
          continue;
        }

        if (attempt < maxRetries - 1) {
          await sleep((attempt + 1) * 5000); // 5s, 10s, 15s between retries
          continue;
        }
        throw new Error(`Gemini API failed: ${response.status}`);
      }

      const result = await response.json();
      return parseGeminiResponse(result);
    } catch (error) {
      console.error(`  Request failed:`, error);
      if (attempt < maxRetries - 1) {
        await sleep((attempt + 1) * 3000);
      }
    }
  }

  throw new Error('Gemini API failed after all retries');
}

// Parse Gemini response
function parseGeminiResponse(response: any): any {
  try {
    const textContent = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strategy: Try multiple JSON extraction approaches in order of reliability
    // 1. Try parsing the entire text as JSON (cleanest case)
    try {
      return JSON.parse(textContent.trim());
    } catch { /* not pure JSON, try extraction */ }

    // 2. Look for JSON code block (```json ... ```)
    const codeBlockMatch = textContent.match(/```json\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch { /* malformed code block JSON */ }
    }

    // 3. Find the first complete JSON object by matching balanced braces
    const firstBrace = textContent.indexOf('{');
    if (firstBrace !== -1) {
      let depth = 0;
      let endIdx = -1;
      for (let i = firstBrace; i < textContent.length; i++) {
        if (textContent[i] === '{') depth++;
        else if (textContent[i] === '}') {
          depth--;
          if (depth === 0) { endIdx = i; break; }
        }
      }
      if (endIdx !== -1) {
        const jsonStr = textContent.slice(firstBrace, endIdx + 1);
        try {
          return JSON.parse(jsonStr);
        } catch { /* malformed JSON object */ }
      }
    }

    // 4. Last resort: greedy regex (may capture too much but better than nothing)
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return JSON.parse(textContent);
  } catch (error) {
    console.error('Failed to parse JSON response, returning raw text');
    return {
      rawText: response.candidates?.[0]?.content?.parts?.[0]?.text || '',
      parseError: true,
    };
  }
}

// ============================================
// BATCH 0: STRUCTURAL ANALYSIS FUNCTIONS
// These are deterministic checks - NO AI needed
// ============================================

/**
 * Extract all TEXT nodes from Figma extraction data
 */
function extractTextNodes(node: any, parentId?: string): FigmaTextNode[] {
  const textNodes: FigmaTextNode[] = [];

  if (!node) return textNodes;

  // Check for TEXT type in various formats
  const isTextNode = node.nodeType === 'TEXT' ||
                     node.figmaData?.type === 'TEXT' ||
                     node.type === 'TEXT';

  if (isTextNode) {
    const style = node.figmaData?.style || node.figmaData?.typography || node.typography || node.style || {};
    const textNode: FigmaTextNode = {
      nodeId: node.nodeId || node.id,
      nodeName: node.nodeName || node.name || '',
      characters: node.figmaData?.characters || node.figmaData?.typography?.content || node.text || node.characters || '',
      textAlignHorizontal: style.textAlignHorizontal || style.textAlign || null,
      textAlignVertical: style.textAlignVertical || null,
      fontSize: style.fontSize || node.computedStyles?.fontSize || node.rnStyles?.fontSize || 0,
      lineHeight: style.lineHeightPx || style.lineHeight || node.computedStyles?.lineHeight || node.rnStyles?.lineHeight || 0,
      fontWeight: style.fontWeight || node.computedStyles?.fontWeight || node.rnStyles?.fontWeight || 400,
      fontFamily: style.fontFamily || node.computedStyles?.fontFamily || node.rnStyles?.fontFamily || '',
      fills: node.figmaData?.fills || node.fills || [],
      characterStyleOverrides: node.figmaData?.characterStyleOverrides || node.figmaData?.typography?.spans || node.characterStyleOverrides || [],
      styleOverrideTable: node.figmaData?.styleOverrideTable || node.styleOverrideTable || {},
      geometry: node.figmaData?.geometry || node.geometry || { x: 0, y: 0, width: 0, height: 0 },
      parentNodeId: parentId,
    };
    textNodes.push(textNode);
  }

  // Recurse into children
  const children = node.children || node.figmaData?.children || [];
  for (const child of children) {
    textNodes.push(...extractTextNodes(child, node.nodeId || node.id));
  }

  return textNodes;
}

/**
 * Extract all positioned nodes with their geometry
 */
function extractPositionedNodes(node: any, parentId?: string): FigmaPositionedNode[] {
  const nodes: FigmaPositionedNode[] = [];

  if (!node) return nodes;

  const geometry = node.figmaData?.geometry || node.geometry || node.computedStyles;
  if (geometry && (geometry.x !== undefined || geometry.width !== undefined)) {
    nodes.push({
      nodeId: node.nodeId || node.id,
      nodeName: node.nodeName || node.name || '',
      nodeType: node.nodeType || node.figmaData?.type || node.type || 'UNKNOWN',
      geometry: {
        x: geometry.x || 0,
        y: geometry.y || 0,
        width: geometry.width || 0,
        height: geometry.height || 0,
      },
      parentNodeId: parentId,
    });
  }

  // Recurse into children
  const children = node.children || node.figmaData?.children || [];
  for (const child of children) {
    nodes.push(...extractPositionedNodes(child, node.nodeId || node.id));
  }

  return nodes;
}

/**
 * Detect if a node is likely a button and extract its fill color
 * Returns null if not a button, otherwise returns button info with fill color
 */
function detectButtonWithFill(node: any): { type: string; fillColor: string | null; fillHex: string | null } | null {
  const nodeName = (node.nodeName || node.name || '').toLowerCase();
  const fills = node.figmaData?.fills || node.fills || [];

  // Extract the primary fill color if it exists
  let fillColor: string | null = null;
  let fillHex: string | null = null;

  const solidFill = fills.find((f: any) => f.type === 'SOLID' && f.visible !== false);
  if (solidFill?.color) {
    if (typeof solidFill.color === 'string') {
      // Blueprint format: color is already a hex string like "#131313"
      fillHex = solidFill.color.toUpperCase();
      fillColor = fillHex;
    } else if (typeof solidFill.color === 'object') {
      // Old extraction format: color is {r, g, b} in 0-1 range
      const { r, g, b } = solidFill.color;
      if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
        const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
        fillHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
        fillColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${solidFill.opacity ?? 1})`;
      }
    }
  }

  // Button detection based on node name
  if (nodeName.includes('button') || nodeName.includes('cta') || nodeName.includes('btn')) {
    return { type: 'button', fillColor, fillHex };
  }

  // Check for children that indicate button structure (frame with text child + solid fill)
  const children = node.children || [];
  const hasTextChild = children.some((c: any) =>
    c.nodeType === 'TEXT' || c.figmaData?.type === 'TEXT'
  );

  // If it has a text child, solid fill, and reasonable button-like dimensions
  const geometry = node.figmaData?.geometry || node.geometry || {};
  const isButtonShaped = geometry.height >= 40 && geometry.height <= 80 && geometry.width >= 100;

  if (hasTextChild && solidFill && isButtonShaped) {
    return { type: 'button', fillColor, fillHex };
  }

  return null;
}

/**
 * Analyze text structure - detect if text should be single or multi-line
 * based on characterStyleOverrides
 */
function analyzeTextStructure(textNode: FigmaTextNode): {
  isSingleLine: boolean;
  hasMultipleStyles: boolean;
  styleSegments: Array<{ startIndex: number; endIndex: number; styleId: string }>;
} {
  const overrides = textNode.characterStyleOverrides || [];
  const styleTable = textNode.styleOverrideTable || {};

  // If no overrides, it's single style
  if (overrides.length === 0) {
    return { isSingleLine: true, hasMultipleStyles: false, styleSegments: [] };
  }

  // Analyze style segments
  const segments: Array<{ startIndex: number; endIndex: number; styleId: string }> = [];
  let currentStyleId = overrides[0]?.toString() || '0';
  let segmentStart = 0;

  for (let i = 1; i < overrides.length; i++) {
    const styleId = overrides[i]?.toString() || '0';
    if (styleId !== currentStyleId) {
      segments.push({
        startIndex: segmentStart,
        endIndex: i - 1,
        styleId: currentStyleId,
      });
      currentStyleId = styleId;
      segmentStart = i;
    }
  }

  // Push final segment
  if (overrides.length > 0) {
    segments.push({
      startIndex: segmentStart,
      endIndex: overrides.length - 1,
      styleId: currentStyleId,
    });
  }

  const hasMultipleStyles = segments.length > 1 || Object.keys(styleTable).length > 1;

  // Check if text contains newlines - if not, should be rendered as single line
  const containsNewline = textNode.characters.includes('\n');
  const isSingleLine = !containsNewline;

  return { isSingleLine, hasMultipleStyles, styleSegments: segments };
}

/**
 * Parse RN code to extract text content and styles
 */
function parseRNTextContent(code: string): Array<{
  componentName: string;
  textContent: string[];
  textAlign?: string;
  lineInfo: { line: number; content: string };
}> {
  const results: Array<{
    componentName: string;
    textContent: string[];
    textAlign?: string;
    lineInfo: { line: number; content: string };
  }> = [];

  const lines = code.split('\n');

  // Find <Text> or <RNText> components and extract their content
  const textRegex = /<(?:RN)?Text[^>]*>([^<]*)<\/(?:RN)?Text>/g;
  const styleRegex = /textAlign:\s*['"]?(center|left|right)['"]?/gi;

  let fullCode = code;
  let match;

  while ((match = textRegex.exec(fullCode)) !== null) {
    const textContent = match[1].trim();
    const lineNumber = code.substring(0, match.index).split('\n').length;

    // Find nearby textAlign style
    const contextStart = Math.max(0, match.index - 500);
    const contextEnd = Math.min(code.length, match.index + 500);
    const context = code.substring(contextStart, contextEnd);
    const styleMatch = styleRegex.exec(context);

    results.push({
      componentName: 'Text',
      textContent: [textContent],
      textAlign: styleMatch ? styleMatch[1].toLowerCase() : undefined,
      lineInfo: { line: lineNumber, content: lines[lineNumber - 1] || '' },
    });
  }

  return results;
}

/**
 * Run Batch 0: Structural Analysis (deterministic, no AI)
 */
function runStructuralAnalysis(
  extractionData: any,
  rnCode: string,
  componentCodes: Map<string, string>,
  route: string,
  componentPaths: Map<string, string> = new Map()
): StructuralAnalysisResult {
  console.log('\n========================================');
  console.log('  BATCH 0: Structural Analysis (Deterministic)');
  console.log('========================================');

  const result: StructuralAnalysisResult = {
    textContentIssues: [],
    alignmentIssues: [],
    positionIssues: [],
    componentVariantIssues: [],
    textStructureIssues: [],
    totalIssues: 0,
  };

  // Extract all text nodes from Figma
  const textNodes = extractTextNodes(extractionData.componentTree);
  console.log(`  Found ${textNodes.length} TEXT nodes in Figma`);

  // Extract all positioned nodes
  const positionedNodes = extractPositionedNodes(extractionData.componentTree);
  console.log(`  Found ${positionedNodes.length} positioned nodes in Figma`);

  // 1. TEXT ALIGNMENT ANALYSIS
  console.log('\n  Checking text alignment...');
  for (const textNode of textNodes) {
    const figmaAlign = textNode.textAlignHorizontal;
    if (!figmaAlign) continue;

    // Map Figma alignment to RN
    const expectedRNAlign = figmaAlign.toLowerCase();

    // Check if this text appears in component code
    const textContent = textNode.characters.substring(0, 30); // First 30 chars
    let foundInCode = false;
    let componentFile = '';

    // Search in screen code
    if (rnCode.includes(textContent) || rnCode.toLowerCase().includes(textContent.toLowerCase())) {
      foundInCode = true;
      componentFile = `app/(${route})/index.tsx`;
    }

    // Search in component codes
    for (const [name, code] of componentCodes.entries()) {
      if (code.includes(textContent) || code.toLowerCase().includes(textContent.toLowerCase())) {
        foundInCode = true;
        componentFile = componentPaths.get(name) || `src/components/${name}.tsx`;
        break;
      }
    }

    if (foundInCode && figmaAlign !== 'LEFT') {
      // Check if code has correct textAlign
      const relevantCode = componentFile.includes('index.tsx') ? rnCode : componentCodes.get(componentFile.split('/').pop()?.replace('.tsx', '') || '') || '';
      const hasCorrectAlign = relevantCode.includes(`textAlign: '${expectedRNAlign}'`) ||
                             relevantCode.includes(`textAlign: "${expectedRNAlign}"`) ||
                             relevantCode.includes(`textAlign: 'center'`) && expectedRNAlign === 'center';

      if (!hasCorrectAlign && expectedRNAlign !== 'left') {
        result.alignmentIssues.push({
          type: 'text-alignment',
          severity: 'major',
          nodeId: textNode.nodeId,
          nodeName: textNode.nodeName,
          figmaValue: figmaAlign,
          expectedRNValue: `textAlign: '${expectedRNAlign}'`,
          file: componentFile,
          explanation: `Text "${textContent}..." has textAlignHorizontal: ${figmaAlign} in Figma but may not have corresponding textAlign in RN code`,
          suggestedFix: `Add textAlign: '${expectedRNAlign}' to the style`,
        });
      }
    }
  }
  console.log(`    Found ${result.alignmentIssues.length} alignment issues`);

  // 2. TEXT STRUCTURE ANALYSIS (single vs multi-line)
  console.log('\n  Checking text structure (single/multi-line)...');
  for (const textNode of textNodes) {
    const structure = analyzeTextStructure(textNode);

    if (structure.hasMultipleStyles && structure.isSingleLine) {
      // This should be rendered as a single <Text> with nested <Text> spans
      // NOT as separate Text components on different lines
      const textPreview = textNode.characters.substring(0, 50);

      result.textStructureIssues.push({
        type: 'text-structure',
        severity: 'major',
        nodeId: textNode.nodeId,
        nodeName: textNode.nodeName,
        figmaValue: {
          text: textNode.characters,
          isSingleLine: structure.isSingleLine,
          hasMultipleStyles: structure.hasMultipleStyles,
          styleSegments: structure.styleSegments.length,
        },
        expectedRNValue: 'Single <Text> with nested <Text> spans for different colors',
        file: `app/(${route})/index.tsx`,
        explanation: `Text "${textPreview}..." is ONE LINE in Figma with ${structure.styleSegments.length} style segments (mixed colors). Should be single <Text> with nested spans, NOT separate lines.`,
        suggestedFix: `<Text style={styles.base}>
  <Text style={styles.gray}>{grayPart}</Text>
  <Text style={styles.orange}>{orangePart}</Text>
</Text>`,
      });
    }
  }
  console.log(`    Found ${result.textStructureIssues.length} text structure issues`);

  // 3. BUTTON FILL ANALYSIS
  console.log('\n  Checking button fill colors...');
  const traverseForButtons = (node: any) => {
    if (!node) return;

    const buttonInfo = detectButtonWithFill(node);
    if (buttonInfo && buttonInfo.fillHex) {
      const nodeName = node.nodeName || node.name || '';
      const textChild = (node.children || []).find((c: any) =>
        c.nodeType === 'TEXT' || c.figmaData?.type === 'TEXT'
      );
      const buttonText = textChild?.figmaData?.characters || textChild?.figmaData?.typography?.content || textChild?.characters || nodeName;

      result.componentVariantIssues.push({
        type: 'component-variant',
        severity: 'major', // Changed from critical - just needs verification
        nodeId: node.nodeId || node.id,
        nodeName: nodeName,
        figmaValue: { type: 'button', text: buttonText, fill: buttonInfo.fillHex },
        expectedRNValue: `Button with backgroundColor: '${buttonInfo.fillHex}'`,
        file: `app/(${route})/index.tsx`,
        explanation: `Button "${buttonText}" has fill ${buttonInfo.fillHex} in Figma. Verify RN backgroundColor matches.`,
        suggestedFix: `Verify button has backgroundColor: '${buttonInfo.fillHex}' or equivalent design token`,
      });
    }

    // Recurse
    const children = node.children || node.figmaData?.children || [];
    for (const child of children) {
      traverseForButtons(child);
    }
  };
  traverseForButtons(extractionData.componentTree);
  console.log(`    Found ${result.componentVariantIssues.length} button fill issues`);

  // 4. POSITION DELTA ANALYSIS
  console.log('\n  Checking position deltas...');
  // Group nodes by parent to calculate relative positions
  const nodesByParent = new Map<string, FigmaPositionedNode[]>();
  for (const node of positionedNodes) {
    const parentId = node.parentNodeId || 'root';
    if (!nodesByParent.has(parentId)) {
      nodesByParent.set(parentId, []);
    }
    nodesByParent.get(parentId)!.push(node);
  }

  // Calculate relative positions
  for (const [parentId, children] of nodesByParent.entries()) {
    if (children.length < 2) continue;

    // Find the parent node's position
    const parentNode = positionedNodes.find(n => n.nodeId === parentId);
    if (!parentNode) continue;

    for (const child of children) {
      // Calculate position relative to parent
      const relativeLeft = child.geometry.x - parentNode.geometry.x;
      const relativeTop = child.geometry.y - parentNode.geometry.y;

      child.relativePosition = { left: relativeLeft, top: relativeTop };

      // Check if this position is unusual (negative, or large offset)
      if (relativeTop < -10 || relativeTop > parentNode.geometry.height) {
        result.positionIssues.push({
          type: 'position-delta',
          severity: 'major',
          nodeId: child.nodeId,
          nodeName: child.nodeName,
          figmaValue: {
            absoluteX: child.geometry.x,
            absoluteY: child.geometry.y,
            relativeLeft,
            relativeTop,
            parentId,
          },
          expectedRNValue: `position: 'absolute', left: ${relativeLeft.toFixed(1)}, top: ${relativeTop.toFixed(1)}`,
          file: `app/(${route})/index.tsx`,
          explanation: `"${child.nodeName}" is positioned at (${relativeLeft.toFixed(1)}, ${relativeTop.toFixed(1)}) relative to "${parentNode.nodeName}". This requires absolute positioning.`,
          suggestedFix: `position: 'absolute',
left: ${relativeLeft.toFixed(1)},
top: ${relativeTop.toFixed(1)},`,
        });
      }
    }
  }
  console.log(`    Found ${result.positionIssues.length} position issues`);

  // Calculate total
  result.totalIssues = result.textContentIssues.length +
                       result.alignmentIssues.length +
                       result.positionIssues.length +
                       result.componentVariantIssues.length +
                       result.textStructureIssues.length;

  console.log(`\n  BATCH 0 SUMMARY: ${result.totalIssues} structural issues found`);
  console.log(`    - Alignment: ${result.alignmentIssues.length}`);
  console.log(`    - Text structure: ${result.textStructureIssues.length}`);
  console.log(`    - Button fills: ${result.componentVariantIssues.length}`);
  console.log(`    - Position deltas: ${result.positionIssues.length}`);

  return result;
}

/**
 * Convert structural issues to CodeFix format for direct output
 */
function convertStructuralToCodeFixes(structural: StructuralAnalysisResult): CodeFix[] {
  const fixes: CodeFix[] = [];
  const seen = new Set<string>(); // Dedup key: file+property+figmaValue

  // Convert alignment issues
  for (const issue of structural.alignmentIssues) {
    fixes.push({
      file: issue.file,
      property: 'textAlign',
      figmaValue: `textAlignHorizontal: ${issue.figmaValue}`,
      currentValue: 'missing or incorrect',
      severity: issue.severity,
      explanation: issue.explanation,
      fixedCode: issue.suggestedFix,
    });
  }

  // Convert text structure issues
  for (const issue of structural.textStructureIssues) {
    fixes.push({
      file: issue.file,
      property: 'text-structure',
      figmaValue: `Single line: ${(issue.figmaValue as any).text?.substring(0, 30)}...`,
      currentValue: 'Multiple lines or separate components',
      severity: issue.severity,
      explanation: issue.explanation,
      fixedCode: issue.suggestedFix,
    });
  }

  // Convert component variant issues
  for (const issue of structural.componentVariantIssues) {
    fixes.push({
      file: issue.file,
      property: 'backgroundColor',
      figmaValue: `Button "${(issue.figmaValue as any).text}" with fill ${(issue.figmaValue as any).fill}`,
      currentValue: 'Verify backgroundColor matches Figma fill',
      severity: issue.severity,
      explanation: issue.explanation,
      fixedCode: issue.suggestedFix,
    });
  }

  // Convert position issues
  for (const issue of structural.positionIssues) {
    fixes.push({
      file: issue.file,
      property: 'position',
      figmaValue: `Relative position: left=${(issue.figmaValue as any).relativeLeft?.toFixed(1)}, top=${(issue.figmaValue as any).relativeTop?.toFixed(1)}`,
      currentValue: 'Position may be incorrect',
      severity: issue.severity,
      explanation: issue.explanation,
      fixedCode: issue.suggestedFix,
    });
  }

  // Deduplicate fixes by file+property+figmaValue
  const dedupedFixes: CodeFix[] = [];
  for (const fix of fixes) {
    const key = `${fix.file}|${fix.property}|${fix.figmaValue}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedFixes.push(fix);
    }
  }

  return dedupedFixes;
}

// Load screen configuration — supports both route keys ("waitlist") and figmaIds ("41-11206")
function loadScreenConfig(screenRoute: string): { route: RouteConfig; screen: ScreenConfig } | null {
  const routesPath = path.join(CONFIG_DIR, 'screen-routes.json');
  const routesConfig = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));

  // First try: direct route key match (e.g., "waitlist", "splash")
  const routeConfig = routesConfig.routes[screenRoute];
  if (routeConfig) {
    return {
      route: routeConfig,
      screen: routeConfig.screens[0],
    };
  }

  // Second try: figmaId lookup — search all routes for a matching screen state
  const normalizedId = screenRoute.replace(':', '-');
  for (const [routeKey, config] of Object.entries(routesConfig.routes) as [string, RouteConfig][]) {
    for (const screen of config.screens) {
      const screenFigmaId = screen.figmaId.replace(':', '-');
      if (screenFigmaId === normalizedId) {
        console.log(`  Resolved figmaId ${screenRoute} → route "${routeKey}", state "${screen.state}"`);
        return { route: config, screen };
      }
    }
  }

  console.error(`Route not found: ${screenRoute}`);
  console.log('Available routes:', Object.keys(routesConfig.routes).join(', '));
  return null;
}

// Convert flat nodes array to tree structure
function convertNodesToTree(nodes: any[]): any {
  if (!nodes || nodes.length === 0) {
    return { children: [] };
  }

  // Map nodes to the expected tree format (handles both blueprint and extraction node formats)
  // Pass through all blueprint properties for deterministic analysis
  const treeNodes = nodes.map(node => ({
    nodeId: node.nodeId || node.id || '',
    nodeName: node.nodeName || node.name || '',
    nodeType: node.nodeType || node.type || '',
    figmaData: {
      type: node.nodeType || node.type || '',
      characters: node.text || node.characters || node.typography?.content || '',
      geometry: node.geometry,
      fills: node.fills || [],
      strokes: node.strokes || [],
      effects: node.effects || [],
      style: node.typography || node.style || {},
      typography: node.typography,
      children: [],
      characterStyleOverrides: node.characterStyleOverrides || [],
      styleOverrideTable: node.styleOverrideTable || {},
      // New properties from extraction audit
      borderRadius: node.borderRadius,
      cornerSmoothing: node.cornerSmoothing,
      layout: node.layout,
      layoutSizingHorizontal: node.layoutSizingHorizontal,
      layoutSizingVertical: node.layoutSizingVertical,
      scrollBehavior: node.scrollBehavior,
      overflowDirection: node.overflowDirection,
      boundVariables: node.boundVariables,
      styleReferences: node.styleReferences,
      componentId: node.componentId,
      componentProperties: node.componentProperties,
      componentPropertyReferences: node.componentPropertyReferences,
      interactions: node.interactions,
      absoluteRenderBounds: node.absoluteRenderBounds,
      clipsContent: node.clipsContent,
      opacity: node.opacity,
      blendMode: node.blendMode,
    },
    computedStyles: node.rnStyles || node.computedStyles || {},
    geometry: node.geometry,
    fills: node.fills || [],
    children: [],
  }));

  // Build actual tree using parentId references (preserves hierarchy for Gemini analysis)
  const nodeMap = new Map<string, any>();
  for (const tn of treeNodes) {
    nodeMap.set(tn.nodeId, tn);
  }

  let root: any = null;
  for (let ni = 0; ni < nodes.length; ni++) {
    const origNode = nodes[ni];
    const treeNode = treeNodes[ni];
    const parentId = origNode.parentId;

    if (!parentId) {
      root = treeNode;
    } else {
      const parent = nodeMap.get(parentId);
      if (parent) {
        parent.children.push(treeNode);
      }
    }
  }

  // Fallback: if no root found via parentId, use flat structure
  if (!root) {
    return {
      nodeId: treeNodes[0]?.nodeId || 'root',
      nodeName: treeNodes[0]?.nodeName || 'Root',
      nodeType: 'ROOT',
      children: treeNodes,
      figmaData: treeNodes[0]?.figmaData || {},
      computedStyles: treeNodes[0]?.computedStyles || {},
    };
  }

  return root;
}

// Load Figma extraction data from multiple possible locations
function loadExtractionData(figmaId: string): any {
  // Convert figmaId format (e.g., "243-2762" or "243:2762")
  const normalizedId = figmaId.replace(':', '-');

  // Define all possible extraction paths in order of preference
  const possiblePaths = [
    // 0. Blueprint extraction (new primary)
    path.join(DATA_DIR, 'blueprints', `${normalizedId}-blueprint.json`),
    path.join(DATA_DIR, 'blueprints', `${figmaId}-blueprint.json`),
    // 1. AI-enhanced extraction
    path.join(DATA_DIR, 'extractions', figmaId, 'enhanced-extraction.json'),
    path.join(DATA_DIR, 'extractions', normalizedId, 'enhanced-extraction.json'),
    // 2. Full extraction from style-maps
    path.join(DATA_DIR, 'style-maps', normalizedId, 'extraction.json'),
    path.join(DATA_DIR, 'style-maps', normalizedId, 'local-extraction.json'),
    // 3. Local extraction in screens
    path.join(DATA_DIR, 'screens', normalizedId, 'extracted-values.json'),
    path.join(DATA_DIR, 'screens', figmaId, 'extracted-values.json'),
    // 4. Style map
    path.join(DATA_DIR, 'style-maps', normalizedId, 'style-map.json'),
    path.join(DATA_DIR, 'style-maps', figmaId, 'style-map.json'),
    // 5. Constants file
    path.join(DATA_DIR, 'style-maps', normalizedId, 'constants.json'),
  ];

  // Try each path
  for (const extractionPath of possiblePaths) {
    if (fs.existsSync(extractionPath)) {
      console.log(`  Found extraction data at: ${extractionPath}`);
      const data = JSON.parse(fs.readFileSync(extractionPath, 'utf-8'));

      // Normalize the data structure based on source format
      if (extractionPath.includes('-blueprint.json')) {
        // Blueprint format: flat `nodes` array, convert to componentTree
        const componentTree = convertNodesToTree(data.nodes || []);
        return {
          version: 'blueprint',
          ...data,
          componentTree,
        };
      }

      if (extractionPath.includes('extraction.json') || extractionPath.includes('local-extraction.json')) {
        // Full extraction format from buildbot - has flat `nodes` array
        // Convert to componentTree structure for compatibility
        const componentTree = convertNodesToTree(data.nodes || []);
        return {
          version: 'combined-extraction',
          ...data,
          componentTree,
        };
      }

      if (extractionPath.includes('style-map.json')) {
        // style-map.json has a different structure, wrap it
        return {
          version: 'style-map',
          styleMap: data,
          componentTree: { children: [] }, // Will be populated from constants.json
        };
      }

      if (extractionPath.includes('extracted-values.json')) {
        // Local extraction format
        return {
          version: 'local-extraction',
          ...data,
          componentTree: data.componentTree || { children: [] },
        };
      }

      return data;
    }
  }

  console.error(`Extraction data not found. Tried paths:`);
  for (const p of possiblePaths) {
    console.error(`  - ${p}`);
  }
  return null;
}

// Load design tokens
function loadDesignTokens(): any {
  const tokensPath = path.join(CONFIG_DIR, 'design-tokens.json');
  return JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
}

/** Generate a compact design token summary for Gemini prompts (avoids hardcoded values) */
function generateTokenSummary(tokens: any): string {
  const lines: string[] = ['From @/src/theme:'];

  // Colors — show hex→token mappings
  const colorByHex = tokens._colorByHex || {};
  const colorEntries = Object.entries(colorByHex).slice(0, 15);
  if (colorEntries.length > 0) {
    lines.push('Colors:');
    for (const [hex, token] of colorEntries) {
      lines.push(`  ${token}=${hex}`);
    }
  }

  // Typography — show style keys
  const typByStyle = tokens._typographyByStyle || {};
  const typEntries = Object.entries(typByStyle).slice(0, 10);
  if (typEntries.length > 0) {
    lines.push('Typography:');
    for (const [key, token] of typEntries) {
      const [fs, lh, fw] = (key as string).split(':');
      lines.push(`  ${token}: fontSize=${fs}, lineHeight=${lh}, fontWeight=${fw}`);
    }
  }

  // Spacing
  const spacingByVal = tokens._spacingByValue || {};
  const spacingEntries = Object.entries(spacingByVal);
  if (spacingEntries.length > 0) {
    lines.push(`Spacing: ${spacingEntries.map(([v, t]) => `${t}=${v}`).join(', ')}`);
  }

  // Radius
  const radiusByVal = tokens._radiusByValue || {};
  const radiusEntries = Object.entries(radiusByVal);
  if (radiusEntries.length > 0) {
    lines.push(`Radius: ${radiusEntries.map(([v, t]) => `${t}=${v}`).join(', ')}`);
  }

  return lines.join('\n');
}

// Find React Native code for a screen
function findReactNativeCode(route: string): { screenCode: string; componentCodes: Map<string, string>; componentPaths: Map<string, string> } {
  const rnAppDir = path.join(BASE_DIR, '..', 'rn-app');

  // Map route to file path - COMPLETE mapping for all Figma screens
  const routeToFile: Record<string, string> = {
    // Auth flow
    'splash': 'app/(auth)/splash.tsx',
    'carousel': 'app/(auth)/carousel.tsx',
    'sign-up': 'app/(auth)/sign-up.tsx',
    'otp': 'app/(auth)/otp.tsx',

    // Agreement flow
    'agreement-upload': 'app/(agreement)/upload.tsx',
    'agreement-review': 'app/(agreement)/review.tsx',

    // Setup flow
    'setup': 'app/(setup)/index.tsx',
    'pending-steps': 'app/(setup)/pending-steps.tsx',
    'add-bank': 'app/(setup)/add-bank.tsx',
    'add-utility': 'app/(setup)/add-utility.tsx',
    'invite-landlord': 'app/(setup)/invite-landlord.tsx',

    // Main/Home screens (different states map to same file)
    'home-active': 'app/(main)/index.tsx',
    'home-empty': 'app/(main)/index.tsx',
    'home': 'app/(main)/index.tsx',

    // Waitlist
    'waitlist': 'app/(waitlist)/index.tsx',
    'waitlist-approved': 'app/(waitlist)/approved.tsx',

    // Transactions
    'transactions': 'app/(transactions)/index.tsx',
    'transaction-detail': 'app/(transactions)/[id].tsx',

    // Payment flow
    'payment-cards': 'app/(payment)/select-method.tsx',
    'payment-select': 'app/(payment)/select-method.tsx',
    'payment-add-upi': 'app/(payment)/add-upi.tsx',
    'payment-add-card': 'app/(payment)/add-card.tsx',
    'payment-add-netbanking': 'app/(payment)/add-netbanking.tsx',
    'payment-success': 'app/(payment)/success.tsx',
    'payment-processing': 'app/(payment)/processing.tsx',
    'payment-failed': 'app/(payment)/failed.tsx',
    'first-rent': 'app/(payment)/first-rent.tsx',
    'initiate': 'app/(payment)/initiate.tsx',

    // Profile screens
    'profile': 'app/(profile)/index.tsx',
    'profile-agreement': 'app/(profile)/index.tsx',
    'profile-account': 'app/(profile)/index.tsx',
    'profile-payment': 'app/(profile)/payment-methods.tsx',
    'profile-edit': 'app/(profile)/edit.tsx',
    'profile-notifications': 'app/(profile)/notifications.tsx',
    'profile-help': 'app/(profile)/help.tsx',
    'profile-about': 'app/(profile)/about.tsx',
  };

  const screenFile = routeToFile[route] || `app/${route}.tsx`;
  const screenPath = path.join(rnAppDir, screenFile);

  const screenCode = readFileSafe(screenPath) || `// Screen file not found: ${screenPath}`;

  // Find related components
  const componentCodes = new Map<string, string>();
  const componentPaths = new Map<string, string>(); // name → actual relative path
  const componentsDir = path.join(rnAppDir, 'src', 'components');

  // Map route to component directories - COMPLETE mapping
  const routeToComponents: Record<string, string[]> = {
    // Auth flow
    'splash': ['auth', 'common', 'ui'],
    'carousel': ['auth', 'common', 'ui'],
    'sign-up': ['auth', 'common', 'ui'],
    'otp': ['auth', 'common', 'ui'],

    // Agreement flow
    'agreement-upload': ['agreement', 'common', 'ui'],
    'agreement-review': ['agreement', 'common', 'ui'],

    // Setup flow
    'setup': ['setup', 'common', 'ui'],
    'pending-steps': ['setup', 'common', 'ui'],
    'add-bank': ['setup', 'common', 'ui'],
    'add-utility': ['setup', 'common', 'ui'],
    'invite-landlord': ['setup', 'common', 'ui'],

    // Home screens
    'home-active': ['home', 'common', 'ui'],
    'home-empty': ['home', 'common', 'ui'],
    'home': ['home', 'common', 'ui'],

    // Waitlist
    'waitlist': ['waitlist', 'common', 'ui'],
    'waitlist-approved': ['waitlist', 'common', 'ui'],

    // Transactions
    'transactions': ['transactions', 'common', 'ui'],
    'transaction-detail': ['transactions', 'common', 'ui'],

    // Payment flow
    'payment-cards': ['payment', 'common', 'ui'],
    'payment-select': ['payment', 'common', 'ui'],
    'payment-add-upi': ['payment', 'common', 'ui'],
    'payment-add-card': ['payment', 'common', 'ui'],
    'payment-add-netbanking': ['payment', 'common', 'ui'],
    'payment-success': ['payment', 'common', 'ui'],
    'payment-processing': ['payment', 'common', 'ui'],
    'payment-failed': ['payment', 'common', 'ui'],
    'first-rent': ['payment', 'common', 'ui'],
    'initiate': ['payment', 'common', 'ui'],

    // Profile screens
    'profile': ['profile', 'common', 'ui'],
    'profile-agreement': ['profile', 'common', 'ui'],
    'profile-account': ['profile', 'common', 'ui'],
    'profile-payment': ['profile', 'common', 'ui'],
    'profile-edit': ['profile', 'common', 'ui'],
    'profile-notifications': ['profile', 'common', 'ui'],
    'profile-help': ['profile', 'common', 'ui'],
    'profile-about': ['profile', 'common', 'ui'],
  };

  const componentDirs = routeToComponents[route] || [];

  for (const dir of componentDirs) {
    const dirPath = path.join(componentsDir, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.tsx'));
      for (const file of files) {
        const code = readFileSafe(path.join(dirPath, file));
        if (code) {
          const name = file.replace('.tsx', '');
          componentCodes.set(name, code);
          componentPaths.set(name, `src/components/${dir}/${file}`);
        }
      }
    }
  }

  return { screenCode, componentCodes, componentPaths };
}

// Extract components from extraction data
function extractComponents(extractionData: any): any[] {
  const components: any[] = [];

  function traverse(node: any, depth: number = 0) {
    if (!node) return;

    // Include nodes that look like components (have children or significant styles)
    if (node.computedStyles && (node.children?.length > 0 || node.aiAnalysis)) {
      components.push({
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        nodeType: node.nodeType,
        computedStyles: node.computedStyles,
        aiAnalysis: node.aiAnalysis,
        depth,
      });
    }

    // Recurse into children
    if (node.children) {
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    }
  }

  traverse(extractionData.componentTree);
  return components;
}

// Main analysis pipeline
async function runPixelFeedbackPipeline(screenRoute: string): Promise<FinalReport> {
  console.log('\n========================================');
  console.log('  GEMINI PIXEL-PERFECT FEEDBACK SYSTEM');
  console.log('========================================\n');

  // Load configuration
  console.log('Step 1: Loading configuration...');
  const config = loadScreenConfig(screenRoute);
  if (!config) {
    throw new Error(`Screen configuration not found for: ${screenRoute}`);
  }

  const { route, screen } = config;
  console.log(`  Screen: ${screen.name}`);
  console.log(`  Figma ID: ${screen.figmaId}`);
  console.log(`  Route: ${route.route}`);

  // Load extraction data
  console.log('\nStep 2: Loading Figma extraction data...');
  const extractionData = loadExtractionData(screen.figmaId);
  if (!extractionData) {
    throw new Error(`Extraction data not found for: ${screen.figmaId}`);
  }
  console.log(`  Loaded ${extractionData.version} extraction`);

  // Load design tokens
  console.log('\nStep 3: Loading design tokens...');
  const designTokens = loadDesignTokens();
  const tokenSummary = generateTokenSummary(designTokens);
  console.log('  Design tokens loaded');

  // Load React Native code — derive route key from resolved config
  // route.route is e.g. "/(waitlist)", we need the key like "waitlist"
  const resolvedRouteKey = route.route.replace(/^\/?\(/, '').replace(/\).*$/, '') || screenRoute;
  console.log('\nStep 4: Loading React Native code...');
  const { screenCode, componentCodes, componentPaths } = findReactNativeCode(resolvedRouteKey);
  console.log(`  Screen code: ${screenCode.length} chars`);
  console.log(`  Components found: ${componentCodes.size}`);

  // Extract component list from Figma data
  const figmaComponents = extractComponents(extractionData);
  console.log(`  Figma components: ${figmaComponents.length}`);

  const batches: BatchResult[] = [];
  const componentFeedback: ComponentFeedback[] = [];

  // ========================================
  // BATCH 0: Structural Analysis (deterministic)
  // ========================================
  const structuralResult = runStructuralAnalysis(
    extractionData,
    screenCode,
    componentCodes,
    resolvedRouteKey,
    componentPaths
  );

  batches.push({
    batch: 0,
    type: 'structural',
    timestamp: new Date().toISOString(),
    feedback: structuralResult,
  });

  // Load Figma baseline image (rendered from Figma)
  console.log('\nStep 5: Loading images...');
  const normalizedFigmaId = screen.figmaId.replace(':', '-');
  const baselinePath = path.join(DATA_DIR, 'baselines', `${normalizedFigmaId}-baseline.png`);
  const fullScreenshotBase64 = loadImageBase64(baselinePath);
  console.log(`  Figma baseline: ${fullScreenshotBase64 ? 'loaded' : 'not found'} (${baselinePath})`);

  // Load component-level assets from data/assets/ (Figma node exports)
  const componentScreenshots = new Map<string, string>();
  const assetsDir = path.join(DATA_DIR, 'assets');
  if (fs.existsSync(assetsDir)) {
    const assetPrefix = `${normalizedFigmaId}_`;
    const assetFiles = fs.readdirSync(assetsDir).filter(f => f.startsWith(assetPrefix) && f.endsWith('.png'));
    for (const file of assetFiles) {
      // Asset files are named {figmaId}_{nodeName}.png — extract node name as key
      const nodeName = file.replace(assetPrefix, '').replace('.png', '');
      const base64 = loadImageBase64(path.join(assetsDir, file));
      if (base64) {
        componentScreenshots.set(nodeName, base64);
      }
    }
    console.log(`  Component assets: ${componentScreenshots.size}`);
  }

  // Load app screenshot (already captured by verify-screen pipeline)
  console.log('\nStep 5b: Loading app screenshot...');
  const appScreenshotPath = path.join(DATA_DIR, 'screenshots', `${normalizedFigmaId}.png`);
  const simScreenshotBase64 = loadImageBase64(appScreenshotPath);
  console.log(`  App screenshot: ${simScreenshotBase64 ? 'loaded' : 'not found'} (${appScreenshotPath})`);

  // ========================================
  // BATCH 1: Component-level analysis
  // ========================================
  console.log('\n========================================');
  console.log('  BATCH 1: Component Analysis');
  console.log('========================================');

  // Analyze key components (limit to avoid rate limits)
  const keyComponents = Array.from(componentCodes.entries()).slice(0, 5);

  for (const [componentName, componentCode] of keyComponents) {
    console.log(`\nAnalyzing component: ${componentName}`);

    // Find matching Figma component
    const figmaComponent = figmaComponents.find(c =>
      c.nodeName.toLowerCase().includes(componentName.toLowerCase())
    );

    const componentExtraction = figmaComponent || { note: 'No direct Figma match found' };

    // Get component screenshot if available (assets keyed by node name)
    const componentScreenshotBase64 = figmaComponent?.nodeName
      ? componentScreenshots.get(figmaComponent.nodeName.toLowerCase().replace(/\s+/g, '-'))
      : null;

    try {
      const prompt = BATCH_PROMPTS.component(componentName, componentExtraction, componentCode, tokenSummary);

      // Include Figma screenshot + simulator screenshot if available
      const images: string[] = [];
      if (componentScreenshotBase64) images.push(componentScreenshotBase64);
      if (simScreenshotBase64) images.push(simScreenshotBase64);
      const result = await callGemini(prompt, images);

      componentFeedback.push({
        componentName,
        nodeId: figmaComponent?.nodeId || 'unknown',
        issues: result.issues || [],
        confidence: result.confidence || 0,
      });

      console.log(`  Issues found: ${result.issues?.length || 0}`);
      console.log(`  Confidence: ${result.confidence || 0}%`);
      if (componentScreenshotBase64) {
        console.log(`  (with Figma screenshot)`);
      }

      // Rate limiting
      await sleep(5000); // 5s between API calls to avoid rate limits
    } catch (error) {
      console.error(`  Error analyzing ${componentName}:`, error);
    }
  }

  batches.push({
    batch: 1,
    type: 'component',
    timestamp: new Date().toISOString(),
    feedback: componentFeedback,
  });

  // ========================================
  // BATCH 2: Full screen analysis (with Figma screenshot)
  // ========================================
  console.log('\n========================================');
  console.log('  BATCH 2: Full Screen Analysis');
  console.log('========================================');

  let screenFeedback: any = { screenLevelIssues: [], layoutIssues: [], animationIssues: [] };

  try {
    const prompt = BATCH_PROMPTS.fullScreen(
      screen.name,
      extractionData.componentTree,
      screenCode,
      componentFeedback
    );

    // Include full screen Figma screenshot + simulator screenshot
    const images: string[] = [];
    if (fullScreenshotBase64) images.push(fullScreenshotBase64);
    if (simScreenshotBase64) images.push(simScreenshotBase64);
    console.log(`  Analyzing with ${images.length} image(s) (Figma: ${fullScreenshotBase64 ? 'yes' : 'no'}, Simulator: ${simScreenshotBase64 ? 'yes' : 'no'})...`);

    screenFeedback = await callGemini(prompt, images);
    console.log(`  Screen-level issues: ${screenFeedback.screenLevelIssues?.length || 0}`);
    console.log(`  Layout issues: ${screenFeedback.layoutIssues?.length || 0}`);

    await sleep(2000);
  } catch (error) {
    console.error('  Error in full screen analysis:', error);
  }

  batches.push({
    batch: 2,
    type: 'fullscreen',
    timestamp: new Date().toISOString(),
    feedback: screenFeedback,
  });

  // ========================================
  // BATCH 3: Synthesis (includes Batch 0 structural issues)
  // ========================================
  console.log('\n========================================');
  console.log('  BATCH 3: Fix Synthesis');
  console.log('========================================');

  let synthesisResult: any = { consolidatedFixes: [], summary: {} };

  try {
    const prompt = BATCH_PROMPTS.synthesis(
      screen.name,
      componentFeedback,
      screenFeedback,
      designTokens,
      structuralResult // Pass structural analysis results
    );

    synthesisResult = await callGemini(prompt);
    console.log(`  Consolidated fixes: ${synthesisResult.consolidatedFixes?.length || 0}`);

    // If synthesis returned no fixes but we have structural issues, add them directly
    if ((!synthesisResult.consolidatedFixes || synthesisResult.consolidatedFixes.length === 0) &&
        structuralResult.totalIssues > 0) {
      console.log('  Adding structural issues directly (synthesis may have missed them)...');
      synthesisResult.consolidatedFixes = convertStructuralToCodeFixes(structuralResult);
    }
  } catch (error) {
    console.error('  Error in synthesis:', error);
    // Fallback: convert structural issues to code fixes directly
    if (structuralResult.totalIssues > 0) {
      console.log('  Falling back to structural issues as fixes...');
      synthesisResult.consolidatedFixes = convertStructuralToCodeFixes(structuralResult);
    }
  }

  batches.push({
    batch: 3,
    type: 'synthesis',
    timestamp: new Date().toISOString(),
    feedback: synthesisResult.consolidatedFixes || [],
  });

  // ========================================
  // Generate Final Report
  // ========================================
  const report: FinalReport = {
    screenId: screen.figmaId,
    screenName: screen.name,
    route: route.route,
    generatedAt: new Date().toISOString(),
    batches,
    consolidatedFixes: synthesisResult.consolidatedFixes || [],
    summary: synthesisResult.summary || {
      totalIssues: 0,
      critical: 0,
      major: 0,
      minor: 0,
      filesAffected: [],
    },
  };

  // Save report to analysis output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const reportPath = path.join(OUTPUT_DIR, `${screenRoute}-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${reportPath}`);

  // Also save to reports/audits/ where verify-screen.ts looks for it
  const auditsDir = path.join(BASE_DIR, 'reports', 'audits');
  fs.mkdirSync(auditsDir, { recursive: true });
  const auditPath = path.join(auditsDir, `${screen.figmaId.replace(':', '-')}-gemini.json`);
  fs.writeFileSync(auditPath, JSON.stringify(report, null, 2));
  console.log(`Audit report: ${auditPath}`);

  // Generate markdown report
  const markdownReport = generateMarkdownReport(report);
  const mdPath = path.join(OUTPUT_DIR, `${screenRoute}-${Date.now()}.md`);
  fs.writeFileSync(mdPath, markdownReport);
  console.log(`Markdown report: ${mdPath}`);

  return report;
}

// Generate markdown report
function generateMarkdownReport(report: FinalReport): string {
  const lines: string[] = [
    `# Pixel-Perfect Feedback Report`,
    ``,
    `**Screen:** ${report.screenName}`,
    `**Figma ID:** ${report.screenId}`,
    `**Route:** ${report.route}`,
    `**Generated:** ${report.generatedAt}`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Issues | ${report.summary.totalIssues} |`,
    `| Critical | ${report.summary.critical} |`,
    `| Major | ${report.summary.major} |`,
    `| Minor | ${report.summary.minor} |`,
    `| Files Affected | ${report.summary.filesAffected?.length || 0} |`,
    ``,
  ];

  // Add Batch 0 Structural Analysis section
  const structuralBatch = report.batches.find(b => b.type === 'structural');
  if (structuralBatch) {
    const structural = structuralBatch.feedback as StructuralAnalysisResult;
    lines.push(`## Batch 0: Structural Analysis (Deterministic)`);
    lines.push(``);
    lines.push(`These issues were detected by analyzing Figma data directly - **visual comparison cannot catch these**:`);
    lines.push(``);

    if (structural.alignmentIssues?.length > 0) {
      lines.push(`### Text Alignment Issues (${structural.alignmentIssues.length})`);
      lines.push(``);
      for (const issue of structural.alignmentIssues) {
        lines.push(`- **${issue.nodeName}** (${issue.nodeId})`);
        lines.push(`  - Figma: \`textAlignHorizontal: ${issue.figmaValue}\``);
        lines.push(`  - Fix: \`${issue.suggestedFix}\``);
      }
      lines.push(``);
    }

    if (structural.textStructureIssues?.length > 0) {
      lines.push(`### Text Structure Issues (${structural.textStructureIssues.length})`);
      lines.push(`*Text that should be single line with mixed colors, NOT multiple lines*`);
      lines.push(``);
      for (const issue of structural.textStructureIssues) {
        lines.push(`- **${issue.nodeName}** (${issue.nodeId})`);
        lines.push(`  - Text: "${(issue.figmaValue as any).text?.substring(0, 50)}..."`);
        lines.push(`  - Has ${(issue.figmaValue as any).styleSegments} style segments`);
        lines.push(`  - Fix: Use single \`<Text>\` with nested spans`);
      }
      lines.push(``);
    }

    if (structural.componentVariantIssues?.length > 0) {
      lines.push(`### Button Fill Issues (${structural.componentVariantIssues.length})`);
      lines.push(`*Buttons with specific fill colors - verify RN backgroundColor matches*`);
      lines.push(``);
      for (const issue of structural.componentVariantIssues) {
        lines.push(`- **${issue.nodeName}** (${issue.nodeId})`);
        lines.push(`  - Button text: "${(issue.figmaValue as any).text}"`);
        lines.push(`  - Figma fill: \`${(issue.figmaValue as any).fill}\``);
        lines.push(`  - Action: ${issue.suggestedFix}`);
      }
      lines.push(``);
    }

    if (structural.positionIssues?.length > 0) {
      lines.push(`### Position Issues (${structural.positionIssues.length})`);
      lines.push(`*Elements with specific offsets requiring absolute positioning*`);
      lines.push(``);
      for (const issue of structural.positionIssues) {
        const pos = issue.figmaValue as any;
        lines.push(`- **${issue.nodeName}** (${issue.nodeId})`);
        lines.push(`  - Relative position: left=${pos.relativeLeft?.toFixed(1)}, top=${pos.relativeTop?.toFixed(1)}`);
        lines.push(`  - Fix: Add absolute positioning with exact coordinates`);
      }
      lines.push(``);
    }
  }

  lines.push(`## Consolidated Fixes`);
  lines.push(``);

  if (report.consolidatedFixes.length === 0) {
    lines.push('No issues found. Implementation matches Figma design.');
  } else {
    // Group by severity
    const critical = report.consolidatedFixes.filter(f => f.severity === 'critical');
    const major = report.consolidatedFixes.filter(f => f.severity === 'major');
    const minor = report.consolidatedFixes.filter(f => f.severity === 'minor');

    if (critical.length > 0) {
      lines.push('### Critical Issues (Fix Immediately)');
      lines.push('');
      for (const fix of critical) {
        lines.push(`#### ${fix.property} in \`${fix.file}\``);
        lines.push(`**Lines:** ${fix.lineRange || 'N/A'}`);
        lines.push(`**Problem:** ${fix.explanation}`);
        lines.push(`**Figma:** ${fix.figmaValue} | **Current:** ${fix.currentValue}`);
        lines.push('');
        lines.push('```typescript');
        lines.push('// Before:');
        lines.push(fix.currentCode || '// N/A');
        lines.push('');
        lines.push('// After:');
        lines.push(fix.fixedCode);
        lines.push('```');
        lines.push('');
      }
    }

    if (major.length > 0) {
      lines.push('### Major Issues');
      lines.push('');
      for (const fix of major) {
        lines.push(`- **${fix.property}** in \`${fix.file}\`: ${fix.explanation}`);
        lines.push(`  - Fix: \`${fix.fixedCode}\``);
      }
      lines.push('');
    }

    if (minor.length > 0) {
      lines.push('### Minor Issues');
      lines.push('');
      for (const fix of minor) {
        lines.push(`- **${fix.property}** in \`${fix.file}\`: ${fix.explanation}`);
      }
    }
  }

  return lines.join('\n');
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Gemini Pixel-Perfect Feedback System');
    console.log('');
    console.log('Usage:');
    console.log('  GEMINI_API_KEY=xxx npx tsx scripts/gemini-pixel-feedback.ts <screen-route>');
    console.log('');
    console.log('Examples:');
    console.log('  GEMINI_API_KEY=xxx npx tsx scripts/gemini-pixel-feedback.ts waitlist');
    console.log('  GEMINI_API_KEY=xxx npx tsx scripts/gemini-pixel-feedback.ts sign-up');
    console.log('');
    console.log('Available screens: waitlist, sign-up, otp, splash, home-empty, home-active');
    process.exit(1);
  }

  const screenRoute = args[0].replace('--screen=', '').replace('--screen ', '');

  if (!GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY environment variable is required');
    console.log('Set it with: export GEMINI_API_KEY=your_api_key');
    process.exit(1);
  }

  try {
    const report = await runPixelFeedbackPipeline(screenRoute);

    console.log('\n========================================');
    console.log('  ANALYSIS COMPLETE');
    console.log('========================================');
    console.log(`Total Issues: ${report.summary.totalIssues}`);
    console.log(`  Critical: ${report.summary.critical}`);
    console.log(`  Major: ${report.summary.major}`);
    console.log(`  Minor: ${report.summary.minor}`);
    console.log(`Files Affected: ${report.summary.filesAffected?.join(', ') || 'None'}`);

  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);

export {
  runPixelFeedbackPipeline,
  loadScreenConfig,
  loadExtractionData,
  findReactNativeCode,
  FinalReport,
  CodeFix,
};
