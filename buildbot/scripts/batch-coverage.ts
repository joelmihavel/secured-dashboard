/**
 * Batch Coverage Checker
 * Runs coverage check on all screens with Figma extraction and RN code
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ScreenResult {
  figmaId: string;
  screenName: string;
  route: string;
  hasRNCode: boolean;
  coverage: number | null;
  status: 'pass' | 'fail' | 'no-rn-code' | 'no-extraction' | 'error';
  error?: string;
}

// Load screen routes config
const routesPath = path.join(__dirname, '../config/screen-routes.json');
const routesConfig = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));

// Get all Figma extractions available
const extractionsDir = path.join(__dirname, '../data/extractions');
const availableExtractions = fs.existsSync(extractionsDir)
  ? fs.readdirSync(extractionsDir).filter(d =>
      fs.statSync(path.join(extractionsDir, d)).isDirectory()
    )
  : [];

// Build list of all screens from routes config
const allScreens: { figmaId: string; name: string; route: string }[] = [];
for (const [, routeConfig] of Object.entries(routesConfig.routes) as [string, any][]) {
  for (const screen of routeConfig.screens || []) {
    allScreens.push({
      figmaId: screen.figmaId,
      name: screen.name,
      route: routeConfig.route,
    });
  }
}

// Check if RN file exists for a route
function checkRNFileExists(route: string): boolean {
  const rnAppPath = path.join(__dirname, '../../rn-app');
  const possiblePaths = [
    path.join(rnAppPath, 'app', route + '.tsx'),
    path.join(rnAppPath, 'app', route, 'index.tsx'),
  ];
  return possiblePaths.some(p => fs.existsSync(p));
}

// Run coverage check for a screen
function runCoverageCheck(figmaId: string): { coverage: number; status: string } | null {
  try {
    const result = execSync(
      `npx tsx scripts/check-coverage.ts ${figmaId}`,
      {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf-8',
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );

    // Parse coverage from output
    const coverageMatch = result.match(/Overall Coverage:\s*([\d.]+)%/);
    if (coverageMatch) {
      const coverage = parseFloat(coverageMatch[1]);
      return { coverage, status: coverage >= 95 ? 'pass' : 'fail' };
    }
    return null;
  } catch (error: any) {
    // Check if it's just a coverage failure vs actual error
    if (error.stdout) {
      const coverageMatch = error.stdout.match(/Overall Coverage:\s*([\d.]+)%/);
      if (coverageMatch) {
        const coverage = parseFloat(coverageMatch[1]);
        return { coverage, status: coverage >= 95 ? 'pass' : 'fail' };
      }
    }
    return null;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('  BATCH COVERAGE CHECKER');
  console.log('='.repeat(70));

  console.log(`\nFound ${availableExtractions.length} Figma extractions`);
  console.log(`Found ${allScreens.length} screens in routes config\n`);

  const results: ScreenResult[] = [];

  // Process each available extraction
  for (const extractionId of availableExtractions) {
    // Find matching screen in routes
    const screen = allScreens.find(s => s.figmaId === extractionId);

    if (!screen) {
      console.log(`⚠️  ${extractionId}: No route mapping found`);
      results.push({
        figmaId: extractionId,
        screenName: 'Unknown',
        route: 'Unknown',
        hasRNCode: false,
        coverage: null,
        status: 'error',
        error: 'No route mapping in screen-routes.json'
      });
      continue;
    }

    // Check if RN code exists
    const hasRNCode = checkRNFileExists(screen.route);

    if (!hasRNCode) {
      console.log(`❌ ${extractionId}: No RN code found for route ${screen.route}`);
      results.push({
        figmaId: extractionId,
        screenName: screen.name,
        route: screen.route,
        hasRNCode: false,
        coverage: null,
        status: 'no-rn-code',
      });
      continue;
    }

    // Run coverage check
    console.log(`🔍 ${extractionId}: Checking coverage...`);
    const coverageResult = runCoverageCheck(extractionId);

    if (coverageResult) {
      const icon = coverageResult.status === 'pass' ? '✅' : '⚠️';
      console.log(`${icon} ${extractionId}: ${coverageResult.coverage}% (${coverageResult.status})`);
      results.push({
        figmaId: extractionId,
        screenName: screen.name,
        route: screen.route,
        hasRNCode: true,
        coverage: coverageResult.coverage,
        status: coverageResult.status as 'pass' | 'fail',
      });
    } else {
      console.log(`❌ ${extractionId}: Coverage check failed`);
      results.push({
        figmaId: extractionId,
        screenName: screen.name,
        route: screen.route,
        hasRNCode: true,
        coverage: null,
        status: 'error',
        error: 'Coverage check failed',
      });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('  SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.status === 'pass');
  const failed = results.filter(r => r.status === 'fail');
  const noRNCode = results.filter(r => r.status === 'no-rn-code');
  const errors = results.filter(r => r.status === 'error');

  console.log(`\n✅ Passed (>=95%):     ${passed.length}`);
  console.log(`⚠️  Failed (<95%):      ${failed.length}`);
  console.log(`❌ No RN Code:         ${noRNCode.length}`);
  console.log(`🔴 Errors:             ${errors.length}`);
  console.log(`📊 Total:              ${results.length}`);

  // Detailed breakdown
  if (passed.length > 0) {
    console.log('\n--- Passed Screens ---');
    for (const r of passed) {
      console.log(`  ${r.figmaId}: ${r.coverage}% - ${r.screenName}`);
    }
  }

  if (failed.length > 0) {
    console.log('\n--- Failed Screens (need fixes) ---');
    for (const r of failed) {
      console.log(`  ${r.figmaId}: ${r.coverage}% - ${r.screenName}`);
    }
  }

  if (noRNCode.length > 0) {
    console.log('\n--- No RN Code (need implementation) ---');
    for (const r of noRNCode) {
      console.log(`  ${r.figmaId}: ${r.route} - ${r.screenName}`);
    }
  }

  // Save results
  const resultsPath = path.join(__dirname, '../reports/batch-coverage-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary: {
      passed: passed.length,
      failed: failed.length,
      noRNCode: noRNCode.length,
      errors: errors.length,
      total: results.length,
    },
    results,
  }, null, 2));
  console.log(`\n📁 Results saved to: ${resultsPath}`);

  console.log('\n' + '='.repeat(70));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
