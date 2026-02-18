#!/usr/bin/env node
// pick-flow.js — Picks the next eligible flow from flows.json
// Usage: node autobot/pick-flow.js
//
// Returns JSON of the highest-priority flow where:
// - At least one screen's stories have passes: false
// - All backendDeps and stateDeps are met
// Returns empty string if all flows are complete.

const fs = require('fs');
const path = require('path');

const flowsPath = path.join(__dirname, 'flows.json');
const prdPath = path.join(__dirname, 'prd.json');
const routesPath = path.join(__dirname, '..', 'buildbot', 'config', 'screen-routes.json');

const flows = JSON.parse(fs.readFileSync(flowsPath, 'utf8'));
const prd = JSON.parse(fs.readFileSync(prdPath, 'utf8'));

// Build lookup maps
const passingIds = new Set(
  prd.stories.filter(s => s.passes === true).map(s => s.id)
);

// Check if a dependency ID is met (passes: true in prd.json)
// Dependencies can be story IDs like "B03", "C01", etc.
function isDependencyMet(depId) {
  // Check if any story with this ID (or originalStoryId) is passing
  const match = prd.stories.find(s =>
    (s.id === depId || s.originalStoryId === depId) && s.passes === true
  );
  if (match) return true;

  // Also check if the dep ID itself is in passing set
  return passingIds.has(depId);
}

// Check if a flow has remaining work
function flowHasWork(flow) {
  for (const screen of flow.screens) {
    // Find stories that reference this screen
    const screenStories = prd.stories.filter(s => {
      const titleLower = s.title.toLowerCase();
      return titleLower.includes(screen.replace(/-/g, ' ')) || titleLower.includes(screen);
    });

    // If any story for this screen is not passing and not exhausted, there's work
    const hasUnfinished = screenStories.some(s =>
      !s.passes && s.status !== 'blocked' && s.status !== 'skipped' && (s.failCount || 0) < 3
    );

    if (hasUnfinished) return true;
  }
  return false;
}

// Check if all dependencies for a flow are met
function flowDepsAreMet(flow) {
  for (const dep of (flow.backendDeps || [])) {
    if (!isDependencyMet(dep)) return false;
  }
  for (const dep of (flow.stateDeps || [])) {
    if (!isDependencyMet(dep)) return false;
  }
  return true;
}

// Sort flows by priority (ascending), then find first eligible
const sortedFlows = [...flows.flows].sort((a, b) => a.priority - b.priority);

for (const flow of sortedFlows) {
  if (!flowHasWork(flow)) continue;
  if (!flowDepsAreMet(flow)) continue;

  // Count progress for this flow
  let totalStories = 0;
  let passingStories = 0;
  for (const screen of flow.screens) {
    const screenStories = prd.stories.filter(s => {
      const titleLower = s.title.toLowerCase();
      return titleLower.includes(screen.replace(/-/g, ' ')) || titleLower.includes(screen);
    });
    totalStories += screenStories.length;
    passingStories += screenStories.filter(s => s.passes).length;
  }

  const result = {
    ...flow,
    progress: {
      total: totalStories,
      passing: passingStories,
      remaining: totalStories - passingStories
    }
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

// No eligible flows
process.exit(0);
