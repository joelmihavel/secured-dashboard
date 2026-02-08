/**
 * State Manager for Autonomous Parity Fixer
 *
 * Manages the state machine for processing designs through the pipeline:
 * PENDING → EXTRACTING → EXTRACTED → ANALYZING → ANALYZED
 *   → REVIEW_1 → IMPLEMENT_1 → REVIEW_2 → IMPLEMENT_2 → REVIEW_3 → IMPLEMENT_3
 *   → FEEDBACK_1 → FIX_1 → FEEDBACK_2 → FIX_2 → FEEDBACK_3 → FIX_3
 *   → VERIFYING → COMPLETED
 */

import * as fs from 'fs';
import * as path from 'path';

// State definitions
export type DesignState =
  | 'IDLE'
  | 'PENDING'
  | 'EXTRACTING'
  | 'EXTRACTED'
  | 'ANALYZING'
  | 'ANALYZED'
  | 'REVIEW_1'
  | 'IMPLEMENT_1'
  | 'REVIEW_2'
  | 'IMPLEMENT_2'
  | 'REVIEW_3'
  | 'IMPLEMENT_3'
  | 'FEEDBACK_1'
  | 'FIX_1'
  | 'FEEDBACK_2'
  | 'FIX_2'
  | 'FEEDBACK_3'
  | 'FIX_3'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED';

export type StateEvent =
  | 'START'
  | 'EXTRACTION_COMPLETE'
  | 'ANALYSIS_COMPLETE'
  | 'REVIEW_COMPLETE'
  | 'IMPLEMENTATION_COMPLETE'
  | 'FEEDBACK_COMPLETE'
  | 'FIX_COMPLETE'
  | 'VERIFICATION_COMPLETE'
  | 'VERIFICATION_FAILED'
  | 'ERROR'
  | 'RETRY';

export interface StateHistoryEntry {
  state: DesignState;
  timestamp: string;
  event?: StateEvent;
  error?: string;
}

export interface CurrentDesign {
  designId: string | null;
  name: string | null;
  route: string | null;
  state: DesignState;
  stateHistory: StateHistoryEntry[];
  retryCount: number;
  errors: string[];
}

export interface BatchProgress {
  totalDesigns: number;
  completed: number;
  failed: number;
  inProgress: number;
  pending: number;
  currentDesignId: string | null;
  startedAt: string | null;
  lastUpdated: string | null;
}

// State transition map
const STATE_TRANSITIONS: Record<DesignState, Partial<Record<StateEvent, DesignState>>> = {
  IDLE: {
    START: 'PENDING',
  },
  PENDING: {
    START: 'EXTRACTING',
    ERROR: 'FAILED',
  },
  EXTRACTING: {
    EXTRACTION_COMPLETE: 'EXTRACTED',
    ERROR: 'FAILED',
    RETRY: 'EXTRACTING',
  },
  EXTRACTED: {
    START: 'ANALYZING',
    ERROR: 'FAILED',
  },
  ANALYZING: {
    ANALYSIS_COMPLETE: 'ANALYZED',
    ERROR: 'FAILED',
    RETRY: 'ANALYZING',
  },
  ANALYZED: {
    START: 'REVIEW_1',
    ERROR: 'FAILED',
  },
  REVIEW_1: {
    REVIEW_COMPLETE: 'IMPLEMENT_1',
    ERROR: 'FAILED',
    RETRY: 'REVIEW_1',
  },
  IMPLEMENT_1: {
    IMPLEMENTATION_COMPLETE: 'REVIEW_2',
    ERROR: 'FAILED',
    RETRY: 'IMPLEMENT_1',
  },
  REVIEW_2: {
    REVIEW_COMPLETE: 'IMPLEMENT_2',
    ERROR: 'FAILED',
    RETRY: 'REVIEW_2',
  },
  IMPLEMENT_2: {
    IMPLEMENTATION_COMPLETE: 'REVIEW_3',
    ERROR: 'FAILED',
    RETRY: 'IMPLEMENT_2',
  },
  REVIEW_3: {
    REVIEW_COMPLETE: 'IMPLEMENT_3',
    ERROR: 'FAILED',
    RETRY: 'REVIEW_3',
  },
  IMPLEMENT_3: {
    IMPLEMENTATION_COMPLETE: 'FEEDBACK_1',
    ERROR: 'FAILED',
    RETRY: 'IMPLEMENT_3',
  },
  FEEDBACK_1: {
    FEEDBACK_COMPLETE: 'FIX_1',
    ERROR: 'FAILED',
    RETRY: 'FEEDBACK_1',
  },
  FIX_1: {
    FIX_COMPLETE: 'FEEDBACK_2',
    ERROR: 'FAILED',
    RETRY: 'FIX_1',
  },
  FEEDBACK_2: {
    FEEDBACK_COMPLETE: 'FIX_2',
    ERROR: 'FAILED',
    RETRY: 'FEEDBACK_2',
  },
  FIX_2: {
    FIX_COMPLETE: 'FEEDBACK_3',
    ERROR: 'FAILED',
    RETRY: 'FIX_2',
  },
  FEEDBACK_3: {
    FEEDBACK_COMPLETE: 'FIX_3',
    ERROR: 'FAILED',
    RETRY: 'FEEDBACK_3',
  },
  FIX_3: {
    FIX_COMPLETE: 'VERIFYING',
    ERROR: 'FAILED',
    RETRY: 'FIX_3',
  },
  VERIFYING: {
    VERIFICATION_COMPLETE: 'COMPLETED',
    VERIFICATION_FAILED: 'FAILED',
    ERROR: 'FAILED',
  },
  COMPLETED: {},
  FAILED: {
    RETRY: 'PENDING',
  },
};

// Paths
const STATE_DIR = path.join(__dirname, '..', 'state');
const CURRENT_DESIGN_PATH = path.join(STATE_DIR, 'current-design.json');
const BATCH_PROGRESS_PATH = path.join(STATE_DIR, 'batch-progress.json');
const COMPLETED_PATH = path.join(STATE_DIR, 'completed.json');
const FAILED_PATH = path.join(STATE_DIR, 'failed.json');

/**
 * Transition the state based on an event
 */
export function transitionState(current: DesignState, event: StateEvent): DesignState {
  const transitions = STATE_TRANSITIONS[current];
  const nextState = transitions[event];

  if (!nextState) {
    console.warn(`Invalid transition: ${current} + ${event}`);
    return current;
  }

  return nextState;
}

/**
 * Load the current design state from file
 */
export function loadCurrentDesign(): CurrentDesign {
  try {
    if (fs.existsSync(CURRENT_DESIGN_PATH)) {
      return JSON.parse(fs.readFileSync(CURRENT_DESIGN_PATH, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load current design state:', error);
  }

  return {
    designId: null,
    name: null,
    route: null,
    state: 'IDLE',
    stateHistory: [],
    retryCount: 0,
    errors: [],
  };
}

/**
 * Save the current design state to file
 */
export function saveCurrentDesign(design: CurrentDesign): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(CURRENT_DESIGN_PATH, JSON.stringify(design, null, 2));
}

/**
 * Update design state with an event
 */
export function updateDesignState(event: StateEvent, error?: string): CurrentDesign {
  const design = loadCurrentDesign();
  const newState = transitionState(design.state, event);

  const historyEntry: StateHistoryEntry = {
    state: newState,
    timestamp: new Date().toISOString(),
    event,
    ...(error && { error }),
  };

  design.state = newState;
  design.stateHistory.push(historyEntry);

  if (error) {
    design.errors.push(error);
  }

  saveCurrentDesign(design);
  return design;
}

/**
 * Start processing a new design
 */
export function startDesign(designId: string, name: string, route: string): CurrentDesign {
  const design: CurrentDesign = {
    designId,
    name,
    route,
    state: 'PENDING',
    stateHistory: [{
      state: 'PENDING',
      timestamp: new Date().toISOString(),
      event: 'START',
    }],
    retryCount: 0,
    errors: [],
  };

  saveCurrentDesign(design);
  return design;
}

/**
 * Reset to idle state
 */
export function resetToIdle(): void {
  const design: CurrentDesign = {
    designId: null,
    name: null,
    route: null,
    state: 'IDLE',
    stateHistory: [],
    retryCount: 0,
    errors: [],
  };
  saveCurrentDesign(design);
}

/**
 * Load batch progress from file
 */
export function loadBatchProgress(): BatchProgress {
  try {
    if (fs.existsSync(BATCH_PROGRESS_PATH)) {
      return JSON.parse(fs.readFileSync(BATCH_PROGRESS_PATH, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load batch progress:', error);
  }

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

/**
 * Save batch progress to file
 */
export function saveBatchProgress(progress: BatchProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(BATCH_PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

/**
 * Update batch progress
 */
export function updateBatchProgress(updates: Partial<BatchProgress>): BatchProgress {
  const progress = loadBatchProgress();
  Object.assign(progress, updates);
  saveBatchProgress(progress);
  return progress;
}

/**
 * Mark a design as completed
 */
export function markDesignCompleted(designId: string, name: string, parityScore: number): void {
  const completedPath = COMPLETED_PATH;
  let completed: { designs: Array<{ designId: string; name: string; completedAt: string; parityScore: number }> } = { designs: [] };

  try {
    if (fs.existsSync(completedPath)) {
      completed = JSON.parse(fs.readFileSync(completedPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load completed designs:', error);
  }

  completed.designs.push({
    designId,
    name,
    completedAt: new Date().toISOString(),
    parityScore,
  });

  fs.writeFileSync(completedPath, JSON.stringify(completed, null, 2));

  // Update batch progress
  const progress = loadBatchProgress();
  progress.completed++;
  progress.inProgress = 0;
  saveBatchProgress(progress);
}

/**
 * Mark a design as failed
 */
export function markDesignFailed(designId: string, name: string, errors: string[]): void {
  const failedPath = FAILED_PATH;
  let failed: { designs: Array<{ designId: string; name: string; failedAt: string; errors: string[] }> } = { designs: [] };

  try {
    if (fs.existsSync(failedPath)) {
      failed = JSON.parse(fs.readFileSync(failedPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load failed designs:', error);
  }

  failed.designs.push({
    designId,
    name,
    failedAt: new Date().toISOString(),
    errors,
  });

  fs.writeFileSync(failedPath, JSON.stringify(failed, null, 2));

  // Update batch progress
  const progress = loadBatchProgress();
  progress.failed++;
  progress.inProgress = 0;
  saveBatchProgress(progress);
}

/**
 * Check if processing is stuck (timeout detection)
 */
export function detectStuck(design: CurrentDesign, timeoutMs: number = 300000): boolean {
  if (design.stateHistory.length === 0) return false;

  const lastEntry = design.stateHistory[design.stateHistory.length - 1];
  const lastUpdate = new Date(lastEntry.timestamp).getTime();
  const now = Date.now();

  return (now - lastUpdate) > timeoutMs;
}

/**
 * Get the next action based on current state
 */
export function getNextAction(state: DesignState): string {
  const actions: Record<DesignState, string> = {
    IDLE: 'start',
    PENDING: 'extract',
    EXTRACTING: 'wait',
    EXTRACTED: 'analyze',
    ANALYZING: 'wait',
    ANALYZED: 'review',
    REVIEW_1: 'wait',
    IMPLEMENT_1: 'wait',
    REVIEW_2: 'wait',
    IMPLEMENT_2: 'wait',
    REVIEW_3: 'wait',
    IMPLEMENT_3: 'feedback',
    FEEDBACK_1: 'wait',
    FIX_1: 'wait',
    FEEDBACK_2: 'wait',
    FIX_2: 'wait',
    FEEDBACK_3: 'wait',
    FIX_3: 'verify',
    VERIFYING: 'wait',
    COMPLETED: 'next',
    FAILED: 'retry_or_skip',
  };

  return actions[state] || 'unknown';
}

/**
 * Check if processing can continue (not in terminal state)
 */
export function canContinue(state: DesignState): boolean {
  return state !== 'COMPLETED' && state !== 'FAILED';
}

/**
 * Log state transition
 */
export function logStateTransition(from: DesignState, to: DesignState, event: StateEvent): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] State: ${from} → ${to} (Event: ${event})`);
}

export default {
  transitionState,
  loadCurrentDesign,
  saveCurrentDesign,
  updateDesignState,
  startDesign,
  resetToIdle,
  loadBatchProgress,
  saveBatchProgress,
  updateBatchProgress,
  markDesignCompleted,
  markDesignFailed,
  detectStuck,
  getNextAction,
  canContinue,
  logStateTransition,
};
