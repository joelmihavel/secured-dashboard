#!/usr/bin/env node
// pick-story.js — Picks the next available story from prd.json
// Usage: node autobot/pick-story.js [--track ui|backend|state|test|all] [--flow flowId]

const fs = require('fs');
const path = require('path');

const prdPath = path.join(__dirname, 'prd.json');
const prd = JSON.parse(fs.readFileSync(prdPath, 'utf8'));

// Parse arguments
let track = 'all';
let flowId = null;

const trackIdx = process.argv.indexOf('--track');
if (trackIdx !== -1 && process.argv[trackIdx + 1]) {
  track = process.argv[trackIdx + 1];
}

const flowIdx = process.argv.indexOf('--flow');
if (flowIdx !== -1 && process.argv[flowIdx + 1]) {
  flowId = process.argv[flowIdx + 1];
}

// If --flow is specified, load flows.json and get screens for that flow
let flowScreens = null;
if (flowId) {
  const flowsPath = path.join(__dirname, 'flows.json');
  if (fs.existsSync(flowsPath)) {
    const flows = JSON.parse(fs.readFileSync(flowsPath, 'utf8'));
    const flow = flows.flows.find(f => f.id === flowId);
    if (flow) {
      flowScreens = new Set(flow.screens);
    }
  }
}

// Build a set of passing story IDs for dependency checking
const passingIds = new Set(
  prd.stories.filter(s => s.passes === true).map(s => s.id)
);

// Find eligible stories: not passed, not skipped, failCount < 3, deps satisfied
const eligible = prd.stories.filter(s => {
  if (s.passes === true) return false;
  if (s.status === 'skipped' || s.status === 'blocked') return false;
  if ((s.failCount || 0) >= 3) return false;
  if (track !== 'all' && s.track !== track) return false;

  // Flow filter: match stories whose title references one of the flow's screens
  if (flowScreens) {
    const titleLower = s.title.toLowerCase();
    let matchesFlow = false;
    for (const screen of flowScreens) {
      if (titleLower.includes(screen.replace(/-/g, ' ')) || titleLower.includes(screen)) {
        matchesFlow = true;
        break;
      }
    }
    if (!matchesFlow) return false;
  }

  // Check dependencies
  const deps = s.dependsOn || [];
  for (const dep of deps) {
    if (!passingIds.has(dep)) return false;
  }

  return true;
});

if (eligible.length === 0) {
  process.exit(0);
}

// Return the first eligible story (ordered by priority in prd.json)
console.log(JSON.stringify(eligible[0]));
