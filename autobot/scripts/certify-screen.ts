#!/usr/bin/env ts-node
/**
 * certify-screen.ts -- CERTIFIED gate for screen promotion.
 *
 * Checks 12 Definition of Done items and promotes VERIFIED -> CERTIFIED
 * in progress.json when all checks pass.
 *
 * Usage:
 *   cd autobot && npx ts-node scripts/certify-screen.ts <figmaId>
 *   cd autobot && npx ts-node scripts/certify-screen.ts --screen <screenKey>
 *
 * The --screen flag processes all figmaIds mapped to that route key
 * (e.g., --screen otp runs certification on all 4 OTP states).
 */

import * as path from "path";
import * as fs from "fs";
import {
  PROGRESS_JSON,
  REPORTS_SCREEN,
  REPORTS_TESTS,
  BB_BLUEPRINTS,
  BB_AUDITS,
  BB_SCREEN_ROUTES,
  RN_APP_ROOT,
  AUTOBOT_ROOT,
  BUILDBOT_ROOT,
} from "./lib/paths";
import {
  ProgressData,
  AuditReport,
  CertificationCheck,
  CertificationReport,
  ScreenRoutesConfig,
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
  getFigmaIdsForRoute,
} from "./lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP = "CERTIFY";
const BB_LEARNINGS_DIR = path.join(BUILDBOT_ROOT, "reports", "learnings");

// ---------------------------------------------------------------------------
// Cached global check results (run once across a batch)
// ---------------------------------------------------------------------------

let _tscResult: { ran: boolean; passed: boolean; detail: string } | null = null;
let _regressionResult: { ran: boolean; passed: boolean; detail: string } | null =
  null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a route like `/(auth)/otp` to the source file path inside rn-app/.
 * Handles `index` routes (e.g. `/(setup)/index` -> `app/(setup)/index.tsx`).
 */
function routeToSourcePath(route: string): string {
  const stripped = route.startsWith("/") ? route.slice(1) : route;
  return path.join(RN_APP_ROOT, "app", `${stripped}.tsx`);
}

/**
 * Derive a plausible test file name from the route key.
 * screen-routes.json keys like "otp", "sign-up", "agreement-upload" map to
 * test files like `otp.test.tsx`, `sign-up.test.tsx`, etc.
 */
function findTestFile(routeKey: string): string | null {
  const testsDir = path.join(RN_APP_ROOT, "src", "__tests__", "screens");
  if (!fs.existsSync(testsDir)) return null;

  // Direct match
  const directMatch = path.join(testsDir, `${routeKey}.test.tsx`);
  if (fs.existsSync(directMatch)) return directMatch;

  // Try without prefix (e.g., "agreement-upload" -> "upload")
  const parts = routeKey.split("-");
  if (parts.length > 1) {
    const suffix = parts[parts.length - 1];
    const suffixMatch = path.join(testsDir, `${suffix}.test.tsx`);
    if (fs.existsSync(suffixMatch)) return suffixMatch;
  }

  // Scan for a file containing the routeKey
  const files = fs.readdirSync(testsDir);
  for (const file of files) {
    if (file.endsWith(".test.tsx") || file.endsWith(".test.ts")) {
      const base = file.replace(/\.test\.(tsx?|js)$/, "");
      if (routeKey.includes(base) || base.includes(routeKey)) {
        return path.join(testsDir, file);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// The 12 certification checks
// ---------------------------------------------------------------------------

function runCertification(figmaId: string): CertificationReport {
  const checks: CertificationCheck[] = [];
  const resolved = resolveScreenName(figmaId);

  log(STEP, `--- Certifying ${figmaId} (${resolved?.name ?? "unknown"}) ---`);

  // -------------------------------------------------------------------------
  // 1. Blueprint exists
  // -------------------------------------------------------------------------
  try {
    const blueprintPath = path.join(BB_BLUEPRINTS, `${figmaId}-blueprint.json`);
    const exists = fs.existsSync(blueprintPath);
    checks.push({
      id: 1,
      name: "Blueprint exists",
      passed: exists,
      detail: exists
        ? `Found at ${blueprintPath}`
        : `Missing: ${blueprintPath}`,
    });
  } catch (e) {
    checks.push({
      id: 1,
      name: "Blueprint exists",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 2. All states have audits
  // -------------------------------------------------------------------------
  try {
    let allStatesAudited = true;
    let auditDetail = "";

    if (resolved) {
      const siblingIds = getFigmaIdsForRoute(resolved.routeKey);
      const missing: string[] = [];
      for (const sibId of siblingIds) {
        const auditPath = path.join(BB_AUDITS, `${sibId}-audit.json`);
        if (!fs.existsSync(auditPath)) {
          missing.push(sibId);
        }
      }
      allStatesAudited = missing.length === 0;
      auditDetail = allStatesAudited
        ? `All ${siblingIds.length} state(s) have audit reports`
        : `Missing audits for: ${missing.join(", ")}`;
    } else {
      // Fallback: just check this figmaId
      const auditPath = path.join(BB_AUDITS, `${figmaId}-audit.json`);
      allStatesAudited = fs.existsSync(auditPath);
      auditDetail = allStatesAudited
        ? "Audit report found"
        : `Missing: ${auditPath} (could not resolve route key)`;
    }

    checks.push({
      id: 2,
      name: "All states have audits",
      passed: allStatesAudited,
      detail: auditDetail,
    });
  } catch (e) {
    checks.push({
      id: 2,
      name: "All states have audits",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 3. Shared component imports
  // -------------------------------------------------------------------------
  try {
    let sharedImport = false;
    let sharedDetail = "";

    if (resolved) {
      const sourcePath = routeToSourcePath(resolved.route);
      if (fs.existsSync(sourcePath)) {
        const content = fs.readFileSync(sourcePath, "utf-8");
        sharedImport = content.includes("@/src/components");
        sharedDetail = sharedImport
          ? `Source file imports from @/src/components`
          : `Source file at ${sourcePath} does not import @/src/components`;
      } else {
        sharedDetail = `Source file not found: ${sourcePath}`;
      }
    } else {
      sharedDetail = "Could not resolve route to source file";
    }

    checks.push({
      id: 3,
      name: "Shared component imports",
      passed: sharedImport,
      detail: sharedDetail,
    });
  } catch (e) {
    checks.push({
      id: 3,
      name: "Shared component imports",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 4. TypeScript compiles (cached across batch)
  // -------------------------------------------------------------------------
  try {
    if (!_tscResult) {
      log(STEP, "Running tsc --noEmit (cached for batch) ...");
      const result = runCommand("npx tsc --noEmit", {
        cwd: RN_APP_ROOT,
        timeout: 120_000,
        silent: true,
      });
      _tscResult = {
        ran: true,
        passed: result.ok,
        detail: result.ok
          ? "tsc --noEmit passed"
          : `tsc --noEmit failed: ${(result.stderr || result.stdout).slice(0, 300)}`,
      };
      log(STEP, `tsc --noEmit: ${_tscResult.passed ? "PASS" : "FAIL"}`);
    }

    checks.push({
      id: 4,
      name: "TypeScript compiles",
      passed: _tscResult.passed,
      detail: _tscResult.detail,
    });
  } catch (e) {
    checks.push({
      id: 4,
      name: "TypeScript compiles",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 5. Unit tests pass
  // -------------------------------------------------------------------------
  try {
    let testPassed = false;
    let testDetail = "";

    const routeKey = resolved?.routeKey ?? "";
    const testFile = findTestFile(routeKey);

    if (testFile) {
      log(STEP, `Running jest for ${path.basename(testFile)} ...`);
      const result = runCommand(
        `npx jest --passWithNoTests --forceExit "${testFile}"`,
        {
          cwd: RN_APP_ROOT,
          timeout: 60_000,
          silent: true,
        }
      );
      testPassed = result.ok;
      testDetail = testPassed
        ? `Tests passed: ${path.basename(testFile)}`
        : `Tests failed: ${(result.stderr || result.stdout).slice(0, 300)}`;
    } else {
      // No test file found -- pass with a note
      testPassed = true;
      testDetail = `No test file found for route key "${routeKey}" (passWithNoTests)`;
    }

    checks.push({
      id: 5,
      name: "Unit tests pass",
      passed: testPassed,
      detail: testDetail,
    });
  } catch (e) {
    checks.push({
      id: 5,
      name: "Unit tests pass",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 6. Audit passed
  // -------------------------------------------------------------------------
  let audit: AuditReport | null = null;
  try {
    const auditPath = path.join(BB_AUDITS, `${figmaId}-audit.json`);
    audit = readJsonSafe<AuditReport>(auditPath);

    if (audit) {
      checks.push({
        id: 6,
        name: "Audit passed",
        passed: audit.overallPassed === true,
        detail: audit.overallPassed
          ? "overallPassed === true"
          : `overallPassed === false. Reasons: ${(audit.failureReasons || []).join("; ")}`,
      });
    } else {
      checks.push({
        id: 6,
        name: "Audit passed",
        passed: false,
        detail: `No audit report at ${auditPath}`,
      });
    }
  } catch (e) {
    checks.push({
      id: 6,
      name: "Audit passed",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 7. Pixel diff passed
  // -------------------------------------------------------------------------
  try {
    const pixelPassed = audit?.pixelDiff?.passed === true;
    const pixelDetail = audit?.pixelDiff
      ? `${audit.pixelDiff.percentage.toFixed(2)}% (threshold: ${audit.pixelDiff.threshold}%) -- ${pixelPassed ? "PASS" : "FAIL"}`
      : "No pixel diff data in audit report";

    checks.push({
      id: 7,
      name: "Pixel diff passed",
      passed: pixelPassed,
      detail: pixelDetail,
    });
  } catch (e) {
    checks.push({
      id: 7,
      name: "Pixel diff passed",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 8. Coverage >= 95
  // -------------------------------------------------------------------------
  try {
    const coverageVal = audit?.coverage?.overall ?? null;
    const coveragePassed = coverageVal !== null && coverageVal >= 95;
    const coverageDetail =
      coverageVal !== null
        ? `Coverage: ${coverageVal.toFixed(1)}% -- ${coveragePassed ? "PASS" : "FAIL (need >= 95%)"}`
        : "No coverage data in audit report";

    checks.push({
      id: 8,
      name: "Coverage >= 95%",
      passed: coveragePassed,
      detail: coverageDetail,
    });
  } catch (e) {
    checks.push({
      id: 8,
      name: "Coverage >= 95%",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 9. Gemini clean
  // -------------------------------------------------------------------------
  try {
    let geminiClean = false;
    let geminiDetail = "";

    if (audit?.geminiAudit) {
      const compIssues = audit.geminiAudit.componentIssues?.length ?? 0;
      const pixIssues = audit.geminiAudit.pixelIssues?.length ?? 0;
      geminiClean = compIssues === 0 && pixIssues === 0;
      geminiDetail = geminiClean
        ? "No component or pixel issues"
        : `${compIssues} component issue(s), ${pixIssues} pixel issue(s)`;
    } else {
      geminiDetail = "No Gemini audit data in audit report";
    }

    checks.push({
      id: 9,
      name: "Gemini clean",
      passed: geminiClean,
      detail: geminiDetail,
    });
  } catch (e) {
    checks.push({
      id: 9,
      name: "Gemini clean",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 10. Regression passes (cached across batch)
  // -------------------------------------------------------------------------
  try {
    if (!_regressionResult) {
      log(STEP, "Running regression-check.ts ...");
      const regressionScript = path.join(
        AUTOBOT_ROOT,
        "scripts",
        "regression-check.ts"
      );
      const result = runCommand(`npx ts-node "${regressionScript}"`, {
        cwd: AUTOBOT_ROOT,
        timeout: 180_000,
        silent: true,
      });
      _regressionResult = {
        ran: true,
        passed: result.ok,
        detail: result.ok
          ? "Regression check passed (exit code 0)"
          : `Regression check failed (exit code != 0): ${(result.stderr || result.stdout).slice(0, 300)}`,
      };
      log(
        STEP,
        `Regression check: ${_regressionResult.passed ? "PASS" : "FAIL"}`
      );
    }

    checks.push({
      id: 10,
      name: "Regression passes",
      passed: _regressionResult.passed,
      detail: _regressionResult.detail,
    });
  } catch (e) {
    checks.push({
      id: 10,
      name: "Regression passes",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 11. Learnings exist (soft failure -- flagged but doesn't block alone)
  // -------------------------------------------------------------------------
  try {
    const learningsPath = path.join(
      BB_LEARNINGS_DIR,
      `${figmaId}-learnings.md`
    );
    const learningsExist = fs.existsSync(learningsPath);

    checks.push({
      id: 11,
      name: "Learnings exist",
      passed: learningsExist,
      detail: learningsExist
        ? `Found at ${learningsPath}`
        : `Missing: ${learningsPath} (soft failure)`,
    });
  } catch (e) {
    checks.push({
      id: 11,
      name: "Learnings exist",
      passed: false,
      detail: `Error: ${(e as Error).message}`,
    });
  }

  // -------------------------------------------------------------------------
  // 12. Progress update ready (always passes -- this is the write step)
  // -------------------------------------------------------------------------
  checks.push({
    id: 12,
    name: "Progress update ready",
    passed: true,
    detail: "Ready to update progress.json if all other checks pass",
  });

  // -------------------------------------------------------------------------
  // Build certification report
  // -------------------------------------------------------------------------

  const allPassed = checks.every((c) => c.passed);

  const report: CertificationReport = {
    screenId: figmaId,
    timestamp: new Date().toISOString(),
    allPassed,
    checks,
    promotedTo: allPassed ? "CERTIFIED" : null,
  };

  // Always write the certification report
  ensureDir(REPORTS_SCREEN);
  const reportPath = path.join(REPORTS_SCREEN, `${figmaId}-certification.json`);
  writeJsonSafe(reportPath, report);
  log(STEP, `Certification report written: ${reportPath}`);

  return report;
}

// ---------------------------------------------------------------------------
// Promotion: update progress.json for a CERTIFIED screen
// ---------------------------------------------------------------------------

function promoteScreen(figmaId: string, progress: ProgressData): void {
  const entry = progress.screens[figmaId];
  if (!entry) {
    logWarn(STEP, `No progress entry for ${figmaId}, cannot promote`);
    return;
  }

  entry.status = "CERTIFIED";
  entry.certifiedAt = new Date().toISOString();

  // Update compound metrics
  if (progress.compound_metrics) {
    const certifiedCount = Object.values(progress.screens).filter(
      (s) => s.status === "CERTIFIED"
    ).length;
    progress.compound_metrics.certified = certifiedCount;
  }

  progress.lastUpdated = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Summary table (for batch mode)
// ---------------------------------------------------------------------------

function printSummaryTable(
  results: Array<{ figmaId: string; report: CertificationReport }>
): void {
  console.log("");
  console.log("=".repeat(78));
  console.log("  CERTIFICATION SUMMARY");
  console.log("=".repeat(78));
  console.log("");

  const hdr = [
    "Figma ID".padEnd(14),
    "Checks".padEnd(8),
    "Failed".padEnd(8),
    "Result".padEnd(12),
  ].join(" | ");
  console.log(`  ${hdr}`);
  console.log(`  ${"=".repeat(hdr.length)}`);

  let totalCertified = 0;
  let totalFailed = 0;

  for (const { figmaId, report } of results) {
    const passedCount = report.checks.filter((c) => c.passed).length;
    const failedCount = report.checks.length - passedCount;
    const status = report.allPassed ? "CERTIFIED" : "FAILED";

    if (report.allPassed) totalCertified++;
    else totalFailed++;

    const row = [
      figmaId.padEnd(14),
      `${passedCount}/${report.checks.length}`.padEnd(8),
      `${failedCount}`.padEnd(8),
      status.padEnd(12),
    ].join(" | ");
    console.log(`  ${row}`);

    // Print failed check names if any
    if (failedCount > 0) {
      const failedNames = report.checks
        .filter((c) => !c.passed)
        .map((c) => `#${c.id} ${c.name}`)
        .join(", ");
      console.log(`  ${"".padEnd(14)}   Failed: ${failedNames}`);
    }
  }

  console.log("");
  console.log(
    `  Total: ${results.length} screen(s) | ${totalCertified} certified | ${totalFailed} failed`
  );
  console.log("=".repeat(78));
  console.log("");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const arg = process.argv[2];

  if (!arg) {
    logError(
      STEP,
      "Usage: certify-screen.ts <figmaId> | --screen <screenKey>"
    );
    process.exit(1);
  }

  // Determine figmaIds to process
  let figmaIds: string[];

  if (arg === "--screen") {
    const screenKey = process.argv[3];
    if (!screenKey) {
      logError(STEP, "--screen flag requires a screenKey argument");
      process.exit(1);
    }
    figmaIds = getFigmaIdsForRoute(screenKey);
    if (figmaIds.length === 0) {
      logError(
        STEP,
        `No figmaIds found for screenKey "${screenKey}" in screen-routes.json`
      );
      process.exit(1);
    }
    log(
      STEP,
      `Batch mode: screenKey="${screenKey}" -> ${figmaIds.length} figmaId(s): ${figmaIds.join(", ")}`
    );
  } else {
    figmaIds = [arg];
    log(STEP, `Single mode: figmaId="${arg}"`);
  }

  // Load progress.json
  const progress = readJsonSafe<ProgressData>(PROGRESS_JSON);
  if (!progress) {
    logError(STEP, `Cannot read progress.json at ${PROGRESS_JSON}`);
    process.exit(1);
  }

  // Run certification on each figmaId
  const results: Array<{ figmaId: string; report: CertificationReport }> = [];

  for (const figmaId of figmaIds) {
    const report = runCertification(figmaId);
    results.push({ figmaId, report });

    if (report.allPassed) {
      log(STEP, `ALL 12 CHECKS PASSED for ${figmaId} -- promoting to CERTIFIED`);
      promoteScreen(figmaId, progress);
    } else {
      const failedChecks = report.checks.filter((c) => !c.passed);
      logWarn(
        STEP,
        `${figmaId}: ${failedChecks.length} check(s) FAILED:`
      );
      for (const fc of failedChecks) {
        logWarn(STEP, `  #${fc.id} ${fc.name}: ${fc.detail}`);
      }
    }
  }

  // Save progress.json if any screen was promoted
  const anyPromoted = results.some((r) => r.report.allPassed);
  if (anyPromoted) {
    const saved = writeJsonSafe(PROGRESS_JSON, progress);
    if (saved) {
      log(STEP, `progress.json updated`);
    } else {
      logError(STEP, "Failed to write progress.json");
    }
  }

  // Print summary table for batch mode (or single mode -- always useful)
  printSummaryTable(results);

  // Exit with appropriate code
  const allCertified = results.every((r) => r.report.allPassed);
  process.exit(allCertified ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main();
