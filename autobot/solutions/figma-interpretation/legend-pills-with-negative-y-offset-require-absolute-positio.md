# Legend pills with negative y-offset require absolute positioning

## Problem
Figma allows children to have negative y positions within auto-layout frames, which visually places them above the parent's top edge. RN auto-layout (flexbox) cannot produce negative offsets — items always stack positively. Without absolute positioning, these elements render below their intended position.

## Solution
When a Figma node has `layoutPositioning: ABSOLUTE` or a negative y within its parent, use `position: 'absolute'` in RN. Calculate the `top` value as: `parent.y + child.y` relative to the grandparent container.

---

## Source
buildbot/learnings/buildbot-learnings.md
