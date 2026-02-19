# Check Figma visible property on all elements before rendering

## Problem
Designers use visibility toggling to create state variants within the same Figma frame. An element with `visible: false` or `fill.visible: false` is intentionally hidden in that state. Rendering it produces UI elements the user was never meant to see.

## Solution
During extraction, mark elements with `visible: false` as `shouldRender: false`. During building, skip any node marked as not visible. The check applies to both the node's `visible` property and individual fill visibility.

---

## Source
buildbot/learnings/buildbot-learnings.md
