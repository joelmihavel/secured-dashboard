# Check fill.visible before rendering any text element

## Problem
Figma designers hide elements by setting `fill.visible=false` rather than deleting nodes. The node still exists in the tree with valid text content, so extractors and builders include it by default. This causes ghost elements to appear in the UI that were intentionally hidden in the design.

## Solution
Before rendering any text node, check `fills[0].visible !== false`. If the fill is hidden, exclude the element entirely — don't just set opacity to 0.

## Source
buildbot/learnings/buildbot-learnings.md
