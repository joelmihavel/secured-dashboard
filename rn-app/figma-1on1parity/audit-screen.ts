/**
 * audit-screen.ts — 10-Pass Figma vs Implementation Comparison Engine
 *
 * Compares Figma blueprint data against implementation extraction data.
 * Produces per-screen audit reports and an aggregate summary.
 *
 * Usage:
 *   npx tsx figma-1on1parity/audit-screen.ts                    # Audit all screens
 *   npx tsx figma-1on1parity/audit-screen.ts --screen 1-29108   # Audit single screen
 *   npx tsx figma-1on1parity/audit-screen.ts --route auth/sign-up  # Audit by route
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MatchType = 'match' | 'close' | 'approximation' | 'mismatch' | 'skip';
type Severity = 'critical' | 'error' | 'warning' | 'info';
type PassStatus = 'pass' | 'warn' | 'fail';
type Effort = 'low' | 'medium' | 'high';
type Impact = 'low' | 'medium' | 'high';

interface AuditIssue {
  severity: Severity;
  pass: string;
  property: string;
  figmaValue: string;
  appValue: string;
  matchType: MatchType;
  nodeId?: string;
  nodeName?: string;
  suggestion?: string;
}

interface PassResult {
  status: PassStatus;
  matchCount: number;
  closeCount: number;
  approximationCount: number;
  mismatchCount: number;
  skipCount: number;
  issues: AuditIssue[];
}

interface AuditSummaryStats {
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  totalChecks: number;
  passRate: number;
}

interface ScreenAudit {
  screenId: string;
  screenName: string;
  route: string;
  state: string;
  auditedAt: string;
  score: number;
  passes: Record<string, PassResult>;
  summary: AuditSummaryStats;
}

interface AuditSummary {
  generatedAt: string;
  totalScreensAudited: number;
  overallScore: number;
  byRoute: Record<string, {
    score: number;
    statesAudited: number;
    topIssues: string[];
  }>;
  byPriority: Record<string, { score: number; screens: number }>;
  topIssues: Array<{
    severity: string;
    count: number;
    description: string;
    affectedScreens: string[];
  }>;
  fixList: Array<{
    priority: number;
    route: string;
    issue: string;
    effort: Effort;
    impact: Impact;
  }>;
}

// Figma blueprint node shape (subset of fields we inspect)
interface BlueprintNode {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  depth: number;
  visible: boolean;
  geometry: { x: number; y: number; width: number; height: number; rotation: number };
  opacity: number;
  fills: Array<{
    type: string;
    visible: boolean;
    color?: string;
    opacity?: number;
    gradientStops?: Array<{ color: string; position: number; opacity: number }>;
    gradientHandlePositions?: Array<{ x: number; y: number }>;
  }>;
  strokes: Array<{
    color: string;
    weight: number;
    visible: boolean;
    align: string;
    cap?: string;
    join?: string;
    dashPattern?: number[];
  }>;
  effects: Array<{
    type: string;
    visible: boolean;
    color: string;
    offset?: { x: number; y: number };
    blur?: number;
    spread?: number;
  }>;
  borderRadius: number | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  clipsContent: boolean;
  layout?: {
    direction: string;
    justifyContent: string;
    alignItems: string;
    gap: number;
    padding: { top: number; right: number; bottom: number; left: number };
    wrap: string;
    sizingH?: string;
    sizingV?: string;
    counterAxisSizingMode?: string;
  };
  typography?: {
    content: string;
    fontSize: number;
    lineHeight: number;
    fontWeight: number;
    fontFamily: string;
    fontStyle: string;
    letterSpacing: number;
    textAlign: string;
    textAlignVertical: string;
    textDecoration: string;
    textTransform: string;
    color: string;
    spans: unknown[];
    lineHeightUnit: string;
    fontPostScriptName: string;
  };
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  layoutAlign?: string;
  layoutPositioning?: string;
  cornerSmoothing?: number;
  childIds?: string[];
  rnComponent?: string;
}

interface BlueprintJSON {
  meta: {
    screenId: string;
    screenName: string;
    figmaUrl: string;
    dimensions: { width: number; height: number };
    generatedAt: string;
    figmaFileKey: string;
  };
  background: {
    color: string;
    hasDottedPattern: boolean;
  };
  nodes: BlueprintNode[];
}

// Implementation extraction node (expected format from extract-implementation.ts)
interface ImplNode {
  componentName: string;
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  children?: ImplNode[];
  // Flattened computed values
  _computed?: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    lineHeight?: number;
    letterSpacing?: number;
    textAlign?: string;
    color?: string;
    backgroundColor?: string;
    borderRadius?: number | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
    borderWidth?: number;
    borderColor?: string;
    borderStyle?: string;
    padding?: { top: number; right: number; bottom: number; left: number };
    margin?: { top: number; right: number; bottom: number; left: number };
    gap?: number;
    flexDirection?: string;
    justifyContent?: string;
    alignItems?: string;
    width?: number | string;
    height?: number | string;
    flex?: number;
    position?: string;
    opacity?: number;
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
    gradientColors?: string[];
    gradientLocations?: number[];
    gradientStart?: { x: number; y: number };
    gradientEnd?: { x: number; y: number };
  };
  _nodeId?: string;
  _nodeName?: string;
}

interface ImplJSON {
  screenId: string;
  route: string;
  state: string;
  extractedAt: string;
  componentTree: ImplNode[];
  flatNodes: ImplNode[];
}

interface ScreenMapping {
  figmaNodeId: string;
  screenName: string;
  route: string;
  state: string;
  category: string;
  tier: number;
}

interface ScreenMappingFile {
  meta: {
    figmaFileKey: string;
    topLevelNodeId: string;
    totalScreens: number;
    generatedAt: string;
    featureAreas: number;
  };
  screens: ScreenMapping[];
}

// ---------------------------------------------------------------------------
// Token Map (Pass 0)
// ---------------------------------------------------------------------------

interface TokenMap {
  colors: Record<string, string>;        // token path → hex
  reverseColors: Record<string, string[]>; // hex → token path(s)
  semanticColors: Record<string, string>; // semantic path → hex
  reverseSemantic: Record<string, string[]>; // hex → semantic path(s)
  typography: Record<string, { fontSize: number; lineHeight: number; fontFamily: string; fontWeight: string; letterSpacing: number }>;
  spacing: Record<string, number>;
  reverseSpacing: Record<number, string[]>;
  radius: Record<string, number>;
  reverseRadius: Record<number, string[]>;
  shadows: Record<string, { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number }>;
  fontWeightToFamily: Record<string, string>; // '400' → 'PlusJakartaSans-Regular'
  gradients: Record<string, { colors: string[]; locations: number[]; start: { x: number; y: number }; end: { x: number; y: number } }>;
}

function buildTokenMap(): TokenMap {
  // --- Colors ---
  const colorsMap: Record<string, string> = {
    'colors.black.900': '#000000',
    'colors.black.800': '#0D0D0D',
    'colors.black.700': '#131313',
    'colors.black.600': '#1A1A1A',
    'colors.black.500': '#202020',
    'colors.black.400': '#4D4D4D',
    'colors.black.350': '#656565',
    'colors.black.300': '#797979',
    'colors.black.200': '#A6A6A6',
    'colors.neutral.100': '#EEEEEE',
    'colors.neutral.200': '#DDDDDD',
    'colors.neutral.300': '#CBCBCB',
    'colors.neutral.400': '#BABABA',
    'colors.neutral.500': '#A9A9A9',
    'colors.neutral.600': '#878787',
    'colors.neutral.800': '#444444',
    'colors.neutral.900': '#222222',
    'colors.brand.300': '#FFCC8A',
    'colors.brand.400': '#FFAE8A',
    'colors.brand.500': '#FF9A6D',
    'colors.brand.600': '#CC7B57',
    'colors.brand.700': '#F06321',
    'colors.brand.800': '#E9661C',
    'colors.success.default': '#70BF73',
    'colors.success.approved': '#06C270',
    'colors.success.dark': '#27803B',
    'colors.success.material': '#4CAF50',
    'colors.error.default': '#FF8080',
    'colors.error.radix': '#E5484D',
    'colors.error.dark': '#AE282E',
    'colors.warning.default': '#FFD580',
    'colors.warning.amber': '#FFB020',
    'colors.white': '#FFFFFF',
  };

  const reverseColors: Record<string, string[]> = {};
  for (const [token, hex] of Object.entries(colorsMap)) {
    const upper = hex.toUpperCase();
    if (!reverseColors[upper]) reverseColors[upper] = [];
    reverseColors[upper].push(token);
  }

  // --- Semantic Colors ---
  const semanticColorsMap: Record<string, string> = {
    'semanticColors.background.primary': '#131313',
    'semanticColors.background.secondary': '#1A1A1A',
    'semanticColors.background.elevated': '#202020',
    'semanticColors.text.primary': '#FFFFFF',
    'semanticColors.text.secondary': '#A6A6A6',
    'semanticColors.text.muted': '#797979',
    'semanticColors.text.disabled': '#797979',
    'semanticColors.text.onAccent': '#131313',
    'semanticColors.text.accent': '#FF9A6D',
    'semanticColors.accent.primary': '#FF9A6D',
    'semanticColors.accent.light': '#FFAE8A',
    'semanticColors.accent.dark': '#CC7B57',
    'semanticColors.border.default': '#4D4D4D',
    'semanticColors.border.active': '#FF9A6D',
    'semanticColors.border.error': '#FF8080',
    'semanticColors.state.disabled': '#202020',
    'semanticColors.state.error': '#FF8080',
    'semanticColors.state.success': '#70BF73',
    'semanticColors.state.warning': '#FFD580',
  };

  const reverseSemantic: Record<string, string[]> = {};
  for (const [token, hex] of Object.entries(semanticColorsMap)) {
    const upper = hex.toUpperCase();
    if (!reverseSemantic[upper]) reverseSemantic[upper] = [];
    reverseSemantic[upper].push(token);
  }

  // --- Typography ---
  const typographyMap: Record<string, { fontSize: number; lineHeight: number; fontFamily: string; fontWeight: string; letterSpacing: number }> = {
    h1: { fontSize: 48, lineHeight: 64, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: -2.0 },
    h2: { fontSize: 40, lineHeight: 52, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: -1.5 },
    h3: { fontSize: 32, lineHeight: 44, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: -1.0 },
    h4: { fontSize: 28, lineHeight: 40, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: -1.0 },
    h5: { fontSize: 20, lineHeight: 32, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: -0.5 },
    h6: { fontSize: 20, lineHeight: 28, fontFamily: 'PlusJakartaSans-SemiBold', fontWeight: '600', letterSpacing: 0 },
    bodyLg: { fontSize: 20, lineHeight: 32, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: 0 },
    bodyLgMedium: { fontSize: 20, lineHeight: 32, fontFamily: 'PlusJakartaSans-Medium', fontWeight: '500', letterSpacing: 0 },
    bodyLgSemibold: { fontSize: 20, lineHeight: 32, fontFamily: 'PlusJakartaSans-SemiBold', fontWeight: '600', letterSpacing: 0 },
    bodyMd: { fontSize: 16, lineHeight: 24, fontFamily: 'PlusJakartaSans-SemiBold', fontWeight: '600', letterSpacing: 0 },
    bodyMdRegular: { fontSize: 16, lineHeight: 24, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: 0 },
    bodyMdMedium: { fontSize: 16, lineHeight: 24, fontFamily: 'PlusJakartaSans-Medium', fontWeight: '500', letterSpacing: 0 },
    bodyMd2: { fontSize: 14, lineHeight: 20, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: 0 },
    bodyMd2Medium: { fontSize: 14, lineHeight: 20, fontFamily: 'PlusJakartaSans-Medium', fontWeight: '500', letterSpacing: 0 },
    bodySm: { fontSize: 12, lineHeight: 20, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: 0 },
    bodySmMedium: { fontSize: 12, lineHeight: 20, fontFamily: 'PlusJakartaSans-Medium', fontWeight: '500', letterSpacing: 0 },
    bodySmSemiBold: { fontSize: 12, lineHeight: 20, fontFamily: 'PlusJakartaSans-SemiBold', fontWeight: '600', letterSpacing: 0 },
    label: { fontSize: 14, lineHeight: 20, fontFamily: 'PlusJakartaSans-SemiBold', fontWeight: '600', letterSpacing: 0 },
    labelSm: { fontSize: 12, lineHeight: 16, fontFamily: 'PlusJakartaSans-SemiBold', fontWeight: '600', letterSpacing: 0 },
    caption: { fontSize: 12, lineHeight: 16, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: 0 },
    captionSm: { fontSize: 10, lineHeight: 16, fontFamily: 'PlusJakartaSans-Regular', fontWeight: '400', letterSpacing: 0 },
    overline: { fontSize: 10, lineHeight: 14, fontFamily: 'PlusJakartaSans-SemiBold', fontWeight: '600', letterSpacing: 1.5 },
    button: { fontSize: 16, lineHeight: 24, fontFamily: 'PlusJakartaSans-Medium', fontWeight: '500', letterSpacing: 0 },
    buttonSmall: { fontSize: 14, lineHeight: 20, fontFamily: 'PlusJakartaSans-Medium', fontWeight: '500', letterSpacing: 0 },
    otpInput: { fontSize: 20, lineHeight: 32, fontFamily: 'PlusJakartaSans-Medium', fontWeight: '500', letterSpacing: 0 },
    amountLarge: { fontSize: 32, lineHeight: 40, fontFamily: 'PlusJakartaSans-Bold', fontWeight: '700', letterSpacing: -1.0 },
    amountMedium: { fontSize: 24, lineHeight: 32, fontFamily: 'PlusJakartaSans-SemiBold', fontWeight: '600', letterSpacing: -0.5 },
  };

  // --- Spacing ---
  const spacingMap: Record<string, number> = {
    'spacing.zero': 0,
    'spacing.xxxs': 2,
    'spacing.xxs': 4,
    'spacing.xs': 8,
    'spacing.sm': 12,
    'spacing.md': 16,
    'spacing.lg': 24,
    'spacing.xl': 32,
    'spacing.xxl': 40,
    'spacing.xxxl': 48,
    'spacing.huge': 64,
  };

  const reverseSpacing: Record<number, string[]> = {};
  for (const [token, val] of Object.entries(spacingMap)) {
    if (!reverseSpacing[val]) reverseSpacing[val] = [];
    reverseSpacing[val].push(token);
  }

  // --- Radius ---
  const radiusMap: Record<string, number> = {
    'radius.none': 0,
    'radius.xs': 4,
    'radius.sm': 8,
    'radius.md': 12,
    'radius.lg': 16,
    'radius.xl': 24,
    'radius.xxl': 40,
    'radius.pill': 200,
    'radius.full': 9999,
  };

  const reverseRadius: Record<number, string[]> = {};
  for (const [token, val] of Object.entries(radiusMap)) {
    if (!reverseRadius[val]) reverseRadius[val] = [];
    reverseRadius[val].push(token);
  }

  // --- Shadows ---
  const shadowsMap: Record<string, { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number }> = {
    none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
    toast: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
    elevated: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
    pressed: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    modal: { shadowColor: '#000000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 16 },
    soft: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
    card: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  };

  // --- Font weight → family mapping ---
  const fontWeightToFamily: Record<string, string> = {
    '400': 'PlusJakartaSans-Regular',
    '500': 'PlusJakartaSans-Medium',
    '600': 'PlusJakartaSans-SemiBold',
    '700': 'PlusJakartaSans-Bold',
  };

  // --- Gradients ---
  const gradientsMap: Record<string, { colors: string[]; locations: number[]; start: { x: number; y: number }; end: { x: number; y: number } }> = {
    button: { colors: ['#202020', '#0D0D0D'], locations: [0, 0.9018], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    buttonDisabled: { colors: ['#202020', '#202020'], locations: [0, 1], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    buttonActive: { colors: ['#FF9A6D', '#CC7B57'], locations: [0, 1], start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
  };

  return {
    colors: colorsMap,
    reverseColors,
    semanticColors: semanticColorsMap,
    reverseSemantic,
    typography: typographyMap,
    spacing: spacingMap,
    reverseSpacing,
    radius: radiusMap,
    reverseRadius,
    shadows: shadowsMap,
    fontWeightToFamily,
    gradients: gradientsMap,
  };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Normalize hex to uppercase 6-char without alpha. */
function normalizeHex(hex: string): string {
  if (!hex || typeof hex !== 'string') return '';
  let h = hex.trim().toUpperCase();
  // Remove alpha suffix if 8-char hex (#RRGGBBAA → #RRGGBB)
  if (h.length === 9 && h.startsWith('#')) {
    h = h.slice(0, 7);
  }
  // Expand 3-char to 6-char (#RGB → #RRGGBB)
  if (h.length === 4 && h.startsWith('#')) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h;
}

/** Extract alpha from 8-char hex, returns 0-1. */
function extractAlpha(hex: string): number {
  if (!hex || hex.length !== 9) return 1;
  const alphaHex = hex.slice(7, 9);
  return parseInt(alphaHex, 16) / 255;
}

/** Check numeric equality within tolerance. */
function withinTolerance(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Map Figma fontWeight number to RN fontFamily name. */
function figmaWeightToRNFamily(weight: number): string {
  if (weight <= 400) return 'PlusJakartaSans-Regular';
  if (weight <= 500) return 'PlusJakartaSans-Medium';
  if (weight <= 600) return 'PlusJakartaSans-SemiBold';
  return 'PlusJakartaSans-Bold';
}

/** Map Figma layout direction to RN flexDirection. */
function figmaDirectionToFlex(dir: string): string {
  if (dir === 'HORIZONTAL' || dir === 'row') return 'row';
  if (dir === 'VERTICAL' || dir === 'column') return 'column';
  return 'column'; // default
}

/** Unwrap s()/sv()/sf() scaling wrappers to extract raw value. */
function unwrapScale(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Match patterns like s(16), sv(24), sf(14)
    const m = value.match(/^(?:s|sv|sf)\((\d+(?:\.\d+)?)\)$/);
    if (m) return parseFloat(m[1]);
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
  }
  return null;
}

/** Convert Figma node ID (colon-separated) to file-safe dash-separated. */
function nodeIdToFileId(nodeId: string): string {
  return nodeId.replace(/:/g, '-');
}

/** Create a fresh PassResult. */
function emptyPassResult(): PassResult {
  return { status: 'pass', matchCount: 0, closeCount: 0, approximationCount: 0, mismatchCount: 0, skipCount: 0, issues: [] };
}

/** Record a check result into a PassResult. */
function recordCheck(
  result: PassResult,
  matchType: MatchType,
  issue?: Omit<AuditIssue, 'matchType'>,
): void {
  switch (matchType) {
    case 'match': result.matchCount++; break;
    case 'close': result.closeCount++; break;
    case 'approximation': result.approximationCount++; break;
    case 'mismatch': result.mismatchCount++; break;
    case 'skip': result.skipCount++; break;
  }
  if (issue && matchType !== 'match') {
    result.issues.push({ ...issue, matchType });
  }
}

/** Determine pass status from counts. */
function resolvePassStatus(result: PassResult): PassStatus {
  if (result.mismatchCount > 0 || result.issues.some(i => i.severity === 'critical' || i.severity === 'error')) return 'fail';
  if (result.closeCount > 0 || result.approximationCount > 0 || result.issues.some(i => i.severity === 'warning')) return 'warn';
  return 'pass';
}

// ---------------------------------------------------------------------------
// RN-specific whitelists (intentional differences, NOT gaps)
// ---------------------------------------------------------------------------

const WHITELIST_PATTERNS = {
  keyboardAvoidancePadding: (prop: string, appVal: unknown) =>
    prop === 'paddingBottom' && typeof appVal === 'number' && appVal > 100,
  bottomFooter: (nodeName: string) =>
    /BottomFooter|bottomFooter/i.test(nodeName),
  transparentModal: (nodeName: string) =>
    /transparentModal|BottomSheet|BlurView/i.test(nodeName),
  animationDefault: (prop: string) =>
    /opacity|transform|translateY|scale/i.test(prop),
};

function isWhitelisted(nodeName: string, property: string, appValue: unknown): boolean {
  if (WHITELIST_PATTERNS.keyboardAvoidancePadding(property, appValue)) return true;
  if (WHITELIST_PATTERNS.bottomFooter(nodeName)) return true;
  if (WHITELIST_PATTERNS.transparentModal(nodeName)) return true;
  if (WHITELIST_PATTERNS.animationDefault(property)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Pass Implementations
// ---------------------------------------------------------------------------

function runPass1LayoutClassification(
  figmaNodes: BlueprintNode[],
  implNodes: ImplNode[],
  _tokens: TokenMap,
): PassResult {
  const result = emptyPassResult();
  const implMap = buildImplNodeMap(implNodes);

  for (const fNode of figmaNodes) {
    if (!fNode.layout || fNode.type === 'TEXT' || fNode.type === 'VECTOR') continue;

    const iNode = implMap.get(fNode.id) ?? implMap.get(fNode.name);
    if (!iNode) {
      recordCheck(result, 'skip', {
        severity: 'info',
        pass: 'layout-classification',
        property: 'layoutMatch',
        figmaValue: fNode.layout.direction || 'none',
        appValue: 'N/A (no matching impl node)',
        nodeId: fNode.id,
        nodeName: fNode.name,
      });
      continue;
    }

    const computed = iNode._computed;
    if (!computed) {
      recordCheck(result, 'skip');
      continue;
    }

    // Check flex direction
    const figmaDir = figmaDirectionToFlex(fNode.layout.direction);
    const appDir = computed.flexDirection ?? 'column';
    if (figmaDir === appDir) {
      recordCheck(result, 'match');
    } else {
      recordCheck(result, 'mismatch', {
        severity: 'error',
        pass: 'layout-classification',
        property: 'flexDirection',
        figmaValue: figmaDir,
        appValue: String(appDir),
        nodeId: fNode.id,
        nodeName: fNode.name,
        suggestion: `Change flexDirection from '${appDir}' to '${figmaDir}'`,
      });
    }

    // Check justifyContent
    if (fNode.layout.justifyContent && computed.justifyContent) {
      const figmaJustify = fNode.layout.justifyContent;
      const appJustify = computed.justifyContent;
      if (figmaJustify === appJustify) {
        recordCheck(result, 'match');
      } else {
        recordCheck(result, 'mismatch', {
          severity: 'warning',
          pass: 'layout-classification',
          property: 'justifyContent',
          figmaValue: figmaJustify,
          appValue: String(appJustify),
          nodeId: fNode.id,
          nodeName: fNode.name,
        });
      }
    }

    // Check alignItems
    if (fNode.layout.alignItems && computed.alignItems) {
      const figmaAlign = fNode.layout.alignItems;
      const appAlign = computed.alignItems;
      if (figmaAlign === appAlign) {
        recordCheck(result, 'match');
      } else {
        recordCheck(result, 'mismatch', {
          severity: 'warning',
          pass: 'layout-classification',
          property: 'alignItems',
          figmaValue: figmaAlign,
          appValue: String(appAlign),
          nodeId: fNode.id,
          nodeName: fNode.name,
        });
      }
    }

    // Check absolute positioning
    if (fNode.layoutPositioning === 'ABSOLUTE') {
      const appPos = computed.position;
      if (appPos === 'absolute') {
        recordCheck(result, 'match');
      } else {
        recordCheck(result, 'mismatch', {
          severity: 'error',
          pass: 'layout-classification',
          property: 'position',
          figmaValue: 'absolute',
          appValue: String(appPos ?? 'relative'),
          nodeId: fNode.id,
          nodeName: fNode.name,
          suggestion: "Add position: 'absolute'",
        });
      }
    }
  }

  result.status = resolvePassStatus(result);
  return result;
}

function runPass2Typography(
  figmaNodes: BlueprintNode[],
  implNodes: ImplNode[],
  tokens: TokenMap,
): PassResult {
  const result = emptyPassResult();
  const implMap = buildImplNodeMap(implNodes);

  const textNodes = figmaNodes.filter(n => n.type === 'TEXT' && n.typography);

  for (const fNode of textNodes) {
    const typo = fNode.typography!;
    const iNode = implMap.get(fNode.id) ?? implMap.get(fNode.name);
    if (!iNode || !iNode._computed) {
      recordCheck(result, 'skip', {
        severity: 'info',
        pass: 'typography',
        property: 'textNode',
        figmaValue: typo.content,
        appValue: 'N/A (no impl node)',
        nodeId: fNode.id,
        nodeName: fNode.name,
      });
      continue;
    }

    const computed = iNode._computed;

    // fontSize — exact match
    if (computed.fontSize !== undefined) {
      const appFontSize = unwrapScale(computed.fontSize) ?? computed.fontSize;
      if (typeof appFontSize === 'number') {
        if (appFontSize === typo.fontSize) {
          recordCheck(result, 'match');
        } else if (withinTolerance(appFontSize, typo.fontSize, 1)) {
          recordCheck(result, 'close', {
            severity: 'warning',
            pass: 'typography',
            property: 'fontSize',
            figmaValue: String(typo.fontSize),
            appValue: String(appFontSize),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        } else {
          recordCheck(result, 'mismatch', {
            severity: 'error',
            pass: 'typography',
            property: 'fontSize',
            figmaValue: String(typo.fontSize),
            appValue: String(appFontSize),
            nodeId: fNode.id,
            nodeName: fNode.name,
            suggestion: `Change fontSize to ${typo.fontSize}`,
          });
        }
      }
    }

    // fontFamily / fontWeight mapping
    if (computed.fontFamily) {
      const expectedFamily = figmaWeightToRNFamily(typo.fontWeight);
      const appFamily = String(computed.fontFamily);
      if (appFamily === expectedFamily || appFamily === typo.fontFamily) {
        recordCheck(result, 'match');
      } else {
        recordCheck(result, 'mismatch', {
          severity: 'error',
          pass: 'typography',
          property: 'fontFamily',
          figmaValue: `${typo.fontFamily} (weight ${typo.fontWeight})`,
          appValue: appFamily,
          nodeId: fNode.id,
          nodeName: fNode.name,
          suggestion: `Use '${expectedFamily}' (Figma weight ${typo.fontWeight})`,
        });
      }
    }

    // Text color — exact hex
    if (computed.color) {
      const figmaColor = normalizeHex(typo.color);
      const appColor = normalizeHex(String(computed.color));
      if (figmaColor === appColor) {
        recordCheck(result, 'match');
      } else {
        recordCheck(result, 'mismatch', {
          severity: 'error',
          pass: 'typography',
          property: 'color',
          figmaValue: figmaColor,
          appValue: appColor,
          nodeId: fNode.id,
          nodeName: fNode.name,
          suggestion: `Change text color to ${figmaColor}`,
        });
      }
    }

    // lineHeight — 2px tolerance
    if (computed.lineHeight !== undefined) {
      const appLineHeight = unwrapScale(computed.lineHeight) ?? computed.lineHeight;
      if (typeof appLineHeight === 'number') {
        if (appLineHeight === typo.lineHeight) {
          recordCheck(result, 'match');
        } else if (withinTolerance(appLineHeight, typo.lineHeight, 2)) {
          recordCheck(result, 'close', {
            severity: 'warning',
            pass: 'typography',
            property: 'lineHeight',
            figmaValue: String(typo.lineHeight),
            appValue: String(appLineHeight),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        } else {
          recordCheck(result, 'mismatch', {
            severity: 'error',
            pass: 'typography',
            property: 'lineHeight',
            figmaValue: String(typo.lineHeight),
            appValue: String(appLineHeight),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        }
      }
    }

    // letterSpacing — 0.5px tolerance
    if (computed.letterSpacing !== undefined) {
      const appLS = unwrapScale(computed.letterSpacing) ?? computed.letterSpacing;
      if (typeof appLS === 'number') {
        if (appLS === typo.letterSpacing) {
          recordCheck(result, 'match');
        } else if (withinTolerance(appLS, typo.letterSpacing, 0.5)) {
          recordCheck(result, 'close', {
            severity: 'info',
            pass: 'typography',
            property: 'letterSpacing',
            figmaValue: String(typo.letterSpacing),
            appValue: String(appLS),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        } else {
          recordCheck(result, 'mismatch', {
            severity: 'warning',
            pass: 'typography',
            property: 'letterSpacing',
            figmaValue: String(typo.letterSpacing),
            appValue: String(appLS),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        }
      }
    }

    // textAlign
    if (computed.textAlign && typo.textAlign) {
      const figmaAlign = typo.textAlign.toLowerCase().replace('justified', 'justify');
      const appAlign = String(computed.textAlign).toLowerCase();
      if (figmaAlign === appAlign || figmaAlign === 'center' && appAlign === 'center') {
        recordCheck(result, 'match');
      } else {
        recordCheck(result, 'mismatch', {
          severity: 'warning',
          pass: 'typography',
          property: 'textAlign',
          figmaValue: figmaAlign,
          appValue: appAlign,
          nodeId: fNode.id,
          nodeName: fNode.name,
        });
      }
    }
  }

  result.status = resolvePassStatus(result);
  return result;
}

function runPass3Colors(
  figmaNodes: BlueprintNode[],
  implNodes: ImplNode[],
  tokens: TokenMap,
): PassResult {
  const result = emptyPassResult();
  const implMap = buildImplNodeMap(implNodes);

  for (const fNode of figmaNodes) {
    const iNode = implMap.get(fNode.id) ?? implMap.get(fNode.name);
    if (!iNode || !iNode._computed) continue;

    const computed = iNode._computed;

    // Fill/background color check
    const solidFills = (fNode.fills || []).filter(f => f.type === 'SOLID' && f.visible !== false);
    for (const fill of solidFills) {
      if (!fill.color) continue;
      const figmaHex = normalizeHex(fill.color);

      // For text nodes, compare against text color; for frames, compare background
      let appHex: string | undefined;
      if (fNode.type === 'TEXT') {
        appHex = computed.color ? normalizeHex(String(computed.color)) : undefined;
      } else {
        appHex = computed.backgroundColor ? normalizeHex(String(computed.backgroundColor)) : undefined;
      }

      if (!appHex) {
        recordCheck(result, 'skip');
        continue;
      }

      if (figmaHex === appHex) {
        // Exact match — but check if the app uses semantic token vs raw hex
        const semanticPaths = tokens.reverseSemantic[figmaHex];
        if (semanticPaths && semanticPaths.length > 0) {
          // This is a "match" color-wise but might be an info-level token concern
          recordCheck(result, 'match');
        } else {
          recordCheck(result, 'match');
        }
      } else {
        recordCheck(result, 'mismatch', {
          severity: 'error',
          pass: 'colors',
          property: fNode.type === 'TEXT' ? 'textColor' : 'backgroundColor',
          figmaValue: figmaHex,
          appValue: appHex,
          nodeId: fNode.id,
          nodeName: fNode.name,
          suggestion: buildColorSuggestion(figmaHex, tokens),
        });
      }
    }

    // Stroke color check
    for (const stroke of fNode.strokes || []) {
      if (!stroke.visible || !stroke.color) continue;
      const figmaStrokeHex = normalizeHex(stroke.color);
      const appBorderColor = computed.borderColor ? normalizeHex(String(computed.borderColor)) : undefined;

      if (!appBorderColor) {
        recordCheck(result, 'skip');
        continue;
      }

      if (figmaStrokeHex === appBorderColor) {
        recordCheck(result, 'match');
      } else {
        recordCheck(result, 'mismatch', {
          severity: 'error',
          pass: 'colors',
          property: 'borderColor',
          figmaValue: figmaStrokeHex,
          appValue: appBorderColor,
          nodeId: fNode.id,
          nodeName: fNode.name,
          suggestion: buildColorSuggestion(figmaStrokeHex, tokens),
        });
      }
    }
  }

  result.status = resolvePassStatus(result);
  return result;
}

function buildColorSuggestion(hex: string, tokens: TokenMap): string {
  const semantic = tokens.reverseSemantic[hex];
  if (semantic && semantic.length > 0) return `Use ${semantic[0]}`;
  const raw = tokens.reverseColors[hex];
  if (raw && raw.length > 0) return `Use ${raw[0]}`;
  return `Set color to ${hex}`;
}

function runPass4Spacing(
  figmaNodes: BlueprintNode[],
  implNodes: ImplNode[],
  tokens: TokenMap,
): PassResult {
  const result = emptyPassResult();
  const implMap = buildImplNodeMap(implNodes);
  const TOLERANCE = 2;

  for (const fNode of figmaNodes) {
    if (!fNode.layout || fNode.type === 'TEXT') continue;

    const iNode = implMap.get(fNode.id) ?? implMap.get(fNode.name);
    if (!iNode || !iNode._computed) continue;

    const computed = iNode._computed;

    // Padding
    if (fNode.layout.padding) {
      const figmaPad = fNode.layout.padding;
      const appPad = computed.padding;

      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const figmaVal = figmaPad[side];
        if (figmaVal === 0 && !appPad) continue; // Both zero, skip

        const appVal = appPad ? unwrapScale(appPad[side]) ?? appPad[side] : 0;
        if (typeof appVal !== 'number') continue;

        // Whitelist keyboard avoidance padding
        if (isWhitelisted(fNode.name, `padding${side.charAt(0).toUpperCase() + side.slice(1)}`, appVal)) {
          recordCheck(result, 'skip');
          continue;
        }

        if (figmaVal === appVal) {
          recordCheck(result, 'match');
        } else if (withinTolerance(figmaVal, appVal, TOLERANCE)) {
          recordCheck(result, 'close', {
            severity: 'warning',
            pass: 'spacing',
            property: `padding.${side}`,
            figmaValue: String(figmaVal),
            appValue: String(appVal),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        } else {
          recordCheck(result, 'mismatch', {
            severity: 'error',
            pass: 'spacing',
            property: `padding.${side}`,
            figmaValue: String(figmaVal),
            appValue: String(appVal),
            nodeId: fNode.id,
            nodeName: fNode.name,
            suggestion: buildSpacingSuggestion(figmaVal, tokens),
          });
        }
      }
    }

    // Gap
    if (fNode.layout.gap !== undefined && fNode.layout.gap > 0) {
      const figmaGap = fNode.layout.gap;
      const appGap = unwrapScale(computed.gap) ?? computed.gap;

      if (typeof appGap === 'number') {
        if (figmaGap === appGap) {
          recordCheck(result, 'match');
        } else if (withinTolerance(figmaGap, appGap, TOLERANCE)) {
          recordCheck(result, 'close', {
            severity: 'warning',
            pass: 'spacing',
            property: 'gap',
            figmaValue: String(figmaGap),
            appValue: String(appGap),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        } else {
          recordCheck(result, 'mismatch', {
            severity: 'error',
            pass: 'spacing',
            property: 'gap',
            figmaValue: String(figmaGap),
            appValue: String(appGap),
            nodeId: fNode.id,
            nodeName: fNode.name,
            suggestion: buildSpacingSuggestion(figmaGap, tokens),
          });
        }
      } else {
        recordCheck(result, 'skip');
      }
    }
  }

  result.status = resolvePassStatus(result);
  return result;
}

function buildSpacingSuggestion(value: number, tokens: TokenMap): string {
  const tokenNames = tokens.reverseSpacing[value];
  if (tokenNames && tokenNames.length > 0) return `Use ${tokenNames[0]} (${value})`;
  // Find closest
  let closest = '';
  let minDiff = Infinity;
  for (const [name, val] of Object.entries(tokens.spacing)) {
    const diff = Math.abs(val - value);
    if (diff < minDiff) { minDiff = diff; closest = name; }
  }
  return closest ? `Closest token: ${closest} (${tokens.spacing[closest]})` : `Set to ${value}`;
}

function runPass5LayoutStructure(
  figmaNodes: BlueprintNode[],
  implNodes: ImplNode[],
  _tokens: TokenMap,
): PassResult {
  const result = emptyPassResult();
  const implMap = buildImplNodeMap(implNodes);

  for (const fNode of figmaNodes) {
    if (!fNode.layout || fNode.type === 'TEXT' || fNode.type === 'VECTOR') continue;

    const iNode = implMap.get(fNode.id) ?? implMap.get(fNode.name);
    if (!iNode || !iNode._computed) continue;

    const computed = iNode._computed;

    // flexDirection (already checked in Pass 1, but repeat for structure context)
    // Width and height
    if (fNode.geometry.width > 0 && computed.width !== undefined) {
      const appWidth = unwrapScale(computed.width);
      if (appWidth !== null && typeof fNode.geometry.width === 'number') {
        // For FILL sizing, width should be flex: 1 or percentage
        if (fNode.layout.sizingH === 'FILL' || fNode.layoutSizingHorizontal === 'FILL') {
          // Expected: flex or percentage-based
          if (computed.flex || String(computed.width).includes('%')) {
            recordCheck(result, 'match');
          } else {
            recordCheck(result, 'close', {
              severity: 'info',
              pass: 'layout-structure',
              property: 'width (FILL)',
              figmaValue: 'FILL → flex: 1 or 100%',
              appValue: String(computed.width),
              nodeId: fNode.id,
              nodeName: fNode.name,
            });
          }
        } else if (fNode.layout.sizingH === 'FIXED') {
          if (withinTolerance(appWidth, fNode.geometry.width, 2)) {
            recordCheck(result, 'match');
          } else {
            recordCheck(result, 'mismatch', {
              severity: 'warning',
              pass: 'layout-structure',
              property: 'width',
              figmaValue: String(fNode.geometry.width),
              appValue: String(appWidth),
              nodeId: fNode.id,
              nodeName: fNode.name,
            });
          }
        }
      }
    }

    // Height
    if (fNode.geometry.height > 0 && computed.height !== undefined) {
      const appHeight = unwrapScale(computed.height);
      if (appHeight !== null && typeof fNode.geometry.height === 'number') {
        if (fNode.layout.sizingV === 'HUG' || fNode.layoutSizingVertical === 'HUG') {
          // HUG means no explicit height, skip
          recordCheck(result, 'skip');
        } else if (fNode.layout.sizingV === 'FIXED') {
          if (withinTolerance(appHeight, fNode.geometry.height, 2)) {
            recordCheck(result, 'match');
          } else {
            recordCheck(result, 'mismatch', {
              severity: 'warning',
              pass: 'layout-structure',
              property: 'height',
              figmaValue: String(fNode.geometry.height),
              appValue: String(appHeight),
              nodeId: fNode.id,
              nodeName: fNode.name,
            });
          }
        }
      }
    }

    // flex value
    if (computed.flex !== undefined) {
      const fSizing = fNode.layout.sizingH ?? fNode.layoutSizingHorizontal;
      if (fSizing === 'FILL' && computed.flex === 1) {
        recordCheck(result, 'match');
      }
    }

    // wrap
    if (fNode.layout.wrap && computed.flexDirection) {
      // Figma NO_WRAP → default in RN (nowrap). WRAP → flexWrap: 'wrap'
      // We skip this check since wrap is rarely used in this app
      recordCheck(result, 'skip');
    }
  }

  result.status = resolvePassStatus(result);
  return result;
}

function runPass6BordersRadius(
  figmaNodes: BlueprintNode[],
  implNodes: ImplNode[],
  tokens: TokenMap,
): PassResult {
  const result = emptyPassResult();
  const implMap = buildImplNodeMap(implNodes);

  for (const fNode of figmaNodes) {
    if (fNode.type === 'TEXT' || fNode.type === 'VECTOR') continue;

    const iNode = implMap.get(fNode.id) ?? implMap.get(fNode.name);
    if (!iNode || !iNode._computed) continue;

    const computed = iNode._computed;

    // Border radius
    const figmaRadius = typeof fNode.borderRadius === 'number'
      ? fNode.borderRadius
      : fNode.borderRadius
        ? Math.max(
            (fNode.borderRadius as any).topLeft ?? 0,
            (fNode.borderRadius as any).topRight ?? 0,
            (fNode.borderRadius as any).bottomRight ?? 0,
            (fNode.borderRadius as any).bottomLeft ?? 0,
          )
        : 0;

    if (figmaRadius > 0 && computed.borderRadius !== undefined) {
      const appRadius = typeof computed.borderRadius === 'number'
        ? computed.borderRadius
        : typeof computed.borderRadius === 'object'
          ? Math.max(
              (computed.borderRadius as any).topLeft ?? 0,
              (computed.borderRadius as any).topRight ?? 0,
              (computed.borderRadius as any).bottomRight ?? 0,
              (computed.borderRadius as any).bottomLeft ?? 0,
            )
          : 0;

      if (figmaRadius === appRadius) {
        recordCheck(result, 'match');
      } else if (withinTolerance(figmaRadius, appRadius, 2)) {
        recordCheck(result, 'close', {
          severity: 'warning',
          pass: 'borders-radius',
          property: 'borderRadius',
          figmaValue: String(figmaRadius),
          appValue: String(appRadius),
          nodeId: fNode.id,
          nodeName: fNode.name,
        });
      } else {
        recordCheck(result, 'mismatch', {
          severity: 'error',
          pass: 'borders-radius',
          property: 'borderRadius',
          figmaValue: String(figmaRadius),
          appValue: String(appRadius),
          nodeId: fNode.id,
          nodeName: fNode.name,
          suggestion: buildRadiusSuggestion(figmaRadius, tokens),
        });
      }
    }

    // cornerSmoothing → borderCurve: 'continuous' (iOS only)
    if (fNode.cornerSmoothing && fNode.cornerSmoothing > 0) {
      // This is an info-level concern; no RN prop to directly compare
      recordCheck(result, 'approximation', {
        severity: 'info',
        pass: 'borders-radius',
        property: 'cornerSmoothing',
        figmaValue: String(fNode.cornerSmoothing),
        appValue: "borderCurve: 'continuous' (check manually)",
        nodeId: fNode.id,
        nodeName: fNode.name,
        suggestion: "Add borderCurve: 'continuous' on iOS",
      });
    }

    // Border width
    for (const stroke of fNode.strokes || []) {
      if (!stroke.visible) continue;

      if (computed.borderWidth !== undefined) {
        const appBorderWidth = unwrapScale(computed.borderWidth) ?? computed.borderWidth;
        if (typeof appBorderWidth === 'number') {
          if (withinTolerance(stroke.weight, appBorderWidth, 0.5)) {
            recordCheck(result, 'match');
          } else {
            recordCheck(result, 'mismatch', {
              severity: 'warning',
              pass: 'borders-radius',
              property: 'borderWidth',
              figmaValue: String(stroke.weight),
              appValue: String(appBorderWidth),
              nodeId: fNode.id,
              nodeName: fNode.name,
            });
          }
        }
      }

      // Dashed border check
      if (stroke.dashPattern && stroke.dashPattern.length > 0) {
        const appBorderStyle = computed.borderStyle;
        if (appBorderStyle === 'dashed') {
          recordCheck(result, 'match');
        } else {
          recordCheck(result, 'mismatch', {
            severity: 'warning',
            pass: 'borders-radius',
            property: 'borderStyle',
            figmaValue: 'dashed',
            appValue: String(appBorderStyle ?? 'solid'),
            nodeId: fNode.id,
            nodeName: fNode.name,
            suggestion: "Add borderStyle: 'dashed'",
          });
        }
      }
    }
  }

  result.status = resolvePassStatus(result);
  return result;
}

function buildRadiusSuggestion(value: number, tokens: TokenMap): string {
  const tokenNames = tokens.reverseRadius[value];
  if (tokenNames && tokenNames.length > 0) return `Use ${tokenNames[0]} (${value})`;
  let closest = '';
  let minDiff = Infinity;
  for (const [name, val] of Object.entries(tokens.radius)) {
    const diff = Math.abs(val - value);
    if (diff < minDiff) { minDiff = diff; closest = name; }
  }
  return closest ? `Closest token: ${closest} (${tokens.radius[closest]})` : `Set borderRadius to ${value}`;
}

function runPass7ShadowsEffects(
  figmaNodes: BlueprintNode[],
  implNodes: ImplNode[],
  _tokens: TokenMap,
): PassResult {
  const result = emptyPassResult();
  const implMap = buildImplNodeMap(implNodes);

  for (const fNode of figmaNodes) {
    if (!fNode.effects || fNode.effects.length === 0) continue;

    const iNode = implMap.get(fNode.id) ?? implMap.get(fNode.name);
    if (!iNode || !iNode._computed) {
      // Node has effects in Figma but no impl node found
      const visibleEffects = fNode.effects.filter(e => e.visible);
      if (visibleEffects.length > 0) {
        recordCheck(result, 'skip', {
          severity: 'info',
          pass: 'shadows-effects',
          property: 'shadow',
          figmaValue: `${visibleEffects.length} effects`,
          appValue: 'N/A (no impl node)',
          nodeId: fNode.id,
          nodeName: fNode.name,
        });
      }
      continue;
    }

    const computed = iNode._computed;

    for (const effect of fNode.effects) {
      if (!effect.visible) continue;

      if (effect.type === 'DROP_SHADOW') {
        // Compare shadow offset, blur, color
        if (computed.shadowOffset && computed.shadowColor) {
          const appOffsetY = computed.shadowOffset.height;
          const figmaOffsetY = effect.offset?.y ?? 0;
          const appBlur = computed.shadowRadius ?? 0;
          const figmaBlur = effect.blur ?? 0;

          // RN shadowRadius is roughly blur/2 in Figma terms
          const expectedRNRadius = figmaBlur / 2;

          if (withinTolerance(appOffsetY, figmaOffsetY, 2) && withinTolerance(appBlur, expectedRNRadius, 2)) {
            recordCheck(result, 'close', {
              severity: 'info',
              pass: 'shadows-effects',
              property: 'dropShadow',
              figmaValue: `offset(${effect.offset?.x ?? 0},${figmaOffsetY}) blur(${figmaBlur})`,
              appValue: `offset(${computed.shadowOffset.width},${appOffsetY}) radius(${appBlur})`,
              nodeId: fNode.id,
              nodeName: fNode.name,
            });
          } else {
            recordCheck(result, 'mismatch', {
              severity: 'warning',
              pass: 'shadows-effects',
              property: 'dropShadow',
              figmaValue: `offset(${effect.offset?.x ?? 0},${figmaOffsetY}) blur(${figmaBlur})`,
              appValue: `offset(${computed.shadowOffset.width},${appOffsetY}) radius(${appBlur})`,
              nodeId: fNode.id,
              nodeName: fNode.name,
              suggestion: `shadowOffset: {width: ${effect.offset?.x ?? 0}, height: ${figmaOffsetY}}, shadowRadius: ${expectedRNRadius}`,
            });
          }
        } else {
          recordCheck(result, 'mismatch', {
            severity: 'warning',
            pass: 'shadows-effects',
            property: 'dropShadow',
            figmaValue: `offset(${effect.offset?.x ?? 0},${effect.offset?.y ?? 0}) blur(${effect.blur ?? 0})`,
            appValue: 'missing',
            nodeId: fNode.id,
            nodeName: fNode.name,
            suggestion: 'Add shadow properties',
          });
        }
      } else if (effect.type === 'INNER_SHADOW') {
        // No RN equivalent — always an approximation
        recordCheck(result, 'approximation', {
          severity: 'info',
          pass: 'shadows-effects',
          property: 'innerShadow',
          figmaValue: `INNER_SHADOW offset(${effect.offset?.x ?? 0},${effect.offset?.y ?? 0}) blur(${effect.blur ?? 0})`,
          appValue: 'N/A (no RN equivalent)',
          nodeId: fNode.id,
          nodeName: fNode.name,
          suggestion: 'Inner shadows have no direct RN equivalent; consider a gradient or overlay',
        });
      }
    }

    // Opacity
    if (fNode.opacity !== undefined && fNode.opacity < 1) {
      const appOpacity = computed.opacity;
      if (appOpacity !== undefined) {
        if (withinTolerance(fNode.opacity, appOpacity, 0.05)) {
          recordCheck(result, 'match');
        } else {
          recordCheck(result, 'mismatch', {
            severity: 'warning',
            pass: 'shadows-effects',
            property: 'opacity',
            figmaValue: String(fNode.opacity),
            appValue: String(appOpacity),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        }
      }
    }
  }

  result.status = resolvePassStatus(result);
  return result;
}

function runPass8Gradients(
  figmaNodes: BlueprintNode[],
  implNodes: ImplNode[],
  tokens: TokenMap,
): PassResult {
  const result = emptyPassResult();
  const implMap = buildImplNodeMap(implNodes);

  for (const fNode of figmaNodes) {
    const gradientFills = (fNode.fills || []).filter(f => f.type === 'GRADIENT_LINEAR' && f.visible !== false);
    if (gradientFills.length === 0) continue;

    const iNode = implMap.get(fNode.id) ?? implMap.get(fNode.name);
    if (!iNode || !iNode._computed) {
      recordCheck(result, 'skip', {
        severity: 'info',
        pass: 'gradients',
        property: 'linearGradient',
        figmaValue: `${gradientFills.length} gradient(s)`,
        appValue: 'N/A (no impl node)',
        nodeId: fNode.id,
        nodeName: fNode.name,
      });
      continue;
    }

    const computed = iNode._computed;

    for (const fill of gradientFills) {
      if (!fill.gradientStops || !computed.gradientColors) {
        recordCheck(result, 'skip');
        continue;
      }

      // Compare gradient stop colors
      const figmaColors = fill.gradientStops.map(s => normalizeHex(s.color));
      const appColors = computed.gradientColors.map(c => normalizeHex(c));

      let allColorsMatch = figmaColors.length === appColors.length;
      if (allColorsMatch) {
        for (let i = 0; i < figmaColors.length; i++) {
          if (figmaColors[i] !== appColors[i]) { allColorsMatch = false; break; }
        }
      }

      if (allColorsMatch) {
        recordCheck(result, 'match');
      } else {
        recordCheck(result, 'mismatch', {
          severity: 'error',
          pass: 'gradients',
          property: 'gradientColors',
          figmaValue: figmaColors.join(' → '),
          appValue: appColors.join(' → '),
          nodeId: fNode.id,
          nodeName: fNode.name,
        });
      }

      // Compare gradient stop positions
      if (fill.gradientStops && computed.gradientLocations) {
        const figmaPositions = fill.gradientStops.map(s => s.position);
        const appPositions = computed.gradientLocations;
        let positionsClose = figmaPositions.length === appPositions.length;
        if (positionsClose) {
          for (let i = 0; i < figmaPositions.length; i++) {
            if (!withinTolerance(figmaPositions[i], appPositions[i], 0.05)) {
              positionsClose = false;
              break;
            }
          }
        }

        if (positionsClose) {
          recordCheck(result, 'match');
        } else {
          recordCheck(result, 'mismatch', {
            severity: 'warning',
            pass: 'gradients',
            property: 'gradientLocations',
            figmaValue: figmaPositions.map(p => p.toFixed(3)).join(', '),
            appValue: appPositions.map(p => p.toFixed(3)).join(', '),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        }
      }

      // Compare gradient direction (start/end)
      if (fill.gradientHandlePositions && computed.gradientStart && computed.gradientEnd) {
        const handles = fill.gradientHandlePositions;
        // Figma handle[0] = start, handle[1] = end
        if (handles.length >= 2) {
          const figmaStart = { x: handles[0].x, y: handles[0].y };
          const figmaEnd = { x: handles[1].x, y: handles[1].y };
          const appStart = computed.gradientStart;
          const appEnd = computed.gradientEnd;

          const startMatch = withinTolerance(figmaStart.x, appStart.x, 0.1) && withinTolerance(figmaStart.y, appStart.y, 0.1);
          const endMatch = withinTolerance(figmaEnd.x, appEnd.x, 0.1) && withinTolerance(figmaEnd.y, appEnd.y, 0.1);

          if (startMatch && endMatch) {
            recordCheck(result, 'match');
          } else {
            recordCheck(result, 'close', {
              severity: 'info',
              pass: 'gradients',
              property: 'gradientDirection',
              figmaValue: `start(${figmaStart.x.toFixed(2)},${figmaStart.y.toFixed(2)}) end(${figmaEnd.x.toFixed(2)},${figmaEnd.y.toFixed(2)})`,
              appValue: `start(${appStart.x.toFixed(2)},${appStart.y.toFixed(2)}) end(${appEnd.x.toFixed(2)},${appEnd.y.toFixed(2)})`,
              nodeId: fNode.id,
              nodeName: fNode.name,
            });
          }
        }
      }
    }
  }

  result.status = resolvePassStatus(result);
  return result;
}

function runPass9ComponentsAssets(
  figmaNodes: BlueprintNode[],
  implNodes: ImplNode[],
  _tokens: TokenMap,
): PassResult {
  const result = emptyPassResult();
  const implMap = buildImplNodeMap(implNodes);

  // Check INSTANCE and component-typed nodes
  const componentNodes = figmaNodes.filter(n =>
    n.type === 'INSTANCE' || n.rnComponent === 'Button' || n.rnComponent === 'Input' || n.rnComponent === 'Image',
  );

  for (const fNode of componentNodes) {
    const iNode = implMap.get(fNode.id) ?? implMap.get(fNode.name);
    if (!iNode) {
      recordCheck(result, 'skip', {
        severity: 'info',
        pass: 'components-assets',
        property: 'component',
        figmaValue: `${fNode.rnComponent ?? fNode.type} "${fNode.name}"`,
        appValue: 'N/A (no matching impl node)',
        nodeId: fNode.id,
        nodeName: fNode.name,
      });
      continue;
    }

    // Verify component dimensions match (width, height)
    const computed = iNode._computed;
    if (computed && fNode.geometry) {
      const appWidth = unwrapScale(computed.width);
      const appHeight = unwrapScale(computed.height);

      if (appWidth !== null && fNode.geometry.width > 0) {
        if (withinTolerance(appWidth, fNode.geometry.width, 4)) {
          recordCheck(result, 'match');
        } else {
          recordCheck(result, 'close', {
            severity: 'warning',
            pass: 'components-assets',
            property: 'componentWidth',
            figmaValue: String(fNode.geometry.width),
            appValue: String(appWidth),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        }
      }

      if (appHeight !== null && fNode.geometry.height > 0) {
        if (withinTolerance(appHeight, fNode.geometry.height, 4)) {
          recordCheck(result, 'match');
        } else {
          recordCheck(result, 'close', {
            severity: 'warning',
            pass: 'components-assets',
            property: 'componentHeight',
            figmaValue: String(fNode.geometry.height),
            appValue: String(appHeight),
            nodeId: fNode.id,
            nodeName: fNode.name,
          });
        }
      }
    }

    // Check SVG/vector nodes
    if (fNode.type === 'VECTOR' || (fNode.name && /icon|svg|vector/i.test(fNode.name))) {
      // Just verify presence
      recordCheck(result, 'match');
    }
  }

  result.status = resolvePassStatus(result);
  return result;
}

// ---------------------------------------------------------------------------
// Node matching helpers
// ---------------------------------------------------------------------------

function buildImplNodeMap(implNodes: ImplNode[]): Map<string, ImplNode> {
  const map = new Map<string, ImplNode>();

  function traverse(node: ImplNode): void {
    if (node._nodeId) map.set(node._nodeId, node);
    if (node._nodeName) map.set(node._nodeName, node);
    if (node.children) {
      for (const child of node.children) traverse(child);
    }
  }

  for (const node of implNodes) traverse(node);
  return map;
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

function calculateScore(passes: Record<string, PassResult>): { score: number; summary: AuditSummaryStats } {
  let criticalCount = 0;
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let totalChecks = 0;

  for (const pass of Object.values(passes)) {
    totalChecks += pass.matchCount + pass.closeCount + pass.approximationCount + pass.mismatchCount + pass.skipCount;
    for (const issue of pass.issues) {
      switch (issue.severity) {
        case 'critical': criticalCount++; break;
        case 'error': errorCount++; break;
        case 'warning': warningCount++; break;
        case 'info': infoCount++; break;
      }
    }
  }

  const rawScore = 100 - (criticalCount * 20 + errorCount * 5 + warningCount * 1);
  const score = Math.max(0, Math.min(100, rawScore));

  const matchChecks = Object.values(passes).reduce((sum, p) => sum + p.matchCount + p.closeCount, 0);
  const comparableChecks = totalChecks - Object.values(passes).reduce((sum, p) => sum + p.skipCount, 0);
  const passRate = comparableChecks > 0 ? matchChecks / comparableChecks : 0;

  return {
    score,
    summary: {
      criticalCount,
      errorCount,
      warningCount,
      infoCount,
      totalChecks,
      passRate: Math.round(passRate * 10000) / 10000,
    },
  };
}

// ---------------------------------------------------------------------------
// Screen auditing
// ---------------------------------------------------------------------------

function auditScreen(
  screenMapping: ScreenMapping,
  blueprint: BlueprintJSON,
  impl: ImplJSON,
  tokens: TokenMap,
): ScreenAudit {
  const figmaNodes = blueprint.nodes;
  const implNodes = impl.flatNodes ?? impl.componentTree ?? [];

  const passes: Record<string, PassResult> = {};

  // Pass 1: Layout Classification
  passes['layout-classification'] = runPass1LayoutClassification(figmaNodes, implNodes, tokens);

  // Pass 2: Typography
  passes['typography'] = runPass2Typography(figmaNodes, implNodes, tokens);

  // Pass 3: Colors
  passes['colors'] = runPass3Colors(figmaNodes, implNodes, tokens);

  // Pass 4: Spacing
  passes['spacing'] = runPass4Spacing(figmaNodes, implNodes, tokens);

  // Pass 5: Layout Structure
  passes['layout-structure'] = runPass5LayoutStructure(figmaNodes, implNodes, tokens);

  // Pass 6: Borders & Radius
  passes['borders-radius'] = runPass6BordersRadius(figmaNodes, implNodes, tokens);

  // Pass 7: Shadows & Effects
  passes['shadows-effects'] = runPass7ShadowsEffects(figmaNodes, implNodes, tokens);

  // Pass 8: Gradients
  passes['gradients'] = runPass8Gradients(figmaNodes, implNodes, tokens);

  // Pass 9: Components & Assets
  passes['components-assets'] = runPass9ComponentsAssets(figmaNodes, implNodes, tokens);

  const { score, summary } = calculateScore(passes);

  return {
    screenId: screenMapping.figmaNodeId.replace(/:/g, '-'),
    screenName: screenMapping.screenName,
    route: screenMapping.route,
    state: screenMapping.state,
    auditedAt: new Date().toISOString(),
    score,
    passes,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Aggregate summary
// ---------------------------------------------------------------------------

function buildAggregateSummary(
  audits: ScreenAudit[],
  screenMappings: ScreenMapping[],
): AuditSummary {
  const totalScreensAudited = audits.length;
  const overallScore = totalScreensAudited > 0
    ? Math.round(audits.reduce((sum, a) => sum + a.score, 0) / totalScreensAudited)
    : 0;

  // Group by route
  const byRoute: AuditSummary['byRoute'] = {};
  for (const audit of audits) {
    if (!byRoute[audit.route]) {
      byRoute[audit.route] = { score: 0, statesAudited: 0, topIssues: [] };
    }
    const entry = byRoute[audit.route];
    entry.statesAudited++;
    entry.score = Math.round(
      ((entry.score * (entry.statesAudited - 1)) + audit.score) / entry.statesAudited,
    );
    // Collect top error/critical issues
    for (const pass of Object.values(audit.passes)) {
      for (const issue of pass.issues) {
        if ((issue.severity === 'critical' || issue.severity === 'error') && entry.topIssues.length < 5) {
          const desc = `[${issue.pass}] ${issue.property}: ${issue.figmaValue} vs ${issue.appValue}`;
          if (!entry.topIssues.includes(desc)) entry.topIssues.push(desc);
        }
      }
    }
  }

  // Group by tier (priority)
  const tierMap = new Map<number, ScreenMapping>();
  for (const sm of screenMappings) tierMap.set(sm.tier, sm);

  const byPriority: AuditSummary['byPriority'] = {};
  for (const tier of [1, 2, 3, 4]) {
    const tierAudits = audits.filter(a => {
      const mapping = screenMappings.find(m => m.figmaNodeId.replace(/:/g, '-') === a.screenId);
      return mapping?.tier === tier;
    });
    byPriority[`p${tier - 1}`] = {
      score: tierAudits.length > 0
        ? Math.round(tierAudits.reduce((sum, a) => sum + a.score, 0) / tierAudits.length)
        : 100,
      screens: tierAudits.length,
    };
  }

  // Aggregate top issues across all screens
  const issueCountMap = new Map<string, { severity: string; count: number; affectedScreens: Set<string> }>();
  for (const audit of audits) {
    for (const pass of Object.values(audit.passes)) {
      for (const issue of pass.issues) {
        if (issue.severity === 'info') continue;
        const key = `${issue.pass}:${issue.property}:${issue.severity}`;
        if (!issueCountMap.has(key)) {
          issueCountMap.set(key, { severity: issue.severity, count: 0, affectedScreens: new Set() });
        }
        const entry = issueCountMap.get(key)!;
        entry.count++;
        entry.affectedScreens.add(audit.route);
      }
    }
  }

  const topIssues = Array.from(issueCountMap.entries())
    .map(([desc, data]) => ({
      severity: data.severity,
      count: data.count,
      description: desc.replace(/:/g, ' — '),
      affectedScreens: Array.from(data.affectedScreens),
    }))
    .sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 0, error: 1, warning: 2, info: 3 };
      const diff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
      if (diff !== 0) return diff;
      return b.count - a.count;
    })
    .slice(0, 20);

  // Build fix list from top issues
  const fixList: AuditSummary['fixList'] = topIssues
    .filter(i => i.severity !== 'info')
    .map((issue, idx) => ({
      priority: idx + 1,
      route: issue.affectedScreens.join(', '),
      issue: issue.description,
      effort: issue.count > 10 ? 'high' as Effort : issue.count > 3 ? 'medium' as Effort : 'low' as Effort,
      impact: issue.severity === 'critical' ? 'high' as Impact : issue.severity === 'error' ? 'medium' as Impact : 'low' as Impact,
    }));

  return {
    generatedAt: new Date().toISOString(),
    totalScreensAudited,
    overallScore,
    byRoute,
    byPriority,
    topIssues,
    fixList,
  };
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

function loadJSON<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const baseDir = path.resolve(__dirname);
  const dataDir = path.join(baseDir, 'data');
  const implDir = path.join(baseDir, 'implementation');
  const reportsDir = path.join(baseDir, 'reports');
  const summariesDir = path.join(baseDir, 'summaries');

  // Parse CLI args
  const args = process.argv.slice(2);
  let filterScreenId: string | undefined;
  let filterRoute: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--screen' && args[i + 1]) filterScreenId = args[++i];
    if (args[i] === '--route' && args[i + 1]) filterRoute = args[++i];
  }

  // Load screen mapping
  const mappingPath = path.join(baseDir, 'screen-mapping.json');
  const mapping = loadJSON<ScreenMappingFile>(mappingPath);
  if (!mapping) {
    console.error(`[FATAL] Cannot load screen-mapping.json from ${mappingPath}`);
    process.exit(1);
  }

  console.log(`[audit-screen] Loaded ${mapping.screens.length} screen mappings`);

  // Build token map (Pass 0)
  console.log('[audit-screen] Pass 0: Building token map...');
  const tokens = buildTokenMap();
  console.log(`[audit-screen]   Colors: ${Object.keys(tokens.colors).length} tokens`);
  console.log(`[audit-screen]   Typography: ${Object.keys(tokens.typography).length} styles`);
  console.log(`[audit-screen]   Spacing: ${Object.keys(tokens.spacing).length} tokens`);
  console.log(`[audit-screen]   Radius: ${Object.keys(tokens.radius).length} tokens`);
  console.log(`[audit-screen]   Shadows: ${Object.keys(tokens.shadows).length} presets`);
  console.log(`[audit-screen]   Gradients: ${Object.keys(tokens.gradients).length} presets`);

  // Filter screens
  let screens = mapping.screens;
  if (filterScreenId) {
    // Normalize to both colon and dash forms for matching
    const normalized = filterScreenId.replace(/-/g, ':');
    const dashed = filterScreenId.replace(/:/g, '-');
    screens = screens.filter(s =>
      s.figmaNodeId === normalized || s.figmaNodeId === dashed ||
      nodeIdToFileId(s.figmaNodeId) === normalized || nodeIdToFileId(s.figmaNodeId) === dashed,
    );
    if (screens.length === 0) {
      // If not found in mapping, check if blueprint exists directly (screen may be unmapped)
      const blueprintPath = path.join(dataDir, `${dashed}-blueprint.json`);
      if (fs.existsSync(blueprintPath)) {
        console.log(`[audit-screen] Screen "${filterScreenId}" not in mapping but blueprint exists. Creating ad-hoc entry.`);
        const bp = loadJSON<BlueprintJSON>(blueprintPath);
        if (bp) {
          screens = [{
            figmaNodeId: normalized,
            screenName: bp.meta.screenName,
            route: 'unknown',
            state: 'default',
            category: 'unknown',
            tier: 4,
          }];
        }
      }
      if (screens.length === 0) {
        console.error(`[FATAL] No screen found with ID "${filterScreenId}"`);
        process.exit(1);
      }
    }
  }
  if (filterRoute) {
    screens = screens.filter(s => s.route.includes(filterRoute!));
    if (screens.length === 0) {
      console.error(`[FATAL] No screens found matching route "${filterRoute}"`);
      process.exit(1);
    }
  }

  console.log(`[audit-screen] Auditing ${screens.length} screen(s)...`);

  // Run audits
  const audits: ScreenAudit[] = [];
  let skippedCount = 0;

  for (const screen of screens) {
    const fileId = nodeIdToFileId(screen.figmaNodeId);

    // Try to load blueprint (primary Figma data)
    const blueprintPath = path.join(dataDir, `${fileId}-blueprint.json`);
    const blueprint = loadJSON<BlueprintJSON>(blueprintPath);

    // Also try summaries directory
    const summaryPath = path.join(summariesDir, `${fileId}-summary.json`);

    if (!blueprint) {
      // Try summary as fallback (different format, but nodes might be present)
      const summary = loadJSON<BlueprintJSON>(summaryPath);
      if (!summary) {
        console.log(`  [skip] ${screen.screenName} — no blueprint or summary data`);
        skippedCount++;
        continue;
      }
    }

    const figmaData = blueprint ?? loadJSON<BlueprintJSON>(summaryPath)!;

    // Load implementation extraction
    const implPath = path.join(implDir, `${fileId}-impl.json`);
    const impl = loadJSON<ImplJSON>(implPath);

    if (!impl) {
      console.log(`  [skip] ${screen.screenName} — no implementation extraction`);
      skippedCount++;
      continue;
    }

    console.log(`  [audit] ${screen.screenName} (${screen.state})`);
    const audit = auditScreen(screen, figmaData, impl, tokens);
    audits.push(audit);

    // Write per-screen report
    const reportPath = path.join(reportsDir, `${fileId}-audit.json`);
    writeJSON(reportPath, audit);

    const statusIcon = audit.score >= 90 ? 'PASS' : audit.score >= 70 ? 'WARN' : 'FAIL';
    console.log(`    Score: ${audit.score}/100 [${statusIcon}]  (C:${audit.summary.criticalCount} E:${audit.summary.errorCount} W:${audit.summary.warningCount} I:${audit.summary.infoCount})`);
  }

  console.log('');
  console.log(`[audit-screen] Completed: ${audits.length} audited, ${skippedCount} skipped`);

  // Write aggregate summary
  if (audits.length > 0) {
    const summary = buildAggregateSummary(audits, mapping.screens);
    const summaryReportPath = path.join(reportsDir, 'audit-summary.json');
    writeJSON(summaryReportPath, summary);

    console.log('');
    console.log('=== AUDIT SUMMARY ===');
    console.log(`  Overall Score:   ${summary.overallScore}/100`);
    console.log(`  Screens Audited: ${summary.totalScreensAudited}`);
    console.log(`  Top Issues:`);
    for (const issue of summary.topIssues.slice(0, 5)) {
      console.log(`    [${issue.severity}] ${issue.description} (${issue.count}x, ${issue.affectedScreens.length} screens)`);
    }
    if (summary.fixList.length > 0) {
      console.log(`  Fix List (top 5):`);
      for (const fix of summary.fixList.slice(0, 5)) {
        console.log(`    #${fix.priority} [${fix.effort}/${fix.impact}] ${fix.issue}`);
      }
    }
    console.log('');
    console.log(`[audit-screen] Reports written to ${reportsDir}/`);
  } else {
    console.log('[audit-screen] No screens audited. Run extract-screen.ts and extract-implementation.ts first.');
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
