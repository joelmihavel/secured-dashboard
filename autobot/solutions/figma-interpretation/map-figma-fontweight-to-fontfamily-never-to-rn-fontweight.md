# Map Figma fontWeight to fontFamily, never to RN fontWeight

## Problem
RN's `fontWeight` prop resolves to system fonts, not custom font files. Setting `fontWeight: '400'` renders the system default, not PlusJakartaSans-Regular. The visual difference is subtle enough to pass casual review but fails pixel comparison.

## Solution
Use the static mapping and set `fontFamily` directly:
- 400 → `PlusJakartaSans-Regular`
- 500 → `PlusJakartaSans-Medium`
- 600 → `PlusJakartaSans-SemiBold`
- 700 → `PlusJakartaSans-Bold`
Never set the `fontWeight` style property on any element using a custom font.

## Source
buildbot/learnings/buildbot-learnings.md
