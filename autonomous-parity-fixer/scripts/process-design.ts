/**
 * Process Single Design - Extraction + Analysis Only
 *
 * This script handles extraction and analysis for a single design.
 * Code fixes are handled by Claude Code sub-agents externally.
 *
 * Usage:
 *   npx ts-node scripts/process-design.ts <figmaId> <designName>
 *   npx ts-node scripts/process-design.ts 1-28055 "Splash Screen"
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DATA_DIR = path.join(__dirname, '..', 'data', 'ai-enhanced');
const ANALYSIS_DIR = path.join(__dirname, '..', 'analysis', 'pixel-feedback');
const STATE_DIR = path.join(__dirname, '..', 'state');

interface ProcessResult {
  success: boolean;
  designId: string;
  extractionPath?: string;
  analysisPath?: string;
  issueCount?: number;
  error?: string;
}

async function runScript(scriptName: string, args: string[], timeoutMs: number = 600000): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, scriptName);
    console.log(`[EXEC] npx ts-node ${scriptName} ${args.join(' ')}`);

    let output = '';
    let errorOutput = '';

    const proc = spawn('npx', ['ts-node', scriptPath, ...args], {
      cwd: path.join(__dirname, '..'),
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

async function processDesign(figmaId: string, designName: string): Promise<ProcessResult> {
  const result: ProcessResult = {
    success: false,
    designId: figmaId,
  };

  console.log('\n' + '='.repeat(60));
  console.log(`PROCESSING: ${designName}`);
  console.log(`Figma ID: ${figmaId}`);
  console.log('='.repeat(60) + '\n');

  // Phase 1: Extraction
  console.log('\n--- PHASE 1: EXTRACTION ---\n');
  const extractionResult = await runScript(
    'extract-figma-ai-enhanced.ts',
    [figmaId.replace('-', ':'), designName],
    600000
  );

  if (!extractionResult.success) {
    result.error = `Extraction failed: ${extractionResult.error}`;
    return result;
  }

  result.extractionPath = path.join(DATA_DIR, figmaId, 'enhanced-extraction.json');

  // Phase 2: Analysis
  console.log('\n--- PHASE 2: ANALYSIS ---\n');
  const analysisResult = await runScript(
    'gemini-pixel-feedback.ts',
    [figmaId],
    900000
  );

  if (!analysisResult.success) {
    result.error = `Analysis failed: ${analysisResult.error}`;
    return result;
  }

  // Find the latest analysis file
  const analysisFiles = fs.readdirSync(ANALYSIS_DIR)
    .filter(f => f.startsWith(figmaId) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (analysisFiles.length > 0) {
    result.analysisPath = path.join(ANALYSIS_DIR, analysisFiles[0]);

    // Count issues
    try {
      const analysis = JSON.parse(fs.readFileSync(result.analysisPath, 'utf-8'));
      result.issueCount = analysis.summary?.totalIssues || 0;
    } catch (e) {
      // Ignore
    }
  }

  result.success = true;
  return result;
}

// Update state file
function updateState(figmaId: string, status: 'extracting' | 'analyzing' | 'ready_for_fixes' | 'completed' | 'failed', details?: any) {
  const statePath = path.join(STATE_DIR, 'processing-status.json');
  let state: any = {};

  try {
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
  } catch (e) {}

  state[figmaId] = {
    status,
    updatedAt: new Date().toISOString(),
    ...details,
  };

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: npx ts-node scripts/process-design.ts <figmaId> <designName>');
    console.log('Example: npx ts-node scripts/process-design.ts 1-28055 "Splash Screen"');
    process.exit(1);
  }

  const figmaId = args[0];
  const designName = args.slice(1).join(' ');

  updateState(figmaId, 'extracting');

  const result = await processDesign(figmaId, designName);

  if (result.success) {
    updateState(figmaId, 'ready_for_fixes', {
      extractionPath: result.extractionPath,
      analysisPath: result.analysisPath,
      issueCount: result.issueCount,
    });

    console.log('\n' + '='.repeat(60));
    console.log('EXTRACTION & ANALYSIS COMPLETE');
    console.log('='.repeat(60));
    console.log(`Extraction: ${result.extractionPath}`);
    console.log(`Analysis: ${result.analysisPath}`);
    console.log(`Issues found: ${result.issueCount}`);
    console.log('\nReady for code fixes by Claude Code sub-agent.');
  } else {
    updateState(figmaId, 'failed', { error: result.error });
    console.error('\n[FAILED]', result.error);
    process.exit(1);
  }
}

main().catch(console.error);
