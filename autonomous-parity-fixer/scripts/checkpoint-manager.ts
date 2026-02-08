/**
 * Checkpoint Manager for Autonomous Parity Fixer
 *
 * Handles checkpoint creation, recovery, and pruning for crash recovery.
 * Checkpoints capture the full state of processing to allow seamless resumption.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BatchProgress, CurrentDesign, loadBatchProgress, loadCurrentDesign, saveBatchProgress, saveCurrentDesign } from './state-manager';

export interface Checkpoint {
  id: string;
  createdAt: string;
  batchProgress: BatchProgress;
  currentDesign: CurrentDesign;
  processingState: {
    lastCompletedPhase: string;
    pendingDesigns: string[];
  };
}

const CHECKPOINT_DIR = path.join(__dirname, '..', 'state', 'checkpoints');
const MAX_CHECKPOINTS = 10;

/**
 * Generate a unique checkpoint ID
 */
function generateCheckpointId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `cp_${timestamp}_${random}`;
}

/**
 * Create a new checkpoint
 */
export function createCheckpoint(pendingDesigns: string[] = []): string {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });

  const batchProgress = loadBatchProgress();
  const currentDesign = loadCurrentDesign();

  const checkpoint: Checkpoint = {
    id: generateCheckpointId(),
    createdAt: new Date().toISOString(),
    batchProgress,
    currentDesign,
    processingState: {
      lastCompletedPhase: currentDesign.state,
      pendingDesigns,
    },
  };

  // Save checkpoint
  const checkpointPath = path.join(CHECKPOINT_DIR, `${checkpoint.id}.json`);
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

  // Save as latest
  const latestPath = path.join(CHECKPOINT_DIR, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(checkpoint, null, 2));

  // Prune old checkpoints
  pruneOldCheckpoints();

  console.log(`[Checkpoint] Created: ${checkpoint.id}`);
  return checkpoint.id;
}

/**
 * Load the latest checkpoint
 */
export function loadLatestCheckpoint(): Checkpoint | null {
  const latestPath = path.join(CHECKPOINT_DIR, 'latest.json');

  try {
    if (fs.existsSync(latestPath)) {
      return JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
    }
  } catch (error) {
    console.error('[Checkpoint] Failed to load latest checkpoint:', error);
  }

  return null;
}

/**
 * Load a specific checkpoint by ID
 */
export function loadCheckpoint(checkpointId: string): Checkpoint | null {
  const checkpointPath = path.join(CHECKPOINT_DIR, `${checkpointId}.json`);

  try {
    if (fs.existsSync(checkpointPath)) {
      return JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
    }
  } catch (error) {
    console.error(`[Checkpoint] Failed to load checkpoint ${checkpointId}:`, error);
  }

  return null;
}

/**
 * Recover from a checkpoint
 */
export function recoverFromCheckpoint(checkpoint: Checkpoint): boolean {
  try {
    // Restore batch progress
    saveBatchProgress(checkpoint.batchProgress);

    // Restore current design state
    saveCurrentDesign(checkpoint.currentDesign);

    console.log(`[Checkpoint] Recovered from: ${checkpoint.id}`);
    console.log(`[Checkpoint] Design: ${checkpoint.currentDesign.designId}`);
    console.log(`[Checkpoint] State: ${checkpoint.currentDesign.state}`);

    return true;
  } catch (error) {
    console.error('[Checkpoint] Recovery failed:', error);
    return false;
  }
}

/**
 * List all available checkpoints
 */
export function listCheckpoints(): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];

  try {
    if (!fs.existsSync(CHECKPOINT_DIR)) {
      return checkpoints;
    }

    const files = fs.readdirSync(CHECKPOINT_DIR);

    for (const file of files) {
      if (file.startsWith('cp_') && file.endsWith('.json')) {
        const checkpointPath = path.join(CHECKPOINT_DIR, file);
        try {
          const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
          checkpoints.push(checkpoint);
        } catch (e) {
          // Skip invalid checkpoints
        }
      }
    }

    // Sort by creation time (newest first)
    checkpoints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('[Checkpoint] Failed to list checkpoints:', error);
  }

  return checkpoints;
}

/**
 * Prune old checkpoints, keeping only the most recent ones
 */
export function pruneOldCheckpoints(): void {
  const checkpoints = listCheckpoints();

  if (checkpoints.length <= MAX_CHECKPOINTS) {
    return;
  }

  // Remove oldest checkpoints
  const toRemove = checkpoints.slice(MAX_CHECKPOINTS);

  for (const checkpoint of toRemove) {
    const checkpointPath = path.join(CHECKPOINT_DIR, `${checkpoint.id}.json`);
    try {
      fs.unlinkSync(checkpointPath);
      console.log(`[Checkpoint] Pruned: ${checkpoint.id}`);
    } catch (error) {
      console.error(`[Checkpoint] Failed to prune ${checkpoint.id}:`, error);
    }
  }
}

/**
 * Validate checkpoint integrity
 */
export function validateCheckpoint(checkpoint: Checkpoint): boolean {
  if (!checkpoint.id || !checkpoint.createdAt) {
    return false;
  }

  if (!checkpoint.batchProgress || !checkpoint.currentDesign) {
    return false;
  }

  if (!checkpoint.processingState) {
    return false;
  }

  return true;
}

/**
 * Get checkpoint age in milliseconds
 */
export function getCheckpointAge(checkpoint: Checkpoint): number {
  const created = new Date(checkpoint.createdAt).getTime();
  return Date.now() - created;
}

/**
 * Delete all checkpoints
 */
export function clearAllCheckpoints(): void {
  try {
    if (fs.existsSync(CHECKPOINT_DIR)) {
      const files = fs.readdirSync(CHECKPOINT_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(CHECKPOINT_DIR, file));
      }
      console.log('[Checkpoint] All checkpoints cleared');
    }
  } catch (error) {
    console.error('[Checkpoint] Failed to clear checkpoints:', error);
  }
}

/**
 * Create a recovery point before a risky operation
 */
export function createRecoveryPoint(label: string, pendingDesigns: string[] = []): string {
  console.log(`[Checkpoint] Creating recovery point: ${label}`);
  return createCheckpoint(pendingDesigns);
}

/**
 * Attempt automatic recovery from the latest checkpoint
 */
export function attemptAutoRecovery(): boolean {
  console.log('[Checkpoint] Attempting automatic recovery...');

  const latest = loadLatestCheckpoint();

  if (!latest) {
    console.log('[Checkpoint] No checkpoint available for recovery');
    return false;
  }

  if (!validateCheckpoint(latest)) {
    console.log('[Checkpoint] Latest checkpoint is invalid');
    return false;
  }

  // Check if checkpoint is too old (> 1 hour)
  const age = getCheckpointAge(latest);
  const maxAge = 60 * 60 * 1000; // 1 hour

  if (age > maxAge) {
    console.log(`[Checkpoint] Latest checkpoint is too old (${Math.round(age / 60000)} minutes)`);
    return false;
  }

  return recoverFromCheckpoint(latest);
}

export default {
  createCheckpoint,
  loadLatestCheckpoint,
  loadCheckpoint,
  recoverFromCheckpoint,
  listCheckpoints,
  pruneOldCheckpoints,
  validateCheckpoint,
  getCheckpointAge,
  clearAllCheckpoints,
  createRecoveryPoint,
  attemptAutoRecovery,
};
