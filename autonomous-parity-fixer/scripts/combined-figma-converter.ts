/**
 * Combined Figma Converter
 *
 * Combines two data sources for pixel-perfect React Native generation:
 * 1. LOCAL EXTRACTION - Precise numerical values (rnStyles, geometry, typography)
 * 2. FIGMA MCP - Semantic structure (hierarchy, multi-span text, parent-child)
 *
 * Usage:
 *   npx ts-node scripts/combined-figma-converter.ts <screenId>
 *   npx ts-node scripts/combined-figma-converter.ts 243-2762
 *
 * Output:
 *   - data/combined/{screenId}/conversion-prompt.md
 *   - data/combined/{screenId}/local-extraction.json
 *   - data/combined/{screenId}/style-map.json
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// PATHS
// ============================================

const PATHS = {
  root: path.join(__dirname, '..'),
  figmaParityData: path.join(__dirname, '../../figma-parity/data/screens'),
  aiEnhancedData: path.join(__dirname, '../data/ai-enhanced'),
  output: path.join(__dirname, '../data/combined'),
  rnApp: path.join(__dirname, '../../rn-app'),
  designTokens: path.join(__dirname, '../config/design-tokens.json'),
  screenRoutes: path.join(__dirname, '../config/screen-routes.json'),
};

// ============================================
// TYPES
// ============================================

interface ExtractedNode {
  nodeId: string;
  name: string;
  type: string;
  geometry: { x: number; y: number; width: number; height: number } | null;
  fills: Array<{ type: string; hex?: string; opacity?: number }>;
  strokes: Array<{ type: string; hex?: string; width?: number }>;
  effects: Array<{ type: string; color?: string; offset?: any; radius?: number }>;
  cornerRadius: { all?: number; topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number };
  layout: {
    mode?: string;
    primaryAlign?: string;
    counterAlign?: string;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    gap?: number;
  } | null;
  typography: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeight?: number;
    letterSpacing?: number;
    textAlign?: string;
    text?: string;
  } | null;
  rnStyles: Record<string, any>;
}

interface LocalExtraction {
  screenId: string;
  screenName: string;
  extractedAt: string;
  nodeCount: number;
  nodes: ExtractedNode[];
}

interface StyleMapEntry {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  rnStyleName: string;
  rnStyles: Record<string, any>;
  textContent?: string;
  geometry?: { x: number; y: number; width: number; height: number };
}

interface ConversionData {
  screenId: string;
  screenName: string;
  localExtraction: LocalExtraction;
  styleMap: StyleMapEntry[];
  conversionPrompt: string;
  themeTokens: Record<string, any>;
}

// ============================================
// UTILITIES
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

function toRnStyleName(nodeName: string): string {
  // Convert "Frame 2095586343" or "Your rent is due in 10 days" to camelCase
  return nodeName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
    .substring(0, 40) || 'container';
}

// ============================================
// LOAD LOCAL EXTRACTION
// ============================================

function loadLocalExtraction(screenId: string): LocalExtraction | null {
  // Try figma-parity data first
  const figmaParityPath = path.join(PATHS.figmaParityData, screenId, 'extracted-values.json');
  if (fs.existsSync(figmaParityPath)) {
    log(`Loading from figma-parity: ${figmaParityPath}`);
    return loadJson<LocalExtraction>(figmaParityPath);
  }

  // Try ai-enhanced data
  const aiEnhancedPath = path.join(PATHS.aiEnhancedData, screenId, 'enhanced-extraction.json');
  if (fs.existsSync(aiEnhancedPath)) {
    log(`Loading from ai-enhanced: ${aiEnhancedPath}`);
    return loadJson<LocalExtraction>(aiEnhancedPath);
  }

  return null;
}

// ============================================
// BUILD STYLE MAP
// ============================================

function buildStyleMap(extraction: LocalExtraction): StyleMapEntry[] {
  const styleMap: StyleMapEntry[] = [];
  const usedNames = new Set<string>();

  for (const node of extraction.nodes) {
    if (!node.rnStyles || Object.keys(node.rnStyles).length === 0) continue;

    let styleName = toRnStyleName(node.name);

    // Ensure unique names
    if (usedNames.has(styleName)) {
      let counter = 2;
      while (usedNames.has(`${styleName}${counter}`)) counter++;
      styleName = `${styleName}${counter}`;
    }
    usedNames.add(styleName);

    // Fix common issues in rnStyles
    const fixedStyles = fixRnStyles(node.rnStyles, node.type);

    const entry: StyleMapEntry = {
      nodeId: node.nodeId,
      nodeName: node.name,
      nodeType: node.type,
      rnStyleName: styleName,
      rnStyles: fixedStyles,
    };

    // Add text content for TEXT nodes
    if (node.type === 'TEXT' && node.typography?.text) {
      entry.textContent = node.typography.text;
    }

    // Add geometry for positioning context
    if (node.geometry) {
      entry.geometry = node.geometry;
    }

    styleMap.push(entry);
  }

  return styleMap;
}

function fixRnStyles(styles: Record<string, any>, nodeType: string): Record<string, any> {
  const fixed: Record<string, any> = {};

  for (const [key, value] of Object.entries(styles)) {
    if (value === undefined || value === null) continue;

    // Fix backgroundColor for TEXT nodes (should be color)
    if (nodeType === 'TEXT' && key === 'backgroundColor') {
      fixed['color'] = value;
      continue;
    }

    // Convert fontWeight to string
    if (key === 'fontWeight' && typeof value === 'number') {
      fixed[key] = String(value);
      continue;
    }

    // Convert textAlign to lowercase
    if (key === 'textAlign' && typeof value === 'string') {
      fixed[key] = value.toLowerCase();
      continue;
    }

    // Round numbers
    if (typeof value === 'number') {
      fixed[key] = Math.round(value * 100) / 100;
      continue;
    }

    fixed[key] = value;
  }

  return fixed;
}

// ============================================
// GENERATE CONVERSION PROMPT
// ============================================

function generateConversionPrompt(screenId: string, screenName: string, styleMap: StyleMapEntry[]): string {
  const textNodes = styleMap.filter(s => s.nodeType === 'TEXT');
  const frameNodes = styleMap.filter(s => s.nodeType === 'FRAME' || s.nodeType === 'GROUP');

  return `# Figma-to-React-Native Conversion Prompt

## Screen: ${screenName} (${screenId})

## Instructions

You are converting this Figma screen to React Native. You have TWO data sources:

### 1. LOCAL EXTRACTION (Use for exact styles)
The \`style-map.json\` file contains pre-computed React Native styles for each Figma node.
These values are EXACT - use them directly in StyleSheet.create().

### 2. FIGMA MCP OUTPUT (Use for structure)
The Figma MCP provides semantic HTML structure showing parent-child relationships.
Use this to understand:
- Which elements are containers vs content
- Multi-span text (different colors in same text)
- Proper nesting hierarchy

## Conversion Rules

1. **Use rnStyles directly** - Don't recalculate, the values are already converted
2. **For multi-color text**, use nested <Text> components:
   \`\`\`tsx
   <Text style={styles.headline}>
     <Text style={styles.grayText}>Your rent is due </Text>
     <Text style={styles.accentText}>in 10 days</Text>
   </Text>
   \`\`\`
3. **Map containers properly**:
   - FRAME with layout.mode=VERTICAL → flexDirection: 'column'
   - FRAME with layout.mode=HORIZONTAL → flexDirection: 'row'
4. **Use ScrollView** for screens taller than device height
5. **Download assets** from Figma MCP URLs to local files

## Key Text Content (from extraction)

${textNodes.slice(0, 20).map(t => `- "${t.textContent}" → styles.${t.rnStyleName}`).join('\n')}

## Key Frame Dimensions

${frameNodes.slice(0, 10).map(f => `- ${f.nodeName}: ${f.geometry?.width}x${f.geometry?.height}`).join('\n')}

## Style Map Summary

Total nodes with styles: ${styleMap.length}
- TEXT nodes: ${textNodes.length}
- FRAME nodes: ${frameNodes.length}

## Usage

1. Call \`mcp__figma__get_design_context\` for semantic structure
2. Load \`style-map.json\` for exact rnStyles
3. Generate React Native component using both:
   - Structure from MCP
   - Styles from extraction

## Example Output Structure

\`\`\`tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ${screenName.replace(/[^a-zA-Z0-9]/g, '')}Screen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Use MCP structure for hierarchy */}
        {/* Use style-map.json values for styles */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Paste rnStyles from style-map.json
});
\`\`\`
`;
}

// ============================================
// LOAD THEME TOKENS
// ============================================

function loadThemeTokens(): Record<string, any> {
  const tokens = loadJson<any>(PATHS.designTokens);
  if (!tokens) return {};

  // Build reverse lookup maps
  const colorByHex: Record<string, string> = {};
  const spacingByValue: Record<string, string> = {};
  const radiusByValue: Record<string, string> = {};

  // Build color lookup
  if (tokens.colors) {
    for (const [category, values] of Object.entries(tokens.colors)) {
      for (const [name, hex] of Object.entries(values as Record<string, string>)) {
        colorByHex[(hex as string).toUpperCase()] = `${category}.${name}`;
      }
    }
  }

  // Build spacing lookup
  if (tokens.spacing) {
    for (const [name, value] of Object.entries(tokens.spacing)) {
      spacingByValue[String(value)] = name;
    }
  }

  // Build radius lookup
  if (tokens.radius) {
    for (const [name, value] of Object.entries(tokens.radius)) {
      radiusByValue[String(value)] = name;
    }
  }

  return {
    ...tokens,
    _colorByHex: colorByHex,
    _spacingByValue: spacingByValue,
    _radiusByValue: radiusByValue,
  };
}

// ============================================
// GENERATE STYLESHEET CODE
// ============================================

function generateStyleSheetCode(styleMap: StyleMapEntry[]): string {
  const lines: string[] = [
    '// Auto-generated from Figma extraction',
    '// Screen styles with exact Figma values',
    '',
    'const styles = StyleSheet.create({',
  ];

  for (const entry of styleMap) {
    lines.push(`  // ${entry.nodeName} (${entry.nodeId})`);
    lines.push(`  ${entry.rnStyleName}: {`);

    for (const [key, value] of Object.entries(entry.rnStyles)) {
      if (typeof value === 'string') {
        lines.push(`    ${key}: '${value}',`);
      } else {
        lines.push(`    ${key}: ${value},`);
      }
    }

    lines.push('  },');
    lines.push('');
  }

  lines.push('});');

  return lines.join('\n');
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const screenId = args[0];

  if (!screenId) {
    console.log('Usage: npx ts-node scripts/combined-figma-converter.ts <screenId>');
    console.log('Example: npx ts-node scripts/combined-figma-converter.ts 243-2762');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           COMBINED FIGMA CONVERTER                         ║');
  console.log('║   Local Extraction + Figma MCP = Pixel Perfect             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Load local extraction
  log(`Loading local extraction for ${screenId}...`);
  const extraction = loadLocalExtraction(screenId);

  if (!extraction) {
    log(`No extraction found for ${screenId}`, 'error');
    log('Run: cd ../figma-parity && npm run extract:single ' + screenId, 'info');
    process.exit(1);
  }

  log(`Loaded ${extraction.nodes?.length || 0} nodes from extraction`, 'success');

  // Build style map
  log('Building style map...');
  const styleMap = buildStyleMap(extraction);
  log(`Created ${styleMap.length} style entries`, 'success');

  // Load theme tokens
  const themeTokens = loadThemeTokens();
  log(`Loaded theme tokens`, 'success');

  // Generate conversion prompt
  const screenName = extraction.screenName || `Screen ${screenId}`;
  const conversionPrompt = generateConversionPrompt(screenId, screenName, styleMap);

  // Generate stylesheet code
  const stylesheetCode = generateStyleSheetCode(styleMap);

  // Create output directory
  const outputDir = path.join(PATHS.output, screenId);
  fs.mkdirSync(outputDir, { recursive: true });

  // Save outputs
  const outputs = {
    'local-extraction.json': JSON.stringify(extraction, null, 2),
    'style-map.json': JSON.stringify(styleMap, null, 2),
    'conversion-prompt.md': conversionPrompt,
    'stylesheet.ts': stylesheetCode,
    'theme-tokens.json': JSON.stringify(themeTokens, null, 2),
  };

  for (const [filename, content] of Object.entries(outputs)) {
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, content);
    log(`Saved: ${filePath}`, 'success');
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('CONVERSION READY');
  console.log('='.repeat(60));
  console.log(`\nScreen: ${screenName}`);
  console.log(`Node count: ${extraction.nodes?.length || 0}`);
  console.log(`Style entries: ${styleMap.length}`);
  console.log(`\nOutput directory: ${outputDir}`);
  console.log('\nNext steps:');
  console.log('1. Call mcp__figma__get_design_context for semantic structure');
  console.log('2. Combine with style-map.json for exact values');
  console.log('3. Generate pixel-perfect React Native component');

  // Print key styles for quick reference
  console.log('\n' + '='.repeat(60));
  console.log('KEY STYLES (first 10):');
  console.log('='.repeat(60));
  for (const entry of styleMap.slice(0, 10)) {
    console.log(`\n${entry.rnStyleName} (${entry.nodeType}):`);
    const styleStr = JSON.stringify(entry.rnStyles, null, 2)
      .split('\n')
      .map(l => '  ' + l)
      .join('\n');
    console.log(styleStr);
  }
}

main().catch(console.error);
