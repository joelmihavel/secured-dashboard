# Compose fill opacity and node opacity separately

## Problem
Figma stores fill opacity (per-fill) and node opacity (container-level) independently. The final visual opacity is `fill.opacity * node.opacity`. Using only one of them produces wrong transparency levels, especially on overlapping elements.

## Solution
Compute `finalOpacity = fill.opacity * node.opacity`. Apply fill opacity via color alpha channel (e.g., `rgba(r, g, b, fillOpacity)`) and node opacity via RN `opacity` prop only when the node itself is transparent.

## Source
buildbot/learnings/buildbot-learnings.md
