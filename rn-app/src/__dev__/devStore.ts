/**
 * Dev Store — Runtime-Mutable Dev State
 *
 * Minimal Zustand store for dev-only mutable state (active scenario, font scale override).
 * NOT for environment mode — that's handled by devConfig.ts.
 *
 * Uses globalThis guard for Fast Refresh safety (Metro re-executes module scope on file save).
 */

import { create } from 'zustand';
import type { ScenarioKey } from './scenarios';

interface DevState {
  activeScenario: ScenarioKey | null;
  fontScaleOverride: number | null; // null = system default
  /** Bypass auth guards so DevNavigator can reach protected screens without a real session */
  devAuthBypass: boolean;
  setScenario: (key: ScenarioKey | null) => void;
  setFontScale: (scale: number | null) => void;
  setDevAuthBypass: (enabled: boolean) => void;
  reset: () => void;
}

// globalThis guard survives Fast Refresh
const STORE_KEY = '__dev_store__';
export const useDevStore = (globalThis as Record<string, unknown>)[STORE_KEY] ??= create<DevState>()((set) => ({
  activeScenario: null,
  fontScaleOverride: null,
  devAuthBypass: false,
  setScenario: (key) => set({ activeScenario: key }),
  setFontScale: (scale) => set({ fontScaleOverride: scale }),
  setDevAuthBypass: (enabled) => set({ devAuthBypass: enabled }),
  reset: () => set({ activeScenario: null, fontScaleOverride: null, devAuthBypass: false }),
}));
