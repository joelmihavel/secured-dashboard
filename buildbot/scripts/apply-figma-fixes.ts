/**
 * Apply Figma Fixes
 *
 * Reads coverage gaps and applies fixes deterministically from Figma data.
 * NO AI imagination - only Figma extraction values.
 *
 * Usage:
 *   npx ts-node scripts/apply-figma-fixes.ts <screenId>
 *   npx ts-node scripts/apply-figma-fixes.ts 1-31485 --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// PATHS
// ============================================

const PATHS = {
  root: path.join(__dirname, '..'),
  rnApp: path.join(__dirname, '../../rn-app'),
  extractions: path.join(__dirname, '../data/extractions'),
  coverageReports: path.join(__dirname, '../reports/coverage'),
  routesConfig: path.join(__dirname, '../config/screen-routes.json'),
  designTokens: path.join(__dirname, '../config/design-tokens.json'),
};

// ============================================
// TYPES
// ============================================

interface FigmaNode {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  computedStyles: Record<string, any>;
  figmaData: Record<string, any>;
  children?: FigmaNode[];
}

interface EnhancedExtraction {
  screenId: string;
  screenName: string;
  componentTree: FigmaNode;
  flattenedNodes?: FigmaNode[];
}

interface UncoveredProperty {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  category: string;
  property: string;
  figmaValue: any;
  rnValue: any;
  fix?: string;
}

interface CoverageReport {
  screenId: string;
  screenName: string;
  summary: {
    overallCoverage: number;
    propertiesMissing: number;
  };
  uncoveredProperties: UncoveredProperty[];
}

interface RouteConfig {
  route: string;
  screens: Array<{
    figmaId: string;
    name: string;
  }>;
}

interface DesignTokens {
  colors: Record<string, Record<string, string>>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  typography: Record<string, any>;
  _colorByHex?: Record<string, string>;
  _spacingByValue?: Record<string, string>;
  _radiusByValue?: Record<string, string>;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function loadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
  const icons = { info: '📋', warn: '⚠️', error: '❌', success: '✅' };
  console.log(`${icons[level]} ${message}`);
}

// ============================================
// LOAD DATA
// ============================================

function loadExtraction(screenId: string): EnhancedExtraction | null {
  const extractionPath = path.join(PATHS.extractions, screenId, 'enhanced-extraction.json');
  return loadJson<EnhancedExtraction>(extractionPath);
}

function loadCoverageReport(screenId: string): CoverageReport | null {
  const reportPath = path.join(PATHS.coverageReports, `${screenId}-coverage.json`);
  return loadJson<CoverageReport>(reportPath);
}

function loadDesignTokens(): DesignTokens | null {
  return loadJson<DesignTokens>(PATHS.designTokens);
}

function findRouteForScreen(screenId: string): { routeKey: string; route: string } | null {
  const routesConfig = loadJson<{ routes: Record<string, RouteConfig> }>(PATHS.routesConfig);
  if (!routesConfig) return null;

  for (const [routeKey, config] of Object.entries(routesConfig.routes)) {
    for (const screen of config.screens || []) {
      if (screen.figmaId === screenId) {
        return { routeKey, route: config.route };
      }
    }
  }

  return null;
}

function findRnFilePath(route: string): string | null {
  const patterns = [
    path.join(PATHS.rnApp, 'app', route + '.tsx'),
    path.join(PATHS.rnApp, 'app', route, 'index.tsx'),
  ];

  for (const p of patterns) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

// ============================================
// FIX GENERATORS
// ============================================

interface Fix {
  type: 'style' | 'prop' | 'import' | 'component';
  description: string;
  location: string;
  oldCode?: string;
  newCode: string;
  priority: number;
}

function generateStyleFix(uncovered: UncoveredProperty, tokens: DesignTokens | null): Fix | null {
  const { nodeName, property, figmaValue, category } = uncovered;

  // Style name from node name (convert to camelCase)
  const styleName = nodeName
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase());

  let rnProperty = property;
  let rnValue = figmaValue;

  // Convert Figma properties to RN
  switch (property) {
    case 'width':
    case 'height':
      rnValue = Math.round(figmaValue);
      break;

    case 'backgroundColor':
    case 'color':
      // Try to use design token
      if (tokens?._colorByHex && typeof figmaValue === 'string') {
        const tokenPath = tokens._colorByHex[figmaValue.toUpperCase()];
        if (tokenPath) {
          rnValue = `colors.${tokenPath}`;
        } else {
          rnValue = `'${figmaValue}'`;
        }
      } else {
        rnValue = `'${figmaValue}'`;
      }
      break;

    case 'borderRadius':
    case 'cornerRadius':
      rnProperty = 'borderRadius';
      // Try to use design token
      if (tokens?._radiusByValue && figmaValue) {
        const tokenPath = tokens._radiusByValue[String(figmaValue)];
        if (tokenPath) {
          rnValue = `radius.${tokenPath}`;
        } else {
          rnValue = Math.round(figmaValue);
        }
      } else {
        rnValue = Math.round(figmaValue);
      }
      break;

    case 'paddingTop':
    case 'paddingBottom':
    case 'paddingLeft':
    case 'paddingRight':
    case 'gap':
      // Try to use design token
      if (tokens?._spacingByValue && figmaValue) {
        const tokenPath = tokens._spacingByValue[String(figmaValue)];
        if (tokenPath) {
          rnValue = `spacing.${tokenPath}`;
        } else {
          rnValue = Math.round(figmaValue);
        }
      } else {
        rnValue = Math.round(figmaValue);
      }
      break;

    case 'fontSize':
    case 'lineHeight':
    case 'letterSpacing':
      rnValue = typeof figmaValue === 'number' ? Math.round(figmaValue * 100) / 100 : figmaValue;
      break;

    case 'fontWeight':
      // Convert numeric to string
      rnValue = `'${figmaValue}'`;
      break;

    case 'fontFamily':
      // Map Figma font family to RN
      if (typeof figmaValue === 'string') {
        if (figmaValue.includes('Plus Jakarta Sans')) {
          rnValue = `'PlusJakartaSans-Regular'`;
        } else {
          rnValue = `'${figmaValue}'`;
        }
      }
      break;

    case 'textAlign':
      if (figmaValue === 'LEFT') rnValue = `'left'`;
      else if (figmaValue === 'CENTER') rnValue = `'center'`;
      else if (figmaValue === 'RIGHT') rnValue = `'right'`;
      break;

    case 'flexDirection':
      if (figmaValue === 'VERTICAL') rnValue = `'column'`;
      else if (figmaValue === 'HORIZONTAL') rnValue = `'row'`;
      break;

    case 'justifyContent':
      if (figmaValue === 'CENTER') rnValue = `'center'`;
      else if (figmaValue === 'SPACE_BETWEEN') rnValue = `'space-between'`;
      else if (figmaValue === 'MIN') rnValue = `'flex-start'`;
      else if (figmaValue === 'MAX') rnValue = `'flex-end'`;
      break;

    case 'alignItems':
      if (figmaValue === 'CENTER') rnValue = `'center'`;
      else if (figmaValue === 'MIN') rnValue = `'flex-start'`;
      else if (figmaValue === 'MAX') rnValue = `'flex-end'`;
      break;

    default:
      // Pass through as-is
      if (typeof figmaValue === 'string') {
        rnValue = `'${figmaValue}'`;
      }
  }

  return {
    type: 'style',
    description: `Add ${rnProperty}: ${rnValue} to ${styleName} style`,
    location: `styles.${styleName}`,
    newCode: `${rnProperty}: ${rnValue},`,
    priority: getCategoryPriority(category),
  };
}

function getCategoryPriority(category: string): number {
  const priorities: Record<string, number> = {
    geometry: 1,
    layout: 2,
    spacing: 3,
    colors: 4,
    typography: 5,
    borders: 6,
    effects: 7,
    images: 8,
    assetExistence: 9,
  };
  return priorities[category] || 10;
}

// ============================================
// FIX REPORT GENERATOR
// ============================================

interface FixReport {
  screenId: string;
  screenName: string;
  currentCoverage: number;
  targetCoverage: number;
  rnFilePath: string | null;
  totalFixes: number;
  fixesByCategory: Record<string, number>;
  fixes: Fix[];
  figmaConstants: string;
}

function generateFixReport(screenId: string): FixReport | null {
  log(`Generating fix report for ${screenId}`);

  // Load data
  const extraction = loadExtraction(screenId);
  if (!extraction) {
    log(`No extraction found for ${screenId}`, 'error');
    return null;
  }

  const coverageReport = loadCoverageReport(screenId);
  if (!coverageReport) {
    log(`No coverage report found for ${screenId}`, 'error');
    return null;
  }

  const tokens = loadDesignTokens();
  const routeInfo = findRouteForScreen(screenId);
  const rnFilePath = routeInfo ? findRnFilePath(routeInfo.route) : null;

  // Generate fixes
  const fixes: Fix[] = [];
  const fixesByCategory: Record<string, number> = {};

  for (const uncovered of coverageReport.uncoveredProperties) {
    fixesByCategory[uncovered.category] = (fixesByCategory[uncovered.category] || 0) + 1;

    const fix = generateStyleFix(uncovered, tokens);
    if (fix) {
      fixes.push(fix);
    }
  }

  // Sort by priority
  fixes.sort((a, b) => a.priority - b.priority);

  // Generate FIGMA constants block
  const figmaConstants = generateFigmaConstants(extraction, coverageReport.uncoveredProperties);

  return {
    screenId,
    screenName: extraction.screenName,
    currentCoverage: coverageReport.summary.overallCoverage,
    targetCoverage: 100,
    rnFilePath,
    totalFixes: fixes.length,
    fixesByCategory,
    fixes,
    figmaConstants,
  };
}

function generateFigmaConstants(extraction: EnhancedExtraction, uncovered: UncoveredProperty[]): string {
  const lines: string[] = [
    '// ============================================',
    '// FIGMA EXTRACTED CONSTANTS',
    `// Source: ${extraction.screenId}`,
    '// ============================================',
    '',
    'const FIGMA = {',
  ];

  // Group uncovered properties by node
  const byNode = new Map<string, UncoveredProperty[]>();
  for (const prop of uncovered) {
    const existing = byNode.get(prop.nodeId) || [];
    existing.push(prop);
    byNode.set(prop.nodeId, existing);
  }

  // Generate constants for each node
  for (const [nodeId, props] of byNode) {
    const nodeName = props[0].nodeName
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^[A-Z]/, c => c.toLowerCase());

    lines.push(`  // Node: ${props[0].nodeName} (${nodeId})`);
    lines.push(`  ${nodeName}: {`);

    for (const prop of props) {
      let value = prop.figmaValue;
      if (typeof value === 'string') {
        value = `'${value}'`;
      } else if (typeof value === 'number') {
        value = Math.round(value * 100) / 100;
      }
      lines.push(`    ${prop.property}: ${value},`);
    }

    lines.push(`  },`);
    lines.push('');
  }

  lines.push('} as const;');

  return lines.join('\n');
}

// ============================================
// MAIN
// ============================================

function main(): void {
  const args = process.argv.slice(2);
  const screenId = args[0];
  const dryRun = args.includes('--dry-run');

  if (!screenId) {
    console.log('Usage: npx ts-node scripts/apply-figma-fixes.ts <screenId> [--dry-run]');
    console.log('Example: npx ts-node scripts/apply-figma-fixes.ts 1-31485');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              FIGMA FIX GENERATOR                           ║');
  console.log('║     Deterministic fixes from Figma extraction              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const report = generateFixReport(screenId);
  if (!report) {
    process.exit(1);
  }

  console.log(`\nScreen: ${report.screenName}`);
  console.log(`Coverage: ${report.currentCoverage}% → ${report.targetCoverage}%`);
  console.log(`RN File: ${report.rnFilePath || 'NOT FOUND'}`);
  console.log(`Total Fixes: ${report.totalFixes}`);
  console.log('\nFixes by Category:');
  for (const [category, count] of Object.entries(report.fixesByCategory)) {
    console.log(`  ${category}: ${count}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('FIGMA CONSTANTS TO ADD:');
  console.log('='.repeat(60));
  console.log(report.figmaConstants);

  console.log('\n' + '='.repeat(60));
  console.log('STYLE FIXES TO APPLY:');
  console.log('='.repeat(60));
  for (const fix of report.fixes.slice(0, 20)) {
    console.log(`\n${fix.description}`);
    console.log(`  Location: ${fix.location}`);
    console.log(`  Code: ${fix.newCode}`);
  }

  if (report.fixes.length > 20) {
    console.log(`\n... and ${report.fixes.length - 20} more fixes`);
  }

  // Save detailed report
  const reportPath = path.join(PATHS.coverageReports, `${screenId}-fix-report.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\nFull report saved to: ${reportPath}`, 'success');
}

main();
