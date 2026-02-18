#!/usr/bin/env node
// count-remaining.js — Counts stories that still need work
// Usage: node autobot/count-remaining.js [--track ui|backend|state|test|all]

const fs = require('fs');
const path = require('path');

const prdPath = path.join(__dirname, 'prd.json');
const prd = JSON.parse(fs.readFileSync(prdPath, 'utf8'));

let track = 'all';
const trackIdx = process.argv.indexOf('--track');
if (trackIdx !== -1 && process.argv[trackIdx + 1]) {
  track = process.argv[trackIdx + 1];
}

const remaining = prd.stories.filter(s => {
  if (s.passes === true) return false;
  if (s.status === 'blocked' || s.status === 'skipped') return false;
  if ((s.failCount || 0) >= 3) return false;
  if (track !== 'all' && s.track !== track) return false;
  return true;
});

console.log(remaining.length.toString());
