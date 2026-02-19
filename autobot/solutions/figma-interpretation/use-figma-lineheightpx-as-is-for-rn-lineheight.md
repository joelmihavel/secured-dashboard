# Use Figma lineHeightPx as-is for RN lineHeight

## Problem
Figma reports `lineHeightPx` as the resolved pixel value. Calculating `lineHeight = fontSize * lineHeightMultiplier` introduces floating-point drift that compounds across multi-line text, causing vertical rhythm misalignment.

## Solution
Read `style.lineHeightPx` from the Figma node and assign it directly to `lineHeight` in RN. Don't derive it from fontSize or lineHeightUnit.

## Source
buildbot/learnings/buildbot-learnings.md
