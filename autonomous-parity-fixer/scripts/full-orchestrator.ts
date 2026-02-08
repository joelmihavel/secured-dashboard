/**
 * Full Autonomous Parity Fixer Orchestrator
 *
 * This script orchestrates the complete pipeline:
 * 1. Extraction (script)
 * 2. Analysis (script)
 * 3. Review Round with 3 parallel sub-agents
 * 4. 3 Feedback Rounds with 3 parallel sub-agents each
 * 5. Verification
 *
 * Sub-agents are spawned via Claude Code Task tool externally.
 * This script handles extraction, analysis, and state management.
 *
 * The actual sub-agent spawning happens in the parent Claude Code session.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Directories
const BASE_DIR = path.join(__dirname, '..');
const CONFIG_DIR = path.join(BASE_DIR, 'config');
const DATA_DIR = path.join(BASE_DIR, 'data', 'ai-enhanced');
const ANALYSIS_DIR = path.join(BASE_DIR, 'analysis', 'pixel-feedback');
const STATE_DIR = path.join(BASE_DIR, 'state');
const RN_APP_DIR = path.join(BASE_DIR, '..', 'rn-app');

// Types
interface DesignConfig {
  nodeId: string;
  nodeIdApi: string;
  name: string;
  priority?: string;
  status?: string;
}

interface ProcessingState {
  designId: string;
  name: string;
  phase: 'extraction' | 'analysis' | 'review' | 'feedback_1' | 'feedback_2' | 'feedback_3' | 'verification' | 'completed' | 'failed';
  extractionPath?: string;
  analysisPath?: string;
  issueCount?: number;
  reviewRoundComplete?: boolean;
  feedbackRoundsComplete?: number;
  parityScore?: number;
  error?: string;
  updatedAt: string;
}

interface BatchProgress {
  totalDesigns: number;
  completed: number;
  failed: number;
  inProgress: number;
  pending: number;
  currentDesignId: string | null;
  startedAt: string | null;
  lastUpdated: string | null;
}

// Helper: Run a script
async function runScript(scriptName: string, args: string[], timeoutMs: number = 600000): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, scriptName);
    console.log(`\n[EXEC] npx ts-node ${scriptName} ${args.join(' ')}\n`);

    let output = '';
    let errorOutput = '';

    const proc = spawn('npx', ['ts-node', scriptPath, ...args], {
      cwd: BASE_DIR,
      env: process.env,
      shell: true,
    });

    const timer = setTimeout(() => {
      console.log(`[TIMEOUT] Script exceeded ${timeoutMs}ms`);
      proc.kill('SIGTERM');
    }, timeoutMs);

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0,
        output,
        error: code !== 0 ? errorOutput || `Exit code ${code}` : undefined,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, output, error: err.message });
    });
  });
}

// State management
function loadBatchProgress(): BatchProgress {
  const filePath = path.join(STATE_DIR, 'batch-progress.json');
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {
      totalDesigns: 0,
      completed: 0,
      failed: 0,
      inProgress: 0,
      pending: 0,
      currentDesignId: null,
      startedAt: null,
      lastUpdated: null,
    };
  }
}

function saveBatchProgress(progress: BatchProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(path.join(STATE_DIR, 'batch-progress.json'), JSON.stringify(progress, null, 2));
}

function loadProcessingState(designId: string): ProcessingState | null {
  const filePath = path.join(STATE_DIR, 'processing-status.json');
  try {
    const states = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return states[designId] || null;
  } catch {
    return null;
  }
}

function saveProcessingState(state: ProcessingState): void {
  const filePath = path.join(STATE_DIR, 'processing-status.json');
  let states: Record<string, ProcessingState> = {};
  try {
    states = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {}

  state.updatedAt = new Date().toISOString();
  states[state.designId] = state;
  fs.writeFileSync(filePath, JSON.stringify(states, null, 2));
}

function loadScreensToProcess(): DesignConfig[] {
  const filePath = path.join(CONFIG_DIR, 'screens-to-process.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.screens || [];
}

// Get latest analysis file for a design
function getLatestAnalysis(designId: string): string | null {
  try {
    const files = fs.readdirSync(ANALYSIS_DIR)
      .filter(f => f.startsWith(designId) && f.endsWith('.json'))
      .sort()
      .reverse();
    return files.length > 0 ? path.join(ANALYSIS_DIR, files[0]) : null;
  } catch {
    return null;
  }
}

// Count issues from analysis
function countIssues(analysisPath: string): number {
  try {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
    return analysis.summary?.totalIssues || 0;
  } catch {
    return 0;
  }
}

// Process single design through extraction + analysis
async function runExtractionAndAnalysis(design: DesignConfig): Promise<ProcessingState> {
  const state: ProcessingState = {
    designId: design.nodeId,
    name: design.name,
    phase: 'extraction',
    updatedAt: new Date().toISOString(),
  };

  console.log('\n' + '='.repeat(70));
  console.log(`PROCESSING: ${design.name}`);
  console.log(`Design ID: ${design.nodeId}`);
  console.log('='.repeat(70));

  // Phase 1: Extraction
  console.log('\n### PHASE 1: EXTRACTION ###\n');
  state.phase = 'extraction';
  saveProcessingState(state);

  const extractResult = await runScript(
    'extract-figma-ai-enhanced.ts',
    [design.nodeIdApi, design.name],
    600000 // 10 min
  );

  if (!extractResult.success) {
    state.phase = 'failed';
    state.error = `Extraction failed: ${extractResult.error}`;
    saveProcessingState(state);
    return state;
  }

  state.extractionPath = path.join(DATA_DIR, design.nodeId, 'enhanced-extraction.json');

  // Phase 2: Analysis
  console.log('\n### PHASE 2: ANALYSIS ###\n');
  state.phase = 'analysis';
  saveProcessingState(state);

  const analysisResult = await runScript(
    'gemini-pixel-feedback.ts',
    [design.nodeId],
    900000 // 15 min
  );

  if (!analysisResult.success) {
    state.phase = 'failed';
    state.error = `Analysis failed: ${analysisResult.error}`;
    saveProcessingState(state);
    return state;
  }

  state.analysisPath = getLatestAnalysis(design.nodeId);
  state.issueCount = state.analysisPath ? countIssues(state.analysisPath) : 0;
  state.phase = 'review';
  saveProcessingState(state);

  console.log('\n' + '='.repeat(70));
  console.log('EXTRACTION & ANALYSIS COMPLETE');
  console.log(`Issues found: ${state.issueCount}`);
  console.log('Ready for Review Round (3 parallel sub-agents)');
  console.log('='.repeat(70));

  return state;
}

// Mark review round complete
function markReviewComplete(designId: string): void {
  const state = loadProcessingState(designId);
  if (state) {
    state.reviewRoundComplete = true;
    state.phase = 'feedback_1';
    saveProcessingState(state);
  }
}

// Run feedback analysis
async function runFeedbackAnalysis(designId: string, round: number): Promise<boolean> {
  console.log(`\n### FEEDBACK ROUND ${round}: RE-ANALYSIS ###\n`);

  const result = await runScript(
    'gemini-pixel-feedback.ts',
    [designId],
    900000
  );

  if (result.success) {
    const state = loadProcessingState(designId);
    if (state) {
      state.analysisPath = getLatestAnalysis(designId);
      state.issueCount = state.analysisPath ? countIssues(state.analysisPath) : 0;
      state.feedbackRoundsComplete = round;
      state.phase = round < 3 ? `feedback_${round + 1}` as any : 'verification';
      saveProcessingState(state);
    }
  }

  return result.success;
}

// Mark design completed
function markDesignCompleted(designId: string, parityScore: number): void {
  const state = loadProcessingState(designId);
  if (state) {
    state.phase = 'completed';
    state.parityScore = parityScore;
    saveProcessingState(state);
  }

  const progress = loadBatchProgress();
  progress.completed++;
  progress.inProgress = 0;
  saveBatchProgress(progress);
}

// Mark design failed
function markDesignFailed(designId: string, error: string): void {
  const state = loadProcessingState(designId);
  if (state) {
    state.phase = 'failed';
    state.error = error;
    saveProcessingState(state);
  }

  const progress = loadBatchProgress();
  progress.failed++;
  progress.inProgress = 0;
  saveBatchProgress(progress);
}

// Get pending designs
function getPendingDesigns(): DesignConfig[] {
  const screens = loadScreensToProcess();
  const statePath = path.join(STATE_DIR, 'processing-status.json');

  let processedIds = new Set<string>();
  try {
    const states = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    processedIds = new Set(
      Object.entries(states)
        .filter(([_, s]: [string, any]) => s.phase === 'completed' || s.phase === 'failed')
        .map(([id]) => id)
    );
  } catch {}

  return screens.filter(s => !processedIds.has(s.nodeId));
}

// Get current design being processed
function getCurrentDesign(): ProcessingState | null {
  const statePath = path.join(STATE_DIR, 'processing-status.json');
  try {
    const states = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    for (const [id, state] of Object.entries(states) as [string, ProcessingState][]) {
      if (state.phase !== 'completed' && state.phase !== 'failed') {
        return state;
      }
    }
  } catch {}
  return null;
}

// Export for external use
export {
  runExtractionAndAnalysis,
  runFeedbackAnalysis,
  markReviewComplete,
  markDesignCompleted,
  markDesignFailed,
  getPendingDesigns,
  getCurrentDesign,
  loadProcessingState,
  saveProcessingState,
  loadBatchProgress,
  saveBatchProgress,
  loadScreensToProcess,
  getLatestAnalysis,
  countIssues,
  DesignConfig,
  ProcessingState,
  BatchProgress,
  DATA_DIR,
  ANALYSIS_DIR,
  RN_APP_DIR,
  STATE_DIR,
};

// CLI mode
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'extract': {
      // Extract and analyze a single design
      const designId = args[1];
      const screens = loadScreensToProcess();
      const design = screens.find(s => s.nodeId === designId);
      if (!design) {
        console.error(`Design ${designId} not found`);
        process.exit(1);
      }
      await runExtractionAndAnalysis(design);
      break;
    }

    case 'feedback': {
      // Run feedback analysis
      const designId = args[1];
      const round = parseInt(args[2] || '1');
      await runFeedbackAnalysis(designId, round);
      break;
    }

    case 'status': {
      // Show current status
      const progress = loadBatchProgress();
      const current = getCurrentDesign();
      console.log('\n=== BATCH PROGRESS ===');
      console.log(JSON.stringify(progress, null, 2));
      if (current) {
        console.log('\n=== CURRENT DESIGN ===');
        console.log(JSON.stringify(current, null, 2));
      }
      break;
    }

    case 'next': {
      // Get next design to process
      const pending = getPendingDesigns();
      if (pending.length > 0) {
        console.log(JSON.stringify(pending[0]));
      } else {
        console.log('null');
      }
      break;
    }

    default:
      console.log(`
Full Orchestrator Commands:
  extract <designId>     - Run extraction + analysis for a design
  feedback <designId> <round> - Run feedback analysis
  status                 - Show current progress
  next                   - Get next pending design
      `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
