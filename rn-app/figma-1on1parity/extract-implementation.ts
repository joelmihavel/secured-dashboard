/**
 * extract-implementation.ts — Static Analysis of React Native Route Files
 *
 * Scans rn-app/app/ for all .tsx route files and extracts implementation
 * details: colors, typography, scaling usage, scroll containers,
 * safe area strategy, shadows, gradients, opacity values.
 *
 * Uses regex-based static analysis (no AST parsing).
 *
 * Output: figma-1on1parity/implementation/{routeKey}-impl.json
 *
 * Usage:
 *   npx tsx figma-1on1parity/extract-implementation.ts
 *   npx tsx figma-1on1parity/extract-implementation.ts --route auth-sign-up
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ColorLiteral {
  value: string;
  source: 'stylesheet' | 'inline' | 'theme';
  property: string;
}

interface TypographyEntry {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  fontWeight?: string;
}

interface ScalingUsage {
  function: string;
  rawValue: number;
  context: string;
}

type ScrollContainer =
  | 'ScrollView'
  | 'FlatList'
  | 'SectionList'
  | 'View'
  | 'KeyboardAvoidingView'
  | 'none';

interface ImplementationExtraction {
  routeKey: string;
  filePath: string;
  components: string[];
  colorLiterals: ColorLiteral[];
  typography: TypographyEntry[];
  scalingUsage: ScalingUsage[];
  scrollContainer: ScrollContainer;
  safeAreaStrategy: string;
  hasShadows: boolean;
  hasGradients: boolean;
  opacityValues: number[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname;
const RN_APP_DIR = path.resolve(SCRIPT_DIR, '..');
const APP_DIR = path.join(RN_APP_DIR, 'app');
const IMPL_DIR = path.join(SCRIPT_DIR, 'implementation');

// ---------------------------------------------------------------------------
// Regex Patterns
// ---------------------------------------------------------------------------

// Color patterns
const HEX_COLOR_RE = /#(?:[0-9A-Fa-f]{3,4}){1,2}\b/g;
const RGBA_RE = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/g;
const COLOR_PROPERTY_RE =
  /(color|backgroundColor|borderColor|tintColor|shadowColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor)\s*:\s*(?:'([^']+)'|"([^"]+)"|([^,}\s]+))/g;
const THEME_COLOR_RE = /colors\.(\w+)(?:\[['"]?(\w+)['"]?\]|\.\w+)/g;

// Typography patterns
const FONT_FAMILY_RE = /fontFamily\s*:\s*(?:'([^']+)'|"([^"]+)")/g;
const FONT_SIZE_RE = /fontSize\s*:\s*(?:sf\()?(\d+(?:\.\d+)?)\)?/g;
const LINE_HEIGHT_RE = /lineHeight\s*:\s*(?:sv\()?(\d+(?:\.\d+)?)\)?/g;
const LETTER_SPACING_RE = /letterSpacing\s*:\s*(-?\d+(?:\.\d+)?)/g;
const FONT_WEIGHT_RE = /fontWeight\s*:\s*(?:'([^']+)'|"([^"]+)")/g;

// Scaling function patterns: s(N), sv(N), sf(N)
const SCALING_RE = /\b(s|sv|sf)\(\s*(-?\d+(?:\.\d+)?)\s*\)/g;

// Component import patterns
const IMPORT_RE = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;

// StyleSheet.create detection
const STYLESHEET_BLOCK_RE = /StyleSheet\.create\(\{([\s\S]*?)\}\s*\)/g;

// Opacity patterns
const OPACITY_RE = /opacity\s*:\s*(\d+(?:\.\d+)?)/g;

// Shadow patterns
const SHADOW_RE =
  /shadow(?:Color|Offset|Opacity|Radius)|elevation\s*:/i;

// Gradient patterns
const GRADIENT_RE = /LinearGradient|RadialGradient|gradient/i;

// useAnimatedStyle patterns
const ANIMATED_STYLE_RE = /useAnimatedStyle\s*\(\s*\(\)\s*=>\s*\({([\s\S]*?)\}\)/g;

// Inline style patterns — style={{ ... }}
const INLINE_STYLE_RE = /style\s*=\s*\{\{([\s\S]*?)\}\}/g;

// ---------------------------------------------------------------------------
// Extraction Functions
// ---------------------------------------------------------------------------

function extractRouteKey(filePath: string): string {
  // Convert app/(auth)/sign-up.tsx -> auth-sign-up
  const rel = path.relative(APP_DIR, filePath);
  return rel
    .replace(/\.tsx?$/, '')
    .replace(/\(([^)]+)\)\//g, '$1-')
    .replace(/\//g, '-')
    .replace(/_layout$/, 'layout');
}

function extractComponents(source: string): string[] {
  const components = new Set<string>();
  let match: RegExpExecArray | null;

  const importRe = new RegExp(IMPORT_RE.source, 'g');
  while ((match = importRe.exec(source)) !== null) {
    const imports = match[1];
    const from = match[2];

    // Only track component imports (from @/src/components or relative)
    if (from.includes('components') || from.startsWith('.')) {
      const names = imports.split(',').map((n) => n.trim()).filter(Boolean);
      for (const name of names) {
        // Handle "Foo as Bar" aliases
        const clean = name.split(/\s+as\s+/)[0].trim();
        if (clean && /^[A-Z]/.test(clean)) {
          components.add(clean);
        }
      }
    }
  }

  return Array.from(components).sort();
}

function extractColorLiterals(source: string): ColorLiteral[] {
  const colors: ColorLiteral[] = [];
  const seen = new Set<string>();

  // Extract from color properties in stylesheets and inline styles
  let match: RegExpExecArray | null;

  const propRe = new RegExp(COLOR_PROPERTY_RE.source, 'g');
  while ((match = propRe.exec(source)) !== null) {
    const property = match[1];
    const value = match[2] || match[3] || match[4];
    if (!value) continue;

    // Determine source type
    const isInStylesheet = isInStylesheetBlock(source, match.index);
    const isTheme = /colors\.|PAYMENT_COLORS|FIGMA_COLORS/.test(value);

    let sourceType: ColorLiteral['source'] = 'inline';
    if (isInStylesheet) sourceType = 'stylesheet';
    if (isTheme) sourceType = 'theme';

    const key = `${value}:${property}:${sourceType}`;
    if (!seen.has(key)) {
      seen.add(key);
      colors.push({ value, source: sourceType, property });
    }
  }

  // Extract standalone hex colors in style contexts
  const hexRe = new RegExp(HEX_COLOR_RE.source, 'g');
  while ((match = hexRe.exec(source)) !== null) {
    const value = match[0].toUpperCase();
    // Only include if not already captured via property extraction
    if (!seen.has(`${value}:standalone:stylesheet`) && !seen.has(`${value}:standalone:inline`)) {
      const src = isInStylesheetBlock(source, match.index) ? 'stylesheet' : 'inline';
      const key = `${value}:standalone:${src}`;
      if (!seen.has(key)) {
        seen.add(key);
        colors.push({ value, source: src as ColorLiteral['source'], property: 'standalone' });
      }
    }
  }

  return colors;
}

function isInStylesheetBlock(source: string, position: number): boolean {
  // Check if the position is within a StyleSheet.create({...}) block
  const ssRe = /StyleSheet\.create\(\{/g;
  let match: RegExpExecArray | null;
  while ((match = ssRe.exec(source)) !== null) {
    const start = match.index;
    // Find matching closing })
    let depth = 1;
    let i = start + match[0].length;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      if (source[i] === '}') depth--;
      i++;
    }
    if (position >= start && position < i) return true;
  }
  return false;
}

function extractTypography(source: string): TypographyEntry[] {
  const entries: TypographyEntry[] = [];
  const seen = new Set<string>();

  // Find all style blocks (StyleSheet + inline + animated)
  const styleBlocks = [
    ...extractStyleBlocks(source, STYLESHEET_BLOCK_RE),
    ...extractStyleBlocks(source, INLINE_STYLE_RE),
    ...extractStyleBlocks(source, ANIMATED_STYLE_RE),
  ];

  for (const block of styleBlocks) {
    // Split into individual style rules
    const rules = block.split(/[,}]\s*(?:\w+\s*:\s*\{|$)/);

    for (const rule of rules) {
      const entry: TypographyEntry = {};

      let m: RegExpExecArray | null;

      const ffRe = new RegExp(FONT_FAMILY_RE.source, 'g');
      if ((m = ffRe.exec(rule))) entry.fontFamily = m[1] || m[2];

      const fsRe = new RegExp(FONT_SIZE_RE.source, 'g');
      if ((m = fsRe.exec(rule))) entry.fontSize = parseFloat(m[1]);

      const lhRe = new RegExp(LINE_HEIGHT_RE.source, 'g');
      if ((m = lhRe.exec(rule))) entry.lineHeight = parseFloat(m[1]);

      const lsRe = new RegExp(LETTER_SPACING_RE.source, 'g');
      if ((m = lsRe.exec(rule))) entry.letterSpacing = parseFloat(m[1]);

      const fwRe = new RegExp(FONT_WEIGHT_RE.source, 'g');
      if ((m = fwRe.exec(rule))) entry.fontWeight = m[1] || m[2];

      // Only add if we found at least one typography property
      if (Object.keys(entry).length > 0) {
        const key = JSON.stringify(entry);
        if (!seen.has(key)) {
          seen.add(key);
          entries.push(entry);
        }
      }
    }
  }

  return entries;
}

function extractStyleBlocks(source: string, regex: RegExp): string[] {
  const blocks: string[] = [];
  const re = new RegExp(regex.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    blocks.push(match[1] || match[0]);
  }
  return blocks;
}

function extractScalingUsage(source: string): ScalingUsage[] {
  const usages: ScalingUsage[] = [];
  const seen = new Set<string>();

  const re = new RegExp(SCALING_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const fn = match[1];
    const rawValue = parseFloat(match[2]);

    // Try to find the property context (look backward for property name)
    const before = source.slice(Math.max(0, match.index - 60), match.index);
    const propMatch = before.match(/(\w+)\s*:\s*$/);
    const context = propMatch ? propMatch[1] : 'unknown';

    const key = `${fn}:${rawValue}:${context}`;
    if (!seen.has(key)) {
      seen.add(key);
      usages.push({ function: fn, rawValue, context });
    }
  }

  return usages;
}

function detectScrollContainer(source: string): ScrollContainer {
  // Check for scroll containers in JSX (order by specificity)
  if (/\bKeyboardAvoidingView\b/.test(source) && /\bScrollView\b/.test(source)) {
    return 'KeyboardAvoidingView';
  }
  if (/\bSectionList\b/.test(source)) return 'SectionList';
  if (/\bFlatList\b/.test(source)) return 'FlatList';
  if (/\bScrollView\b/.test(source)) return 'ScrollView';
  if (/<View[\s>]/.test(source)) return 'View';
  return 'none';
}

function detectSafeAreaStrategy(source: string): string {
  if (/\bScreen\b/.test(source) && /from\s+['"]@\/src\/components/.test(source)) {
    return 'Screen component';
  }
  if (/useSafeAreaInsets/.test(source)) return 'useSafeAreaInsets';
  if (/SafeAreaView/.test(source)) return 'SafeAreaView';
  return 'none';
}

function extractOpacityValues(source: string): number[] {
  const values = new Set<number>();
  const re = new RegExp(OPACITY_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const val = parseFloat(match[1]);
    if (val >= 0 && val <= 1) {
      values.add(val);
    }
  }
  return Array.from(values).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Main Extraction
// ---------------------------------------------------------------------------

function extractImplementation(filePath: string): ImplementationExtraction {
  const source = fs.readFileSync(filePath, 'utf-8');
  const routeKey = extractRouteKey(filePath);
  const relPath = path.relative(RN_APP_DIR, filePath);

  return {
    routeKey,
    filePath: relPath,
    components: extractComponents(source),
    colorLiterals: extractColorLiterals(source),
    typography: extractTypography(source),
    scalingUsage: extractScalingUsage(source),
    scrollContainer: detectScrollContainer(source),
    safeAreaStrategy: detectSafeAreaStrategy(source),
    hasShadows: SHADOW_RE.test(source),
    hasGradients: GRADIENT_RE.test(source),
    opacityValues: extractOpacityValues(source),
  };
}

// ---------------------------------------------------------------------------
// File Discovery
// ---------------------------------------------------------------------------

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(d: string): void {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        // Skip __tests__ and node_modules
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        // Skip layout files — they're routing wrappers, not screens
        if (entry.name === '_layout.tsx') continue;
        results.push(full);
      }
    }
  }

  walk(dir);
  return results.sort();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  Implementation Extractor');
  console.log('========================================\n');

  // Parse optional --route filter
  const routeFilter = process.argv.find((_, i) => process.argv[i - 1] === '--route');

  if (!fs.existsSync(APP_DIR)) {
    console.error(`  Error: app/ directory not found at ${APP_DIR}`);
    process.exit(1);
  }

  const routeFiles = findRouteFiles(APP_DIR);
  console.log(`  Route files found: ${routeFiles.length}`);

  // Ensure implementation directory exists
  fs.mkdirSync(IMPL_DIR, { recursive: true });

  let successCount = 0;
  let errorCount = 0;
  let skipCount = 0;

  const report: Array<{
    routeKey: string;
    components: number;
    colors: number;
    typography: number;
    scaling: number;
    scroll: string;
    safeArea: string;
  }> = [];

  for (const filePath of routeFiles) {
    const routeKey = extractRouteKey(filePath);

    // Apply route filter if specified
    if (routeFilter && !routeKey.includes(routeFilter)) {
      skipCount++;
      continue;
    }

    try {
      const impl = extractImplementation(filePath);

      const outFile = `${routeKey}-impl.json`;
      const outPath = path.join(IMPL_DIR, outFile);
      const jsonStr = JSON.stringify(impl, null, 2);
      fs.writeFileSync(outPath, jsonStr);

      const sizeKB = (Buffer.byteLength(jsonStr) / 1024).toFixed(1);
      console.log(
        `  [OK] ${outFile}  (${sizeKB} KB, ${impl.components.length} components, ${impl.colorLiterals.length} colors)`
      );

      report.push({
        routeKey: impl.routeKey,
        components: impl.components.length,
        colors: impl.colorLiterals.length,
        typography: impl.typography.length,
        scaling: impl.scalingUsage.length,
        scroll: impl.scrollContainer,
        safeArea: impl.safeAreaStrategy,
      });
      successCount++;
    } catch (err) {
      console.error(`  [FAIL] ${filePath}: ${err}`);
      errorCount++;
    }
  }

  // Print report
  console.log('');
  console.log('========================================');
  console.log('  Extraction Report');
  console.log('========================================');
  console.log(`  Extracted: ${successCount}`);
  console.log(`  Skipped:   ${skipCount}`);
  console.log(`  Failed:    ${errorCount}`);

  if (report.length > 0) {
    console.log('');
    console.log('  Route Key                        | Comps | Colors | Typo | Scale | Scroll              | SafeArea');
    console.log('  ' + '-'.repeat(110));
    for (const r of report) {
      console.log(
        `  ${r.routeKey.padEnd(34)} | ${String(r.components).padStart(5)} | ${String(r.colors).padStart(6)} | ${String(r.typography).padStart(4)} | ${String(r.scaling).padStart(5)} | ${r.scroll.padEnd(19)} | ${r.safeArea}`
      );
    }
  }

  console.log('========================================');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
