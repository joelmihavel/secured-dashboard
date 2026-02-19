/**
 * populate-solutions.ts
 *
 * Parses BuildBot learnings and audit reports into categorized
 * solution library markdown files under autobot/solutions/.
 *
 * Usage:
 *   cd autobot && npx ts-node scripts/populate-solutions.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  BB_LEARNINGS,
  BB_AUDITS,
  SOLUTIONS_ROOT,
  SOLUTIONS_FIGMA,
  SOLUTIONS_RN,
  SOLUTIONS_COMPONENT,
  SOLUTIONS_FIX,
} from "./lib/paths";
import { AuditReport } from "./lib/types";
import { log, logError, readJsonSafe, ensureDir } from "./lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedLearning {
  title: string;
  why: string;
  how: string;
  category: string;
}

interface FailureAggregate {
  reason: string;
  screenIds: string[];
}

interface SolutionEntry {
  title: string;
  filename: string;
  category: string;
}

// ---------------------------------------------------------------------------
// Kebab-case conversion
// ---------------------------------------------------------------------------

function toKebabCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

const CATEGORY_DIR_MAP: Record<string, string> = {
  "Figma Interpretation": "figma-interpretation",
  "React Native Patterns": "rn-patterns",
  "Data and State": "component-recipes",
  "Pipeline and Process": "fix-recipes",
};

function getCategoryDir(category: string): string {
  return CATEGORY_DIR_MAP[category] || "fix-recipes";
}

function getCategoryFullPath(category: string): string {
  const dirName = getCategoryDir(category);
  switch (dirName) {
    case "figma-interpretation":
      return SOLUTIONS_FIGMA;
    case "rn-patterns":
      return SOLUTIONS_RN;
    case "component-recipes":
      return SOLUTIONS_COMPONENT;
    case "fix-recipes":
      return SOLUTIONS_FIX;
    default:
      return SOLUTIONS_FIX;
  }
}

// ---------------------------------------------------------------------------
// Parse learnings markdown
// ---------------------------------------------------------------------------

function parseLearnings(raw: string): ParsedLearning[] {
  const learnings: ParsedLearning[] = [];
  let currentCategory = "";
  let currentTitle = "";
  let contentLines: string[] = [];

  const lines = raw.split("\n");

  function flushLearning(): void {
    if (!currentTitle || !currentCategory) return;

    const content = contentLines.join("\n");
    const why = extractSection(content, "Why");
    const how = extractSection(content, "How");

    if (why || how) {
      learnings.push({
        title: currentTitle,
        why: why.trim(),
        how: how.trim(),
        category: currentCategory,
      });
    }

    contentLines = [];
  }

  for (const line of lines) {
    // Category header: ## Figma Interpretation
    if (line.startsWith("## ") && !line.startsWith("### ")) {
      flushLearning();
      currentTitle = "";
      currentCategory = line.replace("## ", "").trim();
      continue;
    }

    // Learning title: ### Map Figma fontWeight...
    if (line.startsWith("### ")) {
      flushLearning();
      currentTitle = line.replace("### ", "").trim();
      contentLines = [];
      continue;
    }

    // Accumulate content under current ### heading
    if (currentTitle) {
      contentLines.push(line);
    }
  }

  // Flush last learning
  flushLearning();

  return learnings;
}

/**
 * Extract content after a **Label**: marker up to the next **Label**: or ### or end.
 */
function extractSection(content: string, label: string): string {
  // Match **Why**: or **How**: followed by content
  const pattern = new RegExp(
    `\\*\\*${label}\\*\\*:\\s*(.+?)(?=\\*\\*(?:Why|How)\\*\\*:|###|$)`,
    "s"
  );
  const match = content.match(pattern);
  if (!match) return "";
  return match[1].trim();
}

// ---------------------------------------------------------------------------
// Write learning solution files
// ---------------------------------------------------------------------------

function writeLearningFiles(learnings: ParsedLearning[]): SolutionEntry[] {
  const entries: SolutionEntry[] = [];

  for (const learning of learnings) {
    const dirPath = getCategoryFullPath(learning.category);
    ensureDir(dirPath);

    const filename = toKebabCase(learning.title) + ".md";
    const filePath = path.join(dirPath, filename);

    const content = [
      `# ${learning.title}`,
      "",
      "## Problem",
      learning.why || "No problem description available.",
      "",
      "## Solution",
      learning.how || "No solution description available.",
      "",
      "## Source",
      "buildbot/learnings/buildbot-learnings.md",
      "",
    ].join("\n");

    try {
      fs.writeFileSync(filePath, content, "utf-8");
      entries.push({
        title: learning.title,
        filename,
        category: getCategoryDir(learning.category),
      });
    } catch (e) {
      logError(
        "WRITE",
        `Failed to write ${filePath}: ${(e as Error).message}`
      );
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Scan audit reports for recurring failure reasons
// ---------------------------------------------------------------------------

function scanAuditFailures(): FailureAggregate[] {
  if (!fs.existsSync(BB_AUDITS)) {
    log("AUDITS", `Audit directory not found: ${BB_AUDITS}`);
    return [];
  }

  const files = fs.readdirSync(BB_AUDITS).filter((f) => f.endsWith("-audit.json"));
  const failureMap = new Map<string, Set<string>>();

  for (const file of files) {
    const filePath = path.join(BB_AUDITS, file);
    const report = readJsonSafe<AuditReport>(filePath);
    if (!report || !report.failureReasons) continue;

    for (const reason of report.failureReasons) {
      // Normalize: trim, collapse whitespace
      const normalized = reason.trim().replace(/\s+/g, " ");
      if (!normalized) continue;

      if (!failureMap.has(normalized)) {
        failureMap.set(normalized, new Set());
      }
      failureMap.get(normalized)!.add(report.screenId);
    }
  }

  // Filter to recurring failures (2+ audit files)
  const recurring: FailureAggregate[] = [];
  for (const [reason, screenIds] of failureMap) {
    if (screenIds.size >= 2) {
      recurring.push({
        reason,
        screenIds: Array.from(screenIds).sort(),
      });
    }
  }

  return recurring;
}

// ---------------------------------------------------------------------------
// Write fix-recipe files from audit failures
// ---------------------------------------------------------------------------

function writeFixRecipeFiles(failures: FailureAggregate[]): SolutionEntry[] {
  const entries: SolutionEntry[] = [];
  ensureDir(SOLUTIONS_FIX);

  for (const failure of failures) {
    // Create a summarized title from the failure reason
    const summaryTitle = summarizeFailureReason(failure.reason);
    const filename = "fix-" + toKebabCase(summaryTitle) + ".md";
    const filePath = path.join(SOLUTIONS_FIX, filename);

    const screenList = failure.screenIds.map((id) => `- ${id}`).join("\n");

    const content = [
      `# Fix: ${summaryTitle}`,
      "",
      "## Problem",
      failure.reason,
      "",
      "## Affected Screens",
      screenList,
      "",
      "## Source",
      "Aggregated from BuildBot audit reports",
      "",
    ].join("\n");

    try {
      fs.writeFileSync(filePath, content, "utf-8");
      entries.push({
        title: `Fix: ${summaryTitle}`,
        filename,
        category: "fix-recipes",
      });
    } catch (e) {
      logError(
        "WRITE",
        `Failed to write ${filePath}: ${(e as Error).message}`
      );
    }
  }

  return entries;
}

/**
 * Summarize a long failure reason string into a short title.
 * Takes the first sentence or first 80 characters, whichever is shorter.
 */
function summarizeFailureReason(reason: string): string {
  // Remove leading identifiers like "Inspector found N critical issue(s):"
  let cleaned = reason.replace(
    /^(Inspector found \d+ critical issue\(s\):\s*)/,
    ""
  );
  cleaned = cleaned.replace(
    /^(Backend Agent:\s*)/,
    ""
  );
  cleaned = cleaned.replace(
    /^(Pixel diff [0-9.]+% exceeds threshold of [0-9.]+%\.)\s*/,
    "Pixel diff exceeds threshold"
  );
  cleaned = cleaned.replace(
    /^(Coverage overall [0-9.]+% is below [0-9.]+% threshold\.)\s*/,
    "Coverage below threshold"
  );

  // Take first sentence
  const firstSentence = cleaned.split(/[.;]/)[0].trim();

  // Cap at 80 chars
  if (firstSentence.length > 80) {
    return firstSentence.slice(0, 77) + "...";
  }

  return firstSentence || "Unknown failure";
}

// ---------------------------------------------------------------------------
// Write INDEX.md
// ---------------------------------------------------------------------------

function writeIndex(
  learningEntries: SolutionEntry[],
  fixEntries: SolutionEntry[]
): void {
  const timestamp = new Date().toISOString();
  const allEntries = [...learningEntries, ...fixEntries];

  // Group by category
  const byCategory = new Map<string, SolutionEntry[]>();
  for (const entry of allEntries) {
    if (!byCategory.has(entry.category)) {
      byCategory.set(entry.category, []);
    }
    byCategory.get(entry.category)!.push(entry);
  }

  // Category display names in desired order
  const categoryOrder: Array<{ dir: string; display: string }> = [
    { dir: "figma-interpretation", display: "Figma Interpretation" },
    { dir: "rn-patterns", display: "React Native Patterns" },
    { dir: "component-recipes", display: "Component Recipes" },
    { dir: "fix-recipes", display: "Fix Recipes" },
  ];

  const sections: string[] = [];
  sections.push("# Solution Library Index");
  sections.push("");
  sections.push(`Generated: ${timestamp}`);

  for (const { dir, display } of categoryOrder) {
    const entries = byCategory.get(dir) || [];
    sections.push("");
    sections.push(`## ${display}`);

    if (entries.length === 0) {
      sections.push("_No solutions yet._");
    } else {
      for (const entry of entries) {
        sections.push(`- [${entry.title}](${entry.category}/${entry.filename})`);
      }
    }
  }

  sections.push("");

  const indexPath = path.join(SOLUTIONS_ROOT, "INDEX.md");
  try {
    fs.writeFileSync(indexPath, sections.join("\n"), "utf-8");
    log("INDEX", `Wrote ${indexPath}`);
  } catch (e) {
    logError("INDEX", `Failed to write INDEX.md: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  log("INIT", "populate-solutions: starting");

  // 1. Read learnings file
  if (!fs.existsSync(BB_LEARNINGS)) {
    logError("INIT", `Learnings file not found: ${BB_LEARNINGS}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(BB_LEARNINGS, "utf-8");
  log("PARSE", `Read learnings file: ${raw.length} bytes`);

  // 2. Parse markdown structure
  const learnings = parseLearnings(raw);
  log("PARSE", `Parsed ${learnings.length} learnings from markdown`);

  // 3. Ensure solution directories exist
  ensureDir(SOLUTIONS_FIGMA);
  ensureDir(SOLUTIONS_RN);
  ensureDir(SOLUTIONS_COMPONENT);
  ensureDir(SOLUTIONS_FIX);

  // 4. Write learning solution files
  const learningEntries = writeLearningFiles(learnings);
  log("WRITE", `Wrote ${learningEntries.length} learning solution files`);

  // 5. Scan audit reports for recurring failures
  const recurringFailures = scanAuditFailures();
  log(
    "AUDITS",
    `Found ${recurringFailures.length} recurring failure reason(s) across audit reports`
  );

  // 6. Write fix-recipe files from audit failures
  const fixEntries = writeFixRecipeFiles(recurringFailures);
  log("WRITE", `Wrote ${fixEntries.length} fix-recipe files from audit failures`);

  // 7. Write INDEX.md
  writeIndex(learningEntries, fixEntries);

  // 8. Summary
  const categoryCounts: Record<string, number> = {};
  for (const entry of [...learningEntries, ...fixEntries]) {
    categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
  }

  log("DONE", "--- Summary ---");
  log(
    "DONE",
    `Total solutions written: ${learningEntries.length + fixEntries.length}`
  );
  for (const [cat, count] of Object.entries(categoryCounts).sort()) {
    log("DONE", `  ${cat}: ${count}`);
  }
  log("DONE", "populate-solutions: complete");
}

main();
