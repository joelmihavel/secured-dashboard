# Always provide demo data with mixed statuses for chart components

## Problem
When charts have no data or all-same-status data, bars render at minimum height (1px) with colors that blend into the dark background (#4D4D4D on #131313). This makes the entire chart appear empty, which is indistinguishable from a rendering bug. Visual inspection then flags P0 "bars invisible" issues that are actually data issues.

## Solution
Create demo data that exercises all visual states. For payment history: at least one `ontime` (tall white bar), one `late` (medium white bar), and remaining `unpaid` (1px dark bar). Match the exact distribution shown in Figma (e.g., JAN=ontime/99px, FEB=late/56px, MAR-DEC=unpaid/1px).

## Source
buildbot/learnings/buildbot-learnings.md
