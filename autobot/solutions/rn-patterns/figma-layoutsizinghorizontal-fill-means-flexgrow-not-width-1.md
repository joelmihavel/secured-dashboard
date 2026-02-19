# Figma layoutSizingHorizontal FILL means flexGrow, not width 100%

## Problem
`width: '100%'` is relative to the parent's content area after padding, which can cause overflow or underflow when siblings exist. `flexGrow: 1` correctly fills remaining space in a flex container, which is what Figma's FILL sizing behavior does.

## Solution
Map Figma layout sizing: `FILL` → `flex: 1` (or `flexGrow: 1`), `FIXED` → explicit width/height, `HUG` → no explicit size (let content determine).

---

## Source
buildbot/learnings/buildbot-learnings.md
