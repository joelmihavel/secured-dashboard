/**
 * bridge-reports.ts — Bridges BuildBot audit data into AutoBot Tier 2 summaries.
 *
 * Usage:
 *   cd autobot && npx ts-node scripts/bridge-reports.ts <screenId>
 *   cd autobot && npx ts-node scripts/bridge-reports.ts --all
 *
 * Reads BuildBot audit reports and unit test reports, combines with progress.json
 * data, and writes ScreenSummary JSON files to autobot/reports/screen/.
 */

import * as path from "path";
import * as fs from "fs";
import {
  PROGRESS_JSON,
  REPORTS_SCREEN,
  REPORTS_TESTS,
  BB_AUDITS,
} from "./lib/paths";
import {
  ProgressData,
  AuditReport,
  UnitTestReport,
  ScreenSummary,
} from "./lib/types";
import {
  log,
  logError,
  logWarn,
  readJsonSafe,
  writeJsonSafe,
  ensureDir,
  resolveScreenName,
} from "./lib/utils";

// ---------------------------------------------------------------------------
// Unit test report matching
// ---------------------------------------------------------------------------

/**
 * Scan autobot/reports/tests/ for a unit test report that covers the given
 * screenId. Test reports use several conventions:
 *   - `screenId` field matches directly (e.g. "1-29108")
 *   - `secondaryScreenId` field matches (e.g. splash report covers "1-28053")
 *   - `figmaIds` array contains the screenId (e.g. carousel report)
 *   - filename contains the resolved screen name (fallback)
 */
function findUnitTestReport(screenId: string): UnitTestReport | null {
  if (!fs.existsSync(REPORTS_TESTS)) return null;

  const files = fs.readdirSync(REPORTS_TESTS).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(REPORTS_TESTS, file);
    const report = readJsonSafe<Record<string, unknown>>(filePath);
    if (!report) continue;

    // Direct screenId match
    if (report.screenId === screenId) {
      return report as unknown as UnitTestReport;
    }

    // Secondary screenId match (e.g. splash covers both 1-28055 and 1-28053)
    if (
      typeof report.secondaryScreenId === "string" &&
      report.secondaryScreenId === screenId
    ) {
      return report as unknown as UnitTestReport;
    }

    // figmaIds array match (e.g. carousel covers multiple pages)
    if (Array.isArray(report.figmaIds) && report.figmaIds.includes(screenId)) {
      return report as unknown as UnitTestReport;
    }
  }

  // Fallback: try to match by screen name in filename
  const resolved = resolveScreenName(screenId);
  if (resolved) {
    const nameLower = resolved.name.toLowerCase().replace(/\s+/g, "-");
    for (const file of files) {
      const fileBase = path.basename(file, ".json").toLowerCase();
      if (nameLower.includes(fileBase) || fileBase.includes(nameLower)) {
        const filePath = path.join(REPORTS_TESTS, file);
        return readJsonSafe<UnitTestReport>(filePath);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core bridge logic for a single screen
// ---------------------------------------------------------------------------

function bridgeScreen(
  screenId: string,
  progress: ProgressData
): ScreenSummary | null {
  const STEP = "BRIDGE";

  // -- Progress entry --
  const entry = progress.screens[screenId];
  if (!entry) {
    logWarn(STEP, `No progress entry for screenId=${screenId}, skipping.`);
    return null;
  }

  // -- Screen name resolution --
  const screenName =
    entry.name || resolveScreenName(screenId)?.name || screenId;

  // -- Audit report --
  const auditPath = path.join(BB_AUDITS, `${screenId}-audit.json`);
  const audit = readJsonSafe<AuditReport>(auditPath);
  if (!audit) {
    logWarn(STEP, `No audit report found at ${auditPath}`);
  }

  // -- Unit test report --
  const testReport = findUnitTestReport(screenId);
  if (!testReport) {
    logWarn(STEP, `No unit test report found for screenId=${screenId}`);
  }

  // -- Visual data --
  const visual: ScreenSummary["visual"] = {
    pixelDiff: audit?.pixelDiff?.percentage ?? null,
    pixelDiffPassed: audit?.pixelDiff?.passed ?? null,
    coverage: audit?.coverage?.overall ?? null,
    coveragePassed: audit?.coverage?.passed ?? null,
    inspectorScore: audit?.inspection?.overallScore ?? null,
    geminiClean:
      audit?.geminiAudit != null
        ? audit.geminiAudit.componentIssues.length === 0 &&
          audit.geminiAudit.pixelIssues.length === 0
        : null,
  };

  // -- Testing data --
  const testing: ScreenSummary["testing"] = {
    unitTestFile: testReport?.testFile ?? null,
    totalTests: testReport?.totalTests ?? 0,
    passed: testReport?.passed ?? 0,
    failed: testReport?.failed ?? 0,
  };

  // -- Certification readiness --
  const blockers: string[] = [];

  if (entry.status !== "VERIFIED" && entry.status !== "CERTIFIED") {
    blockers.push(`Status is ${entry.status}, not VERIFIED or CERTIFIED`);
  }
  if (visual.pixelDiffPassed === false) {
    blockers.push(
      `Pixel diff failed (${visual.pixelDiff?.toFixed(2)}% exceeds threshold)`
    );
  }
  if (visual.coveragePassed === false) {
    blockers.push(
      `Coverage check failed (${visual.coverage?.toFixed(1)}%)`
    );
  }
  if (visual.geminiClean === false) {
    blockers.push("Gemini audit found component or pixel issues");
  }
  if (testing.failed > 0) {
    blockers.push(`${testing.failed} unit test(s) failing`);
  }
  if (testing.totalTests === 0) {
    blockers.push("No unit tests found");
  }

  const certReady = blockers.length === 0;

  const summary: ScreenSummary = {
    screenId,
    screenName,
    route: entry.route,
    flow: entry.flow,
    status: entry.status,
    timestamp: new Date().toISOString(),
    visual,
    testing,
    certification: {
      ready: certReady,
      blockers,
    },
  };

  // -- Write output --
  const outPath = path.join(REPORTS_SCREEN, `${screenId}-summary.json`);
  const ok = writeJsonSafe(outPath, summary);
  if (ok) {
    log(STEP, `Wrote summary: ${outPath}`);
  } else {
    logError(STEP, `Failed to write summary for ${screenId}`);
    return null;
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const STEP = "MAIN";
  const arg = process.argv[2];

  if (!arg) {
    logError(STEP, "Usage: bridge-reports.ts <screenId> | --all");
    process.exit(1);
  }

  // Ensure output directory exists
  ensureDir(REPORTS_SCREEN);

  // Load progress.json
  const progress = readJsonSafe<ProgressData>(PROGRESS_JSON);
  if (!progress) {
    logError(STEP, `Cannot read progress.json at ${PROGRESS_JSON}`);
    process.exit(1);
  }

  if (arg === "--all") {
    // Process all screens from progress.json
    const screenIds = Object.keys(progress.screens);
    log(STEP, `Processing all ${screenIds.length} screens from progress.json`);

    let successCount = 0;
    let skipCount = 0;

    for (const screenId of screenIds) {
      const result = bridgeScreen(screenId, progress);
      if (result) {
        successCount++;
      } else {
        skipCount++;
      }
    }

    log(
      STEP,
      `Bridge complete: ${successCount} summaries written, ${skipCount} skipped (${screenIds.length} total)`
    );
  } else {
    // Process single screenId
    const screenId = arg;
    log(STEP, `Processing single screen: ${screenId}`);

    const result = bridgeScreen(screenId, progress);
    if (result) {
      log(STEP, `Bridge complete for ${screenId} (cert ready: ${result.certification.ready})`);
    } else {
      logError(STEP, `Bridge failed for ${screenId}`);
      process.exit(1);
    }
  }
}

main();
