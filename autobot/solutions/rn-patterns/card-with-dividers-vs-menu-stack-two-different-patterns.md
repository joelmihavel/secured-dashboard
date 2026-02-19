# Card-with-dividers vs menu-stack: two different patterns

## Problem
Figma uses two visually similar but structurally different patterns for lists. Confusing them produces wrong spacing and background behavior.

## Solution
- **Card-with-dividers**: Single card container (bg #202020, radius 12) with items separated by thin 0.25px #4D4D4D dividers. Use `gap: 8` between all children. Items have NO individual background.
- **Menu-stack**: Individual cards (each has its own bg #202020, radius 12) separated by `gap: 4`. Each item is independently styled.
Check whether Figma groups items under one parent frame with a background fill (card) or separate sibling frames each with their own fill (menu-stack).

## Source
buildbot/learnings/buildbot-learnings.md
