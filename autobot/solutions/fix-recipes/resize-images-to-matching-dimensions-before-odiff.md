# Resize images to matching dimensions before ODiff

## Problem
ODiff silently accepts mismatched image dimensions but produces meaningless diff percentages (e.g., 45% for images that are visually similar but different sizes). The comparison is pixel-positional, so a 1206x2622 screenshot compared against a 1179x4476 baseline reports massive differences even where content matches.

## Solution
Before calling ODiff, get dimensions of both images with `magick identify -format "%wx%h"`. If they differ, resize the screenshot to match baseline dimensions using `magick {src} -resize {w}x{h}! {dst}`. For images with longest side >2000px, scale both proportionally to cap at 2000px.

## Source
buildbot/learnings/buildbot-learnings.md
