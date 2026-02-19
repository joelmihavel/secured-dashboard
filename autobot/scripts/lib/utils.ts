import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { BB_SCREEN_ROUTES } from "./paths";
import type { ScreenRoutesConfig } from "./types";

// ---------------------------------------------------------------------------
// Logging (matches verify-screen.ts pattern)
// ---------------------------------------------------------------------------

export function log(step: string, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] [${step}] ${message}`);
}

export function logError(step: string, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.error(`[${timestamp}] [${step}] ERROR: ${message}`);
}

export function logWarn(step: string, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.warn(`[${timestamp}] [${step}] WARN: ${message}`);
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (e) {
    logError("IO", `Failed to read JSON: ${filePath} — ${(e as Error).message}`);
    return null;
  }
}

export function writeJsonSafe(filePath: string, data: unknown): boolean {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    return true;
  } catch (e) {
    logError("IO", `Failed to write JSON: ${filePath} — ${(e as Error).message}`);
    return false;
  }
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

export function runCommand(
  cmd: string,
  opts?: { cwd?: string; timeout?: number; silent?: boolean }
): { ok: boolean; stdout: string; stderr: string } {
  const cwd = opts?.cwd ?? process.cwd();
  const timeout = opts?.timeout ?? 120_000;
  try {
    const stdout = execSync(cmd, {
      cwd,
      timeout,
      encoding: "utf-8",
      stdio: opts?.silent ? "pipe" : ["pipe", "pipe", "pipe"],
    });
    return { ok: true, stdout: stdout.trim(), stderr: "" };
  } catch (e: any) {
    return {
      ok: false,
      stdout: (e.stdout || "").toString().trim(),
      stderr: (e.stderr || "").toString().trim(),
    };
  }
}

// ---------------------------------------------------------------------------
// Screen name resolution
// ---------------------------------------------------------------------------

let _screenRoutes: ScreenRoutesConfig | null = null;

function getScreenRoutes(): ScreenRoutesConfig {
  if (!_screenRoutes) {
    _screenRoutes = readJsonSafe<ScreenRoutesConfig>(BB_SCREEN_ROUTES);
    if (!_screenRoutes) {
      throw new Error(`Cannot read screen-routes.json at ${BB_SCREEN_ROUTES}`);
    }
  }
  return _screenRoutes;
}

/**
 * Resolve a Figma screen ID to its human-readable name and route key.
 * Searches screen-routes.json for the matching figmaId.
 */
export function resolveScreenName(figmaId: string): {
  routeKey: string;
  name: string;
  route: string;
  state: string;
} | null {
  const config = getScreenRoutes();
  for (const [routeKey, entry] of Object.entries(config.routes)) {
    for (const screen of entry.screens) {
      if (screen.figmaId === figmaId) {
        return {
          routeKey,
          name: screen.name,
          route: entry.route,
          state: screen.state,
        };
      }
    }
  }
  return null;
}

/**
 * Get all figma IDs for a given route key (e.g., "otp" → ["1-31175", "1-31073", ...]).
 */
export function getFigmaIdsForRoute(routeKey: string): string[] {
  const config = getScreenRoutes();
  const entry = config.routes[routeKey];
  if (!entry) return [];
  return entry.screens.map((s) => s.figmaId);
}
