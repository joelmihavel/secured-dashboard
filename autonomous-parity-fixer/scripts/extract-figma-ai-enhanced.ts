/**
 * AI-Enhanced Figma Data Extraction Pipeline v3.2
 *
 * Builds on v3.1 by adding design token mapping and IMAGE/GRADIENT asset extraction:
 *
 * KEY FEATURES (v3.2 - Image Asset Extraction):
 * 1. Image Fill Detection - Detects nodes with IMAGE or GRADIENT_* fills
 * 2. Background/Texture Export - Exports these as PNG assets for backgrounds, textures, overlays
 * 3. Gradient Data Capture - Includes gradient stops and positions for CSS/RN recreation
 * 4. Asset Type Inference - Categorizes as background, texture, gradient, overlay based on:
 *    - Node naming (e.g., "background", "texture", "overlay")
 *    - Screen coverage ratio (>50% = likely background)
 *    - Fill type (IMAGE vs GRADIENT_*)
 *
 * PREVIOUS KEY FEATURES (v3.1):
 *
 * KEY FEATURES (v3.2):
 * 1. Design Token Mapping - Maps Figma values to theme token paths:
 *    - Typography: fontSize/lineHeight/weight → typography.{tokenName}
 *    - Colors: hex values → colors.{scale}[{shade}]
 *    - Spacing: padding/gap values → spacing.{size}
 *    - Radius: cornerRadius → radius.{size}
 * 2. _designTokens Output - Each node's computedStyles includes token references
 * 3. _textStyles Output - TEXT nodes include typography token mapping
 * 4. AI Token Suggestions - Batch analysis includes token recommendations
 *
 * KEY LEARNINGS INCORPORATED (v3.1):
 * 1. Multi-Component Visual Effects - AI now identifies when visual effects are
 *    composed of multiple elements (e.g., fold corner = cutout rectangle + shape vector)
 * 2. Layout Alignment Properties - AI explicitly flags counterAxisAlignItems/primaryAxisAlignItems
 *    and their React Native equivalents (alignItems/justifyContent)
 * 3. Explicit Width Requirements - When parent has CENTER alignment, children need
 *    explicit widths (not flex) - AI and computedStyles now flag this
 * 4. Full Figma Data Context - AI receives complete node data, not summaries,
 *    enabling better hierarchy and relationship understanding
 *
 * Features:
 * - Node-level screenshot extraction (individual UI components)
 * - AI-powered visual analysis using Gemini 3 Pro
 * - Combined deterministic + AI insights for pixel-perfect code generation
 * - Hierarchical component tree with visual context
 * - React Native code generation hints
 * - Visible bounds filtering (excludes hidden states, bottom sheets below fold)
 *
 * The pipeline:
 * 1. Extract full screen screenshot
 * 2. Extract screenshots for key UI components (depth-limited, visible bounds filtered)
 * 3. Send FULL Figma node data to AI (not truncated)
 * 4. AI identifies multi-component effects, alignment requirements, overflow needs
 * 5. Combine deterministic data + AI insights
 * 6. Generate enriched output with implementation warnings
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Directories
  configDir: path.join(__dirname, '../config'),
  dataDir: path.join(__dirname, '../data'),

  // Figma API
  restApiBaseUrl: 'https://api.figma.com/v1',
  exportScale: 4,
  exportFormat: 'png' as const,

  // Screenshot extraction settings
  screenshots: {
    // Maximum depth to extract component screenshots (0 = screen only)
    maxDepth: 3,
    // Minimum size for component screenshot (skip tiny elements)
    minWidth: 40,
    minHeight: 40,
    // Node types to capture screenshots for
    captureTypes: [
      'FRAME',
      'COMPONENT',
      'INSTANCE',
      'GROUP',
      'RECTANGLE', // Often used for cards/containers
    ] as string[],
    // Skip these node name patterns
    skipPatterns: [
      /^Vector/i,
      /^Ellipse/i,
      /^Line/i,
      /Status Bar/i,
      /HW Cutout/i,
      /Safe ?Area/i,
      /Home Indicator/i,
    ] as RegExp[],
    // Maximum screenshots per screen (to manage API limits)
    maxPerScreen: 30,
    // Only capture nodes within visible screen bounds
    // This filters out hidden states, bottom sheets positioned below fold, etc.
    filterToVisibleBounds: true,
  },

  // AI Analysis settings
  ai: {
    provider: 'gemini' as const,
    // Gemini 3 Pro for visual analysis (consistent with call-gemini.ts)
    model: 'gemini-3-pro-preview',
    // Same model for batch - Gemini 3 Pro has large context window
    batchModel: 'gemini-3-pro-preview',
    maxTokens: 8192,
    batchMaxTokens: 65536, // Large output for comprehensive batch analysis
    temperature: 0.1, // Low temp for consistent analysis
    // Rate limiting
    requestsPerMinute: 15,
    delayBetweenRequests: 4000, // 4 seconds
    // Enable batch analysis mode (send all screenshots to AI at once)
    enableBatchAnalysis: true,
  },

  // Output settings
  output: {
    prettyPrint: true,
    includeRawApiResponse: false,
  },
};

// iPhone device dimensions for scalability reference
const IPHONE_DEVICES = {
  'iPhone SE (3rd gen)': { width: 375, height: 667, scale: 2 },
  'iPhone 13 mini': { width: 375, height: 812, scale: 3 },
  'iPhone 14': { width: 390, height: 844, scale: 3 },
  'iPhone 14 Pro': { width: 393, height: 852, scale: 3 },
  'iPhone 15': { width: 393, height: 852, scale: 3 },
  'iPhone 15 Pro': { width: 393, height: 852, scale: 3 },
  'iPhone 14 Plus': { width: 428, height: 926, scale: 3 },
  'iPhone 14 Pro Max': { width: 430, height: 932, scale: 3 },
  'iPhone 15 Plus': { width: 430, height: 932, scale: 3 },
  'iPhone 15 Pro Max': { width: 430, height: 932, scale: 3 },
  'iPhone 16 Pro Max': { width: 440, height: 956, scale: 3 },
} as const;

const BASE_DESIGN = { width: 393, height: 852 }; // iPhone 14/15 Pro

// ============================================================================
// DESIGN TOKEN MAPPING (DYNAMIC)
// Loads from design-tokens.json - the single source of truth
// Generated by: npx ts-node scripts/export-figma-tokens.ts
// ============================================================================

interface DesignTokensFile {
  _meta: {
    generatedAt: string;
    source: string;
  };
  colors: Record<string, Record<string, string> | string>;
  typography: Record<string, {
    fontSize: number;
    lineHeight: number;
    fontWeight: number;
  }>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  _colorByHex: Record<string, string>;
  _typographyByStyle: Record<string, string>;
  _spacingByValue: Record<string, string>;
  _radiusByValue: Record<string, string>;
}

/**
 * Loads design tokens from JSON file (generated from Figma/RN theme)
 * Falls back to embedded defaults if file not found
 */
function loadDesignTokens(): DesignTokensFile {
  const tokensPath = path.join(CONFIG.configDir, 'design-tokens.json');

  try {
    if (fs.existsSync(tokensPath)) {
      const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
      console.log(`  ✓ Loaded design tokens from ${tokensPath}`);
      console.log(`    Source: ${tokens._meta?.source || 'unknown'}`);
      console.log(`    Generated: ${tokens._meta?.generatedAt || 'unknown'}`);
      return tokens;
    }
  } catch (e) {
    console.warn(`  ⚠ Failed to load design-tokens.json: ${e}`);
  }

  // Fallback: return minimal embedded tokens
  console.warn('  ⚠ Using fallback embedded tokens - run export-figma-tokens.ts to generate full tokens');
  return {
    _meta: {
      generatedAt: 'fallback',
      source: 'embedded-fallback',
    },
    colors: {},
    typography: {},
    spacing: {},
    radius: {},
    _colorByHex: {
      '#131313': 'colors.black[700]',
      '#1A1A1A': 'colors.black[600]',
      '#202020': 'colors.black[500]',
      '#FF9A6D': 'colors.brand[500]',
      '#FFFFFF': 'colors.white',
    },
    _typographyByStyle: {
      '48:64:400': 'typography.h1',
      '28:40:400': 'typography.h4',
      '16:24:400': 'typography.bodyMdRegular',
      '12:20:400': 'typography.bodySm',
    },
    _spacingByValue: {
      '8': 'spacing.xs',
      '12': 'spacing.sm',
      '16': 'spacing.md',
      '24': 'spacing.lg',
    },
    _radiusByValue: {
      '8': 'radius.sm',
      '12': 'radius.md',
      '16': 'radius.lg',
    },
  };
}

// Load tokens at module initialization
let DESIGN_TOKENS: DesignTokensFile;

function ensureTokensLoaded(): void {
  if (!DESIGN_TOKENS) {
    DESIGN_TOKENS = loadDesignTokens();
  }
}

/**
 * Maps Figma typography properties to a design token reference
 */
function mapTypographyToToken(fontSize: number, lineHeight: number, fontWeight: number | string): string | null {
  ensureTokensLoaded();
  const weight = typeof fontWeight === 'string' ? parseInt(fontWeight, 10) : fontWeight;
  const key = `${Math.round(fontSize)}:${Math.round(lineHeight)}:${weight}`;
  return DESIGN_TOKENS._typographyByStyle?.[key] || null;
}

/**
 * Maps Figma color hex to a design token reference
 */
function mapColorToToken(hex: string): string | null {
  ensureTokensLoaded();
  const normalizedHex = hex.toUpperCase();
  return DESIGN_TOKENS._colorByHex?.[normalizedHex] || null;
}

/**
 * Maps spacing value to a design token reference
 */
function mapSpacingToToken(value: number): string | null {
  ensureTokensLoaded();
  return DESIGN_TOKENS._spacingByValue?.[value.toString()] || null;
}

/**
 * Maps border radius to a design token reference
 */
function mapRadiusToToken(value: number): string | null {
  ensureTokensLoaded();
  return DESIGN_TOKENS._radiusByValue?.[value.toString()] || null;
}

// ============================================================================
// TYPES
// ============================================================================

interface FigmaConfig {
  figmaToken: string;
  fileKey: string;
  restApiBaseUrl: string;
  exportScale: number;
  exportFormat: 'png' | 'jpg' | 'svg';
}

interface ScreenConfig {
  nodeId: string;
  name: string;
  module?: string;
}

interface NodeScreenshot {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  filepath: string;
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  depth: number;
  parentId?: string;
}

interface AIAnalysisResult {
  nodeId: string;
  nodeName: string;
  analysis: {
    componentType: string;
    description: string;
    visualProperties: {
      backgroundColor?: string;
      borderRadius?: string;
      hasShadow?: boolean;
      hasGradient?: boolean;
      hasPattern?: boolean;
      opacity?: number;
    };
    layout: {
      arrangement: 'vertical' | 'horizontal' | 'absolute' | 'grid' | 'unknown';
      alignment: string;
      spacing?: string;
      padding?: string;
    };
    children?: {
      count: number;
      types: string[];
    };
    reactNativeHints: {
      suggestedComponent: string;
      styleProperties: Record<string, string | number>;
      specialConsiderations?: string[];
    };
    positioning?: {
      isAbsolute: boolean;
      relativeToParent?: string;
      zIndex?: number;
    };
  };
  confidence: number;
  rawResponse?: string;
}

interface EnhancedNodeData {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  // Deterministic Figma API data
  figmaData: Record<string, any>;
  // AI visual analysis
  aiAnalysis?: AIAnalysisResult['analysis'];
  aiConfidence?: number;
  // Screenshot reference
  screenshotPath?: string;
  // Computed React Native styles
  computedStyles?: Record<string, any>;
  // Child nodes
  children?: EnhancedNodeData[];
}

// Image/Gradient asset for backgrounds, textures, overlays
interface ImageAsset {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  assetType: 'background' | 'texture' | 'gradient' | 'overlay' | 'image';
  fillType: 'IMAGE' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND';
  filepath: string;
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // For gradients, include the gradient data
  gradientData?: {
    gradientStops: Array<{ position: number; color: string }>;
    gradientHandlePositions?: Array<{ x: number; y: number }>;
  };
  // For images, include the image reference
  imageRef?: string;
  opacity?: number;
  blendMode?: string;
}

interface EnhancedScreenOutput {
  screenId: string;
  screenName: string;
  module: string;
  extractedAt: string;
  version: string;
  pipelineVersion: '3.0-ai-enhanced';
  baseDesign: typeof BASE_DESIGN;
  // Full screen data
  fullScreenshot: string;
  fullScreenAnalysis?: AIAnalysisResult['analysis'];
  // Component tree with AI analysis
  componentTree: EnhancedNodeData;
  // Flat list of all nodes with analysis
  nodes: EnhancedNodeData[];
  // Assets - now properly typed
  assets: ImageAsset[];
  // Summary statistics
  stats: {
    totalNodes: number;
    analyzedNodes: number;
    screenshotsCaptured: number;
    aiAnalysisCount: number;
    imageAssetsExtracted: number;
    processingTimeMs: number;
  };
}

// ============================================================================
// GEMINI AI CLIENT
// ============================================================================

class GeminiClient {
  private apiKey: string;
  private model: string;
  private lastRequestTime: number = 0;
  private requestDelay: number;

  constructor(apiKey: string, model: string = CONFIG.ai.model) {
    this.apiKey = apiKey;
    this.model = model;
    this.requestDelay = CONFIG.ai.delayBetweenRequests;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  async analyzeImage(
    imagePath: string,
    context: {
      nodeName: string;
      nodeType: string;
      parentContext?: string;
      siblingContext?: string[];
      figmaHints?: Record<string, any>;
    }
  ): Promise<AIAnalysisResult['analysis'] | null> {
    await this.waitForRateLimit();

    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = 'image/png';

      const prompt = this.buildAnalysisPrompt(context);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Image,
                  },
                },
                {
                  text: prompt,
                },
              ],
            }],
            generationConfig: {
              temperature: CONFIG.ai.temperature,
              maxOutputTokens: CONFIG.ai.maxTokens,
              topP: 0.8,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        console.error('No text content in Gemini response');
        return null;
      }

      // Parse JSON response
      try {
        const analysis = JSON.parse(textContent);
        return analysis;
      } catch (parseError) {
        console.error('Failed to parse Gemini JSON response:', textContent.substring(0, 500));
        return null;
      }
    } catch (error) {
      console.error(`Gemini analysis failed: ${error}`);
      return null;
    }
  }

  /**
   * Batch analyze all screenshots at once using Gemini's large context window
   * This provides comprehensive cross-component insights
   */
  async analyzeBatch(
    screenshots: Array<{
      nodeId: string;
      nodeName: string;
      nodeType: string;
      filepath: string;
      geometry: { x: number; y: number; width: number; height: number };
      depth: number;
      isFullScreen?: boolean;
    }>,
    figmaNodeData: Record<string, any>
  ): Promise<Map<string, AIAnalysisResult['analysis']>> {
    const results = new Map<string, AIAnalysisResult['analysis']>();

    if (screenshots.length === 0) return results;

    console.log(`   Preparing batch analysis with ${screenshots.length} images...`);

    try {
      // Build the parts array with all images
      const parts: Array<{ inline_data?: { mime_type: string; data: string }; text?: string }> = [];

      // Add all images first
      for (const shot of screenshots) {
        if (!fs.existsSync(shot.filepath)) continue;

        const imageBuffer = fs.readFileSync(shot.filepath);
        const base64Image = imageBuffer.toString('base64');

        parts.push({
          inline_data: {
            mime_type: 'image/png',
            data: base64Image,
          },
        });
      }

      // Build the comprehensive prompt
      const screenshotDescriptions = screenshots.map((s, i) =>
        `Image ${i + 1}: "${s.nodeName}" (${s.nodeType})${s.isFullScreen ? ' [FULL SCREEN]' : ''} - ${s.geometry.width}x${s.geometry.height} at depth ${s.depth}`
      ).join('\n');

      // Send FULL Figma data - Gemini 3 Pro has large context window
      const figmaContext = JSON.stringify(figmaNodeData, null, 2);

      const batchPrompt = `You are a React Native layout expert. Analyze these Figma screenshots to help implement pixel-perfect UI.

## CRITICAL: Your Role
- The Figma API data below contains EXACT values (positions, sizes, padding, colors) - these are the SOURCE OF TRUTH
- Your job is to help VISUALIZE the layout structure and identify things code might miss
- DO NOT suggest colors/hex values - we use design tokens
- Focus on: positioning logic, overflow behavior, z-index, absolute vs relative, edge cases

## Screenshots
${screenshotDescriptions}

## Figma API Data (SOURCE OF TRUTH)
\`\`\`json
${figmaContext}
\`\`\`

## CRITICAL PATTERNS TO IDENTIFY

### 1. Multi-Component Visual Effects
Look for visual effects composed of MULTIPLE sibling elements that work together:
- **Fold corners**: Usually a background-colored rectangle (cutout) + a shape (fold)
- **Overlays**: Multiple stacked elements creating depth
- **Decorative elements**: Paperclips, badges, icons that extend outside parent bounds
When found, explain ALL components needed and their roles.

### 2. Layout Alignment (CRITICAL for React Native)
Look for these Figma properties and translate to React Native:
- \`counterAxisAlignItems: CENTER\` → \`alignItems: 'center'\` (children centered on cross-axis)
- \`counterAxisAlignItems: MIN\` → \`alignItems: 'flex-start'\`
- \`counterAxisAlignItems: MAX\` → \`alignItems: 'flex-end'\`
- \`primaryAxisAlignItems: CENTER\` → \`justifyContent: 'center'\`
- \`primaryAxisAlignItems: SPACE_BETWEEN\` → \`justifyContent: 'space-between'\`
Flag when parent has CENTER alignment - children often need EXPLICIT widths.

### 3. Explicit Dimensions Required
Flag when components need explicit width/height (not flex):
- When parent has \`counterAxisAlignItems: CENTER\` → children need explicit width
- When element has specific Figma width that shouldn't flex
- When multiple siblings should have same width (use the extracted value)

### 4. Overflow Behavior
Identify elements that extend outside their parent bounds:
- Decorative elements (paperclips, fold corners)
- Absolutely positioned overlays
- Elements with negative offsets
Parent MUST have \`overflow: 'visible'\` in React Native.

### 5. Design Token Mapping (CRITICAL for maintainability)
Map Figma values to design tokens where possible:
- **Typography**: fontSize/lineHeight/weight → typography.{tokenName}
  - 12/20/400 → typography.bodySm
  - 14/20/400 → typography.bodyMd2
  - 16/24/400 → typography.bodyMdRegular
  - 48/64/400 → typography.h1
- **Colors**: Map hex to color tokens (prefer tokens over hex)
  - #131313 → colors.black[700]
  - #202020 → colors.black[500]
  - #FF9A6D → colors.brand[500]
  - #797979 → colors.black[300]
- **Spacing**: Map padding/gap to spacing tokens
  - 8 → spacing.sm, 16 → spacing.lg, 24 → spacing[6], 48 → spacing[12]
Flag TEXT nodes with their suggested typography token.

## Output Format (be concise, code-first)
\`\`\`json
{
  "layout": {
    "structure": "vertical | horizontal | absolute-overlay",
    "containerType": "ScrollView | View | SafeAreaView",
    "overflow": "visible | hidden | scroll",
    "alignment": {
      "crossAxis": "center | flex-start | flex-end - from counterAxisAlignItems",
      "mainAxis": "flex-start | center | space-between - from primaryAxisAlignItems"
    },
    "requiresExplicitChildWidths": "boolean - true if parent centers children"
  },
  "components": {
    "[nodeId]": {
      "type": "Card | Button | Text | Image | Icon | Container",
      "position": "relative | absolute",
      "parentId": "nodeId or null",
      "overflowBehavior": "visible | hidden - IMPORTANT for elements extending outside bounds",
      "zIndex": "number or null",
      "explicitWidth": "number or null - set if parent centers and width matters",
      "notes": "string - only if there's something tricky about positioning"
    }
  },
  "multiComponentEffects": [
    {
      "effectName": "fold-corner | overlay | badge | etc",
      "parentNodeId": "string",
      "components": [
        {
          "nodeId": "string",
          "role": "cutout | shape | background | decoration",
          "description": "what this component does in the effect"
        }
      ],
      "implementation": "brief React Native implementation notes"
    }
  ],
  "absoluteElements": [
    {
      "nodeId": "string",
      "anchorTo": "parent-top-left | parent-top-right | screen-top | etc",
      "offset": { "x": "number", "y": "number" },
      "extendsOutside": "boolean - if true, parent needs overflow:visible"
    }
  ],
  "designTokens": {
    "typography": [
      {
        "nodeId": "string - TEXT node id",
        "text": "string - first 30 chars of text",
        "figmaStyle": { "fontSize": "number", "lineHeight": "number", "fontWeight": "number" },
        "suggestedToken": "typography.bodySm | typography.h1 | etc",
        "colorToken": "colors.black[300] | colors.brand[500] | null"
      }
    ],
    "colors": {
      "[nodeId]": {
        "property": "backgroundColor | borderColor | fill",
        "hex": "#RRGGBB",
        "suggestedToken": "colors.black[500] | colors.brand[500] | null"
      }
    },
    "spacing": {
      "[nodeId]": {
        "padding": "spacing.lg | spacing[12] | null",
        "gap": "spacing.lg | null"
      }
    }
  },
  "warnings": ["string - things that could break layout if not handled correctly"]
}
\`\`\`

Be terse. Only include components that need positioning notes. Skip obvious layouts.`;

      parts.push({ text: batchPrompt });

      // Make the API call with the batch model (Gemini 3 Pro)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.ai.batchModel}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: CONFIG.ai.temperature,
              maxOutputTokens: CONFIG.ai.batchMaxTokens,
              topP: 0.8,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini batch API error: ${response.status} - ${errorText}`);
        return results;
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        console.error('No text content in Gemini batch response');
        return results;
      }

      // Parse the batch response - handle markdown-wrapped JSON
      try {
        let jsonContent = textContent;

        // Extract JSON from markdown code blocks if present
        const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        } else {
          // Try to find raw JSON object
          const rawJsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (rawJsonMatch) {
            jsonContent = rawJsonMatch[0];
          }
        }

        const batchAnalysis = JSON.parse(jsonContent);

        // Extract per-component analyses
        if (batchAnalysis.components) {
          for (const [nodeId, analysis] of Object.entries(batchAnalysis.components)) {
            results.set(nodeId, analysis as AIAnalysisResult['analysis']);
          }
        }

        // Store screen overview in the full screen node
        const fullScreenShot = screenshots.find(s => s.isFullScreen);
        if (fullScreenShot && batchAnalysis.screenOverview) {
          const screenAnalysis = results.get(fullScreenShot.nodeId) || {} as any;
          screenAnalysis.screenOverview = batchAnalysis.screenOverview;
          screenAnalysis.relationships = batchAnalysis.relationships;
          screenAnalysis.implementationWarnings = batchAnalysis.implementationWarnings;
          results.set(fullScreenShot.nodeId, screenAnalysis);
        }

        console.log(`   Batch analysis complete: ${results.size} components analyzed`);
      } catch (parseError) {
        console.error('Failed to parse Gemini batch JSON response');
        console.error('Response preview:', textContent.substring(0, 1000));

        // Save raw response for debugging
        const debugPath = path.join(CONFIG.dataDir, 'ai-enhanced', 'debug-response.txt');
        fs.writeFileSync(debugPath, textContent);
        console.error(`Full response saved to: ${debugPath}`);
      }
    } catch (error) {
      console.error(`Gemini batch analysis failed: ${error}`);
    }

    return results;
  }

  private buildAnalysisPrompt(context: {
    nodeName: string;
    nodeType: string;
    parentContext?: string;
    siblingContext?: string[];
    figmaHints?: Record<string, any>;
  }): string {
    const figmaHintsStr = context.figmaHints
      ? `\nFigma API hints:\n${JSON.stringify(context.figmaHints, null, 2)}`
      : '';

    return `You are a UI/UX expert analyzing a mobile app screenshot for React Native implementation.

Analyze this UI component screenshot and provide detailed implementation guidance.

Component Context:
- Name: ${context.nodeName}
- Type: ${context.nodeType}
${context.parentContext ? `- Parent: ${context.parentContext}` : ''}
${context.siblingContext?.length ? `- Siblings: ${context.siblingContext.join(', ')}` : ''}
${figmaHintsStr}

Provide your analysis as a JSON object with this exact structure:
{
  "componentType": "string - e.g., Card, Button, Container, Image, Text, Icon, Input, List, etc.",
  "description": "string - Brief description of what this component is and its purpose",
  "visualProperties": {
    "backgroundColor": "string or null - CSS color value if visible",
    "borderRadius": "string or null - e.g., '12px', 'rounded', 'pill'",
    "hasShadow": "boolean",
    "hasGradient": "boolean",
    "hasPattern": "boolean - e.g., dotted pattern, texture",
    "opacity": "number 0-1 or null"
  },
  "layout": {
    "arrangement": "vertical | horizontal | absolute | grid | unknown",
    "alignment": "string - e.g., 'center', 'flex-start', 'space-between'",
    "spacing": "string or null - e.g., '16px', 'tight', 'loose'",
    "padding": "string or null - e.g., '24px', '16px 24px'"
  },
  "children": {
    "count": "number - estimated child element count",
    "types": ["array of child component types visible"]
  },
  "reactNativeHints": {
    "suggestedComponent": "string - View, ScrollView, TouchableOpacity, Image, Text, etc.",
    "styleProperties": {
      "key": "value pairs for React Native StyleSheet"
    },
    "specialConsiderations": ["array of implementation notes"]
  },
  "positioning": {
    "isAbsolute": "boolean - is this absolutely positioned",
    "relativeToParent": "string or null - position description",
    "zIndex": "number or null"
  }
}

Focus on:
1. EXACT visual properties (colors, dimensions, spacing)
2. Layout structure and child arrangement
3. Any overlapping or absolutely positioned elements
4. Special visual effects (shadows, gradients, patterns)
5. React Native implementation specifics

Be precise and specific. Use actual pixel values where visible.`;
  }
}

// ============================================================================
// FIGMA API FUNCTIONS
// ============================================================================

async function fetchNodeTree(config: FigmaConfig, nodeId: string): Promise<any | null> {
  const url = `${config.restApiBaseUrl}/files/${config.fileKey}/nodes?ids=${nodeId}&geometry=paths`;

  try {
    const response = await fetch(url, {
      headers: { 'X-Figma-Token': config.figmaToken },
    });

    if (!response.ok) {
      console.error(`Figma API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.nodes?.[nodeId]?.document || null;
  } catch (error) {
    console.error(`Failed to fetch node tree: ${error}`);
    return null;
  }
}

async function fetchScreenshots(
  config: FigmaConfig,
  nodeIds: string[],
  outputDir: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  if (nodeIds.length === 0) return results;

  // Batch request (Figma allows multiple IDs)
  const batchSize = 20; // Figma limit
  for (let i = 0; i < nodeIds.length; i += batchSize) {
    const batch = nodeIds.slice(i, i + batchSize);
    const idsParam = batch.join(',');

    const url = `${config.restApiBaseUrl}/images/${config.fileKey}?ids=${idsParam}&scale=${config.exportScale}&format=${config.exportFormat}`;

    try {
      const response = await fetch(url, {
        headers: { 'X-Figma-Token': config.figmaToken },
      });

      if (!response.ok) {
        console.error(`Figma images API error: ${response.status}`);
        continue;
      }

      const data = await response.json() as { images?: Record<string, string> };

      if (data.images) {
        for (const [nodeId, imageUrl] of Object.entries(data.images)) {
          if (imageUrl) {
            try {
              const imageResponse = await fetch(imageUrl);
              const buffer = await imageResponse.arrayBuffer();

              const safeNodeId = nodeId.replace(/[^a-zA-Z0-9-]/g, '_');
              const filename = `node_${safeNodeId}.png`;
              const filepath = path.join(outputDir, filename);

              fs.writeFileSync(filepath, Buffer.from(buffer));
              results.set(nodeId, filepath);

              console.log(`  Screenshot: ${filename}`);
            } catch (imgError) {
              console.error(`Failed to download image for ${nodeId}: ${imgError}`);
            }
          }
        }
      }

      // Rate limiting
      if (i + batchSize < nodeIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to fetch screenshots batch: ${error}`);
    }
  }

  return results;
}

// ============================================================================
// NODE PROCESSING
// ============================================================================

function shouldCaptureScreenshot(
  node: any,
  depth: number,
  capturedCount: number,
  screenBounds?: { x: number; y: number; width: number; height: number }
): boolean {
  const { screenshots } = CONFIG;

  // Check depth limit
  if (depth > screenshots.maxDepth) return false;

  // Check max per screen
  if (capturedCount >= screenshots.maxPerScreen) return false;

  // Check node type
  if (!screenshots.captureTypes.includes(node.type)) return false;

  // Check minimum size
  const width = node.absoluteBoundingBox?.width || 0;
  const height = node.absoluteBoundingBox?.height || 0;
  if (width < screenshots.minWidth || height < screenshots.minHeight) return false;

  // Check skip patterns
  const nodeName = node.name || '';
  for (const pattern of screenshots.skipPatterns) {
    if (pattern.test(nodeName)) return false;
  }

  // Check if node is within visible screen bounds
  if (screenshots.filterToVisibleBounds && screenBounds && node.absoluteBoundingBox) {
    const nodeY = node.absoluteBoundingBox.y;
    const nodeX = node.absoluteBoundingBox.x;
    const nodeBottom = nodeY + (node.absoluteBoundingBox.height || 0);
    const nodeRight = nodeX + (node.absoluteBoundingBox.width || 0);

    // Node must be at least partially within screen bounds
    const screenBottom = screenBounds.y + screenBounds.height;
    const screenRight = screenBounds.x + screenBounds.width;

    // If node starts below screen bottom or ends above screen top, skip it
    if (nodeY > screenBottom || nodeBottom < screenBounds.y) return false;
    // If node starts to the right of screen or ends to the left, skip it
    if (nodeX > screenRight || nodeRight < screenBounds.x) return false;
  }

  return true;
}

function collectNodesToCapture(
  node: any,
  depth: number = 0,
  collected: NodeScreenshot[] = [],
  parentId?: string,
  screenBounds?: { x: number; y: number; width: number; height: number }
): NodeScreenshot[] {
  // Use screen bounds from root node if not provided
  if (!screenBounds && depth === 0 && node.absoluteBoundingBox) {
    screenBounds = {
      x: node.absoluteBoundingBox.x,
      y: node.absoluteBoundingBox.y,
      width: node.absoluteBoundingBox.width || BASE_DESIGN.width,
      height: node.absoluteBoundingBox.height || BASE_DESIGN.height,
    };
  }

  const shouldCapture = shouldCaptureScreenshot(node, depth, collected.length, screenBounds);

  if (shouldCapture) {
    collected.push({
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      filepath: '', // Will be set after screenshot
      geometry: {
        x: node.absoluteBoundingBox?.x || 0,
        y: node.absoluteBoundingBox?.y || 0,
        width: node.absoluteBoundingBox?.width || 0,
        height: node.absoluteBoundingBox?.height || 0,
      },
      depth,
      parentId,
    });
  }

  // Recurse into children (only if parent was within bounds or we haven't filtered yet)
  if (node.children && depth < CONFIG.screenshots.maxDepth) {
    for (const child of node.children) {
      collectNodesToCapture(child, depth + 1, collected, node.id, screenBounds);
    }
  }

  return collected;
}

// ============================================================================
// IMAGE ASSET DETECTION AND COLLECTION
// Detects nodes with IMAGE or GRADIENT fills for background/texture extraction
// ============================================================================

/**
 * Check if a node has exportable image or gradient fills
 */
function hasExportableImageFill(node: any): { hasImage: boolean; hasGradient: boolean; fills: any[] } {
  if (!node.fills || !Array.isArray(node.fills)) {
    return { hasImage: false, hasGradient: false, fills: [] };
  }

  const exportableFills = node.fills.filter((fill: any) => {
    if (fill.visible === false) return false;
    return fill.type === 'IMAGE' || fill.type?.startsWith('GRADIENT_');
  });

  return {
    hasImage: exportableFills.some((f: any) => f.type === 'IMAGE'),
    hasGradient: exportableFills.some((f: any) => f.type?.startsWith('GRADIENT_')),
    fills: exportableFills,
  };
}

/**
 * Determine the asset type based on node name and position
 */
function inferAssetType(
  node: any,
  screenBounds: { x: number; y: number; width: number; height: number }
): 'background' | 'texture' | 'gradient' | 'overlay' | 'image' {
  const name = (node.name || '').toLowerCase();
  const nodeWidth = node.absoluteBoundingBox?.width || 0;
  const nodeHeight = node.absoluteBoundingBox?.height || 0;

  // Check naming conventions
  if (name.includes('background') || name.includes('bg')) return 'background';
  if (name.includes('texture') || name.includes('pattern') || name.includes('noise')) return 'texture';
  if (name.includes('gradient')) return 'gradient';
  if (name.includes('overlay')) return 'overlay';

  // Check if it covers significant portion of screen (likely background)
  const coverageRatio = (nodeWidth * nodeHeight) / (screenBounds.width * screenBounds.height);
  if (coverageRatio > 0.5) return 'background';

  // Check if it's a gradient fill type
  const fillCheck = hasExportableImageFill(node);
  if (fillCheck.hasGradient) return 'gradient';

  return 'image';
}

/**
 * Convert Figma color to hex string
 */
function figmaColorToHex(color: { r: number; g: number; b: number; a?: number }): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  if (color.a !== undefined && color.a < 1) {
    const a = Math.round(color.a * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}${a}`.toUpperCase();
  }
  return `#${r}${g}${b}`.toUpperCase();
}

/**
 * Collect all nodes with image/gradient fills for export
 */
function collectImageAssets(
  node: any,
  depth: number = 0,
  collected: Array<Omit<ImageAsset, 'filepath'>> = [],
  screenBounds?: { x: number; y: number; width: number; height: number }
): Array<Omit<ImageAsset, 'filepath'>> {
  // Set screen bounds from root node
  if (!screenBounds && depth === 0 && node.absoluteBoundingBox) {
    screenBounds = {
      x: node.absoluteBoundingBox.x,
      y: node.absoluteBoundingBox.y,
      width: node.absoluteBoundingBox.width || BASE_DESIGN.width,
      height: node.absoluteBoundingBox.height || BASE_DESIGN.height,
    };
  }

  // Skip invisible nodes
  if (node.visible === false) {
    return collected;
  }

  // Check for exportable fills
  const fillCheck = hasExportableImageFill(node);

  if (fillCheck.hasImage || fillCheck.hasGradient) {
    const geometry = {
      x: node.absoluteBoundingBox?.x || 0,
      y: node.absoluteBoundingBox?.y || 0,
      width: node.absoluteBoundingBox?.width || 0,
      height: node.absoluteBoundingBox?.height || 0,
    };

    // Only collect if it has meaningful size (skip tiny elements)
    if (geometry.width >= 20 && geometry.height >= 20) {
      for (const fill of fillCheck.fills) {
        const assetEntry: Omit<ImageAsset, 'filepath'> = {
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          assetType: inferAssetType(node, screenBounds!),
          fillType: fill.type,
          geometry,
          opacity: fill.opacity ?? node.opacity,
          blendMode: fill.blendMode || node.blendMode,
        };

        // Add gradient-specific data
        if (fill.type?.startsWith('GRADIENT_') && fill.gradientStops) {
          assetEntry.gradientData = {
            gradientStops: fill.gradientStops.map((stop: any) => ({
              position: stop.position,
              color: figmaColorToHex(stop.color),
            })),
            gradientHandlePositions: fill.gradientHandlePositions,
          };
        }

        // Add image reference
        if (fill.type === 'IMAGE' && fill.imageRef) {
          assetEntry.imageRef = fill.imageRef;
        }

        collected.push(assetEntry);
      }
    }
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      collectImageAssets(child, depth + 1, collected, screenBounds);
    }
  }

  return collected;
}

/**
 * Fetch and save image assets as PNGs
 */
async function fetchImageAssets(
  config: FigmaConfig,
  assets: Array<Omit<ImageAsset, 'filepath'>>,
  outputDir: string
): Promise<ImageAsset[]> {
  const results: ImageAsset[] = [];

  if (assets.length === 0) return results;

  console.log(`   Fetching ${assets.length} image assets...`);

  // Get unique node IDs (a node might have multiple fills)
  const uniqueNodeIds = [...new Set(assets.map(a => a.nodeId))];

  // Batch request screenshots for these nodes
  const batchSize = 20;
  const nodeImagePaths = new Map<string, string>();

  for (let i = 0; i < uniqueNodeIds.length; i += batchSize) {
    const batch = uniqueNodeIds.slice(i, i + batchSize);
    const idsParam = batch.join(',');

    const url = `${config.restApiBaseUrl}/images/${config.fileKey}?ids=${idsParam}&scale=${config.exportScale}&format=${config.exportFormat}`;

    try {
      const response = await fetch(url, {
        headers: { 'X-Figma-Token': config.figmaToken },
      });

      if (!response.ok) {
        console.error(`   Figma images API error: ${response.status}`);
        continue;
      }

      const data = await response.json() as { images?: Record<string, string> };

      if (data.images) {
        for (const [nodeId, imageUrl] of Object.entries(data.images)) {
          if (imageUrl) {
            try {
              const imageResponse = await fetch(imageUrl);
              const buffer = await imageResponse.arrayBuffer();

              // Find the asset info for naming
              const assetInfo = assets.find(a => a.nodeId === nodeId);
              const safeName = (assetInfo?.nodeName || nodeId)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 50);

              const filename = `asset_${assetInfo?.assetType || 'image'}_${safeName}.png`;
              const filepath = path.join(outputDir, filename);

              fs.writeFileSync(filepath, Buffer.from(buffer));
              nodeImagePaths.set(nodeId, filepath);

              console.log(`     ✓ ${filename}`);
            } catch (imgError) {
              console.error(`     ✗ Failed to download image for ${nodeId}: ${imgError}`);
            }
          }
        }
      }

      // Rate limiting
      if (i + batchSize < uniqueNodeIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`   Failed to fetch image assets batch: ${error}`);
    }
  }

  // Map back to full asset objects with filepaths
  for (const asset of assets) {
    const filepath = nodeImagePaths.get(asset.nodeId);
    if (filepath) {
      results.push({
        ...asset,
        filepath,
      });
    }
  }

  return results;
}

function extractBasicNodeData(node: any): Record<string, any> {
  // Extract deterministic Figma API data
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible !== false,
    geometry: node.absoluteBoundingBox
      ? {
          x: node.absoluteBoundingBox.x,
          y: node.absoluteBoundingBox.y,
          width: node.absoluteBoundingBox.width,
          height: node.absoluteBoundingBox.height,
        }
      : null,
    constraints: node.constraints,
    fills: node.fills,
    strokes: node.strokes,
    effects: node.effects,
    cornerRadius: node.cornerRadius,
    layoutMode: node.layoutMode,
    primaryAxisAlignItems: node.primaryAxisAlignItems,
    counterAxisAlignItems: node.counterAxisAlignItems,
    paddingTop: node.paddingTop,
    paddingRight: node.paddingRight,
    paddingBottom: node.paddingBottom,
    paddingLeft: node.paddingLeft,
    itemSpacing: node.itemSpacing,
    opacity: node.opacity,
    blendMode: node.blendMode,
    // Typography
    style: node.style,
    characters: node.characters,
    characterStyleOverrides: node.characterStyleOverrides,
    styleOverrideTable: node.styleOverrideTable,
    // Text alignment (critical for TEXT nodes)
    textAlignHorizontal: node.style?.textAlignHorizontal,
    textAlignVertical: node.style?.textAlignVertical,
    textAutoResize: node.style?.textAutoResize,
    // Layout sizing mode (for frames)
    layoutSizingHorizontal: node.layoutSizingHorizontal,
    layoutSizingVertical: node.layoutSizingVertical,
    // Clip content
    clipsContent: node.clipsContent,
  };
}

function buildEnhancedNodeTree(
  node: any,
  screenshotPaths: Map<string, string>,
  aiAnalyses: Map<string, AIAnalysisResult['analysis']>,
  depth: number = 0
): EnhancedNodeData {
  const nodeId = node.id;

  const enhanced: EnhancedNodeData = {
    nodeId,
    nodeName: node.name,
    nodeType: node.type,
    figmaData: extractBasicNodeData(node),
    screenshotPath: screenshotPaths.get(nodeId),
    aiAnalysis: aiAnalyses.get(nodeId),
    aiConfidence: aiAnalyses.has(nodeId) ? 0.85 : undefined,
  };

  // Compute React Native styles from combined data
  enhanced.computedStyles = computeReactNativeStyles(
    enhanced.figmaData,
    enhanced.aiAnalysis
  );

  // Extract text styles with design token mapping for TEXT nodes
  if (node.type === 'TEXT') {
    const textStyles = extractTextStyles(enhanced.figmaData);
    if (textStyles) {
      enhanced.computedStyles._textStyles = textStyles;
    }
  }

  // Recurse into children
  if (node.children && node.children.length > 0) {
    enhanced.children = node.children.map((child: any) =>
      buildEnhancedNodeTree(child, screenshotPaths, aiAnalyses, depth + 1)
    );
  }

  return enhanced;
}

function computeReactNativeStyles(
  figmaData: Record<string, any>,
  aiAnalysis?: AIAnalysisResult['analysis']
): Record<string, any> {
  const styles: Record<string, any> = {};
  // Design token mappings - use these instead of raw values when available
  const tokens: Record<string, string> = {};

  // From Figma API
  if (figmaData.geometry) {
    styles.width = figmaData.geometry.width;
    styles.height = figmaData.geometry.height;
  }

  if (figmaData.cornerRadius) {
    styles.borderRadius = figmaData.cornerRadius;
    const radiusToken = mapRadiusToToken(figmaData.cornerRadius);
    if (radiusToken) tokens.borderRadius = radiusToken;
  }

  if (figmaData.opacity !== undefined && figmaData.opacity !== 1) {
    styles.opacity = figmaData.opacity;
  }

  // Background from fills
  if (figmaData.fills && figmaData.fills.length > 0) {
    const solidFill = figmaData.fills.find((f: any) => f.type === 'SOLID' && f.visible !== false);
    if (solidFill && solidFill.color) {
      const { r, g, b } = solidFill.color;
      const hex = `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
      styles.backgroundColor = hex.toUpperCase();
      const colorToken = mapColorToToken(styles.backgroundColor);
      if (colorToken) tokens.backgroundColor = colorToken;
    }
  }

  // Layout from Figma
  if (figmaData.layoutMode === 'VERTICAL') {
    styles.flexDirection = 'column';
  } else if (figmaData.layoutMode === 'HORIZONTAL') {
    styles.flexDirection = 'row';
  }

  if (figmaData.primaryAxisAlignItems) {
    const alignMap: Record<string, string> = {
      MIN: 'flex-start',
      CENTER: 'center',
      MAX: 'flex-end',
      SPACE_BETWEEN: 'space-between',
    };
    styles.justifyContent = alignMap[figmaData.primaryAxisAlignItems] || 'flex-start';
  }

  if (figmaData.counterAxisAlignItems) {
    const alignMap: Record<string, string> = {
      MIN: 'flex-start',
      CENTER: 'center',
      MAX: 'flex-end',
    };
    styles.alignItems = alignMap[figmaData.counterAxisAlignItems] || 'flex-start';

    // CRITICAL: When parent centers children on cross-axis, children need explicit widths
    // Otherwise they will shrink to content width instead of using Figma's explicit width
    if (figmaData.counterAxisAlignItems === 'CENTER') {
      styles._childrenNeedExplicitWidth = true;
    }
  }

  // Padding - with token mapping
  if (figmaData.paddingTop) {
    styles.paddingTop = figmaData.paddingTop;
    const spacingToken = mapSpacingToToken(figmaData.paddingTop);
    if (spacingToken) tokens.paddingTop = spacingToken;
  }
  if (figmaData.paddingRight) {
    styles.paddingRight = figmaData.paddingRight;
    const spacingToken = mapSpacingToToken(figmaData.paddingRight);
    if (spacingToken) tokens.paddingRight = spacingToken;
  }
  if (figmaData.paddingBottom) {
    styles.paddingBottom = figmaData.paddingBottom;
    const spacingToken = mapSpacingToToken(figmaData.paddingBottom);
    if (spacingToken) tokens.paddingBottom = spacingToken;
  }
  if (figmaData.paddingLeft) {
    styles.paddingLeft = figmaData.paddingLeft;
    const spacingToken = mapSpacingToToken(figmaData.paddingLeft);
    if (spacingToken) tokens.paddingLeft = spacingToken;
  }

  // Gap - with token mapping
  if (figmaData.itemSpacing) {
    styles.gap = figmaData.itemSpacing;
    const spacingToken = mapSpacingToToken(figmaData.itemSpacing);
    if (spacingToken) tokens.gap = spacingToken;
  }

  // Merge AI analysis hints
  if (aiAnalysis?.reactNativeHints?.styleProperties) {
    // AI can override/supplement with visual observations
    Object.assign(styles, aiAnalysis.reactNativeHints.styleProperties);
  }

  // Add design tokens to output (implementers should prefer these over raw values)
  if (Object.keys(tokens).length > 0) {
    styles._designTokens = tokens;
  }

  return styles;
}

/**
 * Extract typography properties from a TEXT node and map to design tokens
 */
function extractTextStyles(figmaData: Record<string, any>): Record<string, any> | null {
  if (figmaData.type !== 'TEXT') return null;

  const style = figmaData.style || {};
  const result: Record<string, any> = {
    fontSize: style.fontSize,
    lineHeight: style.lineHeightPx,
    fontWeight: style.fontWeight,
    fontFamily: style.fontPostScriptName || style.fontFamily,
    letterSpacing: style.letterSpacing || 0,
  };

  // Map to design token
  if (result.fontSize && result.lineHeight && result.fontWeight) {
    const typographyToken = mapTypographyToToken(
      result.fontSize,
      result.lineHeight,
      result.fontWeight
    );
    if (typographyToken) {
      result._designToken = typographyToken;
      result._useToken = true; // Flag to prefer token over raw values
    }
  }

  // Map text color to token
  if (figmaData.fills && figmaData.fills.length > 0) {
    const textFill = figmaData.fills.find((f: any) => f.type === 'SOLID' && f.visible !== false);
    if (textFill && textFill.color) {
      const { r, g, b } = textFill.color;
      const hex = `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
      result.color = hex.toUpperCase();
      const colorToken = mapColorToToken(result.color);
      if (colorToken) result._colorToken = colorToken;
    }
  }

  // Text alignment - CRITICAL for layout
  // Figma: LEFT, CENTER, RIGHT, JUSTIFIED → React Native: left, center, right, justify
  if (figmaData.textAlignHorizontal) {
    const alignMap: Record<string, string> = {
      'LEFT': 'left',
      'CENTER': 'center',
      'RIGHT': 'right',
      'JUSTIFIED': 'justify',
    };
    result.textAlign = alignMap[figmaData.textAlignHorizontal] || 'left';
  }

  // Vertical alignment for multi-line text
  if (figmaData.textAlignVertical) {
    result.textAlignVertical = figmaData.textAlignVertical.toLowerCase();
  }

  // Include actual text content for debugging/verification
  if (figmaData.characters) {
    result.text = figmaData.characters;
    // Check if text has line breaks
    if (figmaData.characters.includes('\n')) {
      result._hasLineBreaks = true;
      result._lineCount = figmaData.characters.split('\n').length;
    }
  }

  return result;
}

function flattenNodeTree(node: EnhancedNodeData, result: EnhancedNodeData[] = []): EnhancedNodeData[] {
  // Add current node (without children to avoid duplication)
  const { children, ...nodeWithoutChildren } = node;
  result.push(nodeWithoutChildren as EnhancedNodeData);

  // Recurse
  if (children) {
    for (const child of children) {
      flattenNodeTree(child, result);
    }
  }

  return result;
}

// ============================================================================
// MAIN EXTRACTION PIPELINE
// ============================================================================

async function extractScreenWithAI(
  config: FigmaConfig,
  screen: ScreenConfig,
  geminiClient: GeminiClient | null,
  outputDir: string
): Promise<EnhancedScreenOutput> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${screen.name} (${screen.nodeId})`);
  console.log(`${'='.repeat(60)}`);

  // Create output directories
  const screenDir = path.join(outputDir, screen.nodeId.replace(':', '-'));
  const screenshotsDir = path.join(screenDir, 'screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  // 1. Fetch node tree from Figma
  console.log('\n1. Fetching node tree from Figma API...');
  const nodeTree = await fetchNodeTree(config, screen.nodeId);

  if (!nodeTree) {
    throw new Error(`Failed to fetch node tree for ${screen.nodeId}`);
  }

  // 2. Collect nodes to capture screenshots for
  console.log('\n2. Collecting nodes for screenshot capture...');
  const nodesToCapture = collectNodesToCapture(nodeTree);

  // Always include the root screen node
  if (!nodesToCapture.find(n => n.nodeId === screen.nodeId)) {
    nodesToCapture.unshift({
      nodeId: screen.nodeId,
      nodeName: screen.name,
      nodeType: nodeTree.type,
      filepath: '',
      geometry: {
        x: nodeTree.absoluteBoundingBox?.x || 0,
        y: nodeTree.absoluteBoundingBox?.y || 0,
        width: nodeTree.absoluteBoundingBox?.width || BASE_DESIGN.width,
        height: nodeTree.absoluteBoundingBox?.height || BASE_DESIGN.height,
      },
      depth: 0,
    });
  }

  console.log(`   Found ${nodesToCapture.length} nodes to capture`);

  // 3. Fetch screenshots from Figma
  console.log('\n3. Fetching screenshots from Figma...');
  const nodeIds = nodesToCapture.map(n => n.nodeId);
  const screenshotPaths = await fetchScreenshots(config, nodeIds, screenshotsDir);

  // Update nodesToCapture with actual paths
  for (const node of nodesToCapture) {
    const filepath = screenshotPaths.get(node.nodeId);
    if (filepath) {
      node.filepath = filepath;
    }
  }

  console.log(`   Captured ${screenshotPaths.size} screenshots`);

  // 4. Run AI analysis on screenshots
  console.log('\n4. Running AI visual analysis...');
  let aiAnalyses = new Map<string, AIAnalysisResult['analysis']>();

  if (geminiClient) {
    // Prepare screenshots data for batch analysis
    const screenshotsForAnalysis = nodesToCapture
      .filter(node => node.filepath && fs.existsSync(node.filepath))
      .map(node => ({
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        nodeType: node.nodeType,
        filepath: node.filepath,
        geometry: node.geometry,
        depth: node.depth,
        isFullScreen: node.nodeId === screen.nodeId,
      }));

    if (CONFIG.ai.enableBatchAnalysis && screenshotsForAnalysis.length > 0) {
      // BATCH MODE: Send all screenshots to Gemini 3 Pro at once
      // This leverages the large context window for comprehensive analysis
      console.log(`   Using BATCH analysis mode with ${screenshotsForAnalysis.length} images...`);
      console.log('   Model: Gemini 3 Pro (large context window)');

      // Collect FULL Figma data for context - not just summaries
      // This is critical for AI to identify layout alignment, multi-component effects, etc.
      const figmaNodeData: Record<string, any> = {};
      const collectFullNodeData = (node: any, depth: number = 0) => {
        figmaNodeData[node.id] = extractBasicNodeData(node);
        figmaNodeData[node.id].depth = depth;

        // Also include children references for hierarchy understanding
        if (node.children && node.children.length > 0) {
          figmaNodeData[node.id].childIds = node.children.map((c: any) => c.id);
          for (const child of node.children) {
            collectFullNodeData(child, depth + 1);
          }
        }
      };
      collectFullNodeData(nodeTree);

      aiAnalyses = await geminiClient.analyzeBatch(screenshotsForAnalysis, figmaNodeData);
    } else {
      // SEQUENTIAL MODE: Analyze each screenshot individually
      console.log('   Using sequential analysis mode...');
      let analyzedCount = 0;

      for (const node of nodesToCapture) {
        if (!node.filepath || !fs.existsSync(node.filepath)) {
          continue;
        }

        console.log(`   Analyzing: ${node.nodeName} (${node.nodeType})`);

        const parentNode = nodesToCapture.find(n => n.nodeId === node.parentId);
        const siblings = nodesToCapture
          .filter(n => n.parentId === node.parentId && n.nodeId !== node.nodeId)
          .map(n => n.nodeName)
          .slice(0, 5);

        const analysis = await geminiClient.analyzeImage(node.filepath, {
          nodeName: node.nodeName,
          nodeType: node.nodeType,
          parentContext: parentNode?.nodeName,
          siblingContext: siblings,
          figmaHints: {
            width: node.geometry.width,
            height: node.geometry.height,
            depth: node.depth,
          },
        });

        if (analysis) {
          aiAnalyses.set(node.nodeId, analysis);
          analyzedCount++;
        }
      }

      console.log(`   Completed ${analyzedCount} AI analyses`);
    }
  } else {
    console.log('   Skipping AI analysis (no API key)');
  }

  // 5. Collect and fetch image/gradient assets (backgrounds, textures, overlays)
  console.log('\n5. Collecting image/gradient assets...');
  const assetsDir = path.join(screenDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const imageAssetNodes = collectImageAssets(nodeTree);
  console.log(`   Found ${imageAssetNodes.length} nodes with image/gradient fills`);

  let imageAssets: ImageAsset[] = [];
  if (imageAssetNodes.length > 0) {
    imageAssets = await fetchImageAssets(config, imageAssetNodes, assetsDir);
    console.log(`   Exported ${imageAssets.length} image assets`);
  }

  // 6. Build enhanced node tree
  console.log('\n6. Building enhanced node tree...');
  const componentTree = buildEnhancedNodeTree(nodeTree, screenshotPaths, aiAnalyses);

  // 7. Flatten for easy access
  const flatNodes = flattenNodeTree(componentTree);

  // 8. Compile output
  const processingTime = Date.now() - startTime;

  const output: EnhancedScreenOutput = {
    screenId: screen.nodeId,
    screenName: screen.name,
    module: screen.module || 'app',
    extractedAt: new Date().toISOString(),
    version: '3.2',
    pipelineVersion: '3.0-ai-enhanced',
    baseDesign: BASE_DESIGN,
    fullScreenshot: screenshotPaths.get(screen.nodeId) || '',
    fullScreenAnalysis: aiAnalyses.get(screen.nodeId),
    componentTree,
    nodes: flatNodes,
    assets: imageAssets,
    stats: {
      totalNodes: flatNodes.length,
      analyzedNodes: aiAnalyses.size,
      screenshotsCaptured: screenshotPaths.size,
      aiAnalysisCount: aiAnalyses.size,
      imageAssetsExtracted: imageAssets.length,
      processingTimeMs: processingTime,
    },
  };

  // 9. Save output
  const outputPath = path.join(screenDir, 'enhanced-extraction.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(output, null, CONFIG.output.prettyPrint ? 2 : 0)
  );

  console.log(`\nSaved: ${outputPath}`);
  console.log(`Stats: ${output.stats.totalNodes} nodes, ${output.stats.screenshotsCaptured} screenshots, ${output.stats.aiAnalysisCount} AI analyses, ${output.stats.imageAssetsExtracted} image assets`);
  console.log(`Time: ${(processingTime / 1000).toFixed(1)}s`);

  return output;
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   AI-Enhanced Figma Extraction Pipeline v3.2               ║');
  console.log('║   Deterministic API + AI Visual Analysis + Image Assets    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Load configuration
  const configPath = path.join(CONFIG.configDir, 'figma.json');
  if (!fs.existsSync(configPath)) {
    console.error(`Config not found: ${configPath}`);
    console.error('Please create figma.json with fileKey and figmaToken');
    process.exit(1);
  }

  const figmaConfigRaw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const figmaConfig: FigmaConfig = {
    figmaToken: process.env.FIGMA_TOKEN || figmaConfigRaw.figmaToken,
    fileKey: figmaConfigRaw.fileKey,
    restApiBaseUrl: CONFIG.restApiBaseUrl,
    exportScale: CONFIG.exportScale,
    exportFormat: CONFIG.exportFormat,
  };

  if (!figmaConfig.figmaToken) {
    console.error('FIGMA_TOKEN not set. Set via environment or figma.config.json');
    process.exit(1);
  }

  // Initialize Gemini client
  // Use same default key as call-gemini.ts for consistency
  const geminiApiKey = process.env.GEMINI_API_KEY || 'AIzaSyDdiHYz0g2P1cVd5HrU5Dwh7ALKPNLVqOM';
  let geminiClient: GeminiClient | null = null;

  if (geminiApiKey) {
    console.log('✓ Gemini 3 Pro API key found - AI analysis enabled');
    console.log(`  Model: ${CONFIG.ai.model}`);
    console.log(`  Batch mode: ${CONFIG.ai.enableBatchAnalysis ? 'ENABLED' : 'disabled'}`);
    geminiClient = new GeminiClient(geminiApiKey, CONFIG.ai.model);
  } else {
    console.log('⚠ GEMINI_API_KEY not set - AI analysis disabled');
    console.log('  Set GEMINI_API_KEY environment variable to enable AI analysis\n');
  }

  // Load screens configuration
  const screensConfigPath = path.join(CONFIG.configDir, 'screens-to-process.json');
  let screensToProcess: ScreenConfig[] = [];

  // Allow CLI override - supports both formats:
  // - Dash format for file paths: 1-29914
  // - Colon format for API: 1:29914
  const cliNodeId = process.argv[2];
  const cliName = process.argv[3];

  if (cliNodeId) {
    // Convert dash format to colon format for API if needed
    const apiNodeId = cliNodeId.includes(':') ? cliNodeId : cliNodeId.replace('-', ':');
    screensToProcess = [{
      nodeId: apiNodeId,
      name: cliName || `Screen ${cliNodeId}`,
    }];
  } else if (fs.existsSync(screensConfigPath)) {
    // Load from config file
    const screensConfig = JSON.parse(fs.readFileSync(screensConfigPath, 'utf-8'));
    // Map to use nodeIdApi (colon format) for API calls
    screensToProcess = (screensConfig.screens || []).map((s: any) => ({
      nodeId: s.nodeIdApi || s.nodeId.replace('-', ':'),
      name: s.name,
      module: s.module,
    })).slice(0, 5); // Limit to 5 screens by default
  }

  if (screensToProcess.length === 0) {
    console.error('No screens to process. Provide nodeId as argument or configure screens.config.json');
    process.exit(1);
  }

  console.log(`\nProcessing ${screensToProcess.length} screen(s)...\n`);

  // Process each screen
  const outputDir = path.join(CONFIG.dataDir, 'ai-enhanced');
  fs.mkdirSync(outputDir, { recursive: true });

  const results: EnhancedScreenOutput[] = [];

  for (const screen of screensToProcess) {
    try {
      const result = await extractScreenWithAI(
        figmaConfig,
        screen,
        geminiClient,
        outputDir
      );
      results.push(result);
    } catch (error) {
      console.error(`Failed to process ${screen.name}: ${error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('EXTRACTION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Screens processed: ${results.length}/${screensToProcess.length}`);
  console.log(`Output directory: ${outputDir}`);

  const totalStats = results.reduce(
    (acc, r) => ({
      nodes: acc.nodes + r.stats.totalNodes,
      screenshots: acc.screenshots + r.stats.screenshotsCaptured,
      aiAnalyses: acc.aiAnalyses + r.stats.aiAnalysisCount,
    }),
    { nodes: 0, screenshots: 0, aiAnalyses: 0 }
  );

  console.log(`Total nodes: ${totalStats.nodes}`);
  console.log(`Total screenshots: ${totalStats.screenshots}`);
  console.log(`Total AI analyses: ${totalStats.aiAnalyses}`);
}

// Run
main().catch(console.error);
