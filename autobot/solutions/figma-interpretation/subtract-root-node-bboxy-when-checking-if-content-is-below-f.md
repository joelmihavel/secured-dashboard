# Subtract root node bbox.y when checking if content is below fold

## Problem
Figma `absoluteBoundingBox` uses canvas-absolute coordinates. A screen positioned at y=3857 on the canvas would have its top content at y=3857, not y=0. Comparing raw bbox.y against designHeight causes the extractor to skip ALL nodes when the screen is far from canvas origin.

## Solution
Calculate relative position: `relativeY = node.absoluteBoundingBox.y - rootNode.absoluteBoundingBox.y`. Compare `relativeY` against `designHeight`, not `node.absoluteBoundingBox.y`.

## Source
buildbot/learnings/buildbot-learnings.md
