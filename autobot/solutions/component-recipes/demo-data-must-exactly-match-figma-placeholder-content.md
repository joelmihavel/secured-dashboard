# Demo data must exactly match Figma placeholder content

## Problem
Coverage checks and visual inspections compare rendered text against Figma content. If mock data says "John Doe" but Figma says "Rohan Joshi", the coverage check flags a text content mismatch. More importantly, different name lengths affect layout (line wrapping, truncation) which causes visual diffs.

## Solution
Extract placeholder text from Figma nodes (`characters` field) and use those exact strings in demo/mock data. Only deviate for fields that are explicitly dynamic (e.g., user's actual name from auth).

## Source
buildbot/learnings/buildbot-learnings.md
