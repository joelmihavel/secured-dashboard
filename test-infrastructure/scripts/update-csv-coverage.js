#!/usr/bin/env node
/**
 * Update master-test-plan.csv with automated coverage status
 * Reads coverage-matrix.json + new Maestro flows to update Type, Status, Notes columns
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CSV_PATH = path.join(ROOT, 'test-infrastructure/test-cases/master-test-plan.csv');
const MATRIX_PATH = path.join(ROOT, 'test-infrastructure/coverage-matrix.json');

// New Maestro flows created in this session (not yet in coverage-matrix.json)
const NEW_MAESTRO_FLOWS = {
  'HJ-008': ['flows/setup/add-utility.yaml'],
  'HJ-013': ['journeys/skip-setup.yaml'],
  'HJ-014': ['flows/setup/add-utility-skip.yaml', 'journeys/skip-setup.yaml'],
  'HJ-015': ['journeys/skip-setup.yaml'],
  'HJ-017': ['journeys/payment-card.yaml'],
  'HJ-019': ['journeys/payment-netbanking.yaml'],
  'HJ-025': ['journeys/sign-out-relogin.yaml'],
  'UI-032': ['flows/main/dashboard-states.yaml'],
  'UI-033': ['flows/main/dashboard-states.yaml'],
  'UI-037': ['flows/payment/enter-rent.yaml'],
  'UI-038': ['flows/payment/method-selector.yaml'],
  'UI-039': ['flows/payment/add-upi.yaml'],
  'UI-040': ['flows/payment/add-card.yaml'],
  'UI-041': ['flows/payment/add-netbanking.yaml'],
  'UI-047': ['flows/profile/edit.yaml'],
  'UI-048': ['flows/profile/payment-methods.yaml'],
  'UI-052': ['flows/profile/agreement.yaml'],
  'EC-002': ['flows/edge-cases/otp-error-states.yaml'],
  'EC-003': ['flows/edge-cases/otp-error-states.yaml'],
  'EC-005': ['journeys/crash-recovery-payment.yaml'],
  'EC-010': ['journeys/network-offline.yaml'],
  'EC-016': ['flows/edge-cases/deep-link-invalid.yaml'],
  'EC-017': ['flows/edge-cases/payment-back-button.yaml'],
  'EC-018': ['flows/edge-cases/rapid-pay-tap.yaml'],
  'EC-027': ['flows/edge-cases/payment-zero-amount.yaml'],
};

// Parse CSV properly handling quoted fields with commas and newlines
function parseCSV(content) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if (ch === '\n' && !inQuotes) {
      row.push(current);
      current = '';
      if (row.length > 1 || row[0] !== '') {
        rows.push(row);
      }
      row = [];
    } else if (ch === '\r' && !inQuotes) {
      // skip CR
    } else {
      current += ch;
    }
  }

  // Last field/row
  if (current || row.length > 0) {
    row.push(current);
    if (row.length > 1 || row[0] !== '') {
      rows.push(row);
    }
  }

  return rows;
}

// Escape a field for CSV output
function escapeCSV(field) {
  if (!field) return '';
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

function main() {
  // Read coverage matrix
  const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));

  // Build lookup: testId -> coverage info
  const coverageMap = {};
  for (const tc of matrix.test_cases) {
    coverageMap[tc.id] = tc.coverage;
  }

  // Collect all gap IDs from matrix
  const gapIds = new Set();
  for (const cat of Object.values(matrix.summary.by_category)) {
    for (const id of cat.gap_ids) {
      gapIds.add(id);
    }
  }

  // Read CSV
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csvContent);

  if (rows.length === 0) {
    console.error('No rows parsed from CSV');
    process.exit(1);
  }

  const header = rows[0];
  console.log(`Header columns: ${header.length}`);
  console.log(`Data rows: ${rows.length - 1}`);

  // Find column indices
  const typeIdx = header.indexOf('Type');
  const statusIdx = header.indexOf('Status');
  const notesIdx = header.indexOf('Notes');
  const testIdIdx = header.indexOf('Test ID');

  console.log(`Type col: ${typeIdx}, Status col: ${statusIdx}, Notes col: ${notesIdx}, TestID col: ${testIdIdx}`);

  let updated = 0;
  let coveredCount = 0;
  let partialCount = 0;
  let gapCount = 0;
  let newE2ECount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Ensure row has enough columns
    while (row.length <= Math.max(typeIdx, statusIdx, notesIdx)) {
      row.push('');
    }

    const testId = row[testIdIdx];
    if (!testId) continue;

    const coverage = coverageMap[testId];
    const isGap = gapIds.has(testId);
    const hasNewMaestro = NEW_MAESTRO_FLOWS[testId];

    // Build notes from coverage data
    let notesParts = [];
    let layers = [];

    if (coverage) {
      if (coverage.backend && coverage.backend.length > 0) {
        layers.push('Backend');
        const files = coverage.backend.map(f => f.split(':')[0]).filter((v, i, a) => a.indexOf(v) === i);
        notesParts.push(`Backend: ${files.join(', ')}`);
      }
      if (coverage.frontend && coverage.frontend.length > 0) {
        layers.push('Frontend');
        const files = coverage.frontend.map(f => f.split(':')[0]).filter((v, i, a) => a.indexOf(v) === i);
        notesParts.push(`Frontend: ${files.join(', ')}`);
      }
      if (coverage.e2e && coverage.e2e.length > 0) {
        layers.push('E2E');
        notesParts.push(`E2E: ${coverage.e2e.join(', ')}`);
      }
    }

    // Add new Maestro flows
    if (hasNewMaestro) {
      if (!layers.includes('E2E')) layers.push('E2E');
      const existingE2E = coverage?.e2e || [];
      const newFlows = hasNewMaestro.filter(f => !existingE2E.includes(f));
      if (newFlows.length > 0) {
        notesParts.push(`E2E (new): ${newFlows.join(', ')}`);
        newE2ECount++;
      }
    }

    // Determine type and status
    // Logic: gap_ids = tests with NO coverage. Everything else = covered.
    // New Maestro flows can upgrade a gap to partial/covered.
    let newType, newStatus;

    if (isGap && !hasNewMaestro) {
      // Still a gap - no automated coverage
      newType = 'Manual';
      newStatus = 'Gap';
      gapCount++;
    } else if (isGap && hasNewMaestro) {
      // Was a gap, now has new E2E coverage from Maestro expansion
      if (layers.length >= 2) {
        // Has backend+frontend AND now E2E
        newType = 'Automated';
        newStatus = 'Covered';
        coveredCount++;
      } else {
        newType = 'E2E';
        newStatus = 'Partial';
        partialCount++;
      }
      newE2ECount++;
    } else if (!isGap) {
      // Covered by automation (not in gap list)
      if (coverage) {
        // We have detailed coverage info
        if (coverage.status === 'fully_covered') {
          newType = 'Automated';
          newStatus = 'Covered';
          coveredCount++;
        } else {
          newType = 'Semi-Auto';
          newStatus = 'Partial';
          partialCount++;
        }
      } else {
        // Not in gaps = covered, but no detailed test_cases entry
        // Infer layer from test ID prefix
        const prefix = testId.split('-')[0];
        if (['BA'].includes(prefix)) {
          newType = 'Automated';
          newStatus = 'Covered';
          notesParts.push('Backend: Deno tests');
        } else if (['UI', 'SM'].includes(prefix)) {
          newType = 'Automated';
          newStatus = 'Covered';
          notesParts.push('Frontend: Jest tests');
        } else if (['SC', 'EC', 'AR', 'PM', 'RC', 'NM', 'NF', 'EA'].includes(prefix)) {
          newType = 'Semi-Auto';
          newStatus = 'Covered';
          notesParts.push('Multi-layer coverage');
        } else if (['PR', 'PF'].includes(prefix)) {
          newType = 'Automated';
          newStatus = 'Covered';
          notesParts.push('CI/build checks');
        } else {
          newType = 'Automated';
          newStatus = 'Covered';
        }
        coveredCount++;
      }
    } else {
      newType = 'Manual';
      newStatus = 'Gap';
      gapCount++;
    }

    // Build final notes - strip any previously-generated coverage notes
    const existingNotes = row[notesIdx] || '';
    // Extract only non-coverage parts of existing notes
    const manualNotes = existingNotes
      .split(' | ')
      .filter(p => !p.startsWith('Backend:') && !p.startsWith('Frontend:') && !p.startsWith('E2E') && !p.startsWith('Multi-layer') && !p.startsWith('CI/build'))
      .join(' | ')
      .trim();

    let finalNotes;
    if (notesParts.length > 0) {
      finalNotes = notesParts.join(' | ');
      if (manualNotes) {
        finalNotes += ` | ${manualNotes}`;
      }
    } else {
      finalNotes = manualNotes;
    }

    // Apply updates
    row[typeIdx] = newType;
    row[statusIdx] = newStatus;
    row[notesIdx] = finalNotes;
    updated++;
  }

  // Write updated CSV
  const output = rows.map(row => row.map(escapeCSV).join(',')).join('\n') + '\n';
  fs.writeFileSync(CSV_PATH, output, 'utf8');

  console.log('\n=== CSV Update Complete ===');
  console.log(`  Total rows updated: ${updated}`);
  console.log(`  Covered (Automated): ${coveredCount}`);
  console.log(`  Partial (Semi-Auto): ${partialCount}`);
  console.log(`  Gap (Manual): ${gapCount}`);
  console.log(`  New E2E coverage added: ${newE2ECount}`);
  console.log(`  File: ${CSV_PATH}`);
}

main();
