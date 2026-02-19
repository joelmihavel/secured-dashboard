# DottedPattern screens have inherent 8-12% pixel diff

## Problem
DottedPattern backgrounds use SVG rendering in the app but bitmap images in Figma baselines. The SVG-to-bitmap conversion introduces antialiasing differences at dot boundaries that odiff counts as changed pixels. This is not a rendering bug — the visual result is identical to the human eye.

## Solution
Use 18% odiff threshold for any screen with `hasDottedPattern: true` in its blueprint. Never attempt to reduce diff below 8% on these screens — it's structurally impossible without switching to bitmap backgrounds.

## Source
buildbot/learnings/buildbot-learnings.md
