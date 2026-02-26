/**
 * generate-summaries.ts — Blueprint Summary Generator
 *
 * Reads all *-blueprint.json files from data/ and generates compact
 * *-summary.json files (4-6KB each) in summaries/.
 *
 * Each summary includes: text contents, color palette, spacing values,
 * node counts, feature flags, and a SHA-256 fingerprint for change detection.
 *
 * Usage:
 *   npx tsx figma-1on1parity/generate-summaries.ts
 *   npx tsx figma-1on1parity/generate-summaries.ts --screen 41-9388
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScreenSummary {
  screenId: string;
  screenName: string;
  route?: string;
  state?: string;
  category?: string;
  dimensions: { width: number; height: number };
  background: { color: string; hasDottedPattern: boolean; backgroundShapeKey?: string };
  counts: {
    nodes: number;
    textNodes: number;
    componentInstances: number;
    interactiveNodes: number;
    imageAssets: number;
  };
  textContents: Array<{
    nodeId: string;
    content: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: number;
    color: string;
    lineHeight: number;
  }>;
  colorPalette: string[];
  spacingValues: number[];
  flags: {
    scrollable: boolean;
    hasSafeAreaNodes: boolean;
    hasGradients: boolean;
    hasShadows: boolean;
    hasAnimations: boolean;
    modalOverlays: boolean;
  };
  fingerprint: string;
}

interface ScreenMapping {
  figmaNodeId: string;
  screenName: string;
  route?: string;
  state?: string;
  category?: string;
}

interface BlueprintNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  opacity?: number;
  fills?: Array<{
    type: string;
    color?: string;
    opacity?: number;
    visible?: boolean;
    imageRef?: string;
    gradientStops?: unknown[];
  }>;
  strokes?: Array<{ color?: string }>;
  effects?: Array<{ type: string }>;
  text?: {
    content: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: number;
    lineHeight?: number;
    letterSpacing?: number;
  };
  geometry?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  layout?: {
    direction?: string;
    gap?: number;
    padding?: { top: number; right: number; bottom: number; left: number };
  };
  children?: BlueprintNode[];
  componentId?: string;
  interactions?: unknown[];
  [key: string]: unknown;
}

interface Blueprint {
  meta: {
    screenId: string;
    screenName: string;
    dimensions: { width: number; height: number };
  };
  background: {
    color: string;
    hasDottedPattern: boolean;
    backgroundShapeKey?: string;
  };
  nodes: BlueprintNode[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname;
const DATA_DIR = path.join(SCRIPT_DIR, 'data');
const SUMMARIES_DIR = path.join(SCRIPT_DIR, 'summaries');
const MAPPING_FILE = path.join(SCRIPT_DIR, 'screen-mapping.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadScreenMapping(): Map<string, ScreenMapping> {
  const map = new Map<string, ScreenMapping>();
  if (!fs.existsSync(MAPPING_FILE)) return map;

  try {
    const data = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
    const screens: ScreenMapping[] = data.screens || [];
    for (const s of screens) {
      // Normalize node ID: "1:29108" -> "1-29108"
      const dashId = s.figmaNodeId.replace(/:/g, '-');
      map.set(dashId, s);
    }
  } catch (err) {
    console.warn(`  Warning: Could not parse screen-mapping.json: ${err}`);
  }
  return map;
}

/** Recursively collect all colors from fills and strokes */
function collectColors(node: BlueprintNode, colors: Set<string>): void {
  if (node.fills) {
    for (const fill of node.fills) {
      if (fill.color && fill.visible !== false) {
        colors.add(fill.color.toUpperCase());
      }
    }
  }
  if (node.strokes) {
    for (const stroke of node.strokes) {
      if (stroke.color) {
        colors.add((stroke.color as string).toUpperCase());
      }
    }
  }
  if (node.text?.content && node.fills) {
    for (const fill of node.fills) {
      if (fill.color) {
        colors.add(fill.color.toUpperCase());
      }
    }
  }
}

/** Recursively collect spacing values from layout padding and gaps */
function collectSpacing(node: BlueprintNode, spacings: Set<number>): void {
  if (node.layout) {
    if (node.layout.gap && node.layout.gap > 0) spacings.add(node.layout.gap);
    if (node.layout.padding) {
      const p = node.layout.padding;
      if (p.top > 0) spacings.add(p.top);
      if (p.right > 0) spacings.add(p.right);
      if (p.bottom > 0) spacings.add(p.bottom);
      if (p.left > 0) spacings.add(p.left);
    }
  }
}

/** Recursively walk all nodes */
function walkNodes(
  nodes: BlueprintNode[],
  visitor: (node: BlueprintNode) => void
): void {
  for (const node of nodes) {
    visitor(node);
    if (node.children) {
      walkNodes(node.children, visitor);
    }
  }
}

/** Flatten nested blueprint nodes into a flat array */
function flattenNodes(nodes: BlueprintNode[]): BlueprintNode[] {
  const result: BlueprintNode[] = [];
  walkNodes(nodes, (node) => result.push(node));
  return result;
}

/** Compute SHA-256 fingerprint from key summary properties */
function computeFingerprint(summary: Omit<ScreenSummary, 'fingerprint'>): string {
  const payload = JSON.stringify({
    screenId: summary.screenId,
    dimensions: summary.dimensions,
    background: summary.background,
    counts: summary.counts,
    textContents: summary.textContents.map((t) => ({
      content: t.content,
      fontSize: t.fontSize,
      color: t.color,
    })),
    colorPalette: summary.colorPalette,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// ---------------------------------------------------------------------------
// Summary Generation
// ---------------------------------------------------------------------------

function generateSummary(
  blueprint: Blueprint,
  mapping: Map<string, ScreenMapping>
): ScreenSummary {
  const { meta, background, nodes } = blueprint;
  const screenId = meta.screenId;
  const allNodes = flattenNodes(nodes);

  // Look up route info from mapping
  const mapEntry = mapping.get(screenId);

  // Count node types
  let textNodeCount = 0;
  let componentInstanceCount = 0;
  let interactiveNodeCount = 0;
  let imageAssetCount = 0;

  const colors = new Set<string>();
  const spacings = new Set<number>();
  const textContents: ScreenSummary['textContents'] = [];

  let hasGradients = false;
  let hasShadows = false;
  let hasScrollable = false;
  let hasSafeArea = false;
  let hasAnimations = false;
  let hasModal = false;

  for (const node of allNodes) {
    // Text nodes
    if (node.type === 'TEXT' && node.text?.content) {
      textNodeCount++;
      const textFillColor =
        node.fills?.find((f) => f.color && f.visible !== false)?.color || '#FFFFFF';
      textContents.push({
        nodeId: node.id,
        content: node.text.content,
        fontSize: node.text.fontSize,
        fontFamily: node.text.fontFamily || 'PlusJakartaSans',
        fontWeight: node.text.fontWeight || 400,
        color: textFillColor.toUpperCase(),
        lineHeight: node.text.lineHeight || 0,
      });
    }

    // Component instances
    if (node.type === 'INSTANCE' || node.componentId) {
      componentInstanceCount++;
    }

    // Interactive nodes (buttons, inputs, etc.)
    if (
      node.interactions?.length ||
      /button|input|toggle|switch|checkbox|tap|press|click/i.test(node.name)
    ) {
      interactiveNodeCount++;
    }

    // Image assets
    if (node.fills) {
      for (const fill of node.fills) {
        if (fill.type === 'IMAGE' && fill.imageRef) {
          imageAssetCount++;
        }
        if (fill.gradientStops) {
          hasGradients = true;
        }
      }
    }

    // Shadows
    if (node.effects) {
      for (const effect of node.effects) {
        if (/shadow/i.test(effect.type)) {
          hasShadows = true;
        }
      }
    }

    // Scrollable detection
    if (/scroll/i.test(node.name) || node.type === 'FRAME' && (node as Record<string, unknown>).scrollBehavior) {
      hasScrollable = true;
    }

    // Safe area detection
    if (/safe.?area|status.?bar|notch/i.test(node.name)) {
      hasSafeArea = true;
    }

    // Animation detection
    if (/anim|lottie|motion|transition/i.test(node.name)) {
      hasAnimations = true;
    }

    // Modal / overlay detection
    if (/modal|overlay|backdrop|sheet/i.test(node.name)) {
      hasModal = true;
    }

    // Collect colors and spacing
    collectColors(node, colors);
    collectSpacing(node, spacings);
  }

  // Add background color to palette
  if (background.color) {
    colors.add(background.color.toUpperCase());
  }

  // Sort color palette and spacing for determinism
  const colorPalette = Array.from(colors).sort();
  const spacingValues = Array.from(spacings).sort((a, b) => a - b);

  const summaryWithoutFingerprint: Omit<ScreenSummary, 'fingerprint'> = {
    screenId,
    screenName: meta.screenName,
    route: mapEntry?.route,
    state: mapEntry?.state,
    category: mapEntry?.category,
    dimensions: meta.dimensions,
    background: {
      color: background.color,
      hasDottedPattern: background.hasDottedPattern,
      backgroundShapeKey: background.backgroundShapeKey,
    },
    counts: {
      nodes: allNodes.length,
      textNodes: textNodeCount,
      componentInstances: componentInstanceCount,
      interactiveNodes: interactiveNodeCount,
      imageAssets: imageAssetCount,
    },
    textContents,
    colorPalette,
    spacingValues,
    flags: {
      scrollable: hasScrollable,
      hasSafeAreaNodes: hasSafeArea,
      hasGradients,
      hasShadows,
      hasAnimations,
      modalOverlays: hasModal,
    },
  };

  return {
    ...summaryWithoutFingerprint,
    fingerprint: computeFingerprint(summaryWithoutFingerprint),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  Blueprint Summary Generator');
  console.log('========================================\n');

  // Parse optional --screen filter
  const screenFilter = process.argv.find((_, i) => process.argv[i - 1] === '--screen');

  // Load screen mapping
  const mapping = loadScreenMapping();
  console.log(`  Screen mapping: ${mapping.size} entries loaded`);

  // Find all blueprint files
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`  Error: data/ directory not found at ${DATA_DIR}`);
    process.exit(1);
  }

  const blueprintFiles = fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('-blueprint.json'))
    .filter((f) => !screenFilter || f.startsWith(screenFilter));

  if (blueprintFiles.length === 0) {
    console.log('  No blueprint files found. Run extract-screen.ts first.');
    process.exit(0);
  }

  console.log(`  Blueprint files: ${blueprintFiles.length} found`);
  console.log('');

  // Ensure summaries directory exists
  fs.mkdirSync(SUMMARIES_DIR, { recursive: true });

  let successCount = 0;
  let errorCount = 0;
  const summaryStats: Array<{ screenId: string; name: string; size: number; nodes: number; texts: number }> = [];

  for (const file of blueprintFiles) {
    const filePath = path.join(DATA_DIR, file);
    try {
      const blueprint: Blueprint = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const summary = generateSummary(blueprint, mapping);

      // Write summary
      const outFile = file.replace('-blueprint.json', '-summary.json');
      const outPath = path.join(SUMMARIES_DIR, outFile);
      const jsonStr = JSON.stringify(summary, null, 2);
      fs.writeFileSync(outPath, jsonStr);

      const sizeKB = (Buffer.byteLength(jsonStr) / 1024).toFixed(1);
      console.log(`  [OK] ${outFile}  (${sizeKB} KB, ${summary.counts.nodes} nodes, ${summary.counts.textNodes} texts)`);

      summaryStats.push({
        screenId: summary.screenId,
        name: summary.screenName,
        size: Buffer.byteLength(jsonStr),
        nodes: summary.counts.nodes,
        texts: summary.counts.textNodes,
      });
      successCount++;
    } catch (err) {
      console.error(`  [FAIL] ${file}: ${err}`);
      errorCount++;
    }
  }

  // Print report
  console.log('');
  console.log('========================================');
  console.log('  Summary Report');
  console.log('========================================');
  console.log(`  Generated: ${successCount}`);
  console.log(`  Failed:    ${errorCount}`);

  if (summaryStats.length > 0) {
    const totalSize = summaryStats.reduce((s, e) => s + e.size, 0);
    const avgSize = totalSize / summaryStats.length;
    const totalNodes = summaryStats.reduce((s, e) => s + e.nodes, 0);
    const totalTexts = summaryStats.reduce((s, e) => s + e.texts, 0);

    console.log(`  Avg size:  ${(avgSize / 1024).toFixed(1)} KB`);
    console.log(`  Total nodes: ${totalNodes}`);
    console.log(`  Total text nodes: ${totalTexts}`);
  }
  console.log('========================================');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
