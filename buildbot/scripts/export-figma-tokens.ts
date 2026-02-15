/**
 * Figma Design Tokens Export Script
 *
 * Generates config/design-tokens.json from Figma MCP Variables.
 * Figma is the SINGLE SOURCE OF TRUTH - no fallbacks.
 *
 * Usage:
 *   npx ts-node scripts/export-figma-tokens.ts
 *   npx ts-node scripts/export-figma-tokens.ts --validate-only
 *
 * To refresh Figma data, use Claude with Figma MCP:
 *   mcp__figma__get_variable_defs(fileKey, nodeId) -> save to config/figma-variables-raw.json
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG_DIR = path.join(__dirname, '../config');
const OUTPUT_DIR = path.join(__dirname, '../config');

interface FigmaConfig {
  fileKey: string;
  figmaToken: string;
}

function loadFigmaConfig(): FigmaConfig {
  const configPath = path.join(CONFIG_DIR, 'figma.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// ============================================================================
// DESIGN TOKEN TYPES
// ============================================================================

interface TypographyToken {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
}

interface DesignTokens {
  _meta: {
    generatedAt: string;
    figmaFileKey: string;
    source: string;
    version: string;
  };
  colors: Record<string, Record<string, string> | string>;
  typography: Record<string, TypographyToken>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  shadows: Record<string, any>;
  _colorByHex: Record<string, string>;
  _typographyByStyle: Record<string, string>;
  _spacingByValue: Record<string, string>;
  _radiusByValue: Record<string, string>;
}

// ============================================================================
// FIGMA MCP VARIABLES PARSING
// ============================================================================

interface FigmaMCPVariables {
  [key: string]: string;
}

function parseFigmaMCPVariables(): DesignTokens {
  const mcpDataPath = path.join(CONFIG_DIR, 'figma-variables-raw.json');

  if (!fs.existsSync(mcpDataPath)) {
    throw new Error(
      `Figma variables not found: ${mcpDataPath}\n` +
      `Run Figma MCP get_variable_defs to generate this file.`
    );
  }

  console.log('\nParsing Figma MCP variables...');

  const rawData: FigmaMCPVariables = JSON.parse(fs.readFileSync(mcpDataPath, 'utf-8'));

  const colors: Record<string, Record<string, string> | string> = {};
  const spacing: Record<string, number> = {};
  const radius: Record<string, number> = {};
  const typography: Record<string, TypographyToken> = {};
  const shadows: Record<string, any> = {};
  const colorByHex: Record<string, string> = {};
  const spacingByValue: Record<string, string> = {};
  const radiusByValue: Record<string, string> = {};
  const typographyByStyle: Record<string, string> = {};

  // Parse each variable
  for (const [figmaPath, value] of Object.entries(rawData)) {
    const pathParts = figmaPath.split('/');
    const category = pathParts[0].toLowerCase();

    // Parse Colors: "Colours/Black/700" -> colors.black[700] = "#131313"
    if (category === 'colours' || category === 'colour' || category === 'colors') {
      if (value.startsWith('#')) {
        const hex = value.toUpperCase();

        if (pathParts.length >= 3) {
          const scale = pathParts[1].toLowerCase();
          const shade = pathParts[2];

          if (!colors[scale]) colors[scale] = {};
          (colors[scale] as Record<string, string>)[shade] = hex;
          colorByHex[hex] = `colors.${scale}[${shade}]`;
        } else if (pathParts.length === 2) {
          const name = pathParts[1].toLowerCase();
          colors[name] = hex;
          colorByHex[hex] = `colors.${name}`;
        }
      }
    }

    // Parse Spacing: "Spacing/sp-8" -> spacing.xs = 8
    else if (category === 'spacing') {
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        const tokenName = mapSpacingName(pathParts[1], numValue);
        spacing[tokenName] = numValue;
        spacingByValue[numValue.toString()] = `spacing.${tokenName}`;
      }
    }

    // Parse Radius: "Radius/rd-12" -> radius.md = 12
    else if (category === 'radius') {
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        const tokenName = mapRadiusName(pathParts[1], numValue);
        radius[tokenName] = numValue;
        radiusByValue[numValue.toString()] = `radius.${tokenName}`;
      }
    }

    // Parse Shadow
    else if (category === 'shadow') {
      shadows[pathParts[1] || 'default'] = { figmaValue: value };
    }

    // Parse Typography: "H1/Regular 400" -> Font definition
    else if (value.startsWith('Font(')) {
      const fontMatch = value.match(/family:\s*"([^"]+)".*size:\s*([^,]+).*weight:\s*(\d+).*lineHeight:\s*([^,)]+)/);
      if (fontMatch) {
        const [, fontFamily, fontSizeRef, fontWeight, lineHeightRef] = fontMatch;

        const fontSize = resolveNumericRef(fontSizeRef, rawData);
        const lineHeight = resolveNumericRef(lineHeightRef, rawData);

        if (fontSize && lineHeight) {
          const tokenName = mapTypographyName(figmaPath);
          typography[tokenName] = {
            fontFamily: fontFamily || 'Plus Jakarta Sans',
            fontSize,
            lineHeight,
            fontWeight: parseInt(fontWeight),
            letterSpacing: 0,
          };

          const styleKey = `${fontSize}:${lineHeight}:${fontWeight}`;
          typographyByStyle[styleKey] = `typography.${tokenName}`;
        }
      }
    }
  }

  console.log(`  Colors: ${Object.keys(colorByHex).length} values`);
  console.log(`  Spacing: ${Object.keys(spacing).length} values`);
  console.log(`  Radius: ${Object.keys(radius).length} values`);
  console.log(`  Typography: ${Object.keys(typography).length} styles`);

  const config = loadFigmaConfig();

  return {
    _meta: {
      generatedAt: new Date().toISOString(),
      figmaFileKey: config.fileKey,
      source: 'figma-mcp-variables',
      version: '3.0.0',
    },
    colors,
    typography,
    spacing,
    radius,
    shadows,
    _colorByHex: colorByHex,
    _typographyByStyle: typographyByStyle,
    _spacingByValue: spacingByValue,
    _radiusByValue: radiusByValue,
  };
}

// Map Figma spacing names (sp-8) to semantic names (xs)
function mapSpacingName(figmaName: string, value: number): string {
  const semanticMap: Record<number, string> = {
    0: 'zero',
    2: 'xxxs',
    4: 'xxs',
    8: 'xs',
    12: 'sm',
    16: 'md',
    24: 'lg',
    32: 'xl',
    40: 'xxl',
    48: 'xxxl',
    64: 'huge',
  };
  return semanticMap[value] || figmaName.replace('sp-', 'sp');
}

// Map Figma radius names (rd-12) to semantic names (md)
function mapRadiusName(figmaName: string, value: number): string {
  const semanticMap: Record<number, string> = {
    0: 'none',
    4: 'xs',
    8: 'sm',
    12: 'md',
    16: 'lg',
    24: 'xl',
    40: 'xxl',
    200: 'pill',
    9999: 'full',
  };
  return semanticMap[value] || figmaName.replace('rd-', 'r');
}

// Map Figma typography names to semantic names
function mapTypographyName(figmaPath: string): string {
  const lower = figmaPath.toLowerCase();

  // Headlines
  if (lower.startsWith('h1/')) return 'h1';
  if (lower.startsWith('h2/')) return 'h2';
  if (lower.startsWith('h3/')) return 'h3';
  if (lower.startsWith('h4/')) return 'h4';
  if (lower.startsWith('h5/')) return 'h5';
  if (lower.startsWith('h6/')) return 'h6';

  // Body variants
  if (lower.startsWith('lg/')) {
    if (lower.includes('semibold') || lower.includes('600')) return 'bodyLgSemibold';
    if (lower.includes('medium') || lower.includes('500')) return 'bodyLgMedium';
    return 'bodyLg';
  }
  if (lower.startsWith('md-2/') || lower.startsWith('md 2/')) {
    if (lower.includes('semibold') || lower.includes('600')) return 'bodyMd';
    if (lower.includes('medium') || lower.includes('500')) return 'bodyMdMedium';
    return 'bodyMdRegular';
  }
  if (lower.startsWith('md-1/') || lower.startsWith('md 1/')) {
    if (lower.includes('semibold') || lower.includes('600')) return 'label';
    if (lower.includes('medium') || lower.includes('500')) return 'bodyMd2Medium';
    return 'bodyMd2';
  }
  if (lower.startsWith('sm/')) {
    if (lower.includes('semibold') || lower.includes('600')) return 'bodySmSemiBold';
    if (lower.includes('medium') || lower.includes('500')) return 'bodySmMedium';
    return 'bodySm';
  }

  // Display
  if (lower.includes('display')) return 'display';

  return figmaPath.replace(/[^a-zA-Z0-9]/g, '_');
}

// Resolve numeric references like "Font Size/Heading/h1" -> 48
function resolveNumericRef(ref: string, data: FigmaMCPVariables): number | null {
  const direct = parseInt(ref.trim());
  if (!isNaN(direct)) return direct;

  const refValue = data[ref.trim()];
  if (refValue) {
    const num = parseInt(refValue);
    if (!isNaN(num)) return num;
  }

  return null;
}

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    colorsCount: number;
    typographyCount: number;
    spacingCount: number;
    radiusCount: number;
  };
}

function validateTokens(tokens: DesignTokens): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!tokens.colors || Object.keys(tokens.colors).length === 0) {
    errors.push('No colors defined');
  }
  if (!tokens.typography || Object.keys(tokens.typography).length === 0) {
    warnings.push('No typography defined');
  }
  if (!tokens.spacing || Object.keys(tokens.spacing).length === 0) {
    warnings.push('No spacing defined');
  }
  if (!tokens._colorByHex || Object.keys(tokens._colorByHex).length === 0) {
    errors.push('Color reverse lookup map is empty');
  }

  // Validate color hex format
  for (const [hex, tokenPath] of Object.entries(tokens._colorByHex || {})) {
    if (!/^#[A-F0-9]{6}$/i.test(hex)) {
      errors.push(`Invalid hex color: ${hex} -> ${tokenPath}`);
    }
  }

  // Count colors
  let colorsCount = 0;
  for (const value of Object.values(tokens.colors || {})) {
    if (typeof value === 'string') {
      colorsCount++;
    } else {
      colorsCount += Object.keys(value).length;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      colorsCount,
      typographyCount: Object.keys(tokens.typography || {}).length,
      spacingCount: Object.keys(tokens.spacing || {}).length,
      radiusCount: Object.keys(tokens.radius || {}).length,
    },
  };
}

// ============================================================================
// OUTPUT
// ============================================================================

function writeDesignTokens(tokens: DesignTokens, outputPath: string): void {
  const output = JSON.stringify(tokens, null, 2);
  fs.writeFileSync(outputPath, output);
  console.log(`\n✅ Written: ${outputPath}`);
  console.log(`   Size: ${(output.length / 1024).toFixed(2)} KB`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  FIGMA DESIGN TOKENS EXPORT');
  console.log('  Source: Figma MCP Variables (Single Source of Truth)');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate-only');

  const config = loadFigmaConfig();
  console.log(`\nFigma File: ${config.fileKey}`);

  // Parse Figma MCP variables (only source)
  const tokens = parseFigmaMCPVariables();

  // Validate
  console.log('\n' + '-'.repeat(60));
  console.log('  VALIDATION');
  console.log('-'.repeat(60));

  const validation = validateTokens(tokens);

  console.log(`\nStats:`);
  console.log(`  Colors: ${validation.stats.colorsCount}`);
  console.log(`  Typography: ${validation.stats.typographyCount}`);
  console.log(`  Spacing: ${validation.stats.spacingCount}`);
  console.log(`  Radius: ${validation.stats.radiusCount}`);

  if (validation.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    validation.errors.forEach(e => console.log(`   - ${e}`));
  }

  if (validation.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    validation.warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (validateOnly) {
    console.log('\n--validate-only flag set, skipping write.');
    process.exit(validation.isValid ? 0 : 1);
  }

  // Write output
  const outputPath = path.join(OUTPUT_DIR, 'design-tokens.json');
  writeDesignTokens(tokens, outputPath);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nReverse lookup maps:`);
  console.log(`  _colorByHex: ${Object.keys(tokens._colorByHex).length} entries`);
  console.log(`  _typographyByStyle: ${Object.keys(tokens._typographyByStyle).length} entries`);
  console.log(`  _spacingByValue: ${Object.keys(tokens._spacingByValue).length} entries`);
  console.log(`  _radiusByValue: ${Object.keys(tokens._radiusByValue).length} entries`);

  console.log(`\n✅ Done!`);
  console.log(`\nTo refresh Figma data:`);
  console.log(`  1. Ask Claude: "Fetch Figma variables and save to figma-variables-raw.json"`);
  console.log(`  2. Run: npx ts-node scripts/export-figma-tokens.ts`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
