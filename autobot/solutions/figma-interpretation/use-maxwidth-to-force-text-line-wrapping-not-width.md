# Use maxWidth to force text line wrapping, not width

## Problem
Figma text nodes with a fixed width (e.g., 313px) force text to wrap at that boundary. Using RN `width: 313` works but prevents the text from being narrower on smaller screens. Using `maxWidth: 313` preserves the wrapping behavior while remaining responsive. Without either, wider devices allow text to fit on one line when the design shows two.

## Solution
When a Figma text node has `textAutoResize: HEIGHT` (fixed width, variable height), set `maxWidth` equal to the node's width. This forces the same line breaks as Figma without hard-coding width.

## Source
buildbot/learnings/buildbot-learnings.md
