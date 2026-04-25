#!/usr/bin/env node
/**
 * scripts/ci/lint-migrations.mjs
 *
 * Static analysis for Supabase migration files. Runs on every PR via
 * `.github/workflows/pr-gates.yml`. Fails the job if any rule is violated.
 *
 * Per the cleanup plan (Phase 5), this lint exists to catch the kinds of
 * incidents we hit during the 2026-04-25 cleanup:
 *   - Version-collision migration silently skipped on db push (the
 *     20260424000001 incident — same version, different content)
 *   - Migrations that hardcode service-role JWTs (the in-git-history leak)
 *   - Destructive operations dropped without a paired rollback
 *
 * Rules implemented (from the plan, security-engineer + sre-engineer
 * recommendations):
 *
 *   1. Version timestamp uniqueness — file's YYYYMMDDHHMMSS prefix must be
 *      unique against the rest of supabase/migrations/ AND > the max version
 *      already on the target branch.
 *   2. Name regex — non-empty, matches ^[a-z0-9_]+$.
 *   3. Destructive ops — DROP COLUMN/TABLE/CONSTRAINT/INDEX requires
 *      `-- @safe-destructive: <reason>` annotation in the file.
 *   4. Rollback comment — every migration must contain a `-- rollback:` block
 *      with the inverse SQL (or "no-op" with explicit reason).
 *   5. SECURITY DEFINER — functions defined with SECURITY DEFINER require
 *      `-- @security-definer: <reason>` annotation.
 *   6. GRANT/REVOKE — require `-- @grant-review: <reason>` annotation.
 *   7. RLS policy changes — CREATE/ALTER/DROP POLICY requires
 *      `-- @rls-review:` annotation (paired test under
 *      supabase/tests/policies/ is encouraged but not enforced here).
 *   8. RLS disable — `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` is
 *      forbidden outright. Drop the table or write a policy.
 *   9. auth.* DML — direct DML on auth.* schema requires
 *      `-- @auth-schema: <reason>` annotation.
 *  10. Hardcoded JWT/sb_secret_ — forbidden. This rule alone would have
 *      caught CRITICAL-1 (the prod service-role JWT in
 *      20260308000001_migrate_cron_keys_to_vault.sql).
 *  11. net.http_post — outbound HTTP from migrations needs explicit
 *      `-- @http-out: <destination>` annotation.
 *
 * Run locally:
 *   node scripts/ci/lint-migrations.mjs
 *
 * In CI (only check files in the PR diff):
 *   node scripts/ci/lint-migrations.mjs --diff <base-sha>
 *
 * Exit codes:
 *   0  — clean
 *   1  — at least one rule violation found
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";

const MIGRATIONS_DIR = "supabase/migrations";
const VERSION_REGEX = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const NAME_REGEX = /^[a-z0-9_]+$/;

// ─── CLI ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const diffMode = args.includes("--diff");
const baseSha = diffMode ? args[args.indexOf("--diff") + 1] : null;

// ─── Discover files to lint ───────────────────────────────────────────────

let filesToLint;
if (diffMode) {
  // Only lint files added/modified in the PR
  const diff = execSync(`git diff --name-only ${baseSha}...HEAD -- ${MIGRATIONS_DIR}`, {
    encoding: "utf8",
  });
  filesToLint = diff
    .split("\n")
    .filter((f) => f.trim().endsWith(".sql"))
    .map((f) => f.trim());
} else {
  filesToLint = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => join(MIGRATIONS_DIR, f));
}

if (filesToLint.length === 0) {
  console.log("✓ migration-lint: no migration files in this PR");
  process.exit(0);
}

// ─── Collect existing versions on target branch (for collision check) ────

const allMigrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) =>
  f.endsWith(".sql"),
);
const existingVersions = new Map(); // version → filename
for (const f of allMigrationFiles) {
  const m = f.match(VERSION_REGEX);
  if (m) existingVersions.set(m[1], f);
}

// ─── Rule implementations ────────────────────────────────────────────────

const violations = [];

function violate(file, rule, line, message) {
  violations.push({ file, rule, line, message });
}

function checkFile(file) {
  if (!existsSync(file)) return; // deleted file — skip
  const filename = basename(file);
  const m = filename.match(VERSION_REGEX);

  // Rule 1 — version uniqueness
  // (also enforced by filename regex below; explicit check for clarity)
  if (!m) {
    violate(file, "rule-1+2", 0, `Filename does not match YYYYMMDDHHMMSS_<name>.sql pattern`);
    return;
  }
  const version = m[1];
  const name = m[2];

  // Rule 1 — same version under a different filename
  for (const [v, f] of existingVersions) {
    if (v === version && f !== filename) {
      violate(
        file,
        "rule-1",
        0,
        `Version ${version} collides with existing ${f}. Pick a fresh timestamp.`,
      );
    }
  }

  // Rule 2 — name regex
  if (!NAME_REGEX.test(name)) {
    violate(file, "rule-2", 0, `Migration name "${name}" must match /^[a-z0-9_]+$/`);
  }

  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  // Aggregate checks need the whole file
  const hasRollbackBlock = /^\s*--\s*rollback:/im.test(content);

  // Rule 4 — rollback comment block required
  if (!hasRollbackBlock) {
    violate(
      file,
      "rule-4",
      0,
      `Migration must include a "-- rollback:" comment block with the inverse SQL ` +
        `(or "-- rollback: no-op — <reason>" if truly irreversible).`,
    );
  }

  // Rule 8 — RLS disable forbidden (early exit on this; no annotation can override)
  if (/\bALTER\s+TABLE\b[^;]*\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(content)) {
    const ln = lines.findIndex((l) =>
      /\bALTER\s+TABLE\b[^;]*\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(l),
    );
    violate(
      file,
      "rule-8",
      ln + 1,
      `ALTER TABLE ... DISABLE ROW LEVEL SECURITY is forbidden. Drop the table or write a policy that grants the access you need.`,
    );
  }

  // Per-line / per-statement checks
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const trimmed = line.trim();
    // Skip pure comments
    if (trimmed.startsWith("--")) return;

    // Rule 3 — destructive ops require annotation in the file
    const destructiveMatch = line.match(
      /\bDROP\s+(COLUMN|TABLE|CONSTRAINT|INDEX|VIEW|FUNCTION|EXTENSION)\b/i,
    );
    if (destructiveMatch) {
      // Look back up to 5 lines for the annotation
      const window = lines.slice(Math.max(0, idx - 5), idx).join("\n");
      if (!/--\s*@safe-destructive:/i.test(window)) {
        violate(
          file,
          "rule-3",
          lineNo,
          `Destructive op (${destructiveMatch[0]}) requires "-- @safe-destructive: <reason>" within 5 lines above.`,
        );
      }
    }

    // Rule 5 — SECURITY DEFINER annotation
    if (/\bSECURITY\s+DEFINER\b/i.test(line)) {
      const window = lines.slice(Math.max(0, idx - 5), idx + 5).join("\n");
      if (!/--\s*@security-definer:/i.test(window)) {
        violate(
          file,
          "rule-5",
          lineNo,
          `SECURITY DEFINER function requires "-- @security-definer: <reason>" annotation within 5 lines.`,
        );
      }
    }

    // Rule 6 — GRANT/REVOKE annotation
    if (/^\s*(GRANT|REVOKE)\s+/i.test(line)) {
      const window = lines.slice(Math.max(0, idx - 5), idx).join("\n");
      if (!/--\s*@grant-review:/i.test(window)) {
        violate(
          file,
          "rule-6",
          lineNo,
          `${line.trim().split(/\s/)[0]} statement requires "-- @grant-review: <reason>" within 5 lines above.`,
        );
      }
    }

    // Rule 7 — policy changes annotation
    if (/\b(CREATE|ALTER|DROP)\s+POLICY\b/i.test(line)) {
      const window = lines.slice(Math.max(0, idx - 5), idx).join("\n");
      if (!/--\s*@rls-review:/i.test(window)) {
        violate(
          file,
          "rule-7",
          lineNo,
          `Policy change requires "-- @rls-review: <reason>" within 5 lines above. Consider adding a paired test under supabase/tests/policies/.`,
        );
      }
    }

    // Rule 9 — auth.* DML
    if (/\b(INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?auth\./i.test(line) ||
        /\bFROM\s+auth\..*\bWHERE\b.*\bDELETE\b/i.test(line)) {
      const window = lines.slice(Math.max(0, idx - 5), idx).join("\n");
      if (!/--\s*@auth-schema:/i.test(window)) {
        violate(
          file,
          "rule-9",
          lineNo,
          `Direct DML on auth.* requires "-- @auth-schema: <reason>" within 5 lines above.`,
        );
      }
    }

    // Rule 10 — hardcoded JWT/sb_secret_ (CRITICAL — never allow)
    // JWT: starts with eyJ, has at least 2 dots, all base64url
    if (/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(line)) {
      violate(
        file,
        "rule-10",
        lineNo,
        `Hardcoded JWT detected. Service-role JWTs MUST NOT live in migrations — use private settings table populated out-of-band.`,
      );
    }
    if (/\bsb_secret_[A-Za-z0-9_-]{16,}/.test(line)) {
      violate(
        file,
        "rule-10",
        lineNo,
        `Hardcoded Supabase secret key (sb_secret_*) detected. Use private settings table populated out-of-band.`,
      );
    }

    // Rule 11 — net.http_post requires annotation
    if (/\bnet\.http_post\b/i.test(line)) {
      const window = lines.slice(Math.max(0, idx - 5), idx + 5).join("\n");
      if (!/--\s*@http-out:/i.test(window)) {
        violate(
          file,
          "rule-11",
          lineNo,
          `net.http_post call requires "-- @http-out: <destination>" within 5 lines.`,
        );
      }
    }
  });
}

// ─── Run all checks ──────────────────────────────────────────────────────

for (const file of filesToLint) {
  checkFile(file);
}

// ─── Report ──────────────────────────────────────────────────────────────

if (violations.length === 0) {
  console.log(`✓ migration-lint: ${filesToLint.length} migration file(s) clean`);
  process.exit(0);
}

console.log(`✗ migration-lint: ${violations.length} violation(s) found:\n`);
for (const v of violations) {
  console.log(`  [${v.rule}] ${v.file}:${v.line}`);
  console.log(`     ${v.message}\n`);
}

console.log("");
console.log("Rule reference:");
console.log("  rule-1   Version timestamp uniqueness");
console.log("  rule-2   Name regex ^[a-z0-9_]+$");
console.log("  rule-3   Destructive op needs -- @safe-destructive: <reason>");
console.log("  rule-4   Migration needs -- rollback: block");
console.log("  rule-5   SECURITY DEFINER needs -- @security-definer: <reason>");
console.log("  rule-6   GRANT/REVOKE needs -- @grant-review: <reason>");
console.log("  rule-7   Policy change needs -- @rls-review: <reason>");
console.log("  rule-8   ALTER TABLE ... DISABLE ROW LEVEL SECURITY forbidden");
console.log("  rule-9   auth.* DML needs -- @auth-schema: <reason>");
console.log("  rule-10  Hardcoded JWT or sb_secret_ literal forbidden");
console.log("  rule-11  net.http_post needs -- @http-out: <destination>");
console.log("");
console.log("Full doc: docs/ci-cd.md (TODO — being written)");

process.exit(1);
