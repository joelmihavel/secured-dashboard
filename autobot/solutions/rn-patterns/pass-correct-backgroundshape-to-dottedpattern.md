# Pass correct backgroundShape to DottedPattern

## Problem
Each screen in Figma has a unique background SVG shape. The DottedPattern component has pre-built shape variants keyed by name. Using `default` when the screen has a specific shape creates a visually different background pattern that fails pixel comparison by 5-10%.

## Solution
Check the Figma screen's background frame for the shape asset name. Map it to the available keys: `splash`, `carousel1`, `carousel2`, `carousel3`, `agreement`, `default`. Always verify the key exists before passing it.

## Source
buildbot/learnings/buildbot-learnings.md
