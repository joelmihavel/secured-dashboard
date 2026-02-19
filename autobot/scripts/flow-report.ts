/**
 * flow-report.ts -- Generates a flow summary when all screens in a flow are CERTIFIED.
 *
 * Usage:
 *   cd autobot && npx ts-node scripts/flow-report.ts auth
 *   cd autobot && npx ts-node scripts/flow-report.ts otp
 *
 * Reads flow-map.json to resolve all figmaIds in the flow, verifies all are
 * CERTIFIED in progress.json, aggregates audit + test data, and writes a
 * FlowReport to autobot/reports/flow/{flowId}-report.json.
 *
 * Also updates execution-order.json (status -> "complete") and increments
 * metrics.json flows_completed.
 */

import * as path from "path";
import * as fs from "fs";
import {
  PROGRESS_JSON,
  FLOW_MAP_JSON,
  EXECUTION_ORDER_JSON,
  METRICS_JSON,
  REPORTS_FLOW,
  REPORTS_TESTS,
  BB_AUDITS,
  BB_FLOWS_DIR,
  RN_APP_ROOT,
} from "./lib/paths";
import {
  ProgressData,
  FlowMap,
  ExecutionOrder,
  Metrics,
  AuditReport,
  UnitTestReport,
  FlowReport,
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
// Helpers
// ---------------------------------------------------------------------------

const STEP = "FLOW-REPORT";

/**
 * Collect every figmaId from all screens/states within a flow.
 */
function collectFigmaIds(flowMap: FlowMap, flowId: string): string[] {
  const flow = flowMap.flows[flowId];
  if (!flow) return [];

  const ids: string[] = [];
  for (const screen of Object.values(flow.screens)) {
    for (const state of Object.values(screen.states)) {
      ids.push(state.figmaId);
    }
  }
  return ids;
}

/**
 * Scan autobot/reports/tests/ for a unit test report covering the given screenId.
 * Matches on: screenId field, secondaryScreenId, figmaIds array, or filename.
 */
function findUnitTestReport(screenId: string): UnitTestReport | null {
  if (!fs.existsSync(REPORTS_TESTS)) return null;

  const files = fs.readdirSync(REPORTS_TESTS).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(REPORTS_TESTS, file);
    const report = readJsonSafe<Record<string, unknown>>(filePath);
    if (!report) continue;

    if (report.screenId === screenId) {
      return report as unknown as UnitTestReport;
    }

    if (
      typeof report.secondaryScreenId === "string" &&
      report.secondaryScreenId === screenId
    ) {
      return report as unknown as UnitTestReport;
    }

    if (Array.isArray(report.figmaIds) && report.figmaIds.includes(screenId)) {
      return report as unknown as UnitTestReport;
    }
  }

  // Fallback: match by screen name in filename
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

/**
 * Find Maestro YAML files relevant to the given flowId.
 * Searches buildbot/data/flows/ and rn-app/.maestro/ for filenames containing
 * the flowId string.
 */
function findMaestroYamls(flowId: string): string[] {
  const yamls: string[] = [];
  const flowIdLower = flowId.toLowerCase();

  // Search buildbot/data/flows/
  if (fs.existsSync(BB_FLOWS_DIR)) {
    const flowFiles = fs.readdirSync(BB_FLOWS_DIR).filter((f) =>
      f.endsWith(".yaml") || f.endsWith(".yml")
    );
    for (const file of flowFiles) {
      if (file.toLowerCase().includes(flowIdLower)) {
        yamls.push(path.join("buildbot", "data", "flows", file));
      }
    }
  }

  // Search rn-app/.maestro/
  const maestroDir = path.join(RN_APP_ROOT, ".maestro");
  if (fs.existsSync(maestroDir)) {
    const maestroFiles = fs.readdirSync(maestroDir).filter((f) =>
      f.endsWith(".yaml") || f.endsWith(".yml")
    );
    for (const file of maestroFiles) {
      if (file.toLowerCase().includes(flowIdLower)) {
        yamls.push(path.join("rn-app", ".maestro", file));
      }
    }
  }

  return yamls;
}

/**
 * Clamp a number to the 0-100 range.
 */
function clamp0to100(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const flowId = process.argv[2];

  if (!flowId) {
    logError(STEP, "Usage: flow-report.ts <flowId>");
    logError(STEP, "Example: npx ts-node scripts/flow-report.ts auth");
    process.exit(1);
  }

  log(STEP, `Generating flow report for: ${flowId}`);

  // -- 1. Load flow-map.json and find the flow entry --
  const flowMap = readJsonSafe<FlowMap>(FLOW_MAP_JSON);
  if (!flowMap) {
    logError(STEP, `Cannot read flow-map.json at ${FLOW_MAP_JSON}`);
    process.exit(1);
  }

  if (!flowMap.flows[flowId]) {
    logError(STEP, `Flow "${flowId}" not found in flow-map.json`);
    logError(
      STEP,
      `Available flows: ${Object.keys(flowMap.flows).join(", ")}`
    );
    process.exit(1);
  }

  // -- 2. Collect all figmaIds from screens/states --
  const figmaIds = collectFigmaIds(flowMap, flowId);
  if (figmaIds.length === 0) {
    logError(STEP, `No figmaIds found for flow "${flowId}"`);
    process.exit(1);
  }

  log(STEP, `Found ${figmaIds.length} screen states in flow "${flowId}"`);

  // -- 3. Load progress.json and verify ALL are CERTIFIED --
  const progress = readJsonSafe<ProgressData>(PROGRESS_JSON);
  if (!progress) {
    logError(STEP, `Cannot read progress.json at ${PROGRESS_JSON}`);
    process.exit(1);
  }

  const notCertified: Array<{ figmaId: string; status: string }> = [];
  for (const figmaId of figmaIds) {
    const entry = progress.screens[figmaId];
    if (!entry) {
      notCertified.push({ figmaId, status: "MISSING" });
    } else if (entry.status !== "CERTIFIED") {
      notCertified.push({ figmaId, status: entry.status });
    }
  }

  if (notCertified.length > 0) {
    logError(
      STEP,
      `Cannot generate flow report: ${notCertified.length} screen(s) are not CERTIFIED`
    );
    for (const item of notCertified) {
      logError(STEP, `  - ${item.figmaId}: ${item.status}`);
    }
    process.exit(1);
  }

  log(STEP, `All ${figmaIds.length} screens are CERTIFIED`);

  // -- 4. Collect per-screen audit + test data --
  const screenEntries: FlowReport["screens"] = [];

  const pixelDiffs: number[] = [];
  const coverages: number[] = [];
  const inspectorScores: number[] = [];
  let totalTests = 0;
  let totalPassed = 0;

  for (const figmaId of figmaIds) {
    const progressEntry = progress.screens[figmaId];
    const screenName =
      progressEntry?.name || resolveScreenName(figmaId)?.name || figmaId;

    // Read audit report
    const auditPath = path.join(BB_AUDITS, `${figmaId}-audit.json`);
    const audit = readJsonSafe<AuditReport>(auditPath);

    let pixelDiff: number | null = null;
    let coverage: number | null = null;
    let inspectorScore: number | null = null;

    if (audit) {
      if (audit.pixelDiff?.percentage != null) {
        pixelDiff = audit.pixelDiff.percentage;
        pixelDiffs.push(pixelDiff);
      }
      if (audit.coverage?.overall != null) {
        coverage = audit.coverage.overall;
        coverages.push(coverage);
      }
      if (audit.inspection?.overallScore != null) {
        inspectorScore = audit.inspection.overallScore;
        inspectorScores.push(inspectorScore);
      }
    } else {
      logWarn(STEP, `No audit report for ${figmaId}, using progress data`);
      // Fall back to progress.json values
      if (progressEntry?.pixelDiff != null) {
        pixelDiff = progressEntry.pixelDiff;
        pixelDiffs.push(pixelDiff);
      }
      if (progressEntry?.coverage != null) {
        coverage = progressEntry.coverage;
        coverages.push(coverage);
      }
      if (progressEntry?.inspectorScore != null) {
        inspectorScore = progressEntry.inspectorScore;
        inspectorScores.push(inspectorScore);
      }
    }

    // Read unit test report
    const testReport = findUnitTestReport(figmaId);
    if (testReport) {
      totalTests += testReport.totalTests;
      totalPassed += testReport.passed;
    }

    screenEntries.push({
      screenId: figmaId,
      name: screenName,
      pixelDiff,
      coverage,
      inspectorScore,
    });
  }

  // -- 5. Aggregate metrics --
  const avgPixelDiff =
    pixelDiffs.length > 0
      ? pixelDiffs.reduce((a, b) => a + b, 0) / pixelDiffs.length
      : 0;

  const avgCoverage =
    coverages.length > 0
      ? coverages.reduce((a, b) => a + b, 0) / coverages.length
      : 0;

  const avgInspectorScore =
    inspectorScores.length > 0
      ? inspectorScores.reduce((a, b) => a + b, 0) / inspectorScores.length
      : 0;

  const testPassRate =
    totalTests > 0 ? (totalPassed / totalTests) * 100 : 100;

  // -- 6. Find Maestro YAMLs --
  const maestroYamls = findMaestroYamls(flowId);
  if (maestroYamls.length > 0) {
    log(STEP, `Found ${maestroYamls.length} Maestro YAML(s) for this flow`);
  } else {
    logWarn(STEP, `No Maestro YAML files found matching "${flowId}"`);
  }

  // -- 7. Calculate health score --
  // healthScore = (avgCoverage * 0.3) + ((100 - avgPixelDiff) * 0.3) + (testPassRate * 0.2) + (avgInspectorScore * 0.2)
  const rawHealth =
    avgCoverage * 0.3 +
    (100 - avgPixelDiff) * 0.3 +
    testPassRate * 0.2 +
    avgInspectorScore * 0.2;

  const healthScore = clamp0to100(Math.round(rawHealth * 100) / 100);

  // -- 8. Resolve flow name from execution-order.json --
  const executionOrder = readJsonSafe<ExecutionOrder>(EXECUTION_ORDER_JSON);
  const execFlow = executionOrder?.flows.find((f) => f.id === flowId);
  const flowName = execFlow?.name || flowId;

  // -- 8b. Build the FlowReport --
  const report: FlowReport = {
    flowId,
    flowName,
    timestamp: new Date().toISOString(),
    screens: screenEntries,
    aggregate: {
      avgPixelDiff: Math.round(avgPixelDiff * 100) / 100,
      avgCoverage: Math.round(avgCoverage * 100) / 100,
      avgInspectorScore: Math.round(avgInspectorScore * 100) / 100,
      totalTests,
      testPassRate: Math.round(testPassRate * 100) / 100,
    },
    maestroYamls,
    healthScore,
  };

  // -- 9. Write flow report --
  ensureDir(REPORTS_FLOW);
  const reportPath = path.join(REPORTS_FLOW, `${flowId}-report.json`);
  const writeOk = writeJsonSafe(reportPath, report);
  if (!writeOk) {
    logError(STEP, `Failed to write flow report to ${reportPath}`);
    process.exit(1);
  }
  log(STEP, `Wrote flow report: ${reportPath}`);

  // -- 10. Update execution-order.json: set flow status to "complete" --
  if (executionOrder && execFlow) {
    execFlow.status = "complete";
    const eoWriteOk = writeJsonSafe(EXECUTION_ORDER_JSON, executionOrder);
    if (eoWriteOk) {
      log(STEP, `Updated execution-order.json: "${flowId}" -> "complete"`);
    } else {
      logWarn(STEP, `Failed to update execution-order.json`);
    }
  } else {
    logWarn(
      STEP,
      `Flow "${flowId}" not found in execution-order.json, skipping status update`
    );
  }

  // -- 11. Update metrics.json: increment flows_completed --
  const metrics = readJsonSafe<Metrics>(METRICS_JSON);
  if (metrics) {
    metrics.flows_completed = (metrics.flows_completed || 0) + 1;
    metrics.lastUpdated = new Date().toISOString();
    const metricsWriteOk = writeJsonSafe(METRICS_JSON, metrics);
    if (metricsWriteOk) {
      log(
        STEP,
        `Updated metrics.json: flows_completed = ${metrics.flows_completed}`
      );
    } else {
      logWarn(STEP, `Failed to update metrics.json`);
    }
  } else {
    logWarn(STEP, `Cannot read metrics.json at ${METRICS_JSON}, skipping update`);
  }

  // -- 12. Log summary --
  log(STEP, `--- Flow Report Summary ---`);
  log(STEP, `Flow:             ${flowName} (${flowId})`);
  log(STEP, `Screens:          ${screenEntries.length}`);
  log(STEP, `Health Score:     ${healthScore}`);
  log(STEP, `Avg Pixel Diff:   ${report.aggregate.avgPixelDiff}%`);
  log(STEP, `Avg Coverage:     ${report.aggregate.avgCoverage}%`);
  log(STEP, `Avg Inspector:    ${report.aggregate.avgInspectorScore}`);
  log(STEP, `Total Tests:      ${totalTests}`);
  log(STEP, `Test Pass Rate:   ${report.aggregate.testPassRate}%`);
  log(STEP, `Maestro YAMLs:    ${maestroYamls.length}`);
  log(STEP, `---------------------------`);
}

main();
