#!/usr/bin/env ts-node
/**
 * regression-check.ts — Lightweight regression runner for all CERTIFIED screens.
 *
 * No API calls. Runs tsc + jest globally, then checks each certified screen
 * for coverage thresholds and git-level code changes since last verification.
 *
 * Usage:
 *   cd autobot && npx ts-node scripts/regression-check.ts
 */

import * as path from "path";
import * as fs from "fs";
import {
  PROGRESS_JSON,
  REPORTS_REGRESSION,
  REPORTS_TESTS,
  RN_APP_ROOT,
  BB_COVERAGE,
} from "./lib/paths";
import {
  ProgressData,
  ScreenProgress,
  RegressionReport,
  RegressionScreenResult,
} from "./lib/types";
import {
  log,
  logError,
  logWarn,
  readJsonSafe,
  writeJsonSafe,
  ensureDir,
  runCommand,
  resolveScreenName,
} from "./lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a route like `/(auth)/otp` to the relative file path `app/(auth)/otp.tsx`
 * inside rn-app/.
 */
function routeToFilePath(route: string): string {
  // Strip leading slash, append .tsx
  const stripped = route.startsWith("/") ? route.slice(1) : route;
  return `app/${stripped}.tsx`;
}

/**
 * Build a compact ISO timestamp suitable for filenames (no colons).
 * Example: "20260216T143025"
 */
function fileTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "")
    .replace("T", "T");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const STEP = "REGRESSION";

  log(STEP, "Starting regression check for all CERTIFIED screens");

  // 1. Load progress.json
  const progress = readJsonSafe<ProgressData>(PROGRESS_JSON);
  if (!progress) {
    logError(STEP, `Cannot read progress.json at ${PROGRESS_JSON}`);
    process.exit(1);
  }

  // Collect certified screens
  const certifiedEntries: Array<[string, ScreenProgress]> = Object.entries(
    progress.screens
  ).filter(([_, sp]) => sp.status === "CERTIFIED");

  if (certifiedEntries.length === 0) {
    log(
      STEP,
      "No certified screens yet -- regression check passes vacuously"
    );
    process.exit(0);
  }

  log(STEP, `Found ${certifiedEntries.length} certified screen(s)`);

  // -------------------------------------------------------------------------
  // 2. Global checks (run once)
  // -------------------------------------------------------------------------

  // TypeScript compilation check
  log(STEP, "Running tsc --noEmit ...");
  const tscResult = runCommand("npx tsc --noEmit", {
    cwd: RN_APP_ROOT,
    timeout: 120_000,
    silent: true,
  });
  const tscPassed = tscResult.ok;
  if (tscPassed) {
    log(STEP, "tsc --noEmit PASSED");
  } else {
    logWarn(STEP, "tsc --noEmit FAILED");
    if (tscResult.stderr) {
      logWarn(STEP, `tsc stderr (truncated): ${tscResult.stderr.slice(0, 500)}`);
    }
    if (tscResult.stdout) {
      logWarn(STEP, `tsc stdout (truncated): ${tscResult.stdout.slice(0, 500)}`);
    }
  }

  // Jest test suite
  log(STEP, "Running jest --passWithNoTests --forceExit ...");
  const jestResult = runCommand("npx jest --passWithNoTests --forceExit", {
    cwd: RN_APP_ROOT,
    timeout: 120_000,
    silent: true,
  });
  const jestPassed = jestResult.ok;
  if (jestPassed) {
    log(STEP, "jest PASSED");
  } else {
    logWarn(STEP, "jest FAILED");
    if (jestResult.stderr) {
      logWarn(STEP, `jest stderr (truncated): ${jestResult.stderr.slice(0, 500)}`);
    }
    if (jestResult.stdout) {
      logWarn(STEP, `jest stdout (truncated): ${jestResult.stdout.slice(0, 500)}`);
    }
  }

  // -------------------------------------------------------------------------
  // 3. Per-screen checks
  // -------------------------------------------------------------------------

  const screenResults: RegressionScreenResult[] = [];

  for (const [screenId, sp] of certifiedEntries) {
    log(STEP, `Checking ${screenId} (${sp.name}) ...`);

    // --- Coverage check ---
    const coveragePath = path.join(BB_COVERAGE, `${screenId}-coverage.json`);
    let coverageOk = true; // default true if no file
    if (fs.existsSync(coveragePath)) {
      const coverageData = readJsonSafe<{ overall?: number }>(coveragePath);
      if (coverageData && typeof coverageData.overall === "number") {
        coverageOk = coverageData.overall >= 95;
        if (!coverageOk) {
          logWarn(
            STEP,
            `${screenId}: coverage ${coverageData.overall}% < 95% threshold`
          );
        }
      }
    }

    // --- Git change detection ---
    const screenFile = routeToFilePath(sp.route);
    let codeChanged = false;

    // Check unstaged/staged diff against HEAD
    const diffResult = runCommand(
      `git diff --name-only HEAD -- "${screenFile}"`,
      { cwd: RN_APP_ROOT, timeout: 10_000, silent: true }
    );
    if (diffResult.ok && diffResult.stdout.length > 0) {
      codeChanged = true;
    }

    // Check commits after verifiedAt (if available)
    if (!codeChanged && sp.verifiedAt) {
      const logResult = runCommand(
        `git log --after="${sp.verifiedAt}" --oneline -- "${screenFile}"`,
        { cwd: RN_APP_ROOT, timeout: 10_000, silent: true }
      );
      if (logResult.ok && logResult.stdout.length > 0) {
        codeChanged = true;
      }
    }

    const needsReverification = codeChanged;

    if (needsReverification) {
      logWarn(STEP, `${screenId}: code changed since verification -- needs re-verification`);
    }

    screenResults.push({
      screenId,
      name: sp.name,
      coverageOk,
      codeChanged,
      needsReverification,
    });
  }

  // -------------------------------------------------------------------------
  // 4. Build report
  // -------------------------------------------------------------------------

  const allPassed =
    tscPassed &&
    jestPassed &&
    screenResults.every((s) => !s.needsReverification);

  const report: RegressionReport = {
    timestamp: new Date().toISOString(),
    certifiedScreens: certifiedEntries.length,
    tscPassed,
    jestPassed,
    screens: screenResults,
    allPassed,
  };

  // Write report
  ensureDir(REPORTS_REGRESSION);
  const reportFile = path.join(
    REPORTS_REGRESSION,
    `${fileTimestamp()}-regression.json`
  );
  const wrote = writeJsonSafe(reportFile, report);
  if (wrote) {
    log(STEP, `Report written to ${reportFile}`);
  }

  // -------------------------------------------------------------------------
  // 5. Summary table
  // -------------------------------------------------------------------------

  console.log("");
  console.log("=".repeat(72));
  console.log("  REGRESSION CHECK SUMMARY");
  console.log("=".repeat(72));
  console.log("");
  console.log(
    `  TypeScript (tsc --noEmit):  ${tscPassed ? "PASS" : "FAIL"}`
  );
  console.log(
    `  Jest test suite:           ${jestPassed ? "PASS" : "FAIL"}`
  );
  console.log(`  Certified screens:         ${certifiedEntries.length}`);
  console.log("");

  // Screen table header
  const hdr = [
    "Screen ID".padEnd(14),
    "Name".padEnd(28),
    "Cov".padEnd(6),
    "Changed".padEnd(9),
    "Status".padEnd(8),
  ].join(" | ");
  console.log(`  ${hdr}`);
  console.log(`  ${"=".repeat(hdr.length)}`);

  for (const sr of screenResults) {
    const row = [
      sr.screenId.padEnd(14),
      sr.name.slice(0, 28).padEnd(28),
      (sr.coverageOk ? "OK" : "LOW").padEnd(6),
      (sr.codeChanged ? "YES" : "no").padEnd(9),
      (sr.needsReverification ? "REVERIFY" : "OK").padEnd(8),
    ].join(" | ");
    console.log(`  ${row}`);
  }

  console.log("");
  console.log(
    `  Overall: ${allPassed ? "ALL PASSED" : "ISSUES FOUND"}`
  );
  console.log("=".repeat(72));
  console.log("");

  // -------------------------------------------------------------------------
  // 6. Exit code
  // -------------------------------------------------------------------------

  process.exit(allPassed ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((err) => {
  logError("REGRESSION", `Unhandled error: ${(err as Error).message}`);
  process.exit(1);
});
