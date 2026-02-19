// ---------------------------------------------------------------------------
// progress.json
// ---------------------------------------------------------------------------

export type ScreenStatus =
  | "PENDING"
  | "EXTRACTED"
  | "COVERAGE_PASS"
  | "VERIFIED"
  | "CERTIFIED"
  | "BLOCKED";

export interface ScreenProgress {
  name: string;
  route: string;
  flow: string;
  status: ScreenStatus;
  coverage?: number;
  pixelDiff?: number;
  inspectorScore?: number;
  extractedAt?: string;
  verifiedAt?: string;
  certifiedAt?: string;
  note?: string;
  blueprintNodes?: number;
}

export interface CompoundMetrics {
  total_screens: number;
  certified: number;
  coverage_pass: number;
  extracted: number;
  pending: number;
  avg_time_to_certify_min: number | null;
  first_pass_success_rate: number | null;
  fix_loop_avg: number | null;
  agents_md_entries: number;
  velocity_trend: string;
}

export interface ProgressData {
  screens: Record<string, ScreenProgress>;
  compound_metrics: CompoundMetrics;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// BuildBot audit report (from verify-screen.ts)
// ---------------------------------------------------------------------------

export interface PixelDiffResult {
  percentage: number;
  threshold: number;
  passed: boolean;
  diffImagePath: string;
}

export interface CoverageResult {
  typography: number;
  colors: number;
  spacing: number;
  overall: number;
  passed: boolean;
}

export interface GeminiAuditResult {
  componentIssues: unknown[];
  pixelIssues: unknown[];
}

export interface InspectionResult {
  overallScore: number;
  criticalIssues: string[];
  suggestions: string[];
}

export interface PMBriefResult {
  hasBrief: boolean;
  briefPath: string;
  functionalAreas: number;
  states: number;
  pmIssues: number;
}

export interface BackendBriefResult {
  hasBrief: boolean;
  briefPath: string;
  requiredHooks: string[];
  mockDataPopulated: boolean;
}

export interface AuditReport {
  screenId: string;
  timestamp: string;
  route: string;
  pmBrief?: PMBriefResult;
  backendBrief?: BackendBriefResult;
  pixelDiff: PixelDiffResult;
  coverage?: CoverageResult;
  geminiAudit?: GeminiAuditResult;
  inspection?: InspectionResult;
  overallPassed: boolean;
  failureReasons: string[];
}

// ---------------------------------------------------------------------------
// Unit test report (from autobot/reports/tests/)
// ---------------------------------------------------------------------------

export interface UnitTestReport {
  screenId: string;
  testType: string;
  timestamp: string;
  testFile: string;
  fixtureFile?: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  executionTimeMs: number;
  failures: unknown[];
  testIdsVerified: string[];
  testIdsMissing: string[];
  statesCovered: string[];
  statesMissing: string[];
  categoriesCovered: Record<string, boolean>;
  notes?: string;
}

// ---------------------------------------------------------------------------
// flow-map.json
// ---------------------------------------------------------------------------

export interface FlowState {
  figmaId: string;
  stories: string[];
}

export interface FlowScreen {
  route: string;
  states: Record<string, FlowState>;
}

export interface Flow {
  screens: Record<string, FlowScreen>;
}

export interface FlowMap {
  description: string;
  flows: Record<string, Flow>;
}

// ---------------------------------------------------------------------------
// execution-order.json
// ---------------------------------------------------------------------------

export interface ExecutionOrderFlow {
  order: number;
  id: string;
  name: string;
  routes: string[];
  screenStates: number;
  status: string;
}

export interface ExecutionOrder {
  description: string;
  currentFlow: number;
  flows: ExecutionOrderFlow[];
}

// ---------------------------------------------------------------------------
// screen-routes.json (BuildBot)
// ---------------------------------------------------------------------------

export interface ScreenRouteScreen {
  figmaId: string;
  name: string;
  state: string;
  routeWithState?: string;
}

export interface ScreenRouteEntry {
  figmaPatterns: string[];
  route: string;
  screens: ScreenRouteScreen[];
}

export interface ScreenRoutesConfig {
  _description?: string;
  routes: Record<string, ScreenRouteEntry>;
}

// ---------------------------------------------------------------------------
// Bridge report output (autobot/reports/screen/)
// ---------------------------------------------------------------------------

export interface ScreenSummary {
  screenId: string;
  screenName: string;
  route: string;
  flow: string;
  status: ScreenStatus;
  timestamp: string;
  visual: {
    pixelDiff: number | null;
    pixelDiffPassed: boolean | null;
    coverage: number | null;
    coveragePassed: boolean | null;
    inspectorScore: number | null;
    geminiClean: boolean | null;
  };
  testing: {
    unitTestFile: string | null;
    totalTests: number;
    passed: number;
    failed: number;
  };
  certification: {
    ready: boolean;
    blockers: string[];
  };
}

// ---------------------------------------------------------------------------
// Certification report (autobot/reports/screen/)
// ---------------------------------------------------------------------------

export interface CertificationCheck {
  id: number;
  name: string;
  passed: boolean;
  detail: string;
}

export interface CertificationReport {
  screenId: string;
  timestamp: string;
  allPassed: boolean;
  checks: CertificationCheck[];
  promotedTo: ScreenStatus | null;
}

// ---------------------------------------------------------------------------
// Regression report (autobot/reports/regression/)
// ---------------------------------------------------------------------------

export interface RegressionScreenResult {
  screenId: string;
  name: string;
  coverageOk: boolean;
  codeChanged: boolean;
  needsReverification: boolean;
}

export interface RegressionReport {
  timestamp: string;
  certifiedScreens: number;
  tscPassed: boolean;
  jestPassed: boolean;
  screens: RegressionScreenResult[];
  allPassed: boolean;
}

// ---------------------------------------------------------------------------
// Flow report (autobot/reports/flow/)
// ---------------------------------------------------------------------------

export interface FlowReport {
  flowId: string;
  flowName: string;
  timestamp: string;
  screens: Array<{
    screenId: string;
    name: string;
    pixelDiff: number | null;
    coverage: number | null;
    inspectorScore: number | null;
  }>;
  aggregate: {
    avgPixelDiff: number;
    avgCoverage: number;
    avgInspectorScore: number;
    totalTests: number;
    testPassRate: number;
  };
  maestroYamls: string[];
  healthScore: number;
}

// ---------------------------------------------------------------------------
// Metrics (autobot/state/metrics.json)
// ---------------------------------------------------------------------------

export interface Metrics {
  screens_verified: number;
  screens_coverage_pass: number;
  screens_extracted: number;
  screens_total: number;
  tests_passing: number;
  unit_tests: number;
  maestro_yamls: number;
  flows_completed: number;
  flows_total: number;
  velocity_trend: string;
  lastUpdated: string;
}
