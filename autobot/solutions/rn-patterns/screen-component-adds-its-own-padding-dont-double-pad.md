# Screen component adds its own padding — don't double-pad

## Problem
The `Screen` wrapper component from `@/src/components` applies SafeArea insets and base padding. Adding `paddingHorizontal` to child views stacks on top of Screen's padding, causing content to be indented too far from the edge. This is especially noticeable on screens where Figma specifies asymmetric padding.

## Solution
Check the Screen component's `padded` prop. If `padded={false}`, manage padding manually in child views. If `padded={true}` (default), don't add horizontal padding to direct children.

## Source
buildbot/learnings/buildbot-learnings.md
