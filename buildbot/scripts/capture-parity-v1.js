#!/usr/bin/env node
/**
 * Screenshot Parity v1 — Capture every screen via Maestro + Simulator
 *
 * Uses Maestro openLink (bypasses Expo dev client deep link dialog)
 * and takeScreenshot for reliable capture.
 *
 * Strategy:
 *   1. Generate a Maestro YAML flow with all screen navigations
 *   2. Each screen: openLink to reset → openLink to target → wait → screenshot
 *   3. Deduplicate screens sharing the same deep link
 *   4. Move screenshots to output folder
 *   5. Generate markdown mapping
 *
 * Output: screenshot-parity-v1/<routeKey>--<state>.png
 * Mapping: screenshot-parity-v1/PARITY-MAPPING.md
 *
 * Usage:
 *   node buildbot/scripts/capture-parity-v1.js
 *   node buildbot/scripts/capture-parity-v1.js --dry-run
 *   node buildbot/scripts/capture-parity-v1.js --route waitlist
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ==============================================
// CONFIG
// ==============================================

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const ROUTES_FILE = path.join(PROJECT_ROOT, 'buildbot', 'config', 'screen-routes.json');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'screenshot-parity-v1');
const MAESTRO_DIR = path.join(PROJECT_ROOT, 'maestro');
const FLOW_FILE = path.join(MAESTRO_DIR, 'flows', '_capture-parity-v1.yaml');
const SCHEME = 'flentsecured';
const RESET_ROUTE = `${SCHEME}:///(dev)/screen-picker`;

// ==============================================
// PARSE ARGS
// ==============================================

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filterRoute = args.find((_, i) => args[i - 1] === '--route') || null;

// ==============================================
// DEEP LINK OVERRIDES
// ==============================================
// Routes ending in /index or using route-group syntax like /(main)/index
// fail as deep links because Expo Router can't resolve scheme URLs to
// index routes. Map them to human-friendly paths from DEEP_LINK_ROUTES.

const DEEP_LINK_OVERRIDES = {
  // Route groups that need human-friendly paths
  '/(main)/index': '/home',
  '/(main)': '/home',
  '/(setup)/index': '/setup/onboarding',
  '/(profile)/index': '/profile',
  '/(profile)': '/profile',
  '/(profile)/edit': '/profile/edit',
  '/(profile)/payment-methods': '/profile/payment-methods',
  '/(profile)/agreement': '/profile/agreement',
  '/(transactions)/index': '/transactions',
  '/(transactions)': '/transactions',
  // Agreement routes use different actual file names
  '/(agreement)/upload': '/agreement/upload',
  '/(agreement)/review': '/agreement/review',
};

// ==============================================
// HELPERS
// ==============================================

function buildDeepLink(screen, routeData) {
  const rawRoute = screen.routeWithState || routeData.route;

  // Split off query params
  const [routePath, queryString] = rawRoute.split('?');

  // Check for override
  const override = DEEP_LINK_OVERRIDES[routePath];
  if (override) {
    const overridePath = queryString ? `${override}?${queryString}` : override;
    return `${SCHEME}://${overridePath}`;
  }

  return `${SCHEME}://${rawRoute}`;
}

function checkPrereqs() {
  // Check Maestro
  try {
    const ver = execSync('maestro --version', { encoding: 'utf8' }).trim();
    console.log(`Maestro: ${ver}`);
  } catch {
    console.error('ERROR: Maestro not installed.');
    process.exit(1);
  }

  // Check simulator
  try {
    const devices = execSync('xcrun simctl list devices booted', { encoding: 'utf8' });
    if (!devices.includes('Booted')) {
      console.error('ERROR: No iOS simulator booted.');
      process.exit(1);
    }
    const match = devices.match(/^\s+(.+?)\s+\([\w-]+\)\s+\(Booted\)/m);
    if (match) console.log(`Simulator: ${match[1].trim()}`);
  } catch {
    console.error('ERROR: xcrun simctl not available.');
    process.exit(1);
  }
}

// ==============================================
// BUILD SCREEN LIST
// ==============================================

function buildScreenList() {
  const routesConfig = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8'));
  const routes = routesConfig.routes;

  const screens = [];
  for (const [routeKey, routeData] of Object.entries(routes)) {
    if (filterRoute && routeKey !== filterRoute) continue;
    for (const screen of routeData.screens) {
      const deepLink = buildDeepLink(screen, routeData);
      const fileName = `${routeKey}--${screen.state}`;
      screens.push({
        routeKey,
        state: screen.state,
        figmaId: screen.figmaId,
        figmaName: screen.name,
        deepLink,
        fileName,
        route: routeData.route,
      });
    }
  }

  // Deduplicate by deep link
  const uniqueLinks = new Map();
  const deduped = [];
  const copies = [];

  for (const screen of screens) {
    if (uniqueLinks.has(screen.deepLink)) {
      copies.push({ ...screen, sourceFileName: uniqueLinks.get(screen.deepLink) });
    } else {
      uniqueLinks.set(screen.deepLink, screen.fileName);
      deduped.push(screen);
    }
  }

  return { screens, deduped, copies, routesConfig };
}

// ==============================================
// GENERATE MAESTRO FLOW
// ==============================================

function generateMaestroFlow(deduped) {
  const lines = [];
  lines.push('# Auto-generated by capture-parity-v1.js — DO NOT EDIT');
  lines.push('appId: com.flent.secured');
  lines.push('---');
  lines.push('');
  lines.push('# Launch app to ensure it is in foreground');
  lines.push('- launchApp:');
  lines.push('    clearState: false');
  lines.push('');
  lines.push('- waitForAnimationToEnd');
  lines.push('');
  lines.push('# Dismiss Expo dev client welcome/menu if visible');
  lines.push('- tapOn:');
  lines.push('    text: "Continue"');
  lines.push('    optional: true');
  lines.push('- tapOn:');
  lines.push('    point: "50%,5%"');
  lines.push('- waitForAnimationToEnd');
  lines.push('');

  for (let i = 0; i < deduped.length; i++) {
    const s = deduped[i];
    lines.push(`# --- [${i + 1}/${deduped.length}] ${s.routeKey} / ${s.state} ---`);
    lines.push(`# Figma: ${s.figmaId} — "${s.figmaName}"`);

    if (i === 0) {
      // First screen: skip reset (app just launched), navigate directly
      lines.push(`- openLink: "${s.deepLink}"`);
      lines.push('- waitForAnimationToEnd');
      lines.push('- waitForAnimationToEnd');
    } else {
      // Reset to screen picker between captures
      lines.push(`- openLink: "${RESET_ROUTE}"`);
      lines.push('- waitForAnimationToEnd');

      // Navigate to target
      lines.push(`- openLink: "${s.deepLink}"`);
      lines.push('- waitForAnimationToEnd');
    }

    // Extra wait for screens that need more time to render (API data, animations, etc.)
    const heavyScreens = ['home-empty', 'home-active', 'transactions', 'agreement-review', 'profile', 'setup'];
    if (heavyScreens.some(h => s.routeKey.startsWith(h))) {
      lines.push('- waitForAnimationToEnd');
      lines.push('- waitForAnimationToEnd');
    }

    // Take screenshot
    lines.push(`- takeScreenshot: "${s.fileName}"`);
    lines.push('');
  }

  return lines.join('\n');
}

// ==============================================
// GENERATE MARKDOWN MAPPING
// ==============================================

function generateMapping(allScreens, capturedFiles, routesConfig) {
  const lines = [];
  lines.push('# Screenshot Parity v1 — Figma-to-Screenshot Mapping');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push(`Total Figma screens: ${allScreens.length}`);
  lines.push(`Unique captures: ${capturedFiles.size}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Group by route key
  const routes = routesConfig.routes;
  for (const [routeKey, routeData] of Object.entries(routes)) {
    const routeScreens = allScreens.filter(s => s.routeKey === routeKey);
    if (routeScreens.length === 0) continue;

    lines.push(`## ${routeKey}`);
    lines.push(`Route: \`${routeData.route}\``);
    lines.push('');
    lines.push('| Figma Screen Name | Figma ID | Screenshot | Status |');
    lines.push('|---|---|---|---|');

    for (const s of routeScreens) {
      const pngFile = `${s.fileName}.png`;
      const exists = capturedFiles.has(s.fileName);
      const isCopy = s.sourceFileName !== undefined;
      let status = exists ? 'PASS' : 'MISSING';
      if (isCopy && exists) status = `COPY [= \`${s.sourceFileName}.png\`]`;
      lines.push(`| ${s.figmaName} | \`${s.figmaId}\` | \`${pngFile}\` | ${status} |`);
    }
    lines.push('');
  }

  // Notes
  lines.push('---');
  lines.push('');
  lines.push('## State Handling Notes');
  lines.push('');
  lines.push('| Route Group | State Mechanism | Per-State Capture? |');
  lines.push('|---|---|---|');
  lines.push('| waitlist | `setDevMockState()` via path-based deep links | Yes |');
  lines.push('| auth (sign-up, OTP, carousel) | `useLocalSearchParams()` — params stripped | No — default only |');
  lines.push('| agreement | `useLocalSearchParams()` — params stripped | No — default only |');
  lines.push('| setup | `useLocalSearchParams()` — params stripped | No — default step |');
  lines.push('| home | API mock data via `useDashboard()` | No — mock state only |');
  lines.push('| payment | API mock data + UI interaction | No — default only |');
  lines.push('| transactions | API mock data | No — mock state only |');
  lines.push('| profile | Multiple sub-routes | Yes — per-route |');
  lines.push('');
  lines.push('### Duplicate Screens');
  lines.push('Screens marked COPY share the same deep link. They display identical content.');
  lines.push('To capture different states, screens need `consumeDeepLinkParams()` + `useDevMockState()` integration (only waitlist has this).');
  lines.push('');

  return lines.join('\n');
}

// ==============================================
// COLLECT SCREENSHOTS
// ==============================================

function findScreenshots(deduped) {
  const capturedFiles = new Map();

  for (const s of deduped) {
    const possibleLocations = [
      // Maestro default: working directory
      path.join(PROJECT_ROOT, `${s.fileName}.png`),
      // Maestro might put them in output dir already
      path.join(OUTPUT_DIR, `${s.fileName}.png`),
    ];

    let found = false;
    for (const srcPath of possibleLocations) {
      if (fs.existsSync(srcPath)) {
        const destPath = path.join(OUTPUT_DIR, `${s.fileName}.png`);
        if (srcPath !== destPath) {
          fs.renameSync(srcPath, destPath);
        }
        const sizeKB = Math.round(fs.statSync(destPath).size / 1024);
        console.log(`  [OK] ${s.fileName}.png (${sizeKB}KB)`);
        capturedFiles.set(s.fileName, destPath);
        found = true;
        break;
      }
    }

    if (!found) {
      // Search in Maestro output directories
      const searchDirs = [
        path.join(process.env.HOME, '.maestro'),
        path.join(PROJECT_ROOT, '.maestro'),
      ];

      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
          const result = execSync(
            `find "${dir}" -name "${s.fileName}.png" -type f 2>/dev/null | head -1`,
            { encoding: 'utf8' }
          ).trim();
          if (result) {
            const destPath = path.join(OUTPUT_DIR, `${s.fileName}.png`);
            fs.copyFileSync(result, destPath);
            const sizeKB = Math.round(fs.statSync(destPath).size / 1024);
            console.log(`  [OK] ${s.fileName}.png (${sizeKB}KB) [maestro output]`);
            capturedFiles.set(s.fileName, destPath);
            found = true;
            break;
          }
        } catch {}
      }
    }

    if (!found) {
      console.log(`  [MISS] ${s.fileName}.png`);
    }
  }

  return capturedFiles;
}

// ==============================================
// MAIN
// ==============================================

function main() {
  console.log('='.repeat(60));
  console.log('  Screenshot Parity v1 — Maestro-Powered Capture');
  console.log('='.repeat(60));
  console.log('');

  checkPrereqs();

  const { screens, deduped, copies, routesConfig } = buildScreenList();
  const allScreens = [...deduped, ...copies];

  console.log(`\nTotal: ${allScreens.length} Figma screens`);
  console.log(`Unique captures: ${deduped.length}`);
  console.log(`Duplicates (copy): ${copies.length}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // Ensure output dir
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  if (dryRun) {
    console.log('DRY RUN — planned captures:\n');
    deduped.forEach((s, i) => {
      console.log(`  [${i + 1}/${deduped.length}] ${s.fileName}.png  ←  ${s.deepLink}`);
    });
    if (copies.length > 0) {
      console.log(`\nDuplicates (will copy):`);
      copies.forEach(s => {
        console.log(`  ${s.fileName}.png  ←  COPY of ${s.sourceFileName}.png`);
      });
    }
    console.log(`\n${deduped.length} unique + ${copies.length} copies = ${allScreens.length} total`);

    // Still generate mapping for review
    const dummyMap = new Map();
    deduped.forEach(s => dummyMap.set(s.fileName, 'dry'));
    copies.forEach(s => dummyMap.set(s.fileName, 'dry'));
    const mapping = generateMapping(allScreens, dummyMap, routesConfig);
    const mappingPath = path.join(OUTPUT_DIR, 'PARITY-MAPPING.md');
    fs.writeFileSync(mappingPath, mapping, 'utf8');
    console.log(`\nMapping preview: ${mappingPath}`);
    return;
  }

  // Generate Maestro flow
  console.log('Generating Maestro flow...');
  const flowYaml = generateMaestroFlow(deduped);
  fs.writeFileSync(FLOW_FILE, flowYaml, 'utf8');
  console.log(`  Written: ${FLOW_FILE}\n`);

  // Run Maestro
  console.log(`Running Maestro (${deduped.length} screens)...\n`);
  try {
    execSync(
      `cd "${PROJECT_ROOT}" && maestro test "${FLOW_FILE}"`,
      { stdio: 'inherit', timeout: deduped.length * 25000 }
    );
    console.log('\nMaestro completed.\n');
  } catch (e) {
    console.error('\nMaestro had failures. Collecting available screenshots...\n');
  }

  // Collect screenshots
  console.log('Collecting screenshots...');
  const capturedFiles = findScreenshots(deduped);

  // Copy duplicates
  if (copies.length > 0) {
    console.log(`\nCopying ${copies.length} duplicates...`);
    for (const s of copies) {
      const sourcePath = path.join(OUTPUT_DIR, `${s.sourceFileName}.png`);
      const destPath = path.join(OUTPUT_DIR, `${s.fileName}.png`);
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        capturedFiles.set(s.fileName, destPath);
        console.log(`  [COPY] ${s.fileName}.png`);
      } else {
        console.log(`  [SKIP] ${s.fileName}.png — source not captured`);
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Captured: ${capturedFiles.size}/${allScreens.length}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log(`${'='.repeat(60)}\n`);

  // Generate mapping
  const mapping = generateMapping(allScreens, capturedFiles, routesConfig);
  const mappingPath = path.join(OUTPUT_DIR, 'PARITY-MAPPING.md');
  fs.writeFileSync(mappingPath, mapping, 'utf8');
  console.log(`Mapping: ${mappingPath}`);

  // Clean up temp flow
  try { fs.unlinkSync(FLOW_FILE); } catch {}

  process.exit(capturedFiles.size < deduped.length ? 1 : 0);
}

main();
