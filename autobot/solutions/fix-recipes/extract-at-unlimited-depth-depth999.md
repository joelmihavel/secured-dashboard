# Extract at unlimited depth (depth=999)

## Problem
Default extraction depth misses nested component internals. A button component at depth 3 contains text, icon, and background at depths 4-6. Shallow extraction sees "Button" but not its contents, so the builder cannot replicate typography, colors, or icon sizing inside components.

## Solution
Always pass `depth=999` or equivalent unlimited depth to the Figma API `nodes` endpoint. The performance cost is minimal compared to the cost of re-extracting with more depth.

## Source
buildbot/learnings/buildbot-learnings.md
