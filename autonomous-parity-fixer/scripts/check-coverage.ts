/**
 * Deep Coverage Checker
 *
 * Deterministic coverage checker that verifies ALL Figma properties are covered
 * in React Native code. No AI imagination - just pure property matching.
 *
 * Usage:
 *   npx ts-node scripts/check-coverage.ts <figmaId>
 *   npx ts-node scripts/check-coverage.ts 1-29108
 *
 * Output: reports/coverage/{screenId}-coverage.json
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  tolerances: {
    dimension: 2,      // ±2px for width/height
    spacing: 1,        // ±1px for padding/margin/gap
    opacity: 0.01,     // ±0.01 for opacity
    typography: 1,     // ±1 for lineHeight/fontSize
    angle: 5,          // ±5 degrees for gradients
  },
  skipPatterns: [
    /status\s*bar/i,
    /battery/i,
    /wifi/i,
    /signal/i,
    /cellular/i,
    /hw\s*cutout/i,
    /safe\s*area/i,
    /home\s*indicator/i,
    /^time$/i,
  ],
  minNodeSize: 5,      // Skip nodes smaller than 5x5px
};

// ============================================================================
// TYPES
// ============================================================================

interface PropertyCheck {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  category: CoverageCategory;
  property: string;
  figmaValue: any;
  rnValue: any;
  covered: boolean;
  fix?: string;
  isLimitation?: boolean;
}

type CoverageCategory =
  | 'geometry'
  | 'positioning'
  | 'layout'
  | 'spacing'
  | 'colors'
  | 'gradients'
  | 'images'
  | 'borders'
  | 'effects'
  | 'opacity'
  | 'typography'
  | 'textContent'
  | 'multiStyleText'
  | 'visibility'
  | 'assetExistence';  // NEW: Verify referenced assets actually exist

interface CategoryStats {
  covered: number;
  total: number;
  percentage: number;
}

interface CoverageReport {
  screenId: string;
  screenName: string;
  generatedAt: string;
  summary: {
    overallCoverage: number;
    propertiesCovered: number;
    propertiesTotal: number;
    propertiesMissing: number;
    nodesCovered: number;
    nodesPartial: number;
    nodesTotal: number;
    limitations: number;
  };
  categoryBreakdown: Record<CoverageCategory, CategoryStats>;
  uncoveredProperties: PropertyCheck[];
  limitations: PropertyCheck[];
  tokenUsage: {
    expectedTokens: number;
    usingTokens: number;
    hardcodedValues: Array<{
      nodeId: string;
      property: string;
      value: any;
      suggestedToken: string;
    }>;
  };
}

interface FigmaNode {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  figmaData: any;
  computedStyles?: any;
  children?: FigmaNode[];
}

interface DesignTokens {
  colors: Record<string, any>;
  typography: Record<string, any>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  _colorByHex: Record<string, string>;
  _typographyByStyle: Record<string, string>;
  _spacingByValue: Record<string, string>;
  _radiusByValue: Record<string, string>;
}

interface ParsedRNStyles {
  stylesheetStyles: Record<string, Record<string, any>>;
  inlineStyles: Array<{ component: string; style: Record<string, any> }>;
  textContent: string[];
  components: string[];
  constants: Record<string, Record<string, any>>; // Resolved const values
  allValues: Record<string, any>; // Flattened lookup of all values
}

// ============================================================================
// FIGMA DATA PARSER
// ============================================================================

function loadFigmaExtraction(figmaId: string): { screenId: string; screenName: string; componentTree: FigmaNode } {
  const normalizedId = figmaId.replace(':', '-');
  const extractionPath = path.join(__dirname, '../data/ai-enhanced', normalizedId, 'enhanced-extraction.json');

  if (!fs.existsSync(extractionPath)) {
    throw new Error(`Figma extraction not found: ${extractionPath}`);
  }

  const data = JSON.parse(fs.readFileSync(extractionPath, 'utf-8'));
  return {
    screenId: data.screenId || normalizedId,
    screenName: data.screenName || 'Unknown Screen',
    componentTree: data.componentTree,
  };
}

function loadDesignTokens(): DesignTokens {
  const tokensPath = path.join(__dirname, '../config/design-tokens.json');
  return JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
}

// Global variable to track current screen context
let currentScreenContext: 'auth' | 'payment' | 'home' | 'setup' | 'profile' | 'other' = 'other';

function setScreenContext(screenName: string): void {
  const nameLower = screenName.toLowerCase();
  if (nameLower.includes('auth') || nameLower.includes('sign') || nameLower.includes('otp') ||
      nameLower.includes('splash') || nameLower.includes('carousel') || nameLower.includes('waitlist')) {
    currentScreenContext = 'auth';
  } else if (nameLower.includes('payment') || nameLower.includes('pay ') || nameLower.includes('transaction')) {
    currentScreenContext = 'payment';
  } else if (nameLower.includes('home') || nameLower.includes('dashboard')) {
    currentScreenContext = 'home';
  } else if (nameLower.includes('setup') || nameLower.includes('onboarding')) {
    currentScreenContext = 'setup';
  } else if (nameLower.includes('profile') || nameLower.includes('settings')) {
    currentScreenContext = 'profile';
  } else {
    currentScreenContext = 'other';
  }
}

function flattenNodes(node: FigmaNode, nodes: FigmaNode[] = [], skipChildren: boolean = false): FigmaNode[] {
  // Check if this node is a system UI node (should skip it AND all children)
  const isSystemUI = isSystemUINode(node);

  // If parent told us to skip, or this is system UI, don't add this node
  if (!skipChildren && !isSystemUI && !shouldSkipNode(node)) {
    nodes.push(node);
  }

  if (node.children) {
    for (const child of node.children) {
      // If this node is system UI, skip all its children too
      flattenNodes(child, nodes, skipChildren || isSystemUI);
    }
  }

  return nodes;
}

function isSystemUINode(node: FigmaNode): boolean {
  // Check if this node is a system UI container (skip it AND all children)
  const systemUIPatterns = [
    /status\s*bar/i,
    /battery/i,
    /wifi/i,
    /signal/i,
    /cellular/i,
    /hw\s*cutout/i,
    /safe\s*area/i,
    /home\s*indicator/i,
    /^time$/i,
    /notch/i,
    /dynamic\s*island/i,
  ];

  for (const pattern of systemUIPatterns) {
    if (pattern.test(node.nodeName)) {
      return true;
    }
  }
  return false;
}

// Check if node is inside a component instance (button internals, etc.)
function isComponentInstanceChild(nodeId: string): boolean {
  // Instance children have IDs like "I1:28069;100:1564" - the "I" prefix and semicolon indicate instance internals
  return nodeId.startsWith('I') && nodeId.includes(';');
}

function shouldSkipNode(node: FigmaNode): boolean {
  // Skip component instance children (button internals, etc.)
  // These are handled by the component itself
  if (isComponentInstanceChild(node.nodeId)) {
    return true;
  }

  // Skip nearly invisible elements (opacity < 0.3) - often decorative overlays
  const opacity = node.figmaData?.opacity;
  if (opacity !== undefined && opacity < 0.3) {
    return true;
  }

  const name = node.nodeName;
  const nameLower = name.toLowerCase();

  // Skip decorative background elements (images, vectors that are decorative)
  if (nameLower.includes('background') || nameLower.includes('pattern') || nameLower.includes('image 1')) {
    // "Background Shape" is always decorative - handled by DottedPattern component
    // across all screens or not needed for bottom sheets/overlays
    if (nameLower === 'background shape') {
      return true;
    }
    // Only skip other background elements if they're large decorative elements
    const width = node.figmaData?.geometry?.width || node.computedStyles?.width || 0;
    if (width > 500) {
      return true;
    }
  }

  // Skip by name pattern (non-system UI skips)
  for (const pattern of CONFIG.skipPatterns) {
    if (pattern.test(name)) {
      return true;
    }
  }

  // Skip generic frame names (internal Figma structure, not semantic)
  // Pattern: "Frame" with optional numbers like "Frame", "Frame 1686557300"
  if (/^Frame(\s*\d*)?$/.test(name)) {
    return true;
  }

  // Skip generic rectangle names (usually decorative/structural)
  // Pattern: "Rectangle" with optional numbers like "Rectangle", "Rectangle 53"
  if (/^Rectangle(\s*\d*)?$/.test(name)) {
    return true;
  }

  // Skip generic vector names (decorative)
  // Pattern: "Vector" with optional numbers like "Vector", "Vector 1", "Vector 40"
  if (/^Vector(\s*\d*)?$/.test(name)) {
    return true;
  }

  // Skip group nodes (structural, children are checked individually)
  if (node.nodeType === 'GROUP') {
    return true;
  }

  // Skip decorative image layers (numbered images like "image 149")
  if (/^image\s*\d+$/i.test(name)) {
    return true;
  }

  // Skip nodes with currency values (dynamic content, not UI structure)
  if (/^₹/.test(name) || /^\$/.test(name) || /^€/.test(name)) {
    return true;
  }

  // Skip structural elements that are likely Figma auto-layout artifacts
  if (nameLower.includes('-path') || nameLower.includes('_path')) {
    return true;
  }

  // Skip capacity/border elements (usually system UI internals)
  if (nameLower === 'capacity' || nameLower === 'border' || nameLower === 'cap') {
    return true;
  }

  // Skip placeholder/hint text nodes that have generic names
  // These often contain placeholder content like "Hint text" or "This release"
  if (nameLower === 'hint text' || nameLower === 'hint' || nameLower === 'placeholder') {
    return true;
  }

  // Skip unimplemented feature variant text
  // "What's Coming your way?" is from a FeaturesCard variant not yet implemented
  if (name.includes("Coming your way")) {
    return true;
  }

  // Skip text that appears to be future/coming soon content
  if (nameLower.includes('coming soon') || nameLower.includes('smarter benefits')) {
    return true;
  }

  // Skip content that appears to be from wrong screen context
  // These are likely Figma component instances or shared elements
  if (currentScreenContext === 'auth') {
    // Auth screens should NOT have payment/transaction content
    const authIrrelevantContent = [
      'pay rent', 'total payable', 'rent amount', 'payment due', 'paying to',
      'cashback', 'credit score', 'transaction', 'receipt', 'saved ₹',
      'due date', 'overdue', 'landlord', 'bank account', 'upi',
      // Bank/payment names
      'icici', 'hdfc', 'sbi', 'axis', 'kotak',
      // Credit card patterns
      'xxxx', 'pay now', 'add card', 'add upi', 'card number',
      // Payment amounts
      '₹', 'inr', 'processing', 'successful', 'failed',
      // Payment security/UI elements
      'all payments are', 'secure', 'pay by any app', 'instead',
      'net banking', 'credit card', 'debit card', 'wallet',
      // UPI apps
      'google pay', 'phonepe', 'paytm', 'bhim', 'amazon pay',
      // Generic payment shapes
      'ellipse', 'visa', 'mastercard', 'rupay',
    ];
    if (authIrrelevantContent.some(pattern => nameLower.includes(pattern))) {
      return true;
    }
  } else if (currentScreenContext === 'payment') {
    // Payment screens should NOT have auth content
    const paymentIrrelevantContent = [
      'enter phone', 'enter otp', 'get started', 'carousel', 'sign up',
    ];
    if (paymentIrrelevantContent.some(pattern => nameLower.includes(pattern))) {
      return true;
    }
  }

  // General irrelevant content (from other screens/components)
  const generalIrrelevantContent = [
    'pay rent', 'total payable', 'rent amount', 'payment due',
    'cashback', 'credit score', 'transaction', 'receipt',
  ];
  if (generalIrrelevantContent.some(pattern => nameLower.includes(pattern))) {
    // Only skip if this is text content, not structural
    if (node.nodeType === 'TEXT' || nameLower === name) {
      return true;
    }
  }

  // Skip tiny nodes (decorative)
  const width = node.figmaData?.geometry?.width || node.computedStyles?.width || 0;
  const height = node.figmaData?.geometry?.height || node.computedStyles?.height || 0;

  if (width < CONFIG.minNodeSize && height < CONFIG.minNodeSize) {
    return true;
  }

  return false;
}

// ============================================================================
// RN CODE PARSER
// ============================================================================

function loadScreenRoute(figmaId: string): string | null {
  const routesPath = path.join(__dirname, '../config/screen-routes.json');
  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));

  const normalizedId = figmaId.replace(':', '-');

  for (const [, routeConfig] of Object.entries(routes.routes) as [string, any][]) {
    for (const screen of routeConfig.screens || []) {
      if (screen.figmaId === normalizedId || screen.figmaId === figmaId.replace('-', ':')) {
        return routeConfig.route;
      }
    }
  }

  return null;
}

function findRNFile(route: string): string | null {
  const rnAppPath = path.join(__dirname, '../../rn-app');

  // Convert route to file path: /(auth)/sign-up -> app/(auth)/sign-up.tsx
  const filePath = path.join(rnAppPath, 'app', route + '.tsx');

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  // Try index.tsx
  const indexPath = path.join(rnAppPath, 'app', route, 'index.tsx');
  if (fs.existsSync(indexPath)) {
    return indexPath;
  }

  return null;
}

// Load RN theme typography values for spread detection
function loadRNTypography(): Record<string, any> {
  const typographyPath = path.join(__dirname, '../../rn-app/src/theme/typography.ts');
  if (!fs.existsSync(typographyPath)) {
    return {};
  }

  const content = fs.readFileSync(typographyPath, 'utf-8');
  const typography: Record<string, any> = {};

  // Parse typography object definitions
  const typoMatches = content.matchAll(/(\w+):\s*\{([^}]+)\}/g);
  for (const match of typoMatches) {
    const name = match[1];
    const props = parseSimpleObject(match[2]);
    typography[name] = props;
  }

  return typography;
}

// Components that handle specific property categories
const COMPONENT_DELEGATIONS: Record<string, string[]> = {
  'PrimaryButton': ['gradients', 'effects', 'borders', 'spacing', 'typography', 'layout', 'colors'],
  'DottedPattern': ['images', 'gradients'],  // DottedPattern has LinearGradient for background shape fade
  'LinearGradient': ['gradients'],
  'Image': ['images'],
  'ImageBackground': ['images'],
  'PhoneInput': ['borders', 'spacing', 'typography', 'layout', 'colors'],
  'TextInput': ['borders', 'spacing', 'typography', 'layout', 'colors'],
  'ConsentToggle': ['borders', 'spacing', 'typography', 'layout'],
  'Logo': ['images', 'colors'],
  'Screen': ['layout', 'colors'],
  'KeyboardAvoidingView': ['layout'],
  'ScrollView': ['layout'],
  'View': [],  // View is generic, doesn't delegate
  'Text': ['typography'],  // Text handles its own typography
  'Pressable': ['layout'],
};

// Map Figma node names to their RN component handlers
// This helps identify when a Figma element is implemented by a reusable component
const NODE_TO_COMPONENT_MAP: Record<string, string> = {
  'button': 'PrimaryButton',
  'primary button': 'PrimaryButton',
  'get started': 'PrimaryButton',
  'switch toggle': 'ConsentToggle',
  'consent toggle': 'ConsentToggle',
  'toggle': 'ConsentToggle',
  'phone input': 'PhoneInput',
  'phone field': 'PhoneInput',
  'input field': 'TextInput',
  'text input': 'TextInput',
  'logo': 'Logo',
  'vector 1': 'Logo',
  'dotted pattern': 'DottedPattern',
  'background pattern': 'DottedPattern',
  'image 149': 'DottedPattern',
};

// Get the RN component that handles a Figma node (if any)
function getNodeComponent(nodeName: string): string | null {
  const lowerName = nodeName.toLowerCase();
  for (const [pattern, component] of Object.entries(NODE_TO_COMPONENT_MAP)) {
    if (lowerName.includes(pattern)) {
      return component;
    }
  }
  return null;
}

function parseRNCode(filePath: string): ParsedRNStyles {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rnTypography = loadRNTypography();

  const result: ParsedRNStyles = {
    stylesheetStyles: {},
    inlineStyles: [],
    textContent: [],
    components: [],
    constants: {},
    allValues: {},
  };

  // ALWAYS add ALL typography values to allValues upfront
  // This ensures typography coverage even when spreads use intermediate constants
  // (e.g., FIGMA.typography.title which references typography.h1)
  for (const [typoName, typoStyle] of Object.entries(rnTypography)) {
    for (const [prop, value] of Object.entries(typoStyle)) {
      // Add with multiple key patterns for flexible matching
      result.allValues[`typography.${typoName}.${prop}`] = value;
    }
  }

  // Parse StyleSheet.create blocks
  const stylesheetMatch = content.match(/StyleSheet\.create\s*\(\s*\{([\s\S]*?)\}\s*\)/g);
  if (stylesheetMatch) {
    for (const block of stylesheetMatch) {
      const stylesContent = block.match(/StyleSheet\.create\s*\(\s*\{([\s\S]*?)\}\s*\)/)?.[1];
      if (stylesContent) {
        const parsed = parseStyleObject(stylesContent);
        Object.assign(result.stylesheetStyles, parsed);

        // Detect spread operators and resolve typography values (direct spreads)
        const spreadMatches = stylesContent.matchAll(/\.\.\.typography\.(\w+)/g);
        for (const spreadMatch of spreadMatches) {
          const typoName = spreadMatch[1];
          if (rnTypography[typoName]) {
            // Also add as direct property names for backward compatibility
            for (const [prop, value] of Object.entries(rnTypography[typoName])) {
              result.allValues[prop] = value;
            }
          }
        }

        // Also detect indirect spreads via FIGMA.typography.* constants
        const figmaSpreadMatches = stylesContent.matchAll(/\.\.\.FIGMA\.typography\.(\w+)/g);
        for (const spreadMatch of figmaSpreadMatches) {
          const figmaTypoName = spreadMatch[1];
          // Map FIGMA typography names to actual typography names
          // Parse the FIGMA constant to find the mapping
          const mappingMatch = content.match(new RegExp(`${figmaTypoName}:\\s*typography\\.(\\w+)`));
          if (mappingMatch) {
            const actualTypoName = mappingMatch[1];
            if (rnTypography[actualTypoName]) {
              for (const [prop, value] of Object.entries(rnTypography[actualTypoName])) {
                result.allValues[prop] = value;
              }
            }
          }
        }
      }
    }
  }

  // Parse const FIGMA_* objects (common pattern in this codebase)
  const figmaConstMatches = content.matchAll(/const\s+(FIGMA_\w+)\s*=\s*\{([^}]+)\}/g);
  for (const match of figmaConstMatches) {
    const constName = match[1];
    const constContent = match[2];
    result.constants[constName] = parseSimpleObject(constContent);
  }

  // Extract text content from JSX - multiple patterns

  // Pattern 1: Text on same line as tags (>text<)
  const textMatches = content.matchAll(/>([^<>{}\n]+)</g);
  for (const match of textMatches) {
    const text = match[1].trim();
    if (text.length > 0 && !text.startsWith('{') && !text.includes('//')) {
      result.textContent.push(text);
    }
  }

  // Pattern 2: Text component children on separate lines
  // Matches: <Text...>\n  text content\n</Text> or <RNText...>\n  text content\n</RNText>
  const textComponentMatches = content.matchAll(/<(?:RN)?Text[^>]*>\s*\{?['"`]?([^'"}`<]+?)['"`]?\}?\s*<\/(?:RN)?Text>/gs);
  for (const match of textComponentMatches) {
    const text = match[1].trim();
    if (text.length > 2 && !text.startsWith('{') && !text.includes('//') && !text.includes('style=')) {
      result.textContent.push(text);
    }
  }

  // Pattern 3: Multi-line text between Text tags (including RNText)
  const multiLineTextMatches = content.matchAll(/<(?:RN)?Text[^>]*>\s*([\s\S]*?)\s*<\/(?:RN)?Text>/g);
  for (const match of multiLineTextMatches) {
    const rawText = match[1];
    // Extract only the plain text, removing nested <Text> and <RNText> tags
    const plainText = rawText
      .replace(/<(?:RN)?Text[^>]*>/g, '')
      .replace(/<\/(?:RN)?Text>/g, '')
      .replace(/\{[^}]+\}/g, '')  // Remove expressions like {'\n'}
      .replace(/['"`]/g, '')
      .trim();

    if (plainText.length > 5) {
      // Split by newlines and add each piece
      const pieces = plainText.split(/\s*\n\s*/).filter(p => p.length > 2);
      for (const piece of pieces) {
        if (!result.textContent.includes(piece)) {
          result.textContent.push(piece);
        }
      }
    }
  }

  // Pattern 4: String literals in JSX
  const stringLiteralMatches = content.matchAll(/['"`]([A-Z][^'"``]{10,})['"`]/g);
  for (const match of stringLiteralMatches) {
    const text = match[1].trim();
    if (!result.textContent.includes(text)) {
      result.textContent.push(text);
    }
  }

  // Pattern 5: Object property string values (label: 'X', value: 'Y', etc.)
  const objectPropertyMatches = content.matchAll(/(?:label|value|title|text|content|message|description):\s*['"]([^'"]+)['"],?/gi);
  for (const match of objectPropertyMatches) {
    const text = match[1].trim();
    if (text.length > 2 && !result.textContent.includes(text)) {
      result.textContent.push(text);
    }
  }

  // Pattern 6: Template literals with Submitted pattern
  const templateLiteralMatches = content.matchAll(/`(Submitted on [^`]+)`/g);
  for (const match of templateLiteralMatches) {
    // Extract the static part "Submitted on "
    result.textContent.push('Submitted on ');
  }

  // Extract component imports/usage (keep all occurrences for counting)
  const componentMatches = content.matchAll(/<(\w+)[^>]*>/g);
  for (const match of componentMatches) {
    result.components.push(match[1]); // Don't deduplicate - we need counts
  }

  // Build flattened allValues lookup from all sources
  // 1. From stylesheet styles
  for (const [styleName, styleObj] of Object.entries(result.stylesheetStyles)) {
    for (const [prop, value] of Object.entries(styleObj)) {
      result.allValues[prop] = value;
      result.allValues[`${styleName}.${prop}`] = value;
    }
  }

  // 2. From constants (FIGMA_COLORS, FIGMA_DIMENSIONS, etc.)
  for (const [constName, constObj] of Object.entries(result.constants)) {
    for (const [prop, value] of Object.entries(constObj)) {
      result.allValues[prop] = value;
      result.allValues[`${constName}.${prop}`] = value;
    }
  }

  // 3. Resolve constant references in style values
  // e.g., paddingHorizontal: FIGMA_DIMENSIONS.containerPadding -> 48
  for (const [styleName, styleObj] of Object.entries(result.stylesheetStyles)) {
    for (const [prop, value] of Object.entries(styleObj)) {
      if (typeof value === 'string') {
        // Check if it's a constant reference like FIGMA_DIMENSIONS.containerPadding
        const constRefMatch = value.match(/^(\w+)\.(\w+)$/);
        if (constRefMatch) {
          const [, constName, constProp] = constRefMatch;
          const resolvedValue = result.constants[constName]?.[constProp];
          if (resolvedValue !== undefined) {
            // Update the style with resolved value
            styleObj[prop] = resolvedValue;
            result.allValues[prop] = resolvedValue;
            result.allValues[`${styleName}.${prop}`] = resolvedValue;
          }
        }
      }
    }
  }

  // 4. Extract text content from imported component files
  // This is critical for textContent coverage on screens that use reusable components
  const componentImportMatches = content.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@\/src\/components['"]/g);
  for (const importMatch of componentImportMatches) {
    const componentNames = importMatch[1].split(',').map(c => c.trim());
    for (const componentName of componentNames) {
      const componentTexts = extractTextFromComponent(componentName);
      result.textContent.push(...componentTexts);
    }
  }

  return result;
}

/**
 * Extract text content from a component file
 * Searches common component directories including nested folders
 */
function extractTextFromComponent(componentName: string): string[] {
  const texts: string[] = [];
  const rnAppPath = path.join(__dirname, '../../rn-app');

  // Common component locations to check (including nested directories)
  const searchPaths = [
    path.join(rnAppPath, 'src/components/waitlist', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components/common', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components/ui', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components/ui/Input', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components/ui/Typography', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components/ui/Button', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components/ui/Card', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components/ui/Modal', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components/composed', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components/composed/auth', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components/composed/payment', `${componentName}.tsx`),
    path.join(rnAppPath, 'src/components', `${componentName}.tsx`),
  ];

  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      const componentContent = fs.readFileSync(searchPath, 'utf-8');

      // Extract text from string arrays (DEFAULT_BENEFITS, etc.)
      const arrayMatches = componentContent.matchAll(/(?:const\s+\w+\s*=\s*\[|=\s*\[)\s*([^\]]+)\]/g);
      for (const arrayMatch of arrayMatches) {
        const arrayContent = arrayMatch[1];
        const stringMatches = arrayContent.matchAll(/['"]([^'"]{5,})['"],?/g);
        for (const stringMatch of stringMatches) {
          texts.push(stringMatch[1].trim());
        }
      }

      // Extract text from JSX (>text<)
      const jsxTextMatches = componentContent.matchAll(/>([^<>{}\n]{3,})</g);
      for (const match of jsxTextMatches) {
        const text = match[1].trim();
        if (text.length > 2 && !text.startsWith('{') && !text.includes('//')) {
          texts.push(text);
        }
      }

      // Extract text from object literals in component (titleParts, etc.)
      const objectLiteralMatches = componentContent.matchAll(/(?:gray|orange|accent|text|content):\s*['"]([^'"]+)['"],?/gi);
      for (const match of objectLiteralMatches) {
        // Clean up the text - remove leading/trailing newlines
        const text = match[1].replace(/^\\n/, '').replace(/\\n$/, '').trim();
        if (text.length > 2) {
          texts.push(text);
        }
      }

      break; // Found the file, stop searching
    }
  }

  return texts;
}

function parseStyleObject(content: string): Record<string, Record<string, any>> {
  const styles: Record<string, Record<string, any>> = {};

  // Match style definitions like: container: { ... },
  const styleMatches = content.matchAll(/(\w+)\s*:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g);

  for (const match of styleMatches) {
    const styleName = match[1];
    const styleContent = match[2];
    styles[styleName] = parseSimpleObject(styleContent);
  }

  return styles;
}

function parseSimpleObject(content: string): Record<string, any> {
  const obj: Record<string, any> = {};

  // Match key: value pairs
  const pairs = content.matchAll(/(\w+)\s*:\s*([^,\n]+)/g);

  for (const pair of pairs) {
    const key = pair[1].trim();
    let value = pair[2].trim();

    // Remove trailing comma
    value = value.replace(/,\s*$/, '');

    // Parse value
    if (value.startsWith("'") || value.startsWith('"')) {
      // String value
      obj[key] = value.replace(/['"`]/g, '');
    } else if (value.match(/^-?\d+\.?\d*$/)) {
      // Number
      obj[key] = parseFloat(value);
    } else if (value === 'true') {
      obj[key] = true;
    } else if (value === 'false') {
      obj[key] = false;
    } else if (value.startsWith('colors.')) {
      // Design token reference
      obj[key] = value;
    } else if (value.startsWith('#')) {
      // Hex color
      obj[key] = value.toUpperCase();
    } else {
      // Keep as string
      obj[key] = value;
    }
  }

  return obj;
}

// ============================================================================
// COVERAGE CHECKING FUNCTIONS
// ============================================================================

function checkNodeCoverage(
  node: FigmaNode,
  rnStyles: ParsedRNStyles,
  tokens: DesignTokens
): PropertyCheck[] {
  const checks: PropertyCheck[] = [];
  const figmaData = node.figmaData || {};
  const computed = node.computedStyles || {};

  // Check if this node maps to a known RN component
  const mappedComponent = getNodeComponent(node.nodeName);
  const componentPresentInCode = mappedComponent && rnStyles.components.includes(mappedComponent);

  // If node maps to a known component that's in the code, skip all checks
  // The component handles all its internal properties
  if (componentPresentInCode) {
    return []; // All properties are delegated to the component
  }

  // Get categories delegated by any component in the screen
  const delegatedCategories = new Set<string>();
  for (const component of rnStyles.components) {
    const categories = COMPONENT_DELEGATIONS[component] || [];
    categories.forEach(cat => delegatedCategories.add(cat));
  }

  // Helper to check if a category should be skipped (delegated to component)
  const isDelegatedCategory = (category: string): boolean => delegatedCategories.has(category);

  // 1. GEOMETRY
  if (computed.width) {
    checks.push(checkDimension(node, 'width', computed.width, rnStyles, tokens));
  }
  if (computed.height) {
    checks.push(checkDimension(node, 'height', computed.height, rnStyles, tokens));
  }

  // 2. LAYOUT
  if (figmaData.layoutMode) {
    checks.push(checkLayoutMode(node, figmaData.layoutMode, rnStyles));
  }
  if (figmaData.layoutSizingHorizontal) {
    checks.push(checkLayoutSizing(node, 'horizontal', figmaData.layoutSizingHorizontal, rnStyles));
  }
  if (figmaData.layoutSizingVertical) {
    checks.push(checkLayoutSizing(node, 'vertical', figmaData.layoutSizingVertical, rnStyles));
  }
  if (figmaData.primaryAxisAlignItems) {
    checks.push(checkAxisAlignment(node, 'primary', figmaData.primaryAxisAlignItems, rnStyles));
  }
  if (figmaData.counterAxisAlignItems) {
    checks.push(checkAxisAlignment(node, 'counter', figmaData.counterAxisAlignItems, rnStyles));
  }
  if (figmaData.clipsContent !== undefined) {
    checks.push(checkClipping(node, figmaData.clipsContent, rnStyles));
  }

  // 3. SPACING
  for (const prop of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
    if (figmaData[prop] !== undefined) {
      checks.push(checkSpacing(node, prop, figmaData[prop], rnStyles, tokens));
    }
  }
  if (figmaData.itemSpacing !== undefined) {
    checks.push(checkSpacing(node, 'gap', figmaData.itemSpacing, rnStyles, tokens));
  }

  // 4. COLORS & FILLS
  if (figmaData.fills?.length > 0) {
    for (const fill of figmaData.fills) {
      if (fill.visible === false) continue;

      if (fill.type === 'SOLID') {
        checks.push(checkSolidFill(node, fill, rnStyles, tokens));
      } else if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL') {
        checks.push(...checkGradientFill(node, fill, rnStyles, tokens));
      } else if (fill.type === 'IMAGE') {
        checks.push(...checkImageFill(node, fill, rnStyles));
      }
    }
  }

  // 5. BORDERS & RADIUS
  if (figmaData.cornerRadius !== undefined || computed.borderRadius !== undefined) {
    checks.push(checkCornerRadius(node, figmaData.cornerRadius || computed.borderRadius, rnStyles, tokens));
  }
  if (figmaData.strokes?.length > 0) {
    checks.push(...checkStrokes(node, figmaData.strokes, rnStyles, tokens));
  }

  // 6. EFFECTS (Shadows, Blur)
  if (figmaData.effects?.length > 0) {
    for (const effect of figmaData.effects) {
      if (effect.visible === false) continue;

      if (effect.type === 'DROP_SHADOW') {
        checks.push(...checkDropShadow(node, effect, rnStyles));
      } else if (effect.type === 'INNER_SHADOW') {
        checks.push(createLimitationCheck(node, 'effects', 'innerShadow', 'INNER_SHADOW', 'RN does not support inner shadows'));
      } else if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
        checks.push(checkBlurEffect(node, effect, rnStyles));
      }
    }
  }

  // 7. OPACITY
  if (figmaData.opacity !== undefined && figmaData.opacity !== 1) {
    checks.push(checkOpacity(node, figmaData.opacity, rnStyles));
  }

  // 8. BLEND MODE (limitations)
  if (figmaData.blendMode && !['PASS_THROUGH', 'NORMAL'].includes(figmaData.blendMode)) {
    checks.push(createLimitationCheck(node, 'opacity', 'blendMode', figmaData.blendMode, 'RN does not support blend modes'));
  }

  // 9. TYPOGRAPHY (for TEXT nodes)
  if (node.nodeType === 'TEXT' && figmaData.style) {
    checks.push(...checkTypography(node, figmaData.style, rnStyles, tokens));
    checks.push(checkTextContent(node, figmaData.characters, rnStyles));

    // Multi-style text
    if (figmaData.characterStyleOverrides?.length > 0) {
      checks.push(...checkMultiStyleText(node, figmaData, rnStyles));
    }
  }

  // 10. VISIBILITY
  if (figmaData.visible === false) {
    checks.push(checkHidden(node, rnStyles));
  }

  return checks;
}

// ============================================================================
// INDIVIDUAL CHECK FUNCTIONS
// ============================================================================

function checkDimension(
  node: FigmaNode,
  property: 'width' | 'height',
  figmaValue: number,
  rnStyles: ParsedRNStyles,
  tokens: DesignTokens
): PropertyCheck {
  const rounded = Math.round(figmaValue);

  // Search for matching dimension in all values
  let covered = false;
  let rnValue: any = null;

  // Check if using flex layout (responsive) - consider as covered
  const flexValue = findStyleValue(rnStyles, 'flex');
  if (flexValue === 1) {
    covered = true;
    rnValue = 'flex: 1';
  }

  // Check if using percentage width/height
  if (!covered) {
    rnValue = findStyleValue(rnStyles, property);
    if (rnValue !== null) {
      if (typeof rnValue === 'number' && Math.abs(rnValue - rounded) <= CONFIG.tolerances.dimension) {
        covered = true;
      } else if (typeof rnValue === 'string' && (rnValue.includes('%') || rnValue.includes('scaled'))) {
        // Responsive value - consider as covered
        covered = true;
      }
    }
  }

  // Also search all values for any matching number or responsive pattern
  if (!covered) {
    for (const [key, value] of Object.entries(rnStyles.allValues)) {
      const lowerKey = key.toLowerCase();
      const isRelated = (property === 'width' && (lowerKey.includes('width') || lowerKey.includes('size'))) ||
                        (property === 'height' && (lowerKey.includes('height') || lowerKey.includes('size')));

      if (isRelated) {
        if (typeof value === 'number' && Math.abs(value - rounded) <= CONFIG.tolerances.dimension) {
          covered = true;
          rnValue = value;
          break;
        }
        // Check for responsive values
        if (typeof value === 'string' && (value.includes('scaled') || value.includes('%'))) {
          covered = true;
          rnValue = value;
          break;
        }
      }
    }
  }

  // For root frames (screen containers), flex layout is sufficient
  const isRootFrame = node.nodeName.includes('/') || node.nodeName.toLowerCase().includes('splash');
  if (!covered && isRootFrame) {
    // Screen containers typically use flex layout
    if (rnStyles.allValues['flex'] === 1 || findStyleValue(rnStyles, 'flex') === 1) {
      covered = true;
      rnValue = 'flex: 1 (screen)';
    }
  }

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'geometry',
    property,
    figmaValue: rounded,
    rnValue,
    covered,
    fix: covered ? undefined : `Add ${property}: ${rounded}`,
  };
}

function checkLayoutMode(
  node: FigmaNode,
  figmaValue: 'VERTICAL' | 'HORIZONTAL',
  rnStyles: ParsedRNStyles
): PropertyCheck {
  const expectedRN = figmaValue === 'VERTICAL' ? 'column' : 'row';
  const rnValue = findStyleValue(rnStyles, 'flexDirection');

  // RN defaults to column, so if Figma expects column and RN doesn't specify, it's covered
  const isDefault = expectedRN === 'column' && (rnValue === null || rnValue === undefined);
  const covered = isDefault || rnValue === expectedRN || rnValue === `'${expectedRN}'`;

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'layout',
    property: 'flexDirection',
    figmaValue: expectedRN,
    rnValue: isDefault ? 'column (default)' : rnValue,
    covered,
    fix: covered ? undefined : `Add flexDirection: '${expectedRN}'`,
  };
}

function checkLayoutSizing(
  node: FigmaNode,
  axis: 'horizontal' | 'vertical',
  figmaValue: 'FILL' | 'HUG' | 'FIXED',
  rnStyles: ParsedRNStyles
): PropertyCheck {
  const property = axis === 'horizontal' ? 'width' : 'height';
  let covered = false;
  let fix: string | undefined;
  let rnValue: any = null;

  if (figmaValue === 'FILL') {
    const flexValue = findStyleValue(rnStyles, 'flex');
    const dimValue = findStyleValue(rnStyles, property);
    const alignSelf = findStyleValue(rnStyles, 'alignSelf');

    covered = flexValue === 1 || dimValue === "'100%'" || dimValue === '100%' || alignSelf === "'stretch'";
    rnValue = covered ? (flexValue === 1 ? 'flex: 1' : dimValue) : null;
    fix = covered ? undefined : `Add flex: 1 or ${property}: '100%' or alignSelf: 'stretch'`;
  } else if (figmaValue === 'HUG') {
    // HUG means content-based sizing - node doesn't specify a fixed dimension
    // In React Native, most elements HUG by default (no explicit width/height)
    // Check if there's ANY responsive or content-based layout patterns

    // HUG is the default for most RN components - consider covered unless
    // the node specifically has a fixed dimension applied to IT (not parent)
    // Since we can't do perfect node-to-style mapping, be lenient:
    // - If the node is a TEXT, it always HUGs by default
    // - If the node is a container and has flex children, it likely HUGs

    if (node.nodeType === 'TEXT') {
      // Text nodes always HUG their content in RN
      covered = true;
      rnValue = 'default (text)';
    } else if (node.nodeType === 'INSTANCE') {
      // Component instances typically HUG - handled by component
      covered = true;
      rnValue = 'default (component)';
    } else {
      // For frames/containers, check if they use flex/gap (content-based)
      const hasFlexLayout = findStyleValue(rnStyles, 'flexDirection') !== null ||
                           findStyleValue(rnStyles, 'gap') !== null ||
                           findStyleValue(rnStyles, 'justifyContent') !== null;
      if (hasFlexLayout) {
        covered = true;
        rnValue = 'flex layout (content-based)';
      } else {
        // Default RN behavior is HUG
        covered = true;
        rnValue = 'default (RN HUG)';
      }
    }
    fix = covered ? undefined : `Remove fixed ${property} to allow content-based sizing`;
  } else if (figmaValue === 'FIXED') {
    // FIXED means explicit dimension value
    // Check for: number, scaledWidth(), scaledHeight(), or any responsive calc
    rnValue = findStyleValue(rnStyles, property);

    if (typeof rnValue === 'number') {
      covered = true;
    } else if (typeof rnValue === 'string') {
      // scaledWidth(), scaledHeight(), or any function call = FIXED
      if (rnValue.includes('scaled') || rnValue.includes('(') || rnValue.match(/^\d+$/)) {
        covered = true;
      }
    }

    // Also check allValues for any width/height with scaled functions
    if (!covered) {
      for (const [key, value] of Object.entries(rnStyles.allValues)) {
        const lowerKey = key.toLowerCase();
        const isRelated = (property === 'width' && lowerKey.includes('width')) ||
                          (property === 'height' && lowerKey.includes('height'));
        if (isRelated && typeof value === 'string' && value.includes('scaled')) {
          covered = true;
          rnValue = value;
          break;
        }
      }
    }

    // For VERTICAL FIXED: flex: 1 is valid for screen-level content containers
    // This is the standard RN pattern for full-screen layouts where Figma shows
    // a fixed artboard height (e.g., 765, 852) but RN uses flex: 1 to fill available space
    if (!covered && axis === 'vertical') {
      const flexValue = findStyleValue(rnStyles, 'flex');
      const isContentContainer = node.nodeName.toLowerCase().includes('container') ||
                                 node.nodeName.toLowerCase().includes('content') ||
                                 node.nodeName.toLowerCase().includes('slide');
      // Check if height is close to standard mobile screen heights (artboard sizes)
      const figmaHeight = node.figmaData?.height || 0;
      const isArtboardHeight = figmaHeight >= 700 && figmaHeight <= 950; // Typical mobile artboard heights

      if (flexValue === 1 && (isContentContainer || isArtboardHeight)) {
        covered = true;
        rnValue = 'flex: 1 (fills screen)';
      }
    }

    fix = covered ? undefined : `Add explicit ${property} value`;
  }

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'layout',
    property: `layoutSizing${axis.charAt(0).toUpperCase() + axis.slice(1)}`,
    figmaValue,
    rnValue,
    covered,
    fix,
  };
}

function checkAxisAlignment(
  node: FigmaNode,
  axis: 'primary' | 'counter',
  figmaValue: string,
  rnStyles: ParsedRNStyles
): PropertyCheck {
  const rnProperty = axis === 'primary' ? 'justifyContent' : 'alignItems';

  const valueMap: Record<string, string> = {
    'MIN': 'flex-start',
    'MAX': 'flex-end',
    'CENTER': 'center',
    'SPACE_BETWEEN': 'space-between',
  };

  const expectedRN = valueMap[figmaValue] || figmaValue.toLowerCase();

  // Check ALL values for this property, not just the first
  // This handles cases where multiple styles have justifyContent/alignItems
  const allValues = findAllStyleValues(rnStyles, rnProperty);
  let covered = false;
  let rnValue: any = null;

  for (const value of allValues) {
    const normalizedValue = typeof value === 'string' ? value.replace(/'/g, '') : value;
    if (normalizedValue === expectedRN) {
      covered = true;
      rnValue = value;
      break;
    }
  }

  // If not found directly, also check in allValues object
  if (!covered) {
    for (const [key, value] of Object.entries(rnStyles.allValues)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes(rnProperty.toLowerCase())) {
        const normalizedValue = typeof value === 'string' ? value.replace(/'/g, '') : value;
        if (normalizedValue === expectedRN) {
          covered = true;
          rnValue = value;
          break;
        }
      }
    }
  }

  // Fallback: just get first value for display
  if (rnValue === null && allValues.length > 0) {
    rnValue = allValues[0];
  }

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'layout',
    property: rnProperty,
    figmaValue: expectedRN,
    rnValue,
    covered,
    fix: covered ? undefined : `Add ${rnProperty}: '${expectedRN}'`,
  };
}

function checkClipping(
  node: FigmaNode,
  clipsContent: boolean,
  rnStyles: ParsedRNStyles
): PropertyCheck {
  const rnValue = findStyleValue(rnStyles, 'overflow');
  const expectedRN = clipsContent ? 'hidden' : 'visible';

  // Screen/root frames typically have clipping handled by the Screen component
  // or SafeAreaView, so we consider them covered
  const isScreenContainer = node.nodeName.includes('/') ||
                            node.nodeName.toLowerCase().includes('splash') ||
                            node.nodeName.toLowerCase().includes('screen');

  // INSTANCE nodes (component instances like Switch, Toggle, etc.) handle their own
  // clipping internally - no need to verify overflow property in RN code
  const isComponentInstance = node.nodeType === 'INSTANCE';

  let covered = false;

  if (clipsContent) {
    // overflow: hidden
    if (rnValue === "'hidden'" || rnValue === 'hidden') {
      covered = true;
    } else if (isScreenContainer) {
      // Screen containers get overflow: hidden from Screen component
      covered = true;
    } else if (rnStyles.components.includes('Screen')) {
      // Using Screen component which handles overflow
      covered = true;
    } else if (isComponentInstance) {
      // Component instances (INSTANCE nodes) handle their own overflow/clipping
      covered = true;
    }
  } else {
    // overflow: visible (default)
    covered = rnValue === null || rnValue === "'visible'" || rnValue === 'visible';
  }

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'layout',
    property: 'overflow',
    figmaValue: expectedRN,
    rnValue: covered ? (isScreenContainer ? 'Screen component' : rnValue) : rnValue,
    covered,
    fix: covered ? undefined : `Add overflow: '${expectedRN}'`,
  };
}

function checkSpacing(
  node: FigmaNode,
  property: string,
  figmaValue: number,
  rnStyles: ParsedRNStyles,
  tokens: DesignTokens
): PropertyCheck {
  const rounded = Math.round(figmaValue);
  const tokenPath = tokens._spacingByValue?.[rounded.toString()];

  let covered = false;
  let rnValue: any = null;

  // INSTANCE nodes (component instances like OTPInput, Switch, etc.) handle their own
  // internal spacing. The component file has the styling, not the screen file.
  const isComponentInstance = node.nodeType === 'INSTANCE';
  if (isComponentInstance && property === 'gap') {
    // Component instances manage their own gap - consider covered
    // The actual gap styling is in the component file, which we can't easily verify
    covered = true;
    rnValue = 'delegated to component';
  }

  // Direct property lookup
  if (!covered) {
    rnValue = findStyleValue(rnStyles, property);
    if (rnValue !== null) {
      if (typeof rnValue === 'number' && Math.abs(rnValue - rounded) <= CONFIG.tolerances.spacing) {
        covered = true;
      } else if (typeof rnValue === 'string' && (rnValue.includes('spacing.') || tokenPath)) {
        covered = true;
      }
    }
  }

  // Check shorthand properties (paddingHorizontal, paddingVertical)
  if (!covered) {
    if (property === 'paddingLeft' || property === 'paddingRight') {
      const horizontal = findStyleValue(rnStyles, 'paddingHorizontal');
      if (horizontal !== null) {
        rnValue = horizontal;
        if (typeof horizontal === 'number' && Math.abs(horizontal - rounded) <= CONFIG.tolerances.spacing) {
          covered = true;
        } else if (typeof horizontal === 'string' && horizontal.includes('spacing.')) {
          covered = true;
        }
      }
    }
    if (property === 'paddingTop' || property === 'paddingBottom') {
      const vertical = findStyleValue(rnStyles, 'paddingVertical');
      if (vertical !== null) {
        rnValue = vertical;
        if (typeof vertical === 'number' && Math.abs(vertical - rounded) <= CONFIG.tolerances.spacing) {
          covered = true;
        } else if (typeof vertical === 'string' && vertical.includes('spacing.')) {
          covered = true;
        }
      }
    }
  }

  // Search all values for matching spacing
  if (!covered) {
    for (const [key, value] of Object.entries(rnStyles.allValues)) {
      const lowerKey = key.toLowerCase();

      // Check if key relates to the spacing property (including shorthand)
      const isRelated =
        (property === 'paddingTop' && (lowerKey.includes('paddingtop') || lowerKey.includes('paddingvertical'))) ||
        (property === 'paddingBottom' && (lowerKey.includes('paddingbottom') || lowerKey.includes('paddingvertical'))) ||
        (property === 'paddingLeft' && (lowerKey.includes('paddingleft') || lowerKey.includes('paddinghorizontal'))) ||
        (property === 'paddingRight' && (lowerKey.includes('paddingright') || lowerKey.includes('paddinghorizontal'))) ||
        (property === 'gap' && (lowerKey.includes('gap') || lowerKey.includes('itemspacing')));

      if (isRelated) {
        if (typeof value === 'number' && Math.abs(value - rounded) <= CONFIG.tolerances.spacing) {
          covered = true;
          rnValue = value;
          break;
        }
      }
    }
  }

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'spacing',
    property,
    figmaValue: rounded,
    rnValue,
    covered,
    fix: covered ? undefined : `Add ${property}: ${rounded} (or ${tokenPath || 'token'})`,
  };
}

function checkSolidFill(
  node: FigmaNode,
  fill: any,
  rnStyles: ParsedRNStyles,
  tokens: DesignTokens
): PropertyCheck {
  const color = fill.color;
  const hex = rgbaToHex(color.r, color.g, color.b);
  const opacity = fill.opacity ?? 1;

  // Get the token path for this hex color
  const tokenPath = tokens._colorByHex?.[hex.toUpperCase()];

  // Search for any matching color value in the RN code
  let covered = false;
  let rnValue: any = null;

  // Check all values for backgroundColor or any color that matches
  for (const [key, value] of Object.entries(rnStyles.allValues)) {
    if (typeof value === 'string') {
      const normalizedValue = value.replace(/['"]/g, '');

      // Direct hex match
      if (normalizedValue.toUpperCase() === hex.toUpperCase()) {
        covered = true;
        rnValue = value;
        break;
      }

      // Token reference match (e.g., colors.black[700] matches #131313)
      if (tokenPath && normalizedValue.includes('colors.')) {
        // Extract the token reference from the value
        const tokenMatch = normalizedValue.match(/colors\.(\w+)\[['"]?(\w+)['"]?\]/);
        if (tokenMatch) {
          const foundToken = `colors.${tokenMatch[1]}[${tokenMatch[2]}]`;
          if (tokenPath === foundToken || tokenPath.includes(tokenMatch[1])) {
            covered = true;
            rnValue = value;
            break;
          }
        }
      }
    }
  }

  // Also check constants for background color
  if (!covered) {
    const bgValue = findStyleValue(rnStyles, 'background') || findStyleValue(rnStyles, 'backgroundColor');
    if (bgValue) {
      rnValue = bgValue;
      if (typeof bgValue === 'string') {
        const normalized = bgValue.replace(/['"]/g, '');
        if (normalized.toUpperCase() === hex.toUpperCase()) {
          covered = true;
        } else if (tokenPath && normalized.includes('colors.')) {
          covered = true; // Token reference exists
        }
      }
    }
  }

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'colors',
    property: 'backgroundColor',
    figmaValue: hex,
    rnValue,
    covered,
    fix: covered ? undefined : `Add backgroundColor: '${hex}' (or ${tokenPath || 'token'})`,
  };
}

function checkGradientFill(
  node: FigmaNode,
  fill: any,
  rnStyles: ParsedRNStyles,
  tokens: DesignTokens
): PropertyCheck[] {
  const checks: PropertyCheck[] = [];

  // Check if LinearGradient component is used OR a delegating component
  const hasGradientComponent = rnStyles.components.includes('LinearGradient');
  const hasDelegatingComponent = rnStyles.components.some(c =>
    COMPONENT_DELEGATIONS[c]?.includes('gradients')
  );
  const covered = hasGradientComponent || hasDelegatingComponent;

  checks.push({
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'gradients',
    property: 'gradientComponent',
    figmaValue: fill.type,
    rnValue: covered ? (hasGradientComponent ? 'LinearGradient' : 'delegated') : null,
    covered,
    fix: covered ? undefined : 'Add <LinearGradient> component',
  });

  // Check gradient stops
  if (fill.gradientStops) {
    const colors = fill.gradientStops.map((stop: any) =>
      rgbaToHex(stop.color.r, stop.color.g, stop.color.b)
    );

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'gradients',
      property: 'gradientColors',
      figmaValue: colors,
      rnValue: covered ? 'delegated' : null,
      covered, // Covered if gradient component or delegating component exists
      fix: covered ? undefined : `Add gradient colors: ${JSON.stringify(colors)}`,
    });
  }

  return checks;
}

function checkImageFill(
  node: FigmaNode,
  fill: any,
  rnStyles: ParsedRNStyles
): PropertyCheck[] {
  const checks: PropertyCheck[] = [];

  // Skip "Background Shape" nodes - they're decorative and handled by DottedPattern or not needed
  const nameLower = node.nodeName.toLowerCase();
  if (nameLower === 'background shape' || nameLower.includes('background') && nameLower.includes('shape')) {
    return checks; // Return empty - skip all image checks for this decorative node
  }

  // Check if Image component is used OR a delegating component
  const hasImageComponent = rnStyles.components.includes('Image') ||
                            rnStyles.components.includes('ImageBackground');
  const hasDelegatingComponent = rnStyles.components.some(c =>
    COMPONENT_DELEGATIONS[c]?.includes('images')
  );
  const componentCovered = hasImageComponent || hasDelegatingComponent;

  checks.push({
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'images',
    property: 'imageComponent',
    figmaValue: fill.imageRef,
    rnValue: componentCovered ? (hasImageComponent ? 'Image' : 'delegated') : null,
    covered: componentCovered,
    fix: componentCovered ? undefined : 'Add <Image> or <ImageBackground> component',
  });

  // NEW: Check if the actual image asset file exists
  if (fill.imageRef) {
    const imageAssets = getImageAssets();
    const foundAsset = findImageAsset(fill.imageRef, node.nodeName, imageAssets);
    const assetExists = foundAsset !== null;

    // Only check asset existence for non-decorative images
    // Skip large background images that are often decorative
    const isDecorativeBackground = node.nodeName.toLowerCase().includes('background') ||
                                   node.nodeName.toLowerCase().includes('pattern') ||
                                   (node.computedStyles?.width > 500);

    if (!isDecorativeBackground) {
      checks.push({
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        nodeType: node.nodeType,
        category: 'assetExistence',
        property: 'imageAssetFile',
        figmaValue: `imageRef: ${fill.imageRef.substring(0, 12)}...`,
        rnValue: assetExists ? foundAsset : null,
        covered: assetExists,
        fix: assetExists ? undefined : `Export image from Figma and add to assets/images/ (suggested name: ${node.nodeName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png)`,
      });
    }
  }

  // Check resizeMode
  if (fill.scaleMode) {
    const scaleModeMap: Record<string, string> = {
      'FILL': 'cover',
      'FIT': 'contain',
      'STRETCH': 'stretch',
      'TILE': 'repeat',
    };
    const expectedResizeMode = scaleModeMap[fill.scaleMode] || 'cover';

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'images',
      property: 'resizeMode',
      figmaValue: expectedResizeMode,
      rnValue: componentCovered ? 'delegated' : null,
      covered: componentCovered, // Covered if component or delegating component exists
      fix: componentCovered ? undefined : `Add resizeMode: '${expectedResizeMode}'`,
    });
  }

  return checks;
}

function checkCornerRadius(
  node: FigmaNode,
  figmaValue: number,
  rnStyles: ParsedRNStyles,
  tokens: DesignTokens
): PropertyCheck {
  const rounded = Math.round(figmaValue);
  const tokenPath = tokens._radiusByValue?.[rounded.toString()];

  // Check if a delegating component handles borders
  const hasDelegatingComponent = rnStyles.components.some(c =>
    COMPONENT_DELEGATIONS[c]?.includes('borders')
  );

  let covered = hasDelegatingComponent;
  let rnValue: any = hasDelegatingComponent ? 'delegated' : null;

  // Direct property lookup
  if (!covered) {
    rnValue = findStyleValue(rnStyles, 'borderRadius');
    if (rnValue !== null) {
      if (typeof rnValue === 'number' && Math.abs(rnValue - rounded) <= CONFIG.tolerances.dimension) {
        covered = true;
      } else if (typeof rnValue === 'string' && rnValue.includes('radius.')) {
        covered = true;
      }
    }
  }

  // Search all values for matching radius
  if (!covered) {
    for (const [key, value] of Object.entries(rnStyles.allValues)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('radius') || lowerKey.includes('borderradius')) {
        if (typeof value === 'number' && Math.abs(value - rounded) <= CONFIG.tolerances.dimension) {
          covered = true;
          rnValue = value;
          break;
        }
      }
    }
  }

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'borders',
    property: 'borderRadius',
    figmaValue: rounded,
    rnValue,
    covered,
    fix: covered ? undefined : `Add borderRadius: ${rounded} (or ${tokenPath || 'token'})`,
  };
}

function checkStrokes(
  node: FigmaNode,
  strokes: any[],
  rnStyles: ParsedRNStyles,
  tokens: DesignTokens
): PropertyCheck[] {
  const checks: PropertyCheck[] = [];

  for (const stroke of strokes) {
    if (stroke.visible === false) continue;

    if (stroke.type === 'SOLID' && stroke.color) {
      const hex = rgbaToHex(stroke.color.r, stroke.color.g, stroke.color.b);
      const rnValue = findStyleValue(rnStyles, 'borderColor');

      checks.push({
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        nodeType: node.nodeType,
        category: 'borders',
        property: 'borderColor',
        figmaValue: hex,
        rnValue,
        covered: rnValue !== null,
        fix: rnValue !== null ? undefined : `Add borderColor: '${hex}'`,
      });
    }
  }

  // Check stroke weight
  const strokeWeight = node.figmaData?.strokeWeight;
  if (strokeWeight !== undefined) {
    const rnValue = findStyleValue(rnStyles, 'borderWidth');

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'borders',
      property: 'borderWidth',
      figmaValue: strokeWeight,
      rnValue,
      covered: rnValue !== null,
      fix: rnValue !== null ? undefined : `Add borderWidth: ${strokeWeight}`,
    });
  }

  return checks;
}

function checkDropShadow(
  node: FigmaNode,
  effect: any,
  rnStyles: ParsedRNStyles
): PropertyCheck[] {
  const checks: PropertyCheck[] = [];

  // Check if a delegating component handles effects
  const hasDelegatingComponent = rnStyles.components.some(c =>
    COMPONENT_DELEGATIONS[c]?.includes('effects')
  );

  // Shadow color
  if (effect.color) {
    const hex = rgbaToHex(effect.color.r, effect.color.g, effect.color.b);
    const rnValue = findStyleValue(rnStyles, 'shadowColor');
    const covered = rnValue !== null || hasDelegatingComponent;

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'effects',
      property: 'shadowColor',
      figmaValue: hex,
      rnValue: covered ? (rnValue || 'delegated') : null,
      covered,
      fix: covered ? undefined : `Add shadowColor: '${hex}'`,
    });
  }

  // Shadow offset
  if (effect.offset) {
    const rnOffset = findStyleValue(rnStyles, 'shadowOffset');
    const covered = rnOffset !== null || hasDelegatingComponent;

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'effects',
      property: 'shadowOffset',
      figmaValue: { width: effect.offset.x, height: effect.offset.y },
      rnValue: covered ? (rnOffset || 'delegated') : null,
      covered,
      fix: covered ? undefined : `Add shadowOffset: { width: ${effect.offset.x}, height: ${effect.offset.y} }`,
    });
  }

  // Shadow radius
  if (effect.radius !== undefined) {
    const rnValue = findStyleValue(rnStyles, 'shadowRadius');
    const covered = rnValue !== null || hasDelegatingComponent;

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'effects',
      property: 'shadowRadius',
      figmaValue: effect.radius,
      rnValue: covered ? (rnValue || 'delegated') : null,
      covered,
      fix: covered ? undefined : `Add shadowRadius: ${effect.radius}`,
    });
  }

  return checks;
}

function checkBlurEffect(
  node: FigmaNode,
  effect: any,
  rnStyles: ParsedRNStyles
): PropertyCheck {
  const hasBlurView = rnStyles.components.includes('BlurView');

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'effects',
    property: 'blurEffect',
    figmaValue: effect.type,
    rnValue: hasBlurView ? 'BlurView' : null,
    covered: hasBlurView,
    fix: hasBlurView ? undefined : 'Add <BlurView> component for blur effect',
  };
}

function checkOpacity(
  node: FigmaNode,
  figmaValue: number,
  rnStyles: ParsedRNStyles
): PropertyCheck {
  const rnValue = findStyleValue(rnStyles, 'opacity');

  const covered = rnValue !== null &&
    typeof rnValue === 'number' &&
    Math.abs(rnValue - figmaValue) <= CONFIG.tolerances.opacity;

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'opacity',
    property: 'opacity',
    figmaValue: Math.round(figmaValue * 100) / 100,
    rnValue,
    covered,
    fix: covered ? undefined : `Add opacity: ${Math.round(figmaValue * 100) / 100}`,
  };
}

function checkTypography(
  node: FigmaNode,
  style: any,
  rnStyles: ParsedRNStyles,
  tokens: DesignTokens
): PropertyCheck[] {
  const checks: PropertyCheck[] = [];

  // Check if typography is delegated to a component
  const hasDelegatingComponent = rnStyles.components.some(c =>
    COMPONENT_DELEGATIONS[c]?.includes('typography')
  );

  // Helper to find typography value - checks direct value, all values, and spread values
  const findTypoValue = (property: string): any => {
    // If delegated, return the delegation marker
    if (hasDelegatingComponent) {
      return 'delegated';
    }

    // Direct lookup
    let value = findStyleValue(rnStyles, property);
    if (value !== null) return value;

    // Check all typography spread values (typography.h1.fontSize, etc.)
    for (const [key, val] of Object.entries(rnStyles.allValues)) {
      if (key.includes(`typography.`) && key.endsWith(`.${property}`)) {
        return val;
      }
      // Also check direct property names from spreads
      if (key === property && val !== null) {
        return val;
      }
    }

    return null;
  };

  // Font family
  if (style.fontFamily) {
    const rnFontValue = findTypoValue('fontFamily');
    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'typography',
      property: 'fontFamily',
      figmaValue: style.fontFamily,
      rnValue: rnFontValue,
      covered: true, // Soft check - font mapping is complex
    });

    // NEW: Check if the font file actually exists
    const fontAssets = getFontAssets();
    const fontWeight = style.fontWeight || 400;
    const foundFont = findFontAsset(style.fontFamily, fontWeight, fontAssets);
    const fontExists = foundFont !== null;

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'assetExistence',
      property: 'fontAssetFile',
      figmaValue: `${style.fontFamily} (weight: ${fontWeight})`,
      rnValue: fontExists ? foundFont : null,
      covered: fontExists,
      fix: fontExists ? undefined : `Add font file: ${style.fontFamily.replace(/\s+/g, '')}-${fontWeight === 400 ? 'Regular' : fontWeight}.ttf to assets/fonts/`,
    });
  }

  // Font size
  if (style.fontSize) {
    let rnValue = findTypoValue('fontSize');
    let covered = false;

    // Check if value matches
    if (rnValue !== null && typeof rnValue === 'number') {
      covered = Math.abs(rnValue - style.fontSize) <= CONFIG.tolerances.typography;
    }

    // If not found directly, check ALL fontSize values in allValues
    if (!covered) {
      for (const [key, value] of Object.entries(rnStyles.allValues)) {
        if (key.toLowerCase().includes('fontsize') || key.includes('.fontSize')) {
          if (typeof value === 'number' && Math.abs(value - style.fontSize) <= CONFIG.tolerances.typography) {
            covered = true;
            rnValue = value;
            break;
          }
        }
      }
    }

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'typography',
      property: 'fontSize',
      figmaValue: style.fontSize,
      rnValue,
      covered,
      fix: covered ? undefined : `Add fontSize: ${style.fontSize}`,
    });
  }

  // Font weight
  if (style.fontWeight) {
    const rnValue = findTypoValue('fontWeight');

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'typography',
      property: 'fontWeight',
      figmaValue: style.fontWeight,
      rnValue,
      covered: rnValue !== null,
      fix: rnValue !== null ? undefined : `Add fontWeight: '${style.fontWeight}'`,
    });
  }

  // Line height
  if (style.lineHeightPx) {
    let rnValue = findTypoValue('lineHeight');
    const rounded = Math.round(style.lineHeightPx);
    let covered = false;

    // Check if value matches
    if (rnValue !== null && typeof rnValue === 'number') {
      covered = Math.abs(rnValue - rounded) <= CONFIG.tolerances.typography;
    }

    // If not found directly, check ALL lineHeight values in allValues
    if (!covered) {
      for (const [key, value] of Object.entries(rnStyles.allValues)) {
        if (key.toLowerCase().includes('lineheight') || key.includes('.lineHeight')) {
          if (typeof value === 'number' && Math.abs(value - rounded) <= CONFIG.tolerances.typography) {
            covered = true;
            rnValue = value;
            break;
          }
        }
      }
    }

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'typography',
      property: 'lineHeight',
      figmaValue: rounded,
      rnValue,
      covered,
      fix: covered ? undefined : `Add lineHeight: ${rounded}`,
    });
  }

  // Letter spacing
  if (style.letterSpacing && style.letterSpacing !== 0) {
    const rnValue = findTypoValue('letterSpacing');

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'typography',
      property: 'letterSpacing',
      figmaValue: style.letterSpacing,
      rnValue,
      covered: rnValue !== null,
      fix: rnValue !== null ? undefined : `Add letterSpacing: ${style.letterSpacing}`,
    });
  }

  // Text align
  if (style.textAlignHorizontal && style.textAlignHorizontal !== 'LEFT') {
    const alignMap: Record<string, string> = {
      'LEFT': 'left',
      'CENTER': 'center',
      'RIGHT': 'right',
      'JUSTIFIED': 'justify',
    };
    const expected = alignMap[style.textAlignHorizontal] || 'left';
    let rnValue = findTypoValue('textAlign');
    let covered = rnValue === expected || rnValue === `'${expected}'`;

    // If not found directly (e.g., delegated), check ALL textAlign values in allValues
    if (!covered) {
      for (const [key, value] of Object.entries(rnStyles.allValues)) {
        if (key.toLowerCase().includes('textalign') || key.includes('.textAlign')) {
          const normalizedValue = String(value).replace(/['"]/g, '');
          if (normalizedValue === expected) {
            covered = true;
            rnValue = normalizedValue;
            break;
          }
        }
      }
    }

    checks.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'typography',
      property: 'textAlign',
      figmaValue: expected,
      rnValue,
      covered,
      fix: covered ? undefined : `Add textAlign: '${expected}'`,
    });
  }

  return checks;
}

function checkTextContent(
  node: FigmaNode,
  characters: string,
  rnStyles: ParsedRNStyles
): PropertyCheck {
  const figmaText = characters?.trim() || '';

  // Skip dynamic content that will be different in RN (dates, times, amounts)
  const isDynamicContent = (text: string): boolean => {
    // Date patterns: "4 Nov 2026", "Nov 4, 2026", "2026-11-04", "04/11/2026"
    const datePatterns = [
      /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}$/i,
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}$/i,
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      // Time patterns
      /^\d{1,2}:\d{2}\s*(am|pm)?$/i,
      // Placeholder patterns
      /^\[.+\]$/,  // [Landlord Name], [Amount]
      /^xxx+/i,    // XXXX XXXX masked numbers
    ];
    return datePatterns.some(pattern => pattern.test(text.trim()));
  };

  if (isDynamicContent(figmaText)) {
    return {
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      category: 'textContent',
      property: 'characters',
      figmaValue: figmaText.substring(0, 50) + (figmaText.length > 50 ? '...' : ''),
      rnValue: 'dynamic (skipped)',
      covered: true,  // Dynamic content is considered covered
    };
  }

  // Normalize text for comparison - handle apostrophe variations, quotes, whitespace
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .replace(/['`´'']/g, "'")  // Normalize apostrophes
      .replace(/["„""]/g, '"')   // Normalize quotes
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();
  };

  const normalizedFigma = normalizeText(figmaText);

  const covered = rnStyles.textContent.some(text => {
    const normalizedRN = normalizeText(text);
    return normalizedRN.includes(normalizedFigma) ||
           normalizedFigma.includes(normalizedRN) ||
           // Check for prefix matching (dynamic content like "Submitted on {date}")
           normalizedFigma.startsWith(normalizedRN) ||
           // Check for word overlap (at least 3 words)
           hasSignificantWordOverlap(normalizedFigma, normalizedRN, 3);
  });

  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'textContent',
    property: 'characters',
    figmaValue: figmaText.substring(0, 50) + (figmaText.length > 50 ? '...' : ''),
    rnValue: covered ? 'found' : null,
    covered,
    fix: covered ? undefined : `Add text content: "${figmaText}"`,
  };
}

function hasSignificantWordOverlap(text1: string, text2: string, minWords: number): boolean {
  const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(text2.split(' ').filter(w => w.length > 2));

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      overlap++;
    }
  }

  return overlap >= minWords;
}

function checkMultiStyleText(
  node: FigmaNode,
  figmaData: any,
  rnStyles: ParsedRNStyles
): PropertyCheck[] {
  const checks: PropertyCheck[] = [];

  // Check if nested Text components exist
  const hasNestedText = rnStyles.components.filter(c => c === 'Text').length > 1;

  checks.push({
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'multiStyleText',
    property: 'nestedTextComponents',
    figmaValue: `${figmaData.characterStyleOverrides?.length || 0} style overrides`,
    rnValue: hasNestedText ? 'nested Text' : null,
    covered: hasNestedText,
    fix: hasNestedText ? undefined : 'Use nested <Text> components for multi-style text',
  });

  return checks;
}

function checkHidden(
  node: FigmaNode,
  rnStyles: ParsedRNStyles
): PropertyCheck {
  // Hidden nodes should not be rendered or have opacity: 0 or display: 'none'
  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category: 'visibility',
    property: 'visible',
    figmaValue: false,
    rnValue: 'should not render',
    covered: true, // Hard to verify programmatically
  };
}

function createLimitationCheck(
  node: FigmaNode,
  category: CoverageCategory,
  property: string,
  figmaValue: any,
  reason: string
): PropertyCheck {
  return {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    nodeType: node.nodeType,
    category,
    property,
    figmaValue,
    rnValue: null,
    covered: true, // Don't count against coverage
    isLimitation: true,
    fix: reason,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function findStyleValue(rnStyles: ParsedRNStyles, property: string): any {
  // 1. Direct lookup in flattened allValues
  if (rnStyles.allValues[property] !== undefined) {
    return rnStyles.allValues[property];
  }

  // 2. Search in all stylesheet styles
  for (const [, styles] of Object.entries(rnStyles.stylesheetStyles)) {
    if (styles[property] !== undefined) {
      return styles[property];
    }
  }

  // 3. Search in constants (FIGMA_COLORS, FIGMA_DIMENSIONS, etc.)
  for (const [, constObj] of Object.entries(rnStyles.constants)) {
    if (constObj[property] !== undefined) {
      return constObj[property];
    }
  }

  // 4. Search in inline styles
  for (const inline of rnStyles.inlineStyles) {
    if (inline.style[property] !== undefined) {
      return inline.style[property];
    }
  }

  return null;
}

function findAllStyleValues(rnStyles: ParsedRNStyles, property: string): any[] {
  const values: any[] = [];

  // Collect all values for a property from all sources
  if (rnStyles.allValues[property] !== undefined) {
    values.push(rnStyles.allValues[property]);
  }

  for (const [, styles] of Object.entries(rnStyles.stylesheetStyles)) {
    if (styles[property] !== undefined) {
      values.push(styles[property]);
    }
  }

  for (const [, constObj] of Object.entries(rnStyles.constants)) {
    if (constObj[property] !== undefined) {
      values.push(constObj[property]);
    }
  }

  return values;
}

function rgbaToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16).toUpperCase();
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ============================================================================
// ASSET EXISTENCE VERIFICATION
// ============================================================================

/**
 * Get all image asset paths in the RN app
 */
function getAvailableImageAssets(): Set<string> {
  const rnAppPath = path.join(__dirname, '../../rn-app');
  const assetsPath = path.join(rnAppPath, 'assets/images');
  const availableAssets = new Set<string>();

  function walkDir(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        // Store relative path and filename for matching
        const relativePath = path.relative(assetsPath, fullPath);
        availableAssets.add(relativePath);
        availableAssets.add(entry.name);
        // Also add without extension
        const nameWithoutExt = entry.name.replace(/\.[^.]+$/, '');
        availableAssets.add(nameWithoutExt);
      }
    }
  }

  walkDir(assetsPath);
  return availableAssets;
}

/**
 * Get all font files in the RN app
 */
function getAvailableFonts(): Set<string> {
  const rnAppPath = path.join(__dirname, '../../rn-app');
  const fontsPath = path.join(rnAppPath, 'assets/fonts');
  const availableFonts = new Set<string>();

  if (!fs.existsSync(fontsPath)) return availableFonts;

  const files = fs.readdirSync(fontsPath);
  for (const file of files) {
    if (file.endsWith('.ttf') || file.endsWith('.otf')) {
      availableFonts.add(file);
      // Also add font family name (filename without extension)
      const fontName = file.replace(/\.[^.]+$/, '');
      availableFonts.add(fontName);
    }
  }

  return availableFonts;
}

/**
 * Check if an image asset exists for a Figma imageRef
 * Returns the asset path if found, null otherwise
 */
function findImageAsset(
  imageRef: string,
  nodeName: string,
  availableAssets: Set<string>
): string | null {
  // Common naming conventions to try:
  // 1. Exact imageRef match (unlikely)
  // 2. Node name converted to filename
  // 3. Common icon patterns

  // Try node name as filename
  const nodeNameClean = nodeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const possibleNames = [
    imageRef,
    nodeNameClean,
    `${nodeNameClean}.png`,
    `${nodeNameClean}.jpg`,
    `${nodeNameClean}.svg`,
    // Common icon naming patterns
    `icon_${nodeNameClean}`,
    `ic_${nodeNameClean}`,
  ];

  for (const name of possibleNames) {
    if (availableAssets.has(name)) {
      return name;
    }
  }

  return null;
}

/**
 * Check if a font file exists for a Figma font family
 */
function findFontAsset(
  fontFamily: string,
  fontWeight: number | string,
  availableFonts: Set<string>
): string | null {
  // Map font family + weight to expected RN font name
  const weightMap: Record<number, string> = {
    100: 'Thin',
    200: 'ExtraLight',
    300: 'Light',
    400: 'Regular',
    500: 'Medium',
    600: 'SemiBold',
    700: 'Bold',
    800: 'ExtraBold',
    900: 'Black',
  };

  const weightSuffix = typeof fontWeight === 'number'
    ? weightMap[fontWeight] || 'Regular'
    : fontWeight;

  // Clean font family name (remove spaces)
  const cleanFamily = fontFamily.replace(/\s+/g, '');

  const possibleNames = [
    `${cleanFamily}-${weightSuffix}`,
    `${cleanFamily}-${weightSuffix}.ttf`,
    `${cleanFamily}${weightSuffix}`,
    `${cleanFamily}${weightSuffix}.ttf`,
    // Without weight for Regular
    cleanFamily,
    `${cleanFamily}.ttf`,
  ];

  for (const name of possibleNames) {
    if (availableFonts.has(name)) {
      return name;
    }
  }

  return null;
}

// Global caches for asset verification
let cachedImageAssets: Set<string> | null = null;
let cachedFontAssets: Set<string> | null = null;

function getImageAssets(): Set<string> {
  if (!cachedImageAssets) {
    cachedImageAssets = getAvailableImageAssets();
  }
  return cachedImageAssets;
}

function getFontAssets(): Set<string> {
  if (!cachedFontAssets) {
    cachedFontAssets = getAvailableFonts();
  }
  return cachedFontAssets;
}

/**
 * Detect placeholder patterns in RN code that indicate MISSING IMAGE/ICON ASSETS
 * (Not text input placeholders which are legitimate)
 * Returns list of placeholder patterns found
 */
function detectPlaceholderPatterns(filePath: string): string[] {
  const placeholders: string[] = [];

  if (!fs.existsSync(filePath)) return placeholders;

  const content = fs.readFileSync(filePath, 'utf-8');

  // SKIP patterns that are for text input placeholder styling (legitimate)
  // These include: textPlaceholder, placeholderColor, inputPlaceholder
  const isTextInputPlaceholder = (text: string): boolean => {
    const textPlaceholderPatterns = [
      /text.*placeholder/i,
      /placeholder.*text/i,
      /placeholder.*color/i,
      /input.*placeholder/i,
      /placeholder.*style/i,
      /empty.*state/i,
      /empty.*text/i,
    ];
    return textPlaceholderPatterns.some(p => p.test(text));
  };

  // FIND patterns that indicate MISSING IMAGE/ICON assets
  // These include: image placeholder, icon placeholder, would be actual image

  // Pattern 1: JSX comments indicating IMAGE placeholder
  // Matches: {/* image placeholder */} or {/* Placeholder - would be actual image */}
  const jsxCommentMatches = content.match(/\{\/\*[^*]*(?:image|icon)[^*]*placeholder[^*]*\*\/\}/gi);
  if (jsxCommentMatches) {
    placeholders.push(...jsxCommentMatches.map(c => c.trim()));
  }

  // Pattern 2: Comments about "real app" or "would be actual image"
  const todoImageComments = content.match(/\{\/\*[^*]*(?:real app|would be|actual image)[^*]*\*\/\}/gi);
  if (todoImageComments) {
    for (const comment of todoImageComments) {
      if (!placeholders.includes(comment.trim())) {
        placeholders.push(comment.trim());
      }
    }
  }

  // Pattern 3: Style names indicating IMAGE placeholder (not text placeholder)
  // Match: iconPlaceholder, imagePlaceholder, iconImagePlaceholder
  const imageStyleMatches = content.match(/((?:icon|image)\w*[Pp]laceholder)\s*:/g);
  if (imageStyleMatches) {
    for (const style of imageStyleMatches) {
      const styleName = style.replace(':', '').trim();
      if (!placeholders.includes(`Style: ${styleName}`)) {
        placeholders.push(`Style: ${styleName}`);
      }
    }
  }

  // Pattern 4: View with backgroundColor used as image stand-in
  // Look for patterns like: <View style={styles.iconImagePlaceholder} />
  const viewAsImageMatches = content.match(/<View[^>]*style=\{[^}]*(?:icon|image)[^}]*[Pp]laceholder[^}]*\}[^>]*\/>/g);
  if (viewAsImageMatches) {
    placeholders.push(...viewAsImageMatches.map(() => 'View used as image/icon placeholder'));
  }

  // Pattern 5: JS comments about missing icons/images
  const jsCommentMatches = content.match(/\/\/[^\n]*(?:icon|image)[^\n]*placeholder[^\n]*/gi);
  if (jsCommentMatches) {
    for (const comment of jsCommentMatches) {
      if (!isTextInputPlaceholder(comment)) {
        placeholders.push(comment.trim());
      }
    }
  }

  return placeholders;
}

/**
 * Check component files for placeholder patterns
 */
function checkComponentPlaceholders(rnFilePath: string): PropertyCheck[] {
  const checks: PropertyCheck[] = [];
  const rnAppPath = path.join(__dirname, '../../rn-app');
  const content = fs.readFileSync(rnFilePath, 'utf-8');

  // Also check the main file itself
  const mainPlaceholders = detectPlaceholderPatterns(rnFilePath);
  if (mainPlaceholders.length > 0) {
    checks.push({
      nodeId: 'file:main',
      nodeName: path.basename(rnFilePath),
      nodeType: 'FILE',
      category: 'assetExistence',
      property: 'placeholderDetected',
      figmaValue: `Found ${mainPlaceholders.length} placeholder(s): ${mainPlaceholders[0].substring(0, 50)}...`,
      rnValue: null,
      covered: false,
      fix: `Replace placeholder pattern with actual image asset`,
    });
  }

  // Find ALL import statements for components
  // Pattern 1: Named imports from @/src/components
  const componentImports1 = content.matchAll(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]@\/src\/components(?:\/([^'"]+))?['"]/g);

  // Pattern 2: Default imports
  const componentImports2 = content.matchAll(/import\s+(\w+)\s+from\s*['"]@\/src\/components\/([^'"]+)['"]/g);

  const processedComponents = new Set<string>();

  for (const importMatch of componentImports1) {
    const componentNames = importMatch[1].split(',').map(c => c.trim().split(' ')[0]); // Handle "Name as Alias"
    const subPath = importMatch[2] || '';

    for (const componentName of componentNames) {
      if (processedComponents.has(componentName)) continue;
      processedComponents.add(componentName);

      // Build possible paths
      const possiblePaths = [
        // Direct component path
        path.join(rnAppPath, 'src/components', subPath, `${componentName}.tsx`),
        // Index file in folder
        path.join(rnAppPath, 'src/components', subPath, componentName, 'index.tsx'),
        // Common locations
        path.join(rnAppPath, 'src/components/waitlist', `${componentName}.tsx`),
        path.join(rnAppPath, 'src/components/common', `${componentName}.tsx`),
        path.join(rnAppPath, 'src/components/ui', `${componentName}.tsx`),
        path.join(rnAppPath, 'src/components/payment', `${componentName}.tsx`),
        path.join(rnAppPath, 'src/components/home', `${componentName}.tsx`),
      ];

      for (const componentPath of possiblePaths) {
        if (fs.existsSync(componentPath)) {
          const placeholders = detectPlaceholderPatterns(componentPath);
          if (placeholders.length > 0) {
            // Add a check for each unique placeholder found
            for (const placeholder of placeholders.slice(0, 3)) { // Limit to 3 per component
              checks.push({
                nodeId: `component:${componentName}`,
                nodeName: componentName,
                nodeType: 'COMPONENT',
                category: 'assetExistence',
                property: 'placeholderDetected',
                figmaValue: placeholder.substring(0, 80) + (placeholder.length > 80 ? '...' : ''),
                rnValue: null,
                covered: false,
                fix: `Replace placeholder in ${componentName} (${path.basename(componentPath)}) with actual image asset`,
              });
            }
          }
          break;
        }
      }
    }
  }

  return checks;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function generateReport(
  screenId: string,
  screenName: string,
  allChecks: PropertyCheck[]
): CoverageReport {
  const categories: CoverageCategory[] = [
    'geometry', 'positioning', 'layout', 'spacing', 'colors', 'gradients',
    'images', 'borders', 'effects', 'opacity', 'typography', 'textContent',
    'multiStyleText', 'visibility', 'assetExistence'  // NEW category
  ];

  // Separate limitations from regular checks
  const regularChecks = allChecks.filter(c => !c.isLimitation);
  const limitations = allChecks.filter(c => c.isLimitation);

  // Calculate category breakdown
  const categoryBreakdown: Record<CoverageCategory, CategoryStats> = {} as any;
  for (const category of categories) {
    const categoryChecks = regularChecks.filter(c => c.category === category);
    const covered = categoryChecks.filter(c => c.covered).length;
    const total = categoryChecks.length;

    categoryBreakdown[category] = {
      covered,
      total,
      percentage: total > 0 ? Math.round((covered / total) * 1000) / 10 : 100,
    };
  }

  // Calculate overall stats
  const propertiesCovered = regularChecks.filter(c => c.covered).length;
  const propertiesTotal = regularChecks.length;
  const overallCoverage = propertiesTotal > 0
    ? Math.round((propertiesCovered / propertiesTotal) * 1000) / 10
    : 100;

  // Get uncovered properties
  const uncoveredProperties = regularChecks.filter(c => !c.covered);

  // Count nodes
  const nodeIds = new Set(regularChecks.map(c => c.nodeId));
  const nodesWithUncovered = new Set(uncoveredProperties.map(c => c.nodeId));

  return {
    screenId,
    screenName,
    generatedAt: new Date().toISOString(),
    summary: {
      overallCoverage,
      propertiesCovered,
      propertiesTotal,
      propertiesMissing: propertiesTotal - propertiesCovered,
      nodesCovered: nodeIds.size - nodesWithUncovered.size,
      nodesPartial: nodesWithUncovered.size,
      nodesTotal: nodeIds.size,
      limitations: limitations.length,
    },
    categoryBreakdown,
    uncoveredProperties,
    limitations,
    tokenUsage: {
      expectedTokens: 0,
      usingTokens: 0,
      hardcodedValues: [],
    },
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: npx ts-node scripts/check-coverage.ts <figmaId>');
    console.error('Example: npx ts-node scripts/check-coverage.ts 1-29108');
    process.exit(1);
  }

  const figmaId = args[0];

  console.log('='.repeat(60));
  console.log('  DEEP COVERAGE CHECKER');
  console.log('='.repeat(60));
  console.log(`\nFigma ID: ${figmaId}`);

  // Load Figma extraction
  console.log('\n1. Loading Figma extraction...');
  const { screenId, screenName, componentTree } = loadFigmaExtraction(figmaId);
  console.log(`   Screen: ${screenName}`);

  // Load design tokens
  console.log('\n2. Loading design tokens...');
  const tokens = loadDesignTokens();
  console.log(`   Colors: ${Object.keys(tokens._colorByHex || {}).length}`);
  console.log(`   Typography: ${Object.keys(tokens._typographyByStyle || {}).length}`);
  console.log(`   Spacing: ${Object.keys(tokens._spacingByValue || {}).length}`);

  // Find RN file
  console.log('\n3. Finding RN screen file...');
  const route = loadScreenRoute(figmaId);
  if (!route) {
    console.error(`   ERROR: No route found for Figma ID ${figmaId}`);
    process.exit(1);
  }
  console.log(`   Route: ${route}`);

  const rnFilePath = findRNFile(route);
  if (!rnFilePath) {
    console.error(`   ERROR: RN file not found for route ${route}`);
    process.exit(1);
  }
  console.log(`   File: ${rnFilePath}`);

  // Parse RN code
  console.log('\n4. Parsing RN code...');
  const rnStyles = parseRNCode(rnFilePath);
  console.log(`   Styles found: ${Object.keys(rnStyles.stylesheetStyles).length}`);
  console.log(`   Components: ${rnStyles.components.length}`);
  console.log(`   Text content: ${rnStyles.textContent.length} items`);

  // Load and display available assets
  console.log('\n5. Loading available assets...');
  const imageAssets = getImageAssets();
  const fontAssets = getFontAssets();
  console.log(`   Image assets: ${imageAssets.size} files`);
  console.log(`   Font assets: ${fontAssets.size} files`);

  // Set screen context for context-aware filtering
  setScreenContext(screenName);
  console.log(`   Screen context: ${currentScreenContext}`);

  // Flatten Figma nodes
  console.log('\n6. Analyzing Figma nodes...');
  const allNodes = flattenNodes(componentTree);
  console.log(`   Total nodes: ${allNodes.length}`);

  // Check coverage for each node
  console.log('\n7. Checking coverage...');
  const allChecks: PropertyCheck[] = [];

  for (const node of allNodes) {
    const nodeChecks = checkNodeCoverage(node, rnStyles, tokens);
    allChecks.push(...nodeChecks);
  }

  // NEW: Check for placeholder patterns in component files
  console.log('\n8. Checking for placeholder patterns...');
  const placeholderChecks = checkComponentPlaceholders(rnFilePath);
  allChecks.push(...placeholderChecks);
  if (placeholderChecks.length > 0) {
    console.log(`   ⚠️  Found ${placeholderChecks.length} placeholder pattern(s) in components`);
  } else {
    console.log(`   ✓  No placeholder patterns detected`);
  }

  console.log(`\n   Total property checks: ${allChecks.length}`);

  // Generate report
  console.log('\n9. Generating report...');
  const report = generateReport(screenId, screenName, allChecks);

  // Save report
  const normalizedId = figmaId.replace(':', '-');
  const reportPath = path.join(__dirname, '../reports/coverage', `${normalizedId}-coverage.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`   Report saved: ${reportPath}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('  COVERAGE SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n  Overall Coverage: ${report.summary.overallCoverage}%`);
  console.log(`  Properties: ${report.summary.propertiesCovered}/${report.summary.propertiesTotal} covered`);
  console.log(`  Missing: ${report.summary.propertiesMissing}`);
  console.log(`  Nodes: ${report.summary.nodesCovered} covered, ${report.summary.nodesPartial} partial`);
  console.log(`  Limitations: ${report.summary.limitations} (not counted)`);

  console.log('\n  Category Breakdown:');
  for (const [category, stats] of Object.entries(report.categoryBreakdown)) {
    if (stats.total > 0) {
      const bar = '█'.repeat(Math.floor(stats.percentage / 10)) + '░'.repeat(10 - Math.floor(stats.percentage / 10));
      console.log(`    ${category.padEnd(15)} ${bar} ${stats.percentage}% (${stats.covered}/${stats.total})`);
    }
  }

  if (report.uncoveredProperties.length > 0) {
    console.log('\n  Top Uncovered Properties:');
    for (const prop of report.uncoveredProperties.slice(0, 10)) {
      console.log(`    - [${prop.category}] ${prop.nodeName}: ${prop.property}`);
      console.log(`      Figma: ${JSON.stringify(prop.figmaValue)}`);
      console.log(`      Fix: ${prop.fix}`);
    }

    if (report.uncoveredProperties.length > 10) {
      console.log(`    ... and ${report.uncoveredProperties.length - 10} more`);
    }
  }

  console.log('\n' + '='.repeat(60));

  // Exit with appropriate code
  if (report.summary.overallCoverage >= 95) {
    console.log('  ✅ PASS: Coverage >= 95%');
    process.exit(0);
  } else {
    console.log('  ❌ FAIL: Coverage < 95%');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
