#!/usr/bin/env node
// mark-story.js — Updates a story's status in prd.json
// Usage: node autobot/mark-story.js <storyId> --pass|--fail "reason"|--skip --reason "reason"|--timeout|--crash

const fs = require('fs');
const path = require('path');

const prdPath = path.join(__dirname, 'prd.json');
const prd = JSON.parse(fs.readFileSync(prdPath, 'utf8'));

const storyId = process.argv[2];
if (!storyId) {
  console.error('Usage: node mark-story.js <storyId> --pass|--fail "reason"|--skip|--timeout|--crash');
  process.exit(1);
}

const story = prd.stories.find(s => s.id === storyId);
if (!story) {
  console.error(`Story not found: ${storyId}`);
  process.exit(1);
}

const action = process.argv[3];
const now = new Date().toISOString();

switch (action) {
  case '--pass':
    story.passes = true;
    story.status = 'completed';
    story.completedAt = now;
    console.log(`PASS: ${storyId} marked as completed`);
    break;

  case '--fail': {
    const reason = process.argv[4] || 'unknown failure';
    story.failCount = (story.failCount || 0) + 1;
    story.failNotes = ((story.failNotes || '') + `\n[${now}] ${reason}`).trim();
    story.status = story.failCount >= 3 ? 'blocked' : 'pending';
    console.log(`FAIL: ${storyId} (attempt ${story.failCount}/3): ${reason}`);
    if (story.failCount >= 3) {
      console.log(`  -> Story BLOCKED after 3 failures`);
    }
    break;
  }

  case '--skip': {
    const reasonIdx = process.argv.indexOf('--reason');
    const skipReason = reasonIdx !== -1 ? process.argv[reasonIdx + 1] : 'unknown';
    story.status = 'skipped';
    story.failNotes = ((story.failNotes || '') + `\n[${now}] Skipped: ${skipReason}`).trim();
    console.log(`SKIP: ${storyId}: ${skipReason}`);
    break;
  }

  case '--timeout':
    story.failCount = (story.failCount || 0) + 1;
    story.failNotes = ((story.failNotes || '') + `\n[${now}] Timed out`).trim();
    story.status = story.failCount >= 3 ? 'blocked' : 'pending';
    console.log(`TIMEOUT: ${storyId} (attempt ${story.failCount}/3)`);
    break;

  case '--crash':
    story.failCount = (story.failCount || 0) + 1;
    story.failNotes = ((story.failNotes || '') + `\n[${now}] Process crashed`).trim();
    story.status = story.failCount >= 3 ? 'blocked' : 'pending';
    console.log(`CRASH: ${storyId} (attempt ${story.failCount}/3)`);
    break;

  default:
    console.error(`Unknown action: ${action}`);
    console.error('Valid: --pass, --fail "reason", --skip --reason "reason", --timeout, --crash');
    process.exit(1);
}

// Update meta counts
prd.meta = prd.meta || {};
prd.meta.completed = prd.stories.filter(s => s.passes === true).length;
prd.meta.failed = prd.stories.filter(s => s.status === 'blocked').length;
prd.meta.lastUpdated = now;

fs.writeFileSync(prdPath, JSON.stringify(prd, null, 2) + '\n');
