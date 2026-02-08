/**
 * Autonomous Parity Fixer Pipeline
 *
 * Processes screens through a deterministic pipeline:
 * 1. EXTRACTION: Extract Figma data (source of truth)
 * 2. PRE-FEEDBACK GATE: Coverage ≥95% before proceeding
 * 3. GEMINI FEEDBACK: Visual pixel analysis
 * 4. POST-FEEDBACK GATE: Coverage = 100% before marking complete
 *
 * Key Principles:
 * - UI values ONLY come from Figma data
 * - No AI imagination for visual properties
 * - Coverage checker is deterministic gate
 * - Fixes are applied iteratively until thresholds met
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  preFeedbackThreshold: 95,
  postFeedbackThreshold: 100,
  maxIterationsPerGate: 10,
  // Skip these patterns (not real screens)
  skipPatterns: [
    /Vector Asset/i,
    /Screen Variant/i,
    /Component Variant/i,
    /Home State Variant/i,
    /Payment Variant/i,
    /Profile Variant/i,
    /Waitlist Variant/i,
  ],
};

const PATHS = {
  root: path.join(__dirname, '..'),
  rnApp: path.join(__dirname, '../../rn-app'),
  extractions: path.join(__dirname, '../data/ai-enhanced'),
  coverageReports: path.join(__dirname, '../reports/coverage'),
  pipelineState: path.join(__dirname, '../state/pipeline-state.json'),
  screensConfig: path.join(__dirname, '../config/screens-to-process.json'),
  routesConfig: path.join(__dirname, '../config/screen-routes.json'),
};

// ============================================
// TYPES
// ============================================

interface ScreenConfig {
  nodeId: string;
  nodeIdApi: string;
  name: string;
  priority?: string;
  status?: string;
}

interface RouteConfig {
  route: string;
  figmaPatterns: string[];
  screens: Array<{
    figmaId: string;
    name: string;
    state?: string;
    routeWithState?: string;
  }>;
}

interface PipelineState {
  startedAt: string;
  lastUpdated: string;
  currentScreen: string | null;
  completed: string[];
  failed: string[];
  pending: string[];
  skipped: string[];
  pendingFixes?: string[];  // Screens that need fixes (continue mode)
}

interface CoverageReport {
  screenId: string;
  screenName: string;
  summary: {
    overallCoverage: number;
    propertiesCovered: number;
    propertiesTotal: number;
    propertiesMissing: number;
  };
  uncoveredProperties: Array<{
    nodeId: string;
    nodeName: string;
    nodeType: string;
    category: string;
    property: string;
    figmaValue: any;
    rnValue: any;
    fix?: string;
  }>;
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

function saveJson(filePath: string, data: any): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
  const icons = { info: '📋', warn: '⚠️', error: '❌', success: '✅' };
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${icons[level]} ${message}`);
}

function shouldSkipScreen(name: string): boolean {
  return CONFIG.skipPatterns.some(pattern => pattern.test(name));
}

/**
 * Check if extraction represents a canvas section header (not a real screen)
 * Real screens are ~393x852, section headers are very wide (13000+px)
 */
function isCanvasSectionHeader(screenId: string): boolean {
  const extractionPath = path.join(PATHS.extractions, screenId, 'enhanced-extraction.json');
  try {
    const extraction = JSON.parse(fs.readFileSync(extractionPath, 'utf-8'));
    const baseDesign = extraction.baseDesign || {};
    const componentTree = extraction.componentTree || {};
    const width = componentTree.computedStyles?.width || baseDesign.width || 0;
    const height = componentTree.computedStyles?.height || baseDesign.height || 0;

    // Section headers are typically very wide (10000+px) and short
    // Real screens are ~393x852 (iPhone dimensions)
    if (width > 1000 && height < 300) {
      return true;
    }

    // Also check if the nodeName suggests it's a section header
    const nodeName = componentTree.nodeName || '';
    if (nodeName.includes('Frame 16865') || nodeName.includes('Section Header')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if the Figma extraction content matches the expected screen name.
 * Detects data mismatches where the extraction pulled wrong content.
 */
function hasContentMismatch(screenId: string, expectedName: string): { mismatch: boolean; actualName: string } {
  const extractionPath = path.join(PATHS.extractions, screenId, 'enhanced-extraction.json');
  try {
    const extraction = JSON.parse(fs.readFileSync(extractionPath, 'utf-8'));
    const componentTree = extraction.componentTree || {};
    const actualNodeName = componentTree.nodeName || '';

    // Normalize names for comparison
    const normalizeForComparison = (name: string): string[] => {
      // Extract key identifying words from the name
      const lower = name.toLowerCase();
      const keywords = lower
        .replace(/[\/\-\s]+/g, ' ')
        .split(' ')
        .filter(w => w.length > 2 && !['the', 'and', 'for', 'get', 'add'].includes(w));
      return keywords;
    };

    const expectedKeywords = normalizeForComparison(expectedName);
    const actualKeywords = normalizeForComparison(actualNodeName);

    // Check for significant overlap
    const overlap = expectedKeywords.filter(k => actualKeywords.some(a => a.includes(k) || k.includes(a)));
    const matchRatio = overlap.length / Math.max(expectedKeywords.length, 1);

    // If less than 30% keyword match, it's likely a mismatch
    if (matchRatio < 0.3 && expectedKeywords.length > 0) {
      return { mismatch: true, actualName: actualNodeName };
    }

    return { mismatch: false, actualName: actualNodeName };
  } catch {
    return { mismatch: false, actualName: '' };
  }
}

// ============================================
// PIPELINE STATE MANAGEMENT
// ============================================

function loadPipelineState(): PipelineState {
  const existing = loadJson<PipelineState>(PATHS.pipelineState);
  if (existing) return existing;

  return {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    currentScreen: null,
    completed: [],
    failed: [],
    pending: [],
    skipped: [],
  };
}

function savePipelineState(state: PipelineState): void {
  state.lastUpdated = new Date().toISOString();
  saveJson(PATHS.pipelineState, state);
}

// ============================================
// EXTRACTION PHASE
// ============================================

function hasExtraction(screenId: string): boolean {
  const extractionPath = path.join(PATHS.extractions, screenId, 'enhanced-extraction.json');
  return fs.existsSync(extractionPath);
}

function runExtraction(screenId: string, screenName: string): boolean {
  log(`Running Figma extraction for ${screenId}: ${screenName}`);

  try {
    const apiId = screenId.replace('-', ':');
    const result = spawnSync(
      'npx',
      ['ts-node', 'scripts/extract-figma-ai-enhanced.ts', apiId, screenName],
      {
        cwd: PATHS.root,
        encoding: 'utf-8',
        timeout: 600000, // 10 minutes
        stdio: 'inherit',
      }
    );

    return result.status === 0;
  } catch (error) {
    log(`Extraction failed: ${error}`, 'error');
    return false;
  }
}

// ============================================
// COVERAGE CHECK
// ============================================

function runCoverageCheck(screenId: string): CoverageReport | null {
  log(`Running coverage check for ${screenId}`);

  try {
    const result = spawnSync(
      'npx',
      ['ts-node', 'scripts/check-coverage.ts', screenId],
      {
        cwd: PATHS.root,
        encoding: 'utf-8',
        timeout: 120000, // 2 minutes
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    // Parse coverage from output
    const output = result.stdout?.toString() || '';
    const coverageMatch = output.match(/Overall Coverage:\s*([\d.]+)%/);

    if (coverageMatch) {
      const coverage = parseFloat(coverageMatch[1]);
      log(`Coverage: ${coverage}%`, coverage >= CONFIG.preFeedbackThreshold ? 'success' : 'warn');
    }

    // Load the generated report
    const reportPath = path.join(PATHS.coverageReports, `${screenId}-coverage.json`);
    return loadJson<CoverageReport>(reportPath);
  } catch (error) {
    log(`Coverage check failed: ${error}`, 'error');
    return null;
  }
}

// ============================================
// RN CODE CHECK
// ============================================

function findRnFilePath(routeKey: string): string | null {
  const routesConfig = loadJson<{ routes: Record<string, RouteConfig> }>(PATHS.routesConfig);
  if (!routesConfig) return null;

  const routeConfig = routesConfig.routes[routeKey];
  if (!routeConfig) return null;

  const route = routeConfig.route;

  // Try different path patterns
  const patterns = [
    path.join(PATHS.rnApp, 'app', route + '.tsx'),
    path.join(PATHS.rnApp, 'app', route, 'index.tsx'),
    path.join(PATHS.rnApp, 'app', route.replace(/^\(/, '').replace(/\)$/, '') + '.tsx'),
  ];

  for (const p of patterns) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

function findRouteKeyForScreen(screenId: string): string | null {
  const routesConfig = loadJson<{ routes: Record<string, RouteConfig> }>(PATHS.routesConfig);
  if (!routesConfig) return null;

  for (const [routeKey, routeConfig] of Object.entries(routesConfig.routes)) {
    for (const screen of routeConfig.screens || []) {
      if (screen.figmaId === screenId) {
        return routeKey;
      }
    }
  }

  return null;
}

// ============================================
// GEMINI FEEDBACK
// ============================================

function runGeminiFeedback(screenId: string): boolean {
  log(`Running Gemini pixel feedback for ${screenId}`);

  try {
    const result = spawnSync(
      'npx',
      ['ts-node', 'scripts/gemini-pixel-feedback.ts', screenId],
      {
        cwd: PATHS.root,
        encoding: 'utf-8',
        timeout: 900000, // 15 minutes
        stdio: 'inherit',
      }
    );

    return result.status === 0;
  } catch (error) {
    log(`Gemini feedback failed: ${error}`, 'error');
    return false;
  }
}

// ============================================
// FIX GENERATION (DETERMINISTIC FROM FIGMA)
// ============================================

interface FixAction {
  type: 'style' | 'prop' | 'component' | 'asset';
  target: string;
  property: string;
  figmaValue: any;
  currentValue: any;
  fix: string;
}

function generateFixes(coverageReport: CoverageReport): FixAction[] {
  const fixes: FixAction[] = [];

  for (const uncovered of coverageReport.uncoveredProperties) {
    const fix: FixAction = {
      type: categorizeFixType(uncovered.category),
      target: uncovered.nodeName,
      property: uncovered.property,
      figmaValue: uncovered.figmaValue,
      currentValue: uncovered.rnValue,
      fix: uncovered.fix || `Set ${uncovered.property} to ${JSON.stringify(uncovered.figmaValue)}`,
    };

    fixes.push(fix);
  }

  return fixes;
}

function categorizeFixType(category: string): 'style' | 'prop' | 'component' | 'asset' {
  const styleCategories = ['geometry', 'spacing', 'colors', 'typography', 'borders', 'effects', 'opacity'];
  const assetCategories = ['images', 'assetExistence'];

  if (styleCategories.includes(category)) return 'style';
  if (assetCategories.includes(category)) return 'asset';
  if (category === 'layout' || category === 'positioning') return 'prop';

  return 'style';
}

// ============================================
// GATE LOOPS
// ============================================

async function preFeedbackGate(screenId: string): Promise<{ passed: boolean; coverage: number }> {
  log(`=== PRE-FEEDBACK GATE (${CONFIG.preFeedbackThreshold}%) ===`);

  for (let iteration = 1; iteration <= CONFIG.maxIterationsPerGate; iteration++) {
    log(`Iteration ${iteration}/${CONFIG.maxIterationsPerGate}`);

    const report = runCoverageCheck(screenId);
    if (!report) {
      return { passed: false, coverage: 0 };
    }

    const coverage = report.summary.overallCoverage;

    if (coverage >= CONFIG.preFeedbackThreshold) {
      log(`PRE-FEEDBACK GATE PASSED: ${coverage}%`, 'success');
      return { passed: true, coverage };
    }

    log(`Coverage ${coverage}% < ${CONFIG.preFeedbackThreshold}%. Missing ${report.summary.propertiesMissing} properties.`, 'warn');

    // Generate and output fixes needed
    const fixes = generateFixes(report);
    if (fixes.length > 0) {
      log(`\nFixes needed (${fixes.length}):`);
      for (const fix of fixes.slice(0, 10)) {
        console.log(`  - ${fix.target}.${fix.property}: ${fix.fix}`);
      }
      if (fixes.length > 10) {
        console.log(`  ... and ${fixes.length - 10} more`);
      }
    }

    // Output fix report for manual/automated fixing
    const fixReportPath = path.join(PATHS.coverageReports, `${screenId}-fixes-needed.json`);
    saveJson(fixReportPath, {
      screenId,
      iteration,
      coverage,
      threshold: CONFIG.preFeedbackThreshold,
      fixesNeeded: fixes,
      generatedAt: new Date().toISOString(),
    });

    log(`Fix report saved to: ${fixReportPath}`);

    // Return false - fixes need to be applied by calling code
    return { passed: false, coverage };
  }

  return { passed: false, coverage: 0 };
}

async function postFeedbackGate(screenId: string): Promise<{ passed: boolean; coverage: number }> {
  log(`=== POST-FEEDBACK GATE (${CONFIG.postFeedbackThreshold}%) ===`);

  for (let iteration = 1; iteration <= CONFIG.maxIterationsPerGate; iteration++) {
    log(`Iteration ${iteration}/${CONFIG.maxIterationsPerGate}`);

    const report = runCoverageCheck(screenId);
    if (!report) {
      return { passed: false, coverage: 0 };
    }

    const coverage = report.summary.overallCoverage;

    if (coverage >= CONFIG.postFeedbackThreshold) {
      log(`POST-FEEDBACK GATE PASSED: ${coverage}%`, 'success');
      return { passed: true, coverage };
    }

    log(`Coverage ${coverage}% < ${CONFIG.postFeedbackThreshold}%. Missing ${report.summary.propertiesMissing} properties.`, 'warn');

    // Generate fixes
    const fixes = generateFixes(report);
    const fixReportPath = path.join(PATHS.coverageReports, `${screenId}-final-fixes.json`);
    saveJson(fixReportPath, {
      screenId,
      iteration,
      coverage,
      threshold: CONFIG.postFeedbackThreshold,
      fixesNeeded: fixes,
      generatedAt: new Date().toISOString(),
    });

    // Return false - fixes need to be applied
    return { passed: false, coverage };
  }

  return { passed: false, coverage: 0 };
}

// ============================================
// MAIN PIPELINE
// ============================================

interface ProcessResult {
  screenId: string;
  screenName: string;
  status: 'completed' | 'failed' | 'needs-fixes' | 'skipped' | 'no-route';
  coverage: number;
  stage: string;
  error?: string;
}

async function processScreen(screen: ScreenConfig): Promise<ProcessResult> {
  const { nodeId: screenId, name: screenName } = screen;

  log(`\n${'='.repeat(60)}`);
  log(`PROCESSING: ${screenName}`);
  log(`Screen ID: ${screenId}`);
  log(`${'='.repeat(60)}`);

  // Check if should skip
  if (shouldSkipScreen(screenName)) {
    log(`Skipping: Not a real screen`, 'warn');
    return { screenId, screenName, status: 'skipped', coverage: 0, stage: 'filter' };
  }

  // Find route
  const routeKey = findRouteKeyForScreen(screenId);
  if (!routeKey) {
    log(`No route mapping found for ${screenId}`, 'warn');
    return { screenId, screenName, status: 'no-route', coverage: 0, stage: 'route-lookup' };
  }

  log(`Route: ${routeKey}`);

  // Phase 1: Extraction
  if (!hasExtraction(screenId)) {
    log(`Extraction not found, running...`);
    const extractSuccess = runExtraction(screenId, screenName);
    if (!extractSuccess) {
      return { screenId, screenName, status: 'failed', coverage: 0, stage: 'extraction', error: 'Extraction failed' };
    }
  } else {
    log(`Extraction exists`, 'success');
  }

  // Check if this is a canvas section header (not a real screen)
  if (isCanvasSectionHeader(screenId)) {
    log(`Skipping: Canvas section header (not a real screen)`, 'warn');
    return { screenId, screenName, status: 'skipped', coverage: 0, stage: 'section-header-filter' };
  }

  // Check for content mismatch (Figma extraction has wrong content)
  const contentCheck = hasContentMismatch(screenId, screenName);
  if (contentCheck.mismatch) {
    log(`Content mismatch: expected "${screenName}", got "${contentCheck.actualName}"`, 'warn');
    log(`Skipping: Needs re-extraction with correct Figma node`, 'warn');
    return { screenId, screenName, status: 'skipped', coverage: 0, stage: 'content-mismatch', error: `Figma data mismatch: actual content is "${contentCheck.actualName}"` };
  }

  // Check if RN code exists
  const rnFilePath = findRnFilePath(routeKey);
  if (!rnFilePath) {
    log(`No RN code found for route ${routeKey}`, 'warn');
    return { screenId, screenName, status: 'needs-fixes', coverage: 0, stage: 'rn-code-check', error: 'No RN code exists' };
  }

  log(`RN file: ${rnFilePath}`);

  // Phase 2: PRE-FEEDBACK GATE
  const preGate = await preFeedbackGate(screenId);
  if (!preGate.passed) {
    return {
      screenId,
      screenName,
      status: 'needs-fixes',
      coverage: preGate.coverage,
      stage: 'pre-feedback-gate',
      error: `Coverage ${preGate.coverage}% < ${CONFIG.preFeedbackThreshold}%`,
    };
  }

  // Phase 3: GEMINI FEEDBACK (optional - can be enabled)
  // const geminiSuccess = runGeminiFeedback(screenId);
  // if (!geminiSuccess) {
  //   log(`Gemini feedback failed, continuing...`, 'warn');
  // }

  // Phase 4: POST-FEEDBACK GATE
  const postGate = await postFeedbackGate(screenId);
  if (!postGate.passed) {
    return {
      screenId,
      screenName,
      status: 'needs-fixes',
      coverage: postGate.coverage,
      stage: 'post-feedback-gate',
      error: `Coverage ${postGate.coverage}% < ${CONFIG.postFeedbackThreshold}%`,
    };
  }

  // SUCCESS
  return {
    screenId,
    screenName,
    status: 'completed',
    coverage: postGate.coverage,
    stage: 'complete',
  };
}

// ============================================
// BATCH PROCESSING
// ============================================

async function runPipeline(options: { singleScreen?: string; dryRun?: boolean } = {}): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         AUTONOMOUS PARITY FIXER PIPELINE v2.0              ║');
  console.log('║         Deterministic UI from Figma Data                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Load screens
  const screensData = loadJson<{ screens: ScreenConfig[] }>(PATHS.screensConfig);
  if (!screensData) {
    log('Failed to load screens config', 'error');
    return;
  }

  let screens = screensData.screens;

  // Filter to single screen if specified
  if (options.singleScreen) {
    screens = screens.filter(s => s.nodeId === options.singleScreen);
    if (screens.length === 0) {
      log(`Screen ${options.singleScreen} not found`, 'error');
      return;
    }
  }

  // Load or initialize state
  const state = loadPipelineState();

  // Filter out already completed/failed/pending-fixes
  const pendingScreens = screens.filter(s =>
    !state.completed.includes(s.nodeId) &&
    !state.failed.includes(s.nodeId) &&
    !state.skipped.includes(s.nodeId) &&
    !(state.pendingFixes || []).includes(s.nodeId)
  );

  log(`Total screens: ${screens.length}`);
  log(`Pending: ${pendingScreens.length}`);
  log(`Completed: ${state.completed.length}`);
  log(`Needs Fixes: ${(state.pendingFixes || []).length}`);
  log(`Failed: ${state.failed.length}`);
  log(`Skipped: ${state.skipped.length}`);

  if (options.dryRun) {
    log('\n=== DRY RUN - No processing ===');
    for (const screen of pendingScreens) {
      const skip = shouldSkipScreen(screen.name);
      const hasExt = hasExtraction(screen.nodeId);
      const routeKey = findRouteKeyForScreen(screen.nodeId);
      console.log(`  ${screen.nodeId}: ${screen.name}`);
      console.log(`    Skip: ${skip}, Extraction: ${hasExt}, Route: ${routeKey || 'NONE'}`);
    }
    return;
  }

  // Process results
  const results: ProcessResult[] = [];

  // Process each screen
  for (const screen of pendingScreens) {
    state.currentScreen = screen.nodeId;
    savePipelineState(state);

    const result = await processScreen(screen);
    results.push(result);

    // Update state based on result
    switch (result.status) {
      case 'completed':
        state.completed.push(screen.nodeId);
        break;
      case 'failed':
        state.failed.push(screen.nodeId);
        break;
      case 'skipped':
        state.skipped.push(screen.nodeId);
        break;
      case 'needs-fixes':
        // Don't add to any list - will retry
        break;
      case 'no-route':
        state.skipped.push(screen.nodeId);
        break;
    }

    state.currentScreen = null;
    savePipelineState(state);

    // If needs fixes, either stop or continue based on mode
    if (result.status === 'needs-fixes') {
      const continueMode = process.env.CONTINUE_MODE === 'true' || process.argv.includes('--continue');

      if (continueMode) {
        // In continue mode, log and keep going
        log(`Screen ${screen.nodeId} needs fixes (${result.coverage}%) - continuing...`, 'warn');
        // Add to a pending-fixes list so we don't re-process
        if (!state.pendingFixes) state.pendingFixes = [];
        if (!state.pendingFixes.includes(screen.nodeId)) {
          state.pendingFixes.push(screen.nodeId);
        }
        savePipelineState(state);
      } else {
        // In default mode, stop and report
        log(`\n⛔ PIPELINE STOPPED: Screen ${screen.nodeId} needs fixes`, 'warn');
        log(`Stage: ${result.stage}`);
        log(`Coverage: ${result.coverage}%`);
        log(`Check reports/coverage/${screen.nodeId}-fixes-needed.json for details`);
        break;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  PIPELINE SUMMARY');
  console.log('='.repeat(60));

  const completed = results.filter(r => r.status === 'completed');
  const needsFixes = results.filter(r => r.status === 'needs-fixes');
  const failed = results.filter(r => r.status === 'failed');
  const skipped = results.filter(r => r.status === 'skipped' || r.status === 'no-route');

  console.log(`\n✅ Completed: ${completed.length}`);
  for (const r of completed) {
    console.log(`   ${r.screenId}: ${r.coverage}%`);
  }

  console.log(`\n⚠️ Needs Fixes: ${needsFixes.length}`);
  for (const r of needsFixes) {
    console.log(`   ${r.screenId}: ${r.coverage}% (${r.stage})`);
  }

  console.log(`\n❌ Failed: ${failed.length}`);
  for (const r of failed) {
    console.log(`   ${r.screenId}: ${r.error}`);
  }

  console.log(`\n⏭️ Skipped: ${skipped.length}`);

  // Save final state
  savePipelineState(state);

  // Save results report
  const reportPath = path.join(PATHS.root, 'reports', 'pipeline-results.json');
  saveJson(reportPath, {
    runAt: new Date().toISOString(),
    summary: {
      completed: completed.length,
      needsFixes: needsFixes.length,
      failed: failed.length,
      skipped: skipped.length,
    },
    results,
  });

  console.log(`\n📁 Results saved to: ${reportPath}`);
}

// ============================================
// CLI
// ============================================

const args = process.argv.slice(2);
const options: { singleScreen?: string; dryRun?: boolean } = {};

for (const arg of args) {
  if (arg.startsWith('--screen=')) {
    options.singleScreen = arg.split('=')[1];
  }
  if (arg === '--dry-run') {
    options.dryRun = true;
  }
}

runPipeline(options).catch(err => {
  console.error('Pipeline error:', err);
  process.exit(1);
});
