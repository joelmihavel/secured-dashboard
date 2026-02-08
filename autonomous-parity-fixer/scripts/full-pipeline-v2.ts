/**
 * Full Figma-to-React-Native Pipeline v2
 *
 * Complete end-to-end orchestration with Gemini analysis integration:
 *
 * PHASE 1: DATA PREPARATION
 *   1. Check/Run AI-enhanced extraction (Gemini 3 Pro)
 *   2. Run universal converter (style maps + constants)
 *   3. Generate component template
 *
 * PHASE 2: IMPLEMENTATION (via Claude sub-agents)
 *   4. Get Figma MCP semantic structure
 *   5. Implement pixel-perfect component
 *
 * PHASE 3: VERIFICATION (Gemini feedback loop)
 *   6. Capture implementation screenshot
 *   7. Run Gemini pixel feedback (4-batch analysis)
 *   8. Apply fixes if needed
 *   9. Re-verify until parity achieved
 *
 * Usage:
 *   npm run pipeline:v2 -- single 243-2762
 *   npm run pipeline:v2 -- single 243-2762 --skip-extraction
 *   npm run pipeline:v2 -- single 243-2762 --verify-only
 *   npm run pipeline:v2 -- batch 243-2762 1-28055
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  figmaFileKey: 'HZaVuwWn6B6jOjrmxZ7Kzv',

  // API Keys (from environment)
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  paths: {
    root: path.join(__dirname, '..'),
    figmaParityData: path.join(__dirname, '../../figma-parity/data/screens'),
    aiEnhancedData: path.join(__dirname, '../data/ai-enhanced'),
    combinedOutput: path.join(__dirname, '../data/combined'),
    generatedComponents: path.join(__dirname, '../output/components'),
    screenshots: path.join(__dirname, '../output/screenshots'),
    figmaBaselines: path.join(__dirname, '../output/figma-baselines'),
    pixelFeedback: path.join(__dirname, '../analysis/pixel-feedback'),
    reports: path.join(__dirname, '../reports'),
  },

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

  // Verification settings
  verification: {
    maxIterations: 3,
    minParityScore: 95,
    screenshotDevice: 'iPhone 17 Pro',
  },
};

// ============================================
// TYPES
// ============================================

interface PipelineOptions {
  skipExtraction?: boolean;
  skipConversion?: boolean;
  verifyOnly?: boolean;
  maxIterations?: number;
}

interface PipelineStep {
  name: string;
  phase: 'preparation' | 'implementation' | 'verification';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
  output?: any;
}

interface GeminiFeedback {
  screenId: string;
  batches: {
    batch: number;
    type: string;
    issues: any[];
  }[];
  consolidatedFixes: any[];
  summary: {
    totalIssues: number;
    critical: number;
    major: number;
    minor: number;
  };
  parityScore: number;
}

interface PipelineResult {
  screenId: string;
  screenName: string;
  success: boolean;
  parityAchieved: boolean;
  finalParityScore: number;
  iterations: number;
  steps: PipelineStep[];
  outputPaths: Record<string, string>;
  duration: number;
  error?: string;
}

// ============================================
// LOGGER
// ============================================

class Logger {
  static info(msg: string) { console.log(`📋 ${msg}`); }
  static success(msg: string) { console.log(`✅ ${msg}`); }
  static warn(msg: string) { console.log(`⚠️  ${msg}`); }
  static error(msg: string) { console.log(`❌ ${msg}`); }
  static step(phase: string, num: number, total: number, msg: string) {
    const phaseIcon = phase === 'preparation' ? '🔧' : phase === 'implementation' ? '💻' : '🔍';
    console.log(`\n${phaseIcon} [${phase.toUpperCase()}] Step ${num}/${total}: ${msg}`);
  }
  static banner(title: string) {
    console.log('\n' + '═'.repeat(70));
    console.log(`  ${title}`);
    console.log('═'.repeat(70) + '\n');
  }
  static phase(name: string) {
    console.log('\n' + '─'.repeat(50));
    console.log(`  PHASE: ${name}`);
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

function execCommand(cmd: string, cwd?: string): { success: boolean; output: string; error?: string } {
  try {
    const output = execSync(cmd, {
      cwd: cwd || CONFIG.paths.root,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 300000, // 5 minutes
    });
    return { success: true, output };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message,
    };
  }
}

function getScreenCategory(screenId: string): string {
  const routesPath = path.join(CONFIG.paths.root, 'config/screen-routes.json');
  const routes = loadJson<any>(routesPath);

  if (!routes?.routes) return 'main';

  for (const [_, config] of Object.entries(routes.routes)) {
    const screens = (config as any).screens || [];
    if (screens.some((s: any) => s.figmaId === screenId)) {
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

// ============================================
// PIPELINE RUNNER
// ============================================

class PipelineRunnerV2 {
  private screenId: string;
  private options: PipelineOptions;
  private steps: PipelineStep[] = [];
  private startTime: Date;
  private iteration: number = 0;

  constructor(screenId: string, options: PipelineOptions = {}) {
    this.screenId = screenId;
    this.options = options;
    this.startTime = new Date();
  }

  async run(): Promise<PipelineResult> {
    Logger.banner(`Pipeline v2: ${this.screenId}`);

    let screenName = 'Unknown';
    let parityScore = 0;

    try {
      // ============================
      // PHASE 1: DATA PREPARATION
      // ============================
      Logger.phase('DATA PREPARATION');

      // Step 1: Check/Run extraction
      if (!this.options.skipExtraction && !this.options.verifyOnly) {
        const extractResult = await this.runStep('check_extraction', 'preparation', async () => {
          return this.checkOrRunExtraction();
        });
        if (!extractResult.output?.exists) {
          return this.createResult(false, 'Extraction failed', screenName, parityScore);
        }
      }

      // Step 2: Run universal converter
      if (!this.options.skipConversion && !this.options.verifyOnly) {
        await this.runStep('universal_converter', 'preparation', async () => {
          return this.runUniversalConverter();
        });
      }

      // Get screen name from extraction
      const extraction = loadJson<any>(
        path.join(CONFIG.paths.figmaParityData, this.screenId, 'extracted-values.json')
      );
      screenName = extraction?.screenName || `Screen ${this.screenId}`;

      // Step 3: Generate component template
      if (!this.options.verifyOnly) {
        await this.runStep('generate_template', 'preparation', async () => {
          return this.generateComponentTemplate();
        });
      }

      // ============================
      // PHASE 2: IMPLEMENTATION
      // ============================
      Logger.phase('IMPLEMENTATION');

      // Step 4: Generate implementation prompt for Claude
      await this.runStep('implementation_prompt', 'implementation', async () => {
        return this.generateImplementationPrompt();
      });

      // ============================
      // PHASE 3: VERIFICATION LOOP
      // ============================
      Logger.phase('VERIFICATION');

      const maxIterations = this.options.maxIterations || CONFIG.verification.maxIterations;

      for (this.iteration = 1; this.iteration <= maxIterations; this.iteration++) {
        Logger.info(`\n--- Verification Iteration ${this.iteration}/${maxIterations} ---\n`);

        // Step 5: Capture screenshot (if implementation exists)
        const screenshotResult = await this.runStep(
          `capture_screenshot_${this.iteration}`,
          'verification',
          async () => this.captureImplementationScreenshot()
        );

        // Step 6: Run Gemini pixel feedback
        const feedbackResult = await this.runStep(
          `gemini_feedback_${this.iteration}`,
          'verification',
          async () => this.runGeminiPixelFeedback()
        );

        if (feedbackResult.output) {
          parityScore = feedbackResult.output.parityScore || 0;

          if (parityScore >= CONFIG.verification.minParityScore) {
            Logger.success(`Parity achieved! Score: ${parityScore}%`);
            break;
          }

          // Step 7: Generate fix instructions
          if (this.iteration < maxIterations) {
            await this.runStep(
              `generate_fixes_${this.iteration}`,
              'verification',
              async () => this.generateFixInstructions(feedbackResult.output)
            );
          }
        }
      }

      // Generate final report
      await this.runStep('final_report', 'verification', async () => {
        return this.generateFinalReport(parityScore);
      });

      return this.createResult(
        true,
        undefined,
        screenName,
        parityScore
      );

    } catch (error: any) {
      return this.createResult(false, error.message, screenName, parityScore);
    }
  }

  private async runStep(
    name: string,
    phase: PipelineStep['phase'],
    fn: () => Promise<any>
  ): Promise<PipelineStep> {
    const stepNum = this.steps.filter(s => s.phase === phase).length + 1;
    const totalInPhase = phase === 'preparation' ? 3 : phase === 'implementation' ? 1 : 4;

    Logger.step(phase, stepNum, totalInPhase, name.replace(/_/g, ' '));

    const step: PipelineStep = {
      name,
      phase,
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
    step.duration = (step.endTime.getTime() - step.startTime!.getTime()) / 1000;

    return step;
  }

  // ============================
  // STEP IMPLEMENTATIONS
  // ============================

  private async checkOrRunExtraction(): Promise<{ exists: boolean; path: string; nodeCount: number }> {
    // Check local extraction first
    const localPath = path.join(CONFIG.paths.figmaParityData, this.screenId, 'extracted-values.json');
    if (fs.existsSync(localPath)) {
      const data = loadJson<any>(localPath);
      Logger.info(`Found local extraction: ${data?.nodes?.length || 0} nodes`);
      return { exists: true, path: localPath, nodeCount: data?.nodes?.length || 0 };
    }

    // Check AI-enhanced extraction
    const aiPath = path.join(CONFIG.paths.aiEnhancedData, this.screenId, 'enhanced-extraction.json');
    if (fs.existsSync(aiPath)) {
      const data = loadJson<any>(aiPath);
      Logger.info(`Found AI-enhanced extraction: ${data?.nodes?.length || 0} nodes`);
      return { exists: true, path: aiPath, nodeCount: data?.nodes?.length || 0 };
    }

    // Run AI-enhanced extraction
    Logger.info('No extraction found. Running AI-enhanced extraction...');
    const nodeIdApi = this.screenId.replace('-', ':');

    const result = execCommand(
      `npx ts-node scripts/extract-figma-ai-enhanced.ts "${nodeIdApi}" "Screen ${this.screenId}"`,
      CONFIG.paths.root
    );

    if (result.success || fs.existsSync(aiPath)) {
      const data = loadJson<any>(aiPath);
      return { exists: true, path: aiPath, nodeCount: data?.nodes?.length || 0 };
    }

    Logger.warn('Extraction not available. Please run extraction manually.');
    return { exists: false, path: '', nodeCount: 0 };
  }

  private async runUniversalConverter(): Promise<{ outputDir: string; styleCount: number }> {
    const result = execCommand(
      `npx ts-node scripts/universal-converter.ts convert ${this.screenId}`,
      CONFIG.paths.root
    );

    const outputDir = path.join(CONFIG.paths.combinedOutput, this.screenId);
    const styleMapPath = path.join(outputDir, 'style-map.json');
    const styleMap = loadJson<any[]>(styleMapPath) || [];

    Logger.info(`Generated ${styleMap.length} style entries`);

    return { outputDir, styleCount: styleMap.length };
  }

  private async generateComponentTemplate(): Promise<{ componentPath: string }> {
    const componentPath = path.join(CONFIG.paths.generatedComponents, `${this.screenId}.tsx`);

    if (fs.existsSync(componentPath)) {
      Logger.info(`Component template exists: ${componentPath}`);
    }

    return { componentPath };
  }

  private async generateImplementationPrompt(): Promise<{ promptPath: string }> {
    const outputDir = path.join(CONFIG.paths.combinedOutput, this.screenId);
    const promptPath = path.join(outputDir, 'claude-implementation-prompt.md');

    const styleMap = loadJson<any[]>(path.join(outputDir, 'style-map.json')) || [];
    const constants = loadJson<any>(path.join(outputDir, 'constants.json')) || {};

    const prompt = `# Claude Implementation Guide

## Screen: ${this.screenId}
## Figma File: ${CONFIG.figmaFileKey}
## Node ID: ${this.screenId.replace('-', ':')}

---

## STEP 1: Get Figma Semantic Structure

\`\`\`javascript
mcp__figma__get_design_context({
  fileKey: "${CONFIG.figmaFileKey}",
  nodeId: "${this.screenId.replace('-', ':')}"
})
\`\`\`

## STEP 2: Load Exact Styles

Style map location: \`${path.join(outputDir, 'style-map.json')}\`

Total styles: ${styleMap.length}

### Sample Styles:
${styleMap.slice(0, 5).map(s => `- ${s.rnStyleName}: ${JSON.stringify(s.rnStyles).slice(0, 100)}...`).join('\n')}

## STEP 3: Implement Component

1. Use MCP structure for hierarchy (parent-child relationships)
2. Use style-map.json for EXACT numerical values
3. Handle multi-span text with nested <Text> components
4. Use FIGMA constants object for organization

## STEP 4: Test

1. Build and run on simulator
2. Navigate to screen
3. Capture screenshot
4. Compare with Figma baseline

---

## Colors (from extraction)
${Object.entries(constants.colors?.values || {}).slice(0, 10).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Typography
${Object.entries(constants.typography?.values || {}).slice(0, 5).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n')}
`;

    saveFile(promptPath, prompt);
    Logger.info(`Implementation prompt saved: ${promptPath}`);

    return { promptPath };
  }

  private async captureImplementationScreenshot(): Promise<{ screenshotPath: string; captured: boolean }> {
    const screenshotDir = path.join(CONFIG.paths.screenshots, this.screenId);
    fs.mkdirSync(screenshotDir, { recursive: true });

    const screenshotPath = path.join(screenshotDir, `impl-iter${this.iteration}.png`);

    // Try to capture from simulator
    const result = execCommand(`xcrun simctl io booted screenshot "${screenshotPath}"`);

    if (result.success && fs.existsSync(screenshotPath)) {
      Logger.info(`Screenshot captured: ${screenshotPath}`);
      return { screenshotPath, captured: true };
    }

    Logger.warn('Could not capture screenshot. Simulator may not be running.');
    return { screenshotPath: '', captured: false };
  }

  private async runGeminiPixelFeedback(): Promise<GeminiFeedback | null> {
    if (!CONFIG.geminiApiKey) {
      Logger.warn('GEMINI_API_KEY not set. Skipping pixel feedback.');
      return null;
    }

    Logger.info('Running Gemini pixel feedback analysis...');

    // Find the route for this screen ID
    const route = this.findRouteForScreen(this.screenId);
    if (!route) {
      Logger.warn(`No route found for screen ${this.screenId}. Skipping Gemini feedback.`);
      return null;
    }

    Logger.info(`Using route: ${route}`);

    // Call the gemini-pixel-feedback script in figma-parity directory
    const figmaParityDir = path.join(CONFIG.paths.root, '..', 'figma-parity');
    const result = execCommand(
      `GEMINI_API_KEY="${CONFIG.geminiApiKey}" npx ts-node scripts/gemini-pixel-feedback.ts ${route}`,
      figmaParityDir
    );

    // Load the generated feedback from figma-parity output
    const figmaFeedbackDir = path.join(figmaParityDir, 'analysis', 'pixel-feedback');
    const feedbackFiles = fs.existsSync(figmaFeedbackDir)
      ? fs.readdirSync(figmaFeedbackDir).filter(f => f.startsWith(route) && f.endsWith('.json'))
      : [];

    // Get the most recent feedback file
    if (feedbackFiles.length > 0) {
      const latestFeedback = feedbackFiles.sort().reverse()[0];
      const feedbackPath = path.join(figmaFeedbackDir, latestFeedback);
      const feedback = loadJson<any>(feedbackPath);

      // Copy to our local feedback directory
      const localFeedbackPath = path.join(CONFIG.paths.pixelFeedback, `${this.screenId}.json`);
      fs.mkdirSync(CONFIG.paths.pixelFeedback, { recursive: true });
      fs.copyFileSync(feedbackPath, localFeedbackPath);

      // Calculate parity score from issues
      const totalIssues = feedback?.summary?.totalIssues || 0;
      const critical = feedback?.summary?.critical || 0;
      const major = feedback?.summary?.major || 0;

      // Simple scoring: start at 100, deduct points for issues
      let parityScore = 100 - (critical * 15) - (major * 5) - (totalIssues - critical - major);
      parityScore = Math.max(0, Math.min(100, parityScore));

      Logger.info(`Parity score: ${parityScore}% (${totalIssues} issues: ${critical} critical, ${major} major)`);

      return {
        screenId: this.screenId,
        batches: feedback?.batches || [],
        consolidatedFixes: feedback?.consolidatedFixes || [],
        summary: feedback?.summary || { totalIssues: 0, critical: 0, major: 0, minor: 0 },
        parityScore,
      };
    }

    Logger.warn('No feedback file generated. Check script output.');
    return null;
  }

  private findRouteForScreen(screenId: string): string | null {
    // Load screen-routes.json from figma-parity
    const routesPath = path.join(CONFIG.paths.root, '..', 'figma-parity', 'config', 'screen-routes.json');
    const routes = loadJson<any>(routesPath);

    if (!routes?.routes) return null;

    for (const [routeName, config] of Object.entries(routes.routes)) {
      const screens = (config as any).screens || [];
      if (screens.some((s: any) => s.figmaId === screenId)) {
        return routeName;
      }
    }

    return null;
  }

  private async generateFixInstructions(feedback: GeminiFeedback): Promise<{ fixesPath: string }> {
    const outputDir = path.join(CONFIG.paths.combinedOutput, this.screenId);
    const fixesPath = path.join(outputDir, `fixes-iter${this.iteration}.md`);

    const fixes = feedback.consolidatedFixes || [];

    const content = `# Fix Instructions - Iteration ${this.iteration}

## Summary
- Total Issues: ${feedback.summary.totalIssues}
- Critical: ${feedback.summary.critical}
- Major: ${feedback.summary.major}
- Minor: ${feedback.summary.minor}
- Current Parity Score: ${feedback.parityScore}%

## Required Fixes

${fixes.map((fix: any, i: number) => `
### ${i + 1}. ${fix.property || 'Style Fix'} (${fix.severity})

**File:** ${fix.file || 'Unknown'}
**Explanation:** ${fix.explanation || 'No explanation'}

**Current:**
\`\`\`
${fix.currentCode || fix.currentValue || 'Unknown'}
\`\`\`

**Fixed:**
\`\`\`
${fix.fixedCode || fix.figmaValue || 'Unknown'}
\`\`\`
`).join('\n')}

## Apply These Fixes

Use Claude Code to apply the fixes above, then re-run verification:
\`\`\`
npm run pipeline:v2 -- single ${this.screenId} --verify-only
\`\`\`
`;

    saveFile(fixesPath, content);
    Logger.info(`Fix instructions saved: ${fixesPath}`);

    return { fixesPath };
  }

  private async generateFinalReport(parityScore: number): Promise<{ reportPath: string }> {
    const reportPath = path.join(CONFIG.paths.reports, `${this.screenId}-pipeline-report.json`);

    const report = {
      screenId: this.screenId,
      figmaFileKey: CONFIG.figmaFileKey,
      figmaNodeId: this.screenId.replace('-', ':'),
      generatedAt: new Date().toISOString(),
      iterations: this.iteration,
      finalParityScore: parityScore,
      parityAchieved: parityScore >= CONFIG.verification.minParityScore,
      steps: this.steps.map(s => ({
        name: s.name,
        phase: s.phase,
        status: s.status,
        duration: s.duration,
        error: s.error,
      })),
      outputPaths: {
        styleMap: path.join(CONFIG.paths.combinedOutput, this.screenId, 'style-map.json'),
        constants: path.join(CONFIG.paths.combinedOutput, this.screenId, 'constants.json'),
        component: path.join(CONFIG.paths.generatedComponents, `${this.screenId}.tsx`),
        screenshots: path.join(CONFIG.paths.screenshots, this.screenId),
        feedback: path.join(CONFIG.paths.pixelFeedback, `${this.screenId}.json`),
      },
    };

    saveJson(reportPath, report);
    Logger.info(`Final report saved: ${reportPath}`);

    return { reportPath };
  }

  private createResult(
    success: boolean,
    error: string | undefined,
    screenName: string,
    parityScore: number
  ): PipelineResult {
    const endTime = new Date();
    const duration = (endTime.getTime() - this.startTime.getTime()) / 1000;

    return {
      screenId: this.screenId,
      screenName,
      success,
      parityAchieved: parityScore >= CONFIG.verification.minParityScore,
      finalParityScore: parityScore,
      iterations: this.iteration,
      steps: this.steps,
      outputPaths: {
        styleMap: path.join(CONFIG.paths.combinedOutput, this.screenId, 'style-map.json'),
        constants: path.join(CONFIG.paths.combinedOutput, this.screenId, 'constants.json'),
        component: path.join(CONFIG.paths.generatedComponents, `${this.screenId}.tsx`),
      },
      duration,
      error,
    };
  }
}

// ============================================
// CLI
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse options
  const options: PipelineOptions = {
    skipExtraction: args.includes('--skip-extraction'),
    skipConversion: args.includes('--skip-conversion'),
    verifyOnly: args.includes('--verify-only'),
  };

  // Ensure directories exist
  Object.values(CONFIG.paths).forEach(p => {
    if (typeof p === 'string' && !p.includes('FlentApp')) {
      fs.mkdirSync(p, { recursive: true });
    }
  });

  switch (command) {
    case 'single': {
      const screenId = args[1];
      if (!screenId || screenId.startsWith('--')) {
        console.log('Usage: npm run pipeline:v2 -- single <screenId> [options]');
        console.log('Options:');
        console.log('  --skip-extraction  Skip extraction phase');
        console.log('  --skip-conversion  Skip conversion phase');
        console.log('  --verify-only      Only run verification (requires existing implementation)');
        process.exit(1);
      }

      const runner = new PipelineRunnerV2(screenId, options);
      const result = await runner.run();

      Logger.banner('Pipeline Complete');
      console.log(`Screen: ${result.screenName}`);
      console.log(`Success: ${result.success}`);
      console.log(`Parity Score: ${result.finalParityScore}%`);
      console.log(`Parity Achieved: ${result.parityAchieved}`);
      console.log(`Iterations: ${result.iterations}`);
      console.log(`Duration: ${result.duration.toFixed(1)}s`);

      if (!result.parityAchieved) {
        console.log('\nTo improve parity:');
        console.log(`1. Review fixes: cat data/combined/${screenId}/fixes-iter*.md`);
        console.log('2. Apply fixes manually or via Claude');
        console.log(`3. Re-verify: npm run pipeline:v2 -- single ${screenId} --verify-only`);
      }
      break;
    }

    case 'batch': {
      const screenIds = args.slice(1).filter(a => !a.startsWith('--'));
      const toProcess = screenIds.length > 0 ? screenIds : listAvailableScreens().slice(0, 5);

      Logger.banner(`Batch Pipeline: ${toProcess.length} screens`);

      const results: PipelineResult[] = [];
      for (const screenId of toProcess) {
        const runner = new PipelineRunnerV2(screenId, options);
        results.push(await runner.run());
      }

      // Summary
      Logger.banner('Batch Summary');
      const achieved = results.filter(r => r.parityAchieved);
      console.log(`Total: ${results.length}`);
      console.log(`Parity Achieved: ${achieved.length}`);
      console.log(`Avg Parity Score: ${(results.reduce((s, r) => s + r.finalParityScore, 0) / results.length).toFixed(1)}%`);
      break;
    }

    case 'list': {
      const screens = listAvailableScreens();
      Logger.banner('Available Screens');
      console.log(`Found ${screens.length} screens:\n`);
      screens.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
      break;
    }

    default:
      console.log(`
Full Pipeline v2 - With Gemini Integration

Usage:
  npm run pipeline:v2 -- <command> [options]

Commands:
  single <screenId>     Full pipeline for one screen
  batch [screenIds...]  Process multiple screens
  list                  List available screens

Options:
  --skip-extraction     Skip extraction phase (use existing)
  --skip-conversion     Skip conversion phase
  --verify-only         Only run verification loop

Examples:
  npm run pipeline:v2 -- single 243-2762
  npm run pipeline:v2 -- single 243-2762 --verify-only
  npm run pipeline:v2 -- batch 243-2762 1-28055

Pipeline Phases:
  1. DATA PREPARATION
     - Check/run AI-enhanced extraction (Gemini 3 Pro)
     - Run universal converter
     - Generate component template

  2. IMPLEMENTATION
     - Generate Claude implementation prompt
     - (Manual: Implement via Claude with Figma MCP)

  3. VERIFICATION LOOP
     - Capture implementation screenshot
     - Run Gemini pixel feedback (4-batch analysis)
     - Generate fix instructions
     - Repeat until parity achieved
`);
  }
}

main().catch(console.error);
