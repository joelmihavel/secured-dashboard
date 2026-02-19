# Use 4x design height threshold for shouldSkipNode, not 1x

## Problem
Scrollable screens in Figma extend well beyond the viewport height (e.g., profile screen is 1492px tall vs 852px viewport). A 1x threshold skips all content below the fold, which for profile-type screens means Payment Information, Support, and App sections are never extracted. The entire lower half of the screen goes missing.

## Solution
Set the shouldSkipNode threshold to `designHeight * 4` (e.g., 3408px for a 852px screen). This captures all content in even the longest scrollable screens while still filtering out off-canvas elements.

## Source
buildbot/learnings/buildbot-learnings.md
