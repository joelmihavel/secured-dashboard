import * as path from "path";

export const AUTOBOT_ROOT = path.join(__dirname, "..", "..");
export const BUILDBOT_ROOT = path.join(AUTOBOT_ROOT, "..", "buildbot");
export const RN_APP_ROOT = path.join(AUTOBOT_ROOT, "..", "rn-app");

// AutoBot state
export const PROGRESS_JSON = path.join(AUTOBOT_ROOT, "state", "progress.json");
export const METRICS_JSON = path.join(AUTOBOT_ROOT, "state", "metrics.json");
export const SESSION_LOG = path.join(AUTOBOT_ROOT, "state", "session-log.md");

// AutoBot config
export const FLOW_MAP_JSON = path.join(AUTOBOT_ROOT, "config", "flow-map.json");
export const EXECUTION_ORDER_JSON = path.join(AUTOBOT_ROOT, "config", "execution-order.json");

// AutoBot reports
export const REPORTS_SCREEN = path.join(AUTOBOT_ROOT, "reports", "screen");
export const REPORTS_FLOW = path.join(AUTOBOT_ROOT, "reports", "flow");
export const REPORTS_REGRESSION = path.join(AUTOBOT_ROOT, "reports", "regression");
export const REPORTS_TESTS = path.join(AUTOBOT_ROOT, "reports", "tests");

// AutoBot solutions
export const SOLUTIONS_ROOT = path.join(AUTOBOT_ROOT, "solutions");
export const SOLUTIONS_FIGMA = path.join(SOLUTIONS_ROOT, "figma-interpretation");
export const SOLUTIONS_RN = path.join(SOLUTIONS_ROOT, "rn-patterns");
export const SOLUTIONS_COMPONENT = path.join(SOLUTIONS_ROOT, "component-recipes");
export const SOLUTIONS_FIX = path.join(SOLUTIONS_ROOT, "fix-recipes");

// BuildBot paths
export const BB_AUDITS = path.join(BUILDBOT_ROOT, "reports", "audits");
export const BB_COVERAGE = path.join(BUILDBOT_ROOT, "reports", "coverage");
export const BB_LEARNINGS = path.join(BUILDBOT_ROOT, "learnings", "buildbot-learnings.md");
export const BB_BLUEPRINTS = path.join(BUILDBOT_ROOT, "data", "blueprints");
export const BB_SCREEN_ROUTES = path.join(BUILDBOT_ROOT, "config", "screen-routes.json");
export const BB_FLOWS_DIR = path.join(BUILDBOT_ROOT, "data", "flows");
export const BB_ENV = path.join(BUILDBOT_ROOT, ".env");
