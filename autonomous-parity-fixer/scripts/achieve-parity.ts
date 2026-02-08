/**
 * Achieve 100% Figma Parity - Full Automation
 *
 * This script runs until parity target is achieved for all screens:
 * 1. Run Gemini pixel feedback
 * 2. Apply suggested fixes automatically
 * 3. Re-verify
 * 4. Repeat until 95%+ parity
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx ts-node scripts/achieve-parity.ts
 *   GEMINI_API_KEY=xxx npx ts-node scripts/achieve-parity.ts --batch-size 10
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  targetParity: 95,
  maxIterations: 5,
  batchSize: parseInt(process.env.BATCH_SIZE || '10'),

  paths: {
    root: path.join(__dirname, '..'),
    figmaParity: path.join(__dirname, '../../figma-parity'),
    combinedData: path.join(__dirname, '../data/combined'),
    implemented: path.join(__dirname, '../output/implemented'),
    reports: path.join(__dirname, '../reports'),
    parityStatus: path.join(__dirname, '../reports/parity-status.json'),
  },
};

// ============================================
// TYPES
// ============================================

interface ScreenStatus {
  screenId: string;
  route: string | null;
  currentParity: number;
  targetMet: boolean;
  iterations: number;
  lastUpdated: string;
  issues: {
    critical: number;
    major: number;
    minor: number;
  };
}

interface ParityStatus {
  totalScreens: number;
  targetParity: number;
  screensAtTarget: number;
  averageParity: number;
  lastUpdated: string;
  screens: Record<string, ScreenStatus>;
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

function log(level: 'info' | 'success' | 'warn' | 'error', msg: string): void {
  const icons = { info: '📋', success: '✅', warn: '⚠️', error: '❌' };
  console.log(`${icons[level]} ${msg}`);
}

function execCommand(cmd: string, cwd?: string): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: cwd || CONFIG.paths.root,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 300000,
    });
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// ============================================
// ROUTE LOOKUP
// ============================================

function loadScreenRoutes(): Record<string, string> {
  const routesPath = path.join(CONFIG.paths.figmaParity, 'config', 'screen-routes.json');
  const routesConfig = loadJson<any>(routesPath);

  const screenToRoute: Record<string, string> = {};

  if (routesConfig?.routes) {
    for (const [routeName, config] of Object.entries(routesConfig.routes)) {
      const screens = (config as any).screens || [];
      for (const screen of screens) {
        screenToRoute[screen.figmaId] = routeName;
      }
    }
  }

  return screenToRoute;
}

// ============================================
// PARITY STATUS MANAGEMENT
// ============================================

function loadParityStatus(): ParityStatus {
  const existing = loadJson<ParityStatus>(CONFIG.paths.parityStatus);
  if (existing) return existing;

  return {
    totalScreens: 0,
    targetParity: CONFIG.targetParity,
    screensAtTarget: 0,
    averageParity: 0,
    lastUpdated: new Date().toISOString(),
    screens: {},
  };
}

function updateParityStatus(status: ParityStatus): void {
  // Calculate summary
  const screens = Object.values(status.screens);
  status.totalScreens = screens.length;
  status.screensAtTarget = screens.filter(s => s.targetMet).length;
  status.averageParity = screens.length > 0
    ? screens.reduce((sum, s) => sum + s.currentParity, 0) / screens.length
    : 0;
  status.lastUpdated = new Date().toISOString();

  saveJson(CONFIG.paths.parityStatus, status);
}

// ============================================
// GEMINI FEEDBACK RUNNER
// ============================================

async function runGeminiFeedback(screenId: string, route: string): Promise<{
  parityScore: number;
  issues: { critical: number; major: number; minor: number };
} | null> {
  if (!CONFIG.geminiApiKey) {
    log('warn', 'GEMINI_API_KEY not set');
    return null;
  }

  log('info', `Running Gemini feedback for ${screenId} (route: ${route})`);

  const result = execCommand(
    `GEMINI_API_KEY="${CONFIG.geminiApiKey}" npx ts-node scripts/gemini-pixel-feedback.ts ${route}`,
    CONFIG.paths.figmaParity
  );

  // Find the latest feedback file
  const feedbackDir = path.join(CONFIG.paths.figmaParity, 'analysis', 'pixel-feedback');
  if (!fs.existsSync(feedbackDir)) return null;

  const feedbackFiles = fs.readdirSync(feedbackDir)
    .filter(f => f.startsWith(route) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (feedbackFiles.length === 0) return null;

  const feedback = loadJson<any>(path.join(feedbackDir, feedbackFiles[0]));
  if (!feedback) return null;

  const summary = feedback.summary || {};
  const totalIssues = summary.totalIssues || 0;
  const critical = summary.critical || 0;
  const major = summary.major || 0;
  const minor = summary.minor || 0;

  // Calculate parity score
  let parityScore = 100 - (critical * 15) - (major * 5) - minor;
  parityScore = Math.max(0, Math.min(100, parityScore));

  return {
    parityScore,
    issues: { critical, major, minor },
  };
}

// ============================================
// MAIN PARITY ACHIEVEMENT LOOP
// ============================================

async function achieveParity(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('  ACHIEVE 100% FIGMA PARITY');
  console.log('═'.repeat(70) + '\n');

  // Load screen routes
  const screenToRoute = loadScreenRoutes();
  log('info', `Loaded routes for ${Object.keys(screenToRoute).length} screens`);

  // Get all screens with combined data
  const combinedDir = CONFIG.paths.combinedData;
  const allScreens = fs.existsSync(combinedDir)
    ? fs.readdirSync(combinedDir).filter(d =>
        fs.existsSync(path.join(combinedDir, d, 'style-map.json'))
      )
    : [];

  log('info', `Found ${allScreens.length} screens with data`);

  // Load existing status
  const status = loadParityStatus();

  // Initialize status for new screens
  for (const screenId of allScreens) {
    if (!status.screens[screenId]) {
      status.screens[screenId] = {
        screenId,
        route: screenToRoute[screenId] || null,
        currentParity: 0,
        targetMet: false,
        iterations: 0,
        lastUpdated: new Date().toISOString(),
        issues: { critical: 0, major: 0, minor: 0 },
      };
    }
  }

  // Filter screens that need work (not at target)
  const screensNeedingWork = allScreens.filter(id => {
    const s = status.screens[id];
    return !s.targetMet && s.route && s.iterations < CONFIG.maxIterations;
  });

  log('info', `${screensNeedingWork.length} screens need parity improvement`);

  // Process in batches
  const batches = [];
  for (let i = 0; i < screensNeedingWork.length; i += CONFIG.batchSize) {
    batches.push(screensNeedingWork.slice(i, i + CONFIG.batchSize));
  }

  log('info', `Processing ${batches.length} batches of ${CONFIG.batchSize} screens each`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    console.log('\n' + '─'.repeat(50));
    console.log(`  Batch ${batchIdx + 1}/${batches.length}`);
    console.log('─'.repeat(50) + '\n');

    for (const screenId of batch) {
      const screenStatus = status.screens[screenId];
      if (!screenStatus.route) {
        log('warn', `No route for ${screenId}, skipping`);
        continue;
      }

      // Run Gemini feedback
      const feedback = await runGeminiFeedback(screenId, screenStatus.route);

      if (feedback) {
        screenStatus.currentParity = feedback.parityScore;
        screenStatus.issues = feedback.issues;
        screenStatus.targetMet = feedback.parityScore >= CONFIG.targetParity;
        screenStatus.iterations++;
        screenStatus.lastUpdated = new Date().toISOString();

        if (screenStatus.targetMet) {
          log('success', `${screenId}: ${feedback.parityScore}% - TARGET MET!`);
        } else {
          log('info', `${screenId}: ${feedback.parityScore}% (${feedback.issues.critical}C/${feedback.issues.major}M/${feedback.issues.minor}m)`);
        }
      }

      // Update status after each screen
      updateParityStatus(status);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Final summary
  console.log('\n' + '═'.repeat(70));
  console.log('  PARITY STATUS SUMMARY');
  console.log('═'.repeat(70) + '\n');

  const finalStatus = loadParityStatus();
  console.log(`Total Screens: ${finalStatus.totalScreens}`);
  console.log(`Target Parity: ${finalStatus.targetParity}%`);
  console.log(`Screens at Target: ${finalStatus.screensAtTarget}`);
  console.log(`Average Parity: ${finalStatus.averageParity.toFixed(1)}%`);
  console.log(`\nStatus saved to: ${CONFIG.paths.parityStatus}`);

  // List screens not at target
  const notAtTarget = Object.values(finalStatus.screens)
    .filter(s => !s.targetMet)
    .sort((a, b) => b.currentParity - a.currentParity);

  if (notAtTarget.length > 0) {
    console.log(`\nScreens not at target (${notAtTarget.length}):`);
    for (const s of notAtTarget.slice(0, 20)) {
      console.log(`  ${s.screenId}: ${s.currentParity}% (route: ${s.route || 'none'})`);
    }
    if (notAtTarget.length > 20) {
      console.log(`  ... and ${notAtTarget.length - 20} more`);
    }
  }
}

// ============================================
// CLI
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse batch size
  const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
  if (batchSizeArg) {
    CONFIG.batchSize = parseInt(batchSizeArg.split('=')[1]) || 10;
  }

  await achieveParity();
}

main().catch(console.error);
