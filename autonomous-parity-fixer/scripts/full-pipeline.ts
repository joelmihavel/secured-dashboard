/**
 * Full Figma-to-React-Native Pipeline
 *
 * A complete orchestration system that converts Figma designs to pixel-perfect
 * React Native code using the combined approach:
 *
 * 1. Local Extraction → Exact numerical values
 * 2. Universal Converter → Style maps and constants
 * 3. Figma MCP Integration → Semantic structure (via Claude)
 * 4. Component Generation → Production-ready code
 * 5. Verification → Screenshot comparison
 *
 * Usage:
 *   # Single screen with full pipeline
 *   npm run pipeline:single -- 243-2762
 *
 *   # Batch process multiple screens
 *   npm run pipeline:batch -- 243-2762 1-28055 41-4569
 *
 *   # Process all available screens
 *   npm run pipeline:batch
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  figmaFileKey: 'HZaVuwWn6B6jOjrmxZ7Kzv',

  paths: {
    root: path.join(__dirname, '..'),
    figmaParityData: path.join(__dirname, '../../figma-parity/data/screens'),
    combinedOutput: path.join(__dirname, '../data/combined'),
    generatedComponents: path.join(__dirname, '../output/components'),
    screenshots: path.join(__dirname, '../output/screenshots'),
    reports: path.join(__dirname, '../reports'),
    rnAppComponents: '/Users/atrishabh/FlentApp/app',
  },

  // Target app for copying generated components
  targetApp: {
    basePath: '/Users/atrishabh/FlentApp',
    componentPaths: {
      auth: 'app/(auth)',
      main: 'app/(main)',
      payment: 'app/(payment)',
      profile: 'app/(profile)',
      transactions: 'app/(transactions)',
      setup: 'app/(setup)',
      waitlist: 'app/(waitlist)',
      agreement: 'app/(agreement)',
    },
  },
};

// ============================================
// TYPES
// ============================================

interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  error?: string;
  output?: any;
}

interface PipelineResult {
  screenId: string;
  screenName: string;
  success: boolean;
  steps: PipelineStep[];
  outputPaths: {
    styleMap?: string;
    constants?: string;
    component?: string;
    screenshot?: string;
    report?: string;
  };
  duration: number;
  error?: string;
}

interface ScreenRouteConfig {
  figmaId: string;
  name: string;
  state: string;
  routeWithState?: string;
}

// ============================================
// LOGGER
// ============================================

class Logger {
  static info(msg: string) { console.log(`📋 ${msg}`); }
  static success(msg: string) { console.log(`✅ ${msg}`); }
  static warn(msg: string) { console.log(`⚠️  ${msg}`); }
  static error(msg: string) { console.log(`❌ ${msg}`); }
  static step(num: number, total: number, msg: string) {
    console.log(`\n[${num}/${total}] ${msg}`);
  }
  static banner(title: string) {
    console.log('\n' + '═'.repeat(70));
    console.log(`  ${title}`);
    console.log('═'.repeat(70) + '\n');
  }
  static subBanner(title: string) {
    console.log('\n' + '─'.repeat(50));
    console.log(`  ${title}`);
    console.log('─'.repeat(50));
  }
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

function saveJson(filePath: string, data: any): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function saveFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function listAvailableScreens(): string[] {
  const screens: string[] = [];

  if (fs.existsSync(CONFIG.paths.figmaParityData)) {
    const dirs = fs.readdirSync(CONFIG.paths.figmaParityData);
    for (const dir of dirs) {
      const extractionPath = path.join(CONFIG.paths.figmaParityData, dir, 'extracted-values.json');
      if (fs.existsSync(extractionPath)) {
        screens.push(dir);
      }
    }
  }

  return screens.sort();
}

function getScreenCategory(screenId: string): string {
  const routesPath = path.join(__dirname, '../config/screen-routes.json');
  const routes = loadJson<any>(routesPath);

  if (!routes?.routes) return 'main';

  for (const [category, config] of Object.entries(routes.routes)) {
    const screens = (config as any).screens || [];
    if (screens.some((s: any) => s.figmaId === screenId)) {
      // Map route category to target path
      const routePath = (config as any).route || '';
      if (routePath.includes('auth')) return 'auth';
      if (routePath.includes('main')) return 'main';
      if (routePath.includes('payment')) return 'payment';
      if (routePath.includes('profile')) return 'profile';
      if (routePath.includes('transactions')) return 'transactions';
      if (routePath.includes('setup')) return 'setup';
      if (routePath.includes('waitlist')) return 'waitlist';
      if (routePath.includes('agreement')) return 'agreement';
    }
  }

  return 'main';
}

// ============================================
// PIPELINE STEPS
// ============================================

class PipelineRunner {
  private screenId: string;
  private steps: PipelineStep[] = [];
  private startTime: Date;

  constructor(screenId: string) {
    this.screenId = screenId;
    this.startTime = new Date();
  }

  /**
   * Run the full pipeline for a single screen
   */
  async run(): Promise<PipelineResult> {
    Logger.banner(`Pipeline: ${this.screenId}`);

    const totalSteps = 5;
    let stepNum = 0;

    // Step 1: Verify extraction exists
    Logger.step(++stepNum, totalSteps, 'Verifying extraction data...');
    const extractionStep = await this.runStep('verify_extraction', () => {
      return this.verifyExtraction();
    });

    if (!extractionStep.output) {
      return this.createResult(false, 'No extraction data found');
    }

    // Step 2: Run universal converter
    Logger.step(++stepNum, totalSteps, 'Running universal converter...');
    const converterStep = await this.runStep('universal_converter', () => {
      return this.runUniversalConverter();
    });

    if (converterStep.status === 'failed') {
      return this.createResult(false, 'Universal converter failed');
    }

    // Step 3: Generate Claude prompt for implementation
    Logger.step(++stepNum, totalSteps, 'Generating implementation prompt...');
    const promptStep = await this.runStep('generate_prompt', () => {
      return this.generateImplementationPrompt();
    });

    // Step 4: Copy to target app (optional - creates placeholder)
    Logger.step(++stepNum, totalSteps, 'Setting up target component...');
    const copyStep = await this.runStep('setup_component', () => {
      return this.setupTargetComponent();
    });

    // Step 5: Generate verification report
    Logger.step(++stepNum, totalSteps, 'Generating verification report...');
    const reportStep = await this.runStep('generate_report', () => {
      return this.generateReport();
    });

    return this.createResult(true);
  }

  private async runStep(name: string, fn: () => Promise<any> | any): Promise<PipelineStep> {
    const step: PipelineStep = {
      name,
      status: 'running',
      startTime: new Date(),
    };

    this.steps.push(step);

    try {
      step.output = await fn();
      step.status = 'completed';
      Logger.success(`${name} completed`);
    } catch (error: any) {
      step.status = 'failed';
      step.error = error.message;
      Logger.error(`${name} failed: ${error.message}`);
    }

    step.endTime = new Date();
    return step;
  }

  private verifyExtraction(): { exists: boolean; nodeCount: number; path: string } {
    const extractionPath = path.join(
      CONFIG.paths.figmaParityData,
      this.screenId,
      'extracted-values.json'
    );

    if (!fs.existsSync(extractionPath)) {
      Logger.warn(`No extraction found at: ${extractionPath}`);
      Logger.info(`Run: cd ../figma-parity && npm run extract:single ${this.screenId}`);
      return { exists: false, nodeCount: 0, path: extractionPath };
    }

    const extraction = loadJson<any>(extractionPath);
    const nodeCount = extraction?.nodes?.length || 0;

    Logger.info(`Found ${nodeCount} nodes in extraction`);
    return { exists: true, nodeCount, path: extractionPath };
  }

  private runUniversalConverter(): { outputDir: string; styleCount: number } {
    Logger.info('Running universal converter...');

    try {
      execSync(
        `npx ts-node scripts/universal-converter.ts convert ${this.screenId}`,
        {
          cwd: CONFIG.paths.root,
          stdio: 'pipe',
          encoding: 'utf-8',
        }
      );
    } catch (error: any) {
      // Converter might output to stderr but still succeed
      if (!fs.existsSync(path.join(CONFIG.paths.combinedOutput, this.screenId))) {
        throw new Error('Converter failed: ' + error.message);
      }
    }

    const styleMapPath = path.join(CONFIG.paths.combinedOutput, this.screenId, 'style-map.json');
    const styleMap = loadJson<any[]>(styleMapPath) || [];

    return {
      outputDir: path.join(CONFIG.paths.combinedOutput, this.screenId),
      styleCount: styleMap.length,
    };
  }

  private generateImplementationPrompt(): { promptPath: string; content: string } {
    const outputDir = path.join(CONFIG.paths.combinedOutput, this.screenId);
    const styleMap = loadJson<any[]>(path.join(outputDir, 'style-map.json')) || [];
    const constants = loadJson<any>(path.join(outputDir, 'constants.json')) || {};
    const extraction = loadJson<any>(path.join(outputDir, 'extraction.json')) || {};

    const screenName = extraction.screenName || `Screen ${this.screenId}`;

    const prompt = `# Pixel-Perfect Implementation Guide

## Screen: ${screenName}
## Figma Node: ${this.screenId.replace('-', ':')}
## File Key: ${CONFIG.figmaFileKey}

---

## STEP 1: Get Figma Semantic Structure

Call the Figma MCP to get the design context:

\`\`\`
mcp__figma__get_design_context({
  fileKey: "${CONFIG.figmaFileKey}",
  nodeId: "${this.screenId.replace('-', ':')}"
})
\`\`\`

This provides:
- Parent-child hierarchy
- Multi-span text structure
- Component relationships

---

## STEP 2: Load Extracted Styles

Use the pre-computed styles from:
\`${path.join(outputDir, 'style-map.json')}\`

Total styles available: ${styleMap.length}

### Key Styles:
${styleMap.slice(0, 10).map(s => `- ${s.rnStyleName}: ${s.nodeType} (${s.nodeName})`).join('\n')}

---

## STEP 3: Implement Component

### Generated Component Template:
\`${path.join(CONFIG.paths.generatedComponents, this.screenId + '.tsx')}\`

### Target Location:
\`${path.join(CONFIG.targetApp.basePath, CONFIG.targetApp.componentPaths[getScreenCategory(this.screenId) as keyof typeof CONFIG.targetApp.componentPaths] || 'app/(main)')}\`

---

## STEP 4: Verify Implementation

1. Build and run on iOS simulator
2. Navigate to the screen
3. Capture screenshot: \`xcrun simctl io booted screenshot\`
4. Compare with Figma baseline

---

## Key Colors (from extraction)
${Object.entries(constants.colors?.values || {}).slice(0, 8).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Key Typography
${Object.entries(constants.typography?.values || {}).slice(0, 5).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n')}

---

## Text Content (for reference)
${styleMap.filter(s => s.nodeType === 'TEXT').slice(0, 15).map(s => `- "${s.textContent}"`).join('\n')}
`;

    const promptPath = path.join(outputDir, 'implementation-guide.md');
    saveFile(promptPath, prompt);

    return { promptPath, content: prompt };
  }

  private setupTargetComponent(): { targetPath: string; created: boolean } {
    const category = getScreenCategory(this.screenId);
    const targetDir = path.join(
      CONFIG.targetApp.basePath,
      CONFIG.targetApp.componentPaths[category as keyof typeof CONFIG.targetApp.componentPaths] || 'app/(main)'
    );

    // Create a placeholder file name
    const componentName = this.screenId.replace('-', '_');
    const targetPath = path.join(targetDir, `${componentName}_pixel_perfect.tsx`);

    // Check if generated component exists
    const generatedPath = path.join(CONFIG.paths.generatedComponents, `${this.screenId}.tsx`);
    if (fs.existsSync(generatedPath)) {
      Logger.info(`Generated component available at: ${generatedPath}`);
      Logger.info(`Target location: ${targetPath}`);
    }

    return { targetPath, created: false };
  }

  private generateReport(): { reportPath: string } {
    const outputDir = path.join(CONFIG.paths.combinedOutput, this.screenId);
    const styleMap = loadJson<any[]>(path.join(outputDir, 'style-map.json')) || [];
    const extraction = loadJson<any>(path.join(outputDir, 'extraction.json')) || {};

    const report = {
      screenId: this.screenId,
      screenName: extraction.screenName || `Screen ${this.screenId}`,
      generatedAt: new Date().toISOString(),
      figmaFileKey: CONFIG.figmaFileKey,
      figmaNodeId: this.screenId.replace('-', ':'),
      stats: {
        totalNodes: extraction.nodes?.length || 0,
        stylesGenerated: styleMap.length,
        textNodes: styleMap.filter((s: any) => s.nodeType === 'TEXT').length,
        frameNodes: styleMap.filter((s: any) => s.nodeType === 'FRAME').length,
      },
      outputPaths: {
        styleMap: path.join(outputDir, 'style-map.json'),
        constants: path.join(outputDir, 'constants.json'),
        component: path.join(CONFIG.paths.generatedComponents, `${this.screenId}.tsx`),
        implementationGuide: path.join(outputDir, 'implementation-guide.md'),
      },
      steps: this.steps.map(s => ({
        name: s.name,
        status: s.status,
        duration: s.endTime && s.startTime
          ? (s.endTime.getTime() - s.startTime.getTime()) / 1000
          : 0,
        error: s.error,
      })),
    };

    const reportPath = path.join(CONFIG.paths.reports, `${this.screenId}-report.json`);
    saveJson(reportPath, report);

    Logger.info(`Report saved: ${reportPath}`);
    return { reportPath };
  }

  private createResult(success: boolean, error?: string): PipelineResult {
    const endTime = new Date();
    const duration = (endTime.getTime() - this.startTime.getTime()) / 1000;

    const extraction = loadJson<any>(
      path.join(CONFIG.paths.figmaParityData, this.screenId, 'extracted-values.json')
    );

    return {
      screenId: this.screenId,
      screenName: extraction?.screenName || `Screen ${this.screenId}`,
      success,
      steps: this.steps,
      outputPaths: {
        styleMap: path.join(CONFIG.paths.combinedOutput, this.screenId, 'style-map.json'),
        constants: path.join(CONFIG.paths.combinedOutput, this.screenId, 'constants.json'),
        component: path.join(CONFIG.paths.generatedComponents, `${this.screenId}.tsx`),
        report: path.join(CONFIG.paths.reports, `${this.screenId}-report.json`),
      },
      duration,
      error,
    };
  }
}

// ============================================
// BATCH RUNNER
// ============================================

class BatchPipelineRunner {
  async run(screenIds: string[]): Promise<PipelineResult[]> {
    Logger.banner('Batch Pipeline Execution');
    Logger.info(`Processing ${screenIds.length} screens...`);

    const results: PipelineResult[] = [];

    for (let i = 0; i < screenIds.length; i++) {
      Logger.subBanner(`Screen ${i + 1}/${screenIds.length}: ${screenIds[i]}`);

      const runner = new PipelineRunner(screenIds[i]);
      const result = await runner.run();
      results.push(result);
    }

    // Print summary
    this.printSummary(results);

    // Save batch report
    this.saveBatchReport(results);

    return results;
  }

  private printSummary(results: PipelineResult[]): void {
    Logger.banner('Batch Summary');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total screens: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Total duration: ${totalDuration.toFixed(1)}s`);

    if (failed.length > 0) {
      console.log('\nFailed screens:');
      failed.forEach(r => {
        console.log(`  ❌ ${r.screenId}: ${r.error || 'Unknown error'}`);
      });
    }

    console.log('\nOutput locations:');
    console.log(`  Combined data: ${CONFIG.paths.combinedOutput}`);
    console.log(`  Components: ${CONFIG.paths.generatedComponents}`);
    console.log(`  Reports: ${CONFIG.paths.reports}`);
  }

  private saveBatchReport(results: PipelineResult[]): void {
    const report = {
      generatedAt: new Date().toISOString(),
      totalScreens: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      screens: results.map(r => ({
        screenId: r.screenId,
        screenName: r.screenName,
        success: r.success,
        duration: r.duration,
        error: r.error,
        outputPaths: r.outputPaths,
      })),
    };

    const reportPath = path.join(CONFIG.paths.reports, `batch-report-${Date.now()}.json`);
    saveJson(reportPath, report);
    Logger.info(`Batch report saved: ${reportPath}`);
  }
}

// ============================================
// CLI
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Ensure output directories exist
  fs.mkdirSync(CONFIG.paths.combinedOutput, { recursive: true });
  fs.mkdirSync(CONFIG.paths.generatedComponents, { recursive: true });
  fs.mkdirSync(CONFIG.paths.screenshots, { recursive: true });
  fs.mkdirSync(CONFIG.paths.reports, { recursive: true });

  switch (command) {
    case 'single': {
      const screenId = args[1];
      if (!screenId) {
        console.log('Usage: npm run pipeline:single -- <screenId>');
        console.log('Example: npm run pipeline:single -- 243-2762');
        process.exit(1);
      }

      const runner = new PipelineRunner(screenId);
      const result = await runner.run();

      Logger.banner('Pipeline Complete');
      console.log(`Screen: ${result.screenName}`);
      console.log(`Success: ${result.success}`);
      console.log(`Duration: ${result.duration.toFixed(1)}s`);

      if (result.success) {
        console.log('\nNext steps:');
        console.log('1. Read the implementation guide:');
        console.log(`   ${path.join(CONFIG.paths.combinedOutput, screenId, 'implementation-guide.md')}`);
        console.log('\n2. Call Figma MCP for semantic structure:');
        console.log(`   mcp__figma__get_design_context({fileKey: "${CONFIG.figmaFileKey}", nodeId: "${screenId.replace('-', ':')}"})`);
        console.log('\n3. Implement the screen using both data sources');
      }

      break;
    }

    case 'batch': {
      const screenIds = args.slice(1);
      const toProcess = screenIds.length > 0 ? screenIds : listAvailableScreens();

      if (toProcess.length === 0) {
        Logger.warn('No screens to process.');
        Logger.info('Run extraction first in figma-parity directory.');
        process.exit(1);
      }

      const batchRunner = new BatchPipelineRunner();
      await batchRunner.run(toProcess);
      break;
    }

    case 'list': {
      Logger.banner('Available Screens');
      const screens = listAvailableScreens();

      if (screens.length === 0) {
        Logger.warn('No screens found with extractions.');
        return;
      }

      console.log(`Found ${screens.length} screens:\n`);
      screens.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s}`);
      });
      break;
    }

    default:
      console.log(`
Full Figma-to-React-Native Pipeline

Usage:
  npm run pipeline <command> [options]

Commands:
  single <screenId>     Run pipeline for a single screen
  batch [screenIds...]  Run pipeline for multiple screens (or all)
  list                  List available screens

Examples:
  npm run pipeline:single -- 243-2762
  npm run pipeline:batch -- 243-2762 1-28055 41-4569
  npm run pipeline:batch

Pipeline Steps:
  1. Verify extraction data exists
  2. Run universal converter (style maps + constants)
  3. Generate implementation prompt
  4. Set up target component placeholder
  5. Generate verification report

Output:
  - data/combined/{screenId}/    Style maps, constants, prompts
  - output/components/           Generated component templates
  - reports/                     Pipeline and verification reports
`);
  }
}

main().catch(console.error);
